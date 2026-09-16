import {
  OUTCOME_TEXT, stepTouchChase, buildScenario, initDefenders,
  type Ball, type Scenario,
} from "../../lib/star/canvasEngine";
import { creditChance, NO_CREDIT } from "../../lib/star/credit";

/**
 * TOUCH MODE'S OWN PURE HALF.
 *
 * Boot.extraTouch — requested directly: "these boots give the player an
 * extra touch... u do a normal aim and kick... HOWEVER with this touch
 * mode on ur player chases the ball and if he gets to it then the game
 * stops again and he has another aim and kick thing again."
 *
 * The gating (the toggle, the boots, ball.owner, acceptsCaptainOrders) is
 * CanvasMatch.tsx-level React code this suite can't reach, same limitation
 * every other pointer/gesture fix in this codebase has always had. But the
 * chase itself — stepTouchChase — is a real, pure, exported engine function
 * now, reported back live after the first version shipped without one:
 * "my player just doesnt chase the touch at all... he never moves at all.
 * I need him to like run to it as soon as he kicks it." That first version
 * only ever remapped stepBall's own invisible dead-ball timeout, which is
 * why nothing moved — this one actually moves scenario.player, and both
 * that movement and the arming logic that stops it firing on the kick's own
 * first tick are worth a real, measured check, not an assumption.
 *
 * creditChance's own "touchOn" branch gets the same treatment as before: a
 * genuinely uncontested touch of your own that repositions the same attempt
 * is not a new shot or a new pass, and credit.ts's own doc records two real
 * historical bugs from exactly this class of mistake (a team-mate's goal
 * filed as yours; a scoreline with nobody credited).
 */

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

function ballAt(x: number, y: number): Ball {
  return {
    pos: { x, y }, vel: { x: 0, y: 0 }, z: 0, vz: 0,
    spin: 0, resting: true, loose: false, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
}

function scenarioAt(seed: number, x: number, y: number): Scenario {
  const rng = mulberry32(seed);
  const sc = buildScenario("cutback", rng, 70, 70);
  initDefenders(sc, rng);
  sc.player = { x, y };
  return sc;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── touchOn is declared neutral, never a goal ────────────────────────────
{
  check(OUTCOME_TEXT.touchOn.kind === "neutral", `touchOn is a neutral outcome, never "goal" (${OUTCOME_TEXT.touchOn.kind})`);
}

// ── touchOn never credits a shot, a pass, or a chance — whatever the
// surrounding context claims. Fuzzed across every ctx combination, since
// the whole point of checking it first in creditChance is that NOTHING
// downstream (youShot, receiverShot, isSimplePass) can override it. ──────
{
  let wrong = 0;
  for (const youShot of [true, false]) {
    for (const receiverShot of [true, false]) {
      for (const isSimplePass of [true, false]) {
        const d = creditChance("touchOn", { youShot, receiverShot, isSimplePass });
        if (JSON.stringify(d) !== JSON.stringify(NO_CREDIT)) wrong++;
      }
    }
  }
  check(wrong === 0, `touchOn credits nothing at all, under any context (${wrong}/8 combinations got something)`);
}

// ── …and, for real contrast, an ordinary shot right next to it still
// credits normally — touchOn's early return isn't accidentally swallowing
// every outcome, just its own. ───────────────────────────────────────────
{
  const goalShot = creditChance("goal", { youShot: true, receiverShot: false, isSimplePass: false });
  check(goalShot.shots === 1 && goalShot.goals === 1, `a real goal you struck still credits shots+goals normally (${JSON.stringify(goalShot)})`);
}

// ── stepTouchChase never fires on the kick's own first tick ─────────────
//
// Player and ball still coincide the instant he strikes it — the exact
// case the old remap never had to worry about (it wasn't watching
// distance at all) and this one has to get right on its own.
{
  const sc = scenarioAt(1, 40, 40);
  const ball = ballAt(40, 40);
  const caught = stepTouchChase(sc, ball, DT);
  check(caught === false, `standing exactly on the ball he just struck is not a catch (armed=${sc.touchChaseArmed})`);
  check(sc.touchChaseArmed !== true, `not armed either — the ball never got away from him (dist stayed 0)`);
}

// ── The player genuinely moves — the whole reported bug ──────────────────
//
// "my player just doesnt chase the touch at all... he never moves at all."
// Ball placed 10m away (a settled touch), ticked once: he must have taken a
// real step toward it, not stayed exactly where he started.
{
  const sc = scenarioAt(2, 30, 30);
  const ball = ballAt(30, 40); // 10m away, straight up the pitch
  const before = { x: sc.player.x, y: sc.player.y };
  stepTouchChase(sc, ball, DT);
  const moved = Math.hypot(sc.player.x - before.x, sc.player.y - before.y);
  check(moved > 0.05, `a single tick moves him a real distance toward the ball (${moved.toFixed(4)} m)`);
  check(sc.player.y > before.y && Math.abs(sc.player.x - before.x) < 1e-6,
    `and specifically toward it, straight up the pitch here (x=${sc.player.x.toFixed(3)}, y=${sc.player.y.toFixed(3)})`);
}

// ── Arms once genuinely separated, then reports caught once he closes the
// gap back down — proven by actually ticking it out, not just trusting the
// arithmetic. ──────────────────────────────────────────────────────────────
{
  const sc = scenarioAt(3, 20, 20);
  const ball = ballAt(20, 30); // 10m away — well past the arm threshold
  let caught = false;
  let ticks = 0;
  const maxTicks = Math.ceil(5 / DT); // 5 real seconds, a generous ceiling
  for (; ticks < maxTicks && !caught; ticks++) {
    caught = stepTouchChase(sc, ball, DT);
  }
  check(sc.touchChaseArmed === true, "a 10m gap genuinely arms the chase");
  check(caught, `he genuinely catches up within 5 simulated seconds (never did, after ${ticks} ticks)`);
  const finalDist = Math.hypot(sc.player.x - ball.pos.x, sc.player.y - ball.pos.y);
  check(finalDist <= 1.2, `and he is standing right next to the ball when he does (${finalDist.toFixed(3)} m away)`);
  // 10m at 7.6 m/s is ~1.32s — well under a second either side is still a
  // sane, responsive catch, not a multi-second wait like the old timeout.
  const elapsed = ticks * DT;
  check(elapsed < 2.5, `and it happens quickly — a real chase, not the old multi-second dead-ball wait (${elapsed.toFixed(2)}s)`);
}

// ── A touch too soft to ever clear the arm threshold never fires — a
// deliberate, bounded limitation, not an open question. Ticked for a
// genuinely long time to prove it is not just "hasn't happened yet". ─────
{
  const sc = scenarioAt(4, 50, 50);
  const ball = ballAt(50.5, 50); // 0.5m away — never leaves his own control radius
  let caught = false;
  for (let i = 0; i < Math.ceil(8 / DT) && !caught; i++) {
    caught = stepTouchChase(sc, ball, DT);
  }
  check(!caught, "a touch that never gets away from him never arms, and so never falsely fires as a catch");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the player genuinely chases the ball, arms and catches correctly, and touchOn is neutral and never credited as a shot or pass");
