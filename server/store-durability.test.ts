// The transcript is durable state: a message the disk refused must never be
// visible in memory, and a roster file that exists but cannot be parsed must
// be preserved, not silently replaced by an empty fleet.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_DIR } from "./config.ts";
import type { ModelSelection } from "./contracts.ts";
import * as mdb from "./message-db.ts";
import { readRosterFile, Store, type StoreChange } from "./store.ts";

vi.mock("./message-db.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./message-db.ts")>();
  return { ...actual, appendMessage: vi.fn(actual.appendMessage) };
});

const selection = (): ModelSelection => ({ instanceId: "claude", model: "claude-sonnet-5" });

describe("transcript durability", () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
    vi.mocked(mdb.appendMessage).mockRestore?.();
  });

  it("a failed durable write leaves no ghost message in memory and emits nothing", () => {
    const store = new Store(selection);
    const bot = store.createBot();
    const before = store.messagesFor(bot.threadId);
    const leafBefore = store.activeLeaf(bot.threadId);

    const events: StoreChange[] = [];
    store.onChange((change) => events.push(change));
    vi.mocked(mdb.appendMessage).mockImplementationOnce(() => {
      throw new Error("SQLITE_BUSY");
    });

    expect(() =>
      store.appendMessage(bot.threadId, { role: "user", kind: "text", text: "must not ghost" }),
    ).toThrow("SQLITE_BUSY");

    // memory matches disk: nothing was added, the branch head did not move,
    // and no client was told about a message that does not exist
    expect(store.messagesFor(bot.threadId)).toHaveLength(before.length);
    expect(store.activeLeaf(bot.threadId)).toBe(leafBefore);
    expect(events.filter((e) => e.type === "message")).toHaveLength(0);

    // the store still works after the failure
    const appended = store.appendMessage(bot.threadId, { role: "user", kind: "text", text: "landed" });
    const reloaded = new Store(selection);
    expect(reloaded.messagesFor(bot.threadId).map((m) => m.id)).toContain(appended.id);
    expect(reloaded.messagesFor(bot.threadId).map((m) => m.text)).not.toContain("must not ghost");
  });

  it("a corrupt bots.json is preserved beside the store instead of silently emptied", () => {
    mkdirSync(DATA_DIR, { recursive: true });
    const file = join(DATA_DIR, "bots.json");
    writeFileSync(file, "{ definitely not json");

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = readRosterFile(file);
    spy.mockRestore();

    expect(loaded).toEqual([]);
    expect(existsSync(file)).toBe(false); // moved, not overwritten
    const backup = readdirSync(DATA_DIR).find((name) => name.startsWith("bots.json.corrupt-"));
    expect(backup).toBeTruthy();
    expect(readFileSync(join(DATA_DIR, backup!), "utf8")).toBe("{ definitely not json");
  });

  it("a missing roster file is just a fresh install", () => {
    mkdirSync(DATA_DIR, { recursive: true });
    expect(readRosterFile(join(DATA_DIR, "bots.json"))).toEqual([]);
  });

  it("valid JSON of the wrong shape is preserved, not adopted as an empty fleet", () => {
    mkdirSync(DATA_DIR, { recursive: true });
    const file = join(DATA_DIR, "bots.json");
    writeFileSync(file, JSON.stringify({ bots: [{ id: "b1" }] }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readRosterFile(file)).toEqual([]);
    spy.mockRestore();
    expect(existsSync(file)).toBe(false);
    expect(readdirSync(DATA_DIR).some((name) => name.startsWith("bots.json.corrupt-"))).toBe(true);
  });

  it("an unreadable roster refuses to start instead of silently wiping it", () => {
    mkdirSync(join(DATA_DIR, "bots.json"), { recursive: true }); // a directory: read fails, not ENOENT
    expect(() => readRosterFile(join(DATA_DIR, "bots.json"))).toThrow(/cannot be read/);
  });

  it("an automation keeps ONE persistent thread across runs, restarts included", () => {
    const store = new Store(selection);
    const bot = store.createBot();
    const first = store.taskForRoutine(bot.id, "hook-sniper", "Sniper signals");
    const again = store.taskForRoutine(bot.id, "hook-sniper", "Sniper signals");
    expect(first).toBeTruthy();
    expect(again?.threadId).toBe(first!.threadId);
    // the automation's task never steals the visible conversation
    expect(store.bot(bot.id)?.threadId).toBe(bot.threadId);

    store.appendMessage(first!.threadId, { role: "user", kind: "text", text: "signal one" });
    const reloaded = new Store(selection);
    expect(reloaded.taskForRoutine(bot.id, "hook-sniper", "Sniper signals")?.threadId).toBe(first!.threadId);
    expect(reloaded.messagesFor(first!.threadId).map((m) => m.text)).toContain("signal one");
  });
});
