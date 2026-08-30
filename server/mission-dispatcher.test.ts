import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

import { MissionManager } from "./missions.ts";
import { MissionDispatcher } from "./mission-dispatcher.ts";

function manager() {
  const dir = mkdtempSync(join(tmpdir(), "myagent-dispatch-"));
  let id = 0;
  const value = new MissionManager({ file: join(dir, "missions.json"), id: () => `id-${++id}`, now: () => 1_000 });
  return { value, dir };
}
function mission(m: MissionManager, id: string, title: string, assignee?: string) {
  m.create({ id, leadAgentId: `${id}-lead`, ownerThreadId: `${id}-thread`, objective: title }); m.addWorkItem(id, { id: `${id}-item`, title, ...(assignee ? { assignee } : {}) }); m.start(id);
}

describe("MissionDispatcher", () => {
  it("orders missions, defaults to lead, and obeys the per-tick bound", async () => {
    const s = manager(); mission(s.value, "a", "first"); mission(s.value, "b", "second", "specialist");
    const calls: string[] = [];
    const dispatcher = new MissionDispatcher({ manager: s.value, maxItemsPerTick: 1, execute: (_m, item, agent) => { calls.push(`${item.id}:${agent}`); return { status: "complete", usage: { tokens: 3 } }; } });
    const result = await dispatcher.runOnce();
    expect(result).toHaveLength(1); expect(calls).toEqual(["a-item:a-lead"]); expect(s.value.get("a")?.status).toBe("completed"); expect(s.value.get("b")?.status).toBe("running");
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("isolates parallel missions and maps block/fail outcomes", async () => {
    const s = manager(); mission(s.value, "a", "block"); mission(s.value, "b", "fail");
    const dispatcher = new MissionDispatcher({ manager: s.value, maxItemsPerTick: 4, execute: async (m) => {
      if (m.id === "a") return { status: "block", reason: "needs review" } as const;
      throw new Error("executor down");
    } });
    const result = await dispatcher.tick();
    expect(result.map((x) => x.status)).toEqual(["block", "fail"]); expect(s.value.get("a")?.status).toBe("blocked"); expect(s.value.get("b")?.status).toBe("blocked");
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("does not recursively dispatch newly unblocked work in one run", async () => {
    const s = manager(); s.value.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "chain" }); s.value.addWorkItem("m", { id: "one", title: "one" }); s.value.addWorkItem("m", { id: "two", title: "two", dependsOn: ["one"] }); s.value.start("m");
    const calls: string[] = []; const dispatcher = new MissionDispatcher({ manager: s.value, execute: (_m, item) => { calls.push(item.id); return { status: "complete" }; } });
    await dispatcher.runOnce(); expect(calls).toEqual(["one"]); expect(s.value.get("m")?.status).toBe("running");
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("leaves work pending when its accountable agent cannot execute yet", async () => {
    const s = manager(); mission(s.value, "a", "wait");
    const execute = vi.fn();
    const dispatcher = new MissionDispatcher({ manager: s.value, canExecute: () => false, execute });
    expect(await dispatcher.runOnce()).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    expect(s.value.get("a")?.workItems[0]).toMatchObject({ status: "pending", attempts: 0 });
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("claims at most one item per agent in a tick", async () => {
    const s = manager(); mission(s.value, "a", "first");
    s.value.create({ id: "c", leadAgentId: "a-lead", ownerThreadId: "c-thread", objective: "second" });
    s.value.addWorkItem("c", { id: "c-item", title: "second", assignee: "a-lead" });
    s.value.start("c");
    const execute = vi.fn(async () => ({ status: "complete" as const }));
    const result = await new MissionDispatcher({ manager: s.value, maxItemsPerTick: 4, execute }).runOnce();
    expect(result).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(s.value.get("c")?.workItems[0].status).toBe("pending");
    rmSync(s.dir, { recursive: true, force: true });
  });
});
