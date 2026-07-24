// Canvas match engine — pure physics, no React, no rendering.
// Coordinate system (shared with lib/star/matchEngine.ts):
//   x: 0-100 (left-right), y: 0-100 (attacking goal at y=0, top), posts x=40..60.
//   1 unit = 1 metre. Height z in metres, crossbar at 2.44m.
// The flight is a real simulation: the OUTCOME is whatever the physics produces.
// Keeper, defenders and rebounds are all driven off the same ball state that the
// renderer draws, so what you see is what resolves.

export interface Vec2 { x: number; y: number; }

export interface Ball {
  pos: Vec2;
  vel: Vec2;   // units/sec, horizontal plane
  z: number;   // metres above the turf
  vz: number;  // m/s vertical
  spin: number; // curl coefficient (sign = direction)
  resting: boolean;
  loose: boolean;      // true once the ball has been parried/deflected and is a live rebound
  contactCd: number;   // seconds of immunity from another deflection/save (prevents same-frame re-trigger)
}

// A goalkeeper that slides + dives along its line and stretches to reach the ball.
export interface Keeper {
  x: number;
  y: number;
  startX: number;
  targetX: number;   // committed crossing x the keeper dives for
  dive: number;      // signed dive extension in metres (for rendering the lunge)
  saves: number;     // save attempts already spent on this ball (each one weakens the next)
  done: boolean;     // caught / tipped — keeper is out of the equation
  flash: number;     // seconds of "just made contact" glow (render only)
}

// A poacher lurking for the rebound.
export interface Follower {
  x: number;
  y: number;
  active: boolean;   // currently chasing a loose ball
  shot: boolean;     // already took its follow-up
}

// The kind of match situation the player has been put in. Shooting kinds
// (one_on_one..header) resolve at the goal line as before. Passing kinds
// (cutback..midfield_pass) instead resolve against a passTarget reception
// zone — same physics, different success condition.
export const SCENARIO_KINDS = [
  "one_on_one", "tight_angle", "long_range", "volley", "header",
  "cutback", "byline_cross", "through_ball", "midfield_pass",
] as const;
export type ScenarioKind = typeof SCENARIO_KINDS[number];

export interface Scenario {
  ball: Vec2;
  player: Vec2;
  defenders: Vec2[];
  keeper: Keeper;
  keeperStrength: number;   // 0-100 — better keepers cover more of the goal
  follower: Follower;
  goal: { x1: number; x2: number };
  crossbar: number;
  kind: ScenarioKind;
  teammates: Vec2[];        // decorative runners/crossers, and/or the pass target
  passTarget: Vec2 | null;  // set for passing kinds — reach this zone to succeed
}

export type Outcome =
  | "goal" | "rebound" | "delivered" | "saved" | "caught" | "tipped"
  | "over" | "post" | "wide" | "blocked" | "out" | "short";

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
const CURL_K = 0.09;           // Magnus-ish lateral bend strength

const SHOT_REF_SPEED = 60;     // roughly the fastest launch speed; used to normalise "fast shots"
const KEEPER_DIVE_MAX = 13;    // metres of goal the keeper can cover with a dive
const KEEPER_DIVE_SPEED = 16;  // units/sec slide/dive speed
const KEEPER_VREACH = 2.7;     // highest ball the keeper can paw at (top-bin shots clear this)
const KEEPER_REACH_MIN = 1.25; // reach floor (metres) even for a weak, wrong-footed keeper
const KEEPER_REACH_MAX = 2.65; // reach ceiling for a top keeper on a comfortable shot

const DEF_BLOCK_R = 1.45;      // how close the ball must pass a defender to hit them
const DEF_BLOCK_H = 2.1;       // defenders can only block below head/torso height — chip over to beat them

const FOLLOWER_SPEED = 15;     // rebound poacher run speed, units/sec

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

// --- Shared scenario scaffolding ---
const GOAL = { x1: 40, x2: 60 };
const CROSSBAR = 2.44;

function makeKeeper(x: number, y = 3.5): Keeper {
  return { x, y, startX: x, targetX: x, dive: 0, saves: 0, done: false, flash: 0 };
}

function makeFollower(rng: () => number, by: number): Follower {
  return {
    x: clamp(50 + (rng() < 0.5 ? -1 : 1) * (4 + rng() * 4), 40, 60),
    y: clamp(by * 0.5, 8, 14),
    active: false, shot: false,
  };
}

