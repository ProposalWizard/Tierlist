// Where the stills' "one-on-one" comes from: the harness (tests/star/match2dCam.mts chanceFor:
// raw buildScenario + initDefenders) vs the real game's served chance (lib/star/chanceMaker.ts
// makeChance, as CanvasMatch calls it). Counts defenders between the ball and the goal (baseScenario.ts inShotCone).
// Usage: npx tsx scripts/cam3d/oneOnOneProbe.mts
import { chanceFor } from "../../tests/star/match2dCam.mts";
import { makeChance } from "../../lib/star/chanceMaker";
import { initDefenders, type Scenario } from "../../lib/star/canvasEngine";
import { inShotCone } from "../../lib/star/baseScenario";
import { mulberry32 } from "../../lib/star/season";

const cone = (sc: Scenario) => sc.defenders.filter((d) => inShotCone(sc, d)).length;
for (let s = 1; s <= 6; s++) {
  const c = chanceFor("one_on_one", s);
  console.log(`harness seed ${s}: ${c.sc.defenders.length} defenders, ${cone(c.sc)} between the ball and the goal`);
}
let n = 0, bad = 0, most = 0, mostSeed = 0;
for (let s = 1; s <= 600; s++) {
  const rng = mulberry32(s);
  const m = makeChance({ source: { from: "request", request: { kinds: ["one_on_one"] } as never, position: "ST" }, rng });
  if (m.sc.kind !== "one_on_one") continue;
  initDefenders(m.sc, rng);
  n++;
  const k = cone(m.sc);
  if (k > 0) bad++;
  if (k > most) { most = k; mostSeed = s; }
}
console.log(`real served one-on-ones (makeChance): ${n}; with a defender between the ball and the goal: ${bad}; most ${most} (seed ${mostSeed})`);
