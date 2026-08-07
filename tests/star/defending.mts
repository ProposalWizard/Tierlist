import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, clearBall, SCENARIO_KINDS,
  type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";

/**
 * Nobody moves until you kick it.
 *
 * This file replaced one that asserted the opposite. The engine used to run a
 * whole Pressure Curve while you were still aiming: the nearest defender closed
 * you down, the others slid onto your passing lanes, and holding the ball too
 * long lost it. Team-mates drifted into space at the same time. Playing it, that
 * is simply not this game — you have unlimited time to decide, the only action
 * you take is the strike, and everything else is a consequence of it.
 *
 * So: the pitch is frozen until the ball is struck, and after that a player
 * reacts only when it comes inside his radius, slowly, both sides at the same
 * pace. Whoever gets there first has it, and a defender who gets there boots it
 * clear and the move is over.
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
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(0)}%`;

/** Everything the match loop steps once the ball is live. */
function playOut(sc: Scenario, ball: Ball, rng: () => number, watch?: () => void): Outcome | "none" {
  let out: Outcome | null = null;
  for (let i = 0; i < 900 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT);
    watch?.();
    out = stepBall(ball, sc, rng, DT);
  }
  return out ?? "none";
}

const snapshot = (sc: Scenario) => JSON.stringify({
  d: sc.defenders.map(d => [d.x, d.y]),
  r: [...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map(r => r.pos)].map(p => [p.x, p.y]),
  f: [sc.follower.x, sc.follower.y],
});

// ── The pitch is frozen while you aim ───────────────────────────────────────
//
// The single most important thing in this file. The match loop does not call
// anything that moves an outfield player during the aim phase, and none of the
// step functions move anybody without a ball either.
{
  for (const kind of ["one_on_one", "long_range", "cutback", "through_ball", "free_kick"] as const) {
    const rng = mulberry32(11);
    const sc = buildScenario(kind, rng, 62, 60);
    initDefenders(sc, rng);
    const before = snapshot(sc);

    // Ten seconds of deliberating. This is what the aim phase actually runs.
    for (let i = 0; i < 600; i++) {
      stepDefenders(sc, DT, sc.player, true, null);
      stepKeeper(sc, DT);
    }
    check(snapshot(sc) === before, `${kind}: not one outfield player moves while you think`);
  }

  // And there is no longer any way to lose the ball by taking too long.
  const rng = mulberry32(5);
  const sc = buildScenario("one_on_one", rng, 62, 60);
  initDefenders(sc, rng);
  let lost: Outcome | null = null;
  for (let i = 0; i < 3600; i++) lost = stepDefenders(sc, DT, sc.player, true, null) ?? lost;
  check(lost === null, "a full minute on the ball cannot be punished — the time is yours");
}

// ── The keeper stands on his line, and stands still ────────────────────────
//
// He used to sweep his line continuously, which made every shot a timing puzzle
// rather than a placement one, and several scenarios started him three or four
// metres out — from the camera that reads as a keeper standing on the penalty
// spot for no reason. Where he is standing IS the question now, so it has to be
// stable and it has to be somewhere a keeper stands.
{
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed * 23 + 7);
      const sc = buildScenario(kind, rng, 62, 60);
      check(sc.keeper.y <= 1.6 && sc.keeper.y >= 0.2,
        `${kind}: the keeper starts on his line (${sc.keeper.y.toFixed(1)} m off it)`);
      check(sc.keeper.x > 28 && sc.keeper.x < 40, `${kind}: and in his goal`);

      // Ten seconds of you deliberating, then a ball flying past him.
      const before = { x: sc.keeper.x, y: sc.keeper.y };
      for (let i = 0; i < 600; i++) stepKeeper(sc, DT);
      check(sc.keeper.x === before.x && sc.keeper.y === before.y,
        `${kind}: and he does not move an inch while you think`);
    }
  }

  // Not even with the ball in flight, right up until he touches it.
  const rng = mulberry32(4);
  const sc = buildScenario("long_range", rng, 62, 60);
  initDefenders(sc, rng);
  const ball = launch(sc, { x: sc.goal.x1 - sc.ball.x, y: -sc.ball.y }, 0.9, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
  const kx = sc.keeper.x;
  let moved = false, out: Outcome | null = null;
  for (let i = 0; i < 600 && !out; i++) {
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    if (sc.keeper.x !== kx) moved = true;
    out = stepBall(ball, sc, rng, DT);
  }
  check(!moved, "and he does not track the flight either — he never learns where it is going");
}

