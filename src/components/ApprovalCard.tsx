// The approval box: what the bot wants to do, and three ways to answer.
//
// Deliberately not the lettered A/B/C list the onboarding card uses — an
// approval is a decision about one concrete action, so it shows the tool
// and the actual command/path in monospace, and the choices carry their
// own behavior instead of being matched by their label text.
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, ShieldCheck, Sparkles, X } from "lucide-react";
import { api, type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";

interface ToolLabels {
  [tool: string]: string;
}

const ROUTINE_SETTLED_LABEL = {
  create: "Routine scheduled",
  update: "Routine updated",
  pause: "Routine paused",
  resume: "Routine resumed",
  run_now: "Routine run queued",
  delete: "Routine deleted",
} as const;

/** The tool's own name is noise to a human: mcp__ogb__computer_batch is
 * "computer batch", Bash is "run a command". */
function toolLabel(tool?: string): string {
  if (!tool) return "an action";
  const bare = tool.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");
  const nice: ToolLabels = {
    Bash: "run a command",
    Read: "read a file",
    Write: "write a file",
    Edit: "edit a file",
    WebFetch: "fetch a web page",
    WebSearch: "search the web",
    "email.send": "send this exact email once",
    schedule_routine: "schedule a routine",
    manage_routine: "change a routine",
  };
  return nice[tool] ?? bare;
}

interface MailDraft {
  fromAccount: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: [];
}

const fieldClass =
  "w-full rounded-lg border border-hairline/50 bg-inset px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function addresses(value: string): string[] {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function MailDraftEditor({ requestId, onClose }: { requestId: string; onClose: (saved: string) => void }) {
  const [draft, setDraft] = useState<MailDraft | null>(null);
  const [initial, setInitial] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [learnStyle, setLearnStyle] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api(`/api/mail-actions/${encodeURIComponent(requestId)}/draft`)
      .then(({ action }) => {
        if (!active) return;
        const loaded: MailDraft = action.draft;
        setDraft(loaded);
        setTo(loaded.to.join(", "));
        setCc(loaded.cc.join(", "));
        setBcc(loaded.bcc.join(", "));
        setInitial(JSON.stringify(loaded));
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requestId]);

  const nextDraft = useMemo<MailDraft | null>(() => draft ? {
    ...draft,
    to: addresses(to),
    cc: addresses(cc),
    bcc: addresses(bcc),
  } : null, [bcc, cc, draft, to]);
  const dirty = nextDraft !== null && JSON.stringify(nextDraft) !== initial;

  const save = async () => {
    if (!nextDraft || !dirty || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api(`/api/mail-actions/${encodeURIComponent(requestId)}/draft`, {
        method: "PUT",
        body: JSON.stringify({ draft: nextDraft, learnStyle }),
      });
      onClose(result.style?.learned
        ? "Saved as a new revision · Mailman learned from your edit"
        : "Saved as a new revision");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-2 text-[13px] text-ink-secondary">
        <Loader2 size={14} className="animate-spin" /> Loading your draft…
      </div>
    );
  }
  if (!draft || !nextDraft) {
    return <div className="text-[13px] text-danger">{error || "This draft could not be opened. Nothing changed."}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          From
          <input value={draft.fromAccount} readOnly className={cn(fieldClass, "cursor-not-allowed opacity-70")} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          To
          <input value={to} onChange={(event) => setTo(event.target.value)} className={fieldClass} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          Cc <span className="font-normal text-ink-secondary/65">optional</span>
          <input value={cc} onChange={(event) => setCc(event.target.value)} className={fieldClass} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          Bcc <span className="font-normal text-ink-secondary/65">optional</span>
          <input value={bcc} onChange={(event) => setBcc(event.target.value)} className={fieldClass} autoComplete="off" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
        Subject
        <input
          value={draft.subject}
          onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          className={fieldClass}
          maxLength={300}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
        Message
        <textarea
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          className={cn(fieldClass, "min-h-56 resize-y leading-relaxed")}
          maxLength={50_000}
        />
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={learnStyle}
        onClick={() => setLearnStyle((value) => !value)}
        className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", learnStyle ? "bg-accent" : "bg-raised")}>
          <span className={cn("absolute top-1 size-4 rounded-full bg-white transition-transform", learnStyle ? "translate-x-6" : "translate-x-1")} />
        </span>
        <span>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Sparkles size={13} className="text-accent" /> Learn from this edit
          </span>
          <span className="block text-[11.5px] leading-relaxed text-ink-secondary">
            Use the difference—not this email&rsquo;s private facts—to improve future drafts.
          </span>
        </span>
      </button>

      {error && <div role="alert" className="text-[12.5px] text-danger">{error} Your saved draft is unchanged.</div>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onClose("")}
          disabled={saving}
          className="min-h-11 rounded-full px-4 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          Keep saved draft
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving your draft…" : "Save new revision"}
        </button>
      </div>
    </div>
  );
}

