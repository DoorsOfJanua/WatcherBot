import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import { DATA_DIR } from "./config.ts";
import {
  formatAutonomyOutcome,
  parseAutonomyOutcomeEnvelope,
  stripAutonomyOutcomeEnvelope,
} from "./autonomy-outcome.ts";
import type { ModelSelection, RuntimeEvent } from "./contracts.ts";
import { redactSecretsInText } from "./redact.ts";
import type { RoutineRequestOperation } from "../shared/routine-request.ts";

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

const persistedSourceThreadId = z.string().trim().min(1).optional().catch(undefined);

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
  /** Conversation that created this routine in chat. Calendar/import-created
   * routines intentionally have no source, and older files migrate in place. */
  sourceThreadId?: string;
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
  /** Snapshot the routine's reporting destination. Execution remains on the
   * separate `threadId` so recurring work never contaminates chat context. */
  sourceThreadId?: string;
  threadId?: string;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  /** Human-readable reason the detached execution is waiting. */
  attention?: string;
  error?: string;
  precheckNote?: string;
  modelSelection?: ModelSelection;
  cost?: number | null;
  denials?: string[];
  createdAt: number;
  seenAt?: number;
}

export interface RoutineRequestReceipt {
  requestId: string;
  messageId: string;
  botId: string;
  threadId: string;
  action: RoutineRequestOperation["action"];
  fingerprintVersion: 1;
  /** SHA-256 of the strict normalized operation carried by the card. */
  fingerprint: string;
  resultId: string;
  appliedAt: number;
}

export interface RoutineRequestCommit {
  requestId: string;
  messageId: string;
  botId: string;
  threadId: string;
  action: RoutineRequestOperation["action"];
  fingerprintVersion: 1;
  fingerprint: string;
}

type RoutineRequestCommitFor<Action extends RoutineRequestOperation["action"]> =
  Omit<RoutineRequestCommit, "action"> & { action: Action };

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
  | { kind: "command"; command: string }
  | { kind: "monitor"; source: Record<string, unknown>; config?: Record<string, unknown> };

export interface RoutinePrecheckResult {
  value?: string;
  error?: string;
}

export type RoutinePrecheckProvider = (
  precheck: RoutinePrecheck,
) => Promise<RoutinePrecheckResult>;

interface RoutineFile {
  version: 1;
  routines: Routine[];
  runs: RoutineRun[];
  /** Durable commit receipts for cross-file confirmation recovery. */
  routineRequestReceipts?: RoutineRequestReceipt[];
}

export type RoutineRequestOwner = Pick<RoutineRequestReceipt, "requestId" | "messageId" | "botId" | "threadId">;

function routineRequestOwnerKey(owner: RoutineRequestOwner): string {
  return JSON.stringify([owner.requestId, owner.messageId, owner.botId, owner.threadId]);
}

