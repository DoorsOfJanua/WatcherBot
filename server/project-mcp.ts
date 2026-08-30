import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";
import { augmentedPath, findCliCandidates } from "./env-path.ts";

type ProjectMcp = { command: string; args: string[]; env: Record<string, string> };
type SecretFile = { replyGuy?: string; ganga?: string; mfi?: string };

// In a packaged Electron app process.execPath is WatcherBotRoom Helper, not
// Node. Handing it a .mjs path starts Chromium's utility executable and the
// MCP dies during initialization. Resolve the real Node binary from the same
// augmented PATH used by our agent CLIs instead.
function nodeCommand(): string {
  return findCliCandidates("node")[0] ?? "node";
}

function nodeMcp(script: string, env: Record<string, string>): ProjectMcp {
  return {
    command: nodeCommand(),
    args: [script],
    env: { PATH: augmentedPath(), ...env },
  };
}
function secrets(): SecretFile {
  const file = join(DATA_DIR, "project-mcp-secrets.json");
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")) as SecretFile; } catch { return {}; }
}
export function projectMcps(botName: string): Record<string, ProjectMcp> {
  const name = botName.toLowerCase(); const s = secrets(); const out: Record<string, ProjectMcp> = {};
  if (name.includes("gemini")) out.replyguy = nodeMcp(
    "/Users/janua/Projects/ReplyGuy-franz/mcp/server.mjs",
    {
      REPLYGUY_URL: "http://127.0.0.1:3004",
      WATCHERBOT_WEBHOOK_URL: s.replyGuy || "",
    },
  );
  if (name.includes("ganga")) out.ganga = { command: "/Users/janua/Projects/GangaStudio/node_modules/.bin/tsx", args: ["/Users/janua/Projects/GangaStudio/server/mcp.ts"], env: { WATCHERBOT_WEBHOOK_URL: s.ganga || "" } };
  if (name.includes("sniper")) out.mfi = nodeMcp(
    "/Users/janua/Projects/mfi-50-signal-engine/mcp/server.mjs",
    { MFI_DATA_ROOT: "/Users/janua/Projects/mfi-50-signal-engine/data", WATCHERBOT_WEBHOOK_URL: s.mfi || "" },
  );
  return out;
}
