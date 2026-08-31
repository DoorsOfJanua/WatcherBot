import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMonitorPrecheckProvider,
  fingerprintMonitorContent,
  MonitorEvaluator,
  normalizeMonitorContent,
} from "./monitor-evaluator.ts";
import { createHttpMonitorAdapter } from "./monitor-http-adapter.ts";
import { RoutineManager } from "./routines.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "watcherbot-monitor-precheck-"));
  dirs.push(dir);
  return join(dir, "routines.json");
}

function response(body: string): Response {
  const value = new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  Object.defineProperty(value, "url", { value: "https://example.test/" });
  return value;
}

describe("MonitorEvaluator", () => {
  it("normalizes unstable markup and produces stable content fingerprints", async () => {
    const evaluator = new MonitorEvaluator({
      adapters: { fixture: async () => "<main>Hello&nbsp; world</main><script>noise</script>" },
    });
    const result = await evaluator.evaluate({ kind: "fixture" });
    expect(result.normalized).toBe("Hello world");
    expect(normalizeMonitorContent("<b>A</b>  B")).toBe("A B");
    expect(result.fingerprint).toBe(fingerprintMonitorContent("Hello world"));
  });

  it("skips an unchanged HTTP page before creating a task or model turn", async () => {
    let now = new Date(2026, 7, 17, 8, 0, 0).getTime();
    const startTurn = vi.fn(async () => {});
    const createTask = vi.fn(() => ({ threadId: "monitor-thread" }));
    const http = createHttpMonitorAdapter({
      fetch: async () => response("<main>Stable page</main>"),
      resolve: async () => ["93.184.216.34"],
    });
    const manager = new RoutineManager({
      file: tempFile(),
      now: () => now,
      botState: () => "ready",
      createTask,
      startTurn,
      precheckProviders: {
        monitor: createMonitorPrecheckProvider({ adapters: { http } }),
      },
    });
    const routine = manager.create({
      name: "Cheap page watch",
      prompt: "Investigate and report the changed page",
      botId: "watcher",
      schedule: { type: "daily", time: "08:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
      precheck: {
        kind: "monitor",
        source: { kind: "http", url: "https://example.test" },
      },
    });

    now = routine.nextRunAt!;
    await manager.tick();
    expect(startTurn).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledTimes(1);
    // settle the first run — an active run would (honestly) produce a
    // missed receipt before the precheck is even consulted
    const settle = {
      eventId: "event-monitor-1",
      provider: "fake",
      threadId: "monitor-thread",
      createdAt: new Date(manager.listRuns()[0]!.startedAt!).toISOString(),
    };
    manager.handleRuntimeEvent({ ...settle, type: "item.completed", itemType: "assistant_text", text: "Checked." });
    manager.handleRuntimeEvent({ ...settle, type: "turn.completed", ok: true, cost: 0 });

    now = manager.listRoutines()[0]!.nextRunAt!;
    await manager.tick();
    expect(startTurn).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(manager.listRuns()[0]).toMatchObject({
      status: "skipped",
      precheckNote: "Pre-check: no change",
    });
  });
});
