---
name: inbox-cleanup
description: "Inspect a connected inbox, classify messages, and propose a safe cleanup plan without changing mail."
---

# Inbox Cleanup

Use this skill when Janua asks to clean, organize, triage, or unsubscribe from
email. This first version is proposal-only.

## Contract

- Read only. Search connected Gmail or Proton mail using the local bridge.
- Never archive, delete, unsubscribe, create a filter, label, forward, send,
  or empty spam during inspection.
- Do not treat an empty search as proof that a category is absent. Report the
  exact query, account, and search limitation when results are uncertain.
- Protect security, billing, legal, personal, and active project mail from
  bulk recommendations unless Janua explicitly includes it.

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
- **Recommended cleanup:** safe candidates and the proposed action
- **Protected:** anything explicitly left untouched and why
- **Uncertain:** questions that require Janua's choice
- **Next step:** ask whether to prepare a separate approval for specific
  actions such as archive, label, unsubscribe, or filter creation

Keep the report short. Include message links or stable IDs only when they are
available and useful. Do not dump full email bodies or raw API responses.
