// Canvas match engine — pure physics, no React, no rendering.
// Coordinate system (shared with lib/star/matchEngine.ts):
//   x: 0-100 (left-right), y: 0-100 (attacking goal at y=0, top), posts x=40..60.
//   1 unit = 1 metre. Height z in metres, crossbar at 2.44m.
// The flight is a real simulation: the OUTCOME is whatever the physics produces.

export interface Vec2 { x: number; y: number; }

export interface Ball {
  pos: Vec2;
  vel: Vec2;   // units/sec, horizontal plane
  z: number;   // metres above the turf
  vz: number;  // m/s vertical
  spin: number; // curl coefficient (sign = direction)
  resting: boolean;
}

export interface Scenario {
  ball: Vec2;
  player: Vec2;
  defenders: Vec2[];
  keeper: Vec2;
  keeperStartX: number;
  keeperTargetX: number; // where the keeper commits to on launch
  goal: { x1: number; x2: number };
  crossbar: number;
}

export type Outcome = "goal" | "saved" | "over" | "post" | "wide" | "blocked" | "out" | "short";

export interface KickSkills {
  power: number;      // 0-100
  technique: number;  // 0-100
}

export interface Contact { cx: number; cy: number; } // -1..1, cx=right, cy=down(bottom)

// --- Tunable constants (this is the "game feel" surface) ---
const G = 9.8;                 // gravity, m/s^2 (height only)
const GROUND_FRICTION = 15;    // units/s^2 while rolling
const AIR_DRAG = 0.2;          // per-second horizontal drag while airborne
const BOUNCE_VZ = 0.5;         // vertical restitution
const BOUNCE_H = 0.7;          // horizontal speed kept on bounce
const CURL_K = 0.022;          // Magnus-ish lateral bend strength
const KEEPER_REACH = 2.9;      // metres the keeper covers around himself
const KEEPER_DIVE_MAX = 12;    // max horizontal dive from start
const KEEPER_DIVE_SPEED = 28;  // units/sec dive speed

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalize(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

function rotateDeg(v: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

// Approx-normal noise in [-~2, ~2]
function gaussian(rng: () => number): number {
  return (rng() + rng() + rng() + rng() - 2) / 1;
}

// A central shooting chance with slight variation.
export function buildShootingScenario(rng: () => number): Scenario {
  const bx = 40 + rng() * 20;
  const by = 19 + rng() * 8;
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.6 },
    defenders: [
      { x: clamp(bx - 6 + rng() * 3, 32, 68), y: clamp(by - 6 - rng() * 3, 6, by - 2) },
      { x: clamp(bx + 6 - rng() * 3, 32, 68), y: clamp(by - 7 - rng() * 3, 6, by - 2) },
    ],
    keeper: { x: keeperX, y: 3.5 },
    keeperStartX: keeperX,
    keeperTargetX: keeperX,
    goal: { x1: 40, x2: 60 },
    crossbar: 2.44,
  };
}

function predictCrossX(from: Vec2, dir: Vec2): number {
  if (dir.y >= -0.001) return from.x; // not heading toward goal
  const s = -from.y / dir.y;
  return clamp(from.x + dir.x * s, 30, 70);
}

// Launch the ball from a slingshot aim + a contact point.
export function launch(
  scenario: Scenario,
  dir: Vec2,
  power: number,
  contact: Contact,
  skills: KickSkills,
  rng: () => number,
): Ball {
  const loft = clamp((contact.cy + 1) / 2, 0, 1); // 0 = struck top (driven), 1 = struck bottom (lofted)
  const tech = skills.technique;

  // Accuracy: technique tightens the launch angle. Power adds wobble.
  const sigmaDeg = (1 - tech / 100) * 4.5 + power * (1 - tech / 100) * 3;
  const noise = gaussian(rng) * sigmaDeg;
  const d = rotateDeg(normalize(dir), noise);

  // Horizontal launch speed. Lofting bleeds a little ground speed into the air.
  const Sh = power * (30 + skills.power * 0.3) * (1 - loft * 0.25);
  // Vertical launch speed from how low on the ball it was struck.
  const vz = loft * power * (9 + skills.power * 0.04);
  // Curl from striking the side of the ball, magnified by technique.
  const spin = contact.cx * (0.5 + tech / 100) * power;

  scenario.keeperTargetX = predictCrossX(scenario.ball, d);

  return {
    pos: { x: scenario.ball.x, y: scenario.ball.y },
    vel: { x: d.x * Sh, y: d.y * Sh },
    z: 0.08,
    vz,
    spin,
    resting: false,
  };
}

