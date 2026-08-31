/** Versioned envelope for background-agent results. Malformed model output
 * safely falls back to ordinary text instead of becoming a scheduler error. */
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

const STATUSES = new Set<AutonomyStatus>(["completed", "failed", "blocked", "skipped", "unchanged"]);
const ENVELOPE_RE = /```autonomy-outcome\s*([\s\S]*?)\s*```/i;
const ENVELOPE_GLOBAL_RE = /```autonomy-outcome\s*[\s\S]*?\s*```/gi;
const WHOLE_JSON_FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function detailLabel(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced ? `${spaced[0]!.toUpperCase()}${spaced.slice(1)}` : "Details";
}

function humanDetails(value: unknown, depth = 0): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null || depth > 3) return "";
  if (Array.isArray(value)) {
    return value.slice(0, 30)
      .map((item) => humanDetails(item, depth + 1))
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");
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
  return value.slice(0, 20).flatMap((item) => {
    if (typeof item === "string") {
      const url = item.trim().slice(0, 2_048);
      return /^https?:\/\//i.test(url) ? [{ label: url.slice(0, 160), url }] : [];
    }
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const url = text(record.url).slice(0, 2_048);
    const label = text(record.label).slice(0, 160) || url.slice(0, 160);
    return /^https?:\/\//i.test(url) ? [{ label, url }] : [];
  });
}

function normalized(value: Record<string, unknown>): AutonomyOutcome | null {
  if (value.kind !== "autonomy-outcome" || (value.version !== undefined && value.version !== 1)) return null;
  const status = value.status === "ok" ? "completed" : value.status;
  if (typeof status !== "string" || !STATUSES.has(status as AutonomyStatus)) return null;
  const changed = status === "unchanged" ? false : typeof value.changed === "boolean" ? value.changed : true;
  const notify = typeof value.notify === "boolean"
    ? value.notify
    : changed || status === "failed" || status === "blocked";
  return {
    status: status as AutonomyStatus,
    changed,
    notify: status === "unchanged" && value.notify !== true ? false : notify,
    summary: text(value.summary).slice(0, 500),
    details: humanDetails(value.details).slice(0, 4_000),
    artifacts: links(value.artifacts),
    sourceLinks: links(value.sourceLinks ?? value.sources),
    followUpAt: typeof value.followUpAt === "string" && !Number.isNaN(Date.parse(value.followUpAt))
      ? value.followUpAt
      : null,
  };
}

export function parseAutonomyOutcomeEnvelope(input: unknown): AutonomyOutcome | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  const candidate = ENVELOPE_RE.exec(raw)?.[1] ?? WHOLE_JSON_FENCE_RE.exec(raw)?.[1] ?? raw;
  try {
    const parsed: unknown = JSON.parse(candidate);
    return parsed && typeof parsed === "object" ? normalized(parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function parseAutonomyOutcome(input: unknown): AutonomyOutcome {
  return parseAutonomyOutcomeEnvelope(input) ?? {
    status: "completed",
    changed: true,
    notify: true,
    summary: typeof input === "string" ? input.trim() : "",
    details: "",
    artifacts: [],
    sourceLinks: [],
    followUpAt: null,
  };
}

export function stripAutonomyOutcomeEnvelope(input: unknown): string {
  if (typeof input !== "string") return "";
  const stripped = input.replace(ENVELOPE_GLOBAL_RE, "").trim();
  if (stripped !== input.trim()) return stripped;
  return parseAutonomyOutcomeEnvelope(input) ? "" : stripped;
}

export function formatAutonomyOutcome(outcome: AutonomyOutcome): string {
  const parts = [outcome.summary, outcome.details].filter(Boolean);
  const renderedLinks = [...outcome.artifacts, ...outcome.sourceLinks]
    .map((link) => `${link.label}: ${link.url}`);
  return [...parts, ...renderedLinks].join("\n\n");
}
