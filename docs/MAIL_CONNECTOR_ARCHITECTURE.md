# Mail connector truth

This is the short operational map for the room and its agents.

## Why Limen Vault is involved

Limen is not the email provider. It is the local registry and secure session
bridge: it records which account is connected, which OAuth capabilities were
granted, and where the encrypted token reference lives in macOS Keychain. The
mail gateway reads that registry before it talks to Gmail. This lets Mailman,
the room, and Telegram use the same account identity and approval boundary.

## Canonical Janua routing

- Active vault: `/Users/janua/Documents/LifeOS` (the iCloud LifeOS vault).
- Doors mailbox: `doorsofjanua@gmail.com`.
- Doors capabilities: read, modify, and send, verified against the live OAuth
  token and Gmail account identity.
- Separate mailbox: `nils.palmen@gmail.com`. It is never a fallback for Doors.
- Retired store: `/Users/janua/LimenOS Vault` (schema v1). It must not be used
  by a running service even if it contains an older connection row.

## Agent rule

Every run must report account capabilities independently: `canRead`,
`canModify`, and `canSend`. A stale read-only record or a failed search is a
routing problem, not proof that the mailbox disappeared. The gateway selects
the strongest verified grant when duplicate connection rows exist.
