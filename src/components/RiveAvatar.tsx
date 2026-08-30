import { useEffect, useState } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

import {
  BOT_AVATAR_STATE_INPUT,
  BOT_AVATAR_STATE_MACHINE,
  BOT_AVATAR_STATE_VALUES,
  type BotAvatarState,
} from "../../shared/bot-avatar";

export interface RiveAvatarProps {
  url: string;
  size: number;
  radius: string;
  label?: string;
  state: BotAvatarState;
  onError: () => void;
}

/** Loaded only when a bot actually owns a .riv asset. The runtime includes a
 * sizeable WASM renderer, so static/code-drawn avatars must not pay for it. */
export function RiveAvatar({ url, size, radius, label, state, onError }: RiveAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const { rive, RiveComponent } = useRive({
    src: url,
    autoplay: !reduceMotion,
    stateMachines: BOT_AVATAR_STATE_MACHINE,
    shouldDisableRiveListeners: true,
    onLoadError: () => setFailed(true),
  });
  const stateInput = useStateMachineInput(rive, BOT_AVATAR_STATE_MACHINE, BOT_AVATAR_STATE_INPUT);

  useEffect(() => {
    if (stateInput) stateInput.value = BOT_AVATAR_STATE_VALUES[state];
  }, [stateInput, state]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const changed = () => setReduceMotion(media.matches);
    media.addEventListener?.("change", changed);
    return () => media.removeEventListener?.("change", changed);
  }, []);

  useEffect(() => {
    if (!rive) return;
    if (reduceMotion) rive.pause();
    else rive.play(BOT_AVATAR_STATE_MACHINE);
  }, [reduceMotion, rive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("avatar unavailable");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    if (failed) onError();
  }, [failed, onError]);

  if (failed) return null;
  return (
    <span
      role="img"
      aria-label={label ?? "Bot avatar"}
      className="block shrink-0 overflow-hidden bg-raised"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <RiveComponent aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />
    </span>
  );
}
