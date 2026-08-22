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

/**
 * The light living inside the black eye. These carry the gaze: state
 * animations (drift, attend, wander, scan) target `.alien__pupil`, and the
 * head poses parallax `.alien__pupilpose` — class names kept from the
 * pupil era, the glints simply took over the job.
 */
function Glints({
  side,
  y = 48,
  dim = false,
}: {
  side: "left" | "right";
  y?: number;
  dim?: boolean;
}) {
  const cx = side === "left" ? 44.5 : 75.5;
  const out = side === "left" ? -1 : 1;
  return (
    <g className="alien__pupilpose">
      <g className={`alien__pupil alien__pupil--${side}`} opacity={dim ? 0.45 : 1}>
        <ellipse
          className="alien__glint alien__rot"
          cx={cx + out * 4}
          cy={y}
          rx="2.9"
          ry="4.3"
          transform={`rotate(${out * 18} ${cx + out * 4} ${y})`}
        />
        <circle className="alien__glint alien__glint--minor" cx={cx - out * 3.5} cy={y + 7} r="1.7" />
      </g>
    </g>
  );
}

/**
 * One eye: the void-black almond, a glossy lower reflection, then
 * mood-specific lids and glints — everything clipped to the almond.
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
  const rot = side === "left" ? 16 : -16;
  return (
    <g clipPath={`url(#${clipId})`}>
      <ellipse
        className="alien__black alien__rot"
        cx={cx}
        cy="51"
        rx={13.5 * scale}
        ry={8.6 * scale}
        transform={`rotate(${rot} ${cx} 51)`}
        fill={PUPIL}
      />
      <ellipse
        className="alien__gloss alien__rot"
        cx={cx}
        cy="56"
        rx={9 * scale}
        ry={3.6 * scale}
        transform={`rotate(${rot} ${cx} 56)`}
        fill={look.mid}
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
      // the canonical void-black almonds
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <Glints side="left" />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <Glints side="right" />
          </Eye>
        </>
      );
    case "calm":
      // upper lids halfway down: serene black crescents
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <ellipse {...lid} className="alien__rot" cx="44.5" cy="42.5" rx="15.5" ry="8.8" transform="rotate(16 44.5 42.5)" />
            <Glints side="left" y={53} dim />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <ellipse {...lid} className="alien__rot" cx="75.5" cy="42.5" rx="15.5" ry="8.8" transform="rotate(-16 75.5 42.5)" />
            <Glints side="right" y={53} dim />
          </Eye>
        </>
      );
    case "wide":
      // fully dilated black, bright high glints
      return (
        <>
          <Eye side="left" clipId={clipL} look={look} scale={1.12}>
            <Glints side="left" y={46.5} />
          </Eye>
          <Eye side="right" clipId={clipR} look={look} scale={1.12}>
            <Glints side="right" y={46.5} />
          </Eye>
        </>
      );
    case "happy":
      // the black eyes curve into smiles
      return (
        <g className="alien__arcs" stroke={PUPIL}>
          <path d="M33.5 53q11-11.5 22 0" />
          <path d="M64.5 53q11-11.5 22 0" />
        </g>
      );
    case "angry":
      // lids slash inward: fierce black blades
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <path {...lid} d="M28 30h36v22L28 41Z" />
            <Glints side="left" y={53} dim />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <path {...lid} d="M92 30H56v22l36-11Z" />
            <Glints side="right" y={53} dim />
          </Eye>
        </>
      );
    case "suspicious":
      // flat lids: unimpressed black slots
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="32" width="34" height="18" />
            <Glints side="left" y={53.5} dim />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="32" width="34" height="18" />
            <Glints side="right" y={53.5} dim />
          </Eye>
        </>
      );
    case "stoned":
      // lids most of the way down, glints drowsy and low
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="32" width="34" height="21" />
            <Glints side="left" y={55.5} dim />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="32" width="34" height="21" />
            <Glints side="right" y={55.5} dim />
          </Eye>
        </>
      );
    case "wink":
      return (
        <>
          <g className="alien__arcs" stroke={PUPIL}>
            <path d="M33.5 53q11-11.5 22 0" />
          </g>
          <Eye side="right" clipId={clipR} look={look}>
            <Glints side="right" />
          </Eye>
        </>
      );
    case "love":
      // a pale heart glowing inside each black eye
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <path
              fill={look.eye}
              d="M44.5 58c-3.8-2.9-6.3-5.5-6.3-8.1 0-3.6 4-4.5 6.3-1.7 2.3-2.8 6.3-1.9 6.3 1.7 0 2.6-2.5 5.2-6.3 8.1Z"
            />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <path
              fill={look.eye}
              d="M75.5 58c-3.8-2.9-6.3-5.5-6.3-8.1 0-3.6 4-4.5 6.3-1.7 2.3-2.8 6.3-1.9 6.3 1.7 0 2.6-2.5 5.2-6.3 8.1Z"
            />
          </Eye>
        </>
      );
    case "dots":
      // shrunk to quizzical black rounds
      return (
        <g fill={PUPIL}>
          <circle cx="44.5" cy="51.5" r="6" />
          <circle cx="75.5" cy="51.5" r="6" />
          <g className="alien__pupilpose">
            <g className="alien__pupil alien__pupil--left">
              <circle className="alien__glint" cx="46.5" cy="49.5" r="1.7" />
            </g>
          </g>
          <g className="alien__pupilpose">
            <g className="alien__pupil alien__pupil--right">
              <circle className="alien__glint" cx="77.5" cy="49.5" r="1.7" />
            </g>
          </g>
        </g>
      );
    case "focused":
      // narrowed to blades, one streak of light
      return (
        <>
          <Eye side="left" clipId={clipL} look={look}>
            <rect {...lid} x="28" y="30" width="34" height="16" />
            <rect {...lid} x="28" y="57" width="34" height="14" />
            <Glints side="left" y={52} dim />
          </Eye>
          <Eye side="right" clipId={clipR} look={look}>
            <rect {...lid} x="58" y="30" width="34" height="16" />
            <rect {...lid} x="58" y="57" width="34" height="14" />
            <Glints side="right" y={52} dim />
          </Eye>
        </>
      );
    case "surprised":
      // perfect startled black rounds
      return (
        <g fill={PUPIL}>
          <circle cx="44.5" cy="50" r="8.6" />
          <circle cx="75.5" cy="50" r="8.6" />
          <g className="alien__pupilpose">
            <g className="alien__pupil alien__pupil--left">
              <circle className="alien__glint" cx="47" cy="47" r="2" />
            </g>
          </g>
          <g className="alien__pupilpose">
            <g className="alien__pupil alien__pupil--right">
              <circle className="alien__glint" cx="78" cy="47" r="2" />
            </g>
          </g>
        </g>
      );
    case "closed":
      return (
        <g className="alien__arcs alien__arcs--dim" stroke={PUPIL}>
          <path d="M33.5 51q11 9.5 22 0" />
          <path d="M64.5 51q11 9.5 22 0" />
        </g>
      );
  }
}

/** Each agent's one identity accessory, worn on or near the head. */
function Accessory({ spirit, look }: { spirit: AgentSpiritName; look: AlienLook }) {
  switch (spirit) {
    case "wormhole":
      // a small moon orbiting the cranium
      return (
        <g className="alien__accessory alien__orbit">
          <ellipse
            className="alien__orbit-path alien__rot"
            stroke={look.hi}
            cx="60"
            cy="33"
            rx="34"
            ry="8.5"
            transform="rotate(-10 60 33)"
          />
          <circle className="alien__orbit-moon" fill={look.hi} cx="88" cy="27" r="3" />
        </g>
      );
    case "sensei":
      // the third eye
      return (
        <path
          className="alien__accessory alien__third-eye"
          fill={look.eye}
          d="m60 24 3.4 5-3.4 5-3.4-5Z"
        />
      );
    case "mailman":
      // a letter arriving at the temple
      return (
        <g className="alien__accessory alien__letter">
          <path fill={look.eye} stroke={look.deep} strokeWidth="1.4" d="m92 26 8 5.5-8 5.5-8-5.5Z" />
          <path fill="none" stroke={look.deep} strokeWidth="1.2" d="m85 29.5 7 4 7-4" />
        </g>
      );
    case "ganga":
      // the current across the cranium
      return (
        <path
          className="alien__accessory alien__crest"
          stroke={look.hi}
          d="M44 27q5.5-4.5 11 0t11 0"
        />
      );
    case "signal":
      // antennae with glowing tips
      return (
        <g className="alien__accessory alien__antennae">
          <path stroke={look.mid} d="M48 16C45 12 43 9 41.5 6.5M72 16c3-4 5-7 6.5-9.5" />
          <circle className="alien__tip alien__tip--left" fill={look.hi} cx="41" cy="5.5" r="2.8" />
          <circle className="alien__tip alien__tip--right" fill={look.hi} cx="79" cy="5.5" r="2.8" />
        </g>
      );
    case "forge":
      // jaw studs, riveted
      return (
        <g className="alien__accessory alien__studs" fill={look.deep}>
          <circle cx="46" cy="78" r="2.2" />
          <circle cx="74" cy="78" r="2.2" />
        </g>
      );
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
            <ellipse className="alien__rot" cx="44.5" cy="51" rx="15.2" ry="9.7" transform="rotate(16 44.5 51)" />
          </clipPath>
          <clipPath id={clipR}>
            <ellipse className="alien__rot" cx="75.5" cy="51" rx="15.2" ry="9.7" transform="rotate(-16 75.5 51)" />
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
              {/* the skull: broad domed cranium tapering to a narrow chin */}
              <path
                className="alien__skull"
                fill={`url(#${uid}-skin)`}
                d="M60 10c21 0 35 14 35 33 0 19-16 33-29.5 47-3.2 3-7.8 3-11 0C41 76 25 62 25 43c0-19 14-33 35-33Z"
              />
              {/* right-side shading facet */}
              <path
                className="alien__facet"
                d="M60 10c21 0 35 14 35 33 0 19-16 33-29.5 47-1.6 1.5-3.4 2.25-5.5 2.25V10Z"
              />
              {/* light along the left cranium */}
              <path
                className="alien__sheen"
                stroke={look.hi}
                d="M54 12.5C42 14.5 28.5 26.5 28 42.5c-.3 9 3.5 18 10 26.5"
              />

              <Accessory spirit={spirit} look={look} />

              <g className="alien__face" filter={`url(#${uid}-glow)`}>
                <g className="alien__gaze">
                  <AlienEyes mood={worn} look={look} clipL={clipL} clipR={clipR} />
                </g>
              </g>
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
