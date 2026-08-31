# P8b Checkpoint Disposition Table — 2026-08-31

Scope is exactly `git log 89d25dd..ab098c0` and `git diff --name-only 0760625 ab098c0`. Rulings in the rebuild runbook are final. A `ported` reference names a commit on `rebuild/upstream-2026-08-30`; an upstream hash names retained equivalent behavior. Mixed files state both the retained and excluded hunks.

Verified inventory: **58 commits** and **97 files**.

## Commit disposition (58/58)

| Checkpoint commit | Subject | Fate |
|---|---|---|
| `c70c28c254674d2603bb9565a4a881a4898034d4` | feat: establish MyAgent Room project memory foundation | superseded by `811daaf` and `db1546d` — branding and memory foundation were split across P1/P5. |
| `93d70cdb52eae80e81fc1e7b24cde71e7352343b` | feat: add agent identities voice and action receipts | ported `af6128e` — identity, voice, profiles, and action receipts. |
| `58e080f1c739dcfd822d41c96a31fb69168898ec` | feat: share agent memory across Telegram and room | ported `db1546d` — shared agent memory bridge. |
| `aad6790bff0b17bafc80981cd84601ff9f6abfe9` | feat: Agent Spirits workshop with hooded sacred-geometry avatar family | ported `8cca920` — Agent Spirits workshop and hood family. |
| `5a4b0d3df63ca25b6ed9108750aa7f9528410a44` | fix: freeze transitions in spirit still mode, drop dead hood brush rule | superseded by `522efb9` — later P4 shared-file checkpoint contains the final still-mode CSS. |
| `be6fb00abc06bc840ac613181544b6dbd7fcdbdc` | feat: alien spirit family (the Visitors) as workshop Direction C | ported `62d05b1` — Visitor/alien spirit family. |
| `6f7b74dd5678def09f56a1b143f3471f51dde1bc` | feat: alien eyes reworked to canonical void-black almonds | superseded by `a0ce07c` — later clean-face pass contains final eye geometry. |
| `fc17c1e1a844ecce02f44569c26ae464776e96c6` | feat: clean alien faces, crown stalks, and mood mouths | ported `a0ce07c` — final alien face/crown/mouth pass. |
| `1fd05ebe8580d4a8ecf2e8b57babed0a6567f6bf` | fix: escape alien head-scale group from ambient transform-origin | ported `324e339` — transform-origin fix. |
| `6bbb515cda00398aeea3ad797e5f86e4f861b9b8` | checkpoint: HoodSpirit shared-file state (Codex watcher/crossfade + Fable reference-cape geometry) | ported `522efb9` — HoodSpirit shared-file checkpoint. |
| `28716758b1afd75e87fe2fd18cbfe6ef30bb11c5` | feat: hood reference pass - cape layer, soft-diamond face, deep brow, full size | ported `75fd7db` — hood reference pass. |
| `484a3fd68736806525958701e3e119c38ff98a5b` | feat: hood face as elongated diamond, rounded peak | ported `bd580e6` — elongated hood face. |
| `97012a0e63aade540247e76b0a67fce1f2c707c4` | tweak: face diamond wider side points, slightly bigger | ported `edf59a8` — wider face-diamond tweak. |
| `90b6dd182f57d83b55522fa4776fb3c2dd508e6a` | tweak: heavier hood base, wider lower flanks, bottom dropped | ported `15b7f9a` — heavier hood base. |
| `3afbc37ae3bfb853ab0cd2371a85366352a1fc27` | tweak: tuck chin inside hood, narrower shoulders, torso slither, bench guard for expression stack | ported `0eb7f53` — chin/shoulder/torso and guard. |
| `5af71c26a2d56ec705e63989f177e617abf00293` | feat: ring comet replaces static dots, Sri Yantra for Ganga, faces fully clean | ported `154766b` — ring comet and Sri Yantra. |
| `af8906c65ee28fd93e52827e27870786220bcc1c` | feat: checkpoint WatcherBot agent room platform | superseded by `811daaf` through `607b9f1` — umbrella checkpoint decomposed across P1–P6b and upstream. |
| `510f2e7ca9f4af9f081b359cedc8b61c176bd129` | feat: add editable agent role library | ported `0cd1217` — editable role library. |
| `0f3b6ccb9cabf05b5e661806f4ee4d9a8ea80897` | feat: add SOTA inspector role | ported `eeb7fbc` — SOTA inspector role. |
| `39b4896d17093af4c78c82bb7a4978a1f1f650d1` | fix: keep new-agent editing state stable | dropped — upstream removed the old NewAgentDialog flow, leaving no target. |
| `38121b49e3a3e15bd64634e055abb22e1101c15d` | Add editable Mailman draft revisions and style learning | ported `1c791f4` — Mailman drafts and style learning. |
| `9e6b412e272df26b5bfe7e562446784092035c35` | Rename iOS app to WatcherBot and persist agent selection | superseded by `762781d` and `c32cad5` — P7 kept upstream pairing and reapplied WatcherBot/spirit state. |
| `a3c83e80bb7a97ba6318b50ddaf72c1e65550bce` | Fix dictation loss and add iPhone voice input | superseded by `0067ab1` and upstream `87d87f8` — timestamp anchoring ported; upstream voice UI retained. |
| `1a9282de4454926e075fd8a62dcae329d5401ac1` | Anchor iPhone dictation to audio timestamps | ported `0067ab1` — audio-timestamp dictation anchoring. |
| `f0d2febb8bed5941e6fa39eeb461b924c83a3e8a` | Add agent attention tray and finish mobile chat polish | ported `b88300a` — desktop attention tray; P7 retained upstream mobile chat. |
| `8e939f7cddcb4b999df0c2257446b48f08192c94` | Show agent spirits in delegation receipts | ported `7741890` and `c32cad5` — spirit identity in receipts and iOS. |
| `b95f40f4669b3c61a778c22b208843f9f48c6714` | Keep agent spirit through profile edits | ported `e143163` — spirit survives profile edits. |
| `e7d67b11547448dec8c3eb356adbc8e817736d71` | Clean code from iPhone notifications | dropped — P7 retained upstream iOS notification transport. |
| `03bb8b286ee015728852bd87e5ecba0aebc392dd` | Clean code from live activity alerts | dropped — P7 retained upstream Live Activity transport. |
| `1b3ab279c4516e2672ca9d324020b8720e98aaad` | Persist living spirit edits from iPhone | ported `84b245a` and `c32cad5` — persisted iOS spirit edits. |
| `18b358b7fe01d75195312596fc08ee62d1e0c32e` | Make spirit selection replace legacy avatar | superseded by `c32cad5` — persisted-spirit renderer replaces the legacy avatar. |
| `ea9d4e7013a634147726a2180c27a0ef92d597ca` | Add visible reconnect control to iPhone roster | superseded by upstream `4130e50` — multiple paired computers replace single reconnect control. |
| `4a16363f77c56d6731e2cf55349477781f50f513` | Clarify agent coordination permission setting | dropped — copy targeted a settings layout replaced upstream. |
| `0d773a71a4dc8a70283e8778c7384354c6454d95` | Expose peer messaging permission on iPhone | dropped — P7 retained upstream iOS coordination controls. |
| `9a4d2ad6b200910cd530138d94ed826b89100a57` | Add animated agent attention beacon | ported `b88300a` — attention beacon/card readability. |
| `b74adaa6a35825cda953dfa117f96234b947cc0d` | Improve agent attention card readability | ported `b88300a` — attention beacon/card readability. |
| `feb33f120b9492f20fdb78c4398336f85bd64104` | Open email drafts in focused editors | ported `1c791f4` and `dd7b2ee` — focused Mailman approval presentation. |
| `d569b8c20c92bc88de0114e0011ac97222f103c9` | Add concise pre-work acknowledgements | ported `d705f2d` — concise acknowledgements and restrained delight. |
| `091bba5bb8fcce4e805d3f47a344f914f510876f` | Let agents mirror user delight with emoticons | ported `d705f2d` — concise acknowledgements and restrained delight. |
| `0ba18cee3956d72eb684bcfb5fcfdf8790d2515c` | Add cheap delight emoticons in reply pipeline | ported `d705f2d` — concise acknowledgements and restrained delight. |
| `d7a7dbf9d72d1f7c7fe21a9b9aa2367ec551a249` | Full-auto approvals, convo-mode decluttering, and today's session work | ported `63c9107`, `dd7b2ee`, and `607b9f1` — local auto-mode/approval/conversation deltas. |
| `58a3d98e65750c67c429354d38fa3541610aa4a0` | docs: friend agent pack + universal skill library design spec | superseded by `0cd1217` and `db1546d` — pack design was realized by canonical roles/memory. |
| `95b9b49488a603174de2cd7a385641f293730810` | docs: spec amendment — universal-first ruling + verified connector inheritance | superseded by `0cd1217` and `db1546d` — pack design was realized by canonical roles/memory. |
| `f73fd40dda0636cae790aa7e9181723ac237fca4` | docs: reconciliation pass complete — 10 deltas absorbed into pack design | superseded by `0cd1217` and `db1546d` — pack design was realized by canonical roles/memory. |
| `0c35b2cf4bee77b6e9126a4db335eb6dedc003ba` | docs: skill library v2 + tool selector implementation spec | superseded by upstream `3f239a3` and P5 `0cd1217` — current skill controls and role library replace the spec. |
| `460c0171bd7b854d63f4ec3b4ad20dbdd832c347` | docs: live verification results — connector test passed, pack provisioned | dropped — historical live-verification evidence is environment-specific. |
| `afd5be63df8b39f01ee1cf47129e984434497b58` | Workbench v1: per-bot Computer/Browser/Files panel, read-only workspace API, thread-cache eviction | superseded by upstream `0b25b0f` and `164e5d7` — newer built-in browser/computer workbench. |
| `0ae3f315dd5dfc502c151d50b758ab079b8665be` | Checkpoint: parallel-session work in flight | superseded by `e1d4876` through `607b9f1` and P7/P8 — parallel checkpoint decomposed by area. |
| `cb8f10da7127b8a6fe2e3b98d6bd16cc09fb351d` | Improve agent approvals and public profiles | ported `dd7b2ee` and `2a45d10` — public profiles/approvals and remaining label helpers. |
| `05ffbb043d9f5d13c1ced3f6fb073bd0b92a215a` | Upgrade inbox cleanup to approved two-phase workflow | ported `dd7b2ee` — safe two-phase inbox and approval polish. |
| `a06fc53a2980a2af8f49fb44185669929fda5810` | Polish approval cards and inbox cleanup | ported `dd7b2ee` — safe two-phase inbox and approval polish. |
| `8d411ad7a0d14599ad973de827822af1c8f1cef1` | Document canonical Limen mail routing | ported `8e92574` — canonical Limen routing/onboarding. |
| `6f38f9bbf7f92377db52fe4c762e68f490430e3f` | Add canonical vault onboarding for hosted setups | ported `8e92574` — canonical Limen routing/onboarding. |
| `63ee99adf525489f1a18faa1d7577ae1bc4aec51` | Explain private Limen brain during onboarding | ported `8e92574` — canonical Limen routing/onboarding. |
| `d770f6cee04081ddde87de52df0e0fa5377af93f` | Add isolated workspace roadmap | dropped — historical roadmap outside the ruled runtime rebuild. |
| `eab3ad047f1204573c827cf3decc5c5f3ed911c4` | feat: mount Ganga Studio, and let the phone review and approve it | ported `e1d4876` — Ganga Studio and phone approval. |
| `07606259d930b1d1783f8ed22a2a32ed10482b9f` | feat: show pixels a tool returned in the thread | ported `607b9f1` — tool-result pixels. |
| `ab098c060a452285e338bbba85a13d4a94ce383e` | checkpoint: all lanes' in-flight work + today's single-instance lock — fallback point before upstream rebuild | ported `391e945` through `2a45d10` — ruled P8b hunks split into six area commits; exclusions below. |

