import { describe, expect, it } from "vitest";

import {
  cancelMicSession,
  idleMicSession,
  micManualEdit,
  micPartial,
  startMicSession,
  stopMicSession,
} from "./mic-session";

describe("mic session", () => {
  it("recording never destroys existing typed text", () => {
    const session = startMicSession("draft I already typed");
    const next = micPartial(session, "hello there");
    expect(next.rendered).toBe("draft I already typed hello there");
  });

  it("keeps every partial monotonic — a shrunk hypothesis cannot erase speech", () => {
    let s = startMicSession("");
    s = micPartial(s, "the quick brown fox jumps over the lazy dog");
    s = micPartial(s, "the quick");
    expect(s.rendered).toBe("the quick brown fox jumps over the lazy dog");
  });

  it("a recognizer restart after a pause appends instead of replacing", () => {
    let s = startMicSession("");
    s = micPartial(s, "first sentence spoken before the pause");
    s = micPartial(s, "now a new phrase");
    expect(s.rendered).toBe("first sentence spoken before the pause now a new phrase");
  });

  it("long dictation preserves the entire transcript", () => {
    let s = startMicSession("typed base");
    const chunks = [
      "one two",
      "one two three four",
      "one two three four five six seven",
      "eight nine ten",
    ];
    for (const c of chunks) s = micPartial(s, c);
    expect(s.rendered).toBe("typed base one two three four five six seven eight nine ten");
  });

  it("a manual edit while recording ends the session and the edit wins", () => {
    let s = startMicSession("base");
    s = micPartial(s, "spoken words");
    const edited = micManualEdit(s, "base spoken words plus my correction");
    expect(edited.status).toBe("idle");
    expect(edited.rendered).toBe("base spoken words plus my correction");
    // a partial that arrives after the edit no longer changes anything
    expect(micPartial(edited, "spoken words and more")).toBe(edited);
  });

  it("a programmatic echo of the session's own text is not a manual edit", () => {
    let s = startMicSession("base");
    s = micPartial(s, "spoken");
    expect(micManualEdit(s, s.rendered)).toBe(s);
    expect(micManualEdit(s, s.rendered).status).toBe("recording");
  });

  it("cancel restores the previous draft unchanged, whitespace included", () => {
    const before = "  my draft with trailing space ";
    let s = startMicSession(before);
    s = micPartial(s, "words to discard");
    const { session, restore } = cancelMicSession(s);
    expect(restore).toBe(before);
    expect(session.status).toBe("idle");
    expect(session.rendered).toBe(before);
  });

  it("stop keeps everything dictated so far", () => {
    let s = startMicSession("base");
    s = micPartial(s, "keep these words");
    const stopped = stopMicSession(s);
    expect(stopped.status).toBe("idle");
    expect(stopped.rendered).toBe("base keep these words");
  });

  it("partials on an idle session are ignored — a late callback cannot resurrect old text", () => {
    let s = startMicSession("base");
    s = micPartial(s, "spoken before send");
    const stopped = stopMicSession(s);
    // the composer was cleared by a send; a straggling partial must not re-render
    expect(micPartial(stopped, "spoken before send")).toBe(stopped);
    expect(idleMicSession.status).toBe("idle");
  });
});
