/**
 * YOUR INTERNATIONAL CAREER on top of the world (world.ts): the national
 * manager, call-ups for each window and each tournament, your matches on the
 * calendar on their real dates, club games you miss while you are away, your
 * results feeding back into the world, and the trophies you win.
 *
 * What the save keeps (`IntlState`) is small: the nation, the national
 * manager's opinion of you (0-100), each window/tournament's answer, the
 * real-player strength adjustment per nation per season, and your own
 * results by match id. Everything else is replayed (replay.ts).
 *
 * THE NATIONAL MANAGER (Mikey, 12 Oct 2026: "in the relations area … very
 * fair to have that start at zero … a big nation will not even acknowledge
 * you … harder for England than DR Congo"). A bar from 0 to 100, starting at
 * 0, shown in Relations. It moves after every club match towards a TARGET:
 *
 *   effective = your overall + division penalty + 2 if you start for your club
 *     division penalty: Premier League (or a top club abroad) 0,
 *     Championship −4, League One −8, League Two −11, National League −14,
 *     lower −16
 *   squad bar = the overall the nation's squad is picked at:
 *     the expected XI for its ranking (38.9 + 0.533 × strength, fitted on the
 *     32 nations with 25+ real players in the game's player data) − 3,
 *     or, if higher, the second-best real player in your position − 1
 *   target = 34 + 5 × (effective − squad bar), kept within 0-100
 *
 *   after a club match you play:  bar += 12% of (target − bar)
 *                                   + (rating − 6.6) × 1.2 × division weight
 *   after one you miss:            bar += 4% of (target − bar) − 0.4
 *   after an international:        bar += (rating − 6.6) × 2.5, +1 win, −1 loss
 *
 * The same thresholds as your club manager (selection.ts): from 34 you are in
 * the squad (a coin flip at 34, nearly sure by 45), from 55 you start.
 * Rotation: in a friendly a starter below 75 is rested about one game in
 * three; after a defeat in which you rated under 6.0 you start on the bench
 * the next match (unless you are 75+); at a tournament the best XI plays.
 */
import type { CareerState, Fixture, MatchStats, SquadPlayer, LeaguePlayer, Trophy, Competition } from "../types";
import { worldAt } from "./replay";
import { type World, type WorldMatch, type WorldInputs, type CompKind } from "./world";
import { nationFor, rankingStrength } from "./nations";
import { windowFor, type WindowKind } from "./windows";
import { winnerOf, loserOf, played, rngFor, table } from "./engine";
import {
  divisionOf, fixtureTimestamp, seasonStartYear, intlWeek, openingSaturday, stopsForBreaks, type CareerDivision,
} from "../calendar";
import { displayOverall } from "../rating";
import { clubDivision } from "../energy";
import { generateSquad, clubNameSeed } from "../squadData";
import { fakeFaceFor } from "../fakeFaces";
import { madeUpNames } from "../nationNames";

const DAY = 86_400_000;

export interface PlayedResult {
  hs: number; as: number; pens?: { hs: number; as: number }; et?: boolean;
  /** Your own goals and assists in that match (absent in saves from before 12 Oct 2026). */
  mine?: { g: number; a: number };
}

export interface IntlState {
  v: 1;
  /** Your nation (the game's spelling), fixed when the career starts. */
  nation: string;
  /** Calendar year the game's first season starts in. */
  firstYear: number;
  /** Season → nation → strength adjustment from the real players the save knows. */
  xi: Record<number, Record<string, number>>;
  /** Your results, by world match id, in the world match's home/away terms. */
  played: Record<string, PlayedResult>;
  /** The national manager's opinion of you, 0-100. */
  manager: number;
  /** Answered call-ups: period key → called or not, and the chance it was. */
  periods: Record<string, { called: boolean; chance: number; starter: boolean }>;
  /** Finals already turned into trophies (edition ids). */
  awarded: string[];
  /** Your last international, for rotation. */
  last?: { lost: boolean; rating: number };
  /** Season → how far the world had been played on its Ballon d'Or night.
   *  The next night counts international goals from there (intl/scorers.ts). */
  nights?: Record<number, number>;
}

export const SQUAD_AT = 34;
export const START_AT = 55;
const SURE_START = 75;

export const TOURNAMENT_COMPS: CompKind[] = [
  "World Cup", "European Championship", "Copa América", "Africa Cup of Nations", "Asian Cup",
  "Gold Cup", "OFC Nations Cup",
];

// ── State ───────────────────────────────────────────────────────────────────

export function myNation(career: Pick<CareerState, "player">): string {
  return nationFor(career.player.nationality)?.name ?? "England";
}

export function intlOf(career: CareerState): IntlState {
  return career.intl ?? {
    v: 1, nation: myNation(career),
    firstYear: seasonStartYear(career.player.startYear, 1),
    xi: {}, played: {}, manager: 0, periods: {}, awarded: [],
  };
}

export function inputsOf(s: IntlState): WorldInputs {
  return { xi: s.xi, played: s.played, firstYear: s.firstYear };
}

function ts(career: CareerState, f: Fixture): number {
  return fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, divisionOf(career));
}

/**
 * How far the world may be played: up to just before your next match of any
 * kind (so none of your own matches is ever played without you), or, with
 * nothing on the calendar, a day past your last one (so a knockout's next
 * round is drawn).
 */
export function frontier(career: CareerState): number {
  let next = Infinity, last = -Infinity;
  for (const f of career.fixtures ?? []) {
    // An international's day starts at 11:30 here: the day's friendlies are
    // drawn at 11:00 and every match kicks off at noon.
    const t = ts(career, f) + (f.kind === "international" ? 11.5 * 3_600_000 : 0);
    if (f.played) last = Math.max(last, t); else next = Math.min(next, t);
  }
  if (next < Infinity) return next - 60_000;
  if (last > -Infinity) return last + DAY + 3_600_000;
  return openingSaturday(seasonStartYear(career.player.startYear, career.season)).getTime() - DAY;
}

