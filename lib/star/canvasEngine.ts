// Canvas match engine — pure physics, no React, no rendering.
// Coordinate system:
//   x: 0-100 (left-right), y: 0-100 (attacking goal at y=0, top), posts x=40..60.
//   1 unit = 1 metre. Height z in metres, crossbar at 2.44m.
// The flight is a real simulation: the OUTCOME is whatever the physics produces.
// Keeper, defenders and rebounds are all driven off the same ball state that the
// renderer draws, so what you see is what resolves.

export interface Vec2 { x: number; y: number; }
export interface Viewport { x1: number; x2: number; y1: number; y2: number; }

// A moment worth narrating, surfaced from the physics tick to the UI once and consumed.
export type BallEvent = "received" | "receiverShot";

export interface Ball {
  pos: Vec2;
  vel: Vec2;   // units/sec, horizontal plane
  z: number;   // metres above the turf
  vz: number;  // m/s vertical
  spin: number; // curl coefficient (sign = direction)
  resting: boolean;
  loose: boolean;      // true once the ball has been parried/deflected and is a live rebound
  contactCd: number;   // seconds of immunity from another deflection/save (prevents same-frame re-trigger)
  receiverControlT: number; // seconds a teammate spends controlling a received pass before shooting
  event: BallEvent | null;  // one-shot flag for the UI to narrate, cleared once read
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
  "penalty", "free_kick", "corner", "buildup",
] as const;
export type ScenarioKind = typeof SCENARIO_KINDS[number];

// The teammate on the end of a cutback/cross/through-ball — their own shot is
// simulated once they receive it, so this is their finishing quality baseline.
export interface Receiver {
  skill: number;     // 0-100 baseline finishing quality, rolled by role
  roleLabel: string; // e.g. "the striker" — used in commentary
}

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
  receiver: Receiver | null;   // set for cutback/byline_cross/through_ball — they shoot on reception
  receiverDone: boolean;       // true once the ball has reached passTarget (guards re-trigger)
  teamRelationship: number;    // 0-100 — how well the team combines, feeds the receiver's shot quality
  viewport: Viewport;
  secondaryPassTargets: Vec2[];
  passDifficulty: number;       // 0-1, set when a pass resolves — harder pass = higher ball-return chance
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
const CURL_K = 0.30;           // Magnus-ish lateral bend strength (bending around defenders is a core skill)

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

// Compute a camera viewport that tightly frames all entities in a scenario,
// maintaining a 3:4 aspect ratio to match the canvas.
function autoViewport(points: Vec2[], includeGoal: boolean): Viewport {
  const all = [...points];
  if (includeGoal) {
    all.push({ x: 40, y: 0 }, { x: 60, y: 0 });
  }
  let x1 = Math.min(...all.map(p => p.x));
  let x2 = Math.max(...all.map(p => p.x));
  let y1 = Math.min(...all.map(p => p.y));
  let y2 = Math.max(...all.map(p => p.y));
  const padX = Math.max(8, (x2 - x1) * 0.18);
  const padY = Math.max(6, (y2 - y1) * 0.18);
  x1 -= padX; x2 += padX; y1 -= padY; y2 += padY;
  const aspect = 3 / 4;
  const w = x2 - x1, h = y2 - y1;
  if (w / h > aspect) { const e = w / aspect - h; y1 -= e / 2; y2 += e / 2; }
  else { const e = h * aspect - w; x1 -= e / 2; x2 += e / 2; }
  return { x1: Math.max(-8, x1), x2: Math.min(108, x2), y1: Math.max(-8, y1), y2: Math.min(105, y2) };
}

function scenarioViewport(sc: { ball: Vec2; player: Vec2; defenders: Vec2[]; teammates: Vec2[]; keeper: { x: number; y: number }; passTarget: Vec2 | null; kind: ScenarioKind }): Viewport {
  const pts: Vec2[] = [sc.ball, sc.player, { x: sc.keeper.x, y: sc.keeper.y }];
  for (const d of sc.defenders) pts.push(d);
  for (const t of sc.teammates) pts.push(t);
  if (sc.passTarget) pts.push(sc.passTarget);
  const showGoal = sc.kind !== "buildup" && sc.kind !== "midfield_pass";
  return autoViewport(pts, showGoal);
}

