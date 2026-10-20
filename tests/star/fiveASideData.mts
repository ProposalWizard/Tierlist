/**
 * THE FIVE-A-SIDE TEST AREA'S NUMBERS (/star-fiveaside-dev, Data tab).
 *
 * Checks three things:
 *  1. The simulation (scripts/fiveaside-data/sim.mts) plays real matches to
 *     full time, the same way twice from the same seed, and its summary adds up.
 *  2. The numbers the page ships (lib/star/fiveASide/simData.json) are whole:
 *     every count adds up to the number of matches.
 *  3. The scenarios the page plays (lib/star/fiveASide/scenarios.ts) wait for
 *     the right chance, and the shared chance pictures are the gallery's own.
 */
import { simulateMatch, simulateScenario, settingsFor } from "../../scripts/fiveaside-data/sim.mts";
import { summariseFiveSim, longestRuns, type FiveSimSummary } from "../../lib/star/fiveASide/simSummary";
import {
  scenarioState, scenarioWorld, fiveChanceWorld, scenarioRollSeed, FIVE_CHANCE_SEEDS,
} from "../../lib/star/fiveASide/scenarios";
import { resumeAction } from "../../lib/star/fiveASide/match";
import { mirror, insideFivePitch } from "../../lib/star/fiveASide/geometry";
import SHIPPED from "../../lib/star/fiveASide/simData.json" with { type: "json" };

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ── 1. The simulation ──────────────────────────────────────────────────
{
  const N = 12;
  const matches = Array.from({ length: N }, (_, i) => simulateMatch(1 + i));
  for (const m of matches) {
    check(m.finished, `seed ${m.seed}: the match must reach full time`);
    check(m.stuck === 0, `seed ${m.seed}: ${m.stuck} kicks froze`);
    check(m.badPositions === 0, `seed ${m.seed}: ${m.badPositions} players off the pitch or NaN`);
    const ours = m.goals.you + m.goals.assist + m.goals.mateWatched + m.goals.mateRolled;
    check(ours === m.score[0], `seed ${m.seed}: our goals by scorer (${ours}) must equal the scoreboard (${m.score[0]})`);
    check(m.goals.themWatched === m.score[1], `seed ${m.seed}: their goals (${m.goals.themWatched}) must equal the scoreboard (${m.score[1]})`);
    check(m.chances.some((c) => c.who === "you"), `seed ${m.seed}: you should get at least one touch`);
    check(m.beats.you + m.beats.them > 60, `seed ${m.seed}: a match is about 90 beats, got ${m.beats.you + m.beats.them}`);
  }
  // Same seed, same match.
  const a = simulateMatch(7), b = simulateMatch(7);
  check(JSON.stringify(a) === JSON.stringify(b), "the same seed plays the same match");

  const s = summariseFiveSim(matches, { settings: settingsFor(N), made: "test" });
  check(s.results.win + s.results.draw + s.results.loss === N, "wins + draws + losses = matches");
  check(sum(s.goalsHistogram) === N, "the goals histogram covers every match");
  check(s.possessionYou > 0 && s.possessionYou < 1, `possession share is a share, got ${s.possessionYou}`);
  check(s.health.every((h) => h.ok), `health on ${N} matches: ${s.health.filter((h) => !h.ok).map((h) => h.label).join("; ")}`);
  const kindTotal = sum(s.kinds.map((k) => k.you.n + k.mate.n + k.them.n));
  check(kindTotal === sum(matches.map((m) => m.chances.length)), "every chance is in the kinds table once");

  // A scenario is played as many times as asked, every play ending somehow.
  const run = simulateScenario("yours", FIVE_CHANCE_SEEDS[4], 20);
  check(run.plays === 20 && sum(Object.values(run.outcomes)) === 20, "a scenario run counts every play");
  check(run.goals <= 20, "…and never more goals than plays");

  check(JSON.stringify(longestRuns(["you", "you", "them", "you", "you", "you"])) === JSON.stringify({ you: 3, them: 1 }),
    "longest spells are counted as unbroken runs");
}

// ── 2. The shipped numbers ──────────────────────────────────────────────
{
  const d = SHIPPED as unknown as FiveSimSummary;
  const N = d.settings.matches;
  check(d.version === 1, "the shipped numbers are version 1");
  check(N >= 500, `the Data tab promises 500 matches, the file has ${N}`);
  check(d.results.win + d.results.draw + d.results.loss === N, "shipped: results add up to the matches");
  check(sum(d.goalsHistogram) === N, "shipped: the histogram adds up to the matches");
  check(d.scenarios.length === 30, `shipped: 30 scenarios (10 pictures × 3 kinds), got ${d.scenarios.length}`);
  check(d.scenarios.every((r) => sum(Object.values(r.outcomes)) === r.plays), "shipped: every scenario's outcomes add up");
  check(d.byDifficulty.length === 3, "shipped: Easy, Even and Hard");
  const easy = d.byDifficulty.find((x) => x.label === "Easy"), hard = d.byDifficulty.find((x) => x.label === "Hard");
  check(!!easy && !!hard && easy.winShare > hard.winShare, "shipped: Easy is easier to win than Hard");
  const usGoals = Math.round(d.goalsPerMatch.us * N);
  const byScorer = d.goalsBy.you + d.goalsBy.assist + d.goalsBy.mateWatched + d.goalsBy.mateRolled;
  check(Math.abs(usGoals - byScorer) <= 3, `shipped: goals by scorer (${byScorer}) match goals a match × matches (${usGoals})`);
}

// ── 3. The scenarios the page plays ─────────────────────────────────────
{
  // The gallery's original picture, unchanged by the move.
  const w = fiveChanceWorld(3000);
  check(w.ball.x === 30 && w.ball.y === 9 && w.you.x === 32 && w.you.y === 9.5, "picture 3000 is the gallery's original spread");
  for (const seed of FIVE_CHANCE_SEEDS) {
    check(resumeAction(scenarioState("yours", seed)) === "passage", `picture ${seed}: "Your chance" waits for your touch`);
    check(resumeAction(scenarioState("mate", seed)) === "mate", `picture ${seed}: "Team-mate's chance" waits for him`);
    check(resumeAction(scenarioState("them", seed)) === "opp", `picture ${seed}: "Their attack" waits for theirs`);
    const them = scenarioWorld("them", seed);
    const yours = scenarioWorld("yours", seed);
    check(mirror(them.ball).x === yours.ball.x && mirror(them.ball).y === yours.ball.y, `picture ${seed}: their attack is the picture turned round`);
    const all = (x: typeof them) => [x.ball, x.you, ...x.mates, ...x.opps, x.yourKeeper, x.theirKeeper];
    check(all(them).every(insideFivePitch) && all(scenarioWorld("mate", seed)).every(insideFivePitch), `picture ${seed}: everyone on the pitch`);
  }
  check(scenarioRollSeed(3000, 0) !== scenarioRollSeed(3000, 1), "each roll is a different roll");
}

if (problems.length) {
  console.error(`fiveASideData: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("fiveASideData: ok");