export function worldOf(career: CareerState, until = frontier(career)): World {
  const s = intlOf(career);
  const nation = s.nation;
  const start = openingSaturday(seasonStartYear(career.player.startYear, 1)).getTime();
  // Your nation's matches wait for the squad to be named (or for you to
  // play them); a window or tournament you were left out of is played.
  // Left out of a break in a league that stops for it (Mikey, 12 Oct 2026):
  // the matches wait on your calendar until you watch them (watch fixtures).
  const watching = stopsForBreaks(divisionOf(career));
  const watched = new Set((career.fixtures ?? []).filter((f) => f.watch && f.played).map((f) => f.intlId));
  const since = lastPlayedTime(career);
  const hold = (m: WorldMatch) => {
    if ((m.home !== nation && m.away !== nation) || m.date < start || s.played[m.id]) return false;
    const decided = s.periods[periodKeyOf(m)];
    if (decided?.called !== false) return true;
    // Only what is still ahead of you: a break already behind you (an old
    // save, a Dev Skip) is played as before.
    return watching && !TOURNAMENT_COMPS.includes(m.comp) && !watched.has(m.id) && m.date > since && inSeason(career, m.date);
  };
  return worldAt(inputsOf(s), until, hold);
}

/** The window or tournament a match belongs to. */
export function periodKeyOf(m: WorldMatch): string {
  if (TOURNAMENT_COMPS.includes(m.comp)) return `T:${m.edition}`;
  return windowKeyOf(m.date)?.key ?? `D:${m.date}`;
}

// ── Real players move a nation's strength ───────────────────────────────────

/** The expected best-XI average for a ranking strength (fitted, see top). */
export function expectedXi(strength: number): number {
  return 38.93 + 0.533 * strength;
}

export interface PoolPlayer { name: string; nation: string; overall: number; position: string; positions?: string[]; club?: string; image?: string; age?: number }

export function realPlayers(career: CareerState): PoolPlayer[] {
  const out = new Map<string, PoolPlayer>();
  const add = (p: PoolPlayer) => { if (p.nation && !out.has(`${p.nation}|${p.name}`)) out.set(`${p.nation}|${p.name}`, p); };
  for (const p of career.squad ?? []) {
    const n = nationFor(p.nationality)?.name;
    if (n && p.overall) add({ name: p.name, nation: n, overall: p.overall, position: p.position, positions: p.positions, club: career.player.club, image: p.imageUrl, age: p.age });
  }
  for (const sq of [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]) {
    for (const p of sq.players) {
      const n = nationFor(p.nation)?.name;
      if (n && p.overall) add({ name: p.name, nation: n, overall: p.overall, position: p.position, positions: p.positions, club: sq.club, image: p.image, age: p.age });
    }
  }
  return Array.from(out.values());
}

/**
 * Each nation's strength adjustment this season: its best eleven real
 * players the save knows (gaps filled at the level its ranking expects),
 * against that expected level, in strength points (÷ 0.533), within ±8.
 */
export function xiAdjustments(career: CareerState): Record<string, number> {
  const by = new Map<string, number[]>();
  for (const p of realPlayers(career)) {
    const xs = by.get(p.nation) ?? [];
    xs.push(p.overall);
    by.set(p.nation, xs);
  }
  // You count for your nation too.
  const mine = myNation(career);
  const me = displayOverall(career.starRating ?? 2.5);
  by.set(mine, [...(by.get(mine) ?? []), me]);
  const out: Record<string, number> = {};
  for (const [n, xs] of Array.from(by.entries())) {
    const nat = nationFor(n);
    if (!nat) continue;
    const exp = expectedXi(rankingStrength(nat.points));
    const best = xs.sort((a, b) => b - a).slice(0, 11);
    const filled = [...best, ...Array(11 - best.length).fill(exp)];
    const avg = filled.reduce((s, x) => s + x, 0) / 11;
    const adj = Math.max(-8, Math.min(8, (avg - exp) / 0.533));
    if (Math.abs(adj) >= 0.5) out[n] = Math.round(adj * 10) / 10;
  }
  return out;
}

// ── The national manager ────────────────────────────────────────────────────

const PENALTY: Record<string, number> = {
  premier: 0, championship: -4, league_one: -8, league_two: -11,
  national_league: -14, national_league_north: -14, national_league_south: -14,
};

export function divisionPenalty(div: CareerDivision | string | null): number {
  if (!div) return 0;
  return PENALTY[div] ?? -16;
}

function posGroup(p: string): string {
  if (p === "GK") return "GK";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(p)) return "MID";
  return "FWD";
}

/** The overall a nation picks its squad at, for a player in your position. */
export function squadBar(career: CareerState, nation = myNation(career)): number {
  const nat = nationFor(nation);
  const xi = intlOf(career).xi[career.season]?.[nation] ?? 0;
  const base = expectedXi(rankingStrength(nat?.points ?? 1192) + xi) - 3;
  const g = posGroup(career.player.position ?? "ST");
  const rivals = realPlayers(career).filter((p) => p.nation === nation && posGroup(p.position) === g)
    .map((p) => p.overall).sort((a, b) => b - a);
  return Math.max(base, (rivals[1] ?? 0) - 1);
}

export function effectiveLevel(career: CareerState): number {
  const overall = displayOverall(career.starRating ?? 2.5);
  const starter = career.status === "1st Team" ? 2 : 0;
  return overall + divisionPenalty(divisionOf(career)) + starter;
}

export function managerTarget(career: CareerState): number {
  return Math.max(0, Math.min(100, SQUAD_AT + 5 * (effectiveLevel(career) - squadBar(career))));
}

function clamp100(x: number) { return Math.max(0, Math.min(100, x)); }

