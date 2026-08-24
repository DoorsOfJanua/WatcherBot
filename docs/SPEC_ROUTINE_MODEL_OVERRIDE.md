# Spec: Per-routine model + effort override

Status: READY FOR CODEX · 2026-08-24 · ruled by Janua (model routing inside the room)
Owner intent: routines are background work; they should run on the cheapest model that can do the job, while the bot keeps its smart model for live conversation.

## Problem
A routine turn runs on the bot's `modelSelection` (server/index.ts, `startTurn` path reads `bot.modelSelection`). Mailman's 2-hourly "Inbox watch" therefore runs at the bot's full model/effort. Triage is a mini-model task; talking to Janua is not. One knob for both is wrong.

## Behavior
1. `RoutineRecord` gains an optional `modelSelection?: { instanceId: string; model: string; effort?: string }` (same shape as `BotRecord.modelSelection`).
2. When a routine with an override fires, the turn runs with the override; the bot record is NOT mutated. A concurrent user conversation with that bot keeps the bot's own model.
3. No override → exactly today's behavior.
4. Validation on create/PATCH `/api/routines`: instanceId must exist in the registry, effort must pass the same `isEffortLevel` + adapter `effortLevels` checks the bot PATCH does (server/index.ts ~4070). Reject with the same error strings.
5. UI (RoutinesPage editor): a "Runs on" select in the routine editor, default "Bot's model", listing the same model catalog the bot settings use. Show the override in the routine row (small text under the schedule label, e.g. "runs on gpt-5.6-mini · low").
6. iOS companion: decode the new optional field tolerantly (unknown/absent → bot's model). Read-only display is enough.

## Where
- server/routines.ts: RoutineRecord type + cleanRoutine validation + pass-through on fire (the fire path calls back into index.ts; thread the override through that callback, do not import the registry into routines.ts).
- server/index.ts: the routine-fire → startTurn seam; startTurn (or its options) accepts an optional selection override.
- src/lib/routines.ts + src/components/RoutinesPage.tsx: type + editor + row label.

## Tests
- cleanRoutine rejects unknown instanceId / bad effort with the exact error strings.
- Routine fire uses the override; a simultaneous direct message to the same bot uses the bot's own selection (assert both spawn arguments).
- No-override routine byte-identical behavior to today (regression).

## Do not
- Do not mutate bot.modelSelection anywhere in the routine path.
- Do not add a fallback ladder (no "try cheap then retry expensive"). Escalation is a separate concern handled by delegate_bot in the routine prompt.

## After landing
Set the "Inbox watch" routine (id d287d951…, bot Mailman 490e02fc…) to the cheapest Codex-lane model at effort low. Report which model was chosen.
