import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.MYAGENT_ROOM_DATA_DIR;

describe("writing style memory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.MYAGENT_ROOM_DATA_DIR;
    else process.env.MYAGENT_ROOM_DATA_DIR = originalDataDir;
  });

  it("records a private before/after lesson and emits a bounded style-only prompt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "myagent-writing-style-"));
    process.env.MYAGENT_ROOM_DATA_DIR = dir;
    const style = await import("./writing-style.ts");
    const workspace = await import("./workspace.ts");
    const result = style.recordWritingStyleEdit({
      botId: "mailman",
      sourceMessageId: "message-1",
      before: { subject: "Following up", body: "I hope this email finds you well. Please respond." },
      after: { subject: "Farmada — next step", body: "Hi Charlie,\n\nCan you send the figures by Friday?\n\nNils" },
      at: Date.parse("2026-08-23T12:00:00Z"),
    });
    expect(result).toEqual({ learned: true, sampleCount: 1 });
    const file = join(workspace.workspaceDir("mailman"), "memory", "writing-style.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toHaveLength(1);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(style.writingStyleSystemPrompt("mailman")).toContain("Janua's saved revision");
    expect(style.writingStyleSystemPrompt("mailman")).toContain("never copy factual content");
  });

  it("does not learn when the saved text is unchanged", async () => {
    const dir = mkdtempSync(join(tmpdir(), "myagent-writing-style-"));
    process.env.MYAGENT_ROOM_DATA_DIR = dir;
    const style = await import("./writing-style.ts");
    expect(style.recordWritingStyleEdit({
      botId: "mailman-unchanged",
      sourceMessageId: "message-2",
      before: { subject: "Same", body: "Same" },
      after: { subject: "Same", body: "Same" },
    })).toEqual({ learned: false, sampleCount: 0 });
  });
});
