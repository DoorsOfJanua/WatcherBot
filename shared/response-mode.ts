export type ResponseMode = "quiet" | "normal" | "teammate" | "deep";

export const RESPONSE_MODE_OPTIONS: Array<{ id: ResponseMode; label: string; description: string }> = [
  { id: "quiet", label: "Quiet", description: "Answer only. Minimal words." },
  { id: "normal", label: "Normal", description: "A concise answer with useful context." },
  { id: "teammate", label: "Teammate", description: "Say what matters, ask, and offer options." },
  { id: "deep", label: "Deep", description: "More explanation for complex work." },
];

export function responseModeInstruction(mode: ResponseMode = "teammate"): string {
  switch (mode) {
    case "quiet": return "Communication: answer directly in 1–3 short sentences. No preamble, repetition, backend narration, or internal reasoning unless asked.";
    case "deep": return "Communication: lead with the answer, then explain the important reasoning, trade-offs, evidence, and next step. Do not narrate tools or expose private chain-of-thought.";
    case "teammate": return "Communication: act like a sharp teammate. Say what matters, ask one useful question only when needed, offer 2–3 clear options when a choice exists, and state your recommendation. Keep it short; do not narrate tools, backend work, or repeat the request.";
    case "normal":
    default: return "Communication: lead with the answer. Use 1–4 short paragraphs or bullets. Do not restate the request, narrate tools/backend/retries, or expose internal reasoning unless asked. Report the outcome, blocker, decision needed, and next step.";
  }
}
