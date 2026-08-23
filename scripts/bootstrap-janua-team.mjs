// Idempotent, secret-free setup for Janua's core roster. The server must be
// running. Imported manifests are personas only; every capability grant is
// made explicitly below and starts closed.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = (process.env.MYAGENT_ROOM_URL || "http://127.0.0.1:8799").replace(/\/$/, "");
const manifest = JSON.parse(await readFile(path.join(root, "janua/team.openmaus.json"), "utf8"));
const names = manifest.team.members.map((member) => member.name);

async function api(route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${route}: ${body?.error || response.status}`);
  return body;
}

let snapshot = await api("/api/bots");
const existingNames = new Set(snapshot.bots.map((bot) => bot.name));
const present = names.filter((name) => existingNames.has(name));
if (present.length > 0 && present.length !== names.length) {
  throw new Error(`Partial Janua roster found (${present.join(", ")}); repair it explicitly before bootstrapping`);
}

if (present.length === 0) {
  await api("/api/teams/import?mode=add", { method: "POST", body: JSON.stringify(manifest) });
  snapshot = await api("/api/bots");
}

const byName = new Map();
for (const name of names) {
  const matches = snapshot.bots.filter((bot) => bot.name === name);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name}; found ${matches.length}`);
  byName.set(name, matches[0]);
}

const profiles = {
  "The Watcher": { chiefOfStaff: true, pinned: true, section: "Command", sharedMemoryId: "wormhole" },
  Forge: {
    section: "Build",
    sharedMemoryId: "forge",
    modelSelection: { instanceId: "codex", model: "gpt-5.6-sol", effort: "high" },
  },
  Signal: {
    section: "Research",
    sharedMemoryId: "signal",
    modelSelection: { instanceId: "claude", model: "claude-sonnet-5", effort: "high" },
  },
  Ganga: {
    section: "Creative",
    sharedMemoryId: "ganga",
    modelSelection: { instanceId: "claude", model: "claude-sonnet-5", effort: "high" },
  },
  Mailman: {
    section: "Operations",
    sharedMemoryId: "mailroom",
    modelSelection: { instanceId: "codex", model: "gpt-5.6-sol", effort: "high" },
  },
  Sensei: {
    section: "Life",
    sharedMemoryId: "coach",
    modelSelection: { instanceId: "claude", model: "claude-sonnet-5", effort: "high" },
  },
};

for (const [name, profile] of Object.entries(profiles)) {
  await api(`/api/bots/${byName.get(name).id}`, {
    method: "PATCH",
    body: JSON.stringify({ computer: "off", composio: false, ...profile }),
  });
}

// A pristine OpenMaus store seeds one unnamed onboarding bot. Archive only
// that unmistakable seed; never hide an existing custom agent on a rerun.
const nonCore = snapshot.bots.filter((bot) => !names.includes(bot.name));
if (
  nonCore.length === 1 &&
  !nonCore[0].title &&
  !nonCore[0].description &&
  nonCore[0].messages?.some((message) => message.kind === "options")
) {
  await api(`/api/bots/${nonCore[0].id}`, {
    method: "PATCH",
    body: JSON.stringify({ computer: "off", hidden: true }),
  });
}

snapshot = await api("/api/bots");
const memberIds = names.map((name) => snapshot.bots.find((bot) => bot.name === name).id);
let room = snapshot.groups.find((candidate) => candidate.name === "MyAgent Room");
if (!room) {
  room = (await api("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name: "MyAgent Room", memberIds }),
  })).group;
}

const bulletin =
  "This is Janua’s core agent room. The Watcher is the default entry point and delegates by specialist charter. " +
  "If Janua explicitly addresses one member, that member owns the answer and others stay quiet unless tagged or they have one short, materially useful addition. " +
  "Keep replies conversational and compact. Canonical project state outranks failed connector searches. " +
  "Reversible work may proceed; external or hard-to-reverse actions require the exact approval receipt.";

await api(`/api/groups/${room.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    memberIds,
    defaultResponder: { kind: "member", botId: byName.get("The Watcher").id },
    bulletin,
  }),
});

console.log(`MyAgent Room ready at ${base}: ${names.join(", ")}`);
