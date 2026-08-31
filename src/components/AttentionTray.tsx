import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileSearch,
  Inbox,
  Loader2,
  Mail,
  MessageCircleQuestion,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";

import { actionableAttentionCount, attentionItems, type AttentionItem, type AttentionKind } from "@/lib/attention";
import { cn } from "@/lib/cn";
import { openNotificationTarget, useStore, type Bot } from "@/state/store";
import { BotAvatar } from "./Avatar";
import "./attention-tray.css";

const presentation = {
  approval: { label: "Approval", icon: ShieldCheck, color: "text-accent" },
  question: { label: "Question", icon: MessageCircleQuestion, color: "text-warning" },
  mail: { label: "Draft", icon: Mail, color: "text-accent" },
  review: { label: "Review", icon: FileSearch, color: "text-success" },
  routine: { label: "Routine", icon: CalendarClock, color: "text-danger" },
  working: { label: "Working", icon: Loader2, color: "text-ink-secondary" },
} satisfies Record<AttentionKind, { label: string; icon: LucideIcon; color: string }>;

function timeLabel(at: number): string {
  if (!at) return "Now";
  const elapsed = Date.now() - at;
  if (elapsed < 60_000) return "Now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  const date = new Date(at);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function attentionMotion(item: AttentionItem) {
  const words = `${item.title} ${item.summary}`.toLowerCase();
  if (item.kind === "routine" || item.kind === "approval" || /urgent|overdue|asap|critical/.test(words)) {
    return { state: "alerting" as const, motion: "alert" as const };
  }
  if (item.kind === "question") return { state: "surprised" as const, motion: "surprise" as const };
  if (item.kind === "working") return { state: "working" as const, motion: "working" as const };
  return { state: "listening" as const, motion: "success" as const };
}

function AttentionIcon({ item }: { item: AttentionItem }) {
  const view = presentation[item.kind];
  const Icon = view.icon;
  return (
    <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline/35 bg-control/65", view.color)}>
      <Icon size={17} className={item.kind === "working" ? "animate-spin" : undefined} aria-hidden="true" />
      {item.priority === "blocking" && (
        <span className="attention-tray-beacon absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel bg-warning" />
      )}
    </span>
  );
}

export function AttentionTray({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const isWatcher = Boolean(bot.chiefOfStaff);
  const items = useMemo(
    () => attentionItems(state, isWatcher ? undefined : bot.id),
    [bot.id, isWatcher, state],
  );
  const count = actionableAttentionCount(items);
  const working = items.filter((item) => item.kind === "working").length;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [bot.id]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openItem = (item: AttentionItem) => {
    if (item.kind === "routine" && item.routineRunId) {
      dispatch({ type: "markRoutineRunSeen", runId: item.routineRunId });
      dispatch({ type: "showRoutines" });
      setOpen(false);
      return;
    }
    if (!item.actionable) return;
    openNotificationTarget(dispatch, { botId: item.botId, threadId: item.threadId }, state);
    if (item.messageId) dispatch({ type: "focusMessage", threadId: item.threadId, messageId: item.messageId });
    setOpen(false);
  };

  const lead = items.find((item) => item.actionable) ?? items[0];
  const leadBot = lead ? state.bots.find((candidate) => candidate.id === lead.botId) : undefined;
  const signal = lead ? attentionMotion(lead) : undefined;
  const urgent = lead?.priority === "blocking";
  const label = count > 0 ? `${count} need${count === 1 ? "s" : ""} you` : working ? `${working} working` : "All quiet";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="attention-tray-panel"
        className={cn(
          "attention-tray-trigger flex h-9 items-center gap-1.5 rounded-xl border px-1.5 text-[12px] font-medium transition hover:-translate-y-px hover:bg-control",
          count ? "border-accent/30 bg-panel text-ink" : "border-hairline/35 text-ink-secondary",
          urgent && "attention-tray-trigger--urgent",
        )}
      >
        <span className="relative flex size-6 items-center justify-center">
          {leadBot && signal ? (
            <span className={cn("attention-tray-lead-avatar", urgent && "attention-tray-lead-avatar--urgent")}>
              <BotAvatar
                bot={leadBot}
                size={27}
                state={signal.state}
                motion={signal.motion}
                motionKey={lead.at}
                label={`${leadBot.name} needs your attention`}
              />
            </span>
          ) : count ? (
            <Inbox size={15} className="attention-tray-beacon" />
          ) : (
            <CheckCircle2 size={15} />
          )}
        </span>
        <span className="@max-5xl/chathead:hidden">{label}</span>
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <section
          id="attention-tray-panel"
          aria-label={isWatcher ? "All agents needing attention" : `${bot.name} attention`}
          className="attention-tray-panel absolute right-0 top-11 z-50 flex max-h-[min(72vh,700px)] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-hairline/45 bg-panel/95 shadow-2xl backdrop-blur-2xl"
        >
          <header className="flex items-start gap-3 border-b border-hairline/25 px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent"><Inbox size={17} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold text-ink">{isWatcher ? "Needs your attention" : `${bot.name}'s desk`}</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-secondary">
                {count ? `${count} open item${count === 1 ? "" : "s"}` : working ? "Work is quietly underway" : "Nothing needs you right now"}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close attention tray" className="flex size-8 items-center justify-center rounded-xl text-ink-secondary hover:bg-control hover:text-ink">
              <X size={15} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-success/10 text-success"><CheckCircle2 size={22} /></span>
                <p className="mt-3 text-[13.5px] font-semibold text-ink">All quiet</p>
                <p className="mt-1 text-[12px] text-ink-secondary">Approvals, drafts, finished work, and routine failures gather here.</p>
              </div>
            ) : items.map((item, index) => {
              const agent = state.bots.find((candidate) => candidate.id === item.botId);
              const children = item.children?.length ? item.children : [item];
              return (
                <div key={item.id} className="attention-tray-row border-b border-hairline/25 p-1 last:border-b-0" style={{ "--attention-index": index } as React.CSSProperties}>
                  <button type="button" onClick={() => openItem(item)} disabled={!item.actionable} className="group flex w-full items-start gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors hover:bg-control/60 disabled:cursor-default">
                    <AttentionIcon item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-secondary">{timeLabel(item.at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] font-medium text-ink-secondary">
                        {presentation[item.kind].label} · {agent?.name ?? item.botName}{agent?.title ? ` · ${agent.title}` : ""}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[11.5px] leading-relaxed text-ink-secondary/80">{item.summary}</span>
                    </span>
                    {item.actionable && <ChevronRight size={14} className="mt-3 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5" />}
                  </button>
                  {children.length > 1 && (
                    <div className="mb-2 ml-[58px] mr-2 overflow-hidden rounded-xl border border-hairline/30 bg-inset/45">
                      {children.map((child) => (
                        <button key={child.id} type="button" onClick={() => openItem(child)} className="flex w-full items-center gap-2 border-b border-hairline/25 px-3 py-2 text-left last:border-b-0 hover:bg-control/60">
                          <Mail size={13} className="shrink-0 text-accent" />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{child.title}</span>
                          <span className="max-w-[45%] truncate text-[11px] text-ink-secondary">{child.summary}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <footer className="flex items-center gap-2 border-t border-hairline/25 px-4 py-2.5 text-[10.5px] text-ink-secondary">
            <CircleAlert size={12} /> Only work that needs awareness or action appears here.
          </footer>
        </section>
      )}
    </div>
  );
}
