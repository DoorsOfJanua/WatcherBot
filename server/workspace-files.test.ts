// The Files surface is a window into a bot's workspace, never a door out of
// it: listing hides symlinks and dotfiles, and the preview gate must reject
// every path that resolves outside the workspace, encoded or symlinked.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureWorkspace,
  listWorkspaceFiles,
  readWorkspaceFile,
  workspaceDir,
  WORKSPACE_PREVIEW_MAX_BYTES,
} from "./workspace.ts";

const BOT = "workspace-files-test-bot";

describe("workspace files", () => {
  beforeEach(() => {
    rmSync(workspaceDir(BOT), { recursive: true, force: true });
    ensureWorkspace(BOT);
  });

  it("lists files and directories with relative paths, hiding dotfiles and symlinks", () => {
    const dir = workspaceDir(BOT);
    writeFileSync(join(dir, "report.md"), "# hello");
    mkdirSync(join(dir, "drafts"));
    writeFileSync(join(dir, "drafts", "one.txt"), "draft");
    writeFileSync(join(dir, ".hidden"), "secret");
    symlinkSync("/etc", join(dir, "escape"));

    const { entries, truncated } = listWorkspaceFiles(BOT);
    const paths = entries.map((e) => e.path);
    expect(paths).toContain("report.md");
    expect(paths).toContain("drafts");
    expect(paths).toContain("drafts/one.txt");
    expect(paths).toContain("MEMORY.md");
    expect(paths).not.toContain(".hidden");
    expect(paths).not.toContain("escape");
    expect(truncated).toBe(false);
    expect(entries.find((e) => e.path === "drafts")?.kind).toBe("dir");
    expect(entries.find((e) => e.path === "report.md")?.bytes).toBeGreaterThan(0);
  });

  it("caps the listing size, hides node_modules, and stops at the depth limit", () => {
    const dir = workspaceDir(BOT);
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "pkg.js"), "hidden");
    // depth limit: level4 is listed as a dir, its children are not walked
    mkdirSync(join(dir, "l1", "l2", "l3", "l4"), { recursive: true });
    writeFileSync(join(dir, "l1", "l2", "l3", "l4", "too-deep.txt"), "x");
    // sorts after l1 so the depth limit is exercised before the cap trips
    const bulk = join(dir, "zbulk");
    mkdirSync(bulk);
    for (let i = 0; i < 520; i++) writeFileSync(join(bulk, `f${String(i).padStart(3, "0")}.txt`), "x");

    const { entries, truncated } = listWorkspaceFiles(BOT);
    const paths = entries.map((e) => e.path);
    expect(entries.length).toBeLessThanOrEqual(500);
    expect(truncated).toBe(true);
    expect(paths.some((p) => p.startsWith("node_modules"))).toBe(false);
    expect(paths).not.toContain("l1/l2/l3/l4/too-deep.txt");
  });

  it("previews a text file and caps it at the preview budget", () => {
    const dir = workspaceDir(BOT);
    writeFileSync(join(dir, "notes.md"), "small file");
    const small = readWorkspaceFile(BOT, "notes.md");
    expect(small).toMatchObject({ ok: true, text: "small file", truncated: false });

    writeFileSync(join(dir, "big.txt"), "x".repeat(WORKSPACE_PREVIEW_MAX_BYTES + 100));
    const big = readWorkspaceFile(BOT, "big.txt");
    if (!big.ok) throw new Error("expected ok");
    expect(big.truncated).toBe(true);
    expect(big.text.length).toBe(WORKSPACE_PREVIEW_MAX_BYTES);
    expect(big.bytes).toBe(WORKSPACE_PREVIEW_MAX_BYTES + 100);
  });

  it("reports binary files instead of decoding garbage", () => {
    writeFileSync(join(workspaceDir(BOT), "blob.bin"), Buffer.from([0x89, 0x50, 0x00, 0x47]));
    expect(readWorkspaceFile(BOT, "blob.bin")).toEqual({ ok: false, reason: "binary" });
  });

  it("rejects traversal, dot segments, and absolute-ish paths", () => {
    for (const bad of ["../other-bot/MEMORY.md", "..", ".hidden", "a/../../x", "a\\..\\x", "", "memory/.sneaky"]) {
      const result = readWorkspaceFile(BOT, bad);
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.reason, bad).not.toBe("binary");
    }
  });

  it("refuses a path that resolves outside the workspace through a symlink", () => {
    const dir = workspaceDir(BOT);
    mkdirSync(join(dir, "sub"));
    symlinkSync("/etc", join(dir, "sub", "link"));
    const result = readWorkspaceFile(BOT, "sub/link/hosts");
    expect(result.ok).toBe(false);
  });

  it("404s cleanly for files that do not exist", () => {
    expect(readWorkspaceFile(BOT, "nope.md")).toEqual({ ok: false, reason: "not-found" });
  });
});
