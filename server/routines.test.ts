import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  nextOccurrence,
  RoutineManager,
  type RoutineManagerOptions,
  type RoutineSchedule,
} from "./routines.ts";

const dirs: string[] = [];

function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "omb-routines-"));
  dirs.push(dir);
  return join(dir, "routines.json");
}

function harness(start = new Date(2026, 7, 17, 8, 0, 0).getTime()) {
  let now = start;
  let bot: "ready" | "busy" | "missing" = "ready";
  let task = 0;
  const routineTasks = new Map<string, string>();
  const started: Array<{ botId: string; threadId: string; prompt: string }> = [];
  const runOns: string[] = [];
  const triggerSources: string[] = [];
  const modelSelections: Array<unknown> = [];
  const taskActivations: boolean[] = [];
  const emitted: any[] = [];
  const changed: any[] = [];
  const failed: any[] = [];
  const options: RoutineManagerOptions = {
    file: tempFile(),
    now: () => now,
    emit: (payload) => emitted.push(payload),
    botState: () => bot,
    createTask: (_botId, _title, activate = false) => {
      taskActivations.push(activate);
      return { threadId: `thread-${++task}` };
    },
    taskForRun: (_botId, routineId) => {
      let threadId = routineTasks.get(routineId);
      if (!threadId) {
        threadId = `thread-${++task}`;
        routineTasks.set(routineId, threadId);
      }
      return { threadId };
    },
    startTurn: async (botId, threadId, prompt, runOn, triggerSource, _onDispatchError, modelSelection) => {
      started.push({ botId, threadId, prompt });
      runOns.push(runOn);
      triggerSources.push(triggerSource);
      modelSelections.push(modelSelection);
    },
    onRunChanged: (run) => changed.push(run),
    onRunFailed: (run) => failed.push(run),
  };
  const manager = new RoutineManager(options);
  return {
    manager,
    options,
    emitted,
    started,
    runOns,
    triggerSources,
    modelSelections,
    taskActivations,
    changed,
    failed,
    setNow: (value: number) => (now = value),
    setBot: (value: typeof bot) => (bot = value),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("nextOccurrence", () => {
  it("finds the next selected weekday in local wall-clock time", () => {
    const monday = new Date(2026, 7, 17, 10, 0, 0).getTime();
    const next = nextOccurrence({ type: "daily", time: "09:30", weekdays: [1, 3] }, monday)!;
    const d = new Date(next);
    expect(d.getDay()).toBe(3);
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 30]);
  });

  it("returns a one-off only while it is still in the future", () => {
    expect(nextOccurrence({ type: "once", at: 200 }, 100)).toBe(200);
    expect(nextOccurrence({ type: "once", at: 100 }, 100)).toBeNull();
  });

  it("steps an interval on marks anchored to the window start", () => {
    const monday = new Date(2026, 7, 17, 10, 7, 0).getTime();
    const next = nextOccurrence(
      { type: "interval", everyMinutes: 30, start: "09:00", end: "22:00", weekdays: [1, 2, 3, 4, 5] },
      monday,
    )!;
    const d = new Date(next);
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([1, 10, 30]);
  });

  it("rolls an interval past its window to the next allowed day", () => {
    const lateMonday = new Date(2026, 7, 17, 22, 5, 0).getTime();
    const next = nextOccurrence(
      { type: "interval", everyMinutes: 30, start: "09:00", end: "22:00", weekdays: [1, 2, 3, 4, 5] },
      lateMonday,
    )!;
    const d = new Date(next);
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([2, 9, 0]);
  });

  it("validates interval schedules on create", () => {
    const h = harness();
    expect(() => h.manager.create({
      name: "Too tight",
      prompt: "watch",
      botId: "maus-1",
      schedule: { type: "interval", everyMinutes: 2, weekdays: [1] },
    })).toThrow(/5 minutes/);
    expect(() => h.manager.create({
      name: "Backwards window",
      prompt: "watch",
      botId: "maus-1",
      schedule: { type: "interval", everyMinutes: 30, start: "18:00", end: "09:00", weekdays: [1] },
    })).toThrow(/end time/);
  });

  it("runs a local pre-check once, then writes a skipped receipt when unchanged", async () => {
    const h = harness(new Date(2026, 7, 17, 8, 0, 0).getTime());
    const routine = h.manager.create({
      name: "Cheap watch",
      prompt: "Only inspect the changed item",
      botId: "maus-1",
      precheck: { kind: "command", command: "printf stable" },
      schedule: { type: "daily", time: "08:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    expect(h.started).toHaveLength(1);
    // settle the first run — an active run would (honestly) produce a
    // missed receipt before the precheck is even consulted
    const settle = {
      eventId: "event-precheck-1",
      provider: "fake",
      threadId: h.started[0]!.threadId,
      createdAt: new Date(h.manager.listRuns()[0]!.startedAt!).toISOString(),
    };
    h.manager.handleRuntimeEvent({ ...settle, type: "item.completed", itemType: "assistant_text", text: "Inspected." });
    h.manager.handleRuntimeEvent({ ...settle, type: "turn.completed", ok: true, cost: 0 });
    const next = h.manager.listRoutines()[0]!.nextRunAt!;
    h.setNow(next);
    await h.manager.tick();
    expect(h.started).toHaveLength(1);
    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "skipped",
      precheckNote: "Pre-check: no change",
    });
  });

  it("rejects a non-local HTTP pre-check", () => {
    const h = harness();
    expect(() => h.manager.create({
      name: "Unsafe watch",
      prompt: "Check",
      botId: "maus-1",
      precheck: { kind: "http", url: "https://example.com/changed" },
      schedule: { type: "daily", time: "08:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    })).toThrow("Pre-check URL must point to localhost");
  });

  it("records an honest missed receipt when an interval run is still active", async () => {
    const start = new Date(2026, 7, 17, 8, 0, 0).getTime();
    const h = harness(start);
    const routine = h.manager.create({
      name: "X watch",
      prompt: "Check for new posts",
      botId: "maus-1",
      schedule: {
        type: "interval",
        everyMinutes: 30,
        start: "08:00",
        end: "22:00",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    expect(h.started).toHaveLength(1);

    const nextMark = h.manager.listRoutines()[0]!.nextRunAt!;
    h.setNow(nextMark);
    await h.manager.tick();

    expect(h.started).toHaveLength(1);
    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "missed",
      scheduledFor: nextMark,
    });
    expect(h.manager.listRuns()[0]!.error).toContain("still going");
    expect(h.manager.listRoutines()[0]!.nextRunAt).toBeGreaterThan(nextMark);
  });
});

describe("RoutineManager", () => {
  it("persists definitions separately from permanent run receipts", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Morning brief",
      prompt: "Summarize what changed",
      botId: "maus-1",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 5).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();

    const routineFile = h.options.file;
    if (!routineFile) throw new Error("test harness did not configure routine persistence");
    let failureWasPersistedBeforeCallback = false;
    h.options.onRunFailed = (run) => {
      h.failed.push(run);
      failureWasPersistedBeforeCallback = readFileSync(routineFile, "utf8").includes('"status": "failed"');
    };
    const reloaded = new RoutineManager(h.options);
    expect(reloaded.listRoutines()).toHaveLength(1);
    expect(reloaded.listRuns()).toMatchObject([
      { routineId: routine.id, routineName: "Morning brief", status: "failed", threadId: "thread-1" },
    ]);
    // Reload recovery truthfully marks an in-process run as interrupted.
    expect(reloaded.listRuns()[0]!.error).toContain("restarted");
    expect(failureWasPersistedBeforeCallback).toBe(true);
    expect(h.failed).toMatchObject([
      {
        routineId: routine.id,
        routineName: "Morning brief",
        status: "failed",
        threadId: "thread-1",
        error: "WatcherBotRoom restarted while this routine was running",
      },
    ]);
  });

  it("persists confirmation receipts with the scheduler mutation and removes them after settlement", () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Before",
      prompt: "Review the queue",
      botId: "maus-1",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
    });
    const request = {
      requestId: "request-update-1",
      messageId: "message-1",
      botId: "maus-1",
      threadId: "thread-1",
      action: "update" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "a".repeat(64),
    };
    h.manager.update(routine.id, { name: "After" }, request);

    const reloaded = new RoutineManager(h.options);
    expect(reloaded.routineRequestReceipt(request.requestId)).toMatchObject({
      ...request,
      resultId: routine.id,
    });
    expect(reloaded.routineRequestReceiptOwners()).toEqual([{
      requestId: request.requestId,
      messageId: request.messageId,
      botId: request.botId,
      threadId: request.threadId,
    }]);
    expect(() => reloaded.update(routine.id, { name: "Never applied" }, {
      ...request,
      fingerprint: "b".repeat(64),
    })).toThrow(/does not match/);
    expect(reloaded.listRoutines()[0]!.name).toBe("After");

    expect(reloaded.reconcileRoutineRequestReceipts([request])).toBe(0);
    expect(reloaded.forgetRoutineRequestReceipt(request)).toBe(true);
    expect(new RoutineManager(h.options).routineRequestReceipt(request.requestId)).toBeNull();
  });

  it("persists trusted chat provenance and snapshots it onto detached runs", async () => {
    const h = harness();
    const request = {
      requestId: "request-source-thread",
      messageId: "message-source-thread",
      botId: "maus-1",
      threadId: "conversation-that-created-it",
      action: "create" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "e".repeat(64),
    };
    const routine = h.manager.create({
      name: "Source report",
      prompt: "Summarize the queue",
      botId: "maus-1",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 5).getTime() },
    }, request);

    expect(routine.sourceThreadId).toBe(request.threadId);
    const reloaded = new RoutineManager(h.options);
    expect(reloaded.listRoutines()[0]?.sourceThreadId).toBe(request.threadId);

    h.setNow(routine.nextRunAt!);
    await reloaded.tick();
    const run = reloaded.listRuns()[0]!;
    expect(run).toMatchObject({
      sourceThreadId: request.threadId,
      threadId: "thread-1",
      status: "running",
    });
    expect(run.threadId).not.toBe(run.sourceThreadId);
    expect(h.changed.map(({ status, sourceThreadId, threadId }) => ({ status, sourceThreadId, threadId })))
      .toEqual([
        { status: "queued", sourceThreadId: request.threadId, threadId: undefined },
        { status: "running", sourceThreadId: request.threadId, threadId: "thread-1" },
      ]);
  });

  it("does not trust a calendar payload to choose another conversation", () => {
    const h = harness();
    const schedule: RoutineSchedule = { type: "daily", time: "09:00", weekdays: [1] };
    const calendarPayload = {
      name: "Calendar-owned",
      prompt: "Run without a chat source",
      botId: "maus-1",
      schedule,
      sourceThreadId: "forged-thread",
    };
    const routine = h.manager.create(calendarPayload);
    expect(routine.sourceThreadId).toBeUndefined();
  });

  it("keeps routine history when a persisted source thread is malformed", () => {
    const h = harness();
    const request = {
      requestId: "request-malformed-source",
      messageId: "message-malformed-source",
      botId: "maus-1",
      threadId: "trusted-source",
      action: "create" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "2".repeat(64),
    };
    h.manager.create({
      name: "Survives malformed provenance",
      prompt: "Keep this routine",
      botId: "maus-1",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
    }, request);
    const file = h.options.file;
    if (!file) throw new Error("test harness did not configure routine persistence");
    const stored = readFileSync(file, "utf8");
    const malformed = stored.replace(`"sourceThreadId": "${request.threadId}"`, '"sourceThreadId": 42');
    expect(malformed).not.toBe(stored);
    writeFileSync(file, malformed);

    const reloaded = new RoutineManager(h.options);
    expect(reloaded.listRoutines()).toMatchObject([{
      name: "Survives malformed provenance",
      sourceThreadId: undefined,
    }]);
  });

  it("reports a chat-confirmed run-now to its invoking thread without rebinding the routine", () => {
    const h = harness();
    const createRequest = {
      requestId: "request-create-origin",
      messageId: "message-create-origin",
      botId: "maus-1",
      threadId: "original-thread",
      action: "create" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "f".repeat(64),
    };
    const routine = h.manager.create({
      name: "Daily source",
      prompt: "Review it",
      botId: "maus-1",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
    }, createRequest);
    const runRequest = {
      ...createRequest,
      requestId: "request-run-now-elsewhere",
      messageId: "message-run-now-elsewhere",
      threadId: "invoking-thread",
      action: "run_now" as const,
      fingerprint: "1".repeat(64),
    };

    const run = h.manager.runNow(routine.id, runRequest)!;
    expect(run.sourceThreadId).toBe("invoking-thread");
    expect(h.manager.listRoutines()[0]?.sourceThreadId).toBe("original-thread");
  });

  it("removes unreachable recovery receipts when their conversation is deleted", () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Cleanup",
      prompt: "Clean unreachable confirmations",
      botId: "maus-1",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
    });
    const request = {
      requestId: "request-orphaned-thread",
      messageId: "message-orphaned-thread",
      botId: "maus-1",
      threadId: "thread-deleted",
      action: "pause" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "d".repeat(64),
    };
    h.manager.update(routine.id, { enabled: false }, request);

    expect(h.manager.forgetRoutineRequestReceiptsForThread("another-thread")).toBe(0);
    expect(h.manager.forgetRoutineRequestReceiptsForThread("thread-deleted")).toBe(1);
    expect(new RoutineManager(h.options).routineRequestReceipt(request.requestId)).toBeNull();
  });

  it("rolls back an uncommitted confirmation when the atomic file write fails", () => {
    const h = harness();
    const file = h.options.file!;
    // A directory at the destination makes the final atomic rename fail
    // after the temporary file has been written.
    mkdirSync(file);
    const request = {
      requestId: "request-create-write-failure",
      messageId: "message-write-failure",
      botId: "maus-1",
      threadId: "thread-1",
      action: "create" as const,
      fingerprintVersion: 1 as const,
      fingerprint: "c".repeat(64),
    };
    const input = {
      name: "Retry safely",
      prompt: "Check the queue",
      botId: "maus-1",
      schedule: { type: "daily" as const, time: "09:00", weekdays: [1] },
    };

    expect(() => h.manager.create(input, request)).toThrow();
    expect(h.manager.listRoutines()).toEqual([]);
    expect(h.manager.routineRequestReceipt(request.requestId)).toBeNull();
    expect(h.emitted).toEqual([]);

    rmSync(file, { recursive: true, force: true });
    rmSync(`${file}.tmp`, { force: true });
    const routine = h.manager.create(input, request);
    expect(h.manager.listRoutines()).toHaveLength(1);
    expect(h.manager.routineRequestReceipt(request.requestId)).toMatchObject({
      ...request,
      resultId: routine.id,
    });
  });

  it("queues behind a busy bot, then dispatches into a detached task", async () => {
    const h = harness();
    h.setBot("busy");
    const routine = h.manager.create({
      name: "Review queue",
      prompt: "Review the queue",
      botId: "maus-2",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
      durationMinutes: 45,
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    expect(h.manager.listRuns()[0]!.status).toBe("queued");
    expect(h.started).toHaveLength(0);

    h.setBot("ready");
    await h.manager.tick();
    expect(h.started).toEqual([{ botId: "maus-2", threadId: "thread-1", prompt: "Review the queue" }]);
    expect(h.manager.listRuns()[0]).toMatchObject({ status: "running", threadId: "thread-1" });
    expect(h.manager.activeRunForBot("maus-2")?.threadId).toBe("thread-1");
    expect(h.manager.isActiveThread("thread-1")).toBe(true);
    expect(h.taskActivations).toEqual([false]);
  });

  it("cancels queued work when a routine is paused", async () => {
    const h = harness();
    h.setBot("busy");
    const routine = h.manager.create({
      name: "Pauseable check",
      prompt: "Check later",
      botId: "maus-2",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();

    h.manager.update(routine.id, { enabled: false });
    h.setBot("ready");
    await h.manager.tick();

    expect(h.manager.listRuns()[0]).toMatchObject({ status: "cancelled" });
    expect(h.started).toHaveLength(0);
  });

  it("pauses definitions and cancels active work during an emergency stop", async () => {
    const h = harness();
    const interrupt = vi.fn(async () => {});
    h.options.interruptTurn = interrupt;
    const routine = h.manager.create({
      name: "Overnight scout",
      prompt: "Keep researching",
      botId: "maus-scout",
      schedule: { type: "daily", time: "23:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    h.manager.runNow(routine.id);
    await h.manager.tick();

    await expect(h.manager.pauseAll()).resolves.toEqual({
      pausedRoutines: 1,
      cancelledRuns: 1,
      interruptedRuns: 1,
    });
    expect(h.manager.listRoutines()[0]).toMatchObject({ enabled: false, nextRunAt: null });
    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "cancelled",
      error: "Emergency stop pressed",
    });
    expect(interrupt).toHaveBeenCalledWith("maus-scout", "thread-1", "maus");
  });

  it("snapshots queued instructions so later edits do not rewrite a receipt", async () => {
    const h = harness();
    h.setBot("busy");
    const routine = h.manager.create({
      name: "Original brief",
      prompt: "Use the original instructions",
      botId: "maus-2",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.update(routine.id, { name: "Edited brief", prompt: "Use the new instructions" });

    h.setBot("ready");
    await h.manager.tick();

    expect(h.started[0]?.prompt).toBe("Use the original instructions");
    expect(h.manager.listRuns()[0]).toMatchObject({
      routineName: "Original brief",
      prompt: "Use the original instructions",
    });
  });

  it("snapshots and dispatches the selected execution machine", async () => {
    const h = harness();
    h.setBot("busy");
    const routine = h.manager.create({
      name: "VM review",
      prompt: "Review the project on the virtual machine",
      botId: "maus-cloud",
      runOn: "cloud",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.update(routine.id, { runOn: "maus" });

    h.setBot("ready");
    await h.manager.tick();

    expect(h.runOns).toEqual(["cloud"]);
    expect(h.manager.listRuns()[0]).toMatchObject({ runOn: "cloud" });
    expect(h.manager.listRoutines()[0]).toMatchObject({ runOn: "maus" });
  });

  it("snapshots and dispatches a per-routine model selection", async () => {
    const h = harness();
    const validate = vi.fn();
    h.options.validateModelSelection = validate;
    const selection = { instanceId: "claude-fast", model: "sonnet", effort: "high" as const };
    const routine = h.manager.create({
      name: "Fast review",
      prompt: "Review this quickly",
      botId: "maus-model",
      modelSelection: selection,
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.update(routine.id, {
      modelSelection: { instanceId: "claude-deep", model: "opus", effort: "xhigh" },
    });
    expect(validate).toHaveBeenCalled();
    expect(h.modelSelections).toEqual([selection]);
    expect(h.manager.listRuns()[0]).toMatchObject({ modelSelection: selection });
  });

  it("opens webhook jobs in the assigned bot's live chat", async () => {
    const h = harness();
    const receivedAt = new Date(2026, 7, 17, 8, 2).getTime();
    const queued = h.manager.enqueueWebhook({
      webhookId: "hook-1",
      webhookName: "New ticket",
      prompt: "Handle ticket 42",
      botId: "maus-webhook",
      runOn: "cloud",
      deliveryId: "delivery-42",
      receivedAt,
    });
    await h.manager.tick();

    expect(queued).toMatchObject({
      routineId: "hook-1",
      webhookId: "hook-1",
      deliveryId: "delivery-42",
      triggerSource: "webhook",
      scheduledFor: receivedAt,
    });
    expect(queued).not.toHaveProperty("durationMinutes");
    expect(h.started).toEqual([{ botId: "maus-webhook", threadId: "thread-1", prompt: "Handle ticket 42" }]);
    expect(h.runOns).toEqual(["cloud"]);
    expect(h.triggerSources).toEqual(["webhook"]);
    expect(h.taskActivations).toEqual([]);
  });

  it("drains webhook deliveries oldest-first into one persistent thread", async () => {
    const h = harness();
    h.setBot("busy");
    for (const n of [1, 2, 3]) {
      h.manager.enqueueWebhook({
        webhookId: "hook-sniper",
        webhookName: "Sniper signals",
        prompt: `signal ${n}`,
        botId: "maus-sniper",
        runOn: "maus",
        deliveryId: `delivery-${n}`,
        receivedAt: n,
      });
    }
    h.setBot("ready");
    await h.manager.tick();
    expect(h.started.map((started) => started.prompt)).toEqual(["signal 1", "signal 2", "signal 3"]);
    expect(new Set(h.started.map((started) => started.threadId)).size).toBe(1);
  });

  it("folds provider lifecycle events into the calendar receipt", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Ship report",
      prompt: "Write the report",
      botId: "maus-3",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    const base = {
      eventId: "event-1",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date(h.manager.listRuns()[0]!.startedAt!).toISOString(),
    };
    const secret = `sk-ant-api03-${"abcdefghijklmnopqrstuvwxyz0123456789"}`;
    h.manager.handleRuntimeEvent({
      ...base,
      type: "request.opened",
      requestType: "question",
      tool: "ask",
      summary: `Choose the two actions before using ${secret}`,
    });
    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "waiting",
      attention: expect.stringContaining("Choose the two actions"),
    });
    expect(h.manager.listRuns()[0]!.attention).not.toContain(secret);
    h.manager.handleRuntimeEvent({ ...base, type: "request.resolved", behavior: "answer", source: "user" });
    expect(h.manager.listRuns()[0]!.attention).toBeUndefined();
    h.manager.handleRuntimeEvent({ ...base, type: "item.completed", itemType: "assistant_text", text: "Report shipped." });
    h.manager.handleRuntimeEvent({ ...base, type: "turn.completed", ok: true, cost: 0.02 });

    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "completed",
      output: "Report shipped.",
      cost: 0.02,
    });
  });

  it("never stores an internal autonomy envelope in a routine receipt", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Sensei nudge",
      prompt: "Send a midday nudge",
      botId: "sensei",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.handleRuntimeEvent({
      eventId: "sensei-output",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date().toISOString(),
      type: "item.completed",
      itemType: "assistant_text",
      text: "Move and drink water.\n\n```autonomy-outcome\n{\"kind\":\"autonomy-outcome\",\"status\":\"ok\"}\n```",
    });
    expect(h.manager.listRuns()[0]?.output).toBe("Move and drink water.");
  });

  it("uses the summary from an envelope-only successful reminder", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Sensei nudge",
      prompt: "Send a midday nudge",
      botId: "sensei",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.handleRuntimeEvent({
      eventId: "sensei-envelope",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date().toISOString(),
      type: "item.completed",
      itemType: "assistant_text",
      text: "```autonomy-outcome\n{\"kind\":\"autonomy-outcome\",\"status\":\"ok\",\"notify\":true,\"summary\":\"Move and drink water, grasshopper.\"}\n```",
    });
    expect(h.manager.listRuns()[0]?.output).toBe("Move and drink water, grasshopper.");
  });

  it("fails a scheduled run that completed without a deliverable message", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Silent reminder",
      prompt: "Come back to me",
      botId: "sensei",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.handleRuntimeEvent({
      eventId: "silent-completion",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date().toISOString(),
      type: "turn.completed",
      ok: true,
    });
    expect(h.manager.listRuns()[0]).toMatchObject({
      status: "failed",
      error: "The bot finished without producing a message for you",
    });
    expect(h.failed).toHaveLength(1);
  });

  it("reports a failed run once with its detached thread", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Broken report",
      prompt: "Write the report",
      botId: "maus-failed",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();

    h.manager.handleRuntimeEvent({
      eventId: "failed",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date().toISOString(),
      type: "turn.completed",
      ok: false,
      stopReason: "provider crashed",
    });

    expect(h.failed).toMatchObject([
      {
        routineName: "Broken report",
        botId: "maus-failed",
        threadId: "thread-1",
        status: "failed",
        error: "provider crashed",
      },
    ]);
    expect(h.manager.listRuns()[0]).toMatchObject({ threadId: "thread-1", status: "failed" });

    h.manager.markSeen(h.failed[0].id);
    expect(h.failed).toHaveLength(1);
  });

  it("keeps recurring history while advancing the definition", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Daily check",
      prompt: "Check it",
      botId: "maus-4",
      schedule: { type: "daily", time: "08:05", weekdays: [1, 2, 3, 4, 5] },
    });
    h.setNow(routine.nextRunAt!);
    await h.manager.tick();
    h.manager.handleRuntimeEvent({
      eventId: "done",
      provider: "fake",
      threadId: "thread-1",
      createdAt: new Date().toISOString(),
      type: "turn.completed",
      ok: true,
    });

    expect(h.manager.listRuns()).toHaveLength(1);
    expect(h.manager.listRoutines()[0]!.nextRunAt).toBeGreaterThan(routine.nextRunAt!);
  });

  it("records a missed receipt instead of launching very stale work", async () => {
    const h = harness();
    const routine = h.manager.create({
      name: "Old check",
      prompt: "Do the old thing",
      botId: "maus-5",
      schedule: { type: "once", at: new Date(2026, 7, 17, 8, 1).getTime() },
    });
    h.setNow(routine.nextRunAt! + 13 * 60 * 60_000);
    await h.manager.tick();
    expect(h.manager.listRuns()[0]).toMatchObject({ status: "missed" });
    expect(h.started).toHaveLength(0);
    expect(h.failed).toMatchObject([{ id: h.manager.listRuns()[0]!.id, status: "missed" }]);
  });

  it("records a missed receipt for a once routine created with a long-past time", async () => {
    const h = harness();
    const staleAt = new Date(2026, 7, 16, 6, 0, 0).getTime();
    const routine = h.manager.create({
      name: "Stale check",
      prompt: "Do the stale thing",
      botId: "maus-6",
      schedule: { type: "once", at: staleAt },
    });
    expect(routine.nextRunAt).toBe(staleAt);
    await h.manager.tick();
    expect(h.manager.listRuns()[0]).toMatchObject({ status: "missed", scheduledFor: staleAt });
    expect(h.started).toHaveLength(0);
  });

  it("runs a once routine created slightly late and records the original scheduled time", async () => {
    const h = harness();
    const lateAt = new Date(2026, 7, 17, 7, 55, 0).getTime();
    const routine = h.manager.create({
      name: "Late check",
      prompt: "Do the late thing",
      botId: "maus-7",
      schedule: { type: "once", at: lateAt },
    });
    expect(routine.nextRunAt).toBe(lateAt);
    await h.manager.tick();
    expect(h.started).toHaveLength(1);
    expect(h.manager.listRuns()[0]).toMatchObject({ status: "running", scheduledFor: lateAt });
  });
});