/** After a club match: played (with your rating) or missed. */
export function managerAfterClubMatch(career: CareerState, rating: number | null, away = false): CareerState {
  const s = intlOf(career);
  const target = managerTarget(career);
  const weight = 1 + divisionPenalty(divisionOf(career)) / 20;
  const bar = rating === null
    ? s.manager + 0.04 * (target - s.manager) - (away ? 0 : 0.4)
    : s.manager + 0.12 * (target - s.manager) + (rating - 6.6) * 1.2 * weight;
  return { ...career, intl: { ...s, manager: Math.round(clamp100(bar) * 10) / 10 } };
}

/** One plain line for Relations and the call-up screen. */
export function managerLine(career: CareerState): string {
  const s = intlOf(career);
  const n = s.nation;
  if (s.manager >= SURE_START) return `${n}'s manager builds the team around you.`;
  if (s.manager >= START_AT) return `${n}'s manager sees you as a starter.`;
  if (s.manager >= SQUAD_AT) return `${n}'s manager has you in his squad plans.`;
  if (s.manager >= 20) return `${n}'s manager is watching you.`;
  const gap = squadBar(career) - effectiveLevel(career);
  if (gap > 6) return `${n}'s manager doesn't know your name yet. Their squad is picked at about ${Math.round(squadBar(career))}.`;
  return `${n}'s manager has heard of you. Keep playing well.`;
}

// ── Periods: a window or a tournament ───────────────────────────────────────

export interface Period {
  key: string;
  kind: "window" | "tournament";
  /** "September–October 2026", "Africa Cup of Nations 2027". */
  label: string;
  /** Your nation's matches in it (known so far). */
  matches: WorldMatch[];
  /** First and last day it can keep you away from your club. */
  start: number;
  end: number;
  edition?: string;
  comp?: CompKind;
}

const WINDOW_NAMES: Record<WindowKind, string> = { sepoct: "September–October", nov: "November", mar: "March", jun: "June" };

function windowKeyOf(t: number): { key: string; label: string; start: number; end: number } | null {
  const y = new Date(t).getUTCFullYear();
  for (const k of ["sepoct", "nov", "mar", "jun"] as WindowKind[]) {
    const w = windowFor(y, k);
    if (w && t >= w.start.getTime() && t <= w.end.getTime() + DAY) {
      return { key: `W:${y}-${k}`, label: `${WINDOW_NAMES[k]} ${y}`, start: w.start.getTime(), end: w.end.getTime() + DAY };
    }
  }
  return null;
}

/** Is the nation still in this tournament (as far as the world has got)? */
function alive(w: World, edition: string, nation: string): boolean {
  const ms = w.edition(edition).filter((m) => m.home === nation || m.away === nation);
  if (ms.some((m) => !played(m))) return true;
  const result = w.facts.get(`${edition}:result`);
  if (result) return false;
  const last = ms.sort((a, b) => b.date - a.date)[0];
  if (!last) return false;
  if (!last.group) return winnerOf(last) === nation;
  // After the group stage: through if the first knockout round has them.
  const tables = w.facts.get(`${edition}:tables`) as Record<string, { name: string }[]> | undefined;
  if (!tables) return true; // group stage not finished yet
  return w.edition(edition).some((m) => !m.group && (m.home === nation || m.away === nation));
}

/** Your nation's periods from `from` on (windows and tournaments). */
export function periodsFrom(w: World, nation: string, from: number): Period[] {
  const out = new Map<string, Period>();
  for (const m of w.matches) {
    if (m.date < from || (m.home !== nation && m.away !== nation)) continue;
    if (TOURNAMENT_COMPS.includes(m.comp)) {
      const key = `T:${m.edition}`;
      const p = out.get(key);
      if (p) { p.matches.push(m); continue; }
      const all = w.edition(m.edition);
      const start = Math.min(...all.map((x) => x.date));
      const lastAll = Math.max(...all.map((x) => x.date));
      out.set(key, {
        key, kind: "tournament", label: `${m.comp} ${new Date(lastAll).getUTCFullYear()}`,
        matches: [m], start: start - 5 * DAY, end: lastAll + DAY, edition: m.edition, comp: m.comp,
      });
    } else {
      const wk = windowKeyOf(m.date);
      if (!wk) continue;
      const p = out.get(wk.key);
      if (p) p.matches.push(m);
      else out.set(wk.key, { key: wk.key, kind: "window", label: wk.label, matches: [m], start: wk.start, end: wk.end });
    }
  }
  const list = Array.from(out.values());
  for (const p of list) {
    p.matches.sort((a, b) => a.date - b.date);
    if (p.kind === "tournament" && p.edition && !alive(w, p.edition, nation)) {
      p.end = p.matches[p.matches.length - 1].date + DAY;
    }
  }
  return list.sort((a, b) => a.start - b.start);
}

/** The club season's last day (31 July). */
function seasonEnd(career: CareerState): number {
  return Date.UTC(seasonStartYear(career.player.startYear, career.season) + 1, 6, 31);
}

function inSeason(career: CareerState, t: number): boolean {
  return t >= openingSaturday(seasonStartYear(career.player.startYear, career.season)).getTime() && t <= seasonEnd(career);
}

/** The season is over (Ballon d'Or night has been): remember how far the
 *  world had been played, so the next night counts from there. */
export function markBallonDorNight(career: CareerState): IntlState {
  const s = intlOf(career);
  return { ...s, nights: { ...(s.nights ?? {}), [career.season]: worldOf(career).now } };
}

/** When the Ballon d'Or year `season` starts: the night before it, or (a
 *  save from before 12 Oct 2026, or the first season) the June before its
 *  club season, or the career's own start. */
export function ballonDorYearStart(career: CareerState, season: number): number {
  const s = intlOf(career);
  const prev = s.nights?.[season - 1];
  if (prev != null) return prev + 1; // after the night, never on it
  const careerStart = openingSaturday(seasonStartYear(career.player.startYear, 1)).getTime();
  if (season <= 1) return careerStart;
  return Math.max(careerStart, Date.UTC(seasonStartYear(career.player.startYear, season), 5, 1));
}

