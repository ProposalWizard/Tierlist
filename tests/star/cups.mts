import {
  openCup, drawRound, playCupRound, shuffle, tieWinner, cupField, cupStrength,
  currentRound, yourTie, stillIn, exitRound,
  CUP_ROUND_NAMES, CUP_FIELD, FA_CUP_ROUND_NAMES, FA_CUP_FIELD, type CupState,
} from "../../lib/star/cups";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
  LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
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

// ── Thirty-two in the hat (the LEAGUE CUP — untouched by the FA Cup's own
// expansion below) ───────────────────────────────────────────────────────────
//
// A Premier League season's own twenty clubs are never in question — the same
// guarantee a Championship season needs for its own twenty-four, checked in
// its own block below. What used to be a fixed twelve-club list is now a
// weighted draw from the real Championship and the five-club promotion pool;
// this checks the shape of that draw rather than which exact names show up,
// since which names show up is now genuinely random. Passes "League Cup"
// explicitly — cupField's own default changed to "FA Cup" when the FA Cup
// grew its own, larger field, and this block is specifically about the
// League Cup's original, unchanged 32-club shape.
{
  const rng = mulberry(41);
  const field = cupField(LEAGUE, "premier", rng, "League Cup");
  check(field.length === CUP_FIELD, `${CUP_FIELD} clubs enter (${field.length})`);
  check(new Set(field).size === CUP_FIELD, "and nobody is in it twice");
  check(CLUBS.every(c => field.includes(c)), "every top-flight club is guaranteed a place");
  const below = field.filter(f => !CLUBS.includes(f));
  check(below.length === 12, `twelve come up from below (${below.length})`);
  check(below.every(c => CHAMPIONSHIP_CLUBS.includes(c) || PROMOTION_POOL_CLUBS.includes(c)),
    `every one of them is a real Championship or promotion-pool club (${below.join(", ")})`);
  check(!below.some(b => CLUBS.includes(b)), "and none of them is already in the division");

  // A club from below is weaker than everybody in the division. An upset should
  // be an upset.
  const worstTop = Math.min(...LEAGUE.map(t => t.strength));
  const belowStrengths = below.map(c => cupStrength(c, LEAGUE));
  check(Math.max(...belowStrengths) < worstTop || Math.max(...belowStrengths) <= 65,
    `the clubs from below are underdogs (best ${Math.max(...belowStrengths)} vs worst top-flight ${worstTop})`);
  check(cupStrength("Liverpool", LEAGUE) === LEAGUE[0].strength, "a top-flight club carries its real strength");

  // Across enough draws, both pools should actually turn up — a fixed
  // twelve-club list would fail this the same way the bug it replaced did.
  const everSeen = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    const f = cupField(LEAGUE, "premier", mulberry(seed * 41 + 7), "League Cup");
    for (const c of f) if (!CLUBS.includes(c)) everSeen.add(c);
  }
  check(CHAMPIONSHIP_CLUBS.some(c => everSeen.has(c)), "real Championship clubs come up from below");
  check(PROMOTION_POOL_CLUBS.some(c => everSeen.has(c)),
    "and, less often, so does the promotion pool — see the next block for how much less often");
}

// ── The pool is a much longer shot than the Championship (League Cup) ──────
{
  let championshipPicks = 0, poolPicks = 0;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry(seed * 53 + 11);
    const field = cupField(LEAGUE, "premier", rng, "League Cup");
    for (const c of field) {
      if (CHAMPIONSHIP_CLUBS.includes(c)) championshipPicks++;
      if (PROMOTION_POOL_CLUBS.includes(c)) poolPicks++;
    }
  }
  // 24 Championship candidates against 5 pool candidates already means the
  // pool is picked less just by having fewer names in the hat — the extra
  // 0.25x weight on top of that should still be visible as a much steeper
  // drop than headcount alone explains.
  const perCandidate = (picks: number, poolSize: number) => picks / poolSize;
  const championshipRate = perCandidate(championshipPicks, CHAMPIONSHIP_CLUBS.length);
  const poolRate = perCandidate(poolPicks, PROMOTION_POOL_CLUBS.length);
  check(poolRate < championshipRate * 0.6,
    `a pool club's odds of a place are well below a Championship club's, per-candidate (${poolRate.toFixed(2)} vs ${championshipRate.toFixed(2)})`);
}

