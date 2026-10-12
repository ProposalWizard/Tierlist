// Why a served chance does or does not turn side-on (matchView.ts turnWideChance). Usage: npx tsx scripts/cam3d/sideOnProbe.mts
import { initDefenders, type Scenario } from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import { sideOnCamera, sideOnFacing, turnsSideOn, turnWideChance } from "../../lib/star/matchView";
import { setWideChancesOverride, wideChances } from "../../lib/star/wideChances";

setWideChancesOverride("new");
for (const kind of ["tight_angle", "cutback"]) for (const seed of [1, 2, 3]) {
  const rng = mulberry32(seed * 977 + kind.length * 13);
  const sc = mulberry32 && makeChance({ source: { from: "kind", kind: kind as Scenario["kind"] }, rng, strength: { keeper: 40 + (seed * 7) % 55, team: 60, vision: 55 } }).sc;
  initDefenders(sc, rng);
  const was = sc.facing;
  const probe = JSON.parse(JSON.stringify(sc)) as Scenario;
  probe.facing = sideOnFacing(probe);
  const cam = sideOnCamera(probe, 704 / 372);
  const turned = turnWideChance(sc, true, 704 / 372);
  console.log(kind, seed, "setting", wideChances(), "eligible", turnsSideOn({ ...sc, facing: was } as Scenario), "turned", turned, "side-on across (m)", (cam.y2 - cam.y1).toFixed(1));
}
