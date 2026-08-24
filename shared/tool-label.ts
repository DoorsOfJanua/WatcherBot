// Human labels for tool activity — chips and approval cards.
//
// Drivers put whatever they have into a tool item's title: the Claude CLI
// sends a bare tool name ("Bash"), codex sends the full shell command, ACP
// drivers send the command truncated to 80 chars. Rendering that verbatim
// fills the conversation with argv noise. This module maps any raw title to
// a short pre-chosen sentence, deterministically — no model call, same input
// same label. The raw title survives in `detail` so the UI can reveal it on
// hover and the harness can keep matching on it; the full command and output
// always remain in the Inspector.
//
// Lives in shared/ because both sides speak it: the server labels chips as
// events arrive, and the client translates approval asks into plain words.

export interface ToolChipLabel {
  /** short human phrase shown in the chip */
  label: string;
  /** the raw title when it differs from the label (tooltip / matching) */
  detail?: string;
}

const DETAIL_MAX_CHARS = 200;

/** Bare tool names (no spaces) → phrase. Checked case-insensitively after
 * any mcp__<server>__ prefix is stripped. */
const NAME_LABELS: Array<[RegExp, string]> = [
  [/^(bash|shell|terminal|run_command|execute|computer_exec)$/i, "Ran a command"],
  [/^(read|read_file|view|open_file)$/i, "Read a file"],
  [/^(write|create_file|write_file)$/i, "Wrote a file"],
  [/^(edit|apply_patch|str_replace|multiedit|multi_edit|notebook_edit)$/i, "Edited a file"],
  [/^(grep|search|glob|find|ls|list_dir|codebase_search)$/i, "Searched files"],
  [/^(web_?search)$/i, "Searched the web"],
  [/^(web_?fetch|fetch)$/i, "Read a web page"],
  [/^(todo_?write|todo_?read|update_plan)$/i, "Updated the plan"],
  [/^(task|agent|dispatch_agent)$/i, "Ran a helper agent"],
  [/^screenshot$/i, "Looked at the screen"],
  [/^(click|type_text|press_key|scroll|computer_batch|open_url|computer)$/i, "Used the computer"],
  [/^list_bots$/i, "Checked which teammates are around"],
  [/^ask_bot$/i, "Asked a teammate"],
  [/^delegate_bot$/i, "Handed work to a teammate"],
  [/^propose_email_draft$/i, "Drafted an email"],
  [/^calendar_(status|list_calendars|list_events)$/i, "Checked the calendar"],
  [/^calendar_create_event$/i, "Added a calendar event"],
  [/^calendar_update_event$/i, "Changed a calendar event"],
  [/^calendar_delete_event$/i, "Removed a calendar event"],
];

/** First word of a shell command → phrase. */
const COMMAND_LABELS: Array<[RegExp, string]> = [
  [/^git$/, "Worked with git"],
  [/^(pytest|vitest|jest|playwright|mocha|tape)$/, "Ran tests"],
  [/^(npm|pnpm|yarn|bun|npx|pnpx)$/, "Ran a package task"],
  [/^(node|python3?|deno|ruby|php|perl)$/, "Ran a script"],
  [/^(grep|rg|ag|ack)$/, "Searched the code"],
  [/^(ls|find|tree|du|stat|wc|file|which|dirname|basename)$/, "Looked through files"],
  [/^(cat|head|tail|less|more|bat)$/, "Read a file"],
  [/^(curl|wget|http|https)$/, "Fetched from the web"],
  [/^(mkdir|cp|mv|rm|touch|chmod|chown|ln|tar|zip|unzip|rsync)$/, "Organized files"],
  [/^(make|cargo|go|tsc|swift|swiftc|xcodebuild|gradle|mvn)$/, "Built the project"],
  [/^(kill|pkill|pgrep|ps|top|lsof)$/, "Checked running processes"],
  [/^open$/, "Opened something on the Mac"],
  [/^osascript$/, "Ran a Mac automation"],
  [/^(brew|apt|apt-get|pip|pip3|gem)$/, "Installed or checked a package"],
  [/^(echo|printf|date|pwd|env|export|sleep|true|test)$/, "Ran a command"],
];

