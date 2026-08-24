// Deterministic context budget for provider turns.
//
// Every section of a turn prompt was already bounded at its producer
// (project state, MEMORY.md, shared memory, writing style); the silent
// growth lived in the transcript replay and the room serialization, whose
// individual entries had no cap at all. This module closes that hole and
// makes every turn's composition inspectable: char-based budgets, a fixed
// trim order, and a report of what rode, what was cut, and roughly how many
// tokens it cost. No model calls, no clock reads, no randomness — the same
// inputs always produce the same prompt, which is what keeps provider
// prompt caches warm.
//
// Raw data is never destroyed by budgeting: full transcripts stay in the
// store's on-disk log, MEMORY.md and project STATE.md stay on disk, and the
// per-thread report says exactly where a cut happened so the source can be
// inspected.

/** Coarse deterministic estimate — good enough to compare sections and spot
 * growth, deliberately not a tokenizer. */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ── budgets ──────────────────────────────────────────────────────────────
// Chars, not tokens, so the numbers are exact and cheap to enforce.

export interface TurnClampBudget {
  /** newest N entries are candidates at all (matches the old hard cap) */
  maxTurns: number;
  /** one entry may not exceed this; overlong text is middle-elided */
  maxTurnChars: number;
  /** all retained entries together may not exceed this; oldest drop first */
  maxTotalChars: number;
}

/** 1:1 transcript replay / API-driver transcript. 40 turns is the
 * pre-existing cap; the char limits are new. */
export const TRANSCRIPT_BUDGET: TurnClampBudget = {
  maxTurns: 40,
  maxTurnChars: 6_000,
  maxTotalChars: 60_000,
};

/** Group-room serialization. 30 messages is the pre-existing cap. */
export const ROOM_BUDGET: TurnClampBudget = {
  maxTurns: 30,
  maxTurnChars: 4_000,
  maxTotalChars: 40_000,
};

/** Whole-system-prompt ceiling. With every per-section cap at its max the
 * sum stays under this, so the global trim pass is a backstop against a
 * misbehaving producer, not the everyday mechanism. ~30k tokens. */
export const SYSTEM_TOTAL_MAX_CHARS = 120_000;

// ── transcript / room clamping ───────────────────────────────────────────

export interface ClampedTurns<T> {
  turns: T[];
  /** whole entries omitted (older than the caps allowed) */
  droppedTurns: number;
  /** entries whose text was middle-elided to fit maxTurnChars */
  truncatedTurns: number;
  /** total chars of the retained, clamped entries */
  chars: number;
}

function elideMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // first pass sizes the marker; the count it prints must include the
  // marker's own footprint, so recompute against what is actually kept
  let marker = `\n[… ${text.length - maxChars} characters omitted here by the context budget — the full message is in the thread transcript on disk …]\n`;
  // a cap too small to hold the marker degrades to a plain hard cut
  if (maxChars <= marker.length + 20) return text.slice(0, maxChars);
  marker = `\n[… ${text.length - (maxChars - marker.length)} characters omitted here by the context budget — the full message is in the thread transcript on disk …]\n`;
  const keep = maxChars - marker.length;
  const head = Math.ceil((keep * 2) / 3);
  const tail = keep - head;
  return text.slice(0, head) + marker + text.slice(text.length - tail);
}

/** Keep the newest entries whole where possible: walk newest → oldest,
 * clamp each entry to the per-entry cap, stop once the total budget is
 * spent. The newest entry always survives (clamped), however large. */
export function clampTurns<T extends { text: string }>(
  all: readonly T[],
  budget: TurnClampBudget,
): ClampedTurns<T> {
  const candidates = all.slice(-budget.maxTurns);
  let droppedTurns = all.length - candidates.length;
  let truncatedTurns = 0;
  let chars = 0;
  const kept: T[] = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const entry = candidates[i];
    const text = elideMiddle(entry.text, budget.maxTurnChars);
    if (kept.length > 0 && chars + text.length > budget.maxTotalChars) {
      droppedTurns += i + 1;
      break;
    }
    if (text !== entry.text) truncatedTurns++;
    kept.push(text === entry.text ? entry : { ...entry, text });
    chars += text.length;
  }
  kept.reverse();
  return { turns: kept, droppedTurns, truncatedTurns, chars };
}

// ── system-prompt sections ───────────────────────────────────────────────

export interface ContextSection {
  id: string;
  text: string;
  /** per-section ceiling; text over it is end-truncated with a marker */
  maxChars?: number;
  /** never truncated or dropped, by its own cap or the global pass —
   * project state, persona, and safety text live here. Producers of
   * protected sections bound themselves (and say so in-prompt when they
   * truncate or fail); the budget layer must not double-cut them. */
  protected?: boolean;
  /** global-overflow order: 1 shrinks first. Unset = shrinks last. */
  trimOrder?: number;
}

export type SectionStatus = "included" | "truncated" | "dropped" | "empty";

export interface SectionReport {
  id: string;
  chars: number;
  approxTokens: number;
  status: SectionStatus;
  protected: boolean;
}

