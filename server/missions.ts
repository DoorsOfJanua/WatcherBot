import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { DATA_DIR } from "./config.ts";
import { writeFileAtomic } from "./atomic.ts";

export const MISSIONS_VERSION = 1 as const;
export type MissionStatus = "draft" | "running" | "paused" | "completed" | "blocked" | "failed" | "cancelled";
export type WorkItemStatus = "pending" | "claimed" | "completed" | "blocked" | "failed" | "cancelled";

export interface MissionBudget { maxTokens?: number; maxCost?: number; maxAttempts?: number }
export interface MissionTeamMember { agentId: string; role?: string }
export interface WorkItem {
  id: string; title: string; description?: string; assignee?: string;
  dependsOn: string[]; status: WorkItemStatus; attempts: number;
  claimedBy?: string; leaseUntil?: number; result?: string; error?: string;
  createdAt: number; updatedAt: number; completedAt?: number;
}
export interface MissionEvent { id: string; at: number; type: string; data?: Record<string, unknown> }
export interface Mission {
  id: string; version: 1; title: string; leadAgentId: string; ownerThreadId: string; team: MissionTeamMember[];
  objective: string; successCriteria: string[]; budget?: MissionBudget;
  status: MissionStatus; workItems: WorkItem[]; events: MissionEvent[];
  createdAt: number; updatedAt: number; spentTokens: number; spentCost: number;
}
export interface CreateMissionInput {
  id?: string; title?: string; leadAgentId: string; ownerThreadId: string; team?: MissionTeamMember[]; objective: string;
  successCriteria?: string[]; budget?: MissionBudget; status?: MissionStatus;
}
export interface AddWorkItemInput { id?: string; title: string; description?: string; assignee?: string; dependsOn?: string[] }
export interface MissionManagerOptions { file?: string; now?: () => number; id?: () => string; leaseMs?: number; maxWorkItems?: number }

interface MissionFile { version: 1; missions: Mission[] }

export class MissionManager {
  private readonly file: string;
  private readonly now: () => number;
  private readonly id: () => string;
  private readonly leaseMs: number;
  private readonly maxWorkItems: number;
  private readonly missions = new Map<string, Mission>();

  constructor(options: MissionManagerOptions = {}) {
    this.file = options.file ?? join(DATA_DIR, "missions.json");
    this.now = options.now ?? (() => Date.now());
    this.id = options.id ?? randomUUID;
    this.leaseMs = options.leaseMs ?? 5 * 60_000;
    this.maxWorkItems = Math.max(1, Math.trunc(options.maxWorkItems ?? 1000));
    this.load();
  }

  list(): Mission[] { return [...this.missions.values()].map(clone); }
  get(id: string): Mission | undefined { const m = this.missions.get(id); return m && clone(m); }
  events(id: string): MissionEvent[] { return this.require(id).events.map(clone); }

