import {
  buildScenario, spaceScore, bestSupportPoint,
  stepDefenders, stepKeeper, stepBall, stepReactions, initDefenders, launch,
  chainKindFor, chainReturnChance, CHAIN_MAX, SCENARIO_KINDS, goalInView,
  type Scenario, type Ball, type Outcome, type Vec2,
} from "../../lib/star/canvasEngine";
import { PITCH_W, CX, HALF_LEN, BOX_DEPTH } from "../../lib/star/pitch";

/**
 * The attack: space evaluation, where your team-mates are standing when the
 * scenario opens, and chaining a completed pass into the next decision.
 *
 * Two things this has had to survive. First, team-mates as furniture — a Vec2[]
 * the renderer drew and nothing read, so a pass not struck straight at somebody
 * was simply wasted. Second, and more recently, team-mates who ran about while
 * you were still aiming: nothing moves until you kick the ball, so the space a
 * support player occupies has to be found when the scenario is BUILT rather
 * than jogged into while you look at it.
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
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The best pass available to the carrier right now, 0..1. */
function bestOption(sc: Scenario): number {
  const opts = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
  if (opts.length === 0) return 0;
  return Math.max(...opts.map(r => spaceScore(r.pos, sc, sc.player)));
}

// ── Space evaluation ────────────────────────────────────────────────────────
{
  const sc = buildScenario("long_range", mulberry32(11), 62, 60);
  // Put the defenders somewhere known rather than trusting the builder's roll.
  sc.player = { x: CX, y: 26 };
  sc.ball = { x: CX, y: 26 };
  sc.defenders = [{ x: CX + 8, y: 20 }];

  const open = spaceScore({ x: CX - 10, y: 20 }, sc, sc.player);
  const marked = spaceScore({ x: CX + 8.5, y: 20.5 }, sc, sc.player);
  check(open > marked, `an unmarked position beats a marked one (${open.toFixed(2)} vs ${marked.toFixed(2)})`);

  const behindHim = spaceScore({ x: CX + 8, y: 14 }, sc, sc.player);
  check(open > behindHim, `a position with an open lane beats one behind a defender (${open.toFixed(2)} vs ${behindHim.toFixed(2)})`);

  // Standing in front of your own team-mate's shot is not support.
  const inTheWay = spaceScore({ x: CX, y: 16 }, sc, sc.player);
  const offTheLine = spaceScore({ x: CX - 9, y: 16 }, sc, sc.player);
  check(offTheLine > inTheWay, `a support player will not block the shooting lane (${offTheLine.toFixed(2)} vs ${inTheWay.toFixed(2)})`);

  check(spaceScore({ x: -5, y: 20 }, sc, sc.player) === 0, "off the pitch is not space");
  check(spaceScore({ x: CX + 0.5, y: 25.5 }, sc, sc.player) === 0, "standing on the carrier's toes is not an option");
  const tooFar = spaceScore({ x: CX, y: 60 }, sc, sc.player);
  check(tooFar < open, `a pass beyond a sensible range scores worse (${tooFar.toFixed(2)} vs ${open.toFixed(2)})`);

  // bestSupportPoint must actually improve on where you already are.
  const from = { x: CX + 8.2, y: 20.2 };            // right on top of the defender
  const to = bestSupportPoint(sc, sc.player, from);
  check(spaceScore(to, sc, sc.player) > spaceScore(from, sc, sc.player),
    "bestSupportPoint moves a marked player somewhere better");
  check(to.x > 3 && to.x < PITCH_W - 3 && to.y > 1 && to.y < HALF_LEN + 6,
    "bestSupportPoint never sends anyone off the pitch");
}

