/** A small, versioned envelope for background agent results.
 *
 * Agents may emit this as JSON (optionally in a fenced code block). The
 * parser deliberately returns a safe ordinary-text result for anything it
 * cannot prove is a valid envelope; callers can therefore adopt it without
 * making malformed model output fatal.
 */
export type AutonomyStatus = "completed" | "failed" | "blocked" | "skipped" | "unchanged";

export interface AutonomyLink {
  label: string;
  url: string;
}

export interface AutonomyOutcome {
  status: AutonomyStatus;
  changed: boolean;
  notify: boolean;
  summary: string;
  details: string;
  artifacts: AutonomyLink[];
  sourceLinks: AutonomyLink[];
  followUpAt: string | null;
}

export interface AutonomyEnvelope extends Partial<Omit<AutonomyOutcome, "status">> {
  kind: "autonomy-outcome";
  version?: 1;
  status: AutonomyStatus;
}

const STATUSES = new Set<AutonomyStatus>(["completed", "failed", "blocked", "skipped", "unchanged"]);
const ENVELOPE_RE = /```autonomy-outcome\s*([\s\S]*?)\s*```/i;
const ENVELOPE_GLOBAL_RE = /```autonomy-outcome\s*[\s\S]*?\s*```/gi;
const WHOLE_JSON_FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const MAX_SUMMARY = 500;
const MAX_DETAILS = 4_000;
const MAX_LINKS = 20;
const MAX_LABEL = 160;
const MAX_URL = 2_048;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capped(value: unknown, max: number): string {
  return text(value).slice(0, max);
}

function detailLabel(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced ? `${spaced[0]!.toUpperCase()}${spaced.slice(1)}` : "Details";
}

/** Models sometimes return a useful details object despite being asked for
 * prose. Render that into compact human Markdown rather than either dropping
 * it or exposing JSON/backend-shaped text in chat. Traversal is deliberately
 * bounded because model output is untrusted. */
function humanDetails(value: unknown, depth = 0): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null || depth > 3) return "";
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => humanDetails(item, depth + 1)).filter(Boolean).map((item) => `- ${item}`).join("\n");
  }
  if (typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>).slice(0, 20).flatMap(([key, item]) => {
    const rendered = humanDetails(item, depth + 1);
    if (!rendered) return [];
    const label = detailLabel(key);
    return rendered.startsWith("- ") || rendered.includes("\n")
      ? [`${label}\n${rendered}`]
      : [`${label}: ${rendered}`];
  }).join("\n\n");
}

function links(value: unknown): AutonomyLink[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LINKS).flatMap((item) => {
    if (typeof item === "string") {
      const url = item.trim().slice(0, MAX_URL);
      return /^https?:\/\//i.test(url) ? [{ label: url.slice(0, MAX_LABEL), url }] : [];
    }
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const url = text(record.url).slice(0, MAX_URL);
    return /^https?:\/\//i.test(url) ? [{ label: capped(record.label, MAX_LABEL) || url.slice(0, MAX_LABEL), url }] : [];
  });
}

function normalized(value: Record<string, unknown>): AutonomyOutcome | null {
  if (value.kind !== "autonomy-outcome" || value.version !== undefined && value.version !== 1) return null;
  // Models commonly use "ok" for a successful result even when the prompt
  // asks for "completed". Treat that harmless synonym as completed instead
  // of stripping the envelope and losing the user-facing summary with it.
  const status = value.status === "ok" ? "completed" : value.status;
  if (typeof status !== "string" || !STATUSES.has(status as AutonomyStatus)) return null;
  const changed = status === "unchanged" ? false : typeof value.changed === "boolean" ? value.changed : true;
  const notify = typeof value.notify === "boolean" ? value.notify : changed || status === "failed" || status === "blocked";
  return {
    status: status as AutonomyStatus,
    changed,
    notify: status === "unchanged" && value.notify !== true ? false : notify,
    summary: capped(value.summary, MAX_SUMMARY),
    details: humanDetails(value.details).slice(0, MAX_DETAILS),
    artifacts: links(value.artifacts),
    sourceLinks: links(value.sourceLinks ?? value.sources),
    followUpAt: typeof value.followUpAt === "string" && !Number.isNaN(Date.parse(value.followUpAt)) ? value.followUpAt : null,
  };
}

/** Parse only an explicit machine envelope. Ordinary prose returns null. */
export function parseAutonomyOutcomeEnvelope(input: unknown): AutonomyOutcome | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  // The semantic `kind` is authoritative. Models occasionally use a generic
  // ```json fence (or no fence) despite the requested autonomy-outcome label;
  // rejecting that valid object leaks backend JSON into chat.
  const candidate = ENVELOPE_RE.exec(raw)?.[1] ?? WHOLE_JSON_FENCE_RE.exec(raw)?.[1] ?? raw;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (parsed && typeof parsed === "object") {
      const result = normalized(parsed as Record<string, unknown>);
      if (result) return result;
    }
  } catch {
    // Model text is untrusted input; ordinary text remains a valid result.
  }
  return null;
}

/** Parse an envelope or safely fall back to ordinary agent text. */
export function parseAutonomyOutcome(input: unknown): AutonomyOutcome {
  return parseAutonomyOutcomeEnvelope(input) ?? fallback(typeof input === "string" ? input.trim() : "");
}

/**
 * Remove explicitly tagged scheduler metadata even when the model made the
 * JSON invalid or used an unsupported status. The tag itself proves this is
 * internal protocol text; malformed metadata must never become chat copy.
 */
export function stripAutonomyOutcomeEnvelope(input: unknown): string {
  if (typeof input !== "string") return "";
  const stripped = input.replace(ENVELOPE_GLOBAL_RE, "").trim();
  if (stripped !== input.trim()) return stripped;
  // A whole generic fence or raw object that validates as our envelope is
  // protocol only. Its human summary/details are rendered by the caller.
  return parseAutonomyOutcomeEnvelope(input) ? "" : stripped;
}

/** Render only user-facing content; never serializes the machine envelope. */
export function formatAutonomyOutcome(outcome: AutonomyOutcome): string {
  const parts = [outcome.summary, outcome.details].filter(Boolean);
  const links = [...outcome.artifacts, ...outcome.sourceLinks].map((link) => `${link.label}: ${link.url}`);
  return [...parts, ...links].join("\n\n");
}

function fallback(summary: string): AutonomyOutcome {
  return { status: "completed", changed: true, notify: true, summary, details: "", artifacts: [], sourceLinks: [], followUpAt: null };
}
