import {
  buildScenario, dragForFullPower, SCENARIO_KINDS, VIEW_ASPECT, type Scenario,
} from "../../lib/star/canvasEngine";

/**
 * The gesture has to be one a thumb can make.
 *
 * Power comes from how far you pull back from the ball, and the room a straight
 * pull has is the room BELOW the ball on the screen. `fitToView` keeps the ball
 * out of the bottom fifth of the frame, so that room is at worst exactly 20% of
 * the screen — and full power used to ask for 34% of it. The gesture had to
 * leave the canvas and finish somewhere down the page, which on a phone is the
 * edge of the device, the navigation bar or the back-swipe gutter.
 *
 * Measured before the fix: 24% of chances could not be pulled to full power
 * without leaving the canvas, and for a shot from distance, a through-ball or a
 * build-up it was none of them. Reported as "it's hard to actually pull the
 * power arrow back to anywhere near 100% on mobile".
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a point sits on the SCREEN, 0..1 — the inverse of pitchFromPointer. */
function toScreen(sc: Scenario, p: { x: number; y: number }) {
  const vp = sc.viewport;
  const fx = (p.x - vp.x1) / (vp.x2 - vp.x1), fy = (p.y - vp.y1) / (vp.y2 - vp.y1);
  if (sc.facing === "right") return { sx: 1 - fy, sy: fx };
  if (sc.facing === "left") return { sx: fy, sy: 1 - fx };
  return { sx: fx, sy: fy };
}

// ── Full power is reachable without leaving the pitch ────────────────────────
{
  // The weakest player needs the longest pull, so he is the case that has to fit.
  for (const power of [0, 30, 55, 100]) {
    const need = dragForFullPower(power);
    let short = 0, total = 0, tightest = 1, tightestKind = "";
    for (const kind of SCENARIO_KINDS) {
      const rng = mulberry32(kind.length * 17 + 5);
      for (let i = 0; i < 800; i++) {
        const sc = buildScenario(kind, rng, 62, 60, 55);
        const room = 1 - toScreen(sc, sc.ball).sy;
        if (room < tightest) { tightest = room; tightestKind = kind; }
        if (room < need) short += 1;
        total += 1;
      }
    }
    check(short === 0,
      `power ${power}: full power is reachable on screen (${pct(short, total)} were not; `
      + `tightest frame ${tightestKind} at ${(tightest * 100).toFixed(1)}%, pull needs ${(need * 100).toFixed(1)}%)`);
  }
}

// ── …and it is the same gesture whichever way the frame is turned ────────────
//
// A crossing situation is watched from the side, so the screen's vertical axis
// is pitch X. Measuring the pull in metres of pitch meant the same physical drag
// bought 1.6× fewer of them there — full power in a byline cross wanted a pull
// 60% of the screen long. Measuring it on the glass is what makes one constant
// mean one thing.
{
  const pull = (sc: Scenario, drag: { x: number; y: number }) => {
    const a = toScreen(sc, drag), b = toScreen(sc, sc.ball);
    return Math.hypot((a.sx - b.sx) * VIEW_ASPECT, a.sy - b.sy);
  };
  // The same drag — a tenth of the canvas height, straight down the screen —
  // must be worth the same power in a turned frame as in an ordinary one.
  const straight = (sc: Scenario) => {
    const vp = sc.viewport, W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
    // Down the SCREEN by 0.10 of its height, expressed back in pitch terms.
    if (sc.facing === "right") return { x: sc.ball.x + 0.10 * W, y: sc.ball.y };
    if (sc.facing === "left") return { x: sc.ball.x - 0.10 * W, y: sc.ball.y };
    return { x: sc.ball.x, y: sc.ball.y + 0.10 * H };
  };
  const rng = mulberry32(404);
  for (const kind of ["long_range", "byline_cross", "corner", "cutback"] as const) {
    const sc = buildScenario(kind, rng, 62, 60, 55);
    const p = pull(sc, straight(sc));
    check(Math.abs(p - 0.10) < 0.005,
      `${kind}: a tenth of the screen is a tenth of the pull (${(p * 100).toFixed(1)}%)`);
  }
}

// ── The pull is still long enough to choose a power with ─────────────────────
//
// The cost of shortening it, and the line past which it would be too twitchy to
// aim: the range must not collapse to a flick.
{
  for (const power of [0, 55, 100]) {
    const full = dragForFullPower(power);
    check(full >= 0.11, `power ${power}: full power is still a deliberate pull (${(full * 100).toFixed(1)}% of the screen)`);
    check(full <= 0.20, `power ${power}: …and still fits inside the frame (${(full * 100).toFixed(1)}%)`);
  }
  check(dragForFullPower(0) > dragForFullPower(100), "a stronger player reaches everything he has with less pull");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — full power is reachable with a thumb, in every situation and every camera");