export interface RoutineManagerOptions {
  file?: string;
  now?: () => number;
  /** Keyed frames only: every payload on this bus is `{ kind, … }`, which
   * is what lets the server number and replay them. */
  emit?: (payload: Record<string, unknown>) => void;
  botState: (botId: string) => "ready" | "busy" | "missing";
  createTask: (botId: string, title: string, activate?: boolean) => { threadId: string } | null;
  /** Persistent task for event feeds. Webhook deliveries reuse it so a burst
   * stays ordered in one durable conversation without stealing live chat. */
  taskForRun?: (botId: string, routineId: string, title: string) => { threadId: string } | null;
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
  /** Projects every durable transition into the source conversation. */
  onRunChanged?: (run: RoutineRun) => void;
  onRunFailed?: (run: RoutineRun) => void;
  validateModelSelection?: (selection: ModelSelection) => void;
  precheckProviders?: Partial<Record<RoutinePrecheck["kind"], RoutinePrecheckProvider>>;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const CATCH_UP_MS = 12 * 60 * 60_000;
const MAX_RUNS = 2_000;
const ROUTINE_REQUEST_ACTIONS = new Set<RoutineRequestOperation["action"]>([
  "create",
  "update",
  "pause",
  "resume",
  "run_now",
  "delete",
]);

function isRoutineRequestAction(value: unknown): value is RoutineRequestOperation["action"] {
  return typeof value === "string" && ROUTINE_REQUEST_ACTIONS.has(value as RoutineRequestOperation["action"]);
}

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
    return {
      type: "interval",
      everyMinutes,
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      weekdays: cleanDays(schedule.weekdays),
    };
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
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("Pre-check URL must be local");
    }
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error("Pre-check URL must point to localhost");
    }
    const jsonPath = candidate.jsonPath == null ? undefined : String(candidate.jsonPath).trim().slice(0, 200);
    return { kind: "http", url: parsed.toString(), ...(jsonPath ? { jsonPath } : {}) };
  }
  if (candidate.kind === "monitor") {
    if (!candidate.source || typeof candidate.source !== "object" || Array.isArray(candidate.source)) {
      throw new Error("Monitor pre-check needs a source");
    }
    const source = structuredClone(candidate.source as Record<string, unknown>);
    const sourceKind = typeof source.kind === "string" ? source.kind.trim().slice(0, 80) : "";
    if (!sourceKind) throw new Error("Monitor pre-check source kind is required");
    source.kind = sourceKind;
    const config = candidate.config == null
      ? undefined
      : candidate.config && typeof candidate.config === "object" && !Array.isArray(candidate.config)
        ? structuredClone(candidate.config as Record<string, unknown>)
        : null;
    if (config === null) throw new Error("Monitor pre-check config must be an object");
    if (JSON.stringify({ source, config }).length > 20_000) throw new Error("Monitor pre-check is too large");
    return { kind: "monitor", source, ...(config ? { config } : {}) };
  }
  throw new Error("Choose a supported pre-check");
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
        candidate += (Math.floor((after - candidate) / every) + 1) * every;
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
  if (modelSelection && (!modelSelection.instanceId || !modelSelection.model)) {
    throw new Error("Routine model selection is incomplete");
  }
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

