export type MonitorStatus = "active" | "paused" | "archived";
export type MonitorObservationStatus = "ok" | "changed" | "error";

export interface MonitorSummary {
  id: string;
  botId: string;
  threadId: string;
  name: string;
  description?: string;
  status: MonitorStatus;
  source: { kind?: string; url?: string };
  schedule: { intervalMinutes: number; nextDueAt: number | null; lastRunAt?: number };
  baseline?: { capturedAt?: number; fingerprint?: string };
  lastObservation?: {
    observedAt?: number;
    changedAt?: number;
    status?: MonitorObservationStatus;
    error?: string;
  };
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

export type MissionStatus = "draft" | "running" | "paused" | "completed" | "blocked" | "failed" | "cancelled";
export type WorkItemStatus = "pending" | "claimed" | "completed" | "blocked" | "failed" | "cancelled";

export interface MissionWorkItem {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: WorkItemStatus;
  attempts: number;
  result?: string;
  error?: string;
  updatedAt: number;
  completedAt?: number;
}

export interface MissionSummary {
  id: string;
  title: string;
  leadAgentId: string;
  ownerThreadId: string;
  objective: string;
  status: MissionStatus;
  workItems: MissionWorkItem[];
  createdAt: number;
  updatedAt: number;
}

export interface AutonomySnapshot {
  monitors: MonitorSummary[];
  missions: MissionSummary[];
}

export interface MissionProgress {
  completed: number;
  total: number;
  percent: number;
}

export function monitorTarget(monitor: MonitorSummary): string {
  return monitor.source.url ?? "Unknown source";
}

export function monitorInterval(minutes: number): string {
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? "Every day" : `Every ${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  return `Every ${minutes} min`;
}

export function missionProgress(mission: MissionSummary): MissionProgress {
  const total = mission.workItems.length;
  const completed = mission.workItems.filter((item) => item.status === "completed").length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export function latestMissionOutcome(mission: MissionSummary): MissionWorkItem | undefined {
  return mission.workItems
    .filter((item) => item.result || item.error)
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))[0];
}

export function relativeTime(at: number | null | undefined, now = Date.now()): string {
  if (at == null || !Number.isFinite(at)) return "Not yet";
  const deltaMinutes = Math.round((at - now) / 60_000);
  const future = deltaMinutes > 0;
  const minutes = Math.abs(deltaMinutes);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `in ${hours} hr` : `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days} d` : `${days} d ago`;
}
