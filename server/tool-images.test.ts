import { describe, expect, it } from "vitest";

import { __testing } from "./drivers/claude.ts";

const { toolResultImages, MAX_TOOL_IMAGES } = __testing;
const image = (data: string, media_type = "image/png") => ({
  type: "image",
  source: { type: "base64", media_type, data },
});

describe("tool result images", () => {
  it("takes base64 image blocks in provider order", () => {
    expect(toolResultImages([
      { type: "text", text: "drafts" },
      image("AAAA"),
      image("BBBB", "image/jpeg"),
    ])).toEqual([
      { data: "AAAA", mime: "image/png" },
      { data: "BBBB", mime: "image/jpeg" },
    ]);
  });

  it("is absent when no pixels were returned", () => {
    expect(toolResultImages([{ type: "text", text: "ok" }])).toBeUndefined();
    expect(toolResultImages("plain result")).toBeUndefined();
    expect(toolResultImages(undefined)).toBeUndefined();
  });

  it("skips malformed blocks and defaults a missing media type", () => {
    expect(toolResultImages([
      { type: "image" },
      { type: "image", source: { type: "url", url: "https://example.invalid/a.png" } },
      { type: "image", source: { type: "base64", data: "" } },
      { type: "image", source: { type: "base64", data: 42 } },
      { type: "image", source: { type: "base64", data: "GOOD" } },
    ])).toEqual([{ data: "GOOD", mime: "image/png" }]);
  });

  it("caps one tool call before it floods the transcript", () => {
    const many = Array.from({ length: MAX_TOOL_IMAGES + 5 }, (_, index) => image(`I${index}`));
    expect(toolResultImages(many)).toHaveLength(MAX_TOOL_IMAGES);
  });
});
