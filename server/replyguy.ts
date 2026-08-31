const REPLYGUY_BASE = "http://127.0.0.1:3004";

export interface ReplyDraftApproval {
  id: string;
  text: string;
}

type ReplyGuyDraft = {
  id: string;
  profileId?: string;
  status?: string;
  text?: string;
  postedAt?: string | null;
  postedUrl?: string | null;
  post?: { url?: string; author?: string };
};

export interface ReplyGuyPostReceipt {
  id: string;
  text: string;
  postedUrl: string;
  postedAt?: string;
  targetUrl?: string;
}

export interface ReplyGuyApprovalPolicy {
  profileId: string;
  agentId: string;
  approvalRequired: boolean;
  canPostAutomatically: boolean;
  unavailableReason: string;
}

function postReceipt(value: ReplyGuyDraft, fallbackText: string): ReplyGuyPostReceipt {
  if (value.status !== "posted" || !value.postedUrl || !/^https:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(value.postedUrl)) {
    throw new Error("ReplyGuy did not return a verified X posting receipt");
  }
  return {
    id: value.id,
    text: value.text?.trim() || fallbackText,
    postedUrl: value.postedUrl,
    ...(value.postedAt ? { postedAt: value.postedAt } : {}),
    ...(value.post?.url ? { targetUrl: value.post.url } : {}),
  };
}

function friendlyPostingError(message: string): string {
  if (/stale-target|Target is \d+ minutes old/i.test(message)) return "That post is too old to reply to now.";
  if (/reply-compose/i.test(message)) return "X did not accept the full reply, so nothing partial was posted.";
  if (/live safety stop is latched/i.test(message)) return "Posting is paused after an X editor problem.";
  if (/hourly-limit|daily-limit|minimum-gap|burst-cooldown/i.test(message)) return "This reply is waiting for the account’s next posting window.";
  return message;
}

async function responseBody(response: Response): Promise<any> {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
}

async function callReplyGuy(path: string, init: RequestInit, fetcher: typeof fetch): Promise<any> {
  const response = await fetcher(`${REPLYGUY_BASE}${path}`, init);
  const body = await responseBody(response);
  if (!response.ok) {
    const detail = body && typeof body === "object" && typeof body.error === "string"
      ? body.error
      : typeof body === "string" ? body : `ReplyGuy returned ${response.status}`;
    throw new Error(detail);
  }
  return body;
}

export async function getReplyGuyApprovalPolicy(
  profileId = "",
  agentId = "",
  fetcher: typeof fetch = fetch,
): Promise<ReplyGuyApprovalPolicy> {
  const query = new URLSearchParams();
  if (profileId) query.set("profileId", profileId);
  if (agentId) query.set("agentId", agentId);
  return callReplyGuy(`/api/approval-policy${query.size ? `?${query}` : ""}`, {}, fetcher);
}

export async function setReplyGuyApprovalPolicy(
  input: { profileId?: string; agentId?: string; approvalRequired: boolean },
  fetcher: typeof fetch = fetch,
): Promise<ReplyGuyApprovalPolicy> {
  if (typeof input.approvalRequired !== "boolean") throw new Error("Choose whether Gemini should ask first");
  return callReplyGuy("/api/approval-policy", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }, fetcher);
}

function normalizedInput(input: unknown): { threadId: string; profileId: string; drafts: ReplyDraftApproval[]; skippedIds: string[] } {
  if (!input || typeof input !== "object") throw new Error("A draft batch is required");
  const body = input as Record<string, unknown>;
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  if (threadId && !/^[a-z0-9_-]{1,100}$/i.test(threadId)) throw new Error("Invalid conversation");
  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  if (!/^[a-z0-9_-]{1,64}$/i.test(profileId)) throw new Error("Invalid ReplyGuy profile");
  if (!Array.isArray(body.drafts) || body.drafts.length > 10 || !Array.isArray(body.skippedIds) || body.skippedIds.length > 10) {
    throw new Error("Choose up to 10 drafts");
  }
  const seen = new Set<string>();
  const drafts = body.drafts.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid draft selection");
    const row = value as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!/^[a-z0-9_-]{1,100}$/i.test(id) || seen.has(id)) throw new Error("Invalid or duplicate draft id");
    if (!text || [...text].length > 280) throw new Error("Every approved reply must contain 1–280 characters");
    seen.add(id);
    return { id, text };
  });
  const skippedIds = body.skippedIds.map((value) => {
    const id = typeof value === "string" ? value.trim() : "";
    if (!/^[a-z0-9_-]{1,100}$/i.test(id) || seen.has(id)) throw new Error("Invalid or duplicate skipped draft id");
    seen.add(id);
    return id;
  });
  if (drafts.length + skippedIds.length < 1 || drafts.length + skippedIds.length > 10) {
    throw new Error("Review between 1 and 10 drafts");
  }
  return { threadId, profileId, drafts, skippedIds };
}

