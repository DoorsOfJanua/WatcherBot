import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import type { AgentSpiritName } from "./AgentSpirit";
import type { HoodMood } from "./HoodSpirit";
import "./agent-spirits.css";
import "./alien-spirit.css";

/**
 * Alien direction — "the Visitors". Classic alien head (domed cranium,
 * tapered chin) with huge slanted almond eyes. The pupils are the soul:
 * they drift, attend, wander, scan, dilate and narrow, so gaze carries far
 * more emotion than the hood's fixed eyes. Same contract as HoodSpirit:
 * eight avatar states, the 13-mood expression library, head poses.
 *
 * Personality per agent: shared skull, per-agent silhouette scale, palette,
 * and one identity accessory (orbit moon, third eye, mail diamond, wave
 * crest, antennae, jaw studs).
 *
 * Static SVG, state-class CSS animation, no per-frame React work.
 */

const ALIEN_LOOKS = {
  wormhole: { hi: "#b8a1fb", mid: "#8b5cf6", lo: "#6d28d9", deep: "#3b1878", eye: "#efe9ff" },
  sensei: { hi: "#86efc0", mid: "#10b981", lo: "#059669", deep: "#054e38", eye: "#eafff4" },
  mailman: { hi: "#fdb5be", mid: "#f43f5e", lo: "#e11d48", deep: "#8a1030", eye: "#ffeef1" },
  ganga: { hi: "#7ceee0", mid: "#2dd4bf", lo: "#0d9488", deep: "#0c4f4a", eye: "#ebfffb" },
  signal: { hi: "#a3cdfd", mid: "#3b82f6", lo: "#2563eb", deep: "#173a8a", eye: "#ecf5ff" },
  forge: { hi: "#fddc84", mid: "#f59e0b", lo: "#d97706", deep: "#7c3d0a", eye: "#fff6e3" },
} satisfies Record<
  AgentSpiritName,
  { hi: string; mid: string; lo: string; deep: string; eye: string }
>;

type AlienLook = (typeof ALIEN_LOOKS)[AgentSpiritName];

/** Personality in the silhouette: cranium proportions per agent. */
const HEAD_SCALE = {
  wormhole: [0.96, 1.06], // tall dome, the strategist
  sensei: [0.92, 1], // slim and composed
  mailman: [1.06, 0.95], // round and quick
  ganga: [1, 1.02], // gentle and flowing
  signal: [0.97, 1], // trim, all antenna
  forge: [1.09, 0.93], // broad jaw, dense
} satisfies Record<AgentSpiritName, [number, number]>;

const PUPIL = "#0b0e1a";

/** Which expression each semantic state wears by default. */
const STATE_MOOD = {
  idle: "open",
  listening: "wide",
  thinking: "dots",
  working: "focused",
  waiting: "stoned",
  success: "happy",
  failure: "angry",
  sleeping: "closed",
} satisfies Record<BotAvatarState, HoodMood>;

function Pupil({
  side,
  cx,
  cy,
  r = 5,
  slit = false,
}: {
  side: "left" | "right";
  cx: number;
  cy: number;
  r?: number;
  slit?: boolean;
}) {
  return (
    <g className="alien__pupilpose">
      <g className={`alien__pupil alien__pupil--${side}`}>
        {slit ? (
          <ellipse cx={cx} cy={cy} rx="2.6" ry="5.6" fill={PUPIL} />
        ) : (
          <circle cx={cx} cy={cy} r={r} fill={PUPIL} />
        )}
        <circle cx={cx + 2} cy={cy - 2.2} r={r > 4 ? 1.7 : 1.2} className="alien__glint" />
      </g>
    </g>
  );
}

/**
 * One eye: glow white clipped inside the almond, then lids, then the pupil.
 * `children` are mood-specific lids/pupils, all clipped to the almond.
 */
