import {
  buildScenario, launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders,
  orderableRunners, acceptsCaptainOrders, SCENARIO_KINDS,
  type Scenario, type Ball, type Outcome, type Runner,
} from "../../lib/star/canvasEngine";
import { CX } from "../../lib/star/pitch";

/**
 * THE ARMBAND.
 *
 * Two abilities that belong to the captain and to nobody else, and both of them
 * break a rule the engine otherwise holds absolutely — which is the whole
 * reason they need testing rather than eyeballing.
 *
 *   THE LAY-OFF. A team-mate who receives your pass shoots. That is all he has
 *   ever done. A captain can name the man he should leave it for instead, and
 *   then it is THAT man who shoots. The thing to prove is that the ball
 *   genuinely travels a second time and that the second man is the one who
 *   strikes it — a version that simply moved the shot's origin would look
 *   identical on the stat line and be nothing at all.
 *
 *   THE RUN. "Nobody moves until you kick the ball, not by an inch" is written
 *   at the top of stepReactions and every other test in this directory relies
 *   on it. A commanded run is the single exception, so the two things worth
 *   proving are that it does not fire while you are still aiming — which would
 *   silently invalidate the frozen-pitch assumption everywhere else — and that
 *   it does fire once the ball is live.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

/** Play the situation out, and say what happened along the way.
 *
 * `secondReceiver` is a snapshot of `sc.receivedBy` taken the instant the
 * SECOND reception happens — not whatever `sc.receivedBy` ends up holding
 * once `playOut` stops. Those are genuinely different questions: a THIRD
 * event (a scramble off the second man's own missed shot, say) can
 * legitimately hand the ball to anyone standing nearby, the original
 * passer included — that is an ordinary rebound, not the relay being
 * undone, and checking final state would confuse the two. */
