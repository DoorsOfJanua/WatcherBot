// Exact, one-shot approvals for external actions (email, WhatsApp, calls,
// publishing, and similar). These are intentionally separate from provider
// permission cards: a provider ask says that a tool may run, while this
// receipt binds one human-approved payload to one external side effect.
//
// The module has no provider integrations. A future sender claims a receipt,
// performs the provider call, and records the provider's receipt. Claiming is
// the at-most-once boundary; completing the claim is idempotent.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { writeFileAtomic } from "./atomic.ts";
import { parseJson, type JsonValue } from "./schema.ts";

export type ActionReceiptState = "pending" | "approved" | "claimed" | "consumed" | "expired" | "invalidated";

export interface ActionReceiptExecution {
  state: ActionReceiptState;
  claimedAt?: string;
  consumedAt?: string;
  invalidatedAt?: string;
  /** Opaque provider response; never interpreted by this foundation. */
  providerReceipt?: JsonValue;
}

export interface ActionReceipt {
  id: string;
  actionType: string;
  channel: string;
  account: string;
  destination: string;
  /** SHA-256 of the exact content or call brief the provider will receive. */
  contentHash: string;
  /** Short, human-readable review copy. Full content is deliberately not stored. */
  preview: string;
  createdAt: string;
  expiresAt: string;
  approvedBy?: string;
  approvedAt?: string;
  execution: ActionReceiptExecution;
}

export interface CreateActionReceiptInput {
  actionType: string;
  channel: string;
  account: string;
  destination: string;
  /** One of content, brief, or contentHash. The first two are hashed here. */
  content?: string;
  brief?: string;
  contentHash?: string;
  preview: string;
  /** ISO timestamp or epoch milliseconds. Must be in the future. */
  expiresAt: string | number;
  id?: string;
  createdAt?: string | number;
}

export interface ActionReceiptClock { now(): number }

export class ActionReceiptError extends Error {
  readonly code: "not_found" | "invalid" | "expired" | "hash_mismatch" | "not_approved" | "already_claimed" | "invalidated";
  constructor(
    message: string,
    code: "not_found" | "invalid" | "expired" | "hash_mismatch" | "not_approved" | "already_claimed" | "invalidated",
  ) {
    super(message);
    this.name = "ActionReceiptError";
    this.code = code;
  }
}

const FILE_NAME = "action-receipts.json";
const HASH = /^[a-f0-9]{64}$/;

function timestamp(value: string | number, label: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ActionReceiptError(`${label} must be a valid timestamp`, "invalid");
  return date.toISOString();
}

export function hashActionContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function copy<T>(value: T): T { return structuredClone(value); }

function freezeReceipt(receipt: ActionReceipt): ActionReceipt {
  Object.freeze(receipt.execution);
  return Object.freeze(receipt);
}

const storedReceiptSchema = z.object({
  id: z.string().min(1), actionType: z.string().min(1), channel: z.string().min(1), account: z.string().min(1),
  destination: z.string().min(1), contentHash: z.string().regex(HASH), preview: z.string(),
  createdAt: z.string(), expiresAt: z.string(), approvedBy: z.string().optional(), approvedAt: z.string().optional(),
  execution: z.object({
    state: z.enum(["pending", "approved", "claimed", "consumed", "expired", "invalidated"]),
    claimedAt: z.string().optional(), consumedAt: z.string().optional(), invalidatedAt: z.string().optional(), providerReceipt: z.json().optional(),
  }),
});

function parseStoredReceipt(value: JsonValue): ActionReceipt | null {
  const parsed = storedReceiptSchema.safeParse(value);
  if (!parsed.success) return null;
  return { ...parsed.data, execution: { ...parsed.data.execution } };
}

const createReceiptSchema = z.object({
  actionType: z.string(), channel: z.string(), account: z.string(), destination: z.string(), preview: z.string(),
  content: z.string().optional(), brief: z.string().optional(), contentHash: z.string().optional(),
  expiresAt: z.union([z.string(), z.number()]), id: z.string().optional(), createdAt: z.union([z.string(), z.number()]).optional(),
});

/** Durable receipt store. Mutations are synchronous and atomic in one server
 * process, so concurrent HTTP requests share the same claim gate. */
