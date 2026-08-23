import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileSearch,
  Inbox,
  Loader2,
  Mail,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { actionableAttentionCount, attentionItems, type AttentionItem, type AttentionKind } from "@/lib/attention";
import { cn } from "@/lib/cn";
import { formatTime, openNotificationTarget, useStore, type Bot } from "@/state/store";
import { BotAvatar } from "./Avatar";
import "./attention-tray.css";

interface KindPresentation {
  label: string;
  icon: LucideIcon;
  color: string;
}

interface AttentionDelayStyle extends CSSProperties {
  "--attention-index": number;
}

function attentionDelay(index: number): AttentionDelayStyle {
  return { "--attention-index": index };
}

const kindPresentation = {
  approval: { label: "Approval", icon: ShieldCheck, color: "text-accent" },
  question: { label: "Question", icon: MessageCircleQuestion, color: "text-warning" },
  mail: { label: "Drafts", icon: Mail, color: "text-accent" },
  review: { label: "To review", icon: FileSearch, color: "text-success" },
  routine: { label: "Routine", icon: CalendarClock, color: "text-danger" },
  working: { label: "Working", icon: Loader2, color: "text-ink-secondary" },
} satisfies Record<AttentionKind, KindPresentation>;

function timeLabel(at: number): string {
  if (!at) return "Now";
  const elapsed = Date.now() - at;
  if (elapsed < 60_000) return "Now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  const today = new Date();
  const date = new Date(at);
  if (today.toDateString() === date.toDateString()) return formatTime(at);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function AttentionGlyph({ item }: { item: AttentionItem }) {
  const presentation = kindPresentation[item.kind];
  const Icon = presentation.icon;
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline/35 bg-raised/70",
        presentation.color,
      )}
      aria-hidden="true"
    >
      <Icon size={17} className={item.kind === "working" ? "animate-spin" : undefined} />
      {item.priority === "blocking" && (
        <span className="attention-tray-beacon absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-panel bg-warning" />
      )}
    </span>
  );
}

