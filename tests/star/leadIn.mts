/**
 * The Real shots lead-in (lib/star/statsbombShots.ts leadinTrack, played by
 * CanvasMatch's `leadIn` through lib/star/leadIn.ts): the real passes before
 * a real shot, replayed in the match's own picture, then the chance.
 *
 * Checks, over every shot that has a lead-in:
 *   - the timing: passes start at the real seconds before the shot (pushed
 *     later only when the ball could not have got there), never longer than
 *     LEAD_MAX_S, never backwards;
 *   - the last pass is received by YOU, and you carry it onto the shot's spot;
 *   - continuity: at the end every man, the ball and the camera are exactly
 *     where the chance has them (no jump when it starts);
 *   - the camera (Harry, 14 Oct 2026: "maybe do it on the pass and then fixed
 *     once in the 6 yard box"): it follows the passes, then is FIXED on the
 *     shot's own frame once the ball is in the lock box (LEAD_LOCK_AREA), and
 *     its biggest move in one frame (1/60 s) is measured.
 * The chance is the page's: the wide Play frame (scenarioForShot wideFrame).
 */
import { readFileSync } from "node:fs";
import {
  scenarioForShot, leadinTrack, sbToPitch, LEAD_MAX_S, LEAD_HOLD_S,
  type SbFile, type SbLeadinFile,
} from "../../lib/star/statsbombShots";
import { leadInEntities, leadInCamera, inLockArea, LEAD_LOCK_AREA } from "../../lib/star/leadIn";
import { chaseNumbers } from "./realShotsChase.mts";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const shots = (JSON.parse(readFileSync("data/statsbomb/shots.json", "utf8")) as SbFile).shots;
const leads = (JSON.parse(readFileSync("data/statsbomb/leadins.json", "utf8")) as SbLeadinFile).leadins;
const withLead = shots.filter((s) => (leads[s.id]?.passes.length ?? 0) >= 1);
check(`shots with a lead-in: ${withLead.length}`, withLead.length > 500);

