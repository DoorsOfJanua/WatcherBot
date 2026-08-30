// Ganga Studio, mounted for the bots that work on Instagram content.
//
// Studio is a separate local-first app on this machine. Its MCP bridge runs
// in `watcher` mode, which can shape drafts and Series but cannot approve,
// schedule, arm, or publish. The loopback client below is a separate path:
// it carries authenticated phone review and approval requests from this
// harness to Studio without exposing Studio itself on the network.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_REPO = join(homedir(), "Projects", "GangaStudio");

export const STUDIO_REPO = process.env.GANGA_STUDIO_PATH?.trim() || DEFAULT_REPO;
export const STUDIO_ORIGIN = process.env.GANGA_STUDIO_ORIGIN?.trim() || "http://127.0.0.1:4310";

const STUDIO_BRIDGE = join(STUDIO_REPO, "server", "mcp.ts");
const STUDIO_TSX = join(STUDIO_REPO, "node_modules", ".bin", "tsx");

/** The bridge is opt-in: nothing is mounted unless Studio is installed. */
export function studioConfigured(): boolean {
  return existsSync(STUDIO_BRIDGE) && existsSync(STUDIO_TSX);
}

/** Studio resolves its own environment and data directory from its module. */
export function studioIntegration(): { command: string; args: string[]; env: Record<string, string> } {
  return { command: STUDIO_TSX, args: [STUDIO_BRIDGE], env: {} };
}

/** Content and Instagram specialists get Studio, not the whole fleet. */
export function studioBotMatches(bot: { name?: string; title?: string; description?: string }): boolean {
  return /instagram|studio|ganga|content|social|editorial/i.test(
    `${bot.name || ""} ${bot.title || ""} ${bot.description || ""}`,
  );
}

export class StudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioUnavailableError";
  }
}

/** One bounded loopback call to Studio. Studio being closed is a normal case. */
export async function studioFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${STUDIO_ORIGIN}${path}`, {
      method: init.method || "GET",
      headers: init.body === undefined ? {} : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new StudioUnavailableError(
      `Studio is not reachable at ${STUDIO_ORIGIN}. Start it in ${STUDIO_REPO}. (${reason})`,
    );
  }
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // A non-JSON Studio diagnostic is safe to pass through as plain text.
  }
  return { status: response.status, body };
}

/** Fetch a render so a paired phone can review pixels available only locally. */
export async function studioRender(
  renderPath: string,
): Promise<{ status: number; contentType: string; bytes: Buffer } | null> {
  if (!/^[\w-]+\/[\w.-]+$/.test(renderPath)) return null;
  const response = await fetch(`${STUDIO_ORIGIN}/renders/${renderPath}`, {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}
