import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import type { AgentSpiritName } from "./AgentSpirit";
import "./agent-spirits.css";

/**
 * Hood direction — Janua's reference: a hooded spirit with a gradient cowl,
 * a dark face void, luminous eyes, and a sacred-geometry halo. The eyes are
 * the state machine; the halo and orbit ring carry the labor; each agent's
 * geometry (Flower of Life, Merkaba, Vesica Piscis, golden spiral, Seed of
 * Life, Metatron's Cube) plus its gradient carries identity.
 *
 * Static SVG, state-class CSS animation, no per-frame React work.
 */

const HOOD_LOOKS = {
  wormhole: { hi: "#b8a1fb", mid: "#8b5cf6", lo: "#6d28d9", deep: "#3b1878", ring: "#8b5cf6" },
  sensei: { hi: "#86efc0", mid: "#10b981", lo: "#059669", deep: "#054e38", ring: "#10b981" },
  mailman: { hi: "#fdb5be", mid: "#f43f5e", lo: "#e11d48", deep: "#8a1030", ring: "#f43f5e" },
  ganga: { hi: "#7ceee0", mid: "#2dd4bf", lo: "#0d9488", deep: "#0c4f4a", ring: "#2dd4bf" },
  signal: { hi: "#a3cdfd", mid: "#3b82f6", lo: "#2563eb", deep: "#173a8a", ring: "#3b82f6" },
  forge: { hi: "#fddc84", mid: "#f59e0b", lo: "#d97706", deep: "#7c3d0a", ring: "#f59e0b" },
} satisfies Record<
  AgentSpiritName,
  { hi: string; mid: string; lo: string; deep: string; ring: string }
>;

type HoodLook = (typeof HOOD_LOOKS)[AgentSpiritName];

/* ---------------------------------------------------------------- moods */

/** The expression library: every eye emotion the hood can wear. */
export const HOOD_MOODS = [
  "open",
  "calm",
  "wide",
  "happy",
  "angry",
  "suspicious",
  "stoned",
  "wink",
  "love",
  "dots",
  "focused",
  "surprised",
  "closed",
] as const;
export type HoodMood = (typeof HOOD_MOODS)[number];

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

function Eyes({ mood }: { mood: HoodMood }) {
  switch (mood) {
    case "open":
      // soft almonds, awake and present
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43.5 51q7-7.5 14 0q-7 7.5-14 0Z" />
          <path d="M62.5 51q7-7.5 14 0q-7 7.5-14 0Z" />
        </g>
      );
    case "calm":
      // serene arcs — the reference's top-left face
      return (
        <g className="hood__eyes hood__eyes--line">
          <path d="M44 52.5q6.5-6.5 13 0" />
          <path d="M63 52.5q6.5-6.5 13 0" />
        </g>
      );
    case "wide":
      // alert, fully open
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43 51q7.5-8.5 15 0q-7.5 8.5-15 0Z" />
          <path d="M62 51q7.5-8.5 15 0q-7.5 8.5-15 0Z" />
        </g>
      );
    case "happy":
      return (
        <g className="hood__eyes hood__eyes--line">
          <path d="M44 53.5q6.5-9 13 0" />
          <path d="M63 53.5q6.5-9 13 0" />
        </g>
      );
    case "angry":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43.5 47 57 51.2 57 54.8 43.5 51Z" />
          <path d="M76.5 47 63 51.2 63 54.8 76.5 51Z" />
        </g>
      );
    case "suspicious":
      // flat lowered bars, unimpressed
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43.5 50h13.5v3.6H43.5Z" />
          <path d="M63 50h13.5v3.6H63Z" />
        </g>
      );
    case "stoned":
      // heavy lids, low thin crescents
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43.5 52.5q6.5-4 13 0l0 1.8q-6.5 2.8-13 0Z" />
          <path d="M63.5 52.5q6.5-4 13 0l0 1.8q-6.5 2.8-13 0Z" />
        </g>
      );
    case "wink":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path className="hood__eyes-linebit" d="M44 52.5q6.5-7 13 0" />
          <path d="M62.5 51q7-7.5 14 0q-7 7.5-14 0Z" />
        </g>
      );
    case "love":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M50 57.5c-4-3-6.6-5.8-6.6-8.5 0-3.8 4.2-4.7 6.6-1.8 2.4-2.9 6.6-2 6.6 1.8 0 2.7-2.6 5.5-6.6 8.5Z" />
          <path d="M70 57.5c-4-3-6.6-5.8-6.6-8.5 0-3.8 4.2-4.7 6.6-1.8 2.4-2.9 6.6-2 6.6 1.8 0 2.7-2.6 5.5-6.6 8.5Z" />
        </g>
      );
    case "dots":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <circle className="hood__eye-dot hood__eye-dot--left" cx="50" cy="51.5" r="4.8" />
          <circle className="hood__eye-dot hood__eye-dot--right" cx="70" cy="51.5" r="4.8" />
        </g>
      );
    case "focused":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <path d="M43.5 49.8 57 48.4 57 52.6 43.5 54Z" />
          <path d="M76.5 49.8 63 48.4 63 52.6 76.5 54Z" />
        </g>
      );
    case "surprised":
      return (
        <g className="hood__eyes hood__eyes--fill">
          <circle cx="50" cy="50.5" r="5.8" />
          <circle cx="70" cy="50.5" r="5.8" />
        </g>
      );
    case "closed":
      return (
        <g className="hood__eyes hood__eyes--line hood__eyes--dim">
          <path d="M44 51.5q6.5 5.5 13 0" />
          <path d="M63 51.5q6.5 5.5 13 0" />
        </g>
      );
  }
}

