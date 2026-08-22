import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Wormhole — Chief of Staff. A violet ribbon folded into an impossible loop:
 * the sash threads over the ring and dives into the portal at its heart.
 * Calm and coordinating; thinking circles, working routes, success briefly
 * opens branching paths out of the portal.
 */
export function WormholeSpirit({
  state = "idle",
  size = 44,
  animated = true,
  label = "Wormhole spirit",
}: {
  state?: BotAvatarState;
  size?: number;
  animated?: boolean;
  label?: string;
}) {
  const glowId = useId().replaceAll(":", "");

  return (
    <span
      key={state}
      className={`spirit spirit-wormhole spirit--${state}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path className="spirit__shadow" d="M34 102c12-4 40-4 52 0-12 6-41 6-52 0Z" />

        <g className="wormhole__figure">
          {/* Drifting motes — quiet company around the loop */}
          <g className="wormhole__motes">
            <path d="m22 34 4-4 4 4-4 4Z" />
            <path d="m96 66 3.5-3.5 3.5 3.5-3.5 3.5Z" />
          </g>

          {/* Branch paths — closed until the portal opens them */}
          <g className="wormhole__branches" fill="none" strokeLinecap="round">
            <path d="M52 48C44 34 34 27 22 26" />
            <path d="M68 48c8-14 18-21 30-22" />
          </g>

          <g className="wormhole__loop">
            {/* The ring, with its portal punched out */}
            <path
              className="wormhole__ring"
              fillRule="evenodd"
              d="M60 26c21 0 37 13 37 30S81 86 60 86 23 73 23 56s16-30 37-30Zm0 16c-11 0-19 6-19 14s8 14 19 14 19-6 19-14-8-14-19-14Z"
            />
            {/* Fold seams on the ring */}
            <path className="wormhole__seam" d="M31 42c4-5 10-9 17-11M89 70c-4 5-10 9-17 11" />

            {/* The portal interior */}
            <ellipse className="wormhole__void" cx="60" cy="56" rx="17" ry="12" />

            {/* The sash: threads over the ring top-right, dives into the portal */}
            <g className="wormhole__sash">
              <path d="M62 63 91 28l13 11-28 33c-6 6-15 0-14-9Z" />
              <path className="wormhole__sash-fold" d="m79 45 9 8" />
              <path className="wormhole__sash-fold" d="m86 37 8 7" />
            </g>

            <g className="wormhole__aperture" filter={`url(#${glowId})`}>
              <circle cx="58" cy="58" r="5.5" />
              <path className="wormhole__aperture-mark" d="m55.5 58 2.5-2.5 2.5 2.5-2.5 2.5Z" />
            </g>
          </g>

          {/* Success flare ring */}
          <ellipse className="wormhole__flare" cx="60" cy="56" rx="24" ry="18" />
          {/* Failure knot — a snagged thread across the sash */}
          <path className="wormhole__knot" d="M84 40c-3 4-1 8 3 8s6-5 2-8" />
        </g>
      </svg>
    </span>
  );
}
