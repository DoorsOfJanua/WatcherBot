// The profile patch parser is the boundary that keeps paired clients from
// writing anything but identity fields. The strict half is the one that
// matters: a privileged bot field arriving here must be refused by NAME,
// so a future field cannot silently become remotely writable.
import { describe, expect, it } from "vitest";

import { parseBotProfilePatch } from "./bot-profile.ts";
import { normalizeBotContact } from "../shared/bot-profile.ts";

describe("parseBotProfilePatch (strict — the paired boundary)", () => {
  it("refuses every privilege-bearing bot field by name", () => {
    for (const field of ["autoApprove", "autoApproveReadsOnly", "silentReads", "autoReview", "alwaysAllow", "computer", "cwd", "composio", "chiefOfStaff", "acknowledgeLocalAuto", "sharedMemoryId"]) {
      const result = parseBotProfilePatch({ name: "Mira", [field]: true } as never, true);
      expect(result.ok, field).toBe(false);
      if (!result.ok) expect(result.error).toContain(field);
    }
  });

  it("refuses unknown cosmetic keys too — strict means the allowlist IS the contract", () => {
    const result = parseBotProfilePatch({ color: "red" } as never, true);
    expect(result).toEqual({ ok: false, error: "unsupported profile field: color" });
  });

  it("accepts the full identity surface", () => {
    const result = parseBotProfilePatch(
      { name: "Mira", title: "Lead", description: "plans", notifications: true, voice: "vx", speakReplies: false },
      true,
    );
    expect(result).toEqual({
      ok: true,
      patch: { name: "Mira", title: "Lead", description: "plans", notifications: true, voice: "vx", speakReplies: false },
    });
  });

  it("accepts only bounded spirit identity and art direction", () => {
    expect(parseBotProfilePatch({
      spirit: "ganga",
      spiritPalette: "rose",
      spiritGeometry: "constellation",
      spiritTemperament: "playful",
    }, true)).toEqual({
      ok: true,
      patch: {
        spirit: "ganga",
        spiritPalette: "rose",
        spiritGeometry: "constellation",
        spiritTemperament: "playful",
      },
    });
    // SAFETY: These deliberately invalid literals exercise runtime schema rejection.
    expect(parseBotProfilePatch({ spirit: "cursor" } as never, true).ok).toBe(false);
    // SAFETY: These deliberately invalid literals exercise runtime schema rejection.
    expect(parseBotProfilePatch({ spiritPalette: "radioactive" } as never, true).ok).toBe(false);
    // SAFETY: These deliberately invalid literals exercise runtime schema rejection.
    expect(parseBotProfilePatch({ spiritGeometry: "triangle" } as never, true).ok).toBe(false);
    // SAFETY: These deliberately invalid literals exercise runtime schema rejection.
    expect(parseBotProfilePatch({ spiritTemperament: "random" } as never, true).ok).toBe(false);
    expect(parseBotProfilePatch({ spirit: null }, true)).toEqual({ ok: true, patch: { spirit: undefined } });
  });

  it("accepts, normalizes, and clears public contact labels", () => {
    expect(parseBotProfilePatch({
      email: "  Agent@Example.COM ",
      phone: " +1 (555) 123-4567 ",
      whatsapp: "  @agent_room ",
    }, true)).toEqual({
      ok: true,
      patch: { email: "agent@example.com", phone: "+15551234567", whatsapp: "@agent_room" },
    });
    expect(parseBotProfilePatch({ email: null, phone: "", whatsapp: null }, true)).toEqual({
      ok: true,
      patch: { email: undefined, phone: undefined, whatsapp: undefined },
    });
  });

  it("rejects malformed or oversized public contact labels", () => {
    for (const [field, value] of [
      ["email", "not-an-email"],
      ["phone", "555-12"],
      ["whatsapp", "https://example.com"],
      ["email", `${"a".repeat(245)}@example.com`],
    ] as const) {
      const result = parseBotProfilePatch({ [field]: value } as never, true);
      expect(result.ok, `${field}: ${value}`).toBe(false);
    }
  });
});

describe("normalizeBotContact", () => {
  it("does not treat arbitrary strings as routing identities", () => {
    expect(normalizeBotContact("phone", "call me").ok).toBe(false);
    expect(normalizeBotContact("whatsapp", "  team room  ").ok).toBe(false);
  });
});

describe("parseBotProfilePatch (both modes)", () => {
  it("lenient mode drops unknown keys instead of failing — the desktop PATCH mixes fields", () => {
    const result = parseBotProfilePatch({ name: "Mira", color: "red" } as never, false);
    expect(result).toEqual({ ok: true, patch: { name: "Mira" } });
  });

  it("rejects a blank or oversized name", () => {
    expect(parseBotProfilePatch({ name: "   " }, true).ok).toBe(false);
    expect(parseBotProfilePatch({ name: "x".repeat(101) }, true).ok).toBe(false);
  });

  it("accepts a bounded shared memory identity only on the local desktop boundary", () => {
    expect(parseBotProfilePatch({ sharedMemoryId: "coach" }, false)).toEqual({
      ok: true,
      patch: { sharedMemoryId: "coach" },
    });
    expect(parseBotProfilePatch({ sharedMemoryId: "Coach Memory" }, false).ok).toBe(false);
    expect(parseBotProfilePatch({ sharedMemoryId: "coach" }, true)).toEqual({
      ok: false,
      error: "unsupported profile field: sharedMemoryId",
    });
  });

  it("only stored-attachment avatar URLs pass; clears normalize to undefined", () => {
    for (const bad of ["https://example.com/a.png", "data:image/png;base64,AAAA", "/api/attachments/../config.json", "/api/attachments/a.svg"]) {
      expect(parseBotProfilePatch({ avatarUrl: bad } as never, true).ok, bad).toBe(false);
    }
    const cleared = parseBotProfilePatch({ avatarUrl: "" }, true);
    expect(cleared).toEqual({ ok: true, patch: { avatarUrl: undefined } });
    const nulled = parseBotProfilePatch({ avatarUrl: null }, true);
    expect(nulled).toEqual({ ok: true, patch: { avatarUrl: undefined } });
  });

  it("maps an avatarCrop issue to the readable message", () => {
    expect(parseBotProfilePatch({ avatarCrop: "hexagon" } as never, true)).toEqual({
      ok: false,
      error: "avatarCrop must be mascot, circle, rounded, or square",
    });
  });
});
