# P8b Upstream Compare — 2026-08-30

Read-only recon for the P8b disposition table. Scope: four zones from the runbook
(VM/computer, delegations, auto-approve, attach/remote server mode). All upstream
refs verified against `upstream/main` = f084f3f79b15304362b3bfccd3a114b10979bbeb.
Our checkpoint = ab098c0 (`checkpoint: all lanes' in-flight work + today's single-instance
lock`); pre-checkpoint baseline = 0760625; common ancestor = 89d25dd.

## Commit-hash verification

Both runbook-cited hashes exist, are real, and are merged into `upstream/main`:

- `cd3221d` = `cd3221d23cfedf35ebed3579db9dedbd620b55c3`, "feat(computer): add secure
  VPS parity and companion uptime", 2026-08-25, merged via PR #458
  (`d206bca` "Merge pull request #458 from milind-soni/codex/vps-parity-companion-awake").
  `git merge-base --is-ancestor cd3221d upstream/main` → yes.
- `e73b250` = `e73b250ab252bb67a0e6853300b1b8bb26f25773`, "feat(comms): a delegation
  ledger — task ids, busy retries, durable receipts, and read-back tools",
  2026-08-29, merged via PR #566 (`79cb60c`). `is-ancestor` → yes.

No hash correction needed. Both citations in `docs/REBUILD_RUNBOOK_2026-08-30.md` P8b
are accurate.

---

## Zone 1 — VM/computer lane

**Verdict: BOTH, non-overlapping. No capability collision. Taking upstream cd3221d
wholesale does NOT lose any working local-VM capability** — upstream never touches
the files our local-Mac-permission/Firefox-profile/storage-diagnostics work lives in.
The two sides extended completely different sub-systems inside a shared filename.

`cd3221d` (23 files, 637 ins / 76 del — full stat via `git show --stat cd3221d`) is
exclusively about two things: (1) BYO-VPS Linux desktop viewer tunnels
(`server/vps-computer.ts` +231 lines: `vpsSshTunnelArgs`, `closeVpsDesktopTunnel`,
loopback port/tunnel plumbing) and (2) companion "keep awake"
(`electron/companion.mjs`: `companionKeepAwakeAtRest`/`rememberCompanionKeepAwake`;
`electron/main.mjs`: `powerSaveBlocker` wiring via `syncCompanionKeepAwake`). Per
`docs/byo-vps.md` (upstream/main): "OpenMausBot can turn a Linux server you already
own into a bot's computer. **The agent process stays on your machine**" — this is a
per-bot remote *desktop*, not a remote room-server. Zero overlap with Zone 4.

Our checkpoint delta (`git diff 0760625 ab098c0 -- server/container-computer.ts
electron/cua-macos-permissions.cjs electron/cua.mjs src/components/{LocalComputerSection,MacLocalControl,ComputerPanel}.tsx`,
157 lines across 6 files) is exclusively about the **local macOS** embedded-CUA
computer path:

