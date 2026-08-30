# Upstream Rebuild Runbook — 2026-08-30

Ruled by Janua: rebuild on latest upstream (OpenMausBot f084f3f), re-apply our layer on top.
Fallback at every step: branch `archive/pre-upstream-rebuild-2026-08-30` (= checkpoint ab098c0,
pushed to origin) + data clones `~/.myagent-room-backup-2026-08-30` and
`~/Library/Application Support/myagent-room-backup-2026-08-30`. The live checkout
(`~/Projects/MyAgentRoom`, branch janua/myagent-room) and the installed app are NOT touched
until the final gate passes and Janua approves the swap.

## Ground rules
- All work happens in the worktree `~/Projects/MyAgentRoom-rebuild`, branch `rebuild/upstream-2026-08-30` (based on upstream/main f084f3f).
- Upstream wins on core plumbing. Our duplicates of upstream features are NOT re-applied
  (delegation receipts, workbench browser internals, approval plumbing upstream now covers).
- Every patch group ends with its gate green before the next group starts. A red gate stops the line.
- Conflict rulings in the four collision zones (comms, approvals, workbench, iOS) go to Fable, not resolved ad hoc.

## Patch groups, in order
- **P1 Branding**: app name WatcherBotRoom, bundle id com.janua.myagentroom, icons,
  desktopName, launchd labels, iOS app name. Source of truth: `git diff 89d25dd ab098c0 --`
  package.json, electron-builder.yml, electron/resources, ios/project.yml.
  Gate: `pnpm package:prepare` green + app launches from `electron .`.
- **P2 Privacy cuts (non-negotiable)**: DEFAULT_COMPOSIO_BROKER_URL stays empty; updater stays
  gated behind MYAGENT_ENABLE_UPDATES; no hosted control-plane/onboarding enrollment on boot.
  Gate: grep assertions + boot with network log shows no broker/control-plane calls.
- **P3 Single-instance lock**: check whether upstream added its own (grep main.mjs for
  requestSingleInstanceLock); if not, re-apply today's block from ab098c0.
  Gate: `open -n` second launch exits, window focuses.
- **P4 Agent Spirits**: cherry-pick the spirit stack (aad6790, be6fb00, fc17c1e, 1fd05eb,
  6bbb515, 2871675, 484a3fd, 97012a0, 90b6dd1, 3afbc37, 5af71c2, plus spirit-persistence
  commits 1b3ab27, b95f40f, 8e939f7, 38121b4-adjacent UI). Self-contained src/ components.
  Gate: spirits render in the room, persist through profile edits.
- **P5 Memory + roles + packs**: 93d70cd, 58e080f, 510f2e7, 0f3b6cc; verify AgentPacks
  provision.mjs still passes the app's zod schema on the new base.
  Gate: pack provision dry-run converges.
- **P6 Janua integrations**: GangaStudio mount + phone approve (eab3ad0), Limen onboarding
  docs (63ee99a, 6f38f9b, 8d411ad), Mailman draft revisions + style learning (38121b4).
  Gate: GangaStudio MCP mounts, Mailman drafts open.
- **P7 iOS**: hardest zone, both sides moved. Take upstream's iOS base (multiple paired
  computers, new pairing). Port ONLY: dictation audio-timestamp anchoring (1a9282d, a3c83e8),
  spirit display, WatcherBot rename. Drop our pairing/reconnect work (superseded).
  Gate: builds in Xcode, pairs against the rebuilt server, no duplicate sends (upstream's
  queued-delivery fix must be exercised).
- **P8 Missions/monitors lane** — RULED by Fable 2026-08-30 after full recon (both engines share
  the same ancestor; missions/monitors are net-new, not duplicates):
  - **Routines**: upstream's engine wins wholesale (confirmation cards + fingerprinted receipts,
    source-conversation run reporting via sourceThreadId/onRunChanged, secret redaction,
    turn.retrying tolerance, zod migration). Re-apply OUR features as additive patches, in this
    order: (a) `interval` schedule, (b) `precheck` + `skipped` runs, (c) skip-if-still-running
    with honest `missed` receipts, (d) autonomy-outcome envelope, (e) finished-without-message
    = failed delivery, (f) `pauseAll()` emergency stop, (g) FIFO webhook drain fix,
    (h) per-routine modelSelection. Conflict surface is four hunks: tick(), newRun(), save(),
    handleRuntimeEvent(). Also port the SSRF-hardened fetch (monitor-http-adapter.ts) as a
    shared utility.
  - **Monitors**: DROP monitors.ts as a separate manager (~360 net lines deleted). Re-express a
    monitor as a routine whose `precheck` is our fingerprint evaluator: register
    monitor-evaluator.ts + monitor-http-adapter.ts as a precheck provider on the routine engine.
    The fingerprint-diff-before-model property (no model woken for an unchanged page) MUST
    survive; it is a product differentiator (cheap watches).
  - **Missions**: keep missions.ts + mission-dispatcher.ts as a sibling scheduler (~260 lines,
    already decoupled via injected execute()). Route its execute() through upstream's routine
    run-record + onRunChanged path so missions inherit source-conversation reporting and
    confirmation cards. Do NOT model the work-item DAG as routines.
  - **Gate**: routine created via chat card round-trips; a monitor-style precheck routine skips
    without a model turn on unchanged content; a 2-item mission DAG runs with lease recovery;
    grep proves redactSecretsInText is applied to run output/error (this and turn.retrying were
    silent regressions in our fork that the upstream base fixes; assert they stay fixed).
- **P9 Data compatibility gate**: run the rebuilt app against CLONED data:
  `MYAGENT_ROOM_DATA_DIR=~/.myagent-room-backup-2026-08-30` + isolated userData.
  Verify: rooms, bots, threads, workspaces, memory files all load; no schema errors in logs.
  NEVER point the rebuild at the live data dir before this gate is green.
- **P10 Final**: full test suite, `pnpm package:mac`, launch packaged build on cloned data,
  then STOP and get Janua's go before replacing /Applications and pointing at live data.

## Fallback procedure (any time)
1. `git checkout archive/pre-upstream-rebuild-2026-08-30` (or reset janua/myagent-room to ab098c0).
2. Restore data: replace live dirs with the two backup clones.
3. Reinstall old app from ~/.myagent-room/backup-WatcherBotRoom-0.1.27-aug28.app or current release/mac-arm64.
