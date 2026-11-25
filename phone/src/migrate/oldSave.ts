/**
 * THE OLD APP'S SAVE, READ OUT OF ITS localStorage (pure: text in, careers out; no phone, no files).
 *
 * The packed app is the website's own game (lib/star), so its save is the website's: lib/star/storage.ts writes
 *   star-career-v2::anon          slot 1's career, JSON ("saved form": other clubs' squads thin, savedSquads)
 *   star-career-v2::anon#slot2    slot 2, and #slot3
 *   star-career-active-slot-v1::anon   which slot was open
 *   star-hall-of-fame-v1::anon    the Hall of Fame book
 * (the packed app has no sign-in, so the scope is always "anon": lib/star/storage.ts ANON_SCOPE).
 * Each career goes through the game's own loader (`loadCareerFromStoredForm`: version check, squads put back, every
 * backfill), the same way a pasted save code does, so a save from an older game version still opens.
 *
 * Nothing here writes. Applying the result is ./applyOldSave.ts.
 */
import type { CareerState } from "@/lib/star/types";
import type { HallBook } from "@/lib/star/hallOfFame";

const CAREER = "star-career-v2";
const ACTIVE = "star-career-active-slot-v1";
const HALL = "star-hall-of-fame-v1";
const SAVED_AT = "star-career-saved-at-v1";
const SCOPE = "anon";
export const MAX_OLD_SLOTS = 3;
const scopeOf = (slot: number) => (slot === 1 ? SCOPE : `${SCOPE}#slot${slot}`);

export interface OldSlot {
  slot: number;
  career: CareerState;
  /** When the website last wrote this save (ms), if the old app recorded it. */
  savedAt: number | null;
  /** The card's words. */
  summary: { name: string; club: string; season: number; retired: boolean };
}
export interface OldSave {
  slots: OldSlot[];
  /** The slot that was open in the old app (1 when it never said). */
  activeSlot: number;
  hall: HallBook | null;
  /** Keys that were there and were not read (so the confirmation can say so). */
  problems: string[];
  /** Every old key/value the import looked at, as JSON text, for the backup file. */
  backupText: string;
}

/** The game's own loader for a saved form, or null. Lazy: the loader pulls in the whole of lib/star. */
function loadStoredForm(raw: unknown): CareerState | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadCareerFromStoredForm } = require("@/lib/star/storage") as typeof import("@/lib/star/storage");
  return loadCareerFromStoredForm(raw);
}

/** Reads the old app's save out of its localStorage entries. Null when there is no career in them. Never throws. */
export function extractOldSave(entries: Map<string, string>): OldSave | null {
  try {
    const problems: string[] = [];
    const slots: OldSlot[] = [];
    const kept: Record<string, string> = {};
    for (let slot = 1; slot <= MAX_OLD_SLOTS; slot++) {
      const key = `${CAREER}::${scopeOf(slot)}`;
      const text = entries.get(key);
      if (!text) continue;
      kept[key] = text;
      try {
        const career = loadStoredForm(JSON.parse(text));
        if (!career) { problems.push(`save ${slot} could not be opened (it is kept in the backup)`); continue; }
        const at = Number(entries.get(`${SAVED_AT}::${scopeOf(slot)}`));
        slots.push({
          slot, career, savedAt: Number.isFinite(at) && at > 0 ? at : null,
          summary: { name: `${career.player.firstName} ${career.player.lastName}`, club: career.player.club || "", season: career.season, retired: !!career.retired },
        });
      } catch (e) { problems.push(`save ${slot} could not be read (${e instanceof Error ? e.message : String(e)})`); }
    }
    let hall: HallBook | null = null;
    const hallText = entries.get(`${HALL}::${SCOPE}`);
    if (hallText) {
      kept[`${HALL}::${SCOPE}`] = hallText;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { sanitizeHallBook } = require("@/lib/star/hallOfFame") as typeof import("@/lib/star/hallOfFame");
        const b = sanitizeHallBook(JSON.parse(hallText));
        if (b.entries.length || b.removed.length) hall = b;
      } catch { problems.push("the Hall of Fame could not be read (it is kept in the backup)"); }
    }
    const act = Number(entries.get(`${ACTIVE}::${SCOPE}`));
    if (entries.has(`${ACTIVE}::${SCOPE}`)) kept[`${ACTIVE}::${SCOPE}`] = String(entries.get(`${ACTIVE}::${SCOPE}`));
    let activeSlot = Number.isInteger(act) && act >= 1 && act <= MAX_OLD_SLOTS ? act : 1;
    if (!slots.length && !hall) return null;
    if (slots.length && !slots.some((s) => s.slot === activeSlot)) activeSlot = slots[0].slot;
    return { slots, activeSlot, hall, problems, backupText: JSON.stringify({ kind: "kib-old-save-backup", version: 1, keys: kept }) };
  } catch {
    return null;
  }
}
