import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface HttpMonitorAdapterOptions {
  fetch?: typeof globalThis.fetch;
  resolve?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
  maxBytes?: number;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ACCEPTED = /^(text\/(html|plain|xml)|application\/(xml|rss\+xml|atom\+xml|xhtml\+xml))(?:\s*;|$)/i;

/** Fetches a public text webpage; it does not execute or interpret page content. */
export function createHttpMonitorAdapter(options: HttpMonitorAdapterOptions = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const resolveHost = options.resolve ?? (async (hostname: string) =>
    (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  return async (source: Record<string, unknown>, _config: Record<string, unknown>) => {
    const raw = String(source.url ?? "").trim();
    const url = validatePublicUrl(raw);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw new Error("Invalid HTTP monitor timeout");
    if (!Number.isFinite(maxBytes) || maxBytes < 1_024 || maxBytes > 20 * 1024 * 1024) throw new Error("Invalid HTTP monitor response limit");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let current = url;
      let response: Response | null = null;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        await assertPublicResolution(current, resolveHost);
        response = await fetchImpl(current, { redirect: "manual", signal: controller.signal, headers: { accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1" } });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        if (redirects === MAX_REDIRECTS) throw new Error("HTTP monitor exceeded redirect limit");
        const location = response.headers.get("location");
        if (!location) throw new Error("HTTP monitor redirect has no destination");
        current = validatePublicUrl(new URL(location, current).toString());
      }
      if (!response) throw new Error("HTTP monitor produced no response");
      validatePublicUrl(response.url || current);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get("content-type") ?? "";
      if (!ACCEPTED.test(type)) throw new Error("HTTP monitor received an unsupported content type");
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > maxBytes) throw new Error("HTTP monitor response exceeds byte limit");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) throw new Error("HTTP monitor response exceeds byte limit");
      return { content: new TextDecoder().decode(bytes), metadata: { url: response.url || current, contentType: type.split(";", 1)[0].toLowerCase(), bytes: bytes.byteLength } };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw new Error("HTTP monitor request timed out");
      throw error;
    } finally { clearTimeout(timer); }
  };
}

async function assertPublicResolution(url: string, resolveHost: (hostname: string) => Promise<string[]>): Promise<void> {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return;
  const addresses = await resolveHost(hostname);
  if (!addresses.length || addresses.some((address) => isPrivateHost(address))) {
    throw new Error("Monitor URL resolves to a non-public address");
  }
}

export function validatePublicUrl(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Monitor URL is invalid"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Monitor URL must use HTTP or HTTPS");
  if (parsed.username || parsed.password) throw new Error("Monitor URL cannot contain credentials");
  if (isPrivateHost(parsed.hostname)) throw new Error("Monitor URL must point to a public host");
  return parsed.toString();
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host === "local" ||
    host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home") || host.endsWith(".lan")
  ) return true;
  // URL canonicalization rewrites dotted IPv4-mapped literals to hex
  // (::ffff:7f00:1). Reject the entire mapped range rather than attempting a
  // second parser and accidentally admitting a private address variant.
  if (host.startsWith("::ffff:")) return true;
  if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}
