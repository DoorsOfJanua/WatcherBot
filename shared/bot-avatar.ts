import { z } from "zod";

/** The mascot is a first-class avatar choice; the other values crop an image. */
export const BOT_AVATAR_CROPS = ["mascot", "circle", "rounded", "square"] as const;
export const botAvatarCropSchema = z.enum(BOT_AVATAR_CROPS);
export type BotAvatarCrop = z.infer<typeof botAvatarCropSchema>;

/** Original, code-drawn character packs. Keep this enum intentionally small:
 * adding a spirit is a product decision, not an arbitrary profile string. */
export const BOT_SPIRITS = [
  "wormhole",
  "sensei",
  "mailman",
  "ganga",
  "signal",
  "forge",
] as const;
export const botSpiritSchema = z.enum(BOT_SPIRITS);
export type BotSpirit = z.infer<typeof botSpiritSchema>;

/** Independent art-direction controls for a spirit. `native` preserves the
 * authored character; the other values let the same body take on a new
 * identity without turning colors or geometry into arbitrary strings. */
export const BOT_SPIRIT_PALETTES = [
  "native",
  "violet",
  "jade",
  "rose",
  "aqua",
  "azure",
  "ember",
  "ivory",
  "ultraviolet",
  "solar",
  "acid",
  "lunar",
  "oilchrome",
] as const;
export const botSpiritPaletteSchema = z.enum(BOT_SPIRIT_PALETTES);
export type BotSpiritPalette = z.infer<typeof botSpiritPaletteSchema>;

export const BOT_SPIRIT_PALETTE_LABELS = {
  native: "Original",
  violet: "Violet",
  jade: "Jade",
  rose: "Rose",
  aqua: "Aqua",
  azure: "Azure",
  ember: "Ember",
  ivory: "Ivory",
  ultraviolet: "Ultraviolet",
  solar: "Solar",
  acid: "Acid",
  lunar: "Lunar",
  oilchrome: "Oil Chrome",
} satisfies Record<BotSpiritPalette, string>;

export const BOT_SPIRIT_GEOMETRIES = [
  "native",
  "flower",
  "merkaba",
  "vesica",
  "yantra",
  "seed",
  "metatron",
  "lens",
  "orbit",
  "constellation",
  "torus",
  "spiral",
  "lotus",
  "enneagram",
  "labyrinth",
  "portal",
] as const;
export const botSpiritGeometrySchema = z.enum(BOT_SPIRIT_GEOMETRIES);
export type BotSpiritGeometry = z.infer<typeof botSpiritGeometrySchema>;

export const BOT_SPIRIT_GEOMETRY_LABELS = {
  native: "Signature",
  flower: "Flower",
  merkaba: "Merkaba",
  vesica: "Vesica",
  yantra: "Yantra",
  seed: "Seed",
  metatron: "Metatron",
  lens: "Lens",
  orbit: "Orbit",
  constellation: "Stars",
  torus: "Torus",
  spiral: "Spiral",
  lotus: "Lotus",
  enneagram: "Enneagram",
  labyrinth: "Labyrinth",
  portal: "Portal",
} satisfies Record<BotSpiritGeometry, string>;

/** Temperament is an emotional range, not a single pinned face. Runtime state
 * still wins, while idle and reaction poses are selected from this cluster. */
export const BOT_SPIRIT_TEMPERAMENTS = [
  "native",
  "quiet",
  "focused",
  "expressive",
  "playful",
  "fierce",
  "curious",
  "mischievous",
  "tender",
  "mystic",
  "melancholic",
  "radiant",
] as const;
export const botSpiritTemperamentSchema = z.enum(BOT_SPIRIT_TEMPERAMENTS);
export type BotSpiritTemperament = z.infer<typeof botSpiritTemperamentSchema>;

export const BOT_SPIRIT_TEMPERAMENT_META = {
  native: { label: "Signature", note: "Its authored personality" },
  quiet: { label: "Quiet", note: "Calm · patient · sparse" },
  focused: { label: "Focused", note: "Alert · exact · restrained" },
  expressive: { label: "Expressive", note: "Warm · open · reactive" },
  playful: { label: "Playful", note: "Winks · joy · surprise" },
  fierce: { label: "Fierce", note: "Sharp · intense · watchful" },
  curious: { label: "Curious", note: "Questioning · alert · bright" },
  mischievous: { label: "Mischievous", note: "Dry · sly · unpredictable" },
  tender: { label: "Tender", note: "Soft · caring · vulnerable" },
  mystic: { label: "Mystic", note: "Trance · wonder · inward" },
  melancholic: { label: "Melancholic", note: "Quiet · wistful · deep" },
  radiant: { label: "Radiant", note: "Proud · ecstatic · luminous" },
} satisfies Record<BotSpiritTemperament, { label: string; note: string }>;

