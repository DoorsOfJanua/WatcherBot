import { MonitorEvaluator, type MonitorEvaluation } from "./monitor-evaluator.ts";
import { MonitorManager } from "./monitors.ts";

export interface MonitorRunnerOptions {
  intervalMs?: number;
  maxPerTick?: number;
  onNotify?: (evaluation: MonitorEvaluation) => void | Promise<void>;
}

export class MonitorRunner {
  private readonly manager: MonitorManager;
  private readonly evaluator: MonitorEvaluator;
  private readonly intervalMs: number;
  private readonly maxPerTick: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(manager: MonitorManager, evaluator: MonitorEvaluator, options: MonitorRunnerOptions = {}) {
    this.manager = manager;
    this.evaluator = evaluator;
    this.intervalMs = options.intervalMs ?? 60_000;
    this.maxPerTick = Math.max(1, Math.floor(options.maxPerTick ?? 10));
    this.onNotify = options.onNotify;
  }

  private readonly onNotify?: (evaluation: MonitorEvaluation) => void | Promise<void>;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean { return this.timer !== null; }

  async tick(): Promise<MonitorEvaluation[]> {
    if (this.ticking) return [];
    this.ticking = true;
    try {
      const evaluations: MonitorEvaluation[] = [];
      for (const monitor of this.manager.due().slice(0, this.maxPerTick)) {
        try {
          const evaluation = await this.evaluator.evaluate(monitor.id);
          if (!evaluation) continue;
          evaluations.push(evaluation);
          if (evaluation.shouldNotify) await this.onNotify?.(evaluation);
        } catch {
          // An individual adapter/evaluator failure must not stop the tick.
        }
      }
      return evaluations;
    } finally { this.ticking = false; }
  }
}