// A clean run in behind — keeper rushes off his line to close the angle.
function buildOneOnOne(rng: () => number, keeperStrength: number): Scenario {
  const bx = 44 + rng() * 12;
  const by = 11 + rng() * 5;
  const keeperX = clamp(bx + (rng() - 0.5) * 6, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.4 },
    defenders: [
      { x: clamp(bx - 10 + rng() * 8, 20, 80), y: by + 10 + rng() * 6 }, // trailing, out of the lane
    ],
    keeper: makeKeeper(keeperX, 6.5 + rng() * 2),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "one_on_one", teammates: [], passTarget: null,
  };
}

// Wide and close to the byline — an acute angle, keeper shaded to the near post.
function buildTightAngle(rng: () => number, keeperStrength: number): Scenario {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 32 + rng() * 5 : 63 + rng() * 5;
  const by = 7 + rng() * 5;
  const keeperX = clamp(bx - side * 3, 40, 60);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders: [
      { x: clamp(50 - side * 6, 35, 65), y: clamp(by + 3, 6, 14) }, // covering the cutback/far post
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "tight_angle", teammates: [], passTarget: null,
  };
}

// Well outside the box — needs pace, and a defensive screen to bend or chip around.
function buildLongRange(rng: () => number, keeperStrength: number): Scenario {
  const bx = 38 + rng() * 24;
  const by = 32 + rng() * 10;
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.6 },
    defenders: [
      { x: clamp(bx - 4 + rng() * 8, 38, 62), y: clamp(by - 12 - rng() * 4, 16, by - 6) },
      { x: clamp(bx + 8 - rng() * 4, 30, 70), y: clamp(by - 8 - rng() * 4, 14, by - 4) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "long_range", teammates: [], passTarget: null,
  };
}

// Edge of the box, ball arriving from a cross — meet it first time.
function buildVolley(rng: () => number, keeperStrength: number): Scenario {
  const bx = 42 + rng() * 16;
  const by = 15 + rng() * 6;
  const side = rng() < 0.5 ? -1 : 1;
  const crosser = { x: side < 0 ? 8 + rng() * 6 : 86 + rng() * 6, y: 10 + rng() * 4 };
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 0.6 },
    defenders: [
      { x: clamp(bx - 5 + rng() * 3, 34, 66), y: clamp(by - 2, 8, by) },
      { x: clamp(bx + 5 - rng() * 3, 34, 66), y: clamp(by - 3, 8, by) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "volley", teammates: [crosser], passTarget: null,
  };
}

// Six-yard box, meeting a cross with your head — tight marking.
function buildHeader(rng: () => number, keeperStrength: number): Scenario {
  const bx = 44 + rng() * 12;
  const by = 4 + rng() * 4;
  const side = rng() < 0.5 ? -1 : 1;
  const crosser = { x: side < 0 ? 6 + rng() * 6 : 88 + rng() * 6, y: 8 + rng() * 4 };
  const keeperX = clamp(bx + (rng() - 0.5) * 4, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 0.4 },
    defenders: [
      { x: clamp(bx - 3 + rng() * 6, 38, 62), y: clamp(by + 1, 3, 10) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "header", teammates: [crosser], passTarget: null,
  };
}

// Byline, squaring the ball back for a teammate arriving at the penalty spot.
function buildCutback(rng: () => number, keeperStrength: number): Scenario {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 10 + rng() * 6 : 84 + rng() * 6;
  const by = 5 + rng() * 4;
  const target = { x: 46 + rng() * 8, y: 15 + rng() * 5 };
  const keeperX = clamp(50 + (rng() - 0.5) * 4, 44, 56);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1 },
    defenders: [
      { x: clamp(target.x - side * 5, 34, 66), y: clamp(target.y - 2, 8, 16) }, // covering the cutback lane
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "cutback", teammates: [target], passTarget: target,
  };
}

