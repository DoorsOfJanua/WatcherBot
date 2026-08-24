// One global switch between plain words and raw code on tool activity and
// approval cards. Persisted so a developer stays in dev mode and everyone
// else never sees argv again; the custom event keeps every mounted card in
// sync the moment the toggle flips.
import { useSyncExternalStore } from "react";

const KEY = "watcherbotroom.devMode";
const EVENT = "watcherbotroom:display-mode";

// Session fallback: private browsing and locked-down webviews may reject
// localStorage, and the toggle must still work for the session.
let memory = false;

export function loadDevMode(): boolean {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored != null) return stored === "1";
  } catch {
    // fall through to the in-memory value
  }
  return memory;
}

export function setDevMode(on: boolean): void {
  memory = on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage refused — the event below still flips this session
  }
  globalThis.dispatchEvent?.(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener?.(EVENT, onChange);
  globalThis.addEventListener?.("storage", onChange);
  return () => {
    globalThis.removeEventListener?.(EVENT, onChange);
    globalThis.removeEventListener?.("storage", onChange);
  };
}

export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, loadDevMode, () => false);
}
