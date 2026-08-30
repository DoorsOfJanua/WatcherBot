// Contract test for the agent-to-agent comms MCP proxy (agents-proxy.ts):
// spawn it exactly the way a driver's mcpServers entry does (process.execPath
// + entry file + env) against a scripted stub of the harness's /api/internal
// endpoints, and drive the MCP stdio surface end to end. No shebang, no
// shell — plain node child, so this runs on every OS like index.test.ts.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROXY = join(dirname(fileURLToPath(import.meta.url)), "agents-proxy.ts");
const TOKEN = "test-comms-token";

// scripted harness stub
let stub: Server;
let stubPort = 0;
let lastAuth: string | undefined;
let lastAskBody: any = null;
let askResponse: unknown = { botName: "Helper", text: "hi from helper" };
let lastDelegateBody: any = null;
let delegateResponse: unknown = { queued: true, message: "Delegation queued." };
let lastRoutineBody: any = null;
let lastRoutineMethod = "";
let lastAutonomyBody: any = null;
let lastAutonomyPath = "";

let child: ChildProcess;
const pending = new Map<number, (msg: any) => void>();
let nextId = 100;

function rpc(method: string, params?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, 10_000).unref?.();
  });
}
const callTool = (name: string, args: unknown) => rpc("tools/call", { name, arguments: args });

beforeAll(async () => {
  stub = createServer((req, res) => {
    lastAuth = req.headers.authorization;
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    if (req.method === "GET" && req.url?.startsWith("/api/internal/agents")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          bots: [{ id: "bot-helper", name: "Helper", model: "fake-model", busy: false }],
        }),
      );
    }
    if (req.method === "GET" && req.url?.startsWith("/api/internal/routines")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        routines: [{ id: "routine-1", name: "Morning bell", enabled: true, nextRunAt: Date.UTC(2026, 7, 27, 7), schedule: { type: "daily", time: "08:00", weekdays: [1, 2, 3, 4, 5] } }],
      }));
    }
    if (req.url === "/api/internal/routines" && req.method === "POST") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastRoutineMethod = req.method ?? "";
        lastRoutineBody = JSON.parse(data);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ routine: { id: "routine-new", name: lastRoutineBody.name, enabled: true, nextRunAt: Date.UTC(2026, 7, 27, 7) } }));
      });
      return;
    }
    if (req.url === "/api/internal/routines/routine-1" && (req.method === "PATCH" || req.method === "DELETE")) {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastRoutineMethod = req.method ?? "";
        lastRoutineBody = JSON.parse(data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(req.method === "DELETE"
          ? { ok: true, name: "Morning bell" }
          : { routine: { id: "routine-1", name: "Morning bell", enabled: lastRoutineBody.enabled } }));
      });
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/api/internal/monitors")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ monitors: [{ id: "monitor-1", name: "Front page", status: "active" }] }));
    }
    if (req.method === "GET" && req.url?.startsWith("/api/internal/missions")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ missions: [{ id: "mission-1", title: "Finish Volume 1", status: "draft" }] }));
    }
    if (req.method === "POST" && req.url && /^\/api\/internal\/(monitors|missions)(?:\/[^/]+\/[^/]+)?$/.test(req.url)) {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastAutonomyPath = req.url ?? "";
        lastAutonomyBody = data ? JSON.parse(data) : {};
        const isMonitor = req.url?.includes("/monitors");
        const id = isMonitor ? "monitor-new" : "mission-new";
        const name = isMonitor ? lastAutonomyBody.name : lastAutonomyBody.title;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          name,
          item: { id, name, title: name },
          ...(isMonitor ? { monitor: { id, name } } : { mission: { id, title: name } }),
        }));
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/internal/ask-bot") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastAskBody = JSON.parse(data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(askResponse));
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/internal/delegate-bot") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastDelegateBody = JSON.parse(data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(delegateResponse));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unknown" }));
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  stubPort = (stub.address() as { port: number }).port;

  child = spawn(process.execPath, [PROXY], {
    env: {
      ...process.env,
      OMB_HARNESS_URL: `http://127.0.0.1:${stubPort}`,
      OMB_BOT_ID: "bot-asker",
      OMB_THREAD_ID: "thread-asker-routine",
      OMB_COMMS_TOKEN: TOKEN,
      OMB_TURN_DEPTH: "0",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  let buf = "";
  child.stdout!.on("data", (c) => {
    buf += c;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }
  });
});

afterAll(async () => {
  child?.kill();
  await new Promise<void>((r) => stub.close(() => r()));
});