/**
 * Custom avatars are deliberately limited to this app's attachment server.
 * Besides making persisted profiles portable across desktop/browser clients,
 * this prevents a bot profile from becoming an external tracking pixel or a
 * script-capable SVG.
 */
export const botAvatarUrlSchema = z
  .string()
  .regex(
    /^\/api\/attachments\/[A-Za-z0-9-]+\.(?:png|jpg|gif|webp|riv)$/,
    "must be a stored PNG, JPEG, GIF, WebP, or Rive attachment",
  );

/** A Rive asset is still app-owned binary data; the extension is part of the
 * generated filename so clients can select the renderer without sniffing or
 * trusting arbitrary persisted MIME values. */
export const BOT_AVATAR_ASSET_EXTENSIONS = ["png", "jpg", "gif", "webp", "riv"] as const;
export type BotAvatarAssetExtension = (typeof BOT_AVATAR_ASSET_EXTENSIONS)[number];

/** Runtime states understood by animated avatar assets. A Rive file may
 * ignore these and render its default animation; files that opt into the
 * contract expose a numeric `state` input on the `Avatar` state machine. */
export const BOT_AVATAR_STATES = [
  "idle",
  "listening",
  "thinking",
  "working",
  "waiting",
  "success",
  "failure",
  "sleeping",
] as const;
export type BotAvatarState = (typeof BOT_AVATAR_STATES)[number];
export const BOT_AVATAR_STATE_MACHINE = "Avatar";
export const BOT_AVATAR_STATE_INPUT = "state";
export const BOT_AVATAR_STATE_VALUES: Record<BotAvatarState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  working: 3,
  waiting: 4,
  success: 5,
  failure: 6,
  sleeping: 7,
};

export function botAvatarAssetExtension(url: string | undefined): BotAvatarAssetExtension | null {
  const extension = url?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension && (BOT_AVATAR_ASSET_EXTENSIONS as readonly string[]).includes(extension)
    ? (extension as BotAvatarAssetExtension)
    : null;
}

export function isRiveAvatarUrl(url: string | undefined): boolean {
  return botAvatarAssetExtension(url) === "riv";
}

export function botAvatarUrlFromStoredPath(path: string): string | null {
  const name = path.replaceAll("\\", "/").split("/").pop();
  if (!name) return null;
  const url = `/api/attachments/${name}`;
  return botAvatarUrlSchema.safeParse(url).success ? url : null;
}

/** Runtime-safe defaults for untrusted persisted/SSE profile data. */
export interface BotAvatarProfileInput {
  avatarUrl?: unknown;
  avatarCrop?: unknown;
  spirit?: unknown;
  spiritPalette?: unknown;
  spiritGeometry?: unknown;
  spiritTemperament?: unknown;
}

export interface BotAvatarProfile {
  avatarUrl?: string;
  avatarCrop: BotAvatarCrop;
  spirit?: BotSpirit;
  spiritPalette: BotSpiritPalette;
  spiritGeometry: BotSpiritGeometry;
  spiritTemperament: BotSpiritTemperament;
}

export function botAvatarProfile(value: BotAvatarProfileInput): BotAvatarProfile {
  const profile: BotAvatarProfile = {
    avatarCrop: botAvatarCropSchema.safeParse(value.avatarCrop).data ?? "mascot",
    spiritPalette: botSpiritPaletteSchema.safeParse(value.spiritPalette).data ?? "native",
    spiritGeometry: botSpiritGeometrySchema.safeParse(value.spiritGeometry).data ?? "native",
    spiritTemperament: botSpiritTemperamentSchema.safeParse(value.spiritTemperament).data ?? "native",
  };
  const spirit = botSpiritSchema.safeParse(value.spirit);
  if (spirit.success) profile.spirit = spirit.data;
  const url = botAvatarUrlSchema.safeParse(value.avatarUrl);
  if (url.success) profile.avatarUrl = url.data;
  return profile;
}