export class ActionReceiptStore {
  private receipts = new Map<string, ActionReceipt>();
  private readonly clock: ActionReceiptClock;
  private readonly file: string;

  constructor(dataDir: string, clock: ActionReceiptClock = { now: () => Date.now() }) {
    mkdirSync(dataDir, { recursive: true });
    this.file = join(dataDir, FILE_NAME);
    this.clock = clock;
    try {
      const raw = parseJson(readFileSync(this.file, "utf8"));
      if (Array.isArray(raw)) {
        for (const value of raw) {
          const receipt = parseStoredReceipt(value);
          if (receipt) this.receipts.set(receipt.id, receipt);
        }
      }
    } catch { /* first run or malformed legacy file */ }
    this.expireAll();
  }

  private save() { writeFileAtomic(this.file, JSON.stringify([...this.receipts.values()], null, 2), { mode: 0o600 }); }
  private nowIso() { return new Date(this.clock.now()).toISOString(); }

  private expire(receipt: ActionReceipt): boolean {
    if ((receipt.execution.state === "pending" || receipt.execution.state === "approved") && Date.parse(receipt.expiresAt) <= this.clock.now()) {
      receipt.execution = { ...receipt.execution, state: "expired" };
      return true;
    }
    return false;
  }
  private expireAll() { let changed = false; for (const r of this.receipts.values()) changed = this.expire(r) || changed; if (changed) this.save(); }
  private find(id: string): ActionReceipt {
    const receipt = this.receipts.get(id);
    if (!receipt) throw new ActionReceiptError("no such action receipt", "not_found");
    if (this.expire(receipt)) this.save();
    return receipt;
  }
  private output(receipt: ActionReceipt): ActionReceipt { return freezeReceipt(copy(receipt)); }

  list(): ActionReceipt[] { this.expireAll(); return [...this.receipts.values()].map((r) => this.output(r)); }
  get(id: string): ActionReceipt { return this.output(this.find(id)); }

  create(input: CreateActionReceiptInput): ActionReceipt {
    const parsed = createReceiptSchema.safeParse(input);
    if (!parsed.success) throw new ActionReceiptError("invalid action receipt body", "invalid");
    input = parsed.data;
    for (const [label, value] of [
      ["actionType", input.actionType], ["channel", input.channel], ["account", input.account], ["destination", input.destination], ["preview", input.preview],
    ] as const) {
      if (!value.trim()) throw new ActionReceiptError(`${label} is required`, "invalid");
    }
    if (input.content !== undefined && input.brief !== undefined) throw new ActionReceiptError("provide content or brief, not both", "invalid");
    const payload = input.content ?? input.brief;
    const contentHash = payload !== undefined ? hashActionContent(payload) : input.contentHash;
    if (!contentHash || !HASH.test(contentHash)) throw new ActionReceiptError("contentHash or content/brief is required", "invalid");
    if (payload !== undefined && input.contentHash !== undefined && input.contentHash !== contentHash) throw new ActionReceiptError("contentHash does not match content", "invalid");
    const createdAt = timestamp(input.createdAt ?? this.clock.now(), "createdAt");
    const expiresAt = timestamp(input.expiresAt, "expiresAt");
    if (Date.parse(createdAt) > this.clock.now()) throw new ActionReceiptError("createdAt cannot be in the future", "invalid");
    if (Date.parse(expiresAt) <= Date.parse(createdAt) || Date.parse(expiresAt) <= this.clock.now()) throw new ActionReceiptError("expiresAt must be after createdAt and in the future", "invalid");
    const receipt: ActionReceipt = {
      id: input.id?.trim() || `ar-${randomUUID()}`,
      actionType: input.actionType.trim(), channel: input.channel.trim(), account: input.account.trim(), destination: input.destination.trim(),
      contentHash, preview: input.preview.trim(), createdAt, expiresAt, execution: { state: "pending" },
    };
    if (this.receipts.has(receipt.id)) throw new ActionReceiptError("receipt id already exists", "invalid");
    this.receipts.set(receipt.id, receipt); this.save(); return this.output(receipt);
  }