export function replyGuyReceiptMessage(result: {
  postedReceipts: ReplyGuyPostReceipt[];
  queuedIds?: string[];
  rejectedIds: string[];
  errors: Array<{ id: string; error: string }>;
}): string {
  const posted = result.postedReceipts.length;
  const lines = [
    posted
      ? `Posted ${posted} approved ${posted === 1 ? "reply" : "replies"} on X.`
      : "No replies were posted.",
  ];
  for (const receipt of result.postedReceipts) {
    lines.push(`- “${receipt.text}” — [View on X](${receipt.postedUrl})`);
  }
  if (result.queuedIds?.length) {
    lines.push(`${result.queuedIds.length} approved ${result.queuedIds.length === 1 ? "reply is" : "replies are"} queued and will post automatically at the account’s normal pace.`);
  }
  if (result.rejectedIds.length) lines.push(`${result.rejectedIds.length} ${result.rejectedIds.length === 1 ? "draft was" : "drafts were"} skipped.`);
  if (result.errors.length) {
    const unique = [...new Set(result.errors.map((entry) => entry.error))];
    lines.push(unique.length === 1 && unique[0] === "That post is too old to reply to now."
      ? `${result.errors.length} ${result.errors.length === 1 ? "reply was" : "replies were"} not posted because ${result.errors.length === 1 ? "the post is" : "those posts are"} too old now.`
      : unique.length === 1
        ? `Posting stopped: ${unique[0]}`
      : `Posting stopped with ${unique.length} problems: ${unique.join(" · ")}`);
  }
  return lines.join("\n");
}

/** One explicit human gesture edits, approves, then posts only the exact
 * selected ReplyGuy drafts. Each id is re-read from ReplyGuy before mutation;
 * a stale or foreign draft fails closed while the rest of the batch reports. */
export async function approveAndPostReplyDrafts(input: unknown, fetcher: typeof fetch = fetch) {
  const { threadId, profileId, drafts, skippedIds } = normalizedInput(input);
  const listed = await callReplyGuy(`/api/drafts?profileId=${encodeURIComponent(profileId)}`, {}, fetcher);
  const rows: ReplyGuyDraft[] = Array.isArray(listed) ? listed : [];
  const byId = new Map(rows.map((draft) => [draft.id, draft]));
  const postedIds: string[] = [];
  const postedReceipts: ReplyGuyPostReceipt[] = [];
  const queuedIds: string[] = [];
  const rejectedIds: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];
  const authorizedIds: string[] = [];

  for (const id of skippedIds) {
    try {
      const current = byId.get(id);
      if (!current || (current.profileId && current.profileId !== profileId)) throw new Error("Draft is no longer available in this account");
      if (current.status === "rejected") {
        rejectedIds.push(id);
        continue;
      }
      if (current.status !== "pending") throw new Error(`Draft is ${current.status || "not pending"}`);
      await callReplyGuy(`/api/drafts/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewedBy: "operator" }),
      }, fetcher);
      rejectedIds.push(id);
    } catch (error) {
      errors.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const selected of drafts) {
    try {
      const current = byId.get(selected.id);
      if (!current || (current.profileId && current.profileId !== profileId)) throw new Error("Draft is no longer available in this account");
      if (current.status === "posted") {
        postedReceipts.push(postReceipt(current, selected.text));
        postedIds.push(selected.id);
        continue;
      }
      if (!['pending', 'approved'].includes(String(current.status))) throw new Error(`Draft is ${current.status || "not pending"}`);
      if (current.status === "pending" && current.text !== selected.text) {
        await callReplyGuy(`/api/drafts/${encodeURIComponent(selected.id)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: selected.text }),
        }, fetcher);
      }
      if (current.status === "pending") {
        await callReplyGuy(`/api/drafts/${encodeURIComponent(selected.id)}/approve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewedBy: "operator" }),
        }, fetcher);
      }
      authorizedIds.push(selected.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ id: selected.id, error: message });
      // A live-safety stop applies to the whole profile. Continuing this loop
      // can never post the remaining drafts; it only repeats the same backend
      // error once per card and obscures the first, useful failure.
      if (/live safety stop is latched/i.test(message) || /reply-compose|reply-post|reply-send-disabled/i.test(message)) break;
    }
  }

  if (authorizedIds.length) {
    try {
      const postingState = await callReplyGuy('/api/posting-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId, draftIds: authorizedIds }),
      }, fetcher);
      const jobByDraft = new Map((Array.isArray(postingState?.jobs) ? postingState.jobs : []).map((job: any) => [job.draftId, job]));
      const refreshed = await callReplyGuy(`/api/drafts?profileId=${encodeURIComponent(profileId)}`, {}, fetcher);
      const freshById = new Map((Array.isArray(refreshed) ? refreshed : []).map((draft: ReplyGuyDraft) => [draft.id, draft]));
      for (const selected of drafts.filter(draft => authorizedIds.includes(draft.id))) {
        const current = freshById.get(selected.id) as ReplyGuyDraft | undefined;
        if (current?.status === 'posted') {
          postedReceipts.push(postReceipt(current, selected.text));
          postedIds.push(selected.id);
        } else if ((jobByDraft.get(selected.id) as any)?.status === 'blocked') {
          errors.push({ id: selected.id, error: friendlyPostingError(String((jobByDraft.get(selected.id) as any)?.error || 'Posting stopped')) });
        } else {
          queuedIds.push(selected.id);
        }
      }
    } catch (error) {
      errors.push({ id: authorizedIds[0], error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { threadId, profileId, requested: drafts.length + skippedIds.length, postedIds, postedReceipts, queuedIds, rejectedIds, errors };
}
