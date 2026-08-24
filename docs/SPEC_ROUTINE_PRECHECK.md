# Spec: Deterministic routine pre-check (zero-token skip)

Status: READY FOR CODEX · 2026-08-24 · ruled by Janua
Owner intent: a watch routine that asks "did anything change?" must not spend an LLM turn to find out nothing changed. The change detector is deterministic; the LLM runs only when there is something to look at.

## Problem
"Inbox watch" (Mailman, every 120 min) starts a full agent turn each mark: memory + history + inbox tool reads ≈ 150k+ input tokens, usually to conclude "Nothing new." Gmail exposes `historyId` (users.getProfile / users.history.list) that changes iff the mailbox changed; IMAP exposes UIDNEXT/HIGHESTMODSEQ. Comparing a counter costs zero tokens.

## Behavior
1. `RoutineRecord` gains optional `precheck?: { kind: "http"; url: string; jsonPath?: string } | { kind: "command"; command: string }`.
   - `http`: GET the url (loopback/local only, see Security), extract the value at `jsonPath` (dot-path) or the whole body.
   - `command`: run via `/bin/zsh -lc` with a hard timeout (10s), stdout (trimmed) is the value.
2. The engine stores the last seen value per routine (`precheckState` on the record, persisted in routines.json).
3. On fire: run the pre-check FIRST.
   - Value unchanged from last run → write a run receipt with a new status `"skipped"` and note "pre-check: no change", advance nextRunAt, spend nothing.
   - Value changed, errored, or first run → store the new value, start the turn as today. A broken pre-check must never silence a routine: error → run the turn and put the pre-check error in the receipt.
4. UI: RoutinesPage run history shows skipped receipts distinctly (muted, not as failures). Routine editor gets an optional "Only run when this changes" section (advanced, collapsed by default).
5. Interval skip-guard interaction: the existing "previous run still going" guard (server/routines.ts tick) runs before the pre-check; order: catch-up check → busy-guard → pre-check → queue.

## Security
- `http` pre-checks: allow only 127.0.0.1/localhost URLs. This is a local change detector, not a webhook system (webhooks already exist for push-style ingress).
- `command` pre-checks run as the user; the routine editor is already an authenticated local surface. Still: no shell interpolation of stored state into the command, pass nothing.

## Concrete first use (part of this task)
Wire "Inbox watch" to a Gmail change counter through the same account the mail tools use. Investigate what the existing mail MCP/bridge exposes; if it has no cheap counter endpoint, add a tiny local endpoint or script that returns `historyId` (Gmail API users.getProfile is one call). The deliverable includes the working pre-check on the live routine, verified by: (a) a fired mark with unchanged mailbox → skipped receipt, zero turn; (b) send yourself a mail → next mark runs a real turn.

## Where
- server/routines.ts: type, cleanRoutine validation, tick() ordering, precheckState persistence, receipt status.
- server/index.ts: nothing new expected beyond the receipt status passing through existing run APIs.
- src/lib/routines.ts + RoutinesPage.tsx: editor section + receipt rendering.
- iOS: tolerant decode; skipped receipts render as muted rows.

## Tests
- Unchanged value → skipped receipt, no turn started, nextRunAt advanced.
- Changed value → turn starts, state updated.
- Pre-check timeout/error → turn starts, error noted in receipt.
- http kind rejects non-loopback URLs at create/PATCH time.

## Do not
- No polling loops outside the routine marks; the pre-check runs at the mark, that's it.
- No third-party services. Local calls only.
