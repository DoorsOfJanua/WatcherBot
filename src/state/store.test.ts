import { describe, expect, it, vi } from "vitest";

import {
  configStatusFromFrame,
  initialState,
  openNotificationTarget,
  reducer,
  restoredConversationId,
  type Bot,
  type Message,
} from "./store";

describe("conversation restoration", () => {
  const bots = [{ id: "sonnet" }, { id: "sol" }] as Bot[];
  const groups = [{ id: "studio" }] as never;

  it("returns to the exact agent or room used before restart", () => {
    expect(restoredConversationId("sol", bots, groups)).toBe("sol");
    expect(restoredConversationId("studio", bots, groups)).toBe("studio");
  });

  it("falls back safely when the remembered conversation was deleted", () => {
    expect(restoredConversationId("gone", bots, groups)).toBe("sonnet");
  });
});

describe("notification routing", () => {
  const bots = [{ id: "bot-1", threadId: "main-thread", tasks: [{ threadId: "detached-thread" }] }] as never;
  const groups = [{ id: "room-1", threadId: "room-thread" }] as never;

  it("selects the bot and switches to the notification's exact task", () => {
    const dispatch = vi.fn();

    openNotificationTarget(dispatch, { botId: "bot-1", threadId: "detached-thread" }, { bots, groups });

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "select", id: "bot-1" },
      { type: "switchTask", botId: "bot-1", threadId: "detached-thread" },
    ]);
  });

  it("opens the room when the thread is a group's — never a bot task switch that would 404", () => {
    // room approval/question notifications carry the asker bot with the
    // GROUP's thread id; the exact destination is the room itself
    const dispatch = vi.fn();

    openNotificationTarget(dispatch, { botId: "bot-1", threadId: "room-thread" }, { bots, groups });

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([{ type: "select", id: "room-1" }]);
  });

  it("lands on a plain bot select for a thread it cannot place, not an error", () => {
    const dispatch = vi.fn();

    openNotificationTarget(dispatch, { botId: "bot-1", threadId: "deleted-task-thread" }, { bots, groups });

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([{ type: "select", id: "bot-1" }]);
  });
});

describe("config status frames", () => {
  it("keeps the room turn timeout with the existing config fields", () => {
    expect(
      configStatusFromFrame({
        xai: { configured: true },
        composio: { configured: true, mode: "managed" },
        box: { configured: false },
        vps: { configured: true, sshAlias: "homelab" },
        rooms: { turnTimeoutMinutes: 20 },
        localVm: { mode: "per-bot", maxInstances: 3 },
        opencodeGo: { configured: true },
        tts: { configured: true, ready: true, voice: "Ada" },
        profile: { name: "Ian", email: "ian@example.test" },
      }),
    ).toEqual({
      xai: { configured: true },
      composio: { configured: true, mode: "managed" },
      box: { configured: false },
      vps: { configured: true, sshAlias: "homelab" },
      rooms: { turnTimeoutMinutes: 20 },
      localVm: { mode: "per-bot", maxInstances: 3 },
      opencodeGo: { configured: true },
      tts: { configured: true, ready: true, voice: "Ada" },
      profile: { name: "Ian", email: "ian@example.test" },
    });
  });
});

describe("cross-client bot creation", () => {
  it("adds an announced bot before its greeting frames arrive", () => {
    const announced = {
      id: "phone-bot",
      threadId: "phone-thread",
      name: "Scout",
      title: "",
      description: "",
      notifications: true,
      color: "green",
      unread: false,
      modelSelection: { instanceId: "codex", model: "default" },
    } satisfies Omit<Bot, "messages">;

    const added = reducer(initialState, { type: "botPatched", bot: announced });

    expect(added.bots).toEqual([{ ...announced, messages: [] }]);

    const greeting = {
      id: "greeting",
      role: "bot",
      kind: "text",
      text: "Hey — I'm Scout. Nice to meet you.",
      at: 2,
    } satisfies Message;
    const greeted = reducer(added, {
      type: "messageAdded",
      threadId: announced.threadId,
      message: greeting,
    });

    expect(greeted.bots[0]?.messages).toEqual([greeting]);
  });
});