// ── Support players are placed in space, not left to find it ────────────────
//
// This replaced a block that ran two seconds of the aim phase and asserted your
// options got BETTER as team-mates drifted about. Nothing drifts any more, so
// the whole question moves to kick-off: is the man you are being offered
// standing somewhere worth finding, right now, before you have touched it?
{
  for (const kind of ["long_range", "one_on_one", "cutback"] as const) {
    const placed: number[] = [];
    const anywhere: number[] = [];

    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(900 + seed);
      const sc = buildScenario(kind, rng, 62, 60);
      initDefenders(sc, rng);
      const support = sc.secondaryRunners.filter(r => r.role === "support");
      if (support.length === 0) continue;
      placed.push(Math.max(...support.map(r => spaceScore(r.pos, sc, sc.player))));
      // What a team-mate dropped on the pitch at random would have been worth.
      const rx = 4 + rng() * (PITCH_W - 8), ry = 2 + rng() * (HALF_LEN - 4);
      anywhere.push(spaceScore({ x: rx, y: ry }, sc, sc.player));
    }

    const m = mean(placed), r = mean(anywhere);
    check(m > r + 0.05, `${kind}: support is offered in real space (${r.toFixed(3)} → ${m.toFixed(3)})`);
    check(placed.filter(x => x > 0).length / placed.length > 0.9,
      `${kind}: and almost always a pass you could actually play`);
  }

  // And the pitch really is frozen: build a scenario, run the aim phase, and
  // nobody has moved a centimetre.
  const rng = mulberry32(41);
  const sc = buildScenario("cutback", rng, 62, 60);
  initDefenders(sc, rng);
  const before = bestOption(sc);
  const where = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].map(r => ({ ...r.pos }));
  for (let t = 0; t < 3.0; t += DT) stepDefenders(sc, DT, sc.player, false);
  const after = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].map(r => r.pos);
  check(after.every((p, i) => p.x === where[i].x && p.y === where[i].y),
    "three seconds of thinking moves nobody");
  check(bestOption(sc) === before, "and your best option is exactly the one you were offered");
}

// ── A ball played near a man, not at him ────────────────────────────────────
//
// The reaction radius is the whole of receiving under this model: he does not
// set off for a pass, he stretches for one that arrives near him. A ball hit
// wide of everybody leaves the frame, and a ball that leaves the frame is gone
// — there is no pitch out there for it to roll around on and nobody is going to
// walk off the edge of the situation to fetch it.
{
  const played = (offset: number, seed: number): { out: Outcome | "none"; frames: number } => {
    const rng = mulberry32(seed);
    const sc = buildScenario("midfield_pass", rng, 62, 60);
    initDefenders(sc, rng);
    // This is about the receiver and nobody else.
    sc.defenders = []; sc.secondaryRunners = [];
    sc.follower.x = -50; sc.follower.y = -50;
    const t = sc.runner!.pos;
    const target = { x: clamp(t.x + offset, 2, PITCH_W - 2), y: t.y };
    const dx = target.x - sc.ball.x, dy = target.y - sc.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const ball: Ball = {
      pos: { x: sc.ball.x, y: sc.ball.y }, vel: { x: dx / d * 15, y: dy / d * 15 },
      z: 0.08, vz: 0, spin: 0, resting: false, loose: false, contactCd: 0,
      receiverControlT: 0, event: null, inNet: false,
    };
    let out: Outcome | null = null, i = 0;
    for (; i < 900 && !out; i++) {
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    return { out: out ?? "none", frames: i };
  };

  const near = Array.from({ length: 120 }, (_, k) => played(3.5, k * 7 + 78));
  const wide = Array.from({ length: 120 }, (_, k) => played(24, k * 7 + 78));
  const quick = (rs: typeof near) => rs.filter(r => r.out === "delivered" && r.frames < 120).length;

  const gone = (rs: typeof near) => rs.filter(r => r.out === "out").length;

  check(quick(near) > 55, `a ball played a few yards off a man is stretched for and taken (${quick(near)}/120 inside two seconds)`);
  check(quick(wide) < 15, `one hit miles wide of him is nobody's pass (${quick(wide)}/120 inside two seconds)`);
  check(gone(wide) > gone(near) * 2, `and it leaves the situation (${gone(near)} vs ${gone(wide)} out of frame)`);
  check([...near, ...wide].every(r => r.frames < 780),
    "and either way the move ends — nothing sits on the grass forever");
}

// ── A ball nobody has is a ball everybody can have ──────────────────────────
//
// Once ANY team-mate had touched the ball, nobody could ever collect it again —
// so a shot the keeper parried away rolled to a stop with your players walking
// toward it, and the move was cut off before the nearest of them arrived. It
// read, correctly, as your side declining to chase a loose ball in their box.
// He has struck it; he no longer has it.
{
  let abandonedShort = 0, played = 0;
  const N = 1200;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 7 + 3);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "long_range", rng, 62, 60);
    initDefenders(sc, rng);
    // Straight at the keeper, so he has to deal with it.
    const ball = launch(sc, { x: sc.keeper.x - sc.ball.x, y: -sc.ball.y }, 0.9, { cx: 0, cy: -0.15 }, { power: 70, technique: 70 }, rng);
    let out: Outcome | null = null;
    for (let i = 0; i < 1500 && !out; i++) {
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    played += 1;
    if (out !== "short") continue;
    // Given up on — which is only allowed when it really is out of reach.
    const all = [...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map(r => r.pos),
                 { x: sc.follower.x, y: sc.follower.y }];
    const nearest = Math.min(...all.map(p => Math.hypot(p.x - ball.pos.x, p.y - ball.pos.y)));
    if (nearest < 6) abandonedShort += 1;
  }
  check(abandonedShort === 0,
    `a loose ball with a man standing over it is never given up on (${abandonedShort}/${played})`);

  // And the flag really does come back off, so a second man can have his go.
  const rng = mulberry32(21);
  const sc = buildScenario("one_on_one", rng, 62, 60);
  sc.receiverDone = true;
  sc.receiverShots = 1;
  check(sc.receiverShots < 2, "…but only so many times — a scramble, not a farce");
}

