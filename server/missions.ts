import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";

export const MISSIONS_VERSION = 1 as const;
export type MissionStatus = "draft" | "running" | "paused" | "completed" | "blocked" | "failed" | "cancelled";
export type WorkItemStatus = "pending" | "claimed" | "completed" | "blocked" | "failed" | "cancelled";

export interface MissionBudget {
  maxTokens?: number;
  maxCost?: number;
  maxAttempts?: number;
}

export interface MissionTeamMember {
  agentId: string;
  role?: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dependsOn: string[];
  status: WorkItemStatus;
  attempts: number;
  claimedBy?: string;
  leaseUntil?: number;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface MissionEvent {
  id: string;
  at: number;
  type: string;
  data?: Record<string, unknown>;
}

export interface Mission {
  id: string;
  version: 1;
  title: string;
  leadAgentId: string;
  ownerThreadId: string;
  team: MissionTeamMember[];
  objective: string;
  successCriteria: string[];
  budget?: MissionBudget;
  status: MissionStatus;
  workItems: WorkItem[];
  events: MissionEvent[];
  createdAt: number;
  updatedAt: number;
  spentTokens: number;
  spentCost: number;
}

export interface CreateMissionInput {
  id?: string;
  title?: string;
  leadAgentId: string;
  ownerThreadId: string;
  team?: MissionTeamMember[];
  objective: string;
  successCriteria?: string[];
  budget?: MissionBudget;
  status?: MissionStatus;
}

export interface AddWorkItemInput {
  id?: string;
  title: string;
  description?: string;
  assignee?: string;
  dependsOn?: string[];
}

export interface MissionManagerOptions {
  file?: string;
  now?: () => number;
  id?: () => string;
  leaseMs?: number;
  maxWorkItems?: number;
}

interface MissionFile {
  version: 1;
  missions: Mission[];
}

export class MissionManager {
  private readonly file: string;
  private readonly now: () => number;
  private readonly id: () => string;
  private readonly leaseMs: number;
  private readonly maxWorkItems: number;
  private readonly missions = new Map<string, Mission>();

  constructor(options: MissionManagerOptions = {}) {
    this.file = options.file ?? join(DATA_DIR, "missions.json");
    this.now = options.now ?? Date.now;
    this.id = options.id ?? randomUUID;
    this.leaseMs = options.leaseMs ?? 5 * 60_000;
    this.maxWorkItems = Math.max(1, Math.trunc(options.maxWorkItems ?? 1_000));
    this.load();
  }

  list(): Mission[] {
    return [...this.missions.values()].map(clone);
  }

  get(id: string): Mission | undefined {
    const mission = this.missions.get(id);
    return mission && clone(mission);
  }

  events(id: string): MissionEvent[] {
    return this.require(id).events.map(clone);
  }

  /** A server restart ends every in-process worker, so boot recovers claimed
   * items immediately instead of waiting out their old process leases. */
  recoverOrphanedClaims(at = this.now()): number {
    let recovered = 0;
    for (const mission of this.missions.values()) {
      for (const item of mission.workItems) {
        if (item.status !== "claimed") continue;
        item.status = "pending";
        item.claimedBy = undefined;
        item.leaseUntil = undefined;
        item.updatedAt = at;
        this.touch(mission, "work-item.orphan-recovered", { itemId: item.id });
        recovered += 1;
      }
    }
    if (recovered > 0) this.save();
    return recovered;
  }

