# MyAgent Room — identity layer

## Why this exists

An agent in MyAgent Room should feel like the same being wherever Janua meets it: desktop,
Telegram, WhatsApp, email, or a telephone call. Its face, voice, role, memory, and authority are
one identity. Channels are doors into that identity, not separate bots with drifting histories.

The product moment is not “an avatar can animate.” It is seeing Mailman visibly search, leave the
computer, and later finding the same work and conversation waiting on the phone.

## Visual direction: threshold spirits

The inherited mascot is a temporary chassis, not the house style. The original cast uses a shared
craft language without sharing a silhouette:

- imperfect cut-paper or carved-ink geometry rather than glossy robot heads;
- one luminous aperture, mark, or relic that identifies the spirit at 28 px;
- role-specific motion grammar rather than generic bouncing;
- restrained color with one agent accent;
- expressive negative space and asymmetry;
- no Cursor/Maus silhouette, stock animal mascot, emoji face, or copied character proportions.

Examples of motion grammar:

- **Mailman:** darts, skids, sorts, briefly vanishes behind an impossible stack of envelopes;
- **Sensei:** almost motionless at rest, economical anticipations, sudden precise strikes;
- **The Watcher:** folds its own outline and opens small spatial seams for handoffs;
- **Ganga:** trails an ink ribbon that occasionally resolves into a sentence or scene;
- **Signal:** tunes, triangulates, and separates weak noise from one clean pulse;
- **Forge:** heats, measures, strikes, cools, and presents finished work without flourish.

## Janua Character Contract v1

Every custom animated character is a `.riv` asset with:

- default artboard (the artboard name is not part of the runtime contract);
- state machine: `Avatar`;
- numeric input: `state`;
- optional trigger: `accent` for a short role-specific flourish;
- transparent background and square composition;
- a readable silhouette at 28, 44, 72, and 220 CSS pixels;
- a settled idle state that stops expensive motion when the runtime can settle.

Stable state values:

| Value | State | Meaning |
| ---: | --- | --- |
| 0 | `idle` | available, quiet, breathing |
| 1 | `listening` | microphone or human input is active |
| 2 | `thinking` | planning or interpreting before tool work |
| 3 | `working` | actively using tools or changing reversible state |
| 4 | `waiting` | needs Janua, approval, login, or outside state |
| 5 | `success` | a task or meaningful checkpoint completed |
| 6 | `failure` | a run failed and remains retryable |
| 7 | `sleeping` | paused, offline, or outside office hours |

All richer internal mascot states collapse into these eight portable states. A character may
interpret them freely. `failure` must not look like success, and `waiting` must be visibly distinct
from autonomous `working`.

Motion respects `prefers-reduced-motion`. The fallback order is animated character, static custom
image, initials, then the temporary inherited mascot. A malformed character asset never makes the
agent disappear.

## Voice identity

The server owns provider credentials. Renderers receive provider names, readiness, voice catalogs,
and audio only—never keys.

The provider boundary supports xAI and ElevenLabs behind the same operations:

1. verify credentials;
2. list voices;
3. synthesize a bounded utterance;
4. report provider and voice metadata;
5. abort or time out a request cleanly.

xAI is the first active experiment. ElevenLabs remains available. The next schema revision should
allow a provider-qualified per-agent selection (`provider + voice id`) so the room can mix providers
without voice-ID collisions. Realtime speech-to-speech is a later call transport; it must not bypass
the existing agent brain, project-state load, tool permissions, or approval ledger.

## Contact identity

An agent may display:

- email address;
- phone number;
- WhatsApp address;
- Telegram identity;
- availability/presence.

These fields are routing labels, not credentials and not authority. The first production topology is:

- individual email aliases per agent;
- one MyAgent Room telephone number with voice/name routing;
- one MyAgent Room WhatsApp business sender with name routing;
- existing individual Telegram bots where they add conversational value.

Every inbound channel event resolves to one canonical `agentId`, `threadId`, and optional
`projectId` before a turn begins. A connector must never create a hidden second memory simply
because the same person spoke through a different app.

## External-action boundary

Identity does not grant permission. Agents can receive, search, classify, transcribe, draft, and
organize autonomously. Sending email or WhatsApp, placing an outbound call, publishing, spending,
or accepting a commitment requires an exact one-shot action receipt:

- operation and channel;
- account and destination;
- immutable content or call brief hash;
- human-readable preview;
- expiry and approving identity;
- at most one execution;
- provider receipt stored after execution.

Editing the content invalidates approval. Once the frozen action is explicitly approved, execution
is allowed and expected; the system should not ask a second vague permission.

## Build order

1. Animated character asset support and the eight-state contract.
2. Provider-neutral TTS with xAI and ElevenLabs.
3. Contact identity fields in each agent profile.
4. Original first character pack, designed from scratch.
5. Exact external-action receipts and effective tool-access isolation.
6. One shared WhatsApp entry point and thread convergence.
7. One shared telephone entry point and xAI realtime voice experiment.
8. Agent email aliases through a dedicated subdomain and inbound webhook.
9. Cross-channel audit timeline and phone-friendly presence view.

## Acceptance checks

- An agent changes expression from actual runtime state, not a decorative timer.
- A custom asset failure falls back without breaking navigation or calls.
- Reduced-motion users see a stable, intentional pose.
- xAI and ElevenLabs can be selected without exposing or overwriting each other's keys.
- Contact fields survive restart and contain no secrets.
- No new identity field creates outbound authority.
- The same task opened from another channel resolves to the same history and project truth.
