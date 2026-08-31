import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface PublicTextFetchOptions {
  fetch?: typeof globalThis.fetch;
  resolve?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface PublicTextFetchResult {
  content: string;
  metadata: {
    url: string;
    contentType: string;
    bytes: number;
  };
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TEXT_CONTENT_TYPE = /^(text\/(html|plain|xml)|application\/(xml|rss\+xml|atom\+xml|xhtml\+xml))(?:\s*;|$)/i;

/** Fetch public text without permitting redirects or DNS results to cross
 * into loopback, link-local, private, or otherwise non-public networks. */
export async function fetchPublicText(
  rawUrl: string,
  options: PublicTextFetchOptions = {},
): Promise<PublicTextFetchResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const resolveHost = options.resolve ?? (async (hostname: string) =>
    (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    throw new Error("Invalid public HTTP timeout");
  }
  if (!Number.isFinite(maxBytes) || maxBytes < 1_024 || maxBytes > 20 * 1024 * 1024) {
    throw new Error("Invalid public HTTP response limit");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = validatePublicHttpUrl(rawUrl);
    let response: Response | null = null;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      await assertPublicResolution(current, resolveHost);
      response = await fetchImpl(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirects === MAX_REDIRECTS) throw new Error("Public HTTP request exceeded redirect limit");
      const location = response.headers.get("location");
      if (!location) throw new Error("Public HTTP redirect has no destination");
      current = validatePublicHttpUrl(new URL(location, current).toString());
    }
    if (!response) throw new Error("Public HTTP request produced no response");
    const finalUrl = validatePublicHttpUrl(response.url || current);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!TEXT_CONTENT_TYPE.test(contentType)) {
      throw new Error("Public HTTP request received an unsupported content type");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("Public HTTP response exceeds byte limit");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error("Public HTTP response exceeds byte limit");
    return {
      content: new TextDecoder().decode(bytes),
      metadata: {
        url: finalUrl,
        contentType: contentType.split(";", 1)[0]!.toLowerCase(),
        bytes: bytes.byteLength,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Public HTTP request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function assertPublicResolution(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]>,
): Promise<void> {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return;
  const addresses = await resolveHost(hostname);
  if (addresses.length === 0 || addresses.some((address) => isPrivateHost(address))) {
    throw new Error("Public URL resolves to a non-public address");
  }
}

export function validatePublicHttpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(String(raw ?? "").trim());
  } catch {
    throw new Error("Public URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Public URL must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password) throw new Error("Public URL cannot contain credentials");
  if (isPrivateHost(parsed.hostname)) throw new Error("Public URL must point to a public host");
  return parsed.toString();
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host === "local" ||
    host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home") || host.endsWith(".lan")
  ) return true;
  // URL canonicalization rewrites dotted IPv4-mapped literals to hex. Reject
  // the complete mapped range rather than admitting alternate private forms.
  if (host.startsWith("::ffff:")) return true;
  if (
    host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1" ||
    host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")
  ) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19));
}
