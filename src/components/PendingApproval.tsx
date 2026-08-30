// Pending approval, ported from the upstream pattern: an approval does
// not sit in the transcript waiting to be noticed — it takes over the
// composer. The prompt is disabled, a strip above it says exactly what
// is being asked, and the send row is replaced by the decisions.
//
// Faithful details worth keeping: one at a time with an "n of N" counter,
// and the buttons ordered least-destructive-last so the primary action
// sits under your thumb. The ask itself is plain words; the raw command
// sits one line below, and the Code toggle opens the full untruncated
// monospace block for anyone who wants to read exactly what will run.
import { memo } from "react";
import { ShieldCheck } from "lucide-react";
import { useStore, type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { approvalExplanation, approvalHoldNote } from "../../shared/tool-label";
import { mailProviderFromDetail, ProviderMark } from "./ProviderMark";
import { TechnicalDetails } from "./TechnicalDetails";

export interface Pending {
  message: Message;
  requestId: string;
  tool: string;
  /** the narrow grant "always allow" writes, computed server-side */
  allowKey?: string;
  detail: string;
  held?: string;
}

/** Open approvals on a thread, oldest first — answered/dismissed drop out. */
export function pendingApprovals(messages: Message[]): Pending[] {
  return messages
    .filter((m) => m.kind === "options" && m.card?.requestId && m.card.tool && !m.card.answered && !m.card.dismissed)
    .map((m) => ({
      message: m,
      requestId: m.card!.requestId!,
      tool: m.card!.tool!,
      allowKey: m.card!.allowKey,
      detail: m.card!.subtitle,
      held: m.card!.held,
    }));
}

export const PendingApprovalPanel = memo(function PendingApprovalPanel({
  pending,
  count,
  index,
  bot,
}: {
  pending: Pending;
  count: number;
  index: number;
  bot?: Bot;
}) {
  const explanation = approvalExplanation(pending.tool, pending.detail);
  const holdNote = approvalHoldNote(pending.held);
  const provider = pending.tool === "email.send" ? mailProviderFromDetail(pending.detail) : undefined;
  return (
    <div className="border-b border-hairline/35 px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-2.5">
        {provider ? <ProviderMark provider={provider} className="mt-0.5 size-8" /> : <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", explanation.sensitive ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent")}><ShieldCheck size={15} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">{provider === "gmail" ? "Gmail" : provider === "proton-bridge" ? "Proton Mail" : "Approval"}</span>
            {count > 1 && (
              <span className="rounded-full bg-raised px-1.5 py-0.5 text-[11px] tabular-nums text-ink-secondary">
                {index + 1} of {count}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">
            {bot?.name ? `${bot.name} wants to ` : "The agent wants to "}{explanation.what}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">{explanation.note}</p>
          {holdNote && <p className="mt-1 text-[12px] leading-relaxed text-warning">{holdNote}</p>}
        </div>
      </div>
      {pending.tool === "email.send" ? (
        <div className="mt-3 whitespace-pre-wrap border-t border-hairline/35 pt-3 text-[13px] leading-relaxed text-ink">{pending.detail}</div>
      ) : (
        <TechnicalDetails detail={pending.detail} meta={pending.tool} label="Exact request" className="mt-1" />
      )}
    </div>
  );
});

export function PendingApprovalActions({
  pending,
  threadId,
  bot,
  onCancelTurn,
}: {
  pending: Pending;
  threadId: string;
  /** who asked — "always allow" is remembered against them */
  bot?: Bot;
  onCancelTurn: () => void;
}) {
  const { dispatch } = useStore();
  const exactEmail = pending.tool === "email.send";
  const decide = (behavior: "allow" | "deny", always = false) =>
    dispatch({
      type: "decideRequest",
      threadId,
      requestId: pending.requestId,
      behavior,
      message: behavior === "deny" ? "Denied by the user." : undefined,
      alwaysAllow: always && bot && pending.allowKey ? { botId: bot.id, key: pending.allowKey } : undefined,
    });

  const base = "min-h-11 rounded-full px-4 text-[13px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
      {!exactEmail && (
        <button onClick={onCancelTurn} className={cn(base, "mr-auto text-ink-secondary hover:bg-raised hover:text-ink")}>
          Stop this task
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => decide("deny")}
          className={cn(base, "border border-danger/30 bg-danger/8 text-danger hover:border-danger/50 hover:bg-danger/15")}
        >
          {exactEmail ? "Don’t send" : "Deny"}
        </button>
      {bot && pending.allowKey && (
        <button
          onClick={() => decide("allow", true)}
          title={`Stop asking ${bot.name} about ${pending.allowKey}`}
          className={cn(base, "border border-hairline/60 bg-card text-ink-secondary hover:border-accent/40 hover:text-ink")}
        >
          Always allow
        </button>
      )}
      <button
        onClick={() => decide("allow")}
        className={cn(base, "bg-accent text-white shadow-sm shadow-accent/20 hover:-translate-y-px hover:brightness-110")}
      >
        {exactEmail ? "Approve & send" : "Allow once"}
      </button>
      </div>
    </div>
  );
}
