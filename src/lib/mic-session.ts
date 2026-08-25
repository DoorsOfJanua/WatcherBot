/**
 * The composer's dictation session as a pure state machine. The Composer owns
 * the audio bridge; every decision about TEXT lives here so it can be tested:
 *
 * - starting the mic never destroys what was already typed,
 * - partial hypotheses append after the typed base and stay monotonic,
 * - a manual edit while recording ends the session and the edit wins,
 * - cancel restores the exact draft from before the mic went on,
 * - stop (or send) keeps everything dictated so far.
 */
import { joinDictation, mergeDictationTranscript } from "./dictation-transcript.js";

export type MicSession = {
  status: "idle" | "recording";
  /** the untouched draft from before the mic went on — what cancel restores */
  preDraft: string;
  /** what was typed before recording; partials append after it */
  base: string;
  /** the monotonic merged transcript of everything spoken this session */
  spoken: string;
  /** the last text this session put into the composer */
  rendered: string;
};

export const idleMicSession: MicSession = {
  status: "idle",
  preDraft: "",
  base: "",
  spoken: "",
  rendered: "",
};

/** The mic goes on over the current draft. */
export function startMicSession(draft: string): MicSession {
  return {
    status: "recording",
    preDraft: draft,
    base: draft.trim(),
    spoken: "",
    rendered: draft,
  };
}

/** A recognition partial arrived; returns the session and the text to show. */
export function micPartial(session: MicSession, hypothesis: string): MicSession {
  if (session.status !== "recording") return session;
  const spoken = mergeDictationTranscript(session.spoken, hypothesis);
  return { ...session, spoken, rendered: joinDictation(session.base, spoken) };
}

/** The user typed while the mic was live. Their edit is authoritative: the
 * session ends immediately, because the recognizer's next partial re-delivers
 * the WHOLE running hypothesis — which is already inside the edited text —
 * and appending it again would duplicate everything spoken so far. */
export function micManualEdit(session: MicSession, value: string): MicSession {
  if (session.status !== "recording" || value === session.rendered) return session;
  return { ...idleMicSession, rendered: value };
}

/** Stop and keep the transcript (the mic button, Esc-to-stop, or a send). */
export function stopMicSession(session: MicSession): MicSession {
  return { ...idleMicSession, rendered: session.rendered };
}

export interface MicCancel {
  session: MicSession;
  /** the untouched pre-mic draft to put back into the composer */
  restore: string;
}

/** Cancel and restore the draft exactly as it was before recording. */
export function cancelMicSession(session: MicSession): MicCancel {
  return { session: { ...idleMicSession, rendered: session.preDraft }, restore: session.preDraft };
}
