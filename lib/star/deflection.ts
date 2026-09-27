/**
 * v0.15 item 16 — A BLOCK DOESN'T HAVE TO END THE HIGHLIGHT.
 *
 * Harry, in the playtest: "Sometimes it should deflect, or rebound to one of
 * your players." And on the plan: "I also think sometimes it should be able to
 * bounce off into the goal at a weird angle."
 *
 * Today a shot that hits a defender is cleared up the pitch on the spot and the
 * chance ends ("BLOCKED"). This turns that moment into a DEFLECTION: the ball
 * comes off him at a new angle as a loose ball, and the match's normal rules
 * decide who gets it — a team-mate who is nearer collects it, a defender who is
 * nearer wins it, the keeper deals with one that still goes at goal, and one
 * that glances on past a keeper who was set for the original line can go in.
 *
 * Nothing in the core engine file (lib/star/canvasEngine.ts) changes. The
 * engine has already cleared the ball when it reports "blocked"; this is called
 * straight after, with the ball as it was a moment BEFORE the block, and puts
 * the ball back into play by setting only the public fields any rebound uses.
 *
 * Seeded: CanvasMatch hands it a stream derived from the chance's own seed, so
 * a replay deflects exactly the same way.
 */
import { markLanding, type Ball, type Scenario } from "./canvasEngine";

/** The ball a moment before the defender got to it. */
export interface IncomingBall { vx: number; vy: number; vz: number; z: number; spin: number }

export type DeflectionKind = "glance" | "loop" | "loose";

/**
 * How a block comes off a defender, of every 100:
 *   22 glance on — a touch that changes its line and takes some pace off it;
 *      still going roughly goalwards, and the keeper was set for the old line;
 *   20 loop     — off a knee or a thigh and up in the air, dropping somewhere
 *      in or around the box (sometimes over the keeper, sometimes over the bar);
 *   58 loose    — straight back out or sideways off him, a loose ball in the
 *      area for whoever is nearest.
 */
export const DEFLECTION_MIX = { glance: 0.22, loop: 0.20 } as const;

const DEG = Math.PI / 180;

export function deflectBlock(ball: Ball, sc: Scenario, pre: IncomingBall, r: () => number): DeflectionKind {
  const s0 = Math.max(6, Math.hypot(pre.vx, pre.vy));
  const a0 = Math.atan2(pre.vy, pre.vx);
  const u = r();
  const side = r() < 0.5 ? -1 : 1;
  let kind: DeflectionKind, a: number, s: number, vz: number;
  if (u < DEFLECTION_MIX.glance) {
    kind = "glance";
    a = a0 + side * (8 + r() * 22) * DEG;
    s = s0 * (0.5 + r() * 0.25);
    vz = Math.max(0, pre.vz) * 0.4 + r() * 2.2;
  } else if (u < DEFLECTION_MIX.glance + DEFLECTION_MIX.loop) {
    kind = "loop";
    a = a0 + side * r() * 45 * DEG;
    s = s0 * (0.15 + r() * 0.17);
    vz = 5 + r() * 3;
  } else {
    kind = "loose";
    a = a0 + Math.PI + side * r() * 75 * DEG;
    s = s0 * (0.22 + r() * 0.3);
    vz = r() * 2.4;
  }
  ball.vel = { x: Math.cos(a) * s, y: Math.sin(a) * s };
  ball.vz = vz;
  ball.z = Math.max(ball.z, Math.min(pre.z, 1.2));
  ball.spin = pre.spin * 0.3 + (r() - 0.5) * 0.4;
  ball.topspin = 0;
  ball.resting = false;
  ball.settling = false;
  // A live, loose ball that belongs to nobody: exactly what a parry leaves.
  ball.loose = true;
  ball.shot = false;
  ball.owner = "none";
  ball.lastTouch = "defence";
  // Long enough to leave the man it came off, short enough that anyone else
  // near it can have it straight away.
  ball.contactCd = 0.22;
  markLanding(ball, sc);
  return kind;
}
