# Universal Skill Library + Tool Selector — Implementation Spec

Date: 2026-08-25
Parent: 2026-08-25-friend-agent-pack-design.md (rulings + reconciliation)
Status: spec-ready, not started
Ruling honored: UNIVERSAL FIRST — this is a product feature for every user.

## What exists (from reconciliation)

`server/skill-library.ts` (99 lines): SKILL.md + manifest.json folders, one
bundled root (`OMB_SKILLS_DIR`, packaged = resources/skills), keyword
substring triggering, global `defaultEnabled`, capability gate, zero UI.
Call sites: server/index.ts:1722-1730 (DM turn), :2251 (room turn).

## Build

### 1. Server: skill library v2 (extend server/skill-library.ts)

- **Two roots**: bundled (`OMB_SKILLS_DIR`) + user root
  `<dataDir>/skills` (i.e. ~/.myagent-room/skills; respect
  MYAGENT_ROOM_DATA_DIR). Merge by id; user root wins on collision. Invalid
  folders are skipped with a logged reason, never crash the loader.
- **Manifest v2** (backward compatible, all new fields optional):
  ```jsonc
  {
    "id": "...", "name": "...", "version": "semver", "description": "...",
    "defaultEnabled": true,
    "triggerTerms": ["..."],
    "requiredCapabilities": [],
    "credentials": [            // NEW: what the skill needs to run
      { "env": "HIGGSFIELD_NONE", "label": "Higgsfield account (CLI login)", "kind": "external" },
      { "env": "OPENAI_API_KEY", "label": "OpenAI API key", "kind": "workspaceKey" }
    ]
  }
  ```
  `kind: "workspaceKey"` = stored in the app credential store and injected
  into the turn env; `kind: "external"` = informational (user logs in a CLI
  themselves), shown in the UI as a requirement, nothing injected.
- **Per-bot enablement**: `BotRecord.skills?: Record<string, boolean>`
  (server/store.ts). Absent id → manifest `defaultEnabled`. Selection becomes
  `selectSkills(text, capabilities, library, bot.skills)` — same trigger
  logic, filtered by the per-bot state. Keep the existing exported names
  working or update both call sites in the same commit.
- **Credential injection**: for each selected skill with `workspaceKey`
  credentials, inject those env vars into that turn's child env AFTER
  `stripWorkspaceCredentialEnv` — an explicit grant list per turn, sourced
  from the credential store, never from ambient env. A skill whose required
  workspaceKey is missing is still selectable; its instructions get a
  one-line prefix: "(credential <label> is not configured — tell the user to
  add it in Settings, do not improvise)".

### 2. Server: API

- `GET /api/skills` → `{ skills: [{manifest, source: "bundled"|"user",
  valid, credentialState: [{env,label,kind,configured}] }] }`
- Bot PATCH accepts `skills` map (validate ids exist or drop unknown ids
  silently — packs may ship ahead of the app).
- Credential store: add per-key generic entries. Extend `appConfigSchema`
  with `skillKeys?: Record<string, string>` (env name → value), stored via
  the existing keychain path (electron/workspace-credentials.mjs) and listed
  in `WORKSPACE_CREDENTIAL_ENV` so they are stripped everywhere EXCEPT the
  explicit per-turn grants above.

### 3. UI: Tool selector window

- New "Tools" surface following existing panel conventions (see
  PluginsPanel.tsx / SettingsPanel.tsx patterns): reachable from bot
  settings AND from a global tools entry.
- Per skill row: name, one-line description, version, source badge
  (bundled/user), requirement line ("Needs: Higgsfield account"), and a
  per-bot toggle. Missing workspaceKey → inline "Add key" link to the
  ApiKeys settings row.
- Global view: same list, per-bot toggle matrix collapsed to "enabled for N
  bots"; clicking opens per-bot state.
- No new visual language; reuse existing components and tokens.

### 4. Tests + verification (gate 3/4)

- Vitest: loader merge/collision, per-bot filtering, credential grant env
  (assert stripped-by-default + granted-when-selected), API shapes, unknown
  id tolerance. Follow existing skill-library test file conventions if one
  exists; otherwise create server/skill-library.test.ts.
- Exercised in the running app: toggle a skill per bot, watch it change the
  next turn's system prompt (verify via a turn that names its loaded
  skills); one gpt-image run with the key injected via the new store.
- /code-review on the diff before done.

## Explicitly out of scope here

- Per-bot MCP config (BotRecord.mcpServers replacing project-mcp.ts) — next
  spec; not on the pack's critical path since Higgsfield is CLI-based.
- Marketplace/team-library skill installation (catalog `skills:` entries) —
  later; this build makes it possible.

## Coordination

- Working tree holds other windows' uncommitted routine-funnel work — do not
  touch server/routines.ts, server/index.ts routine wiring, or
  RoutinesPage.tsx beyond the two selectSkills call sites.
- The creative-pro pack (AgentPacks repo) already installs skills to
  ~/.myagent-room/skills and ships manifests without `credentials` — must
  load fine (v2 fields optional).