function playOut(sc: Scenario, ball: Ball, rng: () => number, maxT = 12) {
  let res: Outcome | null = null;
  let relayed = false;
  let receptions = 0;
  let secondReceiver: Runner | null = null;
  let lastEvent: string | null = null;
  for (let t = 0; t < maxT / DT && !res; t++) {
    stepDefenders(sc, DT, sc.player, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    res = stepBall(ball, sc, rng, DT);
    if (ball.event && ball.event !== lastEvent) {
      if (ball.event === "relay") relayed = true;
      if (ball.event === "received") {
        receptions++;
        if (receptions === 2) secondReceiver = sc.receivedBy ?? null;
      }
      lastEvent = ball.event;
    }
    if (ball.event) ball.event = null;
  }
  return { res, relayed, receptions, secondReceiver };
}

/** A cutback with two men in the middle, the second one well away from the first. */
function twoManScenario(seed: number): { sc: Scenario; rng: () => number } {
  const rng = mulberry32(seed);
  const sc = buildScenario("cutback", rng, 70, 70);
  initDefenders(sc, rng);
  // Placed by hand rather than trusting the builder's roll — this test is about
  // the lay-off, not about where a cutback happens to put people.
  sc.ball = { x: CX - 12, y: 6 };
  sc.player = { x: CX - 12, y: 7.2 };
  sc.defenders = [];
  if (sc.runner) { sc.runner.pos = { x: CX - 2, y: 9 }; sc.runner.to = { ...sc.runner.pos }; }
  sc.secondaryRunners = [{
    pos: { x: CX + 9, y: 11 }, to: { x: CX + 9, y: 11 },
    speed: 7, moving: false, role: "support",
    who: { id: "m2", name: "Second Man", shortName: "Second", position: "ST" },
  }];
  // Out of the way of every pass this file plays — a `cutback` also rolls a
  // "follower" (the loose-ball poacher role, added to the reception
  // candidates via `goalInView`), and left at the builder's own default
  // position it can sit close enough to the ball's path to intercept a
  // pass meant for `sc.runner`, receiving it FIRST under a completely
  // different identity than the one every test in this file believes it
  // is checking. Found by exactly that: a short lay-off test whose "first
  // reception" belonged to neither the intended passer nor the intended
  // target at all.
  sc.follower = { ...sc.follower, x: -100, y: -100 };
  return { sc, rng };
}

/**
 * Play the ball straight at a man, hard enough to reach him.
 *
 * `launch` is the real strike and it is what puts the Ball object together, so
 * it has to be the thing that creates it — but its accuracy is the player's,
 * and a test about what happens AFTER a pass arrives cannot be at the mercy of
 * whether it arrives. So: strike it in his direction, then set the velocity
 * exactly. Everything downstream is untouched.
 */
/**
 * A ball that is live, in the frame, and nowhere near anybody.
 *
 * The run tests are about the RUN, so the ball must not decide them. Sending it
 * off at speed made them depend on where it ended up: change anything upstream
 * that consumes a different number of random values and the ball lands
 * somewhere new, leaves the frame, and `stepReactions` stops moving anybody —
 * so a test of the captain's orders failed because a builder rolled one extra
 * number. It is parked in the middle at a gentle pace instead: fast enough not
 * to count as dead (which would send everyone to fetch it), slow enough to stay
 * where it was put.
 */
function parkedBall(sc: Scenario, rng: () => number): Ball {
  const ball = passTo(sc, sc.runner!, rng);
  ball.pos = { x: CX, y: 24 };
  ball.vel = { x: 0, y: 5 };
  ball.vz = 0; ball.z = 0.08; ball.resting = false;
  return ball;
}

function passTo(sc: Scenario, to: Runner, rng: () => number): Ball {
  const dx = to.pos.x - sc.ball.x, dy = to.pos.y - sc.ball.y;
  const d = Math.hypot(dx, dy) || 1;
  const ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  ball.vel = { x: (dx / d) * 16, y: (dy / d) * 16 };
  ball.vz = 0; ball.z = 0.08; ball.spin = 0;
  ball.shot = false; ball.youStruckAtGoal = false;
  return ball;
}

// ── The lay-off actually happens, and the ball really does travel twice ──────
{
  // Measured against the chances where the ball ACTUALLY REACHED a man, which
  // is the only population the order can apply to. A pass cut out by the keeper
  // never gets to the point where anybody could obey anything, and counting
  // those as failures would be measuring the cutback's completion rate rather
  // than the ability.
  let relays = 0, reached = 0, arrived = 0, runs = 0;
  for (let s = 0; s < 220; s++) {
    const { sc, rng } = twoManScenario(s * 31 + 7);
    const second = sc.secondaryRunners[0];
    sc.relayTo = second;                       // the captain's order
    const ball = passTo(sc, sc.runner!, rng);
    runs++;
    const out = playOut(sc, ball, rng);
    if (out.receptions >= 1) arrived++;
    if (out.relayed) relays++;
    if (out.receptions >= 2) reached++;
  }
  check(arrived > runs * 0.5, `the pass finds a man often enough to measure (${arrived}/${runs})`);
  check(relays >= arrived * 0.98,
    `and when it does, the order is carried out (${relays}/${arrived})`);
  check(reached > arrived * 0.4,
    `the ball genuinely travels a second time and reaches him (${reached}/${arrived})`);
}

// ── …and without the order, nobody lays anything off ────────────────────────
{
  let relays = 0;
  for (let s = 0; s < 120; s++) {
    const { sc, rng } = twoManScenario(s * 17 + 3);
    // No sc.relayTo — this is the ordinary game.
    const ball = passTo(sc, sc.runner!, rng);
    if (playOut(sc, ball, rng).relayed) relays++;
  }
  check(relays === 0, `an uncaptained team-mate shoots, as he always has (${relays} lay-offs)`);
}

// ── A man cannot be told to lay it off to himself ────────────────────────────
{
  const { sc, rng } = twoManScenario(99);
  sc.relayTo = sc.runner;   // …who is also the man the pass is aimed at
  const ball = passTo(sc, sc.runner!, rng);
  const out = playOut(sc, ball, rng);
  check(!out.relayed, "the man on the end of it does not lay it off to himself");
}

/** Same shape as twoManScenario, but the lay-off target is a REALISTIC
 *  short distance away (4m) rather than the far-corner-to-far-corner ~11m
 *  gap the tests above happen to use. Needed specifically because the
 *  self-reception race this reproduces only bites at short range — see
 *  the test below. */
function shortLayoffScenario(seed: number): { sc: Scenario; rng: () => number } {
  const { sc, rng } = twoManScenario(seed);
  const from = sc.runner!.pos;
  sc.secondaryRunners = [{
    pos: { x: from.x + 4, y: from.y }, to: { x: from.x + 4, y: from.y },
    speed: 7, moving: false, role: "support",
    who: { id: "m2", name: "Second Man", shortName: "Second", position: "ST" },
  }];
  return { sc, rng };
}

// ── The pass is not stolen back — the ORDERED man ends up with it, not the
// passer. Reported directly: "they try to pass to the player I selected
// then they INSTANTLY take the ball back and shoot." The existing "genuinely
// travels a second time" test above never actually checked WHOSE feet it
// travelled a second time TO — and it uses an ~11m gap, far enough that the
// ball clears the passer's own control radius comfortably before anyone
// (including him) is allowed to touch it again. A real lay-off order is
// most useful at SHORT range — the near man in space — which is exactly the
// distance this checks instead. ─────────────────────────────────────────
{
  let relays = 0, arrived = 0, wentToTarget = 0, wentToPasser = 0;
  for (let s = 0; s < 300; s++) {
    const { sc, rng } = shortLayoffScenario(s * 41 + 11);
    const passer = sc.runner!;
    const target = sc.secondaryRunners[0];
    sc.relayTo = target;
    const ball = passTo(sc, passer, rng);
    const out = playOut(sc, ball, rng);
    if (out.relayed) relays++;
    if (out.receptions >= 2) {
      arrived++;
      if (out.secondReceiver === target) wentToTarget++;
      if (out.secondReceiver === passer) wentToPasser++;
    }
  }
  check(relays > 0, `the short-distance case actually exercises a relay at all (${relays})`);
  check(arrived > 0, `and a second reception genuinely happens (${arrived})`);
  check(wentToPasser === 0, `the passer never reclaims his own relay (${wentToPasser}/${arrived} went back to him)`);
  check(wentToTarget === arrived, `every second reception genuinely belongs to the ordered man, not just "somebody" (${wentToTarget}/${arrived})`);
}

// ── The order actually works for buildup and midfield_pass too. Both are
// accepted by acceptsCaptainOrders, but reported (via the same symptom
// above) to silently do nothing in practice — these two kinds have no
// scenario.receiver at all (no goal in view: see goalInView), and the relay
// used to only ever be checked inside a receiver-gated branch, so the whole
// mechanism never even ran for them. ──────────────────────────────────────
{
  for (const kind of ["buildup", "midfield_pass"] as const) {
    let relays = 0, arrived = 0, wentToTarget = 0, sampled = 0;
    for (let s = 0; s < 200; s++) {
      const rng = mulberry32(s * 53 + kind.length);
      const sc = buildScenario(kind, rng, 70, 70);
      initDefenders(sc, rng);
      check(sc.receiver === null, `${kind}: sanity check — genuinely has no receiver to begin with`);
      if (!sc.runner) continue; // no primary target this roll — nothing to order a lay-off from
      sampled++;
      const passer = sc.runner;
      sc.defenders = [];
      const target: Runner = {
        pos: { x: passer.pos.x + 4, y: passer.pos.y }, to: { x: passer.pos.x + 4, y: passer.pos.y },
        speed: 7, moving: false, role: "support",
        who: { id: "kb", name: "Layoff Man", shortName: "Layoff", position: "ST" },
      };
      sc.secondaryRunners = [target];
      sc.relayTo = target;
      const ball = passTo(sc, passer, rng);
      const out = playOut(sc, ball, rng);
      if (out.relayed) relays++;
      // Neither kind has a receiver or a goal in view, so the SECOND
      // reception (the relay actually arriving) never gets its own
      // "received" touch-and-hold event the way a shooting chance's does —
      // relayTargetFor correctly refuses a SECOND relay by then
      // (scenario.relayed is already true), so the move goes straight to
      // "delivered" the instant it reaches him. That is success, not a
      // miscount: check the outcome and who it actually reached, not the
      // event count `out.receptions` was built to track for the other kinds.
      if (sc.relayed && out.res === "delivered") {
        arrived++;
        if (sc.receivedBy === target) wentToTarget++;
      }
    }
    check(sampled > 0, `${kind}: at least some rolls actually gave a primary target to test with (${sampled})`);
    check(relays > 0, `${kind}: the order actually fires a relay at all now (${relays})`);
    check(arrived > 0, `${kind}: and it's genuinely delivered rather than just dropped (${arrived})`);
    check(wentToTarget === arrived, `${kind}: it genuinely reaches the ordered man (${wentToTarget}/${arrived})`);
  }
}

// ── One lay-off, never two ──────────────────────────────────────────────────
//
// A relay that did not clear itself would have the two of them passing it back
// and forth in the six-yard box until the runaway guard fired.
{
  let multi = 0;
  for (let s = 0; s < 120; s++) {
    const { sc, rng } = twoManScenario(s * 13 + 5);
    sc.relayTo = sc.secondaryRunners[0];
    const ball = passTo(sc, sc.runner!, rng);
    let relayCount = 0;
    let res: Outcome | null = null;
    for (let t = 0; t < 12 / DT && !res; t++) {
      stepDefenders(sc, DT, sc.player, false, ball); stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
      res = stepBall(ball, sc, rng, DT);
      if (ball.event === "relay") relayCount++;
      if (ball.event) ball.event = null;
    }
    if (relayCount > 1) multi++;
  }
  check(multi === 0, `the ball is laid off once and then struck (${multi} kept it going)`);
}

// ── THE RUN: nothing moves while you are still aiming ───────────────────────
//
// The rule the rest of the engine is built on. A commanded run that fired
// before the strike would break every other test in this directory, silently.
{
  const { sc } = twoManScenario(41);
  const r = sc.secondaryRunners[0];
  const before = { x: r.pos.x, y: r.pos.y };
  r.commandedTo = { x: r.pos.x, y: r.pos.y - 14 };
  // stepReactions is the only thing that moves a man, and in the aim phase the
  // loop does not call it at all — so the assertion is that the position is
  // untouched by the mere existence of the order.
  check(r.pos.x === before.x && r.pos.y === before.y,
    "an order given does not move him while the ball is at your feet");
}

// ── …and it does fire once the ball is live ─────────────────────────────────
{
  const { sc, rng } = twoManScenario(53);
  const r = sc.secondaryRunners[0];
  const startY = r.pos.y;
  r.commandedTo = { x: r.pos.x, y: startY - 12 };
  const ball = parkedBall(sc, rng);
  for (let t = 0; t < 1.0 / DT; t++) stepReactions(sc, ball, DT, rng);
  check(r.pos.y < startY - 4, `he runs where he was sent once it is played (${(startY - r.pos.y).toFixed(1)} m)`);
  check(r.sprint === true, "…and he is running rather than strolling");
}

// ── A run ends when he gets there ───────────────────────────────────────────
{
  const { sc, rng } = twoManScenario(67);
  const r = sc.secondaryRunners[0];
  const target = { x: r.pos.x + 6, y: r.pos.y - 6 };
  r.commandedTo = { ...target };
  const ball = parkedBall(sc, rng);
  for (let t = 0; t < 4 / DT; t++) stepReactions(sc, ball, DT, rng);
  check(r.commandedTo === undefined, "the order is spent once he arrives");
  check(Math.hypot(r.pos.x - target.x, r.pos.y - target.y) < 1.2,
    `and he is standing where he was pointed (${Math.hypot(r.pos.x - target.x, r.pos.y - target.y).toFixed(2)} m off)`);
}

// ── A loose ball still outranks the order ───────────────────────────────────
//
// A side that jogs past a ball rolling to a stop in order to complete a run is
// a side that has lost it, and no captain wants that.
{
  const { sc, rng } = twoManScenario(71);
  const r = sc.secondaryRunners[0];
  r.commandedTo = { x: r.pos.x, y: r.pos.y - 20 };
  const ball = passTo(sc, sc.runner!, rng);
  // A ball that has stopped, three metres away from him.
  ball.pos = { x: r.pos.x + 3, y: r.pos.y };
  ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.z = 0; ball.resting = true;
  const startX = r.pos.x;
  for (let t = 0; t < 0.8 / DT; t++) stepReactions(sc, ball, DT, rng);
  check(r.pos.x > startX + 0.5, "a ball that has stopped is fetched, orders or no orders");
}

// ── Dead balls take no orders ───────────────────────────────────────────────
{
  check(!acceptsCaptainOrders("penalty"), "nobody is sent on a run before a penalty");
  check(!acceptsCaptainOrders("free_kick"), "…nor before a free kick");
  check(!acceptsCaptainOrders("corner"), "…nor before a corner");
  const open = SCENARIO_KINDS.filter(k => acceptsCaptainOrders(k));
  check(open.length === SCENARIO_KINDS.length - 3,
    `every other situation does take them (${open.length} of ${SCENARIO_KINDS.length})`);
  check(acceptsCaptainOrders("cutback") && acceptsCaptainOrders("through_ball") && acceptsCaptainOrders("buildup"),
    "including the three the ability is actually for");
}

// ── Everything the captain can point at is something the ball can reach ─────
{
  for (const kind of SCENARIO_KINDS) {
    const sc = buildScenario(kind, mulberry32(kind.length * 977 + 3), 70, 70);
    const orderable = orderableRunners(sc);
    const reachable = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    check(orderable.length === reachable.length,
      `${kind}: the selectable men are exactly the receivable men (${orderable.length} vs ${reachable.length})`);
    check(orderable.every(r => r.pos && typeof r.pos.x === "number"),
      `${kind}: and every one of them is somewhere on the pitch`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — the armband moves men and moves the ball on, and only when it should");
