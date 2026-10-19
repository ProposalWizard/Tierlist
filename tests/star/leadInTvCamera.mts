/**
 * The Real shots TV camera (lib/star/leadIn.ts, lead.camera "tv").
 *
 * Harry, 14 Oct 2026: "real shots are still very broken … the camerawork needs
 * to change up until you get your chance". Filmed before the fix: the follow
 * frame was never wider than the shot's own frame (22-30 m on a phone), so in
 * midfield you watched empty grass and the ball flew to a man not yet on screen.
 *
 * Over every shot with 2+ passes, frame by frame (1/60 s), the old camera
 * (build-ups' camera) against the TV camera:
 *   - while a pass is in the air, are BOTH the man who hit it and the spot it
 *     goes to on the screen?
 *   - the biggest slide and zoom in one frame (share of the screen);
 *   - at the end it IS the shot's frame (no jump when the chance starts).
 */
import { readFileSync } from "node:fs";
import { scenarioForShot, leadinTrack, type WyscoutShotFile, type RealLead } from "../../lib/star/realMoments";
import { leadInEntities, leadInCamera, type LeadIn } from "../../lib/star/leadIn";
import type { Viewport, Vec2 } from "../../lib/star/canvasEngine";

let fails = 0;
function check(label: string, ok: boolean) { if (!ok) { fails++; console.log(`FAIL ${label}`); } else console.log(`ok   ${label}`); }

const shots = (JSON.parse(readFileSync("data/realmoments/wyscout_shots.json", "utf8")) as WyscoutShotFile).shots;
const leads: Record<string, RealLead> = Object.fromEntries(shots.filter((s) => s.lead).map((s) => [s.id, s.lead!]));
const list = shots.filter((s) => (leads[s.id]?.passes.length ?? 0) >= 2);
// The phone's frame: the match gives the shot's frame the canvas's shape (taller), as CanvasMatch frameScenario does.
const HW = 1.95;
const phoneFrame = (v: Viewport): Viewport => {
  const w = v.x2 - v.x1, h = v.y2 - v.y1;
  return h / w < HW ? { ...v, y2: v.y1 + w * HW } : { ...v, x1: (v.x1 + v.x2) / 2 - h / HW / 2, x2: (v.x1 + v.x2) / 2 + h / HW / 2 };
};
const inside = (v: Viewport, p: Vec2, m = 1) => p.x > v.x1 + m && p.x < v.x2 - m && p.y > v.y1 + m && p.y < v.y2 - m;
// The part of the frame you can SEE on a phone (the canvas is wider than the screen; the commentary box covers the bottom).
const seen = (v: Viewport): Viewport => { const w = v.x2 - v.x1, h = v.y2 - v.y1; return { x1: v.x1 + 0.11 * w, x2: v.x2 - 0.11 * w, y1: v.y1 + 0.02 * h, y2: v.y2 - 0.26 * h }; };

