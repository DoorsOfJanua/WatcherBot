import { useEffect, useRef, useState } from "react";

import type { MausMotion } from "@/lib/mascot";
import type {
  BotAvatarState,
  BotSpiritGeometry,
  BotSpiritPalette,
  BotSpiritTemperament,
} from "../../../shared/bot-avatar";
import {
  HoodSpirit,
  type HoodHeading,
  type HoodMood,
  type HoodSpiritName,
} from "./HoodSpirit";

type SpiritPose = { mood: HoodMood; heading: HoodHeading };

/**
 * A face does not teleport from one emotion to another. It softens, blinks
 * while the head starts turning, then reveals the new expression.
 */
export function transitionFrames(from: SpiritPose, to: SpiritPose): readonly SpiritPose[] {
  if (from.mood === to.mood && from.heading === to.heading) return [to];
  return [
    { mood: "calm", heading: from.heading },
    { mood: "closed", heading: to.heading },
    to,
  ];
}

type SpiritPersonality = {
  /** Deliberately different rhythms keep the room from moving in chorus. */
  cadenceMs: number;
  idle: readonly SpiritPose[];
  states: Record<Exclude<BotAvatarState, "idle">, SpiritPose>;
  notice: SpiritPose;
  reply: SpiritPose;
  delight: SpiritPose;
};

