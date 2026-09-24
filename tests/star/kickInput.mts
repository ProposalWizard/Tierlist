/**
 * ONE DRAG, EVERYWHERE — lib/star/kickInput.ts against the real match.
 *
 * Harry, 24 Sep 2026: "the shooting/goal mechanics should still fully carry
 * over perfectly … sideways drags get about 20% weaker than today, the arrow
 * points where the ball actually goes."
 *
 * Three parts:
 *
 *  1. PARITY. `REF` below is CanvasMatch.tsx's own inline drag maths, retyped
 *     by hand from the file as it stands (pitchFromPointer, screenPull,
 *     powerFromDrag, MIN_PULL = 0.008, the `power < 0.02` floor, and
 *     `dir = ball - drag`). The helper must give the same numbers on every
 *     drag, in every facing, to floating-point exactness. If someone changes
 *     CanvasMatch's formula, retype REF from it and this test says whether
 *     kickInput.ts still matches.
 *
 *  2. FIVE-A-SIDE POWER, before and after. The same pixel length dragged
 *     sideways and up the screen, on the five-a-side's 5:6 canvas.
 *
 *  3. FIVE-A-SIDE ARROW, before and after. The angle between the arrow as
 *     drawn and the ball as launched, through the real engine's `launch` on a
 *     real five-a-side picture and the real camera.
 */
import {
  clamp, dragForFullPower, VIEW_ASPECT, launch, initDefenders, setOffsideRuleEnabled,
  type Vec2, type Viewport,
} from "../../lib/star/canvasEngine";
import {
  MIN_PULL, MIN_POWER, screenPull, powerFromDrag, aimFromDrag, screenToPitch, pitchToScreen,
  type KickFacing,
} from "../../lib/star/kickInput";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import { cameraFor, projectionFor } from "../../lib/star/fiveASide/render";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 1e-12) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// ── 1. THE REFERENCE: CanvasMatch.tsx's inline formula, retyped ─────────
//
// Kept as close to the component's own lines as a free function allows:
// `f` is facingRef.current, `vp` is viewportRef.current, and the canvas is
// always VIEW_ASPECT (5:8) — CanvasMatch hard-codes that constant.
const REF = {
  MIN_PULL: 0.008,
  pitchFromPointer(sx: number, sy: number, vp: Viewport, f: KickFacing) {
    const fx = f === "right" ? sy : f === "left" ? 1 - sy : sx;
    const fy = f === "right" ? 1 - sx : f === "left" ? sx : sy;
    return { x: fx * (vp.x2 - vp.x1) + vp.x1, y: fy * (vp.y2 - vp.y1) + vp.y1 };
  },
  screenPull(drag: Vec2, ball: Vec2, vp: Viewport, f: KickFacing) {
    const W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
    const toScreen = (p: Vec2) => {
      const fx = (p.x - vp.x1) / W, fy = (p.y - vp.y1) / H;
      if (f === "right") return { sx: 1 - fy, sy: fx };
      if (f === "left") return { sx: fy, sy: 1 - fx };
      return { sx: fx, sy: fy };
    };
    const a = toScreen(drag), b = toScreen(ball);
    return Math.hypot((a.sx - b.sx) * VIEW_ASPECT, a.sy - b.sy);
  },
  powerFromDrag(drag: Vec2, ball: Vec2, vp: Viewport, f: KickFacing, power: number) {
    return clamp(REF.screenPull(drag, ball, vp, f) / dragForFullPower(power), 0, 1);
  },
  /** onPointerUp: power, then the two floors, then the direction. */
  pointerUp(d: Vec2, b: Vec2, vp: Viewport, f: KickFacing, skill: number) {
    const power = REF.powerFromDrag(d, b, vp, f, skill);
    if (REF.screenPull(d, b, vp, f) < REF.MIN_PULL) return null;
    if (power < 0.02) return null;
    const dir = { x: b.x - d.x, y: b.y - d.y };
    return { dir, power };
  },
};