/* ----------------------------------------------------------------- halos */

const FLOWER_INNER: [number, number][] = [
  [75, 60], [67.5, 72.99], [52.5, 72.99], [45, 60], [52.5, 47.01], [67.5, 47.01],
];
const FLOWER_OUTER: [number, number][] = [
  [90, 60], [75, 85.98], [45, 85.98], [30, 60], [45, 34.02], [75, 34.02],
  [82.5, 72.99], [60, 85.98], [37.5, 72.99], [37.5, 47.01], [60, 34.02], [82.5, 47.01],
];
const SEED: [number, number][] = [
  [77, 60], [68.5, 74.72], [51.5, 74.72], [43, 60], [51.5, 45.28], [68.5, 45.28],
];
const METATRON_INNER: [number, number][] = [
  [76, 60], [68, 73.86], [52, 73.86], [44, 60], [52, 46.14], [68, 46.14],
];
const METATRON_OUTER: [number, number][] = [
  [92, 60], [76, 87.7], [44, 87.7], [28, 60], [44, 32.3], [76, 32.3],
];
const METATRON_CENTERS: [number, number][] = [[60, 60], ...METATRON_INNER, ...METATRON_OUTER];

/**
 * Each agent's sacred-geometry halo — the identity layer behind the figure.
 * Famous forms, one per spirit: coordination, balance, exchange, flow,
 * resonance, and the builder's blueprint.
 */
