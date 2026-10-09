/**
 * THE DRAFT RECORDS BOARD'S CHECKS (8 Oct 2026, Harry: "close the cheat holes
 * that affect other players").
 *
 * /api/draft/records writes to draft_records, the public board (top 5 per
 * category, read by everyone). The phone sends the numbers, so the route
 * checks every one of them here before anything is written:
 *
 *   1. Real limits. A Premier League season is 38 games. "All competitions"
 *      adds at most FA Cup 5, League Cup 5 (6 games: a two-legged semi),
 *      Champions or Europa League 13 ties (8 league games + play-off, last 16,
 *      quarter, semi: two legs each, then the final), Super Cup 1, Community
 *      Shield 1. So at most 63 wins and 68 games in a season. A draft is 5
 *      seasons.
 *   2. The season must be the one already saved in draft_runs (same account,
 *      same season key), and agree with it wherever both hold the same number
 *      (wins, points, goals against, unbeaten run, squad rating, season).
 *   3. Player names are short, plain text. The route then checks each name is
 *      a real player in sofifa_players.
 *
 * Anything that fails is refused, never trimmed down to fit. Pure: no
 * database here, so tests/star/routeLocks.mts can run it.
 */

export const PL_GAMES = 38;
/** FA Cup 5 + League Cup 5 + Champions/Europa League 13 + Super Cup 1 + Community Shield 1. */
export const MAX_CUP_WINS = 25;
/** PL 38 + FA Cup 5 + League Cup 6 + Europe 17 + Super Cup 1 + Community Shield 1. */
export const MAX_ALL_GAMES = 68;
export const MAX_ALL_WINS = PL_GAMES + MAX_CUP_WINS; // 63
export const MAX_SEASONS = 5;
/** Generous: three goals (or assists) every game, all season, by one player. */
const PER_GAME = 3;
export const MAX_TROPHIES_PER_SEASON = 7; // league, FA Cup, League Cup, Europe, Super Cup, Shield… with room
export const MAX_NAME_CHARS = 60;

/** Largest believable value per (competition, record type), for one season. */
export const RECORD_CAPS: Record<string, number> = {
  pl_wins: PL_GAMES,
  pl_unbeaten: PL_GAMES,
  pl_goals: PL_GAMES * PER_GAME,
  pl_assists: PL_GAMES * PER_GAME,
  pl_clean_sheets: PL_GAMES,
  pl_goals_conceded: PL_GAMES * 10,
  pl_biggest_win: 15,
  pl_avg_rating: 100,
  pl_most_points: PL_GAMES * 3, // 114
  all_wins: MAX_ALL_WINS,
  all_unbeaten: PL_GAMES, // the client sends the league unbeaten run here too
  all_goals: MAX_ALL_GAMES * PER_GAME,
  all_assists: MAX_ALL_GAMES * PER_GAME,
  all_clean_sheets: MAX_ALL_GAMES,
  all_goals_conceded: MAX_ALL_GAMES * 10,
  all_biggest_win: 15,
  all_avg_rating: 100,
  all_squad_ovr: 99,
};

/** Career caps grow with the season number (at most 5). */
export function careerCap(recordType: string, seasonNumber: number): number {
  const s = Math.max(1, Math.min(MAX_SEASONS, seasonNumber));
  switch (recordType) {
    case "career_goals":
    case "career_assists": return s * MAX_ALL_GAMES * PER_GAME;
    case "career_trophies": return s * MAX_TROPHIES_PER_SEASON;
    case "career_avg_rating": return 100;
    default: return 0;
  }
}

/** The saved season (a draft_runs row) the record must agree with. */
export interface SavedRun {
  season_number: number | null;
  finish?: number | null;
  points: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  avg_ovr: number | null;
  longest_unbeaten_run?: number | null;
}

export interface RecordCandidate {
  competition: "pl" | "all" | "career";
  record_type: string;
  value: number;
  player_name: string | null;
  player_ovr: number | null;
  /** true: player_name is a real player and must be found in sofifa_players. */
  needsPlayer: boolean;
}

interface Entry { value?: unknown; playerName?: unknown; playerOvr?: unknown }
interface Team { value?: unknown; teamOvr?: unknown; score?: unknown }
export interface RecordBody {
  pl?: Record<string, unknown>;
  all?: Record<string, unknown>;
  career?: Record<string, unknown>;
  seasonNumber?: unknown;
  eventKey?: unknown;
}

/** A season key as the client makes it (DraftResult.tsx runKey). */
export const EVENT_KEY = /^[A-Za-z0-9._-]{1,120}$/;

