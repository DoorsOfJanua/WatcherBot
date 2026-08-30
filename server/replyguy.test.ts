import { describe, expect, it, vi } from "vitest";
import { approveAndPostReplyDrafts, getReplyGuyApprovalPolicy, replyGuyReceiptMessage, setReplyGuyApprovalPolicy } from "./replyguy.ts";

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("ReplyGuy batch approval", () => {
  it("reads and changes the narrow approval policy", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return reply({ profileId: "cryptocat-btc", agentId: "fllow-agent", approvalRequired: false, canPostAutomatically: true, unavailableReason: "" });
    }) as unknown as typeof fetch;
    const read = await getReplyGuyApprovalPolicy("cryptocat-btc", "fllow-agent", fetcher);
    const changed = await setReplyGuyApprovalPolicy({ profileId: "cryptocat-btc", agentId: "fllow-agent", approvalRequired: false }, fetcher);
    expect(read.approvalRequired).toBe(false);
    expect(changed.canPostAutomatically).toBe(true);
    expect(new URL(calls[0].url).searchParams.get("agentId")).toBe("fllow-agent");
    expect(calls[1].init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({ approvalRequired: false });
  });

  it("edits, operator-approves, and posts only the selected exact draft", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let draftReads = 0;
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/api/drafts?")) {
        draftReads += 1;
        return draftReads === 1
          ? reply([{ id: "draft-1", profileId: "cryptocat-btc", status: "pending", text: "old" }])
          : reply([{ id: "draft-1", profileId: "cryptocat-btc", status: "posted", text: "edited reply", postedUrl: "https://x.com/crypt0cat_btc/status/123", postedAt: "2026-08-27T09:08:42.720Z" }]);
      }
      if (String(url).endsWith("/api/posting-jobs")) return reply({ queued: 0, posted: 1 });
      return reply({ ok: true });
    }) as unknown as typeof fetch;
    const result = await approveAndPostReplyDrafts({
      threadId: "gemini-thread",
      profileId: "cryptocat-btc",
      drafts: [{ id: "draft-1", text: "edited reply" }],
      skippedIds: [],
    }, fetcher);
    expect(result.postedIds).toEqual(["draft-1"]);
    expect(result.threadId).toBe("gemini-thread");
    expect(result.postedReceipts).toEqual([{
      id: "draft-1",
      text: "edited reply",
      postedUrl: "https://x.com/crypt0cat_btc/status/123",
      postedAt: "2026-08-27T09:08:42.720Z",
    }]);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/drafts",
      "/api/drafts/draft-1",
      "/api/drafts/draft-1/approve",
      "/api/posting-jobs",
      "/api/drafts",
    ]);
    expect(calls[2].init?.body).toBe(JSON.stringify({ reviewedBy: "operator" }));
  });

  it("turns verified posting receipts into durable human-readable chat context", () => {
    expect(replyGuyReceiptMessage({
      postedReceipts: [{ id: "draft-1", text: "so back bro", postedUrl: "https://x.com/crypt0cat_btc/status/123" }],
      rejectedIds: [],
      errors: [],
    })).toBe("Posted 1 approved reply on X.\n- “so back bro” — [View on X](https://x.com/crypt0cat_btc/status/123)");
  });

  it("reports a durable posting-queue failure once for the whole deck", async () => {
    const fetcher = vi.fn((url: string | URL | Request) => {
      if (String(url).includes("/api/drafts?")) return reply([
        { id: "draft-1", profileId: "cryptocat-btc", status: "approved", text: "one" },
        { id: "draft-2", profileId: "cryptocat-btc", status: "approved", text: "two" },
      ]);
      if (String(url).endsWith('/api/posting-jobs')) return reply({ error: "reply-compose" }, 500);
      return reply({ ok: true });
    }) as unknown as typeof fetch;
    const result = await approveAndPostReplyDrafts({
      profileId: "cryptocat-btc",
      drafts: [{ id: "draft-1", text: "one" }, { id: "draft-2", text: "two" }],
      skippedIds: [],
    }, fetcher);
    expect(result.errors).toEqual([{ id: "draft-1", error: "reply-compose" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(replyGuyReceiptMessage(result)).toBe("No replies were posted.\nPosting stopped: reply-compose");
  });

  it("reports an approved draft as queued until ReplyGuy returns its posting receipt", async () => {
    const fetcher = vi.fn((url: string | URL | Request) => {
      if (String(url).includes("/api/drafts?")) return reply([{ id: "draft-1", profileId: "cryptocat-btc", status: "approved", text: "reply" }]);
      return reply({ ok: true });
    }) as unknown as typeof fetch;
    const result = await approveAndPostReplyDrafts({
      profileId: "cryptocat-btc",
      drafts: [{ id: "draft-1", text: "reply" }],
      skippedIds: [],
    }, fetcher);
    expect(result.postedIds).toEqual([]);
    expect(result.postedReceipts).toEqual([]);
    expect(result.queuedIds).toEqual(["draft-1"]);
    expect(result.errors).toEqual([]);
  });

  it("fails a stale id closed without posting it", async () => {
    const fetcher = vi.fn(() => reply([])) as unknown as typeof fetch;
    const result = await approveAndPostReplyDrafts({
      profileId: "cryptocat-btc",
      drafts: [{ id: "missing", text: "reply" }],
      skippedIds: [],
    }, fetcher);
    expect(result.postedIds).toEqual([]);
    expect(result.errors[0].error).toMatch(/no longer available/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("records skipped drafts as operator rejections without posting", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/api/drafts?")) return reply([{ id: "draft-2", profileId: "cryptocat-btc", status: "pending", text: "no" }]);
      return reply({ ok: true });
    }) as unknown as typeof fetch;

    const result = await approveAndPostReplyDrafts({
      profileId: "cryptocat-btc",
      drafts: [],
      skippedIds: ["draft-2"],
    }, fetcher);

    expect(result).toMatchObject({ postedIds: [], rejectedIds: ["draft-2"], errors: [] });
    expect(new URL(calls[1].url).pathname).toBe("/api/drafts/draft-2/reject");
    expect(calls[1].init?.body).toBe(JSON.stringify({ reviewedBy: "operator" }));
  });
});
