---
name: inbox-cleanup
description: "Inspect connected Gmail or Proton mail, freeze an exact cleanup plan, then execute only the approved safe changes."
---

# Inbox Cleanup

Use this skill when Janua asks to clean, organize, triage, or unsubscribe from
email. It is a two-phase workflow: inspection creates a frozen plan; execution
requires Janua's explicit approval of that exact plan.

## Contract

- **Phase 1 — inspect and freeze:** Search connected Gmail or Proton mail using
  the local bridge. Classify messages, protect exclusions, and freeze the exact
  account, query, message/thread IDs, action, and expected count. Do not change
  mail in this phase.
- **Phase 2 — execute approved plan:** Only after Janua explicitly approves the
  frozen plan, execute those exact IDs and actions, then verify before/after
  counts and return a receipt. If the plan, IDs, account, or counts change,
  discard the approval and create a new plan.
- Allowed after approval: add/remove labels, move to folders, archive, move to
  Trash, mark read/unread, create a narrowly scoped filter, and follow a safe
  unsubscribe link. Gmail mutation requires `gmail.modify`; Gmail filter
  creation may require its separate settings permission or browser fallback.
  Proton Bridge may use its folder and read-state operations.
- **Connection fallback:** prefer the local Gmail/Proton connector. If a
  connector is missing, read-only, or cannot expose the needed operation, open
  the provider in the browser and let Janua complete login/2FA there. Never ask
  for a password or one-time code in chat. Continue with the same frozen plan
  only after the browser session is visibly authenticated and the account
  identity is verified.
- Never send mail, empty Spam/Trash, delete permanently, change permissions, or
  act on an unapproved item.
- Do not treat an empty search as proof that a category is absent. Report the
  exact query, account, and search limitation when results are uncertain.
- Protect human, personal, active project, financial, security, legal,
  account-access, and deadline mail from bulk recommendations and execution.
  An explicit request to include a protected item still requires it to be
  listed separately and approved item-by-item.

## Classification

Group results into:

1. Human replies needed
2. Security, billing, legal, or account notices
3. Active project/work mail
4. Receipts and records
5. Newsletters and promotional mail
6. Likely junk or automated noise
7. Uncertain — needs Janua's decision

Use sender, subject, labels, thread count, and a short excerpt as evidence.
Never infer from the sender alone when the message could be an invoice,
security notice, or project update.

## Return format

Return a compact report:

- **Snapshot:** account(s), search scope, messages reviewed, and date range
- **Groups:** count per group, with at most three representative examples
- **Frozen plan:** plan ID/hash, exact account, query, IDs, action per item,
  protected exclusions, expected counts, and expiry/recheck condition
- **Protected:** anything explicitly left untouched and why
- **Uncertain:** questions that require Janua's choice
- **Approval:** ask Janua to approve this exact frozen plan, or name the items
  to remove/change. Do not treat “looks good” or a new unrelated request as
  approval for a different plan.

## Execution receipt

After approval, return a short receipt: plan ID, account, attempted/completed/
skipped counts, every failed item and reason, final verification counts, and
any actions that were intentionally not attempted. Never claim a cleanup ran
from a local status update alone; verify against the live mailbox.

Keep the report short. Include message links or stable IDs only when they are
available and useful. Do not dump full email bodies or raw API responses.
