import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Goal,
  Loader2,
  Radar,
  RefreshCw,
} from "lucide-react";

import { BotAvatar } from "@/components/Avatar";
import {
  latestMissionOutcome,
  missionProgress,
  monitorInterval,
  monitorTarget,
  relativeTime,
  type AutonomySnapshot,
  type MissionStatus,
  type MissionSummary,
  type MonitorStatus,
  type MonitorSummary,
} from "@/lib/autonomy";
import { cn } from "@/lib/cn";
import { api, type Bot } from "@/state/store";

type View = "watchers" | "missions";
type Scope = "all" | "active" | "attention" | "done";

const EMPTY_SNAPSHOT: AutonomySnapshot = { monitors: [], missions: [] };

function fullTime(at?: number | null) {
  return at == null
    ? "Not yet"
    : new Date(at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function monitorStatus(status: MonitorStatus, observation?: MonitorSummary["lastObservation"]) {
  if (observation?.status === "error") return { label: "Needs attention", tone: "text-danger", dot: "bg-danger" };
  if (observation?.status === "changed") return { label: "Change found", tone: "text-accent", dot: "bg-accent" };
  if (status === "active") return { label: "Watching", tone: "text-success", dot: "bg-success" };
  if (status === "paused") return { label: "Paused", tone: "text-warning", dot: "bg-warning" };
  return { label: "Archived", tone: "text-ink-secondary", dot: "bg-ink-secondary/50" };
}

function missionStatus(status: MissionStatus) {
  switch (status) {
    case "running": return { label: "Working", tone: "text-accent", dot: "animate-pulse bg-accent" };
    case "completed": return { label: "Completed", tone: "text-success", dot: "bg-success" };
    case "blocked": return { label: "Needs you", tone: "text-warning", dot: "bg-warning" };
    case "failed": return { label: "Failed", tone: "text-danger", dot: "bg-danger" };
    case "paused": return { label: "Paused", tone: "text-warning", dot: "bg-warning" };
    case "cancelled": return { label: "Cancelled", tone: "text-ink-secondary", dot: "bg-ink-secondary/50" };
    default: return { label: "Ready", tone: "text-ink-secondary", dot: "bg-ink-secondary/60" };
  }
}

function monitorInScope(monitor: MonitorSummary, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "attention") return monitor.lastObservation?.status === "error";
  if (scope === "done") return monitor.status === "archived";
  return monitor.status === "active" || monitor.status === "paused";
}

function missionInScope(mission: MissionSummary, scope: Scope): boolean {
  if (scope === "all") return true;
  const status = mission.status;
  if (scope === "attention") return status === "blocked" || status === "failed";
  if (scope === "done") return status === "completed" || status === "cancelled";
  return status === "draft" || status === "running" || status === "paused";
}

function Owner({ bot }: { bot?: Bot }) {
  return bot ? (
    <div className="flex min-w-0 items-center gap-2">
      <BotAvatar bot={bot} state={bot.busy ? "working" : "idle"} size={34} animated={false} label={bot.name} />
      <span className="truncate text-[12px] font-medium text-ink">{bot.name}</span>
    </div>
  ) : (
    <span className="text-[12px] text-ink-secondary">Former MAUS</span>
  );
}

function WatcherCard({ monitor, bot }: { monitor: MonitorSummary; bot?: Bot }) {
  const status = monitorStatus(monitor.status, monitor.lastObservation);
  const target = monitorTarget(monitor);
  const lastRun = monitor.lastObservation?.observedAt ?? monitor.schedule.lastRunAt;
  return (
    <article className="rounded-2xl border border-hairline/45 bg-panel/80 p-4 shadow-sm shadow-black/5 transition hover:border-hairline/70 hover:bg-panel">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-accent/8 text-accent"><Radar size={19} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold text-ink">{monitor.name}</h3>
              {monitor.description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">{monitor.description}</p>}
            </div>
            <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[10.5px] font-medium", status.tone)}>
              <span className={cn("size-1.5 rounded-full", status.dot)} />{status.label}
            </span>
          </div>
          <a href={target === "Unknown source" ? undefined : target} target="_blank" rel="noreferrer" className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-[11.5px]", target === "Unknown source" ? "text-ink-secondary" : "text-accent hover:underline")}>
            <span className="truncate">{target}</span>{target !== "Unknown source" && <ExternalLink size={11} className="shrink-0" />}
          </a>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-inset/75 px-3 py-2.5"><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Owner</div><div className="mt-1.5"><Owner bot={bot} /></div></div>
        <div className="rounded-xl bg-inset/75 px-3 py-2.5"><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Rhythm</div><div className="mt-1.5 text-[12px] font-medium text-ink">{monitorInterval(monitor.schedule.intervalMinutes)}</div></div>
        <div className="rounded-xl bg-inset/75 px-3 py-2.5" title={fullTime(lastRun)}><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Last check</div><div className="mt-1.5 text-[12px] font-medium text-ink">{relativeTime(lastRun)}</div></div>
        <div className="rounded-xl bg-inset/75 px-3 py-2.5" title={fullTime(monitor.schedule.nextDueAt)}><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Next check</div><div className="mt-1.5 text-[12px] font-medium text-ink">{monitor.status === "active" ? relativeTime(monitor.schedule.nextDueAt) : "—"}</div></div>
      </div>
      {monitor.lastObservation?.error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-danger"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{monitor.lastObservation.error}</span></div>
      ) : monitor.lastObservation ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-secondary">
          {monitor.lastObservation.status === "changed" ? <RefreshCw size={12} className="text-accent" /> : <CheckCircle2 size={12} className="text-success" />}
          {monitor.lastObservation.status === "changed" ? `Change recorded ${relativeTime(monitor.lastObservation.changedAt ?? monitor.lastObservation.observedAt)}` : "Latest check matched the baseline — no notification sent."}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-secondary"><Clock3 size={12} />Waiting for its first check.</div>
      )}
    </article>
  );
}

