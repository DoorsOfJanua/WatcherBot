export type RoutineSchedule =
  | { type: "once"; at: number }
  | { type: "daily"; time: string; weekdays: number[] }
  | { type: "interval"; everyMinutes: number; start?: string; end?: string; weekdays: number[] };

export type RoutineRunOn = "maus" | "cloud";

export type RoutineRunTrigger = "schedule" | "manual" | "webhook";

export type RoutineRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled"
  | "missed";

export interface Routine {
  id: string;
  name: string;
  prompt: string;
  botId: string;
  runOn: RoutineRunOn;
  enabled: boolean;
  schedule: RoutineSchedule;
  durationMinutes: number;
  precheck?: RoutinePrecheck;
  precheckState?: string;
  modelSelection?: { instanceId: string; model: string; effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max" };
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineRun {
  id: string;
  routineId: string;
  routineName: string;
  prompt?: string;
  durationMinutes?: number;
  botId: string;
  runOn: RoutineRunOn;
  scheduledFor: number;
  status: RoutineRunStatus;
  manual: boolean;
  triggerSource?: RoutineRunTrigger;
  webhookId?: string;
  deliveryId?: string;
  threadId?: string;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  error?: string;
  precheckNote?: string;
  modelSelection?: Routine["modelSelection"];
  cost?: number | null;
  denials?: string[];
  createdAt: number;
  seenAt?: number;
}

export interface RoutineInput {
  name: string;
  prompt: string;
  botId: string;
  runOn?: RoutineRunOn;
  enabled?: boolean;
  schedule: RoutineSchedule;
  durationMinutes?: number;
  precheck?: RoutinePrecheck;
  modelSelection?: Routine["modelSelection"];
}

export type RoutinePrecheck =
  | { kind: "http"; url: string; jsonPath?: string }
  | { kind: "command"; command: string };
