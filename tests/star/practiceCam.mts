/**
 * THE PRACTICE CAMERA AND TWO TOUCH'S SKILL (Harry, 9 Oct 2026: "the camera
 * should be set above the players shoulders not in tandem with the joystick
 * … Two touch has no element of skill and moving messes everything up").
 *
 * Camera (lib/star/three3d/orbitCam.ts):
 *   - settles 2.2 m up and 4.6 m behind you, looking a little down;
 *   - never turns faster than 60°/s, and starts and stops a turn smoothly;
 *   - is never turned by your stick or your facing (only by where you are
 *     against what it frames);
 *   - a cross in the air (track): it rises and turns towards the ball, then
 *     settles back behind your shoulder;
 *   - a peek springs back.
 * Two Touch (lib/star/play3d/twoTouch.ts):
 *   - the grade windows (Perfect / Good / Heavy / miss) by technique;
 *   - a Perfect first touch sits up higher and closer than a Heavy one;
 *   - an aimed, weighted return keeps the rally more than a too-hard or
 *     too-wide one;
 *   - you step under the ball on your own: pushing the stick the wrong way
 *     the whole rally still leaves the ball in reach.
 */
import { STEP, CX } from "../../lib/star/play3d/constants";
import { skillsOf } from "../../lib/star/play3d/player";
import {
  makePracticeCam, stepPracticeCam, setPeek, wrap, SHOULDER, TRACK, MAX_TURN, PEEK_MAX,
} from "../../lib/star/three3d/orbitCam";
import {
  makeTwoTouch, touchGrade, timeToTouch, returnTarget, juggleWindow, PERFECT_Q, GOOD_Q, JUGGLE_REACH,
  RETURN_FULL_PULL, RETURN_IDEAL, SETUP,
} from "../../lib/star/play3d/twoTouch";
import { DRILLS } from "../../lib/star/play3d/drills";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const DT = 1 / 60;
const deg = (r: number) => r * 180 / Math.PI;

// ── 1. Camera: behind and above your shoulder ──
{
  const cam = makePracticeCam();
  let c = stepPracticeCam(cam, { you: { x: CX, y: 20 }, target: { x: CX, y: 0 } }, DT);
  for (let i = 0; i < 300; i++) c = stepPracticeCam(cam, { you: { x: CX, y: 20 }, target: { x: CX, y: 0 } }, DT);
  const back = c.pos.y - 20, side = c.pos.x - CX;
  check(Math.abs(c.pos.z - 2.2) < 0.01 && Math.abs(back - 4.6) < 0.01 && Math.abs(side - 0.8) < 0.01, `settles 2.2 m up, 4.6 m back, 0.8 m right (${c.pos.z.toFixed(2)} up, ${back.toFixed(2)} back, ${side.toFixed(2)} right)`);
  check(c.pos.y > 20, "it stands behind you (further from the goal than you)");
  const down = deg(Math.atan2(c.pos.z - c.look.z, Math.hypot(c.look.x - c.pos.x, c.look.y - c.pos.y)));
  check(down > 5 && down < 15, `looks a little down (${down.toFixed(1)}°)`);
  console.log(`camera: ${SHOULDER.up} m up, ${SHOULDER.back} m back, looking ${down.toFixed(1)}° down`);
}

