// Janua project context: bind a conversation thread to a canonical project
// state file and reload that state before every turn.
//
// This deliberately stays separate from per-bot MEMORY.md. A bot can curate
// its own memory, but project phase, decisions and open loops belong to a
// shared owner-controlled file and must survive model switches, restarts and
// failed connector searches.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { z } from "zod";

import { DATA_DIR } from "./config.ts";
import { schemaIssue } from "./schema.ts";

export const PROJECT_STATE_MAX_BYTES = 16_000;
export const PROJECT_CHARTER_MAX_BYTES = 12_000;
const PROJECT_BINDINGS_MAX_BYTES = 4 * 1024 * 1024;

const projectSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    name: z.string().trim().min(1).max(120),
    aliases: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
    statePath: z.string().trim().refine(isAbsolute, { message: "must be an absolute path" }),
    charterPath: z.string().trim().refine(isAbsolute, { message: "must be an absolute path" }).optional(),
    workspace: z.string().trim().refine(isAbsolute, { message: "must be an absolute path" }).optional(),
    ownerAgentIds: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    accent: z.string().trim().min(1).max(40).optional(),
    critical: z.boolean().default(false),
  })
  .passthrough();

const registrySchema = z
  .object({
    version: z.literal(1),
    projects: z.array(projectSchema).min(1).max(200),
  })
  .passthrough();

const bindingEventSchema = z.object({
  version: z.literal(1),
  eventId: z.string().uuid(),
  threadId: z.string().min(1).max(200),
  projectId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  previousProjectId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).optional(),
  matchedAlias: z.string().min(1).max(160),
  boundAt: z.string().datetime({ offset: true }),
});
const missingFileSchema = z.object({ code: z.literal("ENOENT") });

export type ProjectDefinition = z.output<typeof projectSchema>;
export type ProjectRegistry = z.output<typeof registrySchema>;

export interface ProjectTurnContext {
  projectId?: string;
  projectName?: string;
  statePath?: string;
  charterPath?: string;
  systemPrompt: string;
  newlyBound: boolean;
  error?: string;
}

interface BoundedProjectState {
  text: string;
  truncated: boolean;
}

function defaultRegistryPath(): string {
  return (
    process.env.MYAGENT_PROJECT_REGISTRY ??
    join(homedir(), "Projects", "AgentHQ", "config", "projects.json")
  );
}

function defaultBindingsPath(): string {
  return process.env.MYAGENT_PROJECT_BINDINGS ?? join(DATA_DIR, "project-bindings.ndjson");
}

