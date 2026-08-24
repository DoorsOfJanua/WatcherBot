import { describe, expect, it } from "vitest";
import { joinDictation, mergeDictationTranscript } from "./dictation-transcript";

describe("mergeDictationTranscript", () => {
  it("lets a normal cumulative hypothesis grow", () => {
    expect(mergeDictationTranscript("this is the", "this is the first sentence")).toBe(
      "this is the first sentence",
    );
  });

  it("does not erase visible speech when a hypothesis briefly shrinks", () => {
    expect(mergeDictationTranscript("this is the first sentence", "this is the first")).toBe(
      "this is the first sentence",
    );
  });

  it("keeps legitimate revisions to the current phrase", () => {
    expect(mergeDictationTranscript("I need the blue folder", "I need the new folder")).toBe(
      "I need the new folder",
    );
  });

  it("appends a fresh phrase instead of replacing the earlier sentence", () => {
    expect(mergeDictationTranscript("Research the Ganga source material", "then find the strongest exchanges")).toBe(
      "Research the Ganga source material then find the strongest exchanges",
    );
  });

  it("deduplicates words repeated across a phrase boundary", () => {
    expect(mergeDictationTranscript("Open the project folder", "project folder and run the tests")).toBe(
      "Open the project folder and run the tests",
    );
  });

  it("drops a long phrase the recognizer re-sends after a pause", () => {
    const spoken = "This text box still is buggy when i use the microphone";
    const restarted = "When I'm pausing, it shows the last message twice";
    const afterPause = mergeDictationTranscript(spoken, restarted);
    expect(afterPause).toBe(`${spoken} ${restarted}`);
    // the same phrase arriving again must not append a second copy
    expect(mergeDictationTranscript(afterPause, restarted)).toBe(afterPause);
  });

  it("still appends a new phrase that merely ends like an earlier one", () => {
    expect(
      mergeDictationTranscript("send it to the printer", "then email it to the printer as well"),
    ).toBe("send it to the printer then email it to the printer as well");
  });
});

describe("joinDictation", () => {
  it("preserves text that was already in the composer", () => {
    expect(joinDictation("Sensei,", "build tomorrow's workout")).toBe("Sensei, build tomorrow's workout");
  });
});
