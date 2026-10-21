import type { CareerState, LeagueSquad, LeagueTeam } from "../types";
import { mulberry32, simulateFixtureScore } from "../season";
import { divisionOf, fixtureTimestamp, PRE_SEASON_WEEK } from "../calendar";
import { membershipOf, ratingFor, type DivisionMembership } from "../promotion";
import { europeanStrengthOf } from "../euro";
import { openCup, playCupRound, roundNamesFor, type CupState } from "../cups";
import { cupRoundWeek } from "../competitions";
import { simulateShootout } from "../shootout";
import { openWorldLeagues, advanceWorldLeagues } from "./leagues";
import { openWorldEuro, advanceWorldEuro } from "./europe";
import type { ShieldResult, WorldState, WorldEuro } from "./types";
import { SEASON_ONE_HOLDERS } from "./holders";
export { SEASON_ONE_HOLDERS };

/**
 * THE WORLD SEASON — read docs/WORLD_SEASON.md first.
 *
 * `openWorld` builds the season (every league you're not in, the European
 * competitions you're not in, the League Cup when you're not entered, both
 * shields). `advanceWorld` plays whatever's date has come. `finishWorld`
 * plays the rest, for the season's end. `worldOf` is the world as it stands
 * for any career (opening and catching up one that has none yet).
 *
 * THE SWITCH. `WORLD_LIVE` true: played after every match of yours (the
 * build, 19 Oct 2026). False: the end-of-season-only fallback — nothing is
 * played during the season and `finishWorld` plays it all at the end. Both
 * give the same tables: every round has its own seed and the ratings are
 * fixed when the world opens.
 */
export const WORLD_LIVE = true;

// ── Ratings for any club ────────────────────────────────────────────────────

/** Any club the career knows: on the English ladder, or anywhere in Europe. */
export function anyClubRating(career: CareerState, club: string, members: DivisionMembership = membershipOf(career)): number {
  const onLadder = Object.values(members).some(list => list.includes(club));
  if (onLadder || career.league.some(t => t.name === club)) return ratingFor(career, club, members);
  return europeanStrengthOf(club, career);
}

const ratedCache = new WeakMap<object, LeagueTeam[]>();
/**
 * Every club the career knows, as table rows carrying their rating — what
 * the cups read their strengths off (cups.ts cupStrength looks a club up in
 * the list it is handed before falling back to its own estimate). Your own
 * division's rows come first, with their live strengths.
 */
