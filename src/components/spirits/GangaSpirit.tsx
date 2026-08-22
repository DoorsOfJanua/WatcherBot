import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Ganga — Editorial & creative. A turquoise river-flame rising from a pool,
 * carrying a page in its current. Patient and luminous: thinking gathers
 * fragments into the current, working writes onto the page while the current
 * runs, success crests into a ring of light.
 */
export function GangaSpirit({
  state = "idle",
  size = 44,
  animated = true,
  label = "Ganga spirit",
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
      className={`spirit spirit-ganga spirit--${state}${animated ? "" : " spirit--still"}`}
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

        <path className="spirit__shadow" d="M32 104c13-4 43-4 56 0-13 6-44 6-56 0Z" />

        {/* Loose fragments drifting in from the margin */}
        <g className="ganga__fragments">
          <path d="m22 46 3.5-3.5 3.5 3.5-3.5 3.5Z" />
          <path d="m16 66 3-3 3 3-3 3Z" />
          <path d="m96 56 3.5-3.5 3.5 3.5-3.5 3.5Z" />
        </g>

        <g className="ganga__figure">
          <g className="ganga__pool">
            <ellipse cx="60" cy="96" rx="27" ry="6.5" />
            <path className="ganga__ripple" d="M40 96c6 3 34 3 40 0" />
          </g>

          <g className="ganga__flame">
            <path
              className="ganga__body"
              d="M60 18c17 17 26 34 22 52-3 13-11 22-22 22S41 83 38 70c-4-18 5-35 22-52Z"
            />
            {/* Currents flowing up the body */}
            <g className="ganga__currents">
              <path d="M50 80c-4-14 0-26 8-38" />
              <path d="M70 80c4-16-1-28-9-40" />
            </g>

            {/* The carried page, with its written line */}
            <g className="ganga__page">
              <path className="ganga__page-sheet" d="m52 56 17-4 3 13-17 4Z" />
              <path className="ganga__page-line" d="m56 61 10-2.5" />
              <path className="ganga__page-line ganga__page-line--second" d="m57 65 8-2" />
            </g>

            <g className="ganga__aperture" filter={`url(#${glowId})`}>
              <circle cx="60" cy="42" r="5.5" />
              <path className="ganga__aperture-mark" d="m57.5 42 2.5-2.5 2.5 2.5-2.5 2.5Z" />
            </g>
          </g>

          {/* Success crest */}
          <circle className="ganga__crest" cx="60" cy="50" r="20" />
        </g>
      </svg>
    </span>
  );
}
