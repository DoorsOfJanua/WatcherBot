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

## Reconciliation findings (2026-08-25)

- **Connector inheritance: VERIFIED (official Claude Code docs).** claude.ai
  connectors (Gmail, Google Calendar) load automatically in the claude CLI
  when signed in with the same account, in interactive AND headless `-p`
  sessions. Conditions the app/runbook must hold: subprocess runs with the
  user's normal HOME (login + user-scope config is what carries inheritance),
  no `--bare`, no custom `CLAUDE_CONFIG_DIR`, and `disableClaudeAiConnectors`
  must stay unset. Runbook checks: `claude login` then `claude mcp list`
  should show the connectors.

## Open items

1. Reconciliation pass (Fable, in progress): verify against the codebase —
   routine scheduling capability (fixed times 3x/day), per-bot persona/skill/
   MCP mechanisms, how the app spawns the claude subprocess (env/HOME/flags,
   see verified conditions above), host control gating, existing
   import/provision paths. Any conflict amends this spec before build.
2. Friend's OpenAI API credit decision (only if lanes 1-2 prove insufficient).
3. Bot display names: Desk / Compass / Studio are working names; friend can
   rename at onboarding.
