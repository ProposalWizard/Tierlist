/**
 * tests/star/removedPoacher.mts — taking the poacher out must not make him offside.
 *
 * `Scenario.follower` can't be spliced out, so a removed poacher is walked
 * off the pitch instead. He used to be walked 400m PAST the goal line — ahead
 * of the ball and every defender — which is offside, so the editor said
 * "attacker offside" on pictures where every visible attacker was behind the
 * ball (reported by Leo; 3 of 65 saved scenarios). He is now parked behind
 * the ball, where nobody can be offside.
 */
import { buildScenario, goalInView, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { fixBaseScenario, scenarioFaults, offsideLineOf } from "@/lib/star/baseScenario";
import { frameFromScenario } from "@/lib/star/scenarioFrame";
import { applyOverrideToScenario, OFF_PITCH, type PosOverride } from "@/lib/star/scenarioEdit";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("\nREMOVED POACHER");
let checked = 0, offsideAfter = 0;
for (const kind of ["one_on_one", "tight_angle", "cutback", "through_ball"] as ScenarioKind[]) {
  if (!goalInView(kind)) continue;
  for (let seed = 1; seed <= 60; seed++) {
    const sc = buildScenario(kind, mulberry32(seed));
    fixBaseScenario(sc);
    if (scenarioFaults(sc).includes("attacker offside")) continue;   // only pictures that start legal
    const frame = frameFromScenario(sc);
    const idx = frame.items.findIndex((it) => it.look.label === "POACH");
    if (idx < 0) continue;
    const ov: PosOverride = { items: {}, removed: [frame.items[idx].id] };
    applyOverrideToScenario(sc, ov);
    checked++;
    if (scenarioFaults(sc).includes("attacker offside")) offsideAfter++;
  }
}
ok(checked > 50, `enough pictures with a poacher to test (${checked})`);
ok(offsideAfter === 0, `taking the poacher out never makes the picture offside (${offsideAfter}/${checked})`);
ok(OFF_PITCH.y > 105, "he is parked behind the ball, not beyond the goal line");
void offsideLineOf;

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