{
  check(MIN_PULL === REF.MIN_PULL, "MIN_PULL must be the match's 0.008");
  check(MIN_POWER === 0.02, "MIN_POWER must be the match's 0.02 floor");

  const rng = mulberry32(20260924);
  const facings: KickFacing[] = ["up", "right", "left"];
  let compared = 0, kicks = 0, noKick = 0;
  for (let i = 0; i < 6000; i++) {
    // A real match viewport is 5:8 in metres; vary where it sits and its size.
    const h = 30 + rng() * 20;
    const w = h * VIEW_ASPECT;
    const x1 = -5 + rng() * 40, y1 = -6 + rng() * 30;
    const vp: Viewport = { x1, x2: x1 + w, y1, y2: y1 + h };
    const f = facings[i % 3];
    const ballS = { sx: 0.1 + rng() * 0.8, sy: 0.1 + rng() * 0.8 };
    // Drags from a hair (inside the dead-zone) to longer than full power, and
    // past the canvas edge, which the match deliberately does not clamp.
    const len = i % 10 === 0 ? rng() * 0.012 : rng() * 0.35;
    const ang = rng() * Math.PI * 2;
    const dragS = { sx: ballS.sx + Math.cos(ang) * len, sy: ballS.sy + Math.sin(ang) * len };
    const skill = Math.round(rng() * 100);

    const ball = REF.pitchFromPointer(ballS.sx, ballS.sy, vp, f);
    const drag = REF.pitchFromPointer(dragS.sx, dragS.sy, vp, f);
    const b2 = screenToPitch(ballS.sx, ballS.sy, vp, f);
    const d2 = screenToPitch(dragS.sx, dragS.sy, vp, f);
    check(b2.x === ball.x && b2.y === ball.y && d2.x === drag.x && d2.y === drag.y,
      `screenToPitch differs from pitchFromPointer (facing ${f})`);
    const back = pitchToScreen(drag, vp, f);
    check(near(back.sx, dragS.sx, 1e-9) && near(back.sy, dragS.sy, 1e-9),
      `pitchToScreen is not the inverse of screenToPitch (facing ${f})`);

    check(screenPull(drag, ball, vp, f) === REF.screenPull(drag, ball, vp, f),
      `screenPull differs (facing ${f})`);
    check(powerFromDrag(drag, ball, vp, skill, f) === REF.powerFromDrag(drag, ball, vp, f, skill),
      `powerFromDrag differs (facing ${f})`);
    const got = aimFromDrag(drag, ball, vp, skill, f);
    const want = REF.pointerUp(drag, ball, vp, f, skill);
    if (!want) { noKick++; check(got === null, `helper kicks where the match does not (facing ${f})`); }
    else {
      kicks++;
      check(!!got && got.power === want.power && got.dir.x === want.dir.x && got.dir.y === want.dir.y,
        `aimFromDrag differs from onPointerUp (facing ${f})`);
    }
    compared++;
  }
  check(kicks > 1000 && noKick > 100, `parity sample too thin: ${kicks} kicks, ${noKick} non-kicks`);
  console.log(`  parity: ${compared} drags across up/right/left, ${kicks} kicks + ${noKick} non-kicks — identical to CanvasMatch`);
}

// ── 2. FIVE-A-SIDE POWER, BEFORE AND AFTER ──────────────────────────────
//
// The five-a-side canvas is `aspect-[5/6]`. 390 × 468 is a phone at full width.
{
  const W = 390, H = 468;
  const cam = cameraFor(FIVE_A_SIDE, { x: 34, y: 20 }, W, H);
  const skill = 70;
  const px = 40;                         // the same thumb movement, in pixels
  const full = dragForFullPower(skill);

  // BEFORE — FiveASide.tsx's old pointerMove: hypot(Δx/W, Δy/H).
  const oldPower = (dx: number, dy: number) => Math.min(1, Math.hypot(dx / W, dy / H) / full);
  // AFTER — kickInput with the canvas's own shape.
  const newPower = (dx: number, dy: number) => {
    const anchor = screenToPitch(0.5, 0.5, cam);
    const finger = screenToPitch(0.5 + dx / W, 0.5 + dy / H, cam);
    return powerFromDrag(finger, anchor, cam, skill, "up", W / H);
  };

  const bS = oldPower(px, 0), bU = oldPower(0, px);
  const aS = newPower(px, 0), aU = newPower(0, px);
  const change = (aS - bS) / bS;
  console.log(`  five-a-side ${W}×${H}, ${px}px drag, power ${skill}:`);
  console.log(`    before  sideways ${(bS * 100).toFixed(1)}%  up ${(bU * 100).toFixed(1)}%  (sideways ×${(bS / bU).toFixed(3)})`);
  console.log(`    after   sideways ${(aS * 100).toFixed(1)}%  up ${(aU * 100).toFixed(1)}%  (sideways ×${(aS / aU).toFixed(3)})`);
  console.log(`    sideways change: ${(change * 100).toFixed(1)}%`);
  check(near(bS / bU, 6 / 5, 1e-9), `before, sideways should be 1.2× up the screen, was ${bS / bU}`);
  check(near(aS, aU, 1e-9), `after, sideways and up must buy the same power per pixel (${aS} vs ${aU})`);
  check(near(aU, bU, 1e-9), "a drag straight up the screen must be unchanged");
  check(change < -0.15 && change > -0.2, `sideways should be ~17-20% weaker, was ${(change * 100).toFixed(1)}%`);
}