  private checkHash(receipt: ActionReceipt, contentHash: string) {
    if (!HASH.test(contentHash)) throw new ActionReceiptError("contentHash must be a SHA-256 hex digest", "invalid");
    if (receipt.contentHash === contentHash) return;
    if (receipt.execution.state === "approved" || receipt.execution.state === "claimed") {
      receipt.execution = { ...receipt.execution, state: "invalidated", invalidatedAt: this.nowIso() }; this.save();
      throw new ActionReceiptError("receipt payload changed; approval invalidated", "hash_mismatch");
    }
    throw new ActionReceiptError("contentHash does not match receipt", "hash_mismatch");
  }

  approve(id: string, contentHash: string, approvedBy: string, approvedAt?: string | number): ActionReceipt {
    const receipt = this.find(id); this.checkHash(receipt, contentHash);
    if (!approvedBy.trim()) throw new ActionReceiptError("approvedBy is required", "invalid");
    if (receipt.execution.state === "consumed" || receipt.execution.state === "claimed") return this.output(receipt);
    if (receipt.execution.state === "invalidated") throw new ActionReceiptError("receipt approval was invalidated", "invalidated");
    if (receipt.execution.state === "expired") throw new ActionReceiptError("receipt has expired", "expired");
    if (receipt.execution.state === "approved") return this.output(receipt);
    if (receipt.execution.state !== "pending") throw new ActionReceiptError("receipt is not awaiting approval", "invalid");
    const at = timestamp(approvedAt ?? this.clock.now(), "approvedAt");
    if (Date.parse(at) < Date.parse(receipt.createdAt) || Date.parse(at) > this.clock.now()) throw new ActionReceiptError("approvedAt must be between createdAt and now", "invalid");
    receipt.approvedBy = approvedBy.trim(); receipt.approvedAt = at; receipt.execution = { state: "approved" }; this.save(); return this.output(receipt);
  }

  /** Permanently close an unexecuted receipt (for a human denial/cancel). */
  invalidate(id: string, contentHash: string): ActionReceipt {
    const receipt = this.find(id); this.checkHash(receipt, contentHash);
    if (receipt.execution.state === "consumed" || receipt.execution.state === "claimed") return this.output(receipt);
    if (receipt.execution.state === "invalidated") return this.output(receipt);
    if (receipt.execution.state === "expired") throw new ActionReceiptError("receipt has expired", "expired");
    receipt.execution = { ...receipt.execution, state: "invalidated", invalidatedAt: this.nowIso() };
    this.save();
    return this.output(receipt);
  }

  /** The one-shot execution gate; every later caller is rejected. */
  claim(id: string, contentHash: string): ActionReceipt {
    const receipt = this.find(id); this.checkHash(receipt, contentHash);
    if (receipt.execution.state === "consumed" || receipt.execution.state === "claimed") {
      throw new ActionReceiptError("receipt has already been claimed", "already_claimed");
    }
    if (receipt.execution.state === "invalidated") throw new ActionReceiptError("receipt approval was invalidated", "invalidated");
    if (receipt.execution.state === "expired") throw new ActionReceiptError("receipt has expired", "expired");
    if (receipt.execution.state !== "approved") throw new ActionReceiptError("receipt is not approved", "not_approved");
    receipt.execution = { ...receipt.execution, state: "claimed", claimedAt: this.nowIso() }; this.save(); return this.output(receipt);
  }

  /** Store an opaque provider receipt. Repeating this call is idempotent. */
  consume(id: string, contentHash: string, providerReceipt: JsonValue): ActionReceipt {
    const receipt = this.find(id); this.checkHash(receipt, contentHash);
    if (receipt.execution.state === "consumed") return this.output(receipt);
    if (receipt.execution.state === "invalidated") throw new ActionReceiptError("receipt approval was invalidated", "invalidated");
    if (receipt.execution.state === "expired") throw new ActionReceiptError("receipt has expired", "expired");
    if (receipt.execution.state !== "claimed") throw new ActionReceiptError("receipt must be claimed before consumption", "not_approved");
    if (providerReceipt === undefined || providerReceipt === null || providerReceipt === "") throw new ActionReceiptError("providerReceipt is required", "invalid");
    receipt.execution = { ...receipt.execution, state: "consumed", consumedAt: this.nowIso(), providerReceipt: copy(providerReceipt) };
    this.save(); return this.output(receipt);
  }
}