export function ratedTeams(career: CareerState): LeagueTeam[] {
  const hit = ratedCache.get(career as object);
  if (hit) return hit;
  const members = membershipOf(career);
  const seen = new Set(career.league.map(t => t.name));
  const out: LeagueTeam[] = [...career.league];
  for (const list of Object.values(members)) {
    for (const club of list) {
      if (seen.has(club)) continue;
      seen.add(club);
      out.push({ name: club, strength: ratingFor(career, club, members), played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
    }
  }
  ratedCache.set(career as object, out);
  return out;
}

// ── Squads, for naming scorers ──────────────────────────────────────────────

function squadLookup(career: CareerState): (club: string) => LeagueSquad | undefined {
  const m = new Map<string, LeagueSquad>();
  for (const s of career.externalSquads ?? []) m.set(s.club, s);
  for (const s of career.leagueSquads ?? []) m.set(s.club, s);
  return (club) => m.get(club);
}

// ── The two shields ─────────────────────────────────────────────────────────

export function shieldPairs(career: CareerState): ShieldResult[] {
  const w = career.season <= 1 ? SEASON_ONE_HOLDERS : career.lastSeasonWinners;
  if (!w) return [];
  const out: ShieldResult[] = [];
  const champion = w.premierLeague ?? (career.lastTopFlight?.[0]) ?? undefined;
  if (champion && w.faCup) {
    const runnerUp = ("premierLeagueRunnerUp" in w ? w.premierLeagueRunnerUp : undefined) ?? career.lastTopFlight?.[1];
    const a = champion === w.faCup ? (runnerUp ?? champion) : champion;
    if (a !== w.faCup) out.push({ competition: "Community Shield", home: a, away: w.faCup });
  }
  if (w.championsLeague && w.europaLeague && w.championsLeague !== w.europaLeague) {
    out.push({ competition: "Super Cup", home: w.championsLeague, away: w.europaLeague });
  }
  return out;
}

function playShield(career: CareerState, s: ShieldResult): ShieldResult {
  const rng = mulberry32((Math.imul(career.season, 7349) ^ (s.competition === "Super Cup" ? 991 : 337)) >>> 0);
  const a = anyClubRating(career, s.home), b = anyClubRating(career, s.away);
  const sc = simulateFixtureScore(a, b, rng);
  const out: ShieldResult = { ...s, hs: sc.home, as: sc.away };
  // Neither plays extra time (shootout.ts hasExtraTime): level goes to penalties.
  if (sc.home === sc.away) {
    const p = simulateShootout(a, b, rng);
    out.pens = { home: p.home, away: p.away };
    out.winner = p.home > p.away ? s.home : s.away;
  } else out.winner = sc.home > sc.away ? s.home : s.away;
  return out;
}

// ── Opening ─────────────────────────────────────────────────────────────────

export function openWorld(career: CareerState): WorldState {
  const division = divisionOf(career);
  const yours = career.player.club;
  const inEurope = career.euroState?.competition;
  const europe: WorldEuro[] = (["Champions League", "Europa League"] as const)
    .filter(c => c !== inEurope)
    .map(c => openWorldEuro(career, c));
  const enteredLeagueCup = (career.cupState ?? []).some(c => c.competition === "League Cup");
  let leagueCup: CupState | undefined;
  if (!enteredLeagueCup) {
    const premier = membershipOf(career).premier;
    const rated = ratedTeams(career);
    const table = premier.map(n => rated.find(t => t.name === n)!).filter(Boolean);
    leagueCup = openCup("League Cup", table, "premier", mulberry32((Math.imul(career.season, 6151) ^ 0x51ed) >>> 0));
  }
  // A shield your own club is in is played as your fixture (seedPreSeason).
  const shields = shieldPairs(career).filter(s => s.home !== yours && s.away !== yours);
  return { v: 1, season: career.season, division, leagues: openWorldLeagues(career, division), europe, ...(leagueCup ? { leagueCup } : {}), shields };
}

// ── Playing it ──────────────────────────────────────────────────────────────

function advanceLeagueCup(career: CareerState, cup: CupState, clock: number): CupState {
  let s = cup;
  const rated = ratedTeams(career);
  for (let guard = 0; guard < roundNamesFor(s.competition).length + 1 && !s.winner; guard++) {
    const idx = s.rounds.length - 1;
    const week = cupRoundWeek("League Cup", idx, 20, "premier", false);
    if (fixtureTimestamp(career.player.startYear, career.season, week, "cup", "premier") > clock) break;
    const next = playCupRound(s, rated, "", null, mulberry32((Math.imul(career.season, 4099) ^ Math.imul(idx + 1, 977)) >>> 0));
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Play everything whose date is at or before `clock` (ms). */
export function advanceWorld(career: CareerState, world: WorldState, clock: number): WorldState {
  const squadOf = squadLookup(career);
  const leagues = advanceWorldLeagues(career, world.leagues, clock, squadOf);
  const europe = world.europe.map(e => advanceWorldEuro(career, e, clock, squadOf));
  const leagueCup = world.leagueCup ? advanceLeagueCup(career, world.leagueCup, clock) : undefined;
  const shieldTime = fixtureTimestamp(career.player.startYear, career.season, PRE_SEASON_WEEK, "cup", world.division);
  const shields = world.shields.map(s => (s.winner || shieldTime > clock ? s : playShield(career, s)));
  const same = leagues === world.leagues && europe.every((e, i) => e === world.europe[i])
    && leagueCup === world.leagueCup && shields.every((s, i) => s === world.shields[i]);
  return same ? world : { ...world, leagues, europe, ...(leagueCup ? { leagueCup } : {}), shields };
}

/** The latest moment this season's own matches have reached. */
export function seasonClock(career: CareerState): number {
  const d = divisionOf(career);
  let t = -Infinity;
  for (const f of career.fixtures) {
    if (!f.played) continue;
    const ts = fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, d);
    if (ts > t) t = ts;
  }
  return t;
}

function current(career: CareerState): boolean {
  const w = career.world;
  return !!w && w.v === 1 && w.season === career.season && w.division === divisionOf(career);
}

/**
 * The world as it stands for this career. A save with none (a new season, a
 * save from before 19 Oct 2026) opens one and catches it up to the last match
 * played. Pure: nothing is saved here — creditMatchResult saves it.
 */
export function worldOf(career: CareerState): WorldState {
  if (current(career)) return career.world!;
  const opened = openWorld(career);
  return WORLD_LIVE ? advanceWorld(career, opened, seasonClock(career)) : opened;
}

/** After a match at `clock`: the world to save on the career. */
export function worldAfterMatch(career: CareerState, clock: number): WorldState {
  const w = worldOf(career);
  return WORLD_LIVE ? advanceWorld(career, w, clock) : w;
}

const finished = new WeakMap<object, WorldState>();
/**
 * The season played to its end: every round, every final. Pure and cached
 * per save object — the season-end screens all ask for it.
 */
export function finishWorld(career: CareerState): WorldState {
  const hit = finished.get(career as object);
  if (hit) return hit;
  const w = advanceWorld(career, worldOf(career), Infinity);
  finished.set(career as object, w);
  return w;
}

/** A finished world league's final table, by division. */
export function worldTable(career: CareerState, division: import("../calendar").CareerDivision): LeagueTeam[] | null {
  if (division === divisionOf(career)) return career.league;
  return finishWorld(career).leagues.find(l => l.division === division)?.teams ?? null;
}
