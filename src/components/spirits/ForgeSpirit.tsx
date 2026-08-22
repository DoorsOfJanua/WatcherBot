import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Forge — Builder. A dense amber anvil-block with an ember heart, a hammer
 * arm and a workpiece on top. Working is shaping: strike, pause, strike, with
 * sparks on the hit and the piece flattening under it. Failure banks the
 * ember to a coal that keeps a faint re-glow — a snag, never death.
 */
export function ForgeSpirit({
  state = "idle",
  size = 44,
  animated = true,
  label = "Forge spirit",
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
      className={`spirit spirit-forge spirit--${state}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path className="spirit__shadow" d="M32 102c13-4 43-4 56 0-13 6-44 6-56 0Z" />

        <g className="forge__figure">
          {/* Sparks — burst on each strike */}
          <g className="forge__sparks">
            <path d="m70 40 5-7" />
            <path d="m76 46 8-3" />
            <path d="m64 38 1-8" />
          </g>

          {/* The workpiece being shaped */}
          <g className="forge__workpiece">
            <rect x="46" y="48" width="26" height="7" rx="2.5" />
            <path className="forge__gleam" d="m49 51 20 0" />
          </g>

          {/* The anvil body */}
          <g className="forge__block">
            <path
              className="forge__block-body"
              d="M28 56h64l-7 12-9 4v12H44V72l-9-4Z"
            />
            <path className="forge__block-facet" d="M28 56h64l-4 7H32Z" />
            <path className="forge__block-base" d="M40 84h40l3 8H37Z" />
            <g className="forge__ember" filter={`url(#${glowId})`}>
              <circle cx="60" cy="72" r="5.5" />
              <path className="forge__ember-mark" d="m57.5 72 2.5-2.5 2.5 2.5-2.5 2.5Z" />
            </g>
          </g>

          {/* The hammer arm */}
          <g className="forge__hammer">
            <path className="forge__hammer-handle" d="M74 56 92 34" />
            <path className="forge__hammer-head" d="m86 26 12 10-6 7-12-10Z" />
          </g>

          {/* Failure crack — a recoverable seam, not a shatter */}
          <path className="forge__crack" d="m52 60 4 5-3 5" />
        </g>
      </svg>
    </span>
  );
}
