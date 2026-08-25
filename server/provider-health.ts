import type { RuntimeEvent } from "./contracts.ts";

export type ProviderHealthStatus = "ok" | "limited" | "down";
export interface ProviderHealth { instanceId: string; status: ProviderHealthStatus; reason?: string; lastOkAt?: number; lastCheckedAt: number; consecutiveFailures: number; }

export class ProviderHealthStore {
  private readonly states = new Map<string, ProviderHealth>();
  observe(event: RuntimeEvent, now = Date.now()): ProviderHealth | null {
    const instanceId = event.providerInstanceId;
    if (!instanceId) return null;
    const previous = this.states.get(instanceId) ?? { instanceId, status: "ok" as const, lastCheckedAt: now, consecutiveFailures: 0 };
    if (event.type === "turn.completed" && event.ok) {
      const next = { ...previous, status: "ok" as const, reason: undefined, lastOkAt: now, lastCheckedAt: now, consecutiveFailures: 0 };
      this.states.set(instanceId, next); return next;
    }
    if (event.type === "runtime.error" || (event.type === "turn.completed" && !event.ok)) {
      const failures = previous.consecutiveFailures + 1;
      const text = event.type === "runtime.error" ? event.message : event.stopReason ?? "turn failed";
      const limited = /rate|quota|usage|limit|overage|capacity/i.test(text);
      const next = { ...previous, status: limited ? "limited" as const : failures >= 2 ? "down" as const : previous.status, reason: text, lastCheckedAt: now, consecutiveFailures: failures };
      this.states.set(instanceId, next); return next;
    }
    // Nothing changed — return null so the caller does not broadcast. Every
    // content.delta carries providerInstanceId; returning `previous` here
    // made the server emit a provider-health frame per streamed token,
    // flooding the SSE replay buffer and evicting real message frames.
    return null;
  }
  list(): ProviderHealth[] { return [...this.states.values()].map((state) => ({ ...state })); }
}
