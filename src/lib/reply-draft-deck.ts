export interface ReplyDraftItem {
  id: string;
  author: string;
  post: string;
  reply: string;
  url?: string;
}

export interface ReplyDraftBatch {
  profileId: string;
  agentId?: string;
  title: string;
  items: ReplyDraftItem[];
}

function short(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseReplyDraftBatch(raw: string): ReplyDraftBatch | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const profileId = short(value.profileId, 64);
    const agentId = short(value.agentId, 64);
    const source = Array.isArray(value.items) ? value.items : [];
    if (!profileId || source.length < 1 || source.length > 10) return null;
    const seen = new Set<string>();
    const items: ReplyDraftItem[] = [];
    for (const candidate of source) {
      if (!candidate || typeof candidate !== "object") return null;
      const row = candidate as Record<string, unknown>;
      const id = short(row.id, 100);
      const author = short(row.author, 40).replace(/^@/, "");
      const post = short(row.post, 500);
      const reply = short(row.reply, 280);
      const url = short(row.url, 500);
      if (!id || !author || !post || !reply || seen.has(id)) return null;
      seen.add(id);
      items.push({ id, author, post, reply, ...(url ? { url } : {}) });
    }
    return {
      profileId,
      ...(agentId ? { agentId } : {}),
      title: short(value.title, 80) || `${items.length} replies ready`,
      items,
    };
  } catch {
    return null;
  }
}
