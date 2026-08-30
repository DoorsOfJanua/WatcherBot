// WatcherBot workspace MCP proxy — spawned as an MCP server inside a bot's
// agent process (via the "agents" integration). Exposes fleet tools, durable
// routine tools, plus Mailman's exact-draft proposal tool when the harness
// enables it. They
// let one bot talk to another, routed back through the harness so the
// harness stays the single owner of turns, permissions, and recursion
// limits:
//
//   list_bots()                          → the other bots in this workspace + their status
//   ask_bot(bot_id, msg)                 → send msg to that bot, wait, return its reply
//   delegate_bot(bot_id, msg, reason?)   → hand the task to a peer ASYNC: returns
//                                          immediately, the peer runs after your
//                                          current turn finishes, the user sees
//                                          the peer's reply as its own turn
//   list_routines()                      → this bot's durable WatcherBot routines
//   create_routine(...)                  → create a restart-safe reminder/job
//   set_routine_enabled(id, enabled)     → pause or resume one of this bot's jobs
//   delete_routine(id)                   → remove one of this bot's jobs
//
// Speaks raw JSON-RPC 2.0 over stdio (no MCP SDK — house style, matches
// computer-proxy / permission-proxy). All state comes from env, injected by
// the harness when it builds the integration:
//   OMB_HARNESS_URL  base URL of the harness (http://127.0.0.1:8799)
//   OMB_BOT_ID       the calling bot's id (excluded from list_bots; sender)
//   OMB_COMMS_TOKEN  shared secret for the localhost-only internal endpoints
//   OMB_TURN_DEPTH   this turn's comms depth (the harness refuses recursion)
import { request as httpRequest } from "node:http";
import readline from "node:readline";

const HARNESS = process.env.OMB_HARNESS_URL ?? "http://127.0.0.1:8799";
const BOT_ID = process.env.OMB_BOT_ID ?? "";
const THREAD_ID = process.env.OMB_THREAD_ID ?? "";
const TOKEN = process.env.OMB_COMMS_TOKEN ?? "";
const DEPTH = Number(process.env.OMB_TURN_DEPTH ?? "0") || 0;
const CAN_STAGE_EMAIL = process.env.OMB_CAN_STAGE_EMAIL === "1";
const MAX_NAME = 160;
const MAX_TEXT = 4_000;
const MAX_ID = 200;
const bounded = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const ownBody = (args: Json = {}): Json => ({ ...args, botId: BOT_ID, threadId: THREAD_ID });
const resourceId = (args: Json, key: string) => bounded(args[key], MAX_ID);
const resourceTool = (name: string, description: string, properties: Json, required: string[] = []) => ({ name, description, inputSchema: { type: "object", properties, required } });

