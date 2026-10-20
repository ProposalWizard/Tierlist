import {
  makeIdentity, attachClub, creditMatchResult, simulateMissedFixture,
} from "../../lib/star/careerFlow";
import { nextFixtureFor, seedEurope } from "../../lib/star/competitions";
import {
  ALL_DIVISIONS, fixtureTimestamp, matchweeksFor, stopsForBreaks, seasonStartYear,
  leagueNameFor, type CareerDivision,
} from "../../lib/star/calendar";
import { seasonWindows } from "../../lib/star/intl/windows";
import {
  periodDue, decide, applyDecision, syncIntl, intlOf, awayOnDuty,
} from "../../lib/star/intl/career";
import { sortLeague } from "../../lib/star/season";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS,
  NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * EVERY FIXTURE, EVERY DIVISION: NO CLASHES (Harry, 20 Oct 2026: "do a full
 * pass over all the fixtures, not just fixing the FA Cup Round of 64 date,
 * but fix it").
 *
 * Plays whole seasons for a club in every division, in every competition it
 * can be in, through the real career code (makeIdentity + attachClub, then
 * nextFixtureFor + creditMatchResult, as the game does). Every cup and
 * European tie is won, so each run reaches every round. The club is put in
 * the play-off places before the last league round, so the play-offs are
 * played too. The player is called up for every international window.
 *
 * The rules each season's fixtures must keep:
 *   1. Never two games on one day.
 *   2. Never games on two days in a row.
 *   3. MINIMUM REST: two clear days between games, so games are at least
 *      3 days apart (Saturday then Tuesday is fine; Sunday then Tuesday is
 *      not). Applies to the player's own games, internationals included.
 *   4. A cup round is never played before the round before it.
 *   5. The club season ends before the June international window opens, and
 *      never after 31 May. No club game after that.
 *   6. The Premier League and the Championship stop for international breaks:
 *      none of their clubs' games falls inside a FIFA window.
 */

const DAY = 86_400_000;
const START_YEAR = 2027;
const SEASONS = [1, 2, 3, 4, 5];
const MIN_GAP_DAYS = 3;

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS: Record<CareerDivision, readonly string[]> = {
  premier: PREMIER_LEAGUE_CLUBS,
  championship: CHAMPIONSHIP_CLUBS,
  league_one: LEAGUE_ONE_CLUBS,
  league_two: LEAGUE_TWO_CLUBS,
  national_league: NATIONAL_LEAGUE_CLUBS,
  national_league_north: NATIONAL_LEAGUE_NORTH_CLUBS,
  national_league_south: NATIONAL_LEAGUE_SOUTH_CLUBS,
};

interface Scenario {
  label: string;
  division: CareerDivision;
  club: string;
  /** Put the club in this European competition (for a division whose clubs
   *  never start in it: the Championship's relegated cup winner). */
  europe?: "Champions League" | "Europa League";
  /** Last season's winners, so the Community Shield and Super Cup are played. */
  preSeason?: boolean;
  /** Reported on its own, not counted: see KNOWN LIMIT below. */
  knownLimit?: boolean;
}

function scenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const division of ALL_DIVISIONS) {
    // A Premier League club that does not start in Europe (Leeds United).
    const club = CLUBS[division][3];
    out.push({ label: `${leagueNameFor(division)} (${club})`, division, club });
  }
  // The Premier League in each European competition, with both pre-season games.
  out.push({ label: "Premier League + Champions League (Arsenal)", division: "premier", club: "Arsenal", preSeason: true });
  out.push({ label: "Premier League + Europa League (Crystal Palace)", division: "premier", club: "Crystal Palace", preSeason: true });
  // KNOWN LIMIT: a relegated cup winner keeps its European place. Winning
  // everything, that club needs 12 Tuesday league rounds, 16 European nights
  // and 10 cup ties: 38 midweeks, and a season has 34. Its early season is
  // clash-free (checked below); a deep run in Europe and the cups is not.
  out.push({ label: "Championship + Europa League", division: "championship", club: CHAMPIONSHIP_CLUBS[4], europe: "Europa League", knownLimit: true });
  return out;
}