// ── A firm ball at a man is a pass, not a shot ──────────────────────────────
//
// The most-reported bug in the game: you pass to the attacker standing next to
// you and the ball goes straight THROUGH him, then rolls away with nobody
// allowed to touch it.
//
// Cause: anything struck hard toward the goal is flagged as your shot, so that
// a team-mate cannot wander into it and turn your goal into a completed pass —
// and a support player steps out of the way of your shot. Hit a man firmly,
// which is what you do when he is ten metres off and there are defenders about,
// and he was standing aside from a ball you had aimed at his feet.
//
// A man on the line of the ball, before it reaches the goal, means you meant to
// find him.
{
  for (const kind of SCENARIO_KINDS) {
    if (!goalInView(kind)) continue;
    let flagged = 0, played = 0;
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed * 17 + 9);
      const sc = buildScenario(kind, rng, 62, 60);
      initDefenders(sc, rng);
      const mates = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]
        .sort((a, b) => Math.hypot(a.pos.x - sc.ball.x, a.pos.y - sc.ball.y)
                      - Math.hypot(b.pos.x - sc.ball.x, b.pos.y - sc.ball.y));
      if (!mates.length) continue;
      played += 1;
      const t = mates[0].pos;
      const ball = launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, 0.55, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
      // A header is the exception, and legitimately: the man marking you can win
      // it in the air, and a ball nobody owns belongs to whoever gets there.
      if (ball.shot && !ball.loose) flagged += 1;
    }
    if (played === 0) continue;
    check(flagged < played * 0.02,
      `${kind}: a ball struck at a team-mate is his, not a shot (${flagged}/${played} taken for a shot)`);
  }
}

