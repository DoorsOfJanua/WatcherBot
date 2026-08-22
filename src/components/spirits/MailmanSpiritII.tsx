import { useId } from "react";
import type { BotAvatarState } from "../../../shared/bot-avatar";
import "./agent-spirits.css";

/**
 * Mailman — Operations & email. The proven envelope-and-satchel spirit,
 * re-inked into the family grammar: warm family ink, the shared luminous
 * aperture with its diamond mark, and the same state vocabulary as its five
 * siblings. Restless feet, sorting cards, a triumphant delivery seal.
 *
 * This is the workshop refinement; the production MailmanSpirit component is
 * untouched until the family is promoted.
 */
export function MailmanSpiritII({
  state = "idle",
  size = 44,
  animated = true,
  label = "Mailman spirit",
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
      className={`spirit spirit-mailman spirit--${state}${animated ? "" : " spirit--still"}`}
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

        <g className="mailman__loose-letters" aria-hidden="true">
          <path d="M18 31 23 26 28 31 23 36Z" />
          <path d="m91 42 5-4 5 4-5 5Z" />
          <path d="m101 24 4-3 4 3-4 4Z" />
        </g>

        <g className="mailman__cards" aria-hidden="true">
          <path d="m19 62 16-4 2 14-16 4Z" />
          <path d="m17 66 16-4" />
          <path d="m85 57 18-2 1 14-18 2Z" />
          <path d="m87 61 15-2" />
        </g>

        <g className="mailman__figure">
          <path className="spirit__shadow" d="M29 98c14-5 45-6 62 0-14 7-48 8-62 0Z" />

          <g className="mailman__legs">
            <path d="M52 82c-1 11-7 17-11 21" />
            <path d="M72 82c3 10 8 15 15 19" />
            <path className="mailman__foot mailman__foot--left" d="m38 103-8 1" />
            <path className="mailman__foot mailman__foot--right" d="m86 101 8 2" />
          </g>

          <g className="mailman__satchel">
            <path className="mailman__satchel-body" d="M69 59c12 0 22 6 24 17l-1 20c-9 5-22 4-30-2l1-23c0-6 2-10 6-12Z" />
            <path className="mailman__satchel-trim" d="M68 61c8-3 18 1 21 8" />
            <path className="mailman__satchel-crease" d="m67 70 25 9" />
            <path className="mailman__satchel-strap" d="m74 54 6 8" />
            <circle className="mailman__satchel-stud" cx="82" cy="84" r="2.5" />
          </g>

          <g className="mailman__body">
            <path className="mailman__envelope" d="M27 28 75 21 87 58 73 79 34 75 22 50Z" />
            <path className="mailman__flap" d="m27 28 28 25 20-32" />
            <path className="mailman__fold" d="m22 50 25 3-13 22M87 58 55 53l18 26" />
            <path className="mailman__arm mailman__arm--left" d="m29 56-12 11 9 4 9-9" />
            <path className="mailman__arm mailman__arm--right" d="m78 51 10-9 6 7-13 12" />
            <g className="mailman__aperture" filter={`url(#${glowId})`}>
              <circle cx="57" cy="47" r="6" />
              <path className="mailman__aperture-mark" d="m54 47 3-3 3 3-3 3Z" />
            </g>
          </g>

          <g className="mailman__seal-burst">
            <path d="M45 26v-7M38 29l-5-5M52 25l4-6M36 36l-7-2M62 25l6-3" />
          </g>

          <path className="mailman__salute" d="m88 47 9-12 4 4-5 13" />
          <path className="mailman__jam" d="m20 49 17-4 2 10-17 4Z" />
        </g>
      </svg>
    </span>
  );
}
