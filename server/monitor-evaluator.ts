import { createHash } from "node:crypto";

import { parseAutonomyOutcome, type AutonomyOutcome } from "./autonomy-outcome.ts";
import { MonitorManager, type Monitor, type MonitorObservation } from "./monitors.ts";

export interface MonitorAdapterResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export type MonitorSourceAdapter = (source: Record<string, unknown>, config: Record<string, unknown>) => Promise<MonitorAdapterResult | string>;

export interface MonitorEvaluatorOptions {
  adapters?: Record<string, MonitorSourceAdapter>;
  now?: () => number;
}

export interface MonitorEvaluation {
  monitor: Monitor;
  outcome: AutonomyOutcome;
  changed: boolean;
  baselineEstablished: boolean;
  shouldNotify: boolean;
  fingerprint?: string;
}

/** Source-neutral monitor evaluation. Adapters only fetch; this owns comparison and persistence. */
export class MonitorEvaluator {
  private readonly manager: MonitorManager;
  private readonly adapters: Record<string, MonitorSourceAdapter>;
  private readonly now: () => number;

  constructor(manager: MonitorManager, options: MonitorEvaluatorOptions = {}) {
    this.manager = manager;
    this.adapters = options.adapters ?? {};
    this.now = options.now ?? Date.now;
  }

  async evaluate(id: string): Promise<MonitorEvaluation | null> {
    const monitor = this.manager.get(id);
    if (!monitor || monitor.status !== "active") return null;
    const kind = typeof monitor.source.kind === "string" ? monitor.source.kind : "";
    const adapter = this.adapters[kind];
    if (!adapter) return this.recordError(monitor, `No monitor adapter registered for source kind "${kind || "unknown"}"`);
    try {
      const result = await adapter(monitor.source, monitor.config);
      const content = typeof result === "string" ? result : result.content;
      const normalized = normalizeMonitorContent(content);
      const fingerprint = fingerprintMonitorContent(normalized);
      const metadata = typeof result === "string" ? undefined : result.metadata;
      const observedAt = this.now();
      const baselineEstablished = monitor.baseline?.fingerprint === undefined;
      const changed = !baselineEstablished && monitor.baseline?.fingerprint !== fingerprint;
      const observation: MonitorObservation = {
        observedAt, fingerprint, status: changed ? "changed" : "ok", value: normalized,
        ...(metadata ? { metadata } : {}),
        ...(changed ? { changedAt: observedAt } : {}),
      };
      if (baselineEstablished) {
        this.manager.update(id, { baseline: { capturedAt: observedAt, fingerprint, value: normalized, ...(metadata ? { metadata } : {}) } });
      } else if (changed) {
        this.manager.update(id, { baseline: { capturedAt: observedAt, fingerprint, value: normalized, ...(metadata ? { metadata } : {}) } });
      }
      const saved = this.manager.recordObservation(id, observation, observedAt)!;
      const outcome = changed
        ? outcomeFrom({ kind: "autonomy-outcome", status: "completed", changed: true, notify: true, summary: `Monitor changed: ${monitor.name}`, details: `Fingerprint changed from ${monitor.baseline?.fingerprint ?? "none"} to ${fingerprint}.` })
        : outcomeFrom({ kind: "autonomy-outcome", status: "unchanged", changed: false, notify: false, summary: baselineEstablished ? `Baseline established: ${monitor.name}` : `No meaningful change: ${monitor.name}` });
      return { monitor: saved, outcome, changed, baselineEstablished, shouldNotify: changed && this.policyAllows(monitor, "change"), fingerprint };
    } catch (error) {
      return this.recordError(monitor, error instanceof Error ? error.message : String(error));
    }
  }

  private recordError(monitor: Monitor, message: string): MonitorEvaluation {
    const observedAt = this.now();
    const observation: MonitorObservation = { observedAt, status: "error", error: message.slice(0, 2_000) };
    const saved = this.manager.recordObservation(monitor.id, observation, observedAt)!;
    const outcome = outcomeFrom({ kind: "autonomy-outcome", status: "failed", changed: false, notify: true, summary: `Monitor error: ${monitor.name}`, details: observation.error });
    return { monitor: saved, outcome, changed: false, baselineEstablished: false, shouldNotify: this.policyAllows(monitor, "error") };
  }

  private policyAllows(monitor: Monitor, kind: "change" | "error"): boolean {
    const policy = monitor.notificationPolicy;
    return policy.enabled !== false && (kind === "change" ? policy.onChange !== false : policy.onError !== false);
  }
}

function outcomeFrom(value: Record<string, unknown>): AutonomyOutcome {
  return parseAutonomyOutcome(JSON.stringify(value));
}


export function normalizeMonitorContent(content: string): string {
  return String(content ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

export function fingerprintMonitorContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