// ── 2. Camera: turn rate capped at 60°/s, eased in and out ──
{
  const cam = makePracticeCam();
  // settle looking at the goal, then the thing it frames jumps behind you (a 180° turn wanted)
  for (let i = 0; i < 120; i++) stepPracticeCam(cam, { you: { x: CX, y: 20 }, target: { x: CX, y: 0 } }, DT);
  let prev = cam.heading, peak = 0, first = -1;
  const rates: number[] = [];
  for (let i = 0; i < 600; i++) {
    stepPracticeCam(cam, { you: { x: CX, y: 20 }, target: { x: CX + 0.01, y: 40 } }, DT);
    const r = Math.abs(wrap(cam.heading - prev)) / DT;
    prev = cam.heading;
    rates.push(r);
    peak = Math.max(peak, r);
    if (first < 0 && Math.abs(wrap(cam.heading - Math.PI / 2)) < 0.01) first = i * DT;
  }
  check(peak <= MAX_TURN * 1.001, `never faster than 60°/s (peak ${deg(peak).toFixed(1)}°/s)`);
  check(peak > MAX_TURN * 0.95, `a big turn reaches about 60°/s (${deg(peak).toFixed(1)}°/s)`);
  check(rates[0] < MAX_TURN * 0.2, `starts a turn gently (first frame ${deg(rates[0]).toFixed(1)}°/s)`);
  check(first > 2.9 && first < 4.5, `a 180° turn takes 3-4.5 s (${first.toFixed(2)} s)`);
  const end = rates.slice(Math.round(first / DT) - 6, Math.round(first / DT));
  check(end.every((r) => r < MAX_TURN * 0.6), "slows down as it arrives (no snap at the end)");
  console.log(`camera turn: peak ${deg(peak).toFixed(1)}°/s, first frame ${deg(rates[0]).toFixed(1)}°/s, 180° in ${first.toFixed(2)} s`);
}

// ── 3. Camera: the stick and your facing never turn it ──
{
  // the camera function is never handed the stick or the facing; check the heading only follows geometry:
  // you running 4 m sideways in front of a goal 20 m away moves it by the angle that makes (≈ 11°), not by your 90° stick
  const cam = makePracticeCam();
  for (let i = 0; i < 120; i++) stepPracticeCam(cam, { you: { x: CX, y: 20 }, target: { x: CX, y: 0 } }, DT);
  const h0 = cam.heading;
  for (let i = 0; i < 60; i++) stepPracticeCam(cam, { you: { x: CX + 4 * (i + 1) / 60, y: 20 }, target: { x: CX, y: 0 } }, DT);
  for (let i = 0; i < 240; i++) stepPracticeCam(cam, { you: { x: CX + 4, y: 20 }, target: { x: CX, y: 0 } }, DT);
  const moved = deg(Math.abs(wrap(cam.heading - h0)));
  const geom = deg(Math.atan2(4, 20));
  check(Math.abs(moved - geom) < 0.5, `running sideways turns it only by the geometry (${moved.toFixed(1)}° vs ${geom.toFixed(1)}°)`);
}

// ── 4. Camera: a cross in the air is tracked, then it settles ──
{
  const cam = makePracticeCam();
  const you = { x: CX, y: 13 }, goal = { x: CX, y: 0 };
  for (let i = 0; i < 120; i++) stepPracticeCam(cam, { you, target: goal }, DT);
  const ball = { x: 9, y: 5, z: 2.5 };
  let c = stepPracticeCam(cam, { you, target: goal, ball, trackBall: true }, DT);
  for (let i = 0; i < 90; i++) c = stepPracticeCam(cam, { you, target: goal, ball, trackBall: true }, DT);
  const toBall = Math.atan2(ball.y - you.y, ball.x - you.x), toGoal = -Math.PI / 2;
  const nearer = Math.abs(wrap(cam.heading - toBall)) < Math.abs(wrap(toGoal - toBall));
  check(nearer && c.pos.z > SHOULDER.up + 0.8, `tracking: turns towards the ball and rises (${deg(wrap(cam.heading - toGoal)).toFixed(0)}° off the goal, ${c.pos.z.toFixed(2)} m up)`);
  for (let i = 0; i < 360; i++) c = stepPracticeCam(cam, { you, target: goal, ball, trackBall: false }, DT);
  check(Math.abs(c.pos.z - SHOULDER.up) < 0.05 && Math.abs(wrap(cam.heading - toGoal)) < 0.02, `settles back behind your shoulder (${c.pos.z.toFixed(2)} m up)`);
  console.log(`ball track: up to ${TRACK.up} m, ${TRACK.back} m back`);
}

