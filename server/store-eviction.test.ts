// The materialized-thread cache must stay a cache: every mutation writes
// through to SQLite first, so an idle thread can be dropped from memory and
// re-read later with nothing lost. Without eviction, every thread ever
// touched stays fully in RAM (messages plus screen frames) for the life of
// the process.
import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_DIR } from "./config.ts";
import type { ModelSelection } from "./contracts.ts";
import { Store } from "./store.ts";

const selection = (): ModelSelection => ({ instanceId: "claude", model: "claude-sonnet-5" });

const cacheSize = (store: Store) => store.materializedThreadCount;

describe("thread cache eviction", () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("evicts idle threads once the cache is full, and loses nothing", () => {
    let now = 1_000_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const store = new Store(selection);

    const bots = Array.from({ length: Store.THREAD_CACHE_MAX + 1 }, () => store.createBot());
    const first = bots[0];
    store.appendMessage(first.threadId, { role: "user", kind: "text", text: "written before eviction" });
    const held = store.messagesFor(first.threadId);
    expect(cacheSize(store)).toBeGreaterThan(Store.THREAD_CACHE_MAX);

    // everything goes idle, then one fresh materialization triggers the sweep
    now += Store.THREAD_IDLE_EVICT_MS + 60_000;
    // the sweep leaves exactly one free slot, which the fresh thread fills
    const fresh = store.createBot();
    store.messagesFor(fresh.threadId);
    expect(cacheSize(store)).toBe(Store.THREAD_CACHE_MAX);

    // the evicted thread re-reads from SQLite identically — a new array,
    // same content, same branch head
    const leafBefore = held.at(-1)!.id;
    const reloaded = store.messagesFor(first.threadId);
    expect(reloaded).not.toBe(held);
    expect(reloaded.map((m) => m.text)).toContain("written before eviction");
    expect(store.activeLeaf(first.threadId)).toBe(leafBefore);
  });

  it("never evicts a recently touched thread, even with the cache over its cap", () => {
    let now = 1_000_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const store = new Store(selection);

    for (let i = 0; i < Store.THREAD_CACHE_MAX + 5; i++) store.createBot();
    const sizeBefore = cacheSize(store);

    // a minute later everything is still inside the idle floor — a new
    // materialization must not evict anything
    now += 60_000;
    store.messagesFor(store.createBot().threadId);
    expect(cacheSize(store)).toBe(sizeBefore + 1);
  });
});
