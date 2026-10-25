/**
 * THE BUILD-UP CAMERA, MEASURED (Harry, 0.108h, 24 Oct 2026: "I don't like how
 * the camera can move in multiple movements, it should be smooth").
 *
 *   npx tsx scripts/fhr/glide-measure.mts [--n=300]
 *
 * Plays every build-up the served chances give (and the three styles: long
 * ball, tiki-taka, run then pass) through the match's own lead-in camera
 * (leadIn.ts leadInCamera, the call CanvasMatch makes every frame) at 60 fps
 * on a phone's match canvas (366 px wide), and counts:
 *   - reversals: how often the camera's pan turns back on itself (across or
 *     down), counted only when it was moving faster than 15 px/s;
 *   - stops: how often it comes to a near stop (< 15 px/s) and sets off again;
 *   - acceleration: the camera centre's worst px/s² (median and worst);
 *   - jerk: the worst change of speed from one frame to the next (px/s);
 *   - ball off: share of frames with the ball outside the frame;
 *   - hand-over: px between the last build-up frame and the chance's camera.
 */
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { matchStill } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpFor, fhrWantsBuildUp, FHR_STYLES, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { leadInCamera, leadInEntities, type LeadIn } from "../../lib/star/leadIn";
import type { Scenario, Viewport } from "../../lib/star/canvasEngine";

const arg = (k: string, d: string) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const N = Number(arg("n", "300"));
const W = 366, H = 744, FPS = 60, MOVING = 15;

export interface CamStats { reversals: number; stops: number; maxAcc: number; maxJerk: number; ballOff: number; frames: number; handPx: number }

/** One build-up's camera, played frame by frame. */
export function cameraStats(lead: LeadIn, sc: Scenario, chance: Viewport): CamStats {
  const cam = leadInCamera(lead, leadInEntities(sc).map((e) => e.key));
  const pxPerM = W / (chance.x2 - chance.x1);
  const cs: { x: number; y: number }[] = [];
  let off = 0, frames = 0, last: Viewport = chance;
  for (let i = 0; i / FPS < lead.durS; i++) {
    const t = i / FPS;
    const v = cam.at(t, chance);
    last = v;
    cs.push({ x: ((v.x1 + v.x2) / 2) * pxPerM, y: ((v.y1 + v.y2) / 2) * pxPerM });
    const b = lead.ballAt(t);
    frames++;
    if (b.x < v.x1 || b.x > v.x2 || b.y < v.y1 || b.y > v.y2) off++;
  }
  let reversals = 0, stops = 0, maxAcc = 0, maxJerk = 0;
  const sgn = [0, 0];
  let moving = false;
  const vel = cs.slice(1).map((c, i) => ({ x: (c.x - cs[i].x) * FPS, y: (c.y - cs[i].y) * FPS }));
  vel.forEach((v, i) => {
    (["x", "y"] as const).forEach((k, j) => {
      if (Math.abs(v[k]) < MOVING) return;
      const s = Math.sign(v[k]);
      if (sgn[j] !== 0 && s !== sgn[j]) reversals++;
      sgn[j] = s;
    });
    const sp = Math.hypot(v.x, v.y);
    if (moving && sp < MOVING) { moving = false; }
    else if (!moving && sp >= MOVING) { if (i > 0) stops++; moving = true; }
    if (i > 0) {
      const dv = Math.hypot(v.x - vel[i - 1].x, v.y - vel[i - 1].y);
      maxJerk = Math.max(maxJerk, dv);
    }
    if (i > 2) {
      // Acceleration over a few frames (one frame alone is noise).
      const a = Math.hypot(v.x - vel[i - 3].x, v.y - vel[i - 3].y) / (3 / FPS);
      maxAcc = Math.max(maxAcc, a);
    }
  });
  const a = { x: ((last.x1 + last.x2) / 2) * pxPerM, y: ((last.y1 + last.y2) / 2) * pxPerM };
  const b = { x: ((chance.x1 + chance.x2) / 2) * pxPerM, y: ((chance.y1 + chance.y2) / 2) * pxPerM };
  return { reversals, stops, maxAcc, maxJerk, ballOff: off / Math.max(1, frames), frames, handPx: Math.hypot(a.x - b.x, a.y - b.y) };
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

function main() {
  forceFhrMode("on"); forceChancesMode("new");
  const pool = servedChances({ count: N, seed: 41 });
  const rows: Record<string, CamStats[]> = {};
  for (const c of pool) {
    const sc = JSON.parse(JSON.stringify(c.sc)) as Scenario;
    const chance = { ...matchStill(sc, H / W, 20).frame.camera };
    const moment = { ...c.moment, fresh: true, frame: chance };
    if (!fhrWantsBuildUp(sc.kind, moment)) continue;
    for (const style of [undefined, ...FHR_STYLES]) {
      let lead: FhrBuildUp | null = null;
      try { lead = fhrBuildUpFor(JSON.parse(JSON.stringify(sc)), moment, undefined, style ? { style } : {}); } catch { lead = null; }
      if (!lead) continue;
      (rows[style ?? "mixed"] ??= []).push(cameraStats(lead, sc, chance));
    }
  }
  forceFhrMode(null); forceChancesMode(null);
  console.log(`build-up camera (phone ${W}x${H}, ${FPS} fps)`);
  console.log("style       n    reversals/build-up  stops/build-up  acc px/s² med / worst   jerk px/s worst   ball off %   hand-over px worst");
  for (const [k, r] of Object.entries(rows)) {
    console.log(`${k.padEnd(10)} ${String(r.length).padStart(4)}   ${mean(r.map((x) => x.reversals)).toFixed(2).padStart(10)}        ${mean(r.map((x) => x.stops)).toFixed(2).padStart(8)}      ${median(r.map((x) => x.maxAcc)).toFixed(0).padStart(6)} / ${Math.max(...r.map((x) => x.maxAcc)).toFixed(0).padStart(6)}     ${Math.max(...r.map((x) => x.maxJerk)).toFixed(1).padStart(8)}       ${(100 * mean(r.map((x) => x.ballOff))).toFixed(2).padStart(6)}       ${Math.max(...r.map((x) => x.handPx)).toFixed(3)}`);
  }
}
if (process.argv[1]?.includes("glide-measure")) main();
