import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, Pencil, Send, X } from "lucide-react";
import { api } from "@/state/store";
import { cn } from "@/lib/cn";
import type { ReplyDraftBatch } from "@/lib/reply-draft-deck";
import { ReplyApprovalToggle } from "@/components/ReplyApprovalToggle";

type Decision = "approve" | "skip";
type PostReceipt = { id: string; text: string; postedUrl: string; postedAt?: string; targetUrl?: string };

export function ReplyDraftDeck({ batch, threadId }: { batch: ReplyDraftBatch; threadId?: string }) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(batch.items.map((item) => [item.id, item.reply])),
  );
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<string[]>([]);
  const [receipts, setReceipts] = useState<PostReceipt[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [queued, setQueued] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const item = batch.items[index];
  const approved = useMemo(
    () => batch.items.filter((candidate) => decisions[candidate.id] === "approve"),
    [batch.items, decisions],
  );
  const skipped = useMemo(
    () => batch.items.filter((candidate) => decisions[candidate.id] === "skip"),
    [batch.items, decisions],
  );
  const reviewed = Object.keys(decisions).length;

  useEffect(() => setEditing(false), [index]);

  const decide = (decision: Decision) => {
    setDecisions((current) => ({ ...current, [item.id]: decision }));
    setEditing(false);
    if (index < batch.items.length - 1) setIndex(index + 1);
  };

  const finishReview = async () => {
    if (!reviewed || posting) return;
    setPosting(true);
    setError("");
    try {
      const result = await api("/api/replyguy/drafts/batch", {
        method: "POST",
        body: JSON.stringify({
          ...(threadId ? { threadId } : {}),
          profileId: batch.profileId,
          drafts: approved.map((candidate) => ({ id: candidate.id, text: edits[candidate.id] })),
          skippedIds: skipped.map((candidate) => candidate.id),
        }),
      }) as { postedIds?: string[]; postedReceipts?: PostReceipt[]; queuedIds?: string[]; rejectedIds?: string[]; errors?: Array<{ id: string; error: string }> };
      setPosted(result.postedIds ?? []);
      setReceipts(result.postedReceipts ?? []);
      setRejected(result.rejectedIds ?? []);
      setQueued(result.queuedIds ?? []);
      setFinished(true);
      if (result.errors?.length) {
        setError(result.errors.map((entry) => entry.error).join(" · "));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPosting(false);
    }
  };

  if (finished) {
    return (
      <div className="my-3 w-full max-w-[760px] border-y border-success/25 py-4">
        <div className="flex items-center gap-3 text-ink">
          <span className="flex size-9 items-center justify-center rounded-full bg-success/12 text-success"><Check size={17} /></span>
          <div>
            <div className="text-[15px] font-semibold">{error ? "Review partly finished" : "Review finished"}</div>
            <div className="text-[12px] text-ink-secondary">{posted.length} posted · {queued.length} queued · {rejected.length} skipped</div>
          </div>
        </div>
        {receipts.map((receipt) => (
          <div key={receipt.id} className="ml-12 mt-3 max-w-[58ch] border-t border-hairline/35 pt-3">
            <p className="text-[13px] leading-relaxed text-ink">{receipt.text}</p>
            <a href={receipt.postedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-medium text-accent-text hover:text-ink">
              View the posted reply on X <ExternalLink size={13} />
            </a>
          </div>
        ))}
        {error && <div role="alert" className="ml-12 mt-3 text-[12px] leading-relaxed text-danger">{error}</div>}
      </div>
    );
  }

  return (
    <section className="my-3 w-full max-w-[760px] overflow-hidden border-y border-hairline/60 bg-card/35" aria-label={batch.title}>
      <header className="flex items-center justify-between gap-4 border-b border-hairline/40 px-4 py-3 sm:px-5">
        <div>
          <div className="text-[15px] font-semibold text-ink">{batch.title}</div>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-ink-secondary">{reviewed} reviewed · {approved.length} approved</div>
        </div>
        <div className="flex items-center gap-1 text-[12px] tabular-nums text-ink-secondary">
          <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous draft" className="flex size-8 items-center justify-center rounded-full hover:bg-raised disabled:opacity-25"><ChevronLeft size={15} /></button>
          <span className="min-w-12 text-center">{index + 1} of {batch.items.length}</span>
          <button type="button" onClick={() => setIndex(Math.min(batch.items.length - 1, index + 1))} disabled={index === batch.items.length - 1} aria-label="Next draft" className="flex size-8 items-center justify-center rounded-full hover:bg-raised disabled:opacity-25"><ChevronRight size={15} /></button>
        </div>
      </header>

      <ReplyApprovalToggle profileId={batch.profileId} agentId={batch.agentId} compact />

      <div className="px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <span className="font-medium text-ink">@{item.author}</span>
          {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-accent-text">View post</a>}
        </div>
        <p className="mt-2 line-clamp-2 max-w-[65ch] text-[12.5px] leading-relaxed text-ink-secondary">{item.post}</p>

        {editing ? (
          <textarea
            autoFocus
            value={edits[item.id]}
            onChange={(event) => setEdits((current) => ({ ...current, [item.id]: event.target.value.slice(0, 280) }))}
            className="mt-6 min-h-32 w-full resize-none border-0 border-b border-accent/60 bg-transparent px-0 pb-3 text-[22px] leading-snug tracking-[-0.02em] text-ink outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="mt-6 block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <span className="block max-w-[32ch] text-[22px] leading-snug tracking-[-0.02em] text-ink sm:text-[25px]">{edits[item.id]}</span>
          </button>
        )}
        <button type="button" onClick={() => setEditing((value) => !value)} className="mt-3 flex min-h-8 items-center gap-1.5 text-[12px] text-accent-text hover:text-ink">
          <Pencil size={12} /> {editing ? "Done editing" : "Edit"}
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hairline/35 pt-4">
          <button type="button" onClick={() => decide("approve")} className={cn("flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium", decisions[item.id] === "approve" ? "bg-accent text-[var(--color-accent-ink)]" : "bg-accent/12 text-accent-text hover:bg-accent/20")}><Check size={14} /> Approve</button>
          <button type="button" onClick={() => decide("skip")} className={cn("flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px]", decisions[item.id] === "skip" ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised hover:text-ink")}><X size={14} /> Skip</button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline/40 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {batch.items.map((candidate, candidateIndex) => (
            <button
              type="button"
              key={candidate.id}
              onClick={() => setIndex(candidateIndex)}
              aria-label={`Open draft ${candidateIndex + 1}`}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums transition-colors",
                candidateIndex === index ? "border-accent text-accent-text" :
                  decisions[candidate.id] === "approve" ? "border-success/40 bg-success/10 text-success" :
                    decisions[candidate.id] === "skip" ? "border-hairline/40 text-ink-secondary/50" : "border-hairline/60 text-ink-secondary",
              )}
            >
              {decisions[candidate.id] === "approve" ? <Check size={11} /> : candidateIndex + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void finishReview()}
          disabled={!reviewed || posting}
          className="flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-[var(--color-accent-ink)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {posting ? "Finishing…" : approved.length ? `Post approved (${approved.length})` : "Finish review"}
        </button>
      </div>
      {error && <div role="alert" className="border-t border-danger/20 px-5 py-2.5 text-[12px] text-danger">{error}</div>}
    </section>
  );
}
