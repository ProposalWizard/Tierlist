/**
 * THE HALL OF FAME ON THE PHONE (lib/star/hallOfFame.ts's book, kept in the
 * phone's own storage instead of the browser's localStorage).
 *
 * Same entries, same ids, same order as the website: hallEntryFor makes the
 * card, hallIdFor keeps a career from going in twice, removed ids stay out.
 * No cloud copy: the phone app has no sign-in (lib/app/packed.ts).
 */
import { useSyncExternalStore } from "react";
import type { CareerState } from "@/lib/star/types";
import { hallEntryFor, hallIdFor, sanitizeHallBook, HALL_MAX_ENTRIES, type HallBook } from "@/lib/star/hallOfFame";
import { loadJson, saveJson } from "../game/save";

const KEY = "hall-of-fame-v1";
let book: HallBook = sanitizeHallBook(loadJson<HallBook>(KEY) ?? { entries: [], removed: [] });
const subs = new Set<() => void>();
function write(next: HallBook) { book = next; saveJson(KEY, next); subs.forEach((f) => f()); }

export function phoneHall(): HallBook { return book; }
export function usePhoneHall(): HallBook {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => book, () => book);
}

/** Put a retired career in the Hall, once (addToHall). */
export function addToPhoneHall(career: CareerState): boolean {
  if (!career.retired) return false;
  const id = hallIdFor(career);
  if (book.removed.includes(id) || book.entries.some((e) => e.id === id)) return false;
  const entries = [hallEntryFor(career), ...book.entries].sort((a, b) => b.addedAt - a.addedAt).slice(0, HALL_MAX_ENTRIES);
  write({ ...book, entries });
  return true;
}

/** Bring in a Hall of Fame book from elsewhere (the old app's, migrate/applyOldSave.ts): entries by id, anything removed stays removed. */
export function importPhoneHall(other: HallBook) {
  const seen = new Set(book.entries.map((e) => e.id));
  const removed = Array.from(new Set([...book.removed, ...other.removed]));
  const entries = [...book.entries, ...other.entries.filter((e) => !seen.has(e.id) && !removed.includes(e.id))]
    .sort((a, b) => b.addedAt - a.addedAt).slice(0, HALL_MAX_ENTRIES);
  write({ entries, removed });
}

/** Take one out (removeFromHall): it stays out. */
export function removeFromPhoneHall(id: string) {
  write({ entries: book.entries.filter((e) => e.id !== id), removed: [...book.removed, id] });
}
