import { describe, expect, it, vi } from "vitest";

import { createHttpMonitorAdapter, validatePublicUrl } from "./monitor-http-adapter.ts";

function response(body: string, type = "text/html", url = "https://example.test/"): Response {
  const value = new Response(body, { status: 200, headers: { "content-type": type } });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("HTTP monitor adapter", () => {
  it("fetches accepted public text through the shared hardened utility", async () => {
    const fetcher = vi.fn(async () => response("<h1>Hello</h1>"));
    const adapter = createHttpMonitorAdapter({
      fetch: fetcher,
      resolve: async () => ["93.184.216.34"],
      maxBytes: 1_024,
    });
    await expect(adapter({ kind: "http", url: "https://example.test" }, {})).resolves.toMatchObject({
      content: "<h1>Hello</h1>",
      metadata: { url: "https://example.test/", contentType: "text/html" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects private targets before fetch", async () => {
    for (const url of [
      "http://localhost/a",
      "http://127.0.0.1",
      "http://10.0.0.1",
      "http://169.254.1.2",
      "http://[::ffff:127.0.0.1]",
    ]) expect(() => validatePublicUrl(url)).toThrow();
    const fetcher = vi.fn();
    const adapter = createHttpMonitorAdapter({
      fetch: fetcher,
      resolve: async () => ["127.0.0.1"],
    });
    await expect(adapter({ kind: "http", url: "https://example.test" }, {})).rejects.toThrow("non-public");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
