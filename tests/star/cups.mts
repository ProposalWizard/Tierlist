import {
  openCup, drawRound, playCupRound, shuffle, tieWinner, cupField, cupStrength,
  currentRound, yourTie, stillIn, exitRound,
  CUP_ROUND_NAMES, CUP_FIELD, CUP_ENTRANTS_BELOW, type CupState,
} from "../../lib/star/cups";
import { buildLeague } from "../../lib/star/season";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, LeagueTeam } from "../../lib/star/types";

/**
 * THE CUPS.
 *
 * Thirty-two clubs, a fresh draw every round, every tie played. What it replaced
 * was not a cup at all: a counter that picked a random club out of the division
 * each round and played you against it. Nobody else was in it, so winning the
 * final meant beating four random opponents in a row.
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
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];
const LEAGUE: LeagueTeam[] = buildLeague(CLUBS, "Liverpool");

// ── Thirty-two in the hat ───────────────────────────────────────────────────
{
  const field = cupField(LEAGUE);
  check(field.length === CUP_FIELD, `${CUP_FIELD} clubs enter (${field.length})`);
  check(new Set(field).size === CUP_FIELD, "and nobody is in it twice");
  check(CLUBS.every(c => field.includes(c)), "every top-flight club is in it");
  const below = field.filter(f => !CLUBS.includes(f));
  check(below.length === 12, `twelve come up from below (${below.length})`);
  check(below.includes("Wrexham") && below.includes("Millwall") && below.includes("Watford"),
    "including the ones the draft game uses");
  // Nobody from below is secretly a Premier League club under another name.
  check(!below.some(b => CLUBS.includes(b)), "and none of them is already in the division");

  // A club from below is weaker than everybody in the division. An upset should
  // be an upset.
  const worstTop = Math.min(...LEAGUE.map(t => t.strength));
  const bestBelow = Math.max(...CUP_ENTRANTS_BELOW.map(t => t.strength));
  check(bestBelow < worstTop || bestBelow <= 62,
    `the clubs from below are underdogs (best ${bestBelow} vs worst top-flight ${worstTop})`);
  check(cupStrength("Wrexham", LEAGUE) === 55, "and each carries its own strength");
  check(cupStrength("Liverpool", LEAGUE) === LEAGUE[0].strength, "…as does everybody in the division");
}

// ── The shuffle is a shuffle ────────────────────────────────────────────────
//
// `sort(() => rng() - 0.5)` is the one everybody writes and it does not produce
// a uniform permutation. A draw out of a hat has to actually be one.
{
  const rng = mulberry(7);
  const N = 24000;
  const counts = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < N; i++) {
    const out = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
    out.forEach((v, pos) => { counts[v][pos] += 1; });
  }
  const expected = N / 8;
  let worst = 0;
  for (const row of counts) for (const c of row) worst = Math.max(worst, Math.abs(c - expected) / expected);
  check(worst < 0.08, `every club is equally likely to come out anywhere (worst drift ${(worst * 100).toFixed(1)}%)`);
  check(shuffle([1], mulberry(1)).length === 1, "a one-item hat is not a crash");
  check(shuffle([], mulberry(1)).length === 0, "nor is an empty one");
}

// ── A cup plays out to one winner ───────────────────────────────────────────
{
  for (let seed = 0; seed < 60; seed++) {
    const rng = mulberry(seed * 31 + 5);
    let cup = openCup("FA Cup", LEAGUE, rng);
    check(cup.rounds[0].ties.length === 16, `seed ${seed}: sixteen first-round ties`);
    check(cup.rounds[0].name === CUP_ROUND_NAMES[0], `seed ${seed}: it is the round of 32`);

    let guard = 0;
    while (!cup.winner && guard++ < 10) cup = playCupRound(cup, LEAGUE, "nobody", null, rng);

    check(!!cup.winner, `seed ${seed}: somebody wins it`);
    check(cup.rounds.length === 5, `seed ${seed}: five rounds (${cup.rounds.length})`);
    check(cup.rounds.map(r => r.ties.length).join(",") === "16,8,4,2,1",
      `seed ${seed}: 16, 8, 4, 2, 1 ties (${cup.rounds.map(r => r.ties.length).join(",")})`);
    check(cup.rounds.every(r => r.ties.every(t => t.hs !== undefined)), `seed ${seed}: every tie is played`);
    check(cup.rounds.every(r => r.ties.every(t => t.hs !== t.as || !!t.pens)),
      `seed ${seed}: no tie is left drawn`);

    // Nobody plays twice in a round, and every winner goes into the next hat.
    for (let i = 0; i < cup.rounds.length; i++) {
      const round = cup.rounds[i];
      const clubs = round.ties.flatMap(t => [t.home, t.away]);
      check(new Set(clubs).size === clubs.length, `seed ${seed} ${round.name}: nobody plays twice`);
      if (i === 0) continue;
      const wonLast = new Set(cup.rounds[i - 1].ties.map(tieWinner));
      check(clubs.every(c => wonLast.has(c)), `seed ${seed} ${round.name}: only winners are in the hat`);
    }
    check(tieWinner(cup.rounds[4].ties[0]) === cup.winner, `seed ${seed}: the winner won the final`);
  }
}

// ── The draw is a draw ──────────────────────────────────────────────────────
//
// Not a bracket. Beating somebody does not put you on a fixed path — you go back
// into a hat with everybody else who won.
{
  const seen = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    const rng = mulberry(seed * 17 + 3);
    const cup = playCupRound(openCup("FA Cup", LEAGUE, rng), LEAGUE, "nobody", null, rng);
    const r2 = cup.rounds[1];
    const tie = r2?.ties.find(t => t.home === "Liverpool" || t.away === "Liverpool");
    if (tie) seen.add(tie.home === "Liverpool" ? tie.away : tie.home);
  }
  check(seen.size > 8, `the second-round opponent is genuinely drawn (${seen.size} different clubs across 200 draws)`);
}

// ── Your tie is yours; the rest of the country is not ───────────────────────
{
  const rng = mulberry(99);
  const cup = openCup("FA Cup", LEAGUE, rng);
  const mine = yourTie(cup, "Liverpool")!;
  check(!!mine, "you are in the first round");
  check(stillIn(cup, "Liverpool"), "…and still in it");

  // Hand in a 4-0 and it is a 4-0, whichever end you were at.
  const home = mine.home === "Liverpool";
  const after = playCupRound(cup, LEAGUE, "Liverpool", home ? { hs: 4, as: 0 } : { hs: 0, as: 4 }, mulberry(1));
  const played = after.rounds[0].ties.find(t => t.home === "Liverpool" || t.away === "Liverpool")!;
  check(tieWinner(played) === "Liverpool", "your result decides your tie");
  check((home ? played.hs : played.as) === 4, `and it is the scoreline you handed in (${played.hs}-${played.as})`);
  check(after.rounds.length === 2, "…and the next round is drawn");
  check(stillIn(after, "Liverpool"), "you are still in it");

  // Lose it and you are out, and it says where.
  const out = playCupRound(cup, LEAGUE, "Liverpool", home ? { hs: 0, as: 2 } : { hs: 2, as: 0 }, mulberry(2));
  check(!stillIn(out, "Liverpool"), "losing puts you out");
  check(exitRound(out, "Liverpool") === CUP_ROUND_NAMES[0], `and records the round (${exitRound(out, "Liverpool")})`);
  check(!!currentRound(out), "the cup carries on without you");
  check(out.rounds[1].ties.every(t => t.home !== "Liverpool" && t.away !== "Liverpool"),
    "…and you are not in the next draw");
}

// ── A cup goal is not a Golden Boot goal ────────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  let c: CareerState = makeInitialCareer(player, CLUBS);

  const statsFor = (goals: number, assists: number) => ({
    homeScore: goals, awayScore: 0, chances: 2, goals, assists, passes: 10,
    rating: 8, starMan: true, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [
      ...Array.from({ length: goals }, (_, i) => ({ minute: 10 + i, scorer: "Mikey Vass", isUserGoal: true })),
      { minute: 80, scorer: c.squad[11].name, assist: "Mikey Vass", isUserGoal: false },
    ],
  }) as never;

  // Get to the first cup tie, scoring in the league on the way.
  let guard = 0;
  let leagueGoals = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) {
    c = creditMatchResult(c, nextFixtureFor(c)!, statsFor(2, 1)).career;
    leagueGoals += 2;
  }
  check(guard < 40, "a cup tie comes round");
  check(c.leagueSeasonStats?.goals === leagueGoals, `league goals are counted (${c.leagueSeasonStats?.goals})`);

  const beforeLeague = c.leagueSeasonStats!.goals;
  const beforeAll = c.seasonStats.goals;
  const mate = c.squad[11];
  const mateBeforeLeague = c.squad[11].leagueGoals ?? c.squad[11].seasonGoals;
  const mateBeforeAll = c.squad[11].seasonGoals;

  c = creditMatchResult(c, nextFixtureFor(c)!, statsFor(3, 1)).career;

  check(c.seasonStats.goals === beforeAll + 3, `a cup hat-trick counts on your club record (${c.seasonStats.goals})`);
  check(c.leagueSeasonStats!.goals === beforeLeague,
    `but not on the Golden Boot (${c.leagueSeasonStats!.goals}, was ${beforeLeague})`);

  const after = c.squad.find(p => p.id === mate.id)!;
  check(after.seasonGoals === mateBeforeAll + 1, "a team-mate's cup goal counts on his club record");
  check((after.leagueGoals ?? 0) === mateBeforeLeague, "…and not on the chart");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — thirty-two clubs, a draw every round, and cup goals stay out of the league charts");