// ── After the kick, they react — but only when it comes near ───────────────
{
  const rng = mulberry32(3);
  const sc = buildScenario("midfield_pass", rng, 62, 60);
  initDefenders(sc, rng);
  sc.defenders = [{ x: 5, y: 5 }];   // miles away from everything
  const far = { ...sc.defenders[0] };

  const ball: Ball = {
    pos: { x: 40, y: 40 }, vel: { x: 0, y: -14 }, z: 0.1, vz: 0,
    spin: 0, resting: false, loose: false, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
  for (let i = 0; i < 60; i++) stepReactions(sc, ball, DT);
  check(sc.defenders[0].x === far.x && sc.defenders[0].y === far.y,
    "a defender nowhere near the ball does not move at all");

  // Put the ball on top of him and he reacts — slowly.
  const near: Scenario = { ...sc, defenders: [{ x: 41, y: 39 }] };
  const start = { ...near.defenders[0] };
  for (let i = 0; i < 60; i++) stepReactions(near, ball, DT);
  const moved = Math.hypot(near.defenders[0].x - start.x, near.defenders[0].y - start.y);
  check(moved > 0.2, `a defender the ball comes near does react (${moved.toFixed(2)} m in a second)`);
  check(moved < 4, `and it is a stretch and a step, not a sprint (${moved.toFixed(2)} m/s)`);
}

// ── Both sides move at exactly the same pace ───────────────────────────────
//
// Who wins a loose ball is a question of where it went, not of who is quicker.
{
  const rng = mulberry32(7);
  const sc = buildScenario("cutback", rng, 62, 60);
  initDefenders(sc, rng);
  const ball: Ball = {
    pos: { x: 34, y: 10 }, vel: { x: 0, y: 0 }, z: 0, vz: 0,
    spin: 0, resting: true, loose: true, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
  // One of each, the same distance away on opposite sides.
  sc.defenders = [{ x: 30, y: 10 }];
  sc.secondaryRunners = [{ pos: { x: 38, y: 10 }, to: { x: 38, y: 10 }, speed: 7, moving: false, role: "support" }];
  sc.runner = null;
  const d0 = { ...sc.defenders[0] }, a0 = { ...sc.secondaryRunners[0].pos };
  for (let i = 0; i < 30; i++) stepReactions(sc, ball, DT);
  const dMoved = Math.hypot(sc.defenders[0].x - d0.x, sc.defenders[0].y - d0.y);
  const aMoved = Math.hypot(sc.secondaryRunners[0].pos.x - a0.x, sc.secondaryRunners[0].pos.y - a0.y);
  check(Math.abs(dMoved - aMoved) < 1e-6, `neither side is quicker (${dMoved.toFixed(3)} vs ${aMoved.toFixed(3)} m)`);
}

// ── A ball that stops is always collected ──────────────────────────────────
//
// Otherwise it sits on the grass and the move never ends.
{
  const rng = mulberry32(9);
  const sc = buildScenario("long_range", rng, 62, 60);
  initDefenders(sc, rng);
  const ball: Ball = {
    pos: { x: 34, y: 30 }, vel: { x: 0, y: 0 }, z: 0, vz: 0,
    spin: 0, resting: true, loose: true, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
  // Everybody is well outside the reaction radius.
  sc.defenders = [{ x: 34, y: 55 }];
  const start = { ...sc.defenders[0] };
  for (let i = 0; i < 120; i++) stepReactions(sc, ball, DT);
  const closed = Math.hypot(sc.defenders[0].x - ball.pos.x, sc.defenders[0].y - ball.pos.y);
  check(closed < Math.hypot(start.x - ball.pos.x, start.y - ball.pos.y),
    "somebody walks to a stopped ball however far away it is");
}

// ── A defender who gets it clears it, and the move is over ─────────────────
{
  const rng = mulberry32(13);
  const sc = buildScenario("one_on_one", rng, 62, 60);
  initDefenders(sc, rng);
  const ball: Ball = {
    pos: { x: sc.defenders[0].x, y: sc.defenders[0].y + 0.4 }, vel: { x: 0, y: -6 },
    z: 0.1, vz: 0, spin: 0, resting: false, loose: false, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
  const out = stepBall(ball, sc, rng, DT);
  check(out === "tackled", `a defender on the ball takes it (${out})`);
  check(ball.vel.y > 0, "and boots it back down the pitch, away from his own goal");
  check(ball.owner === "opponent", "possession is theirs");

  // clearBall on its own does the same thing, whoever calls it.
  const b2: Ball = { ...ball, vel: { x: 0, y: -20 }, owner: "you" };
  clearBall(b2, mulberry32(2));
  check(b2.vel.y > 0 && b2.vz > 0, "a clearance goes up and away");
  check(b2.owner === "opponent", "and hands it over");
}

// ── A shot the defence is nowhere near still goes in ───────────────────────
//
// The block above must not have turned every scenario into a wall of legs.
{
  let goals = 0, tackled = 0;
  const N = 400;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 7 + 900);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "tight_angle", rng, 62, 60);
    initDefenders(sc, rng);
    const mid = (sc.goal.x1 + sc.goal.x2) / 2;
    const g = { x: sc.keeper.x < mid ? sc.goal.x2 - 0.8 : sc.goal.x1 + 0.8, y: 0 };
    const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.92, { cx: 0, cy: -0.2 }, { power: 72, technique: 72 }, rng);
    const out = playOut(sc, ball, rng);
    if (out === "goal") goals++;
    if (out === "tackled") tackled++;
  }
  check(goals > N * 0.15, `shots still go in (${pct(goals, N)})`);
  check(tackled < N * 0.4, `and the defence does not eat everything (${pct(tackled, N)} lost)`);
}

