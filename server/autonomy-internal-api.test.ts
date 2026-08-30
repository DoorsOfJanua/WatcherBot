import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { MissionManager } from "./missions.ts";
import { MonitorManager } from "./monitors.ts";

describe("autonomy internal API contract boundaries", () => {
  it("filters monitors by both persisted owner dimensions", () => {
    const file = join(mkdtempSync(join(tmpdir(), "autonomy-api-")), "monitors.json");
    const manager = new MonitorManager({ file, now: () => 1000 });
    manager.create({ botId: "bot-a", threadId: "thread-a", name: "A", source: { kind: "command" }, schedule: { intervalMinutes: 5 } });
    manager.create({ botId: "bot-b", threadId: "thread-b", name: "B", source: { kind: "command" }, schedule: { intervalMinutes: 5 } });
    expect(manager.list({ botId: "bot-a", threadId: "thread-a" }).map((m) => m.name)).toEqual(["A"]);
    expect(manager.list({ botId: "bot-a", threadId: "thread-b" })).toEqual([]);
  });

  it("supports the monitor lifecycle and keeps archived records out of default lists", () => {
    const manager = new MonitorManager({ file: join(mkdtempSync(join(tmpdir(), "autonomy-api-")), "m.json"), now: () => 1000 });
    const m = manager.create({ botId: "bot", threadId: "thread", name: "Watch", source: {}, schedule: { intervalMinutes: 5 } });
    expect(manager.pause(m.id)?.status).toBe("paused");
    expect(manager.resume(m.id)?.status).toBe("active");
    expect(manager.archive(m.id)?.status).toBe("archived");
    expect(manager.list()).toEqual([]);
  });

  it("creates a mission with exactly one bounded lead work item and runs its lifecycle", () => {
    const manager = new MissionManager({ file: join(mkdtempSync(join(tmpdir(), "autonomy-api-")), "m.json"), id: (() => { let n = 0; return () => `id-${++n}`; })(), now: () => 1000, maxWorkItems: 1 });
    const mission = manager.create({ title: "Ship", objective: "Ship the fix", leadAgentId: "bot-a", ownerThreadId: "thread-a" });
    const item = manager.addWorkItem(mission.id, { title: "Lead work", assignee: "bot-a" });
    expect(mission.workItems).toEqual([]);
    expect(manager.get(mission.id)?.workItems).toHaveLength(1);
    expect(manager.get(mission.id)?.workItems[0]).toMatchObject({ id: item.id, assignee: "bot-a", status: "pending" });
    expect(() => manager.addWorkItem(mission.id, { title: "Second" })).toThrow("more than 1");
    expect(manager.start(mission.id).status).toBe("running");
    expect(manager.pause(mission.id).status).toBe("paused");
    expect(manager.resume(mission.id).status).toBe("running");
    expect(manager.cancel(mission.id).status).toBe("cancelled");
  });
});