function Halo({ spirit }: { spirit: AgentSpiritName }) {
  switch (spirit) {
    case "wormhole":
      // Flower of Life — everything connected through the coordinator
      return (
        <g className="hood__halo">
          <circle cx="60" cy="60" r="15" />
          {FLOWER_INNER.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="15" />
          ))}
          {FLOWER_OUTER.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="15" />
          ))}
        </g>
      );
    case "sensei":
      // Merkaba — two forces held in balance
      return (
        <g className="hood__halo">
          <path d="M60 16 21.9 82h76.2Z" />
          <path d="M60 104 21.9 38h76.2Z" />
        </g>
      );
    case "mailman":
      // Vesica Piscis — the exchange between two realms
      return (
        <g className="hood__halo">
          <circle cx="46" cy="60" r="28" />
          <circle cx="74" cy="60" r="28" />
        </g>
      );
    case "ganga":
      // Golden spiral — the current that gathers everything
      return (
        <g className="hood__halo">
          <path d="M92 60A32 32 0 0 1 60 92A20 20 0 0 1 40 72A12 12 0 0 1 52 60A7 7 0 0 1 59 67A4 4 0 0 1 55 71" />
          <path d="M28 60A32 32 0 0 1 60 28" opacity="0.5" />
        </g>
      );
    case "signal":
      // Seed of Life — ripples radiating from one source
      return (
        <g className="hood__halo">
          <circle cx="60" cy="60" r="17" />
          {SEED.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="17" />
          ))}
        </g>
      );
    case "forge":
      // Metatron's Cube — the blueprint holding every solid
      return (
        <g className="hood__halo">
          {METATRON_CENTERS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
          ))}
          <path d="M92 60 76 87.7 44 87.7 28 60 44 32.3 76 32.3Z" />
          <path d="M92 60 44 87.7 44 32.3Z" />
          <path d="M28 60 76 32.3 76 87.7Z" />
          <path d="M28 60H92M44 32.3 76 87.7M76 32.3 44 87.7" />
        </g>
      );
  }
}

/** Accessories that belong to the body and must never orbit. */
function FigureAccessory({ spirit, look }: { spirit: AgentSpiritName; look: HoodLook }) {
  switch (spirit) {
    case "mailman":
      // satchel strap across the chest
      return <path className="hood__accessory hood__strap" stroke={look.lo} d="M46 70 72 88" />;
    case "ganga":
      // current flowing beneath the cloak
      return (
        <path
          className="hood__accessory hood__wave"
          stroke={look.ring}
          d="M40 92q5-4 10 0t10 0t10 0t10 0"
        />
      );
    default:
      return null;
  }
}

/** Where the head is turned. Poses transition smoothly; they never remount. */
export const HOOD_HEADINGS = ["center", "left", "right", "up", "down"] as const;
export type HoodHeading = (typeof HOOD_HEADINGS)[number];

