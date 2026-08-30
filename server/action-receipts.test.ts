import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionReceiptError, ActionReceiptStore, hashActionContent } from "./action-receipts.ts";

const now = new Date("2026-08-22T12:00:00.000Z").getTime();

describe("external action receipts", () => {
  function store(at = now) {
    const dir = mkdtempSync(join(tmpdir(), "myagent-action-receipt-"));
    return { dir, value: new ActionReceiptStore(dir, { now: () => at }) };
  }

  it("hashes exact content, persists a reviewable immutable receipt, and binds approval to that hash", () => {
    const { dir, value } = store();
    const receipt = value.create({
      actionType: "email.send", channel: "email", account: "mailman@janua.example", destination: "janua@example.com",
      content: "Subject: Hello\n\nExact body", preview: "Hello — Exact body", expiresAt: now + 60_000,
    });
    expect(receipt.contentHash).toBe(hashActionContent("Subject: Hello\n\nExact body"));
    expect(receipt.execution.state).toBe("pending");
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(new ActionReceiptStore(dir, { now: () => now }).get(receipt.id)).toMatchObject({ id: receipt.id, contentHash: receipt.contentHash, execution: { state: "pending" } });
    expect(JSON.parse(readFileSync(join(dir, "action-receipts.json"), "utf8"))).toHaveLength(1);
  });

  it("invalidates an approved receipt when a draft is edited", () => {
    const { value } = store();
    const receipt = value.create({
      actionType: "whatsapp.send", channel: "whatsapp", account: "agent-business", destination: "+351900000000",
      brief: "The original message", preview: "The original message", expiresAt: now + 60_000,
    });
    value.approve(receipt.id, receipt.contentHash, "janua");
    expect(() => value.consume(receipt.id, hashActionContent("An edited message"), "provider-1")).toThrowError(/approval invalidated/);
    expect(value.get(receipt.id).execution).toMatchObject({ state: "invalidated" });
    expect(() => value.claim(receipt.id, receipt.contentHash)).toThrow(ActionReceiptError);
  });

  it("explicitly invalidates a pending receipt after a denial", () => {
    const { value } = store();
    const receipt = value.create({
      actionType: "email.send", channel: "email", account: "a", destination: "b",
      content: "body", preview: "body", expiresAt: now + 60_000,
    });
    expect(value.invalidate(receipt.id, receipt.contentHash).execution.state).toBe("invalidated");
    expect(value.invalidate(receipt.id, receipt.contentHash).execution.state).toBe("invalidated");
    expect(() => value.approve(receipt.id, receipt.contentHash, "janua")).toThrow(/invalidated/);
  });

  it("claims once and makes consumption idempotent while preserving the first provider receipt", () => {
    const { value } = store();
    const receipt = value.create({
      actionType: "phone.call", channel: "phone", account: "janua-number", destination: "+351911111111",
      contentHash: hashActionContent("Call brief"), preview: "Call about the handoff", expiresAt: now + 60_000,
    });
    value.approve(receipt.id, receipt.contentHash, "identity:janua");
    expect(value.claim(receipt.id, receipt.contentHash).execution.state).toBe("claimed");
    expect(() => value.claim(receipt.id, receipt.contentHash)).toThrowError(/already been claimed/);
    const first = value.consume(receipt.id, receipt.contentHash, { providerId: "p-1" });
    const second = value.consume(receipt.id, receipt.contentHash, { providerId: "p-2" });
    expect(first.execution).toMatchObject({ state: "consumed", providerReceipt: { providerId: "p-1" } });
    expect(second.execution).toEqual(first.execution);
  });

  it("expires before approval and never permits execution", () => {
    let at = now;
    const dir = mkdtempSync(join(tmpdir(), "myagent-action-receipt-"));
    const value = new ActionReceiptStore(dir, { now: () => at });
    const receipt = value.create({
      actionType: "email.send", channel: "email", account: "a", destination: "b", content: "body", preview: "body", expiresAt: now + 1,
    });
    at = now + 2;
    expect(value.get(receipt.id).execution.state).toBe("expired");
    expect(() => value.approve(receipt.id, receipt.contentHash, "janua")).toThrow(/expired/);
  });
});
