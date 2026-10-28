/**
 * MIKEY'S POP-UPS (Mikey, 20 Oct 2026). The words that pop up when an action
 * finishes (GOAL, PASS, OFFSIDE…) are drawn as TV graphics
 * (components/star/MikeyPopup.tsx): a goal is a scoreboard at the top whose
 * score rolls over, with the scorer and the assist; everything else is a short
 * caption strip.
 *
 * The only pop-ups since 27 Oct 2026 (Mikey: "There is no toggle, there's no
 * setting for it … that is the new base version of the pop-ups"). The Settings
 * row "Pop-up pack: Classic | Broadcast" and the Classic words are gone; an old
 * phone's stored "star-mikey-popups" value is ignored (Brain FACT-UI-017).
 */

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