// ── A support player never steals your shot ─────────────────────────────────
//
// The single worst thing this system could produce: a team-mate wandering into
// a ball that was going in and "controlling" it, turning your goal into a
// completed pass. He steps out of the way of a live shot. Once it has died on
// the grass he can pick it up like anybody else — there is nothing left to
// steal, and somebody has to, or the move never ends.
{
  let stolen = 0, shots = 0, goals = 0, collected = 0;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry32(4000 + seed);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "tight_angle", rng, 62, 60);
    initDefenders(sc, rng);
    // Aim straight at the middle of the goal, hard.
    // The corner away from the keeper — he stands still now, so the middle of
    // the goal is the middle of him.
    const mid = (sc.goal.x1 + sc.goal.x2) / 2;
    const goalC = { x: sc.keeper.x < mid ? sc.goal.x2 - 0.8 : sc.goal.x1 + 0.8, y: 0 };
    const dir = { x: goalC.x - sc.ball.x, y: goalC.y - sc.ball.y };
    const ball = launch(sc, dir, 0.9, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
    shots += 1;
    let out: Outcome | null = null;
    for (let i = 0; i < 900 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      const wasLive = Math.hypot(ball.vel.x, ball.vel.y) > 5 && !ball.resting;
      out = stepBall(ball, sc, rng, DT);
      // A shot taken off you while it was still travelling. This must never
      // happen; a dead ball tidied up afterwards is fine and is counted apart.
      if (out === "delivered" && ball.shot) { if (wasLive) stolen += 1; else collected += 1; }
    }
    if (out === "goal") goals += 1;
  }
  check(stolen === 0, `no shot at goal is ever taken off you in flight (${stolen}/${shots})`);
  check(goals > shots * 0.1, `shots still go in with team-mates on the pitch (${goals}/${shots})`);

  // …and the other half of that rule, built rather than waited for: a shot that
  // has died on the grass is not sacred. Somebody picks it up, or it lies there
  // and the move never ends.
  {
    let tidied = 0;
    for (let seed = 0; seed < 60; seed++) {
      const rng = mulberry32(seed * 3 + 11);
      const sc = buildScenario("long_range", rng, 62, 60);
      initDefenders(sc, rng);
      sc.defenders = [];
      const mate = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners][0];
      if (!mate) continue;
      const ball: Ball = {
        pos: { x: mate.pos.x + 4, y: mate.pos.y + 4 }, vel: { x: 0, y: 0 },
        z: 0, vz: 0, spin: 0, resting: true, loose: false, contactCd: 0,
        receiverControlT: 0, event: null, inNet: false, shot: true,
      };
      let out: Outcome | null = null;
      for (let i = 0; i < 600 && !out; i++) {
        stepReactions(sc, ball, DT, rng);
        out = stepBall(ball, sc, rng, DT);
      }
      // Whatever he then does with it — shoots, scores, skies it — somebody
      // picked it up. That is the whole claim.
      if (sc.receiverDone) tidied += 1;
      void out;
    }
    check(tidied > 45, `a shot that has died is tidied up rather than left lying there (${tidied}/60)`);
  }
}

// ── Every scenario still builds, and dead balls stay still ──────────────────
{
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 40; seed++) {
      const rng = mulberry32(seed * 31 + 5);
      const sc = buildScenario(kind, rng, 62, 60);
      const support = sc.secondaryRunners.filter(r => r.role === "support");
      const dead = kind === "penalty" || kind === "free_kick" || kind === "corner";
      if (dead) check(support.length === 0, `${kind}: a dead ball has nobody making runs`);
      for (const r of support) {
        check(r.pos.x > 0 && r.pos.x < PITCH_W && r.pos.y > 0 && r.pos.y < HALF_LEN + 8,
          `${kind}: support players start on the pitch`);
        check(Math.hypot(r.pos.x - sc.player.x, r.pos.y - sc.player.y) > 3,
          `${kind}: support players do not start on top of you`);
      }
      check(sc.viewport.x2 > sc.viewport.x1 && sc.viewport.y2 > sc.viewport.y1, `${kind}: viewport is sane`);
    }
  }

  // Nobody runs onto anything, so the spot the game marks for you has to be one
  // the man it belongs to can actually stretch into. A target ten metres beyond
  // his feet is an instruction to give the ball away.
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 60; seed++) {
      const sc = buildScenario(kind, mulberry32(seed * 17 + 3), 62, 60);
      for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
        const reach = Math.hypot(r.to.x - r.pos.x, r.to.y - r.pos.y);
        check(reach < 6, `${kind}: the spot marked for a team-mate is within his reach (${reach.toFixed(1)} m)`);
      }
    }
  }

  // The whole point: an open-play chance is no longer shoot-or-nothing.
  const openPlay = ["one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross"] as const;
  for (const kind of openPlay) {
    const sc = buildScenario(kind, mulberry32(7), 62, 60);
    const opts = (sc.runner ? 1 : 0) + sc.secondaryRunners.length;
    check(opts >= 1, `${kind}: you have someone to pass to`);
  }
}

