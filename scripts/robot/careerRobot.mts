/**
 * THE CAREER ROBOT (Mikey, 23 Oct 2026): "a robot … plays through an entire
 * 20-year career … an average player … on average about 28 to 55 goals."
 *
 * Plays a whole career with no screens, the same rules the game uses
 * (creditMatchResult, the summer window, advanceSeason), and prints one line
 * a season: club, league, goals, assists, star level, Star Pass rewards
 * reached, money, trophies. Anything that throws or breaks a rule the game
 * must always keep is listed at the end. Writes the full report as JSON when
 * given a path (the nightly run keeps it).
 *
 *   npx tsx scripts/robot/careerRobot.mts                 (seed 1, 20 seasons)
 *   npx tsx scripts/robot/careerRobot.mts 7 20 out.json   (seed 7, report file)
 *
 * The robot's player: every match he plays, he scores 0-3 (about 0.73 a game,
 * so about 30-50 a season), assists about 0.35, rates 6.4-8.6 by how he did. In the
 * summer he signs for the keenest club from the highest league that wants
 * him, like a player chasing a bigger stage. He does no training, buys
 * nothing and never wins the Ballon d'Or vote here: it measures the climb a
 * plain career gets from playing.
 */
import { writeFileSync } from "node:fs";
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { weeklyWageFor, goalBonusFor, assistBonusFor } from "../../lib/star/economy";
import { NATIONAL_LEAGUE_NORTH_CLUBS } from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import { divisionOf, leagueNameFor } from "../../lib/star/calendar";
import { starStatus } from "../../lib/star/starPoints";
import { mulberry32 } from "../../lib/star/season";
import { windowInterest, allInterested, levelOf, keenest } from "../../lib/star/transferInterest";
import { acceptOffer } from "../../lib/star/transfers";
import { clearAfterWindow } from "../../lib/star/transferRequest";
import { retirementCheck } from "../../lib/star/retirement";
import { DEFAULT_PASS_LEVELS } from "../../lib/star/rewardCatalogue";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

// No browser here: the save code reads and writes localStorage.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, get length() { return store.size; },
} as Storage;

const SEED = Number(process.argv[2] ?? 1);
const SEASONS = Number(process.argv[3] ?? 20);
const OUT = process.argv[4];
const rng = mulberry32(SEED * 7919 + 13);

const problems: string[] = [];
const fail = (what: string) => { if (problems.length < 40) problems.push(what); };

/** One match, played by an average player: the game's own end-of-match sum
 *  (finaliseMatch) turns his goals into the rating, the wage and the bonuses. */
