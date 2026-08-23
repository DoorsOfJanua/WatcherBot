# Fable Architecture Review Brief

## The decision

Design one durable architecture for Janua's personal agent system. This should be a system we can evolve without repeatedly replacing its foundations.

Do not edit code, restart services, migrate data, or expose secrets. Inspect the referenced local files, reason from the existing implementation, and return a concrete architecture verdict and staged migration plan.

## Desired experience

Janua wants to:

- Speak to the same persistent agent identities from Telegram and MyAgentRoom.
- Use Claude and Codex interactively in terminal/app sessions without creating separate, contradictory memories.
- Delegate real project work, leave the computer, receive progress updates, and return to evidence-backed results.
- Maintain an accurate written mental model for every project: its history, purpose, present state, decisions, open questions, next work, and possible future.
- Avoid explaining previously settled context again or watching agents act on stale chat history.
- Let agents research and revise their understanding when evidence changes.
- See agents, missions, conversations, approvals, and automated activity in a Grok-Bot-like room.
- Let specialist agents coordinate visibly while preserving one accountable owner per mission.
- Use cheap models for bounded scanning/extraction and strong models for synthesis, judgment, architecture, and high-stakes work.
- Require explicit human approval for irreversible actions such as sending, publishing, deploying, spending, deleting, or changing permissions.
- Eventually operate the system remotely from a phone and keep safe work running while the Mac is unavailable.

The "mental model" is semantic and written. It does not need to be a visual graph.

## Existing systems

### MyAgentRoom

Path: `/Users/janua/Projects/MyAgentRoom`

This is the preferred UI and chassis, forked from OpenMausBot. It directly launches Claude and Codex agents and already supports persistent sessions, rooms, delegation, routines, computers, and approval cards. It currently has a project-context layer and a relationship-memory bridge, but project binding is incomplete. Its current project registry contains only Farmada, and the Ganga agent currently works in an isolated MyAgentRoom workspace rather than the real Ganga project.

Read:

- `/Users/janua/Projects/MyAgentRoom/docs/JANUA-SPEC.md`
- `/Users/janua/Projects/MyAgentRoom/docs/SHARED-MEMORY-BRIDGE.md`
- `/Users/janua/Projects/MyAgentRoom/server/project-context.ts`
- `/Users/janua/Projects/MyAgentRoom/server/shared-agent-memory.ts`
- `/Users/janua/Projects/MyAgentRoom/.impeccable.md`

### AgentHQ and Telegram

Path: `/Users/janua/Projects/AgentHQ`

AgentHQ is the older backend/UI. Its frontend is not preferred, but it owns useful infrastructure: Telegram routing, a job ledger, reminders, memory, Mailman gateway, approvals, a conversation ledger, and a project registry. It independently launches Claude and Codex work, which overlaps with MyAgentRoom. Existing jobs are not project-bound. Telegram stores local memory and mirrors conversation turns into AgentHQ. AgentHQ's runtime injects shared relationship context, so the bridge is more complete than a superficial audit suggests, but project state remains fragmented.

At review time the Telegram polling bot is running and its worker is not, so jobs can queue without being executed. This is an operational supervision problem, not merely a memory problem.

Read:

- `/Users/janua/Projects/AgentHQ/README.md`
- `/Users/janua/Projects/AgentHQ/docs/HQ-MEMORY-SPEC.md`
- `/Users/janua/Projects/AgentHQ/docs/SHARED-CONVERSATION-SPEC.md`
- `/Users/janua/Projects/AgentHQ/docs/HQ-TELEGRAM-SPEC.md`
- `/Users/janua/Projects/AgentHQ/hq-server/src/runtime.ts`
- `/Users/janua/Projects/AgentHQ/hq-server/src/projects.ts`
- `/Users/janua/Projects/AgentHQ/hq-telegram/src/executor.ts`

### Obsidian, LifeOS, and Limen

Relevant roots:

- `/Users/janua/Documents/LifeOS`
- `/Users/janua/Documents/lifeos-backend`

Obsidian/LifeOS is the durable human-readable brain. Limen provides a vault adapter, project sync, canonical task primitives, retrieval, and other kernel services. MyAgentRoom and Telegram already use parts of Limen retrieval, but Limen does not yet uniformly own the current project state used by all surfaces.

### Wormhole

Path: `/Users/janua/Projects/wormhole`

Wormhole is a Git coordination membrane with durable outboxes, state/backlog files, claims, and a local bus. Its own design says project files and Obsidian are durable while account memory is temporary. It should not accidentally become another competing brain.

Read:

- `/Users/janua/Projects/wormhole/README.md`

### Claude and Codex

Interactive Claude terminal sessions have Claude auto-memory, `claude-mem`, and session handoff behavior. Interactive Codex sessions have their own threads, configuration, and skills. AgentHQ and MyAgentRoom also invoke Claude/Codex separately, sometimes with different model defaults. We need a shared project contract that works across these entry points without pretending every vendor session has one native memory.

### Agent Computer

A persistent Playwright browser service exists locally at `127.0.0.1:4100`. It should be an execution capability controlled by missions and approvals, not the canonical source of truth.

## Product principles

Read `/Users/janua/app.md` and treat it as the product filter for the consumer-facing experience.

## Questions Fable must answer

1. What is the one canonical system of record for each of these: personal/relationship memory, project mental model/state, conversations, missions/jobs, tasks, research/evidence, actions/receipts, and approvals?
2. Should MyAgentRoom replace AgentHQ as the runtime, should AgentHQ become a headless kernel behind it, or should both become adapters over a smaller canonical kernel? Choose one and explain the tradeoff.
3. What exact role should Obsidian/Limen play? What exact role should Wormhole play?
4. How do Claude terminal, Codex terminal/app, Telegram, and MyAgentRoom read and update the same project truth without copying entire chat logs into every prompt?
5. Define the smallest practical project file/data contract. Reuse current repositories and files where sensible; avoid creating a second shadow project tree.
6. How should provisional observations, confirmed facts, decisions, contradictions, superseded state, and agent-generated hypotheses be represented and promoted?
7. How should mission execution, progress updates, delegation, resumption, receipts, and approval gates work?
8. What should be kept, moved, adapted, or retired from MyAgentRoom, AgentHQ, Limen, Wormhole, and the Telegram bridge?
9. Give a reversible migration sequence with a coexistence period, validation tests, and rollback points. Account for existing history and queued jobs.
10. Define service supervision for a dependable local system now and an always-on/remote version later.
11. Define privacy, security, credential, and irreversible-action boundaries.
12. Define economical context assembly and model routing.
13. Name the few decisions that genuinely require Janua's judgment.
14. Recommend the first end-to-end proof mission, preferably using the Ganga book/source material, and state the acceptance test.

## Required answer shape

Lead with a decisive recommendation. Be candid about what is currently duplicated or structurally wrong. Then provide:

1. The target architecture.
2. The canonical ownership table.
3. The project memory contract.
4. The mission and approval lifecycle.
5. The migration sequence.
6. Validation and rollback tests.
7. The first proof mission.
8. Decisions needed from Janua.

Do not provide vague "it depends" alternatives without choosing a default. Do not implement anything during this review.
