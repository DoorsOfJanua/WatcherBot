# Shared agent memory bridge

## Outcome

Sensei in Telegram, AgentHQ, and MyAgent Room is one canonical relationship identity (`coach`),
even though each surface may show a different conversation thread. The same mapping applies to the
rest of Janua's core roster.

## The three memory layers

1. **Relationship memory** — cross-surface conversation evidence for one agent. AgentHQ's local
   ledger is the bridge. MyAgent Room reads a bounded relevant window before each turn and mirrors
   new ordinary text turns back into that ledger.
2. **Bot memory** — the agent's short, editable `MEMORY.md` in its private workspace. This holds
   curated durable facts and preferences rather than the whole conversation stream.
3. **Project truth** — Limen/project `STATE.md` files. Decisions, current phase, evidence, and open
   loops belong here and outrank either relationship recollection or an old assistant reply.

## Identity map

| MyAgent Room | Canonical memory identity |
| --- | --- |
| Wormhole | `wormhole` |
| Forge | `forge` |
| Signal | `signal` |
| Ganga | `ganga` |
| Mailman | `mailroom` |
| Sensei | `coach` |

The identity is a nonsecret routing label. Changing it changes which private history can reach a
model, so paired/mobile profile writes are not allowed to edit it.

## Token and truth rules

- Load at most 14 turns, with a fair per-turn budget.
- Always retain the newest context and retrieve a few older turns by deterministic keyword/concept
  overlap. No extra model call is spent deciding what memory to load.
- Janua's turns may support recollection. Old agent replies are context only: they never prove a
  fact, decision, or completed action.
- Newer corrections win.
- Legacy internal Telegram wrappers and duplicate cross-surface turns are removed from recall.
- If AgentHQ is unavailable, the bridge fails closed and the agent keeps its local `MEMORY.md`; it
  does not invent shared memory.

## Transport behavior

- Telegram → AgentHQ already records turns in the local conversation ledger.
- AgentHQ → MyAgent Room is read-only prompt context over loopback.
- MyAgent Room → AgentHQ mirrors ordinary user and assistant text turns over loopback with stable,
  idempotent source references.
- AgentHQ's runtime supplies an agent-wide relationship window to future AgentHQ and Telegram tasks,
  while keeping the visible topic threads separate.

The bridge carries no credentials and grants no tools or external-action authority.

## Existing-history backfill

Run `node scripts/backfill-shared-memory.mjs` while both local servers are awake. The operation is
idempotent; it uses stable message references and can be repeated safely.

## Honest remaining gap

The two surfaces do not render one literally identical transcript yet. They share bounded
relationship memory while retaining separate visible threads. Telegram's nightly portrait job also
still derives from its own append-only Telegram memory ledger; MyAgent Room turns reach live
Telegram replies through AgentHQ, but are not yet evidence for that nightly portrait.
