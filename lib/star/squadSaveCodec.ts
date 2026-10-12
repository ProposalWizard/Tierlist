import type { CareerState, LeaguePlayer, LeagueSquad } from "./types";

/**
 * THE OTHER CLUBS' SQUADS, SAVED THIN.
 *
 * `career.externalSquads` (every club outside your division — ~172 of them,
 * ~3,400 real players) and `career.leagueSquads` (the rest of your division)
 * were saved in full: every player's photo URL, nationality, six attributes
 * and position list, on every save, locally and to the cloud. Measured
 * against the real database on 28 Sep 2026: 925 KB for the external clubs
 * alone, most of a ~1.4 MB save — for data that is one request away and
 * identical for every career.
 *
 * But those squads are NOT pure copies of the database. The career writes
 * into them: European and cup goals (settleEuro), wonderkid growth
 * (growWonderkids), the international transfer window moving players in
 * and out, signings and sales at clubs you own (investments.ts), your son's
 * squad place, club mergers. None of that exists anywhere else, so simply
 * not saving the squads would lose it.
 *
 * So each player is saved as the part only the career can know —
 *
 *     [id, name, position, overall, goals, assists, rest?]
 *
 * — where `rest` holds every other field whose value differs from what the
 * database gave for that player id this session. Anything the same as the
 * database (the photo, the flag, the attributes, …) is left out and filled
 * back in from the next fetch (`hydrateSquads`). Rosters, order, goals,
 * grown ratings, signings and invented players (your son, a generated
 * lower-league squad) are all kept exactly.
 *
 * Names are kept on purpose: a save opened offline, before any fetch has
 * landed, still has every real name, rating and goal tally — it is only
 * missing faces until the next time the squads can be fetched.
 *
 * When nothing is known about a player (no fetch has landed this session,
 * or he never came from one), every field is kept — a save made before the
 * fetch lands is never thinner than what the player had.
 */

/** The database's version of each player id, from this session's fetches. */
const fetched = new Map<string, LeaguePlayer>();

/**
 * Called by fetchLeagueSquads (leagueSquads.ts) with every squad a REAL
 * fetch built — never the invented fallback it returns when the request
 * fails, since that is not what the database says.
 */
export function rememberFetchedSquads(squads: LeagueSquad[]): void {
  for (const s of squads) for (const p of s.players) fetched.set(p.id, p);
}

/** Test/dev hook: forget every fetched player. */
export function forgetFetchedSquads(): void {
  fetched.clear();
}

const CORE = new Set(["id", "name", "position", "overall", "goals", "assists"]);

export type SavedPlayer =
  | [string, string, LeaguePlayer["position"], number, number, number]
  | [string, string, LeaguePlayer["position"], number, number, number, Partial<LeaguePlayer>];
export type SavedSquad = [string, SavedPlayer[]];

/** What goes in the saved blob in place of the two squad arrays. */
export interface SavedSquads {
  v: 1;
  league?: SavedSquad[];
  external?: SavedSquad[];
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * THE SIX STATS, SAVED AS ONE SHIFT.
 *
 * The world ages (worldAgeing.ts): every season each man's six stats move
 * with his rating — the same amount for all six, plus an extra drop for
 * pace (and, late on, physical). Saved key by key that is about 70 bytes a
 * player, ~200 KB for the wider world at its peak (measured: a save's
 * squads went 132 → 277 KB by season 6). Saved as `sd: [all, paceExtra,
 * physicalExtra]` against the database's own numbers, it is ~15 bytes. A
 * stat that does not fit the shift is still written out in full; a save
 * read back before any fetch keeps `sd` (and simply has no stats yet, as
 * any thin save before a fetch) until hydrateSquads works them out.
 */
const STATS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;
type StatKey = typeof STATS[number];
function shiftOf(k: StatKey, sd: [number, number, number]): number {
  return sd[0] + (k === "pace" ? sd[1] : k === "physical" ? sd[2] : 0);
}
function statShift(p: LeaguePlayer, base: LeaguePlayer): [number, number, number] | null {
  const ref = (["shooting", "passing", "dribbling", "defending"] as const).find(k => typeof p[k] === "number" && typeof base[k] === "number");
  if (!ref) return null;
  const all = (p[ref] as number) - (base[ref] as number);
  const pe = typeof p.pace === "number" && typeof base.pace === "number" ? p.pace - base.pace - all : 0;
  const pf = typeof p.physical === "number" && typeof base.physical === "number" ? p.physical - base.physical - all : 0;
  return all || pe || pf ? [all, pe, pf] : null;
}

export function encodePlayer(p: LeaguePlayer): SavedPlayer {
  const base = fetched.get(p.id);
  const rest: Record<string, unknown> = {};
  let any = false;
  const held = (p as unknown as { sd?: [number, number, number] }).sd;
  const sd = (base ? statShift(p, base) : null) ?? (Array.isArray(held) ? held : null);
  if (sd) { rest.sd = sd; any = true; }
  for (const k of Object.keys(p)) {
    if (CORE.has(k)) continue;
    if (k === "sd") continue;
    if (sd && base && (STATS as readonly string[]).includes(k)
      && typeof base[k as StatKey] === "number" && p[k as StatKey] === (base[k as StatKey] as number) + shiftOf(k as StatKey, sd)) continue;
    const v = (p as unknown as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (base && k in base && same(v, (base as unknown as Record<string, unknown>)[k])) continue;
    rest[k] = v;
    any = true;
  }
  const core: [string, string, LeaguePlayer["position"], number, number, number] =
    [p.id, p.name, p.position, p.overall, p.goals, p.assists];
  return any ? [...core, rest as Partial<LeaguePlayer>] : core;
}

export function decodePlayer(t: unknown): LeaguePlayer | null {
  if (!Array.isArray(t) || typeof t[0] !== "string") return null;
  const [id, name, position, overall, goals, assists, rest] = t as SavedPlayer;
  const extra = rest && typeof rest === "object" ? rest : {};
  return {
    ...extra,
    id,
    name: typeof name === "string" ? name : id,
    position,
    overall: typeof overall === "number" ? overall : 60,
    goals: typeof goals === "number" ? goals : 0,
    assists: typeof assists === "number" ? assists : 0,
  };
}

export function encodeSquads(squads: LeagueSquad[]): SavedSquad[] {
  return squads.map(s => [s.club, s.players.map(encodePlayer)]);
}

export function decodeSquads(saved: unknown): LeagueSquad[] {
  if (!Array.isArray(saved)) return [];
  const out: LeagueSquad[] = [];
  for (const entry of saved) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Array.isArray(entry[1])) continue;
    const players: LeaguePlayer[] = [];
    for (const t of entry[1]) { const p = decodePlayer(t); if (p) players.push(p); }
    out.push({ club: entry[0], players });
  }
  return out;
}

