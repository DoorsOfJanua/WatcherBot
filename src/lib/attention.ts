import { visibleMessages, type AppState, type Bot, type Message, type MausColor } from "@/state/store";

export type AttentionKind = "approval" | "question" | "mail" | "review" | "routine" | "working";
export type AttentionPriority = "blocking" | "soon" | "review" | "ambient";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  priority: AttentionPriority;
  botId: string;
  botName: string;
  botColor: MausColor;
  threadId: string;
  title: string;
  summary: string;
  at: number;
  actionable: boolean;
  messageId?: string;
  routineRunId?: string;
  children?: AttentionItem[];
}

const priorityRank = {
  blocking: 0,
  soon: 1,
  review: 2,
  ambient: 3,
} satisfies Record<AttentionPriority, number>;

function oneLine(value: string | undefined, max = 150): string {
  if (!value) return "";
  const clean = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function header(detail: string, label: string): string {
  return detail.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
}

export function mailPreviewMeta(detail: string): { to: string; subject: string } {
  return { to: header(detail, "To"), subject: header(detail, "Subject") };
}

function latestUsefulMessage(bot: Bot): Message | undefined {
  return [...visibleMessages(bot)].reverse().find((message) => {
    if (message.role !== "bot") return false;
    if (message.kind === "text") return Boolean(message.text?.trim());
    if (message.kind === "activity") return Boolean(message.tool?.name);
    return false;
  });
}

function messageSummary(message: Message | undefined): string {
  if (message?.kind === "text") return oneLine(message.text);
  if (message?.kind === "activity") return oneLine(message.tool?.name);
  return "";
}

function openCards(bot: Bot): Message[] {
  return visibleMessages(bot).filter(
    (message) =>
      message.kind === "options" &&
      Boolean(message.card) &&
      !message.card?.answered &&
      !message.card?.dismissed,
  );
}

function mailItem(bot: Bot, message: Message): AttentionItem {
  const meta = mailPreviewMeta(message.card?.subtitle ?? "");
  return {
    id: `mail:${bot.id}:${message.id}`,
    kind: "mail",
    priority: "review",
    botId: bot.id,
    botName: bot.name,
    botColor: bot.color,
    threadId: bot.threadId,
    messageId: message.id,
    title: meta.subject || "Email ready to review",
    summary: meta.to ? `To ${meta.to}` : "Review the exact draft before sending",
    at: message.at,
    actionable: true,
  };
}

function groupedMailItem(bot: Bot, children: AttentionItem[]): AttentionItem {
  if (children.length === 1) return children[0];
  const sorted = [...children].sort((a, b) => b.at - a.at);
  const recipients = sorted.map((item) => item.summary.replace(/^To\s+/i, "")).filter(Boolean);
  const more = Math.max(0, recipients.length - 3);
  return {
    id: `mail-batch:${bot.id}:${bot.threadId}`,
    kind: "mail",
    priority: "review",
    botId: bot.id,
    botName: bot.name,
    botColor: bot.color,
    threadId: bot.threadId,
    title: `${sorted.length} drafts ready`,
    summary: recipients.length
      ? `${recipients.slice(0, 3).join(", ")}${more ? ` +${more} more` : ""}`
      : "Review Mailman's draft batch",
    at: sorted[0].at,
    actionable: true,
    children: sorted,
  };
}

function cardItem(bot: Bot, message: Message): AttentionItem {
  const card = message.card!;
  const isApproval = Boolean(card.tool || card.requestId);
  return {
    id: `${isApproval ? "approval" : "question"}:${bot.id}:${message.id}`,
    kind: isApproval ? "approval" : "question",
    priority: "blocking",
    botId: bot.id,
    botName: bot.name,
    botColor: bot.color,
    threadId: bot.threadId,
    messageId: message.id,
    title: card.title || (isApproval ? `${bot.name} needs approval` : `${bot.name} has a question`),
    summary: oneLine(card.subtitle) || "Open the conversation to respond",
    at: message.at,
    actionable: true,
  };
}

/** A derived projection over durable approvals, unread work, live work and
 * routine failures. No second queue is persisted, so the tray cannot drift
 * from the underlying records. */
export function attentionItems(
  state: Pick<AppState, "bots" | "routineRuns">,
  scopeBotId?: string,
): AttentionItem[] {
  const bots = state.bots.filter((bot) => !bot.hidden && (!scopeBotId || bot.id === scopeBotId));
  const botById = new Map(bots.map((bot) => [bot.id, bot]));
  const items: AttentionItem[] = [];

  for (const bot of bots) {
    const cards = openCards(bot);
    const mail = cards
      .filter((message) => message.card?.tool === "email.send")
      .map((message) => mailItem(bot, message));
    if (mail.length) items.push(groupedMailItem(bot, mail));
    items.push(...cards.filter((message) => message.card?.tool !== "email.send").map((message) => cardItem(bot, message)));

    const latest = latestUsefulMessage(bot);
    if (bot.unread && cards.length === 0) {
      items.push({
        id: `review:${bot.id}:${latest?.id ?? bot.threadId}`,
        kind: "review",
        priority: "review",
        botId: bot.id,
        botName: bot.name,
        botColor: bot.color,
        threadId: bot.threadId,
        messageId: latest?.id,
        title: `${bot.name} has an update`,
        summary: messageSummary(latest) || "New work is ready to review",
        at: latest?.at ?? 0,
        actionable: true,
      });
    }
    if (bot.busy && cards.length === 0) {
      items.push({
        id: `working:${bot.id}:${bot.threadId}`,
        kind: "working",
        priority: "ambient",
        botId: bot.id,
        botName: bot.name,
        botColor: bot.color,
        threadId: bot.threadId,
        title: `${bot.name} is working`,
        summary: messageSummary(latest) || bot.tasks?.find((task) => task.threadId === bot.threadId)?.title || "Working now…",
        at: latest?.at ?? 0,
        actionable: false,
      });
    }
  }

  for (const run of state.routineRuns) {
    if (run.seenAt || (run.status !== "failed" && run.status !== "missed")) continue;
    const bot = botById.get(run.botId);
    if (!bot) continue;
    items.push({
      id: `routine:${run.id}`,
      kind: "routine",
      priority: "soon",
      botId: bot.id,
      botName: bot.name,
      botColor: bot.color,
      threadId: run.threadId ?? bot.threadId,
      routineRunId: run.id,
      title: run.status === "missed" ? `${run.routineName} was missed` : `${run.routineName} needs attention`,
      summary: oneLine(run.error) || (run.status === "missed" ? "This scheduled run did not start." : "The routine did not finish successfully."),
      at: run.finishedAt ?? run.scheduledFor,
      actionable: true,
    });
  }

  return items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.at - a.at);
}

export function actionableAttentionCount(items: AttentionItem[]): number {
  return items.reduce((total, item) => total + (item.actionable ? item.children?.length ?? 1 : 0), 0);
}
