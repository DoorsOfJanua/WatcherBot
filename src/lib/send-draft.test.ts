import { describe, expect, it } from "vitest";

import { beginSend, idleSendDraft, settleSend, shouldClearDraft } from "./send-draft";

const LONG = `a very long message ${"with many words ".repeat(200)}that must never be lost`;

describe("send draft contract", () => {
  it("a failed send keeps the complete text and flags retry", () => {
    const sending = beginSend(idleSendDraft, LONG);
    expect(sending).not.toBeNull();
    const settled = settleSend(sending!, LONG, false);
    expect(settled.failed).toBe(LONG);
    expect(settled.inFlight).toBeNull();
    // the draft itself was never cleared, so retry re-sends the same text
    const retry = beginSend(settled, LONG);
    expect(retry).not.toBeNull();
    expect(retry!.failed).toBeNull();
  });

  it("a duplicate Enter while the same text is in flight does not send twice", () => {
    const sending = beginSend(idleSendDraft, "hello")!;
    expect(beginSend(sending, "hello")).toBeNull();
  });

  it("an edited draft may send while the older text is still in flight", () => {
    const sending = beginSend(idleSendDraft, "hello")!;
    expect(beginSend(sending, "hello again")).not.toBeNull();
  });

  it("clears the composer only when confirmed and unchanged", () => {
    expect(shouldClearDraft(LONG, LONG)).toBe(true);
    expect(shouldClearDraft(`${LONG} plus newer typing`, LONG)).toBe(false);
  });

  it("an old send settling cannot disarm a newer in-flight one", () => {
    const first = beginSend(idleSendDraft, "first")!;
    const second = beginSend(first, "second")!;
    const settled = settleSend(second, "first", true);
    expect(settled.inFlight).toBe("second");
  });

  it("success clears a stale failure of the same text", () => {
    const failed = settleSend(beginSend(idleSendDraft, "x")!, "x", false);
    const retried = beginSend(failed, "x")!;
    const done = settleSend(retried, "x", true);
    expect(done.failed).toBeNull();
    expect(done.inFlight).toBeNull();
  });
});
