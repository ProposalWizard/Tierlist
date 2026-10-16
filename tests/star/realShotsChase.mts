/**
 * The Real shots lead-in: do the men chase the ball, or hold their shape?
 * (Harry, 14 Oct 2026: "in real shots they don't pass, they just run after the
 * ball endlessly.") Measured over every shot with a lead-in
 * (lib/star/statsbombShots.ts leadinTrack), frame by frame at 1/30 s:
 *   - men within 5 m of the ball (all, and the ones not on it: chasers);
 *   - of the man-frames moving (> 1 m/s, not on the ball), the share heading
 *     at the ball (within 45°) vs holding shape (not);
 *   - the fastest man (m/s, 1/60 s frames; a man carrying the ball at the
 *     ball's own speed is the ball's timing, counted apart);
 *   - the end frame vs the shot's real freeze frame (m).
 * Run alone it prints the numbers; tests/star/leadIn.mts checks the limits.
 */
import { readFileSync } from "node:fs";
import { scenarioForShot, leadinTrack, peopleOf, type SbFile, type SbLeadinFile, type SbShot, type SbLeadin } from "../../lib/star/statsbombShots";
import { leadInEntities } from "../../lib/star/leadIn";

export interface ChaseNumbers {
  shots: number;
  /** Mean men within 5 m of the ball, per frame. */
  nearAll: number;
  /** The same, not counting the man on the ball (passer / receiver). */
  nearChasers: number;
  /** Mean men a frame running at the ball faster than 3 m/s (their own run; not the man on it). */
  closingFast: number;
  /** Metres each man runs in a lead-in, on average. */
  runPerMan: number;
  /** The same two, only while the passes are played (before you have it). */
  nearChasersPasses: number;
  towardSharePasses: number;
  movingFrames: number;
  /** Of the moving man-frames (not on the ball): share heading at the ball. */
  towardShare: number;
  maxSpeed: number;
  over9Share: number;
  /** Mean m from each real man in the shot's frame to the nearest end man of his side. */
  endVsReal: number;
}
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

type Track = ReturnType<typeof leadinTrack>;
export function chaseNumbers(shots: SbShot[], leads: Record<string, SbLeadin>, track: (s: SbShot, l: SbLeadin, sc: ReturnType<typeof scenarioForShot>) => Track = leadinTrack): ChaseNumbers {
  let closing = 0, runM = 0, runMen = 0;
  let pFrames = 0, pNear = 0, pMoving = 0, pToward = 0;
  let n = 0, frames = 0, nearAll = 0, nearCh = 0, moving = 0, toward = 0, maxSp = 0, manFrames = 0, over9 = 0, endSum = 0, endN = 0;
  for (const s of shots) {
    const lead = leads[s.id];
    if (!lead || lead.passes.length < 1) continue;
    const sc = scenarioForShot(s, { wideFrame: true });
    const ents = leadInEntities(sc);
    const tr = track(s, lead, sc);
    n++;
    const keys = [...ents.map((e) => e.key), ...Array.from({ length: tr.extraMates ?? 0 }, (_, i) => `extra${i}`)];
    // Who is on the ball at t: the passer from just before his touch to just after his pass; you from the last pass.
    const onBall = (t: number): Set<string> => {
      const on = new Set<string>();
      tr.holders.forEach((h, i) => {
        if (!h) return;
        const from = i === 0 ? 0 : tr.passEnd[i - 1] - 0.4;
        if (t >= from && t <= tr.passStart[i] + 0.15) on.add(h);
      });
      if (t >= tr.passEnd[tr.passEnd.length - 1] - 0.4) on.add("you");
      return on;
    };
    const F = 1 / 30;
    for (let t = F; t <= tr.durS + 1e-9; t += F) {
      const b = tr.ballAt(t), on = onBall(t);
      const inPasses = t < tr.passEnd[tr.passEnd.length - 1];
      frames++;
      if (inPasses) pFrames++;
      for (const k of keys) {
        const p = tr.posAt(k, t), q = tr.posAt(k, t - F);
        if (!p || !q) continue;
        if (d(p, b) < 5) { nearAll++; if (!on.has(k)) { nearCh++; if (inPasses) pNear++; } }
        const v = d(p, q) / F;
        { // his own run toward the ball, m/s (the ball moving does not count)
          const bx = b.x - q.x, by = b.y - q.y, bn = Math.hypot(bx, by) || 1;
          if (!on.has(k) && ((p.x - q.x) * bx + (p.y - q.y) * by) / (F * bn) > 3) closing++;
        }
        if (v > 1 && !on.has(k)) {
          moving++;
          const bx = b.x - q.x, by = b.y - q.y, bn = Math.hypot(bx, by) || 1;
          const tw = ((p.x - q.x) * bx + (p.y - q.y) * by) / (v * F * bn) > Math.SQRT1_2;
          if (tw) toward++;
          if (inPasses) { pMoving++; if (tw) pToward++; }
        }
      }
    }
    const G = 1 / 60;
    for (const k of keys) {
      let prev = tr.posAt(k, 0);
      let ran = 0;
      for (let t = G; t <= tr.durS + 1e-9; t += G) { const p = tr.posAt(k, t), q = tr.posAt(k, t - G); if (p && q) ran += d(p, q); }
      runM += ran; runMen++;
      for (let t = G; t <= tr.durS + 1e-9; t += G) {
        const p = tr.posAt(k, t);
        if (!p || !prev) { prev = p; continue; }
        const v = d(p, prev) / G;
        const ballV = d(tr.ballAt(t), tr.ballAt(t - G)) / G;
        prev = p;
        if (onBall(t).has(k) && d(p, tr.ballAt(t)) < 1.6 && v <= ballV + 0.5) continue;
        manFrames++;
        if (v > 9 + 1e-6) over9++;
        maxSp = Math.max(maxSp, v);
      }
    }
    const p = peopleOf(s);
    const endOf = (side: string) => ents.filter((e) => e.side === side || (side === "mate" && e.side === "you")).map((e) => tr.posAt(e.key, tr.durS)!);
    const v = sc.viewport, inV = (q: { x: number; y: number }) => q.x > v.x1 + 0.8 && q.x < v.x2 - 0.8 && q.y > v.y1 + 0.8 && q.y < v.y2 - 0.8;
    for (const [list, side] of [[p.opps, "opp"], [p.mates, "mate"]] as const) {
      const ends = endOf(side);
      for (const q of list) {
        if (!inV(q) || !ends.length) continue;
        endSum += Math.min(...ends.map((e) => d(e, q))); endN++;
      }
    }
    if (p.keeper) { endSum += d(tr.posAt("keeper", tr.durS)!, p.keeper); endN++; }
  }
  return {
    shots: n, nearAll: nearAll / frames, nearChasers: nearCh / frames,
    closingFast: closing / frames, runPerMan: runM / Math.max(1, runMen) / 1,
    nearChasersPasses: pNear / Math.max(1, pFrames), towardSharePasses: pToward / Math.max(1, pMoving),
    movingFrames: moving, towardShare: toward / Math.max(1, moving),
    maxSpeed: maxSp, over9Share: over9 / Math.max(1, manFrames), endVsReal: endSum / Math.max(1, endN),
  };
}

if (process.argv[1]?.endsWith("realShotsChase.mts")) {
  const shots = (JSON.parse(readFileSync("data/statsbomb/shots.json", "utf8")) as SbFile).shots;
  const leads = (JSON.parse(readFileSync("data/statsbomb/leadins.json", "utf8")) as SbLeadinFile).leadins;
  console.log(JSON.stringify(chaseNumbers(shots, leads), null, 1));
}