// ── A pass into a defender is lost; one away from him is not ───────────────
{
  let blockedLost = 0, openLost = 0;
  const N = 300;
  for (let seed = 0; seed < N; seed++) {
    for (const inLane of [true, false]) {
      const rng = mulberry32(seed * 29 + 5);
      const sc = buildScenario("midfield_pass", rng, 62, 60);
      const target = sc.runner!.to;
      const mid = { x: (sc.ball.x + target.x) / 2, y: (sc.ball.y + target.y) / 2 };
      sc.defenders = [inLane ? { x: mid.x, y: mid.y } : { x: mid.x, y: mid.y + 20 }];
      initDefenders(sc, rng);
      const ball = launch(sc, { x: target.x - sc.ball.x, y: target.y - sc.ball.y }, 0.42, { cx: 0, cy: 0.1 }, { power: 70, technique: 70 }, rng);
      const out = playOut(sc, ball, rng);
      if (out === "tackled") { if (inLane) blockedLost++; else openLost++; }
    }
  }
  check(blockedLost > openLost * 2,
    `a pass straight at a defender is lost far more often (${pct(blockedLost, N)} vs ${pct(openLost, N)})`);
  check(openLost < N * 0.2, `and a clear lane is a pass you complete (${pct(openLost, N)} lost)`);
}

// ── The move always ends ────────────────────────────────────────────────────
//
// The single risk this model runs. Nothing chases you, a ball that stops is not
// an outcome any more, and a defender who reaches it clears it — so if any of
// those three drop a case, the highlight hangs and the match cannot continue.
// Every scenario kind, every seed, struck every which way.
{
  let slowest = 0, hung = 0;
  const N = 1200;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 37 + 4);
    const kind = SCENARIO_KINDS[seed % SCENARIO_KINDS.length];
    const sc = buildScenario(kind, rng, 62, 60);
    initDefenders(sc, rng);
    // A deliberately awful spread of strikes: hammered, dinked, sideways, and
    // barely touched at all.
    const dir = { x: (rng() - 0.5) * 2, y: -1 + (rng() - 0.5) * 1.6 };
    const power = 0.06 + rng() * 0.94;
    const ball = launch(sc, dir, power, { cx: (rng() - 0.5) * 2, cy: (rng() - 0.5) * 2 },
      { power: 20 + rng() * 80, technique: 20 + rng() * 80 }, rng);

    let out: Outcome | null = null, i = 0;
    for (; i < 3000 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    if (!out) hung += 1; else slowest = Math.max(slowest, i);
  }
  check(hung === 0, `${hung}/${N} scenarios never resolved — the match would hang there`);
  check(slowest < 1500, `and the longest took ${(slowest / 60).toFixed(1)}s, which is a highlight, not a wait`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the pitch is frozen until you kick it, and reactions are slow and local");