function Eye({
  side,
  clipId,
  look,
  scale = 1,
  children,
}: {
  side: "left" | "right";
  clipId: string;
  look: AlienLook;
  scale?: number;
  children: React.ReactNode;
}) {
  const cx = side === "left" ? 44.5 : 75.5;
  const rot = side === "left" ? 12 : -12;
  return (
    <g clipPath={`url(#${clipId})`}>
      <ellipse
        className="alien__white alien__rot"
        cx={cx}
        cy="51"
        rx={13 * scale}
        ry={8.3 * scale}
        transform={`rotate(${rot} ${cx} 51)`}
        fill={look.eye}
      />
      {children}
    </g>
  );
}

function AlienEyes({
  mood,
  look,
  clipL,
  clipR,
}: {
  mood: HoodMood;
  look: AlienLook;
  clipL: string;
  clipR: string;
}) {
  const lid = { fill: look.mid, stroke: "none" } as const;
  switch (mood) {
    case "open":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <Pupil side="left" cx={44.5} cy={52} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <Pupil side="right" cx={75.5} cy={52} />
          </Eye>
        </>
      );
    case "calm":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <ellipse {...lid} className="alien__rot" cx="44.5" cy="43" rx="15" ry="8.5" transform="rotate(12 44.5 43)" />
            <Pupil side="left" cx={44.5} cy={54} r={4.4} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <ellipse {...lid} className="alien__rot" cx="75.5" cy="43" rx="15" ry="8.5" transform="rotate(-12 75.5 43)" />
            <Pupil side="right" cx={75.5} cy={54} r={4.4} />
          </Eye>
        </>
      );
    case "wide":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look} scale={1.1}>
            <Pupil side="left" cx={44.5} cy={51.5} r={3.4} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look} scale={1.1}>
            <Pupil side="right" cx={75.5} cy={51.5} r={3.4} />
          </Eye>
        </>
      );
    case "happy":
      return (
        <g className="alien__arcs" stroke={look.eye}>
          <path d="M33.5 53q11-11 22 0" />
          <path d="M64.5 53q11-11 22 0" />
        </g>
      );
    case "angry":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <path {...lid} d="M28 32h34v21L28 42Z" />
            <Pupil side="left" cx={45.5} cy={53.5} r={4.2} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <path {...lid} d="M92 32H58v21l34-11Z" />
            <Pupil side="right" cx={74.5} cy={53.5} r={4.2} />
          </Eye>
        </>
      );
    case "suspicious":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="34" width="34" height="16.5" />
            <Pupil side="left" cx={44.5} cy={54} r={4} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="34" width="34" height="16.5" />
            <Pupil side="right" cx={75.5} cy={54} r={4} />
          </Eye>
        </>
      );
    case "stoned":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="34" width="34" height="19" />
            <Pupil side="left" cx={44.5} cy={55.5} r={6.4} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="34" width="34" height="19" />
            <Pupil side="right" cx={75.5} cy={55.5} r={6.4} />
          </Eye>
        </>
      );
    case "wink":
      return (
        <>
          <g className="alien__arcs" stroke={look.eye}>
            <path d="M33.5 53q11-11 22 0" />
          </g>
          <Eye side="right" clipId={clipR} look={look}>
            <Pupil side="right" cx={75.5} cy={52} />
          </Eye>
        </>
      );
    case "love":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <path
              fill={PUPIL}
              d="M44.5 58c-3.8-2.9-6.3-5.5-6.3-8.1 0-3.6 4-4.5 6.3-1.7 2.3-2.8 6.3-1.9 6.3 1.7 0 2.6-2.5 5.2-6.3 8.1Z"
            />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <path
              fill={PUPIL}
              d="M75.5 58c-3.8-2.9-6.3-5.5-6.3-8.1 0-3.6 4-4.5 6.3-1.7 2.3-2.8 6.3-1.9 6.3 1.7 0 2.6-2.5 5.2-6.3 8.1Z"
            />
          </Eye>
        </>
      );
    case "dots":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <Pupil side="left" cx={44.5} cy={52} r={4.4} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <Pupil side="right" cx={75.5} cy={52} r={4.4} />
          </Eye>
        </>
      );
    case "focused":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="32" width="34" height="14.5" />
            <rect {...lid} x="28" y="57.5" width="34" height="12" />
            <Pupil side="left" cx={44.5} cy={52} slit />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="32" width="34" height="14.5" />
            <rect {...lid} x="58" y="57.5" width="34" height="12" />
            <Pupil side="right" cx={75.5} cy={52} slit />
          </Eye>
        </>
      );
    case "surprised":
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <Pupil side="left" cx={44.5} cy={49.5} r={2.8} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <Pupil side="right" cx={75.5} cy={49.5} r={2.8} />
          </Eye>
        </>
      );
    case "closed":
      return (
        <g className="alien__arcs alien__arcs--dim" stroke={look.eye}>
          <path d="M33.5 51q11 9 22 0" />
          <path d="M64.5 51q11 9 22 0" />
        </g>
      );
  }
}