export interface PackedSystem {
  text: string;
  chars: number;
  approxTokens: number;
  sections: SectionReport[];
  /** true when even the global pass could not reach the ceiling (protected
   * sections alone exceed it) — surfaced, never silently ignored */
  overCeiling: boolean;
}

function truncateSection(id: string, text: string, maxChars: number): string {
  const marker = `\n[context budget: section "${id}" truncated here — inspect its source file for the rest]`;
  const keep = Math.max(maxChars - marker.length, 0);
  return text.slice(0, keep) + marker;
}

/** Concatenate sections in the given order (no added glue — the result is
 * byte-identical to plain concatenation whenever every section fits its
 * budget), enforcing per-section caps and then the global ceiling by
 * shrinking unprotected sections in trimOrder. */
export function packSections(
  sections: readonly ContextSection[],
  totalMaxChars = SYSTEM_TOTAL_MAX_CHARS,
): PackedSystem {
  const packed = sections.map((section) => {
    if (!section.text) {
      return { section, text: "", status: "empty" as SectionStatus };
    }
    if (!section.protected && section.maxChars !== undefined && section.text.length > section.maxChars) {
      return {
        section,
        text: truncateSection(section.id, section.text, section.maxChars),
        status: "truncated" as SectionStatus,
      };
    }
    return { section, text: section.text, status: "included" as SectionStatus };
  });

  let total = packed.reduce((sum, p) => sum + p.text.length, 0);
  if (total > totalMaxChars) {
    // Backstop: shrink unprotected sections, lowest priority first, dropping
    // a section entirely when even a marker-sized remnant cannot help.
    const order = packed
      .filter((p) => !p.section.protected && p.text.length > 0)
      .sort(
        (a, b) =>
          (a.section.trimOrder ?? Number.MAX_SAFE_INTEGER) - (b.section.trimOrder ?? Number.MAX_SAFE_INTEGER),
      );
    for (const p of order) {
      if (total <= totalMaxChars) break;
      const overflow = total - totalMaxChars;
      if (p.text.length <= overflow) {
        total -= p.text.length;
        p.text = "";
        p.status = "dropped";
      } else {
        const target = p.text.length - overflow;
        const shrunk = truncateSection(p.section.id, p.text, target);
        // a truncation marker longer than the space it saves is pure loss
        if (shrunk.length >= p.text.length) {
          total -= p.text.length;
          p.text = "";
          p.status = "dropped";
        } else {
          total -= p.text.length - shrunk.length;
          p.text = shrunk;
          p.status = "truncated";
        }
      }
    }
  }

  return {
    text: packed.map((p) => p.text).join(""),
    chars: total,
    approxTokens: Math.ceil(total / CHARS_PER_TOKEN),
    sections: packed.map((p) => ({
      id: p.section.id,
      chars: p.text.length,
      approxTokens: Math.ceil(p.text.length / CHARS_PER_TOKEN),
      status: p.status,
      protected: p.section.protected === true,
    })),
    overCeiling: total > totalMaxChars,
  };
}

// ── per-turn diagnostics ─────────────────────────────────────────────────

export interface ContextReport {
  at: string;
  kind: "turn" | "room";
  threadId: string;
  botId: string;
  system: {
    chars: number;
    approxTokens: number;
    overCeiling: boolean;
    sections: SectionReport[];
  };
  transcript: {
    turns: number;
    droppedTurns: number;
    truncatedTurns: number;
    chars: number;
    approxTokens: number;
  };
  /** the text field actually sent for this turn (user message or replay) */
  turnTextChars: number;
  totalApproxTokens: number;
}

export function buildContextReport(input: {
  kind: "turn" | "room";
  threadId: string;
  botId: string;
  system: PackedSystem;
  transcript: ClampedTurns<{ text: string }>;
  turnTextChars: number;
  /** true when the driver receives the transcript as its own field rather
   * than folded into the turn text (API-transcript drivers) — those tokens
   * ride the wire and must be part of the total, not just the breakdown */
  transcriptRidesSeparately?: boolean;
}): ContextReport {
  const transcriptTokens = Math.ceil(input.transcript.chars / CHARS_PER_TOKEN);
  return {
    at: new Date().toISOString(),
    kind: input.kind,
    threadId: input.threadId,
    botId: input.botId,
    system: {
      chars: input.system.chars,
      approxTokens: input.system.approxTokens,
      overCeiling: input.system.overCeiling,
      sections: input.system.sections,
    },
    transcript: {
      turns: input.transcript.turns.length,
      droppedTurns: input.transcript.droppedTurns,
      truncatedTurns: input.transcript.truncatedTurns,
      chars: input.transcript.chars,
      approxTokens: transcriptTokens,
    },
    turnTextChars: input.turnTextChars,
    totalApproxTokens:
      input.system.approxTokens +
      Math.ceil(input.turnTextChars / CHARS_PER_TOKEN) +
      (input.transcriptRidesSeparately ? transcriptTokens : 0),
  };
}
