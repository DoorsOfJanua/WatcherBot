import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { MissionDispatcher } from "./mission-dispatcher.ts";
import { MissionManager } from "./missions.ts";

function setupManager() {
  const dir = mkdtempSync(join(tmpdir(), "watcherbot-mission-dispatch-"));
  let id = 0;
  const manager = new MissionManager({
    file: join(dir, "missions.json"),
    id: () => `id-${++id}`,
    now: () => 1_000,
  });
  return { manager, dir };
}

function createMission(manager: MissionManager, id: string, title: string, assignee?: string): void {
  manager.create({ id, leadAgentId: `${id}-lead`, ownerThreadId: `${id}-thread`, objective: title });
  manager.addWorkItem(id, { id: `${id}-item`, title, ...(assignee ? { assignee } : {}) });
  manager.start(id);
}

describe("MissionDispatcher", () => {
  it("orders missions, defaults to the lead, and obeys its per-tick bound", async () => {
    const setupState = setupManager();
    createMission(setupState.manager, "a", "first");
    createMission(setupState.manager, "b", "second", "specialist");
    const calls: string[] = [];
    const dispatcher = new MissionDispatcher({
      manager: setupState.manager,
      maxItemsPerTick: 1,
      execute: (_mission, item, agent) => {
        calls.push(`${item.id}:${agent}`);
        return { status: "complete", usage: { tokens: 3 } };
      },
    });
    expect(await dispatcher.runOnce()).toHaveLength(1);
    expect(calls).toEqual(["a-item:a-lead"]);
    expect(setupState.manager.get("a")?.status).toBe("completed");
    expect(setupState.manager.get("b")?.status).toBe("running");
    rmSync(setupState.dir, { recursive: true, force: true });
  });

  it("maps blocked and thrown executions without cross-mission failure", async () => {
    const setupState = setupManager();
    createMission(setupState.manager, "a", "block");
    createMission(setupState.manager, "b", "fail");
    const dispatcher = new MissionDispatcher({
      manager: setupState.manager,
      maxItemsPerTick: 4,
      execute: async (mission) => {
        if (mission.id === "a") return { status: "block", reason: "needs review" };
        throw new Error("executor down");
      },
    });
    expect((await dispatcher.tick()).map((outcome) => outcome.status)).toEqual(["block", "fail"]);
    expect(setupState.manager.get("a")?.status).toBe("blocked");
    expect(setupState.manager.get("b")?.status).toBe("blocked");
    rmSync(setupState.dir, { recursive: true, force: true });
  });

  it("claims at most one item per agent in a tick", async () => {
    const setupState = setupManager();
    createMission(setupState.manager, "a", "first");
    setupState.manager.create({ id: "c", leadAgentId: "a-lead", ownerThreadId: "c-thread", objective: "second" });
    setupState.manager.addWorkItem("c", { id: "c-item", title: "second", assignee: "a-lead" });
    setupState.manager.start("c");
    const execute = vi.fn(async () => ({ status: "complete" as const }));
    const result = await new MissionDispatcher({
      manager: setupState.manager,
      maxItemsPerTick: 4,
      execute,
    }).runOnce();
    expect(result).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(setupState.manager.get("c")?.workItems[0].status).toBe("pending");
    rmSync(setupState.dir, { recursive: true, force: true });
  });
});
