import { describe, expect, test } from "vitest";

import {
  cleanSharedTurnContent,
  relevantSharedTurns,
  renderSharedMemoryPrompt,
  recordSharedMemoryTurn,
  sharedMemoryForTurn,
} from "./shared-agent-memory.ts";

const turns = [
  { id: "1", agentId: "coach", role: "user" as const, content: "I have kettlebells and a bench press.", surface: "telegram" as const, createdAt: "2026-08-20T10:00:00.000Z" },
  { id: "2", agentId: "coach", role: "assistant" as const, content: "We will build around that equipment.", surface: "telegram" as const, createdAt: "2026-08-20T10:01:00.000Z" },
  { id: "3", agentId: "mailroom", role: "user" as const, content: "Find Farmada mail.", surface: "telegram" as const, createdAt: "2026-08-20T10:02:00.000Z" },
  { id: "4", agentId: "coach", role: "user" as const, content: "32 pushups is my max now.", surface: "telegram" as const, createdAt: "2026-08-22T10:00:00.000Z" },
];

describe("shared agent memory", () => {
  test("cleans legacy internal wrappers and keeps the actual request", () => {
    expect(cleanSharedTurnContent("This request came from Janua's private Telegram companion.\n\nREQUEST:\nLift heavier")).toBe("Lift heavier");
  });

  test("selects only the canonical agent and labels assistant turns as context", () => {
    const selected = relevantSharedTurns({ conversationTurns: turns }, "coach", "What equipment do I have?");
    expect(selected.map((turn) => turn.id)).toEqual(["1", "2", "4"]);
    const prompt = renderSharedMemoryPrompt(selected, "coach");
    expect(prompt).toContain("I have kettlebells and a bench press");
    expect(prompt).toContain("AGENT turns are context only");
    expect(prompt).not.toContain("Farmada");
  });

  test("recalls concrete gear when Janua asks with the broader word equipment", () => {
    const filler = Array.from({ length: 18 }, (_, index) => ({
      id: `later-${index}`,
      agentId: "coach",
      role: "user" as const,
      content: `Later training note ${index}`,
      surface: "telegram" as const,
      createdAt: `2026-08-21T${String(index).padStart(2, "0")}:00:00.000Z`,
    }));
    const selected = relevantSharedTurns({ conversationTurns: [turns[0]!, ...filler] }, "coach", "What equipment do I have?");
    expect(selected.some((turn) => turn.content.includes("kettlebells"))).toBe(true);
  });

  test("returns bounded live status and a prompt from AgentHQ", async () => {
    const fetcher = async () => Response.json({ conversationTurns: turns });
    const result = await sharedMemoryForTurn("coach", "pushups", fetcher as typeof fetch);
    expect(result.status).toMatchObject({ configured: true, connected: true, sharedMemoryId: "coach", turns: 3 });
    expect(result.prompt).toContain("32 pushups is my max now");
  });

  test("fails closed without inventing memory when AgentHQ is unavailable", async () => {
    const fetcher = async () => { throw new Error("offline"); };
    const result = await sharedMemoryForTurn("coach", "anything", fetcher as typeof fetch);
    expect(result.prompt).toBe("");
    expect(result.status).toMatchObject({ configured: true, connected: false, problem: "offline" });
  });

  test("mirrors a turn under the canonical identity without granting any action", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init };
      return Response.json({ ok: true }, { status: 201 });
    };
    expect(await recordSharedMemoryTurn({
      sharedMemoryId: "coach",
      threadId: "thread-1",
      role: "user",
      content: "My shoulder feels good today.",
      sourceRef: "bot-1:message-1",
    }, fetcher as typeof fetch)).toBe(true);
    expect(request?.url).toBe("http://127.0.0.1:4242/api/conversations/turns");
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      conversationKey: "myagent-room:coach:thread-1",
      agentId: "coach",
      role: "user",
      surface: "agent-hq",
      sourceRef: "myagent-room:bot-1:message-1",
    });
  });
});