/**
 * Each agent's crown appendage — the one thing worn on top of the head.
 * Same vibe across the family (little stalks and shapes at the crown),
 * a different twist each. Faces stay clean.
 */
function Accessory({ spirit, look }: { spirit: AgentSpiritName; look: AlienLook }) {
  switch (spirit) {
    case "wormhole":
      // one center stalk carrying a small open ring — the portal, miniature
      return (
        <g className="alien__accessory alien__stalks">
          <path stroke={look.mid} d="M60 12V5" />
          <circle className="alien__tip" fill="none" stroke={look.hi} strokeWidth="2.2" cx="60" cy="1.5" r="3.2" />
        </g>
      );
    case "sensei":
      // one still stalk, a diamond balanced at the tip
      return (
        <g className="alien__accessory alien__stalks">
          <path stroke={look.mid} d="M60 12V6" />
          <path className="alien__tip" fill={look.hi} d="m60 0 3 4-3 4-3-4Z" />
        </g>
      );
    case "mailman":
      // a swept-back stalk flying a little pennant
      return (
        <g className="alien__accessory alien__stalks">
          <path stroke={look.mid} d="M62 12c3-3 6-5.5 10-7.5" />
          <path className="alien__tip" fill={look.hi} d="m72 4.5 7-2-3.5 6Z" />
        </g>
      );
    case "ganga":
      // one stalk holding a single drop
      return (
        <g className="alien__accessory alien__stalks">
          <path stroke={look.mid} d="M60 12V6.5" />
          <path className="alien__tip" fill={look.hi} d="M60 0c1.9 2.4 2.9 4 2.9 5.4a2.9 2.9 0 1 1-5.8 0C57.1 4 58.1 2.4 60 0Z" />
        </g>
      );
    case "signal":
      // the twin ball antennae
      return (
        <g className="alien__accessory alien__stalks">
          <path stroke={look.mid} d="M48 16C45 12 43 9 41.5 6.5M72 16c3-4 5-7 6.5-9.5" />
          <circle className="alien__tip alien__tip--left" fill={look.hi} cx="41" cy="5.5" r="2.8" />
          <circle className="alien__tip alien__tip--right" fill={look.hi} cx="79" cy="5.5" r="2.8" />
        </g>
      );
    case "forge":
      // two stout flat-topped horns
      return (
        <g className="alien__accessory alien__stalks">
          <path className="alien__tip" fill={look.mid} d="M47 14.5 48.5 5h6l-1 7.5Z" />
          <path className="alien__tip" fill={look.mid} d="M73 14.5 71.5 5h-6l1 7.5Z" />
        </g>
      );
  }
}

/** A small mouth, one per mood. Sits low on the face, quiet by design. */
function Mouth({ mood }: { mood: HoodMood }) {
  switch (mood) {
    case "happy":
    case "love":
    case "wink":
      return <path className="alien__mouth" d="M55 70q5 4.5 10 0" />;
    case "angry":
      return <path className="alien__mouth" d="M55.5 72.5q4.5-3.5 9 0" />;
    case "wide":
    case "surprised":
      return <ellipse className="alien__mouth alien__mouth--o" cx="60" cy="71.5" rx="3.2" ry="4" />;
    case "stoned":
      return <ellipse className="alien__mouth alien__mouth--o" cx="60" cy="72" rx="2.4" ry="2.8" />;
    case "suspicious":
      return <path className="alien__mouth" d="M56.5 71.5h8" transform="rotate(-6 60 71.5)" />;
    case "dots":
      return <path className="alien__mouth" d="M57 71.5h6" transform="rotate(8 60 71.5)" />;
    case "focused":
      return <path className="alien__mouth" d="M56 71.5h8" />;
    case "closed":
      return <path className="alien__mouth" d="M56.5 71q3.5 2.5 7 0" />;
    default:
      return <path className="alien__mouth" d="M56.5 71.5h7" />;
  }
}