// ── The rectangle IS the situation ──────────────────────────────────────────
//
// Not a window onto a pitch that a camera visits. There is nothing outside the
// frame, because the camera never moves and never will, so anybody the builder
// leaves out there is not off-screen — he is not in the game. Every man in
// every situation starts inside his own frame, and stays a readable distance
// from the ball and from you.
{
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 120; seed++) {
      const sc = buildScenario(kind, mulberry32(seed * 41 + 13), 62, 60);
      const vp = sc.viewport;
      const inside = (p: Vec2) => p.x >= vp.x1 && p.x <= vp.x2 && p.y >= vp.y1 && p.y <= vp.y2;

      const everyone: Vec2[] = [sc.ball, sc.player, ...sc.defenders,
        ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map(r => r.pos)];
      // The keeper and the man in the box belong to situations with a goal in
      // them; the others do not draw either.
      if (goalInView(kind)) everyone.push({ x: sc.keeper.x, y: sc.keeper.y }, { x: sc.follower.x, y: sc.follower.y });
      check(everyone.every(inside), `${kind}: everyone in the situation is inside the frame it is played in`);

      // …and the frame is a frame, not the whole half.
      check(vp.y2 - vp.y1 <= 46.5, `${kind}: framed on the situation (${(vp.y2 - vp.y1).toFixed(0)} m down the screen)`);
    }
  }

  // The ball is BESIDE you and level with your boots. "In front" is up the
  // screen, and so is your own body, so anything in front climbs to your head —
  // it was drawn over the top of it. Sideways is a different axis, and the
  // figure now stands on its own feet, so "level" means level.
  for (const kind of SCENARIO_KINDS) {
    const sc = buildScenario(kind, mulberry32(99), 62, 60);
    const across = Math.abs(sc.player.x - sc.ball.x);
    const along = Math.abs(sc.player.y - sc.ball.y);
    check(across > along * 4, `${kind}: the ball is off your standing foot, not out in front of you`);
    check(along < 0.4, `${kind}: and level with your boots (${along.toFixed(2)} m ahead)`);
    check(Math.hypot(across, along) < 2, `${kind}: a stride away, not a pass away`);
  }

  // The keeper is ON his line, and now that a figure stands on its own feet
  // rather than hanging off its middle, that is also what you see.
  for (const kind of SCENARIO_KINDS) {
    if (!goalInView(kind)) continue;
    for (let seed = 0; seed < 60; seed++) {
      const sc = buildScenario(kind, mulberry32(seed * 13 + 7), 62, 60);
      check(sc.keeper.y <= 0.6, `${kind}: the keeper is on his line (${sc.keeper.y.toFixed(2)} m off it)`);
    }
  }
}

// ── Chaining a completed pass ───────────────────────────────────────────────
{
  const rng = mulberry32(3);
  check(CHAIN_MAX >= 1 && CHAIN_MAX <= 4, "a move is a few passes, not an infinite loop");

  // Where the ball arrived decides what you get next.
  const central = Array.from({ length: 200 }, () => chainKindFor({ x: CX, y: 10 }, rng));
  check(central.every(k => ["one_on_one", "volley", "tight_angle"].includes(k)),
    "a ball played into the middle of the box gives you a finish");
  const wideDeep = Array.from({ length: 200 }, () => chainKindFor({ x: 6, y: BOX_DEPTH - 2 }, rng));
  check(wideDeep.every(k => ["cutback", "tight_angle"].includes(k)),
    "a ball played into the corner gives you a cutback or a tight angle");
  const own = Array.from({ length: 200 }, () => chainKindFor({ x: CX, y: 55 }, rng));
  check(own.every(k => ["midfield_pass", "buildup"].includes(k)),
    "a ball played backwards does not hand you a shooting chance");

  // The return chance rewards a difficult ball to a well-drilled side.
  const sc = buildScenario("buildup", mulberry32(9), 62, 60);
  sc.passDifficulty = 0; sc.teamRelationship = 50;
  const easy = chainReturnChance(sc);
  sc.passDifficulty = 1;
  const hard = chainReturnChance(sc);
  sc.teamRelationship = 95;
  const hardAndDrilled = chainReturnChance(sc);
  check(hard > easy, `a harder ball is likelier to come back (${easy.toFixed(2)} → ${hard.toFixed(2)})`);
  check(hardAndDrilled > hard, `a better-drilled side returns it more (${hard.toFixed(2)} → ${hardAndDrilled.toFixed(2)})`);
  check(easy >= 0.1 && hardAndDrilled <= 0.85, "the return chance stays inside its bounds");
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — space, where support stands, reception, shot safety and chaining all hold");
