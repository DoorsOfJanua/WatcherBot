/** Profile input limits shared by every web and server write surface. */
export const BOT_PROFILE_LIMITS = {
  name: 100,
  title: 200,
  description: 4000,
  voice: 200,
  /** Public routing labels only — never credentials or message content. */
  email: 254,
  phone: 32,
  whatsapp: 64,
  /** Nonsecret canonical identity used by a local cross-surface memory bridge. */
  sharedMemoryId: 64,
} as const;

export type BotContactField = "email" | "phone" | "whatsapp";

export type BotContactResult =
  | { ok: true; value?: string }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;
const WHATSAPP_HANDLE_PATTERN = /^@[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

/**
 * Normalize the optional public identities stored on a bot. These values are
 * labels/routing hints, not credentials, and are intentionally never used to
 * send anything. Empty input clears the field; all other values are trimmed
 * and normalized into one stable representation before persistence.
 */
export function normalizeBotContact(field: BotContactField, input: string | null | undefined): BotContactResult {
  if (input === null || input === undefined) return { ok: true };

  const raw = input.trim();
  if (raw.length > BOT_PROFILE_LIMITS[field]) {
    return { ok: false, error: `${field} must be at most ${BOT_PROFILE_LIMITS[field]} characters` };
  }
  if (!raw) return { ok: true };

  if (field === "email") {
    const value = raw.toLowerCase();
    return EMAIL_PATTERN.test(value)
      ? { ok: true, value }
      : { ok: false, error: "email must be a valid email address" };
  }

  // Accept common human formatting, but persist phone numbers in a compact
  // international form so routing comparisons do not depend on punctuation.
  const phone = raw.replace(/[\s().-]/g, "");
  if (field === "phone") {
    return PHONE_PATTERN.test(phone)
      ? { ok: true, value: phone }
      : { ok: false, error: "phone must be an international number (7–15 digits)" };
  }

  if (PHONE_PATTERN.test(phone)) return { ok: true, value: phone };
  const handle = raw.startsWith("@") ? raw : `@${raw}`;
  return WHATSAPP_HANDLE_PATTERN.test(handle)
    ? { ok: true, value: handle }
    : { ok: false, error: "whatsapp must be a phone number or handle" };
}