// ── 5. Camera: a peek springs back ──
{
  const cam = makePracticeCam();
  const f = { you: { x: CX, y: 20 }, target: { x: CX, y: 0 } };
  for (let i = 0; i < 60; i++) stepPracticeCam(cam, f, DT);
  setPeek(cam, 5);
  let c = stepPracticeCam(cam, f, DT);
  for (let i = 0; i < 60; i++) c = stepPracticeCam(cam, f, DT);
  check(Math.abs(wrap(c.heading - cam.heading) - PEEK_MAX) < 0.02, "a peek looks round 40° at most");
  check(Math.abs(wrap(cam.heading + Math.PI / 2)) < 0.01, "a peek never moves the stick's heading");
  setPeek(cam, 0);
  for (let i = 0; i < 60; i++) c = stepPracticeCam(cam, f, DT);
  check(Math.abs(wrap(c.heading - cam.heading)) < 0.01, "and springs back when let go");
}

// ── 6. The three drills use it; Wembley keeps its own ──
{
  for (const id of ["two-touch", "free-roam", "headers-volleys"]) {
    const d = DRILLS.find((x) => x.id === id)!;
    const s = d.start!({ seed: 1, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: [{ id: "m1", name: "A", skills: skillsOf(70) }, { id: "m2", name: "B", skills: skillsOf(70) }] });
    check(s.camera === "practice" && !!s.frame && !!s.hints?.pc && !!s.hints?.touch, `${id}: practice camera, framing, phone and PC hints`);
  }
  const hv = DRILLS.find((x) => x.id === "headers-volleys")!.start!({ seed: 3, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: [] });
  check(hv.hints!.pc.includes("Hold Shift to sprint"), "PC hint uses the pace drill's wording");
  let tracked = 0, settledAtStrike = true;
  for (let i = 0; i < 60 * 40; i++) {
    const tr = hv.frame!(hv.world).trackBall;
    if (tr) tracked++;
    hv.world.step(STEP);
  }
  check(tracked > 60, `Headers & Volleys tracks the crosses (${(tracked / 60).toFixed(1)} s of 40)`);
  void settledAtStrike;
}

// ── 7. Two Touch: the grade windows ──
const lines: string[] = [];
for (const tech of [50, 70, 90]) {
  const win = juggleWindow(tech);
  check(touchGrade(win * PERFECT_Q * 0.99, tech) === "perfect" && touchGrade(-win * PERFECT_Q * 1.01, tech) === "good", `technique ${tech}: perfect edge`);
  check(touchGrade(win * GOOD_Q * 1.01, tech) === "poor" && touchGrade(win * 1.01, tech) === "miss", `technique ${tech}: heavy and miss edges`);
  lines.push(`tech ${tech}: perfect ±${Math.round(win * PERFECT_Q * 1000)} ms, good ±${Math.round(win * GOOD_Q * 1000)} ms, heavy ±${Math.round(win * 1000)} ms`);
}
console.log("two-touch grades — " + lines.join("; "));

// helpers for a real rally
const you = { id: "you", name: "You", skills: skillsOf(75) };
const mate = { id: "mate", name: "Mate", skills: skillsOf(75) };
const waitTouch = (w: ReturnType<typeof makeTwoTouch>["world"], off: number) => {
  for (let i = 0; i < 1200; i++) {
    const b = w.ball;
    if (b.vz < 0 && timeToTouch(b) <= off) return true;
    w.step(STEP);
  }
  return false;
};