const TOOLS = [
  {
    name: "list_bots",
    description:
      "List the other bots (agents) in this WatcherBot Room workspace you can message, with their model and whether they're busy. Call this before ask_bot to discover who's available.",
    inputSchema: { type: "object", properties: {} },
  },
  resourceTool("list_monitors", "List monitors owned by this bot and thread.", {}, []),
  resourceTool("create_monitor", "Create a restart-safe monitor owned by this bot. Use webpage for an HTTP(S) page. The first check establishes a quiet baseline; later meaningful changes can notify the user.", {
    name: { type: "string", maxLength: MAX_NAME },
    description: { type: "string", maxLength: MAX_TEXT },
    source_kind: { type: "string", enum: ["webpage"] },
    target: { type: "string", maxLength: 2_048, description: "The full HTTP(S) URL to watch." },
    interval_minutes: { type: "integer", minimum: 5, maximum: 43_200 },
  }, ["name", "source_kind", "target"]),
  resourceTool("pause_monitor", "Pause one of this bot's monitors.", { monitor_id: { type: "string", maxLength: MAX_ID } }, ["monitor_id"]),
  resourceTool("resume_monitor", "Resume one of this bot's monitors.", { monitor_id: { type: "string", maxLength: MAX_ID } }, ["monitor_id"]),
  resourceTool("archive_monitor", "Archive one of this bot's monitors.", { monitor_id: { type: "string", maxLength: MAX_ID } }, ["monitor_id"]),
  resourceTool("list_missions", "List missions owned by this bot and thread.", {}, []),
  resourceTool("create_mission", "Create a bounded mission owned by this bot and thread.", { name: { type: "string", maxLength: MAX_NAME }, objective: { type: "string", maxLength: MAX_TEXT } }, ["name", "objective"]),
  resourceTool("start_mission", "Start one of this bot's missions.", { mission_id: { type: "string", maxLength: MAX_ID } }, ["mission_id"]),
  resourceTool("pause_mission", "Pause one of this bot's missions.", { mission_id: { type: "string", maxLength: MAX_ID } }, ["mission_id"]),
  resourceTool("resume_mission", "Resume one of this bot's missions.", { mission_id: { type: "string", maxLength: MAX_ID } }, ["mission_id"]),
  resourceTool("cancel_mission", "Cancel one of this bot's missions.", { mission_id: { type: "string", maxLength: MAX_ID } }, ["mission_id"]),
  {
    name: "ask_bot",
    description:
      "Send a message to another bot in this workspace and wait for its reply. Use it to delegate a subtask to a specialist bot or ask a peer a question. The other bot runs a full turn under its own model and permissions; the reply is returned to you as text. Returns promptly with a note if that bot is busy.",
    inputSchema: {
      type: "object",
      properties: {
        bot_id: { type: "string", description: "The target bot's id (from list_bots)." },
        message: { type: "string", description: "What to say / ask the bot." },
      },
      required: ["bot_id", "message"],
    },
  },
  {
    name: "delegate_bot",
    description:
      "Hand a task to another bot ASYNCHRONOUSLY: returns immediately and the peer runs after your current turn finishes. Use this when you want to keep working or hand off a long-running subtask without waiting. The user sees the peer's reply as its own turn; you do NOT receive the reply inline.",
    inputSchema: {
      type: "object",
      properties: {
        bot_id: { type: "string", description: "The target bot's id (from list_bots)." },
        message: { type: "string", description: "What the peer should do / answer." },
        reason: { type: "string", description: "Optional one-line reason for the delegation (shown to the user as a chip)." },
      },
      required: ["bot_id", "message"],
    },
  },
  {
    name: "list_routines",
    description:
      "List your durable WatcherBot routines, including their ids, schedules, enabled state, and next run. These survive agent sessions and app restarts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_routine",
    description:
      "Create a durable WatcherBot reminder or recurring job for yourself. Use this when the user asks for ongoing follow-through (for example, check-ins during the day), or on your own initiative when a later check materially advances your assigned role or an open commitment. It survives agent sessions and app restarts; do not use provider-local Cron tools. List existing routines first, keep notifications sparse, and tell the user what you armed.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short user-facing routine name." },
        prompt: { type: "string", description: "Exact instructions you should execute when the routine wakes you." },
        schedule_type: { type: "string", enum: ["once", "daily", "interval"] },
        at_iso: { type: "string", description: "For once: ISO 8601 date-time with an explicit timezone." },
        time: { type: "string", description: "For daily: local wall-clock HH:MM." },
        weekdays: {
          type: "array",
          items: { type: "integer", minimum: 0, maximum: 6 },
          description: "Local weekdays, Sunday=0 through Saturday=6. Omit for every day.",
        },
        every_minutes: { type: "integer", minimum: 5, maximum: 1440, description: "For interval schedules." },
        start: { type: "string", description: "Optional interval window start, local HH:MM." },
        end: { type: "string", description: "Optional interval window end, local HH:MM." },
        duration_minutes: { type: "integer", minimum: 15, maximum: 240 },
      },
      required: ["name", "prompt", "schedule_type"],
    },
  },
  {
    name: "set_routine_enabled",
    description: "Pause or resume one of your durable WatcherBot routines by id.",
    inputSchema: {
      type: "object",
      properties: {
        routine_id: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["routine_id", "enabled"],
    },
  },
  {
    name: "delete_routine",
    description: "Delete one of your durable WatcherBot routines by id when the user asks, or when you can verify it is obsolete or duplicated.",
    inputSchema: {
      type: "object",
      properties: { routine_id: { type: "string" } },
      required: ["routine_id"],
    },
  },
  ...(CAN_STAGE_EMAIL ? [{
    name: "propose_email_draft",
    description:
      "Stage one exact email draft for Janua to review on desktop or phone. This NEVER sends. The harness freezes From/To/Cc/Bcc/Subject/body, shows an approval card, and only sends that exact copy after Janua taps Approve & send. Use fromAccount nils.palmen@protonmail.com; attachments must be an empty list.",
    inputSchema: {
      type: "object",
      properties: {
        fromAccount: { type: "string" },
        to: { type: "array", items: { type: "string" } },
        cc: { type: "array", items: { type: "string" } },
        bcc: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        body: { type: "string" },
        attachments: { type: "array", maxItems: 0 },
      },
      required: ["fromAccount", "to", "cc", "bcc", "subject", "body", "attachments"],
    },
  }] : []),
];

