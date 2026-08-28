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
  /** Up to seven designated substitutes, in the order the user chose. */
  bench?: string[];
  /** Whoever is in the dugout. Typed in, because the database has no managers. */
  manager?: string;
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
  return {
    formation: saved.formation || DEFAULT_FORMATION,
    xi: saved.xi,
    bench: Array.isArray(saved.bench) ? saved.bench : undefined,
    manager: typeof saved.manager === "string" ? saved.manager : "",
  };
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

/**
 * A COPY YOU KEEP YOURSELF.
 *
 * Every saved lineup lives only in this one browser's localStorage — there is
 * no cloud copy, and a club built on one device is invisible to the same
 * career opened on another (a laptop and a phone are two different stores
 * entirely). `exportAll` hands back the whole thing as one block of JSON, so
 * it can be pasted somewhere safe — or straight into another device's Import
 * box — instead of being rebuilt by hand a second time.
 */
export function exportAll(): string {
  return JSON.stringify(read(), null, 2);
}

export interface ImportResult {
  ok: boolean;
  /** How many clubs were actually written. */
  count?: number;
  error?: string;
}

/**
 * The other half of exportAll — reads back exactly what it wrote.
 *
 * Merges rather than replaces: a club not mentioned in the pasted JSON is
 * left exactly as it was, so importing a backup that only covers two clubs
 * can never wipe out everything else already saved on this device.
 */
export function importAll(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That doesn't look like valid JSON — check nothing got cut off when you pasted it." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "That JSON isn't a lineup backup — expected an object keyed by club name." };
  }
  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    ([, v]) => v && typeof v === "object" && Array.isArray((v as SavedLineup).xi),
  ) as [string, SavedLineup][];
  if (entries.length === 0) {
    return { ok: false, error: "No valid lineups found in that JSON." };
  }
  try {
    const all = read();
    for (const [club, lineup] of entries) {
      all[club] = {
        formation: lineup.formation || DEFAULT_FORMATION,
        xi: lineup.xi,
        bench: Array.isArray(lineup.bench) ? lineup.bench : undefined,
        manager: typeof lineup.manager === "string" ? lineup.manager : "",
      };
    }
    localStorage.setItem(KEY, JSON.stringify(all));
    return { ok: true, count: entries.length };
  } catch {
    return { ok: false, error: "Couldn't write to this browser's storage." };
  }
}