// Built from a string: the project's TypeScript target rejects a /u literal.
const NAME_RE = new RegExp("^[\\p{L}\\p{M}][\\p{L}\\p{M} .'’-]*$", "u");

/** A player's name: trimmed, 1-60 characters, letters (any language), spaces and . ' - only. */
export function cleanPlayerName(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim().replace(/\s+/g, " ");
  if (t.length < 1 || t.length > MAX_NAME_CHARS) return null;
  if (!NAME_RE.test(t)) return null;
  return t;
}

/** "5-0": the winning score of a biggest-win record. */
export function parseScore(x: unknown): { for: number; against: number } | null {
  if (typeof x !== "string") return null;
  const m = x.match(/^(\d{1,2})-(\d{1,2})$/);
  return m ? { for: Number(m[1]), against: Number(m[2]) } : null;
}

const num = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : Number.NaN;
  return Number.isFinite(n) ? n : null;
};
const ovr = (x: unknown): number | null => {
  if (x == null) return null;
  const n = num(x);
  return n != null && Number.isInteger(n) && n >= 1 && n <= 99 ? n : Number.NaN;
};

export interface CheckResult {
  ok: boolean;
  /** Plain-English reasons, one per failed check. */
  errors: string[];
  candidates: RecordCandidate[];
}

/**
 * Every record in the body, checked against the real limits and the saved
 * season. `run` is null when no saved season matches: that alone fails.
 * Zero values are skipped (nothing to post), as before.
 */
