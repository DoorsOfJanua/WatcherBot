/**
 * Local Google Calendar bridge for WatcherBot Room.
 *
 * OAuth tokens and client credentials stay on this Mac. The normal mode is a
 * narrow MCP server over Janua's calendars — reads plus event writes
 * (create/update/delete, ruled 2026-08-24); `--auth` performs the one-time
 * desktop OAuth flow and stores the refresh token in
 * ~/.myagent-room/google-calendar. Writes never email attendees
 * (sendUpdates: "none") — outward messages are not this bridge's lane.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { google } from "googleapis";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ROOT = process.env.MYAGENT_ROOM_DATA_DIR?.trim() || join(homedir(), ".myagent-room");
const DIR = join(ROOT, "google-calendar");
const CLIENT_FILE = join(DIR, "client.json");
const TOKEN_FILE = join(DIR, "token.json");
// events = create/update/delete events; readonly = calendarList and
// anything events does not cover. Deliberately NOT the full `calendar`
// scope — this bridge never manages calendars themselves.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

type ClientFile = { client_id: string; client_secret: string };

function readClient(): ClientFile {
  let raw: Record<string, unknown> = {};
  if (existsSync(CLIENT_FILE)) raw = JSON.parse(readFileSync(CLIENT_FILE, "utf8")) as Record<string, unknown>;
  const installed = (raw.installed ?? raw.web ?? raw) as Record<string, unknown>;
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID ?? installed.client_id ?? "").trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? installed.client_secret ?? "").trim();
  if (!clientId || !clientSecret) {
    throw new Error(`Google OAuth is not configured. Put a Desktop OAuth client JSON at ${CLIENT_FILE}, or set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.`);
  }
  return { client_id: clientId, client_secret: clientSecret };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function oauthClient(redirectUri?: string) {
  const client = readClient();
  return new google.auth.OAuth2(client.client_id, client.client_secret, redirectUri);
}

function openUrl(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

async function authenticate(): Promise<void> {
  const server = createServer();
  const code = new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/oauth/callback") { res.writeHead(404); res.end("Not found"); return; }
      const error = url.searchParams.get("error");
      if (error) { res.writeHead(400); res.end(`Google authorization failed: ${error}`); reject(new Error(error)); return; }
      const value = url.searchParams.get("code");
      if (!value) { res.writeHead(400); res.end("Missing authorization code"); reject(new Error("Missing authorization code")); return; }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<h2>WatcherBot Room Calendar connected.</h2><p>You can close this tab.</p>");
      resolve(value);
    });
    server.on("error", reject);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not open the local OAuth callback");
  const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
  const client = oauthClient(redirectUri);
  const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent select_account", scope: SCOPES });
  console.error(`Opening Google authorization: ${url}`);
  openUrl(url);
  const authCode = await Promise.race([
    code,
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Google authorization timed out")), 120_000)),
  ]);
  const { tokens } = await client.getToken(authCode);
  writeJson(TOKEN_FILE, tokens);
  server.close();
  console.error(`Calendar token saved to ${TOKEN_FILE}`);
}

function calendarApi() {
  if (!existsSync(TOKEN_FILE)) throw new Error(`Google Calendar is not authorized yet. Run: pnpm calendar:auth`);
  const client = oauthClient();
  client.setCredentials(JSON.parse(readFileSync(TOKEN_FILE, "utf8")));
  return google.calendar({ version: "v3", auth: client });
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

const server = new McpServer({ name: "watcherbot-local-calendar", version: "0.1.0" });

server.registerTool("calendar_status", {
  title: "Calendar connection status",
  description: "Check whether the local Google Calendar bridge has an authorized account.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => jsonResult({ authorized: existsSync(TOKEN_FILE), tokenStore: "local Mac only" }));

server.registerTool("calendar_list_calendars", {
  title: "List calendars",
  description: "List the calendars visible to Janua's connected Google account.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async () => {
  const response = await calendarApi().calendarList.list({ minAccessRole: "reader", showDeleted: false });
  return jsonResult({ calendars: (response.data.items ?? []).map((item) => ({ id: item.id, summary: item.summary, primary: item.primary, timeZone: item.timeZone, accessRole: item.accessRole })) });
});

server.registerTool("calendar_list_events", {
  title: "List calendar events",
  description: "Read events in a date window.",
  inputSchema: {
    calendarId: z.string().default("primary").describe("Calendar ID, usually primary."),
    timeMin: z.string().datetime({ offset: true }).optional().describe("Inclusive ISO timestamp."),
    timeMax: z.string().datetime({ offset: true }).optional().describe("Exclusive ISO timestamp."),
    query: z.string().max(200).optional().describe("Optional text search."),
    maxResults: z.number().int().min(1).max(250).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async ({ calendarId, timeMin, timeMax, query, maxResults }) => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86_400_000);
  const response = await calendarApi().events.list({ calendarId, timeMin: timeMin ?? now.toISOString(), timeMax: timeMax ?? end.toISOString(), q: query, maxResults, singleEvents: true, orderBy: "startTime", showDeleted: false });
  return jsonResult({ calendarId, events: (response.data.items ?? []).map((event) => ({ id: event.id, status: event.status, summary: event.summary, description: event.description, location: event.location, start: event.start, end: event.end, htmlLink: event.htmlLink, attendees: event.attendees?.map((a) => ({ email: a.email, displayName: a.displayName, responseStatus: a.responseStatus })) })) });
});

/** "2026-08-24" → all-day {date}; anything else must be an ISO datetime
 * with offset → timed {dateTime}. */
