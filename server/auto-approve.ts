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

// Outward: the action leaves this machine toward other people or money —
// sending, publishing, paying — or destroys a record someone would miss.
// These card even in full auto mode, because the cost of a wrong one is
// social or financial, not technical. An explicit always-allow the user
// pressed on the exact key still wins (same precedence as read-only mode:
// a mode narrows the blanket, never a grant), so grants can never go dead.
// Matched against tool name AND summary — `send_message` with a friendly
// summary is still a send.
// Tense-tolerant on purpose: drivers summarize in whatever tense they like
// ("Sending the invoice", "Posted the update"), and a guard that only knows
// the imperative stem waves those through. A request that already classifies
// as read-only skips this list entirely — that is what keeps "List replies
// posted since yesterday" from carding — and a genuinely outward TOOL still
// lands here because its own name ("send_message") reads as write intent.
const OUTWARD = [
  /\b(send(s|ing)?|sent|repl(y|ies|ied|ying)|forward(s|ed|ing)?|respond(s|ed|ing)?)\b/i,
  /\b(post(s|ed|ing)?|publish(es|ed|ing)?|tweet(s|ed|ing)?|broadcast(s|ed|ing)?|shar(e|es|ed|ing))\b/i,
  /\b(pay(s|ing)?|paid|payment|purchas(e|es|ed|ing)|buy(s|ing)?|bought|subscrib(e|es|ed|ing)|transfer(s|red|ring)?|withdraw(s|ing|n)?|withdrew|checkout|donat(e|es|ed|ing)|mail(s|ed|ing)?|email(s|ed|ing)?)\b/i,
  /\b(delet(e|es|ed|ing)|trash(es|ed)?|destroy(s|ed|ing)?|eras(e|es|ed|ing)|wip(e|es|ed|ing)|drop(s|ped|ping)?)\b/i,
  // plain rm is not in the DESTRUCTIVE list (that one blocks even grants);
  // it belongs here: "deleting" always cards in auto mode (Janua ruling
  // 2026-08-24), but an explicit always-allow the user pressed still wins.
  /(^|[\s;&|(])(rm|rmdir|unlink|shred)\s/,
  /\bfind\b[^|;&]*\s-delete\b/,
];

/** Tool names spell their verbs with underscores (mcp__gmail__send_message),
 * and `\b` never fires between two word characters — so a boundary-anchored
 * verb list is blind to the codebase's own naming convention. Classification
 * therefore reads underscores as spaces. The shell-targeted guards above
 * (DESTRUCTIVE, SENSITIVE) keep the raw text: in a command line an
 * underscore is real syntax, and softening it would turn a harmless
 * `drop_table.sql` filename into a DROP TABLE match. */
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

// ── shell read classifier ───────────────────────────────────────────────
// A shell command's read-ness cannot come from English words: `ps`, `lsof`
// and `curl -s 127.0.0.1/...` carry no read verb, while a grep FOR the
// word "send" carries a false write verb. Classify by program instead:
// every simple command in the line (split on && || ; | and newlines, with
// $(…)/backtick substitution bodies classified as commands too) must be a
// known read-only program, and nothing may redirect to a file. Fail closed:
// anything unparsed or unlisted is not a read.
const READ_PROGRAMS = new Set([
  "ls", "cat", "head", "tail", "wc", "pwd", "date", "which", "file", "stat",
  "du", "df", "ps", "lsof", "echo", "printf", "grep", "egrep", "fgrep", "rg",
  "find", "sort", "uniq", "cut", "tr", "diff", "shasum", "md5", "basename",
  "dirname", "uname", "whoami", "hostname", "uptime", "sw_vers", "true",
  "test", "[", "cd", "type", "column", "jq", "strings",
  "readlink", "realpath", "sleep", "wait",
]);
// listed programs that can still execute or write through their own flags —
// `env cmd` runs cmd, `find -exec` runs anything, `sort -o` writes a file
const READ_PROGRAM_ESCAPES: Record<string, RegExp> = {
  find: /\s-(delete|exec|execdir|ok|okdir|fprint\S*)\b/,
  sort: /\s(-o|--output)\b/,
};
// git subcommands that only inspect; branch/tag/remote/stash all have
// mutating spellings, so they stay out.
const READ_GIT = new Set([
  "status", "log", "diff", "show", "shortlog", "blame", "ls-files",
  "rev-parse", "rev-list", "describe", "grep",
]);
// shell keywords that wrap another command — strip and classify the rest
const WRAPPER_WORDS = new Set(["do", "then", "time", "!", "{", "}", "while", "until", "if", "elif"]);
// segment-level keywords whose own line executes nothing (loop headers, closers)
const CONTROL_SEGMENTS = new Set(["for", "case", "done", "fi", "esac", "else", "in"]);

export function isReadOnlyShellCommand(command: string): boolean {
  if (!command.trim()) return false;
  if (/\bsudo\b/.test(command)) return false;
  if (/\s-delete\b/.test(command)) return false; // find -delete
  // redirects: writing anywhere but /dev/null (or fd merges) is a write
  const withoutSafeRedirects = command
    .replace(/\d?>&\d/g, " ")
    .replace(/\d?>>?\s*\/dev\/null/g, " ");
  if (/>/.test(withoutSafeRedirects)) return false;
  // curl with a substitution anywhere in its arguments is the exfil shape
  // (`curl "url?data=$(cat file)"`): the inner command classifies as a read
  // on its own, so the outer curl must refuse instead
  if (/curl[^\n;|&]*(\$\(|`)/.test(command)) return false;
  // substitution bodies become segments of their own: `echo $(rm x)` must
  // classify the rm, and `cat <(curl ...)` must classify the curl. Closing
  // parens/backticks just end up as harmless trailing characters on the
  // last argument. (`>(...)` needs no case here — its `>` already failed
  // the redirect check above.)
  const flattened = command.replace(/\$\(/g, "; ").replace(/<\(/g, "; ").replace(/`/g, "; ");
  const segments = flattened.split(/\|\||&&|;|\||\n/);
  for (const segment of segments) {
    let words = segment.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    // env assignments and wrapper keywords precede the real program
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
      // default curl is a GET; any flag that uploads, posts, or writes a
      // file makes it a write
      if (/\s(-X|--request|-d|--data\S*|-F|--form|-T|--upload-file|-o|-O|--output|--remote-name)\b/.test(` ${words.join(" ")}`)) return false;
      continue;
    }
    if (program === "sed") {
      // sed prints to stdout unless -i edits in place
      if (words.some((w) => /^-i/.test(w))) return false;
      continue;
    }
    if (!READ_PROGRAMS.has(program)) return false;
    const escape = READ_PROGRAM_ESCAPES[program];
    if (escape && escape.test(` ${words.join(" ")}`)) return false;
  }
  return true;
}

/** Conservative classification for the optional read-only auto mode. */
export function isReadOnlyRequest(tool: string, summary: string): boolean {
  // shell commands classify by program, not by English words in the text
  if (isCommandTool(tool)) return isReadOnlyShellCommand(summary);
  // asWords: `mcp__gcal__list_events` must read as the word "list", see above
  const text = asWords(`${tool} ${summary}`);
  if (WRITE_INTENT.test(text)) return false;
  return READ_INTENT.test(text);
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
  /** Auto mode may be limited to clearly read-only requests. */
  autoApproveReadsOnly?: boolean;
  alwaysAllow?: string[];
  /** Policy reads: clearly read-only requests approve themselves for every
   * bot, auto mode or not. On unless explicitly set to false. Never covers
   * command tools (a shell is never provably read-only), never covers
   * anything the sensitive or outward guards match, and never fires on an
   * unattended turn. */
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
  // the guards outrank the grants, so an "always allow" can never widen
  // into them
  const destructive = matchFirst(DESTRUCTIVE, summary) ?? matchFirst(DESTRUCTIVE, tool);
  const sensitive = destructive ? null : matchFirst(SENSITIVE, summary);
  const readOnly = isReadOnlyRequest(tool, summary);
  const outward = destructive || sensitive || readOnly
    ? null
    : (matchFirst(OUTWARD, asWords(summary)) ?? matchFirst(OUTWARD, asWords(tool)));
  const readOnlyBlocked = Boolean(bot.autoApprove && bot.autoApproveReadsOnly && !readOnly);
  // The grant is computed even when a hard block will refuse it: the row
  // worth auditing is "this WOULD have auto-approved, and only the block
  // stood in the way", which cannot be told apart from an ordinary
  // "nobody granted this" card without knowing both halves.
  const key = approvalKey(tool, summary, context?.scope);
  const grant =
    destructive || sensitive
      ? null
      : bot.alwaysAllow?.includes(key)
        ? { approve: `auto-approved ${key} (always allowed)`, source: "always-allow" as const, rule: key }
      : bot.autoApprove
          // outward narrows the blanket auto-approve exactly the way
          // read-only mode does; the explicit always-allow branch above is
          // deliberately not narrowed by either.
          ? readOnlyBlocked || outward
            ? null
            : { approve: `auto-approved ${tool}`, source: "auto-mode" as const, rule: undefined }
          : null;
  // Policy reads: a clearly read-only request approves itself for any bot.
  // Computed like `grant` (before the hard blocks) so an unattended card can
  // audit as "this WOULD have read silently". Command tools never qualify —
  // a shell command's read-ness is a guess, and a wrong guess is a shell.
  const policyRead =
    !destructive && !sensitive && !outward && !grant
    && bot.silentReads !== false
    && !isCommandTool(tool)
    && readOnly
      ? { approve: `auto-approved ${tool} (read-only)`, source: "policy-read" as const, rule: "read-only request" }
      : null;
  if (context?.unattended) {
    // Auto mode is something a person switched on for turns they are present
    // for. A webhook turn begins with nobody watching, on a payload someone
    // else wrote, so it does not inherit that decision — the guard above is a
    // pattern list its own comment calls "not a security boundary", and it
    // must not stand in for a human at 3am. A guard that would have carded
    // anyway keeps its own name; the block is only the story when it is the
    // thing that changed the outcome.
    if (grant) return { approve: null, source: "unattended-block", rule: grant.rule };
    if (policyRead) return { approve: null, source: "unattended-block", rule: policyRead.rule };
    if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
    if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
    if (outward) return { approve: null, source: "outward-guard", rule: outward };
    return { approve: null, source: "no-grant" };
  }
  if (context?.scope === "local-computer" && !bot.autoApprove) {
    // Host control is not covered by a remembered always-allow grant, and
    // not by policy reads either: "observe the screen" reads whatever is on
    // it, which is nothing like listing a calendar.
    // After the Auto-on-this-computer warning, unclassified GUI actions
    // (click/type) may auto-approve; destructive/sensitive still card.
    if (grant) return { approve: null, source: "local-computer-block", rule: grant.rule };
    if (policyRead) return { approve: null, source: "local-computer-block", rule: policyRead.rule };
    if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
    if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
    if (outward) return { approve: null, source: "outward-guard", rule: outward };
    return { approve: null, source: "no-grant" };
  }
  if (destructive) return { approve: null, source: "destructive-guard", rule: destructive };
  if (sensitive) return { approve: null, source: "sensitive-guard", rule: sensitive };
  // An explicit always-allow outranks read-only mode: the mode narrows the
  // blanket auto-approve, not a grant the user pressed on this exact key.
  // (Only an always-allow grant can reach here with readOnlyBlocked set —
  // the auto-mode grant was already nulled by it above.) Returning the
  // guard first was why a bot in read-only auto mode re-carded a tool the
  // user had already Always-allowed, on every single call.
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
