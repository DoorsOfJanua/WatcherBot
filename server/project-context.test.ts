import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadProjectRegistry, matchingProjects, ProjectContextProvider } from "./project-context.ts";

const roots: string[] = [];

interface FixtureProject {
  id: string;
  name: string;
  aliases: string[];
  statePath: string;
  critical: boolean;
}

function fixture(projects?: FixtureProject[]) {
  const root = mkdtempSync(join(tmpdir(), "myagent-project-context-"));
  roots.push(root);
  const statePath = join(root, "STATE.md");
  const charterPath = join(root, "CANONICAL.md");
  const registryPath = join(root, "project-registry.json");
  const bindingsPath = join(root, "project-bindings.ndjson");
  writeFileSync(statePath, "# Farmada\n\nThree questionnaires exist. Next: draft Charlie reply.\n");
  writeFileSync(charterPath, "# Farmada charter\n\nStable artifact: farmada-questionnaires.\n");
  writeFileSync(
    registryPath,
    JSON.stringify({
      version: 1,
      projects: projects ?? [
        {
          id: "farmada",
          name: "Farmada",
          aliases: ["farmada vragenlijst", "farmada questionnaires"],
          statePath,
          charterPath,
          workspace: root,
          ownerAgentIds: ["mailroom"],
          accent: "#ffb454",
          critical: true,
        },
      ],
    }),
  );
  return { root, statePath, charterPath, registryPath, bindingsPath };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project context", () => {
  it("binds on an explicit alias and reloads that project for a later pronoun-only turn", () => {
    const files = fixture();
    const provider = new ProjectContextProvider(files);

    const first = provider.forTurn("thread-1", "Please open the Farmada vragenlijst work");
    expect(first.projectId).toBe("farmada");
    expect(first.newlyBound).toBe(true);
    expect(first.systemPrompt).toContain("Three questionnaires exist");
    expect(first.systemPrompt).toContain("Stable artifact: farmada-questionnaires");
    expect(first.systemPrompt).toContain("shared across Telegram, MyAgentRoom, Claude CLI and Codex");
    expect(first.systemPrompt).toContain("zero-result or failed search must never erase this state");

    const continued = provider.forTurn("thread-1", "continue");
    expect(continued.projectId).toBe("farmada");
    expect(continued.newlyBound).toBe(false);
    expect(continued.systemPrompt).toContain("draft Charlie reply");
  });

  it("survives a provider restart because the binding log is append-only on disk", () => {
    const files = fixture();
    new ProjectContextProvider(files).forTurn("thread-restart", "Farmada");

    const afterRestart = new ProjectContextProvider(files).forTurn("thread-restart", "what next?");
    expect(afterRestart.projectName).toBe("Farmada");
    const events = readFileSync(files.bindingsPath, "utf8").trim().split("\n");
    expect(events).toHaveLength(1);
  });

  it("reloads STATE.md on every turn instead of caching stale project truth", () => {
    const files = fixture();
    const provider = new ProjectContextProvider(files);
    provider.forTurn("thread-live", "Farmada");
    writeFileSync(files.statePath, "# Farmada\n\nUPDATED NEXT ACTION\n");
    expect(provider.forTurn("thread-live", "continue").systemPrompt).toContain("UPDATED NEXT ACTION");
  });

  it("does not bind substrings or unrelated conversations", () => {
    const files = fixture();
    const registry = loadProjectRegistry(files.registryPath);
    expect(matchingProjects("The old farm database is slow", registry)).toEqual([]);
    expect(new ProjectContextProvider(files).forTurn("thread-none", "hello there").systemPrompt).toBe("");
  });

  it("fails visibly rather than pretending a critical state file disappeared", () => {
    const files = fixture();
    rmSync(files.statePath);
    const result = new ProjectContextProvider(files).forTurn("thread-broken", "Farmada");
    expect(result.error).toMatch(/Critical project Farmada state is unreadable/);
    expect(result.systemPrompt).toContain("do not infer that the project disappeared");
  });

  it("rejects relative project state paths", () => {
    const files = fixture();
    writeFileSync(
      files.registryPath,
      JSON.stringify({
        version: 1,
        projects: [{ id: "farmada", name: "Farmada", aliases: [], statePath: "STATE.md", critical: true }],
      }),
    );
    expect(() => loadProjectRegistry(files.registryPath)).toThrow(/absolute path/);
  });

  it("accepts the shared AgentHQ registry superset without creating a second schema", () => {
    const files = fixture();
    const project = loadProjectRegistry(files.registryPath).projects[0];
    expect(project.workspace).toBe(files.root);
    expect(project.charterPath).toBe(files.charterPath);
    expect(project.ownerAgentIds).toEqual(["mailroom"]);
  });

  it("marks state truncation honestly while keeping the charter first", () => {
    const files = fixture();
    writeFileSync(files.statePath, `# State\n${"x".repeat(20_000)}`);
    const prompt = new ProjectContextProvider(files).forTurn("thread-large", "Farmada").systemPrompt;
    expect(prompt.indexOf("<project_charter>")).toBeLessThan(prompt.indexOf("<project_state>"));
    expect(prompt).toContain("State was truncated at 16000 bytes");
  });

  it("does not guess when a new thread names multiple projects", () => {
    const files = fixture();
    mkdirSync(join(files.root, "ganga"));
    const gangaState = join(files.root, "ganga", "STATE.md");
    writeFileSync(gangaState, "# Ganga");
    writeFileSync(
      files.registryPath,
      JSON.stringify({
        version: 1,
        projects: [
          { id: "farmada", name: "Farmada", aliases: [], statePath: files.statePath, critical: true },
          { id: "ganga", name: "Ganga", aliases: [], statePath: gangaState, critical: false },
        ],
      }),
    );
    const result = new ProjectContextProvider(files).forTurn("thread-many", "Compare Farmada and Ganga");
    expect(result.error).toMatch(/multiple projects/);
    expect(result.projectId).toBeUndefined();
  });
});
