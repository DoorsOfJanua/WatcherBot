# Shared Project Memory — Ganga Vertical Slice Receipt

Date: 2026-08-22
Authority: Janua
Architecture review: Claude Fable CLI, reviewed twice
Status: implemented and verified

## Outcome

Ganga now has one external project mind rather than separate conversation memories. MyAgentRoom, AgentHQ Telegram, Claude CLI, Codex, and the LifeOS/Obsidian entry resolve current project truth from the same canonical root:

`/Users/janua/Documents/Ganga-Mira-Book-Project`

The minimum memory pack is:

1. `CANONICAL.md` — project charter, maps, artifact identities, and invariants.
2. `STATE.md` — compact current truth, active work, blockers, next actions, and contradictions.
3. `DECISIONS.md` — append-only standing and proposed rulings.

This is deliberately smaller than a full transcript or semantic-memory dump. The runtime pack is bounded to 12 KB of charter plus 16 KB of state, with visible truncation markers instead of silent loss.

## Stable artifact identities

- `fierce-grace-early-era` — Volume One, 1999–2021 by default.
- `fierce-grace-late-era` — Volume Two, 2022–2026 by default, with three grandfathered 2021 pieces.
- `ganga-mira-sutras` — separate distilled work.
- `ganga-story-book` — separate story-book lane.

Mutable publication labels and retired directory names are not used as identities.

## Runtime wiring

- One physical project registry: `/Users/janua/Projects/AgentHQ/config/projects.json`.
- MyAgentRoom loads charter then state from that registry for every bound turn.
- The MyAgentRoom Ganga bot is bound to the real canonical root and project ID `ganga`.
- AgentHQ Telegram loads the same registry and files, persists conversation-to-project bindings, and reloads the files on every turn.
- Pronoun-only follow-ups such as `continue` retain the project binding without replaying a full conversation.
- Root `AGENTS.md` and `CLAUDE.md` give Codex and Claude CLI the same read-first and write-back contract when working in the project.
- The former LifeOS state page is now pointer-only. Its superseded 2026-07-27 claims were preserved as a dated historical snapshot.

## Write and authority rules

- Verified factual progress may update root `STATE.md` in the same turn without another approval.
- `DECISIONS.md` is append-only.
- A standing decision must name its authority; an agent without that authority may append only a clearly marked proposal.
- Contradictions are recorded rather than silently resolved.
- Connector failure or an empty search result never erases established state.
- Source transcripts remain immutable; derived scans and editorial work go only to declared output surfaces.

## Verification

- MyAgentRoom project-context tests: 9 passed; TypeScript typecheck passed.
- AgentHQ server shared-project tests: 4 passed; TypeScript typecheck passed.
- Telegram prompt and project-context tests: 9 passed; TypeScript typecheck passed.
- Full MyAgentRoom suite during this implementation: 1,549 passed, 12 skipped; broker, updater, desktop-viewer, and packaged-server checks passed.
- Full AgentHQ suites during this implementation: server 10 passed, Telegram 77 passed, mail gateway 3 passed.
- Live model-free probes confirmed that MyAgentRoom and Telegram both bind `Fierce Grace` to `ganga`, retain that binding for `continue`, and include both stable volume identities.

## Fable's reduction

Fable agreed with the shared external project mind but rejected prematurely building a large memory platform. The implemented minimum is the existing charter plus compact state, append-only decisions, stable artifact identities, one registry, and acceptance tests. Deferred until real use proves the need: `ARTIFACTS.yaml`, `EVENTS.jsonl`, semantic indexing, a Cartographer agent, and a standalone memory service.

## Next proof

Run one real, bounded Ganga source-scan mission from Telegram or MyAgentRoom. It must declare scope, preserve provenance, avoid silent sampling, write outputs into the canonical project root, and update `STATE.md` when verified. The result should be reviewable from either surface without Janua re-explaining the project.
