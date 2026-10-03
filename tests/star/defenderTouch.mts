/**
 * tests/star/defenderTouch.mts — a defender never plays the rebound at his own keeper.
 *
 * Harry, live playtest 2 Oct 2026 (v0.25 item 20): a long shot was saved, it
 * came back out, and an opposing defender "shot" the loose ball at his own
 * keeper. Two things sent it there, both measured here over real played
 * chances (CanvasMatch's flight loop, mirrored):
 *   - the loose-ball 50-50 (canvasEngine's "short" with the defence on it)
 *     leaves the ball rolling on after the whistle, often at goal;
 *   - the block deflection (deflection.ts) carries on goalwards on a rebound.
 * lib/star/defenderTouch.ts turns both round, from CanvasMatch only.
 * The first block of YOUR strike keeps its odd bounce (v0.15), on purpose.
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepDefenders, stepKeeper, stepReactions,
  type Ball, type Scenario, type ScenarioKind,
} from "@/lib/star/canvasEngine";
import { deflectBlock } from "@/lib/star/deflection";
import { POST_L, POST_R } from "@/lib/star/pitch";
import { clearLooseWin, steerDeflectionFromOwnGoal, turnAwayFromGoal, isSecondPhase } from "@/lib/star/defenderTouch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const H = 1 / 180;
const CXG = (POST_L + POST_R) / 2;
/** Travelling at his own goal line, and its line crosses within 3 m of a post. */
const atGoal = (b: Ball) => {
  if (b.vel.y >= -0.5) return false;
  const t = -b.pos.y / b.vel.y;
  const x = b.pos.x + b.vel.x * t;
  return x > POST_L - 3 && x < POST_R + 3;
};

interface Tally { wins: number; winsAtGoal: number; reboundBlocks: number; reboundAtGoal: number; firstBlocks: number; firstAtGoal: number }

function play(fix: boolean): Tally {
  const t: Tally = { wins: 0, winsAtGoal: 0, reboundBlocks: 0, reboundAtGoal: 0, firstBlocks: 0, firstAtGoal: 0 };
  const KINDS: ScenarioKind[] = ["long_range", "one_on_one", "tight_angle", "volley", "cutback", "through_ball", "corner", "byline_cross"];
  for (const kind of KINDS) for (let seed = 0; seed < 300; seed++) {
    const rng = mulberry32(seed * 2654435761 + kind.length * 97);
    const sc = buildScenario(kind, rng, 60, 60, 60);
    initDefenders(sc, rng);
    const side = rng() < 0.5 ? -1 : 1;
    const shoot = ["long_range", "one_on_one", "tight_angle", "volley"].includes(kind);
    let dir, power;
    if (shoot) {
      const tx = CXG + side * ((POST_R - POST_L) / 2 - 0.6) * (0.3 + rng() * 0.7);
      dir = { x: tx - sc.ball.x, y: -Math.max(sc.ball.y, 1) };
      power = Math.min(1, 0.45 + Math.hypot(sc.ball.x - CXG, sc.ball.y) / 40) * (0.85 + rng() * 0.3);
    } else {
      const tg = sc.runner?.pos ?? { x: sc.ball.x, y: sc.ball.y - 10 };
      dir = { x: tg.x - sc.ball.x, y: tg.y - sc.ball.y };
      power = Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32);
    }
    const ball = launch(sc, dir, power, { cx: (rng() - 0.5) * 0.6, cy: -0.2 - rng() * 0.3 }, { power: 65, technique: 65 }, rng);
    let deflections = 0;
    let res: ReturnType<typeof stepBall> = null;
    for (let i = 0; i < 1500 && !res; i++) {
      for (let s = 0; s < 3 && !res; s++) {
        stepDefenders(sc, H, ball.pos, false, ball);
        stepKeeper(sc, H);
        stepReactions(sc, ball, H, rng);
        const pre = { vx: ball.vel.x, vy: ball.vel.y, vz: ball.vz, z: ball.z, spin: ball.spin };
        const rebound = isSecondPhase(ball, sc);
        res = stepBall(ball, sc, rng, H);
        if (res === "blocked" && deflections < 1) {
          deflections++;
          deflectBlock(ball, sc, pre, mulberry32((seed * 31 + i) >>> 0));
          if (fix) steerDeflectionFromOwnGoal(ball, sc);
          if (rebound) { t.reboundBlocks++; if (atGoal(ball)) t.reboundAtGoal++; }
          else { t.firstBlocks++; if (atGoal(ball)) t.firstAtGoal++; }
          res = null;
          continue;
        }
        if (res === "short" && ball.lastTouch === "defence" && ball.settling) {
          if (fix) clearLooseWin(ball, sc);
          t.wins++;
          if (atGoal(ball)) t.winsAtGoal++;
        }
      }
    }
  }
  return t;
}

console.log("\nDEFENDER TOUCHES — where the ball goes next (2,400 played chances)");
const before = play(false);
const after = play(true);
const pc = (a: number, b: number) => `${a}/${b} (${b ? ((100 * a) / b).toFixed(1) : "0"}%)`;
console.log(`  50-50 won by a defender, then at his own goal: before ${pc(before.winsAtGoal, before.wins)}, after ${pc(after.winsAtGoal, after.wins)}`);
console.log(`  rebound blocked, then at his own goal:         before ${pc(before.reboundAtGoal, before.reboundBlocks)}, after ${pc(after.reboundAtGoal, after.reboundBlocks)}`);
console.log(`  your first strike blocked, then at goal:       before ${pc(before.firstAtGoal, before.firstBlocks)}, after ${pc(after.firstAtGoal, after.firstBlocks)}`);
ok(before.wins >= 10 && before.winsAtGoal > 0, "the old behaviour is really exercised (a won 50-50 rolled at goal)");
ok(before.reboundAtGoal > 0, "the old behaviour is really exercised (a rebound block went on at goal)");
ok(after.wins >= 10 && after.winsAtGoal === 0, "a defender who wins the 50-50 never leaves it rolling at his own goal");
ok(after.reboundBlocks >= 10 && after.reboundAtGoal === 0, "a rebound blocked by a defender never carries on at his own goal");
ok(after.firstBlocks === before.firstBlocks && after.firstAtGoal === before.firstAtGoal,
  "the first block of your strike is untouched (it can still bounce in at an odd angle)");

console.log("\nTURNING IT ROUND");
{
  const sc = buildScenario("long_range", mulberry32(7), 60, 60, 60);
  const ball = launch(sc, { x: 0, y: -1 }, 0.5, { cx: 0, cy: -0.3 }, { power: 60, technique: 60 }, mulberry32(8));
  ball.vel = { x: 2, y: -6 };
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  ok(turnAwayFromGoal(ball, sc), "a ball at goal is turned");
  ok(ball.vel.y > 0 && Math.abs(Math.hypot(ball.vel.x, ball.vel.y) - speed) < 1e-9, "it goes up the pitch at the same speed");
  ok(!turnAwayFromGoal(ball, sc), "a ball already going away is left alone");
  const sc2: Scenario = buildScenario("long_range", mulberry32(9), 60, 60, 60);
  const b2 = launch(sc2, { x: 0, y: -1 }, 0.5, { cx: 0, cy: -0.3 }, { power: 60, technique: 60 }, mulberry32(10));
  b2.vel = { x: 0, y: -5 };
  ok(!steerDeflectionFromOwnGoal(b2, sc2) && b2.vel.y < 0, "no keeper or post touch yet: the deflection is left as it was");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
