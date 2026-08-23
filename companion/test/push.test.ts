import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { DeviceRegistry } from "../src/devices.ts";
import { DATA_DIR } from "../src/state.ts";
import { apnsConfig, notificationPayload } from "../src/push.ts";

const pair = (registry: DeviceRegistry) => {
  const { code } = registry.openPairing();
  const result = registry.redeem(code, "Janua's iPhone");
  if ("error" in result) throw new Error(result.error);
  return result;
};

describe("APNs registration", () => {
  beforeEach(() => rmSync(DATA_DIR, { recursive: true, force: true }));

  it("binds a valid APNs token to one paired device and hides it from the control UI", () => {
    const registry = new DeviceRegistry();
    const { device } = pair(registry);
    const token = "ab".repeat(32);

    expect(registry.setPush(device.id, token, "development")).toBe(true);
    expect(registry.pushTargets()).toEqual([
      expect.objectContaining({ deviceId: device.id, token, environment: "development" }),
    ]);
    expect(JSON.stringify(registry.list())).not.toContain(token);
    expect(readFileSync(join(DATA_DIR, "devices.json"), "utf8")).toContain(token);
  });

  it("suppresses duplicate delivery while that phone has a live app stream", () => {
    const registry = new DeviceRegistry();
    const { device } = pair(registry);
    expect(registry.setPush(device.id, "12".repeat(32), "production")).toBe(true);
    registry.streamOpened(device.id);
    expect(registry.pushTargets()).toEqual([]);
    registry.streamClosed(device.id);
    expect(registry.pushTargets()).toHaveLength(1);
  });

  it("rejects malformed tokens and environments", () => {
    const registry = new DeviceRegistry();
    const { device } = pair(registry);
    expect(registry.setPush(device.id, "not-a-token", "production")).toBe(false);
    expect(registry.setPush(device.id, "ab".repeat(32), "preview")).toBe(false);
  });
});
describe("APNs wire contract", () => {
  it("marks approvals time-sensitive and carries only navigation ids", () => {
    const payload = notificationPayload({
      title: "Forge needs you",
      body: "Approve this action?",
      botId: "forge",
      threadId: "thread-1",
      kind: "approval",
      isBlocking: true,
    }) as any;
    expect(payload.aps["interruption-level"]).toBe("time-sensitive");
    expect(payload.aps.category).toBe("WATCHERBOT_APPROVAL");
    expect(payload).toMatchObject({ botId: "forge", threadId: "thread-1", kind: "approval" });
  });

  it("stays off unless every APNs credential is present", () => {
    expect(apnsConfig({})).toBeNull();
    expect(apnsConfig({ OMB_APNS_TEAM_ID: "team", OMB_APNS_KEY_ID: "key" })).toBeNull();
  });
});
