// The phone app keeps no handle on the match for outside tools. (The web build used by the look
// check does: debugHook.web.ts, so a test can read the live match and step it. Never in the app.)
export function debugMatch(_d: unknown): void { /* nothing on the phone */ }

export function debugRun(_r: unknown): void { /* nothing on the phone */ }