// ── 3. FIVE-A-SIDE ARROW vs THE BALL, BEFORE AND AFTER ──────────────────
//
// A real passage, the real camera, the real `launch`. The arrow's on-screen
// heading is compared with the launched ball's on-screen heading. `drawAim`
// draws from ball to ball + dir·len through the projection, so its heading is
// atan2(dir.y·sy, dir.x·sx).
{
  setOffsideRuleEnabled(false);
  const W = 390, H = 468;
  const seeds = 400;
  let oldMax = 0, oldSum = 0, newMax = 0, newSum = 0, newVsAimMax = 0, n = 0;
  const heading = (v: Vec2, sx: number, sy: number) => Math.atan2(v.y * sy, v.x * sx);
  const diffDeg = (a: number, b: number) => {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return (d * 180) / Math.PI;
  };
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(9000 + s);
    const sc = buildPassage(kickOffWorld(true), { keeperStrength: 60, rng });
    sc.goal = { ...FIVE_A_SIDE.goal };
    sc.crossbar = FIVE_A_SIDE.crossbar;
    sc.viewport = { ...FIVE_A_SIDE.view };
    initDefenders(sc, rng);
    const cam = cameraFor(FIVE_A_SIDE, sc.ball, W, H);
    // projectionFor's own per-axis scale — what drawAim projects through.
    const proj = projectionFor(FIVE_A_SIDE, W, H, cam);
    const sxScale = proj.px(1) - proj.px(0), syScale = proj.py(1) - proj.py(0);

    // A diagonal-ish drag back from the thumb-down point, in screen fractions.
    const ang = Math.PI * (0.15 + 0.7 * rng());          // anywhere in the lower half
    const len = 0.05 + rng() * 0.08;
    const fx = Math.cos(ang) * len, fy = Math.sin(ang) * len;   // thumb moved by (fx, fy)

    // BEFORE: aim.dir = (−fx, −fy) in screen fractions, handed to drawAim as
    // metres; the ball was launched along (−fx·Wm, −fy·Hm).
    const oldArrow = { x: -fx, y: -fy };
    const oldLaunchDir = { x: -fx * (cam.x2 - cam.x1), y: -fy * (cam.y2 - cam.y1) };
    // AFTER: one metre vector for both.
    const anchor = screenToPitch(0.5, 0.5, cam);
    const finger = screenToPitch(0.5 + fx, 0.5 + fy, cam);
    const aim = aimFromDrag(finger, anchor, cam, 70, "up", W / H);
    if (!aim) continue;

    const skills = { power: 70, technique: 99 };
    const contact = { cx: 0, cy: 0 };
    const oldBall = launch(structuredClone(sc), oldLaunchDir, aim.power, contact, skills, mulberry32(s));
    const newBall = launch(structuredClone(sc), aim.dir, aim.power, contact, skills, mulberry32(s));

    const dOld = diffDeg(heading(oldArrow, sxScale, syScale), heading(oldBall.vel, sxScale, syScale));
    const dNew = diffDeg(heading(aim.dir, sxScale, syScale), heading(newBall.vel, sxScale, syScale));
    newVsAimMax = Math.max(newVsAimMax, diffDeg(heading(aim.dir, 1, 1), heading(newBall.vel, 1, 1)));
    oldMax = Math.max(oldMax, dOld); oldSum += dOld;
    newMax = Math.max(newMax, dNew); newSum += dNew;
    n++;
  }
  console.log(`  arrow vs ball on screen, ${n} real five-a-side strikes (technique 99, centre contact):`);
  console.log(`    before  mean ${(oldSum / n).toFixed(2)}°  worst ${oldMax.toFixed(2)}°`);
  console.log(`    after   mean ${(newSum / n).toFixed(2)}°  worst ${newMax.toFixed(2)}°`);
  check(n > 300, `too few strikes measured (${n})`);
  check(oldMax > 3, `the old arrow should have visibly disagreed with the ball (worst ${oldMax.toFixed(2)}°)`);
  check(newSum / n < oldSum / n, "the new arrow must agree with the ball better than the old one");
  // Whatever gap is left is the engine's own launch (spin/technique), which is
  // identical for the real match — not the arrow.
  check(newMax <= newVsAimMax + 1e-6,
    "after the fix, any arrow/ball gap must be the engine's own launch scatter, nothing of the arrow's");
}

// ── Five-a-side reads the drag against the match's pitch height ────────────
// Harry, 24 Sep 2026, question 11 "A": its pitch is shorter on a phone, so
// the same finger movement must be scaled by (own height / match height).
{
  const vp = { x1: 0, x2: 40, y1: 0, y2: 64 };
  const ball = { x: 20, y: 40 }, drag = { x: 20, y: 46 };
  const full = screenPull(drag, ball, vp);
  const scaled = screenPull(drag, ball, vp, "up", VIEW_ASPECT, 468 / 585.6);
  check(Math.abs(scaled - full * (468 / 585.6)) < 1e-12, "heightScale scales the pull exactly");
  check(screenPull(drag, ball, vp, "up", VIEW_ASPECT, 1) === full, "heightScale 1 changes nothing");
  // 60px up a 468px five-a-side pitch = 60px up a 585.6px match pitch.
  const fiveA = 60 / 468 * (468 / 585.6), match = 60 / 585.6;
  check(Math.abs(fiveA - match) < 1e-12, "the same 60px drag is the same pull in both");
}

if (problems.length) {
  console.error(`kickInput: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 30)) console.error("  - " + p);
  process.exit(1);
}
console.log("kickInput: ok");
