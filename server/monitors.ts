import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { DATA_DIR } from "./config.ts";
import { writeFileAtomic } from "./atomic.ts";

export type MonitorStatus = "active" | "paused" | "archived";

/** Adapter-owned source descriptor. The manager stores it but never executes it. */
export type MonitorSource = Record<string, unknown>;
export type MonitorConfig = Record<string, unknown>;

export interface MonitorBaseline {
  capturedAt?: number;
  value?: unknown;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface MonitorObservation {
  observedAt?: number;
  changedAt?: number;
  value?: unknown;
  fingerprint?: string;
  status?: "ok" | "changed" | "error";
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MonitorNotificationPolicy {
  enabled?: boolean;
  onChange?: boolean;
  onError?: boolean;
  cooldownMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface MonitorSchedule {
  intervalMinutes: number;
  nextDueAt: number | null;
  lastRunAt?: number;
}

export interface Monitor {
  id: string;
  botId: string;
  threadId: string;
  name: string;
  description?: string;
  status: MonitorStatus;
  source: MonitorSource;
  config: MonitorConfig;
  baseline?: MonitorBaseline;
  lastObservation?: MonitorObservation;
  schedule: MonitorSchedule;
  notificationPolicy: MonitorNotificationPolicy;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

export interface MonitorInput {
  botId: string;
  threadId: string;
  name: string;
  description?: string;
  source: MonitorSource;
  config?: MonitorConfig;
  baseline?: MonitorBaseline;
  schedule: { intervalMinutes: number; nextDueAt?: number | null };
  notificationPolicy?: MonitorNotificationPolicy;
}

export type MonitorPatch = Partial<Omit<MonitorInput, "schedule" | "botId" | "threadId">> & {
  schedule?: Partial<MonitorInput["schedule"]>;
  baseline?: MonitorBaseline | null;
  lastObservation?: MonitorObservation | null;
};

interface MonitorFile {
  version: 1;
  monitors: Monitor[];
}

export interface MonitorManagerOptions {
  file?: string;
  now?: () => number;
}

const MAX_NAME = 160;
const MAX_DESCRIPTION = 2_000;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cleanRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return clone(value as Record<string, unknown>);
}

function cleanBaseline(value: unknown): MonitorBaseline | undefined {
  if (value == null) return undefined;
  const input = cleanRecord(value, "Baseline");
  if (input.capturedAt !== undefined && !Number.isFinite(Number(input.capturedAt))) throw new Error("Baseline timestamp is invalid");
  return input as MonitorBaseline;
}

function cleanObservation(value: unknown): MonitorObservation | undefined {
  if (value == null) return undefined;
  const input = cleanRecord(value, "Observation");
  if (input.observedAt !== undefined && !Number.isFinite(Number(input.observedAt))) throw new Error("Observation timestamp is invalid");
  if (input.status !== undefined && !["ok", "changed", "error"].includes(String(input.status))) throw new Error("Observation status is invalid");
  return input as MonitorObservation;
}

function cleanPolicy(value: unknown): MonitorNotificationPolicy {
  if (value == null) return { enabled: true, onChange: true, onError: true, cooldownMinutes: 0 };
  const input = cleanRecord(value, "Notification policy");
  const cooldownMinutes = input.cooldownMinutes == null ? 0 : Math.round(Number(input.cooldownMinutes));
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > 30 * 24 * 60) throw new Error("Notification cooldown must be between 0 and 43200 minutes");
  return {
    enabled: input.enabled !== false,
    onChange: input.onChange !== false,
    onError: input.onError !== false,
    cooldownMinutes,
    ...(input.metadata === undefined ? {} : { metadata: cleanRecord(input.metadata, "Notification metadata") }),
  };
}

function cleanInput(input: MonitorInput): Omit<Monitor, "id" | "createdAt" | "updatedAt" | "status" | "schedule"> & { intervalMinutes: number; nextDueAt: number | null | undefined } {
  const botId = String(input.botId ?? "").trim();
  const threadId = String(input.threadId ?? "").trim();
  if (!botId) throw new Error("Monitor bot cannot be empty");
  if (!threadId) throw new Error("Monitor thread cannot be empty");
  const name = String(input.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) throw new Error("Monitor name cannot be empty");
  const description = input.description == null ? undefined : String(input.description).trim().slice(0, MAX_DESCRIPTION);
  const intervalMinutes = Math.round(Number(input.schedule?.intervalMinutes));
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 30 * 24 * 60) throw new Error("Monitor interval must be between 1 and 43200 minutes");
  const hasNextDueAt = Object.prototype.hasOwnProperty.call(input.schedule, "nextDueAt");
  const nextDueAt = !hasNextDueAt || input.schedule.nextDueAt === undefined
    ? undefined
    : input.schedule.nextDueAt === null ? null : Number(input.schedule.nextDueAt);
  if (nextDueAt !== null && nextDueAt !== undefined && !Number.isFinite(nextDueAt)) throw new Error("Monitor due time is invalid");
  return {
    botId,
    threadId,
    name,
    ...(description ? { description } : {}),
    source: cleanRecord(input.source, "Monitor source"),
    config: cleanRecord(input.config ?? {}, "Monitor config"),
    ...(input.baseline === undefined ? {} : { baseline: cleanBaseline(input.baseline) }),
    notificationPolicy: cleanPolicy(input.notificationPolicy),
    intervalMinutes,
    nextDueAt,
  };
}

export class MonitorManager {
  private readonly file: string;
  private readonly now: () => number;
  private monitors: Monitor[] = [];

