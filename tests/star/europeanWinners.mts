import { openCup, playCupRound, finishCupToWinner, type CupState, type CupTie } from "../../lib/star/cups";
import { seasonQualifiers, seedPreSeason } from "../../lib/star/competitions";
import { crownWithoutYou } from "../../lib/star/euro";
import { buildLeague, sortLeague } from "../../lib/star/season";
import type { CareerState, LeagueTeam } from "../../lib/star/types";

/**
 * WHO ACTUALLY WON EVERYTHING.
 *
 * Reported: "we should make it so that all competitions are simulated through
 * each round regardless of whether the user's team are in the competitions."
 *
 * Before this, a domestic cup you were knocked out of simply stopped — no FA
 * Cup or League Cup winner was ever determined for a season you didn't win,
 * and Community Shield / Super Cup checked only YOUR trophy cabinet, so both
 * fixtures silently vanished from the calendar in any season you didn't
 * personally win the relevant trophy — even though in reality they'd still be
 * played between whichever two clubs actually won those things.
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

// ── A cup you are knocked out of still finishes ─────────────────────────────
{
  const rng = mulberry(1);
  let state: CupState = openCup("FA Cup", LEAGUE, rng);
  // Play "your" round as a loss, the way settleCupTie does before handing off
  // to finishCupToWinner — Liverpool goes out in round one.
  const tie = state.rounds[0].ties.find(t => t.home === "Liverpool" || t.away === "Liverpool")!;
  const oppWon = tie.home === "Liverpool" ? { hs: 0, as: 1 } : { hs: 1, as: 0 };
  state = playCupRound(state, LEAGUE, "Liverpool", oppWon, rng);
  check(!state.winner, "not decided after just the first round");

  const finished = finishCupToWinner(state, LEAGUE, "Liverpool", rng);
  check(!!finished.winner, `a winner is reached without you (got: ${finished.winner})`);
  check(finished.winner !== "Liverpool", "and it is not the club that already went out");
  // Every round after the one Liverpool lost should be fully played.
  const allPlayed = finished.rounds.every(r => r.ties.every(t => t.hs !== undefined));
  check(allPlayed, "every round on the way to the winner was actually played, not skipped");

  // Idempotent: calling it again on an already-finished state changes nothing.
  const again = finishCupToWinner(finished, LEAGUE, "Liverpool", rng);
  check(again.winner === finished.winner, "finishing an already-finished cup is a no-op");
}

// Losing the FINAL itself must resolve immediately (playCupRound already sets
// the winner on a single-tie round), and finishCupToWinner must not choke on
// a state that has no more rounds to draw.
{
  const rng = mulberry(2);
  const state: CupState = {
    competition: "League Cup",
    rounds: [{ name: "Final", ties: [{ home: "Arsenal", away: "Chelsea" } as CupTie] }],
  };
  const played = playCupRound(state, LEAGUE, "Arsenal", { hs: 1, as: 2 }, rng);
  check(played.winner === "Chelsea", `the final alone decides it (winner: ${played.winner})`);
  const finished = finishCupToWinner(played, LEAGUE, "Arsenal", rng);
  check(finished.winner === "Chelsea", "finishing a state that already has a winner leaves it alone");
}

// ── European qualification, applied to the whole division ──────────────────
{
  // Twenty clubs: top 5 Champions League, 6th/7th Europa League — same maths
  // as qualificationFor, just read straight off final league position instead
  // of asking about one club at a time.
  const table = sortLeague(LEAGUE);
  // No cup winners this round — plain league-position case.
  const q = seasonQualifiers(LEAGUE, null, null);
  check(q.champions.length === 5, `top five by table go into the Champions League (${q.champions.length})`);
  check(q.europa.length === 2, `sixth and seventh go into the Europa League (${q.europa.length})`);
  check(q.champions.every(c => table.slice(0, 5).map(t => t.name).includes(c)), "the right five, specifically");

  // A cup winner OUTSIDE the top seven earns a Europa League place on top.
  const outsideTop7 = table[10].name;
  const withCup = seasonQualifiers(LEAGUE, outsideTop7, null);
  check(withCup.europa.includes(outsideTop7), `an unqualified cup winner (${outsideTop7}) gets the Europa League place`);
  check(withCup.europa.length === 3, `which is a real extra place, not a swap (${withCup.europa.length})`);

  // A cup winner who ALREADY qualified through the league does not create a
  // second place — the vacated berth cascades to the next club by position.
  const alreadyChampion = table[0].name;
  const eighthPlace = table[7].name;
  const cascaded = seasonQualifiers(LEAGUE, alreadyChampion, null);
  check(!cascaded.europa.includes(alreadyChampion),
    "the champion's own cup win does not double up their European spot");
  check(cascaded.europa.includes(eighthPlace),
    `the vacated place cascades to 8th by table position (${eighthPlace})`);
  // Real UEFA rule: the cup's own continental berth is still used by someone
  // even when the winner did not need it — so this IS a third place, cascaded
  // rather than dropped, same as an outside-top-7 cup winner adds one.
  check(cascaded.europa.length === 3, `the vacated berth still goes to someone — three places, not two (${cascaded.europa.length})`);

  // Both domestic cups won by the same already-qualified club: only one
  // cascade happens per vacated place, to two DIFFERENT clubs in turn.
  const ninthPlace = table[8].name;
  const both = seasonQualifiers(LEAGUE, alreadyChampion, alreadyChampion);
  check(both.europa.includes(eighthPlace) && both.europa.includes(ninthPlace),
    `two cup wins by one already-qualified club cascade to two different clubs (${[...both.europa]})`);
}

// ── A winner exists even when you were never in it ──────────────────────────
{
  const withoutEntrants = crownWithoutYou("Champions League", [], 5);
  check(!!withoutEntrants, `a winner is still named from the fixed pool alone (${withoutEntrants})`);

  // A Premier League entrant that qualified this season is a genuine
  // candidate, not just flavour text: at a strength on par with Europe's
  // best (100, same scale as Real Madrid's 92), it should win a real, sizeable
  // share against the other sixteen contenders — and pushed well past that
  // scale, it should win outright most of the time, confirming the weighting
  // actually responds to strength rather than treating every entrant the same.
  const trials = 300;
  const winRate = (strength: number) => {
    let wins = 0;
    for (let seed = 0; seed < trials; seed++) {
      if (crownWithoutYou("Champions League", [{ name: "X", strength }], seed * 97 + 1) === "X") wins++;
    }
    return wins / trials;
  };
  const atTop = winRate(100);
  check(atTop > 0.08, `a top-calibre entrant wins a real share, not a token one (${(atTop * 100).toFixed(1)}%)`);
  const dominant = winRate(150);
  check(dominant > 0.4, `and scaling strength up further scales its win rate up with it (${(dominant * 100).toFixed(1)}%)`);

  // A weak entrant essentially never beats the actual best sides in Europe.
  let weakWins = 0;
  for (let seed = 0; seed < trials; seed++) {
    const winner = crownWithoutYou("Europa League", [{ name: "Weak FC", strength: 40 }], seed * 53 + 3);
    if (winner === "Weak FC") weakWins++;
  }
  check(weakWins < trials * 0.05, `a weak entrant almost never wins it (${weakWins}/${trials})`);
}

// ── Community Shield / Super Cup read the real winners, not your cabinet ───
{
  const base: CareerState = {
    season: 2,
    player: { club: "Arsenal" },
    league: LEAGUE,
  } as unknown as CareerState;

  // Neither trophy is yours: no fixture for either, because it is not your
  // match to play.
  const notInvolved: CareerState = {
    ...base,
    lastSeasonWinners: { league: "Chelsea", faCup: "Liverpool", championsLeague: "Real Madrid", europaLeague: "Sevilla" },
  };
  check(seedPreSeason(notInvolved).length === 0, "no fixture when your club won neither trophy in either pair");

  // You won the league, somebody else won the FA Cup: Community Shield
  // against the REAL cup holder, not a placeholder.
  const wonLeague: CareerState = {
    ...base,
    lastSeasonWinners: { league: "Arsenal", faCup: "Liverpool", championsLeague: "Real Madrid", europaLeague: "Sevilla" },
  };
  const shieldFixtures = seedPreSeason(wonLeague);
  const shield = shieldFixtures.find(f => f.competition === "Community Shield");
  check(!!shield, "Community Shield fixture appears when you're the league champion");
  check(shield?.opponent === "Liverpool", `against the real FA Cup holder (got: ${shield?.opponent})`);

  // The Double: your own club won both, so the Shield opponent is the league
  // runner-up, not yourself.
  const double: CareerState = {
    ...base,
    lastSeasonWinners: {
      league: "Arsenal", leagueRunnerUp: "Manchester City", faCup: "Arsenal",
      championsLeague: "Real Madrid", europaLeague: "Sevilla",
    },
  };
  const doubleShield = seedPreSeason(double).find(f => f.competition === "Community Shield");
  check(doubleShield?.opponent === "Manchester City",
    `a Double sends the runner-up, not yourself (got: ${doubleShield?.opponent})`);

  // Super Cup: you won the Europa League, a Premier League rival won the
  // Champions League this season — the opponent is a real named club, not
  // always one of the fixed European pool.
  const superCup: CareerState = {
    ...base,
    lastSeasonWinners: {
      league: "Chelsea", faCup: "Liverpool",
      championsLeague: "Manchester City", europaLeague: "Arsenal",
    },
  };
  const superFixture = seedPreSeason(superCup).find(f => f.competition === "Super Cup");
  check(superFixture?.opponent === "Manchester City",
    `Super Cup opponent can be a Premier League rival now (got: ${superFixture?.opponent})`);
  check((superFixture?.opponentStrength ?? 0) > 0, "and it carries a real strength, not a missing-club default");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — every cup finishes to a real winner, and the Shield/Super Cup meet them");
