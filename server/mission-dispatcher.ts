import type { Mission, MissionManager, WorkItem } from "./missions.ts";

export type MissionExecutionResult =
  | { status: "complete"; result?: string; usage?: { tokens?: number; cost?: number } }
  | { status: "block"; reason?: string; usage?: { tokens?: number; cost?: number } }
  | { status: "fail"; reason?: string; usage?: { tokens?: number; cost?: number } };

export interface MissionDispatch {
  missionId: string;
  itemId: string;
  agentId: string;
  item: WorkItem;
}

export interface MissionDispatchOutcome extends MissionDispatch {
  status: "complete" | "block" | "fail";
  error?: string;
}

export interface MissionDispatcherOptions {
  manager: MissionManager;
  maxItemsPerTick?: number;
  now?: () => number;
  canExecute?: (mission: Mission, item: WorkItem, agentId: string) => boolean;
  heartbeatMs?: number;
  execute: (mission: Mission, item: WorkItem, agentId: string) => Promise<MissionExecutionResult> | MissionExecutionResult;
}

export class MissionDispatcher {
  private readonly manager: MissionManager;
  private readonly maxItemsPerTick: number;
  private readonly now: () => number;
  private readonly canExecute: NonNullable<MissionDispatcherOptions["canExecute"]>;
  private readonly execute: MissionDispatcherOptions["execute"];
  private readonly heartbeatMs: number;

  constructor(options: MissionDispatcherOptions) {
    this.manager = options.manager;
    this.maxItemsPerTick = Math.max(1, Math.trunc(options.maxItemsPerTick ?? 10));
    this.now = options.now ?? (() => Date.now());
    this.canExecute = options.canExecute ?? (() => true);
    this.execute = options.execute;
    this.heartbeatMs = Math.max(1_000, Math.trunc(options.heartbeatMs ?? 60_000));
  }

  async runOnce(): Promise<MissionDispatchOutcome[]> {
    const claimed: MissionDispatch[] = [];
    const claimedAgents = new Set<string>();
    for (const mission of this.manager.list()) {
      if (mission.status !== "running" || claimed.length >= this.maxItemsPerTick) continue;
      for (const item of this.manager.readyItems(mission.id, this.now())) {
        if (claimed.length >= this.maxItemsPerTick) break;
        const agentId = item.assignee ?? mission.leadAgentId;
        if (claimedAgents.has(agentId)) continue;
        if (!this.canExecute(mission, item, agentId)) continue;
        const current = this.manager.claimReadyItem(mission.id, agentId, this.now());
        if (current) {
          claimed.push({ missionId: mission.id, itemId: current.id, agentId, item: current });
          claimedAgents.add(agentId);
        }
      }
    }
    const settled = await Promise.allSettled(claimed.map(async (dispatch): Promise<MissionDispatchOutcome> => {
      const mission = this.manager.get(dispatch.missionId);
      if (!mission) return { ...dispatch, status: "fail", error: "Mission disappeared" };
      const heartbeat = setInterval(() => {
        try { this.manager.renewClaim(dispatch.missionId, dispatch.itemId, dispatch.agentId, this.now()); } catch { /* settlement/restart owns recovery */ }
      }, this.heartbeatMs);
      heartbeat.unref?.();
      try {
        const outcome = await this.execute(mission, dispatch.item, dispatch.agentId);
        if (outcome.status === "complete") {
          this.manager.completeWorkItem(dispatch.missionId, dispatch.itemId, outcome.result, outcome.usage);
        } else if (outcome.status === "block") {
          this.manager.blockWorkItem(dispatch.missionId, dispatch.itemId, outcome.reason);
        } else {
          this.manager.failWorkItem(dispatch.missionId, dispatch.itemId, outcome.reason);
        }
        const reason = outcome.status === "complete" ? undefined : outcome.reason;
        return { ...dispatch, status: outcome.status, ...(reason ? { error: reason } : {}) };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        try { this.manager.failWorkItem(dispatch.missionId, dispatch.itemId, reason); } catch { /* lease or mission may have changed */ }
        return { ...dispatch, status: "fail", error: reason };
      } finally {
        clearInterval(heartbeat);
      }
    }));
    return settled.map((entry, index) => entry.status === "fulfilled" ? entry.value : { ...claimed[index], status: "fail", error: String(entry.reason) });
  }

  tick(): Promise<MissionDispatchOutcome[]> { return this.runOnce(); }
}