function MissionCard({ mission, bot }: { mission: MissionSummary; bot?: Bot }) {
  const status = missionStatus(mission.status);
  const progress = missionProgress(mission);
  const latest = latestMissionOutcome(mission);
  const current = mission.workItems.find((item) => item.status === "claimed")
    ?? mission.workItems.find((item) => item.status === "blocked" || item.status === "failed")
    ?? mission.workItems.find((item) => item.status === "pending");
  return (
    <article className="rounded-2xl border border-hairline/45 bg-panel/80 p-4 shadow-sm shadow-black/5 transition hover:border-hairline/70 hover:bg-panel">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-accent/8 text-accent"><Goal size={19} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold text-ink">{mission.title}</h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">{mission.objective}</p>
            </div>
            <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[10.5px] font-medium", status.tone)}><span className={cn("size-1.5 rounded-full", status.dot)} />{status.label}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(150px,0.8fr)_minmax(220px,1.5fr)_minmax(120px,0.7fr)]">
        <div className="rounded-xl bg-inset/75 px-3 py-2.5"><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Lead</div><div className="mt-1.5"><Owner bot={bot} /></div></div>
        <div className="rounded-xl bg-inset/75 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3"><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Progress</div><div className="text-[10.5px] tabular-nums text-ink-secondary">{progress.completed}/{progress.total} steps</div></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress.percent}%` }} /></div>
        </div>
        <div className="rounded-xl bg-inset/75 px-3 py-2.5" title={fullTime(mission.updatedAt)}><div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-secondary/75">Last movement</div><div className="mt-1.5 text-[12px] font-medium text-ink">{relativeTime(mission.updatedAt)}</div></div>
      </div>
      {current && mission.status !== "completed" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-hairline/40 bg-inset/55 px-3 py-2.5">
          {current.status === "claimed" ? <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-accent" /> : current.status === "blocked" || current.status === "failed" ? <CircleAlert size={14} className="mt-0.5 shrink-0 text-warning" /> : <Clock3 size={14} className="mt-0.5 shrink-0 text-ink-secondary" />}
          <div className="min-w-0"><div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-secondary">{current.status === "claimed" ? "Working on" : current.status === "pending" ? "Up next" : "Stopped at"}</div><div className="mt-0.5 text-[12px] text-ink">{current.title}</div></div>
        </div>
      )}
      {latest && (
        <div className={cn("mt-3 rounded-xl border px-3 py-2.5", latest.error ? "border-danger/25 bg-danger/8" : "border-success/20 bg-success/5")}>
          <div className={cn("flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em]", latest.error ? "text-danger" : "text-success")}>{latest.error ? <CircleAlert size={12} /> : <CheckCircle2 size={12} />}{latest.error ? "Latest issue" : "Latest result"}</div>
          <div className={cn("mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed", latest.error ? "text-danger" : "text-ink")}>{latest.error ?? latest.result}</div>
        </div>
      )}
    </article>
  );
}

export function AutonomyPanel({ view, bots }: { view: View; bots: Bot[] }) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [botId, setBotId] = useState("all");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const next = await api("/api/autonomy");
      setSnapshot({ monitors: next.monitors ?? [], missions: next.missions ?? [] });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const watcherItems = useMemo(
    () => snapshot.monitors
      .filter((monitor) => botId === "all" || monitor.botId === botId)
      .filter((monitor) => monitorInScope(monitor, scope))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [botId, scope, snapshot.monitors],
  );
  const missionItems = useMemo(
    () => snapshot.missions
      .filter((mission) => botId === "all" || mission.leadAgentId === botId)
      .filter((mission) => missionInScope(mission, scope))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [botId, scope, snapshot.missions],
  );

  const items = view === "watchers" ? watcherItems : missionItems;
  const activeCount = view === "watchers"
    ? snapshot.monitors.filter((monitor) => monitorInScope(monitor, "active")).length
    : snapshot.missions.filter((mission) => missionInScope(mission, "active")).length;
  const attentionCount = view === "watchers"
    ? snapshot.monitors.filter((monitor) => monitorInScope(monitor, "attention")).length
    : snapshot.missions.filter((mission) => missionInScope(mission, "attention")).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-hairline/35">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline/35 px-5 py-3">
        <div className="flex rounded-xl bg-panel p-1">
          {(["all", "active", "attention", "done"] as const).map((value) => (
            <button key={value} onClick={() => setScope(value)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium capitalize", scope === value ? "bg-raised text-ink shadow" : "text-ink-secondary hover:text-ink")}>{value}{value === "active" && activeCount > 0 ? ` ${activeCount}` : value === "attention" && attentionCount > 0 ? ` ${attentionCount}` : ""}</button>
          ))}
        </div>
        <select value={botId} onChange={(event) => setBotId(event.target.value)} className="rounded-xl border border-hairline/50 bg-panel px-3 py-2 text-[11.5px] text-ink outline-none focus:border-accent/60">
          <option value="all">All MAUSes</option>
          {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>
        <button onClick={() => void load()} disabled={refreshing} className="ml-auto rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-50" aria-label="Refresh autonomy activity" title="Refresh"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {error && <div className="mb-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/8 px-3 py-2.5 text-[12px] text-danger"><CircleAlert size={14} className="mt-0.5 shrink-0" />{error}</div>}
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-ink-secondary"><Loader2 size={15} className="animate-spin" />Loading autonomous work…</div>
        ) : items.length > 0 ? (
          <div className="mx-auto grid max-w-[1100px] gap-3">
            {view === "watchers"
              ? watcherItems.map((monitor) => <WatcherCard key={monitor.id} monitor={monitor} bot={bots.find((bot) => bot.id === monitor.botId)} />)
              : missionItems.map((mission) => <MissionCard key={mission.id} mission={mission} bot={bots.find((bot) => bot.id === mission.leadAgentId)} />)}
          </div>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center px-5 text-center">
            <div className="max-w-[440px]">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-accent/15 bg-accent/8 text-accent">{view === "watchers" ? <Radar size={28} /> : <Goal size={28} />}</div>
              <h2 className="mt-4 text-[17px] font-semibold text-ink">{scope === "all" ? (view === "watchers" ? "Nothing is watching yet" : "No missions yet") : `No ${scope} ${view}`}</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">{scope === "all" ? (view === "watchers" ? <>Tell any MAUS: <span className="text-ink">“Watch this page and tell me when it changes.”</span> It will arm the watcher for you.</> : <>Tell any MAUS: <span className="text-ink">“Make this a mission, keep working, and update me when useful.”</span></>) : "Try another status or MAUS filter."}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