| Capability | Ours | Upstream | Notes |
|---|---|---|---|
| Preflight-only macOS Accessibility/Screen-Recording check (no dialog spam) | YES — `electron/cua-macos-permissions.cjs:1-17` (new file), used from `electron/cua.mjs:79` | NO — upstream still calls `sdk.requestMacOSPermissions()` (prompts every launch): `electron/cua.mjs:184` on upstream/main | Ours only. Upstream's `cua-macos-permissions.cjs` doesn't exist (`git show upstream/main:electron/cua-macos-permissions.cjs` → missing) |
| On-demand Accessibility re-prompt IPC (`cua:mac-request-accessibility`) with 30s cooldown | YES — `electron/cua.mjs:108-132` | NO | Ours only |
| Typed `MacOSPermissionsRequiredError` with `reasonCode`/`missingPermissions` surfaced to renderer | YES — `electron/cua.mjs:49-59, 94-101` | NO | Ours only |
| Per-permission granular retry buttons in UI ("Allow Accessibility" / "Open Screen Recording" separately) | YES — `src/components/MacLocalControl.tsx:292-372` (rewritten) | NO — `MacLocalControl.tsx` has **zero diff** between 89d25dd and upstream/main (`git diff --stat 89d25dd upstream/main -- src/components/MacLocalControl.tsx` → empty) | Ours only; upstream never touched this file since the fork point |
| Firefox browser-profile persistence in the container image (alongside existing chrome/chromium) | YES — `server/container-computer.ts:156-172` (Dockerfile heredoc: `firefox_source`/`firefox_target` migrate block) | NO — `git show upstream/main:server/container-computer.ts \| grep firefox` → no hits | Ours only |
| Image/container storage-corruption diagnostics (`image_error`/`container_error` distinct from "not built yet") | YES — `server/container-computer.ts:180-227, 232-254` (`runtimeStorageError`) | NO | Ours only |
| Zero-byte OpenSSL base-image guard in the Dockerfile build | NO | YES — `cd3221d` added the `ssl_lib` size check to `managedImageDockerfile()` (upstream/main `server/container-computer.ts` lines ~120-135) | Upstream only; unrelated failure mode (bad base-image layer) from ours (runtime storage corruption) |
| `IMAGE_LAYER_VERSION` cache-bust discipline | Bumped 4→5 for the Firefox change (`server/container-computer.ts:145`) | Stayed at "4" even though upstream changed the Dockerfile recipe (`git show upstream/main:server/container-computer.ts \| grep IMAGE_LAYER_VERSION` → still `"4"`) | Not a capability gap — flagging as a merge-mechanics note: whoever ports Firefox+OpenSSL-guard together must bump the version once, not twice, or existing users get two rebuilds instead of one |
| VPS (remote Linux) desktop viewer tunnel + keep-awake | NO | YES — `cd3221d` | Upstream only, additive |

Our `electron/main.mjs`/`src/components/SettingsPanel.tsx` touches inside the same
checkpoint window (`git diff 0760625 ab098c0 -- electron/main.mjs
src/components/SettingsPanel.tsx`, 23 lines) are unrelated to the computer lane: the
single-instance lock (already resolved — see P3 log entry `1b02500`) and a
`ReplyApprovalToggle` mount gated on bot name containing "gemini" (ReplyGuy, a
separate P8b item). Noting so they are not silently miscounted as VM/computer scope.

---

## Zone 2 — Delegations

**Verdict: Upstream wins outright on substance; our delta is tiny and cosmetic.**
Confirms the runbook's framing. `e73b250` is a full rewrite (309 lines net, 280 ins /
29 del since 89d25dd) that ships a task-id ledger, bounded busy-retry (`MAX_BUSY_ATTEMPTS
= 3`), durable JSON receipts, and two new MCP tools. Our checkpoint touched only 13
lines (`git diff 0760625 ab098c0 -- server/delegations.ts`); our full delta since the
fork is 25 lines (`git diff 89d25dd ab098c0 -- server/delegations.ts`).

Exported-function diff (`git show <ref>:server/delegations.ts | grep -n "^export"`):

- Ours (ab098c0): `_loadPending`, `pendingThreads`, `queueDelegation`, `drainDelegations`,
  `discardDelegations`, `_pendingCount`, `_resetPending` — the pre-ledger shape.
- Upstream (main): all of the above **plus** `MAX_BUSY_ATTEMPTS`, `recordDelegationReceipt`,
  `findDelegationReceipt`, `pendingDelegationInfo`, `threadsWaitingOn`,
  `releaseDelegationsWaitingOn`, `pendingDelegationSnapshot`.

Capabilities ours has that theirs lacks (both are genuine but small; everything else
is superseded):

- `discardDelegations` returns the dropped count (`server/delegations.ts:199` in
  ours, `number` not `void`) and the count is actually consumed at
  `server/index.ts:3627` (`queuedDelegations += discardDelegations(...)`) to report
  how many queued handoffs were dropped across threads. Upstream's signature is
  still `void` (`git show upstream/main:server/delegations.ts | grep discardDelegations`
  → `export function discardDelegations(bus: CommsBus, threadId: string): void`).
