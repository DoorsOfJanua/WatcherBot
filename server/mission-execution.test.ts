import { describe, expect, it } from "vitest";

import { formatMissionPrompt, MAX_MISSION_PROMPT_CHARS, parseMissionReply } from "./mission-execution.ts";
import type { Mission, WorkItem } from "./missions.ts";

const mission: Mission = { id: "m1", version: 1, title: "Ship it", ownerThreadId: "thread-1", leadAgentId: "lead", team: [{ agentId: "lead", role: "lead" }], objective: "Ship it", successCriteria: ["tests pass"], budget: { maxTokens: 500 }, status: "running", workItems: [], events: [], createdAt: 1, updatedAt: 1, spentTokens: 0, spentCost: 0 };
const item: WorkItem = { id: "w1", title: "Implement", description: "the thing", dependsOn: ["w0"], status: "claimed", attempts: 1, createdAt: 1, updatedAt: 1 };

describe("mission execution contract", () => {
  it("formats required bounded mission context and envelope", () => {
    const prompt = formatMissionPrompt(mission, item);
    expect(prompt.length).toBeLessThanOrEqual(MAX_MISSION_PROMPT_CHARS);
    expect(prompt).toContain("m1"); expect(prompt).toContain("Ship it"); expect(prompt).toContain("tests pass"); expect(prompt).toContain("w0"); expect(prompt).toContain("lead"); expect(prompt).toContain("```autonomy-outcome");
    expect(prompt).toContain("Do not use Python");
    expect(prompt).toContain("auditable read-only shell programs");
  });
  it("parses complete/block/fail envelopes with usage and rejects ordinary text", () => {
    expect(parseMissionReply('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"completed","summary":"done"}\n```', { usage: { tokens: 9 } })).toMatchObject({ status: "complete", result: "done", usage: { tokens: 9 } });
    expect(parseMissionReply('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"blocked","summary":"approval"}\n```')).toMatchObject({ status: "block", reason: "approval" });
    expect(parseMissionReply('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"failed","summary":"boom"}\n```')).toMatchObject({ status: "fail", reason: "boom" });
    expect(parseMissionReply("done in prose")).toMatchObject({ status: "block" });
  });
  it("does not allow unchanged replies to complete or blocked/failed states to clear", () => {
    expect(parseMissionReply("same", { unchangedReply: "same" }).status).toBe("block");
    expect(parseMissionReply('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"completed","summary":"x"}\n```', { currentStatus: "blocked" }).status).toBe("block");
    expect(parseMissionReply('```autonomy-outcome\n{"kind":"autonomy-outcome","status":"completed","summary":"x"}\n```', { currentStatus: "failed" }).status).toBe("fail");
  });
});
