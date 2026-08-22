import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Signal — Research. A cyan radar moth: folded angular wings, ribbon
 * antennae, and a lens on its back with a sweeping needle. Alert and precise:
 * listening perks the antennae toward the conversation, thinking scans the
 * lens side to side, working runs a full radar sweep with pings.
 */
export function SignalSpirit({
  state = "idle",
  size = 44,
  animated = true,
  label = "Signal spirit",
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
      className={`spirit spirit-signal spirit--${state}${animated ? "" : " spirit--still"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path className="spirit__shadow" d="M36 102c11-4 37-4 48 0-11 6-38 6-48 0Z" />

        {/* Ping arcs — the sweep's discoveries */}
        <g className="signal__pings">
          <path d="M42 28a24 24 0 0 1 36 0" />
          <path d="M48 36a15 15 0 0 1 24 0" />
        </g>

        <g className="signal__figure">
          <g className="signal__antenna signal__antenna--left">
            <path d="M56 44C50 36 44 30 38 24" />
            <circle cx="37" cy="23" r="2.6" />
          </g>
          <g className="signal__antenna signal__antenna--right">
            <path d="M64 44c6-8 12-15 19-20" />
            <circle cx="84" cy="23" r="2.6" />
          </g>

          <g className="signal__wing signal__wing--left">
            <path className="signal__wing-shape" d="M55 54 18 42l8 22 15 15 14-2Z" />
            <path className="signal__wing-facet" d="m26 64 27 9" />
          </g>
          <g className="signal__wing signal__wing--right">
            <path className="signal__wing-shape" d="m65 54 37-12-8 22-15 15-14-2Z" />
            <path className="signal__wing-facet" d="M94 64 67 73" />
          </g>

          <g className="signal__body-group">
            <path
              className="signal__body"
              d="M60 40c6 4 8 18 5 38-1 6-9 6-10 0-3-20-1-34 5-38Z"
            />
            <g className="signal__lens">
              <circle className="signal__lens-dish" cx="60" cy="58" r="8.5" />
              <path className="signal__needle" d="M60 58V50" />
              <g className="signal__aperture" filter={`url(#${glowId})`}>
                <circle cx="60" cy="58" r="3.4" />
              </g>
              <path className="signal__flatline" d="M55 58h10" />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
