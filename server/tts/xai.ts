// xAI Text to Speech.
//
// xAI's TTS API is intentionally kept behind the harness. The renderer only
// receives audio bytes and configured/not-configured state; the workspace xAI
// key never crosses the server boundary.
import type { Audio, VerifyResult, Voice } from "./elevenlabs.ts";

const API = process.env.OMB_XAI_TTS_API || "https://api.x.ai/v1";

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function message(status: number, what: string, body: any, key?: string): string {
  const theirs =
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.detail?.message === "string" && body.detail.message.trim()) ||
    (typeof body?.message === "string" && body.message.trim()) ||
    (typeof body?.error === "string" && body.error.trim()) ||
    "";
  // A provider should never echo a credential, but strip it defensively
  // before allowing an upstream error into the UI.
  const safe = key && theirs ? theirs.split(key).join("[redacted]") : theirs;
  if (status === 401 || status === 403) {
    return "xAI rejected that key. Check that it is active and has access to Text to Speech.";
  }
  if (status === 429) return safe || "xAI is rate-limiting this account — wait a moment and try again.";
  if (status === 402) return safe || "xAI says this account has insufficient credits.";
  return safe ? `${what} failed: ${safe}` : `${what} failed (${status})`;
}

/** Validate the same endpoint used by the voice picker. */
export async function verifyKey(key: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${API}/tts/voices`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: message(res.status, "checking that key", await safeJson(res), key) };
  } catch {
    return { ok: false, message: "Couldn't reach xAI to check that key — check your connection." };
  }
}

export async function listVoices(key: string): Promise<Voice[]> {
  const res = await fetch(`${API}/tts/voices`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await safeJson(res);
  if (!res.ok) throw new Error(message(res.status, "listing voices", body, key));
  return (body?.voices ?? [])
    .map((v: any): Voice => ({
      id: String(v.voice_id ?? ""),
      label: String(v.name ?? v.voice_id ?? "Voice"),
      description: [v.language, v.description, v.tone].filter(Boolean).join(" · ") || undefined,
    }))
    .filter((v: Voice) => v.id);
}

export async function synthesize(text: string, voiceId: string, key: string): Promise<Audio> {
  const res = await fetch(`${API}/tts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", accept: "audio/mpeg" },
    // Agents regularly answer Janua in English, Dutch, and Portuguese.
    // Let xAI detect the utterance instead of forcing an English reading.
    body: JSON.stringify({ text, voice_id: voiceId, language: "auto" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(message(res.status, "speaking", await safeJson(res), key));
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mime: res.headers.get("content-type")?.split(";", 1)[0] || "audio/mpeg",
  };
}
