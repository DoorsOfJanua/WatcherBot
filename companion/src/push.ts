// Closed-app notifications, delivered directly from the owner's computer to
// APNs. No hosted relay receives transcripts or device credentials.
import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";
import { readFileSync } from "node:fs";

import type { PushRegistration } from "./devices.ts";

export interface PushTarget extends PushRegistration { deviceId: string }
export interface NotifyFrame {
  title: string;
  body: string;
  botId: string;
  threadId: string;
  kind: string;
  isBlocking?: boolean;
}

export interface ApnsConfig {
  teamId: string;
  keyId: string;
  bundleId: string;
  privateKey: string;
}

const b64url = (value: string | Buffer): string => Buffer.from(value).toString("base64url");
const clipUtf8 = (value: string, maxBytes: number): string => {
  let out = "";
  let bytes = 0;
  for (const character of value) {
    const width = Buffer.byteLength(character);
    if (bytes + width > maxBytes) break;
    out += character;
    bytes += width;
  }
  return out;
};

export function apnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const teamId = env.OMB_APNS_TEAM_ID?.trim();
  const keyId = env.OMB_APNS_KEY_ID?.trim();
  const inline = env.OMB_APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  let privateKey = inline;
  if (!privateKey && env.OMB_APNS_PRIVATE_KEY_PATH) {
    try { privateKey = readFileSync(env.OMB_APNS_PRIVATE_KEY_PATH, "utf8").trim(); } catch { return null; }
  }
  if (!teamId || !keyId || !privateKey) return null;
  try { createPrivateKey(privateKey); } catch { return null; }
  return {
    teamId,
    keyId,
    privateKey,
    bundleId: env.OMB_APNS_BUNDLE_ID?.trim() || "com.doorsofjanua.agentroom",
  };
}

export function notificationPayload(frame: NotifyFrame): Record<string, unknown> {
  return {
    aps: {
      // Standard APNs payloads cap at 4 KB. Keep generous room for ids and
      // JSON escaping even when the text is all four-byte emoji.
      alert: { title: clipUtf8(frame.title, 300), body: clipUtf8(frame.body, 2_500) },
      sound: "default",
      category: frame.isBlocking ? "WATCHERBOT_APPROVAL" : "WATCHERBOT_UPDATE",
      "thread-id": frame.threadId,
      "interruption-level": frame.isBlocking ? "time-sensitive" : "active",
    },
    botId: frame.botId,
    threadId: frame.threadId,
    kind: frame.kind,
  };
}

export class ApnsSender {
  private readonly config: ApnsConfig;
  private jwt = "";
  private jwtAt = 0;

  constructor(config: ApnsConfig) { this.config = config; }

  private authorization(now = Math.floor(Date.now() / 1000)): string {
    if (this.jwt && now - this.jwtAt < 50 * 60) return this.jwt;
    const header = b64url(JSON.stringify({ alg: "ES256", kid: this.config.keyId }));
    const claims = b64url(JSON.stringify({ iss: this.config.teamId, iat: now }));
    const unsigned = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(unsigned), {
      key: this.config.privateKey,
      dsaEncoding: "ieee-p1363",
    });
    this.jwt = `${unsigned}.${b64url(signature)}`;
    this.jwtAt = now;
    return this.jwt;
  }

  send(target: PushTarget, frame: NotifyFrame): Promise<"sent" | "invalid" | "failed"> {
    const origin = target.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
    return new Promise((resolve) => {
      const client = connect(origin);
      let settled = false;
      const finish = (result: "sent" | "invalid" | "failed") => {
        if (settled) return;
        settled = true;
        client.close();
        resolve(result);
      };
      client.once("error", () => finish("failed"));
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${target.token}`,
        authorization: `bearer ${this.authorization()}`,
        "apns-topic": this.config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
      });
      let status = 0;
      let response = "";
      request.setEncoding("utf8");
      request.on("response", (headers) => { status = Number(headers[":status"] ?? 0); });
      request.on("data", (chunk: string) => { response += chunk; });
      request.on("end", () => {
        if (status === 200) return finish("sent");
        let reason = "";
        try { reason = String(JSON.parse(response).reason ?? ""); } catch { /* APNs may close without JSON */ }
        finish(status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" ? "invalid" : "failed");
      });
      request.once("error", () => finish("failed"));
      request.end(JSON.stringify(notificationPayload(frame)));
    });
  }
}

interface PushServiceOptions {
  harnessPort: number;
  targets: () => PushTarget[];
  unregister: (deviceId: string) => void;
  sender: Pick<ApnsSender, "send">;
  log?: (line: string) => void;
}

/** A resumable loopback SSE subscriber. It receives only policy-approved
 * notify frames and fans them out to devices whose app stream is not open. */
export class PushService {
  private readonly options: PushServiceOptions;
  private stopped = false;
  private cursor: string | undefined;

  constructor(options: PushServiceOptions) { this.options = options; }

  stop(): void { this.stopped = true; }

  async run(): Promise<void> {
    let delay = 1000;
    while (!this.stopped) {
      try {
        const url = new URL(`http://127.0.0.1:${this.options.harnessPort}/api/events`);
        url.searchParams.set("screens", "off");
        const response = await fetch(url, {
          headers: this.cursor ? { "last-event-id": this.cursor } : {},
          signal: AbortSignal.timeout(24 * 60 * 60 * 1000),
        });
        if (!response.ok || !response.body) throw new Error(`event stream answered ${response.status}`);
        delay = 1000;
        await this.consume(response.body);
      } catch (error) {
        if (this.stopped) return;
        this.options.log?.(`push stream: ${(error as Error).message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 15_000);
      }
    }
  }

  private async consume(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done || this.stopped) return;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      for (;;) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary < 0) break;
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await this.handleEvent(event);
      }
    }
  }

  private async handleEvent(event: string): Promise<void> {
    let data = "";
    for (const line of event.split("\n")) {
      if (line.startsWith("id:")) this.cursor = line.slice(3).trim();
      if (line.startsWith("data:")) data += `${line.slice(5).trimStart()}\n`;
    }
    if (!data) return;
    let parsed: { kind?: string; notification?: NotifyFrame };
    try { parsed = JSON.parse(data); } catch { return; }
    if (parsed.kind !== "notify" || !parsed.notification) return;
    const targets = this.options.targets();
    await Promise.all(targets.map(async (target) => {
      const result = await this.options.sender.send(target, parsed.notification!);
      if (result === "invalid") this.options.unregister(target.deviceId);
    }));
  }
}