export type AlienHeading = "center" | "left" | "right" | "up" | "down";

export function AlienSpirit({
  spirit,
  state = "idle",
  mood,
  heading = "center",
  size = 44,
  animated = true,
  label,
}: {
  spirit: AgentSpiritName;
  state?: BotAvatarState;
  /** Pin an expression from the shared library; otherwise the state picks one. */
  mood?: HoodMood;
  /** Turn the head — skull shifts, pupils shift further (parallax). */
  heading?: AlienHeading;
  size?: number;
  animated?: boolean;
  label?: string;
}) {
  const uid = useId().replaceAll(":", "");
  const look = ALIEN_LOOKS[spirit];
  const [sx, sy] = HEAD_SCALE[spirit];
  const worn = mood ?? STATE_MOOD[state];
  const clipL = `${uid}-eyeL`;
  const clipR = `${uid}-eyeR`;

  return (
    <span
      key={`${state}-${worn}`}
      className={`spirit alien alien-${spirit} spirit--${state} alien--look-${heading}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${spirit} spirit`}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.hi} />
            <stop offset="0.5" stopColor={look.mid} />
            <stop offset="1" stopColor={look.lo} />
          </linearGradient>
          <clipPath id={clipL}>
            <ellipse className="alien__rot" cx="44.5" cy="51" rx="14.4" ry="9.2" transform="rotate(12 44.5 51)" />
          </clipPath>
          <clipPath id={clipR}>
            <ellipse className="alien__rot" cx="75.5" cy="51" rx="14.4" ry="9.2" transform="rotate(-12 75.5 51)" />
          </clipPath>
          <filter id={`${uid}-glow`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="1.2" result="core" />
            <feGaussianBlur stdDeviation="4.8" result="halo" />
            <feMerge>
              <feMergeNode in="halo" />
              <feMergeNode in="core" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-soft`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <g className="alien__figure">
          <ellipse
            className="alien__underglow"
            fill={look.mid}
            filter={`url(#${uid}-soft)`}
            cx="60"
            cy="100"
            rx="22"
            ry="6"
          />

          <g className="alien__head-wrap">
            <g transform={`translate(${60 - 60 * sx} ${52 - 52 * sy}) scale(${sx} ${sy})`}>
              {/* the skull: broad domed cranium, one smooth taper to the chin */}
              <path
                className="alien__skull"
                fill={`url(#${uid}-skin)`}
                d="M60 10c21 0 35 14 35 33 0 18-13 31-26 44-5 5-13 5-18 0C38 74 25 61 25 43c0-19 14-33 35-33Z"
              />
              {/* right-side shading facet */}
              <path
                className="alien__facet"
                d="M60 10c21 0 35 14 35 33 0 18-13 31-26 44-2.5 2.5-5.75 3.75-9 3.75V10Z"
              />

              <Accessory spirit={spirit} look={look} />

              <g className="alien__face" filter={`url(#${uid}-glow)`}>
                <g className="alien__gaze">
                  <AlienEyes mood={worn} look={look} clipL={clipL} clipR={clipR} />
                </g>
              </g>
              <Mouth mood={worn} />
            </g>
          </g>
        </g>

        {/* state ornaments */}
        <path
          className="alien__spark"
          fill={look.hi}
          d="m101 22 2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2Z"
        />
        <circle className="alien__alert" fill={look.mid} cx="103" cy="82" r="4.5" />
      </svg>
    </span>
  );
}
