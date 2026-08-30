import { afterEach, describe, expect, it, vi } from "vitest";

import {
  STUDIO_ORIGIN,
  studioBotMatches,
  studioFetch,
  studioIntegration,
  studioRender,
} from "./studio.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ganga Studio integration", () => {
  it("mounts only for content specialists", () => {
    expect(studioBotMatches({ name: "Ganga" })).toBe(true);
    expect(studioBotMatches({ title: "Instagram editor" })).toBe(true);
    expect(studioBotMatches({ description: "Social content strategy" })).toBe(true);
    expect(studioBotMatches({ name: "Mailman", title: "Inbox" })).toBe(false);

    const integration = studioIntegration();
    expect(integration.command).toMatch(/[\\/]GangaStudio[\\/]node_modules[\\/]\.bin[\\/]tsx$/);
    expect(integration.args[0]).toMatch(/[\\/]GangaStudio[\\/]server[\\/]mcp\.ts$/);
    expect(integration.env).toEqual({});
  });

  it("uses only the configured loopback origin and parses review JSON", async () => {
    const fetchMock = vi.fn(async () => new Response('{"waiting":2}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(studioFetch("/api/review")).resolves.toEqual({ status: 200, body: { waiting: 2 } });
    expect(fetchMock).toHaveBeenCalledWith(
      `${STUDIO_ORIGIN}/api/review`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects render traversal before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(studioRender("../../etc/passwd")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
