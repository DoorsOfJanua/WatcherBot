import { createHash } from "node:crypto";

import type {
  RoutinePrecheckProvider,
  RoutinePrecheckResult,
} from "./routines.ts";
import type { MonitorSourceAdapter } from "./monitor-http-adapter.ts";

export interface MonitorEvaluatorOptions {
  adapters?: Record<string, MonitorSourceAdapter>;
}

export interface MonitorEvaluation {
  content: string;
  normalized: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
}

/** Source-neutral monitor evaluation. Adapters only fetch; this owns stable
 * normalization and fingerprinting. RoutineManager owns comparison/state. */
export class MonitorEvaluator {
  private readonly adapters: Record<string, MonitorSourceAdapter>;

  constructor(options: MonitorEvaluatorOptions = {}) {
    this.adapters = options.adapters ?? {};
  }

  async evaluate(
    source: Record<string, unknown>,
    config: Record<string, unknown> = {},
  ): Promise<MonitorEvaluation> {
    const kind = typeof source.kind === "string" ? source.kind : "";
    const adapter = this.adapters[kind];
    if (!adapter) throw new Error(`No monitor adapter registered for source kind "${kind || "unknown"}"`);
    const result = await adapter(source, config);
    const content = typeof result === "string" ? result : result.content;
    const metadata = typeof result === "string" ? undefined : result.metadata;
    const normalized = normalizeMonitorContent(content);
    return {
      content,
      normalized,
      fingerprint: fingerprintMonitorContent(normalized),
      ...(metadata ? { metadata } : {}),
    };
  }
}

export function createMonitorPrecheckProvider(options: MonitorEvaluatorOptions): RoutinePrecheckProvider {
  const evaluator = new MonitorEvaluator(options);
  return async (precheck): Promise<RoutinePrecheckResult> => {
    if (precheck.kind !== "monitor") return { error: "Monitor pre-check provider received another kind" };
    try {
      const evaluation = await evaluator.evaluate(precheck.source, precheck.config ?? {});
      return { value: evaluation.fingerprint };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export function normalizeMonitorContent(content: string): string {
  return String(content ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprintMonitorContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
