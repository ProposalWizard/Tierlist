import { buildSeasonFixtures, buildFixtures, playLeagueWeek, buildLeague, mulberry32, updateLeagueWithUserResult } from "../../lib/star/season";

/**
 * A real fixture list.
 *
 * The division used to have no schedule at all. Your own thirty-eight were a
 * proper round-robin; the other nine games each week were the remaining
 * eighteen clubs shuffled and paired off at random, freshly, every week. The
 * table stayed level — everybody played once a week and finished on 38 — but
 * two clubs could meet three times and another pair never, there was no answer
 * to "who is my rival playing this week", and the only result in the game was
 * your own.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Liverpool", "Arsenal", "Man City", "Chelsea", "Spurs", "Man Utd", "Newcastle", "Aston Villa",
  "Brighton", "West Ham", "Everton", "Fulham", "Palace", "Brentford", "Wolves", "Forest",
  "Bournemouth", "Leeds", "Burnley", "Sunderland",
];
const USER = "Liverpool";
const key = (a: string, b: string) => [a, b].sort().join(" v ");

// ── Everybody plays everybody, twice, once each way ─────────────────────────
{
  for (const n of [20, 18, 12, 6]) {
    const clubs = CLUBS.slice(0, n);
    const fx = buildSeasonFixtures(clubs);
    const weeks = 2 * (n - 1);

    check(fx.length === n * (n - 1) / 2 * 2, `${n} clubs: ${n * (n - 1)} fixtures (${fx.length})`);
    check(Math.max(...fx.map(f => f.week)) === weeks, `${n} clubs: ${weeks} gameweeks`);

    // Every unordered pair exactly twice, and exactly once at each ground.
    const meetings = new Map<string, number>();
    const venues = new Map<string, number>();
    for (const f of fx) {
      meetings.set(key(f.home, f.away), (meetings.get(key(f.home, f.away)) ?? 0) + 1);
      venues.set(`${f.home}>${f.away}`, (venues.get(`${f.home}>${f.away}`) ?? 0) + 1);
    }
    const pairs = n * (n - 1) / 2;
    check(meetings.size === pairs, `${n} clubs: every pair meets (${meetings.size}/${pairs})`);
    check([...meetings.values()].every(v => v === 2), `${n} clubs: and meets exactly twice`);
    check([...venues.values()].every(v => v === 1), `${n} clubs: once at each ground, never twice at one`);

    // One game per club per week, and nobody sits a week out.
    for (let w = 1; w <= weeks; w++) {
      const inWeek = fx.filter(f => f.week === w);
      const seen = new Set<string>();
      for (const f of inWeek) { seen.add(f.home); seen.add(f.away); }
      check(inWeek.length === n / 2, `${n} clubs, week ${w}: ${n / 2} games (${inWeek.length})`);
      check(seen.size === n, `${n} clubs, week ${w}: everybody plays exactly once`);
    }

    // Half your season at home. Guaranteed by the mirrored second half, but it
    // is the thing a fixture list is judged on, so it is asserted.
    for (const c of clubs) {
      const home = fx.filter(f => f.home === c).length;
      check(home === n - 1, `${c}: ${n - 1} home games (${home})`);
    }
  }
}

// ── Your own fixtures are read out of that same list ────────────────────────
{
  const fx = buildSeasonFixtures(CLUBS);
  const mine = buildFixtures(CLUBS, USER);
  check(mine.length === 38, `you play 38 (${mine.length})`);
  check(mine.every((f, i) => i === 0 || f.week > mine[i - 1].week), "…in week order, one a week");
  check(new Set(mine.map(f => f.opponent)).size === 19, "against nineteen different clubs");
  check(mine.filter(f => f.home).length === 19, `nineteen of them at home (${mine.filter(f => f.home).length})`);

  // The half that matters: your fixture and the division's fixture are the same
  // game. They used to be generated separately, which is how the results screen
  // would have shown your opponent playing somebody else.
  let agree = 0;
  for (const f of mine) {
    const scheduled = fx.find(g => g.week === f.week && (g.home === USER || g.away === USER))!;
    const opp = scheduled.home === USER ? scheduled.away : scheduled.home;
    if (opp === f.opponent && (scheduled.home === USER) === f.home) agree += 1;
  }
  check(agree === 38, `every one of your fixtures is the division's fixture (${agree}/38)`);
}

// ── A season played out: ten games a week, and a table that adds up ─────────
{
  let league = buildLeague(CLUBS, USER);
  const rng = mulberry32(4242);
  const mine = buildFixtures(CLUBS, USER);
  const all: { week: number; home: string; away: string; hs: number; as: number }[] = [];

  for (const f of mine) {
    const scored = 1 + Math.floor(rng() * 3), conceded = Math.floor(rng() * 3);
    league = updateLeagueWithUserResult(league, USER, f.opponent, scored, conceded);
    const round = playLeagueWeek(league, f.week, {
      club: USER, opponent: f.opponent, home: f.home, scored, conceded,
    }, rng);
    league = round.league;
    all.push(...round.results);
    check(round.results.length === 10, `week ${f.week}: ten games (${round.results.length})`);
  }

  check(all.length === 380, `a season is 380 games (${all.length})`);
  check(league.every(t => t.played === 38), `everybody plays 38 (${league.map(t => t.played).join(",")})`);
  check(league.every(t => t.won + t.drawn + t.lost === t.played), "won + drawn + lost adds up");
  check(league.every(t => t.points === t.won * 3 + t.drawn), "points add up");

  const gf = league.reduce((a, t) => a + t.goalsFor, 0);
  const ga = league.reduce((a, t) => a + t.goalsAgainst, 0);
  check(gf === ga, `every goal scored was conceded by somebody (${gf} vs ${ga})`);

  // And the played record IS the schedule — nobody met twice in a week, nobody
  // met three times in a season.
  const meetings = new Map<string, number>();
  for (const r of all) meetings.set(key(r.home, r.away), (meetings.get(key(r.home, r.away)) ?? 0) + 1);
  check(meetings.size === 190, `every pair met (${meetings.size}/190)`);
  check([...meetings.values()].every(v => v === 2), "…exactly twice, over the whole season");
  for (let w = 1; w <= 38; w++) {
    const seen = new Set<string>();
    let dup = 0;
    for (const r of all.filter(x => x.week === w)) {
      if (seen.has(r.home) || seen.has(r.away)) dup += 1;
      seen.add(r.home); seen.add(r.away);
    }
    check(dup === 0 && seen.size === 20, `week ${w}: twenty clubs, one game each`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — a real 38-week schedule: everybody twice, once each way, ten games a round");