// ── A Championship season's own twenty-four are just as guaranteed, and
// the rest of the field is the REAL Premier League, not an invented one
// (League Cup) ───────────────────────────────────────────────────────────
//
// Reported directly, after a relegation, with a screenshot: a Championship
// season's cup field was nothing but the Championship's own twenty-four
// padded out with fabricated "X B" filler clubs — the FA Cup and League Cup
// are not restricted to your own division, and belowField() reaching only
// "below" broke completely the moment the career's own division WAS the
// bottom one this game models. Fixed to reach into the real Premier League
// instead, the same way a Premier League season already reaches into the
// real Championship — see belowField's own comment in cups.ts.
{
  const champLeague = buildLeague([...CHAMPIONSHIP_CLUBS], CHAMPIONSHIP_CLUBS[0]);
  let premierPicks = 0, fakeBTeams = 0;
  for (let seed = 0; seed < 30; seed++) {
    const field = cupField(champLeague, "championship", mulberry(seed * 19 + 2), "League Cup");
    check(field.length === CUP_FIELD, `seed ${seed}: still thirty-two clubs (${field.length})`);
    check(CHAMPIONSHIP_CLUBS.every(c => field.includes(c)),
      `seed ${seed}: every Championship club — including your own — is guaranteed a place`);
    const below = field.filter(c => !CHAMPIONSHIP_CLUBS.includes(c));
    check(below.every(c => PREMIER_LEAGUE_CLUBS.includes(c) || PROMOTION_POOL_CLUBS.includes(c) || c.endsWith(" B")),
      `seed ${seed}: the rest is real Premier League or promotion-pool clubs, not something invented (${below.join(", ")})`);
    premierPicks += below.filter(c => PREMIER_LEAGUE_CLUBS.includes(c)).length;
    fakeBTeams += below.filter(c => c.endsWith(" B")).length;
  }
  check(premierPicks > 0, "a Championship season's cup field genuinely does draw real Premier League clubs");
  check(fakeBTeams === 0, `forty-nine real English clubs is plenty for a field of thirty-two — no invented "X B" filler needed (${fakeBTeams})`);
}

