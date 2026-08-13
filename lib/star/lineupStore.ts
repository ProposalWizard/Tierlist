import { DEFAULT_FORMATION } from "./formations";

/**
 * SAVED ELEVENS.
 *
 * One per club, kept beside the career rather than inside it. Two reasons: a
 * side you picked for Everton is not part of YOUR career and should not travel
 * with it through a transfer or a retirement, and the career save is already
 * carrying a division's worth of squads and a season of results.
 *
 * Stored as slot index → player id, so it survives a squad being re-fetched:
 * the ids are SoFIFA ids for a real squad and stable generated ones otherwise.
 */

const KEY = "star-lineups-v1";

export interface SavedLineup {
  formation: string;
  /** Eleven entries, one per slot, in the formation's own order. */
  xi: (string | null)[];
}

type Store = Record<string, SavedLineup>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadLineup(club: string): SavedLineup | null {
  const saved = read()[club];
  if (!saved || !Array.isArray(saved.xi)) return null;
  return { formation: saved.formation || DEFAULT_FORMATION, xi: saved.xi };
}

export function saveLineup(club: string, lineup: SavedLineup): void {
  try {
    const all = read();
    all[club] = lineup;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // A full or blocked localStorage loses the arrangement and nothing else.
  }
}

export function clearLineup(club: string): void {
  try {
    const all = read();
    delete all[club];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
