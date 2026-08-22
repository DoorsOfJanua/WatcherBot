// Provider-neutral voice boundary. Provider modules own their HTTP details;
// this file selects one from config and owns the write-only key rules.
import type { AppConfig } from "../config.ts";
import * as elevenlabs from "./elevenlabs.ts";
import * as xai from "./xai.ts";

export type TtsProvider = "elevenlabs" | "xai";

export function provider(cfg: AppConfig): TtsProvider {
  return cfg.tts?.provider === "xai" ? "xai" : "elevenlabs";
}

function keyFor(cfg: AppConfig, selected: TtsProvider): string | undefined {
  return selected === "xai" ? cfg.xai?.key : cfg.tts?.key;
}

export class NoVoiceConfigured extends Error {
  // a plain field rather than a constructor parameter property: the harness
  // runs under `node --experimental-strip-types`, which is strip-ONLY, so a
  // parameter property is rejected at load time even though it typechecks
  readonly reason: "key" | "voice";

  constructor(reason: "key" | "voice", selected: TtsProvider = "elevenlabs") {
    super(
      reason === "key"
        ? `Add an ${selected === "xai" ? "xAI" : "ElevenLabs"} key in Settings on the computer to turn on voice.`
        : "Pick a voice in the agent profile.",
    );
    this.reason = reason;
  }
}

export function voiceConfigured(cfg: AppConfig): boolean {
  return Boolean(keyFor(cfg, provider(cfg)) && cfg.tts?.voice);
}

/** A per-bot voice is a complete choice too; it should not be blocked just
 * because the app-wide fallback has not been selected yet. */
export function voiceReady(cfg: AppConfig, voiceId?: string): boolean {
  return Boolean(keyFor(cfg, provider(cfg)) && (voiceId || cfg.tts?.voice));
}

/** What the settings panel needs. Never includes the key — same write-only
 * rule as every other credential. */
export function describeVoice(cfg: AppConfig) {
  const selected = provider(cfg);
  return {
    // Keep the legacy response shape for the default provider. Clients that
    // know about provider selection receive it when xAI is selected.
    ...(selected === "xai" ? { provider: selected } : {}),
    configured: Boolean(keyFor(cfg, selected)),
    ready: voiceConfigured(cfg),
    voice: cfg.tts?.voice ?? "",
  };
}

export function verifyKey(key: string, selected: TtsProvider = "elevenlabs") {
  return selected === "xai" ? xai.verifyKey(key) : elevenlabs.verifyKey(key);
}

export async function listVoices(cfg: AppConfig): Promise<elevenlabs.Voice[]> {
  const selected = provider(cfg);
  const key = keyFor(cfg, selected);
  if (!key) return [];
  return selected === "xai" ? xai.listVoices(key) : elevenlabs.listVoices(key);
}

/** Synthesize one utterance. Throws NoVoiceConfigured when there is nothing
 * to speak with, which the route turns into a 409 the client can explain. */
export function speak(cfg: AppConfig, text: string, voiceId?: string) {
  const selected = provider(cfg);
  const key = keyFor(cfg, selected);
  if (!key) throw new NoVoiceConfigured("key", selected);
  const voice = voiceId || cfg.tts?.voice;
  if (!voice) throw new NoVoiceConfigured("voice");
  return selected === "xai"
    ? xai.synthesize(text, voice, key)
    : elevenlabs.synthesize(text, voice, key);
}

export type { Voice } from "./elevenlabs.ts";