// ── 8. A Perfect first touch sits up better than a Heavy one ──
{
  const sit = (off: number) => {
    let apex = 0, drift = 0;
    const N = 60;
    for (let s = 0; s < N; s++) {
      const { world: w, state } = makeTwoTouch({ seed: 500 + s, you, mate });
      waitTouch(w, off); w.act({ kind: "tap" }); w.step(STEP);
      if (state.touches !== 1) continue;
      const p = w.get("you")!, x0 = p.x, y0 = p.y, z0 = w.ball.z;
      let top = 0;
      for (let i = 0; i < 240 && !(w.ball.vz < 0 && w.ball.z < 0.75); i++) { top = Math.max(top, w.ball.z); w.step(STEP); }
      apex += top - z0; drift += Math.hypot(w.ball.x - x0, w.ball.y - y0);
    }
    return { apex: apex / N, drift: drift / N };
  };
  const win = juggleWindow(75);
  const perfect = sit(0), heavy = sit(win * 0.85);
  check(perfect.apex > heavy.apex + 0.2, `perfect pops up more above the foot (${perfect.apex.toFixed(2)} vs ${heavy.apex.toFixed(2)} m)`);
  check(perfect.drift < heavy.drift, `perfect drifts less (${perfect.drift.toFixed(2)} vs ${heavy.drift.toFixed(2)} m)`);
  console.log(`first touch: perfect rise ${perfect.apex.toFixed(2)} m, drift ${perfect.drift.toFixed(2)} m; heavy rise ${heavy.apex.toFixed(2)} m, drift ${heavy.drift.toFixed(2)} m (set-up rise ${SETUP.perfect.rise}/${SETUP.poor.rise} m)`);
}

// ── 9. The return: aimed and weighted ──
{
  const ret = (weight: number, offDeg: number) => {
    let kept = 0, n = 0;
    for (let s = 0; s < 120; s++) {
      const { world: w, state } = makeTwoTouch({ seed: 900 + s, you, mate });
      waitTouch(w, 0); w.act({ kind: "tap" }); w.step(STEP);
      if (state.touches !== 1) continue;
      waitTouch(w, 0);
      const p = w.get("you")!, m = w.get("mate")!;
      const a = Math.atan2(m.y - p.y, m.x - p.x) + offDeg * Math.PI / 180;
      w.act({ kind: "shoot", dir: { x: Math.cos(a), y: Math.sin(a) }, pull: weight * RETURN_FULL_PULL }); w.step(STEP);
      if (state.receiver !== "mate") continue;
      n++;
      const rallies = state.rallies.length;
      for (let i = 0; i < 60 * 6 && state.rallies.length === rallies && state.receiver !== "you"; i++) w.step(STEP);
      if (state.receiver === "you" && state.rallies.length === rallies) kept++;
    }
    return n ? kept / n : 0;
  };
  const good = ret(RETURN_IDEAL, 0), hard = ret(RETURN_IDEAL * 1.9, 0), wide = ret(RETURN_IDEAL, 35);
  check(good > hard + 0.2 && good > wide + 0.2, `a good return keeps the rally more (good ${(good * 100).toFixed(0)}%, too hard ${(hard * 100).toFixed(0)}%, 35° wide ${(wide * 100).toFixed(0)}%)`);
  const t = returnTarget({ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 1, y: 0 }, RETURN_IDEAL * RETURN_FULL_PULL);
  check(Math.abs(t.x - 8) < 1e-9 && t.verdict === "", "the ideal weight lands on him");
  check(returnTarget({ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 1, y: 0.5 }, 0.07).verdict === "Too wide", "27° off reads Too wide");
  console.log(`return kept by the mate (75s, 120 tries): ideal ${(good * 100).toFixed(0)}%, too hard ${(hard * 100).toFixed(0)}%, 35° wide ${(wide * 100).toFixed(0)}%`);
}

// ── 10. Moving can't break it: the stick only nudges ──
{
  let inReach = 0, n = 0;
  for (let s = 0; s < 60; s++) {
    const { world: w } = makeTwoTouch({ seed: 1300 + s, you, mate });
    w.input = { move: { x: 0, y: 1 }, sprint: true }; // full push the wrong way, the whole time
    if (!waitTouch(w, 0)) continue;
    n++;
    const p = w.get("you")!;
    if (Math.hypot(w.ball.x - p.x, w.ball.y - p.y) <= JUGGLE_REACH) inReach++;
  }
  check(inReach / n > 0.9, `full stick the wrong way: ball still in reach ${inReach}/${n}`);
  console.log(`stick held the wrong way all rally: ball in reach at the touch ${inReach}/${n}`);
}

if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("practiceCam: all checks pass");