  create(input: CreateMissionInput): Mission {
    const now = this.now();
    const id = input.id ?? this.id();
    if (this.missions.has(id)) throw new Error(`Mission already exists: ${id}`);
    const objective = required(input.objective, "objective");
    const mission: Mission = {
      id,
      version: 1,
      title: optional(input.title) || objective.slice(0, 160),
      leadAgentId: required(input.leadAgentId, "leadAgentId"),
      ownerThreadId: required(input.ownerThreadId, "ownerThreadId"),
      team: normalizeTeam(input.team, input.leadAgentId),
      objective,
      successCriteria: (input.successCriteria ?? []).map(String).filter(Boolean),
      budget: normalizeBudget(input.budget),
      status: input.status ?? "draft",
      workItems: [],
      events: [],
      createdAt: now,
      updatedAt: now,
      spentTokens: 0,
      spentCost: 0,
    };
    this.missions.set(id, mission);
    this.event(mission, "mission.created");
    this.save();
    return clone(mission);
  }

  addWorkItem(missionId: string, input: AddWorkItemInput): WorkItem {
    const mission = this.mutable(missionId);
    ensureEditable(mission);
    if (mission.workItems.length >= this.maxWorkItems) {
      throw new Error(`Mission cannot contain more than ${this.maxWorkItems} work items`);
    }
    const title = required(input.title, "title");
    const id = input.id ?? this.id();
    if (mission.workItems.some((item) => item.id === id)) throw new Error(`Work item already exists: ${id}`);
    const dependsOn = [...new Set(input.dependsOn ?? [])];
    if (
      dependsOn.includes(id) ||
      dependsOn.some((dependency) => !mission.workItems.some((item) => item.id === dependency))
    ) throw new Error("Work item has invalid dependency");
    const now = this.now();
    const item: WorkItem = {
      id,
      title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.assignee ? { assignee: input.assignee } : {}),
      dependsOn,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    mission.workItems.push(item);
    this.touch(mission, "work-item.added", { itemId: id });
    this.save();
    return clone(item);
  }

  start(id: string): Mission {
    const mission = this.mutable(id);
    if (mission.status !== "draft" && mission.status !== "paused") throw new Error("Mission cannot start");
    mission.status = "running";
    this.touch(mission, "mission.started");
    this.save();
    return clone(mission);
  }

  pause(id: string): Mission {
    const mission = this.mutable(id);
    if (mission.status !== "running") throw new Error("Mission is not running");
    mission.status = "paused";
    this.touch(mission, "mission.paused");
    this.save();
    return clone(mission);
  }

  resume(id: string): Mission {
    const mission = this.mutable(id);
    if (mission.status !== "paused" && mission.status !== "blocked") throw new Error("Mission is not resumable");
    mission.status = "running";
    this.touch(mission, "mission.resumed");
    this.save();
    return clone(mission);
  }

  cancel(id: string): Mission {
    const mission = this.mutable(id);
    if (["completed", "failed", "cancelled"].includes(mission.status)) throw new Error("Mission is terminal");
    mission.status = "cancelled";
    this.touch(mission, "mission.cancelled");
    this.save();
    return clone(mission);
  }

  readyItems(id: string, at = this.now()): WorkItem[] {
    const mission = this.mutable(id);
    const recovered = this.recoverLeases(mission, at);
    const ready = mission.status === "running" && !this.overBudget(mission)
      ? mission.workItems.filter((item) =>
          item.status === "pending" &&
          item.dependsOn.every((dependency) =>
            mission.workItems.find((candidate) => candidate.id === dependency)?.status === "completed",
          ),
        )
      : [];
    if (ready.length > 0 || recovered) this.save();
    return ready.map(clone);
  }

  claimReadyItem(id: string, agentId: string, at = this.now(), leaseMs = this.leaseMs): WorkItem | undefined {
    const mission = this.mutable(id);
    this.recoverLeases(mission, at);
    if (mission.status !== "running" || this.overBudget(mission)) {
      this.save();
      return undefined;
    }
    const item = mission.workItems.find((candidate) =>
      candidate.status === "pending" &&
      (!candidate.assignee || candidate.assignee === agentId) &&
      candidate.dependsOn.every((dependency) =>
        mission.workItems.find((other) => other.id === dependency)?.status === "completed",
      ),
    );
    if (!item) {
      this.save();
      return undefined;
    }
    item.status = "claimed";
    item.claimedBy = agentId;
    item.leaseUntil = at + leaseMs;
    item.attempts += 1;
    item.updatedAt = at;
    this.touch(mission, "work-item.claimed", { itemId: item.id, agentId });
    this.save();
    return clone(item);
  }

