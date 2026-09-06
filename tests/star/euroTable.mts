import { openEuro, simulateEuroMatchday, sortEuro } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";
import type { LeagueSquad } from "../../lib/star/types";

/**
 * THE LEAGUE-PHASE TABLE, MATCHDAY BY MATCHDAY — AND, NOW, EVERY GAME A REAL
 * FIXTURE WITH NAMED SCORERS.
 *
 * Reported directly, with a real save as the evidence: after playing only
 * matchday one, the table already showed every club — you included — on a
 * full eight games played. The previous design (`buildEuroTable`, since
 * removed) recomputed a fully-projected thirty-six-club table from scratch
 * on every render, simulating even your own unplayed fixtures. This is the
 * replacement: `simulateEuroMatchday` runs exactly once per matchday, the
 * moment your own result for it is known, and the table is real,
 * incrementally-accumulated state (`EuroState.liveTable`) — never
 * fabricated ahead of where the season has actually got to.
 *
 * Requested directly, later: "it should know who [an upcoming opponent has]
 * played... know the result... even know who scored the goals... called the
 * assists." `simulateEuroMatchday` now also builds a real `EuroFixtureResult`
 * for every one of a matchday's eighteen games (not just credits a bare
 * scoreline to the table) and appends them to `EuroState.results` — the
 * European analogue of `career.results`, and deliberately the same
 * `LeagueResult` shape so `scoutReport.ts` can read it unchanged.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** A minimal real squad, for exercising the named-scorer path. */
function squadFor(club: string): LeagueSquad {
  const positions = ["GK", "CB", "LB", "CM", "CAM", "ST"] as const;
  return {
    club,
    players: positions.map((pos, i) => ({
      id: `${club}-${i}`, name: `${club} Player ${i}`, position: pos,
      overall: 70 + i, goals: 0, assists: 0,
    })),
  };
}

function freshState(competition: "Champions League" | "Europa League" = "Champions League") {
  return openEuro(competition, "Test FC", 78, 3, mulberry32(11));
}

// ── A fresh campaign starts genuinely blank, not pre-filled ────────────────
{
  const state = freshState();
  check(state.liveTable.length === 36, `all thirty-six clubs are in the table from the start (${state.liveTable.length})`);
  check(state.liveTable.every(r => r.played === 0), "…but nobody has played anything yet");
  check(state.matchdaysPlayed === 0, "no matchday has been simulated yet");
  check(state.liveTable.filter(r => r.isYou).length === 1, "exactly one row is you");
  check((state.results ?? []).length === 0, "…and no fixture history exists yet either");
}

// ── Simulating ONE matchday plays exactly that many games — not the whole
// phase — for every one of the thirty-six clubs, you included ─────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const rng = mulberry32(999);
  const after = simulateEuroMatchday(state, 0, "Test FC", opponent, true, 3, 1, rng);

  check(after.matchdaysPlayed === 1, `exactly matchday one is recorded as played (${after.matchdaysPlayed})`);
  check(after.liveTable.every(r => r.played === 1),
    `every one of the thirty-six clubs has played exactly one game, not eight (${after.liveTable.map(r => r.played).join(",")})`);

  const you = after.liveTable.find(r => r.isYou)!;
  check(you.won === 1 && you.points === 3, `your real 3-1 win is credited (${you.won}W, ${you.points}pts)`);
  check(you.goalsFor === 3 && you.goalsAgainst === 1, `…with the real scoreline (${you.goalsFor}-${you.goalsAgainst})`);

  const them = after.liveTable.find(r => r.name === opponent)!;
  check(them.lost === 1 && them.points === 0, `your opponent is credited the real loss, not simulated separately (${them.lost}L, ${them.points}pts)`);

  // The matchday's eighteen games are all stored as real fixtures now, not
  // just folded into the table and discarded.
  check((after.results ?? []).length === 18, `all eighteen of the matchday's games are stored as real fixtures (${(after.results ?? []).length})`);
  check((after.results ?? []).every(r => r.week === 1), "…every one tagged with the matchday it was actually played on");
  const yourFixture = (after.results ?? []).find(r => r.home === "Test FC" || r.away === "Test FC");
  check(!!yourFixture && yourFixture.home === "Test FC" && yourFixture.away === opponent
    && yourFixture.hs === 3 && yourFixture.as === 1,
    `your own match is stored with the real scoreline, home/away correct (${JSON.stringify(yourFixture)})`);
}

// ── Named scorers and assists — for YOUR match (with real, live-match goal
// events handed in, the same way playLeagueWeek's user.goals/oppGoals work)
// AND for the other seventeen games (a fresh weighted roll, same as the
// domestic league simulates everyone else's) ──────────────────────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const squads = [squadFor("Test FC"), squadFor(opponent)];
  const yourGoals = [{ m: 12, s: "Player 5" }, { m: 61, s: "Player 5", a: "Player 4" }, { m: 80, s: "Player 3" }];
  const after = simulateEuroMatchday(
    state, 0, "Test FC", opponent, true, 3, 0, mulberry32(42), squads, yourGoals,
  );
  const yourFixture = after.results!.find(r => r.home === "Test FC")!;
  check(JSON.stringify(yourFixture.hg) === JSON.stringify(yourGoals),
    `your own real goal events are stored exactly as handed in, not re-rolled (${JSON.stringify(yourFixture.hg)})`);

  // The other seventeen games: at least SOME of them involve a club whose
  // squad was NOT supplied (only two of the thirty-six squads exist here),
  // so this also exercises "no squad -> no named scorers, but the scoreline
  // still stands" without a separate test.
  const othersWithGoals = after.results!.filter(r => r.home !== "Test FC" && r.away !== "Test FC" && (r.hs > 0 || r.as > 0));
  check(othersWithGoals.length > 0, "at least one of the other seventeen games actually had a goal in it, to test against");
  const namedElsewhere = othersWithGoals.some(r => (r.hg?.length ?? 0) > 0 || (r.ag?.length ?? 0) > 0);
  check(!namedElsewhere, "…and since neither club in any of THOSE games has a squad supplied, none of them get named scorers either — the fallback is real, not accidentally always-on");
}