/** When your last played match (of any kind) was. */
function lastPlayedTime(career: CareerState): number {
  let t = -Infinity;
  for (const f of career.fixtures ?? []) if (f.played) t = Math.max(t, ts(career, f));
  return t;
}

function nextClubTime(career: CareerState): number {
  let t = Infinity;
  for (const f of career.fixtures ?? []) if (!f.played && f.kind !== "international") t = Math.min(t, ts(career, f));
  return t;
}

/**
 * The window or tournament whose squad is to be named now: your nation's
 * first match in it is before your next club match (or the season's club
 * games are all played), and it has not been answered.
 */
export function periodDue(career: CareerState): Period | null {
  if (!career.player?.club || !career.fixtures?.length || !Number.isFinite(frontier(career))) return null;
  const s = intlOf(career);
  const w = worldOf(career);
  const from = Math.max(frontier(career) - 40 * DAY, openingSaturday(seasonStartYear(career.player.startYear, career.season)).getTime());
  const limit = Math.min(nextClubTime(career), seasonEnd(career));
  for (const p of periodsFrom(w, s.nation, from)) {
    if (s.periods[p.key]) continue;
    const first = p.matches.find((m) => !played(m) && !s.played[m.id]);
    if (!first || first.date < lastPlayedTime(career)) continue;
    if (first.date <= limit + DAY && first.date <= seasonEnd(career)) return p;
  }
  return null;
}

// ── The decision ────────────────────────────────────────────────────────────

export interface IntlDecision {
  period: Period;
  nation: string;
  called: boolean;
  chance: number;
  starter: boolean;
  reason: string;
  /** The manager's bar and the line under it. */
  manager: number;
  line: string;
}

export function callUpChanceFor(career: CareerState, period?: Period): number {
  if (career.injury) return 0;
  const s = intlOf(career);
  // In the squads before a tournament: the men in the last squads go.
  const lastCalled = Object.values(s.periods).slice(-3).filter((p) => p.called).length;
  const bonus = period?.kind === "tournament" ? 2 * lastCalled : 0;
  const x = (s.manager + bonus - SQUAD_AT) / 4;
  return Math.max(0.02, Math.min(0.98, 1 / (1 + Math.exp(-x))));
}

export function decide(career: CareerState, period: Period): IntlDecision {
  const s = intlOf(career);
  const chance = callUpChanceFor(career, period);
  const roll = rngFor(`callup|${career.player.firstName} ${career.player.lastName}|${period.key}`)();
  const called = roll < chance;
  const starter = s.manager >= START_AT;
  const reason = career.injury ? "You're injured, so the manager leaves you out."
    : called ? (starter ? "You're one of his first names on the team sheet." : "You're in the squad. Earn a start.")
    : s.manager < 15 ? `${s.nation}'s manager isn't looking at you yet.`
    : "Close, but not this time. Keep playing well.";
  return { period, nation: s.nation, called, chance, starter, reason, manager: s.manager, line: managerLine(career) };
}

const COMP_NAMES: Record<CompKind, Competition> = {
  "World Cup": "World Cup", "World Cup Qualifier": "World Cup Qualifier", "World Cup Play-Off": "World Cup Play-Off",
  "European Championship": "European Championship", "Euro Qualifier": "Euro Qualifier",
  "Nations League": "Nations League", "Copa América": "Copa América",
  "Africa Cup of Nations": "Africa Cup of Nations", "AFCON Qualifier": "AFCON Qualifier",
  "Asian Cup": "Asian Cup", "Asian Cup Qualifier": "Asian Cup Qualifier", "Gold Cup": "Gold Cup",
  "Gold Cup Qualifier": "Gold Cup Qualifier", "CONCACAF Nations League": "CONCACAF Nations League",
  "OFC Nations Cup": "OFC Nations Cup", "International Friendly": "International Friendly",
};

function fixtureFor(career: CareerState, w: World, m: WorldMatch, nation: string): Fixture {
  const home = m.home === nation;
  const opp = home ? m.away : m.home;
  let intlKo: Fixture["intlKo"];
  if (m.firstLeg) {
    const f = w.byId.get(m.firstLeg);
    const r = f && (career.intl?.played[f.id] ?? (played(f) ? { hs: f.hs!, as: f.as! } : null));
    if (f && r) intlKo = { level: "et-pens", firstLeg: f.home === nation ? { us: r.hs, them: r.as } : { us: r.as, them: r.hs } };
  } else if (m.level) intlKo = { level: m.level };
  return {
    week: intlWeek(career.player.startYear, career.season, new Date(m.date)),
    opponent: opp,
    home,
    played: false,
    ...(intlKo ? { intlKo } : {}),
    competition: COMP_NAMES[m.comp],
    kind: "international",
    round: m.stage,
    opponentStrength: Math.round(w.strength(opp, m.date)),
    intlId: m.id,
  };
}

export function applyDecision(career: CareerState, d: IntlDecision): CareerState {
  const s = intlOf(career);
  const periods = { ...s.periods, [d.period.key]: { called: d.called, chance: Math.round(d.chance * 100) / 100, starter: d.starter } };
  return syncIntl({ ...career, intl: { ...s, periods } });
}

// ── Keeping the calendar in step with the world ─────────────────────────────

/**
 * Put your called-up periods' matches on the calendar (and take off any that
 * no longer exist — a knockout opponent decided by your own result), write
 * this season's real-player adjustments, and hand out trophies. Called after
 * every change that can move the world.
 */
