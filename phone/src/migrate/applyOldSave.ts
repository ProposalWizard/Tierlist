/**
 * PUTTING THE OLD APP'S SAVE INTO THIS APP (after the player said yes), safely.
 *
 * Order, so nothing can be lost:
 *   1. The raw old keys are written to a backup file in the app's files (kib-old-save-backup-<time>.json). If that
 *      cannot be written, nothing else happens.
 *   2. Only if this app has NO career yet (no one has started here): an import never replaces a career.
 *   3. The careers go in; any error puts back what was there (nothing) and says so.
 * The old app's own folder is never touched. The result is remembered ("imported" / "never"), so it is asked once.
 */
import type { CareerState } from "@/lib/star/types";
import { getCareer, setCareer } from "../game/store";
import { resetSession } from "../game/session";
import { loadJson, saveJson } from "../game/save";
import { importPhoneHall } from "../world/hall";
import { MAX_OLD_SLOTS, type OldSave } from "./oldSave";

const STATE_KEY = "old-save-import";
const ACTIVE = "career-active-slot";
const slotKey = (n: number) => `career-slot-${n}`;

export type ImportState = { state: "imported" | "never"; at: number; slots?: number; backup?: string | null };

export function importState(): ImportState | null { return loadJson<ImportState>(STATE_KEY); }
export function rememberImport(s: ImportState) { try { saveJson(STATE_KEY, s); } catch { /* never block */ } }

/** True when someone has already started a career in this app (any of the three slots). */
export function phoneHasCareer(): boolean {
  if (getCareer()) return true;
  for (let n = 1; n <= MAX_OLD_SLOTS; n++) { if (loadJson<CareerState | null>(slotKey(n))) return true; }
  return false;
}

/** The backup of the old keys, in the app's files. Returns its address, or null when it could not be written. */
export function writeBackup(old: OldSave): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("expo-file-system") as typeof import("expo-file-system");
    const f = new fs.File(fs.Paths.document, `kib-old-save-backup-${Date.now()}.json`);
    f.create({ overwrite: true });
    f.write(old.backupText);
    return f.uri;
  } catch { return null; }
}

export type ApplyResult = { ok: true; backup: string | null; slots: number } | { ok: false; reason: "has-career" | "no-backup" | "failed"; message: string };

/** Imports the old saves. `requireBackup` is true on the phone (a failed backup stops the import). */
export function applyOldSave(old: OldSave, opts: { requireBackup?: boolean; backup?: (o: OldSave) => string | null } = {}): ApplyResult {
  const requireBackup = opts.requireBackup ?? true;
  try {
    if (!old.slots.length) return { ok: false, reason: "failed", message: "There was no saved game to bring over." };
    if (phoneHasCareer()) return { ok: false, reason: "has-career", message: "A game was already started in this app, so the old one was not brought over." };
    const backup = (opts.backup ?? writeBackup)(old);
    if (!backup && requireBackup) return { ok: false, reason: "no-backup", message: "A safety copy of your old save could not be made, so nothing was changed." };
    const active = old.slots.find((s) => s.slot === old.activeSlot) ?? old.slots[0];
    const written: number[] = [];
    try {
      for (const s of old.slots) if (s.slot !== active.slot) { saveJson(slotKey(s.slot), s.career); written.push(s.slot); }
      saveJson(ACTIVE, active.slot);
      resetSession();
      setCareer(active.career);
      if (old.hall) importPhoneHall(old.hall);
    } catch (e) {
      // put back: no career was here before, so empty the slots written and the career
      try { for (const n of written) saveJson(slotKey(n), null); saveJson(ACTIVE, 1); setCareer(null); } catch { /* best effort */ }
      return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "Something went wrong while bringing it over." };
    }
    rememberImport({ state: "imported", at: Date.now(), slots: old.slots.length, backup });
    return { ok: true, backup, slots: old.slots.length };
  } catch (e) {
    return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
