import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { DATA_DIR } from "./config.ts";
import type { ModelSelection, RuntimeEvent } from "./contracts.ts";
import { formatAutonomyOutcome, parseAutonomyOutcomeEnvelope, stripAutonomyOutcomeEnvelope } from "./autonomy-outcome.ts";

export type RoutineSchedule =
  | { type: "once"; at: number }
  | { type: "daily"; time: string; weekdays: number[] }
  /** Recurring watch: every N minutes, optionally boxed into a daily
   * HH:MM window, on the chosen weekdays. Occurrences are anchored to the
   * window start (midnight when unset) so runs land on predictable marks
   * (09:00, 09:30, …) instead of drifting from the creation moment. */
  | { type: "interval"; everyMinutes: number; start?: string; end?: string; weekdays: number[] };

/** `cloud` runs the agent itself inside the bot's Box VM. `maus` keeps
 * using the provider selected on the MAUS and only borrows its configured
 * computer tools, if any. */
export type RoutineRunOn = "maus" | "cloud";

export type RoutineRunTrigger = "schedule" | "manual" | "webhook";

export type RoutineRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled"
  | "missed";

export interface Routine {
  id: string;
  name: string;
  prompt: string;
  botId: string;
  runOn: RoutineRunOn;
  enabled: boolean;
  schedule: RoutineSchedule;
  durationMinutes: number;
  precheck?: RoutinePrecheck;
  precheckState?: string;
  modelSelection?: ModelSelection;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineRun {
  id: string;
  routineId: string;
  routineName: string;
  /** Snapshot the work so an edited/deleted definition cannot rewrite history. */
  prompt?: string;
  durationMinutes?: number;
  botId: string;
  runOn: RoutineRunOn;
  scheduledFor: number;
  status: RoutineRunStatus;
  manual: boolean;
  /** Why this receipt exists. Kept optional so version-1 files migrate in place. */
  triggerSource?: RoutineRunTrigger;
  webhookId?: string;
  deliveryId?: string;
  threadId?: string;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  error?: string;
  precheckNote?: string;
  modelSelection?: ModelSelection;
  cost?: number | null;
  denials?: string[];
  createdAt: number;
  seenAt?: number;
}

export interface RoutineInput {
  name: string;
  prompt: string;
  botId: string;
  runOn?: RoutineRunOn;
  enabled?: boolean;
  schedule: RoutineSchedule;
  durationMinutes?: number;
  precheck?: RoutinePrecheck;
  modelSelection?: ModelSelection;
}

export type RoutinePrecheck =
  | { kind: "http"; url: string; jsonPath?: string }
  | { kind: "command"; command: string };

interface RoutineFile {
  version: 1;
  routines: Routine[];
  runs: RoutineRun[];
}

export interface RoutineManagerOptions {
  file?: string;
  now?: () => number;
  /** Keyed frames only: every payload on this bus is `{ kind, … }`, which
   * is what lets the server number and replay them. */
  emit?: (payload: Record<string, unknown>) => void;
  botState: (botId: string) => "ready" | "busy" | "missing";
  /** The persistent task this automation runs in — reused across runs (one
   * durable feed per routine/webhook), keyed by `routineId`. */
  taskForRun: (botId: string, routineId: string, title: string) => { threadId: string } | null;
  startTurn: (
    botId: string,
    threadId: string,
    prompt: string,
    runOn: RoutineRunOn,
    triggerSource: RoutineRunTrigger,
    onDispatchError: (message: string) => void,
    modelSelection?: ModelSelection,
  ) => Promise<void>;
  interruptTurn?: (botId: string, threadId: string, runOn: RoutineRunOn) => Promise<void>;
  onRunFailed?: (run: RoutineRun) => void;
  validateModelSelection?: (selection: ModelSelection) => void;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const CATCH_UP_MS = 12 * 60 * 60_000;
const MAX_RUNS = 2_000;

function cleanDays(days: unknown): number[] {
  if (!Array.isArray(days)) return ALL_DAYS;
  const out = [...new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return out.length ? out : ALL_DAYS;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function cleanSchedule(schedule: RoutineSchedule): RoutineSchedule {
  if (schedule?.type === "once") {
    const at = Number(schedule.at);
    if (!Number.isFinite(at)) throw new Error("Choose a valid date and time");
    return { type: "once", at };
  }
  if (schedule?.type === "daily") {
    const time = String(schedule.time ?? "");
    if (!TIME_RE.test(time)) throw new Error("Time must use HH:MM");
    return { type: "daily", time, weekdays: cleanDays(schedule.weekdays) };
  }
  if (schedule?.type === "interval") {
    const everyMinutes = Math.round(Number(schedule.everyMinutes));
    if (!Number.isFinite(everyMinutes) || everyMinutes < 5 || everyMinutes > 1440) {
      throw new Error("Repeat every 5 minutes to 24 hours");
    }
    const start = schedule.start == null || schedule.start === "" ? undefined : String(schedule.start);
    const end = schedule.end == null || schedule.end === "" ? undefined : String(schedule.end);
    if (start !== undefined && !TIME_RE.test(start)) throw new Error("Start time must use HH:MM");
    if (end !== undefined && !TIME_RE.test(end)) throw new Error("End time must use HH:MM");
    if (start !== undefined && end !== undefined && minutesOf(end) <= minutesOf(start)) {
      throw new Error("The end time must be after the start time");
    }
    return { type: "interval", everyMinutes, ...(start ? { start } : {}), ...(end ? { end } : {}), weekdays: cleanDays(schedule.weekdays) };
  }
  throw new Error("Choose a supported schedule");
}

function cleanPrecheck(value: unknown): RoutinePrecheck | undefined {
  if (value == null || value === false) return undefined;
  if (!value || typeof value !== "object") throw new Error("Pre-check must be a local HTTP URL or command");
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "command") {
    const command = String(candidate.command ?? "").trim().slice(0, 2_000);
    if (!command) throw new Error("Pre-check command cannot be empty");
    return { kind: "command", command };
  }
  if (candidate.kind === "http") {
    const raw = String(candidate.url ?? "").trim();
    let parsed: URL;
    try { parsed = new URL(raw); } catch { throw new Error("Pre-check URL must be local"); }
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error("Pre-check URL must point to localhost");
    }
    const jsonPath = candidate.jsonPath == null ? undefined : String(candidate.jsonPath).trim().slice(0, 200);
    return { kind: "http", url: parsed.toString(), ...(jsonPath ? { jsonPath } : {}) };
  }
  throw new Error("Pre-check must be a local HTTP URL or command");
}

/** Next wall-clock occurrence in this computer's timezone, strictly after `after`. */
export function nextOccurrence(schedule: RoutineSchedule, after: number): number | null {
  if (schedule.type === "once") return schedule.at > after ? schedule.at : null;
  const weekdays = new Set(cleanDays(schedule.weekdays));
  if (schedule.type === "interval") {
    const every = schedule.everyMinutes * 60_000;
    for (let offset = 0; offset <= 8; offset++) {
      const day = new Date(after);
      day.setDate(day.getDate() + offset);
      const [startHour, startMinute] = (schedule.start ?? "00:00").split(":").map(Number);
      const [endHour, endMinute] = (schedule.end ?? "23:59").split(":").map(Number);
      const windowStart = new Date(day);
      windowStart.setHours(startHour, startMinute, 0, 0);
      const windowEnd = new Date(day);
      windowEnd.setHours(endHour, endMinute, 0, 0);
      if (!weekdays.has(windowStart.getDay())) continue;
      let candidate = windowStart.getTime();
      if (candidate <= after) {
        const steps = Math.floor((after - candidate) / every) + 1;
        candidate += steps * every;
      }
      if (candidate > after && candidate <= windowEnd.getTime()) return candidate;
    }
    return null;
  }
  const [hour, minute] = schedule.time.split(":").map(Number);
  for (let offset = 0; offset <= 8; offset++) {
    const d = new Date(after);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() > after && weekdays.has(d.getDay())) return d.getTime();
  }
  return null;
}

function sanitizeInput(input: RoutineInput): Omit<Routine, "id" | "createdAt" | "updatedAt" | "nextRunAt"> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const prompt = String(input.prompt ?? "").trim().slice(0, 20_000);
  const botId = String(input.botId ?? "").trim();
  if (!name) throw new Error("Give the routine a name");
  if (!prompt) throw new Error("Tell the bot what to do");
  if (!botId) throw new Error("Choose a bot");
  const runOn = input.runOn ?? "maus";
  if (runOn !== "maus" && runOn !== "cloud") throw new Error("Choose where this routine runs");
  const precheck = cleanPrecheck(input.precheck);
  const modelSelection = input.modelSelection == null ? undefined : {
    instanceId: String(input.modelSelection.instanceId ?? "").trim(),
    model: String(input.modelSelection.model ?? "").trim(),
    ...(input.modelSelection.effort ? { effort: input.modelSelection.effort } : {}),
  };
  if (modelSelection && (!modelSelection.instanceId || !modelSelection.model)) throw new Error("Routine model selection is incomplete");
  return {
    name,
    prompt,
    botId,
    runOn,
    enabled: input.enabled !== false,
    schedule: cleanSchedule(input.schedule),
    durationMinutes: Math.min(240, Math.max(15, Math.round(Number(input.durationMinutes) || 30))),
    ...(precheck ? { precheck } : {}),
    ...(modelSelection ? { modelSelection } : {}),
  };
}

