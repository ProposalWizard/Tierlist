import {
  defensiveShape, clearOfBall, laneClearance, DEFEND_ROLES,
} from "../../lib/star/fiveASide/shape";
import { playOn, newFlow, flowAfterTouch } from "../../lib/star/fiveASide/flow";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import { FIVE_KEEPER_STRENGTH, insideFivePitch } from "../../lib/star/fiveASide/geometry";
import { initDefenders, setOffsideRuleEnabled, type Scenario, type Vec2 } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX } from "../../lib/star/pitch";

/**
 * A DEFENCE THAT KNOWS WHERE IT IS.
 *
 * The brief, verbatim:
 *
 *   "the goal middle question is tough because in football scenarios aren't so
 *    set like that, each cpu should have an understanding of his position /
 *    know when to cover space and/or the game itself should understand
 *    football scenarios."
 *
 * What this file checks is not that the defence is GOOD — that is the wrong
 * target and the brief says so ("positional defending that is merely BETTER at
 * blocking is a regression"). It checks that the picture is a defence: that
 * where a man stands follows from where the ball is, who he is picking up and
 * which goal he is defending, and that four of them do not end up in a heap.
 *
 * The numbers every check is set against were measured on the version this
 * replaced, over 500 real chances the flow actually produced:
 *
 *                                            before     after
 *   the back four's spread across a 24 m
 *     pitch                                  1.02 m     1.68 m
 *   nearest two defenders to each other      0.99 m     1.90 m
 *   nearest man to the ball                  5.86 m     4.31 m
 *   does where they stand follow the ball?   r = -0.11  r = +0.62
 *
 * The last one is the whole thing in one number. It is the correlation between
 * the back four's own centre and the ball's position across the pitch, and
 * before this it was NEGATIVE: where the defence stood had no relationship
 * whatever to where the ball was.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const R = FIVE_A_SIDE;
const GOAL_C = (R.goal.x1 + R.goal.x2) / 2;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

// ── The four slots are four different jobs ──────────────────────────────
//
// Read straight off the shape, against hand-built situations, so a failure
// says which job went wrong rather than "the numbers moved".
{
  check(DEFEND_ROLES.length === 4, "four defenders, four jobs");
  check(new Set(DEFEND_ROLES).size === 4, "…and no two of them are the same job");

  // A ball wide on the right, 9 m out, with three attackers spread ahead of
  // their markers.
  const ball: Vec2 = { x: GOAL_C + 7, y: 9 };
  const attackers: Vec2[] = [
    { x: GOAL_C + 7, y: 9 },      // the carrier, on the ball
    { x: GOAL_C - 4, y: 6 },      // a man free at the far post
    { x: GOAL_C + 1, y: 7 },      // a man free in the middle
    { x: GOAL_C + 3, y: 14 },     // somebody holding, behind the ball
  ];
  const { slots, roles } = defensiveShape(R, ball, attackers);
  const at = (r: string) => slots[roles.indexOf(r as never)];

  check(slots.length === 4, `four slots, got ${slots.length}`);
  check(
    slots.every(s => insideFivePitch(s)),
    `every defender is on the pitch: ${JSON.stringify(slots)}`,
  );

  // PRESS — goal-side of the ball and near it. "Goal-side" is the whole of
  // what makes him a defender rather than a man chasing back.
  const press = at("press");
  check(press.y < ball.y, `the presser is goal-side of the ball (${press.y.toFixed(1)} vs ${ball.y})`);
  check(
    dist(press, ball) > 1.8 && dist(press, ball) < 6,
    `…and he is actually pressing it, ${dist(press, ball).toFixed(1)} m away`,
  );
  // …and he SHOWS the shooter one way rather than standing on the line and
  // blocking nothing in particular. He shades to the near post — the side the
  // ball is on — which leaves the far post as the ball being invited.
  check(
    press.x > laneAt(ball, { x: GOAL_C, y: 0 }, press.y),
    "…and he shades to the near side, showing the shooter across goal",
  );

  // COVER — between the ball and the near post, without standing on it.
  const cover = at("cover");
  const nearPost: Vec2 = { x: R.goal.x2, y: 0 };
  check(
    laneClearance(cover, ball, nearPost) < 2.0,
    `the cover man is on the ball's line to the near post `
    + `(${laneClearance(cover, ball, nearPost).toFixed(2)} m off it)`,
  );
  check(
    dist(cover, nearPost) > 2,
    `…and is not standing on the post itself (${dist(cover, nearPost).toFixed(1)} m off it)`,
  );

  // MARK — somebody steps to the free man nearest goal. That is attacker 1,
  // the one at the far post, and the marker has to be goal-side of him.
  const mark = at("mark");
  check(
    dist(mark, attackers[1]) < 3.5,
    `somebody steps to the free man nearest goal (${dist(mark, attackers[1]).toFixed(1)} m off him)`,
  );
  check(mark.y < attackers[1].y, "…and does it goal-side of him, not behind him");

  // LAST — holds the middle, on the ball's own line to the middle of the goal.
  const last = at("last");
  check(
    laneClearance(last, ball, { x: GOAL_C, y: 0 }) < 1.6,
    `the last man holds the middle (${laneClearance(last, ball, { x: GOAL_C, y: 0 }).toFixed(2)} m off the line to it)`,
  );
  check(last.y < press.y, "…and is the deepest of the four, behind the press");
}

/** Where the line from a to b sits, across the pitch, at this depth. */
function laneAt(a: Vec2, b: Vec2, y: number): number {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-6) return a.x;
  return a.x + (b.x - a.x) * ((y - a.y) / dy);
}