/** Composio/connector actions arrive as APP_ACTION_NAME. */
const CONNECTOR_TOOL = /^([A-Z][A-Z0-9]+)_[A-Z0-9_]+$/;

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** The command a shell line actually runs: skip `cd x && `, env prefixes,
 * sudo/nohup wrappers, then take the first word's basename. */
function commandWord(command: string): string {
  let rest = command.trim();
  for (let hops = 0; hops < 4; hops++) {
    const cd = rest.match(/^cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*(?:&&|;)\s*([\s\S]*)$/);
    if (!cd) break;
    rest = cd[1].trim();
  }
  const words = rest.split(/\s+/);
  let index = 0;
  while (
    index < words.length &&
    (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]) || /^(sudo|nohup|command|exec|time)$/.test(words[index]))
  ) {
    index++;
  }
  const first = words[index] ?? "";
  return (first.split("/").pop() ?? "").toLowerCase();
}

function commandLabel(command: string): string {
  const word = commandWord(command);
  for (const [pattern, label] of COMMAND_LABELS) {
    if (pattern.test(word)) {
      // package runners doing test/build deserve the more specific phrase
      if (/^(npm|pnpm|yarn|bun)$/.test(word)) {
        if (/\b(test|vitest|jest)\b/.test(command)) return "Ran tests";
        if (/\b(build|typecheck|tsc|lint)\b/.test(command)) return "Built and checked the project";
      }
      return label;
    }
  }
  return "Ran a command";
}

/** Deterministic label for a raw tool title. Harness-authored chips
 * ("error:...", "auto-approved:...") pass through untouched. */
export function toolChipLabel(raw: string): ToolChipLabel {
  const title = raw.trim();
  if (!title) return { label: "Ran a tool" };
  if (/^(error|auto-approved):/i.test(title)) return { label: title };

  // mcp__server__tool → try the tool part, else name the server
  const mcp = title.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
  const name = mcp ? mcp[2] : title;

  if (!/\s/.test(name)) {
    for (const [pattern, label] of NAME_LABELS) {
      if (pattern.test(name)) return withDetail(label, title);
    }
    const connector = name.match(CONNECTOR_TOOL);
    if (connector) return withDetail(`Worked with ${titleCase(connector[1])}`, title);
    if (mcp) return withDetail(`Used ${mcp[1]}`, title);
    // an unknown bare tool name is already short and legible — keep it
    return { label: title.slice(0, 80) };
  }

  // whitespace means a real command line
  return withDetail(commandLabel(name), title);
}

function withDetail(label: string, raw: string): ToolChipLabel {
  if (raw === label) return { label };
  return { label, detail: raw.length > DETAIL_MAX_CHARS ? `${raw.slice(0, DETAIL_MAX_CHARS)}…` : raw };
}

// ---------------------------------------------------------------------------
// Approval asks: "Poppy wants to <ask>". Chips describe what already
// happened (past tense); an approval describes what the bot is ASKING to
// do, so the same tables get re-voiced into the present.

export interface ApprovalAsk {
  /** present-tense verb phrase completing "wants to …" */
  ask: string;
  /** short human hint of the target: "work with git", "…/server/index.ts" */
  gist?: string;
}

/** Chip labels whose word-by-word rewrite would read badly. */
const ASK_OVERRIDES: Record<string, string> = {
  "Installed or checked a package": "install or check a package",
  "Built and checked the project": "build and check the project",
};

const PRESENT_VERB: Record<string, string> = {
  Ran: "run",
  Read: "read",
  Wrote: "write",
  Edited: "edit",
  Searched: "search",
  Updated: "update",
  Handed: "hand",
  Asked: "ask",
  Checked: "check",
  Looked: "look",
  Used: "use",
  Worked: "work",
  Drafted: "draft",
  Fetched: "fetch",
  Organized: "organize",
  Built: "build",
  Opened: "open",
  Added: "add",
  Changed: "change",
  Removed: "remove",
};

