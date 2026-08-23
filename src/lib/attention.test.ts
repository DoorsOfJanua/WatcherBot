import { describe, expect, it } from "vitest";
import { actionableAttentionCount, attentionItems, mailPreviewMeta } from "./attention";
import type { Bot, Message } from "@/state/store";
import type { RoutineRun } from "./routines";

function message(id: string, card: Message["card"], at = 100): Message {
  return { id, role: "bot", kind: "options", card, at };
}

function bot(id: string, messages: Message[] = [], patch: Partial<Bot> = {}): Bot {
  return {
    id,
    threadId: `${id}-thread`,
    name: id === "mailman" ? "Mailman" : "Watcher",
    title: "Agent",
    description: "",
    notifications: true,
    color: id === "mailman" ? "orange" : "blue",
    unread: false,
    modelSelection: { instanceId: "local", model: "default" },
    messages,
    ...patch,
  };
}

const mailDetail = (to: string, subject: string) => [
  "Frozen draft · abc123",
  "From: janua@example.com",
  `To: ${to}`,
  `Subject: ${subject}`,
  "Attachments: none",
  "",
  "Hello there",
].join("\n");

describe("attention projection", () => {
  it("extracts the human mail labels from an exact frozen preview", () => {
    expect(mailPreviewMeta(mailDetail("ada@example.com", "Project update"))).toEqual({
      to: "ada@example.com",
      subject: "Project update",
    });
  });

  it("groups a Mailman batch into one tray item while keeping exact drafts", () => {
    const mailman = bot("mailman", [
      message("m1", { title: "Email", subtitle: mailDetail("ada@example.com", "Alpha"), options: ["Deny", "Allow"], requestId: "r1", tool: "email.send" }, 100),
      message("m2", { title: "Email", subtitle: mailDetail("bea@example.com", "Beta"), options: ["Deny", "Allow"], requestId: "r2", tool: "email.send" }, 200),
    ]);

    const items = attentionItems({ bots: [mailman], routineRuns: [] });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "mail", title: "2 drafts ready" });
    expect(items[0].children?.map((item) => item.title)).toEqual(["Beta", "Alpha"]);
    expect(actionableAttentionCount(items)).toBe(2);
  });

  it("keeps agent scope local and gives blocking cards priority", () => {
    const watcher = bot("watcher", [], { busy: true });
    const mailman = bot("mailman", [
      message("approval", { title: "Choose a direction", subtitle: "Which version should I use?", options: ["A", "B"] }),
    ], { unread: true });

    const local = attentionItems({ bots: [watcher, mailman], routineRuns: [] }, "watcher");
    const all = attentionItems({ bots: [watcher, mailman], routineRuns: [] });

    expect(local.map((item) => item.botId)).toEqual(["watcher"]);
    expect(all[0]).toMatchObject({ botId: "mailman", kind: "question", priority: "blocking" });
  });

  it("surfaces unseen failed routines and omits them after review", () => {
    const watcher = bot("watcher");
    const failed: RoutineRun = {
      id: "run-1",
      routineId: "routine-1",
      routineName: "Morning brief",
      botId: watcher.id,
      runOn: "maus",
      scheduledFor: 100,
      status: "failed",
      manual: false,
      error: "Calendar connection expired",
      createdAt: 90,
    };

    expect(attentionItems({ bots: [watcher], routineRuns: [failed] })[0]).toMatchObject({
      kind: "routine",
      summary: "Calendar connection expired",
    });
    expect(attentionItems({ bots: [watcher], routineRuns: [{ ...failed, seenAt: 110 }] })).toEqual([]);
  });
});
