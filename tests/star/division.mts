import { buildFixtures, playLeagueWeek, buildLeague, mulberry32, updateLeagueWithUserResult } from "../../lib/star/season";
import { buildLeagueSquad, nameGoals, resetLeagueSquads, type RosterRow } from "../../lib/star/leagueSquads";
import { goldenBootRace, assistRace } from "../../lib/star/recognition";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import type { CareerState, LeagueSquad } from "../../lib/star/types";
import { shouldUpgradeSquad } from "../../lib/star/realSquad";
import { generateSquad } from "../../lib/star/squadData";

/**
 * EVERY GOAL IN THE DIVISION BELONGS TO SOMEBODY.
 *
 * 380 league games a season, of which you play 38. The other 342 used to
 * produce a scoreline and nothing else, and the Golden Boot chart beside them
 * was not a count at all — one invented player per club, first name and surname
 * drawn from two lists, with a tally derived from a formula on team strength
 * times how far through the season it was. Nobody had scored any of them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUBS = [
  "Liverpool", "Arsenal", "Man City", "Chelsea", "Tottenham Hotspur", "Manchester United",
  "Newcastle United", "Aston Villa", "Brighton", "West Ham United", "Everton", "Fulham",
  "Crystal Palace", "Brentford", "Wolverhampton Wanderers", "Nottingham Forest",
  "AFC Bournemouth", "Leeds United", "Burnley", "Sunderland",
];
const USER = "Liverpool";

/** A roster shaped like the endpoint's, so the builder is exercised for real. */
function roster(club: string, n = 26): RosterRow[] {
  const rng = mulberry(club.length * 31 + n);
  const POS = ["GK", "CB", "CB,LB", "RB", "LB", "CDM", "CM", "CM,CAM", "CAM", "LW", "RW", "ST", "ST,CF"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${club}-${i}`,
    name: `${club.slice(0, 3)}Player${i}`,
    positions: POS[i % POS.length],
    overall: 60 + Math.floor(rng() * 32),
  }));
}

// ── A squad is a shape, not the twenty best players ─────────────────────────
{
  for (const club of CLUBS.slice(0, 6)) {
    const sq = buildLeagueSquad(club, roster(club));
    check(sq.players.length === 20, `${club}: twenty players (${sq.players.length})`);
    check(new Set(sq.players.map(p => p.id)).size === 20, `${club}: nobody appears twice`);
    const gks = sq.players.filter(p => p.position === "GK").length;
    check(gks === 2, `${club}: two goalkeepers, not four or none (${gks})`);
    check(sq.players.some(p => p.position === "ST"), `${club}: somebody plays up front`);
    check(sq.players.some(p => p.position === "LB") && sq.players.some(p => p.position === "RB"),
      `${club}: and there are full-backs on both sides`);
    check(sq.players.every(p => p.goals === 0 && p.assists === 0), `${club}: nobody starts with a goal`);
  }

  // A club with nobody in the database still fields a team.
  const empty = buildLeagueSquad("Nowhere FC", []);
  check(empty.players.length === 20, "a club with no rows still has a squad");
  check(empty.players.every(p => p.name.length > 0), "…and every one of them has a name");

  // A thin club is topped up rather than fielding fifteen men.
  const thin = buildLeagueSquad("Thin FC", roster("Thin FC", 9));
  check(thin.players.length === 20, `a nine-man roster is topped up to twenty (${thin.players.length})`);
}

// ── Goals go to the men who would score them ────────────────────────────────
{
  const sq = buildLeagueSquad("Arsenal", roster("Arsenal"));
  const rng = mulberry(4242);
  const by: Record<string, number> = {};
  let assisted = 0, total = 0;
  for (let i = 0; i < 4000; i++) {
    for (const g of nameGoals(sq, 2, rng)) {
      total += 1;
      if (g.a) assisted += 1;
      if (g.a === g.s) by.SELF = (by.SELF ?? 0) + 1;
    }
  }
  for (const p of sq.players) by[p.position] = (by[p.position] ?? 0) + p.goals;

  const tally = sq.players.reduce((n, p) => n + p.goals, 0);
  check(tally === total, `every goal landed on somebody (${tally} of ${total})`);
  check((by.SELF ?? 0) === 0, "nobody assists his own goal");
  check(by.GK === undefined || by.GK === 0, `the goalkeeper does not score (${by.GK ?? 0})`);

  const forwards = (by.ST ?? 0) + (by.LW ?? 0) + (by.RW ?? 0) + (by.CAM ?? 0);
  const backs = (by.CB ?? 0) + (by.LB ?? 0) + (by.RB ?? 0);
  check(forwards / total > 0.65, `forwards score most of them (${((forwards / total) * 100).toFixed(0)}%)`);
  check(backs / total > 0.005 && backs / total < 0.12,
    `defenders get the odd one (${((backs / total) * 100).toFixed(1)}%)`);
  check(assisted / total > 0.5 && assisted / total < 0.75,
    `most goals are made by somebody (${((assisted / total) * 100).toFixed(0)}%)`);

  // Better players score more, without it being only the best man.
  const sorted = [...sq.players].filter(p => p.position === "ST").sort((a, b) => b.overall - a.overall);
  if (sorted.length >= 2) {
    check(sorted[0].goals > sorted[sorted.length - 1].goals,
      `the better striker outscores the worse one (${sorted[0].goals} vs ${sorted[sorted.length - 1].goals})`);
    check(sorted[sorted.length - 1].goals > 0, "…and the worse one still scores");
  }
}

// ── A season: every goal on the table has a name against it ─────────────────
{
  let league = buildLeague(CLUBS, USER);
  const squads: LeagueSquad[] = CLUBS.map(c => buildLeagueSquad(c, roster(c)));
  const rng = mulberry(99);
  let namedGoals = 0, tableGoals = 0;

  for (const f of buildFixtures(CLUBS, USER)) {
    league = updateLeagueWithUserResult(league, USER, f.opponent, 2, 1);
    const r = playLeagueWeek(league, f.week, {
      club: USER, opponent: f.opponent, home: f.home, scored: 2, conceded: 1,
    }, rng, squads);
    league = r.league;
    for (const res of r.results) {
      // Your own game is the one the squads do not cover — your scorers come off
      // the real match, and your opponent's are deliberately anonymous.
      const yours = res.home === USER || res.away === USER;
      if (yours) continue;
      check((res.hg?.length ?? 0) === res.hs, `wk${res.week} ${res.home}: ${res.hs} goals, ${res.hg?.length ?? 0} named`);
      check((res.ag?.length ?? 0) === res.as, `wk${res.week} ${res.away}: ${res.as} goals, ${res.ag?.length ?? 0} named`);
      namedGoals += (res.hg?.length ?? 0) + (res.ag?.length ?? 0);
      tableGoals += res.hs + res.as;
    }
  }
  check(namedGoals === tableGoals, `every simulated goal is named (${namedGoals}/${tableGoals})`);
  check(namedGoals > 500, `a season produces a lot of them (${namedGoals})`);

  // The squads' tallies are the same goals, counted the other way.
  const tallied = squads.reduce((n, s) => n + s.players.reduce((m, p) => m + p.goals, 0), 0);
  check(tallied === namedGoals, `the squads' tallies match the results (${tallied} vs ${namedGoals})`);

  // Somebody has had a season.
  const best = squads.flatMap(s => s.players).sort((a, b) => b.goals - a.goals)[0];
  check(best.goals >= 8 && best.goals <= 45, `the leading scorer has a believable haul (${best.goals})`);

  // A rollover wipes it, and only it.
  const fresh = resetLeagueSquads(squads);
  check(fresh.every(s => s.players.every(p => p.goals === 0 && p.assists === 0)), "a new season starts at nought");
  check(fresh.length === squads.length && fresh[0].players.length === 20, "…with the same players");
}

// ── The chart is a count, and you are in it ─────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: USER, nationality: "England",
  } as never;
  let career: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(c => buildLeagueSquad(c, roster(c))),
  };

  // Before a ball is kicked, the only name on it is yours, on nought.
  const opening = goldenBootRace(career);
  check(opening.length === 1 && opening[0].isYou, `nobody has scored before the season starts (${opening.length})`);

  const stats = {
    homeScore: 3, awayScore: 0, chances: 2, goals: 2, assists: 1, passes: 10,
    rating: 8.4, starMan: true, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [
      { minute: 20, scorer: "Mikey Vass", isUserGoal: true },
      { minute: 55, scorer: "Mikey Vass", isUserGoal: true },
      { minute: 70, scorer: career.squad[11].name, assist: "Mikey Vass", isUserGoal: false },
    ],
  } as never;

  for (let i = 0; i < 6; i++) {
    const fixture = career.fixtures.find(f => !f.played)!;
    career = creditMatchResult(career, fixture, stats).career;
  }

  const race = goldenBootRace(career);
  const you = race.find(r => r.isYou)!;
  check(you.goals === 12, `your goals are counted (${you.goals})`);
  check(race.length > 20, `so is everybody else's (${race.length} scorers in the division)`);
  check(race.every((r, i) => i === 0 || r.goals <= race[i - 1].goals), "the chart is in order");
  check(race.filter(r => r.club === USER && !r.isYou).length > 0, "your team-mates are in it too");
  // Nobody in the chart is from a club that does not exist.
  check(race.every(r => CLUBS.includes(r.club)), "every scorer plays for a club in the division");

  const assists = assistRace(career);
  const yourAssists = assists.find(r => r.isYou)!;
  check(yourAssists.goals === 6, `your assists are counted (${yourAssists.goals})`);
  check(assists.length > 20, `and the division's (${assists.length} creators)`);

  // The save stays small.
  const kb = JSON.stringify(career).length / 1024;
  check(kb < 400, `six weeks in, the career is ${kb.toFixed(0)} KB`);
}

// ── A generated squad always upgrades to the real one ───────────────────────
//
// The rule used to be "…and only if nothing has been earned on it", which meant
// a career that had played two matches with its invented eleven was locked out
// of real players for the rest of the save. Reported as exactly that: Liverpool
// and Man United on real squads, Chelsea permanently on made-up ones.
{
  const invented = generateSquad("chelsea");
  check(shouldUpgradeSquad(invented), "an invented squad is replaced");

  const played = invented.map((p, i) => ({ ...p, careerGoals: i === 3 ? 11 : 0, seasonGoals: i === 3 ? 4 : 0 }));
  check(shouldUpgradeSquad(played), "…even after the invented team-mates have scored");

  const real = invented.map((p, i) => ({ ...p, sofifaId: String(1000 + i) }));
  check(!shouldUpgradeSquad(real), "a real squad is left alone");

  const mixed = real.map((p, i) => (i === 0 ? { ...p, sofifaId: undefined } : p));
  check(!shouldUpgradeSquad(mixed), "…and so is one that is mostly real");

  check(shouldUpgradeSquad([]), "an empty squad is filled");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — every goal in the division belongs to a named player, and the charts count them");
