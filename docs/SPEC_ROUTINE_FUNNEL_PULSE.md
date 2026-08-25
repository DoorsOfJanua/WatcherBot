# SPEC: Funnel Pulse (Sniper routine)

Ruled by Janua 2026-08-24: Sniper updates him on the token-funnel findings
in very simple, to-the-point messages. Data source: the MFI-50 MCP tool
`lifecycle_funnel` (live, smoke 16/16). Nothing here trades; the feed is
COVERAGE_ONLY and every payload says so.

## Messages (the whole point: short, plain, rare)

1. **Daily line** — once, 09:00 WEST:
   `FUNNEL 24h: 1240 born · 310 alive · 890 dead · 12 revived · 96 hit 2x. Radar OK. Buckets OK.`
   One line. No links, no jargon. If a collector was down during the day,
   append: `Radar was down 2h overnight.`

2. **Revival alert** — per event, immediately (the desk's strongest
   measured signal class):
   `BACK FROM DEAD: $WIF3 was quiet 9h, trading again. Peak before death 3.1x. Watching.`
   Cap: 10 revival alerts/day, then one summary line
   (`+6 more revivals today, list in the app`).

3. **Collector health** — immediately on DEGRADED:
   `RADAR DOWN 40 min. Fix: launchctl kickstart -k gui/501/com.mfi50.crowd-crossing`
   (same for the bucketizer). Recovery gets one line: `Radar back.`

4. **Nothing else.** Tokens hitting 2x are counted in the daily line only
   (116 in the first hour: per-event would be spam). No hourly chatter.
   Silence means "nothing you need to know", and health alerts make
   silence trustworthy.

## Mechanics (per the standing routine specs)

- Routine on the WatcherBot scheduler; MCP calls:
  `lifecycle_funnel {}` for counts/heartbeats, `{to:"REVIVED"}` for
  alerts.
- SPEC_ROUTINE_PRECHECK applies: deterministic zero-token precheck first
  (funnel-status.json `tip`/`at` unchanged AND no new REVIVED sequence
  numbers => no turn, no message). Track last-seen transition `sequence`
  in routine state so alerts never duplicate or miss across restarts.
- SPEC_ROUTINE_MODEL_OVERRIDE applies: cheapest model lane; the messages
  are template fills, not prose tasks.
- Honesty: numbers come only from the tool payload; a missing field
  prints `not measured`, never zero. If `lifecycle_funnel` itself errors,
  that IS a health alert.

## Boundaries

- No trading language ("buy", "entry", "signal") in any message: the feed
  is coverage. A revival alert is information, not a recommendation.
- Nothing gets committed in MyAgentRoom without Janua's go (standing
  rule). This spec is the build order for Codex; Janua approves the
  commit.