const execFileAsync = promisify(execFile);

function jsonPathValue(value: unknown, jsonPath?: string): unknown {
  if (!jsonPath) return value;
  return jsonPath.split(".").filter(Boolean).reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

async function readPrecheck(precheck: RoutinePrecheck): Promise<{ value?: string; error?: string }> {
  try {
    let raw: unknown;
    if (precheck.kind === "command") {
      const result = await execFileAsync("/bin/zsh", ["-lc", precheck.command], { timeout: 10_000, maxBuffer: 64 * 1024 });
      raw = result.stdout.trim();
    } else {
      const response = await fetch(precheck.url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      try { raw = JSON.parse(text); } catch { raw = text.trim(); }
      raw = jsonPathValue(raw, precheck.jsonPath);
    }
    if (raw == null) return { value: "<missing>" };
    return { value: typeof raw === "string" ? raw : JSON.stringify(raw) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export class RoutineManager {
  private readonly file: string;
  private readonly now: () => number;
  private readonly options: RoutineManagerOptions;
  private routines: Routine[] = [];
  private runs: RoutineRun[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(options: RoutineManagerOptions) {
    this.options = options;
    this.file = options.file ?? join(DATA_DIR, "routines.json");
    this.now = options.now ?? Date.now;
    try {
      const disk = JSON.parse(readFileSync(this.file, "utf8")) as Partial<RoutineFile>;
      this.routines = Array.isArray(disk.routines)
        ? disk.routines.map((routine) => ({ ...routine, runOn: routine.runOn ?? "maus" }))
        : [];
      this.runs = Array.isArray(disk.runs)
        ? disk.runs.map((run) => ({ ...run, runOn: run.runOn ?? "maus" }))
        : [];
    } catch {
      this.routines = [];
      this.runs = [];
    }
    // A local process cannot still own these turns after a full restart.
    const recovered: RoutineRun[] = [];
    for (const run of this.runs) {
      if (run.status === "running" || run.status === "waiting") {
        run.status = "failed";
        run.error = "WatcherBotRoom restarted while this routine was running";
        run.finishedAt = this.now();
        recovered.push({ ...run });
      }
    }
    if (recovered.length > 0) {
      this.save();
      for (const run of recovered) this.options.onRunFailed?.(run);
    }
  }

  listRoutines(): Routine[] {
    return this.routines.map((r) => ({ ...r, schedule: { ...r.schedule } }));
  }

  listRuns(from?: number, to?: number): RoutineRun[] {
    return this.runs
      .filter((r) => (from == null || r.scheduledFor >= from) && (to == null || r.scheduledFor <= to))
      .sort((a, b) => b.scheduledFor - a.scheduledFor)
      .map((r) => ({ ...r }));
  }

  activeRunForBot(botId: string): RoutineRun | null {
    const run = this.runs.find(
      (candidate) => candidate.botId === botId && ["running", "waiting"].includes(candidate.status),
    );
    return run ? { ...run } : null;
  }

  isActiveThread(threadId: string): boolean {
    return this.runs.some(
      (run) => run.threadId === threadId && ["running", "waiting"].includes(run.status),
    );
  }

  create(input: RoutineInput): Routine {
    const clean = sanitizeInput(input);
    if (this.options.botState(clean.botId) === "missing") throw new Error("That bot no longer exists");
    if (clean.modelSelection) this.options.validateModelSelection?.(clean.modelSelection);
    const at = this.now();
    const routine: Routine = {
      id: randomUUID(),
      ...clean,
      nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, at) : null,
      createdAt: at,
      updatedAt: at,
    };
    this.routines.unshift(routine);
    this.save();
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  update(id: string, patch: Partial<RoutineInput>): Routine | null {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    const clean = sanitizeInput({
      name: patch.name ?? routine.name,
      prompt: patch.prompt ?? routine.prompt,
      botId: patch.botId ?? routine.botId,
      runOn: patch.runOn ?? routine.runOn,
      enabled: patch.enabled ?? routine.enabled,
      schedule: patch.schedule ?? routine.schedule,
      durationMinutes: patch.durationMinutes ?? routine.durationMinutes,
      precheck: patch.precheck ?? routine.precheck,
      modelSelection: patch.modelSelection ?? routine.modelSelection,
    });
    if (this.options.botState(clean.botId) === "missing") throw new Error("That bot no longer exists");
    if (clean.modelSelection) this.options.validateModelSelection?.(clean.modelSelection);
    Object.assign(routine, clean, {
      nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, this.now()) : null,
      updatedAt: this.now(),
    });
    if (patch.enabled === false) {
      for (const run of this.runs) {
        if (run.routineId !== routine.id || run.status !== "queued") continue;
        run.status = "cancelled";
        run.finishedAt = this.now();
        run.error = "The routine was paused before this run started";
        this.emitRun(run);
      }
    }
    this.save();
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  remove(id: string): boolean {
    const at = this.routines.findIndex((r) => r.id === id);
    if (at === -1) return false;
    this.routines.splice(at, 1);
    for (const run of this.runs) {
      if (run.routineId === id && run.status === "queued") {
        run.status = "cancelled";
        run.finishedAt = this.now();
        this.emitRun(run);
      }
    }
    this.save();
    this.options.emit?.({ kind: "routine.deleted", routineId: id });
    return true;
  }

  disableForBot(botId: string) {
    let changed = false;
    for (const routine of this.routines) {
      if (routine.botId !== botId || !routine.enabled) continue;
      routine.enabled = false;
      routine.nextRunAt = null;
      routine.updatedAt = this.now();
      this.emitRoutine(routine);
      changed = true;
    }
    for (const run of this.runs) {
      if (run.botId !== botId || !["queued", "running", "waiting"].includes(run.status)) continue;
      run.status = "cancelled";
      run.finishedAt = this.now();
      run.error = "The assigned bot was deleted";
      this.emitRun(run);
      if (run.threadId) void this.options.interruptTurn?.(run.botId, run.threadId, run.runOn ?? "maus").catch(() => {});
      changed = true;
    }
    if (changed) this.save();
  }

  /** Latching half of the fleet emergency stop. Scheduled definitions stay
   * paused until the person explicitly enables them again; active and queued
   * receipts remain as an honest cancelled history rather than disappearing. */
  async pauseAll(reason = "Emergency stop pressed"): Promise<{
    pausedRoutines: number;
    cancelledRuns: number;
    interruptedRuns: number;
  }> {
    let pausedRoutines = 0;
    let cancelledRuns = 0;
    const interrupts: Promise<void>[] = [];
    const at = this.now();

    for (const routine of this.routines) {
      if (!routine.enabled) continue;
      routine.enabled = false;
      routine.nextRunAt = null;
      routine.updatedAt = at;
      this.emitRoutine(routine);
      pausedRoutines += 1;
    }
    for (const run of this.runs) {
      if (!["queued", "running", "waiting"].includes(run.status)) continue;
      const wasActive = run.status === "running" || run.status === "waiting";
      run.status = "cancelled";
      run.finishedAt = at;
      run.error = reason.slice(0, 500);
      this.emitRun(run);
      cancelledRuns += 1;
      if (wasActive && run.threadId && this.options.interruptTurn) {
        interrupts.push(
          this.options.interruptTurn(run.botId, run.threadId, run.runOn ?? "maus").catch(() => {}),
        );
      }
    }
    if (pausedRoutines || cancelledRuns) this.save();
    await Promise.allSettled(interrupts);
    return { pausedRoutines, cancelledRuns, interruptedRuns: interrupts.length };
  }

  runNow(id: string): RoutineRun | null {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    const run = this.newRun(routine, this.now(), true);
    this.save();
    this.emitRun(run);
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  /** Queue an event-driven job without inventing a calendar schedule. Webhook
   * definitions live in their own store; the execution receipt deliberately
   * reuses this manager so busy-bot ordering, task creation and VM routing stay
   * identical for every unattended job. */
  enqueueWebhook(input: {
    webhookId: string;
    webhookName: string;
    prompt: string;
    botId: string;
    runOn: RoutineRunOn;
    deliveryId: string;
    receivedAt: number;
  }): RoutineRun {
    if (this.options.botState(input.botId) === "missing") {
      throw Object.assign(new Error("The assigned MAUS no longer exists"), { status: 410 });
    }
    const run: RoutineRun = {
      id: randomUUID(),
      routineId: input.webhookId,
      routineName: input.webhookName,
      prompt: input.prompt,
      botId: input.botId,
      runOn: input.runOn,
      scheduledFor: input.receivedAt,
      status: "queued",
      manual: false,
      triggerSource: "webhook",
      webhookId: input.webhookId,
      deliveryId: input.deliveryId,
      createdAt: this.now(),
    };
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    this.save();
    this.emitRun(run);
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  activeWebhookRunCount(webhookId: string): number {
    return this.runs.filter(
      (run) => run.webhookId === webhookId && ["queued", "running", "waiting"].includes(run.status),
    ).length;
  }

  cancelQueuedWebhook(webhookId: string, message: string): void {
    let changed = false;
    for (const run of this.runs) {
      if (run.webhookId !== webhookId || run.status !== "queued") continue;
      run.status = "cancelled";
      run.finishedAt = this.now();
      run.error = message.slice(0, 500);
      this.emitRun(run);
      changed = true;
    }
    if (changed) this.save();
  }

  async cancelRun(id: string): Promise<RoutineRun | null> {
    const run = this.runs.find((r) => r.id === id);
    if (!run || !["queued", "running", "waiting"].includes(run.status)) return null;
    run.status = "cancelled";
    run.finishedAt = this.now();
    this.save();
    this.emitRun(run);
    if (run.threadId) await this.options.interruptTurn?.(run.botId, run.threadId, run.runOn ?? "maus").catch(() => {});
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  markSeen(id: string): RoutineRun | null {
    const run = this.runs.find((r) => r.id === id);
    if (!run) return null;
    if (!run.seenAt) {
      run.seenAt = this.now();
      this.save();
      this.emitRun(run);
    }
    return { ...run };
  }

  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.now();
      let changed = false;
      for (const routine of this.routines) {
        if (!routine.enabled || routine.nextRunAt == null || routine.nextRunAt > now) continue;
        const scheduledFor = routine.nextRunAt;
        const late = now - scheduledFor;
        if (late > CATCH_UP_MS) {
          const missed = this.newRun(routine, scheduledFor, false);
          missed.status = "missed";
          missed.finishedAt = now;
          missed.error = "This computer was offline for more than 12 hours after the scheduled time";
          this.emitRun(missed);
        } else if (
          routine.schedule.type === "interval" &&
          this.runs.some((r) => r.routineId === routine.id && ["queued", "running", "waiting"].includes(r.status))
        ) {
          // A tight interval must not stack work behind a slow or stuck run —
          // the queue would drain as a burst of stale back-to-back turns.
          // The skipped occurrence still gets an honest receipt.
          const skipped = this.newRun(routine, scheduledFor, false);
          skipped.status = "missed";
          skipped.finishedAt = now;
          skipped.error = "Skipped: the previous run of this routine was still going";
          this.emitRun(skipped);
        } else if (routine.precheck) {
          const check = await readPrecheck(routine.precheck);
          if (check.value !== undefined && routine.precheckState === check.value) {
            const skipped = this.newRun(routine, scheduledFor, false);
            skipped.status = "skipped";
            skipped.finishedAt = now;
            skipped.precheckNote = "Pre-check: no change";
            this.emitRun(skipped);
          } else {
            if (check.value !== undefined) routine.precheckState = check.value;
            const run = this.newRun(routine, scheduledFor, false);
            if (check.error) run.precheckNote = `Pre-check failed; ran anyway: ${check.error}`;
            this.emitRun(run);
          }
        } else {
          const run = this.newRun(routine, scheduledFor, false);
          this.emitRun(run);
        }
        routine.nextRunAt =
          routine.schedule.type === "once" ? null : nextOccurrence(routine.schedule, Math.max(now, scheduledFor));
        if (routine.schedule.type === "once") routine.enabled = false;
        routine.updatedAt = now;
        this.emitRoutine(routine);
        changed = true;
      }
      if (changed) this.save();

      // Insertion order IS delivery order. `this.runs` is oldest-first, and
      // draining it newest-first made a burst of queued webhook deliveries
      // (e.g. Sniper signals while the bot was busy) run in reverse.
      for (const run of [...this.runs]) {
        if (run.status !== "queued") continue;
        const state = this.options.botState(run.botId);
        if (state === "busy") continue;
        if (state === "missing") {
          this.failRun(run, "The assigned bot no longer exists");
          continue;
        }
        // Every run of an automation lands in the SAME persistent task, so
        // its messages accumulate as one durable conversation. The task is
        // never activated: webhook runs must not steal the visible
        // conversation — activating their task switched the UI to a new
        // thread on every event, making the user's live conversation
        // "disappear" (Janua, 2026-08-25).
        const task = this.options.taskForRun(run.botId, run.routineId, run.routineName);
        if (!task) {
          this.failRun(run, "Could not create a task for this run");
          continue;
        }
        run.threadId = task.threadId;
        run.startedAt = this.now();
        run.status = "running";
        this.save();
        this.emitRun(run);
        try {
          const prompt = run.prompt ?? this.routines.find((r) => r.id === run.routineId)?.prompt;
          if (!prompt) {
            this.failThread(task.threadId, "The routine was deleted before it could start");
            continue;
          }
          const triggerSource = run.triggerSource ?? (run.manual ? "manual" : "schedule");
          await this.options.startTurn(
            run.botId,
            task.threadId,
            prompt,
            run.runOn ?? "maus",
            triggerSource,
            (message) => this.failThread(task.threadId, message),
            run.modelSelection,
          );
        } catch (error) {
          this.failThread(task.threadId, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  handleRuntimeEvent(event: RuntimeEvent): RoutineRun | null {
    const run = this.runs.find((r) => r.threadId === event.threadId && ["running", "waiting"].includes(r.status));
    if (!run) return null;
    if (event.type === "request.opened") {
      run.status = "waiting";
    } else if (event.type === "request.resolved") {
      run.status = "running";
    } else if (event.type === "item.completed" && event.itemType === "assistant_text") {
      const prose = stripAutonomyOutcomeEnvelope(event.text);
      const outcome = parseAutonomyOutcomeEnvelope(event.text);
      run.output = (prose || (outcome ? formatAutonomyOutcome(outcome) : "")).slice(0, 2_000);
    } else if (event.type === "runtime.error") {
      run.error = event.message.slice(0, 500);
    } else if (event.type === "turn.completed") {
      run.cost = event.cost;
      run.denials = event.denials;
      if (!event.ok) {
        this.failRun(run, event.stopReason ?? run.error ?? "The bot did not complete this run");
        queueMicrotask(() => void this.tick());
        return { ...run };
      }
      // A scheduled/manual routine exists to come back to the user. Provider
      // success without a human-visible answer is failed delivery, not a
      // completed reminder. Webhooks may deliberately stay quiet when their
      // watched input did not change.
      const triggerSource = run.triggerSource ?? (run.manual ? "manual" : "schedule");
      if (triggerSource !== "webhook" && !run.output?.trim()) {
        this.failRun(run, "The bot finished without producing a message for you");
        queueMicrotask(() => void this.tick());
        return { ...run };
      }
      run.status = "completed";
      run.finishedAt = this.now();
      run.error = undefined;
    } else {
      return null;
    }
    this.save();
    this.emitRun(run);
    if (event.type === "turn.completed") queueMicrotask(() => void this.tick());
    return { ...run };
  }

  failThread(threadId: string, message: string) {
    const run = this.runs.find((r) => r.threadId === threadId && ["running", "waiting"].includes(r.status));
    if (!run) return;
    this.failRun(run, message);
    queueMicrotask(() => void this.tick());
  }

  private failRun(run: RoutineRun, message: string) {
    run.status = "failed";
    run.error = message.slice(0, 500);
    run.finishedAt = this.now();
    this.save();
    this.emitRun(run);
    this.options.onRunFailed?.({ ...run });
  }

  private initialOccurrence(schedule: RoutineSchedule, now: number): number | null {
    if (schedule.type === "once") return Math.max(schedule.at, now);
    return nextOccurrence(schedule, now);
  }

  private newRun(routine: Routine, scheduledFor: number, manual: boolean): RoutineRun {
    const run: RoutineRun = {
      id: randomUUID(),
      routineId: routine.id,
      routineName: routine.name,
      prompt: routine.prompt,
      durationMinutes: routine.durationMinutes,
      botId: routine.botId,
      runOn: routine.runOn ?? "maus",
      ...(routine.modelSelection ? { modelSelection: routine.modelSelection } : {}),
      scheduledFor,
      status: "queued",
      manual,
      triggerSource: manual ? "manual" : "schedule",
      createdAt: this.now(),
    };
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    return run;
  }

  private emitRoutine(routine: Routine) {
    this.options.emit?.({ kind: "routine", routine: { ...routine, schedule: { ...routine.schedule } } });
  }

  private emitRun(run: RoutineRun) {
    this.options.emit?.({ kind: "routine.run", run: { ...run } });
  }

  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, routines: this.routines, runs: this.runs } satisfies RoutineFile, null, 2));
    renameSync(temp, this.file);
  }
}
