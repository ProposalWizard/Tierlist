import { openEuro, buildEuroTable, sortEuro, type EuroMatch } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE LEAGUE-PHASE TABLE, ON SCREEN.
 *
 * Requested directly: a real Champions/Europa League campaign had nowhere
 * on screen showing a table at all, despite the league phase genuinely
 * being one — eight real games apiece against thirty-five other real
 * clubs, the same shape the domestic table already is. `buildEuroTable`
 * already existed and already simulates the other thirty-five clubs'
 * results the way the domestic league does — it just had no test coverage
 * and, until now, nothing on screen ever called it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const SEED = 2027 * 104729 + 17;

function freshState(competition: "Champions League" | "Europa League" = "Champions League") {
  return openEuro(competition, "Test FC", 78, 3, mulberry32(11));
}

// ── A fresh campaign (nothing played yet) still produces a full table ──────
{
  const state = freshState();
  const table = sortEuro(buildEuroTable(state, "Test FC", SEED));
  check(table.length === 36, `all thirty-six clubs appear, not just the ones with real results (${table.length})`);
  check(table.every(t => t.played === 8), `every club — you included, on nothing played yet — is credited a full eight (${table.map(t => t.played).join(",")})`);
  check(table.filter(t => t.isYou).length === 1, "exactly one row is you");
  check(table.some(t => t.name === "Test FC"), "…and it's genuinely your own club in the table");
}

// ── Your OWN real results are credited, not overwritten by the simulation ──
{
  const state = freshState();
  // Play out all eight of your own games with a fixed, extreme scoreline —
  // if the simulation ever overwrote these, this exact tally couldn't survive.
  const played: EuroMatch[] = state.leaguePhase.map(m => ({ ...m, us: 4, them: 0 }));
  const withResults = { ...state, leaguePhase: played };

  const table = sortEuro(buildEuroTable(withResults, "Test FC", SEED));
  const you = table.find(t => t.isYou)!;
  check(you.played === 8, `your own eight are the ones credited, not re-simulated (${you.played})`);
  check(you.won === 8 && you.drawn === 0 && you.lost === 0,
    `eight real 4-0 wins survive into the table untouched (${you.won}W ${you.drawn}D ${you.lost}L)`);
  check(you.points === 24, `…worth the real twenty-four points, not a simulated number (${you.points})`);
  check(you.goalsFor === 32 && you.goalsAgainst === 0, `…and the real goal difference (${you.goalsFor}-${you.goalsAgainst})`);
}

// ── Deterministic: the same state and seed always builds the same table ────
{
  const state = freshState();
  const first = buildEuroTable(state, "Test FC", SEED);
  const second = buildEuroTable(state, "Test FC", SEED);
  check(JSON.stringify(sortEuro(first)) === JSON.stringify(sortEuro(second)),
    "reopening the same screen mid-season doesn't reshuffle the simulated clubs' results");
}

// ── Every one of the thirty-six always reaches exactly eight — not "almost
// always": the old fill algorithm ("pair the two clubs furthest from a
// full card") looked sound and was not — it could leave exactly one club
// stuck on nothing with nobody left to play, for perfectly ordinary
// starting conditions, not just some contrived edge case. Stress-tested
// across many seeds, campaigns at various stages, and both competitions.
{
  let anyShort = false;
  for (let seed = 0; seed < 60; seed++) {
    for (const competition of ["Champions League", "Europa League"] as const) {
      const state = openEuro(competition, "Test FC", 70 + (seed % 20), 1 + (seed % 20), mulberry32(seed * 31 + 7));
      // Vary how many of your own eight are "played" so far, 0 through 8.
      const playedCount = seed % 9;
      const leaguePhase: EuroMatch[] = state.leaguePhase.map((m, i) =>
        i < playedCount ? { ...m, us: (seed + i) % 4, them: (seed + i + 1) % 4 } : m);
      const table = buildEuroTable({ ...state, leaguePhase }, "Test FC", seed * 104729 + 17);
      if (table.length !== 36 || table.some(t => t.played !== 8)) {
        anyShort = true;
        problems.push(`seed ${seed}/${competition}, ${playedCount} of your own games played: ` +
          `${table.length} clubs, played counts [${table.map(t => t.played).join(",")}]`);
      }
    }
  }
  check(!anyShort, "every club reaches exactly eight played, across sixty seeds, both competitions, and every stage of your own campaign");
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
console.log("PASS — the league phase is a real, simulated thirty-six-club table, not a blank screen");