describe("bot spirit persistence", () => {
  const watcher = {
    id: "watcher",
    threadId: "watcher-thread",
    name: "Custom Watcher",
    title: "Inspector",
    description: "Keeps watch.",
    notifications: true,
    color: "purple",
    spirit: "wormhole",
    unread: false,
    modelSelection: { instanceId: "codex", model: "default" },
    messages: [],
  } satisfies Bot;

  it("keeps the selected character through unrelated profile edits", () => {
    const edited = reducer(
      { ...initialState, bots: [watcher] },
      { type: "updateBot", botId: watcher.id, patch: { description: "A sharper brief." } },
    );

    expect(edited.bots[0]?.spirit).toBe("wormhole");
  });

  it("changes or clears the character only when explicitly requested", () => {
    const changed = reducer(
      { ...initialState, bots: [watcher] },
      { type: "updateBot", botId: watcher.id, patch: { spirit: "forge" } },
    );
    expect(changed.bots[0]?.spirit).toBe("forge");

    const cleared = reducer(changed, {
      type: "updateBot",
      botId: watcher.id,
      patch: { spirit: null },
    });
    expect(cleared.bots[0]?.spirit).toBeUndefined();
  });
});

describe("spirit reactions", () => {
  const message = {
    id: "answer-1",
    role: "bot",
    kind: "text",
    text: "Done.",
    at: 2,
  } satisfies Message;
  const bot = {
    id: "mailman",
    threadId: "mail-thread",
    name: "Mailman",
    title: "Operations",
    description: "Fast, cheerful mail operations.",
    notifications: true,
    color: "red",
    unread: false,
    modelSelection: { instanceId: "codex", model: "default" },
    messages: [message],
  } satisfies Bot;

  it("reacts when the user adds and removes an emoji", () => {
    const added = reducer(
      { ...initialState, bots: [bot] },
      { type: "toggleReaction", threadId: bot.threadId, messageId: message.id, emoji: "❤️" },
    );
    expect(added.mascotMotion).toEqual({ botId: bot.id, nonce: 1, kind: "customize" });

    const removed = reducer(added, {
      type: "toggleReaction",
      threadId: bot.threadId,
      messageId: message.id,
      emoji: "❤️",
    });
    expect(removed.mascotMotion).toEqual({ botId: bot.id, nonce: 2, kind: "blink" });
  });
});

describe("transcript event durability (reconnect / duplicates)", () => {
  const bot = {
    id: "sniper",
    threadId: "sniper-thread",
    name: "Sniper",
    title: "",
    description: "",
    notifications: true,
    color: "red",
    unread: false,
    modelSelection: { instanceId: "claude", model: "default" },
  } satisfies Omit<Bot, "messages">;
  const seeded = reducer(initialState, { type: "botPatched", bot });
  const message = (id: string, text: string, at = 1): Message =>
    ({ id, role: "bot", kind: "text", text, at }) satisfies Message;

  it("a replayed duplicate event is a no-op — never a doubled message", () => {
    const once = reducer(seeded, { type: "messageAdded", threadId: bot.threadId, message: message("m1", "signal") });
    const twice = reducer(once, { type: "messageAdded", threadId: bot.threadId, message: message("m1", "signal") });
    expect(twice.bots[0]?.messages.map((m) => m.id)).toEqual(["m1"]);
  });

  it("a very long message survives append and patch intact", () => {
    const long = `signal ${"with a lot of detail ".repeat(500)}end`;
    const added = reducer(seeded, { type: "messageAdded", threadId: bot.threadId, message: message("m1", long) });
    expect(added.bots[0]?.messages[0]?.text).toBe(long);
    const patched = reducer(added, {
      type: "messagePatched",
      threadId: bot.threadId,
      message: message("m1", `${long} updated`),
    });
    expect(patched.bots[0]?.messages[0]?.text).toBe(`${long} updated`);
  });

  it("ordinary bot patches never replace the transcript; only a task switch may", () => {
    const withMessages = reducer(seeded, {
      type: "messageAdded",
      threadId: bot.threadId,
      message: message("m1", "signal one"),
    });
    // a plain profile patch (same thread) keeps every message
    const renamed = reducer(withMessages, { type: "botPatched", bot: { ...bot, name: "Sniper2" } });
    expect(renamed.bots[0]?.messages.map((m) => m.id)).toEqual(["m1"]);
    // a task switch replaces the transcript with the new thread's messages
    const switched = reducer(renamed, {
      type: "botPatched",
      bot: { ...bot, threadId: "other-thread", messages: [message("t2", "task two history")] },
    });
    expect(switched.bots[0]?.messages.map((m) => m.id)).toEqual(["t2"]);
  });

  it("events for a thread that is not the bot's active task change nothing silently destructive", () => {
    const withMessages = reducer(seeded, {
      type: "messageAdded",
      threadId: bot.threadId,
      message: message("m1", "kept"),
    });
    const other = reducer(withMessages, {
      type: "messageAdded",
      threadId: "background-routine-thread",
      message: message("bg", "webhook run message"),
    });
    // the visible transcript is untouched; the durable copy lives server-side
    expect(other.bots[0]?.messages.map((m) => m.id)).toEqual(["m1"]);
  });
});