  renewClaim(id: string, itemId: string, agentId: string, at = this.now(), leaseMs = this.leaseMs): boolean {
    const mission = this.mutable(id);
    const item = this.item(mission, itemId);
    if (mission.status !== "running" || item.status !== "claimed" || item.claimedBy !== agentId) return false;
    item.leaseUntil = at + leaseMs;
    item.updatedAt = at;
    mission.updatedAt = at;
    this.save();
    return true;
  }

  retryWorkItem(id: string, itemId: string): Mission {
    const mission = this.mutable(id);
    if (mission.status !== "blocked") throw new Error("Only blocked missions can retry work");
    const item = this.item(mission, itemId);
    if (item.status !== "blocked" && item.status !== "failed") throw new Error("Work item is not retryable");
    item.status = "pending";
    item.error = undefined;
    item.updatedAt = this.now();
    this.touch(mission, "work-item.retried", { itemId });
    this.save();
    return clone(mission);
  }

  completeWorkItem(
    id: string,
    itemId: string,
    result?: string,
    usage?: { tokens?: number; cost?: number },
  ): Mission {
    const mission = this.mutable(id);
    this.recoverLeases(mission, this.now());
    const item = this.item(mission, itemId);
    if (item.status !== "claimed") throw new Error("Work item is not claimed");
    item.status = "completed";
    item.result = result;
    item.completedAt = this.now();
    item.updatedAt = item.completedAt;
    item.claimedBy = undefined;
    item.leaseUntil = undefined;
    mission.spentTokens += usage?.tokens ?? 0;
    mission.spentCost += usage?.cost ?? 0;
    this.touch(mission, "work-item.completed", { itemId });
    this.reconcile(mission);
    this.save();
    return clone(mission);
  }

  blockWorkItem(id: string, itemId: string, reason?: string): Mission {
    return this.finishItem(id, itemId, "blocked", reason, "work-item.blocked");
  }

  failWorkItem(id: string, itemId: string, reason?: string): Mission {
    return this.finishItem(id, itemId, "failed", reason, "work-item.failed");
  }

  complete(id: string): Mission {
    const mission = this.mutable(id);
    if (mission.status !== "running" || mission.workItems.some((item) => item.status !== "completed")) {
      throw new Error("Mission still has unfinished work");
    }
    mission.status = "completed";
    this.touch(mission, "mission.completed");
    this.save();
    return clone(mission);
  }

  block(id: string, reason?: string): Mission {
    const mission = this.mutable(id);
    mission.status = "blocked";
    this.touch(mission, "mission.blocked", reason ? { reason } : undefined);
    this.save();
    return clone(mission);
  }

  fail(id: string, reason?: string): Mission {
    const mission = this.mutable(id);
    mission.status = "failed";
    this.touch(mission, "mission.failed", reason ? { reason } : undefined);
    this.save();
    return clone(mission);
  }

  private finishItem(
    id: string,
    itemId: string,
    status: "blocked" | "failed",
    reason: string | undefined,
    event: string,
  ): Mission {
    const mission = this.mutable(id);
    this.recoverLeases(mission, this.now());
    const item = this.item(mission, itemId);
    if (item.status !== "claimed") throw new Error("Work item is not claimed");
    item.status = status;
    item.error = reason;
    item.claimedBy = undefined;
    item.leaseUntil = undefined;
    item.updatedAt = this.now();
    this.touch(mission, event, { itemId, ...(reason ? { reason } : {}) });
    this.reconcile(mission);
    this.save();
    return clone(mission);
  }

