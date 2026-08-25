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
import { useStore, type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { approvalExplanation } from "../../shared/tool-label";
import { mailProviderFromDetail, ProviderMark } from "./ProviderMark";
import { useDevMode } from "@/lib/display-mode";
import { DevModeToggle } from "./DevModeToggle";

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
  const dev = useDevMode();
  const explanation = approvalExplanation(pending.tool, pending.detail);
  const provider = pending.tool === "email.send" ? mailProviderFromDetail(pending.detail) : undefined;
  return (
    <div className="rounded-t-2xl border-b border-hairline/50 bg-card px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        {provider ? <ProviderMark provider={provider} className="mt-0.5 size-9" /> : <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", explanation.sensitive ? "bg-warning/12 text-warning" : "bg-accent/12 text-accent")}><span className="text-[16px]">{explanation.sensitive ? "!" : "?"}</span></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-secondary">{provider === "gmail" ? "Gmail" : provider === "proton-bridge" ? "Proton Mail" : "Your decision"}</span>
            {count > 1 && (
              <span className="rounded-full bg-raised px-1.5 py-0.5 text-[11px] tabular-nums text-ink-secondary">
                {index + 1} of {count}
              </span>
            )}
          </div>
          <div className="mt-1 text-[15px] font-semibold leading-snug text-ink">
            {bot?.name ? `${bot.name} wants to ` : "The agent wants to "}{explanation.what}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">{explanation.note}</p>
        </div>
        <DevModeToggle className="shrink-0" />
      </div>
      {dev ? (
        <>
          <div className="mt-1.5 font-mono text-[11px] text-ink-secondary">{pending.tool}</div>
          {/* never truncated in code view — long commands wrap and scroll */}
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink">
            {pending.detail}
          </pre>
        </>
      ) : null}
      {pending.held && <div className="mt-3 rounded-xl border border-warning/25 bg-warning/8 px-3 py-2 text-[12px] leading-relaxed text-warning">Paused for your approval because this may touch sensitive data or make a change.</div>}
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

  const base = "rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/30 bg-raised/25 px-4 py-3 sm:px-5">
      {!exactEmail && (
        <button onClick={onCancelTurn} className={cn(base, "mr-auto text-ink-secondary hover:bg-raised hover:text-ink")}>
          Stop this task
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => decide("deny")}
          className={cn(base, "border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10")}
        >
          {exactEmail ? "Don’t send" : "Deny"}
        </button>
      {bot && pending.allowKey && (
        <button
          onClick={() => decide("allow", true)}
          title={`Stop asking ${bot.name} about ${pending.allowKey}`}
          className={cn(base, "border border-hairline/50 text-ink hover:bg-raised")}
        >
          Always allow
        </button>
      )}
      <button
        onClick={() => decide("allow")}
        className={cn(base, "bg-accent font-medium text-white hover:brightness-110")}
      >
        {exactEmail ? "Approve & send" : "Allow once"}
      </button>
      </div>
    </div>
  );
}