// Advance the keeper's dive toward its committed target.
export function stepKeeper(scenario: Scenario, dt: number) {
  const target = clamp(
    scenario.keeperTargetX,
    scenario.keeperStartX - KEEPER_DIVE_MAX,
    scenario.keeperStartX + KEEPER_DIVE_MAX,
  );
  const dx = target - scenario.keeper.x;
  const move = Math.sign(dx) * Math.min(Math.abs(dx), KEEPER_DIVE_SPEED * dt);
  scenario.keeper.x += move;
}

// Advance the ball one tick and return an Outcome if the play has resolved.
export function stepBall(ball: Ball, scenario: Scenario, dt: number): Outcome | null {
  if (ball.resting) return "short";

  const prevY = ball.pos.y;
  const prevX = ball.pos.x;
  const prevZ = ball.z;

  // --- Curl (lateral bend perpendicular to travel) ---
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  if (speed > 0.01 && Math.abs(ball.spin) > 0.0001) {
    // positive spin curves LEFT of travel (struck right side of ball)
    const ax = ball.spin * CURL_K * ball.vel.y;
    const ay = ball.spin * CURL_K * -ball.vel.x;
    ball.vel.x += ax * dt;
    ball.vel.y += ay * dt;
  }

  // --- Air drag while airborne ---
  if (ball.z > 0.02) {
    const k = Math.max(0, 1 - AIR_DRAG * dt);
    ball.vel.x *= k;
    ball.vel.y *= k;
  }

  // --- Gravity / height ---
  ball.vz -= G * dt;
  ball.z += ball.vz * dt;

  // --- Move on the plane ---
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  // --- Bounce / roll ---
  if (ball.z <= 0) {
    ball.z = 0;
    if (ball.vz < -1.2) {
      ball.vz = -ball.vz * BOUNCE_VZ;
      ball.vel.x *= BOUNCE_H;
      ball.vel.y *= BOUNCE_H;
    } else {
      ball.vz = 0;
    }
  }
  if (ball.z <= 0.03) {
    const s = Math.hypot(ball.vel.x, ball.vel.y);
    const drop = GROUND_FRICTION * dt;
    if (s <= drop) {
      ball.vel.x = 0;
      ball.vel.y = 0;
      ball.resting = true;
    } else {
      const f = (s - drop) / s;
      ball.vel.x *= f;
      ball.vel.y *= f;
    }
  }

  // --- Resolution ---
  // Defender block (only what they can reach, below head height).
  for (const d of scenario.defenders) {
    if (ball.z < 2.0 && Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y) < 1.7) {
      return "blocked";
    }
  }

  // Keeper save (before the goal line; must be low enough to be reachable).
  if (ball.z < 2.6 && Math.hypot(scenario.keeper.x - ball.pos.x, scenario.keeper.y - ball.pos.y) < KEEPER_REACH) {
    return "saved";
  }

  // Goal line crossing (interpolate the exact x and z at y=0).
  if (prevY > 0 && ball.pos.y <= 0) {
    const frac = prevY / (prevY - ball.pos.y);
    const xCross = prevX + (ball.pos.x - prevX) * frac;
    const zCross = prevZ + (ball.z - prevZ) * frac;
    const { x1, x2 } = scenario.goal;
    const crossbar = scenario.crossbar;
    if (xCross >= x1 && xCross <= x2) {
      if (zCross > crossbar + 0.12) return "over";
      if (zCross > crossbar - 0.12) return "post"; // clipped the bar
      return "goal";
    }
    if ((xCross >= x1 - 1.1 && xCross < x1) || (xCross > x2 && xCross <= x2 + 1.1)) return "post";
    return "wide";
  }

  // Out of bounds.
  if (ball.pos.x < -2 || ball.pos.x > 102 || ball.pos.y > 102) return "out";

  if (ball.resting) return "short";
  return null;
}

export const OUTCOME_TEXT: Record<Outcome, { text: string; kind: "goal" | "miss" | "neutral" }> = {
  goal: { text: "GOAL!", kind: "goal" },
  saved: { text: "Saved by the keeper!", kind: "miss" },
  over: { text: "Over the bar!", kind: "miss" },
  post: { text: "Off the woodwork!", kind: "miss" },
  wide: { text: "Wide of the mark!", kind: "miss" },
  blocked: { text: "Blocked!", kind: "miss" },
  out: { text: "Out of play.", kind: "neutral" },
  short: { text: "Didn't reach.", kind: "neutral" },
};
