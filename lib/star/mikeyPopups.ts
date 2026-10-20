/**
 * MIKEY'S NEW POP-UPS — Settings → "Mikey's new pop-ups: New | Old" (Mikey,
 * 20 Oct 2026). Asked for by name as a toggle: "This should not affect the
 * current version. Instead, it should be a toggle called Mikey's new pop-ups."
 *
 * New: the words that pop up when an action finishes (GOAL, PASS, OFFSIDE…)
 * are drawn as TV graphics (components/star/MikeyPopup.tsx): a goal is a
 * scoreboard at the top whose score rolls over, with the scorer and the
 * assist; everything else is a short caption strip. Old (the default): the
 * pop-ups exactly as they were. One phone at a time; saves are never touched.
 */
import { useSyncExternalStore } from "react";

export type MikeyPopupsLook = "new" | "old";
export const MIKEY_POPUPS_KEY = "star-mikey-popups";
export const MIKEY_POPUPS_DEFAULT: MikeyPopupsLook = "old";
let stored: MikeyPopupsLook | undefined;
const listeners = new Set<() => void>();

function read(): MikeyPopupsLook {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(MIKEY_POPUPS_KEY) : null;
    return v === "new" || v === "old" ? v : MIKEY_POPUPS_DEFAULT;
  } catch {
    return MIKEY_POPUPS_DEFAULT;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MIKEY_POPUPS_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function mikeyPopupsLook(): MikeyPopupsLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setMikeyPopupsLook(v: MikeyPopupsLook): void {
  try { localStorage.setItem(MIKEY_POPUPS_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useMikeyPopupsLook(): MikeyPopupsLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    mikeyPopupsLook, () => MIKEY_POPUPS_DEFAULT,
  );
}

/** What kind of moment a word is: picks the strip's colour and its icon. */
export type PopupTone = "good" | "bad" | "save" | "ref" | "plain" | "goal";

export function popupTone(text: string): PopupTone {
  if (text === "GOAL" || text === "SCORED") return "goal";
  if (["PASS", "TOUCH ON", "BACK TO YOU", "BEAT HIM", "KNUCKLEBALL"].includes(text) || text.startsWith("⚡")) return "good";
  if (["INTERCEPTED", "BLOCKED", "CLOSED DOWN", "CHANCE GONE"].includes(text)) return "bad";
  if (text.startsWith("SAVED") || text === "POST") return "save";
  if (["OFFSIDE", "FOUL", "PENALTY"].includes(text)) return "ref";
  return "plain"; // WIDE, OVER, OUT OF PLAY, NOBODY THERE, MISCUED, DEFLECTED, SCUFFED, MISSED…
}

/** How long each pop-up is up (ms): the same as today's pop-ups, so seven goals never mean seven long waits. */
export function popupMs(text: string): number {
  if (text === "GOAL" || text === "SCORED") return 1500;
  if (text === "PASS" || text === "BACK TO YOU") return 800;
  return 1000;
}

/** A name as a TV graphic shows it: the surname, or the one name he goes by. */
export function popupName(full: string | undefined): string | undefined {
  if (!full) return undefined;
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}
