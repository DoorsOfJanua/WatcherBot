import { z } from "zod";

/** The mascot is a first-class avatar choice; the other values crop an image. */
export const BOT_AVATAR_CROPS = ["mascot", "circle", "rounded", "square"] as const;
export const botAvatarCropSchema = z.enum(BOT_AVATAR_CROPS);
export type BotAvatarCrop = z.infer<typeof botAvatarCropSchema>;

/** Original, code-drawn character packs. Keep this enum intentionally small:
 * adding a spirit is a product decision, not an arbitrary profile string. */
export const BOT_SPIRITS = ["mailman"] as const;
export const botSpiritSchema = z.enum(BOT_SPIRITS);
export type BotSpirit = z.infer<typeof botSpiritSchema>;

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
}

export interface BotAvatarProfile {
  avatarUrl?: string;
  avatarCrop: BotAvatarCrop;
  spirit?: BotSpirit;
}

export function botAvatarProfile(value: BotAvatarProfileInput): BotAvatarProfile {
  const profile: BotAvatarProfile = {
    avatarCrop: botAvatarCropSchema.safeParse(value.avatarCrop).data ?? "mascot",
  };
  const spirit = botSpiritSchema.safeParse(value.spirit);
  if (spirit.success) profile.spirit = spirit.data;
  const url = botAvatarUrlSchema.safeParse(value.avatarUrl);
  if (url.success) profile.avatarUrl = url.data;
  return profile;
}
