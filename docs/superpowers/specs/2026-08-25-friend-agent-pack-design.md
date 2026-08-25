# Friend Agent Pack + Universal Skill Library — Design

Date: 2026-08-25
Status: approved in brainstorm (Janua), pending codebase reconciliation pass (Fable)
Scope: WatcherBotRoom (this repo) + a new agent-pack repo

## Goal

A non-technical friend (motion designer: After Effects, Cinema 4D, Higgsfield,
ChatGPT image, Gmail, Google Calendar) gets WatcherBotRoom on his own Mac with
his own Claude subscription (plus his existing ChatGPT subscription as the
Codex lane), pre-loaded with a team of three proactive agents that handle his
email, his schedule, his work/family balance, and his professional creative
work. Janua installs once; updates ship as a pack, never by re-touching the
Mac by hand.

Secondary goal that fell out of the design: the creative skills (Higgsfield,
gpt-image, etc.) become a **universal skill library surfaced in the app** (tool
selector window), not files buried in one man's install. The friend's setup is
the first consumer; every future WatcherBotRoom user is the real audience.

## Decisions already ruled by Janua

- **UNIVERSAL FIRST (ruled 2026-08-25): every app-side build is a product
  feature for ALL WatcherBotRoom users, not a friend-special.** The skill
  library, tool selector window, pack import/provisioning, onboarding
  interview, and Brain pattern are built generic, per-user, with the friend's
  setup as the first instance. Nothing hardcodes the friend: his bots, Brain
  content, accounts, and credentials live only in his pack instance. The
  inspiration came from the friend; the audience is every user.
- Platform: WatcherBotRoom on the friend's Mac. No new app, no hosting.
- No Composio, no extra services. Native claude.ai account connectors only
  (Gmail + Google Calendar ride the friend's Claude login into the claude CLI).
- Multiple small, specific agents, not one mega-agent.
- Engines: Claude sub is the backbone (all connector-touching bots). His
  ChatGPT sub powers the Codex lane as second engine.
- Image generation lanes, ranked:
  1. Higgsfield MCP (GPT Image 2 lane) — primary workhorse, his Higgsfield sub.
  2. Host-browser ChatGPT lane — the app's own computer/host control drives his
     real logged-in chatgpt.com session. Explicit "generate in my ChatGPT"
     command, never a default. ToS-gray; approval-gated; uses the sub he pays.
  3. OpenAI API credits — clean pay-per-use fallback for volume/headless.
- Email cycle: 3x/day, immediate drafts, reply-able questions, knowledge-aware.
- Setup and agent experience must be good. The onboarding interview IS the
  setup experience.

## The roster (three bots, one shared voice)

### 1. The Desk — email + calendar
- Runs on Claude (connectors requirement).
- 3x/day routine (approx. 08:30 / 13:00 / 18:00) using routine prechecks so a
  no-new-mail run costs almost nothing.
- For every mail needing an answer it drafts **immediately**, in two places:
  a real draft in his Gmail drafts folder (send from phone possible) and a chat
  card with Send / Edit / Skip.
- Never auto-sends. Every send/booking is an approval card.
- Asks plain questions in the thread when information is missing, and those
  questions are knowledge-aware: it cross-references the Brain (projects,
  people, family rhythm) and the calendar before asking. Example: "Client asks
  if Thursday works; your calendar says school pickup at 16:00; offer Friday
  morning instead?"
- Change watch: new invites, reschedules, cancellations get pushed as noticed,
  not hoarded for the next cycle.

### 2. The Compass — planning + the personality home
- Runs on Claude.
- Owns the proactive loop: morning briefing (inbox headlines + today's
  calendar + one good line for the day), evening wrap, family-time guard
  ("you blocked Saturday for the kids — decline this?").
- Personality lives here: funny, warm, not too deep but occasionally touching.
  Specced as a voice (style rules + example lines), never a canned quote list.
- Runs the onboarding interview on first launch and writes the Brain itself.

### 3. The Studio — professional creative copilot
- Engine: either; default Codex to spread quota (flippable in model picker).
- Skills: Higgsfield MCP driving (ported higgsfield-generate, higgsfield-soul-id,
  higgsfield-product-photoshoot, higgsfield-marketplace-cards knowledge),
  gpt-image prompt craft (gptimage pipeline knowledge), visual prompt design,
  character sheet templates, After Effects (expressions, workflows), Cinema 4D.
  AE/C4D stay knowledge-level skills — no integration to maintain.
- Higgsfield MCP configured with the friend's own Higgsfield account.

## The Brain (shared knowledge layer)

- A shared folder of plain markdown all three bots read and write: projects.md,
  people.md, family-rhythm.md, voice.md, preferences.md, plus a lightweight
  index. Same pattern as Janua's own memory system. No service, no database.
- Lives inside the bots' shared working directory (exact path decided in the
  reconciliation pass against how the app assigns per-bot cwd).
