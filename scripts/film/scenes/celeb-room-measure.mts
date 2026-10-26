/**
 * How near anyone gets to you during your celebration, in real goal recordings (chat 1, 25 Oct 2026).
 *   npx tsx scripts/film/scenes/celeb-room-measure.mts <clips.json>...   (from dump-goal-clips.mjs)
 * "as recorded" = the spots the match had (the old picture); "with room" = celebration.ts roomFor applied.
 * Recordings made before the fix hold raw spots; a newer one already has roomFor in it (then both columns agree).
 */
import fs from "node:fs";
import { trackFromStored, frameAt } from "../../../lib/star/goalClip/track";
import { planCelebration, roomFor, type CelebrationMove } from "../../../lib/star/celebration";

const OVERLAP_M = 0.8;   // two figures' bodies touch closer than this (about a shoulder width each side)
for (const file of process.argv.slice(2)) {
  for (const row of JSON.parse(fs.readFileSync(file, "utf8"))) {
    const tr = trackFromStored(row.track);
    const cel = tr?.meta.celebration;
    if (!tr || !cel) { console.log(file, "no celebration in", row.id); continue; }
    const plan = planCelebration({ x: cel.from[0], y: cel.from[1] }, cel.move as CelebrationMove);
    const t0 = tr.goalT + cel.at, end = tr.n / tr.fps;
    const you = tr.bodies.findIndex((b) => b.id === "you");
    const res = { raw: { d: Infinity, who: "", at: 0, overlapS: 0 }, room: { d: Infinity, who: "", at: 0, overlapS: 0 } };
    for (let t = t0 + 0.6; t < end; t += 1 / 30) {
      const f = frameAt(tr, t), y = f.bodies[you];
      for (let b = 0; b < tr.bodies.length; b++) {
        if (b === you || tr.bodies[b].id === "keeper") continue;
        const raw = f.bodies[b], rm = roomFor(plan, raw, t - t0);
        for (const [k, p] of [["raw", raw], ["room", rm]] as const) {
          const d = Math.hypot(p.x - y.x, p.y - y.y), r = res[k];
          if (d < r.d) { r.d = d; r.who = tr.bodies[b].id; r.at = t - t0; }
        }
      }
      for (const k of ["raw", "room"] as const) {
        const near = tr.bodies.some((bd, b) => b !== you && bd.id !== "keeper" && (() => { const p = k === "raw" ? f.bodies[b] : roomFor(plan, f.bodies[b], t - t0); return Math.hypot(p.x - y.x, p.y - y.y) < OVERLAP_M; })());
        if (near) res[k].overlapS += 1 / 30;
      }
    }
    const fmt = (r: typeof res.raw) => `closest ${r.d.toFixed(2)} m (${r.who} at +${r.at.toFixed(1)} s), touching ${r.overlapS.toFixed(1)} s`;
    console.log(`${row.id} ${cel.move}: as recorded ${fmt(res.raw)} | with room ${fmt(res.room)}`);
  }
}
