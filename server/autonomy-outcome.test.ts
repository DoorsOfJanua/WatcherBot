import { describe, expect, it } from "vitest";
import { formatAutonomyOutcome, parseAutonomyOutcome, parseAutonomyOutcomeEnvelope, stripAutonomyOutcomeEnvelope } from "./autonomy-outcome.ts";

describe("parseAutonomyOutcome", () => {
  it("normalizes the machine-readable envelope", () => {
    expect(parseAutonomyOutcome('```autonomy-outcome\n{"kind":"autonomy-outcome","version":1,"status":"completed","changed":true,"summary":"Built it","details":"Tests pass","artifacts":[{"label":"Build","url":"https://example.test/build"}],"sources":["https://example.test/source"],"followUpAt":"2030-01-02T03:04:05Z"}\n```')).toEqual({
      status: "completed", changed: true, notify: true, summary: "Built it", details: "Tests pass",
      artifacts: [{ label: "Build", url: "https://example.test/build" }], sourceLinks: [{ label: "https://example.test/source", url: "https://example.test/source" }], followUpAt: "2030-01-02T03:04:05Z",
    });
  });

  it("keeps unchanged and explicitly quiet runs quiet", () => {
    expect(parseAutonomyOutcome('{"kind":"autonomy-outcome","status":"unchanged","changed":true,"notify":false}')).toMatchObject({ status: "unchanged", changed: false, notify: false });
  });

  it("does not treat an unrelated fenced JSON answer as an envelope", () => {
    const answer = 'Here is the data:\n```json\n{"kind":"autonomy-outcome","status":"unchanged"}\n```';
    expect(parseAutonomyOutcome(answer)).toMatchObject({ summary: answer, notify: true });
    expect(parseAutonomyOutcomeEnvelope(answer)).toBeNull();
  });

  it("accepts an explicitly tagged envelope and caps untrusted fields", () => {
    const long = "x".repeat(5_000);
    const result = parseAutonomyOutcome("```autonomy-outcome\n{" + `"kind":"autonomy-outcome","status":"unchanged","summary":"${long}","details":"${long}","artifacts":["https://example.test/${long}"],"notify":false}` + "\n```");
    expect(result).toMatchObject({ status: "unchanged", changed: false, notify: false });
    expect(result.summary).toHaveLength(500);
    expect(result.details).toHaveLength(4000);
    expect(result.artifacts[0].url).toHaveLength(2048);
  });

  it("formats display content without the envelope", () => {
    const outcome = parseAutonomyOutcome('{"kind":"autonomy-outcome","status":"completed","summary":"Done","details":"Checks pass","artifacts":[{"label":"Log","url":"https://example.test/log"}]}');
    expect(formatAutonomyOutcome(outcome)).toBe("Done\n\nChecks pass\n\nLog: https://example.test/log");
    expect(formatAutonomyOutcome(parseAutonomyOutcome("ordinary answer"))).toBe("ordinary answer");
  });

  it("turns structured model details into human copy instead of dropping them or showing JSON", () => {
    const parsed = parseAutonomyOutcome('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"completed","summary":"Today is Legs.","details":{"plan":["Warm up for five minutes.","Squat 4×6."],"finish_by":"19:00","low_readiness_adaptation":"Use 60kg for 5×5."}}\n```');
    expect(formatAutonomyOutcome(parsed)).toBe(
      "Today is Legs.\n\nPlan\n- Warm up for five minutes.\n- Squat 4×6.\n\nFinish by: 19:00\n\nLow readiness adaptation: Use 60kg for 5×5.",
    );
    expect(formatAutonomyOutcome(parsed)).not.toContain("{");
  });

  it("accepts the common ok synonym as completed", () => {
    expect(parseAutonomyOutcomeEnvelope('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"ok","notify":true,"summary":"Move and drink water."}\n```')).toMatchObject({
      status: "completed",
      notify: true,
      summary: "Move and drink water.",
    });
  });

  it("recognizes its semantic kind inside generic or missing fences", () => {
    for (const answer of [
      '```json\n{"kind":"autonomy-outcome","status":"completed","summary":"Human answer"}\n```',
      '{"kind":"autonomy-outcome","status":"completed","summary":"Human answer"}',
    ]) {
      expect(parseAutonomyOutcomeEnvelope(answer)).toMatchObject({ status: "completed", summary: "Human answer" });
      expect(stripAutonomyOutcomeEnvelope(answer)).toBe("");
      expect(formatAutonomyOutcome(parseAutonomyOutcome(answer))).toBe("Human answer");
    }
  });

  it("strips internal metadata from mixed prose even when the envelope is invalid", () => {
    const response = 'Drink water and move, grasshopper.\n\n```autonomy-outcome\n{"kind":"autonomy-outcome","status":"ok","notify":true}\n```';
    expect(parseAutonomyOutcomeEnvelope(response)).toMatchObject({ status: "completed", notify: true });
    expect(stripAutonomyOutcomeEnvelope(response)).toBe("Drink water and move, grasshopper.");
    expect(stripAutonomyOutcomeEnvelope('```autonomy-outcome\n{not valid json}\n```')).toBe("");
  });

  it("falls back to ordinary text and never throws on malformed output", () => {
    expect(parseAutonomyOutcome("Nothing changed yet")).toMatchObject({ summary: "Nothing changed yet", notify: true, changed: true });
    expect(parseAutonomyOutcome('{"kind":"autonomy-outcome","status":"wat"}')).toMatchObject({ summary: "{\"kind\":\"autonomy-outcome\",\"status\":\"wat\"}", notify: true });
    expect(parseAutonomyOutcome(null)).toMatchObject({ summary: "", notify: true });
  });
});