function presentTense(label: string): string {
  const override = ASK_OVERRIDES[label];
  if (override) return override;
  const [first, ...rest] = label.split(" ");
  const verb = PRESENT_VERB[first];
  if (!verb) return label.charAt(0).toLowerCase() + label.slice(1);
  return [verb, ...rest].join(" ");
}

/** "/Users/janua/Projects/X/server/index.ts" → "…/server/index.ts" */
function shortPath(value: string): string | undefined {
  if (!/[\\/]/.test(value)) return value.length <= 60 ? value : undefined;
  const parts = value.split(/[\\/]/).filter(Boolean);
  const tail = parts.slice(-2).join("/");
  return parts.length > 2 ? `…/${tail}` : tail;
}

/** Delete-capable tokens ANYWHERE in a command line — not just the first
 * word, so `make clean && rm -rf build` cannot headline as "build the
 * project". High-confidence destroyers only; the raw command is always
 * one line below for everything else. */
const DESTRUCTIVE_COMMAND = new RegExp(
  [
    String.raw`(?:^|[\s;&|(])rm(?:\s|$)`,
    String.raw`(?:^|[\s;&|(])(?:rmdir|unlink|shred)\b`,
    String.raw`\bfind\b[^|;&]*\s-delete\b`,
    String.raw`\bgit\s+(?:clean\b|reset\s+--hard\b|branch\s+-D\b)`,
    String.raw`\bgit\s+push\b[^|;&]*\s(?:--force|-f)\b`,
    String.raw`\b(?:docker|podman)\s+(?:system\s+prune|volume\s+rm|rmi?)\b`,
    String.raw`\b(?:npm|pnpm|yarn|bun|brew|pip3?|gem|apt(?:-get)?)\s+(?:uninstall|remove|rm|purge)\b`,
    String.raw`\bdd\s+[^|;&]*\bof=`,
    String.raw`\bmkfs\b`,
    String.raw`\btruncate\s+-s\b`,
  ].join("|"),
);

/** A command approval must never soften a delete into "organize files" or
 * hide it behind a benign leading command — the person is deciding whether
 * to ALLOW it. */
function commandAsk(text: string): ApprovalAsk {
  const ask = "run a command";
  if (DESTRUCTIVE_COMMAND.test(text)) return { ask, gist: "can delete things" };
  const specific = presentTense(commandLabel(text));
  return specific === ask ? { ask } : { ask, gist: specific };
}

/** Plain words for a permission ask, from the tool name plus the raw
 * summary (command line, path, …). Deterministic, same tables as chips. */
export function approvalAsk(tool: string | undefined, summary: string): ApprovalAsk {
  const raw = (tool ?? "").trim();
  const text = summary.trim();
  if (raw === "email.send") return { ask: "send this exact email" };

  const mcp = raw.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
  const name = mcp ? mcp[2] : raw;

  if (name) {
    for (const [pattern, label] of NAME_LABELS) {
      if (pattern.test(name)) {
        const ask = presentTense(label);
        if (ask === "run a command" && /\s/.test(text)) return commandAsk(text);
        // file tools carry a bare path — a short version is the honest gist
        if (/a file$/.test(ask) && text && !/\s/.test(text)) return { ask, gist: shortPath(text) };
        return { ask };
      }
    }
    const connector = name.match(CONNECTOR_TOOL);
    if (connector) return { ask: `work with ${titleCase(connector[1])}` };
    if (mcp) return { ask: `use ${mcp[1]}` };
    return { ask: `use ${name.replace(/_/g, " ").slice(0, 60)}` };
  }

  // no tool name at all — fall back to reading the summary as a command
  if (/\s/.test(text)) return commandAsk(text);
  return { ask: "do something" };
}
