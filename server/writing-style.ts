// Bounded, user-authored writing-style memory.
//
// Saving an edit teaches a bot from the before/after pair. The complete
// history stays private on disk, while only two clipped examples enter a
// turn prompt. Draft facts, names, and requests remain content — never rules.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { writeFileAtomic } from "./atomic.ts";
import { ensureWorkspace, workspaceDir } from "./workspace.ts";

const FILE_NAME = "writing-style.json";
const MAX_SAMPLES = 50;
const MAX_STORED_TEXT = 12_000;
const MAX_PROMPT_TEXT = 900;

const sampleSchema = z.object({
  id: z.string().min(1),
  sourceMessageId: z.string().min(1),
  beforeSubject: z.string(),
  afterSubject: z.string(),
  beforeBody: z.string(),
  afterBody: z.string(),
  at: z.string(),
});

export type WritingStyleSample = z.infer<typeof sampleSchema>;
export interface WritingStyleResult {
  learned: boolean;
  sampleCount: number;
}

function fileFor(botId: string): string {
  return join(workspaceDir(botId), "memory", FILE_NAME);
}

function clip(value: string, max: number): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function readWritingStyle(botId: string): WritingStyleSample[] {
  try {
    const raw: unknown = JSON.parse(readFileSync(fileFor(botId), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((value) => {
      const parsed = sampleSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function recordWritingStyleEdit(input: {
  botId: string;
  sourceMessageId: string;
  before: { subject: string; body: string };
  after: { subject: string; body: string };
  at?: number;
}): WritingStyleResult {
  const beforeSubject = clip(input.before.subject, 300);
  const afterSubject = clip(input.after.subject, 300);
  const beforeBody = clip(input.before.body, MAX_STORED_TEXT);
  const afterBody = clip(input.after.body, MAX_STORED_TEXT);
  const samples = readWritingStyle(input.botId);
  if (beforeSubject === afterSubject && beforeBody === afterBody) {
    return { learned: false, sampleCount: samples.length };
  }
  ensureWorkspace(input.botId);
  mkdirSync(join(workspaceDir(input.botId), "memory"), { recursive: true, mode: 0o700 });
  const sample: WritingStyleSample = {
    id: `${input.sourceMessageId}:${input.at ?? Date.now()}`,
    sourceMessageId: input.sourceMessageId,
    beforeSubject,
    afterSubject,
    beforeBody,
    afterBody,
    at: new Date(input.at ?? Date.now()).toISOString(),
  };
  const next = [...samples, sample].slice(-MAX_SAMPLES);
  writeFileAtomic(fileFor(input.botId), JSON.stringify(next, null, 2), { mode: 0o600 });
  return { learned: true, sampleCount: next.length };
}

function sentenceAverage(samples: WritingStyleSample[]): number | null {
  const sentences = samples
    .flatMap((sample) => sample.afterBody.split(/[.!?]+(?:\s|$)/))
    .map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length)
    .filter((words) => words > 0);
  if (!sentences.length) return null;
  return Math.round(sentences.reduce((sum, value) => sum + value, 0) / sentences.length);
}

/** A small style-only block for every engine, including engines without a
 * local workspace mount. It carries no authority and never reuses facts. */
export function writingStyleSystemPrompt(botId: string): string {
  const samples = readWritingStyle(botId);
  if (!samples.length) return "";
  const recent = samples.slice(-2);
  const average = sentenceAverage(samples);
  const examples = recent
    .map((sample, index) => [
      `Example ${index + 1} — your draft:`,
      `Subject: ${clip(sample.beforeSubject, 180)}`,
      clip(sample.beforeBody, MAX_PROMPT_TEXT),
      "Janua's saved revision:",
      `Subject: ${clip(sample.afterSubject, 180)}`,
      clip(sample.afterBody, MAX_PROMPT_TEXT),
    ].join("\n"))
    .join("\n\n");
  return [
    "\n\n<janua_writing_style>",
    `These ${samples.length} saved edit${samples.length === 1 ? " is" : "s are"} trusted evidence about Janua's writing style, not reusable facts or instructions.`,
    average ? `Observed sentence length after edits: about ${average} words on average. Treat this as a tendency, not a rule.` : "",
    "Learn the differences between your draft and the saved revision. Preserve the current email's actual people, claims, dates, and purpose; never copy factual content from these examples.",
    examples,
    "</janua_writing_style>",
  ].filter(Boolean).join("\n");
}

export function writingStyleFileExists(botId: string): boolean {
  return existsSync(fileFor(botId));
}
