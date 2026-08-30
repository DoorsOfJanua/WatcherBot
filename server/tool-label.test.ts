import { describe, expect, it } from "vitest";

import { approvalAsk, approvalExplanation, humanCardSubtitle, humanErrorMessage, looksTechnicalInline, toolChipLabel } from "../shared/tool-label.ts";

describe("toolChipLabel", () => {
  it("maps bare tool names to phrases with the raw name as detail", () => {
    expect(toolChipLabel("Bash")).toEqual({ label: "Ran a command", detail: "Bash" });
    expect(toolChipLabel("Read")).toEqual({ label: "Read a file", detail: "Read" });
    expect(toolChipLabel("screenshot")).toEqual({ label: "Looked at the screen", detail: "screenshot" });
  });

  it("translates backend errors and keeps their evidence as detail", () => {
    expect(humanErrorMessage("Prepare the Cua desktop image with Driver 0.20.0 (App Settings → Local VM)")).toEqual({
      message: "This computer is not ready yet. Open Settings → Local VM and choose Prepare.",
      detail: "Prepare the Cua desktop image with Driver 0.20.0 (App Settings → Local VM)",
    });
    expect(humanErrorMessage("OAuth 401 from Gmail").message).toMatch(/connected again/);
    expect(looksTechnicalInline("gmail:nils@example.com:1a0314d731dc5a25")).toBe(true);
    expect(looksTechnicalInline("important phrase")).toBe(false);
  });

  it("classifies full command lines by the command actually run", () => {
    expect(toolChipLabel("git status --short | head -20").label).toBe("Worked with git");
    expect(toolChipLabel("rg -n 'MAX_COMMS_DEPTH' server/").label).toBe("Searched the code");
    expect(toolChipLabel("cd /Users/janua/Projects/X && pnpm test --run").label).toBe("Ran tests");
    expect(toolChipLabel("FOO=1 node script.mjs").label).toBe("Ran a script");
    expect(toolChipLabel("/usr/bin/python3 -m json.tool x.json").label).toBe("Ran a script");
    expect(toolChipLabel("frobnicate --wat").label).toBe("Ran a command");
  });

  it("keeps the raw command as bounded detail", () => {
    const long = `git log ${"x".repeat(400)}`;
    const chip = toolChipLabel(long);
    expect(chip.label).toBe("Worked with git");
    expect(chip.detail!.length).toBeLessThanOrEqual(201);
    expect(chip.detail!.startsWith("git log")).toBe(true);
  });

  it("strips mcp prefixes and names known bridges", () => {
    expect(toolChipLabel("mcp__calendar__calendar_list_events").label).toBe("Checked the calendar");
    expect(toolChipLabel("mcp__agents__list_bots").label).toBe("Checked which teammates are around");
  });

  it("names connector actions by app", () => {
    expect(toolChipLabel("GMAIL_FETCH_EMAILS").label).toBe("Worked with Gmail");
    expect(toolChipLabel("NOTION_CREATE_PAGE").label).toBe("Worked with Notion");
  });

  it("keeps harness diagnostics behind a human status label", () => {
    expect(toolChipLabel("error: engine crashed")).toEqual({ label: "Needs attention", detail: "error: engine crashed" });
    expect(toolChipLabel("auto-approved: Bash")).toEqual({ label: "Approved automatically", detail: "auto-approved: Bash" });
    expect(toolChipLabel("auto-approved Bash:cd (always allowed)")).toEqual({
      label: "Approved automatically",
      detail: "auto-approved Bash:cd (always allowed)",
    });
  });

  it("keeps unknown short names legible without inventing detail", () => {
    expect(toolChipLabel("LSP")).toEqual({ label: "LSP" });
  });

  it("is deterministic", () => {
    const raw = "cd /a && FOO=bar pnpm vitest run --silent";
    expect(toolChipLabel(raw)).toEqual(toolChipLabel(raw));
  });
});

describe("approvalAsk", () => {
  it("re-voices command asks into the present with a specific gist", () => {
    expect(approvalAsk("Bash", "git push origin main")).toEqual({ ask: "run a command", gist: "work with git" });
    expect(approvalAsk("Bash", "frobnicate --wat")).toEqual({ ask: "run a command" });
    expect(approvalAsk("shell", "pnpm test --run")).toEqual({ ask: "run a command", gist: "run tests" });
  });

  it("shows a short path for file tools", () => {
    expect(approvalAsk("Read", "/Users/janua/Projects/X/server/index.ts")).toEqual({
      ask: "read a file",
      gist: "…/server/index.ts",
    });
    expect(approvalAsk("Edit", "notes.md")).toEqual({ ask: "edit a file", gist: "notes.md" });
  });

  it("names email, connectors, calendar writes, and mcp bridges", () => {
    expect(approvalAsk("email.send", "To: x Subject: y").ask).toBe("send this exact email");
    expect(approvalAsk("GMAIL_SEND_EMAIL", "…").ask).toBe("work with Gmail");
    expect(approvalAsk("mcp__calendar__calendar_create_event", "{}").ask).toBe("add a calendar event");
    expect(approvalAsk("mcp__weird-bridge__do_thing", "x").ask).toBe("use weird-bridge");
  });

  it("names the human action behind colon-style MCP approvals", () => {
    expect(approvalExplanation(
      "mcp:replyguy",
      'Allow the replyguy MCP server to run tool "post_draft"?',
    )).toMatchObject({ what: "post the approved X reply", sensitive: true });
    expect(approvalExplanation(
      "mcp:replyguy",
      'Allow the replyguy MCP server to run tool "recover_error_wall"?',
    ).what).toBe("recover ReplyGuy from an X error page");
  });

  it("keeps backend subtitles out of ordinary question cards", () => {
    expect(humanCardSubtitle('{"tool":"Bash","command":"rm -rf build"}')).toBe("Choose how you want to continue.");
    expect(humanCardSubtitle("Which direction should we take?")).toBe("Which direction should we take?");
  });

  it("never softens a delete, wherever it hides in the line", () => {
    const destructive = [
      "rm -rf build",
      "make clean && rm -rf build",
      "find . -name '*.log' -delete",
      "git reset --hard origin/main",
      "git push origin main --force",
      "cd /a && git clean -fd",
      "docker system prune -f",
      "npm uninstall left-pad",
    ];
    for (const command of destructive) {
      expect(approvalAsk("Bash", command)).toEqual({ ask: "run a command", gist: "can delete things" });
    }
    // and benign look-alikes stay specific
    expect(approvalAsk("Bash", "git push origin main")).toEqual({ ask: "run a command", gist: "work with git" });
    expect(approvalAsk("Bash", "grep -rn 'formula' src/")).toEqual({ ask: "run a command", gist: "search the code" });
    expect(approvalAsk("Bash", "npm install left-pad").gist).toBe("run a package task");
  });

  it("falls back to reading the summary when the tool name is missing", () => {
    expect(approvalAsk(undefined, "git status --short")).toEqual({ ask: "run a command", gist: "work with git" });
    expect(approvalAsk(undefined, "").ask).toBe("do something");
  });
});
