// Pending approval, ported from the upstream pattern: an approval does
// not sit in the transcript waiting to be noticed — it takes over the
// composer. The prompt is disabled, a strip above it says exactly what
// is being asked, and the send row is replaced by the decisions.
//
// Faithful details worth keeping: one at a time with an "n of N" counter,
// the detail printed raw in a monospace block that is NEVER truncated
// (it scrolls instead), and the buttons ordered least-destructive-last so
// the primary action sits under your thumb.
import { memo } from "react";
import { useStore, type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { MailProviderMark, mailProviderFromDetail } from "./MailProviderMark";

interface ApprovalLabels {
  [tool: string]: string;
}

export interface Pending {
  message: Message;
  requestId: string;
  tool: string;
  /** the narrow grant "always allow" writes, computed server-side */
  allowKey?: string;
  detail: string;
  held?: string;
}

/** The persisted payload is the authoritative marker. Tool names are
 * provider-authored display strings and can collide with ours. */
export function isRoutineApproval(pending: Pending): boolean {
  return Boolean(pending.message.card?.routineRequest);
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

/** Routine cards can carry every instruction the user asked for (up to
 * 20,000 characters). Calls should announce the concise, visible title and
 * let the user review those details on screen instead of reading them all. */
export function spokenApprovalPrompt(pending: Pending, requester: string): string {
  const isRoutineRequest = isRoutineApproval(pending);
  if (!isRoutineRequest) {
    return `${requester} wants to ${pending.tool}. ${pending.detail}. Should I allow it?`;
  }
  const title = pending.message.card?.title.trim() || "Confirm this routine?";
  return `${requester} asks: ${title}${/[.!?]$/.test(title) ? "" : "."} Review the schedule and instructions on screen. Should I confirm it?`;
}

function label(pending: Pending): string {
  if (isRoutineApproval(pending)) {
    return pending.message.card?.routineRequest?.operation.action === "create"
      ? "Confirm this routine"
      : "Confirm this routine change";
  }
  const nice: ApprovalLabels = {
    Bash: "Command approval requested",
    shell: "Command approval requested",
    Read: "File-read approval requested",
    Write: "File-change approval requested",
    Edit: "File-change approval requested",
    edit: "File-change approval requested",
  };
  return nice[pending.tool] ?? "Approval requested";
}

function approvalCopy(pending: Pending): { what: string; note: string; sensitive: boolean } {
  if (isRoutineApproval(pending)) {
    return {
      what: pending.message.card?.routineRequest?.operation.action === "create" ? "schedule this routine" : "change this routine",
      note: "Review the schedule and instructions below. The change happens only after you confirm it.",
      sensitive: false,
    };
  }
  if (pending.tool === "email.send") {
    return {
      what: "send this exact email once",
      note: "Nothing has been sent. Check the frozen recipients and wording before approving.",
      sensitive: true,
    };
  }
  const words = pending.tool.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ").toLowerCase();
  const nice: Record<string, string> = {
    bash: "run a command",
    shell: "run a command",
    read: "read a file",
    write: "write a file",
    edit: "edit a file",
    webfetch: "fetch a web page",
    websearch: "search the web",
  };
  return {
    what: nice[pending.tool.toLowerCase()] ?? (words || "take an action"),
    note: pending.held || "Review the exact request below before deciding.",
    sensitive: Boolean(pending.held),
  };
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
  const copy = approvalCopy(pending);
  const provider = pending.tool === "email.send" ? mailProviderFromDetail(pending.detail) : undefined;
  return (
    <div
      role="region"
      aria-label={isRoutineApproval(pending) ? "Pending routine confirmation" : "Pending approval"}
      className="rounded-t-2xl border-b border-accent/15 bg-gradient-to-br from-card via-card to-accent/[0.04] px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex items-start gap-3" aria-live="polite">
        {provider ? (
          <MailProviderMark provider={provider} className="mt-0.5" />
        ) : (
          <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", copy.sensitive ? "bg-warning/12 text-warning" : "bg-accent/12 text-accent")}>
            <span className="text-[16px]">{copy.sensitive ? "!" : "?"}</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-secondary">
              {provider === "gmail" ? "Gmail" : provider === "proton-bridge" ? "Proton Mail" : label(pending)}
            </span>
            {count > 1 && (
              <span className="rounded-full bg-control px-1.5 py-0.5 text-[11px] tabular-nums text-ink-secondary">{index + 1} of {count}</span>
            )}
          </div>
          <div className="mt-1 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {bot?.name ? `${bot.name} wants to ` : "The agent wants to "}{copy.what}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{copy.note}</p>
        </div>
      </div>
      {/* never truncated — long commands wrap and scroll */}
      <pre
        tabIndex={0}
        aria-label={isRoutineApproval(pending) ? "Routine details to review" : "Approval details to review"}
        className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink"
      >
        {pending.detail}
      </pre>
      {pending.held && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/8 px-3 py-2.5 text-[12px] leading-relaxed text-warning">
          <span aria-hidden="true">⚠</span><span>{pending.held}</span>
        </div>
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
  const isRoutineRequest = isRoutineApproval(pending);
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

  const base = "min-h-10 rounded-xl px-4 text-[13px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline/30 bg-control/20 px-4 py-3.5 sm:px-6">
      {!isRoutineRequest && !exactEmail && (
        <button onClick={onCancelTurn} className={cn(base, "mr-auto text-ink-secondary hover:bg-control hover:text-ink")}>
          Stop this task
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <button
        onClick={() => decide("deny")}
        className={cn(base, "border border-danger/30 bg-danger/8 text-danger hover:border-danger/50 hover:bg-danger/15")}
      >
        {isRoutineRequest ? "Cancel" : exactEmail ? "Don’t send" : "Deny"}
      </button>
      {!isRoutineRequest && bot && pending.allowKey && (
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
        {isRoutineRequest ? "Confirm" : exactEmail ? "Approve & send" : "Allow once"}
      </button>
      </div>
    </div>
  );
}
