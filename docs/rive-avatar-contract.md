# Animated bot avatar contract

MyAgentRoom accepts app-owned Rive files (`.riv`) as bot avatars. A file may
render its authored default animation without any integration, or opt into
runtime state changes:

- state machine: `Avatar`
- numeric input: `state`
- values: `0 idle`, `1 listening`, `2 thinking`, `3 working`, `4 waiting`,
  `5 success`, `6 failure`, `7 sleeping`

The client always renders a Rive asset with this state-machine name and input
when present. Missing inputs are harmless: the authored animation continues.
Network failures, corrupt runtime files, and invalid app-owned URLs fall back to the existing mascot.
Motion pauses when the operating system requests reduced motion.

Uploads use `POST /api/avatars` with the original filename in
`X-Avatar-Filename`; `.riv` uploads must use a Rive binary MIME type. The
generic composer image route remains image-only.
