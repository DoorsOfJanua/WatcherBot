#!/usr/bin/env node
/**
 * One compact audit for Janua's personal automation surface.
 * Durable WatcherBot routines are authoritative for reminders; macOS cron and
 * LaunchAgents are reported as external jobs so failures cannot look like
 * successful personal reminders.
 */
import { execFileSync } from "node:child_process";

const base = process.env.MYAGENT_ROOM_URL ?? "http://127.0.0.1:8799";
const today = new Date().toISOString().slice(0, 10);

const run = (command, args = []) => {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    return `unavailable: ${error?.status ?? error?.message ?? "unknown error"}`;
  }
};

let payload;
try {
  const response = await fetch(`${base}/api/routines`);
  if (!response.ok) throw new Error(`WatcherBot API ${response.status}`);
  payload = await response.json();
} catch (error) {
  console.error(`WatcherBot routines unavailable: ${error.message}`);
  process.exitCode = 1;
  payload = { routines: [], runs: [] };
}

const routines = (payload.routines ?? []).map((routine) => ({
  name: routine.name,
  botId: routine.botId,
  enabled: routine.enabled,
  schedule: routine.schedule,
  nextRunAt: routine.nextRunAt ? new Date(routine.nextRunAt).toISOString() : null,
  todayRuns: (payload.runs ?? [])
    .filter((run) => run.routineId === routine.id && new Date(run.scheduledFor).toISOString().slice(0, 10) === today)
    .map((run) => ({ status: run.status, trigger: run.triggerSource, error: run.error ?? null })),
}));

const cron = run("crontab", ["-l"]);
const launchAgents = [
  "com.janua.sakshi-morning",
  "com.janua.sakshi-evening",
  "com.doorsofjanua.lifeos",
  "com.doorsofjanua.daily-research",
].map((label) => {
  const output = run("launchctl", ["print", `gui/${process.getuid?.() ?? ""}/${label}`]);
  return {
    label,
    state: output.match(/state = ([^\n]+)/)?.[1] ?? "unknown",
    lastExit: output.match(/last exit code = ([^\n]+)/)?.[1] ?? "unknown",
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), durableRoutines: routines, external: { cronInstalled: !cron.startsWith("unavailable"), launchAgents } }, null, 2));
