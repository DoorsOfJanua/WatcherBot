// Idempotently mirror existing MyAgent Room text turns into AgentHQ's local
// conversation ledger. New turns are mirrored live by the server; this script
// covers conversations that existed before the bridge was installed.

const roomUrl = (process.env.MYAGENT_ROOM_URL || "http://127.0.0.1:8799").replace(/\/$/, "");
const hqUrl = (process.env.OMB_AGENT_HQ_URL || "http://127.0.0.1:4242").replace(/\/$/, "");

for (const [label, raw] of [["MyAgent Room", roomUrl], ["AgentHQ", hqUrl]]) {
  const url = new URL(raw);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`${label} URL must remain on this computer`);
  }
}

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url}: ${body.error || response.status}`);
  return body;
}

const snapshot = await json(`${roomUrl}/api/bots?messages=0`);
let mirrored = 0;
for (const bot of snapshot.bots) {
  if (!bot.sharedMemoryId) continue;
  for (const task of bot.tasks || []) {
    const page = await json(`${roomUrl}/api/threads/${encodeURIComponent(task.threadId)}/messages?limit=200`);
    for (const message of page.messages || []) {
      if (message.kind !== "text" || !message.text?.trim()) continue;
      const response = await fetch(`${hqUrl}/api/conversations/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationKey: `myagent-room:${bot.sharedMemoryId}:${task.threadId}`,
          agentId: bot.sharedMemoryId,
          role: message.role === "user" ? "user" : "assistant",
          content: message.text.trim().slice(0, 24_000),
          surface: "agent-hq",
          sourceRef: `myagent-room:${bot.id}:${task.threadId}:${message.id}`,
          createdAt: new Date(message.at).toISOString(),
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`AgentHQ rejected ${bot.name} turn ${message.id}`);
      mirrored += 1;
    }
  }
}

console.log(`Shared-memory backfill checked ${mirrored} existing text turns.`);