export function syncIntl(career: CareerState): CareerState {
  if (!career.player?.club || !Number.isFinite(frontier(career))) return career;
  let s = intlOf(career);
  if (!s.xi[career.season]) s = { ...s, xi: { ...s.xi, [career.season]: xiAdjustments(career) } };
  career = { ...career, intl: s };
  const w = worldOf(career);
  const nation = s.nation;
  const from = openingSaturday(seasonStartYear(career.player.startYear, career.season)).getTime();
  // A window jumped past (a Dev Skip, an old save) is passed, not offered
  // late: its matches are played without you.
  const lastT = lastPlayedTime(career);
  let passed: Record<string, { called: boolean; chance: number; starter: boolean }> | null = null;
  for (const p of periodsFrom(w, nation, from)) {
    if (s.periods[p.key]) continue;
    const first = p.matches.find((m) => !played(m) && !s.played[m.id]);
    if (first && first.date < lastT) (passed ??= { ...s.periods })[p.key] = { called: false, chance: 0, starter: false };
  }
  if (passed) {
    s = { ...s, periods: passed };
    career = { ...career, intl: s };
    return syncIntl(career);
  }
  const wanted = new Map<string, WorldMatch>();
  for (const p of periodsFrom(w, nation, from)) {
    if (!s.periods[p.key]?.called || p.start > seasonEnd(career)) continue;
    for (const m of p.matches) if (!s.played[m.id] && !played(m) && m.date <= seasonEnd(career)) wanted.set(m.id, m);
  }
  // Left out, in a league that stops for the break: your nation's matches go
  // on the calendar to watch (Plan B, Mikey 12 Oct 2026).
  const watchList = new Map<string, WorldMatch>();
  if (stopsForBreaks(divisionOf(career))) {
    for (const p of periodsFrom(w, nation, from)) {
      if (p.kind !== "window" || s.periods[p.key]?.called !== false) continue;
      for (const m of p.matches) {
        if (!s.played[m.id] && !played(m) && inSeason(career, m.date) && m.date > lastT) watchList.set(m.id, m);
      }
    }
  }
  // Unplayed internationals are rebuilt each time (a knockout's opponent, a
  // second leg's first-leg score); played ones stay as they are.
  const keep = (career.fixtures ?? []).filter((f) => !f.intlId || f.played);
  const done = new Set(keep.map((f) => f.intlId).filter(Boolean));
  const add = [
    ...Array.from(wanted.values()).filter((m) => !done.has(m.id)).map((m) => fixtureFor(career, w, m, nation)),
    ...Array.from(watchList.values()).filter((m) => !done.has(m.id) && !wanted.has(m.id)).map((m) => ({ ...fixtureFor(career, w, m, nation), watch: true })),
  ];
  // Trophies: a final your nation won in a period you were called up for.
  const trophies: Trophy[] = [];
  const awarded = [...s.awarded];
  for (const f of w.finals) {
    if (f.winner !== nation || awarded.includes(f.edition)) continue;
    const fm = w.edition(f.edition).find((m) => m.stage === "Final" || m.stage === "Final · Leg 2");
    if (!fm) continue;
    const p = periodsFrom(w, nation, fm.date - DAY).find((x) => x.matches.some((m) => m.id === fm.id));
    if (!p || !s.periods[p.key]?.called) continue;
    awarded.push(f.edition);
    trophies.push({ season: career.season, competition: f.comp, club: nation });
  }
  return {
    ...career,
    fixtures: [...keep, ...add],
    trophies: trophies.length ? [...(career.trophies ?? []), ...trophies] : career.trophies,
    intl: { ...s, awarded },
  };
}

// ── Watching your nation (not picked) ──────────────────────────────────────

/**
 * The result of a match you watched (a `watch` fixture), in your fixture's
 * terms (us = your nation). The match is let go by the world (the fixture
 * marked played) and read off it. Null if the world has no such match.
 */
export function watchedScore(career: CareerState, f: Fixture): { us: number; them: number; pens?: { us: number; them: number } } | null {
  if (!f.intlId) return null;
  const marked = { ...career, fixtures: career.fixtures.map((x) => (x.intlId === f.intlId ? { ...x, played: true } : x)) };
  const w = worldOf(marked, Math.max(frontier(marked), ts(career, f) + DAY));
  const m = w.byId.get(f.intlId);
  if (!m || !played(m)) return null;
  const nation = intlOf(career).nation;
  const home = m.home === nation;
  return {
    us: home ? m.hs! : m.as!, them: home ? m.as! : m.hs!,
    ...(m.pens ? { pens: home ? { us: m.pens.hs, them: m.pens.as } : { us: m.pens.as, them: m.pens.hs } } : {}),
  };
}

// ── Club games you miss ─────────────────────────────────────────────────────

/** Away with the nation on this club fixture's date? Returns the reason, or null. */
export function awayOnDuty(career: CareerState, f: Fixture): string | null {
  if (f.kind === "international" || !career.intl || !Number.isFinite(frontier(career))) return null;
  const s = career.intl;
  const t = ts(career, f);
  const w = worldOf(career);
  for (const p of periodsFrom(w, s.nation, t - 60 * DAY)) {
    if (!s.periods[p.key]?.called) continue;
    const first = p.matches[0]?.date ?? p.start;
    const last = p.kind === "tournament" ? p.end : (p.matches[p.matches.length - 1]?.date ?? p.end) + DAY;
    if (t >= first - 3 * DAY && t <= last) {
      return p.kind === "tournament"
        ? `You're away with ${s.nation} at the ${p.comp}.`
        : `You're away with ${s.nation} for the international break.`;
    }
  }
  return null;
}

// ── Your matches ────────────────────────────────────────────────────────────

/**
 * FRIENDLIES ARE FOR LOOKING AT PLAYERS (Mikey, 12 Oct 2026): "friendlies are
 * about trying to figure out your nation's best team … a lot of substitutes
 * will be used, usually the maximum, which is five … if you had three or four
 * friendlies in an international break, regular starters get about two games,
 * maybe three, and probably not the whole 90."
 *
 * Which of the window's friendlies you start, by the manager's bar:
 *   friendlies in the window   1   2   3   4
 *   starter (55–74)            1   1   2   2
 *   sure starter (75+)         1   2   2   3
 *   squad player (34–54)       0   0   1   1
 * The rest you come on in (46'–65'). Starting a friendly, you come off at
 * 55'–75' (a sure starter 65'–80'). Seeded per window, so it never changes on
 * a reload. Competitive matches are untouched.
 */
