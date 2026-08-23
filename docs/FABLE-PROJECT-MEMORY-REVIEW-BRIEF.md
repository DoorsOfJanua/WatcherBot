# Fable Follow-up: Project Intelligence Before Runtime Migration

## Why this follow-up exists

Janua agrees that MyAgentRoom can become the visible runtime and AgentHQ can become a headless service kernel, but he is not satisfied that a single mutable `STATE.md` is enough memory.

The failure is concrete: the two Fierce Grace volumes diverged because agents encountered different project names, directories, snapshots, decisions, and historical reasoning. Much of the right knowledge existed, but no mechanism reliably distinguished current truth from old analysis, or stable artifact identity from mutable labels such as `BOOK`, `BOOK2`, `VOL1`, and `VOL2`.

The user wants persistent project intelligence without placing the complete project history into every model prompt.

## Proposed correction to the previous architecture

For every real project, use a small canonical memory contract in the real project root:

1. `PROJECT.md`: slow-changing identity, purpose, vocabulary, invariants, creative laws, and authority boundaries.
2. `STATE.md`: compact current snapshot only: current verified state, active work, blockers, next actions, unresolved contradictions.
3. `DECISIONS.md`: append-only decisions with stable IDs, dates, authority, rationale, evidence, and `supersedes` links.
4. `ARTIFACTS.yaml`: stable artifact IDs and lineage independent of mutable titles, volume numbers, folder names, or publication order.
5. `EVENTS.jsonl` plus per-mission records: append-only machine-readable record of work, evidence, state-update proposals, approvals, outcomes, and artifact hashes.

Git supplies audit, ancestry, rollback, and provenance. Git is not used as the prompt-time query engine.

A rebuildable index supplies lexical/semantic retrieval. It is never canonical.

A shared Project Context Compiler gives Telegram, MyAgentRoom, Claude CLI, and Codex a bounded pack:

- always: project identity/invariants plus current state;
- selectively: relevant decisions, artifacts, recent related mission summaries, and evidence handles;
- raw source material only when the mission requires it;
- strict byte/token budgets and explicit truncation notices.

A Project Cartographer function runs after substantial missions. Cheap models may extract events and candidate facts. A strong model validates contradictions, artifact identity, editorial direction, and proposed canonical-state changes. Critical decisions are never silently promoted. The Cartographer is a system role, not necessarily another visible chat bot.

## Specific Fierce Grace hypothesis

Stable identities should represent the two works independently of labels:

- `fierce-grace-early-era`: publication label Volume One; corpus 1999-2021; currently reconstruction/scanning.
- `fierce-grace-late-era`: publication label Volume Two; corpus 2022-2026 plus explicitly grandfathered 2021 selections; currently print-ready or proof-gated according to canonical evidence.

Existing files to inspect include:

- `/Users/janua/Documents/Ganga-Mira-Book-Project/FABLE_DECISIONS_2026-08-04b.md`
- `/Users/janua/Documents/Ganga-Mira-Book-Project/VOLUME_BOUNDARY_2026-08-04.md`
- `/Users/janua/Documents/Ganga-Mira-Book-Project/08_PRINT/STATE.md`
- `/Users/janua/Documents/Ganga-Mira-Book-Project/STORY_SCAN_BRIEF.md`
- `/Users/janua/Documents/ganga-mira/AGENTS.md`
- `/Users/janua/_ganga_setup_stage/DECISIONS_LOG.md`

Relevant runtime code:

- `/Users/janua/Projects/MyAgentRoom/server/project-context.ts`
- `/Users/janua/Projects/MyAgentRoom/server/shared-agent-memory.ts`
- `/Users/janua/Projects/MyAgentRoom/server/index.ts`
- `/Users/janua/Projects/MyAgentRoom/server/bots-json.ts`
- `/Users/janua/Projects/MyAgentRoom/server/groups-json.ts`
- `/Users/janua/Projects/AgentHQ/hq-server/src/projects.ts`
- `/Users/janua/Projects/AgentHQ/hq-server/src/runtime.ts`
- `/Users/janua/Projects/AgentHQ/hq-telegram/src/executor.ts`

Relevant proven memory pattern:

- `/Users/janua/Projects/GroupBrain/docs/SPEC.md`
- `/Users/janua/Projects/GroupBrain/src/groupbrain/index.py`
- `/Users/janua/Projects/GroupBrain/src/groupbrain/vault.py`

## What Fable must decide

1. Is this strengthened contract correct, or is it overbuilt/wrong for Janua's creative project estate?
2. What exact canonical root and directory names should be used? Avoid a hidden shadow tree that humans do not naturally encounter.
3. Which records are append-only, which are mutable projections, and who may update each?
4. How should proposed state changes be promoted without requiring Janua to approve routine factual progress?
5. How should stable artifact lineage handle renames, splits, merges, publication ordering, source inheritance, and superseded drafts?
6. What must the first implementation include today, and what should explicitly wait?
7. What tests prove that Telegram, MyAgentRoom, Claude CLI, and Codex no longer confuse the two Fierce Grace volumes?

## Required response

Give one decisive verdict, then an exact minimum implementation contract. Name any correction to your previous recommendation. Do not edit any file, start services, migrate data, or expose secrets. This is the final architecture review before Codex implements the vertical slice.