  private reconcile(mission: Mission): void {
    if (mission.status !== "running") return;
    if (mission.workItems.some((item) => item.status === "blocked" || item.status === "failed")) {
      mission.status = "blocked";
    } else if (mission.workItems.length > 0 && mission.workItems.every((item) => item.status === "completed")) {
      mission.status = "completed";
    }
  }

  private recoverLeases(mission: Mission, at: number): boolean {
    let changed = false;
    for (const item of mission.workItems) {
      if (item.status !== "claimed" || item.leaseUntil === undefined || item.leaseUntil > at) continue;
      item.status = "pending";
      item.claimedBy = undefined;
      item.leaseUntil = undefined;
      item.updatedAt = at;
      this.touch(mission, "work-item.lease-expired", { itemId: item.id });
      changed = true;
    }
    return changed;
  }

  private overBudget(mission: Mission): boolean {
    return (mission.budget?.maxTokens !== undefined && mission.spentTokens >= mission.budget.maxTokens) ||
      (mission.budget?.maxCost !== undefined && mission.spentCost >= mission.budget.maxCost) ||
      (mission.budget?.maxAttempts !== undefined &&
        mission.workItems.reduce((total, item) => total + item.attempts, 0) >= mission.budget.maxAttempts);
  }

  private item(mission: Mission, id: string): WorkItem {
    const item = mission.workItems.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Unknown work item: ${id}`);
    return item;
  }

  private require(id: string): Mission {
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Unknown mission: ${id}`);
    return mission;
  }

  private mutable(id: string): Mission {
    return this.require(id);
  }

  private touch(mission: Mission, type: string, data?: Record<string, unknown>): void {
    mission.updatedAt = this.now();
    this.event(mission, type, data);
  }

  private event(mission: Mission, type: string, data?: Record<string, unknown>): void {
    mission.events.push({ id: this.id(), at: this.now(), type, ...(data ? { data } : {}) });
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as MissionFile;
      if (parsed.version !== MISSIONS_VERSION || !Array.isArray(parsed.missions)) return;
      for (const mission of parsed.missions) this.missions.set(mission.id, normalizeMission(mission));
    } catch {
      // New or corrupt state is an empty install.
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const data: MissionFile = { version: MISSIONS_VERSION, missions: this.list() };
    writeFileAtomic(this.file, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}

function required(value: unknown, name: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function optional(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTeam(team: MissionTeamMember[] | undefined, lead: string): MissionTeamMember[] {
  return [
    { agentId: lead, role: "lead" },
    ...(team ?? [])
      .filter((member) => member.agentId && member.agentId !== lead)
      .map((member) => ({ agentId: member.agentId, ...(member.role ? { role: member.role } : {}) })),
  ];
}

function normalizeBudget(budget?: MissionBudget): MissionBudget | undefined {
  if (!budget) return undefined;
  const normalized: MissionBudget = {};
  if (budget.maxTokens !== undefined) normalized.maxTokens = Math.max(0, budget.maxTokens);
  if (budget.maxCost !== undefined) normalized.maxCost = Math.max(0, budget.maxCost);
  if (budget.maxAttempts !== undefined) normalized.maxAttempts = Math.max(0, Math.trunc(budget.maxAttempts));
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMission(mission: Mission): Mission {
  return {
    ...mission,
    version: 1,
    title: optional(mission.title) || optional(mission.objective).slice(0, 160),
    ownerThreadId: optional(mission.ownerThreadId),
    team: normalizeTeam(mission.team, mission.leadAgentId),
    successCriteria: mission.successCriteria ?? [],
    workItems: mission.workItems ?? [],
    events: mission.events ?? [],
    spentTokens: mission.spentTokens ?? 0,
    spentCost: mission.spentCost ?? 0,
  };
}

function terminal(status: MissionStatus): boolean {
  return ["completed", "blocked", "failed", "cancelled"].includes(status);
}

function ensureEditable(mission: Mission): void {
  if (terminal(mission.status)) throw new Error("Mission is terminal");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
