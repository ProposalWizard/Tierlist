/**
 * THE BUILD-UP CAMERA IS ONE SMOOTH MOVE (Harry, 0.108h, 24 Oct 2026: "I don't
 * like how the camera can move in multiple movements, it should be smooth").
 *
 * Every Full-highlights build-up (each style: mixed, long ball, tiki-taka, run
 * then pass; and the foul before a set piece) is played through the match's
 * own lead-in camera (leadIn.ts leadInCamera → glideCamera), frame by frame at
 * 60 fps on a phone's match canvas (366 × 744 px). Pinned:
 *   1. the build-ups ask for the glide camera (and the career's old lead-ins don't);
 *   2. jerk: the camera's speed never changes by more than MAX_JERK px/s from
 *      one frame to the next (the old per-pass camera: about 650);
 *   3. stops: on average under MAX_STOPS stop-and-go's per build-up (old: 1-2);
 *   4. the ball never leaves the frame;
 *   5. it lands on the chance's own frame: the last frame before the hand-over
 *      within 1 px, and at the hand-over exactly the chance's frame.
 * Measured before/after: scripts/fhr/glide-measure.mts.
 */
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { matchStill } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpFor, fhrWantsBuildUp, FHR_STYLES, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul } from "../../lib/star/fhr/foulBuildUp";
import { fhrBuildUpOn } from "../../lib/star/fhr/builders";
import { leadInCamera, type LeadIn } from "../../lib/star/leadIn";
import { standBackFor, yourRunupFor, penaltyRunupOf, freeKickRunupOf } from "../../lib/star/runupStyles";
import { cameraStats } from "../../scripts/fhr/glide-measure.mts";
import type { Scenario, Viewport } from "../../lib/star/canvasEngine";

const MAX_JERK = 60;     // px/s, one frame to the next
const MAX_STOPS = 1.2;   // stop-and-go's per build-up, on average
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

forceFhrMode("on"); forceChancesMode("new");
const pool = servedChances({ count: 160, seed: 77 });
let n = 0, worstJerk = 0, stops = 0, off = 0, worstHand = 0, foulN = 0, offsides = 0;
const W = 366;
const handOver = (lead: LeadIn, chance: Viewport) => {
  const cam = leadInCamera(lead, []);
  let t = 0, v = cam.at(0, chance);
  for (;;) { const nt = t + 1 / 60; if (nt >= lead.durS) break; t = nt; v = cam.at(t, chance); }
  const k = W / (chance.x2 - chance.x1);
  const atEnd = cam.at(lead.durS, chance);
  check(atEnd.x1 === chance.x1 && atEnd.x2 === chance.x2 && atEnd.y1 === chance.y1 && atEnd.y2 === chance.y2, "at the hand-over the camera is not exactly the chance's frame");
  return Math.hypot(((v.x1 + v.x2) - (chance.x1 + chance.x2)) / 2 * k, ((v.y1 + v.y2) - (chance.y1 + chance.y2)) / 2 * k) + Math.abs((v.x2 - v.x1) - (chance.x2 - chance.x1)) * k;
};
for (const c of pool) {
  const sc0 = JSON.parse(JSON.stringify(c.sc)) as Scenario;
  const setPiece = sc0.kind === "free_kick" || sc0.kind === "penalty";
  if (setPiece) sc0.player = standBackFor(yourRunupFor(sc0.kind, penaltyRunupOf(undefined), freeKickRunupOf(undefined)), sc0.ball, sc0.player, sc0.viewport);
  const chance = { ...matchStill(sc0, 744 / 366, 20).frame.camera };
  const moment = { ...c.moment, fresh: true, frame: chance };
  const leads: LeadIn[] = [];
  // The career's own build-up (the style it picks, trimmed to ~3 s) as the match plays it.
  { const on = fhrBuildUpOn(JSON.parse(JSON.stringify(sc0)), moment, undefined, { everyChance: true }); if (on) leads.push(on); }
  if (fhrWantsBuildUp(sc0.kind, moment)) {
    for (const style of [undefined, ...FHR_STYLES]) {
      const l = fhrBuildUpFor(JSON.parse(JSON.stringify(sc0)), moment, undefined, style ? { style } : {}) as FhrBuildUp | null;
      if (l) leads.push(l);
    }
  } else if (fhrWantsFoul(sc0, moment)) {
    const l = fhrFoulBuildUpFor(sc0, moment);
    if (l) { leads.push(l); foulN++; }
  }
  for (const lead of leads) {
    check(lead.camera === "glide", `${sc0.kind}: a build-up does not ask for the glide camera`);
    const s = cameraStats(lead, sc0, chance);
    n++;
    worstJerk = Math.max(worstJerk, s.maxJerk);
    stops += s.stops;
    off += s.ballOff;
    check(s.maxJerk <= MAX_JERK, `${sc0.kind}: the camera's speed jumps ${s.maxJerk.toFixed(1)} px/s in one frame (max ${MAX_JERK})`);
    check(s.ballOff === 0, `${sc0.kind}: the ball is off the frame ${(100 * s.ballOff).toFixed(1)}% of the build-up`);
    if (!lead.offside) {
      const h = handOver(lead, chance);
      worstHand = Math.max(worstHand, h);
      check(h <= 1, `${sc0.kind}: the last build-up frame is ${h.toFixed(2)} px off the chance's camera`);
    } else {
      // A called offside has no chance to land on: it glides to the end and
      // the match keeps that frame (CanvasMatch endInOffside, cam.at(durS)).
      offsides++;
      const cam = leadInCamera(lead, []);
      check(cam.lockAt(lead.durS, chance) === 0, `${sc0.kind}: a called offside locks onto a chance`);
      const a = cam.at(lead.durS - 1 / 60, chance), b = cam.at(lead.durS, chance), k = W / (chance.x2 - chance.x1);
      const jump = Math.hypot((a.x1 + a.x2 - b.x1 - b.x2) / 2 * k, (a.y1 + a.y2 - b.y1 - b.y2) / 2 * k);
      check(jump <= 3, `${sc0.kind} (offside): the camera moves ${jump.toFixed(2)} px on the last frame`);
    }
  }
}
forceFhrMode(null); forceChancesMode(null);
check(n >= 100, `only ${n} build-ups were checked`);
check(foulN > 0, "no foul build-up was checked");
check(stops / Math.max(1, n) <= MAX_STOPS, `${(stops / n).toFixed(2)} stop-and-go's per build-up (max ${MAX_STOPS})`);
// 1. The career's own lead-ins (not the rebuild) keep the follow camera.
{
  const plain: LeadIn = { durS: 2, ballAt: (t) => ({ x: 34 + 5 * t, y: 40 - 5 * t }), posAt: () => null, passStart: [0], passEnd: [1.5] };
  const v = leadInCamera(plain, []).at(1, { x1: 19, x2: 49, y1: 0, y2: 58 });
  check(Number.isFinite(v.x1) && plain.camera === undefined, "the follow camera broke");
}

if (problems.length) {
  console.log(`fhrGlideCamera FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log(`fhrGlideCamera: ${n} build-ups (${foulN} fouls, ${offsides} called offsides) — worst jerk ${worstJerk.toFixed(1)} px/s a frame (max ${MAX_JERK}), ${(stops / n).toFixed(2)} stop-and-go's each (max ${MAX_STOPS}), ball off ${(100 * off / n).toFixed(2)}%, hand-over worst ${worstHand.toFixed(3)} px — all checks pass`);
