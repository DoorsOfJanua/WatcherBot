import type { Mission, MissionStatus, WorkItem } from "./missions.ts";
import type { MissionExecutionResult } from "./mission-dispatcher.ts";
import { formatAutonomyOutcome, parseAutonomyOutcomeEnvelope, type AutonomyOutcome } from "./autonomy-outcome.ts";

export const MAX_MISSION_PROMPT_CHARS = 12_000;
export const MAX_REPLY_CHARS = 20_000;

export interface ParseMissionReplyOptions {
  missionId?: string;
  currentStatus?: MissionStatus;
  unchangedReply?: string;
  usage?: { tokens?: number; cost?: number };
}

/** Build the bounded, provider-neutral instruction passed to an agent turn. */
export function formatMissionPrompt(mission: Mission, item: WorkItem): string {
  const dependencies = item.dependsOn.length ? item.dependsOn.join(", ") : "none";
  const budget = mission.budget
    ? JSON.stringify(mission.budget)
    : "none specified; stay within the authority granted by the server";
  const prompt = [
    "You are executing one bounded mission work item.",
    "MISSION",
    `id: ${mission.id}`,
    `title: ${cap(mission.title, 1_000)}`,
    `objective: ${cap(mission.objective, 2_000)}`,
    `success criteria: ${mission.successCriteria.length ? mission.successCriteria.map((x) => cap(x, 800)).join(" | ") : "none specified"}`,
    `lead/accountable agent: ${mission.leadAgentId}`,
    "WORK ITEM",
    `id: ${item.id}`,
    `title: ${cap(item.title, 1_000)}`,
    `description: ${cap(item.description ?? "", 2_000) || "none"}`,
    `dependencies: ${dependencies}`,
    `assigned agent: ${item.assignee ?? mission.leadAgentId}`,
    `budget: ${budget}`,
    "AUTONOMY AND APPROVAL RULES",
    "Stay within this item and the stated budget. Do not claim completion for another item. Ask for approval or block when required authority, a dependency, or success criterion cannot be satisfied. Do not treat an ordinary narrative reply as completion.",
    "For unattended inspection, use native Read/Glob/Grep tools or auditable read-only shell programs such as ls, find, rg, grep, jq, wc, head, tail, stat, comm, cut, sed, and read-only git commands. Use find only for listing: never use find -exec, -delete, -ok, or -fprint; pipe listed paths through read-only tools instead. Never redirect output to a file or create temporary files during a read-only mission; for two-stream comparisons use read-only process substitution such as comm -23 <(first read pipeline) <(second read pipeline). Do not use Python, Node, Ruby, Perl, awk, shell interpreters, eval, or generated scripts merely to read/count/transform data: arbitrary interpreter code cannot be safely auto-approved. If the work cannot be completed with auditable reads, return blocked and name the exact approval or capability needed.",
    "REQUIRED FINAL OUTCOME ENVELOPE",
    '```autonomy-outcome\n{"kind":"autonomy-outcome","version":1,"status":"completed|blocked|failed","changed":true,"notify":true,"summary":"...","details":"...","artifacts":[],"sourceLinks":[]}\n```',
    "Return exactly one autonomy-outcome envelope. Use completed only when this work item is actually done; use blocked when waiting for approval, input, or a dependency; use failed for an execution failure.",
  ].join("\n");
  return prompt.length <= MAX_MISSION_PROMPT_CHARS ? prompt : `${prompt.slice(0, MAX_MISSION_PROMPT_CHARS - 1)}…`;
}

/** Parse only an explicit outcome envelope; unstructured text fails safe. */
export function parseMissionReply(reply: string, options: ParseMissionReplyOptions = {}): MissionExecutionResult & { outcome?: AutonomyOutcome } {
  const text = reply.slice(0, MAX_REPLY_CHARS).trim();
  const unchanged = options.unchangedReply?.trim();
  if (!text || (unchanged !== undefined && text === unchanged)) return safeFallback(options.currentStatus, "No changed mission outcome was provided");
  const outcome = parseAutonomyOutcomeEnvelope(text);
  if (!outcome) return safeFallback(options.currentStatus, "Agent did not provide the required mission outcome envelope");
  const display = formatAutonomyOutcome(outcome);
  if (options.currentStatus === "failed") return { status: "fail", reason: display || "Mission remains failed", usage: options.usage, outcome };
  if (options.currentStatus === "blocked" && outcome.status === "completed") return { status: "block", reason: "Mission remains blocked until resumed", usage: options.usage, outcome };
  if (outcome.status === "completed") return { status: "complete", ...(display ? { result: display } : {}), usage: options.usage, outcome };
  if (outcome.status === "blocked") return { status: "block", ...(display ? { reason: display } : {}), usage: options.usage, outcome };
  if (outcome.status === "failed") return { status: "fail", ...(display ? { reason: display } : {}), usage: options.usage, outcome };
  return { status: "block", reason: display || "Mission work did not report completion", usage: options.usage, outcome };
}
function safeFallback(status: MissionStatus | undefined, reason: string): MissionExecutionResult { return status === "failed" ? { status: "fail", reason } : { status: "block", reason }; }
function cap(value: string, limit: number): string { return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`; }
