const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { ruleSetFor, hasAuthored, sampleFromScenario } from "../../lib/star/authoredChance";
import { violations, outliersOf } from "../../lib/star/scenarioRules";
import { nextSim, newSimMemory, buildSimScenario, simFaults, authoredShapeFor } from "../../lib/star/gallerySim";
import { mulberry32 } from "../../lib/star/season";

/**
 * LONG SHOTS HAVE A RULE SET (24 Sep 2026).
 *
 * Asked for directly: "create the rule set for long shots… recreate it for
 * long shots, so that it has a rule set to create and simulate more." Rule
 * sets are scanned off the saved drawings of a kind, so this is the saved
 * long-range drawings doing their job: enough of them to count, a clean pool,
 * and Simulate building from them without breaking what they agree on.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const set = ruleSetFor("long_range");
check(!!set && set.n >= 5, `at least five long-shot drawings (${set?.n ?? 0})`);
check(hasAuthored("long_range"), "the game serves long shots from the drawings");
const law = (id: string) => set?.rules.find((r) => r.id === id);
check(!!law("inBox")?.invariant && law("inBox")!.at === 0, "a long shot is always from outside the box");
check(!!law("mateInShot")?.invariant && law("mateInShot")!.at === 0, "no team-mate ever stands in your shot");
check(set ? outliersOf(set).length === 0 : false, "no drawing disagrees with a law");
const depth = law("ballDepth");
check(!!depth && depth.min >= 16.5 && depth.max <= 36, `the ball is a real long shot away (${depth?.min.toFixed(1)}-${depth?.max.toFixed(1)}m)`);

// Simulate builds from the drawings and never breaks what they agree on.
const rng = mulberry32(42), mem = newSimMemory();
let fromDrawing = 0, broke = 0, faulty = 0;
const N = 300;
for (let k = 0; k < N; k++) {
  const spec = nextSim("long_range", rng, mem);
  if (authoredShapeFor(spec)) fromDrawing++;
  const sc = buildSimScenario(spec);
  if (set && violations(sampleFromScenario(sc), set).length) broke++;
  if (simFaults(sc, spec.planId).length) faulty++;
}
check(fromDrawing === N, `every simulated long shot is built from a drawing (${fromDrawing}/${N})`);
check(broke === 0, `no simulated long shot breaks a law (${broke})`);
check(faulty / N < 0.1, `fewer than 1 in 10 simulated long shots has a fault (${faulty}/${N})`);

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — long shots have a rule set from ${set!.n} drawings, and Simulate follows it (${faulty}/${N} with a fault, 0 laws broken)`);
