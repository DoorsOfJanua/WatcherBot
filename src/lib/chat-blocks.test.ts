import { describe, expect, it } from "vitest";
import { chatBlockKind, isArrowOutline } from "./chat-blocks";

describe("chatBlockKind", () => {
  it("hides machine-only routine envelopes", () => {
    expect(chatBlockKind("autonomy-outcome", '{"kind":"autonomy-outcome"}')).toBe("hidden");
  });

  it("renders prose diagrams as human notes", () => {
    const source = "Low-Cap Reset\n  ↓ establishes evidence laws\nCoin admission\n  ↓ safety, liquidity, quality";
    expect(chatBlockKind("", source)).toBe("note");
    expect(chatBlockKind("text", source)).toBe("note");
    expect(isArrowOutline(source)).toBe(true);
  });

  it("keeps real source code as code", () => {
    expect(chatBlockKind("ts", "const answer = 42;")).toBe("code");
    expect(chatBlockKind("", '{"answer":42}')).toBe("code");
  });
});

