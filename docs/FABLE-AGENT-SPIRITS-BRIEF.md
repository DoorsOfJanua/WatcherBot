# Fable brief: original animated Agent Spirits

You are working inside `/Users/janua/Projects/MyAgentRoom`, Janua's private desktop-and-phone headquarters for a persistent team of AI agents.

## Mission

Design and implement a family of delightful, original, animated agent icons that feel as alive and expressive as the current mascots but are unmistakably Janua's own visual language. They should feel like small living presences in a shared workshop—not company logos, emoji, generic robots, fantasy-game character portraits, or copies of the current Cursor/Maus silhouette.

The magic moment is glancing at the sidebar and immediately sensing both **who** an agent is and **what it is doing**.

## Read first

Before proposing or editing anything, inspect:

- `.impeccable.md`
- `/Users/janua/app.md`
- `src/components/Avatar.tsx`
- `src/components/CursorAvatar.tsx`
- `src/components/MailmanSpirit.tsx`
- `src/components/mailman-spirit.css`
- `src/components/BotProfileAvatarCard.tsx`
- `src/mascot-preview.tsx`
- `shared/bot-avatar.ts`

Reuse the proven animation/state architecture where useful, but do not preserve the current borrowed visual style merely because it is already implemented.

## Creative direction

The family is called **Agent Spirits**: compact, tactile beings assembled from folded ink, apertures, ribbons, tools, paper, water, ember, signal and motion. They share a visual grammar—bold silhouette, dark hand-inked outline, one luminous aperture or pair of expressive marks, restrained material texture—but each has a different body and movement personality.

Start with these six agents:

1. **Wormhole — Chief of Staff**
   Violet folding portal or impossible loop. Calm, coordinating, capable of briefly opening into branching paths. Never a generic purple blob.

2. **Sensei — Coach**
   Jade folded blade, balanced knot, or disciplined brushstroke spirit. Stillness with sudden precision. Wise, fierce, funny and honest. Avoid robes, chopsticks, conical hats, martial-arts caricatures, or other cultural cliché.

3. **Mailman — Operations and email**
   Keep the charming fast envelope-and-satchel idea as inspiration, but refine it into the same family language. Restless feet, sorting motions, triumphant delivery seal. Do not trace or imitate an outside mascot.

4. **Ganga — Editorial and creative**
   Turquoise river-flame, flowing page, or water-calligraphy spirit. Patient, luminous and able to gather fragments into one current. Avoid religious iconography and literal human portraiture.

5. **Signal — Research**
   Cyan radar moth, tuning fork, antenna ribbon, or searching lens. Alert, curious and precise; its working motion should visibly scan rather than merely bounce.

6. **Forge — Builder**
   Amber ember, folded anvil, or tool-spark spirit. Dense and purposeful; working should feel like shaping, striking or assembling—not frantic shaking.

## Non-negotiable runtime contract

Every spirit must work at 24 px, 40–44 px, and 96–112 px, on dark and light surfaces. At 24 px, silhouette and one identity cue must remain readable.

Each spirit supports the existing eight semantic states from `shared/bot-avatar.ts`:

- `idle`
- `listening`
- `thinking`
- `working`
- `waiting`
- `success`
- `failure`
- `sleeping`

Motion should reveal personality:

- Idle is alive but quiet—breathing, drifting, tapping, flowing.
- Listening visibly attends toward the conversation.
- Thinking is agent-specific: sorting, circling, scanning, balancing, gathering, testing.
- Working communicates meaningful labor rather than a generic spinner.
- Waiting reads as paused for Janua, not broken.
- Success gets one joyful signature beat.
- Failure communicates a recoverable snag, never death or shame.
- Sleeping is peaceful and visually economical.

Respect `prefers-reduced-motion`. Avoid continuous costly React rerenders; prefer CSS/SVG transforms or an imperative animation loop. Do not animate layout properties. Avoid glow-heavy crypto/AI aesthetics, gradient-text aesthetics, emoji faces, over-detailed miniature illustration and generic rounded robot heads.

## Implementation strategy

Prefer an original code-drawn React/SVG spirit system modeled on the technical virtues of `MailmanSpirit`: portable, inspectable, state-driven, efficient, and easy to version. If a real Rive authoring/export tool is available, the existing `Avatar` state machine contract may be used. Do not fabricate `.riv` binaries or claim an untestable Rive export.

First build a reviewable **Agent Spirits Workshop** inside the existing preview surface. Show all six agents at 24, 44 and 112 px, all eight states, animation on/off, dark/light surfaces, and a realistic sidebar strip. The workshop must make comparison easy and must not replace production avatars yet.

Create one coherent family, not six unrelated illustrations. It is acceptable to implement two or three strong visual directions for one representative spirit first, choose the strongest using explicit criteria, and then propagate that grammar—but do not stop at a written moodboard. Produce working animated code.

After the preview works:

1. Run typecheck and focused tests.
2. Inspect the page visually at desktop and phone widths.
3. Report what was built, what remains provisional, and which direction you recommend.
4. Wait for Janua's visual judgment before replacing the production defaults.

Preserve existing user work and do not commit, push, publish, or delete current avatar implementations.