function MailDrafts({ item, onOpen }: { item: AttentionItem; onOpen: (item: AttentionItem) => void }) {
  if (!item.children?.length) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-hairline/35 bg-inset/45">
      {item.children.map((draft, index) => (
        <button
          key={draft.id}
          type="button"
          onClick={() => onOpen(draft)}
          className={cn(
            "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-raised/65",
            index > 0 && "border-t border-hairline/25",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Mail size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-ink">{draft.title}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-ink-secondary">{draft.summary}</span>
          </span>
          <ChevronRight size={14} className="shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}

function AttentionRow({
  item,
  index,
  open,
  onToggle,
  onOpen,
}: {
  item: AttentionItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  onOpen: (item: AttentionItem) => void;
}) {
  const presentation = kindPresentation[item.kind];
  const hasDrafts = Boolean(item.children?.length);
  return (
    <div
      className="attention-tray-row border-b border-hairline/25 last:border-b-0"
      style={attentionDelay(index)}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-raised/45"
      >
        <AttentionGlyph item={item} />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
            <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-ink-secondary">{timeLabel(item.at)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-secondary">
            <span>{presentation.label}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.botName}</span>
          </span>
        </span>
        <ChevronDown
          size={14}
          className={cn("mt-2 shrink-0 text-ink-secondary transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div className="attention-tray-detail" data-open={open}>
        <div>
          <div className="px-3 pb-3 pl-[60px]">
            <p className="text-[12.5px] leading-relaxed text-ink-secondary">{item.summary}</p>
            {hasDrafts ? (
              <MailDrafts item={item} onOpen={onOpen} />
            ) : (
              <button
                type="button"
                onClick={() => onOpen(item)}
                disabled={!item.actionable}
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                  item.actionable
                    ? "bg-accent text-[var(--color-accent-ink)] hover:brightness-110"
                    : "cursor-default bg-raised text-ink-secondary",
                )}
              >
                {item.kind === "routine" ? "Review routine" : item.kind === "working" ? "In progress" : "Open conversation"}
                {item.actionable && <ChevronRight size={13} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AgentGroup {
  bot: Bot;
  items: AttentionItem[];
  actionable: number;
}

function AgentOverview({ groups, onChoose }: { groups: AgentGroup[]; onChoose: (botId: string) => void }) {
  return (
    <div className="px-2 pb-2">
      {groups.map((group, index) => (
        <button
          key={group.bot.id}
          type="button"
          onClick={() => onChoose(group.bot.id)}
          className="attention-tray-row group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-raised/50"
          style={attentionDelay(index)}
        >
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <BotAvatar bot={group.bot} size={36} />
            {group.actionable > 0 && (
              <span className="absolute -top-0.5 -right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-[var(--color-accent-ink)]">
                {group.actionable}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-semibold text-ink">{group.bot.name}</span>
              {group.items.some((item) => item.kind === "working") && (
                <span className="attention-tray-working size-1.5 rounded-full bg-success" aria-label="Working" />
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-ink-secondary">{group.items[0]?.title}</span>
          </span>
          <ChevronRight size={15} className="text-ink-secondary transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
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
  const groups = useMemo<AgentGroup[]>(() => {
    const byAgent = new Map<string, AttentionItem[]>();
    for (const item of items) byAgent.set(item.botId, [...(byAgent.get(item.botId) ?? []), item]);
    return [...byAgent].flatMap(([botId, agentItems]) => {
      const agent = state.bots.find((candidate) => candidate.id === botId);
      return agent ? [{ bot: agent, items: agentItems, actionable: actionableAttentionCount(agentItems) }] : [];
    });
  }, [items, state.bots]);

  const [expanded, setExpanded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
    setSelectedAgentId(null);
    setOpenItemId(null);
  }, [bot.id]);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) setExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  const selectedItems = selectedAgentId ? items.filter((item) => item.botId === selectedAgentId) : items;
  const selectedBot = selectedAgentId ? state.bots.find((candidate) => candidate.id === selectedAgentId) : undefined;

  const openAttention = (item: AttentionItem) => {
    if (item.kind === "routine" && item.routineRunId) {
      dispatch({ type: "markRoutineRunSeen", runId: item.routineRunId });
      dispatch({ type: "showRoutines" });
      setExpanded(false);
      return;
    }
    if (!item.actionable) return;
    openNotificationTarget(dispatch, { botId: item.botId, threadId: item.threadId }, state);
    if (item.messageId) dispatch({ type: "focusMessage", threadId: item.threadId, messageId: item.messageId });
    setExpanded(false);
  };

  const quiet = count === 0 && working === 0;
  const triggerLabel = count > 0 ? `${count} need${count === 1 ? "s" : ""} you` : working > 0 ? `${working} working` : "All quiet";

  return (
    <div ref={rootRef} className="absolute top-[68px] right-4 z-30 max-w-[calc(100%-2rem)]">
      <button
        type="button"
        onClick={() => {
          setExpanded((value) => !value);
          if (expanded) {
            setSelectedAgentId(null);
            setOpenItemId(null);
          }
        }}
        aria-expanded={expanded}
        aria-controls="attention-tray-panel"
        className={cn(
          "attention-tray-trigger ml-auto flex h-10 items-center gap-2 rounded-2xl border px-2.5 text-[12.5px] font-medium backdrop-blur-xl transition hover:-translate-y-0.5",
          count > 0
            ? "border-accent/30 bg-panel/90 text-ink"
            : "border-hairline/35 bg-panel/75 text-ink-secondary",
        )}
      >
        <span className={cn("flex size-6 items-center justify-center rounded-lg", count > 0 ? "bg-accent/12 text-accent" : "bg-raised/70")}>
          {quiet ? <CheckCircle2 size={14} /> : count > 0 ? <Inbox size={14} className="attention-tray-beacon" /> : <Loader2 size={14} className="animate-spin" />}
        </span>
        <span>{triggerLabel}</span>
        <ChevronDown size={13} className={cn("transition-transform duration-300", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="attention-tray-shell absolute top-12 right-0 w-[min(380px,calc(100vw-2rem))]">
          <section
            id="attention-tray-panel"
            aria-label={isWatcher ? "All agents needing attention" : `${bot.name} attention`}
            className="attention-tray-panel flex max-h-[min(68vh,620px)] flex-col overflow-hidden rounded-[26px] border border-hairline/45 bg-panel/95 backdrop-blur-2xl"
          >
            <header className="flex items-center gap-3 px-4 pt-4 pb-3">
              {isWatcher && selectedAgentId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(null);
                    setOpenItemId(null);
                  }}
                  aria-label="Back to all agents"
                  className="flex size-8 items-center justify-center rounded-xl bg-raised/65 text-ink-secondary transition hover:bg-raised hover:text-ink"
                >
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <Sparkles size={17} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-semibold text-ink">
                  {selectedBot ? selectedBot.name : isWatcher ? "Needs your attention" : `${bot.name}'s desk`}
                </h2>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
                  {selectedBot
                    ? `${actionableAttentionCount(selectedItems)} open · ${selectedItems.filter((item) => item.kind === "working").length} working`
                    : isWatcher
                      ? `${groups.length} agent${groups.length === 1 ? "" : "s"} with something to see`
                      : count > 0
                        ? `${count} item${count === 1 ? "" : "s"} waiting for you`
                        : working > 0
                          ? "Work is quietly underway"
                          : "Nothing needs you right now"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close attention tray"
                className="flex size-8 items-center justify-center rounded-xl text-ink-secondary transition hover:bg-raised hover:text-ink"
              >
                <X size={15} />
              </button>
            </header>

            <div className="mx-4 h-px bg-hairline/30" />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-success/10 text-success">
                    <CheckCircle2 size={22} />
                  </span>
                  <p className="mt-3 text-[13.5px] font-semibold text-ink">All quiet</p>
                  <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-ink-secondary">
                    New approvals, finished work, and drafts will gather here.
                  </p>
                </div>
              ) : isWatcher && !selectedAgentId ? (
                <AgentOverview groups={groups} onChoose={setSelectedAgentId} />
              ) : (
                <div className="px-2">
                  {selectedItems.map((item, index) => (
                    <AttentionRow
                      key={item.id}
                      item={item}
                      index={index}
                      open={openItemId === item.id}
                      onToggle={() => setOpenItemId((value) => value === item.id ? null : item.id)}
                      onOpen={openAttention}
                    />
                  ))}
                </div>
              )}
            </div>

            <footer className="flex items-center gap-2 border-t border-hairline/25 px-4 py-2.5 text-[10.5px] text-ink-secondary">
              <CircleAlert size={12} />
              <span>Only work that needs awareness or action appears here.</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
