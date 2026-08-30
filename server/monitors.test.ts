import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MonitorManager } from "./monitors.ts";

const owner = { botId: "bot-1", threadId: "thread-1" };
const dirs: string[] = [];
function file() {
  const dir = mkdtempSync(join(tmpdir(), "myagent-monitors-"));
  dirs.push(dir);
  return join(dir, "monitors.json");
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("MonitorManager", () => {
  it("persists versioned records and reloads them", () => {
    let now = 1000;
    const path = file();
    const manager = new MonitorManager({ file: path, now: () => now });
    const created = manager.create({
      ...owner,
      name: "Release page", source: { kind: "http", url: "https://example.test" },
      config: { selector: "main" }, baseline: { fingerprint: "a", capturedAt: 900 },
      schedule: { intervalMinutes: 30, nextDueAt: 2_000 },
      notificationPolicy: { onChange: true, cooldownMinutes: 5 },
    });
    expect(created).not.toHaveProperty("intervalMinutes");
    expect(created).not.toHaveProperty("nextDueAt");
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ version: 1, monitors: [{ id: created.id }] });
    expect(new MonitorManager({ file: path, now: () => now }).get(created.id)).toMatchObject({
      name: "Release page", source: { kind: "http" }, schedule: { intervalMinutes: 30, nextDueAt: 2_000 },
      notificationPolicy: { enabled: true, onChange: true, onError: true, cooldownMinutes: 5 },
    });
  });

  it("defaults omitted due time to now and allows explicitly clearing it", () => {
    let now = 1_000;
    const manager = new MonitorManager({ file: file(), now: () => now });
    const created = manager.create({ ...owner, name: "Due", source: {}, schedule: { intervalMinutes: 5 } });
    expect(created.schedule.nextDueAt).toBe(1_000);
    expect(manager.update(created.id, { schedule: { nextDueAt: null } })?.schedule.nextDueAt).toBeNull();
    now = 2_000;
    const updated = manager.update(created.id, { name: "Due again" })!;
    expect(updated.schedule.nextDueAt).toBeNull();
    expect(updated).not.toHaveProperty("intervalMinutes");
    expect(updated).not.toHaveProperty("nextDueAt");
  });

  it("supports update, observation metadata, pause/resume, and archive-safe deletion", () => {
    let now = 100;
    const manager = new MonitorManager({ file: file(), now: () => now });
    const monitor = manager.create({ ...owner, name: "Build", source: { kind: "command" }, schedule: { intervalMinutes: 10 } });
    expect(manager.update(monitor.id, { lastObservation: { status: "changed", observedAt: 110, metadata: { count: 2 } }, schedule: { nextDueAt: 500 } })).toMatchObject({
      lastObservation: { status: "changed", observedAt: 110 }, schedule: { nextDueAt: 500 },
    });
    expect(manager.pause(monitor.id)).toMatchObject({ status: "paused", schedule: { nextDueAt: null } });
    now = 200;
    expect(manager.resume(monitor.id)).toMatchObject({ status: "active", schedule: { nextDueAt: 200 } });
    expect(manager.delete(monitor.id)).toBe(false);
    const archived = manager.archive(monitor.id)!;
    expect(archived.status).toBe("archived");
    expect(manager.list()).toHaveLength(0);
    expect(manager.list({ includeArchived: true })).toHaveLength(1);
    expect(manager.update(monitor.id, { name: "Nope" })).toBeNull();
    expect(manager.delete(monitor.id)).toBe(true);
    expect(manager.get(monitor.id)).toBeNull();
  });

  it("rejects invalid source, schedule, and notification policy", () => {
    const manager = new MonitorManager({ file: file() });
    expect(() => manager.create({ ...owner, name: "", source: {}, schedule: { intervalMinutes: 5 } })).toThrow();
    expect(() => manager.create({ ...owner, name: "x", source: [], schedule: { intervalMinutes: 5 } } as never)).toThrow("source");
    expect(() => manager.create({ ...owner, name: "x", source: {}, schedule: { intervalMinutes: 0 } })).toThrow("interval");
    expect(() => manager.create({ ...owner, name: "x", source: {}, schedule: { intervalMinutes: 5 }, notificationPolicy: { cooldownMinutes: -1 } })).toThrow("cooldown");
  });
});
