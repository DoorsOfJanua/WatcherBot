export type ChatBlockKind = "code" | "note" | "hidden";

const MACHINE_ONLY_LANGUAGES = new Set(["autonomy-outcome"]);
const PROSE_LANGUAGES = new Set(["text", "txt", "plain", "plaintext"]);

/**
 * Fenced markdown is often used by agents for diagrams and working summaries,
 * not just source code. Keep machine envelopes out of the transcript and let
 * prose fences use the quiet, human renderer.
 */
export function chatBlockKind(language: string, source: string): ChatBlockKind {
  const lang = language.trim().toLowerCase();
  if (MACHINE_ONLY_LANGUAGES.has(lang)) return "hidden";
  if (PROSE_LANGUAGES.has(lang)) return "note";
  if (lang) return "code";

  const text = source.trim();
  if (!text) return "note";

  if (/^[{[]/.test(text)) {
    try {
      JSON.parse(text);
      return "code";
    } catch {
      // A sentence can begin with a bracket; keep checking stronger signals.
    }
  }

  const codeSignals = [
    /^(?:import|export|const|let|var|function|class|interface|type)\s/m,
    /^(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\s/mi,
    /^(?:#!|\$\s|npm\s|pnpm\s|yarn\s|git\s|curl\s)/m,
    /<\/?[a-z][^>]*>/i,
    /=>|\b(?:async|await)\b/,
    /[{};]\s*$/m,
  ];
  return codeSignals.some((signal) => signal.test(text)) ? "code" : "note";
}

export function isArrowOutline(source: string): boolean {
  return source
    .split("\n")
    .filter((line) => /^\s*(?:↓|→|->|=>)\s*\S/.test(line)).length >= 2;
}
