import { describe, expect, it } from "vitest";

import {
  botAvatarProfile,
  botAvatarCropSchema,
  botAvatarUrlFromStoredPath,
  botAvatarUrlSchema,
  BOT_SPIRIT_GEOMETRIES,
  BOT_SPIRIT_PALETTES,
  BOT_SPIRIT_TEMPERAMENTS,
  BOT_AVATAR_STATE_VALUES,
  botSpiritSchema,
  BOT_SPIRITS,
  isRiveAvatarUrl,
} from "../shared/bot-avatar.ts";

describe("bot avatar profile schema", () => {
  it("accepts the original branded spirit family and preserves it through normalization", () => {
    expect(BOT_SPIRITS).toEqual(["wormhole", "sensei", "mailman", "ganga", "signal", "forge"]);
    for (const spirit of BOT_SPIRITS) expect(botSpiritSchema.safeParse(spirit).success).toBe(true);
    expect(botSpiritSchema.safeParse("cursor").success).toBe(false);
    expect(botAvatarProfile({ spirit: "signal" }).spirit).toBe("signal");
    expect(botAvatarProfile({ spirit: "cursor" }).spirit).toBeUndefined();
  });

  it("normalizes bounded spirit art direction", () => {
    expect(BOT_SPIRIT_PALETTES).toContain("oilchrome");
    expect(BOT_SPIRIT_GEOMETRIES).toContain("constellation");
    expect(BOT_SPIRIT_TEMPERAMENTS).toContain("mystic");
    expect(botAvatarProfile({
      spirit: "forge",
      spiritPalette: "ivory",
      spiritGeometry: "orbit",
      spiritTemperament: "quiet",
    })).toMatchObject({
      spirit: "forge",
      spiritPalette: "ivory",
      spiritGeometry: "orbit",
      spiritTemperament: "quiet",
    });
    expect(botAvatarProfile({ spiritPalette: "neon", spiritGeometry: "hex", spiritTemperament: "chaos" }))
      .toMatchObject({ spiritPalette: "native", spiritGeometry: "native", spiritTemperament: "native" });
  });

  it("accepts the four supported display shapes", () => {
    for (const crop of ["mascot", "circle", "rounded", "square"]) {
      expect(botAvatarCropSchema.parse(crop)).toBe(crop);
    }
    expect(botAvatarCropSchema.safeParse("hexagon").success).toBe(false);
  });

  it("only accepts app-owned raster or Rive attachments", () => {
    expect(botAvatarUrlSchema.parse("/api/attachments/123e4567-e89b-12d3-a456-426614174000.webp"))
      .toContain("/api/attachments/");
    expect(isRiveAvatarUrl("/api/attachments/123e4567-e89b-12d3-a456-426614174000.riv")).toBe(true);
    for (const value of [
      "https://tracker.example/avatar.png",
      "/api/attachments/avatar.svg",
      "/api/attachments/../../config.json",
      "data:image/png;base64,abc",
    ]) {
      expect(botAvatarUrlSchema.safeParse(value).success).toBe(false);
    }
  });

  it("turns a saved attachment path into a safe serving URL", () => {
    expect(botAvatarUrlFromStoredPath("/tmp/attachments/abc-123.png"))
      .toBe("/api/attachments/abc-123.png");
    expect(botAvatarUrlFromStoredPath("C:\\data\\attachments\\abc-123.jpg"))
      .toBe("/api/attachments/abc-123.jpg");
    expect(botAvatarUrlFromStoredPath("/tmp/attachments/anim.riv"))
      .toBe("/api/attachments/anim.riv");
    expect(botAvatarUrlFromStoredPath("/tmp/attachments/avatar.svg")).toBeNull();
  });

  it("falls back safely for malformed persisted data", () => {
    expect(botAvatarProfile({ avatarUrl: "https://example.test/pixel.png", avatarCrop: "round" }))
      .toEqual({
        avatarCrop: "mascot",
        spiritPalette: "native",
        spiritGeometry: "native",
        spiritTemperament: "native",
      });
  });

  it("publishes the stable animated state contract", () => {
    expect(BOT_AVATAR_STATE_VALUES).toEqual({
      idle: 0,
      listening: 1,
      thinking: 2,
      working: 3,
      waiting: 4,
      success: 5,
      failure: 6,
      sleeping: 7,
    });
  });
});