const DEFAULT_VP: Viewport = { x1: -5, x2: 105, y1: -5, y2: 100 };

// Who's on the end of a cutback/cross/through-ball, and their rough finishing quality.
const RECEIVER_ROLES: Partial<Record<ScenarioKind, { label: string; skillMin: number; skillMax: number }[]>> = {
  cutback: [
    { label: "the striker", skillMin: 62, skillMax: 90 },
    { label: "the attacking midfielder", skillMin: 55, skillMax: 82 },
  ],
  byline_cross: [
    { label: "the striker", skillMin: 55, skillMax: 85 },
    { label: "the center-back", skillMin: 40, skillMax: 68 },
  ],
  through_ball: [
    { label: "the striker", skillMin: 58, skillMax: 88 },
    { label: "the winger", skillMin: 52, skillMax: 80 },
  ],
  corner: [
    { label: "the center-back", skillMin: 45, skillMax: 72 },
    { label: "the striker", skillMin: 55, skillMax: 82 },
  ],
};

function rollReceiver(kind: ScenarioKind, rng: () => number): Receiver | null {
  const options = RECEIVER_ROLES[kind];
  if (!options) return null;
  const pick = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
  return { skill: pick.skillMin + rng() * (pick.skillMax - pick.skillMin), roleLabel: pick.label };
}

