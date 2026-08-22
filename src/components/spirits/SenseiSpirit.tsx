import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Sensei — Coach. Jade folds balanced on a single point, two stones for
 * company. Its personality is stillness: idle barely breathes, thinking is
 * weight shifting, working is long quiet then one sudden precise snap, and
 * success is a single clean brushstroke.
 */
export function SenseiSpirit({
  state = "idle",
  size = 44,
  animated = true,
  label = "Sensei spirit",
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
      className={`spirit spirit-sensei spirit--${state}${animated ? "" : " spirit--still"}`}
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

        <path className="spirit__shadow" d="M36 100c11-4 37-4 48 0-11 6-38 6-48 0Z" />

        {/* Two stones it keeps — witnesses, not tools */}
        <g className="sensei__stones">
          <path d="M26 96c1-4 6-6 10-4s5 6 2 8c-4 2-11 1-12-4Z" />
          <path d="M86 98c0-3 4-5 8-4s5 5 2 7c-3 2-9 1-10-3Z" />
        </g>

        <g className="sensei__figure">
          {/* Lower fold tapering to the balance point */}
          <path className="sensei__base" d="M50 62h20l-6 30h-8Z" />
          {/* Upper folded form */}
          <g className="sensei__folds">
            <path className="sensei__fold-main" d="M60 16 92 44 74 63H46L28 44Z" />
            <path className="sensei__fold-facet" d="M60 16v47" />
            <path className="sensei__fold-crease" d="M46 63 28 44m64 0L74 63" />
            <g className="sensei__aperture" filter={`url(#${glowId})`}>
              <circle cx="60" cy="42" r="5.5" />
              <path className="sensei__aperture-mark" d="m57.5 42 2.5-2.5 2.5 2.5-2.5 2.5Z" />
            </g>
          </g>
        </g>

        {/* The brushstroke — drawn only for its decisive beats */}
        <path className="sensei__stroke" d="M22 30C42 16 78 16 98 30" />
      </svg>
    </span>
  );
}
