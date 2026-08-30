import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { MissionManager } from "./missions.ts";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "myagent-missions-"));
  let clock = 1_000;
  let sequence = 0;
  const options = { file: join(dir, "missions.json"), now: () => clock, id: () => `id-${++sequence}`, leaseMs: 100 };
  return { dir, options, tick: (n: number) => { clock += n; } };
}

describe("MissionManager", () => {
  it("persists lifecycle, dependencies, events, and reloads", () => {
    const s = setup();
    const first = new MissionManager(s.options);
    first.create({ id: "m1", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "ship", successCriteria: ["green" ] });
    first.addWorkItem("m1", { id: "a", title: "prepare" });
    first.addWorkItem("m1", { id: "b", title: "ship", dependsOn: ["a"] });
    first.start("m1");
    expect(first.readyItems("m1").map((x) => x.id)).toEqual(["a"]);
    expect(first.claimReadyItem("m1", "worker")?.id).toBe("a");
    first.completeWorkItem("m1", "a", "done", { tokens: 4, cost: 0.2 });
    expect(first.readyItems("m1").map((x) => x.id)).toEqual(["b"]);
    expect(first.events("m1").map((x) => x.type)).toContain("work-item.completed");
    const reloaded = new MissionManager(s.options);
    expect(reloaded.get("m1")?.spentTokens).toBe(4);
    expect(reloaded.readyItems("m1").map((x) => x.id)).toEqual(["b"]);
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("recovers expired leases and enforces attempt budgets", () => {
    const s = setup();
    const manager = new MissionManager({ ...s.options });
    manager.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x", budget: { maxAttempts: 2 } });
    manager.addWorkItem("m", { id: "w", title: "work" });
    manager.start("m");
    expect(manager.claimReadyItem("m", "a")?.attempts).toBe(1);
    s.tick(101);
    expect(manager.readyItems("m").map((x) => x.id)).toEqual(["w"]);
    expect(manager.claimReadyItem("m", "b")?.attempts).toBe(2);
    s.tick(101);
    expect(manager.readyItems("m")).toEqual([]);
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("renews a live claim so long-running work can settle after the original lease", () => {
    const s = setup();
    const manager = new MissionManager(s.options);
    manager.create({ id: "long", leadAgentId: "lead", ownerThreadId: "thread", objective: "inspect" });
    manager.addWorkItem("long", { id: "w", title: "work" });
    manager.start("long");
    manager.claimReadyItem("long", "lead");
    s.tick(90);
    expect(manager.renewClaim("long", "w", "lead")).toBe(true);
    s.tick(20);
    expect(manager.readyItems("long")).toEqual([]);
    manager.completeWorkItem("long", "w", "done");
    expect(manager.get("long")?.status).toBe("completed");
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("recovers orphaned in-process claims immediately when the server boots", () => {
    const s = setup();
    const manager = new MissionManager(s.options);
    manager.create({ id: "restart", leadAgentId: "lead", ownerThreadId: "thread", objective: "inspect" });
    manager.addWorkItem("restart", { id: "w", title: "work" });
    manager.start("restart");
    manager.claimReadyItem("restart", "lead");

    expect(manager.recoverOrphanedClaims()).toBe(1);
    expect(manager.get("restart")?.workItems[0]).toMatchObject({ status: "pending", attempts: 1 });
    expect(manager.events("restart").at(-1)?.type).toBe("work-item.orphan-recovered");
    expect(manager.recoverOrphanedClaims()).toBe(0);
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("blocks dependent work and supports pause/resume/cancel", () => {
    const s = setup();
    const manager = new MissionManager(s.options);
    manager.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x" });
    manager.addWorkItem("m", { id: "a", title: "a" });
    manager.addWorkItem("m", { id: "b", title: "b", dependsOn: ["a"] });
    manager.start("m"); manager.pause("m");
    expect(manager.readyItems("m")).toEqual([]);
    manager.resume("m"); manager.claimReadyItem("m", "lead"); manager.blockWorkItem("m", "a", "no input");
    expect(manager.get("m")?.status).toBe("blocked");
    expect(manager.cancel("m").status).toBe("cancelled");
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("writes a versioned durable envelope", () => {
    const s = setup(); const manager = new MissionManager(s.options);
    manager.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x" });
    expect(JSON.parse(readFileSync(s.options.file, "utf8")).version).toBe(1);
    rmSync(s.dir, { recursive: true, force: true });
  });

  it("retries a blocked item, resumes the mission, and can cancel while blocked", () => {
    const s = setup(); const manager = new MissionManager(s.options);
    manager.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x" });
    manager.addWorkItem("m", { id: "w", title: "work" }); manager.start("m");
    manager.claimReadyItem("m", "lead"); manager.blockWorkItem("m", "w", "missing input");
    expect(manager.get("m")?.status).toBe("blocked");
    manager.retryWorkItem("m", "w"); expect(manager.get("m")?.status).toBe("blocked");
    manager.resume("m"); expect(manager.claimReadyItem("m", "lead")?.id).toBe("w");
    const other = new MissionManager({ ...s.options, file: join(s.dir, "other.json") });
    other.create({ id: "blocked", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x" });
    other.addWorkItem("blocked", { id: "w", title: "work" }); other.start("blocked");
    other.claimReadyItem("blocked", "lead"); other.blockWorkItem("blocked", "w"); other.cancel("blocked");
    expect(other.get("blocked")?.status).toBe("cancelled"); rmSync(s.dir, { recursive: true, force: true });
  });

  it("persists an expired lease even when the attempt budget is exhausted", () => {
    const s = setup(); const manager = new MissionManager({ ...s.options });
    manager.create({ id: "m", leadAgentId: "lead", ownerThreadId: "thread-1", objective: "x", budget: { maxAttempts: 1 } });
    manager.addWorkItem("m", { id: "w", title: "work" }); manager.start("m"); manager.claimReadyItem("m", "lead");
    s.tick(101); expect(manager.readyItems("m")).toEqual([]);
    const reloaded = new MissionManager(s.options); const item = reloaded.get("m")?.workItems[0];
    expect(item?.status).toBe("pending"); expect(reloaded.events("m").map((e) => e.type)).toContain("work-item.lease-expired");
    rmSync(s.dir, { recursive: true, force: true });
  });
});