- Brand-safe, shorter handoff prompt: ours reads `Hey ${target.name} — ${sender.name}
  here. I'm passing this your way.` (`server/delegations.ts:296`, comment above it at
  :291-293 explains why — avoids repeating routing prose the target's own persona
  contract already covers). Upstream's current prompt still says `[Delegated by
  @${sender.name}, another bot in this OpenMausBot workspace. Do the work and reply
  directly.]` (`server/delegations.ts:531` on upstream/main) — this leaks the
  upstream project name ("OpenMausBot workspace") into a peer bot's turn context,
  which is a real product/brand leak upstream still has and we don't.

Everything else in our version (queue/drain/discard mechanics) is the pre-ledger
implementation upstream has already superseded with receipts + retries; no other
ours-only capability found.

---

## Zone 3 — Auto-approve

**Verdict: the runbook's framing ("upstream wins on mechanism, port policy deltas
only") does not hold as stated — upstream never touched the shared mechanism file.
The two sides added two DIFFERENT, non-overlapping mechanisms on top of an identical
base. Neither should be discarded; they compose.**

`server/auto-approve.ts` at the common ancestor (89d25dd) is byte-identical to
`upstream/main`'s copy: `git diff 89d25dd upstream/main -- server/auto-approve.ts`
returns empty. Upstream added zero lines to this file since the fork. What upstream
actually added is a wholly separate file, `server/auto-review.ts` (109 new lines,
`git diff --stat 89d25dd upstream/main -- server/auto-review.ts`), which did not
exist at the fork point (`git show 89d25dd:server/auto-review.ts` → missing).

**Upstream's new mechanism — LLM-based review, live and wired:**
- `AutoReviewMode = "off" | "shadow" | "enforce"`, resolved per-bot from
  `asker.autoReview` (`server/auto-review.ts:6,29-31`).
- `shouldReview()` gates it to ordinary attended cards only — never unattended
  turns, never local-computer scope, only when the base guard already said
  `no-grant` (`server/auto-review.ts:36-43`).
- `requestReview()` asks the *same provider instance that opened the permission
  request* (no fleet fallback), 8s timeout (`AUTO_REVIEW_TIMEOUT_MS`), strict Zod
  schema on the JSON verdict (`allow: boolean, reason: string ≤200 chars`), fails
  closed (null) on timeout/malformed/extra-keys (`server/auto-review.ts:65-109`).
- Wired into `server/index.ts` on upstream/main: `import { requestReview,
  resolveAutoReviewMode, shouldReview } from "./auto-review.ts"` (line 22), called at
  lines 1226-1277 and 1589-1595 (`git show upstream/main:server/index.ts | grep -n
  "auto-review\|shouldReview\|requestReview"`), with verdict sources
  `auto-review-shadow` / `auto-review`.
- We have **no equivalent** — `server/auto-review.ts` doesn't exist in our tree at
  any point (`git show ab098c0:server/auto-review.ts` → missing).

**Our new mechanism — deeper static rule engine, not policy tuning:**
(`git diff 0760625 ab098c0 -- server/auto-approve.ts`, 179 lines; full delta since
fork 357 lines, `git diff 89d25dd ab098c0 -- server/auto-approve.ts`)
- New `OUTWARD` guard class (`server/auto-approve.ts:37-47`): send/post/publish/pay/
  purchase/delete verbs, tense-tolerant, checked against tool name AND summary —
  this is a new guard category upstream's base file has no concept of at all
  (upstream only has `DESTRUCTIVE` and `SENSITIVE`).
- `isReadOnlyShellCommand()` (server/auto-approve.ts:238-313): a real static shell
  analyzer — quote/escape-aware segment splitting on `&&`/`||`/`;`/`|`/newline
  (`shellSegments`, :130-157), command-substitution recursion into `$()`/backtick
  bodies (`extractShellSubstitutions`, :175-236), per-program allowlist
  (`READ_PROGRAMS`, :102-109) with per-program escape hatches for `find -delete`,
  `sort -o`, git subcommand allowlisting (`READ_GIT`, :118-121), `xargs` recursive
  classification, `curl` flag inspection for uploads, `sed -i` detection. This is a
  mechanism, not a tunable threshold — upstream has nothing like it.
- `policy-read` verdict source (:442-448): any bot, not just auto-mode bots, can have
  a provably read-only *non-command* request auto-approve, gated by `bot.silentReads
  !== false`.
- `trustedAutomationRead` context flag (:404-406, 449-468): server-scheduled
  missions/routines may auto-approve classified reads on unattended turns, which
  ordinary webhook-triggered unattended turns still cannot (kept separate from
  `unattended-block` deliberately, per the inline comment).
- `readOnlyBlocked` / `autoApproveReadsOnly` mode (:354-363, 419, 434-437, 498-506):
  a bot's auto-mode can be narrowed to read-only-only, with an explicit fix noted in
  the code (:498-503) for a real regression ("read-only auto mode re-carded a tool
  the user had already Always-allowed, on every single call").

**Related file `server/autonomy-outcome.ts`** (160 new lines, `git diff --stat 0760625
ab098c0 -- server/autonomy-outcome.ts`): this is NOT part of the auto-approve
permission mechanism — it's a structured "background job outcome" envelope parser
(status/changed/notify/summary/artifacts) wired into `server/routines.ts`,
`server/mission-execution.ts`, `server/monitor-evaluator.ts`, `src/lib/chat-blocks.ts`
(confirmed via `git grep -l AutonomyOutcome ab098c0`). It belongs to the P8 Routines
lane's item (d) "autonomy-outcome envelope", already dispositioned there. Upstream
has no equivalent anywhere (`git show upstream/main:server/autonomy-outcome.ts` →
missing; no `autonomy` hits in upstream server/ outside unrelated ACP driver files).

**Mechanism vs. policy, stated plainly:** there is no upstream mechanism upgrade to
"win" here — the base guard file is static on their side. The real choice is
additive: adopt upstream's `auto-review.ts` LLM-review layer (net-new, no conflict)
on top of, not instead of, our expanded static rule engine (`OUTWARD`, shell
read-only analyzer, `policy-read`, `trustedAutomationRead`). Discarding our
additions to take "upstream's auto-approve.ts" literally would regress live guard
coverage (no outward/financial/social-harm guard, no shell read-only classification,
no policy-reads, no trusted-automation-read path for missions) with nothing upstream
offers in exchange for that specific loss — their new capability lives in a
different file and answers a different question (should an ambiguous *attended*
card be waved through by an LLM) than ours does (is this request read-only /
outward / destructive by construction).

---

## Zone 4 — Attach/remote server mode (feeds P11)

**Verdict: No, upstream does not let a client point at a remote/existing server
today. The packaged app forks its own server and explicitly refuses to find one,
by design. Partial building blocks exist for the phone-to-desktop leg only.**

- `electron/main.mjs` (current worktree tree, = upstream/main base since our branch
  is unmodified there — confirmed no diff at HEAD vs upstream/main for this file
  pre-P8b) hardcodes self-spawn with a 3-port fallback ladder and treats any answer
  from another process as a conflict to be refused, not adopted:
  `startServerPackaged()` at `electron/main.mjs:872`, port loop `[8799, 18799, 28799]`
  at `:877`, and on total failure: *"Every OpenMausBot port answered health checks
  from another process — likely a second copy of the app... Quit that program, then
  quit and reopen OpenMausBot."* (`:919`). There is no code path that treats a
  healthy answer on 8799 as "attach to it" instead of "conflict, try the next port."
- No `OMB_SERVER_URL`-shaped env var, no remote-host config, anywhere in
  `server/`, `electron/`, `companion/`, `ios/`:
  `grep -rln "SERVER_URL\|API_BASE\|ROOM_SERVER\|serverHost\|remoteHost\|SERVER_HOST"`
  across those trees returns zero hits.
- Searched upstream log since fork for attach/remote-server work
  (`git log 89d25dd..upstream/main --oneline -i --grep="attach\|remote server\|remote
  host\|adopt.*server\|point.*server\|external server"`): only hits are UI
  *file-attachment* features (composer attach button, image attachments) — unrelated
  to server networking. No commit implements client-to-existing-server attach.