- Seeded by the Compass onboarding interview (~20 min, conversational), then
  maintained by all bots: Desk learns senders/projects, Compass learns rhythm,
  Studio learns visual style and recurring characters.

## Universal Skill Library + Tool Selector window (app feature)

Janua's ruling (2026-08-25): the creative tools should be universal and easily
accessible in a tool window / tool selector in WatcherBotRoom.

- The higgsfield-* and gptimage skills (and future ones) move from private
  dotfiles into the app's skill library as first-class, shippable skills.
- A **tool selector window** in the app lets any user browse the library and
  toggle skills per bot: name, one-line description, what it needs (e.g.
  "Higgsfield account"), on/off per bot.
- Exact mechanism (extend server/skill-library.ts + roster UI vs. new surface)
  is decided in the reconciliation pass; the feature follows existing app
  patterns, including the approval/permission model.
- Credentials a skill needs (Higgsfield key, OpenAI key) are configured in the
  app, never pasted into chats, following the existing connector/credential
  patterns.

## Engines

- Claude (his new sub, start on Pro): Desk, Compass, everything touching
  connectors, routines, the Brain. Upgrade to Max only if limits actually hit.
- Codex (his existing ChatGPT sub): Studio default, plus overflow lane for any
  bot via the model picker.
- Honest caveat delivered to the friend: in-CLI gpt-image is NOT covered by the
  ChatGPT subscription; API images are separate pay-per-use credits. Lanes 1
  and 2 above exist so he mostly never needs it.

## The Agent Pack (deliverable + update path)

Packs are a **generic app concept**: any user can import a pack (personas +
skills + routines + brain templates) into their own WatcherBotRoom. The
friend's pack is the first one; the pack format itself carries zero
friend-specific assumptions.

A small private repo (the friend's pack instance) containing:
- personas/ — the three bots' system prompts / persona files
- skills/ — the ported + new skills listed above
- brain-templates/ — empty Brain files + the onboarding interview skill
- routines/ — routine definitions (3x/day Desk cycle, morning briefing,
  evening wrap, change watch)
- runbook/SETUP.md — Janua's one-time install runbook (app dmg, claude CLI
  login, claude.ai Gmail+GCal connectors, Higgsfield MCP, pack import)
- an import/provision script if the app lacks one (reconciliation pass decides)

Update path: Janua pushes to the pack repo; next maintenance touch pulls. No
hand-rebuilding the friend's Mac. The pack is deliberately reusable: friend #2
is a clone with a fresh Brain.

## Error handling & safety

- Nothing outward-facing fires without an approval card: email sends, calendar
  writes, host-browser control. Reads (inbox triage, calendar reads) run free.
- Routine runs that hit a missing connector/login post a plain-language chat
  message telling him what to click, and tell Janua's runbook what to check.