  /** A WatcherBot server restart ends every in-process worker. Recover those
   * orphaned claims immediately instead of making launchd wait out each
   * lease. This is called explicitly by the single-owner server at boot;
   * ordinary manager construction remains side-effect free for other uses. */
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
    if (recovered) this.save();
    return recovered;
  }

  create(input: CreateMissionInput): Mission {
    const now = this.now();
    const id = input.id ?? this.id();
    if (this.missions.has(id)) throw new Error(`Mission already exists: ${id}`);
    const objective = required(input.objective, "objective");
    const mission: Mission = { id, version: 1, title: optional(input.title) || objective.slice(0, 160), leadAgentId: required(input.leadAgentId, "leadAgentId"), ownerThreadId: required(input.ownerThreadId, "ownerThreadId"),
      team: normalizeTeam(input.team, input.leadAgentId), objective,
      successCriteria: (input.successCriteria ?? []).map(String).filter(Boolean), budget: normalizeBudget(input.budget),
      status: input.status ?? "draft", workItems: [], events: [], createdAt: now, updatedAt: now, spentTokens: 0, spentCost: 0 };
    this.missions.set(id, mission); this.event(mission, "mission.created"); this.save(); return clone(mission);
  }

  addWorkItem(missionId: string, input: AddWorkItemInput): WorkItem {
    const m = this.mutable(missionId); ensureEditable(m);
    if (m.workItems.length >= this.maxWorkItems) throw new Error(`Mission cannot contain more than ${this.maxWorkItems} work items`);
    const title = required(input.title, "title");
    const id = input.id ?? this.id();
    if (m.workItems.some((x) => x.id === id)) throw new Error(`Work item already exists: ${id}`);
    const deps = [...new Set(input.dependsOn ?? [])];
    if (deps.includes(id) || deps.some((d) => !m.workItems.some((x) => x.id === d))) throw new Error("Work item has invalid dependency");
    const now = this.now(); const item: WorkItem = { id, title, ...(input.description ? { description: input.description } : {}), ...(input.assignee ? { assignee: input.assignee } : {}), dependsOn: deps, status: "pending", attempts: 0, createdAt: now, updatedAt: now };
    m.workItems.push(item); this.touch(m, "work-item.added", { itemId: id }); this.save(); return clone(item);
  }

  start(id: string): Mission { const m = this.mutable(id); if (m.status !== "draft" && m.status !== "paused") throw new Error("Mission cannot start"); m.status = "running"; this.touch(m, "mission.started"); this.save(); return clone(m); }
  pause(id: string): Mission { const m = this.mutable(id); if (m.status !== "running") throw new Error("Mission is not running"); m.status = "paused"; this.touch(m, "mission.paused"); this.save(); return clone(m); }
  resume(id: string): Mission { const m = this.mutable(id); if (m.status !== "paused" && m.status !== "blocked") throw new Error("Mission is not resumable"); m.status = "running"; this.touch(m, "mission.resumed"); this.save(); return clone(m); }
  cancel(id: string): Mission { const m = this.mutable(id); if (m.status === "completed" || m.status === "failed" || m.status === "cancelled") throw new Error("Mission is terminal"); m.status = "cancelled"; this.touch(m, "mission.cancelled"); this.save(); return clone(m); }

  readyItems(id: string, at = this.now()): WorkItem[] {
    const m = this.mutable(id); const recovered = this.recoverLeases(m, at);
    const ready = m.status === "running" && !this.overBudget(m) ? m.workItems.filter((x) => x.status === "pending" && x.dependsOn.every((d) => m.workItems.find((y) => y.id === d)?.status === "completed")) : [];
    if (ready.length || recovered) this.save(); return ready.map(clone);
  }
  claimReadyItem(id: string, agentId: string, at = this.now(), leaseMs = this.leaseMs): WorkItem | undefined {
    const m = this.mutable(id); this.recoverLeases(m, at); if (m.status !== "running" || this.overBudget(m)) { this.save(); return undefined; }
    const item = m.workItems.find((x) => x.status === "pending" && (!x.assignee || x.assignee === agentId) && x.dependsOn.every((d) => m.workItems.find((y) => y.id === d)?.status === "completed"));
    if (!item) { this.save(); return undefined; }
    item.status = "claimed"; item.claimedBy = agentId; item.leaseUntil = at + leaseMs; item.attempts++; item.updatedAt = at;
    this.touch(m, "work-item.claimed", { itemId: item.id, agentId }); this.save(); return clone(item);
  }
  renewClaim(id: string, itemId: string, agentId: string, at = this.now(), leaseMs = this.leaseMs): boolean {
    const m = this.mutable(id);
    const item = this.item(m, itemId);
    if (m.status !== "running" || item.status !== "claimed" || item.claimedBy !== agentId) return false;
    item.leaseUntil = at + leaseMs;
    item.updatedAt = at;
    m.updatedAt = at;
    this.save();
    return true;
  }
  retryWorkItem(id: string, itemId: string): Mission {
    const m = this.mutable(id);
    if (m.status !== "blocked") throw new Error("Only blocked missions can retry work");
    const item = this.item(m, itemId);
    if (item.status !== "blocked" && item.status !== "failed") throw new Error("Work item is not retryable");
    item.status = "pending"; item.error = undefined; item.updatedAt = this.now();
    this.touch(m, "work-item.retried", { itemId }); this.save(); return clone(m);
  }
  completeWorkItem(id: string, itemId: string, result?: string, usage?: { tokens?: number; cost?: number }): Mission {
    const m = this.mutable(id); this.recoverLeases(m, this.now()); const item = this.item(m, itemId); if (item.status !== "claimed") throw new Error("Work item is not claimed");
    item.status = "completed"; item.result = result; item.completedAt = this.now(); item.updatedAt = item.completedAt; item.claimedBy = undefined; item.leaseUntil = undefined;
    m.spentTokens += usage?.tokens ?? 0; m.spentCost += usage?.cost ?? 0; this.touch(m, "work-item.completed", { itemId }); this.reconcile(m); this.save(); return clone(m);
  }
  blockWorkItem(id: string, itemId: string, reason?: string): Mission { return this.finishItem(id, itemId, "blocked", reason, "work-item.blocked"); }
  failWorkItem(id: string, itemId: string, reason?: string): Mission { return this.finishItem(id, itemId, "failed", reason, "work-item.failed"); }
  complete(id: string): Mission { const m = this.mutable(id); if (m.status !== "running" || m.workItems.some((x) => x.status !== "completed")) throw new Error("Mission still has unfinished work"); m.status = "completed"; this.touch(m, "mission.completed"); this.save(); return clone(m); }
  block(id: string, reason?: string): Mission { const m = this.mutable(id); m.status = "blocked"; this.touch(m, "mission.blocked", reason ? { reason } : undefined); this.save(); return clone(m); }
  fail(id: string, reason?: string): Mission { const m = this.mutable(id); m.status = "failed"; this.touch(m, "mission.failed", reason ? { reason } : undefined); this.save(); return clone(m); }

  private finishItem(id: string, itemId: string, status: "blocked" | "failed", reason: string | undefined, event: string): Mission { const m = this.mutable(id); this.recoverLeases(m, this.now()); const item = this.item(m, itemId); if (item.status !== "claimed") throw new Error("Work item is not claimed"); item.status = status; item.error = reason; item.claimedBy = undefined; item.leaseUntil = undefined; item.updatedAt = this.now(); this.touch(m, event, { itemId, ...(reason ? { reason } : {}) }); this.reconcile(m); this.save(); return clone(m); }
  private reconcile(m: Mission): void { if (m.status !== "running") return; if (m.workItems.some((x) => x.status === "blocked" || x.status === "failed")) m.status = "blocked"; else if (m.workItems.length > 0 && m.workItems.every((x) => x.status === "completed")) m.status = "completed"; }
  private recoverLeases(m: Mission, at: number): boolean { let changed = false; for (const x of m.workItems) if (x.status === "claimed" && x.leaseUntil !== undefined && x.leaseUntil <= at) { x.status = "pending"; x.claimedBy = undefined; x.leaseUntil = undefined; x.updatedAt = at; this.touch(m, "work-item.lease-expired", { itemId: x.id }); changed = true; } return changed; }
  private overBudget(m: Mission): boolean { return (m.budget?.maxTokens !== undefined && m.spentTokens >= m.budget.maxTokens) || (m.budget?.maxCost !== undefined && m.spentCost >= m.budget.maxCost) || (m.budget?.maxAttempts !== undefined && m.workItems.reduce((n, x) => n + x.attempts, 0) >= m.budget.maxAttempts); }
  private item(m: Mission, id: string): WorkItem { const x = m.workItems.find((v) => v.id === id); if (!x) throw new Error(`Unknown work item: ${id}`); return x; }
  private require(id: string): Mission { const m = this.missions.get(id); if (!m) throw new Error(`Unknown mission: ${id}`); return m; }
  private mutable(id: string): Mission { const m = this.require(id); return m; }
  private touch(m: Mission, type: string, data?: Record<string, unknown>): void { m.updatedAt = this.now(); this.event(m, type, data); }
  private event(m: Mission, type: string, data?: Record<string, unknown>): void { m.events.push({ id: this.id(), at: this.now(), type, ...(data ? { data } : {}) }); }
  private load(): void { try { const parsed = JSON.parse(readFileSync(this.file, "utf8")) as MissionFile; if (parsed.version !== 1 || !Array.isArray(parsed.missions)) return; for (const m of parsed.missions) this.missions.set(m.id, normalizeMission(m)); } catch { /* new or corrupt state is an empty install */ } }
  private save(): void { mkdirSync(dirname(this.file), { recursive: true }); const data: MissionFile = { version: 1, missions: this.list() }; writeFileAtomic(this.file, JSON.stringify(data, null, 2), { mode: 0o600 }); }
}

