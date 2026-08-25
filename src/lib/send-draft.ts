/**
 * The composer's contract with a send: the draft is durable state. It is
 * cleared only after the server confirms delivery, a failed send keeps the
 * complete text and offers retry, and a repeated Enter while the same text
 * is in flight is a duplicate — not a second message.
 */
export type SendDraftState = {
  /** the composed text currently posting, or null */
  inFlight: string | null;
  /** the last composed text whose POST failed — drives the retry notice */
  failed: string | null;
};

export const idleSendDraft: SendDraftState = { inFlight: null, failed: null };

/** Begin sending `composed`. Returns null when this exact text is already
 * in flight (a double Enter / double tap), which must not send twice. */
export function beginSend(state: SendDraftState, composed: string): SendDraftState | null {
  if (state.inFlight === composed) return null;
  return { inFlight: composed, failed: null };
}

/** The POST settled. On failure the text is kept and flagged for retry. */
export function settleSend(state: SendDraftState, composed: string, ok: boolean): SendDraftState {
  const inFlight = state.inFlight === composed ? null : state.inFlight;
  if (ok) return { inFlight, failed: state.failed === composed ? null : state.failed };
  return { inFlight, failed: composed };
}

/** After a confirmed delivery, clear the composer only if the user hasn't
 * meanwhile typed something newer than what was sent. */
export function shouldClearDraft(currentComposed: string, sentComposed: string): boolean {
  return currentComposed === sentComposed;
}