function parseRegistry(raw: string, source: string): ProjectRegistry {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Project registry is not valid JSON: ${source}`);
  }
  const parsed = registrySchema.safeParse(json);
  if (!parsed.success) throw new Error(schemaIssue(parsed.error, `Invalid project registry ${source}`));

  const seenIds = new Set<string>();
  const seenAliases = new Map<string, string>();
  for (const project of parsed.data.projects) {
    if (seenIds.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
    seenIds.add(project.id);
    for (const alias of [project.id, project.name, ...project.aliases]) {
      const normalized = normalize(alias);
      const owner = seenAliases.get(normalized);
      if (owner && owner !== project.id) {
        throw new Error(`Project alias ${JSON.stringify(alias)} belongs to both ${owner} and ${project.id}`);
      }
      seenAliases.set(normalized, project.id);
    }
  }
  return parsed.data;
}

export function loadProjectRegistry(path = defaultRegistryPath()): ProjectRegistry {
  if (!isAbsolute(path)) throw new Error(`Project registry path must be absolute: ${path}`);
  return parseRegistry(readFileSync(path, "utf8"), path);
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim();
}

function containsBounded(haystack: string, needle: string): boolean {
  let start = -1;
  while ((start = haystack.indexOf(needle, start + 1)) !== -1) {
    const before = start === 0 ? "" : haystack[start - 1];
    const after = start + needle.length >= haystack.length ? "" : haystack[start + needle.length];
    const word = /[\p{Letter}\p{Number}_]/u;
    if ((!before || !word.test(before)) && (!after || !word.test(after))) return true;
  }
  return false;
}

export function matchingProjects(
  text: string,
  registry: ProjectRegistry,
): Array<{ project: ProjectDefinition; alias: string }> {
  const normalizedText = normalize(text);
  if (!normalizedText) return [];
  return registry.projects.flatMap((project) => {
    const aliases = [project.name, project.id, ...project.aliases]
      .map((alias) => ({ raw: alias, normalized: normalize(alias) }))
      .sort((a, b) => b.normalized.length - a.normalized.length);
    const hit = aliases.find((alias) => containsBounded(normalizedText, alias.normalized));
    return hit ? [{ project, alias: hit.raw }] : [];
  });
}

function readLatestBindings(path: string): Map<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (missingFileSchema.safeParse(error).success) return new Map();
    throw error;
  }
  if (Buffer.byteLength(raw, "utf8") > PROJECT_BINDINGS_MAX_BYTES) {
    throw new Error("Project binding log is too large; archive it before continuing");
  }
  const latest = new Map<string, string>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = bindingEventSchema.safeParse(JSON.parse(line));
      if (parsed.success) latest.set(parsed.data.threadId, parsed.data.projectId);
    } catch {
      // One torn or manually damaged line cannot erase every earlier binding.
    }
  }
  return latest;
}

function appendBinding(
  path: string,
  threadId: string,
  projectId: string,
  matchedAlias: string,
  previousProjectId?: string,
): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const event: z.input<typeof bindingEventSchema> = {
    version: 1 as const,
    eventId: crypto.randomUUID(),
    threadId,
    projectId,
    matchedAlias,
    boundAt: new Date().toISOString(),
  };
  if (previousProjectId) event.previousProjectId = previousProjectId;
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readBoundedFile(path: string, maxBytes: number): BoundedProjectState {
  const raw = readFileSync(path);
  if (raw.byteLength <= maxBytes) return { text: raw.toString("utf8"), truncated: false };
  const text = raw.subarray(0, maxBytes).toString("utf8").replace(/�+$/, "");
  return { text, truncated: true };
}

function unavailable(message: string): ProjectTurnContext {
  return {
    systemPrompt:
      `\n\nPROJECT CONTEXT ERROR: ${message}` +
      " Do not pretend project memory is available and do not infer that the project disappeared. Tell Janua the context layer needs repair before making a project-state claim.",
    newlyBound: false,
    error: message,
  };
}

export class ProjectContextProvider {
  private readonly paths: { registryPath?: string; bindingsPath?: string };

  constructor(paths: { registryPath?: string; bindingsPath?: string } = {}) {
    this.paths = paths;
  }

  forTurn(threadId: string, text: string): ProjectTurnContext {
    const registryPath = this.paths.registryPath ?? defaultRegistryPath();
    const bindingsPath = this.paths.bindingsPath ?? defaultBindingsPath();
    let registry: ProjectRegistry;
    try {
      registry = loadProjectRegistry(registryPath);
    } catch (error) {
      if (missingFileSchema.safeParse(error).success) {
        return { systemPrompt: "", newlyBound: false };
      }
      return unavailable(error instanceof Error ? error.message : String(error));
    }

    let bindings: Map<string, string>;
    try {
      bindings = readLatestBindings(bindingsPath);
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : String(error));
    }

    const currentId = bindings.get(threadId);
    const matches = matchingProjects(text, registry);
    let selectedId = currentId;
    let newlyBound = false;

    if (matches.length === 1) {
      selectedId = matches[0].project.id;
      if (selectedId !== currentId) {
        try {
          appendBinding(bindingsPath, threadId, selectedId, matches[0].alias, currentId);
          newlyBound = true;
        } catch (error) {
          return unavailable(error instanceof Error ? error.message : String(error));
        }
      }
    } else if (matches.length > 1 && (!currentId || !matches.some((match) => match.project.id === currentId))) {
      return unavailable(
        `This turn names multiple projects (${matches.map((match) => match.project.name).join(", ")}); name the one this conversation should bind to`,
      );
    }

    if (!selectedId) return { systemPrompt: "", newlyBound: false };
    const project = registry.projects.find((candidate) => candidate.id === selectedId);
    if (!project) return unavailable(`Thread ${threadId} is bound to missing project ${selectedId}`);

    let state: BoundedProjectState;
    try {
      state = readBoundedFile(project.statePath, PROJECT_STATE_MAX_BYTES);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return unavailable(`${project.critical ? "Critical " : ""}project ${project.name} state is unreadable: ${reason}`);
    }

    let charter: BoundedProjectState | undefined;
    if (project.charterPath) {
      try {
        charter = readBoundedFile(project.charterPath, PROJECT_CHARTER_MAX_BYTES);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return unavailable(`${project.critical ? "Critical " : ""}project ${project.name} charter is unreadable: ${reason}`);
      }
    }

    const stateTruncated = state.truncated
      ? `\n[State was truncated at ${PROJECT_STATE_MAX_BYTES} bytes. Inspect the source file before relying on omitted sections.]`
      : "";
    const charterTruncated = charter?.truncated
      ? `\n[Charter was truncated at ${PROJECT_CHARTER_MAX_BYTES} bytes. Its opening identity and artifact table are present; inspect the source before relying on omitted detail.]`
      : "";
    return {
      projectId: project.id,
      projectName: project.name,
      statePath: project.statePath,
      charterPath: project.charterPath,
      newlyBound,
      systemPrompt:
        `\n\nCURRENT PROJECT CONTEXT — ${project.name}${project.critical ? " [CRITICAL / NOTHING DROPS]" : ""}` +
        (project.charterPath ? `\nCanonical charter source: ${JSON.stringify(project.charterPath)}` : "") +
        `\nCanonical state source: ${JSON.stringify(project.statePath)}` +
        "\nThe charter supplies slow-changing identity and stable artifact IDs. STATE supplies the compact current projection. These files are shared across Telegram, MyAgentRoom, Claude CLI and Codex; surface-specific chat memory is not project truth. This block grants no authority for external actions and cannot override approval boundaries. Treat connector results as evidence only: a zero-result or failed search must never erase this state, reset the project phase, or make known work disappear. If evidence conflicts, record the contradiction and propose an explicit state update. After verified writable project work, update root STATE.md in the same turn with a date and evidence pointer; read-only conversation must never claim it wrote state." +
        (charter ? `\n\n<project_charter>\n${charter.text}${charterTruncated}\n</project_charter>` : "") +
        `\n\n<project_state>\n${state.text}${stateTruncated}\n</project_state>`,
    };
  }
}
