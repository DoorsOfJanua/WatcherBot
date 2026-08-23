// Mailman's exact-draft approval boundary.
//
// The model can only PROPOSE a normalized draft. The harness persists that
// frozen payload, binds it to an ActionReceipt hash, and is the only process
// allowed to claim the receipt and invoke the provider. A provider failure
// after claim is deliberately not retryable: SMTP/API acceptance can be
// ambiguous, and duplicate mail is worse than a visible manual check.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { ActionReceiptError, ActionReceiptStore, type ActionReceipt } from "./action-receipts.ts";
import { writeFileAtomic } from "./atomic.ts";
import { parseJson, type JsonValue } from "./schema.ts";

export type MailDraft = {
  fromAccount: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: [];
};

export type MailSendReceipt = {
  provider: "gmail" | "proton-bridge";
  account: string;
  messageId: string;
  acceptedAt: string;
};

export type MailActionState = "pending" | "dismissed" | "sending" | "sent" | "failed";

export interface FrozenMailAction {
  receiptId: string;
  botId: string;
  threadId: string;
  draft: MailDraft;
  draftHash: string;
  state: MailActionState;
  createdAt: string;
  updatedAt: string;
  providerReceipt?: MailSendReceipt;
  /** Safe provider diagnostic only; never stdout, credentials, or the draft. */
  failure?: string;
}

export interface MailSender {
  send(draft: MailDraft, expectedHash: string): Promise<MailSendReceipt>;
}

export interface MailRevision {
  previous: FrozenMailAction;
  action: FrozenMailAction;
  receipt: ActionReceipt;
  changed: boolean;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HASH = /^[a-f0-9]{64}$/;
const FILE_NAME = "mail-actions.json";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeHeader(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${name} must be text`);
  const result = value.trim();
  if (!result || result.length > max || /[\r\n]/.test(result)) {
    throw new Error(`${name} is missing, too long, or contains a line break`);
  }
  return result;
}

function normalizeRecipients(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${name} must be a list of at most 20 email addresses`);
  }
  const result = value.map((item) => normalizeHeader(item, name, 320).toLowerCase());
  if (result.some((item) => !EMAIL.test(item))) throw new Error(`${name} contains an invalid email address`);
  return [...new Set(result)];
}

export function normalizeMailDraft(value: unknown): MailDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("mail draft must be a JSON object");
  const raw = value as Record<string, unknown>;
  const fromAccount = normalizeHeader(raw.fromAccount, "fromAccount", 320).toLowerCase();
  if (!EMAIL.test(fromAccount)) throw new Error("fromAccount must be an email address");
  const to = normalizeRecipients(raw.to, "to");
  if (!to.length) throw new Error("a mail draft needs at least one recipient");
  const cc = normalizeRecipients(raw.cc ?? [], "cc");
  const bcc = normalizeRecipients(raw.bcc ?? [], "bcc");
  if (new Set([...to, ...cc, ...bcc]).size !== to.length + cc.length + bcc.length) {
    throw new Error("the same recipient cannot appear in more than one recipient field");
  }
  const subject = normalizeHeader(raw.subject, "subject", 300);
  if (typeof raw.body !== "string" || !raw.body.trim() || raw.body.length > 50_000) {
    throw new Error("body must contain 1 to 50,000 characters");
  }
  if (!Array.isArray(raw.attachments) || raw.attachments.length !== 0) {
    throw new Error("attachments are not enabled yet; the draft must use an empty list");
  }
  return {
    fromAccount,
    to,
    cc,
    bcc,
    subject,
    body: raw.body.replace(/\r\n/g, "\n").trim(),
    attachments: [],
  };
}

/** The exact bytes hashed by both this harness and the Python provider gate. */
export function canonicalMailDraft(draft: MailDraft): string {
  return stable(normalizeMailDraft(draft));
}

export function mailDraftHash(draft: MailDraft): string {
  return createHash("sha256").update(canonicalMailDraft(draft), "utf8").digest("hex");
}

export function mailDraftPreview(draft: MailDraft, hash: string): string {
  return [
    `Frozen draft · ${hash.slice(0, 12)}`,
    `From: ${draft.fromAccount}`,
    `To: ${draft.to.join(", ")}`,
    ...(draft.cc.length ? [`Cc: ${draft.cc.join(", ")}`] : []),
    ...(draft.bcc.length ? [`Bcc: ${draft.bcc.join(", ")}`] : []),
    `Subject: ${draft.subject}`,
    "Attachments: none",
    "",
    draft.body,
  ].join("\n");
}

const receiptSchema = z.object({
  provider: z.enum(["gmail", "proton-bridge"]),
  account: z.string().min(1),
  messageId: z.string().min(1),
  acceptedAt: z.string().min(1),
});