// Corner-flag area, whipping a cross in for a run at the near/far post.
function buildBylineCross(rng: () => number, keeperStrength: number): Scenario {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 2 + rng() * 5 : 93 + rng() * 5;
  const by = 3 + rng() * 4;
  const target = { x: 42 + rng() * 16, y: 8 + rng() * 5 };
  const keeperX = clamp(50 - side * 3, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1 },
    defenders: [
      { x: clamp(target.x - side * 3, 36, 64), y: clamp(target.y, 6, 13) }, // marking the run
      { x: clamp(50 + side * 4, 38, 62), y: clamp(target.y + 3, 8, 16) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "byline_cross", teammates: [target], passTarget: target,
  };
}

// Central midfield, splitting the defense for a teammate breaking in behind.
function buildThroughBall(rng: () => number, keeperStrength: number): Scenario {
  const bx = 40 + rng() * 20;
  const by = 32 + rng() * 10;
  const target = { x: 44 + rng() * 12, y: 12 + rng() * 5 };
  const lineY = clamp((by + target.y) / 2, 20, 30);
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.6 },
    defenders: [
      { x: clamp(bx - 6 + rng() * 4, 34, 50), y: lineY }, // the line the ball must be threaded past
      { x: clamp(bx + 6 - rng() * 4, 50, 66), y: lineY + 2 },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "through_ball", teammates: [target], passTarget: target,
  };
}

// Deep and safe — simple recycling pass, "no goal" in this situation.
function buildMidfieldPass(rng: () => number, keeperStrength: number): Scenario {
  const bx = 30 + rng() * 40;
  const by = 44 + rng() * 14;
  const target = { x: clamp(bx + (rng() - 0.5) * 20, 15, 85), y: clamp(by - 6 - rng() * 6, 30, 52) };
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.4 },
    defenders: [
      { x: clamp((bx + target.x) / 2 + (rng() - 0.5) * 6, 20, 80), y: clamp((by + target.y) / 2, 36, 54) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "midfield_pass", teammates: [target], passTarget: target,
  };
}

// Build one scenario of a given kind.
export function buildScenario(kind: ScenarioKind, rng: () => number, keeperStrength = 62): Scenario {
  const ks = clamp(keeperStrength, 0, 100);
  switch (kind) {
    case "one_on_one": return buildOneOnOne(rng, ks);
    case "tight_angle": return buildTightAngle(rng, ks);
    case "long_range": return buildLongRange(rng, ks);
    case "volley": return buildVolley(rng, ks);
    case "header": return buildHeader(rng, ks);
    case "cutback": return buildCutback(rng, ks);
    case "byline_cross": return buildBylineCross(rng, ks);
    case "through_ball": return buildThroughBall(rng, ks);
    case "midfield_pass": return buildMidfieldPass(rng, ks);
  }
}

// How often each scenario kind shows up, by the player's position. Attackers see
// mostly finishing chances; wide players get more crosses/cutbacks; central and
// deep players get more through-balls and safe build-up passes.
const DEFAULT_WEIGHTS: Record<ScenarioKind, number> = {
  one_on_one: 11, tight_angle: 11, long_range: 11, volley: 11, header: 11,
  cutback: 11, byline_cross: 11, through_ball: 11, midfield_pass: 11,
};

const POSITION_WEIGHTS: Record<string, Record<ScenarioKind, number>> = {
  ST:  { one_on_one: 22, tight_angle: 16, long_range: 8,  volley: 16, header: 18, cutback: 6,  byline_cross: 2,  through_ball: 8,  midfield_pass: 4 },
  CAM: { one_on_one: 16, tight_angle: 12, long_range: 14, volley: 12, header: 10, cutback: 8,  byline_cross: 4,  through_ball: 16, midfield_pass: 8 },
  LW:  { one_on_one: 14, tight_angle: 16, long_range: 8,  volley: 10, header: 6,  cutback: 12, byline_cross: 18, through_ball: 8,  midfield_pass: 8 },
  RW:  { one_on_one: 14, tight_angle: 16, long_range: 8,  volley: 10, header: 6,  cutback: 12, byline_cross: 18, through_ball: 8,  midfield_pass: 8 },
  CM:  { one_on_one: 6,  tight_angle: 4,  long_range: 14, volley: 6,  header: 4,  cutback: 8,  byline_cross: 6,  through_ball: 20, midfield_pass: 32 },
  LM:  { one_on_one: 8,  tight_angle: 10, long_range: 8,  volley: 6,  header: 4,  cutback: 12, byline_cross: 20, through_ball: 12, midfield_pass: 20 },
  RM:  { one_on_one: 8,  tight_angle: 10, long_range: 8,  volley: 6,  header: 4,  cutback: 12, byline_cross: 20, through_ball: 12, midfield_pass: 20 },
  CDM: { one_on_one: 3,  tight_angle: 2,  long_range: 16, volley: 3,  header: 4,  cutback: 4,  byline_cross: 4,  through_ball: 16, midfield_pass: 48 },
  CB:  { one_on_one: 2,  tight_angle: 1,  long_range: 6,  volley: 2,  header: 10, cutback: 2,  byline_cross: 2,  through_ball: 8,  midfield_pass: 67 },
  LB:  { one_on_one: 3,  tight_angle: 3,  long_range: 4,  volley: 2,  header: 4,  cutback: 8,  byline_cross: 24, through_ball: 10, midfield_pass: 42 },
  RB:  { one_on_one: 3,  tight_angle: 3,  long_range: 4,  volley: 2,  header: 4,  cutback: 8,  byline_cross: 24, through_ball: 10, midfield_pass: 42 },
  GK:  { one_on_one: 0,  tight_angle: 0,  long_range: 2,  volley: 0,  header: 0,  cutback: 0,  byline_cross: 0,  through_ball: 8,  midfield_pass: 90 },
};