function measure(tv: boolean) {
  let passFrames = 0, both = 0, recv = 0, worstSlide = 0, worstZoom = 0, endOff = 0, n = 0, ballOff = 0, frames = 0;
  const scales: number[] = [];
  const slides: number[] = [];
  for (const s of list) {
    const sc = scenarioForShot(s, { wideFrame: true });
    const tr = leadinTrack(s, leads[s.id], sc);
    const lead: LeadIn = { ...tr, camera: tv ? "tv" : undefined };
    const chance = phoneFrame(sc.viewport);
    const cam = leadInCamera(lead, leadInEntities(sc).map((e) => e.key));
    let pv = cam.at(0, chance), shotSlide = 0;
    n++;
    for (let t = 1 / 60; t <= tr.durS + 1e-9; t += 1 / 60) {
      const v = cam.at(t, chance);
      const w = v.x2 - v.x1, pw = pv.x2 - pv.x1;
      const slide = Math.hypot((v.x1 + v.x2 - pv.x1 - pv.x2) / 2, (v.y1 + v.y2 - pv.y1 - pv.y2) / 2) / w;
      shotSlide = Math.max(shotSlide, slide);
      worstZoom = Math.max(worstZoom, Math.abs(w - pw) / pw);
      if (cam.lockAt(t, chance) < 0.01) { scales.push(w / (chance.x2 - chance.x1)); frames++; if (!inside(seen(v), tr.ballAt(t), 0)) ballOff++; }
      const i = tr.passStart.findIndex((a, k) => t >= a && t < tr.passEnd[k]);
      if (i >= 0 && cam.lockAt(t, chance) < 0.01) {
        passFrames++;
        if (inside(v, tr.ballAt(tr.passStart[i])) && inside(v, tr.ballAt(tr.passEnd[i]))) both++;
        if (inside(seen(v), tr.ballAt(tr.passEnd[i]))) recv++;
      }
      pv = v;
    }
    slides.push(shotSlide);
    worstSlide = Math.max(worstSlide, shotSlide);
    const e = cam.at(tr.durS, chance);
    if (Math.abs(e.x1 - chance.x1) + Math.abs(e.x2 - chance.x2) + Math.abs(e.y1 - chance.y1) + Math.abs(e.y2 - chance.y2) > 1e-6) endOff++;
  }
  slides.sort((a, b) => a - b);
  scales.sort((a, b) => a - b);
  return { recvPct: (100 * recv) / Math.max(1, passFrames), medScale: scales[Math.floor(scales.length / 2)], maxScale: scales[scales.length - 1], ballOffPct: (100 * ballOff) / Math.max(1, frames), n, bothPct: (100 * both) / Math.max(1, passFrames), medSlide: slides[Math.floor(slides.length / 2)] * 100, p99Slide: slides[Math.floor(0.99 * (slides.length - 1))] * 100, worstSlide: worstSlide * 100, worstZoom: worstZoom * 100, endOff };
}

const before = measure(false), after = measure(true);
const f = (r: ReturnType<typeof measure>) => `frame width vs the shot's own: median ${r.medScale.toFixed(2)}x, widest ${r.maxScale.toFixed(2)}x · ball hidden (off the seen part) ${r.ballOffPct.toFixed(2)}% of frames · where the pass goes, seen ${r.recvPct.toFixed(1)}% · both ends of the pass on screen ${r.bothPct.toFixed(1)}% of pass frames · biggest slide in one frame: median ${r.medSlide.toFixed(1)}%, 99th ${r.p99Slide.toFixed(1)}%, worst ${r.worstSlide.toFixed(1)}% of the screen · biggest zoom in one frame ${r.worstZoom.toFixed(1)}%`;
console.log(`     ${before.n} moves with 2+ passes`);
console.log(`     old camera: ${f(before)}`);
console.log(`     TV camera:  ${f(after)}`);
// Round 3 (Harry: "far too zoomed out"): the TV camera works at the shot's own scale, men the size you play them at.
check(`TV camera: never more than 1.2x the shot's own frame width (widest ${after.maxScale.toFixed(3)}x, median ${after.medScale.toFixed(2)}x)`, after.maxScale <= 1.2 + 1e-6);
check(`TV camera: the ball stays in the part you can see (hidden ${after.ballOffPct.toFixed(2)}% of frames; old ${before.ballOffPct.toFixed(2)}%)`, after.ballOffPct <= 0.5);
check(`TV camera: where the pass goes is seen in 75%+ of pass frames (the frame stays at player size, so a long pass can outrun it) (${after.recvPct.toFixed(1)}%; old ${before.recvPct.toFixed(1)}%)`, after.recvPct >= 75);
check(`TV camera: never slides more than 4% of the screen in one frame on 99% of moves (${after.p99Slide.toFixed(1)}%)`, after.p99Slide <= 4);
check(`TV camera: never zooms more than 2% in one frame (${after.worstZoom.toFixed(2)}%)`, after.worstZoom <= 2);
check(`TV camera: ends exactly on the shot's frame, no jump at the handover (${after.endOff} off)`, after.endOff === 0);
console.log(fails ? `\n${fails} failed` : "\nall ok");
if (fails) process.exit(1);