const PERSONALITIES = {
  wormhole: {
    cadenceMs: 6800,
    idle: [
      // The center gaze is The Watcher's visual home. It looks away and
      // changes affect, then returns to this deep, unsettling watch.
      { mood: "open", heading: "center" },
      { mood: "suspicious", heading: "left" },
      { mood: "calm", heading: "right" },
    ],
    states: {
      listening: { mood: "wide", heading: "right" },
      thinking: { mood: "dots", heading: "left" },
      working: { mood: "focused", heading: "down" },
      waiting: { mood: "calm", heading: "center" },
      success: { mood: "happy", heading: "up" },
      failure: { mood: "angry", heading: "right" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "surprised", heading: "up" },
    reply: { mood: "wink", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
  sensei: {
    cadenceMs: 7600,
    idle: [
      { mood: "calm", heading: "center" },
      { mood: "suspicious", heading: "down" },
      { mood: "calm", heading: "left" },
    ],
    states: {
      listening: { mood: "calm", heading: "down" },
      thinking: { mood: "suspicious", heading: "left" },
      working: { mood: "focused", heading: "down" },
      waiting: { mood: "stoned", heading: "center" },
      success: { mood: "calm", heading: "down" },
      failure: { mood: "angry", heading: "center" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "wide", heading: "down" },
    reply: { mood: "calm", heading: "right" },
    delight: { mood: "happy", heading: "down" },
  },
  mailman: {
    cadenceMs: 4100,
    idle: [
      { mood: "open", heading: "right" },
      { mood: "wide", heading: "left" },
      { mood: "wink", heading: "right" },
      { mood: "happy", heading: "up" },
    ],
    states: {
      listening: { mood: "wide", heading: "up" },
      thinking: { mood: "dots", heading: "left" },
      working: { mood: "focused", heading: "right" },
      waiting: { mood: "suspicious", heading: "left" },
      success: { mood: "happy", heading: "up" },
      failure: { mood: "surprised", heading: "down" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "surprised", heading: "right" },
    reply: { mood: "wink", heading: "right" },
    delight: { mood: "love", heading: "up" },
  },
  ganga: {
    cadenceMs: 6800,
    idle: [
      { mood: "calm", heading: "center" },
      { mood: "open", heading: "up" },
      { mood: "love", heading: "left" },
    ],
    states: {
      listening: { mood: "calm", heading: "left" },
      thinking: { mood: "dots", heading: "up" },
      working: { mood: "focused", heading: "down" },
      waiting: { mood: "calm", heading: "left" },
      success: { mood: "love", heading: "up" },
      failure: { mood: "suspicious", heading: "down" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "wide", heading: "left" },
    reply: { mood: "love", heading: "right" },
    delight: { mood: "love", heading: "up" },
  },
  signal: {
    cadenceMs: 4900,
    idle: [
      { mood: "suspicious", heading: "left" },
      { mood: "focused", heading: "right" },
      { mood: "dots", heading: "up" },
    ],
    states: {
      listening: { mood: "suspicious", heading: "right" },
      thinking: { mood: "dots", heading: "left" },
      working: { mood: "focused", heading: "up" },
      waiting: { mood: "suspicious", heading: "center" },
      success: { mood: "wide", heading: "up" },
      failure: { mood: "angry", heading: "right" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "wide", heading: "up" },
    reply: { mood: "suspicious", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
  forge: {
    cadenceMs: 7200,
    idle: [
      { mood: "focused", heading: "down" },
      { mood: "open", heading: "center" },
      { mood: "suspicious", heading: "right" },
    ],
    states: {
      listening: { mood: "open", heading: "down" },
      thinking: { mood: "suspicious", heading: "down" },
      working: { mood: "focused", heading: "down" },
      waiting: { mood: "stoned", heading: "center" },
      success: { mood: "happy", heading: "up" },
      failure: { mood: "angry", heading: "down" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "wide", heading: "down" },
    reply: { mood: "focused", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
  watcher: {
    cadenceMs: 8400,
    idle: [
      { mood: "calm", heading: "center" },
      { mood: "open", heading: "left" },
      { mood: "suspicious", heading: "right" },
      { mood: "calm", heading: "up" },
    ],
    states: {
      listening: { mood: "wide", heading: "center" },
      thinking: { mood: "dots", heading: "up" },
      working: { mood: "focused", heading: "down" },
      waiting: { mood: "suspicious", heading: "right" },
      success: { mood: "calm", heading: "up" },
      failure: { mood: "angry", heading: "center" },
      sleeping: { mood: "closed", heading: "down" },
    },
    notice: { mood: "wide", heading: "center" },
    reply: { mood: "calm", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
} satisfies Record<HoodSpiritName, SpiritPersonality>;

const TEMPERAMENTS = {
  quiet: {
    cadenceMs: 9200,
    idle: [
      { mood: "calm", heading: "center" },
      { mood: "closed", heading: "down" },
      { mood: "open", heading: "left" },
    ],
    notice: { mood: "wide", heading: "center" },
    reply: { mood: "calm", heading: "right" },
    delight: { mood: "happy", heading: "center" },
  },
  focused: {
    cadenceMs: 6800,
    idle: [
      { mood: "focused", heading: "center" },
      { mood: "suspicious", heading: "left" },
      { mood: "open", heading: "down" },
    ],
    notice: { mood: "wide", heading: "up" },
    reply: { mood: "focused", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
  expressive: {
    cadenceMs: 4500,
    idle: [
      { mood: "open", heading: "center" },
      { mood: "wide", heading: "left" },
      { mood: "happy", heading: "up" },
      { mood: "surprised", heading: "right" },
    ],
    notice: { mood: "surprised", heading: "up" },
    reply: { mood: "wide", heading: "right" },
    delight: { mood: "love", heading: "up" },
  },
  playful: {
    cadenceMs: 3600,
    idle: [
      { mood: "wink", heading: "right" },
      { mood: "happy", heading: "up" },
      { mood: "love", heading: "left" },
      { mood: "surprised", heading: "down" },
    ],
    notice: { mood: "surprised", heading: "right" },
    reply: { mood: "wink", heading: "right" },
    delight: { mood: "love", heading: "up" },
  },
  fierce: {
    cadenceMs: 5600,
    idle: [
      { mood: "suspicious", heading: "center" },
      { mood: "focused", heading: "left" },
      { mood: "angry", heading: "right" },
    ],
    notice: { mood: "wide", heading: "center" },
    reply: { mood: "suspicious", heading: "right" },
    delight: { mood: "focused", heading: "up" },
  },
  curious: {
    cadenceMs: 5200,
    idle: [
      { mood: "curious", heading: "left" },
      { mood: "wide", heading: "up" },
      { mood: "skeptical", heading: "right" },
    ],
    notice: { mood: "awe", heading: "up" },
    reply: { mood: "curious", heading: "right" },
    delight: { mood: "happy", heading: "up" },
  },
  mischievous: {
    cadenceMs: 3900,
    idle: [
      { mood: "amused", heading: "right" },
      { mood: "wink", heading: "left" },
      { mood: "skeptical", heading: "center" },
      { mood: "proud", heading: "up" },
    ],
    notice: { mood: "surprised", heading: "left" },
    reply: { mood: "amused", heading: "right" },
    delight: { mood: "wink", heading: "up" },
  },
  tender: {
    cadenceMs: 7200,
    idle: [
      { mood: "calm", heading: "center" },
      { mood: "love", heading: "left" },
      { mood: "sad", heading: "down" },
    ],
    notice: { mood: "curious", heading: "center" },
    reply: { mood: "calm", heading: "right" },
    delight: { mood: "love", heading: "up" },
  },
  mystic: {
    cadenceMs: 8100,
    idle: [
      { mood: "awe", heading: "up" },
      { mood: "closed", heading: "center" },
      { mood: "dots", heading: "left" },
    ],
    notice: { mood: "awe", heading: "center" },
    reply: { mood: "skeptical", heading: "right" },
    delight: { mood: "ecstatic", heading: "up" },
  },
  melancholic: {
    cadenceMs: 8600,
    idle: [
      { mood: "sad", heading: "down" },
      { mood: "stoned", heading: "left" },
      { mood: "calm", heading: "center" },
    ],
    notice: { mood: "curious", heading: "up" },
    reply: { mood: "sad", heading: "right" },
    delight: { mood: "calm", heading: "up" },
  },
  radiant: {
    cadenceMs: 4300,
    idle: [
      { mood: "ecstatic", heading: "up" },
      { mood: "happy", heading: "right" },
      { mood: "proud", heading: "center" },
      { mood: "wide", heading: "left" },
    ],
    notice: { mood: "awe", heading: "up" },
    reply: { mood: "happy", heading: "right" },
    delight: { mood: "ecstatic", heading: "up" },
  },
} satisfies Record<Exclude<BotSpiritTemperament, "native">, Pick<SpiritPersonality, "cadenceMs" | "idle" | "notice" | "reply" | "delight">>;

export function poseForSpirit({
  spirit,
  state,
  idleBeat = 0,
  reaction = "none",
  temperament = "native",
}: {
  spirit: HoodSpiritName;
  state: BotAvatarState;
  idleBeat?: number;
  reaction?: MausMotion;
  temperament?: BotSpiritTemperament;
}): SpiritPose {
  const personality = PERSONALITIES[spirit];
  const emotionalRange = temperament === "native" ? personality : TEMPERAMENTS[temperament];
  if (reaction === "arrive" || reaction === "switch" || reaction === "launch" || reaction === "surprise") {
    return emotionalRange.notice;
  }
  if (reaction === "customize") return emotionalRange.delight;
  if (reaction === "blink") return emotionalRange.reply;
  if (reaction === "thinking") return personality.states.thinking;
  if (reaction === "working") return personality.states.working;
  if (reaction === "success" || reaction === "celebrate") return personality.states.success;
  if (reaction === "failure" || reaction === "alert") return personality.states.failure;
  if (state !== "idle") return personality.states[state];
  return emotionalRange.idle[idleBeat % emotionalRange.idle.length]!;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useStagedPose(target: SpiritPose, smooth: boolean): SpiritPose {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);

  useEffect(() => {
    const show = (pose: SpiritPose) => {
      displayedRef.current = pose;
      setDisplayed(pose);
    };
    if (!smooth) {
      show(target);
      return;
    }

    const frames = transitionFrames(displayedRef.current, target);
    if (frames.length === 1) return;

    show(frames[0]!);
    const turnTimer = window.setTimeout(() => show(frames[1]!), 82);
    const revealTimer = window.setTimeout(() => show(frames[2]!), 178);
    return () => {
      window.clearTimeout(turnTimer);
      window.clearTimeout(revealTimer);
    };
  }, [smooth, target.heading, target.mood]);

  return displayed;
}

/**
 * The behavioral layer over Fable's SVG body. One inexpensive timer changes
 * an idle expression every few seconds; real app events temporarily override
 * that ambient pose. The inner spirit remains pure SVG/CSS.
 */
export function LivingHoodSpirit({
  spirit,
  state = "idle",
  size = 44,
  animated = true,
  label,
  motion = "none",
  motionKey = 0,
  palette = "native",
  geometry = "native",
  temperament = "native",
}: {
  spirit: HoodSpiritName;
  state?: BotAvatarState;
  size?: number;
  animated?: boolean;
  label?: string;
  motion?: MausMotion;
  motionKey?: number;
  palette?: BotSpiritPalette;
  geometry?: BotSpiritGeometry;
  temperament?: BotSpiritTemperament;
}) {
  const reducedMotion = useReducedMotion();
  const [idleBeat, setIdleBeat] = useState(0);
  const [reaction, setReaction] = useState<MausMotion>("none");
  const personality = PERSONALITIES[spirit];
  const cadenceMs = temperament === "native" ? personality.cadenceMs : TEMPERAMENTS[temperament].cadenceMs;

  useEffect(() => {
    setIdleBeat(0);
    if (!animated || reducedMotion || state !== "idle") return;
    const timer = window.setInterval(() => setIdleBeat((beat) => beat + 1), cadenceMs);
    return () => window.clearInterval(timer);
  }, [animated, cadenceMs, reducedMotion, spirit, state, temperament]);

  useEffect(() => {
    if (!animated || reducedMotion || motion === "none") {
      setReaction("none");
      return;
    }
    setReaction(motion);
    const timer = window.setTimeout(() => setReaction("none"), 1250);
    return () => window.clearTimeout(timer);
  }, [animated, motion, motionKey, reducedMotion]);

  const targetPose = poseForSpirit({ spirit, state, idleBeat, reaction, temperament });
  const pose = useStagedPose(targetPose, animated && !reducedMotion);
  const renderedSize = Math.round(size * 1.12);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-visible"
      style={{ width: size, height: size }}
    >
      <HoodSpirit
        spirit={spirit}
        state={state}
        mood={pose.mood}
        heading={pose.heading}
        size={renderedSize}
        animated={animated && !reducedMotion}
        label={label}
        palette={palette}
        geometry={geometry}
      />
    </span>
  );
}
