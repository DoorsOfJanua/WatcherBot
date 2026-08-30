// Provider-neutral voice boundary. Provider modules own HTTP/process details;
// this file selects one from config and keeps credentials server-side.
import type { AppConfig } from "../config.ts";
import * as elevenlabs from "./elevenlabs.ts";
import * as systemVoices from "./system-voices.ts";
import * as xai from "./xai.ts";

export type TtsProvider = "elevenlabs" | "system" | "xai";
export type VoiceProvider = TtsProvider;

export function provider(cfg: AppConfig): TtsProvider {
  const selected = cfg.tts?.provider;
  return selected === "system" || selected === "xai" ? selected : "elevenlabs";
}

export const voiceProvider = provider;

function keyFor(cfg: AppConfig, selected: TtsProvider): string | undefined {
  if (selected === "system") return undefined;
  return selected === "xai" ? cfg.xai?.key : cfg.tts?.key;
}

export class NoVoiceConfigured extends Error {
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

/** The system provider needs no credential; availability is its configured state. */
export function providerConfigured(cfg: AppConfig): boolean {
  const selected = provider(cfg);
  return selected === "system" ? systemVoices.systemVoicesAvailable() : Boolean(keyFor(cfg, selected));
}

export function voiceConfigured(cfg: AppConfig): boolean {
  const selected = provider(cfg);
  if (selected === "system") {
    return systemVoices.systemVoicesAvailable() && Boolean(cfg.tts?.voice);
  }
  return Boolean(keyFor(cfg, selected) && cfg.tts?.voice);
}

export function voiceReady(cfg: AppConfig, voiceId?: string): boolean {
  const selected = provider(cfg);
  if (selected === "system") {
    return systemVoices.systemVoicesAvailable() && Boolean(voiceId || cfg.tts?.voice);
  }
  return Boolean(keyFor(cfg, selected) && (voiceId || cfg.tts?.voice));
}

/** Settings status; credentials themselves never leave this boundary. */
export function describeVoice(cfg: AppConfig) {
  return {
    configured: providerConfigured(cfg),
    ready: voiceConfigured(cfg),
    voice: cfg.tts?.voice ?? "",
    provider: provider(cfg),
  };
}

export function verifyKey(key: string, selected: TtsProvider = "elevenlabs") {
  return selected === "xai" ? xai.verifyKey(key) : elevenlabs.verifyKey(key);
}

export async function listVoices(
  cfg: AppConfig,
  run?: systemVoices.Runner,
): Promise<elevenlabs.Voice[]> {
  const selected = provider(cfg);
  if (selected === "system") return systemVoices.listSystemVoices(run);
  const key = keyFor(cfg, selected);
  if (!key) return [];
  return selected === "xai" ? xai.listVoices(key) : elevenlabs.listVoices(key);
}

export function speak(
  cfg: AppConfig,
  text: string,
  voiceId?: string,
  run?: systemVoices.Runner,
) {
  const selected = provider(cfg);
  const voice = voiceId || cfg.tts?.voice;
  if (selected === "system") {
    if (!systemVoices.systemVoicesAvailable() && !run) throw new NoVoiceConfigured("key");
    if (!voice) throw new NoVoiceConfigured("voice");
    return systemVoices.synthesizeSystem(text, voice, run);
  }
  const key = keyFor(cfg, selected);
  if (!key) throw new NoVoiceConfigured("key", selected);
  if (!voice) throw new NoVoiceConfigured("voice", selected);
  return selected === "xai"
    ? xai.synthesize(text, voice, key)
    : elevenlabs.synthesize(text, voice, key);
}

export type { Voice } from "./elevenlabs.ts";
