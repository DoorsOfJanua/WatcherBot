import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { MissionDispatcher, type MissionExecutionResult } from "./mission-dispatcher.ts";
import { MissionManager } from "./missions.ts";
import { RoutineManager, type RoutineRun } from "./routines.ts";

describe("mission routine execution bridge", () => {
  it("runs a recovered two-item DAG through routine receipts and source reporting", async () => {
    const dir = mkdtempSync(join(tmpdir(), "watcherbot-mission-routine-"));
    let now = 1_000;
    const manager = new MissionManager({
      file: join(dir, "missions.json"),
      now: () => now,
      leaseMs: 100,
    });
    manager.create({ id: "mission", leadAgentId: "lead", ownerThreadId: "owner-thread", objective: "Ship safely" });
    manager.addWorkItem("mission", { id: "one", title: "Prepare" });
    manager.addWorkItem("mission", { id: "two", title: "Ship", dependsOn: ["one"] });
    manager.start("mission");

    // Prove lease recovery before the sibling dispatcher resumes the DAG.
    manager.claimReadyItem("mission", "lead");
    now += 101;
    expect(manager.readyItems("mission").map((item) => item.id)).toEqual(["one"]);

    const changes: RoutineRun[] = [];
    const waiters = new Map<string, (result: MissionExecutionResult) => void>();
    let routines!: RoutineManager;
    const startTurn = vi.fn(async (_botId: string, threadId: string) => {
      queueMicrotask(() => {
        routines.handleRuntimeEvent({
          eventId: `output-${threadId}`,
          provider: "fake",
          threadId,
          createdAt: new Date().toISOString(),
          type: "item.completed",
          itemType: "assistant_text",
          text: "```autonomy-outcome\n{\"kind\":\"autonomy-outcome\",\"status\":\"completed\",\"summary\":\"Work complete\"}\n```",
        });
        routines.handleRuntimeEvent({
          eventId: `done-${threadId}`,
          provider: "fake",
          threadId,
          createdAt: new Date().toISOString(),
          type: "turn.completed",
          ok: true,
          cost: 0.01,
        });
      });
    });
    routines = new RoutineManager({
      file: join(dir, "routines.json"),
      now: () => now,
      botState: () => "ready",
      createTask: (_botId, title) => ({ threadId: `run-${title}-${changes.length}` }),
      startTurn,
      onRunChanged: (run) => {
        changes.push(run);
        if (run.status !== "completed") return;
        const resolve = waiters.get(run.id);
        if (!resolve) return;
        waiters.delete(run.id);
        resolve({ status: "complete", result: run.output, usage: { cost: run.cost ?? undefined } });
      },
    });
    const dispatcher = new MissionDispatcher({
      manager,
      now: () => now,
      execute: (mission, item, agentId) => new Promise((resolve) => {
        const run = routines.enqueueMission({
          missionId: mission.id,
          missionTitle: mission.title,
          workItemId: item.id,
          workItemTitle: item.title,
          prompt: `Do ${item.title}`,
          botId: agentId,
          sourceBotId: mission.leadAgentId,
          sourceThreadId: mission.ownerThreadId,
        });
        waiters.set(run.id, resolve);
      }),
    });

    await dispatcher.runOnce();
    expect(manager.get("mission")?.workItems[0]).toMatchObject({ status: "completed", attempts: 2 });
    await dispatcher.runOnce();
    expect(manager.get("mission")?.status).toBe("completed");
    expect(startTurn).toHaveBeenCalledTimes(2);
    expect(routines.listRoutines()).toEqual([]);
    expect(routines.listRuns()).toHaveLength(2);
    expect(routines.listRuns()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        triggerSource: "mission",
        missionId: "mission",
        sourceBotId: "lead",
        sourceThreadId: "owner-thread",
        status: "completed",
        output: "Work complete",
      }),
    ]));
    expect(changes.some((run) => run.status === "queued" && run.triggerSource === "mission")).toBe(true);
    expect(changes.some((run) => run.status === "completed" && run.triggerSource === "mission")).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
