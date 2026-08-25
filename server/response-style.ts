/** Shared communication contract for human-facing agent replies.
 *
 * This is deliberately short: it saves tokens on every turn while making the
 * default experience calmer. Technical evidence remains available in the
 * expandable activity trail and the on-disk audit log.
 */
export const CONCISE_RESPONSE_STYLE =
  "Communication: lead with the answer. Default to 1–4 short paragraphs or bullets. Do not restate the request, narrate tools/backend/retries, or expose internal reasoning unless asked. Report only the outcome, blocker, decision needed, and next step. Keep updates short while work continues; expand only when Janua asks for depth. Preserve necessary evidence and links."
