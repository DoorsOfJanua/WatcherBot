# MyAgent Room — local runbook

## Current phase

This is an isolated development fork. AgentHQ stays intact as rollback. Do not point Telegram or
scheduled work at MyAgent Room until the Farmada memory and approval acceptance tests pass.

The Farmada memory half has a passing unit and live conversational proof. The exact external
action receipt is still a cutover blocker; do not enable autonomous sending merely because an
OpenMaus shell/tool permission card was approved.

## Development start

```bash
cd /Users/janua/Projects/MyAgentRoom
MYAGENT_ROOM_DATA_DIR=/Users/janua/.myagent-room pnpm dev:server
```

In another terminal:

```bash
cd /Users/janua/Projects/MyAgentRoom
pnpm dev
```

On a fresh data directory, seed the closed-by-default core roster once:

```bash
MYAGENT_ROOM_URL=http://127.0.0.1:8799 pnpm bootstrap:janua
```

The bootstrap is idempotent. It imports personas, selects the intended Claude/Codex models,
makes The Watcher Chief of Staff, creates the room, and explicitly leaves computers and connected
apps off. It refuses to guess if it finds a partial or duplicate core roster.

The project registry defaults to `/Users/janua/.myagent-room/project-registry.json`. Override it
only with an absolute path:

```bash
MYAGENT_PROJECT_REGISTRY=/absolute/path/project-registry.json
```

## Required acceptance sequence

1. Start with a fresh test data directory and the test project registry.
2. Create or import the Janua core team without granting connected apps or computer access.
3. Tell The Watcher: `Open Farmada and tell me the current next action.`
4. In the same thread say only: `continue`.
5. Confirm both responses use the same Farmada project state and do not ask for a re-explanation.
6. Simulate a mailbox result of zero matches. Confirm the agent reports the failed search but
   retains the three known questionnaire responses and Farmada's current phase.
7. Restart the server, say `continue` again, and confirm the thread-to-project binding survived.
8. Prepare a sample email draft, approve its exact receipt, then modify the draft. Confirm the old
   approval cannot send the changed content.
9. Approve the new exact draft and confirm one send is possible and a replay is rejected.
10. Only after these pass, connect a non-critical Telegram test room. Live Farmada stays on the
    existing path until the parallel run agrees.

## Provider and access policy

- Model CLIs may use existing local CLI authentication; do not paste provider tokens into team
  manifests or chat.
- Imported agents begin with Composio disabled and computer access off.
- Treat local provider plugins/MCPs as a separate access surface. The 22 August live test showed
  Mailman could see a Codex Gmail plugin while Composio was off. Do not enable unattended runs
  until provider homes are isolated or an explicit plugin allowlist is enforced.
- Enable Gmail for Mailman only after a read-only retrieval test. Sending is enabled only through
  the exact approval path.
- Protected logins, MFA, CAPTCHAs, payment confirmations, and password entry are always human
  handoffs on the visible computer.

## Phone path

The native iOS companion is the first phone surface. Pair it over Tailscale with the desktop
companion process; do not expose the harness directly to the public internet. While the Mac is the
runtime host, the Mac must be awake and online. A later VPS worker can provide 24/7 execution while
the same UI and state model remain.

## Upstream maintenance

```bash
git fetch upstream
git log --oneline --decorate --graph --all -20
git merge upstream/main
```

Keep Janua code in named modules and documents. Preserve `LICENSE`, `NOTICE`, and
`JANUA-NOTICE.md`. Review upstream changes to authentication, connectors, computer control,
permissions, team imports, and auto-approval before merging.

## Rollback

Stopping MyAgent Room does not alter AgentHQ. Until cutover, rollback is simply: stop the new
server and continue using the existing `/Users/janua/Projects/AgentHQ` services. Never clean,
reset, or rewrite that dirty worktree as part of this migration.
