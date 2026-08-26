// Pixels a tool returned reaching the person reading the thread.
//
// The agent could always see them: an MCP tool result carries image blocks and
// the model looks at them. Nobody else could. A bot inspecting a rendered
// Instagram slide could only describe it, which is exactly the wrong way round
// when the question is "does this design look right".
//
// These cover the extraction, because that is where a malformed block would
// otherwise throw inside the driver's event loop and take the turn with it.
import { describe, expect, it } from "vitest";

import { __testing } from "./drivers/claude.ts";

const { toolResultImages, MAX_TOOL_IMAGES } = __testing;

const image = (data: string, media_type = "image/png") => ({
  type: "image",
  source: { type: "base64", media_type, data },
});

describe("tool result images", () => {
  it("takes base64 image blocks in the order the tool sent them", () => {
    expect(toolResultImages([
      { type: "text", text: "3 drafts waiting" },
      image("AAAA"),
      { type: "text", text: "slide 1 of 8" },
      image("BBBB", "image/jpeg"),
    ])).toEqual([
      { data: "AAAA", mime: "image/png" },
      { data: "BBBB", mime: "image/jpeg" },
    ]);
  });

  it("is absent, not empty, when a tool returned no pixels", () => {
    // undefined rather than [] so the common case adds nothing to the event.
    expect(toolResultImages([{ type: "text", text: "ok" }])).toBeUndefined();
    expect(toolResultImages("plain string result")).toBeUndefined();
    expect(toolResultImages(undefined)).toBeUndefined();
    expect(toolResultImages(null)).toBeUndefined();
  });

  it("skips malformed blocks instead of throwing the turn away", () => {
    // A picture that cannot be read must never fail the turn that made it.
    expect(toolResultImages([
      { type: "image" },
      { type: "image", source: null },
      { type: "image", source: { type: "url", url: "https://example.com/a.png" } },
      { type: "image", source: { type: "base64", data: "" } },
      { type: "image", source: { type: "base64", data: 42 } },
      null,
      image("GOOD"),
    ])).toEqual([{ data: "GOOD", mime: "image/png" }]);
  });

  it("defaults a missing media type rather than dropping the image", () => {
    expect(toolResultImages([{ type: "image", source: { type: "base64", data: "X" } }]))
      .toEqual([{ data: "X", mime: "image/png" }]);
  });

  it("caps how many one tool call can put in the thread", () => {
    // Every one of these is base64 in the message store, so a tool that
    // returns fifty images must not become fifty inline messages.
    const many = Array.from({ length: MAX_TOOL_IMAGES + 5 }, (_, i) => image(`I${i}`));
    const taken = toolResultImages(many);
    expect(taken).toHaveLength(MAX_TOOL_IMAGES);
    expect(taken?.[0]).toEqual({ data: "I0", mime: "image/png" });
  });
});