function required(value: unknown, name: string): string { const s = String(value ?? "").trim(); if (!s) throw new Error(`${name} is required`); return s; }
function optional(value: unknown): string { return String(value ?? "").trim(); }
function normalizeTeam(team: MissionTeamMember[] | undefined, lead: string): MissionTeamMember[] { const values = team ?? []; return [{ agentId: lead, role: "lead" }, ...values.filter((x) => x.agentId && x.agentId !== lead).map((x) => ({ agentId: x.agentId, ...(x.role ? { role: x.role } : {}) }))]; }
function normalizeBudget(b?: MissionBudget): MissionBudget | undefined { if (!b) return undefined; const out: MissionBudget = {}; if (b.maxTokens !== undefined) out.maxTokens = Math.max(0, b.maxTokens); if (b.maxCost !== undefined) out.maxCost = Math.max(0, b.maxCost); if (b.maxAttempts !== undefined) out.maxAttempts = Math.max(0, Math.trunc(b.maxAttempts)); return Object.keys(out).length ? out : undefined; }
function normalizeMission(m: Mission): Mission { return { ...m, version: 1, title: optional(m.title) || optional(m.objective).slice(0, 160), ownerThreadId: optional(m.ownerThreadId), team: normalizeTeam(m.team, m.leadAgentId), successCriteria: m.successCriteria ?? [], workItems: m.workItems ?? [], events: m.events ?? [], spentTokens: m.spentTokens ?? 0, spentCost: m.spentCost ?? 0 }; }
function terminal(s: MissionStatus): boolean { return s === "completed" || s === "blocked" || s === "failed" || s === "cancelled"; }
function ensureEditable(m: Mission): void { if (terminal(m.status)) throw new Error("Mission is terminal"); }
function clone<T>(value: T): T { return structuredClone(value); }
