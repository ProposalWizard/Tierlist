/**
 * SWITCHED-OFF CHANCE KINDS (lib/star/switchedOffKinds.ts).
 *
 * Harry, 24 Sep 2026, switched volley and header off; B10 (20 Oct 2026,
 * "headers AND volleys back on") switched them back on, so the list is empty.
 * This checks that "on" really means on everywhere a chance is picked — the
 * engine's own pickers, a chain after a pass, a hidden-match request, the
 * highlights pool and the even mix — and that the swap machinery, kept for
 * the next time a kind is switched off, leaves every kind alone.
 */
import {
  SCENARIO_KINDS, buildWeightedScenario, buildAttackingScenario, chainKindFor,
  type ScenarioKind,
} from "../../lib/star/canvasEngine";
import { kindsForZone } from "../../lib/star/hiddenMatch";
import { SWITCHED_OFF_KINDS, isSwitchedOff, playableKind, withoutSwitchedOff } from "../../lib/star/switchedOffKinds";
import { allKinds, loadKinds } from "../../lib/star/highlightStore";
import { EVEN_KINDS } from "../../lib/star/kindMix";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const POSITIONS = ["ST", "CAM", "LW", "RW", "CM", "CDM", "LB", "RB", "CB"];
const N = 3000;
const AIR: ScenarioKind[] = ["header", "volley"];

check(SWITCHED_OFF_KINDS.size === 0, `the list is not empty: ${[...SWITCHED_OFF_KINDS].join(", ")}`);
for (const k of AIR) check(!isSwitchedOff(k), `${k} is still switched off`);

// 1. Every kind passes through the swap untouched, without drawing from the rng.
for (const k of SCENARIO_KINDS) {
  let draws = 0;
  const counting = () => { draws++; return 0.5; };
  check(playableKind(k, counting) === k && draws === 0, `${k} was changed or drew from the rng`);
}
// 2. A request's kinds come through whole.
for (const zone of ["own_box", "defensive", "middle", "attacking", "box"] as const) {
  for (const lane of ["left", "centre", "right"] as const) {
    const kinds = kindsForZone(zone, lane);
    check(withoutSwitchedOff(kinds).length === kinds.length, `${zone}/${lane}: a kind was filtered out`);
  }
}
check(kindsForZone("box", "centre").some((k) => AIR.includes(k)), "the box offers no header or volley");

// 3. The engine's pickers and a chain hand them out again.
let fromChain = 0, fromPickers = 0;
for (let i = 0; i < N; i++) {
  const rng = mulberry32(1000 + i);
  if (AIR.includes(chainKindFor({ x: 34, y: 10 }, rng, 1))) fromChain++;
  const r2 = mulberry32(5000 + i);
  const sc = i % 2 ? buildWeightedScenario(r2, POSITIONS[i % POSITIONS.length]) : buildAttackingScenario(r2);
  if (AIR.includes(sc.kind)) fromPickers++;
}
check(fromChain > 0, "a chain in the box never gives a volley");
check(fromPickers > 0, "the weighted/attacking pickers never give a header or volley");

// 4. The highlights pool and the even mix have them.
for (const k of AIR) {
  check(allKinds().includes(k), `the highlights 'All' pool has no ${k}`);
  check(loadKinds().includes(k), `the highlights saved pool has no ${k}`);
  check(EVEN_KINDS.includes(k), `the even mix has no ${k}`);
}

console.log(`a chain in the box: ${fromChain}/${N} headers/volleys; the engine's pickers: ${fromPickers}/${N}`);
if (problems.length) { console.log("FAIL"); for (const p of problems) console.log("  - " + p); process.exit(1); }
console.log("PASS — headers and volleys are on everywhere a chance is picked");
