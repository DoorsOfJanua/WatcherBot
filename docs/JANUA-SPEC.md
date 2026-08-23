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

## Roles, skills, routines, and approvals

These are separate layers and must not be collapsed into one prompt:

- A **role charter** defines who an agent is, what it owns, what good looks like, and where its
  authority stops. Choosing a role copies editable text into a bot profile; it grants no access.
- A **skill** defines one reusable process. “Save this process as a skill” drafts: when to use it,
  required inputs and access, sequence of work, validation, return value, and approval points.
- A **routine** defines when or on which event a proven skill runs. A routine is created only after
  the underlying process has succeeded under observation.
- An **approval receipt** binds an irreversible step to its exact payload and destination. Neither a
  role nor a skill may weaken that boundary.

The intended creation loop is: complete real work once, validate the result, save the method as a
skill, review its six-part contract, enable it for selected agents, then optionally schedule it.

### Teach a task

When visual teaching is available, it runs inside a one-to-one agent conversation with the computer
view. Janua first states the intended result, then demonstrates the visible workflow for at most ten
minutes. The capture records interaction, not audio or intent, so the review step must explicitly add:

- why an item is included or excluded;
- which missing input stops the workflow;
- what constitutes success and failure;
- recovery behavior for missing or changed sources;
- approval boundaries that cannot be inferred from clicks.

The generated skill remains a draft until it passes a safe example. Only a validated skill may be
offered for scheduling as a routine. In short: **skill = how; routine = when**.

### Multi-agent sequences before coordinators

New cross-agent work starts as an explicit pipeline, not autonomous orchestration:

1. one named source agent reads defined inputs and writes to one draft location;
2. one named review or communication agent reads that draft, changes only its owned layer, and
   writes to a separate review location;
3. one named human owner approves the final artifact or returns it with corrections.

Agents receive one lane and no overlapping write authority. A coordinator may route and synthesize
once the fixed sequence is proven, but it can never approve an external action proposed by itself or
its specialists.

### Routine freshness and evidence

Every event-triggered or time-sensitive routine names its exact source and event type, allowed and
prohibited actions, output schema, failure policy, and approval boundary. Before using current data,
it records the source timestamp and compares it with the declared freshness threshold. Stale or
missing data produces an explicit failure containing: source, expected timestamp, actual or last
successful timestamp, impact, and action taken. It is never silently reused as current evidence.

### Candidate workflow library

Examples gathered from field guides are retained as workflow candidates without turning every
example into another agent. The durable role owns the lane; the skill and routine hold the varying
task details:

- **Reproduce a staging bug** — Reproduction Specialist skill; ticket-triggered or manual; returns
  a timestamped repro pack and stops before any external engineering message.
- **Weekly marketing source brief** — Competitor Watch skill plus Monday routine; compares public
  announcements, pricing, and documentation against the previous verified snapshot.
- **Organize support without replying** — Support Organizer skill; event-triggered from a named
  queue; classifies and drafts while every reply remains gated.
- **Compare activation analytics** — Analytics Investigator skill; manual or scheduled; returns the
  largest measured step change, chart evidence, hypotheses, and next discriminating check.
- **Track documentation changes** — Documentation Tracker skill plus change or schedule routine;
  stores dated snapshots and drafts a changelog without publishing it.
- **Draft Gmail follow-ups** — Inbox Manager skill plus tag-specific event routine; reads the exact
  threads and creates traceable drafts, while sending requires a payload-bound approval receipt.

Each candidate must be completed successfully once with real inputs, reviewed, saved through the
six-part skill contract, and tested on a safe example before its routine can be enabled.
