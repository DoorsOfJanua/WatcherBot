import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitorEvaluator, normalizeMonitorContent } from "./monitor-evaluator.ts";
import { MonitorManager } from "./monitors.ts";

const owner = { botId: "bot-1", threadId: "thread-1" };
const dirs: string[] = [];
function path() { const dir = mkdtempSync(join(tmpdir(), "myagent-monitor-eval-")); dirs.push(dir); return join(dir, "monitors.json"); }
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("MonitorEvaluator", () => {
  it("normalizes HTML and establishes a quiet baseline", async () => {
    let now = 100;
    const manager = new MonitorManager({ file: path(), now: () => now });
    const monitor = manager.create({ ...owner, name: "Page", source: { kind: "fixture" }, schedule: { intervalMinutes: 5 } });
    const evaluate = new MonitorEvaluator(manager, { now: () => now, adapters: { fixture: vi.fn(async () => "<main>Hello&nbsp; world</main><script>noise</script>") } });
    const result = await evaluate.evaluate(monitor.id);
    expect(normalizeMonitorContent("<b>A</b>  B")).toBe("A B");
    expect(result).toMatchObject({ baselineEstablished: true, changed: false, shouldNotify: false, outcome: { status: "unchanged", notify: false } });
    expect(manager.get(monitor.id)?.baseline?.value).toBe("Hello world");
  });

  it("stays quiet when unchanged, then returns evidence for change and persists it", async () => {
    let now = 100;
    const file = path();
    const manager = new MonitorManager({ file, now: () => now });
    const monitor = manager.create({ ...owner, name: "Feed", source: { kind: "fixture" }, schedule: { intervalMinutes: 5 } });
    let value = "same";
    const evaluate = new MonitorEvaluator(manager, { now: () => now, adapters: { fixture: async () => value } });
    await evaluate.evaluate(monitor.id);
    now = 200;
    expect((await evaluate.evaluate(monitor.id))?.shouldNotify).toBe(false);
    value = "different"; now = 300;
    const changed = await evaluate.evaluate(monitor.id);
    expect(changed).toMatchObject({ changed: true, shouldNotify: true, outcome: { changed: true } });
    expect(new MonitorManager({ file }).get(monitor.id)?.baseline?.value).toBe("different");
  });

  it("records adapter errors and honors error notification policy", async () => {
    const manager = new MonitorManager({ file: path() });
    const monitor = manager.create({ ...owner, name: "Broken", source: { kind: "broken" }, schedule: { intervalMinutes: 5 }, notificationPolicy: { onError: false } });
    const result = await new MonitorEvaluator(manager, { adapters: { broken: async () => { throw new Error("offline"); } } }).evaluate(monitor.id);
    expect(result).toMatchObject({ shouldNotify: false, outcome: { status: "failed" }, monitor: { lastObservation: { status: "error", error: "offline" } } });
  });
});