export function checkRecordBody(body: RecordBody, run: SavedRun | null): CheckResult {
  const errors: string[] = [];
  const candidates: RecordCandidate[] = [];
  const fail = (s: string) => errors.push(s);

  const season = num(body.seasonNumber);
  if (season == null || !Number.isInteger(season) || season < 1 || season > MAX_SEASONS) {
    fail(`season number must be 1-${MAX_SEASONS}`);
  }
  if (typeof body.eventKey !== "string" || !EVENT_KEY.test(body.eventKey)) fail("missing season key");
  if (!body.pl || typeof body.pl !== "object" || !body.all || typeof body.all !== "object") fail("missing pl/all record data");
  if (!run) fail("no saved season matches this one");
  if (errors.length) return { ok: false, errors, candidates };
  const r = run!;
  const s = season!;
  if (r.season_number != null && r.season_number !== s) fail(`season ${s} does not match the saved season ${r.season_number}`);

  const add = (competition: RecordCandidate["competition"], record_type: string, raw: unknown, kind: "entry" | "team" | "count") => {
    if (raw == null) return;
    let valueRaw: unknown, name: unknown = null, ovrRaw: unknown = null, score: unknown = undefined;
    if (kind === "count") valueRaw = raw;
    else if (typeof raw !== "object") { fail(`${competition} ${record_type}: not a record`); return; }
    else if (kind === "entry") { const e = raw as Entry; valueRaw = e.value; name = e.playerName; ovrRaw = e.playerOvr; }
    else { const t = raw as Team; valueRaw = t.value; ovrRaw = t.teamOvr; score = t.score; }

    const value = num(valueRaw);
    if (value == null) { fail(`${competition} ${record_type}: not a number`); return; }
    if (value === 0) return; // nothing to post
    if (value < 0 || !Number.isInteger(value)) { fail(`${competition} ${record_type}: ${value} is not a whole positive number`); return; }
    const cap = competition === "career" ? careerCap(record_type, s) : RECORD_CAPS[`${competition}_${record_type}`];
    if (!cap) { fail(`${competition} ${record_type}: unknown record`); return; }
    if (value > cap) { fail(`${competition} ${record_type}: ${value} is over the real limit of ${cap}`); return; }

    const o = ovr(ovrRaw);
    if (Number.isNaN(o)) { fail(`${competition} ${record_type}: rating must be 1-99`); return; }

    let player_name: string | null = null;
    let needsPlayer = false;
    if (kind === "entry") {
      if (name == null || name === "") { fail(`${competition} ${record_type}: no player named`); return; }
      const clean = cleanPlayerName(name);
      if (!clean) { fail(`${competition} ${record_type}: player name is not a real name`); return; }
      player_name = clean;
      needsPlayer = true;
    } else if (score !== undefined && score !== null) {
      const sc = parseScore(score);
      if (!sc || sc.for - sc.against !== value) { fail(`${competition} ${record_type}: score "${String(score)}" does not give a ${value}-goal win`); return; }
      player_name = `${sc.for}-${sc.against}`;
    }
    candidates.push({ competition, record_type, value, player_name, player_ovr: o ?? null, needsPlayer });
  };

  const pl = body.pl as Record<string, unknown>;
  const all = body.all as Record<string, unknown>;
  add("pl", "wins", pl.wins, "team");
  add("pl", "unbeaten", pl.unbeaten, "team");
  add("pl", "goals", pl.goals, "entry");
  add("pl", "assists", pl.assists, "entry");
  add("pl", "clean_sheets", pl.cleanSheets, "entry");
  add("pl", "goals_conceded", pl.goalsConceded, "team");
  add("pl", "biggest_win", pl.biggestWin, "team");
  add("pl", "avg_rating", pl.avgRating, "entry");
  add("pl", "most_points", pl.mostPoints, "team");
  add("all", "wins", all.wins, "team");
  add("all", "unbeaten", all.unbeaten, "team");
  add("all", "goals", all.goals, "entry");
  add("all", "assists", all.assists, "entry");
  add("all", "clean_sheets", all.cleanSheets, "entry");
  add("all", "goals_conceded", all.goalsConceded, "team");
  add("all", "biggest_win", all.biggestWin, "team");
  add("all", "avg_rating", all.avgRating, "entry");
  add("all", "squad_ovr", all.squadOvr, "team");
  const career = body.career && typeof body.career === "object" ? body.career as Record<string, unknown> : null;
  if (career) {
    add("career", "career_goals", career.goals, "entry");
    add("career", "career_assists", career.assists, "entry");
    add("career", "career_trophies", career.trophies, "count");
    add("career", "career_avg_rating", career.avgRating, "entry");
  }

  // ── Agree with the saved season, and with itself ──────────────────────────
  const v = (comp: string, type: string) => candidates.find(c => c.competition === comp && c.record_type === type)?.value ?? 0;
  const same = (label: string, sent: number, saved: number | null | undefined) => {
    if (saved == null || sent === 0) return;
    if (sent !== saved) fail(`${label}: sent ${sent}, the saved season says ${saved}`);
  };
  const atMost = (label: string, sent: number, limit: number | null | undefined) => {
    if (limit == null) return;
    if (sent > limit) fail(`${label}: ${sent} is more than ${limit} in the saved season`);
  };
  same("league wins", v("pl", "wins"), r.wins);
  same("league points", v("pl", "most_points"), r.points);
  same("league goals against", v("pl", "goals_conceded"), r.goals_against);
  same("unbeaten run", v("pl", "unbeaten"), r.longest_unbeaten_run);
  same("unbeaten run (all)", v("all", "unbeaten"), r.longest_unbeaten_run);
  if (r.avg_ovr) same("squad rating", v("all", "squad_ovr"), r.avg_ovr);
  if (r.wins != null && r.draws != null && r.points != null && r.points !== r.wins * 3 + r.draws) {
    fail(`saved season: ${r.points} points does not fit ${r.wins} wins and ${r.draws} draws`);
  }
  if (r.wins != null && r.draws != null && r.losses != null && r.wins + r.draws + r.losses > PL_GAMES) {
    fail("saved season has more than 38 league games");
  }
  atMost("league top scorer", v("pl", "goals"), r.goals_for);
  atMost("league top assists", v("pl", "assists"), r.goals_for);
  atMost("league biggest win", v("pl", "biggest_win"), r.goals_for);
  if (r.wins != null && r.draws != null) atMost("league clean sheets", v("pl", "clean_sheets"), r.wins + r.draws);
  if (r.wins != null) {
    const allWins = v("all", "wins");
    if (allWins && (allWins < r.wins || allWins > r.wins + MAX_CUP_WINS)) fail(`all-competition wins ${allWins} do not fit ${r.wins} league wins`);
  }
  const allConceded = v("all", "goals_conceded");
  if (allConceded && r.goals_against != null && allConceded < r.goals_against) fail(`all-competition goals against ${allConceded} is fewer than the league's ${r.goals_against}`);
  const order = (label: string, low: number, high: number) => { if (low && high && high < low) fail(`${label}: ${high} is less than ${low}`); };
  order("all-competition top scorer vs league", v("pl", "goals"), v("all", "goals"));
  order("all-competition top assists vs league", v("pl", "assists"), v("all", "assists"));
  order("all-competition biggest win vs league", v("pl", "biggest_win"), v("all", "biggest_win"));
  order("career top scorer vs this season", v("all", "goals"), v("career", "career_goals"));

  return { ok: errors.length === 0, errors, candidates };
}