function matchFor(career: CareerState, fixture: Fixture): MatchStats {
  const r = rng();
  const goals = r < 0.45 ? 0 : r < 0.85 ? 1 : r < 0.97 ? 2 : 3;
  const assists = rng() < 0.3 ? 1 : 0;
  const us = goals + (rng() < 0.55 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
  const them = rng() < 0.35 ? 0 : rng() < 0.75 ? 1 : 2;
  return finaliseMatch(4 + goals + Math.floor(rng() * 3), goals, assists, 20 + Math.floor(rng() * 15), 90, us, them, career, [], null, [], fixture);
}

/** The game's rules that must always hold. */
function audit(c: CareerState, when: string) {
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (!finite(c.money) || !finite(c.fame) || !finite(c.starRating)) fail(`${when}: a headline number is not a number`);
  if (!c.league.some((t) => t.name === c.player.club)) fail(`${when}: your club is not in your own table`);
  if (new Set(c.league.map((t) => t.name)).size !== c.league.length) fail(`${when}: a club twice in the table`);
  for (const t of c.league) if (t.played !== t.won + t.drawn + t.lost) { fail(`${when}: ${t.name}'s table row does not add up`); break; }
  if (c.fixtures.some((f) => f.opponent === c.player.club)) fail(`${when}: your club plays itself`);
}

const passLevels = Object.keys(DEFAULT_PASS_LEVELS).map(Number).sort((a, b) => a - b);
const player = { firstName: "Robo", lastName: "Average", age: 17, skinTone: "light", club: NATIONAL_LEAGUE_NORTH_CLUBS[8], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let c: CareerState = { ...makeInitialCareer(player, [...NATIONAL_LEAGUE_NORTH_CLUBS], "national_league_north"), unlocks: undefined };
// The deal a scouted trialist signs (scoutedPlacement.ts): a starter's wage at that club.
{
  const wage = weeklyWageFor(c.player.club, "national_league_north");
  c = { ...c, money: 0, contract: { ...c.contract, club: c.player.club, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 2 } };
}

interface SeasonLine { season: number; age: number; club: string; league: string; apps: number; goals: number; assists: number; avg: number; stars: number; passRewards: number; money: number; trophies: number; moved?: string }
const lines: SeasonLine[] = [];
const t0 = Date.now();
let matches = 0;

for (let s = 1; s <= SEASONS; s++) {
  const at = c.season;
  let g = 0;
  while (g++ < 300) {
    const next = nextFixtureFor(c);
    if (!next) break;
    try { c = creditMatchResult(c, next, matchFor(c, next)).career; matches++; }
    catch (e) { fail(`season ${at}: a match throws: ${(e as Error).message.slice(0, 140)}`); break; }
    if (g % 10 === 0) audit(c, `season ${at}`);
  }
  if (g >= 300) fail(`season ${at}: never ends`);
  const ss = c.seasonStats;
  const stars = starStatus(c).stars;
  const line: SeasonLine = {
    season: at, age: c.player.age, club: c.player.club, league: leagueNameFor(divisionOf(c)),
    apps: ss.appearances, goals: ss.goals, assists: ss.assists,
    avg: ss.ratingCount ? Math.round((ss.totalRating / ss.ratingCount) * 100) / 100 : 0,
    stars, passRewards: passLevels.filter((l) => l <= stars).length, money: Math.round(c.money), trophies: c.trophies.length,
  };
  if (retirementCheck(c).mustRetire || s === SEASONS) { lines.push(line); break; }
  // The summer window: the keenest club from the highest league that wants him.
  let moved = false;
  try {
    const up = allInterested(windowInterest(c, "summer")).filter((x) => levelOf(x.division) > levelOf(divisionOf(c)));
    const top = Math.max(-1, ...up.map((x) => levelOf(x.division)));
    const best = keenest(up.filter((x) => levelOf(x.division) === top));
    if (best) { c = clearAfterWindow(acceptOffer(c, best.offer)); moved = true; line.moved = `${best.club} (${leagueNameFor(best.division)})`; }
  } catch (e) { fail(`season ${at}: the summer window throws: ${(e as Error).message.slice(0, 140)}`); }
  lines.push(line);
  try { c = advanceSeason(c, false, moved).career; }
  catch (e) { fail(`season ${at}: the season end throws: ${(e as Error).message.slice(0, 140)}`); break; }
  // A deal that ran out: the robot signs the club's renewal at the same terms.
  if (c.contract.seasonsRemaining <= 0) c = { ...c, contract: { ...c.contract, seasonsRemaining: 2 } };
  audit(c, `after season ${at}`);
}

const pad = (v: string | number, n: number) => String(v).padEnd(n);
console.log(`Career robot · seed ${SEED} · ${lines.length} seasons · ${matches} matches · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log("S   age club                       league                  apps  G   A   avg   star pass  money");
for (const l of lines) {
  console.log(`${pad(l.season, 4)}${pad(l.age, 4)}${pad(l.club.slice(0, 26), 27)}${pad(l.league.slice(0, 22), 24)}${pad(l.apps, 6)}${pad(l.goals, 4)}${pad(l.assists, 4)}${pad(l.avg.toFixed(2), 6)}${pad(l.stars, 5)}${pad(l.passRewards, 5)}★${l.money.toLocaleString("en-GB")}${l.moved ? `  → ${l.moved}` : ""}`);
}
const goals = lines.map((l) => l.goals);
console.log(`Goals a season: ${Math.min(...goals)}-${Math.max(...goals)} (mean ${Math.round(goals.reduce((a, b) => a + b, 0) / goals.length)}) · star level at the end: ${lines[lines.length - 1]?.stars}`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ✗ ${problems.join("\n  ✗ ")}` : "No problems found");
if (OUT) writeFileSync(OUT, JSON.stringify({ seed: SEED, seasons: lines, problems, matches, ranAt: new Date().toISOString() }, null, 2));
process.exitCode = problems.length ? 1 : 0;
