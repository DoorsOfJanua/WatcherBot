import type { Bot } from "@/state/store";

const PHRASES = {
  watcher: ["Watching the threads…", "Looking beneath the surface…", "Holding the whole room in view…"],
  sensei: ["Chopping wood…", "Carrying water…", "Sharpening the blade…"],
  mailman: ["Sorting the post…", "Chasing the paper trail…", "Making the rounds…"],
  ganga: ["Following the current…", "Gathering fragments…", "Listening for the living thread…"],
  signal: ["Reading the signal…", "Scanning the horizon…", "Separating signal from noise…"],
  forge: ["Heating the forge…", "Hammering the build…", "Tempering the machinery…"],
  social: ["Reading the room…", "Bending the trend…", "Preparing the signal…"],
  default: ["Working under the hood…", "Following the thread…", "Putting the pieces together…"],
} as const;

type PhraseFamily = keyof typeof PHRASES;

function phraseFamily(bot: Bot): PhraseFamily {
  const identity = `${bot.name} ${bot.title ?? ""}`.toLowerCase();
  if (/social|instagram|influenc|trend|content|pulse|echo/.test(identity)) return "social";
  if (bot.spirit === "sensei" || /sensei|coach|trainer/.test(identity)) return "sensei";
  if (bot.spirit === "mailman" || /mail|inbox|post/.test(identity)) return "mailman";
  if (bot.spirit === "ganga" || /ganga|editor|creative/.test(identity)) return "ganga";
  if (bot.spirit === "signal" || /signal|research|scout/.test(identity)) return "signal";
  if (bot.spirit === "forge" || /forge|build|engineer|develop/.test(identity)) return "forge";
  if (bot.spirit === "wormhole" || /watcher|chief/.test(identity)) return "watcher";
  return "default";
}

function stableIndex(value: string, length: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash % length;
}

/** Deterministic local personality: no model call and therefore no token cost. */
export function workingPhrase(bot: Bot, activityId: string): string {
  const phrases = PHRASES[phraseFamily(bot)];
  return phrases[stableIndex(`${bot.id}:${activityId}`, phrases.length)];
}