type Json = Record<string, unknown>;
const send = (msg: Json) => process.stdout.write(JSON.stringify(msg) + "\n");
const ok = (id: unknown, result: unknown) => send({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
const textResult = (id: unknown, text: string, isError = false) =>
  ok(id, { content: [{ type: "text", text }], isError });

async function api(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(HARNESS + path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}`, ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(String(body.error ?? `HTTP ${res.status}`));
  return body;
}

/** POST that may legitimately wait many minutes for its response — the
 * outer hop of a deep ask_bot chain outlives global fetch's built-in
 * 5-minute undici headersTimeout. Loopback only, so plain node:http with
 * no socket timeout is the correct transport, not a bigger fetch timeout. */
function longPost(path: string, body: Json): Promise<Json> {
  return new Promise((resolve, reject) => {
    const url = new URL(HARNESS + path);
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed: Json = {};
          try {
            parsed = JSON.parse(data) as Json;
          } catch {
            /* non-JSON body — treated as empty, status decides below */
          }
          if ((res.statusCode ?? 500) >= 400) reject(new Error(String(parsed.error ?? `HTTP ${res.statusCode}`)));
          else resolve(parsed);
        });
      },
    );
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

async function callTool(name: string, args: Json): Promise<{ text: string; isError?: boolean }> {
  if (name === "list_bots") {
    const r = await api(`/api/internal/agents?self=${encodeURIComponent(BOT_ID)}`);
    const bots = (r.bots as Array<Json>) ?? [];
    if (!bots.length) return { text: "No other bots in this workspace yet." };
    const lines = bots.map((b) => {
      const role = b.title ? ` — ${b.title}` : "";
      const about = b.description ? ` (${String(b.description).slice(0, 120)})` : "";
      return `- ${b.name}${role}${about} [id: ${b.id}, model: ${b.model}${b.busy ? ", busy" : ""}]`;
    });
    return { text: `Other bots you can message with ask_bot:\n${lines.join("\n")}` };
  }
  if (name === "ask_bot") {
    const toBotId = String(args.bot_id ?? "").trim();
    const message = String(args.message ?? "").trim();
    if (!toBotId || !message) return { text: "ask_bot needs bot_id and message.", isError: true };
    const r = await longPost(`/api/internal/ask-bot`, {
      fromBotId: BOT_ID,
      fromThreadId: THREAD_ID,
      toBotId,
      message,
      depth: DEPTH,
    });
    if (r.busy) return { text: `That bot is busy right now — try again after it finishes.` };
    if (r.error) return { text: `Couldn't reach that bot: ${r.error}`, isError: true };
    return { text: `${r.botName ?? "Bot"} replied:\n${r.text ?? "(no reply)"}` };
  }
  if (name === "delegate_bot") {
    const toBotId = String(args.bot_id ?? "").trim();
    const message = String(args.message ?? "").trim();
    const reason = typeof args.reason === "string" ? args.reason.trim() : "";
    if (!toBotId || !message) return { text: "delegate_bot needs bot_id and message.", isError: true };
    const body: Record<string, unknown> = {
      fromBotId: BOT_ID,
      fromThreadId: THREAD_ID,
      toBotId,
      message,
      depth: DEPTH,
    };
    if (reason) body.reason = reason;
    const r = await api(`/api/internal/delegate-bot`, { method: "POST", body: JSON.stringify(body) });
    if (r.error) return { text: `Couldn't queue the delegation: ${r.error}`, isError: true };
    // Fire-and-forget by contract: the harness returns immediately, the
    // peer turn runs after our current turn finishes.
    return { text: typeof r.message === "string" ? r.message : "Delegation queued." };
  }
  if (name === "list_monitors" || name === "list_missions") {
    const kind = name.slice(5);
    const r = await api(`/api/internal/${kind}?botId=${encodeURIComponent(BOT_ID)}&threadId=${encodeURIComponent(THREAD_ID)}`);
    const items = (r[ kind ] as Json[]) ?? (r.items as Json[]) ?? [];
    if (!items.length) return { text: `No ${kind} owned by this agent.` };
    return { text: `${kind[0].toUpperCase() + kind.slice(1)}:\n${items.map((item) => `- ${bounded(item.name ?? item.title ?? item.id, MAX_NAME)} [id: ${bounded(item.id, MAX_ID)}, ${bounded(item.status, 40) || "active"}]`).join("\n")}` };
  }
  const monitorAction: Record<string, string> = { pause_monitor: "pause", resume_monitor: "resume", archive_monitor: "archive" };
  const missionAction: Record<string, string> = { start_mission: "start", pause_mission: "pause", resume_mission: "resume", cancel_mission: "cancel" };
  const action = monitorAction[name] ?? missionAction[name];
  if (action) {
    const kind = monitorAction[name] ? "monitors" : "missions";
    const key = kind === "monitors" ? "monitor_id" : "mission_id";
    const id = resourceId(args, key);
    if (!id) return { text: `${name} needs ${key}.`, isError: true };
    const r = await api(`/api/internal/${kind}/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify(ownBody()) });
    const past = action === "start" ? "started" : action === "archive" ? "archived" : action === "pause" ? "paused" : action === "cancel" ? "cancelled" : "resumed";
    return { text: `${kind.slice(0, -1)} ${bounded(r.name ?? (r.item as Json | undefined)?.name ?? id, MAX_NAME)} ${past}.` };
  }
  if (name === "create_monitor" || name === "create_mission") {
    const kind = name === "create_monitor" ? "monitors" : "missions";
    const required = name === "create_monitor" ? "name" : "objective";
    const value = bounded(args[required], MAX_TEXT);
    if (!value || (name === "create_monitor" && value.length > MAX_NAME)) return { text: `${name} needs a bounded ${required}.`, isError: true };
    let resource: Json;
    if (name === "create_monitor") {
      const target = bounded(args.target, 2_048);
      const sourceKind = bounded(args.source_kind, 40);
      if (sourceKind !== "webpage" || !/^https?:\/\//i.test(target)) {
        return { text: "create_monitor currently needs source_kind webpage and a full HTTP(S) target.", isError: true };
      }
      resource = {
        name: value,
        description: bounded(args.description, MAX_TEXT),
        sourceKind,
        target,
        intervalMinutes: args.interval_minutes == null ? 60 : Number(args.interval_minutes),
      };
    } else {
      resource = { title: bounded(args.name, MAX_NAME), objective: value };
    }
    const body = ownBody(resource);
    const r = await api(`/api/internal/${kind}`, { method: "POST", body: JSON.stringify(body) });
    const item = (r[kind.slice(0, -1)] ?? r.item ?? r) as Json;
    return { text: `${kind.slice(0, -1)} created: ${bounded(item.name ?? item.id, MAX_NAME)} [id: ${bounded(item.id, MAX_ID)}].` };
  }
  if (name === "list_routines") {
    const r = await api(
      `/api/internal/routines?botId=${encodeURIComponent(BOT_ID)}&threadId=${encodeURIComponent(THREAD_ID)}`,
    );
    const routines = (r.routines as Array<Json>) ?? [];
    if (!routines.length) return { text: "You have no durable WatcherBot routines." };
    const lines = routines.map((routine) => {
      const next = routine.nextRunAt ? new Date(Number(routine.nextRunAt)).toISOString() : "none";
      return `- ${String(routine.name)} [id: ${String(routine.id)}, ${routine.enabled ? "enabled" : "paused"}, next: ${next}, schedule: ${JSON.stringify(routine.schedule)}]`;
    });
    return { text: `Your durable WatcherBot routines:\n${lines.join("\n")}` };
  }
  if (name === "create_routine") {
    const scheduleType = String(args.schedule_type ?? "");
    const weekdays = Array.isArray(args.weekdays) ? args.weekdays : [0, 1, 2, 3, 4, 5, 6];
    let schedule: Json;
    if (scheduleType === "once") {
      const at = Date.parse(String(args.at_iso ?? ""));
      if (!Number.isFinite(at)) return { text: "A one-time routine needs at_iso with an explicit timezone.", isError: true };
      schedule = { type: "once", at };
    } else if (scheduleType === "daily") {
      schedule = { type: "daily", time: String(args.time ?? ""), weekdays };
    } else if (scheduleType === "interval") {
      schedule = {
        type: "interval",
        everyMinutes: Number(args.every_minutes),
        weekdays,
        ...(args.start ? { start: String(args.start) } : {}),
        ...(args.end ? { end: String(args.end) } : {}),
      };
    } else {
      return { text: "schedule_type must be once, daily, or interval.", isError: true };
    }
    const r = await api("/api/internal/routines", {
      method: "POST",
      body: JSON.stringify({
        fromBotId: BOT_ID,
        fromThreadId: THREAD_ID,
        name: String(args.name ?? ""),
        prompt: String(args.prompt ?? ""),
        schedule,
        durationMinutes: args.duration_minutes == null ? undefined : Number(args.duration_minutes),
      }),
    });
    const routine = r.routine as Json;
    const next = routine.nextRunAt ? new Date(Number(routine.nextRunAt)).toISOString() : "not scheduled";
    return {
      text: `${r.deduplicated ? "Matching durable routine already armed" : "Durable routine created"}: ${String(routine.name)} [id: ${String(routine.id)}]. Next run: ${next}. It will wake you through WatcherBot even when this agent session is asleep.`,
    };
  }
  if (name === "set_routine_enabled") {
    const routineId = String(args.routine_id ?? "").trim();
    if (!routineId) return { text: "set_routine_enabled needs routine_id.", isError: true };
    const r = await api(`/api/internal/routines/${encodeURIComponent(routineId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        fromBotId: BOT_ID,
        fromThreadId: THREAD_ID,
        enabled: args.enabled === true,
      }),
    });
    const routine = r.routine as Json;
    return { text: `${String(routine.name)} is now ${routine.enabled ? "enabled" : "paused"}.` };
  }
  if (name === "delete_routine") {
    const routineId = String(args.routine_id ?? "").trim();
    if (!routineId) return { text: "delete_routine needs routine_id.", isError: true };
    const r = await api(`/api/internal/routines/${encodeURIComponent(routineId)}`, {
      method: "DELETE",
      body: JSON.stringify({ fromBotId: BOT_ID, fromThreadId: THREAD_ID }),
    });
    return { text: `Deleted durable routine ${String(r.name ?? routineId)}.` };
  }
  if (name === "propose_email_draft" && CAN_STAGE_EMAIL) {
    const r = await api("/api/internal/mail-drafts", {
      method: "POST",
      body: JSON.stringify({ fromBotId: BOT_ID, fromThreadId: THREAD_ID, draft: args }),
    });
    return {
      text: `Exact draft staged for Janua's approval (receipt ${String(r.receiptId)}). Nothing was sent. Do not send through another tool or modify this receipt; create a new proposal for any edit.`,
    };
  }
  return { text: `Unknown tool: ${name}`, isError: true };
}

async function handle(msg: Json) {
  const id = msg.id;
  const method = msg.method as string | undefined;
  if (!method) return;
  const params = (msg.params ?? {}) as Json;
  switch (method) {
    case "initialize":
      ok(id, {
        protocolVersion: (params.protocolVersion as string) ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "opengrokbot-agents", version: "0.1.0" },
      });
      return;
    case "notifications/initialized":
    case "notifications/cancelled":
      return;
    case "ping":
      ok(id, {});
      return;
    case "tools/list":
      ok(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params.name as string;
      if (!TOOLS.some((t) => t.name === name)) return rpcErr(id, -32602, `Unknown tool: ${name}`);
      try {
        const { text, isError } = await callTool(name, (params.arguments ?? {}) as Json);
        textResult(id, text, isError);
      } catch (e) {
        textResult(id, (e as Error).message, true);
      }
      return;
    }
    default:
      if (id !== undefined) rpcErr(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  let msg: Json;
  try {
    msg = JSON.parse(t) as Json;
  } catch {
    return;
  }
  void handle(msg).catch((e) => {
    if (msg.id !== undefined) rpcErr(msg.id, -32603, (e as Error).message);
  });
});
rl.on("close", () => process.exit(0));
