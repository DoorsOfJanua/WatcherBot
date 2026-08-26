// Ganga Studio, mounted for the bots that work on Instagram content.
//
// Studio is a separate local-first app on this machine (default
// ~/Projects/GangaStudio, port 4310). Two things connect to it and they are
// deliberately different:
//
//   the MCP bridge  — the bot's own tools, in Studio's `watcher` mode, which
//                     can shape drafts and Series but cannot approve,
//                     schedule, arm or publish. That boundary is enforced in
//                     Studio by filtering its tool registry, not here.
//   the loopback client — how *this* server reads Studio's queue and carries
//                     Janua's approval to it, for the phone.
//
// Studio binds 127.0.0.1 and has no authentication of its own. That is the
// reason the phone never speaks to it: the device authenticates to the
// companion, the companion forwards to this server on loopback, and this
// server is the only thing that calls Studio. Exposing Studio on the tailnet
// instead would have put its /arm and publish routes on the network behind no
// credential at all.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_REPO = join(homedir(), "Projects", "GangaStudio");

export const STUDIO_REPO = process.env.GANGA_STUDIO_PATH?.trim() || DEFAULT_REPO;
export const STUDIO_ORIGIN = process.env.GANGA_STUDIO_ORIGIN?.trim() || "http://127.0.0.1:4310";

/** Studio's own tsx, because its server is TypeScript with .js specifiers. */
const STUDIO_BRIDGE = join(STUDIO_REPO, "server", "mcp.ts");
const STUDIO_TSX = join(STUDIO_REPO, "node_modules", ".bin", "tsx");

/** The bridge is opt-in: nothing is mounted unless Studio is actually here. */
export function studioConfigured(): boolean {
  return existsSync(STUDIO_BRIDGE) && existsSync(STUDIO_TSX);
}

/**
 * No cwd is passed, and none is needed: Studio's server/env.ts resolves its
 * .env from its own module path and that .env sets an absolute
 * STUDIO_DATA_DIR. Before that import existed, an MCP server spawned from a
 * foreign cwd silently opened an empty database instead of Studio's.
 */
export function studioIntegration(): { command: string; args: string[]; env: Record<string, string> } {
  return { command: STUDIO_TSX, args: [STUDIO_BRIDGE], env: {} };
}

/** Which bots get Studio. Content and Instagram specialists, not the fleet. */
export function studioBotMatches(bot: { name?: string; title?: string; description?: string }): boolean {
  return /instagram|studio|ganga|content|social|editorial/i.test(
    `${bot.name || ""} ${bot.title || ""} ${bot.description || ""}`
  );
}

export class StudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioUnavailableError";
  }
}

/**
 * One call to Studio on loopback. Short timeout on purpose: Studio not
 * running is the normal case (it is a desktop app), and the phone should get
 * a clear "Studio is not running" rather than a spinner.
 */
export async function studioFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${STUDIO_ORIGIN}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method || "GET",
      headers: init.body === undefined ? {} : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new StudioUnavailableError(
      `Studio is not reachable at ${STUDIO_ORIGIN}. Start it with "npm run dev" in ${STUDIO_REPO}. (${reason})`,
    );
  }
  const text = await response.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* Studio returned non-JSON; pass it through as text */ }
  return { status: response.status, body };
}

/** Fetch a render's bytes so the phone can show a design it cannot reach itself. */
export async function studioRender(renderPath: string): Promise<{ status: number; contentType: string; bytes: Buffer } | null> {
  // Anchored and undecoded, like the companion's allowlist: the failure mode
  // of a strict pattern is a closed door, which is the one to have.
  if (!/^[\w-]+\/[\w.-]+$/.test(renderPath)) return null;
  const response = await fetch(`${STUDIO_ORIGIN}/renders/${renderPath}`, {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response || !response.ok) return null;
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}
