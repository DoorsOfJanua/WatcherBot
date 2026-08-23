import { describe, expect, it } from "vitest";

import type { Message } from "@/state/store";
import { groupTranscriptActivity, isCollapsibleActivity } from "./activity-groups";

const message = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
  role: "bot",
  kind: "activity",
  tool: { name: `Bash: ${id}`, ok: true },
  at: new Date("2026-08-23T12:00:00Z").getTime(),
  ...overrides,
});

describe("activity transcript groups", () => {
  it("folds consecutive backend work into one transcript item", () => {
    const items = groupTranscriptActivity([
      message("read"),
      message("bash"),
      message("answer", { kind: "text", text: "Done." }),
      message("write"),
    ]);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ kind: "activity-group", messages: [{ id: "read" }, { id: "bash" }] });
    expect(items[1]).toMatchObject({ id: "answer", kind: "text" });
    expect(items[2]).toMatchObject({ kind: "activity-group", messages: [{ id: "write" }] });
  });

  it("keeps failures and bot handoffs visible", () => {
    const error = message("error", { tool: { name: "error: build failed", ok: false } });
    const comm = message("comm", {
      comm: { groupId: "room", withBotId: "forge", withName: "Forge", withColor: "orange" },
    });

    expect(isCollapsibleActivity(error)).toBe(false);
    expect(isCollapsibleActivity(comm)).toBe(false);
    expect(groupTranscriptActivity([error, comm])).toEqual([error, comm]);
  });

  it("does not hide a date boundary inside a group", () => {
    const before = message("before", { at: new Date(2026, 7, 23, 23, 59, 59).getTime() });
    const after = message("after", { at: new Date(2026, 7, 24, 0, 0, 1).getTime() });
    expect(groupTranscriptActivity([before, after])).toHaveLength(2);
  });
});
