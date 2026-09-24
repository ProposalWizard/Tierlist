/**
 * WHAT IS ON THE PITCH (lib/star/scenePicture.ts).
 *
 * Harry, 24 Sep 2026: a drill should only have what it is about on the pitch —
 * "technique training does not need a goalie/goal". A feature's `scene` takes
 * the keeper and the team-mates OFF, and nothing else changes: the ball, the
 * kick and the flight are the real match's.
 *
 * Pinned here, on real long-range shots through the match's own substep loop:
 *   - a benched keeper never saves, catches or smothers anything
 *   - with the keeper on, the same shots DO get saved (so the test can fail)
 *   - a benched poacher never receives or finishes a rebound
 *   - a scene with nothing switched off changes nothing at all
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepDefenders, stepKeeper, stepReactions,
  type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { stageScene, type ScenePicture } from "../../lib/star/scenePicture";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const FRAME = 1 / 60;
/** CanvasMatch's flight substep, in its order. */
function fly(sc: Scenario, ball: Ball, rng: () => number): Outcome | "none" {
  for (let f = 0; f < 60 * 12; f++) {
    let res: Outcome | null = null;
    for (let i = 0; i < 3 && !res; i++) {
      const h = FRAME / 3;
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      res = stepBall(ball, sc, rng, h);
    }
    if (res) return res;
  }
  return "none";
}

function shoot(seed: number, scene: ScenePicture | undefined) {
  const rng = mulberry32(seed);
  const sc = buildScenario("long_range", rng, 70, 60, 55);
  initDefenders(sc, rng);
  sc.defenders = [];   // nothing in the lane: only the keeper can stop it
  stageScene(sc, scene);
  // Aim somewhere across the goal mouth at a decent pace.
  const aimX = 30.5 + (rng() - 0.5) * 6.5;
  const dir = { x: aimX - sc.ball.x, y: 0 - sc.ball.y };
  const ball = launch(sc, dir, 0.55 + rng() * 0.35, { cx: 0, cy: 0 }, { power: 60, technique: 60 }, rng);
  return { res: fly(sc, ball, rng), sc, ball };
}

const KEEPER_OUTCOMES = new Set<string>(["saved", "caught", "tipped"]);
const N = 600;

// ── Keeper benched ──
let benchedSaves = 0, benchedGoals = 0, keeperMoved = 0;
for (let s = 1; s <= N; s++) {
  const { res, sc } = shoot(s, { keeper: false });
  if (KEEPER_OUTCOMES.has(res)) benchedSaves++;
  if (res === "goal") benchedGoals++;
  if (sc.keeper.x > -300 || sc.keeper.y < 300) keeperMoved++;
}
check(benchedSaves === 0, `a benched keeper made ${benchedSaves} saves in ${N} shots`);
check(keeperMoved === 0, `a benched keeper walked back onto the pitch in ${keeperMoved} of ${N} shots`);

// ── Keeper on: the same shots do get saved, so the check above can fail ──
let liveSaves = 0, liveGoals = 0;
for (let s = 1; s <= N; s++) {
  const { res } = shoot(s, undefined);
  if (KEEPER_OUTCOMES.has(res)) liveSaves++;
  if (res === "goal") liveGoals++;
}
check(liveSaves > N * 0.05, `with the keeper on only ${liveSaves} of ${N} shots were saved — the test shot is too weak to prove anything`);
check(benchedGoals > liveGoals, `benching the keeper should mean more goals (${benchedGoals} vs ${liveGoals})`);

// ── Team-mates benched: the poacher never gets a touch ──
let poacherTouches = 0;
for (let s = 1; s <= N; s++) {
  const { res, ball, sc } = shoot(s, { teammates: false });
  // ("rebound" is the engine's word for a shot that goes in off the KEEPER,
  // so it is not counted here; only a team-mate's own touch is.)
  if (ball.lastTouch === "mate") poacherTouches++;
  // He still jogs toward a loose ball (the engine moves him; it is never
  // edited), but from ~570 m away he never gets anywhere near the pitch.
  check(sc.follower.x < -250 && sc.follower.y > 250, `seed ${s}: the benched poacher got near the pitch (${sc.follower.x.toFixed(0)}, ${sc.follower.y.toFixed(0)})`);
  check(sc.teammates.length === 0 && sc.secondaryRunners.length === 0 && sc.runner === null, `seed ${s}: team-mates still on the pitch`);
}
check(poacherTouches === 0, `a benched poacher touched the ball in ${poacherTouches} of ${N} shots`);

// ── An empty scene changes nothing ──
let diffs = 0;
for (let s = 1; s <= 200; s++) {
  const a = shoot(s, undefined), b = shoot(s, {});
  if (a.res !== b.res || Math.abs(a.ball.pos.x - b.ball.pos.x) > 1e-9 || Math.abs(a.ball.pos.y - b.ball.pos.y) > 1e-9) diffs++;
}
check(diffs === 0, `an empty scene changed ${diffs} of 200 shots`);

console.log(`keeper benched: ${benchedSaves} saves, ${benchedGoals} goals / ${N}`);
console.log(`keeper on:      ${liveSaves} saves, ${liveGoals} goals / ${N}`);
console.log(`team-mates benched: ${poacherTouches} poacher touches / ${N}`);
if (problems.length) { console.log("FAIL"); for (const p of problems.slice(0, 20)) console.log("  - " + p); process.exit(1); }
console.log("PASS — a scene only takes things off the pitch; the ball is the match's");