let n = 0, backwards = 0, tooLong = 0, endBall = 0, endPeople = 0, endCam = 0, youRecv = 0, youEnd = 0;
// The camera, frame by frame (1/60 s): its biggest step while following, beyond the ball's own move.
const stepMax: number[] = [];
let overStep = 0, lockedMoves = 0, entered = 0, lockedOnEntry = 0, lockedLate = 0, lockedAtEnd = 0;
const FRAME = 1 / 60, STEP_LIMIT = 1.0;
let camLost = 0, camJump = 0, realTimed = 0, timedPasses = 0, compressed = 0, jumpy = 0, passerOn = 0, passerAll = 0, startBall = 0;
for (const s of withLead) {
  const lead = leads[s.id];
  const sc = scenarioForShot(s, { wideFrame: true });
  const ends = leadInEntities(sc).map((e) => ({ key: e.key, at: e.get() }));
  const tr = leadinTrack(s, lead, sc);
  n++;
  const ts = tr.ballKeys.map((k) => k.t);
  if (ts.some((t, i) => i > 0 && t < ts[i - 1] - 1e-9)) backwards++;
  if (tr.durS > LEAD_MAX_S + 1e-6) tooLong++;
  if (d(tr.ballAt(0), sbToPitch(lead.passes[0][1])) > 1e-6) startBall++;
  const be = tr.ballAt(tr.durS);
  if (d(be, sc.ball) > 1e-6 || be.z !== 0) endBall++;
  // Everyone ends exactly where the chance has him; nobody jumps in the last frame.
  for (const e of ends) {
    const p = tr.posAt(e.key, tr.durS);
    if (p && d(p, e.at) > 1e-6) { endPeople++; break; }
  }
  for (const e of ends) {
    const a = tr.posAt(e.key, tr.durS - 1 / 60), b = tr.posAt(e.key, tr.durS);
    if (a && b && d(a, b) > 0.6) { jumpy++; break; }
  }
  // The camera keeps the ball in frame all the way, and glides (no jump frame to frame).
  const keys = ends.map((e) => e.key);
  const cam = leadInCamera(tr, keys);
  let prev = cam.at(0, sc.viewport);
  for (let t = 0; t <= tr.durS + 1e-9; t += 1 / 15) {
    const v = cam.at(t, sc.viewport);
    const b = tr.ballAt(t);
    if (b.x < v.x1 || b.x > v.x2 || b.y < v.y1 || b.y > v.y2) { camLost++; break; }
    const ballMove = d(b, tr.ballAt(Math.max(0, t - 1 / 15)));
    if (Math.max(Math.abs(v.x1 - prev.x1), Math.abs(v.y1 - prev.y1), Math.abs(v.x2 - prev.x2), Math.abs(v.y2 - prev.y2)) > Math.max(3, ballMove * 1.15)) { camJump++; break; }
    prev = v;
  }
  // Frame by frame: the biggest step; and after the lock, not a millimetre of movement.
  {
    const c2 = leadInCamera(tr, keys);
    const lockT = c2.lockTime(sc.viewport);
    let pv = c2.at(0, sc.viewport), worst = 0, over = false, moved = false, te = -1;
    for (let k = 1; k * FRAME <= tr.durS + 1e-9; k++) {
      const t = k * FRAME;
      const v = c2.at(t, sc.viewport);
      const step = Math.max(Math.abs(v.x1 - pv.x1), Math.abs(v.x2 - pv.x2), Math.abs(v.y1 - pv.y1), Math.abs(v.y2 - pv.y2));
      worst = Math.max(worst, step);
      // never faster than STEP_LIMIT a frame (60 m/s), unless it is keeping up with the ball itself
      // (1.1x, 14 Oct 2026: the Real shots TV camera panning with a sped-up long ball as it glides onto the shot frame)
      if (step > Math.max(STEP_LIMIT, d(tr.ballAt(t), tr.ballAt(t - FRAME)) * 1.1 + 0.02)) over = true;
      if (t >= lockT && Math.abs(v.x1 - sc.viewport.x1) + Math.abs(v.x2 - sc.viewport.x2) + Math.abs(v.y1 - sc.viewport.y1) + Math.abs(v.y2 - sc.viewport.y2) > 1e-9) moved = true;
      if (te < 0 && inLockArea(tr.ballAt(t))) te = t;
      pv = v;
    }
    stepMax.push(worst);
    if (over) overStep++;
    if (moved) lockedMoves++;
    if (lockT >= tr.durS - 1e-9) lockedAtEnd++;
    if (te >= 0) { entered++; if (lockT <= te + FRAME + 1e-9) lockedOnEntry++; else lockedLate++; }
  }
  const vp = cam.at(tr.durS, sc.viewport);
  if (Math.abs(vp.x1 - sc.viewport.x1) + Math.abs(vp.y1 - sc.viewport.y1) + Math.abs(vp.x2 - sc.viewport.x2) + Math.abs(vp.y2 - sc.viewport.y2) > 1e-9) endCam++;
  // YOU receive the last pass: at its arrival you stand where it arrives (just behind the ball).
  const last = tr.passEnd.length - 1;
  const you = tr.posAt("you", tr.passEnd[last])!;
  const ballThen = tr.ballAt(tr.passEnd[last]);
  const off = d(sc.player, sc.ball);
  if (Math.abs(d(you, ballThen) - off) < 0.05) youRecv++;
  if (d(tr.posAt("you", tr.durS)!, sc.player) < 1e-6) youEnd++;
  // The real timing: each pass starts at the real seconds before the shot
  // (times the speed-up), unless the ball could not have been there yet.
  const k = tr.durS < LEAD_MAX_S - 1e-6 ? 1 : null;
  if (k === null) compressed++;
  else {
    lead.passes.forEach((p, i) => {
      timedPasses++;
      const real = LEAD_HOLD_S + (lead.passes[0][0] - p[0]);
      if (Math.abs(tr.passStart[i] - real) < 0.02) realTimed++;
    });
  }
  // The passer is on the ball as he plays it.
  tr.holders.forEach((h, i) => {
    passerAll++;
    if (!h) return;
    const pos = tr.posAt(h, tr.passStart[i])!;
    if (d(pos, tr.ballAt(tr.passStart[i])) < 1.5) passerOn++;
  });
}
check(`ball keys never go backwards (${backwards}/${n})`, backwards === 0);
check(`no lead-in longer than ${LEAD_MAX_S} s (${tooLong}/${n})`, tooLong === 0);
check(`the ball starts at the first pass (${startBall} off)`, startBall === 0);
check(`the ball ends on the chance's ball, on the grass (${endBall} off)`, endBall === 0);
check(`everyone ends where the chance has him (${endPeople} off)`, endPeople === 0);
check(`nobody jumps in the last frame (${jumpy} of ${n})`, jumpy === 0);
check(`the lead-in camera keeps the ball in frame (${camLost} lost)`, camLost === 0);
check(`the lead-in camera glides: never faster than 45 m/s or the ball itself (${camJump} of ${n} moves have one faster frame; allowed: under 0.5%)`, camJump < n * 0.005);
check(`the camera ends on the chance's own frame (${endCam} off)`, endCam === 0);
stepMax.sort((a, b) => a - b);
const pct = (f: number) => stepMax[Math.floor(f * (stepMax.length - 1))].toFixed(2);
console.log(`     camera's biggest step in one frame (m): median ${pct(0.5)}, 99th ${pct(0.99)}, worst ${pct(1)} (worst = keeping up with a sped-up ball)`);
check(`the camera never steps more than ${STEP_LIMIT} m in a frame unless the ball does (${overStep} of ${n})`, overStep === 0);
check(`after the lock the camera does not move at all (${lockedMoves} of ${n} moved)`, lockedMoves === 0);
check(`the ball enters the "${LEAD_LOCK_AREA}" box in ${entered} moves: locked on entry ${lockedOnEntry}, later ${lockedLate} (the ball would leave the fixed frame)`, lockedOnEntry > entered * 0.8);
check(`shots from outside the box lock as the lead-in ends (${lockedAtEnd} of ${n})`, lockedAtEnd + lockedOnEntry + lockedLate >= n && lockedAtEnd > 0);
check(`YOU receive the last pass (${youRecv}/${n})`, youRecv === n);
check(`YOU end exactly where the chance has you (${youEnd}/${n})`, youEnd === n);
const realShare = realTimed / Math.max(1, timedPasses);
check(`passes start at the real second (${(realShare * 100).toFixed(0)}% of ${timedPasses}; ${compressed} long moves sped up)`, realShare > 0.6);
const onShare = passerOn / Math.max(1, passerAll);
check(`the passer is on the ball as he plays it (${(onShare * 100).toFixed(0)}% of ${passerAll})`, onShare > 0.8);

