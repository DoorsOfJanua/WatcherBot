import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionReceiptError, ActionReceiptStore } from "./action-receipts.ts";
import {
  canonicalMailDraft,
  MailActionCoordinator,
  MailActionStore,
  mailDraftHash,
  normalizeMailDraft,
  type MailDraft,
  type MailSender,
} from "./mail-actions.ts";

const NOW = new Date("2026-08-23T12:00:00.000Z").getTime();

const draft: MailDraft = {
  fromAccount: "nils.palmen@protonmail.com",
  to: ["farmada@example.com"],
  cc: [],
  bcc: [],
  subject: "Farmada questionnaire",
  body: "Dear Farmada,\n\nHere is the exact approved reply.\n\nJanua",
  attachments: [],
};

function harness(sender?: MailSender) {
  const dir = mkdtempSync(join(tmpdir(), "myagent-mail-action-"));
  let calls = 0;
  const fake: MailSender = sender ?? {
    async send(value, expectedHash) {
      calls += 1;
      expect(mailDraftHash(value)).toBe(expectedHash);
      return {
        provider: "proton-bridge",
        account: value.fromAccount,
        messageId: "provider-message-1",
        acceptedAt: "2026-08-23T12:01:00.000Z",
      };
    },
  };
  const receipts = new ActionReceiptStore(dir, { now: () => NOW });
  const actions = new MailActionStore(dir);
  return {
    dir,
    receipts,
    actions,
    coordinator: new MailActionCoordinator(receipts, actions, fake, () => NOW),
    calls: () => calls,
  };
}

describe("Mailman exact-draft action", () => {
  it("normalizes the draft and uses one canonical provider-compatible hash", () => {
    const normalized = normalizeMailDraft({
      ...draft,
      fromAccount: " NILS.PALMEN@PROTONMAIL.COM ",
      to: ["FARMADA@example.com", "farmada@example.com"],
      body: "Line one\r\nLine two\n",
    });
    expect(normalized).toMatchObject({
      fromAccount: "nils.palmen@protonmail.com",
      to: ["farmada@example.com"],
      body: "Line one\nLine two",
    });
    expect(mailDraftHash(normalized)).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalMailDraft(normalized)).toContain('"attachments":[]');
  });

  it("persists the full frozen copy privately and stages a review receipt", () => {
    const h = harness();
    const { action, receipt } = h.coordinator.stage({ botId: "mailman", threadId: "mail-thread", draft });
    expect(receipt).toMatchObject({
      actionType: "email.send",
      account: draft.fromAccount,
      destination: draft.to[0],
      contentHash: action.draftHash,
      execution: { state: "pending" },
    });
    expect(receipt.preview).toContain(draft.body);
    expect(JSON.parse(readFileSync(join(h.dir, "mail-actions.json"), "utf8"))[0].draft).toEqual(draft);
    expect(statSync(join(h.dir, "mail-actions.json")).mode & 0o777).toBe(0o600);
  });

  it("cannot send before approval and sends the exact frozen copy once after approval", async () => {
    const h = harness();
    const { action } = h.coordinator.stage({ botId: "mailman", threadId: "mail-thread", draft });
    expect(() => h.receipts.claim(action.receiptId, action.draftHash)).toThrow(ActionReceiptError);

    const sent = await h.coordinator.approveAndSend(action.receiptId, "identity:janua");
    expect(sent).toMatchObject({ state: "sent", providerReceipt: { messageId: "provider-message-1" } });
    expect(h.calls()).toBe(1);
    expect(h.receipts.get(action.receiptId)).toMatchObject({
      approvedBy: "identity:janua",
      execution: { state: "consumed", providerReceipt: { messageId: "provider-message-1" } },
    });

    const replay = await h.coordinator.approveAndSend(action.receiptId, "identity:janua");
    expect(replay.providerReceipt?.messageId).toBe("provider-message-1");
    expect(h.calls()).toBe(1);
  });

  it("permanently invalidates a denied draft", async () => {
    const h = harness();
    const { action } = h.coordinator.stage({ botId: "mailman", threadId: "mail-thread", draft });
    expect(h.coordinator.deny(action.receiptId).state).toBe("dismissed");
    expect(h.receipts.get(action.receiptId).execution.state).toBe("invalidated");
    await expect(h.coordinator.approveAndSend(action.receiptId, "identity:janua")).rejects.toThrow(/fresh draft/);
    expect(h.calls()).toBe(0);
  });

  it("locks an ambiguous provider failure and never retries it", async () => {
    let calls = 0;
    const h = harness({
      async send() {
        calls += 1;
        throw new Error("SMTP connection closed after DATA");
      },
    });
    const { action } = h.coordinator.stage({ botId: "mailman", threadId: "mail-thread", draft });
    await expect(h.coordinator.approveAndSend(action.receiptId, "identity:janua")).rejects.toThrow(/SMTP connection closed/);
    expect(h.actions.get(action.receiptId)).toMatchObject({ state: "failed", failure: "SMTP connection closed after DATA" });
    expect(h.receipts.get(action.receiptId).execution.state).toBe("claimed");
    await expect(h.coordinator.approveAndSend(action.receiptId, "identity:janua")).rejects.toThrow(/fresh draft/);
    expect(calls).toBe(1);
  });

  it("rejects header injection, duplicate recipient lanes, and attachments", () => {
    expect(() => normalizeMailDraft({ ...draft, subject: "Hello\nBcc: thief@example.com" })).toThrow(/line break/);
    expect(() => normalizeMailDraft({ ...draft, cc: [draft.to[0]] })).toThrow(/same recipient/);
    expect(() => normalizeMailDraft({ ...draft, attachments: ["secret.pdf"] })).toThrow(/not enabled/);
  });
});