export function friendlyPlan(career: CareerState, f: Fixture): { start: boolean; onAt: number; offAt?: number; nth: number; of: number } | null {
  const s = intlOf(career);
  const w = worldOf(career);
  const m = w.byId.get(f.intlId ?? "");
  if (!m || m.importance !== 10) return null;
  const nation = s.nation;
  // The window's matchdays with no competitive match for this nation. Friendlies
  // are only drawn the day before they are played, so count the free days, not
  // the friendlies already known.
  const wk = windowKeyOf(m.date);
  const kind = wk?.key.split("-")[1] as WindowKind | undefined;
  const win = kind ? windowFor(new Date(m.date).getUTCFullYear(), kind) : null;
  const sameDay = (a: number, b: number) => Math.floor(a / DAY) === Math.floor(b / DAY);
  const days = (win?.matchdays ?? [new Date(m.date)]).map((d) => d.getTime())
    .filter((d) => sameDay(d, m.date) || !w.matches.some((x) => x.importance !== 10 && (x.home === nation || x.away === nation) && sameDay(x.date, d)));
  const n = Math.max(1, days.length);
  const nth = Math.max(0, days.findIndex((d) => sameDay(d, m.date)));
  const bar = s.manager;
  const tier = bar >= SURE_START ? 2 : bar >= START_AT ? 1 : 0;
  const STARTS = [[0, 0, 1, 1], [1, 1, 2, 2], [1, 2, 2, 3]];
  const starts = STARTS[tier][Math.min(n, 4) - 1];
  // Which ones: a seeded shuffle of the window's friendlies.
  const rng = rngFor(`friendlies|${wk?.key ?? m.id}|${nation}`);
  const order = days.map((_, i) => ({ i, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.i);
  const start = order.slice(0, starts).includes(nth);
  const r = rngFor(`friendly-mins|${m.id}|${nation}`);
  if (start) {
    const lo = tier === 2 ? 65 : 55;
    return { start, onAt: 0, offAt: lo + Math.floor(r() * 16), nth, of: n };
  }
  return { start, onAt: 46 + Math.floor(r() * 20), nth, of: n };
}

/** Start or bench for an international, when a sub comes on, and (friendlies) when you come off. */
export function intlSelection(career: CareerState, f: Fixture): { status: "1st Team" | "Substitute"; onAt: number; offAt?: number; reason: string } {
  const s = intlOf(career);
  const bar = s.manager;
  const m = worldOf(career).byId.get(f.intlId ?? "");
  const tournament = m ? TOURNAMENT_COMPS.includes(m.comp) : false;
  const nation = s.nation;
  const plan = friendlyPlan(career, f);
  if (plan) {
    const of = plan.of > 1 ? ` (friendly ${plan.nth + 1} of ${plan.of})` : "";
    return plan.start
      ? { status: "1st Team", onAt: 0, offAt: plan.offAt, reason: `A friendly${of}: you start, and the manager plans to change you around ${plan.offAt}'.` }
      : { status: "Substitute", onAt: plan.onAt, reason: `A friendly${of}: the manager is looking at other players. You come on around ${plan.onAt}'.` };
  }
  let start = bar >= START_AT;
  let why = start ? `In the ${nation} side — you start.` : `On the ${nation} bench.`;
  if (start && bar < SURE_START && !tournament && s.last?.lost && s.last.rating < 6.0) {
    start = false; why = "Dropped to the bench after the last defeat.";
  }
  if (start) return { status: "1st Team", onAt: 0, reason: why };
  const onAt = bar >= 47 ? 60 : bar >= 40 ? 70 : 80;
  return { status: "Substitute", onAt, reason: why };
}

/**
 * Credit one of your internationals: your result into the world (in the
 * world match's own home/away terms), the national manager's view, and the
 * calendar moved on.
 */
export function creditIntl(
  career: CareerState, f: Fixture,
  stats: Pick<MatchStats, "homeScore" | "awayScore" | "rating"> & Partial<Pick<MatchStats, "shootout" | "wentToExtraTime" | "goals" | "assists">> | null,
  opts: { keepManager?: boolean } = {},
): CareerState {
  const id = f.intlId;
  if (!id) return career;
  const s = intlOf(career);
  if (!stats) return syncIntl(career);
  const w = worldOf(career);
  const m = w.byId.get(id);
  const nationHome = m ? m.home === s.nation : f.home;
  const us = stats.homeScore, them = stats.awayScore;
  // Live shootout is in the fixture's home/away terms (fixture.home = we are home).
  const pens = stats.shootout
    ? (f.home === nationHome ? { hs: stats.shootout.home, as: stats.shootout.away } : { hs: stats.shootout.away, as: stats.shootout.home })
    : undefined;
  const res: PlayedResult = {
    hs: nationHome ? us : them, as: nationHome ? them : us,
    ...(stats.wentToExtraTime ? { et: true } : {}), ...(pens ? { pens } : {}),
    ...(stats.goals != null ? { mine: { g: stats.goals, a: stats.assists ?? 0 } } : {}),
  };
  const won = us > them || (us === them && !!pens && (nationHome ? pens.hs > pens.as : pens.as > pens.hs));
  const lost = us < them || (us === them && !!pens && !won);
  const manager = opts.keepManager ? s.manager : clamp100(s.manager + (stats.rating - 6.6) * 2.5 + (won ? 1 : lost ? -1 : 0));
  const nextState: IntlState = {
    ...s, played: { ...s.played, [id]: res }, manager: Math.round(manager * 10) / 10,
    ...(opts.keepManager ? {} : { last: { lost, rating: stats.rating } }),
  };
  const after = syncIntl({ ...career, intl: nextState });
  // One line for the post-match screen at a tournament or in a knockout.
  let knockoutMessage = after.knockoutMessage ?? null;
  if (m && (TOURNAMENT_COMPS.includes(m.comp) || !m.group) && m.comp !== "International Friendly") {
    const w2 = worldOf(after);
    const nextMine = (after.fixtures ?? []).filter((x) => !x.played && x.intlId && w2.byId.get(x.intlId)?.edition === m.edition)
      .sort((a, b) => a.week - b.week)[0];
    const fin = w2.finals.find((x) => x.edition === m.edition);
    if (fin && fin.winner === s.nation) knockoutMessage = `🏆 ${s.nation} win the ${m.comp}!`;
    else if (nextMine) knockoutMessage = `${s.nation} play ${nextMine.opponent} next · ${nextMine.round}.`;
    else if (!m.group || (fin && fin.runnerUp === s.nation)) knockoutMessage = `${s.nation} are out of the ${m.comp}.`;
  }
  return { ...after, knockoutMessage };
}

// ── Squads ──────────────────────────────────────────────────────────────────

const SLOTS_23: SquadPlayer["position"][] = [
  "GK", "GK", "GK", "CB", "CB", "CB", "CB", "LB", "RB", "LB", "RB", "CDM", "CM", "CM", "CM",
  "CAM", "LW", "RW", "LW", "RW", "ST", "ST", "ST",
];
const SLOTS_26: SquadPlayer["position"][] = [...SLOTS_23, "CB", "CM", "ST"];

/**
 * A nation's squad: real players of that nation the save knows, picked by
 * overall plus their club's division penalty (an 83 in the Championship is
 * picked as a 79), one per slot by position, then made-up players (fake
 * faces, names typical of the nation) at the level its ranking expects.
 * 23 for a window, 26 for a tournament. You are never in it here — the
 * match puts you on the pitch.
 */
export function squadFor(career: CareerState, nation: string, size: 23 | 26 = 23, everyone?: PoolPlayer[]): SquadPlayer[] {
  const youName = `${career.player.firstName} ${career.player.lastName}`;
  const score = (p: PoolPlayer) => p.overall + divisionPenalty(p.club ? clubDivision(career, p.club) : null);
  const pool = (everyone ?? realPlayers(career)).filter((p) => p.nation === nation && p.name !== youName)
    .sort((a, b) => score(b) - score(a));
  const used = new Set<string>();
  const slots = size === 26 ? SLOTS_26 : SLOTS_23;
  const nat = nationFor(nation);
  const xi = intlOf(career).xi[career.season]?.[nation] ?? 0;
  const level = expectedXi(rankingStrength(nat?.points ?? 1192) + xi);
  const filler = generateSquad(clubNameSeed(`nation|${nation}`));
  const names = madeUpNames(nation, slots.length + 2).filter((n) => n !== youName);
  return slots.map((pos, i) => {
    const pick = pool.find((p) => !used.has(p.name) && (p.position === pos || p.positions?.includes(pos)));
    if (pick) {
      used.add(pick.name);
      return {
        id: `intl_${nation}_${pick.name}`, name: pick.name, shortName: pick.name.split(" ").slice(-1)[0],
        position: pos, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
        overall: pick.overall, imageUrl: pick.image, nationality: nation, age: pick.age, positions: pick.positions,
      } as SquadPlayer;
    }
    const g = filler[i % filler.length];
    const id = `intl_gen_${nation}_${i}`;
    const name = names[i] ?? g.name;
    return {
      ...g, id, name, shortName: name.split(" ").slice(-1)[0], position: pos, nationality: nation,
      overall: Math.round(Math.max(40, Math.min(92, level - (i < 11 ? 1 : 5) + ((i * 7) % 5) - 2))),
      imageUrl: fakeFaceFor(`${nation}:${id}`),
    } as SquadPlayer;
  });
}

export function squadAsLeague(career: CareerState, nation: string): LeaguePlayer[] {
  return squadFor(career, nation).map((p) => ({
    id: `opp_${p.id}`, name: p.name, position: p.position, overall: p.overall ?? 65, goals: 0, assists: 0,
    image: p.imageUrl, nation, age: p.age, positions: p.positions,
  }));
}

// ── Reading the world for screens ───────────────────────────────────────────

export interface WhoWonRow { year: number; comp: string; winner: string; runnerUp: string; score: string }

export function whoWon(career: CareerState): WhoWonRow[] {
  const w = worldOf(career);
  return w.finals.map((f) => ({
    year: f.year, comp: f.comp, winner: f.winner, runnerUp: f.runnerUp,
    score: `${f.home === f.winner ? f.hs : f.as}-${f.home === f.winner ? f.as : f.hs}${f.et ? " aet" : ""}${f.pens ? ` (${Math.max(f.pens.hs, f.pens.as)}-${Math.min(f.pens.hs, f.pens.as)} pens)` : ""}`,
  })).reverse();
}

/** The nation's strength now (for the engine). */
export function nationStrengthNow(career: CareerState, nation: string): number {
  const w = worldOf(career);
  return Math.round(w.strength(nation, w.now));
}

export { loserOf };

// ── The international page ──────────────────────────────────────────────────

export interface GroupView {
  title: string;
  rows: { name: string; p: number; w: number; d: number; l: number; gd: number; pts: number }[];
}

/** Your nation's group tables, newest first: the live table of each group it has played in. */
export function myGroups(career: CareerState, max = 2): GroupView[] {
  const w = worldOf(career);
  const nation = intlOf(career).nation;
  const seen = new Set<string>();
  const out: GroupView[] = [];
  const mine = w.matches.filter((m) => m.group && (m.home === nation || m.away === nation) && played(m))
    .sort((a, b) => b.date - a.date);
  for (const m of mine) {
    const k = `${m.edition}|${m.group}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const ms = w.edition(m.edition).filter((x) => x.group === m.group);
    const teams = Array.from(new Set(ms.flatMap((x) => [x.home, x.away])));
    const tie = m.comp === "World Cup" || m.comp === "Copa América" || m.comp.startsWith("Gold") || m.comp === "CONCACAF Nations League" ? "overall" : "h2h";
    const rows = table(teams, ms, tie, w.rankOf).map((r) => ({ name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gd: r.gf - r.ga, pts: r.pts }));
    const stage = m.stage.split(" · ")[0];
    out.push({ title: `${m.comp} ${new Date(Math.max(...ms.map((x) => x.date))).getUTCFullYear()} · ${stage}`, rows });
    if (out.length >= max) break;
  }
  return out;
}

export interface MatchView { id?: string; date: number; comp: string; stage: string; home: string; away: string; hs?: number; as?: number; pens?: string; mine?: boolean }

/** Your nation's last and next matches (the next only as far as they are drawn). */
export function myMatches(career: CareerState): { last: MatchView[]; next: MatchView[] } {
  const w = worldOf(career);
  const nation = intlOf(career).nation;
  const all = w.matches.filter((m) => m.home === nation || m.away === nation).sort((a, b) => a.date - b.date);
  const view = (m: WorldMatch): MatchView => ({
    id: m.id, date: m.date, comp: m.comp, stage: m.stage, home: m.home, away: m.away, hs: m.hs, as: m.as,
    ...(m.pens ? { pens: `${m.pens.hs}-${m.pens.as} pens` } : {}),
  });
  return {
    last: all.filter(played).slice(-5).reverse().map(view),
    next: all.filter((m) => !played(m)).slice(0, 4).map(view),
  };
}

/** FIFA ranking position and points, now. */
export function myRanking(career: CareerState): { rank: number; points: number; nation: string } {
  const w = worldOf(career);
  const nation = intlOf(career).nation;
  return { nation, rank: w.rankOf(nation), points: Math.round(w.points.get(nation) ?? 0) };
}

/** The top of the FIFA ranking now. */
export function topRanking(career: CareerState, n = 10): { name: string; points: number }[] {
  const w = worldOf(career);
  return w.ranking().slice(0, n).map((name) => ({ name, points: Math.round(w.points.get(name) ?? 0) }));
}

// ── National duty (Plan A) and the screens ─────────────────────────────────

export interface DutyView {
  nation: string;
  period: Period;
  /** Your nation's matches in it so far, and in all. */
  played: number;
  total: number;
}

/**
 * Away with your nation right now (Mikey, 12 Oct 2026, Plan A): your next
 * match is an international you were picked for, or your club plays without
 * you because you are at a tournament. Home and the League switch to the
 * national team while this is true. Null otherwise (watch days included).
 */
export function dutyNow(career: CareerState): DutyView | null {
  if (!career.intl || !career.fixtures?.length) return null;
  const s = career.intl;
  let next: Fixture | null = null;
  let nt = Infinity;
  for (const f of career.fixtures) {
    if (f.played) continue;
    const t = ts(career, f);
    if (t < nt) { nt = t; next = f; }
  }
  if (!next || next.watch) return null;
  if (next.kind !== "international" && !awayOnDuty(career, next)) return null;
  const w = worldOf(career);
  const p = periodsFrom(w, s.nation, nt - 60 * DAY).find((x) =>
    next!.intlId ? x.matches.some((m) => m.id === next!.intlId) : nt >= x.start && nt <= x.end);
  if (!p || !s.periods[p.key]?.called) return null;
  const done = (m: WorldMatch) => played(m) || !!s.played[m.id];
  return { nation: s.nation, period: p, played: p.matches.filter(done).length, total: p.matches.length };
}

/** The live table of the group a match belongs to (null for a knockout). */
export function groupOf(career: CareerState, m: WorldMatch): GroupView | null {
  if (!m.group) return null;
  const w = worldOf(career);
  const ms = w.edition(m.edition).filter((x) => x.group === m.group);
  const teams = Array.from(new Set(ms.flatMap((x) => [x.home, x.away])));
  const tie = m.comp === "World Cup" || m.comp === "Copa América" || m.comp.startsWith("Gold") || m.comp === "CONCACAF Nations League" ? "overall" : "h2h";
  const rows = table(teams, ms, tie, w.rankOf).map((r) => ({ name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gd: r.gf - r.ga, pts: r.pts }));
  return { title: `${m.comp} · ${m.stage.replace(/ · Matchday \d+/, "")}`, rows };
}

const viewOf = (m: WorldMatch): MatchView => ({
  id: m.id, date: m.date, comp: m.comp, stage: m.stage, home: m.home, away: m.away, hs: m.hs, as: m.as,
  ...(m.pens ? { pens: `${m.pens.hs}-${m.pens.as} pens` } : {}),
});

export interface RoundView {
  date: number;
  /** "Nations League · League B · Matchday 3". */
  title: string;
  /** Your nation's match first, then the rest of that competition's games that day. */
  matches: MatchView[];
}

/**
 * The matchdays of a period, each with every game of that competition on the
 * same day (Results board, Plan A). Friendlies show only your own.
 */
export function roundsOf(career: CareerState, p: Period): RoundView[] {
  const w = worldOf(career);
  const nation = intlOf(career).nation;
  const sameDay = (a: number, b: number) => Math.abs(a - b) < 12 * 3_600_000;
  return p.matches.map((m) => {
    const others = m.comp === "International Friendly" ? []
      : w.edition(m.edition).filter((x) => x.id !== m.id && sameDay(x.date, m.date)
        && (m.group ? x.stage.split(" · ")[0].split(" Group")[0] === m.stage.split(" · ")[0].split(" Group")[0] : !x.group));
    const sorted = others.sort((a, b) => Number(!!b.group && b.group === m.group) - Number(!!a.group && a.group === m.group)).slice(0, 15);
    const mine = { ...viewOf(m), ...(career.intl?.played[m.id] ? { hs: career.intl.played[m.id].hs, as: career.intl.played[m.id].as } : {}) };
    const md = m.stage.match(/Matchday \d+/)?.[0];
    return { date: m.date, title: `${m.comp} · ${md ?? m.stage}`, matches: [mine, ...sorted.map(viewOf)] };
  }).map((r) => ({ ...r, matches: r.matches.map((x) => ({ ...x, mine: x.home === nation || x.away === nation })) }));
}
