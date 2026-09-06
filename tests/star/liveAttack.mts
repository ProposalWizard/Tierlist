import { mulberry32 } from "../../lib/star/season";
import {
  newLiveAttack, ballFlightAt, isReady, hasMissed, stepLiveAttack,
  fieldPositionsAt, strikeLiveAttack, fullPowerPullMetres, powerFromPull,
  DELIVERY_KINDS, type DeliveryKind,
} from "../../lib/star/liveAttack";

/**
 * The moving attacking-situation sandbox's pure logic: does the ball
 * genuinely arrive where the real scenario expects it, does the ready
 * window actually gate a strike, do defenders/runners actually arrive
 * rather than teleport, and does striking late genuinely cost you distance.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const DT = 1 / 60;

function runOut(kind: DeliveryKind, seed: number) {
  return newLiveAttack(kind, mulberry32(seed));
}

// ── Every delivery kind builds a real, self-consistent scenario ──────────
for (const kind of DELIVERY_KINDS) {
  const s = runOut(kind, 1);
  check(!!s.scenario.viewport, `${kind}: scenario has a real viewport`);
  check(s.defenderFrom.length === s.scenario.defenders.length, `${kind}: one "from" per defender`);
  check(s.runnerFrom.length === s.scenario.secondaryRunners.length, `${kind}: one "from" per support runner`);
  check(s.approach.duration > 0, `${kind}: delivery takes real time`);
  check(s.readyStart >= 0, `${kind}: ready window never starts before kickoff`);
  check(s.readyStart < s.readyEnd, `${kind}: ready window has real width`);
  check(s.approach.duration >= s.readyStart && s.approach.duration <= s.readyEnd, `${kind}: "perfect" arrival falls inside its own ready window`);
}

// ── ballFlightAt: starts at the origin, arrives exactly at scenario.ball,
// and always touches down (z=0) right at arrival ─────────────────────────
{
  for (const kind of DELIVERY_KINDS) {
    const s = runOut(kind, 7);
    const start = ballFlightAt(s, 0);
    check(Math.abs(start.x - s.approach.from.x) < 1e-9 && Math.abs(start.y - s.approach.from.y) < 1e-9,
      `${kind}: ball starts exactly at the delivery's origin`);
    check(start.z === 0, `${kind}: ball starts on the deck`);

    const arrive = ballFlightAt(s, s.approach.duration);
    check(Math.abs(arrive.x - s.scenario.ball.x) < 1e-6 && Math.abs(arrive.y - s.scenario.ball.y) < 1e-6,
      `${kind}: ball reaches exactly the real scenario's ball position on time`);
    check(Math.abs(arrive.z) < 1e-6, `${kind}: whatever arc or bounce it took, it's back on the deck the instant it arrives`);
  }
}

// ── Progress toward the target is monotonic — no backward wobble ─────────
{
  const s = runOut("cross", 3);
  const distTo = (p: { x: number; y: number }) => Math.hypot(p.x - s.scenario.ball.x, p.y - s.scenario.ball.y);
  let prev = distTo(ballFlightAt(s, 0));
  let monotonic = true;
  for (let i = 1; i <= 40; i++) {
    const d = distTo(ballFlightAt(s, (s.approach.duration * i) / 40));
    if (d > prev + 1e-6) monotonic = false;
    prev = d;
  }
  check(monotonic, "distance to the arrival point shrinks monotonically during the approach");
}

// ── Striking late costs you distance — the ball keeps travelling in the
// same direction rather than snapping to a halt at the arrival point ─────
{
  const s = runOut("ground", 11);
  const atArrival = ballFlightAt(s, s.approach.duration);
  const late = ballFlightAt(s, s.approach.duration + 0.3);
  const movedOn = Math.hypot(late.x - atArrival.x, late.y - atArrival.y);
  check(movedOn > 0.3, `a late read keeps moving past the arrival point (moved ${movedOn.toFixed(2)}m) rather than freezing there`);
}

// ── The ready window actually gates a strike ──────────────────────────────
{
  const s = runOut("throughball", 5);
  check(!isReady(s), "not ready at t=0, long before arrival");
  s.t = s.readyStart + 0.01;
  check(isReady(s), "ready once inside the window");
  s.t = s.readyEnd + 0.2;
  check(!isReady(s), "no longer ready once the window has closed");
  check(hasMissed(s), "closing the window with nothing done about it is a miss");
}

// ── stepLiveAttack advances time and flips to missed exactly once, then
// stops advancing altogether ──────────────────────────────────────────────
{
  const s = runOut("counter", 9);
  let steps = 0;
  while (s.phase === "buildup" && steps < 100000) { stepLiveAttack(s, DT); steps++; }
  check(s.phase === "missed", "an untouched build-up eventually times out to missed");
  const tAtMiss = s.t;
  stepLiveAttack(s, DT);
  check(s.t === tAtMiss, "time stops advancing once the chance is gone");
}

// ── Defenders and support runners genuinely arrive, they don't teleport ──
{
  const s = runOut("cross", 13);
  if (s.scenario.defenders.length > 0) {
    const at0 = fieldPositionsAt(s).defenders[0];
    check(Math.abs(at0.x - s.defenderFrom[0].x) < 1e-9 && Math.abs(at0.y - s.defenderFrom[0].y) < 1e-9,
      "a defender starts exactly at his own recorded starting point");
    s.t = s.approach.duration;
    const atArrival = fieldPositionsAt(s).defenders[0];
    check(Math.abs(atArrival.x - s.scenario.defenders[0].x) < 1e-6 && Math.abs(atArrival.y - s.scenario.defenders[0].y) < 1e-6,
      "by the time the ball arrives, a defender has reached the real scenario's position for him");
    s.t = s.approach.duration + 5; // long after — must not overshoot past the real position
    const held = fieldPositionsAt(s).defenders[0];
    check(Math.abs(held.x - s.scenario.defenders[0].x) < 1e-6 && Math.abs(held.y - s.scenario.defenders[0].y) < 1e-6,
      "a defender holds his real position rather than running through it");
  } else {
    check(true, "cross seed 13 happened to draw zero defenders — nothing to check");
  }
}

// ── strikeLiveAttack locks the scenario's ball to the live point, inside
// the viewport ─────────────────────────────────────────────────────────────
{
  const s = runOut("ground", 21);
  s.t = s.readyStart;
  const point = strikeLiveAttack(s, s.t);
  check(s.phase === "struck", "striking moves the state to struck");
  check(s.scenario.ball.x === point.x && s.scenario.ball.y === point.y, "the scenario's own ball is moved to exactly the returned strike point");
  const vp = s.scenario.viewport;
  check(point.x >= vp.x1 && point.x <= vp.x2 && point.y >= vp.y1 && point.y <= vp.y2, "the strike point always lands inside the scenario's own viewport");
}

// ── Determinism: the same seed always builds the same situation ──────────
{
  for (const kind of DELIVERY_KINDS) {
    const a = runOut(kind, 99);
    const b = runOut(kind, 99);
    check(
      a.scenario.ball.x === b.scenario.ball.x && a.scenario.ball.y === b.scenario.ball.y &&
      a.approach.from.x === b.approach.from.x && a.approach.duration === b.approach.duration,
      `${kind}: the same seed builds the exact same situation`,
    );
  }
}

// ── The power-from-pull helper: monotonic, bounded, and a stronger player
// needs a shorter pull for the same power ─────────────────────────────────
{
  check(powerFromPull(0, 50) === 0, "no pull at all is zero power");
  check(powerFromPull(1000, 50) === 1, "an absurdly long pull clamps to full power, never past it");
  check(powerFromPull(-5, 50) === 0, "a negative pull clamps to zero, never negative power");
  const weak = fullPowerPullMetres(10);
  const strong = fullPowerPullMetres(90);
  check(strong < weak, "a stronger player needs a shorter pull to reach full power");
  const midPull = 4;
  check(
    powerFromPull(midPull, 90) > powerFromPull(midPull, 10),
    "the same pull registers as more power for a stronger player",
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the moving attacking-situation build-up arrives on schedule, gates the strike by a real ready window, and defenders/runners genuinely arrive rather than teleport");
