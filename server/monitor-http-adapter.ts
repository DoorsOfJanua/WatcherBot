import {
  fetchPublicText,
  type PublicTextFetchOptions,
  validatePublicHttpUrl,
} from "./public-http-fetch.ts";

export type HttpMonitorAdapterOptions = PublicTextFetchOptions;

export interface MonitorAdapterResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export type MonitorSourceAdapter = (
  source: Record<string, unknown>,
  config: Record<string, unknown>,
) => Promise<MonitorAdapterResult | string>;

/** Monitor-shaped adapter over the shared SSRF-hardened public fetch. */
export function createHttpMonitorAdapter(options: HttpMonitorAdapterOptions = {}): MonitorSourceAdapter {
  return async (source) => {
    const result = await fetchPublicText(String(source.url ?? ""), options);
    return { content: result.content, metadata: result.metadata };
  };
}

/** Compatibility name retained for callers/tests from the checkpoint lane. */
export const validatePublicUrl = validatePublicHttpUrl;