- Host-browser ChatGPT lane is opt-in per invocation, visible on screen,
  stoppable, and never scheduled.

## Testing / verification

- Pack verified in a live WatcherBotRoom instance on Janua's Mac first: create
  the three bots from the pack, run one full Desk cycle against a real Gmail
  test account, one morning briefing, one Higgsfield generation, before the
  friend's install. "Should work" is not done.
- Tool selector window: unit tests per app conventions + exercised in the
  running app.

## Reconciliation findings (2026-08-25, pass complete)

**Verdict: the design stands. Ten deltas, none fatal, three reshape the build.**

### Verified sound
- **Connector inheritance: VERIFIED twice (official Claude Code docs + code
  read).** claude.ai connectors (Gmail, Google Calendar) load automatically in
  the claude CLI when signed in with the same account, interactive AND headless
  `-p`. The app spawns claude with HOME untouched, no `CLAUDE_CONFIG_DIR`, no
  `--settings`, no `--strict-mcp-config` (server/drivers/claude.ts:581-762),
  so the user's own login and connectors ride in. Runbook checks: `claude
  login`, then `claude mcp list` shows the connectors;
  `disableClaudeAiConnectors` must stay unset.
- **"Host browser never scheduled" is enforced by construction, not policy:**
  unattended runs (routines/webhooks) refuse every auto-approval and always
  card (server/auto-approve.ts:313-326); local-computer scope additionally
  refuses remembered grants and silent reads (auto-approve.ts:328-339).
- **The Desk send flow already exists as a primitive:** action receipts
  (server/action-receipts.ts) + mail-actions (server/mail-actions.ts) give
  exact-payload, at-most-once, editable-in-card email sends. The Desk bot rides
  this, no new safety code.
- **Pack provisioning has a proven template:** team manifest import
  (persona-only by design, server/team-manifest.ts) + a post-import API script
  (scripts/bootstrap-janua-team.mjs) that PATCHes bots and creates the rest.
  The pack copies this two-step shape.

### Deltas absorbed into the design
1. **No cron schedules.** RoutineSchedule is once/daily(one time)/interval
   (server/routines.ts:10-17). The 3x/day Desk cycle = THREE `daily` routines
   (08:30 / 13:00 / 18:00). No app change needed.
2. **Build dependency: routine precheck, per-routine model override, and the
   persistent routine task (TaskRecord.routineId / taskForRoutine) exist only
   in the uncommitted working tree** (other window's lane, 4 known review
   findings to fix before commit). The pack's routine definitions depend on
   all three. They must land on the branch before the friend install; pack
   authoring can proceed in parallel.
3. **Image lane 1 needs NO MCP server:** higgsfield-generate wraps the
   `higgsfield` CLI via Bash, authenticated by the friend's own Higgsfield
   login. Lane 3 (gpt-image API) is a script + OPENAI_API_KEY. So the pack's
   creative skills run on the existing skill mechanism + credentials; per-bot
   MCP config is NOT on the critical path (it remains a wanted universal
   feature, replacing the hardcoded server/project-mcp.ts name-match table
   with a real BotRecord.mcpServers field — both drivers already accept
   integrations.projectMcps).
4. **Skill library is real but minimal** (server/skill-library.ts, 99 lines):
   SKILL.md + manifest.json folders, bundled dir only (OMB_SKILLS_DIR),
   keyword-triggered, globally on/off, ZERO UI. The universal build extends
   it: a user skills root (~/.myagent-room/skills), per-bot enablement,
   credential declarations in the manifest, and the tool selector window as
   the net-new UI surface.
5. **Bots have no system-prompt field.** Persona = name + title + description
   (≤4000 chars, server/index.ts:1697-1703), exactly how the 23 agent-role
   templates ship charters (shared/agent-role-templates.ts). The three pack
   personas are written as ≤4000-char charters; anything longer goes in the
   Brain via cwd (bots pick up CLAUDE.md/MEMORY.md from their working folder).
6. **Brain placement decided:** one shared folder, set as all three bots'
   `cwd`. Bots load its CLAUDE.md; Brain files are plain markdown next to it.
   Default per-bot workspaces (~/.myagent-room/workspaces/<id>) are bypassed
   deliberately so all three read/write the same Brain.
7. **Credentials:** workspace keys live in AppConfig + OS keychain, stripped
   from every CLI child env (server/config.ts:229-242) and redacted from
   transcripts. New keys (Higgsfield, OpenAI) each need: appConfigSchema field
   + WORKSPACE_CREDENTIAL_ENV entry + keychain plumbing + an ApiKeys.tsx row.
   Skill-declared credentials (generic) are part of the universal skill
   library build. NOTE: the credential-strip must NOT strip keys the skills
   themselves need in the child env — the skill-library build defines how a
   skill-granted key reaches the subprocess deliberately, not by leak.
8. **The private pack repo cannot ship via /api/team-library/github** (public
   HTTPS only). Delivery = git clone + local import + provision script. Fine:
   Janua runs the maintenance touches anyway.
9. **RISK, verify before friend install:** when the app injects MCP servers it
   sets `--allowedTools` from ONLY the injected servers, and headless
   `acceptEdits` silently denies unlisted tools (claude.ts:605-663). Must
   verify empirically that the user's claude.ai connector tools are not
   denied on a bot that also mounts injected MCP. Test on Janua's instance
   first; if they are denied, the fix is appending the connector tool
   namespace to --allowedTools or dropping the narrow list for such bots.
10. **Installer is unnotarized** (electron-builder.yml notarize: false):
    friend's first launch needs the right-click-open Gatekeeper dance, plus
    Accessibility + Screen Recording TCC grants for host control. Runbook
    covers it; real fix is notarizing with a Developer ID.

## Live verification (2026-08-25, on Janua's instance)

- **Pack provisioned live and idempotent**: 3 bots (correct cwd = shared
  brain, computer off, correct engines/models, no auto-approve), room "The
  Team" (3 members), 6 routines with valid schedules (created PAUSED via
  PACK_ROUTINES_ENABLED=0), brain seeded once and never re-clobbered on
  re-run. AgentPacks repo: packs/creative-pro @ c4639c2.
- **Finding 9 RESOLVED for pack bots**: live Desk turn used the claude.ai
  Gmail connector from inside the app's claude subprocess and read the real
  inbox (201 unread, newest subject returned). Pack bots mount no injected
  MCP → no --allowedTools narrowing → connectors available. The narrowing
  risk remains only for bots that DO mount injected MCP servers.
- **Compass smoke turn**: persona loads, sees all five brain files through
  the shared cwd.
- **Routine attendance class verified in code**: markUnattended fires only
  for webhook turns (server/index.ts:1595); scheduled routines keep
  policy-read auto-approval (auto-approve.ts:306-311), so the 3x/day cycle
  triages unattended and only outward actions card. Design holds.
- Not yet verified: a full scheduled Desk cycle end to end, morning briefing
  run, in-app Higgsfield generation (blocked on the user-skills-root feature
  in the skill-library v2 build — the app cannot load pack skills yet).

## Open items

1. ~~Reconciliation pass~~ DONE 2026-08-25, findings above.
2. ~~Empirical connector test (finding 9)~~ DONE, see live verification.
3. Other window: commit the routine precheck/model-override/task-funnel work
   (finding 2) after fixing its 4 review findings.
4. Build skill library v2 + tool selector per
   2026-08-25-skill-library-tool-selector-impl.md (spec-ready).
5. Full end-to-end pack test (Desk cycle, briefing, Higgsfield) once 3+4
   land.
2. Friend's OpenAI API credit decision (only if lanes 1-2 prove insufficient).
3. Bot display names: Desk / Compass / Studio are working names; friend can
   rename at onboarding.