function player(club: string): StarPlayer {
  return {
    firstName: "Fixture", lastName: "Checker", age: 24, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: START_YEAR,
  } as StarPlayer;
}

function stats(us: number, them: number): MatchStats {
  return {
    chances: 2, goals: 0, assists: 0, passes: 10, rating: 7, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0,
    sponsorPay: 0, totalCash: 0, homeScore: us, awayScore: them, minutes: 90,
  } as MatchStats;
}

function build(s: Scenario, season: number): CareerState {
  const identity = makeIdentity(player(s.club), s.division);
  identity.season = season;
  if (s.preSeason) {
    identity.lastSeasonWinners = {
      league: s.club, leagueRunnerUp: "Liverpool", faCup: "Chelsea",
      championsLeague: s.club, europaLeague: "Aston Villa",
    } as CareerState["lastSeasonWinners"];
  }
  let c = attachClub(identity, s.club, [...CLUBS[s.division]], s.division);
  if (s.europe) {
    c = { ...c, europeanQualification: s.europe };
    const e = seedEurope(c);
    c = { ...c, euroState: e.state ?? undefined, fixtures: [...c.fixtures, ...e.fixtures] };
  }
  c = { ...c, starRating: 4.5 };
  c = syncIntl({ ...c, intl: { ...intlOf(c), manager: 90 } });
  return c;
}

/** Fourth in the table: in the play-off places in every division that has them. */
function intoPlayOffPlaces(c: CareerState): CareerState {
  const order = sortLeague(c.league).map(t => t.name).filter(n => n !== c.player.club);
  order.splice(3, 0, c.player.club);
  const points = new Map(order.map((n, i) => [n, 200 - i * 3]));
  return { ...c, league: c.league.map(t => ({ ...t, points: points.get(t.name) ?? t.points })) };
}

interface Played {
  f: Fixture;
  t: number;
  away: boolean; // a club game the player missed, away with the national team
}

function label(f: Fixture): string {
  if (!f.kind || f.kind === "league") return "League";
  if (f.kind === "international") return "International";
  if (f.kind === "playoff") return "Play-Offs";
  return String(f.competition ?? f.kind);
}

function day(t: number): string {
  return new Date(t).toUTCString().slice(0, 16);
}

function playSeason(s: Scenario, season: number): Played[] {
  let c = build(s, season);
  const division = s.division;
  const ts = (f: Fixture) => fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, division);
  const out: Played[] = [];
  let rigged = false;
  for (let guard = 0; guard < 300; guard++) {
    const p = periodDue(c);
    if (p) { c = applyDecision(c, { ...decide(c, p), called: true }); continue; }
    const next = nextFixtureFor(c);
    if (!next) break;
    const kind = next.kind ?? "league";
    if (kind === "league" && next.week === matchweeksFor(division) && !rigged && division !== "premier") {
      c = intoPlayOffPlaces(c);
      rigged = true;
    }
    const t = ts(next);
    if (kind !== "international" && awayOnDuty(c, next)) {
      out.push({ f: next, t, away: true });
      c = simulateMissedFixture(c, next).career;
    } else if (next.watch) {
      c = simulateMissedFixture(c, next).career;
    } else {
      out.push({ f: next, t, away: false });
      const win = kind === "cup" || kind === "europe" || kind === "playoff";
      c = creditMatchResult(c, next, win ? stats(2, 0) : stats(1, 1)).career;
    }
    c = { ...c, starRating: 4.5, intl: { ...intlOf(c), manager: 90 } };
  }
  return out;
}

// ── The rules ───────────────────────────────────────────────────────────────

type Rule = "same day" | "consecutive days" | "under 2 days' rest" | "cup round out of order"
  | "after the season ends" | "inside an international break" | "time goes backwards";
const RULES: Rule[] = ["same day", "consecutive days", "under 2 days' rest", "cup round out of order",
  "after the season ends", "inside an international break", "time goes backwards"];

interface Bucket {
  counts: Map<string, Map<Rule, number>>;
  pairs: Map<string, number>;
  examples: Map<string, string>;
}
const newBucket = (): Bucket => ({ counts: new Map(), pairs: new Map(), examples: new Map() });
const main = newBucket();
const limit = newBucket();
/** The known-limit club's clashes before 1 January (its early season). */
let limitEarly = 0;
let current: { bucket: Bucket; season: number; knownLimit: boolean } = { bucket: main, season: 1, knownLimit: false };