  constructor(options: MonitorManagerOptions = {}) {
    this.file = options.file ?? join(DATA_DIR, "monitors.json");
    this.now = options.now ?? Date.now;
    try {
      const disk = JSON.parse(readFileSync(this.file, "utf8")) as Partial<MonitorFile>;
      this.monitors = Array.isArray(disk.monitors) ? disk.monitors.map((monitor) => this.migrate(monitor)) : [];
    } catch {
      this.monitors = [];
    }
  }

  private migrate(value: Monitor): Monitor {
    return {
      ...value,
      botId: typeof value.botId === "string" ? value.botId : "",
      threadId: typeof value.threadId === "string" ? value.threadId : "",
      status: value.status ?? "active",
      config: value.config ?? {},
      schedule: value.schedule ?? { intervalMinutes: 60, nextDueAt: null },
      notificationPolicy: value.notificationPolicy ?? cleanPolicy(undefined),
    };
  }

  list(options: { includeArchived?: boolean; botId?: string; threadId?: string } = {}): Monitor[] {
    return this.monitors
      .filter((monitor) => options.includeArchived || monitor.status !== "archived")
      .filter((monitor) => !options.botId || monitor.botId === options.botId)
      .filter((monitor) => !options.threadId || monitor.threadId === options.threadId)
      .map((monitor) => clone(monitor));
  }

  get(id: string): Monitor | null {
    const monitor = this.monitors.find((candidate) => candidate.id === id);
    return monitor ? clone(monitor) : null;
  }

  /** Returns active monitors whose adapter work is due at the supplied time. */
  due(at = this.now()): Monitor[] {
    return this.monitors
      .filter((monitor) => monitor.status === "active" && monitor.schedule.nextDueAt !== null && monitor.schedule.nextDueAt <= at)
      .map((monitor) => clone(monitor));
  }

  /** Persists an adapter result and advances the next due time. */
  recordObservation(id: string, observation: MonitorObservation, observedAt = this.now()): Monitor | null {
    const monitor = this.monitors.find((candidate) => candidate.id === id);
    if (!monitor || monitor.status === "archived") return null;
    const clean = cleanObservation({ ...observation, observedAt });
    const nextDueAt = observedAt + monitor.schedule.intervalMinutes * 60_000;
    monitor.lastObservation = clean;
    monitor.schedule = { ...monitor.schedule, lastRunAt: observedAt, nextDueAt };
    monitor.updatedAt = observedAt;
    this.save();
    return clone(monitor);
  }

  create(input: MonitorInput): Monitor {
    const clean = cleanInput(input);
    const at = this.now();
    const { intervalMinutes, nextDueAt, ...fields } = clean;
    const monitor: Monitor = {
      id: randomUUID(), ...fields, status: "active",
      schedule: { intervalMinutes, nextDueAt: nextDueAt === undefined ? at : nextDueAt },
      createdAt: at, updatedAt: at,
    };
    this.monitors.unshift(monitor);
    this.save();
    return clone(monitor);
  }

  update(id: string, patch: MonitorPatch): Monitor | null {
    const current = this.monitors.find((monitor) => monitor.id === id);
    if (!current || current.status === "archived") return null;
    const clean = cleanInput({
      botId: current.botId,
      threadId: current.threadId,
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      source: patch.source ?? current.source,
      config: patch.config ?? current.config,
      baseline: patch.baseline === null ? undefined : patch.baseline ?? current.baseline,
      schedule: {
        intervalMinutes: patch.schedule?.intervalMinutes ?? current.schedule.intervalMinutes,
        nextDueAt: patch.schedule && Object.prototype.hasOwnProperty.call(patch.schedule, "nextDueAt")
          ? patch.schedule.nextDueAt : current.schedule.nextDueAt,
      },
      notificationPolicy: patch.notificationPolicy ?? current.notificationPolicy,
    });
    const { intervalMinutes, nextDueAt, ...fields } = clean;
    Object.assign(current, fields, {
      schedule: { intervalMinutes, nextDueAt: nextDueAt === undefined ? current.schedule.nextDueAt : nextDueAt },
      updatedAt: this.now(),
    });
    if (patch.lastObservation !== undefined) current.lastObservation = patch.lastObservation === null ? undefined : cleanObservation(patch.lastObservation);
    this.save();
    return clone(current);
  }

  pause(id: string): Monitor | null { return this.transition(id, "paused"); }
  resume(id: string): Monitor | null { return this.transition(id, "active"); }

  archive(id: string): Monitor | null {
    const monitor = this.monitors.find((candidate) => candidate.id === id);
    if (!monitor || monitor.status === "archived") return null;
    const at = this.now();
    Object.assign(monitor, { status: "archived", archivedAt: at, updatedAt: at, schedule: { ...monitor.schedule, nextDueAt: null } });
    this.save();
    return clone(monitor);
  }

  /** Permanent deletion is deliberately restricted to archived records. */
  delete(id: string): boolean {
    const index = this.monitors.findIndex((monitor) => monitor.id === id);
    if (index < 0 || this.monitors[index]!.status !== "archived") return false;
    this.monitors.splice(index, 1);
    this.save();
    return true;
  }

  private transition(id: string, status: "active" | "paused"): Monitor | null {
    const monitor = this.monitors.find((candidate) => candidate.id === id);
    if (!monitor || monitor.status === "archived") return null;
    Object.assign(monitor, { status, updatedAt: this.now(), schedule: { ...monitor.schedule, nextDueAt: status === "paused" ? null : monitor.schedule.nextDueAt ?? this.now() } });
    this.save();
    return clone(monitor);
  }

  private save(): void {
    const parent = dirname(this.file);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileAtomic(this.file, JSON.stringify({ version: 1, monitors: this.monitors } satisfies MonitorFile, null, 2));
  }
}
