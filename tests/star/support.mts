import {
  buildScenario, spaceScore, bestSupportPoint, interceptPoint, stepSupport, stepRunner,
  stepDefenders, stepKeeper, stepBall, stepFollower, initDefenders, launch,
  chainKindFor, chainReturnChance, CHAIN_MAX, SCENARIO_KINDS,
  type Scenario, type Ball, type Outcome, type Vec2,
} from "../../lib/star/canvasEngine";
import { PITCH_W, CX, HALF_LEN, BOX_DEPTH } from "../../lib/star/pitch";

/**
 * The attack: space evaluation, supporting runs, pursuit of a loose ball, and
 * chaining a completed pass into the next decision.
 *
 * The thing every one of these guards against is the state this replaced —
 * team-mates as furniture. They were a Vec2[] the renderer drew and nothing
 * read, so while the defence closed you down your options only ever got worse,
 * and a pass that was not struck straight at someone was simply wasted.
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

// ── Supporting runs: options must not only decay ────────────────────────────
{
  // Run the aim phase twice from the same scenario: once with support moving,
  // once with the team-mates frozen the way they used to be.
  for (const kind of ["long_range", "one_on_one", "cutback"] as const) {
    const withSupport: number[] = [];
    const frozen: number[] = [];

    for (let seed = 0; seed < 200; seed++) {
      for (const live of [true, false]) {
        const rng = mulberry32(900 + seed);
        const sc = buildScenario(kind, rng, 62, 60);
        initDefenders(sc, rng);
        const before = bestOption(sc);
        for (let t = 0; t < 2.0; t += DT) {
          stepDefenders(sc, DT, sc.player, false);   // false: we want the shape, not a tackle
          if (live) { stepSupport(sc, null, sc.player, DT); stepRunner(sc, DT); }
        }
        (live ? withSupport : frozen).push(bestOption(sc) - before);
      }
    }

    const m = mean(withSupport), f = mean(frozen);
    const improved = withSupport.filter(x => x > 0.01).length / withSupport.length;
    const improvedFrozen = frozen.filter(x => x > 0.01).length / frozen.length;

    check(m > f + 0.02, `${kind}: supporting runs beat standing still (${f.toFixed(3)} → ${m.toFixed(3)})`);
    check(improved > 0.5, `${kind}: most of the time your best option is better after two seconds (${(improved * 100).toFixed(0)}%)`);
    check(improved > improvedFrozen * 2, `${kind}: and that is the running, not the scenario (${(improvedFrozen * 100).toFixed(0)}% frozen)`);
    check(m > 0, `${kind}: holding the ball no longer only makes things worse (${m.toFixed(3)})`);
  }
}

// ── Pursuit: a ball not played straight at you ──────────────────────────────
{
  const rng = mulberry32(77);
  const sc = buildScenario("midfield_pass", rng, 62, 60);
  const runner = sc.runner!;
  const mkBall = (target: Vec2, speed: number): Ball => {
    const dx = target.x - sc.ball.x, dy = target.y - sc.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    return {
      pos: { x: sc.ball.x, y: sc.ball.y }, vel: { x: dx / d * speed, y: dy / d * speed },
      z: 0.08, vz: 0, spin: 0, resting: false, loose: false, contactCd: 0,
      receiverControlT: 0, event: null, inNet: false,
    };
  };

  // Four metres to one side of him: reachable, and he should go and get it.
  const near = mkBall({ x: runner.to.x + 4, y: runner.to.y }, 16);
  check(interceptPoint(near, runner) !== null, "a pass played near a team-mate can be chased down");

  // Thirty metres the wrong way: not reachable, and pretending otherwise would
  // mean a badly overhit pass was never really a mistake.
  const away = mkBall({ x: clamp(runner.to.x + 34, 2, PITCH_W - 2), y: runner.to.y + 26 }, 26);
  check(interceptPoint(away, runner) === null, "a pass nobody can reach stays a wasted pass");

  // And the whole loop: an offset pass is actually received.
  {
    const r2 = mulberry32(78);
    const s2 = buildScenario("midfield_pass", r2, 62, 60);
    initDefenders(s2, r2);
    const t = s2.runner!.to;
    const ball = mkBall({ x: clamp(t.x + 3.5, 2, PITCH_W - 2), y: t.y }, 15);
    let out: Outcome | null = null;
    for (let i = 0; i < 400 && !out; i++) {
      stepSupport(s2, ball, ball.pos, DT);
      stepRunner(s2, DT);
      out = stepBall(ball, s2, r2, DT);
    }
    check(s2.receiverDone, "an offset pass is run onto and controlled");
  }
}

// ── A support player never steals your shot ─────────────────────────────────
{
  let stolen = 0, shots = 0, goals = 0;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry32(4000 + seed);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "tight_angle", rng, 62, 60);
    initDefenders(sc, rng);
    // Aim straight at the middle of the goal, hard.
    const goalC = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    const dir = { x: goalC.x - sc.ball.x, y: goalC.y - sc.ball.y };
    const ball = launch(sc, dir, 0.9, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
    shots += 1;
    let out: Outcome | null = null;
    for (let i = 0; i < 600 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false);
      stepKeeper(sc, DT);
      stepSupport(sc, ball, ball.pos, DT);
      stepRunner(sc, DT);
      stepFollower(sc, ball, rng, DT);
      out = stepBall(ball, sc, rng, DT);
    }
    if (out === "delivered") stolen += 1;
    if (out === "goal") goals += 1;
  }
  check(stolen === 0, `no shot at goal is ever intercepted by your own support player (${stolen}/${shots})`);
  check(goals > shots * 0.1, `shots still go in with team-mates on the pitch (${goals}/${shots})`);
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

  // The whole point: an open-play chance is no longer shoot-or-nothing.
  const openPlay = ["one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross"] as const;
  for (const kind of openPlay) {
    const sc = buildScenario(kind, mulberry32(7), 62, 60);
    const opts = (sc.runner ? 1 : 0) + sc.secondaryRunners.length;
    check(opts >= 1, `${kind}: you have someone to pass to`);
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
console.log("PASS — space, supporting runs, pursuit, shot safety and chaining all hold");