async function readPrecheck(
  precheck: RoutinePrecheck,
  providers: RoutineManagerOptions["precheckProviders"],
): Promise<RoutinePrecheckResult> {
  try {
    const provider = providers?.[precheck.kind];
    if (provider) return await provider(precheck);
    let raw: unknown;
    if (precheck.kind === "command") {
      const result = await execFileAsync("/bin/zsh", ["-lc", precheck.command], {
        timeout: 10_000,
        maxBuffer: 64 * 1024,
      });
      raw = result.stdout.trim();
    } else if (precheck.kind === "http") {
      const response = await fetch(precheck.url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      try {
        raw = JSON.parse(text);
      } catch {
        raw = text.trim();
      }
      raw = jsonPathValue(raw, precheck.jsonPath);
    } else {
      throw new Error(`No pre-check provider registered for kind "${precheck.kind}"`);
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
  private routineRequestReceipts: RoutineRequestReceipt[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(options: RoutineManagerOptions) {
    this.options = options;
    this.file = options.file ?? join(DATA_DIR, "routines.json");
    this.now = options.now ?? Date.now;
    try {
      const disk = JSON.parse(readFileSync(this.file, "utf8")) as Partial<RoutineFile>;
      this.routines = Array.isArray(disk.routines)
        ? disk.routines.map((routine) => ({
            ...routine,
            runOn: routine.runOn ?? "maus",
            sourceThreadId: persistedSourceThreadId.parse(routine.sourceThreadId),
          }))
        : [];
      this.runs = Array.isArray(disk.runs)
        ? disk.runs.map((run) => ({
            ...run,
            runOn: run.runOn ?? "maus",
            sourceThreadId: persistedSourceThreadId.parse(run.sourceThreadId),
          }))
        : [];
      this.routineRequestReceipts = Array.isArray(disk.routineRequestReceipts)
        ? disk.routineRequestReceipts.filter((receipt): receipt is RoutineRequestReceipt =>
            typeof receipt?.requestId === "string" &&
            typeof receipt?.messageId === "string" &&
            typeof receipt?.botId === "string" &&
            typeof receipt?.threadId === "string" &&
            isRoutineRequestAction(receipt?.action) &&
            receipt?.fingerprintVersion === 1 &&
            typeof receipt?.fingerprint === "string" && /^[a-f0-9]{64}$/.test(receipt.fingerprint) &&
            typeof receipt?.resultId === "string" &&
            Number.isFinite(receipt?.appliedAt)
          )
        : [];
    } catch {
      this.routines = [];
      this.runs = [];
      this.routineRequestReceipts = [];
    }
    // A local process cannot still own these turns after a full restart.
    const recovered: RoutineRun[] = [];
    for (const run of this.runs) {
      if (run.status === "running" || run.status === "waiting") {
        run.status = "failed";
        run.error = "WatcherBotRoom restarted while this routine was running";
        run.attention = undefined;
        run.finishedAt = this.now();
        recovered.push({ ...run });
      }
    }
    if (recovered.length > 0) {
      this.save();
      for (const run of recovered) {
        this.notifyRunChanged(run);
        this.options.onRunFailed?.(run);
      }
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

  routineRequestReceipt(requestId: string): RoutineRequestReceipt | null {
    const receipt = this.routineRequestReceipts.find((candidate) => candidate.requestId === requestId);
    return receipt ? { ...receipt } : null;
  }

  /** Small startup index used to locate only transcripts that may need
   * cross-file commit recovery. Most launches have no receipts and therefore
   * do not read or cache any transcript for this feature. */
  routineRequestReceiptOwners(): RoutineRequestOwner[] {
    return this.routineRequestReceipts.map(({ requestId, messageId, botId, threadId }) => ({
      requestId,
      messageId,
      botId,
      threadId,
    }));
  }

  /** Once the transcript card is durably settled, its scheduler receipt is
   * redundant. Unsettled receipts are intentionally never count-evicted: an
   * actionable card may survive indefinitely and must retain its exact-once
   * recovery record for the same lifetime. */
  forgetRoutineRequestReceipt(request: RoutineRequestCommit): boolean {
    const receipt = this.matchingRoutineRequestReceipt(request);
    if (!receipt) return false;
    const index = this.routineRequestReceipts.indexOf(receipt);
    this.commitMutation(() => {
      this.routineRequestReceipts.splice(index, 1);
    });
    return true;
  }

  forgetRoutineRequestReceiptsForThread(threadId: string): number {
    const kept = this.routineRequestReceipts.filter((receipt) => receipt.threadId !== threadId);
    const removed = this.routineRequestReceipts.length - kept.length;
    if (removed === 0) return 0;
    this.commitMutation(() => {
      this.routineRequestReceipts = kept;
    });
    return removed;
  }

  /** Drop only receipts whose confirmation transcript no longer exists.
   * Reachable open cards retain exact-once recovery for their full lifetime. */
  reconcileRoutineRequestReceipts(reachable: readonly RoutineRequestOwner[]): number {
    const keys = new Set(reachable.map(routineRequestOwnerKey));
    const kept = this.routineRequestReceipts.filter((receipt) => keys.has(routineRequestOwnerKey(receipt)));
    const removed = this.routineRequestReceipts.length - kept.length;
    if (removed === 0) return 0;
    this.commitMutation(() => {
      this.routineRequestReceipts = kept;
    });
    return removed;
  }

  isActiveThread(threadId: string): boolean {
    return this.runs.some(
      (run) => run.threadId === threadId && ["running", "waiting"].includes(run.status),
    );
  }

  create(input: RoutineInput, request?: RoutineRequestCommitFor<"create">): Routine {
    if (request) {
      const receipt = this.matchingRoutineRequestReceipt(request);
      if (receipt) {
        const committed = this.routines.find((routine) => routine.id === receipt.resultId);
        if (committed) return { ...committed, schedule: { ...committed.schedule } };
        throw new Error("This routine request was already applied");
      }
    }
    const clean = sanitizeInput(input);
    if (this.options.botState(clean.botId) === "missing") throw new Error("That bot no longer exists");
    if (clean.modelSelection) this.options.validateModelSelection?.(clean.modelSelection);
    const at = this.now();
    const routine: Routine = {
      id: randomUUID(),
      ...clean,
      // Only a confirmed chat card supplies `request`; the public calendar
      // API cannot choose an arbitrary transcript as a reporting target.
      sourceThreadId: request?.threadId,
      nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, at) : null,
      createdAt: at,
      updatedAt: at,
    };
    this.commitMutation(() => {
      this.routines.unshift(routine);
      if (request) this.rememberRoutineRequest(request, routine.id, at);
    });
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  update(
    id: string,
    patch: Partial<RoutineInput>,
    request?: RoutineRequestCommitFor<"update" | "pause" | "resume">,
  ): Routine | null {
    if (request) {
      const receipt = this.matchingRoutineRequestReceipt(request);
      if (receipt) {
        const committed = this.routines.find((routine) => routine.id === receipt.resultId);
        return committed ? { ...committed, schedule: { ...committed.schedule } } : null;
      }
    }
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    const now = this.now();
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
    const cancelledRuns: RoutineRun[] = [];
    this.commitMutation(() => {
      Object.assign(routine, clean, {
        nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, now) : null,
        // `updatedAt` doubles as the optimistic revision on durable routine
        // confirmation cards. Keep it monotonic even for two writes in one ms.
        updatedAt: Math.max(now, routine.updatedAt + 1),
      });
      if (patch.enabled === false) {
        for (const run of this.runs) {
          if (run.routineId !== routine.id || run.status !== "queued") continue;
          run.status = "cancelled";
          run.attention = undefined;
          run.finishedAt = this.now();
          run.error = "The routine was paused before this run started";
          cancelledRuns.push(run);
        }
      }
      if (request) this.rememberRoutineRequest(request, routine.id, now);
    });
    for (const run of cancelledRuns) this.emitRun(run);
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  remove(id: string, request?: RoutineRequestCommitFor<"delete">): boolean {
    if (request) {
      const receipt = this.matchingRoutineRequestReceipt(request);
      if (receipt) {
        return true;
      }
    }
    const at = this.routines.findIndex((r) => r.id === id);
    if (at === -1) return false;
    const cancelledRuns: RoutineRun[] = [];
    this.commitMutation(() => {
      this.routines.splice(at, 1);
      for (const run of this.runs) {
        if (run.routineId !== id || run.status !== "queued") continue;
        run.status = "cancelled";
        run.attention = undefined;
        run.finishedAt = this.now();
        cancelledRuns.push(run);
      }
      if (request) this.rememberRoutineRequest(request, id, this.now());
    });
    for (const run of cancelledRuns) this.emitRun(run);
    this.options.emit?.({ kind: "routine.deleted", routineId: id });
    return true;
  }

  disableForBot(botId: string) {
    let changed = false;
    for (const routine of this.routines) {
      if (routine.botId !== botId || !routine.enabled) continue;
      routine.enabled = false;
      routine.nextRunAt = null;
      routine.updatedAt = Math.max(this.now(), routine.updatedAt + 1);
      this.emitRoutine(routine);
      changed = true;
    }
    for (const run of this.runs) {
      if (run.botId !== botId || !["queued", "running", "waiting"].includes(run.status)) continue;
      run.status = "cancelled";
      run.attention = undefined;
      run.finishedAt = this.now();
      run.error = "The assigned bot was deleted";
      this.emitRun(run);
      if (run.threadId) void this.options.interruptTurn?.(run.botId, run.threadId, run.runOn ?? "maus").catch(() => {});
      changed = true;
    }
    if (changed) this.save();
  }

  /** Latching half of the fleet emergency stop. Definitions stay paused
   * until explicitly re-enabled; active receipts remain as honest cancelled
   * history instead of disappearing. */
  async pauseAll(reason = "Emergency stop pressed"): Promise<{
    pausedRoutines: number;
    cancelledRuns: number;
    interruptedRuns: number;
  }> {
    const changedRoutines: Routine[] = [];
    const changedRuns: RoutineRun[] = [];
    const interruptTargets: Array<Pick<RoutineRun, "botId" | "threadId" | "runOn">> = [];
    const at = this.now();
    const safeReason = redactSecretsInText(reason).slice(0, 500);

    this.commitMutation(() => {
      for (const routine of this.routines) {
        if (!routine.enabled) continue;
        routine.enabled = false;
        routine.nextRunAt = null;
        routine.updatedAt = Math.max(at, routine.updatedAt + 1);
        changedRoutines.push(routine);
      }
      for (const run of this.runs) {
        if (!["queued", "running", "waiting"].includes(run.status)) continue;
        const wasActive = run.status === "running" || run.status === "waiting";
        run.status = "cancelled";
        run.attention = undefined;
        run.finishedAt = at;
        run.error = safeReason;
        changedRuns.push(run);
        if (wasActive && run.threadId && this.options.interruptTurn) {
          interruptTargets.push({ botId: run.botId, threadId: run.threadId, runOn: run.runOn });
        }
      }
    });

    for (const routine of changedRoutines) this.emitRoutine(routine);
    for (const run of changedRuns) this.emitRun(run);
    const interrupts = interruptTargets.map((run) =>
      this.options.interruptTurn!(run.botId, run.threadId!, run.runOn ?? "maus").catch(() => {}),
    );
    await Promise.allSettled(interrupts);
    return {
      pausedRoutines: changedRoutines.length,
      cancelledRuns: changedRuns.length,
      interruptedRuns: interrupts.length,
    };
  }

  runNow(id: string, request?: RoutineRequestCommitFor<"run_now">): RoutineRun | null {
    if (request) {
      const receipt = this.matchingRoutineRequestReceipt(request);
      if (receipt) {
        const committed = this.runs.find((run) => run.id === receipt.resultId);
        return committed ? { ...committed } : null;
      }
    }
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    let run!: RoutineRun;
    this.commitMutation(() => {
      run = this.newRun(routine, this.now(), true);
      // A chat-confirmed "run now" reports back to the conversation that
      // invoked this one run. It must not silently rebind future schedules.
      if (request) run.sourceThreadId = request.threadId;
      if (request) this.rememberRoutineRequest(request, run.id, this.now());
    });
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
      run.attention = undefined;
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
    run.attention = undefined;
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
      const missedRuns: RoutineRun[] = [];
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
          missedRuns.push({ ...missed });
        } else if (
          routine.schedule.type === "interval" &&
          this.runs.some((run) =>
            run.routineId === routine.id && ["queued", "running", "waiting"].includes(run.status),
          )
        ) {
          // A tight interval must not stack work behind a slow or stuck run;
          // that would drain as a burst of stale back-to-back turns. The
          // skipped occurrence still receives an honest terminal receipt.
          const missed = this.newRun(routine, scheduledFor, false);
          missed.status = "missed";
          missed.finishedAt = now;
          missed.error = "Skipped: the previous run of this routine was still going";
          this.emitRun(missed);
        } else if (routine.precheck) {
          const check = await readPrecheck(routine.precheck, this.options.precheckProviders);
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
        routine.updatedAt = Math.max(now, routine.updatedAt + 1);
        this.emitRoutine(routine);
        changed = true;
      }
      if (changed) this.save();
      for (const missed of missedRuns) this.options.onRunFailed?.(missed);

      // Insertion order is delivery order. Reversing this queue made a burst
      // of webhook deliveries drain newest-first once its bot became ready.
      for (const run of [...this.runs]) {
        if (run.status !== "queued") continue;
        const state = this.options.botState(run.botId);
        if (state === "busy") continue;
        if (state === "missing") {
          this.failRun(run, "The assigned bot no longer exists");
          continue;
        }
        const task = run.triggerSource === "webhook" && this.options.taskForRun
          ? this.options.taskForRun(run.botId, run.routineId, run.routineName)
          : this.options.createTask(run.botId, run.routineName, false);
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
      run.attention = redactSecretsInText(event.summary).trim().slice(0, 500) || undefined;
    } else if (event.type === "request.resolved") {
      run.status = "running";
      run.attention = undefined;
    } else if (event.type === "item.completed" && event.itemType === "assistant_text") {
      const redacted = redactSecretsInText(event.text);
      const prose = stripAutonomyOutcomeEnvelope(redacted);
      const outcome = parseAutonomyOutcomeEnvelope(redacted);
      run.output = (prose || (outcome ? formatAutonomyOutcome(outcome) : "")).slice(0, 2_000);
    } else if (event.type === "runtime.error") {
      run.error = redactSecretsInText(event.message).slice(0, 500);
    } else if (event.type === "turn.retrying") {
      // the driver will relaunch this same run; a transient blip is not a
      // receipt-worthy failure, so keep the run running and stay quiet
      return null;
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
      // completed reminder. Webhooks may deliberately stay quiet.
      const triggerSource = run.triggerSource ?? (run.manual ? "manual" : "schedule");
      if (triggerSource !== "webhook" && !run.output?.trim()) {
        this.failRun(run, "The bot finished without producing a message for you");
        queueMicrotask(() => void this.tick());
        return { ...run };
      }
      run.status = "completed";
      run.attention = undefined;
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
    run.attention = undefined;
    run.error = redactSecretsInText(message).slice(0, 500);
    run.finishedAt = this.now();
    this.save();
    this.emitRun(run);
    this.options.onRunFailed?.({ ...run });
  }

  private initialOccurrence(schedule: RoutineSchedule, now: number): number | null {
    // Return the original time, not max(at, now): tick() already decides
    // whether a stale "once" run fires or is recorded as "missed" based on
    // how far past the scheduled time it is. Clamping to now here hides the
    // original schedule from the run receipt (scheduledFor would read "now"
    // instead of the time the user chose) and prevents the 12-hour missed
    // threshold from ever triggering for a "once" routine created late.
    if (schedule.type === "once") return schedule.at;
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
      ...(routine.modelSelection ? { modelSelection: { ...routine.modelSelection } } : {}),
      scheduledFor,
      status: "queued",
      manual,
      triggerSource: manual ? "manual" : "schedule",
      sourceThreadId: routine.sourceThreadId,
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
    this.notifyRunChanged(run);
  }

  private notifyRunChanged(run: RoutineRun) {
    try {
      this.options.onRunChanged?.({ ...run });
    } catch (error) {
      // Reporting is secondary to scheduler truth. A transcript write must
      // never strand the run in memory or prevent the next tick.
      console.error("routine: source-thread lifecycle update failed", error);
    }
  }

  private matchingRoutineRequestReceipt(request: RoutineRequestCommit): RoutineRequestReceipt | null {
    const receipt = this.routineRequestReceipts.find((candidate) => candidate.requestId === request.requestId);
    if (!receipt) return null;
    if (
      receipt.action !== request.action ||
      receipt.messageId !== request.messageId ||
      receipt.botId !== request.botId ||
      receipt.threadId !== request.threadId ||
      receipt.fingerprintVersion !== request.fingerprintVersion ||
      receipt.fingerprint !== request.fingerprint
    ) {
      throw new Error("Routine request receipt does not match this confirmation card");
    }
    return receipt;
  }

  private rememberRoutineRequest(
    request: RoutineRequestCommit,
    resultId: string,
    appliedAt: number,
  ) {
    const existing = this.matchingRoutineRequestReceipt(request);
    if (existing) {
      if (existing.resultId !== resultId) throw new Error("Routine request receipt has another result");
      return;
    }
    this.routineRequestReceipts.unshift({ ...request, resultId, appliedAt });
  }

  /**
   * A confirmation receipt is only true once the scheduler mutation and its
   * receipt reached the same atomic file. Restore the complete in-memory
   * state if writing or renaming that file fails so a retry cannot mistake an
   * uncommitted action for a durable one.
   */
  private commitMutation(mutate: () => void): void {
    const before = {
      routines: this.routines.map((routine) => ({ ...routine, schedule: { ...routine.schedule } })),
      runs: this.runs.map((run) => ({ ...run, denials: run.denials ? [...run.denials] : undefined })),
      receipts: this.routineRequestReceipts.map((receipt) => ({ ...receipt })),
    };
    try {
      mutate();
      this.save();
    } catch (error) {
      this.routines = before.routines;
      this.runs = before.runs;
      this.routineRequestReceipts = before.receipts;
      throw error;
    }
  }

  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({
      version: 1,
      routines: this.routines,
      runs: this.runs,
      routineRequestReceipts: this.routineRequestReceipts,
    } satisfies RoutineFile, null, 2));
    renameSync(temp, this.file);
  }
}
