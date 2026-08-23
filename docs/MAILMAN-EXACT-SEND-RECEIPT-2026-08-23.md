# Mailman exact-send receipt — 23 August 2026

## Outcome

Mailman can now propose a real email from MyAgent Room, show the complete frozen copy on desktop or
the paired iPhone, send exactly once only after Janua approves it, and return the provider receipt.
An ordinary chat message saying “approved” has no authority.

## Authority path

1. Only an agent with canonical memory identity `mailroom` receives `propose_email_draft`.
2. The harness normalizes From, To, Cc, Bcc, Subject, body, and the empty attachment list.
3. The full frozen draft is stored in `~/.myagent-room/mail-actions.json` with mode `0600`.
4. A separate durable action receipt binds SHA-256, sender, recipients, expiry, approver, and time.
5. Desktop and iPhone render one card with the complete copy and `Approve & send` / `Deny`.
6. Approval synchronously claims the receipt before the first provider await.
7. The AgentHQ Python gateway independently recomputes the same hash before Gmail or Proton Bridge.
8. Success consumes the receipt and writes the provider, account, message id, and accepted time.
9. A provider failure after claim never auto-retries. The transcript says to check Sent and create a
   fresh draft only when safe.

## Current sender allowlist

- `nils.palmen@protonmail.com` — Proton Bridge, send enabled.
- `doorsofjanua@gmail.com` — read only; not accepted as a sender until OAuth gains send/compose.

Override deliberately with `OMB_MAIL_SEND_ACCOUNTS`; this changes staging eligibility, not provider
credentials or the exact-approval boundary.

## Verification

- 11 focused action/receipt tests passed.
- 26 Codex driver tests passed; current MCP elicitation approval framing is pinned.
- 80 real harness HTTP tests passed.
- 177 paired-phone companion tests passed; the thread approval route is present in the paired-safe
  allowlist and the companion boots under Node's strip-only TypeScript runtime.
- Vite production renderer build passed.
- Live no-send rehearsal produced receipt `ar-cf4187a6-e6bf-49af-8ff7-c2e91ea7d7a9`, then denied it.
  Durable state is `dismissed` / `invalidated`, with no provider receipt.

No live email was sent during implementation or verification.