// ── With every club's squad supplied, every scoring game gets named
// scorers — this is the actual payoff: a Champions League scout report can
// show "who scored" for a club you've never even played yet. ─────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const squads = state.clubs.map(c => squadFor(c.name));
  const after = simulateEuroMatchday(state, 0, "Test FC", opponent, true, 2, 1, mulberry32(7), squads);
  const scoringGames = after.results!.filter(r => r.hs > 0 || r.as > 0);
  const missingNames = scoringGames.filter(r => (r.hs > 0 && !r.hg?.length) || (r.as > 0 && !r.ag?.length));
  check(missingNames.length === 0,
    `every game with a goal in it has a named scorer for that side, once every club's squad is available (${missingNames.length} missing)`);
  // And the squad itself was actually mutated — a real Golden-Boot-style tally.
  const totalGoalsNamed = squads.reduce((s, sq) => s + sq.players.reduce((s2, p) => s2 + p.goals, 0), 0);
  const totalGoalsScored = after.results!.reduce((s, r) => s + r.hs + r.as, 0);
  check(totalGoalsNamed === totalGoalsScored,
    `every single goal across the whole matchday is credited to a real named player (${totalGoalsNamed} named vs ${totalGoalsScored} scored)`);
}

// ── Playing every matchday in order reaches exactly eight for everyone —
// not "almost always": the old fill algorithm this replaced could leave
// exactly one club stuck on nothing with nobody left to play. Here there is
// no such failure mode by construction (36 clubs, 34 always pair evenly
// once you and your opponent are set aside) — stress-tested across many
// seeds and campaign starting conditions anyway, since "provably can't fail"
// is worth checking, not just asserting. ─────────────────────────────────
{
  let anyShort = false;
  for (let seed = 0; seed < 40; seed++) {
    for (const competition of ["Champions League", "Europa League"] as const) {
      let state = openEuro(competition, "Test FC", 70 + (seed % 20), 1 + (seed % 20), mulberry32(seed * 31 + 7));
      const rng = mulberry32(seed * 104729 + 17);
      for (let md = 0; md < 8; md++) {
        const opponent = state.leaguePhase[md].opponent;
        state = simulateEuroMatchday(state, md, "Test FC", opponent, md % 2 === 0, (seed + md) % 4, (seed + md + 1) % 4, rng);
      }
      if (state.liveTable.length !== 36 || state.liveTable.some(r => r.played !== 8)) {
        anyShort = true;
        problems.push(`seed ${seed}/${competition}: ${state.liveTable.length} clubs, played counts [${state.liveTable.map(r => r.played).join(",")}]`);
      }
      if (state.matchdaysPlayed !== 8) {
        anyShort = true;
        problems.push(`seed ${seed}/${competition}: matchdaysPlayed is ${state.matchdaysPlayed}, not 8`);
      }
    }
  }
  check(!anyShort, "every club reaches exactly eight played after all eight matchdays run, across forty seeds and both competitions");
}

// ── Deterministic: the same inputs and rng stream always produce the same
// matchday result — reopening the screen mid-phase must not reshuffle what
// already happened. ─────────────────────────────────────────────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const first = simulateEuroMatchday(state, 0, "Test FC", opponent, true, 2, 2, mulberry32(555));
  const second = simulateEuroMatchday(state, 0, "Test FC", opponent, true, 2, 2, mulberry32(555));
  check(JSON.stringify(first.liveTable) === JSON.stringify(second.liveTable),
    "the same matchday, replayed with the same seed, produces the exact same table");
  check(JSON.stringify(first.results) === JSON.stringify(second.results),
    "…and the exact same set of named fixtures too");
}

// ── Guarded against replaying an already-simulated matchday ────────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const once = simulateEuroMatchday(state, 0, "Test FC", opponent, true, 1, 0, mulberry32(1));
  const again = simulateEuroMatchday(once, 0, "Test FC", opponent, true, 9, 9, mulberry32(2));
  check(JSON.stringify(again.liveTable) === JSON.stringify(once.liveTable),
    "asking for a matchday that's already been played is a no-op, not a second, contradictory result");
  check(again.matchdaysPlayed === 1, "…and the count doesn't move either");
  check((again.results ?? []).length === 18, "…and the fixture history doesn't grow a second copy of the matchday either");
}

// ── sortEuro: points first, goal difference the tiebreak ───────────────────
{
  const rows = [
    { name: "A", played: 8, won: 5, drawn: 2, lost: 1, goalsFor: 12, goalsAgainst: 8, points: 17, isYou: false },
    { name: "B", played: 8, won: 5, drawn: 2, lost: 1, goalsFor: 15, goalsAgainst: 6, points: 17, isYou: false },
    { name: "C", played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 10, goalsAgainst: 9, points: 18, isYou: false },
  ];
  const sorted = sortEuro(rows);
  check(sorted[0].name === "C", `most points leads regardless of goal difference (${sorted[0].name})`);
  check(sorted[1].name === "B", `level on points, the better goal difference (+9) comes before the worse one (+4) (${sorted[1].name})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the league phase plays out one real matchday at a time, never fabricated ahead of where the season actually is");