// ── Nobody covers the same blade of grass ───────────────────────────────
//
// Four men who each pick a sensible spot can still pick the SAME sensible
// spot. Fuzzed across the whole pitch rather than checked on one picture,
// because the collapse this replaces was invisible on any single one — it only
// showed up as an average.
{
  const rng = mulberry32(99);
  let worstPair = Infinity;
  let worstBall = Infinity;
  let off = 0;
  for (let i = 0; i < 4000; i++) {
    const ball: Vec2 = {
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * (R.pitch.y2 - R.pitch.y1),
    };
    const attackers: Vec2[] = Array.from({ length: 4 }, () => ({
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * (R.pitch.y2 - R.pitch.y1),
    }));
    attackers[0] = { ...ball };
    const { slots } = defensiveShape(R, ball, attackers, rng);
    for (let a = 0; a < slots.length; a++) {
      worstBall = Math.min(worstBall, dist(slots[a], ball));
      if (!insideFivePitch(slots[a])) off++;
      for (let b = a + 1; b < slots.length; b++) {
        worstPair = Math.min(worstPair, dist(slots[a], slots[b]));
      }
    }
  }
  // The engine tackles a carrier with a defender inside 1.8 m of the ball
  // before the kick has travelled (see buildPassage's own note). No slot may
  // ever be inside that, wherever the ball is — including the corners, where
  // the first version of the guard clamped men back onto it.
  check(
    worstBall >= 1.8,
    `no defender may ever be standing on the ball — closest over 4,000 shapes was ${worstBall.toFixed(2)} m`,
  );
  // Two men closer than this are one man with a shadow.
  //
  // The bar is a metre and not `MIN_SEP`, and the reason is geometry rather
  // than slack: with the ball jammed in a corner of the pitch, the ring of
  // legal standing positions around it is a quarter-arc about four metres
  // long, and four men on four metres of arc cannot be three metres apart.
  // The fuzz deliberately includes those corners. What matters is that nobody
  // is ever ON anybody — this found two slots exactly 0.00 m apart before the
  // relaxation was made to run all three rules together — and the number that
  // describes the ordinary picture is the real-chance average below (1.90 m,
  // against 0.99 m for the shape this replaced).
  check(
    worstPair >= 0.9,
    `no two defenders may occupy the same spot — closest over 4,000 shapes was ${worstPair.toFixed(2)} m`,
  );
  console.log(
    `      4,000 fuzzed shapes: nearest anyone got to the ball ${worstBall.toFixed(2)} m, `
    + `to each other ${worstPair.toFixed(2)} m, off the pitch ${off}`,
  );
}

// ── The guard that keeps a man off the ball actually sweeps ─────────────
//
// `clearOfBall` exists because two earlier passes — separation, and the clamp
// back onto the pitch — can each put a man back on the ball. The bug it fixes
// is that pushing him straight out and clamping him back drags him into the
// radius he was just moved out of, which is why it sweeps for an angle that
// works instead. Tested in the corner, which is the only place it matters.
{
  const corner: Vec2 = { x: R.pitch.x1 + 0.3, y: 0.3 };
  const on: Vec2 = { x: corner.x, y: corner.y };
  const out = clearOfBall(on, corner, R);
  check(dist(out, corner) >= 2.5, `a man on the ball in the corner is moved off it (${dist(out, corner).toFixed(2)} m)`);
  check(insideFivePitch(out), `…and onto the pitch, not off the side of it (${JSON.stringify(out)})`);
  // And somebody already clear is left exactly where he is — this runs on
  // every defender of every shape and must be a no-op for nearly all of them.
  const clear: Vec2 = { x: CX, y: 20 };
  const same = clearOfBall(clear, corner, R);
  check(same.x === clear.x && same.y === clear.y, "a man already clear of the ball is not moved at all");
}

