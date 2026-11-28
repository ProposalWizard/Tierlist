/**
 * THE WALK-OUT FROM ABOVE (28 Nov 2026, Harry: "players walking through each other on the cut scene"): every man's
 * place, 30 times a second, in the 22-man test walk-out, as filmed on 28 Nov (each man's distance set by his
 * pace, the full pace shift and surge, no spacing) and now (spacing pass on). Writes JSON for the check sheet
 * (scripts/walk3d/spacing_sheet.py draws it) and prints the closest two men ever came, front to back and side by side.
 *
 *   npx tsx scripts/walk3d/spacing.mts --out=FILE.json
 */
import { writeFileSync } from "node:fs";
import { TEST_SCENES } from "../../lib/star/cutscene/testScenes";
import { compileScript, rootAt, WALK_PACE, CROWD } from "../../lib/star/cutscene/timeline";
import { ownMotion } from "../../lib/star/people/life";
import type { CutsceneScript } from "../../lib/star/cutscene/types";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "/tmp/walkout-spacing.json";

function oldWalkout(): CutsceneScript {
  const s = TEST_SCENES.walkout22();
  for (const t of s.tracks) if (t.type === "move") {
    const mv = t as { actor: string; dur: number; path: [number, number, number][] };
    const own = ownMotion(mv.actor), m = s.cast.find((c) => c.id === mv.actor)!.mark as [number, number, number];
    mv.path = [[mv.path[0][0], 0, m[2] + 1.05 * own.pace * mv.dur]];
  }
  return s;
}

function sample(s: CutsceneScript, noCrowd: boolean) {
  const c = { ...compileScript(s), noCrowd };
  const ids = c.cast.map((m) => m.id);
  const frames: { t: number; p: [number, number, number][] }[] = [];
  let minFront = 9, minSide = 9, bad = 0;
  for (let f = 0; f <= s.duration * 30; f++) {
    const t = f / 30;
    const P = ids.map((id) => rootAt(c, id, t));
    frames.push({ t, p: P.map((r) => [+r.pos[0].toFixed(3), +r.pos[2].toFixed(3), +r.yaw.toFixed(3)]) });
    let overlap = false;
    for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) if (i !== j) {
      const dx = P[j].pos[0] - P[i].pos[0], dz = P[j].pos[2] - P[i].pos[2];
      const fx = Math.sin(P[i].yaw), fz = Math.cos(P[i].yaw);
      const a = dx * fx + dz * fz, l = Math.abs(dx * -fz + dz * fx);
      if (a > 0 && l < 0.45) { minFront = Math.min(minFront, a); if (a < 0.65) overlap = true; }
      const d = Math.hypot(dx, dz); minSide = Math.min(minSide, d); if (d < 0.54) overlap = true;
    }
    if (overlap) bad++;
  }
  return { ids, frames, minFront, minSide, bad };
}

const WAS = { ...WALK_PACE };
WALK_PACE.shift = 0.9; WALK_PACE.surge = 1;
const before = sample(oldWalkout(), true);
Object.assign(WALK_PACE, WAS);
const after = sample(TEST_SCENES.walkout22(), false);
writeFileSync(out, JSON.stringify({ crowd: CROWD, before, after }));
for (const [k, r] of [["before", before], ["after", after]] as const) console.log(`${k}: ${r.frames.length} frames, ${r.bad} with two men inside each other; closest front to back ${(r.minFront * 100).toFixed(0)} cm, closest any two ${(r.minSide * 100).toFixed(0)} cm`);
