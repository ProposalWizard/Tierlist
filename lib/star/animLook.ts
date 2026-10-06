/**
 * ANIMATIONS: NEW | OLD — Settings → Look. One phone at a time.
 *
 * Leo, 6 Oct 2026: "i dont wanna see something happen in game thats not how
 * it looks." New: every man who touches the ball is seen doing it — a team-
 * mate's shot, pass and touch, a defender's block and clearance, a header
 * jump, and the keeper's catch, parry, one-handed stretch and fumble
 * (lib/star/actionAnim.ts). Old: the match exactly as drawn before.
 *
 * Harry's standing rule (3 Oct 2026): every new look gets a toggle and the
 * old one stays playable. Like newLook.ts this is a module-level value read
 * inside the match screen, never a prop, so every screen that mounts the real
 * match follows it and the one-engine guard has nothing new to compare.
 */
import { useSyncExternalStore } from "react";

export type AnimationsLook = "new" | "old";

const KEY = "star-look-animations";
const FALLBACK: AnimationsLook = "old";

let cached: AnimationsLook | null | undefined;
let override: AnimationsLook | null = null;
const listeners = new Set<() => void>();

function readStored(): AnimationsLook | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(KEY);
    return v === "new" || v === "old" ? v : null;
  } catch {
    return null;
  }
}

/** Read every frame by the match: cheap. */
export function animationsLook(): AnimationsLook {
  if (override) return override;
  if (cached === undefined) cached = readStored();
  return cached ?? FALLBACK;
}

export function setAnimationsLook(v: AnimationsLook): void {
  try { localStorage.setItem(KEY, v); } catch { /* the in-memory value still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

/** Force it while a dev screen is open. Returns the undo. */
export function setAnimationsLookOverride(v: AnimationsLook | null): () => void {
  const before = override;
  override = v;
  listeners.forEach((f) => f());
  return () => { override = before; listeners.forEach((f) => f()); };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { cached = undefined; listeners.forEach((f) => f()); }
  });
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export const useAnimationsLook = () => useSyncExternalStore(subscribe, animationsLook, () => FALLBACK);
