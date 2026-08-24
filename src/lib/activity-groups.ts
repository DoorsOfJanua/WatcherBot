import type { Message } from "@/state/store";

export interface ActivityGroup {
  kind: "activity-group";
  id: string;
  messages: Message[];
}

export type TranscriptItem = Message | ActivityGroup;

/** Tool chatter is useful evidence, but it is not conversation. Keep errors
 * and bot-to-bot handoffs visible; collapse ordinary consecutive tool runs. */
export function isCollapsibleActivity(message: Message): boolean {
  return (
    message.kind === "activity" &&
    Boolean(message.tool) &&
    !message.comm &&
    !message.tool?.name.startsWith("error:")
  );
}

function sameDay(left: Message, right: Message): boolean {
  return new Date(left.at).toDateString() === new Date(right.at).toDateString();
}

export function groupTranscriptActivity(messages: Message[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];

  for (const message of messages) {
    const previous = items.at(-1);
    if (isCollapsibleActivity(message)) {
      if (
        previous?.kind === "activity-group" &&
        sameDay(previous.messages.at(-1)!, message) &&
        // in a room, runs from different bots never merge into one row
        previous.messages.at(-1)!.from?.botId === message.from?.botId
      ) {
        previous.messages.push(message);
      } else {
        items.push({ kind: "activity-group", id: `activity-${message.id}`, messages: [message] });
      }
      continue;
    }
    items.push(message);
  }

  return items;
}
