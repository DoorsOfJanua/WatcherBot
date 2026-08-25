import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";

type ProjectMcp = { command: string; args: string[]; env: Record<string, string> };
type SecretFile = { replyGuy?: string; ganga?: string; mfi?: string };
function secrets(): SecretFile {
  const file = join(DATA_DIR, "project-mcp-secrets.json");
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")) as SecretFile; } catch { return {}; }
}
export function projectMcps(botName: string): Record<string, ProjectMcp> {
  const name = botName.toLowerCase(); const s = secrets(); const out: Record<string, ProjectMcp> = {};
  if (name.includes("gemini")) out.replyguy = {
    command: process.execPath,
    args: ["/Users/janua/Projects/ReplyGuy-franz/mcp/server.mjs"],
    env: {
      REPLYGUY_URL: "http://127.0.0.1:3004",
      WATCHERBOT_WEBHOOK_URL: s.replyGuy || "",
    },
  };
  if (name.includes("ganga")) out.ganga = { command: "/Users/janua/Projects/GangaStudio/node_modules/.bin/tsx", args: ["/Users/janua/Projects/GangaStudio/server/mcp.ts"], env: { WATCHERBOT_WEBHOOK_URL: s.ganga || "" } };
  if (name.includes("sniper")) out.mfi = { command: process.execPath, args: ["/Users/janua/Projects/mfi-50-signal-engine/mcp/server.mjs"], env: { MFI_DATA_ROOT: "/Users/janua/Projects/mfi-50-signal-engine/data", WATCHERBOT_WEBHOOK_URL: s.mfi || "" } };
  return out;
}
