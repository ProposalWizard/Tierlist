/**
 * FIVE-A-SIDE'S FLIGHT LOOP IS THE MATCH'S FLIGHT LOOP.
 *
 * CanvasMatch.tsx runs, every substep of a live ball:
 *   stepDefenders -> stepKeeper -> stepReactions -> (touch chase) -> stepBall
 * with three substeps a frame. FiveASide.tsx had no stepDefenders. It does now.
 *
 * This plays the same real five-a-side chances — yours, a team-mate's and
 * theirs, mirrored, built the way the screen builds them — through the screen's
 * substep loop twice, seed for seed: once as it was, once with stepDefenders
 * in the match's slot. It reports the outcome split for both and whether any
 * outcome, ball position or defender position differs.
 *
 * Expected: nothing differs. stepDefenders only jumps a free-kick wall and
 * five-a-side never builds a free kick; defenders chasing a ball in flight
 * has always been stepReactions, which was already in the loop. The test
 * pins that, so a future engine change to stepDefenders shows up here as a
 * measured change to five-a-side rather than a silent one.
 */
import {
  initDefenders, stepReactions, stepKeeper, stepBall, stepDefenders, launch, setOffsideRuleEnabled,
  type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import {
  buildPassage, buildTheirAttack, aimTheirShot, buildMateAttack, kickOffWorld, type FiveWorld,
} from "../../lib/star/fiveASide/passage";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import { leftPitch, mirror, FIVE_KEEPER_STRENGTH } from "../../lib/star/fiveASide/geometry";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
setOffsideRuleEnabled(false);

const FRAME = 1 / 60;

/** FiveASide.tsx's flight branch, frame by frame, with or without stepDefenders. */
function fly(sc: Scenario, ball: Ball, rng: () => number, theirs: boolean, withDefenders: boolean): Outcome | "none" {
  for (let f = 0; f < 60 * 15; f++) {
    let res: Outcome | null = null;
    for (let i = 0; i < 3 && !res; i++) {
      const h = FRAME / 3;
      if (withDefenders) stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      res = stepBall(ball, sc, rng, h);
    }
    if (!res && leftPitch(theirs ? mirror(ball.pos) : ball.pos)) res = "out" as Outcome;
    if (res) return res;
  }
  return "none";
}

type Kind = "mine" | "mate" | "theirs";
function chance(kind: Kind, seed: number, world: FiveWorld) {
  const rng = mulberry32(seed);
  const opts = { keeperStrength: kind === "mine" ? 60 : FIVE_KEEPER_STRENGTH, teamRelationship: 55, rng };
  const sc = kind === "mine" ? buildPassage(world, opts)
    : kind === "mate" ? buildMateAttack(world, opts)
    : buildTheirAttack(world, opts);
  sc.goal = { ...FIVE_A_SIDE.goal };
  sc.crossbar = FIVE_A_SIDE.crossbar;
  sc.viewport = { ...FIVE_A_SIDE.view };
  initDefenders(sc, rng);
  let ball: Ball;
  if (kind === "mine") {
    // A strike toward goal with some spread, the way a thumb would.
    const dir = { x: (rng() - 0.5) * 14, y: -(8 + rng() * 10) };
    ball = launch(sc, dir, 0.4 + rng() * 0.55, { cx: (rng() - 0.5) * 0.6, cy: -rng() * 0.5 },
      { power: 70, technique: 70 }, rng);
  } else {
    const shot = aimTheirShot(sc, 0.5, rng);
    ball = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, rng);
  }
  return { sc, ball, rng };
}

const kinds: Kind[] = ["mine", "mate", "theirs"];
const N = 400;
const tallyA: Record<string, number> = {}, tallyB: Record<string, number> = {};
let differ = 0, defendersSeen = 0, freeKicks = 0, runs = 0, movedInFlight = 0;
for (const kind of kinds) {
  for (let s = 0; s < N; s++) {
    // Vary where on the pitch it happens: kick-off, then real positions pushed up.
    const base = kickOffWorld(true);
    const world: FiveWorld = { ...base, ball: { x: base.ball.x + (s % 7 - 3) * 2, y: base.ball.y - (s % 5) * 5 } };
    const A = chance(kind, 5000 + s, world);
    const B = chance(kind, 5000 + s, world);
    const start = A.sc.defenders.map(d => ({ x: d.x, y: d.y }));
    const ra = fly(A.sc, A.ball, A.rng, kind === "theirs", false);
    const rb = fly(B.sc, B.ball, B.rng, kind === "theirs", true);
    tallyA[ra] = (tallyA[ra] ?? 0) + 1;
    tallyB[rb] = (tallyB[rb] ?? 0) + 1;
    defendersSeen += A.sc.defenders.length;
    if (A.sc.kind === "free_kick") freeKicks++;
    if (A.sc.defenders.some((d, i) => Math.hypot(d.x - start[i].x, d.y - start[i].y) > 0.05)) movedInFlight++;
    const same = ra === rb
      && A.ball.pos.x === B.ball.pos.x && A.ball.pos.y === B.ball.pos.y
      && A.sc.defenders.every((d, i) => d.x === B.sc.defenders[i].x && d.y === B.sc.defenders[i].y);
    if (!same) differ++;
    runs++;
  }
}

const fmt = (t: Record<string, number>) =>
  Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");
console.log(`  ${runs} real five-a-side chances (${N} each: yours, a team-mate's, theirs)`);
console.log(`  defenders per chance: ${(defendersSeen / runs).toFixed(2)}; free kicks built: ${freeKicks}`);
console.log(`  chances where a defender moved while the ball was live: ${movedInFlight} (${(movedInFlight / runs * 100).toFixed(0)}%) — stepReactions, before and after`);
console.log(`  before (no stepDefenders): ${fmt(tallyA)}`);
console.log(`  after  (match order):      ${fmt(tallyB)}`);
console.log(`  chances with ANY difference in outcome, ball or defenders: ${differ}`);

check(defendersSeen > 0, "five-a-side chances should have defenders in them");
check(freeKicks === 0, "five-a-side is not expected to build a free kick — if it does, stepDefenders now matters");
check(movedInFlight > runs * 0.2, "defenders should already be moving in flight via stepReactions");
check(differ === 0, `stepDefenders changed ${differ} five-a-side chances — measure and report before shipping`);

if (problems.length) {
  console.error(`fiveASideFlight: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("fiveASideFlight: ok");