// ── The FA Cup's Round of 64: every PL and Championship club, a genuine
// League One/Two mix, and one or two National League clubs — never zero,
// never three or more ─────────────────────────────────────────────────────
{
  // The test's own fictional CLUBS fixture (used across this whole file for
  // the League Cup too) happens to overlap the real CHAMPIONSHIP_CLUBS list
  // (Burnley, Wolverhampton Wanderers, West Ham United all appear in both) —
  // the real PREMIER_LEAGUE_CLUBS/CHAMPIONSHIP_CLUBS lists in clubs.ts do
  // not overlap at all, so a real career always sees exactly 44 guaranteed
  // and 20 left over. faCupField already de-duplicates before counting
  // (same as belowField always has), so the guaranteed count here is
  // computed the same way rather than hardcoded to 20, which would be wrong
  // against this fixture's own overlap.
  const guaranteedCount = new Set([...CLUBS, ...CHAMPIONSHIP_CLUBS]).size;
  const restCount = FA_CUP_FIELD - guaranteedCount;
  let sawOne = false, sawTwo = false, sawL1 = false, sawL2 = false;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry(seed * 73 + 5);
    const field = cupField(LEAGUE, "premier", rng, "FA Cup");
    check(field.length === FA_CUP_FIELD, `seed ${seed}: ${FA_CUP_FIELD} clubs enter (${field.length})`);
    check(new Set(field).size === FA_CUP_FIELD, `seed ${seed}: nobody is in it twice`);
    check(CLUBS.every(c => field.includes(c)), `seed ${seed}: every Premier League club is guaranteed a place`);
    check(CHAMPIONSHIP_CLUBS.every(c => field.includes(c)),
      `seed ${seed}: every Championship club is guaranteed a place too`);

    const rest = field.filter(c => !CLUBS.includes(c) && !CHAMPIONSHIP_CLUBS.includes(c));
    check(rest.length === restCount, `seed ${seed}: ${restCount} places left over (${rest.length})`);

    const nationalCount = rest.filter(c => NATIONAL_LEAGUE_CLUBS.includes(c)).length;
    check(nationalCount >= 1 && nationalCount <= 2,
      `seed ${seed}: one or two National League clubs, never zero or three-plus (${nationalCount})`);
    if (nationalCount === 1) sawOne = true;
    if (nationalCount === 2) sawTwo = true;

    const l1l2 = rest.filter(c => !NATIONAL_LEAGUE_CLUBS.includes(c));
    check(l1l2.every(c => LEAGUE_ONE_CLUBS.includes(c) || LEAGUE_TWO_CLUBS.includes(c)),
      `seed ${seed}: everything else is a real League One or League Two club (${l1l2.join(", ")})`);
    check(l1l2.length + nationalCount === restCount, `seed ${seed}: the leftover places split correctly (${l1l2.length}+${nationalCount})`);
    if (l1l2.some(c => LEAGUE_ONE_CLUBS.includes(c))) sawL1 = true;
    if (l1l2.some(c => LEAGUE_TWO_CLUBS.includes(c))) sawL2 = true;
  }
  check(sawOne, "a one-National-League-club draw happens");
  check(sawTwo, "a two-National-League-club draw happens too");
  check(sawL1, "League One clubs genuinely turn up");
  check(sawL2, "League Two clubs genuinely turn up in the SAME draw shape — a real mix, not one pool exhausted first");

  // The mix is genuine within a single draw, not "League One this season,
  // League Two next" — most individual draws should have some of each.
  let mixedDraws = 0;
  for (let seed = 0; seed < 200; seed++) {
    const field = cupField(LEAGUE, "premier", mulberry(seed * 91 + 13), "FA Cup");
    const rest = field.filter(c => !CLUBS.includes(c) && !CHAMPIONSHIP_CLUBS.includes(c));
    const hasL1 = rest.some(c => LEAGUE_ONE_CLUBS.includes(c));
    const hasL2 = rest.some(c => LEAGUE_TWO_CLUBS.includes(c));
    if (hasL1 && hasL2) mixedDraws++;
  }
  check(mixedDraws > 150, `most draws mix League One and League Two together, not one then the other (${mixedDraws}/200)`);

  // Works the other way round too — a Championship career reaches the real
  // Premier League as its guaranteed "other" tier, same as the League Cup.
  const champLeague = buildLeague([...CHAMPIONSHIP_CLUBS], CHAMPIONSHIP_CLUBS[0]);
  for (let seed = 0; seed < 30; seed++) {
    const field = cupField(champLeague, "championship", mulberry(seed * 29 + 3), "FA Cup");
    check(field.length === FA_CUP_FIELD, `championship seed ${seed}: still sixty-four clubs (${field.length})`);
    check(PREMIER_LEAGUE_CLUBS.every(c => field.includes(c)),
      `championship seed ${seed}: every real Premier League club is guaranteed a place`);
    check(CHAMPIONSHIP_CLUBS.every(c => field.includes(c)),
      `championship seed ${seed}: every Championship club — including your own — is guaranteed a place`);
  }

  // League One/Two/National League clubs are distinctly weaker than the
  // Championship's own 58 baseline and the old pool's 50 — an FA Cup upset
  // from this deep should be a real upset.
  check(cupStrength(LEAGUE_TWO_CLUBS[0], LEAGUE) < cupStrength(CHAMPIONSHIP_CLUBS[0], LEAGUE),
    "a League Two club rates below a Championship one");
  check(cupStrength(NATIONAL_LEAGUE_CLUBS[0], LEAGUE) < cupStrength(LEAGUE_TWO_CLUBS[0], LEAGUE),
    "and a National League club rates below League Two");
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

