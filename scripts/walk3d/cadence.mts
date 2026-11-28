/**
 * STEPS A SECOND IN THE WALK-OUT (28 Nov 2026, "seems a bit heavy for some"): each of the 22 men's cadence
 * through the test walk-out, as filmed on 28 Nov and now. Cadence = his speed over his step on his build
 * (step lengths measured with scripts/walk3d/gait.mts: c1 0.55-0.57 m, c2 0.61-0.63, c3 0.58-0.60).
 * A fit young man walks at 1.8 to 2.0 steps a second.
 *
 *   npx tsx scripts/walk3d/cadence.mts
 */
import { TEST_SCENES } from "../../lib/star/cutscene/testScenes";
import { compileScript, rootAt, WALK_PACE } from "../../lib/star/cutscene/timeline";
import { ownMotion } from "../../lib/star/people/life";
import { toonBodyFor } from "../../lib/star/style3d/toon/bodies";
import type { CutsceneScript } from "../../lib/star/cutscene/types";

const STEP: Record<string, Record<string, number>> = {
  c1: { walk: 0.55, walk_relaxed: 0.56, walk_formal: 0.57 },
  c2: { walk: 0.61, walk_relaxed: 0.62, walk_formal: 0.63 },
  c3: { walk: 0.58, walk_relaxed: 0.59, walk_formal: 0.6 },
};
function oldWalkout(): CutsceneScript {
  const s = TEST_SCENES.walkout22();
  for (const t of s.tracks) if (t.type === "move") {
    const mv = t as { actor: string; dur: number; path: [number, number, number][] };
    const own = ownMotion(mv.actor), m = s.cast.find((c) => c.id === mv.actor)!.mark as [number, number, number];
    mv.path = [[mv.path[0][0], 0, m[2] + 1.05 * own.pace * mv.dur]];
  }
  return s;
}
function cad(s: CutsceneScript, noCrowd: boolean) {
  const c = { ...compileScript(s), noCrowd };
  const rows: { id: string; walk: string; build: string; min: number; med: number; max: number }[] = [];
  for (const m of c.cast) {
    const own = ownMotion(m.id), b = toonBodyFor(m.id);
    const step = STEP[b]?.[own.walk] ?? 0.58;
    const cs: number[] = [];
    // (from 0.6 s after he sets off: getting going is not his walking pace)
    const start = Math.min(...s.tracks.filter((t) => t.type === "move" && (t as { actor: string }).actor === m.id).map((t) => t.at)) + 0.6;
    for (let t = start; t <= s.duration - 0.3; t += 0.1) { const g = rootAt(c, m.id, t).gait; if (g && g.weight > 0.9 && g.speed > 0.3) cs.push(g.speed / step); }
    cs.sort((a, z) => a - z);
    if (cs.length) rows.push({ id: m.id, walk: own.walk, build: b, min: cs[0], med: cs[cs.length >> 1], max: cs[cs.length - 1] });
  }
  return rows;
}
const WAS = { ...WALK_PACE };
WALK_PACE.shift = 0.9; WALK_PACE.surge = 1;
const before = cad(oldWalkout(), true);
Object.assign(WALK_PACE, WAS);
const after = cad(TEST_SCENES.walkout22(), false);
console.log("man      walk          build | steps a second, before: least / middle / most | now: least / middle / most");
for (const r of before) {
  const a = after.find((x) => x.id === r.id)!;
  console.log(`${r.id.padEnd(8)} ${r.walk.padEnd(13)} ${r.build}    |   ${r.min.toFixed(2)} / ${r.med.toFixed(2)} / ${r.max.toFixed(2)}   |   ${a.min.toFixed(2)} / ${a.med.toFixed(2)} / ${a.max.toFixed(2)}`);
}
const mid = (rs: typeof before) => { const m = rs.map((r) => r.med).sort((a, b) => a - b); return m[m.length >> 1]; };
const low = (rs: typeof before) => Math.min(...rs.map((r) => r.min));
const share = (rs: typeof before, lo: number) => rs.filter((r) => r.med >= lo).length;
console.log(`all 22: before middle ${mid(before).toFixed(2)}, slowest moment ${low(before).toFixed(2)}, ${share(before, 1.75)} men at 1.75+ | now middle ${mid(after).toFixed(2)}, slowest moment ${low(after).toFixed(2)}, ${share(after, 1.75)} men at 1.75+`);
