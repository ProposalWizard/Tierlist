import { buildScenario, launch, stepBall, type KickSkills, type Scenario, type Vec2 } from "./canvasEngine";
import { mulberry32 } from "./season";
import { CX, BOX_DEPTH } from "./pitch";

/**
 * CAN YOU REACH THE BOX FROM THE CORNER FLAG? (Mikey, 20 Oct 2026)
 *
 * "I am generally always the corner kick taker … but I don't have enough power
 * to actually kick the ball far into the box." The corner is yours only if your
 * best delivery reaches the middle of the penalty area IN THE AIR.
 *
 * Measured with the match's own physics, not the power number: your strongest
 * kick (full power, the contact that carries furthest) is launched from the
 * corner flag with the real `launch` and flown with the real `stepBall` on an
 * empty pitch, and the distance it carries before it first lands is compared
 * with the distance from the flag to the middle of the box. So when the power
 * scale changes (a weaker start, new boots, a retuned launch), the answer
 * changes with it, by itself.
 */

/** The middle of the penalty area: in line with the goal, half its depth out. */
export const BOX_MIDDLE: Vec2 = { x: CX, y: BOX_DEPTH / 2 };

const cache = new Map<string, CornerReach>();

export interface CornerReach {
  /** How far your best corner carries in the air, in metres. */
  carry: number;
  /** How far it has to: corner flag to the middle of the box, in metres. */
  needed: number;
  ok: boolean;
}

/** A corner with nobody on the pitch but you and the ball. */
function emptyCorner(): Scenario {
  const sc = buildScenario("corner", mulberry32(7), 70, 50, 60);
  return {
    ...sc,
    defenders: [], teammates: [], secondaryRunners: [], runner: null,
    // Nobody to meet it: the follower and the keeper are stood off the pitch.
    follower: { ...sc.follower, x: -200, y: -200 },
    keeper: { ...sc.keeper, x: -100, y: -100 },
  } as Scenario;
}

/** How far one delivery carries in the air towards the middle of the box. */
function carryOf(skills: KickSkills, cy: number): number {
  const sc = emptyCorner();
  const from = { ...sc.ball };
  const dx = BOX_MIDDLE.x - from.x, dy = BOX_MIDDLE.y - from.y;
  const L = Math.hypot(dx, dy);
  const dir = { x: dx / L, y: dy / L };
  // A random draw that makes the miskick noise zero: aim exactly.
  const still = () => 0.9999999;
  const ball = launch(sc, dir, 1, { cx: 0, cy }, skills, still);
  let airborne = false;
  let best = 0;
  for (let t = 0; t < 6; t += 1 / 120) {
    stepBall(ball, sc, still, 1 / 120);
    const along = (ball.pos.x - from.x) * dir.x + (ball.pos.y - from.y) * dir.y;
    if (ball.z > 0.3) airborne = true;
    if (airborne && ball.z <= 0.15) return along; // first landing
    best = Math.max(best, along);
  }
  return airborne ? best : 0;
}

/** Your best corner, and whether it reaches the middle of the box. */
export function cornerReach(skills: KickSkills): CornerReach {
  const key = `${Math.round(skills.power)}:${Math.round(skills.technique)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const flag = emptyCorner().ball;
  const needed = Math.hypot(BOX_MIDDLE.x - flag.x, BOX_MIDDLE.y - flag.y);
  let carry = 0;
  for (let cy = 0; cy <= 1.0001; cy += 0.1) carry = Math.max(carry, carryOf(skills, cy));
  const out = { carry, needed, ok: carry >= needed };
  cache.set(key, out);
  return out;
}

/** May you take corners at all? (The usual duty roll still decides each one.) */
export function canTakeCorners(skills: KickSkills): boolean {
  return cornerReach(skills).ok;
}