describe("agents-proxy MCP surface", () => {
  it("answers the MCP handshake and lists peer plus durable routine tools", async () => {
    const init = await rpc("initialize", { protocolVersion: "2024-11-05" });
    expect(init.result.serverInfo.name).toContain("agents");
    const list = await rpc("tools/list");
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "list_bots",
      "list_monitors",
      "create_monitor",
      "pause_monitor",
      "resume_monitor",
      "archive_monitor",
      "list_missions",
      "create_mission",
      "start_mission",
      "pause_mission",
      "resume_mission",
      "cancel_mission",
      "ask_bot",
      "delegate_bot",
      "list_routines",
      "create_routine",
      "set_routine_enabled",
      "delete_routine",
    ]);
  });

  it("list_bots renders the roster and authenticates with the shared token", async () => {
    const res = await callTool("list_bots", {});
    const text = res.result.content[0].text;
    expect(text).toContain("Helper");
    expect(text).toContain("bot-helper");
    expect(lastAuth).toBe(`Bearer ${TOKEN}`);
  });

  it("ask_bot forwards sender + depth and returns the reply", async () => {
    askResponse = { botName: "Helper", text: "hi from helper" };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.content[0].text).toContain("Helper replied:");
    expect(res.result.content[0].text).toContain("hi from helper");
    expect(lastAskBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      toBotId: "bot-helper",
      message: "ping",
      depth: 0,
    });
  });

  it("renders a busy peer as a clean answer, not an error", async () => {
    askResponse = { busy: true };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.content[0].text).toContain("busy");
    expect(res.result.isError).toBeFalsy();
  });

  it("surfaces the harness's depth refusal as a tool error", async () => {
    askResponse = { error: "message chains are limited to one hop" };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("one hop");
  });

  it("forwards the source thread when queueing a delegation", async () => {
    delegateResponse = { queued: true, message: "Delegation queued." };
    const res = await callTool("delegate_bot", {
      bot_id: "bot-helper",
      message: "take this",
      reason: "follow-up",
    });
    expect(res.result.content[0].text).toContain("Delegation queued");
    expect(lastDelegateBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      toBotId: "bot-helper",
      message: "take this",
      reason: "follow-up",
      depth: 0,
    });
  });

  it("returns queue refusal guidance to the agent as a tool error", async () => {
    delegateResponse = { error: "delegation chains are limited to one hop — do this one yourself" };
    const res = await callTool("delegate_bot", { bot_id: "bot-helper", message: "take this" });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("do this one yourself");
  });

  it("lists and creates restart-safe WatcherBot routines for the calling bot", async () => {
    const listed = await callTool("list_routines", {});
    expect(listed.result.content[0].text).toContain("Morning bell");
    expect(listed.result.content[0].text).toContain("routine-1");

    const created = await callTool("create_routine", {
      name: "Training bell",
      prompt: "Ask whether the iron moved.",
      schedule_type: "daily",
      time: "13:30",
      weekdays: [1, 2, 3, 4, 5],
      duration_minutes: 15,
    });
    expect(created.result.content[0].text).toContain("Durable routine created");
    expect(lastRoutineMethod).toBe("POST");
    expect(lastRoutineBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      name: "Training bell",
      prompt: "Ask whether the iron moved.",
      schedule: { type: "daily", time: "13:30", weekdays: [1, 2, 3, 4, 5] },
      durationMinutes: 15,
    });
  });

  it("pauses and deletes only through the durable routine endpoints", async () => {
    const paused = await callTool("set_routine_enabled", { routine_id: "routine-1", enabled: false });
    expect(paused.result.content[0].text).toContain("paused");
    expect(lastRoutineMethod).toBe("PATCH");
    expect(lastRoutineBody).toMatchObject({ fromBotId: "bot-asker", enabled: false });

    const deleted = await callTool("delete_routine", { routine_id: "routine-1" });
    expect(deleted.result.content[0].text).toContain("Deleted durable routine");
    expect(lastRoutineMethod).toBe("DELETE");
    expect(lastRoutineBody).toMatchObject({ fromBotId: "bot-asker" });
  });

  it("creates a webpage monitor with caller-owned provenance", async () => {
    const created = await callTool("create_monitor", {
      name: "Front page",
      source_kind: "webpage",
      target: "https://example.test/news",
      interval_minutes: 30,
      botId: "bot-evil",
    });
    expect(created.result.content[0].text).toContain("monitor created");
    expect(lastAutonomyPath).toBe("/api/internal/monitors");
    expect(lastAutonomyBody).toMatchObject({
      botId: "bot-asker",
      threadId: "thread-asker-routine",
      name: "Front page",
      sourceKind: "webpage",
      target: "https://example.test/news",
      intervalMinutes: 30,
    });
  });

  it("creates and controls a mission only as the calling bot", async () => {
    const created = await callTool("create_mission", {
      name: "Finish Volume 1",
      objective: "Inventory the sources, resolve blockers, and begin safe work.",
      botId: "bot-evil",
    });
    expect(created.result.content[0].text).toContain("mission created");
    expect(lastAutonomyBody).toMatchObject({
      botId: "bot-asker",
      threadId: "thread-asker-routine",
      title: "Finish Volume 1",
      objective: "Inventory the sources, resolve blockers, and begin safe work.",
    });

    const started = await callTool("start_mission", { mission_id: "mission-1", botId: "bot-evil" });
    expect(started.result.content[0].text).toContain("started");
    expect(lastAutonomyPath).toBe("/api/internal/missions/mission-1/start");
    expect(lastAutonomyBody).toEqual({ botId: "bot-asker", threadId: "thread-asker-routine" });
  });

  it("rejects unknown tools with -32602", async () => {
    const res = await rpc("tools/call", { name: "made_up", arguments: {} });
    expect(res.error.code).toBe(-32602);
  });

  it("requires bot_id and message", async () => {
    const res = await callTool("ask_bot", { bot_id: "", message: "" });
    expect(res.result.isError).toBe(true);
  });
});
