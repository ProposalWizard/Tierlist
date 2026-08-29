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
 *
 * ── One shared answer, not one per browser ──
 *
 * These used to live ONLY here — localStorage, one browser, gone the moment
 * a different device (or a different player) opened the same career. Every
 * lineup is now also a row in Supabase's `star_lineups` table (see
 * app/api/star/lineups/route.ts and supabase/migrations/star_lineups.sql),
 * which is the real, shared answer everyone reads. localStorage is now just
 * a synchronous read cache in front of it: `loadLineup` below still reads
 * from here directly, because team-sheet generation (lib/star/teamsheet.ts)
 * needs an answer mid-render with no `await` to spare — but the cache is
 * kept full by `fetchSharedLineups`, fired at app load the same way the
 * career's own squads already are, and every save now also pushes to the
 * server so it is visible everywhere, not just here.
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
 * Pull every club's lineup down from the shared table and merge it into the
 * local cache — the server's copy of a club wins over the local one where
 * both exist, but a club the server does not have (yet) is left exactly as
 * it was here, never deleted. This used to be a wholesale REPLACE, on the
 * theory that the server is the real source of truth so a stale local copy
 * should never survive a successful sync — but that is only true once the
 * server actually has the data. Run right after the table itself is first
 * created, with nothing in it yet, a REPLACE wiped the one and only real
 * copy of every lineup — which had been sitting safely in localStorage the
 * whole time — the moment the page next loaded, on every device, before any
 * of it had a chance to get pushed up first. A sync must never be able to
 * make things WORSE than not syncing at all; merge cannot.
 *
 * Fire this at app load (see app/star-dev/page.tsx, alongside the career's
 * own squad fetches) and once on mount of the Lineups page, both
 * fire-and-forget the same way squad data already is — `loadLineup` stays
 * synchronous either way, reading whatever is in the cache at the moment
 * it's called.
 */
export async function fetchSharedLineups(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/api/star/lineups", { cache: "no-store" });
    if (!res.ok) return { ok: false };
    const data = await res.json() as { lineups?: Store };
    if (data.lineups && typeof data.lineups === "object") {
      const merged = { ...read(), ...data.lineups };
      localStorage.setItem(KEY, JSON.stringify(merged));
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export interface PushResult {
  ok: boolean;
  error?: string;
}

/**
 * Write one club's lineup to the shared table — the server checks admin
 * access itself (see the route), so a non-admin caller gets a real error
 * back here rather than a save that silently only ever affected them.
 */
export async function pushLineupShared(club: string, lineup: SavedLineup): Promise<PushResult> {
  try {
    const res = await fetch("/api/star/lineups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ club, ...lineup }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: body.error ?? `Save failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — the save only landed locally, not on the server." };
  }
}

/**
 * A COPY YOU KEEP YOURSELF.
 *
 * The lineups themselves now live in the shared database (see the note at
 * the top of this file) — but `exportAll` is still worth having: a plain
 * text copy you hold yourself, outside any database, for the day something
 * needs rebuilding from scratch anyway. Hands back the whole local cache as
 * one block of JSON.
 */
export function exportAll(): string {
  return JSON.stringify(read(), null, 2);
}

export interface ImportResult {
  ok: boolean;
  /** How many clubs were actually written. */
  count?: number;
  error?: string;
  /** What was actually written, normalised — for pushAllShared below. */
  entries?: [string, SavedLineup][];
}

/**
 * The other half of exportAll — reads back exactly what it wrote, into the
 * LOCAL cache only. Merges rather than replaces: a club not mentioned in the
 * pasted JSON is left exactly as it was, so importing a backup that only
 * covers two clubs can never wipe out everything else already saved here.
 *
 * This does not touch the shared database by itself — see `pushAllShared`,
 * which the Backup panel calls right after this succeeds, so a restore is
 * visible everywhere and not just back in this one browser.
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
  const normalised: [string, SavedLineup][] = entries.map(([club, lineup]) => [club, {
    formation: lineup.formation || DEFAULT_FORMATION,
    xi: lineup.xi,
    bench: Array.isArray(lineup.bench) ? lineup.bench : undefined,
    manager: typeof lineup.manager === "string" ? lineup.manager : "",
  }]);
  try {
    const all = read();
    for (const [club, lineup] of normalised) all[club] = lineup;
    localStorage.setItem(KEY, JSON.stringify(all));
    return { ok: true, count: normalised.length, entries: normalised };
  } catch {
    return { ok: false, error: "Couldn't write to this browser's storage." };
  }
}

/**
 * Push every entry from a successful `importAll` up to the shared table, one
 * request per club (the route only takes one at a time). Best-effort — a
 * club that fails (most likely: not signed in as admin) is reported by name
 * rather than aborting the rest.
 */
export async function pushAllShared(entries: [string, SavedLineup][]): Promise<{ succeeded: string[]; failed: { club: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { club: string; error: string }[] = [];
  for (const [club, lineup] of entries) {
    const r = await pushLineupShared(club, lineup);
    if (r.ok) succeeded.push(club);
    else failed.push({ club, error: r.error ?? "Save failed" });
  }
  return { succeeded, failed };
}