// ── …and it holds all the way through to the real picture ───────────────
//
// The shape is only worth anything if it survives `buildPassage`, which is
// what the engine is actually handed. Measured on real chances the flow
// produced, not on hand-built ones.
{
  setOffsideRuleEnabled(false);
  const spread: number[] = [], pairMin: number[] = [], toBall: number[] = [];
  const ballX: number[] = [], centroid: number[] = [], goalSide: number[] = [];
  let n = 0, rolesNamed = 0, pressIsNearest = 0;

  for (let seed = 1; seed <= 900 && n < 400; seed++) {
    const rng = mulberry32(seed * 32749);
    let world = kickOffWorld(true);
    let flow = newFlow(true);
    for (let hop = 0; hop < 8 && n < 400; hop++) {
      const r = playOn(R, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 40);
      world = r.world; flow = r.flow;
      if (r.stop === "full-time") break;
      if (r.stop === "you" && world.ball.y < 13) {
        const sc: Scenario = buildPassage(world, { keeperStrength: FIVE_KEEPER_STRENGTH, rng });
        initDefenders(sc, rng);
        const ds = sc.defenders;
        const mx = avg(ds.map(d => d.x));
        spread.push(Math.sqrt(avg(ds.map(d => (d.x - mx) ** 2))));
        toBall.push(Math.min(...ds.map(d => dist(d, sc.ball))));
        goalSide.push(ds.filter(d => d.y < sc.ball.y).length);
        ballX.push(sc.ball.x); centroid.push(mx);
        let pm = Infinity;
        for (let a = 0; a < ds.length; a++) {
          for (let b = a + 1; b < ds.length; b++) pm = Math.min(pm, dist(ds[a], ds[b]));
        }
        pairMin.push(pm);

        // The jobs the flow recorded for this exact picture.
        const jobs = flow.defendRoles;
        if (jobs && jobs.length === 4 && new Set(jobs).size === 4) rolesNamed++;
        if (jobs) {
          const press = jobs.indexOf("press");
          let nearest = 0;
          world.opps.forEach((o, i) => {
            if (dist(o, world.ball) < dist(world.opps[nearest], world.ball)) nearest = i;
          });
          if (press === nearest) pressIsNearest++;
        }
        n++;
      }
      flow = flowAfterTouch(R, flow, r.stop === "you" ? "them" : "you", world.ball.y);
    }
  }

  // Does where the defence stands follow where the ball is? Before this round
  // the answer was no, and the correlation was very slightly negative.
  const mb = avg(ballX), mc = avg(centroid);
  let cov = 0, vb = 0, vc = 0;
  for (let i = 0; i < ballX.length; i++) {
    cov += (ballX[i] - mb) * (centroid[i] - mc);
    vb += (ballX[i] - mb) ** 2; vc += (centroid[i] - mc) ** 2;
  }
  const r = cov / Math.sqrt(vb * vc);

  console.log(
    `      ${n} real chances: back four spread ${avg(spread).toFixed(2)} m (was 1.02), `
    + `nearest pair ${avg(pairMin).toFixed(2)} m (was 0.99), nearest man to the ball `
    + `${avg(toBall).toFixed(2)} m (was 5.86), tracks the ball r=${r.toFixed(2)} (was -0.11)`,
  );

  check(n >= 300, `enough real chances to measure the picture, got ${n}`);
  // Every chance names all four jobs, exactly once each. That is what "the
  // position and the role are one answer" has to mean in practice: the slots
  // come back in role order, a man's job is whichever one he took, and if the
  // two could ever disagree this is where it would show.
  check(rolesNamed === n, `every chance names all four jobs, ${rolesNamed} of ${n} did`);
  // The man doing the pressing is NOT asserted to be the one nearest the ball,
  // and that is deliberate rather than an omission. Jobs go to whoever is
  // nearest the SPOT, which keeps everybody's run short; the press spot sits
  // goal-side of the ball, so the presser is often a man closing from behind
  // it rather than the one standing next to it — measured at 169 of 400.
  // Handing the press to the nearest man instead was built and measured and
  // shuts the stage down (37.0% of your touches blocked against 30.3%, the
  // open post 40.2% against 54.6%); see the note on `assignRoles` in flow.ts.
  // What IS asserted is the honest version of the same idea: somebody is close
  // enough to the ball to be pressing it, which is the check below.
  check(pressIsNearest > 0, `the nearest man does sometimes press — ${pressIsNearest} of ${n}`);
  // THE ONE THAT MATTERS. Not "is it a good defence" — "is it a defence at
  // all, or four men standing where they happen to be standing".
  check(
    r > 0.4,
    `where the defence stands has to follow where the ball is — r=${r.toFixed(2)}, and it was -0.11`,
  );
  check(
    avg(spread) > 1.3,
    `the back four cannot occupy one lane of a 24 m pitch — spread ${avg(spread).toFixed(2)} m, was 1.02`,
  );
  check(
    avg(pairMin) > 1.3,
    `…nor stand on each other — nearest pair ${avg(pairMin).toFixed(2)} m on average, was 0.99`,
  );
  // Somebody is in front of you. That is the difference between a picture you
  // can read and a chance with nobody in it.
  check(
    avg(toBall) < 5.0,
    `somebody has to be close enough to the ball to be pressing it — nearest man `
    + `${avg(toBall).toFixed(2)} m on average, was 5.86`,
  );
  check(
    avg(goalSide) > 1.5,
    `…and men have to be between the ball and the goal, not behind it — `
    + `${avg(goalSide).toFixed(2)} of four`,
  );
  setOffsideRuleEnabled(true);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the defenders stand where the football puts them, not where a builder does");