// A clean run in behind — keeper rushes off his line to close the angle.
function buildOneOnOne(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 44 + rng() * 12;
  const by = 11 + rng() * 5;
  const keeperX = clamp(bx + (rng() - 0.5) * 6, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.4 },
    defenders: [
      { x: clamp(bx - 10 + rng() * 8, 20, 80), y: by + 10 + rng() * 6 },
    ],
    keeper: makeKeeper(keeperX, 6.5 + rng() * 2),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "one_on_one" as const, teammates: [], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Wide and close to the byline — an acute angle, keeper shaded to the near post.
function buildTightAngle(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 32 + rng() * 5 : 63 + rng() * 5;
  const by = 7 + rng() * 5;
  const keeperX = clamp(bx - side * 3, 40, 60);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders: [
      { x: clamp(50 - side * 6, 35, 65), y: clamp(by + 3, 6, 14) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "tight_angle" as const, teammates: [], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Well outside the box — needs pace, and a defensive screen to bend or chip around.
function buildLongRange(rng: () => number, keeperStrength: number, teamRelationship: number) {
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
    kind: "long_range" as const, teammates: [], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Edge of the box, ball arriving from a cross — meet it first time.
function buildVolley(rng: () => number, keeperStrength: number, teamRelationship: number) {
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
    kind: "volley" as const, teammates: [crosser], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Six-yard box, meeting a cross with your head — tight marking.
function buildHeader(rng: () => number, keeperStrength: number, teamRelationship: number) {
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
    kind: "header" as const, teammates: [crosser], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Byline, squaring the ball back for a teammate arriving at the penalty spot —
// they take their own shot the instant it reaches their feet.
function buildCutback(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 10 + rng() * 6 : 84 + rng() * 6;
  const by = 5 + rng() * 4;
  const target = { x: 46 + rng() * 8, y: 15 + rng() * 5 };
  const keeperX = clamp(50 + (rng() - 0.5) * 4, 44, 56);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1 },
    defenders: [
      { x: clamp(target.x - side * 5, 34, 66), y: clamp(target.y - 2, 8, 16) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "cutback" as const, teammates: [target], passTarget: target,
    receiver: rollReceiver("cutback", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Corner-flag area, whipping a cross in for a run at the near/far post — the
// runner meets it and shoots the instant it arrives.
function buildBylineCross(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 2 + rng() * 5 : 93 + rng() * 5;
  const by = 3 + rng() * 4;
  const target = { x: 42 + rng() * 16, y: 8 + rng() * 5 };
  const keeperX = clamp(50 - side * 3, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1 },
    defenders: [
      { x: clamp(target.x - side * 3, 36, 64), y: clamp(target.y, 6, 13) },
      { x: clamp(50 + side * 4, 38, 62), y: clamp(target.y + 3, 8, 16) },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "byline_cross" as const, teammates: [target], passTarget: target,
    receiver: rollReceiver("byline_cross", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Central midfield, splitting the defense for a teammate breaking in behind —
// they run onto it and shoot first time. The teammate starts BEHIND (higher y
// than) the defensive line to look onside — the purple target zone is the space
// they'll run into.
function buildThroughBall(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 40 + rng() * 20;
  const by = 32 + rng() * 10;
  const lineY = clamp(by - 8 - rng() * 4, 20, 28);
  const target = { x: 44 + rng() * 12, y: clamp(lineY - 6 - rng() * 4, 10, lineY - 4) };
  const runnerStart = { x: clamp(target.x + (rng() - 0.5) * 6, 38, 62), y: lineY + 1 + rng() * 2 };
  const keeperX = 48 + rng() * 4;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.6 },
    defenders: [
      { x: clamp(bx - 6 + rng() * 4, 34, 50), y: lineY },
      { x: clamp(bx + 6 - rng() * 4, 50, 66), y: lineY + 2 },
    ],
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "through_ball" as const, teammates: [runnerStart], passTarget: target,
    receiver: rollReceiver("through_ball", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Deep and safe — simple recycling pass, "no goal" in this situation. No receiver,
// so it resolves as a plain completed/failed delivery rather than chaining a shot.
function buildMidfieldPass(rng: () => number, keeperStrength: number, teamRelationship: number) {
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
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Penalty kick — just you and the keeper, no defenders, tight camera.
function buildPenalty(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const keeperX = 50 + (rng() - 0.5) * 2;
  return {
    ball: { x: 50, y: 11 },
    player: { x: 50, y: 13.5 },
    defenders: [],
    keeper: makeKeeper(keeperX, 1.5),
    keeperStrength, follower: { x: 52, y: 14, active: false, shot: false } as Follower,
    goal: GOAL, crossbar: CROSSBAR,
    kind: "penalty" as const, teammates: [], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Free kick — wall of defenders, need to bend it over or around them.
function buildFreeKick(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 42 + rng() * 16;
  const by = 24 + rng() * 8;
  const keeperX = clamp(bx + (rng() - 0.5) * 4, 44, 56);
  const wallY = by - 9.15;
  const wallCx = (bx + 50) / 2;
  const wallSize = 3 + (rng() < 0.35 ? 1 : 0);
  const defenders: Vec2[] = [];
  for (let i = 0; i < wallSize; i++) {
    defenders.push({ x: clamp(wallCx - (wallSize - 1) + i * 2, 34, 66), y: wallY });
  }
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 2.5 },
    defenders,
    keeper: makeKeeper(keeperX),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "free_kick" as const, teammates: [], passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Corner kick — cross from the corner flag into the box for a header.
function buildCorner(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 1 : 99;
  const by = 1;
  const target = { x: 44 + rng() * 12, y: 6 + rng() * 5 };
  const keeperX = clamp(50 + side * 3 + (rng() - 0.5) * 6, 42, 58);
  return {
    ball: { x: bx, y: by },
    player: { x: bx + side * 1.5, y: by + 2 },
    defenders: [
      { x: clamp(target.x + (rng() - 0.5) * 5, 38, 62), y: clamp(target.y + 1, 4, 12) },
      { x: clamp(50 - side * 4 + (rng() - 0.5) * 4, 38, 62), y: clamp(target.y + 3, 6, 14) },
    ],
    keeper: makeKeeper(keeperX, 4 + rng() * 2),
    keeperStrength, follower: makeFollower(rng, 10),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "corner" as const, teammates: [target], passTarget: target,
    receiver: rollReceiver("corner", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Build-up play — deep in midfield, 2-3 pass options, no goal visible.
// Easy (behind/nearby) → low chance of ball return; hard (forward) → high chance.
function buildBuildup(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 30 + rng() * 40;
  const by = 48 + rng() * 12;
  const easyTarget = {
    x: clamp(bx + (rng() - 0.5) * 14, 15, 85),
    y: clamp(by + 2 + rng() * 5, 40, 62),
  };
  const hardTarget = {
    x: clamp(50 + (rng() - 0.5) * 24, 25, 75),
    y: clamp(by - 14 - rng() * 6, 22, 40),
  };
  const defenders: Vec2[] = [
    { x: clamp((bx + hardTarget.x) / 2 + (rng() - 0.5) * 6, 20, 80), y: clamp((by + hardTarget.y) / 2, 30, 50) },
  ];
  if (rng() < 0.55) {
    defenders.push({ x: clamp(hardTarget.x + (rng() - 0.5) * 10, 20, 80), y: clamp(hardTarget.y + 3, 25, 45) });
  }
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.5 },
    defenders,
    keeper: makeKeeper(50, 2),
    keeperStrength, follower: { x: 50, y: 50, active: false, shot: false } as Follower,
    goal: GOAL, crossbar: CROSSBAR,
    kind: "buildup" as const,
    teammates: [easyTarget, hardTarget],
    passTarget: hardTarget,
    secondaryPassTargets: [easyTarget],
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Build one scenario of a given kind, applying default viewport + new fields.
export function buildScenario(kind: ScenarioKind, rng: () => number, keeperStrength = 62, teamRelationship = 60): Scenario {
  const ks = clamp(keeperStrength, 0, 100);
  const tr = clamp(teamRelationship, 0, 100);
  let sc: Scenario;
  switch (kind) {
    case "one_on_one": sc = buildOneOnOne(rng, ks, tr) as Scenario; break;
    case "tight_angle": sc = buildTightAngle(rng, ks, tr) as Scenario; break;
    case "long_range": sc = buildLongRange(rng, ks, tr) as Scenario; break;
    case "volley": sc = buildVolley(rng, ks, tr) as Scenario; break;
    case "header": sc = buildHeader(rng, ks, tr) as Scenario; break;
    case "cutback": sc = buildCutback(rng, ks, tr) as Scenario; break;
    case "byline_cross": sc = buildBylineCross(rng, ks, tr) as Scenario; break;
    case "through_ball": sc = buildThroughBall(rng, ks, tr) as Scenario; break;
    case "midfield_pass": sc = buildMidfieldPass(rng, ks, tr) as Scenario; break;
    case "penalty": sc = buildPenalty(rng, ks, tr) as Scenario; break;
    case "free_kick": sc = buildFreeKick(rng, ks, tr) as Scenario; break;
    case "corner": sc = buildCorner(rng, ks, tr) as Scenario; break;
    case "buildup": sc = buildBuildup(rng, ks, tr) as Scenario; break;
  }
  if (!sc.viewport) sc.viewport = scenarioViewport(sc);
  if (!sc.secondaryPassTargets) sc.secondaryPassTargets = [];
  if (sc.passDifficulty === undefined) sc.passDifficulty = 0;
  return sc;
}

// How often each scenario kind shows up, by the player's position. Attackers see
// mostly finishing chances; wide players get more crosses/cutbacks; central and
// deep players get more through-balls and safe build-up passes.
const DEFAULT_WEIGHTS: Record<ScenarioKind, number> = {
  one_on_one: 9, tight_angle: 9, long_range: 9, volley: 9, header: 9,
  cutback: 9, byline_cross: 9, through_ball: 9, midfield_pass: 7,
  penalty: 3, free_kick: 5, corner: 6, buildup: 7,
};

const POSITION_WEIGHTS: Record<string, Record<ScenarioKind, number>> = {
  ST:  { one_on_one: 20, tight_angle: 14, long_range: 6,  volley: 14, header: 16, cutback: 5,  byline_cross: 2,  through_ball: 6,  midfield_pass: 2,  penalty: 5, free_kick: 3, corner: 2, buildup: 5 },
  CAM: { one_on_one: 14, tight_angle: 10, long_range: 12, volley: 10, header: 8,  cutback: 6,  byline_cross: 3,  through_ball: 14, midfield_pass: 5,  penalty: 3, free_kick: 5, corner: 2, buildup: 8 },
  LW:  { one_on_one: 12, tight_angle: 14, long_range: 6,  volley: 8,  header: 5,  cutback: 10, byline_cross: 16, through_ball: 6,  midfield_pass: 5,  penalty: 2, free_kick: 3, corner: 6, buildup: 7 },
  RW:  { one_on_one: 12, tight_angle: 14, long_range: 6,  volley: 8,  header: 5,  cutback: 10, byline_cross: 16, through_ball: 6,  midfield_pass: 5,  penalty: 2, free_kick: 3, corner: 6, buildup: 7 },
  CM:  { one_on_one: 5,  tight_angle: 3,  long_range: 12, volley: 5,  header: 3,  cutback: 6,  byline_cross: 4,  through_ball: 16, midfield_pass: 10, penalty: 2, free_kick: 6, corner: 4, buildup: 24 },
  LM:  { one_on_one: 7,  tight_angle: 8,  long_range: 6,  volley: 5,  header: 3,  cutback: 10, byline_cross: 16, through_ball: 10, midfield_pass: 8,  penalty: 2, free_kick: 4, corner: 6, buildup: 15 },
  RM:  { one_on_one: 7,  tight_angle: 8,  long_range: 6,  volley: 5,  header: 3,  cutback: 10, byline_cross: 16, through_ball: 10, midfield_pass: 8,  penalty: 2, free_kick: 4, corner: 6, buildup: 15 },
  CDM: { one_on_one: 2,  tight_angle: 2,  long_range: 12, volley: 2,  header: 3,  cutback: 3,  byline_cross: 3,  through_ball: 12, midfield_pass: 12, penalty: 2, free_kick: 6, corner: 3, buildup: 38 },
  CB:  { one_on_one: 1,  tight_angle: 1,  long_range: 4,  volley: 1,  header: 8,  cutback: 1,  byline_cross: 1,  through_ball: 5,  midfield_pass: 10, penalty: 1, free_kick: 3, corner: 8, buildup: 56 },
  LB:  { one_on_one: 2,  tight_angle: 2,  long_range: 3,  volley: 1,  header: 3,  cutback: 6,  byline_cross: 18, through_ball: 8,  midfield_pass: 10, penalty: 1, free_kick: 3, corner: 8, buildup: 35 },
  RB:  { one_on_one: 2,  tight_angle: 2,  long_range: 3,  volley: 1,  header: 3,  cutback: 6,  byline_cross: 18, through_ball: 8,  midfield_pass: 10, penalty: 1, free_kick: 3, corner: 8, buildup: 35 },
  GK:  { one_on_one: 0,  tight_angle: 0,  long_range: 1,  volley: 0,  header: 0,  cutback: 0,  byline_cross: 0,  through_ball: 5,  midfield_pass: 20, penalty: 0, free_kick: 0, corner: 1, buildup: 73 },
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
export function buildWeightedScenario(rng: () => number, position: string, keeperStrength = 62, teamRelationship = 60): Scenario {
  const kind = pickScenarioKind(position, rng);
  return buildScenario(kind, rng, keeperStrength, teamRelationship);
}

// After a successful build-up pass, the ball returns in an attacking situation.
const ATTACKING_KINDS: ScenarioKind[] = [
  "one_on_one", "tight_angle", "long_range", "volley", "header",
  "cutback", "byline_cross", "through_ball",
];
export function buildAttackingScenario(rng: () => number, keeperStrength = 62, teamRelationship = 60): Scenario {
  const kind = ATTACKING_KINDS[Math.floor(rng() * ATTACKING_KINDS.length)];
  return buildScenario(kind, rng, keeperStrength, teamRelationship);
}

function predictCrossX(from: Vec2, dir: Vec2): number {
  if (dir.y >= -0.001) return from.x; // not heading toward goal
  const s = -from.y / dir.y;
  return clamp(from.x + dir.x * s, 30, 70);
}

const RECEIVER_CONTROL_T = 0.5; // seconds the teammate takes to control the ball before shooting

// A teammate who's just received a cutback/cross/through-ball takes their own shot.
// Quality is a real simulation input (accuracy spread, power, curl), not a probability
// roll — same physics as the player's own strike, driven by their role and how well
// the team combines (relationships.team).
function launchReceiverShot(ball: Ball, scenario: Scenario, rng: () => number) {
  const receiver = scenario.receiver;
  if (!receiver) return;
  const target = scenario.passTarget ?? ball.pos;

  const posQuality = clamp(1 - target.y / 24, 0, 1);          // closer to goal = better chance
  const teamQuality = clamp(scenario.teamRelationship / 100, 0, 1); // how well you two combine
  const composite = clamp(receiver.skill * 0.5 + posQuality * 50 + teamQuality * 25, 10, 96);

  const goalCx = (scenario.goal.x1 + scenario.goal.x2) / 2;
  const spread = 20 - composite * 0.14; // tighter aim as composite quality rises
  const aimX = goalCx + (rng() - 0.5) * spread;
  const baseDir = normalize({ x: aimX - ball.pos.x, y: 0.001 - ball.pos.y });
  const sigmaDeg = (1 - composite / 100) * 11;
  const dir = rotateDeg(baseDir, gaussian(rng) * sigmaDeg);

  const power = 0.55 + (composite / 100) * 0.35 + rng() * 0.08;
  const loft = clamp(0.22 + rng() * 0.3 - composite / 500, 0.05, 0.75);
  const Sh = power * (34 + composite * 0.22) * (1 - loft * 0.25);
  const vz = loft * power * (9 + composite * 0.05);
  const spin = (rng() - 0.5) * 2 * (0.35 + composite / 220) * power;

  ball.vel = { x: dir.x * Sh, y: dir.y * Sh };
  ball.vz = vz;
  ball.spin = spin;
  ball.z = 0.1;
  ball.loose = false;
  ball.contactCd = 0.15;
  ball.event = "receiverShot";
  scenario.keeper.targetX = predictCrossX(ball.pos, dir);
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
  // Curl from striking the side of the ball, magnified by technique. Struck near
  // the edge with good technique this bends dramatically — enough to bend around a
  // defender, which is the point.
  const spin = contact.cx * (0.65 + tech / 100 * 1.2) * power;

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
    receiverControlT: 0,
    event: null,
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
  // A teammate is controlling a pass they've just received — hold the ball, then strike.
  if (ball.receiverControlT > 0) {
    ball.receiverControlT = Math.max(0, ball.receiverControlT - dt);
    if (ball.receiverControlT <= 0) launchReceiverShot(ball, scenario, rng);
    return null;
  }

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

  // --- Pass reception: check against primary + secondary pass targets ---
  // Uses a swept-sphere check along the ball's path to prevent fast balls tunneling
  // through teammates without being detected.
  if (!scenario.receiverDone && ball.z < 3.2) {
    const targets = scenario.passTarget
      ? [scenario.passTarget, ...scenario.secondaryPassTargets]
      : scenario.secondaryPassTargets;
    const PASS_RADIUS = 3.0;
    for (const tgt of targets) {
      const dist = Math.hypot(tgt.x - ball.pos.x, tgt.y - ball.pos.y);
      // Also check along the segment from prev to current position (swept sphere)
      let swept = dist;
      const segX = ball.pos.x - prevX, segY = ball.pos.y - prevY;
      const segLen2 = segX * segX + segY * segY;
      if (segLen2 > 0.01) {
        const t = clamp(((tgt.x - prevX) * segX + (tgt.y - prevY) * segY) / segLen2, 0, 1);
        const closestX = prevX + segX * t, closestY = prevY + segY * t;
        swept = Math.min(swept, Math.hypot(tgt.x - closestX, tgt.y - closestY));
      }
      if (swept < PASS_RADIUS) {
        scenario.receiverDone = true;
        // Track how difficult the pass was (for build-up → return mechanic)
        const passLen = Math.hypot(tgt.x - scenario.ball.x, tgt.y - scenario.ball.y);
        const forward = scenario.ball.y - tgt.y;
        scenario.passDifficulty = clamp(forward / 30 + passLen / 60, 0, 1);
        if (scenario.receiver) {
          ball.pos = { x: tgt.x, y: tgt.y };
          ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.z = 0.08; ball.spin = 0;
          ball.receiverControlT = RECEIVER_CONTROL_T;
          ball.event = "received";
          return null;
        }
        return "delivered";
      }
    }
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
