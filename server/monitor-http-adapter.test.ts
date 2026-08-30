import { describe, expect, it, vi } from "vitest";
import { createHttpMonitorAdapter, validatePublicUrl } from "./monitor-http-adapter.ts";

function response(body: string, type = "text/html", url = "https://example.test/"): Response {
  const value = new Response(body, { status: 200, headers: { "content-type": type } });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("HTTP monitor adapter", () => {
  it("fetches accepted text and enforces limits", async () => {
    const fetcher = vi.fn(async () => response("<h1>Hello</h1>"));
    const resolve = async () => ["93.184.216.34"];
    const adapter = createHttpMonitorAdapter({ fetch: fetcher, resolve, maxBytes: 1024 });
    await expect(adapter({ url: "https://example.test" }, {})).resolves.toMatchObject({ content: "<h1>Hello</h1>" });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/", expect.objectContaining({ redirect: "manual" }));
    await expect(createHttpMonitorAdapter({ fetch: async () => response("x", "application/json"), resolve })({ url: "https://example.test" }, {})).rejects.toThrow("content type");
    await expect(createHttpMonitorAdapter({ fetch: async () => response("12345"), resolve, maxBytes: 1024 })({ url: "https://example.test" }, {})).resolves.toBeTruthy();
  });

  it("blocks private targets and private redirect destinations", async () => {
    for (const url of ["http://localhost/a", "http://printer.local", "http://metadata.google.internal", "http://127.0.0.1", "http://10.0.0.1", "http://192.168.1.4", "http://169.254.1.2", "http://[::ffff:127.0.0.1]", "ftp://example.test"]) expect(() => validatePublicUrl(url)).toThrow();
    const resolve = async () => ["93.184.216.34"];
    await expect(createHttpMonitorAdapter({ fetch: async () => response("x", "text/plain"), resolve })({ url: "https://example.test" }, {})).resolves.toBeTruthy();
    await expect(createHttpMonitorAdapter({ fetch: async () => response("x", "text/plain", "http://127.0.0.1/private"), resolve })({ url: "https://example.test" }, {})).rejects.toThrow("public host");
    const privateRedirect = new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    const redirectFetch = vi.fn(async () => privateRedirect);
    await expect(createHttpMonitorAdapter({ fetch: redirectFetch, resolve })({ url: "https://example.test" }, {})).rejects.toThrow("public host");
    expect(redirectFetch).toHaveBeenCalledTimes(1);
    const neverFetch = vi.fn();
    await expect(createHttpMonitorAdapter({ fetch: neverFetch, resolve: async () => ["127.0.0.1"] })({ url: "https://example.test" }, {})).rejects.toThrow("non-public");
    expect(neverFetch).not.toHaveBeenCalled();
  });
});