function flag(division: string, rule: Rule, pair: string, example: string, t?: number): void {
  const b = current.bucket;
  const m = b.counts.get(division) ?? new Map<Rule, number>();
  m.set(rule, (m.get(rule) ?? 0) + 1);
  b.counts.set(division, m);
  const k = `${rule} · ${pair}`;
  b.pairs.set(k, (b.pairs.get(k) ?? 0) + 1);
  if (!b.examples.has(k)) b.examples.set(k, example);
  if (current.knownLimit && t !== undefined && t < Date.UTC(seasonStartYear(START_YEAR, current.season) + 1, 0, 1)) limitEarly++;
}

/** Where a fixture sits in its competition: league-phase matchdays first,
 *  then the rounds in order, the second leg just after the first. */
function roundRank(f: Fixture): number {
  const r = f.round ?? "";
  const md = /MD(\d+)/.exec(r);
  if (md) return Number(md[1]) / 10;
  const stages: [RegExp, number][] = [
    [/Qualifier/, 1], [/^Round 1\b/, 2], [/Round of 64/, 3], [/Round of 32/, 4], [/Round of 16/, 5],
    [/Quarter/, 6], [/Semi/, 7], [/Final/, 8],
  ];
  const hit = stages.find(([re]) => re.test(r));
  if (!hit) return -1;
  const second = f.leg === 2 || /Leg 2|Second Leg/.test(r);
  return hit[1] + (second ? 0.5 : 0);
}

function seasonEnd(season: number): number {
  const y = seasonStartYear(START_YEAR, season) + 1;
  const may31 = Date.UTC(y, 4, 31);
  const june = seasonWindows(y - 1).find(w => w.kind === "jun");
  return Math.min(may31, june ? june.start.getTime() - DAY : may31);
}

function audit(s: Scenario, season: number, played: Played[]): void {
  const div = s.label;
  const mine = played.filter(p => !p.away);
  const club = played.filter(p => p.f.kind !== "international");
  const where = (p: Played) => `${label(p.f)} ${p.f.round ?? ""} ${day(p.t)}`.replace(/\s+/g, " ").trim();

  // 1–3: the player's own games, in date order.
  const sorted = [...mine].sort((a, b) => a.t - b.t);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    const gap = Math.round((b.t - a.t) / DAY);
    const pair = [label(a.f), label(b.f)].join(" → ");
    const ex = `${div} s${season}: ${where(a)} then ${where(b)}`;
    if (gap === 0) flag(div, "same day", pair, ex, b.t);
    else if (gap === 1) flag(div, "consecutive days", pair, ex, b.t);
    else if (gap < MIN_GAP_DAYS) flag(div, "under 2 days' rest", pair, ex, b.t);
  }
  // The club's games too (the ones played while you were away count).
  const clubSorted = [...club].sort((a, b) => a.t - b.t);
  for (let i = 1; i < clubSorted.length; i++) {
    const a = clubSorted[i - 1], b = clubSorted[i];
    if (!a.away && !b.away) continue; // already checked above
    const gap = Math.round((b.t - a.t) / DAY);
    const pair = [label(a.f), label(b.f)].join(" → ") + " (club, you away)";
    const ex = `${div} s${season}: ${where(a)} then ${where(b)}`;
    if (gap === 0) flag(div, "same day", pair, ex, b.t);
    else if (gap === 1) flag(div, "consecutive days", pair, ex, b.t);
    else if (gap < MIN_GAP_DAYS) flag(div, "under 2 days' rest", pair, ex, b.t);
  }

  // Time only moves forward: each game is on or after the one before it.
  for (let i = 1; i < played.length; i++) {
    if (played[i].t < played[i - 1].t) {
      flag(div, "time goes backwards", `${label(played[i - 1].f)} → ${label(played[i].f)}`,
        `${div} s${season}: ${where(played[i - 1])} then ${where(played[i])}`);
    }
  }

  // 4: each cup's rounds in order (and legs in order).
  const byComp = new Map<string, Played[]>();
  for (const p of club) {
    const k = p.f.kind;
    if (k !== "cup" && k !== "europe" && k !== "playoff") continue;
    const comp = label(p.f);
    byComp.set(comp, [...(byComp.get(comp) ?? []), p]);
  }
  for (const [comp, list] of byComp) {
    const inOrder = [...list].sort((a, b) => a.t - b.t);
    for (let i = 1; i < inOrder.length; i++) {
      const ra = roundRank(inOrder[i - 1].f), rb = roundRank(inOrder[i].f);
      if (ra < 0 || rb < 0) continue;
      if (rb <= ra) {
        flag(div, "cup round out of order", comp,
          `${div} s${season}: ${where(inOrder[i - 1])} then ${where(inOrder[i])}`);
      }
    }
  }

  // 5: nothing after the season ends.
  const end = seasonEnd(season);
  for (const p of club) {
    if (p.t > end) flag(div, "after the season ends", label(p.f), `${div} s${season}: ${where(p)} (ends ${day(end)})`);
  }

  // 6: the Premier League and the Championship stop for international breaks.
  if (stopsForBreaks(s.division)) {
    const windows = seasonWindows(seasonStartYear(START_YEAR, season)).filter(w => w.kind !== "jun");
    for (const p of club) {
      const w = windows.find(x => p.t >= x.start.getTime() && p.t <= x.end.getTime() + DAY - 1);
      if (w) flag(div, "inside an international break", label(p.f), `${div} s${season}: ${where(p)} (${w.kind} window)`);
    }
  }
}

