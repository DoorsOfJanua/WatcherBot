import { describe, expect, it } from "vitest";
import { ProviderHealthStore } from "./provider-health.ts";

const base = { eventId: "e", provider: "claude", providerInstanceId: "claude", threadId: "t", createdAt: "2026-08-24T00:00:00Z" };

describe("provider health", () => {
  it("marks quota failures limited and clears after success", () => {
    const store = new ProviderHealthStore();
    store.observe({ ...base, type: "runtime.error", message: "usage limit reached" }, 1);
    expect(store.list()[0]).toMatchObject({ status: "limited", consecutiveFailures: 1 });
    store.observe({ ...base, type: "turn.completed", ok: true }, 2);
    expect(store.list()[0]).toMatchObject({ status: "ok", consecutiveFailures: 0 });
  });

  it("requires two ordinary failures before declaring a lane down", () => {
    const store = new ProviderHealthStore();
    store.observe({ ...base, type: "runtime.error", message: "spawn failed" }, 1);
    expect(store.list()[0]?.status).toBe("ok");
    store.observe({ ...base, type: "runtime.error", message: "spawn failed" }, 2);
    expect(store.list()[0]?.status).toBe("down");
  });
});