export function pickScenarioKind(position: string, rng: () => number): ScenarioKind {
  const weights = POSITION_WEIGHTS[position] ?? DEFAULT_WEIGHTS;
  const total = SCENARIO_KINDS.reduce((sum, k) => sum + weights[k], 0);
  let roll = rng() * total;
  for (const k of SCENARIO_KINDS) {
    roll -= weights[k];
    if (roll <= 0) return k;
  }
  return SCENARIO_KINDS[SCENARIO_KINDS.length - 1];
}

// Pick a scenario kind weighted by position, then build it — the single entry
// point the UI needs for spawning the next situation.
export function buildWeightedScenario(rng: () => number, position: string, keeperStrength = 62): Scenario {
  const kind = pickScenarioKind(position, rng);
  return buildScenario(kind, rng, keeperStrength);
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

  // Keeper commits to the predicted crossing point.
  scenario.keeper.targetX = predictCrossX(scenario.ball, d);

  return {
    pos: { x: scenario.ball.x, y: scenario.ball.y },
    vel: { x: d.x * Sh, y: d.y * Sh },
    z: 0.08,
    vz,
    spin,
    resting: false,
    loose: false,
    contactCd: 0,
  };
}

// Advance the keeper's slide/dive toward its committed target.
export function stepKeeper(scenario: Scenario, dt: number) {
  const k = scenario.keeper;
  if (k.flash > 0) k.flash = Math.max(0, k.flash - dt);
  if (k.done) return;

  const target = clamp(k.targetX, k.startX - KEEPER_DIVE_MAX, k.startX + KEEPER_DIVE_MAX);
  const dx = target - k.x;
  // A keeper already committed to one save recovers a touch slower for the next.
  const speed = KEEPER_DIVE_SPEED * (k.saves > 0 ? 0.78 : 1);
  const move = Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
  k.x += move;
  // Dive extension eases toward how far he is from his standing spot.
  const wanted = clamp(k.x - k.startX, -KEEPER_DIVE_MAX, KEEPER_DIVE_MAX);
  k.dive += (wanted - k.dive) * Math.min(1, dt * 12);
}

// Advance the rebound poacher. Chases a loose ball and pokes a follow-up goalward.
export function stepFollower(scenario: Scenario, ball: Ball, rng: () => number, dt: number) {
  const f = scenario.follower;
  if (f.shot) return;

  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const dangerous = ball.loose && !ball.resting && ball.pos.y < 16 && speed < 42;
  if (!f.active && dangerous) f.active = true;
  if (!f.active) return;

  // Run onto the loose ball.
  const dx = ball.pos.x - f.x, dy = ball.pos.y - f.y;
  const dist = Math.hypot(dx, dy) || 1;
  const step = FOLLOWER_SPEED * dt;
  if (dist > step) {
    f.x += (dx / dist) * step;
    f.y += (dy / dist) * step;
  } else {
    f.x = ball.pos.x; f.y = ball.pos.y;
  }

  // Close enough and the ball is low → take the second chance.
  if (dist < 1.6 && ball.z < 1.7) {
    const tx = 44 + rng() * 12;                 // aim somewhere across the goal
    const dir = normalize({ x: tx - ball.pos.x, y: -ball.pos.y - 0.001 });
    const sp = 32 + rng() * 12;
    ball.vel = { x: dir.x * sp, y: dir.y * sp };
    ball.vz = 0.3 + rng() * 0.7;
    ball.spin *= 0.3;
    ball.loose = false;                         // a fresh shot — but it still counts as a rebound if it goes in
    ball.contactCd = 0.18;
    f.shot = true;
    // Keeper reacts late, already out of position from the first save.
    scenario.keeper.targetX = predictCrossX(ball.pos, dir);
  }
}