export function ApprovalCard({
  bot,
  message,
}: {
  /** who is asking, for the "Name wants to …" line */
  bot?: Bot;
  message: Message;
}) {
  const [editingDraft, setEditingDraft] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const card = message.card;
  if (!card) return null;
  const settled = card.answered;
  const isRoutineRequest = Boolean(card.routineRequest);
  const routineAction = card.routineRequest?.operation.action;
  const routineSettledLabel = routineAction ? ROUTINE_SETTLED_LABEL[routineAction] : undefined;
  const exactEmail = card.tool === "email.send";
  const revisableEmail = exactEmail && Boolean(card.requestId) && settled !== "allow" && settled !== "failed";
  const displayTool = isRoutineRequest
    ? routineAction === "create" ? "schedule_routine" : "manage_routine"
    : card.tool;

  return (
    <div
      className={cn(
        "w-full max-w-[840px] rounded-2xl border bg-card p-4",
        settled ? "border-hairline/30 opacity-70" : "border-accent/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[15px] font-semibold text-ink">
          {bot ? `${bot.name} wants to ` : "Wants to "}
          {toolLabel(displayTool)}
        </div>
        {displayTool && <span className="shrink-0 font-mono text-[11px] text-ink-secondary">{displayTool}</span>}
      </div>

      {/* what, exactly */}
      <pre
        tabIndex={0}
        aria-label={isRoutineRequest ? "Routine details" : "Approval details"}
        className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-inset px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink"
      >
        {card.subtitle}
      </pre>

      {revisableEmail && card.requestId && (
        <button
          type="button"
          onClick={() => {
            setSavedNotice("");
            setEditingDraft(true);
          }}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-full border border-hairline/50 px-3.5 text-[13px] font-medium text-ink hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Pencil size={14} /> {settled ? "Revise draft" : "Edit draft"}
        </button>
      )}

      {savedNotice && (
        <div role="status" className="mt-2 flex items-center gap-1.5 text-[12.5px] text-success">
          <Check size={13} /> {savedNotice}
        </div>
      )}

      {card.held && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
          {card.held}
        </div>
      )}

      {/* The decision lives in the composer (one place to answer, and it
          can't be scrolled past); here we only record what happened. */}
      <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-secondary">
        {settled === "allow" ? (
          <>
            <Check size={14} className="text-success" />
            {exactEmail ? "Approved and sent" : routineSettledLabel ?? (isRoutineRequest ? "Routine confirmed" : "Allowed")}
          </>
        ) : settled === "failed" ? (
          <>
            <X size={14} className="text-danger" /> Send not confirmed — approval locked
          </>
        ) : settled ? (
          <>
            <X size={14} /> {isRoutineRequest ? "Cancelled" : "Denied"}
          </>
        ) : (
          <>
            <ShieldCheck size={14} className="text-accent" />
            {isRoutineRequest ? "Waiting for your confirmation below" : "Waiting for your answer below"}
          </>
        )}
      </div>

      {editingDraft && card.requestId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit email draft"
            className="max-h-[min(900px,calc(100vh-2rem))] w-full max-w-[860px] overflow-y-auto rounded-[28px] border border-hairline/50 bg-panel shadow-2xl shadow-black/30"
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline/30 bg-card/55 p-5 sm:p-7">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Email draft</div>
                <h2 className="mt-1 text-[21px] font-semibold text-ink">Make it sound like you</h2>
                <p className="mt-1 text-[12.5px] text-ink-secondary">
                  Review the exact recipients and wording before anything is sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDraft(false)}
                aria-label="Close email draft editor"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-raised hover:text-ink"
              >
                <X size={17} />
              </button>
            </div>
            <div className="p-5 sm:p-7">
              <MailDraftEditor
                requestId={card.requestId}
                onClose={(notice) => {
                  setEditingDraft(false);
                  setSavedNotice(notice);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