// ── Chasing (Harry, 14 Oct 2026: "they just run after the ball endlessly") ──
// Before the rebuild on the build-up's way of moving people (14 Oct 2026):
// 0.77 men not on the ball within 5 m of it while the passes are played,
// 14.6% of moving man-frames heading at it, 8.4% of man-frames over 9 m/s
// (fastest 719 m/s: men jumping), 48 m run a man a lead-in.
{
  const c = chaseNumbers(withLead, leads);
  const p1 = (v: number) => `${(v * 100).toFixed(1)}%`;
  console.log(`     chasing: ${c.nearChasersPasses.toFixed(2)} men (not on it) within 5 m of the ball during the passes, ${c.nearChasers.toFixed(2)} over the whole lead-in; heading at it ${p1(c.towardSharePasses)} of moving man-frames; ${c.closingFast.toFixed(2)} a frame running at it over 3 m/s; ${c.runPerMan.toFixed(1)} m run a man; fastest ${c.maxSpeed.toFixed(1)} m/s, ${p1(c.over9Share)} of man-frames over 9; end vs the real freeze frame ${c.endVsReal.toFixed(3)} m`);
  check(`nobody chases the ball: under 0.75 men not on it within 5 m during the passes (${c.nearChasersPasses.toFixed(2)}; before 0.77)`, c.nearChasersPasses < 0.75);
  check(`men hold their shape: under 20% of moving man-frames head at the ball (${p1(c.towardSharePasses)})`, c.towardSharePasses < 0.2);
  check(`nobody over 9 m/s (${p1(c.over9Share)} of man-frames; under 0.2%; before 8.4%)`, c.over9Share < 0.002);
  check(`no endless running: under 25 m a man a lead-in (${c.runPerMan.toFixed(1)} m; before 48)`, c.runPerMan < 25);
  check(`the end frame is the shot's real freeze frame (${c.endVsReal.toFixed(3)} m)`, c.endVsReal < 0.05);
}

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall ok");
