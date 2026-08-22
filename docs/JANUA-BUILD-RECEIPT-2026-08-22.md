# MyAgent Room build receipt — 22 August 2026

## Source and isolation

- Fork path: `/Users/janua/Projects/MyAgentRoom`
- Branch: `janua/myagent-room`
- Upstream remote: `https://github.com/milind-soni/OpenMausBot.git`
- Upstream base: `89d25ddca420d4e9728d95f02a03313ebbc5697e`
- Runtime data: `/Users/janua/.myagent-room`
- Existing `/Users/janua/Projects/AgentHQ` worktree: untouched and retained as rollback.

## Implemented

- MyAgent Room product name and isolated data home.
- Upstream release updater and hosted Composio broker disabled by default.
- Secret-free, idempotent Janua roster bootstrap.
- Wormhole Chief of Staff; Forge/Mailman on Codex Sol high; Signal/Ganga/Sensei on Claude high.
- All imported agents start with OpenMaus computer and Composio grants off.
- Append-only conversation-to-project bindings.
- Bounded canonical project state loaded before every private or room turn.
- Farmada critical-state and failed-search protection.
- Janua specification, runbook, attribution notice, and project registry example.

## Identity and action-safety wave

- Added an original code-drawn Mailman character: a running folded-letter spirit with a red
  satchel, its own silhouette, and idle/listening/thinking/working/waiting/success/failure/sleeping
  motion states. Mailman's live profile now selects it.
- Added a per-agent character picker plus optional `.riv` upload. Rive's runtime and WASM are
  lazy-loaded only for agents that actually use a Rive asset.
- Added the provider-neutral voice layer with ElevenLabs and xAI Text to Speech. Switching providers
  clears provider-specific voice selections instead of silently reusing an invalid voice id.
- Added optional per-agent email, phone, and WhatsApp identity fields. These are routing labels only;
  they do not grant sending authority or store provider credentials.
- Added durable, exact external-action receipts: an approval is bound to the SHA-256 hash of one
  payload, expires, records the approving identity and time, can be claimed once, and preserves the
  first provider receipt idempotently. Provider send adapters and the review UI are deliberately not
  connected yet.
- Added the Threshold Spirits identity direction and the Rive animation contract under `docs/`.

## Verification

- Untouched upstream `pnpm typecheck`: passed.
- Untouched upstream `pnpm build`: passed.
- Untouched upstream full `pnpm test`: Vitest floor stalled at zero CPU for four minutes before
  any fork changes; stopped and recorded as an upstream baseline issue.
- Fork targeted project-context tests: 7 passed.
- Fork relevant team/chief/model-switch tests: 32 passed across 5 files.
- Fork `pnpm typecheck`: passed.
- Fork `pnpm build`: passed; only the existing Vite large-chunk warning remains.
- Fork new-file lint: passed. Whole-repository lint still reports pre-existing upstream
  anti-slop violations.
- Idempotent bootstrap rerun: passed without duplicate agents or rooms.
- Headless Chrome visual acceptance at 1440×1000: title, six-agent sidebar, Chief of Staff,
  MyAgent Room, and Farmada conversation visible; zero console/page errors.
- Identity-wave focused tests: 136 passed across 8 files; focused HTTP integration tests: 5 passed.
- Identity-wave typecheck, production build, and `git diff --check`: passed.
- Headless Chrome visual acceptance: Mailman's original animated character renders in the live
  Agent profile and can be selected independently of the inherited mascot.

## Live vertical proof

1. Asked Wormhole for Farmada's verified state without email/browser tools.
2. Wormhole loaded canonical `STATE.md` and gave the correct three-response truth and next action.
3. Sent only `continue`; the persisted thread binding retained Farmada context.
4. Wormhole delegated evidence retrieval to Mailman.
5. Mailman initially found zero through the wrong Gmail identity and correctly stated that this did
   not contradict canonical Farmada state.
6. Mailman used the existing read-only gateway to recover all three real submissions and exclude
   Charlie's known test, with stable Gmail handles.
7. Wormhole delegated the evidence to Signal; Signal produced the requirements matrix.
8. Wormhole sent the conclusion to Mailman; Mailman produced the Dutch draft and did not send it.
9. Outputs were saved into Farmada and `STATE.md` was advanced explicitly.

## Honest blockers before cutover

- Exact hash-bound external action receipts and the one-shot claim gate now exist inside MyAgent
  Room. The human review card and real email/WhatsApp/phone provider adapters are not wired to that
  gate yet, so do not treat an in-chat “approved” message as permission to transmit from this fork.
- The live test proved Codex user plugins can remain available even when the OpenMaus Composio flag
  is off. Provider-native plugin/MCP isolation or an explicit allowlist is required before
  unattended operation.
- Telegram and iOS/Tailscale still need convergence testing against the same canonical threads.
- 24/7 work still depends on this Mac being awake until a controlled VPS worker exists.