// The keeper's effective reach shrinks against pace, corners and elevation.
function keeperReach(scenario: Scenario, ball: Ball, speed: number): number {
  const base = KEEPER_REACH_MIN + (scenario.keeperStrength / 100) * (KEEPER_REACH_MAX - KEEPER_REACH_MIN);
  const speedPen = clamp(speed / SHOT_REF_SPEED, 0, 1);            // fierce shots are harder to reach
  const cornerPen = clamp(Math.abs(ball.pos.x - 50) / 10, 0, 1);  // shots into the corners stretch him
  const heightPen = clamp(ball.z / KEEPER_VREACH, 0, 1);          // high shots into the top bins
  const wear = Math.max(0.35, 1 - 0.4 * scenario.keeper.saves);   // each prior save leaves him grounded
  return base * (1 - speedPen * 0.42) * (1 - cornerPen * 0.28) * (1 - heightPen * 0.30) * wear;
}

// Resolve a keeper contact into catch / parry / tip. Returns a terminal Outcome
// for catch/tip, or null when the ball is parried and stays live.
function resolveKeeper(ball: Ball, scenario: Scenario, dist: number, reach: number, speed: number, rng: () => number): Outcome | null {
  const k = scenario.keeper;
  k.saves += 1;
  k.flash = 0.35;
  const marginNorm = clamp((reach - dist) / reach, 0, 1); // 1 = right at the body, 0 = full stretch
  const lowAndSlow = speed < 30 && ball.z < 1.2;

  // Comfortable, gathered save.
  if (marginNorm > 0.5 && lowAndSlow && rng() < 0.72) {
    ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.resting = true;
    k.done = true;
    return "caught";
  }

  // Full-stretch, high or fierce → tip it to safety (over the bar / around the post).
  if (marginNorm < 0.24 || ball.z > 1.85 || speed > 46) {
    ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.resting = true;
    k.done = true;
    return "tipped";
  }

  // Otherwise: a parry that stays in play.
  const away = normalize({ x: ball.pos.x - k.x, y: ball.pos.y - k.y });
  const dangerous = rng() < 0.34; // sometimes spilled straight back into the danger zone
  // Safe parries go wide + downfield; dangerous ones drop short and central.
  const fwd: Vec2 = dangerous ? { x: 0, y: 0.5 } : { x: 0, y: 1 };
  const lat = (rng() - 0.5) * (dangerous ? 0.6 : 1.4);
  let dir = normalize({ x: away.x * 0.6 + fwd.x + lat, y: away.y * 0.6 + fwd.y });
  // Keep the parry in front of goal — a keeper rarely paws it back over his own line.
  const minY = dangerous ? 0.05 : 0.25;
  if (dir.y < minY) dir = normalize({ x: dir.x, y: minY });
  const newSpeed = speed * (dangerous ? 0.22 + rng() * 0.12 : 0.4 + rng() * 0.2);
  ball.vel = { x: dir.x * newSpeed, y: dir.y * newSpeed };
  ball.vz = 0.6 + rng() * 1.6; // the ball pops up off the parry
  ball.spin *= 0.4;
  ball.loose = true;
  ball.contactCd = 0.28;
  // Keeper scrambles back toward where the ball spills.
  k.targetX = ball.pos.x;
  return null;
}

// A defender in the way deflects the ball rather than swallowing it.
function deflectOffDefender(ball: Ball, d: Vec2, speed: number, rng: () => number): boolean {
  const n = normalize({ x: ball.pos.x - d.x, y: ball.pos.y - d.y }); // outward from defender
  const vn = ball.vel.x * n.x + ball.vel.y * n.y;
  if (vn >= 0) return false; // already moving away — no real contact
  // Reflect the incoming component, then damp: a genuine deflection, not a wall.
  const damp = 0.42 + rng() * 0.22;
  const jitter = (rng() - 0.5) * 6;
  ball.vel = {
    x: (ball.vel.x - 2 * vn * n.x) * damp + jitter * 0.15,
    y: (ball.vel.y - 2 * vn * n.y) * damp,
  };
  ball.vz += 0.8 + rng() * 1.4;    // deflections loop up off shins/knees
  ball.spin *= 0.5;
  ball.loose = true;
  ball.contactCd = 0.3;
  ball.pos.x += n.x * 0.25;        // nudge clear so it doesn't re-trigger
  ball.pos.y += n.y * 0.25;
  return true;
}

