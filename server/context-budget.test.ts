import { describe, expect, it } from "vitest";

import {
  buildContextReport,
  CHARS_PER_TOKEN,
  clampTurns,
  estimateTokens,
  packSections,
  ROOM_BUDGET,
  SYSTEM_TOTAL_MAX_CHARS,
  TRANSCRIPT_BUDGET,
} from "./context-budget.ts";

const turn = (text: string, role: "user" | "assistant" = "user") => ({ role, text });

describe("estimateTokens", () => {
  it("is a deterministic chars/4 ceiling", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("x".repeat(4 * CHARS_PER_TOKEN))).toBe(4);
  });
});

describe("clampTurns", () => {
  const budget = { maxTurns: 5, maxTurnChars: 100, maxTotalChars: 250 };

  it("passes small transcripts through untouched, same object identity", () => {
    const turns = [turn("hello"), turn("world", "assistant")];
    const result = clampTurns(turns, budget);
    expect(result.turns).toEqual(turns);
    expect(result.turns[0]).toBe(turns[0]);
    expect(result.droppedTurns).toBe(0);
    expect(result.truncatedTurns).toBe(0);
    expect(result.chars).toBe("hello".length + "world".length);
  });

  it("enforces the pre-existing maxTurns cap and counts the drop", () => {
    const turns = Array.from({ length: 8 }, (_, i) => turn(`m${i}`));
    const result = clampTurns(turns, budget);
    expect(result.turns.map((t) => t.text)).toEqual(["m3", "m4", "m5", "m6", "m7"]);
    expect(result.droppedTurns).toBe(3);
  });

  it("middle-elides an overlong turn with an explicit marker", () => {
    const long = "A".repeat(80) + "MIDDLE".repeat(100) + "Z".repeat(80);
    const result = clampTurns([turn(long)], { ...budget, maxTotalChars: 10_000, maxTurnChars: 300 });
    expect(result.truncatedTurns).toBe(1);
    const text = result.turns[0].text;
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text).toContain("characters omitted here by the context budget");
    expect(text.startsWith("A".repeat(10))).toBe(true);
    expect(text.endsWith("Z".repeat(10))).toBe(true);
  });

  it("keeps the newest turns whole and drops the oldest when the total budget runs out", () => {
    const turns = [turn("old ".repeat(30)), turn("mid ".repeat(30)), turn("new ".repeat(30))];
    const result = clampTurns(turns, { maxTurns: 5, maxTurnChars: 500, maxTotalChars: 250 });
    expect(result.turns.map((t) => t.text)).toEqual([turns[1].text, turns[2].text]);
    expect(result.droppedTurns).toBe(1);
  });

  it("always retains the newest turn even when it alone exceeds the total budget", () => {
    const result = clampTurns([turn("x".repeat(1_000))], { maxTurns: 5, maxTurnChars: 300, maxTotalChars: 100 });
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].text.length).toBeLessThanOrEqual(300);
  });

  it("is deterministic: same input, same output", () => {
    const turns = Array.from({ length: 50 }, (_, i) => turn(`message ${i} `.repeat(i)));
    const a = clampTurns(turns, TRANSCRIPT_BUDGET);
    const b = clampTurns(turns, TRANSCRIPT_BUDGET);
    expect(a).toEqual(b);
  });

  it("room budget keeps 30 messages as before", () => {
    expect(ROOM_BUDGET.maxTurns).toBe(30);
    expect(TRANSCRIPT_BUDGET.maxTurns).toBe(40);
  });
});