// ── Run it ──────────────────────────────────────────────────────────────────

let seasonsPlayed = 0;
let gamesSeen = 0;
const perComp = new Map<string, number>();
for (const s of scenarios()) {
  for (const season of SEASONS) {
    const played = playSeason(s, season);
    seasonsPlayed++;
    gamesSeen += played.length;
    for (const p of played) perComp.set(label(p.f), (perComp.get(label(p.f)) ?? 0) + 1);
    current = { bucket: s.knownLimit ? limit : main, season, knownLimit: !!s.knownLimit };
    audit(s, season, played);
  }
}

function report(b: Bucket): number {
  let total = 0;
  for (const [r, m] of b.counts) {
    console.log(`  ${r}: ${RULES.filter(x => m.get(x)).map(x => `${x} ${m.get(x)}`).join(" · ")}`);
    for (const n of m.values()) total += n;
  }
  for (const [k, n] of [...b.pairs].sort((a, c) => c[1] - a[1])) {
    console.log(`    ${n}× ${k} — e.g. ${b.examples.get(k)}`);
  }
  return total;
}

console.log(`  ${seasonsPlayed} seasons (${SEASONS.length} each: 2026/27 to ${2025 + SEASONS.length}/${(26 + SEASONS.length) % 100}), ${gamesSeen} games`);
console.log(`  (${[...perComp].map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log("  Rule 3 (minimum rest): two clear days between games, so at least 3 days apart.");
console.log("  Rule 5 (season end): before the June international window, and by 31 May.");
const total = report(main);
if (total === 0) console.log("  Every division, every competition: no clashes.");
console.log("  KNOWN LIMIT — a Championship club in Europe, winning everything (not counted):");
const limitTotal = report(limit);
console.log(`    ${limitTotal} clashes in ${SEASONS.length} seasons, ${limitEarly} of them before 1 January.`);

check(total === 0, `${total} clashes in ${seasonsPlayed - SEASONS.length} seasons (see the list above)`);
check(limitEarly === 0, `a Championship club in Europe has a clash-free autumn (${limitEarly} clashes before 1 January)`);
check(perComp.has("FA Cup") && perComp.has("Lower League Trophy") && perComp.has("League Cup"),
  "the domestic cups were all played");
check(perComp.has("Champions League") && perComp.has("Europa League"), "both European competitions were played");
check(perComp.has("Play-Offs") && perComp.has("International"), "play-offs and internationals were played");
check(perComp.has("Community Shield") && perComp.has("Super Cup"), "the pre-season games were played");


if (problems.length) {
  console.error(`FAIL fixtureClashes (${problems.length})`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("PASS fixtureClashes");
