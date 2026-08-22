import { useId } from "react";
import type { MausMotion, MausState } from "@/lib/mascot";
import "./mailman-spirit.css";

export type MailmanSpiritState =
  | "idle"
  | "listening"
  | "thinking"
  | "working"
  | "waiting"
  | "success"
  | "failure"
  | "sleeping";

const STATE_MAP = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  working: "working",
  waiting: "waiting",
  success: "success",
  failure: "failure",
  sleeping: "sleeping",
} satisfies Record<MailmanSpiritState, MailmanSpiritState>;

export function mailmanSpiritState(
  state: MausState | MailmanSpiritState | undefined,
  motion: MausMotion,
): MailmanSpiritState {
  if (motion === "success" || motion === "celebrate") return "success";
  if (motion === "failure" || motion === "alert") return "failure";
  if (motion === "working" || motion === "launch") return "working";
  if (motion === "thinking") return "thinking";
  if (motion === "surprise") return "listening";

  switch (state) {
    case "listening":
      return "listening";
    case "thinking":
    case "searching":
      return "thinking";
    case "working":
    case "writing":
    case "progress":
    case "loading":
    case "sending":
    case "receiving":
    case "uploading":
      return "working";
    case "happy":
    case "excited":
    case "celebrate":
    case "proud":
      return "success";
    case "sad":
    case "scared":
    case "angry":
    case "alerting":
      return "failure";
    case "sleeping":
    case "drowsy":
    case "bored":
      return "sleeping";
    default:
      return "idle";
  }
}

export function MailmanSpirit({
  state = "idle",
  size = 44,
  label = "Mailman spirit",
  motion = "none",
  motionKey = 0,
  animated = true,
}: {
  state?: MausState | MailmanSpiritState;
  size?: number;
  label?: string;
  motion?: MausMotion;
  motionKey?: number;
  animated?: boolean;
}) {
  const pose = mailmanSpiritState(state, motion);
  const key = `${pose}-${motion}-${motionKey}`;
  const glowId = useId().replaceAll(":", "");

  return (
    <span
      key={key}
      className={`mailman-spirit mailman-spirit--${STATE_MAP[pose]}${animated ? "" : " mailman-spirit--still"}`}
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

        <g className="mailman-spirit__loose-letters" aria-hidden="true">
          <path d="M18 31 23 26 28 31 23 36Z" />
          <path d="m91 42 5-4 5 4-5 5Z" />
          <path d="m101 24 4-3 4 3-4 4Z" />
        </g>

        <g className="mailman-spirit__cards" aria-hidden="true">
          <path d="m19 62 16-4 2 14-16 4Z" />
          <path d="m17 66 16-4" />
          <path d="m85 57 18-2 1 14-18 2Z" />
          <path d="m87 61 15-2" />
        </g>

        <g className="mailman-spirit__figure">
          <path className="mailman-spirit__shadow" d="M29 98c14-5 45-6 62 0-14 7-48 8-62 0Z" />

          <g className="mailman-spirit__legs" fill="none" stroke="#171717" strokeLinecap="round" strokeLinejoin="round">
            <path d="M52 82c-1 11-7 17-11 21" />
            <path d="M72 82c3 10 8 15 15 19" />
            <path className="mailman-spirit__foot mailman-spirit__foot--left" d="m38 103-8 1" />
            <path className="mailman-spirit__foot mailman-spirit__foot--right" d="m86 101 8 2" />
          </g>

          <g className="mailman-spirit__satchel">
            <path d="M69 59c12 0 22 6 24 17l-1 20c-9 5-22 4-30-2l1-23c0-6 2-10 6-12Z" fill="#b94236" />
            <path d="M68 61c8-3 18 1 21 8" fill="none" stroke="#e36c4f" strokeWidth="3" strokeLinecap="round" />
            <path d="m67 70 25 9" fill="none" stroke="#762d2b" strokeWidth="2" opacity=".7" />
            <path d="m74 54 6 8" fill="none" stroke="#171717" strokeWidth="4" strokeLinecap="round" />
            <circle cx="82" cy="84" r="2.5" fill="#f1bf55" />
          </g>

          <g className="mailman-spirit__body">
            <path className="mailman-spirit__envelope" d="M27 28 75 21 87 58 73 79 34 75 22 50Z" fill="#e7ddc7" stroke="#171717" strokeWidth="3" strokeLinejoin="round" />
            <path className="mailman-spirit__flap" d="m27 28 28 25 20-32" fill="#f2ead7" stroke="#171717" strokeWidth="3" strokeLinejoin="round" />
            <path className="mailman-spirit__fold" d="m22 50 25 3-13 22M87 58 55 53l18 26" fill="none" stroke="#8f8779" strokeWidth="2" strokeLinejoin="round" />
            <path className="mailman-spirit__arm mailman-spirit__arm--left" d="m29 56-12 11 9 4 9-9" fill="#e7ddc7" stroke="#171717" strokeWidth="3" strokeLinejoin="round" />
            <path className="mailman-spirit__arm mailman-spirit__arm--right" d="m78 51 10-9 6 7-13 12" fill="#e7ddc7" stroke="#171717" strokeWidth="3" strokeLinejoin="round" />
            <circle className="mailman-spirit__aperture" cx="57" cy="47" r="8" fill="#f5c95c" stroke="#171717" strokeWidth="3" filter={`url(#${glowId})`} />
            <path className="mailman-spirit__aperture-mark" d="m53 47 4-4 4 4-4 4Z" fill="#fff5bc" />
          </g>

          <g className="mailman-spirit__seal-burst" fill="none" stroke="#f5c95c" strokeLinecap="round" strokeWidth="2">
            <path d="M45 26v-7M38 29l-5-5M52 25l4-6M36 36l-7-2M62 25l6-3" />
          </g>

          <path className="mailman-spirit__salute" d="m88 47 9-12 4 4-5 13" fill="none" stroke="#171717" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path className="mailman-spirit__jam" d="m20 49 17-4 2 10-17 4Z" fill="#e7ddc7" stroke="#171717" strokeWidth="2" strokeLinejoin="round" />
        </g>
      </svg>
    </span>
  );
}