- `cd3221d` "VPS parity" (docs/byo-vps.md, upstream/main): *"OpenMausBot can turn a
  Linux server you already own into a bot's computer. **The agent process stays on
  your machine**... never runs an agent remotely."* This is confirmed **not** what
  P11 needs — it is a per-bot remote *desktop* (BYO-VPS Cua container), not a
  remote *room server*. Zone 1 and Zone 4 are unrelated capabilities that happen to
  share the word "VPS" in the runbook's citation.

**Partial building block that DOES exist — phone-to-desktop-companion addressing,
including Tailscale:**
- `companion/src/listener.ts` already discriminates the local machine's Tailscale
  address from LAN addresses for the phone-pairing QR/host list:
  `tailscaleAddress()` (:62-68, matches Tailscale's CGNAT range 100.64.0.0/10),
  `lanAddresses()` (:41-49, ranks real `en*` interfaces ahead of `utun`/VPN/bridge
  interfaces), plus MagicDNS name lookup and `tailscaleCandidates()` CLI-path probing
  (:87-101). This is real, upstream, and unrelated to any of our work (not present
  in our checkpoint diff at all).
- This solves *"what Tailscale address is this Mac reachable at"* for a phone
  dialing the **companion sidecar on the same Mac that also runs the harness**. It
  does not solve, and is not designed to solve, *"point the desktop app / iOS app /
  CLI at a harness running on a different machine (a Hetzner box) instead of its own
  loopback one."*
- `companion/src/proxy.ts` (upstream/main, :1-13, comment block) is explicit that the
  proxy always forwards to `127.0.0.1` on the same machine it runs on — by design,
  to satisfy the harness's own loopback-only DNS-rebinding defense — and states
  "Nothing upstream has to change, or even know this exists." This is architecturally
  the opposite of what a Hetzner-hosted harness needs (a client, anywhere, dialing a
  non-loopback harness address).

**What exists vs. what's missing, per P11's two goals:**

(a) Desktop app attaching to a local headless server instead of forking its own:
- Exists: nothing. `startServerPackaged()` has no "detect and attach" branch; a
  healthy foreign process on 8799 is treated as a conflict (see citation above).
- Missing: a client-mode path in `electron/main.mjs` that, given a healthy
  `/health`-style response on a configured port, skips `startServerPackaged()`
  entirely and just points the renderer's origin at it.

(b) Everything (desktop, phone via companion, browser) pointing at a Hetzner box
over Tailscale:
- Exists: Tailscale address *discovery* for the phone-pairing flow
  (`companion/src/listener.ts`), and the general MagicDNS/tailnet-awareness pattern
  it establishes, which a remote-server client mode could reuse for host advertising.
- Missing: everything else — no server-side config for "harness lives elsewhere,"
  no companion-proxy mode that forwards to a non-loopback harness (proxy.ts's whole
  design currently assumes same-machine loopback), no client (desktop/iOS/browser)
  concept of a remote harness base URL at all.

**iOS companion client does have a remote-endpoint concept — but it is upstream's
own hosted relay, not a self-hosted remote room server:**
`ios/Sources/CompanionCore/Endpoint.swift` defines `CompanionEndpointKind = hosted |
tailnet | lan | bonjour` (:6-10) with priority-ordered fallback
(`ios/Sources/CompanionCore/Client.swift`, `Failover.swift`). `hosted` means routing
through upstream's own control-plane/broker over HTTPS (`Models.swift:191`: *"harnesses
included) means the hosted Box; 'vps' means the user's own"* — i.e., `hosted` is
upstream's managed relay service, the same control-plane P2's privacy cuts
deliberately disable (`DEFAULT_COMPOSIO_BROKER_URL` empty, no hosted control-plane
enrollment on boot). This is **not** the P11 goal: it is upstream's own hosted relay
for pairing/connectivity, not a mechanism for a client to dial an arbitrary
self-hosted harness (a Hetzner box) directly. `tailnet` in this same enum is the
MagicDNS-name route for the phone-to-desktop-companion case described above — still
phone-to-companion-on-the-same-Mac, not client-to-remote-harness.

Not verified beyond this: the full iOS pairing/failover state machine
(`Failover.swift`, `Client.swift` internals) was read only for the endpoint-kind
vocabulary above, not exhaustively for every code path. If there is a deeper
mechanism there for redirecting a paired device to a self-hosted non-loopback
harness, it was not found by this pass and would need a dedicated iOS-focused read.
