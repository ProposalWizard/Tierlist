/** B10 probe: of the header/volley shots that end "blocked", how many lost the
 *  aerial duel at the strike (applyAerialContest) vs were blocked in flight;
 *  and the nearest defender to the ball in the served pictures. */
import { shoot } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { makeChance } from "../../lib/star/chanceMaker";
import { buildScenario, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";

for (const kind of ["header", "volley"] as ScenarioKind[]) {
  for (const src of ["builder", "drawn"]) {
    let duel = 0, blocked = 0, n = 0, near = 0, defs = 0;
    for (let i = 1; i <= 400; i++) {
      const seed = (i * 7919) >>> 0;
      const sc = src === "builder" ? buildScenario(kind, mulberry32(seed ^ 0xb10)) : makeChance({ source: { from: "kind", kind }, rng: mulberry32(seed), memory: null }).sc;
      const d = Math.min(...sc.defenders.map((p) => Math.hypot(p.x - sc.ball.x, p.y - sc.ball.y)));
      near += d; defs += sc.defenders.length;
      let lostDuel = false;
      const r = shoot(kind, seed, {
        scenario: sc, skills: { power: 65, technique: 65 },
        afterLaunch: (ball, s, thumb) => { lostDuel = ball.lastTouch === "defence"; applyAirborne(ball, s, { kind: kind as "header", lift: 0.9, cx: thumb.contact.cx, cy: thumb.contact.cy, tech: 65 }); },
      });
      n++; if (r.blocked) blocked++; if (lostDuel) duel++;
    }
    console.log(`${kind} ${src}: blocked ${blocked}/${n}, lost the duel at the strike ${duel}; nearest defender to the ball ${(near / n).toFixed(2)} m; defenders ${(defs / n).toFixed(1)}`);
  }
}
