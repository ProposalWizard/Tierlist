import {
  curveDirFromSwipe, applyCurveSwipe,
  CURVE_SPIN_STEP, CURVE_SPIN_MAX, CURVE_VZ_STEP, CURVE_VZ_MAX,
  type Ball,
} from "../../lib/star/canvasEngine";

/**
 * Curve boots: "swipe the screen to curve the ball... with each additional
 * swipe stacking the curve." curveDirFromSwipe/applyCurveSwipe are the pure
 * logic CanvasMatch's flight-phase pointer handlers call into — no canvas,
 * same idiom as every other pure-logic suite here.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mkBall(spin = 0, vz = 0): Ball {
  return {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 10 },
    z: 1,
    vz,
    spin,
    resting: false,
    loose: false,
    contactCd: 0,
    receiverControlT: 0,
    event: null,
    inNet: false,
  };
}

// ── Swipe classification: dominant axis only, never a diagonal blend ──────
{
  check(curveDirFromSwipe(20, 3) === "right", "a mostly-horizontal rightward swipe reads as right");
  check(curveDirFromSwipe(-20, 3) === "left", "a mostly-horizontal leftward swipe reads as left");
  check(curveDirFromSwipe(3, 20) === "down", "a mostly-vertical downward swipe reads as down");
  check(curveDirFromSwipe(3, -20) === "up", "a mostly-vertical upward swipe reads as up");
  check(curveDirFromSwipe(10, 10) === "right", "a perfect diagonal ties toward the horizontal axis (>=), not a blend");
  check(curveDirFromSwipe(0, 0) === null, "a zero-length swipe classifies as nothing");
}

// ── One swipe nudges spin/vz by exactly one step, in the swiped direction ──
{
  const ball = mkBall(0.2, 3);
  const baseSpin = ball.spin, baseVz = ball.vz;
  const ok = applyCurveSwipe(ball, "right");
  check(ok === true, "a fresh right swipe is accepted");
  check(Math.abs(ball.spin - (baseSpin + CURVE_SPIN_STEP)) < 1e-9, "right swipe adds exactly one spin step");
  check(ball.vz === baseVz, "a horizontal swipe never touches vz");

  const ball2 = mkBall(0.2, 3);
  applyCurveSwipe(ball2, "left");
  check(Math.abs(ball2.spin - (0.2 - CURVE_SPIN_STEP)) < 1e-9, "left swipe subtracts one spin step");

  const ball3 = mkBall(0, 2);
  applyCurveSwipe(ball3, "up");
  check(Math.abs(ball3.vz - (2 + CURVE_VZ_STEP)) < 1e-9, "up swipe adds exactly one vz step");
  check(ball3.spin === 0, "a vertical swipe never touches spin");

  const ball4 = mkBall(0, 2);
  applyCurveSwipe(ball4, "down");
  check(Math.abs(ball4.vz - (2 - CURVE_VZ_STEP)) < 1e-9, "down swipe subtracts one vz step");
}

// ── Repeated same-direction swipes stack, up to the cap ─────────────────────
{
  const ball = mkBall(0, 0);
  let lastOk = true;
  for (let i = 0; i < 20; i++) lastOk = applyCurveSwipe(ball, "right");
  check(Math.abs(ball.curveSpinAdj ?? 0) <= CURVE_SPIN_MAX + 1e-9, "spin correction never exceeds the cap however many swipes are thrown at it");
  check(Math.abs((ball.curveSpinAdj ?? 0) - CURVE_SPIN_MAX) < 1e-9, "twenty swipes saturate exactly at the cap, not short of it");
  check(lastOk === false, "a swipe once already at the cap reports it changed nothing");

  const ball2 = mkBall(0, 0);
  for (let i = 0; i < 20; i++) applyCurveSwipe(ball2, "up");
  check(Math.abs((ball2.curveVzAdj ?? 0) - CURVE_VZ_MAX) < 1e-9, "vz correction saturates at its own cap the same way");
}

// ── Swiping the other way walks the correction back down, not just up ─────
{
  const ball = mkBall(0, 0);
  applyCurveSwipe(ball, "right");
  applyCurveSwipe(ball, "right");
  const afterTwo = ball.spin;
  applyCurveSwipe(ball, "left");
  check(ball.spin < afterTwo, "swiping the opposite way reduces the correction already applied");
  check(Math.abs(ball.spin - CURVE_SPIN_STEP) < 1e-9, "two right swipes and one left nets to exactly one step of curve");
}

// ── The cap bounds the SWIPE'S OWN contribution, not the ball's total spin —
// a strike that already left the boot heavily curled can still take the
// full swipe correction on top of it ─────────────────────────────────────
{
  const heavilyCurled = mkBall(1.85, 0); // roughly launch()'s own max
  for (let i = 0; i < 20; i++) applyCurveSwipe(heavilyCurled, "right");
  check(
    Math.abs(heavilyCurled.spin - (1.85 + CURVE_SPIN_MAX)) < 1e-9,
    "the swipe cap tracks its own contribution separately from however curly the strike already was",
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — curve-boot swipes classify by dominant axis, stack bidirectionally, and cap independently of the strike's own curl");
