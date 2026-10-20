/**
 * Makes the five-a-side numbers: npx tsx scripts/fiveaside-data/run.mts [matches]
 *
 * Plays `matches` (default 500) whole five-a-side matches with the real
 * five-a-side code and a bot for your thumb (sim.mts), every fixed scenario 200
 * times, and 200 matches each at an easy and a hard setting for comparison.
 * Writes lib/star/fiveASide/simData.json, which the Data tab of
 * /star-fiveaside-dev reads. Same seeds every run, so the file only changes
 * when the game does. Re-run it after a five-a-side or engine change.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simulateMatch, simulateScenario, probeLastThirdPass, settingsFor, ALL_SCENARIOS, SIM_DEFAULTS } from "./sim.mts";
import { summariseFiveSim } from "../../lib/star/fiveASide/simSummary";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const N = Math.max(1, Number(process.argv[2]) || 500);
const SCENARIO_PLAYS = 200;
const SIDE_MATCHES = 200;

const t0 = Date.now();
const main = Array.from({ length: N }, (_, i) => simulateMatch(1 + i));
const easy = Array.from({ length: SIDE_MATCHES }, (_, i) => simulateMatch(100_001 + i, { difficulty: 0.2 }));
const hard = Array.from({ length: SIDE_MATCHES }, (_, i) => simulateMatch(200_001 + i, { difficulty: 0.8 }));
const scenarios = ALL_SCENARIOS.map(({ kind, seed }) => simulateScenario(kind, seed, SCENARIO_PLAYS));

const summary = summariseFiveSim(main, {
  settings: settingsFor(N),
  made: new Date().toISOString().slice(0, 10),
  scenarios,
  lastThirdPass: probeLastThirdPass(100),
  byDifficulty: [
    { label: "Easy", difficulty: 0.2, matches: easy },
    { label: "Even", difficulty: SIM_DEFAULTS.difficulty, matches: main },
    { label: "Hard", difficulty: 0.8, matches: hard },
  ],
});

const out = join(ROOT, "lib/star/fiveASide/simData.json");
writeFileSync(out, JSON.stringify(summary, null, 1) + "\n");
console.log(`five-a-side numbers: ${N} matches (+${SIDE_MATCHES * 2} at Easy/Hard, ${scenarios.length} scenarios × ${SCENARIO_PLAYS}) in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${out}`);
console.log(`  results W/D/L ${summary.results.win}/${summary.results.draw}/${summary.results.loss}; goals a match ${summary.goalsPerMatch.us}–${summary.goalsPerMatch.them}`);
for (const h of summary.health) console.log(`  ${h.ok ? "ok " : "BAD"} ${h.label} — ${h.detail}`);
