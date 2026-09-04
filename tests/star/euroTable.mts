import { openEuro, simulateEuroMatchday, sortEuro } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE LEAGUE-PHASE TABLE, MATCHDAY BY MATCHDAY.
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
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

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
}

// ── Simulating ONE matchday plays exactly that many games — not the whole
// phase — for every one of the thirty-six clubs, you included ─────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const rng = mulberry32(999);
  const after = simulateEuroMatchday(state, 0, "Test FC", opponent, 3, 1, rng);

  check(after.matchdaysPlayed === 1, `exactly matchday one is recorded as played (${after.matchdaysPlayed})`);
  check(after.liveTable.every(r => r.played === 1),
    `every one of the thirty-six clubs has played exactly one game, not eight (${after.liveTable.map(r => r.played).join(",")})`);

  const you = after.liveTable.find(r => r.isYou)!;
  check(you.won === 1 && you.points === 3, `your real 3-1 win is credited (${you.won}W, ${you.points}pts)`);
  check(you.goalsFor === 3 && you.goalsAgainst === 1, `…with the real scoreline (${you.goalsFor}-${you.goalsAgainst})`);

  const them = after.liveTable.find(r => r.name === opponent)!;
  check(them.lost === 1 && them.points === 0, `your opponent is credited the real loss, not simulated separately (${them.lost}L, ${them.points}pts)`);
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
        state = simulateEuroMatchday(state, md, "Test FC", opponent, (seed + md) % 4, (seed + md + 1) % 4, rng);
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
  const first = simulateEuroMatchday(state, 0, "Test FC", opponent, 2, 2, mulberry32(555));
  const second = simulateEuroMatchday(state, 0, "Test FC", opponent, 2, 2, mulberry32(555));
  check(JSON.stringify(first.liveTable) === JSON.stringify(second.liveTable),
    "the same matchday, replayed with the same seed, produces the exact same table");
}

// ── Guarded against replaying an already-simulated matchday ────────────────
{
  const state = freshState();
  const opponent = state.leaguePhase[0].opponent;
  const once = simulateEuroMatchday(state, 0, "Test FC", opponent, 1, 0, mulberry32(1));
  const again = simulateEuroMatchday(once, 0, "Test FC", opponent, 9, 9, mulberry32(2));
  check(JSON.stringify(again.liveTable) === JSON.stringify(once.liveTable),
    "asking for a matchday that's already been played is a no-op, not a second, contradictory result");
  check(again.matchdaysPlayed === 1, "…and the count doesn't move either");
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
