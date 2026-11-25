// WEB BUILD ONLY (the look check and the playtest bench, phone/tools/look): the live match on
// `window.__kibMatch`, so a test can read it (phase, ball, pop-ups) and reach a state to look at.
// The Android app never loads this file (it loads debugHook.ts).
export function debugMatch(d: unknown): void {
  try { (globalThis as Record<string, unknown>).__kibMatch = d; } catch { /* no window */ }
}

/** The live first-person dribble run (MatchFirstPerson) on `window.__kibRun`, for the playtest bench. */
export function debugRun(r: unknown): void {
  try { (globalThis as Record<string, unknown>).__kibRun = r; } catch { /* no window */ }
}
