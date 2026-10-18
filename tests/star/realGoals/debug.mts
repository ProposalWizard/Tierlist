import { loadGoals, aimAtReal, playStrike } from "./harness.mts";
import { realEnd } from "../../../lib/star/realGoals";
const ids = process.argv.slice(2);
for (const g of loadGoals().filter((q) => ids.includes(q.id))) {
  const aim = aimAtReal(g), e = realEnd(g);
  console.log(g.id, g.shot.player, "real", e.x.toFixed(2), e.z.toFixed(2), "aim", aim.x.toFixed(2), aim.z.toFixed(2), "cy", aim.cy.toFixed(2), "pow", aim.power.toFixed(2));
  for (let i = 0; i < 6; i++) {
    const seed = (9001 + i * 7919) >>> 0;
    for (const wob of [false, true]) {
      const p = playStrike(g, aim, true, seed, wob);
      console.log(`  seed ${i} wobble ${wob} -> ${p.outcome} lane ${p.inLane} crossed ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    }
  }
}