// ── A cup plays out to one winner — the FA Cup's new sixth round ───────────
{
  for (let seed = 0; seed < 60; seed++) {
    const rng = mulberry(seed * 31 + 5);
    let cup = openCup("FA Cup", LEAGUE, "premier", rng);
    check(cup.rounds[0].ties.length === 32, `seed ${seed}: thirty-two first-round ties`);
    check(cup.rounds[0].name === FA_CUP_ROUND_NAMES[0], `seed ${seed}: it is the round of 64`);

    let guard = 0;
    while (!cup.winner && guard++ < 10) cup = playCupRound(cup, LEAGUE, "nobody", null, rng);

    check(!!cup.winner, `seed ${seed}: somebody wins it`);
    check(cup.rounds.length === 6, `seed ${seed}: six rounds (${cup.rounds.length})`);
    check(cup.rounds.map(r => r.ties.length).join(",") === "32,16,8,4,2,1",
      `seed ${seed}: 32, 16, 8, 4, 2, 1 ties (${cup.rounds.map(r => r.ties.length).join(",")})`);
    check(cup.rounds.map(r => r.name).join(",") === FA_CUP_ROUND_NAMES.join(","),
      `seed ${seed}: the round names run in order (${cup.rounds.map(r => r.name).join(",")})`);
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
    check(tieWinner(cup.rounds[5].ties[0]) === cup.winner, `seed ${seed}: the winner won the final`);
  }
}

// ── The League Cup's own five rounds are still exactly what they were ──────
{
  for (let seed = 0; seed < 30; seed++) {
    const rng = mulberry(seed * 47 + 5);
    let cup = openCup("League Cup", LEAGUE, "premier", rng);
    check(cup.rounds[0].ties.length === 16, `seed ${seed}: sixteen first-round League Cup ties`);
    check(cup.rounds[0].name === CUP_ROUND_NAMES[0], `seed ${seed}: it is still the round of 32`);
    let guard = 0;
    while (!cup.winner && guard++ < 10) cup = playCupRound(cup, LEAGUE, "nobody", null, rng);
    check(cup.rounds.length === 5, `seed ${seed}: still five rounds (${cup.rounds.length})`);
    check(!!cup.winner, `seed ${seed}: the League Cup still reaches a winner`);
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
    const cup = playCupRound(openCup("FA Cup", LEAGUE, "premier", rng), LEAGUE, "nobody", null, rng);
    const r2 = cup.rounds[1];
    const tie = r2?.ties.find(t => t.home === "Liverpool" || t.away === "Liverpool");
    if (tie) seen.add(tie.home === "Liverpool" ? tie.away : tie.home);
  }
  check(seen.size > 8, `the second-round opponent is genuinely drawn (${seen.size} different clubs across 200 draws)`);
}

// ── Your tie is yours; the rest of the country is not ───────────────────────
{
  const rng = mulberry(99);
  const cup = openCup("FA Cup", LEAGUE, "premier", rng);
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
  check(exitRound(out, "Liverpool") === FA_CUP_ROUND_NAMES[0], `and records the round (${exitRound(out, "Liverpool")})`);
  check(!!currentRound(out), "the cup carries on without you");
  check(out.rounds[1].ties.every(t => t.home !== "Liverpool" && t.away !== "Liverpool"),
    "…and you are not in the next draw");
}

// ── A cup goal is not a Golden Boot goal ────────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England", startYear: 2027,
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
console.log("PASS — League Cup 32/five rounds, FA Cup 64/six rounds, a draw every round, and cup goals stay out of the league charts");