export function HoodSpirit({
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
  /** Pin an expression from the library; otherwise the state picks one. */
  mood?: HoodMood;
  /** Turn the head — cowl shifts, eyes shift further (parallax). */
  heading?: HoodHeading;
  size?: number;
  animated?: boolean;
  label?: string;
}) {
  const uid = useId().replaceAll(":", "");
  const look = HOOD_LOOKS[spirit];
  const worn = mood ?? STATE_MOOD[state];

  return (
    <span
      key={`${state}-${worn}`}
      className={`spirit hood hood-${spirit} spirit--${state} hood--look-${heading}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${spirit} spirit`}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-cowl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.hi} />
            <stop offset="0.45" stopColor={look.mid} />
            <stop offset="1" stopColor={look.lo} />
          </linearGradient>
          <linearGradient id={`${uid}-facet`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.mid} />
            <stop offset="1" stopColor={look.deep} />
          </linearGradient>
          <linearGradient id={`${uid}-chest`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.deep} />
            <stop offset="1" stopColor={look.deep} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={look.hi} />
            <stop offset="1" stopColor={look.ring} />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="1.1" result="core" />
            <feGaussianBlur stdDeviation="4.6" result="halo" />
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

        <g className="hood__halo-wrap" stroke={look.ring}>
          <Halo spirit={spirit} />
        </g>

        <g className="hood__ring" stroke={look.ring}>
          <circle className="hood__ring-line" stroke={`url(#${uid}-ring)`} cx="60" cy="60" r="52" />
          <circle className="hood__ring-dot" fill={look.ring} stroke="none" cx="60" cy="8" r="3.2" />
          <circle
            className="hood__ring-dot hood__ring-dot--minor"
            fill={look.ring}
            stroke="none"
            cx="112"
            cy="60"
            r="2.4"
          />
        </g>

        {/* the figure: centered, large in its halo */}
        <g className="hood__fit" transform="translate(6 6) scale(0.9)">
          <g className="hood__figure">
            {/* ambient under-glow pooled beneath the figure */}
            <ellipse
              className="hood__underglow"
              fill={look.ring}
              filter={`url(#${uid}-soft)`}
              cx="60"
              cy="86"
              rx="20"
              ry="7"
            />
            {/* chest fading out beneath the hem */}
            <path className="hood__chest" fill={`url(#${uid}-chest)`} d="M60 62 88 78 60 98 32 78Z" />

            {/* the head: everything that turns together */}
            <g className="hood__head">
              {/* the cowl: hooked peak, blade edges, pointed shoulders, fanged hem */}
              <path
                className="hood__cowl"
                fill={`url(#${uid}-cowl)`}
                d="M64 11C58 16.5 47 29 39 44c-7.5 13.5-12 25.5-10.5 34 .5 2.9 1.5 4 3 4.5L46 71.5l6.5 5.5 7.5-8.5 7.5 8.5 6.5-5.5 14.5 11c1.5-.5 2.5-1.6 3-4.5 1.5-8.5-3-20.5-10.5-34-8-15-17.5-27.5-17-33Z"
              />
              {/* right-side fold facet, ridge running slightly off-axis */}
              <path
                className="hood__facet"
                fill={`url(#${uid}-facet)`}
                d="M64 11c-1.5 15-3 36.5-4 57.5l7.5 8.5 6.5-5.5 14.5 11c1.5-.5 2.5-1.6 3-4.5 1.5-8.5-3-20.5-10.5-34-8-15-15.5-27.5-17-33Z"
              />
              {/* left outer edge catching the light */}
              <path
                className="hood__edge"
                stroke={look.hi}
                d="M61.5 14C56 20 47.5 31.5 40.5 45c-6.5 12.6-10.7 24-9.7 32.5"
              />
              {/* the face void: a sharpened diamond */}
              <path
                className="hood__void"
                d="M60 30c-5.5 7.5-12.5 17-12.5 26 0 8.8 5.5 14.8 12.5 18.2 7-3.4 12.5-9.4 12.5-18.2 0-9-7-18.5-12.5-26Z"
              />
              {/* rim light where the cowl's inner edge catches the face glow */}
              <path
                className="hood__rim"
                stroke={look.hi}
                d="M60 30c-5.5 7.5-12.5 17-12.5 26 0 8.8 5.5 14.8 12.5 18.2"
              />
              {/* the fanged hem edge, crisp against the chest */}
              <path
                className="hood__hem"
                stroke={look.lo}
                d="M31.5 82.5 46 71.5l6.5 5.5 7.5-8.5 7.5 8.5 6.5-5.5 14.5 11"
              />
              {/* hooked peak facet */}
              <path className="hood__peak" fill={look.hi} d="m64 11 4.6 7.4-5.6 6.4-2.8-7.6Z" />

              <g className="hood__face" filter={`url(#${uid}-glow)`}>
                <g className="hood__gaze">
                  <g className="hood__eyepose">
                    <Eyes mood={worn} />
                  </g>
                </g>
              </g>
            </g>

            <FigureAccessory spirit={spirit} look={look} />
          </g>
        </g>

        {/* state ornaments */}
        <g className="hood__badge hood__badge--think" stroke={look.ring} fill="none">
          <circle cx="98" cy="22" r="10" />
          <path d="M94.5 19c0-5 7-5 7-1 0 3-3.5 3-3.5 6" />
          <circle className="hood__badge-dot" fill={look.ring} stroke="none" cx="98" cy="27.5" r="1.4" />
        </g>
        <path
          className="hood__spark"
          fill={look.hi}
          stroke="none"
          d="M97 28l2.4 6.6L106 37l-6.6 2.4L97 46l-2.4-6.6L88 37l6.6-2.4Z"
        />
        <circle className="hood__alert" fill={look.ring} stroke="none" cx="103" cy="79" r="4.5" />
      </svg>
    </span>
  );
}