// Advance the ball one tick and return an Outcome if the play has resolved.
export function stepBall(ball: Ball, scenario: Scenario, rng: () => number, dt: number): Outcome | null {
  if (ball.resting) return "short";

  const prevY = ball.pos.y;
  const prevX = ball.pos.x;
  const prevZ = ball.z;
  if (ball.contactCd > 0) ball.contactCd = Math.max(0, ball.contactCd - dt);

  // --- Curl (lateral bend perpendicular to travel) ---
  const speed0 = Math.hypot(ball.vel.x, ball.vel.y);
  if (speed0 > 0.01 && Math.abs(ball.spin) > 0.0001) {
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

  const speed = Math.hypot(ball.vel.x, ball.vel.y);

  // --- Defender deflection (only below head height, and only what they can reach) ---
  if (ball.contactCd <= 0 && ball.z < DEF_BLOCK_H && speed > 8) {
    for (const d of scenario.defenders) {
      if (Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y) < DEF_BLOCK_R) {
        deflectOffDefender(ball, d, speed, rng);
        break;
      }
    }
  }

  // --- Keeper save (before the goal line; must be low enough to be reachable) ---
  const k = scenario.keeper;
  if (!k.done && ball.contactCd <= 0 && ball.z < KEEPER_VREACH && ball.pos.y > 0.2) {
    const reach = keeperReach(scenario, ball, speed);
    const dist = Math.hypot(k.x - ball.pos.x, k.y - ball.pos.y);
    if (dist < reach) {
      const res = resolveKeeper(ball, scenario, dist, reach, speed, rng);
      if (res) return res; // caught or tipped
      // parried — ball is loose, keep simulating this tick
    }
  }

  // --- Pass delivery (cutback / cross / through-ball / midfield pass) ---
  if (scenario.passTarget && ball.z < 3.2) {
    const dist = Math.hypot(scenario.passTarget.x - ball.pos.x, scenario.passTarget.y - ball.pos.y);
    if (dist < 2.4) return "delivered";
  }

  // --- Goal line crossing (interpolate the exact x and z at y=0) ---
  if (prevY > 0 && ball.pos.y <= 0) {
    const frac = prevY / (prevY - ball.pos.y);
    const xCross = prevX + (ball.pos.x - prevX) * frac;
    const zCross = prevZ + (ball.z - prevZ) * frac;
    const { x1, x2 } = scenario.goal;
    const crossbar = scenario.crossbar;
    if (xCross >= x1 && xCross <= x2) {
      if (zCross > crossbar + 0.12) return "over";
      if (zCross > crossbar - 0.12) return "post"; // clipped the bar
      // A ball that beat the keeper and crossed the line — rebound if it had been spilled.
      return ball.loose ? "rebound" : "goal";
    }
    if ((xCross >= x1 - 1.1 && xCross < x1) || (xCross > x2 && xCross <= x2 + 1.1)) return "post";
    return "wide";
  }

  // Out of bounds.
  if (ball.pos.x < -2 || ball.pos.x > 102 || ball.pos.y > 102) return "out";

  if (ball.resting) return "short";
  return null;
}

export const OUTCOME_TEXT: Record<Outcome, { text: string; kind: "goal" | "pass" | "miss" | "neutral" }> = {
  goal: { text: "GOAL!", kind: "goal" },
  rebound: { text: "GOAL — rebound!", kind: "goal" },
  delivered: { text: "Picked out the run!", kind: "pass" },
  saved: { text: "Saved by the keeper!", kind: "miss" },
  caught: { text: "Caught by the keeper!", kind: "miss" },
  tipped: { text: "Tipped to safety!", kind: "miss" },
  over: { text: "Over the bar!", kind: "miss" },
  post: { text: "Off the woodwork!", kind: "miss" },
  wide: { text: "Wide of the mark!", kind: "miss" },
  blocked: { text: "Blocked!", kind: "miss" },
  out: { text: "Out of play.", kind: "neutral" },
  short: { text: "Scrambled clear.", kind: "neutral" },
};