describe("packSections", () => {
  it("is byte-identical to plain concatenation when everything fits", () => {
    const sections = [
      { id: "persona", text: "You are Poppy.", protected: true },
      { id: "project", text: "\n\nPROJECT STATE", protected: true },
      { id: "memory", text: "\n\nMEMORY", maxChars: 1_000, trimOrder: 4 },
    ];
    const packed = packSections(sections);
    expect(packed.text).toBe("You are Poppy.\n\nPROJECT STATE\n\nMEMORY");
    expect(packed.sections.map((s) => s.status)).toEqual(["included", "included", "included"]);
    expect(packed.overCeiling).toBe(false);
  });

  it("truncates an over-cap unprotected section with a marker naming it", () => {
    const packed = packSections([
      { id: "skills", text: "S".repeat(5_000), maxChars: 1_000, trimOrder: 1 },
    ]);
    expect(packed.sections[0].status).toBe("truncated");
    expect(packed.text.length).toBeLessThanOrEqual(1_000);
    expect(packed.text).toContain('section "skills" truncated here');
  });

  it("never cuts a protected section, even over its own cap", () => {
    const text = "P".repeat(5_000);
    const packed = packSections([{ id: "project", text, maxChars: 1_000, protected: true }]);
    expect(packed.text).toBe(text);
    expect(packed.sections[0].status).toBe("included");
  });

  it("global ceiling shrinks unprotected sections in trimOrder, protected last intact", () => {
    const packed = packSections(
      [
        { id: "persona", text: "p".repeat(100), protected: true },
        { id: "skills", text: "s".repeat(400), trimOrder: 1 },
        { id: "memory", text: "m".repeat(400), trimOrder: 2 },
      ],
      600,
    );
    // skills (trimOrder 1) absorbs the whole 300-char overflow
    const skills = packed.sections.find((s) => s.id === "skills")!;
    const memory = packed.sections.find((s) => s.id === "memory")!;
    const persona = packed.sections.find((s) => s.id === "persona")!;
    expect(persona.chars).toBe(100);
    expect(memory.chars).toBe(400);
    expect(skills.status).toBe("truncated");
    expect(packed.chars).toBeLessThanOrEqual(600);
    expect(packed.overCeiling).toBe(false);
  });

  it("drops a section entirely when a marker-sized remnant would not help, and reports it", () => {
    const packed = packSections(
      [
        { id: "persona", text: "p".repeat(590), protected: true },
        { id: "skills", text: "s".repeat(50), trimOrder: 1 },
      ],
      600,
    );
    const skills = packed.sections.find((s) => s.id === "skills")!;
    expect(skills.status).toBe("dropped");
    expect(skills.chars).toBe(0);
    expect(packed.chars).toBe(590);
  });

  it("reports overCeiling when protected sections alone exceed the ceiling", () => {
    const packed = packSections([{ id: "project", text: "p".repeat(700), protected: true }], 600);
    expect(packed.overCeiling).toBe(true);
    expect(packed.text.length).toBe(700);
  });

  it("empty sections report as empty and add nothing", () => {
    const packed = packSections([
      { id: "persona", text: "hi", protected: true },
      { id: "sharedMemory", text: "", trimOrder: 2 },
    ]);
    expect(packed.text).toBe("hi");
    expect(packed.sections[1].status).toBe("empty");
  });

  it("worst-case section budgets stay under the global ceiling", () => {
    // The everyday guarantee: per-section caps are the mechanism and the
    // global pass is a backstop. Mirror the call-site budgets.
    const worstCase =
      600 + // persona
      30_000 + // project charter+state (pre-bounded by project-context.ts)
      1_200 + // computer + safety guidance
      4_000 + // coordination
      26_000 + // MEMORY.md + guidance
      4_000 + // writing style
      9_000 + // shared memory
      16_000 + // skills
      600 + // webhook note
      2_000; // tagged mentions
    expect(worstCase).toBeLessThan(SYSTEM_TOTAL_MAX_CHARS);
  });
});

describe("buildContextReport", () => {
  it("summarizes system, transcript, and turn text into approximate tokens", () => {
    const system = packSections([{ id: "persona", text: "x".repeat(400), protected: true }]);
    const transcript = clampTurns([turn("y".repeat(100))], TRANSCRIPT_BUDGET);
    const report = buildContextReport({
      kind: "turn",
      threadId: "t1",
      botId: "b1",
      system,
      transcript,
      turnTextChars: 200,
    });
    expect(report.system.approxTokens).toBe(100);
    expect(report.transcript.turns).toBe(1);
    expect(report.transcript.approxTokens).toBe(25);
    expect(report.totalApproxTokens).toBe(150);
    expect(report.kind).toBe("turn");
    expect(Date.parse(report.at)).not.toBeNaN();
  });

  it("counts a separately-riding transcript in the total for API-transcript drivers", () => {
    const system = packSections([{ id: "persona", text: "x".repeat(400), protected: true }]);
    const transcript = clampTurns([turn("y".repeat(100))], TRANSCRIPT_BUDGET);
    const report = buildContextReport({
      kind: "turn",
      threadId: "t1",
      botId: "b1",
      system,
      transcript,
      turnTextChars: 200,
      transcriptRidesSeparately: true,
    });
    // system 100 + turn text 50 + transcript 25
    expect(report.totalApproxTokens).toBe(175);
    expect(report.transcript.approxTokens).toBe(25);
  });
});
