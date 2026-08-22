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
 * Two stable SVG planes, state-class CSS animation, no per-frame React work.
 * The sacred geometry never remounts with the character, and every expression
 * remains mounted so faces can cross-fade instead of popping between paths.
 */

export type HoodSpiritName = AgentSpiritName | "watcher";

const HOOD_LOOKS = {
  wormhole: { hi: "#b8a1fb", mid: "#8b5cf6", lo: "#6d28d9", deep: "#3b1878", ring: "#8b5cf6" },
  sensei: { hi: "#86efc0", mid: "#10b981", lo: "#059669", deep: "#054e38", ring: "#10b981" },
  mailman: { hi: "#fdb5be", mid: "#f43f5e", lo: "#e11d48", deep: "#8a1030", ring: "#f43f5e" },
  ganga: { hi: "#7ceee0", mid: "#2dd4bf", lo: "#0d9488", deep: "#0c4f4a", ring: "#2dd4bf" },
  signal: { hi: "#a3cdfd", mid: "#3b82f6", lo: "#2563eb", deep: "#173a8a", ring: "#3b82f6" },
  forge: { hi: "#fddc84", mid: "#f59e0b", lo: "#d97706", deep: "#7c3d0a", ring: "#f59e0b" },
  watcher: { hi: "#f1eadf", mid: "#b7a99a", lo: "#71665e", deep: "#211d1b", ring: "#d7c7b5" },
} satisfies Record<
  HoodSpiritName,
  { hi: string; mid: string; lo: string; deep: string; ring: string }
>;

type HoodLook = (typeof HOOD_LOOKS)[HoodSpiritName];

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
function Halo({ spirit }: { spirit: HoodSpiritName }) {
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
    case "watcher":
      // The witnessing lens — an eye held inside two quiet, intersecting arcs.
      return (
        <g className="hood__halo">
          <path d="M18 60q42-38 84 0-42 38-84 0Z" />
          <circle cx="60" cy="60" r="17" />
          <circle cx="60" cy="60" r="5" />
          <path d="M60 18v25M60 77v25M18 60h25M77 60h25" opacity="0.55" />
        </g>
      );
  }
}

/** Accessories that belong to the body and must never orbit. */
function FigureAccessory({ spirit, look }: { spirit: HoodSpiritName; look: HoodLook }) {
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
  spirit: HoodSpiritName;
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
      className={`spirit hood hood-${spirit} spirit--${state} hood--look-${heading}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? (spirit === "watcher" ? "The Watcher" : `${spirit} spirit`)}
    >
      {/* Stable environment plane: geometry and orbit never remount with a face. */}
      <svg
        className="hood__environment"
        viewBox="0 0 120 120"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={look.hi} />
            <stop offset="1" stopColor={look.ring} />
          </linearGradient>
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
      </svg>

      {/* Character plane: body, head, face and state ornaments. */}
      <svg
        className="hood__character"
        viewBox="0 0 120 120"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
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
          <linearGradient id={`${uid}-cape`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={look.lo} />
            <stop offset="0.55" stopColor={look.deep} />
            <stop offset="1" stopColor={look.deep} stopOpacity="0" />
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

        {/* the figure: centered, large in its halo */}
        <g className="hood__fit" transform="translate(1.2 0.6) scale(0.98)">
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
            {/* the cape: spreads wider than the hood, dissolving downward */}
            <path
              className="hood__cape"
              fill={`url(#${uid}-cape)`}
              d="M60 34C46 40 33.5 52 26 66c-5 9-7.5 16-8 22 14-4 28-6 42-6s28 2 42 6c-.5-6-3-13-8-22C86.5 52 74 40 60 34Z"
            />
            {/* chest fading out below the face */}
            <path className="hood__chest" fill={`url(#${uid}-chest)`} d="M60 60 85 76 60 95 35 76Z" />

            {/* the head: everything that turns together */}
            <g className="hood__head">
              {/* the cowl: tall peak with a rounded tip, deep fabric over the brow */}
              <path
                className="hood__cowl"
                fill={`url(#${uid}-cowl)`}
                d="M60 5.5c-2.5 0-4.5 1.5-6.2 4C46.5 19.5 38.5 31.5 34 44c-4 10-3 19 4 25 7 5.5 14.5 8 22 8s15-2.5 22-8c7-6 8-15 4-25-4.5-12.5-12.5-24.5-19.8-34.5C64.5 7 62.5 5.5 60 5.5Z"
              />
              {/* right panel, split clean from the peak */}
              <path
                className="hood__facet"
                fill={`url(#${uid}-facet)`}
                d="M60 5.5c2.5 0 4.5 1.5 6.2 4C73.5 19.5 81.5 31.5 86 44c4 10 3 19-4 25-7 5.5-14.5 8-22 8Z"
              />
              {/* left outer edge catching the light */}
              <path
                className="hood__edge"
                stroke={look.hi}
                d="M56.5 9C49.5 18.5 40 31.5 35.5 44.5c-3.3 8.5-2.5 16 3 21.5"
              />
              {/* the face void: a big soft diamond, chin point reaching into the neck */}
              <path
                className="hood__void"
                d="M60 28c3.7 1 10.3 6.5 15 13.5 3.2 4.6 6 8.2 6 10.5 0 3.3-2.8 7.8-6 12.8-4.4 6.8-9.6 12.2-15 16.2-5.4-4-10.6-9.4-15-16.2-3.2-5-6-9.5-6-12.8 0-2.3 2.8-5.9 6-10.5C49.7 34.5 56.3 29 60 28Z"
              />
              {/* the hood rim's shadowed underside, overhanging the face */}
              <path
                className="hood__brow"
                fill="none"
                stroke={look.deep}
                strokeWidth="4.5"
                strokeLinecap="round"
                opacity="0.85"
                d="M45.5 41C49.5 34.5 54.5 31 60 31s10.5 3.5 14.5 10"
              />
              {/* rim light where the cowl's inner edge catches the face glow */}
              <path
                className="hood__rim"
                stroke={look.hi}
                d="M60 28c-3.7 1-10.3 6.5-15 13.5-3.2 4.6-6 8.2-6 10.5 0 3.3 2.8 7.8 6 12.8 4.4 6.8 9.6 12.2 15 16.2"
              />
              {/* peak facet, rounded like the tip it sits on */}
              <path className="hood__peak" fill={look.hi} d="M60 6.5c1.8 0 3.3 1.1 4.5 3l-4.5 8-4.5-8c1.2-1.9 2.7-3 4.5-3Z" />

              <g className="hood__face" filter={`url(#${uid}-glow)`}>
                <g className="hood__gaze">
                  <g className="hood__eyepose">
                    {HOOD_MOODS.map((expression) => (
                      <g
                        key={expression}
                        className={`hood__expression${expression === worn ? " hood__expression--active" : ""}`}
                      >
                        <Eyes mood={expression} />
                      </g>
                    ))}
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
