import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { projectMcps } from "./project-mcp.ts";

describe("project MCP launchers", () => {
  it("launches ReplyGuy with a real Node executable in packaged builds", () => {
    const replyGuy = projectMcps("Gemini").replyguy;

    expect(basename(replyGuy.command)).toMatch(/^node(?:\.exe)?$/i);
    expect(replyGuy.args).toEqual(["/Users/janua/Projects/ReplyGuy-franz/mcp/server.mjs"]);
    expect(replyGuy.env.PATH).toContain("/usr/local/bin");
  });

  it("uses the same safe Node launcher for Sniper", () => {
    const mfi = projectMcps("Sniper").mfi;

    expect(basename(mfi.command)).toMatch(/^node(?:\.exe)?$/i);
    expect(mfi.args).toEqual(["/Users/janua/Projects/mfi-50-signal-engine/mcp/server.mjs"]);
  });
});
