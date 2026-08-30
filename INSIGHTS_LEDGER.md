# Insights Ledger — MyAgentRoom / WatcherBot
Append-only. Each entry: observation, evidence, how to test. Status moves
HYPOTHESIS→TESTING→CONFIRMED→TO-CODE→CODED, never rewrite history.

## 2026-08-31 — typecheck green does not mean the server runs
- **Status**: CONFIRMED
- **Observation**: server/ and companion/ code executes under `node
  --experimental-strip-types`. Non-erasable TypeScript (parameter properties,
  enums, namespaces) passes `tsc` and `vite build` but crashes the process at
  boot with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. Any gate that relies on
  typecheck+build alone will pass broken server code.
- **Evidence**: P6 Mailman port (1c791f4) shipped `constructor(private readonly
  ...)` in server/mail-actions.ts:240; typecheck green, 10 e2e test files then
  failed at setup because the spawned server exited 1. Fixed by erasing to
  explicit fields (commit "P6 fixup: erase parameter properties").
- **How to test**: grep diff for `constructor(\s*(private|public|protected)`,
  `enum `, `namespace ` before merge; or boot the server once
  (`OMB_PORT=<scratch> node --experimental-strip-types server/index.ts`) as
  part of every gate. The e2e suites catch it too, but only outside a sandbox
  that can bind ports.

## 2026-08-31 — sandboxed executors cannot see runtime-only breaks
- **Status**: CONFIRMED
- **Observation**: Codex's seatbelt sandbox denies port binds, so every
  server-spawning suite skips there. Its self-checks can be green while the
  server cannot boot. The verifier OUTSIDE the sandbox must always rerun the
  full suite; "green in the executor" is not a gate.
- **Evidence**: same incident as above; codex reported the port suites as
  "sandbox-only reds" while a real crasher hid among them.
- **How to test**: pipeline rule already applied — Fable reruns `pnpm test`
  unsandboxed after every patch group.
