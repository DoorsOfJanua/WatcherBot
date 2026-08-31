import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MissionManager } from "./missions.ts";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "watcherbot-missions-"));
  let clock = 1_000;
  let sequence = 0;
  const options = {
    file: join(dir, "missions.json"),
    now: () => clock,
    id: () => `id-${++sequence}`,
    leaseMs: 100,
  };
  return { dir, options, tick: (milliseconds: number) => { clock += milliseconds; } };
}

describe("MissionManager", () => {
  it("persists a dependency DAG and advances only ready work", () => {
    const setupState = setup();
    const manager = new MissionManager(setupState.options);
    manager.create({
      id: "m1",
      leadAgentId: "lead",
      ownerThreadId: "thread-1",
      objective: "ship",
      successCriteria: ["green"],
    });
    manager.addWorkItem("m1", { id: "a", title: "prepare" });
    manager.addWorkItem("m1", { id: "b", title: "ship", dependsOn: ["a"] });
    manager.start("m1");
    expect(manager.readyItems("m1").map((item) => item.id)).toEqual(["a"]);
    manager.claimReadyItem("m1", "lead");
    manager.completeWorkItem("m1", "a", "done", { tokens: 4, cost: 0.2 });
    expect(manager.readyItems("m1").map((item) => item.id)).toEqual(["b"]);
    const reloaded = new MissionManager(setupState.options);
    expect(reloaded.get("m1")?.spentTokens).toBe(4);
    expect(JSON.parse(readFileSync(setupState.options.file, "utf8")).version).toBe(1);
    rmSync(setupState.dir, { recursive: true, force: true });
  });

  it("recovers expired and restart-orphaned leases", () => {
    const setupState = setup();
    const manager = new MissionManager(setupState.options);
    manager.create({ id: "restart", leadAgentId: "lead", ownerThreadId: "thread", objective: "inspect" });
    manager.addWorkItem("restart", { id: "w", title: "work" });
    manager.start("restart");
    expect(manager.claimReadyItem("restart", "lead")?.attempts).toBe(1);
    setupState.tick(101);
    expect(manager.readyItems("restart").map((item) => item.id)).toEqual(["w"]);
    manager.claimReadyItem("restart", "lead");
    expect(manager.recoverOrphanedClaims()).toBe(1);
    expect(manager.get("restart")?.workItems[0]).toMatchObject({ status: "pending", attempts: 2 });
    expect(manager.events("restart").at(-1)?.type).toBe("work-item.orphan-recovered");
    rmSync(setupState.dir, { recursive: true, force: true });
  });

  it("enforces attempt budgets after persisting lease recovery", () => {
    const setupState = setup();
    const manager = new MissionManager(setupState.options);
    manager.create({
      id: "budget",
      leadAgentId: "lead",
      ownerThreadId: "thread",
      objective: "inspect",
      budget: { maxAttempts: 1 },
    });
    manager.addWorkItem("budget", { id: "w", title: "work" });
    manager.start("budget");
    manager.claimReadyItem("budget", "lead");
    setupState.tick(101);
    expect(manager.readyItems("budget")).toEqual([]);
    const reloaded = new MissionManager(setupState.options);
    expect(reloaded.get("budget")?.workItems[0].status).toBe("pending");
    expect(reloaded.events("budget").map((event) => event.type)).toContain("work-item.lease-expired");
    rmSync(setupState.dir, { recursive: true, force: true });
  });
});