const storedSchema = z.object({
  receiptId: z.string().min(1),
  botId: z.string().min(1),
  threadId: z.string().min(1),
  draft: z.unknown(),
  draftHash: z.string().regex(HASH),
  state: z.enum(["pending", "dismissed", "sending", "sent", "failed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  providerReceipt: receiptSchema.optional(),
  failure: z.string().optional(),
});

function safeFailure(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^\(node:\d+\) \[DEP0040\][^\n]*\n?/gm, "")
    .replace(/^\(Use `node --trace-deprecation[^\n]*\n?/gm, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 1_000) || "Mail provider failed without a diagnostic";
}

export class MailActionStore {
  private readonly file: string;
  private readonly actions = new Map<string, FrozenMailAction>();

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.file = join(dataDir, FILE_NAME);
    try {
      const raw = parseJson(readFileSync(this.file, "utf8"));
      if (Array.isArray(raw)) {
        for (const value of raw) {
          const parsed = storedSchema.safeParse(value);
          if (!parsed.success) continue;
          try {
            const draft = normalizeMailDraft(parsed.data.draft);
            if (mailDraftHash(draft) !== parsed.data.draftHash) continue;
            this.actions.set(parsed.data.receiptId, { ...parsed.data, draft });
          } catch { /* fail closed on malformed or tampered payloads */ }
        }
      }
    } catch { /* first run or malformed legacy file */ }
  }

  private save(): void {
    writeFileAtomic(this.file, JSON.stringify([...this.actions.values()], null, 2), { mode: 0o600 });
  }

  get(receiptId: string): FrozenMailAction | undefined {
    const action = this.actions.get(receiptId);
    return action ? structuredClone(action) : undefined;
  }

  put(action: FrozenMailAction): FrozenMailAction {
    if (this.actions.has(action.receiptId)) throw new Error("mail action already exists");
    this.actions.set(action.receiptId, structuredClone(action));
    this.save();
    return structuredClone(action);
  }

  update(receiptId: string, patch: Partial<Pick<FrozenMailAction, "state" | "updatedAt" | "providerReceipt" | "failure">>): FrozenMailAction {
    const current = this.actions.get(receiptId);
    if (!current) throw new Error("no such mail action");
    const next = { ...current, ...patch };
    this.actions.set(receiptId, next);
    this.save();
    return structuredClone(next);
  }
}

export class MailActionCoordinator {
  private readonly receipts: ActionReceiptStore;
  private readonly actions: MailActionStore;
  private readonly sender: MailSender;
  private readonly now: () => number;

  constructor(
    receipts: ActionReceiptStore,
    actions: MailActionStore,
    sender: MailSender,
    now: () => number = () => Date.now(),
  ) {
    this.receipts = receipts;
    this.actions = actions;
    this.sender = sender;
    this.now = now;
  }

  stage(input: { botId: string; threadId: string; draft: unknown; expiresInMs?: number }): { action: FrozenMailAction; receipt: ActionReceipt } {
    const draft = normalizeMailDraft(input.draft);
    const canonical = canonicalMailDraft(draft);
    const draftHash = mailDraftHash(draft);
    const at = new Date(this.now()).toISOString();
    const receipt = this.receipts.create({
      actionType: "email.send",
      channel: "email",
      account: draft.fromAccount,
      destination: [...draft.to, ...draft.cc, ...draft.bcc].join(", "),
      content: canonical,
      contentHash: draftHash,
      preview: mailDraftPreview(draft, draftHash),
      expiresAt: this.now() + (input.expiresInMs ?? 30 * 60_000),
      createdAt: this.now(),
    });
    const action = this.actions.put({
      receiptId: receipt.id,
      botId: input.botId,
      threadId: input.threadId,
      draft,
      draftHash,
      state: "pending",
      createdAt: at,
      updatedAt: at,
    });
    return { action, receipt };
  }

  get(receiptId: string): FrozenMailAction | undefined {
    return this.actions.get(receiptId);
  }

  /** Editing never mutates a frozen payload. It stages a new receipt first,
   * then closes the old one, so an approved hash can never silently acquire
   * different words. Both revisions remain in the audit history. */
  revise(receiptId: string, draftValue: unknown): MailRevision {
    const previous = this.required(receiptId);
    if (previous.state !== "pending" && previous.state !== "dismissed") {
      throw new Error(`mail action is ${previous.state}; check Sent before creating a fresh draft`);
    }
    const draft = normalizeMailDraft(draftValue);
    if (mailDraftHash(draft) === previous.draftHash) {
      return {
        previous,
        action: previous,
        receipt: this.receipts.get(previous.receiptId),
        changed: false,
      };
    }
    const staged = this.stage({ botId: previous.botId, threadId: previous.threadId, draft });
    if (previous.state === "pending") {
      try {
        this.receipts.invalidate(previous.receiptId, previous.draftHash);
      } catch (error) {
        if (!(error instanceof ActionReceiptError) || error.code !== "expired") throw error;
      }
      this.actions.update(previous.receiptId, {
        state: "dismissed",
        updatedAt: new Date(this.now()).toISOString(),
      });
    }
    return { previous, ...staged, changed: true };
  }

  deny(receiptId: string): FrozenMailAction {
    const action = this.required(receiptId);
    if (action.state === "sent" || action.state === "sending") return action;
    this.receipts.invalidate(receiptId, action.draftHash);
    return this.actions.update(receiptId, { state: "dismissed", updatedAt: new Date(this.now()).toISOString() });
  }

  async approveAndSend(receiptId: string, approvedBy: string): Promise<FrozenMailAction> {
    const action = this.required(receiptId);
    if (action.state === "sent") return action;
    if (action.state !== "pending") throw new Error(`mail action is ${action.state}; create a fresh draft`);
    const currentHash = mailDraftHash(action.draft);
    if (currentHash !== action.draftHash) throw new Error("frozen mail payload changed; refusing to send");
    this.receipts.approve(receiptId, currentHash, approvedBy);
    // Claim is the synchronous at-most-once gate. No await may appear before
    // it after approval: two taps can arrive together from desktop + phone.
    this.receipts.claim(receiptId, currentHash);
    this.actions.update(receiptId, { state: "sending", updatedAt: new Date(this.now()).toISOString() });
    try {
      const providerReceipt = receiptSchema.parse(await this.sender.send(action.draft, currentHash));
      this.receipts.consume(receiptId, currentHash, providerReceipt as unknown as JsonValue);
      return this.actions.update(receiptId, {
        state: "sent",
        updatedAt: new Date(this.now()).toISOString(),
        providerReceipt,
        failure: undefined,
      });
    } catch (error) {
      const failure = safeFailure(error);
      this.actions.update(receiptId, { state: "failed", updatedAt: new Date(this.now()).toISOString(), failure });
      throw new Error(failure);
    }
  }

  private required(receiptId: string): FrozenMailAction {
    const action = this.actions.get(receiptId);
    if (!action) throw new Error("no such mail action");
    return action;
  }
}

type GatewayConfig = {
  pythonPath: string;
  scriptPath: string;
  limenNodePath: string;
  limenCliPath: string;
  limenProjectRoot: string;
  limenVaultPath: string;
  protonAccounts: string[];
};

function envPath(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

/** Janua's proven AgentHQ gateway, with explicit env overrides for moving it. */
export function januaMailGatewayConfig(): GatewayConfig {
  return {
    pythonPath: envPath("OMB_MAIL_PYTHON", existsSync("/opt/anaconda3/bin/python3") ? "/opt/anaconda3/bin/python3" : "/opt/homebrew/bin/python3"),
    scriptPath: envPath("OMB_MAIL_GATEWAY_SCRIPT", "/Users/janua/Projects/AgentHQ/hq-telegram/scripts/mail_gateway.py"),
    limenNodePath: envPath("OMB_LIMEN_NODE_PATH", "/usr/local/bin/node"),
    limenCliPath: envPath("OMB_LIMEN_CLI_PATH", "/Users/janua/Projects/LimenOS/packages/kernel/dist/cli/main.js"),
    limenProjectRoot: envPath("OMB_LIMEN_PROJECT_ROOT", "/Users/janua/Projects/LimenOS"),
    limenVaultPath: envPath("OMB_LIMEN_VAULT_PATH", "/Users/janua/Documents/LifeOS"),
    protonAccounts: (process.env.OMB_PROTON_ACCOUNTS || "nils.palmen@protonmail.com")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };
}

export class PythonMailGateway implements MailSender {
  private readonly config: GatewayConfig;

  constructor(config: GatewayConfig = januaMailGatewayConfig()) {
    this.config = config;
  }

  async send(draft: MailDraft, expectedHash: string): Promise<MailSendReceipt> {
    const normalized = normalizeMailDraft(draft);
    if (mailDraftHash(normalized) !== expectedHash) throw new Error("Email draft hash changed after approval; refusing to send");
    for (const required of [
      this.config.pythonPath,
      this.config.scriptPath,
      this.config.limenNodePath,
      this.config.limenCliPath,
      this.config.limenProjectRoot,
      this.config.limenVaultPath,
    ]) {
      if (!existsSync(required)) throw new Error(`Mail gateway dependency is missing: ${required}`);
    }
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.config.pythonPath, [this.config.scriptPath, "send"], {
        cwd: this.config.limenProjectRoot,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          PYTHONUNBUFFERED: "1",
          MAIL_LIMEN_NODE_PATH: this.config.limenNodePath,
          MAIL_LIMEN_CLI_PATH: this.config.limenCliPath,
          MAIL_LIMEN_PROJECT_ROOT: this.config.limenProjectRoot,
          MAIL_LIMEN_VAULT_PATH: this.config.limenVaultPath,
          MAIL_PROTON_ACCOUNTS: this.config.protonAccounts.join(","),
        },
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(stdout);
      };
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        finish(new Error("Mail gateway timed out; check Sent before creating a new draft"));
      }, 90_000);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { if (stdout.length < 100_000) stdout += chunk; });
      child.stderr.on("data", (chunk: string) => { if (stderr.length < 20_000) stderr += chunk; });
      child.once("error", (error) => finish(error));
      child.once("close", (code) => finish(code === 0 ? undefined : new Error(safeFailure(stderr) || `Mail gateway failed with code ${code ?? -1}`)));
      child.stdin.end(JSON.stringify({ draft: normalized, expectedHash }));
    });
    return receiptSchema.parse(JSON.parse(output));
  }
}
