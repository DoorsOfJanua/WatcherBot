# Spec: Provider-health warnings (model down / usage exhausted / subscription ended)

Status: READY FOR CODEX · 2026-08-24 · ruled by Janua
Owner intent: when a model lane stops working (usage cap hit, subscription lapsed, auth expired, CLI broken), the room must say so loudly in the app. Today a bot just fails or goes quiet and Janua finds out by absence.

## Signals that already exist (currently dropped or unclassified)
- Claude CLI stream emits `rate_limit_event` with `rate_limit_info: { status, resetsAt, rateLimitType, overageStatus, ... }` on every turn. Grep of server/ shows NO consumer; the events are visible in `~/.myagent-room/native/<threadId>.ndjson` transcripts. This is the primary Claude-lane health signal, including "allowed but nearly exhausted" and "rejected".
- Turn failures already flow through the runtime event lane (`turn.*`, `runtime.error` in server/drivers/claude.ts ~905-925; codex.ts settle path ~428). They are not classified by cause.
- `claude auth status --json` exists (claude.ts ~56) for on-demand auth checks; Codex lane has its own auth/status surface, investigate its adapter.

## Behavior
1. New server-side module `server/provider-health.ts` keeping per provider-instance state: `{ instanceId, status: "ok" | "degraded" | "limited" | "down", reason, resetsAt?, lastOkAt, lastCheckedAt }`.
2. Drivers feed it:
   - claude driver parses `rate_limit_event`: overage/rejected or status not "allowed" → `limited` with `resetsAt`; also record utilization when the event carries it so "approaching the cap" can surface before hard failure.
   - Turn failures get a cause classification at the driver seam (auth error, spawn failure, rate limit, provider 4xx/5xx, unknown). N consecutive cause-classified failures (N=2) → `down`/`limited` accordingly. One success → back to `ok`.
3. API: `GET /api/provider-health` returns all lanes; changes broadcast over the existing SSE/broadcast channel (`broadcast({kind: "provider-health", ...})`).
4. UI (desktop):
   - A persistent banner at the top of the app when any lane is `limited`/`down`: plain words, e.g. "Claude lane is out of usage until 18:00. Bots on Claude models will fail until then." One banner, worst lane wins, dismissible until the state changes again.
   - Per-bot: a small warning dot + tooltip on every bot whose modelSelection sits on an unhealthy lane, in the roster list and the chat header.
   - Routines page: routines whose bot (or routine override, see SPEC_ROUTINE_MODEL_OVERRIDE) is on an unhealthy lane show "will fail: <lane> is down" instead of silently queueing failures.
5. Routine engine: when a lane is `down`/`limited` at fire time, still create the receipt but mark it failed fast with the health reason WITHOUT spawning the CLI (fail fast, no zombie spawn storms). When the lane recovers, routines resume on their normal marks.
6. iOS companion: surface the same banner state (the phone bridge already mirrors room state; tolerant decode, read-only).
7. Notification: on transition ok → down/limited, one macOS notification via the existing notification path (bots already notify), throttled to one per lane per hour. This is how Janua learns his subscription/usage died while the app is closed.

## Explicitly in scope
- "Usage finished" (five-hour/weekly caps, overage rejected) on the Claude lane via rate_limit_event.
- "Subscription ended / auth expired": classify auth failures from both CLIs' stderr/exit and the auth status commands; do an auth status probe when a turn fails unclassified.
- Codex lane equivalents: investigate what the codex CLI emits on rate limit/auth failure and classify the same way (the adapter's settle path already carries error messages).

## Tests
- Feed a captured rate_limit_event (take a real one from a native transcript) → state `limited`, resetsAt propagated, banner payload broadcast.
- Two consecutive auth-classified failures → `down`; next success → `ok`.
- Routine fire on a down lane → fast-fail receipt with reason, no spawn.
- Health endpoint shape stable for iOS decode.

## Do not
- No fallback to a different model when a lane dies. Warn and fail honestly; rerouting is Janua's decision (ALWAYS-pro rule: no silent second-best).
- No polling of provider billing APIs. Classify what the turns and CLIs already say.
