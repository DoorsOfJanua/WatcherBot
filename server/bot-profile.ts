import { z } from "zod";

import {
  botAvatarCropSchema,
  botAvatarUrlSchema,
  botSpiritGeometrySchema,
  botSpiritPaletteSchema,
  botSpiritSchema,
  botSpiritTemperamentSchema,
} from "../shared/bot-avatar.ts";
import { BOT_PROFILE_LIMITS, normalizeBotContact } from "../shared/bot-profile.ts";

import type { BotRecord } from "./store.ts";

export const BOT_PROFILE_PATCH_FIELDS = [
  "name",
  "title",
  "description",
  "notifications",
  "avatarUrl",
  "avatarCrop",
  "spirit",
  "spiritPalette",
  "spiritGeometry",
  "spiritTemperament",
  "voice",
  "speakReplies",
  "email",
  "phone",
  "whatsapp",
] as const;

const contactFieldSchema = z
  .union([z.string(), z.null()])
  .optional();

const profilePatchSchema = z.object({
  name: z
    .string({ error: "name must be a string" })
    .max(BOT_PROFILE_LIMITS.name, { error: "name must be at most 100 characters" })
    .refine((value) => Boolean(value.trim()), { error: "name must not be empty" })
    .optional(),
  title: z
    .string({ error: "title must be a string" })
    .max(BOT_PROFILE_LIMITS.title, { error: "title must be at most 200 characters" })
    .optional(),
  description: z
    .string({ error: "description must be a string" })
    .max(BOT_PROFILE_LIMITS.description, { error: "description must be at most 4000 characters" })
    .optional(),
  notifications: z.boolean({ error: "notifications must be true or false" }).optional(),
  avatarUrl: z
    .union([botAvatarUrlSchema, z.literal(""), z.null()], {
      error: "avatarUrl must be a stored PNG, JPEG, GIF, WebP, or Rive attachment",
    })
    .optional(),
  avatarCrop: botAvatarCropSchema.optional(),
  spirit: z.union([botSpiritSchema, z.null()]).optional(),
  spiritPalette: botSpiritPaletteSchema.optional(),
  spiritGeometry: botSpiritGeometrySchema.optional(),
  spiritTemperament: botSpiritTemperamentSchema.optional(),
  voice: z
    .string({ error: "voice must be a string" })
    .max(BOT_PROFILE_LIMITS.voice, { error: "voice must be at most 200 characters" })
    .optional(),
  speakReplies: z.boolean({ error: "speakReplies must be true or false" }).optional(),
  email: contactFieldSchema,
  phone: contactFieldSchema,
  whatsapp: contactFieldSchema,
});

export type BotProfilePatchInput = z.input<typeof profilePatchSchema>;

export type BotProfilePatch = Partial<
  Pick<
    BotRecord,
    | "name"
    | "title"
    | "description"
    | "notifications"
    | "avatarUrl"
    | "avatarCrop"
    | "spirit"
    | "spiritPalette"
    | "spiritGeometry"
    | "spiritTemperament"
    | "voice"
    | "speakReplies"
    | "email"
    | "phone"
    | "whatsapp"
  >
>;

export type BotProfilePatchResult =
  | { ok: true; patch: BotProfilePatch }
  | { ok: false; error: string };

/**
 * The shared validation boundary for profile fields. The desktop's broad bot
 * PATCH passes strict=false; paired clients use strict=true so a future bot
 * field cannot silently become remotely writable.
 *
 * avatarUrl deliberately uses `undefined` as the normalized clear value.
 * Store persistence already omits undefined fields, while wireBot sends null
 * back to clients so Codable and object-spread clients both clear stale data.
 */
export function parseBotProfilePatch(input: BotProfilePatchInput, strict = false): BotProfilePatchResult {
  const parsed = (strict ? profilePatchSchema.strict() : profilePatchSchema).safeParse(input);
  if (!parsed.success) {
    const unsupported = parsed.error.issues.find((issue) => issue.code === "unrecognized_keys");
    if (unsupported?.code === "unrecognized_keys") {
      return { ok: false, error: `unsupported profile field: ${unsupported.keys[0] ?? "unknown"}` };
    }
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "avatarCrop") {
      return { ok: false, error: "avatarCrop must be mascot, circle, rounded, or square" };
    }
    return { ok: false, error: issue?.message ?? "invalid profile patch" };
  }

  const { avatarUrl, spirit, email, phone, whatsapp, ...fields } = parsed.data;
  const patch: BotProfilePatch = fields;
  if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl || undefined;
  if (spirit !== undefined) patch.spirit = spirit || undefined;
  for (const field of ["email", "phone", "whatsapp"] as const) {
    const input = { email, phone, whatsapp }[field];
    if (input === undefined) continue;
    const normalized = normalizeBotContact(field, input);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    patch[field] = normalized.value;
  }
  return { ok: true, patch };
}
