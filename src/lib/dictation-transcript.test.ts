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
});

describe("joinDictation", () => {
  it("preserves text that was already in the composer", () => {
    expect(joinDictation("Sensei,", "build tomorrow's workout")).toBe("Sensei, build tomorrow's workout");
  });
});
