// Auto mode: when a bot may answer its own permission requests.
//
// Two ways in — the bot is in auto mode, or the user pressed "Always
// allow" for that one tool — and one way out: anything that reads as
// destructive stops and asks a human anyway.
//
// The guard is deliberately tiny and literal. It is NOT a security
// boundary (an agent set on damage has a thousand spellings for `rm`);
// it is a "you probably didn't mean to hand THIS one over unattended"
// backstop for the obvious catastrophes. Real containment is the
// sandbox and the bot's own computer, not a regex.

const DESTRUCTIVE = [
  /\brm\s+(-[a-z]*\s+)*-[a-z]*[rf]/i, // rm -rf, rm -fr, rm -r -f
  /\bmkfs\b|\bdiskutil\s+erase|\bdd\s+[^|]*\bof=\/dev\//i,
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
  /:\(\)\s*\{.*\}\s*;?\s*:/, // fork bomb
  /\bgit\s+push\s+[^|]*--force(-with-lease)?\b|\bgit\s+reset\s+--hard\b/i,
  /\bDROP\s+(TABLE|DATABASE)\b|\bTRUNCATE\s+TABLE\b/i,
  /\bsudo\s+rm\b|\bchmod\s+-R\s+777\s+\//i,
];

// Actions that leave the machine toward other people or money, or destroy a
// record someone would miss. Full Auto keeps ordinary work moving but cards
// these social/financial/destructive edges unless the exact key was explicitly
// always-allowed by the user.
const OUTWARD = [
  /\b(send(s|ing)?|sent|repl(y|ies|ied|ying)|forward(s|ed|ing)?|respond(s|ed|ing)?)\b/i,
  /\b(post(s|ed|ing)?|publish(es|ed|ing)?|tweet(s|ed|ing)?|broadcast(s|ed|ing)?|shar(e|es|ed|ing))\b/i,
  /\b(pay(s|ing)?|paid|payment|purchas(e|es|ed|ing)|buy(s|ing)?|bought|subscrib(e|es|ed|ing)|transfer(s|red|ring)?|withdraw(s|ing|n)?|withdrew|checkout|donat(e|es|ed|ing)|mail(s|ed|ing)?|email(s|ed|ing)?)\b/i,
  /\b(delet(e|es|ed|ing)|trash(es|ed)?|destroy(s|ed|ing)?|eras(e|es|ed|ing)|wip(e|es|ed|ing)|drop(s|ped|ping)?)\b/i,
  /(^|[\s;&|(])(rm|rmdir|unlink|shred)\s/,
  /\bfind\b[^|;&]*\s-delete\b/,
];

function asWords(text: string): string {
  return text.replace(/_/g, " ");
}

// Not destructive, but exactly what you don't hand over unattended: a
// bot reading your keys is quiet, permanent, and unrecoverable.
const SENSITIVE = [
  /(^|[\s/"'])\.env(\.|$|["'\s])/i,
  /\.ssh\/|id_rsa|id_ed25519|authorized_keys/i,
  /\.aws\/credentials|\.netrc|\.npmrc|\.pypirc|\.docker\/config\.json/i,
  /security\s+find-(generic|internet)-password|\bkeychain\b/i,
  /\bcredentials?\.json\b|\bserviceaccount\b/i,
];

/** First matching pattern's source, so a verdict can NAME the rule that
 * made it — the decision log's whole value is "which rule", and deriving
 * the match a second time at the call site is how the log and the verdict
 * drift apart. */
function matchFirst(rules: RegExp[], text: string): string | null {
  for (const re of rules) if (re.test(text)) return re.source;
  return null;
}

export function looksSensitive(text: string): boolean {
  return matchFirst(SENSITIVE, text) !== null;
}

export function looksDestructive(text: string): boolean {
  return matchFirst(DESTRUCTIVE, text) !== null;
}

export function looksOutward(text: string): boolean {
  return matchFirst(OUTWARD, asWords(text)) !== null;
}

const READ_INTENT = /\b(read|list|get|fetch|find|search|query|inspect|check|view|retrieve|look\s*up|summari[sz]e|describe|status|show)\b/i;
const WRITE_INTENT = /\b(send|create|add|update|edit|delete|remove|write|publish|post|move|rename|append|insert|clear|modify|change|schedule|cancel|invite|upload|commit|push|approve|pay|purchase)\b/i;

const READ_PROGRAMS = new Set([
  "ls", "cat", "head", "tail", "wc", "pwd", "date", "which", "file", "stat",
  "du", "df", "ps", "lsof", "echo", "printf", "grep", "egrep", "fgrep", "rg",
  "find", "sort", "uniq", "cut", "tr", "diff", "shasum", "md5", "basename",
  "dirname", "uname", "whoami", "hostname", "uptime", "sw_vers", "true", "test",
  "[", "cd", "type", "column", "jq", "strings", "readlink", "realpath", "sleep", "wait",
]);
const READ_PROGRAM_ESCAPES: Record<string, RegExp> = {
  find: /\s-(delete|exec|execdir|ok|okdir|fprint\S*)\b/,
  sort: /\s(-o|--output)\b/,
};
const READ_GIT = new Set([
  "status", "log", "diff", "show", "shortlog", "blame", "ls-files", "rev-parse", "rev-list", "describe", "grep",
]);
const WRAPPER_WORDS = new Set(["do", "then", "time", "!", "{", "}", "while", "until", "if", "elif"]);
const CONTROL_SEGMENTS = new Set(["for", "case", "done", "fi", "esac", "else", "in"]);

/** Fail-closed program-level classifier for shell reads. English verb matching
 * cannot tell `ps` from `npm install`, nor a grep for the word "send" from a
 * send operation, so every executable segment has to be a known read shape. */
export function isReadOnlyShellCommand(command: string): boolean {
  if (!command.trim() || /\bsudo\b/.test(command) || /\s-delete\b/.test(command)) return false;
  const withoutSafeRedirects = command
    .replace(/\d?>&\d/g, " ")
    .replace(/\d?>>?\s*\/dev\/null/g, " ");
  if (/>/.test(withoutSafeRedirects)) return false;
  if (/curl[^\n;|&]*(\$\(|`)/.test(command)) return false;
  const flattened = command.replace(/\$\(/g, "; ").replace(/<\(/g, "; ").replace(/`/g, "; ");
  for (const segment of flattened.split(/\|\||&&|;|\||\n/)) {
    let words = segment.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    while (
      words.length &&
      (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]) || WRAPPER_WORDS.has(words[0].replace(/^\(+/, "")))
    ) {
      words = words.slice(1);
    }
    if (!words.length) continue;
    const first = words[0].replace(/^\(+/, "");
    if (CONTROL_SEGMENTS.has(first)) continue;
    const program = first.split("/").pop() ?? "";
    if (program === "git") {
      if (!words[1] || !READ_GIT.has(words[1])) return false;
      continue;
    }
    if (program === "curl") {
      if (/\s(-X|--request|-d|--data\S*|-F|--form|-T|--upload-file|-o|-O|--output|--remote-name)\b/.test(` ${words.join(" ")}`)) return false;
      continue;
    }
    if (program === "sed") {
      if (words.some((word) => /^-i/.test(word))) return false;
      continue;
    }
    if (!READ_PROGRAMS.has(program)) return false;
    const escape = READ_PROGRAM_ESCAPES[program];
    if (escape?.test(` ${words.join(" ")}`)) return false;
  }
  return true;
}

/** The key an "Always allow" remembers.
 *
 * A bare tool name is far too coarse for a command runner: remembering
 * "Bash" would hand the bot a permanent unattended shell, which is the
 * opposite of what someone pressing "always allow" on `git status`
 * intends. Command tools are therefore keyed by their program —
 * `Bash:git`, `Bash:npm` — so the grant is as narrow as the thing you
 * actually looked at. Computed once, server-side, and echoed back by the
 * client so the two sides can never disagree about what was granted. */
const COMMAND_TOOLS = new Set(["bash", "shell", "execute", "run_command", "computer_exec", "terminal"]);

function isCommandTool(tool: string): boolean {
  return COMMAND_TOOLS.has(tool.replace(/^mcp__[^_]+__/, "").toLowerCase());
}

/** Conservative read classification for policy reads and optional read-only
 * Auto mode. Command tools use the program classifier above. */
export function isReadOnlyRequest(tool: string, summary: string): boolean {
  if (isCommandTool(tool)) return isReadOnlyShellCommand(summary);
  const text = asWords(`${tool} ${summary}`);
  if (WRITE_INTENT.test(text)) return false;
  return READ_INTENT.test(text);
}

export function approvalKey(tool: string, summary: string, scope?: "local-computer"): string {
  const bare = tool.replace(/^mcp__[^_]+__/, "").toLowerCase();
  if (!COMMAND_TOOLS.has(bare)) return scope ? `${scope}:${tool}` : tool;
  // first bare word of the command, skipping env assignments and sudo
  const words = summary.trim().split(/\s+/);
  let i = 0;
  while (i < words.length && (/^[A-Z_][A-Z0-9_]*=/.test(words[i]) || words[i] === "sudo")) i += 1;
  const program = (words[i] ?? "").split("/").pop()?.replace(/[^\w.-]/g, "") ?? "";
  const key = program ? `${tool}:${program}` : tool;
  return scope ? `${scope}:${key}` : key;
}

export interface AutoApprover {
  autoApprove?: boolean;
  autoApproveReadsOnly?: boolean;
  alwaysAllow?: string[];
  /** Clearly read-only non-shell requests approve themselves unless this is
   * explicitly false. Never inherited by unattended turns. */
  silentReads?: boolean;
}

/** Why a verdict landed the way it did. `unattended-block` exists only in
 * contrast: a grant WOULD have fired, and the only thing that stopped it
 * was that nobody started this turn — the most audit-worthy card of all. */
export type AutoVerdictSource =
  | "always-allow"
  | "auto-mode"
  | "policy-read"
  | "unattended-block"
  | "local-computer-block"
  | "destructive-guard"
  | "sensitive-guard"
  | "outward-guard"
  | "read-only-guard"
  | "no-grant";

export interface AutoVerdict {
  /** Chip text when the bot may answer itself, null when a human decides.
   * The string becomes the chip in the transcript, so an auto-approved
   * action is never invisible. */
  approve: string | null;
  source: AutoVerdictSource;
  /** What identifies the rule that decided: the matched regex (guards) or
   * the granted key (always-allow, and unattended-block over one). Auto
   * mode has no narrower identity than the mode itself, so it carries none. */
  rule?: string;
}

/** The verdict AND its provenance. The decision itself is unchanged from
 * autoDecision below — this exists so the decision log can record which
 * rule decided without the call site re-deriving (and eventually
 * mis-deriving) the match. */
export function autoVerdict(
  bot: AutoApprover,
  tool: string,
  summary: string,
  context?: {
    /** the turn was started by an outside event, with nobody at the keyboard */
    unattended?: boolean;
    /** the request controls the user's active desktop */
    scope?: "local-computer";
  },
): AutoVerdict {
  const destructive = matchFirst(DESTRUCTIVE, summary) ?? matchFirst(DESTRUCTIVE, tool);
  const sensitive = destructive ? null : matchFirst(SENSITIVE, summary);
  const readOnly = isReadOnlyRequest(tool, summary);
  const outward = destructive || sensitive || readOnly
    ? null
    : (matchFirst(OUTWARD, asWords(summary)) ?? matchFirst(OUTWARD, asWords(tool)));
  const readOnlyBlocked = Boolean(bot.autoApprove && bot.autoApproveReadsOnly && !readOnly);
  const key = approvalKey(tool, summary, context?.scope);
  const grant =
    destructive || sensitive
      ? null
      : bot.alwaysAllow?.includes(key)
        ? { approve: `auto-approved ${key} (always allowed)`, source: "always-allow" as const, rule: key }
        : bot.autoApprove
          ? readOnlyBlocked || outward
            ? null
            : { approve: `auto-approved ${tool}`, source: "auto-mode" as const, rule: undefined }
          : null;
  const policyRead =
    !destructive &&
    !sensitive &&
    !outward &&
    !grant &&
    bot.silentReads !== false &&
    !isCommandTool(tool) &&
    readOnly
      ? { approve: `auto-approved ${tool} (read-only)`, source: "policy-read" as const, rule: "read-only request" }
      : null;
  if (context?.unattended) {
    if (grant) return { approve: null, source: "unattended-block", rule: grant.rule };
    if (policyRead) return { approve: null, source: "unattended-block", rule: policyRead.rule };
    if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
    if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
    if (outward) return { approve: null, source: "outward-guard", rule: outward };
    return { approve: null, source: "no-grant" };
  }
  if (context?.scope === "local-computer" && !bot.autoApprove) {
    if (grant) return { approve: null, source: "local-computer-block", rule: grant.rule };
    if (policyRead) return { approve: null, source: "local-computer-block", rule: policyRead.rule };
    if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
    if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
    if (outward) return { approve: null, source: "outward-guard", rule: outward };
    return { approve: null, source: "no-grant" };
  }
  if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
  if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
  if (grant) return { approve: grant.approve, source: grant.source, rule: grant.rule };
  if (policyRead) return { approve: policyRead.approve, source: policyRead.source, rule: policyRead.rule };
  if (readOnlyBlocked) return { approve: null, source: "read-only-guard", rule: "read-only mode" };
  if (outward) return { approve: null, source: "outward-guard", rule: outward };
  return { approve: null, source: "no-grant" };
}

/** Why this request may be answered without the human, or null to ask. */
export function autoDecision(
  bot: AutoApprover,
  tool: string,
  summary: string,
  context?: {
    /** the turn was started by an outside event, with nobody at the keyboard */
    unattended?: boolean;
    /** the request controls the user's active desktop */
    scope?: "local-computer";
  },
): string | null {
  return autoVerdict(bot, tool, summary, context).approve;
}
