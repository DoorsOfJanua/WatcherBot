import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LOCAL_CALENDAR_BRIDGE = join(process.cwd(), "server", "local-calendar-mcp.ts");
const root = process.env.MYAGENT_ROOM_DATA_DIR?.trim() || join(homedir(), ".myagent-room");
const tokenFile = join(root, "google-calendar", "token.json");

/** The bridge is opt-in: no calendar MCP server is mounted until OAuth has
 * completed and a local refresh token exists. */
export function localCalendarConfigured(): boolean {
  return existsSync(tokenFile);
}

export function localCalendarIntegration(): { command: string; args: string[]; env: Record<string, string> } {
  return {
    command: process.execPath,
    args: ["--experimental-strip-types", LOCAL_CALENDAR_BRIDGE],
    env: { MYAGENT_ROOM_DATA_DIR: root },
  };
}
