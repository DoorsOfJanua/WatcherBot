import { describe, expect, it, vi } from "vitest";

import { fetchPublicText, validatePublicHttpUrl } from "./public-http-fetch.ts";

function response(body: string, type = "text/html", url = "https://example.test/"): Response {
  const value = new Response(body, { status: 200, headers: { "content-type": type } });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("public HTTP fetch", () => {
  it("fetches accepted text with manual redirects and byte limits", async () => {
    const fetcher = vi.fn(async () => response("<h1>Hello</h1>"));
    await expect(fetchPublicText("https://example.test", {
      fetch: fetcher,
      resolve: async () => ["93.184.216.34"],
      maxBytes: 1_024,
    })).resolves.toMatchObject({ content: "<h1>Hello</h1>" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/",
      expect.objectContaining({ redirect: "manual" }),
    );
    await expect(fetchPublicText("https://example.test", {
      fetch: async () => response("{}", "application/json"),
      resolve: async () => ["93.184.216.34"],
    })).rejects.toThrow("content type");
  });

  it("blocks private literals, DNS results, and redirect destinations", async () => {
    for (const url of [
      "http://localhost/a",
      "http://printer.local",
      "http://metadata.google.internal",
      "http://127.0.0.1",
      "http://10.0.0.1",
      "http://192.168.1.4",
      "http://169.254.1.2",
      "http://[::ffff:127.0.0.1]",
      "ftp://example.test",
    ]) expect(() => validatePublicHttpUrl(url)).toThrow();

    const neverFetch = vi.fn();
    await expect(fetchPublicText("https://example.test", {
      fetch: neverFetch,
      resolve: async () => ["127.0.0.1"],
    })).rejects.toThrow("non-public");
    expect(neverFetch).not.toHaveBeenCalled();

    const redirect = new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
    await expect(fetchPublicText("https://example.test", {
      fetch: async () => redirect,
      resolve: async () => ["93.184.216.34"],
    })).rejects.toThrow("public host");
  });
});
