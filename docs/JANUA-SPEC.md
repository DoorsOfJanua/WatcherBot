# MyAgent Room — product and safety specification

## Product promise

MyAgent Room is the visual home for Janua's persistent agent team. Its first magic moment is
simple: mention a project once, then continue the conversation later without explaining the
project again. The room loads the project's current truth, decisions, owners, and open loops
before an agent answers or acts.

The OpenMausBot chassis supplies the agent roster, conversations, model switching, computers,
routines, delegation, permissions, and phone companion. Limen remains the canonical project
state layer. Telegram is a conversational doorway into the same agents and threads, not a
second memory system.

## Implementation status — 22 August 2026

Implemented and exercised locally:

- isolated MyAgent Room runtime data home;
- closed-by-default six-agent roster and Chief-of-Staff room;
- append-only conversation-to-project binding;
- live, per-turn canonical project-state reload;
- Farmada critical-state protection across a pronoun-only follow-up;
- Claude and Codex provider selection and bot-to-bot delegation.

Specified but not yet a MyAgent Room enforcement boundary:

- hash-bound external action receipts and approved email execution;
- Telegram thread convergence;
- native iOS/Tailscale pairing;
- Janua-owned connected-app broker;
- unattended/VPS worker and cross-surface audit UI.

Until those boundaries are ported and tested, OpenMaus permission cards are internal tool
permissions only. They must not be treated as sufficient approval for sending mail, publishing,
payments, deletion, or production changes.

Live-test finding: a local Codex CLI can expose user-installed Codex plugins (including Gmail)
even when the OpenMaus `composio` flag is off. Therefore `composio: false` currently means “do
not mount the OpenMaus Composio connection,” not “this agent has no app access.” Before unattended
operation, MyAgent Room must launch providers with an explicit per-agent plugin/MCP allowlist or
an isolated provider home. The UI must show effective access, not only app-mounted access.

## First protected vertical slice: Farmada

1. A message containing an unambiguous Farmada alias binds that conversation thread to the
   `farmada` project.
2. Every later turn in that thread loads `/Users/janua/Projects/FARMADA/STATE.md`, including a
   plain `continue`.
3. The state file outranks connector search results for project phase, decisions, and open
   loops. A mailbox `not found` result is evidence about that search, never permission to erase
   project truth.
4. Farmada remains critical and pinned until Janua explicitly records `paused` or `completed`
   with a reason.
5. Email retrieval and drafting are reversible. Sending an approved email is allowed only for
   the exact frozen draft whose action receipt Janua approved.

## Memory model

- **Conversation transcript:** complete chronological exchange for a bot task or room.
- **Bot memory:** compact personal preferences and durable facts in the bot's `MEMORY.md`.
- **Project state:** canonical current truth in the project's `STATE.md`.
- **Decisions:** settled choices in project decision files or the action ledger.
- **Evidence:** email, source material, research, and transcripts; evidence can update state only
  through an explicit synthesis step.
- **Binding log:** append-only record mapping a conversation thread to its active project.

No layer silently substitutes for another. Search failure does not delete state. A summary does
not replace evidence. An agent's private memory does not overrule a project decision.

## Authority and approvals

Agents may autonomously research, inspect, compare, draft, test, organize, and save work when
those actions are reversible. External or hard-to-reverse actions are parked for Janua.

An approval is valid only when its receipt identifies the exact operation and immutable payload:

- action type;
- target account and recipient/destination;
- frozen content hash and human-readable preview;
- expiry time;
- one approving identity and timestamp;
- one execution at most.

Editing a draft invalidates its approval. “Yes,” a reaction, or a general permission in another
thread is not enough unless the UI is answering that exact receipt. Sending after exact approval
is allowed and expected; the point is to stop at review, not to prohibit useful action forever.

## Data boundaries

- Runtime state defaults to `~/.myagent-room`, never `~/.openmausbot`.
- The project registry is local, owner-controlled, and contains absolute paths. It contains no
  credentials.
- Secrets stay in the operating-system credential store or dedicated connector stores and are
  never committed to this repository or copied from AgentHQ.
- Imported team manifests are persona-only. Connected apps and computer access are granted per
  agent after review.
- The upstream hosted Composio broker and release updater are not trusted as Janua infrastructure
  by default. They remain disabled until deliberately replaced or enabled.

## Nothing-drops invariants

- Critical work cannot disappear because time passed, a query returned zero rows, or an agent
  crashed.
- Every task has a stable identity, project, owner, state, and updated timestamp.
- Every handoff and external action has an observable receipt.
- Failures are visible and retryable; they are never presented as successful completion.
- Telegram, desktop, and phone views converge on the same canonical task and conversation state.

## Initial roster

- **The Watcher** — chief of staff and the default human entry point.
- **Forge** — builder and code owner.
- **Signal** — research, evidence comparison, and synthesis.
- **Ganga** — Ganga book/studio source work and editorial continuity.
- **Mailman** — stable mailbox retrieval, triage, drafting, and approved sending.
- **Sensei** — training plans, honest coaching, scheduled exercise windows, and follow-through.

Specialists get narrow charters and separate memory. The Watcher delegates and synthesizes; it does
not impersonate a specialist when one was explicitly addressed.
