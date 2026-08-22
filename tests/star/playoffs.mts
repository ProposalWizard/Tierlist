import { seedPlayOffs, settlePlayOffFixture } from "../../lib/star/playoffs";
import { resolveLadder } from "../../lib/star/promotion";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32, sortLeague } from "../../lib/star/season";
import { CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { PLAY_OFF_SLOTS } from "../../lib/star/calendar";
import type { CareerState, StarPlayer, Fixture } from "../../lib/star/types";

/**
 * THE PLAY-OFFS YOU PLAY.
 *
 * Reaching them should put real fixtures on the calendar and let the last
 * promotion place be decided by matches rather than by a dice roll — and,
 * crucially, the rollover must then USE that result rather than quietly
 * re-simulating one on top of it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027,
  } as StarPlayer;
}

/** Finishing order, top to bottom. */
function withStandings(career: CareerState, order: string[]): CareerState {
  return {
    ...career,
    league: career.league.map((t) => {
      const at = order.indexOf(t.name);
      const points = (order.length - at) * 3;
      return { ...t, played: 46, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
    }),
  };
}

const clubs = [...CHAMPIONSHIP_CLUBS];
/** Put `you` in a chosen finishing position (1-indexed). */
function seasonEndingAt(place: number, you = clubs[10]): CareerState {
  const order = clubs.filter(c => c !== you);
  order.splice(place - 1, 0, you);
  return withStandings(makeInitialCareer(playerAt(you), clubs, "championship"), order);
}

// ── Who gets them, and who does not ─────────────────────────────────────────
{
  for (const place of [1, 2, 7, 12, 24]) {
    check(seedPlayOffs(seasonEndingAt(place)) === null,
      `finishing ${place}th does not put you in the play-offs`);
  }
  for (const place of [3, 4, 5, 6]) {
    check(seedPlayOffs(seasonEndingAt(place)) !== null,
      `finishing ${place}th does`);
  }
  // Not a Championship thing at all if you are not in the Championship.
  const pl = withStandings(
    makeInitialCareer(playerAt(PREMIER_LEAGUE_CLUBS[4]), [...PREMIER_LEAGUE_CLUBS], "premier"),
    [...PREMIER_LEAGUE_CLUBS]);
  check(seedPlayOffs(pl) === null, "a Premier League season never has play-offs");
}

// ── Reaching them puts two real fixtures on the calendar ────────────────────
{
  const career = seasonEndingAt(4);
  const seeded = seedPlayOffs(career)!;
  check(seeded.fixtures.length === 2, `two semi-final legs (${seeded.fixtures.length})`);
  check(seeded.fixtures.every(f => f.kind === "playoff" && f.competition === "Play-Offs"),
    "both are play-off fixtures");
  check(seeded.fixtures[0].week === PLAY_OFF_SLOTS[0].week
     && seeded.fixtures[1].week === PLAY_OFF_SLOTS[1].week,
    "on the calendar's own play-off weeks");
  // 4th plays 5th, and the higher seed is at home in the SECOND leg.
  const table = sortLeague(career.league).map(t => t.name);
  check(seeded.fixtures[0].opponent === table[4], `4th plays 5th (${seeded.fixtures[0].opponent})`);
  check(seeded.fixtures[0].home === false && seeded.fixtures[1].home === true,
    "away first, home second, as the higher seed");
  // The other semi is decided up front, so a final always has an opponent.
  check(!!seeded.state.semis[1].winner, "the other semi-final is already resolved");
  check(seeded.state.semis[1].legs.length === 2, "and it was played over two legs");
}

// ── Winning the semi earns a final; losing it ends the run ──────────────────
{
  const base = seasonEndingAt(3);
  const seeded = seedPlayOffs(base)!;
  let career: CareerState = { ...base, playOffState: seeded.state, fixtures: [...base.fixtures, ...seeded.fixtures] };
  const [leg1, leg2] = seeded.fixtures;

  // Thrash them over both legs.
  const a = settlePlayOffFixture(career, leg1, 3, 0)!;
  check(a.result === "through" && a.fixtures.length === 0, "the first leg settles nothing on its own");
  career = { ...career, playOffState: a.state };
  const b = settlePlayOffFixture(career, leg2, 2, 0)!;
  check(b.result === "through", `winning on aggregate goes through (${b.result})`);
  check(b.fixtures.length === 1 && b.fixtures[0].round === "Play-Off Final",
    "which earns a final");
  check(b.fixtures[0].week === PLAY_OFF_SLOTS[2].week, "on the final's own week");
  check(b.fixtures[0].opponent === seeded.state.semis[1].winner,
    "against the other semi-final's winner");

  // …and the other way round.
  let lost: CareerState = { ...base, playOffState: seeded.state };
  const c = settlePlayOffFixture(lost, leg1, 0, 2)!;
  lost = { ...lost, playOffState: c.state };
  const d = settlePlayOffFixture(lost, leg2, 0, 1)!;
  check(d.result === "eliminated", `losing on aggregate is out (${d.result})`);
  check(d.fixtures.length === 0, "and earns nothing");
  check(d.state.yourRunOver === true, "the run is marked over");
  check(d.state.promoted === undefined, "and nobody was promoted through you");
}

// ── The final decides it, and the rollover honours the real result ──────────
{
  for (const [label, hs, as, expectPromoted] of [
    ["winning", 2, 1, true], ["losing", 0, 1, false],
  ] as const) {
    const base = seasonEndingAt(3);
    const seeded = seedPlayOffs(base)!;
    let career: CareerState = { ...base, playOffState: seeded.state };
    const [leg1, leg2] = seeded.fixtures;
    career = { ...career, playOffState: settlePlayOffFixture(career, leg1, 2, 0)!.state };
    const semi = settlePlayOffFixture(career, leg2, 2, 0)!;
    career = { ...career, playOffState: semi.state };
    const final = semi.fixtures[0];

    const out = settlePlayOffFixture(career, final, hs, as)!;
    check(out.result === (expectPromoted ? "promoted" : "lost-final"),
      `${label} the final reads as ${expectPromoted ? "promoted" : "lost-final"} (${out.result})`);
    check(out.state.promoted === (expectPromoted ? career.player.club : final.opponent),
      `${label}: the right club goes up (${out.state.promoted})`);

    // The rollover must not re-roll a play-off that was actually played.
    const after: CareerState = { ...career, playOffState: out.state };
    const ladder = resolveLadder(after, mulberry32(99));
    check(ladder.playOffs === null,
      `${label}: the rollover does not simulate a play-off you played`);
    check(ladder.promotedToPremier.includes(out.state.promoted!),
      `${label}: the club that actually won it is the one promoted`);
    check(ladder.promotedToPremier.length === 3, `${label}: still three up`);
    if (expectPromoted) {
      check(ladder.division === "premier" && ladder.yourMove === "promoted",
        `${label}: you go up (${ladder.division})`);
    } else {
      check(ladder.division === "championship" && ladder.yourMove === null,
        `${label}: you stay down (${ladder.division})`);
    }
  }
}

// ── A play-off you never reached is still simulated for everybody else ──────
{
  const career = seasonEndingAt(12);
  check(seedPlayOffs(career) === null, "you are not in them");
  const ladder = resolveLadder(career, mulberry32(3));
  check(ladder.playOffs !== null, "but they are still played out");
  check(ladder.promotedToPremier.length === 3, "and three clubs still go up");
  const table = sortLeague(career.league).map(t => t.name);
  check(table.slice(2, 6).includes(ladder.playOffs!.promoted),
    "the play-off place went to one of 3rd-6th");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — reach them, play them, and the rollover honours what you did");
