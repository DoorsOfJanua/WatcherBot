# Local Google Calendar bridge

WatcherBot Room can mount a small, read-only Google Calendar MCP server for
calendar/scheduling agents such as Poppy. It does not use Composio or a hosted
connector. OAuth credentials and refresh tokens remain under:

`~/.myagent-room/google-calendar/`

## One-time setup

1. In Google Cloud Console, create a **Desktop app OAuth client** with the
   Google Calendar API enabled.
2. Save the downloaded client JSON as
   `~/.myagent-room/google-calendar/client.json` (mode `0600`).
3. Run `pnpm calendar:auth` from this repository.
4. Complete Google sign-in in the browser that opens. The refresh token is
   saved locally as `token.json`.
5. Restart the WatcherBot Room server once, then ask Poppy to list the next
   few days.

The bridge currently exposes only `calendar_status`,
`calendar_list_calendars`, and `calendar_list_events`. It cannot create,
move, or delete events. Poppy must propose those changes for Janua's approval.

If no token exists, the bridge is not mounted at all, so other agents never
receive a misleading Calendar tool.