const eventTime = z
  .string()
  .describe("ISO datetime with offset (2026-08-24T15:00:00+01:00) for a timed event, or YYYY-MM-DD for all-day.");
function toEventTime(value: string): { date: string } | { dateTime: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value };
  const parsed = z.string().datetime({ offset: true }).safeParse(value);
  if (!parsed.success) throw new Error(`Not a date (YYYY-MM-DD) or ISO datetime with offset: ${value}`);
  return { dateTime: value };
}

function eventSummaryShape(event: { id?: string | null; status?: string | null; summary?: string | null; start?: unknown; end?: unknown; htmlLink?: string | null }) {
  return { id: event.id, status: event.status, summary: event.summary, start: event.start, end: event.end, htmlLink: event.htmlLink };
}

server.registerTool("calendar_create_event", {
  title: "Create a calendar event",
  description: "Create an event on one of Janua's calendars. Attendees are never emailed by this bridge.",
  inputSchema: {
    calendarId: z.string().default("primary").describe("Calendar ID, usually primary."),
    summary: z.string().min(1).max(300).describe("Event title."),
    start: eventTime,
    end: eventTime,
    description: z.string().max(4_000).optional(),
    location: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async ({ calendarId, summary, start, end, description, location }) => {
  const response = await calendarApi().events.insert({
    calendarId,
    sendUpdates: "none",
    requestBody: { summary, description, location, start: toEventTime(start), end: toEventTime(end) },
  });
  return jsonResult({ created: eventSummaryShape(response.data) });
});

server.registerTool("calendar_update_event", {
  title: "Update a calendar event",
  description: "Change fields on an existing event (title, times, description, location). Only the fields you pass change. Attendees are never emailed by this bridge.",
  inputSchema: {
    calendarId: z.string().default("primary").describe("Calendar ID, usually primary."),
    eventId: z.string().min(1).describe("The event's id, from calendar_list_events."),
    summary: z.string().min(1).max(300).optional(),
    start: eventTime.optional(),
    end: eventTime.optional(),
    description: z.string().max(4_000).optional(),
    location: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async ({ calendarId, eventId, summary, start, end, description, location }) => {
  const patch: Record<string, unknown> = {};
  if (summary !== undefined) patch.summary = summary;
  if (description !== undefined) patch.description = description;
  if (location !== undefined) patch.location = location;
  if (start !== undefined) patch.start = toEventTime(start);
  if (end !== undefined) patch.end = toEventTime(end);
  if (!Object.keys(patch).length) throw new Error("Nothing to change — pass at least one field.");
  const response = await calendarApi().events.patch({ calendarId, eventId, sendUpdates: "none", requestBody: patch });
  return jsonResult({ updated: eventSummaryShape(response.data) });
});

server.registerTool("calendar_delete_event", {
  title: "Delete a calendar event",
  description: "Delete one event permanently. Double-check the event id against calendar_list_events before calling this.",
  inputSchema: {
    calendarId: z.string().default("primary").describe("Calendar ID, usually primary."),
    eventId: z.string().min(1).describe("The event's id, from calendar_list_events."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
}, async ({ calendarId, eventId }) => {
  await calendarApi().events.delete({ calendarId, eventId, sendUpdates: "none" });
  return jsonResult({ deleted: { calendarId, eventId } });
});

if (process.argv.includes("--auth")) {
  authenticate().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
} else {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => { console.error(error); process.exitCode = 1; });
}

export { CLIENT_FILE, DIR, SCOPES, TOKEN_FILE };
