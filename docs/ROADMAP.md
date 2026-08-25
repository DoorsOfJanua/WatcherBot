# WatcherBot Room roadmap

This is the build order for the product, separate from day-to-day bug fixes.

## Now

- Keep the Mac room stable while the Hetzner pilot runs in parallel.
- Move the remote worker from infrastructure baseline to a verified always-on
  agent runtime.
- Add private Tailscale access, remote CLI authentication, restart supervision,
  and a safe phone test.
- Verify memory, schedules, approvals, and browser work after the Mac is closed.

## Next: isolated workspaces

Create a first-class **New Workspace** option for separate personal projects
and future customers.

### Local MVP (1–2 days)

- Create a workspace name and icon.
- Allocate a separate data directory and server port.
- Open a separate WatcherBot window.
- Give the workspace its own agents, conversations, tasks, and skills.
- Show the active workspace clearly in the UI.

### Product-ready isolation (4–7 days)

- Choose or create a separate Limen vault.
- Configure connectors and browser sessions per workspace.
- Prevent cross-workspace memory retrieval and credential access.
- Add workspace backup/export and deletion safeguards.
- Add tests proving project files, history, and connector records cannot leak
  across workspaces.

### Hosted customer workspaces (after the remote worker)

- One isolated worker/container and vault per customer.
- Separate credentials, logs, approvals, and backups.
- Workspace suspension and export for unpaid accounts.
- Operator access with explicit audit receipts.
- Workspace-level usage limits and billing.

## Later

- Teach-a-task browser skills.
- Event-triggered routines from a durable hosted relay.
- Customer onboarding, subscription billing, and support tooling.
- Dedicated workers for high-value or privacy-sensitive customers.
