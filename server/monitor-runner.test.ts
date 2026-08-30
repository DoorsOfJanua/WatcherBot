import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonitorEvaluator } from "./monitor-evaluator.ts";
import { MonitorManager } from "./monitors.ts";
import { MonitorRunner } from "./monitor-runner.ts";

const dirs: string[] = [];
function file() { const d = mkdtempSync(join(tmpdir(), "myagent-runner-")); dirs.push(d); return join(d, "monitors.json"); }
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("MonitorRunner", () => {
  it("runs only due monitors, caps work, isolates errors, and notifies changes", async () => {
    let now = 1000;
    const manager = new MonitorManager({ file: file(), now: () => now });
    const owner = { botId: "bot", threadId: "thread" };
    const one = manager.create({ ...owner, name: "One", source: { kind: "x" }, schedule: { intervalMinutes: 5, nextDueAt: 900 } });
    const two = manager.create({ ...owner, name: "Two", source: { kind: "x" }, schedule: { intervalMinutes: 5, nextDueAt: 900 } });
    manager.create({ ...owner, name: "Later", source: { kind: "x" }, schedule: { intervalMinutes: 5, nextDueAt: 5000 } });
    let calls = 0;
    const evaluator = new MonitorEvaluator(manager, { now: () => now, adapters: { x: async (_source) => { calls++; if (calls === 2) throw new Error("bad"); return calls === 1 ? "a" : "b"; } } });
    const notified: string[] = [];
    const runner = new MonitorRunner(manager, evaluator, { maxPerTick: 2, onNotify: (result) => { notified.push(result.monitor.name); } });
    const results = await runner.tick();
    expect(results).toHaveLength(2); expect(calls).toBe(2); expect(notified).toEqual(["One"]);
    now = 400_000;
    const results2 = await runner.tick();
    expect(results2).toHaveLength(2); expect(notified).toEqual(["One", "Two"]);
    expect(one.id).not.toBe(two.id);
  });

  it("does not overlap ticks and start/stop are idempotent", async () => {
    const manager = new MonitorManager({ file: file() });
    const evaluator = { evaluate: vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return null; }) } as unknown as MonitorEvaluator;
    const runner = new MonitorRunner(manager, evaluator, { intervalMs: 1 });
    runner.start(); runner.start(); expect(runner.isRunning()).toBe(true);
    const [a, b] = await Promise.all([runner.tick(), runner.tick()]);
    runner.stop(); runner.stop();
    expect(a.length + b.length).toBe(0); expect(evaluator.evaluate).not.toHaveBeenCalled();
  });
});