/**
 * Fill in, from this session's fetches, every field a player is missing.
 *
 * Only ever ADDS a field the player does not have — anything the career set
 * (a grown rating, a new age, a flag) is never overwritten. Returns the same
 * array when there was nothing to fill, so a state update can be skipped.
 *
 * This also fills fields that were never dropped — e.g. the six attributes
 * the transfer window's rebuild does not carry (leagueTransfers.ts's
 * toLeaguePlayer). That is deliberate and is what every load already did:
 * the old load path replaced the whole wider world with a fresh fetch each
 * time (see reconcileExternalSquads), attributes included.
 */
export function hydrateSquads(squads: LeagueSquad[]): LeagueSquad[] {
  if (!fetched.size) return squads;
  let changed = false;
  const out = squads.map(s => {
    let clubChanged = false;
    const players = s.players.map(p => {
      const base = fetched.get(p.id);
      if (!base) return p;
      let next: LeaguePlayer | null = null;
      // A saved stat shift (see statShift above): the six stats are the
      // database's own, moved by it.
      const sd = (p as unknown as { sd?: [number, number, number] }).sd;
      for (const k of Object.keys(base)) {
        if (CORE.has(k)) continue;
        if ((p as unknown as Record<string, unknown>)[k] !== undefined) continue;
        let v = (base as unknown as Record<string, unknown>)[k];
        if (v === undefined) continue;
        if (Array.isArray(sd) && typeof v === "number" && (STATS as readonly string[]).includes(k)) v = v + shiftOf(k as StatKey, sd);
        if (!next) next = { ...p };
        (next as unknown as Record<string, unknown>)[k] = v;
      }
      if (Array.isArray(sd)) {
        if (!next) next = { ...p };
        delete (next as unknown as { sd?: unknown }).sd;
      }
      if (!next) return p;
      clubChanged = true;
      return next;
    });
    if (!clubChanged) return s;
    changed = true;
    return { ...s, players };
  });
  return changed ? out : squads;
}

/**
 * The blob that is actually written — locally and to the cloud. The two
 * squad arrays are swapped for their thin form; everything else is the
 * career exactly as it is.
 */
export function toSavedForm(career: CareerState): CareerState & { savedSquads?: SavedSquads } {
  const { leagueSquads, externalSquads, ...rest } = career;
  if (!leagueSquads && !externalSquads) return career;
  const savedSquads: SavedSquads = { v: 1 };
  if (leagueSquads) savedSquads.league = encodeSquads(leagueSquads);
  if (externalSquads) savedSquads.external = encodeSquads(externalSquads);
  return { ...rest, savedSquads } as CareerState & { savedSquads?: SavedSquads };
}

/**
 * The inverse, run on every save read back (local or cloud) before
 * anything else looks at it. A save from before this existed has full
 * arrays and no `savedSquads`, and passes through untouched.
 *
 * If a blob somehow has BOTH (an out-of-date copy of the game, still open
 * in another tab, loaded a thin save and wrote it back with a freshly
 * fetched full array beside it), the thin form wins: it is the one that
 * carries this career's own changes, the full array is a fresh fetch that
 * never saw them.
 */
export function fromSavedForm(raw: CareerState & { savedSquads?: SavedSquads }): CareerState {
  const saved = raw.savedSquads;
  if (!saved || typeof saved !== "object") return raw;
  const { savedSquads: _drop, ...rest } = raw;
  void _drop;
  const out: CareerState = { ...(rest as CareerState) };
  if (saved.league !== undefined) out.leagueSquads = decodeSquads(saved.league);
  if (saved.external !== undefined) out.externalSquads = decodeSquads(saved.external);
  return out;
}