## File disposition (97/97)

| Checkpoint-diff file | Fate |
|---|---|
| `.impeccable.md` | dropped — design-tool instructions are not runtime source. |
| `companion/src/routes.ts` | dropped — post-P7 phone organization/ReplyGuy proxy was outside the explicit P8b ReplyGuy file set. |
| `companion/test/routes.test.ts` | dropped — post-P7 phone organization/ReplyGuy proxy was outside the explicit P8b ReplyGuy file set. |
| `electron/capabilities.cjs` | ported `82770c0` — local macOS permission lane. |
| `electron/capabilities.test.mjs` | ported `82770c0` — local macOS permission lane. |
| `electron/cua-macos-permissions.cjs` | ported `82770c0` — local macOS permission lane. |
| `electron/cua-macos-permissions.test.mjs` | ported `82770c0` — local macOS permission lane. |
| `electron/cua.mjs` | ported `82770c0` — local macOS permission lane. |
| `electron/main.mjs` | superseded by `1b02500` — upstream single-instance lock retained in P3. |
| `electron/preload.cjs` | ported `82770c0` — local macOS permission lane. |
| `ios/App/ChatListView.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/App/ChatView.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/App/MarkdownText.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/App/Session.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/App/Updates.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/App/UpdatesSheet.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Sources/CompanionCore/ChatPresentation.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Sources/CompanionCore/Client.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Sources/CompanionCore/Models.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Tests/CompanionCoreTests/ChatPresentationTests.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Tests/CompanionCoreTests/ConnectionTransportTests.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Tests/CompanionCoreTests/DecodingTests.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/Tests/CompanionCoreTests/ProfileClientTests.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/UITests/CompanionConnectionUITests.swift` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `ios/project.yml` | dropped — final P7/P8b rulings retain upstream mobile and exclude the checkpoint's later folder/ReplyGuy/reconnect additions. |
| `server/auto-approve.test.ts` | ported `bc76605` — complete static approval policy and tests. |
| `server/auto-approve.ts` | ported `bc76605` — complete static approval policy and tests. |
| `server/autonomy-internal-api.test.ts` | dropped — instantiates the separate MonitorManager rejected by P8; production projection was adapted in `2a45d10`. |
| `server/autonomy-outcome.test.ts` | superseded by `a287ba3` — retained envelope is covered through routine integration tests. |
| `server/autonomy-outcome.ts` | ported `a287ba3` — autonomy outcome envelope. |
| `server/comms.test.ts` | ported `7958532` — short brand-safe handoff was already landed. |
| `server/container-computer.test.ts` | ported `82770c0` — Firefox persistence, diagnostics, and exactly one 4→5 layer bump. |
| `server/container-computer.ts` | ported `82770c0` — Firefox persistence, diagnostics, and exactly one 4→5 layer bump. |
| `server/contracts.ts` | ported `bc76605` — policySummary; earlier contract hunks landed in `e1d4876`, `607b9f1`, and `a287ba3`. |
| `server/delegations.test.ts` | ported `c8c7092` — used drop count on upstream ledger. |
| `server/delegations.ts` | ported `c8c7092` — used drop count on upstream ledger. |
| `server/drivers/agents-proxy.test.ts` | ported `936b052` — only behavior without upstream equivalents. |
| `server/drivers/agents-proxy.ts` | ported `936b052` — only behavior without upstream equivalents. |
| `server/drivers/claude.test.ts` | ported `936b052` — only behavior without upstream equivalents. |
| `server/drivers/claude.ts` | ported `936b052` — only behavior without upstream equivalents. |
| `server/index.test.ts` | superseded by `a287ba3`, `34f2ac6`, and `46a50fc` — focused P8 tests replace monolithic cases. |
| `server/index.ts` | ported `391e945`, `bc76605`, `936b052`, and `2a45d10`; P8 wiring was already in `a287ba3`, `34f2ac6`, and `46a50fc`. |
| `server/mission-dispatcher.test.ts` | ported `46a50fc` — mission scheduler, state, execution, and coverage. |
| `server/mission-dispatcher.ts` | ported `46a50fc` — mission scheduler, state, execution, and coverage. |
| `server/mission-execution.test.ts` | ported `46a50fc` — mission scheduler, state, execution, and coverage. |
| `server/mission-execution.ts` | superseded by `46a50fc` — execution intentionally routes through upstream routine receipts. |
| `server/missions.test.ts` | ported `46a50fc` — mission scheduler, state, execution, and coverage. |
| `server/missions.ts` | ported `46a50fc` — mission scheduler, state, execution, and coverage. |
| `server/monitor-evaluator.test.ts` | ported `34f2ac6` — routine-precheck monitor evaluator/adapter. |
| `server/monitor-evaluator.ts` | ported `34f2ac6` — routine-precheck monitor evaluator/adapter. |
| `server/monitor-http-adapter.test.ts` | ported `34f2ac6` — routine-precheck monitor evaluator/adapter. |
| `server/monitor-http-adapter.ts` | ported `34f2ac6` — routine-precheck monitor evaluator/adapter. |
| `server/monitor-runner.test.ts` | superseded by `34f2ac6` — routine precheck tests replace the parallel runner. |
| `server/monitor-runner.ts` | dropped — final P8 ruling rejects a separate monitor manager/runner. |
| `server/monitors.test.ts` | dropped — final P8 ruling rejects a separate monitor manager/runner. |
| `server/monitors.ts` | dropped — final P8 ruling rejects a separate monitor manager/runner. |
| `server/notify.test.ts` | superseded by `34f2ac6` and `46a50fc` — updates use routine receipts/source-conversation reporting. |
| `server/notify.ts` | superseded by `34f2ac6` and `46a50fc` — updates use routine receipts/source-conversation reporting. |
| `server/project-mcp.test.ts` | dropped — unruled hard-coded private-project launcher delta; internal P8b ReplyGuy workflow is retained. |
| `server/project-mcp.ts` | dropped — unruled hard-coded private-project launcher delta; internal P8b ReplyGuy workflow is retained. |
| `server/replyguy.test.ts` | ported `391e945` — ReplyGuy server workflow whole. |
| `server/replyguy.ts` | ported `391e945` — ReplyGuy server workflow whole. |
| `server/routines.test.ts` | ported `a287ba3`, `34f2ac6`, and `46a50fc` — upstream engine plus ruled additions. |
| `server/routines.ts` | ported `a287ba3`, `34f2ac6`, and `46a50fc` — upstream engine plus ruled additions. |
| `server/store.ts` | superseded by `a287ba3` and `46a50fc` — current receipts replace checkpoint provenance union. |
| `server/testing/fake-claude-cli.ts` | superseded by `a287ba3` and `46a50fc` — focused P8 fixtures replace env-triggered branches. |
| `server/tool-label.test.ts` | ported `2a45d10` — human tool/card summaries required by attention. |
| `shared/tool-label.ts` | ported `2a45d10` — human tool/card summaries required by attention. |
| `src/components/ApprovalCard.tsx` | dropped — later technical-details restyle was outside the final P8b list; P6b approval UI remains. |
| `src/components/AutonomyPanel.tsx` | ported `2a45d10` — watcher/mission overview. |
| `src/components/ChatMarkdown.tsx` | ported `391e945` and `2a45d10` — ReplyGuy deck and hidden autonomy blocks. |
| `src/components/ChatView.tsx` | ported `391e945` — ReplyGuy thread context; unrelated restyle dropped. |
| `src/components/Composer.tsx` | dropped — later technical-details restyle was outside the final P8b list; P6b approval UI remains. |
| `src/components/ComputerPanel.tsx` | ported `82770c0` — typed local-Mac permission UX. |
| `src/components/GroupView.tsx` | ported `391e945` — ReplyGuy room context; unrelated bubble restyle dropped. |
| `src/components/LocalComputerSection.tsx` | ported `82770c0` — typed local-Mac permission UX. |
| `src/components/MacLocalControl.tsx` | ported `82770c0` — typed local-Mac permission UX. |
| `src/components/Onboarding.tsx` | dropped — checkpoint mascot swap was outside P8b; Limen onboarding remains `8e92574`. |
| `src/components/OptionCard.tsx` | dropped — later technical-details restyle was outside the final P8b list; P6b approval UI remains. |
| `src/components/PendingApproval.tsx` | dropped — later technical-details restyle was outside the final P8b list; P6b approval UI remains. |
| `src/components/ReplyApprovalToggle.tsx` | ported `391e945` — ReplyGuy policy/deck/parser integration. |
| `src/components/ReplyDraftDeck.tsx` | ported `391e945` — ReplyGuy policy/deck/parser integration. |
| `src/components/RoutinesPage.tsx` | ported `2a45d10` — Watchers/Missions tabs atop P8. |
| `src/components/SettingsPanel.tsx` | ported `391e945` — ReplyGuy policy/deck/parser integration. |
| `src/components/Sidebar.tsx` | ported `2a45d10` — collapsible room/folder organization. |
| `src/components/TechnicalDetails.tsx` | dropped — later technical-details restyle was outside the final P8b list; P6b approval UI remains. |
| `src/lib/attention.ts` | ported `2a45d10` — attention/autonomy/chat-block presentation deltas. |
| `src/lib/autonomy.test.ts` | ported `2a45d10` — attention/autonomy/chat-block presentation deltas. |
| `src/lib/autonomy.ts` | ported `2a45d10` — attention/autonomy/chat-block presentation deltas. |
| `src/lib/chat-blocks.test.ts` | ported `2a45d10` — attention/autonomy/chat-block presentation deltas. |
| `src/lib/chat-blocks.ts` | ported `2a45d10` — attention/autonomy/chat-block presentation deltas. |
| `src/lib/reply-draft-deck.test.ts` | ported `391e945` — ReplyGuy policy/deck/parser integration. |
| `src/lib/reply-draft-deck.ts` | ported `391e945` — ReplyGuy policy/deck/parser integration. |
| `src/lib/sidebar-preferences.test.ts` | ported `2a45d10` — collapsible room/folder organization. |
| `src/lib/sidebar-preferences.ts` | ported `2a45d10` — collapsible room/folder organization. |
| `src/state/store.tsx` | superseded by `a287ba3` and `46a50fc` — current receipts replace checkpoint provenance union. |
| `src/types/ogb.d.ts` | ported `82770c0` — typed local-Mac permission UX. |

## Mechanical completeness

- Commit keys set-equal `git log --format='%H%x09%s' --reverse 89d25dd..ab098c0`: 58/58.
- File keys set-equal `git diff --name-only 0760625 ab098c0`: 97/97.
- No item has an implicit or blank fate.
