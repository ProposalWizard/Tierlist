// Canvas match engine — pure physics, no React, no rendering.
//
// Coordinate system and every dimension come from ./pitch (real IFAB metres):
//   x: 0 = left touchline, 68 = right touchline. Goal mouth spans 30.34..37.66.
//   y: 0 = the attacking goal line, growing upfield. Negative y is inside the net.
//   z: metres above the turf. Crossbar at 2.44 m.
// Both axes are metric and equally scaled, so distances mean the same thing in
// every direction and the renderer can draw the same geometry the ball is
// tested against — what you see is exactly what resolves.
//
// The flight is a real simulation: the OUTCOME is whatever the physics produces.
// Keeper, defenders, the runner on the end of a pass and rebounds are all driven
// off the same ball state the renderer draws.

import {
  PITCH_W, HALF_LEN, CX, GOAL_H, POST_L, POST_R, NET_DEPTH,
  SIX_DEPTH, BOX_DEPTH, BOX_L, BOX_R, PEN_SPOT_Y, BALL_R,
  insideGoalMouth, hitsPost,
} from "./pitch";

export interface Vec2 { x: number; y: number; }
export interface Viewport { x1: number; x2: number; y1: number; y2: number; }

// A moment worth narrating, surfaced from the physics tick to the UI once and consumed.
export type BallEvent = "received" | "receiverShot";

export interface Ball {
  pos: Vec2;
  vel: Vec2;   // m/s, horizontal plane
  z: number;   // metres above the turf
  vz: number;  // m/s vertical
  spin: number; // curl coefficient (sign = direction)
  /**
   * Vertical spin: -1 is heavy backspin, +1 heavy topspin. Taken from where on
   * the ball it was struck, and only used at a bounce — topspin flattens and
   * runs on, backspin sits up and checks.
   */
  topspin?: number;
  resting: boolean;
  loose: boolean;      // true once the ball has been parried/deflected and is a live rebound
  contactCd: number;   // seconds of immunity from another deflection/save (prevents same-frame re-trigger)
  receiverControlT: number; // seconds a teammate spends controlling a received pass before shooting
  event: BallEvent | null;  // one-shot flag for the UI to narrate, cleared once read
  inNet: boolean;      // crossed the line — the UI keeps animating it into the netting
  /**
   * Struck at goal rather than played to a team-mate. Decided once, at the
   * strike, and sticky: a shot that deflects, curls away or is parried is still
   * your shot, so a support player can never wander into it and turn a goal
   * into a completed pass.
   */
  shot?: boolean;
  /**
   * Who the ball belongs to right now. "none" is a genuinely loose ball — the
   * only state in which it can be won by either side, which is what makes a
   * deflection or a parry a 50-50 rather than a lull.
   */
  owner?: "you" | "mate" | "opponent" | "none";
}

// A goalkeeper that slides + dives along its line and stretches to reach the ball.
/**
 * The keeper is a TIMING PUZZLE, not an opponent trying to read your shot.
 *
 * He patrols his line continuously, before and during the shot, and never
 * reacts to where you aim. Whether a shot goes in is decided by comparing where
 * the ball crosses the goal plane against where he happens to be at that
 * moment. So the question a shot asks is "can I predict where he will be when
 * the ball arrives", not "can he react fast enough" — and beating him feels
 * earned rather than lucky.
 *
 * This replaced a keeper that called predictCrossX() the instant you struck the
 * ball and dived straight to the crossing point. That is the thing the design
 * most needed to lose: it read your input, so a save never felt like a save you
 * could have avoided.
 */
export interface Keeper {
  x: number;
  y: number;
  startX: number;
  targetX: number;   // only used when scrambling after a loose ball
  dive: number;      // signed lean/dive extension in metres (for rendering)
  saves: number;     // save attempts already spent on this ball
  done: boolean;     // caught / tipped — keeper is out of the equation
  flash: number;     // seconds of "just made contact" glow (render only)

  // ── Patrol ──
  patrolT: number;       // seconds elapsed along the patrol
  patrolSeed: number;    // phase offset so no two scenarios start identically
  /** Chasing a spill rather than patrolling. */
  scrambling: boolean;
  /** 0..1 lunge played AFTER the outcome is decided (render only). */
  saveLunge: number;
  /** Which way that lunge goes. */
  saveDir: number;
  /** Which save animation to play. Set only once the outcome is already decided. */
  saveKind: SaveKind | null;
  /** Seconds of life, for idle breathing and weight shifts (render only). */
  idleT: number;
}

// A poacher lurking for the rebound.
export interface Follower {
  x: number;
  y: number;
  active: boolean;   // currently chasing a loose ball
  shot: boolean;     // already took its follow-up
}

// The team-mate a pass is aimed at. They are a real moving entity: the renderer
// draws them at `pos` and reception is tested against `pos`, so a pass can never
// visually pass through the player without them receiving it — which is what
// happened when the drawn team-mate and the reception zone were separate things.
export interface Runner {
  pos: Vec2;      // live position — drawn here, reception tested here
  to: Vec2;       // where they are running
  speed: number;  // m/s (a sprinting footballer tops out around 8)
  moving: boolean;
  /**
   * target : the man the scenario aimed the pass at. Runs his scripted line.
   * support: making himself available. He looks for space while you hold the
   *          ball, so your options improve rather than only decaying, and he
   *          goes after a ball that was not played straight to him.
   */
  role?: "target" | "support";
  /** Seconds until this runner re-reads the situation. Keeps him from jittering. */
  replanIn?: number;
  /** False while jogging into space, true while chasing a ball. */
  sprint?: boolean;
}

// The kind of match situation the player has been put in. Shooting kinds
// (one_on_one..header) resolve at the goal line. Passing kinds
// (cutback..midfield_pass) instead resolve against the runner.
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

/**
 * A defender.
 *
 * Extends Vec2, so the thirteen scenario builders that create plain {x, y}
 * literals still satisfy it and needed no changes. The AI fields are filled in
 * by initDefenders() when the scenario starts.
 */
export interface Defender extends Vec2 {
  /** Where he started — cover defenders hold a shape relative to this. */
  homeX?: number;
  homeY?: number;
  /**
   * press    : closes the ball carrier down and contains him.
   * cover    : slides onto the passing lane to the most dangerous runner.
   * hold     : a wall or a marker. Drifts only; never charges. Dead balls.
   * intercept: has read the ball's path and is going for it.
   * recover  : has been played past and is sprinting back goal-side.
   *
   * The last two are taken on and given up during play; `baseRole` is what he
   * goes back to.
   */
  role?: "press" | "cover" | "hold" | "intercept" | "recover";
  /** The role the scenario assigned him, restored when the ball is dead. */
  baseRole?: "press" | "cover" | "hold";
  /** Where he is running to while intercepting. */
  interceptTo?: Vec2;
  /** Metres per second. Varied slightly per defender so they don't move as one. */
  speed?: number;
  /** Seconds spent within containment range of the carrier. Drives the tackle. */
  containT?: number;
}

export interface Scenario {
  ball: Vec2;
  player: Vec2;
  defenders: Defender[];
  keeper: Keeper;
  keeperStrength: number;   // 0-100 — better keepers cover more of the goal
  follower: Follower;
  goal: { x1: number; x2: number };
  crossbar: number;
  kind: ScenarioKind;
  teammates: Vec2[];        // decorative players (crossers, support) — never pass targets
  runner: Runner | null;    // the team-mate a pass is aimed at, if any
  passTarget: Vec2 | null;  // where the runner is heading (drawn as the aim marker)
  receiver: Receiver | null;   // set for cutback/byline_cross/through_ball — they shoot on reception
  receiverDone: boolean;       // true once the ball has reached the runner (guards re-trigger)
  teamRelationship: number;    // 0-100 — how well the team combines, feeds the receiver's shot quality
  viewport: Viewport;
  secondaryRunners: Runner[];  // extra options: support players and build-up outlets
  passDifficulty: number;      // 0-1, set when a pass resolves — harder pass = higher ball-return chance
  offsideRisk: number;         // 0-1 chance the run is flagged, set at build time from the real line
  /** How many passes deep into one move this is. Chained scenarios count up. */
  chainDepth?: number;
  /** Where a completed pass was actually received. The next link starts here. */
  receivedAt?: Vec2;
}

export type Outcome =
  | "goal" | "rebound" | "delivered" | "saved" | "caught" | "tipped"
  | "over" | "post" | "wide" | "blocked" | "out" | "short" | "offside"
  /** Dwelt too long and the closing defender took it off you. */
  | "tackled";

export interface KickSkills {
  power: number;      // 0-100
  technique: number;  // 0-100
}

export interface Contact { cx: number; cy: number; } // -1..1, cx=right, cy=down(bottom)

// --- Tunable constants — all in real units (metres, seconds, m/s) ---
const G = 9.8;                 // gravity, m/s^2
const GROUND_FRICTION = 1.9;   // m/s^2 rolling resistance. Lowered from 2.6 so the
                               // ball settles under friction instead of appearing
                               // to hit an invisible brake.
const AIR_DRAG = 0.12;         // per-second horizontal drag while airborne. Was 0.2,
                               // which bled enough speed that shots stopped
                               // carrying through the air.

// ── Bounce ───────────────────────────────────────────────────────────────────
// Tuned by simulating the loop rather than by how the numbers read. At the old
// 0.55/0.72 a firm shot bounced to [1.91, 0.58, 0.17] and carried 12.7 m after
// the first bounce — the second bounce was under a third of the first and the
// ball died. These give [1.91, 0.93, 0.45, 0.22, 0.11] and 31.2 m of carry:
// high, medium, small, tiny, roll, stop.
const BOUNCE_VZ = 0.70;        // vertical restitution off turf
const BOUNCE_H = 0.88;         // horizontal speed kept on bounce — it skips across
                               // the grass rather than sticking to it
const MIN_BOUNCE_VZ = 0.5;     // below this it stops bouncing and rolls. Was 1.2,
                               // which swallowed the last visible bounces.
const BOUNCE_SPIN_KEEP = 0.82; // curl survives a bounce, so a curling ball keeps
                               // bending after it lands
const BOUNCE_TOPSPIN_VZ = 0.18;// topspin flattens the bounce, backspin lifts it
const BOUNCE_TOPSPIN_H = 0.10; // …and topspin runs on while backspin checks up
const BOUNCE_SIDESPIN_TURN = 0.12; // sidespin nudges the bounce off straight
const CURL_K = 0.48;           // Magnus-ish lateral bend, applied perpendicular to
                               // travel so it rotates the flight rather than shoving
                               // it sideways. At 0.16 a maximum-curve strike bent
                               // only ~2-3 m over 25 m, which barely read as curl at
                               // all; this is 3x that, so a hard shot struck on the
                               // outside of the ball bends properly round a keeper.

const SHOT_REF_SPEED = 32;     // m/s — about as hard as a professional strikes it
const KEEPER_LATERAL_MAX = 3.2;// metres along the line a keeper can cover scrambling
const KEEPER_DIVE_SPEED = 5.4; // m/s lateral when chasing a loose ball
const KEEPER_VREACH = 2.5;     // metres — fingertips at full stretch

// ── The two numbers that balance the keeper ──────────────────────────────────
// Everything else about him is presentation. Widen the save radius or speed up
// the patrol to make him harder; nothing else should need touching, and neither
// makes him unfair because both stay visible to the player before they shoot.
const KEEPER_PATROL_AMP = 2.6;     // metres either side of centre he ranges over.
                                   // Tuned so that when he is at one extreme the
                                   // FAR corner is genuinely open — that gap is
                                   // the whole game.
const KEEPER_PATROL_PERIOD = 4.2;  // seconds for one full sweep and back — slow
                                   // enough to watch for a second and commit
const KEEPER_SAVE_R_MIN = 2.15;    // save radius at the goal plane, weakest keeper
const KEEPER_SAVE_R_MAX = 2.95;    // …and the strongest

/**
 * Difficulty tiers.
 *
 * Two numbers do all the balancing — how far he ranges and how much he covers
 * when he gets there — plus how quickly he sweeps. Nothing here makes him
 * cleverer or gives him foreknowledge, so even the hardest keeper stays fair:
 * he is simply harder to find a gap in, and gives you less time to find it.
 */
export type KeeperTier = "easy" | "normal" | "hard" | "expert";
export const KEEPER_TIERS: Record<KeeperTier, { amp: number; period: number; radius: number }> = {
  easy:   { amp: 2.15, period: 5.2, radius: 2.05 },
  normal: { amp: 2.60, period: 4.2, radius: 2.55 },
  hard:   { amp: 2.95, period: 3.5, radius: 2.80 },
  // Expert refines the movement rather than cheating: a wider beat and a
  // slightly less even rhythm, never a reaction to the shot.
  expert: { amp: 3.15, period: 3.0, radius: 2.95 },
};

/** Which tier a keeper of this rating plays at. */
export function keeperTierFor(strength: number): KeeperTier {
  const s = clamp(strength, 0, 100);
  if (s < 45) return "easy";
  if (s < 70) return "normal";
  if (s < 88) return "hard";
  return "expert";
}

/** How a save is played out. Chosen AFTER the outcome, purely for the animation. */
export type SaveKind = "catch" | "central" | "low" | "high" | "fingertip";
// Height costs more than width: a keeper covers his line far more easily than he
// gets up. This is what makes the top corners the safest target without any
// hidden bonus for aiming there — they are simply furthest from him.
const KEEPER_SAVE_Z_SCALE = 1.15;
const KEEPER_BODY_R = 0.75;        // his actual body, for a ball that runs into him
const KEEPER_CENTRE_Z = 0.95;      // metres — roughly his chest, the centre of the
                                   // save volume

const DEF_BLOCK_R = 0.95;      // metres — body + outstretched leg
const DEF_BLOCK_H = 1.9;       // defenders can only block below head height — chip over them

const FOLLOWER_SPEED = 7.2;    // m/s — a sprinting poacher
const RUNNER_SPEED = 7.0;      // m/s — the team-mate making the run

const PASS_CONTROL_R = 2.0;    // metres — how close the ball must get to be controlled

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
const GOAL = { x1: POST_L, x2: POST_R };
const CROSSBAR = GOAL_H;

// Keepers stand on their line. `y` is how far off it they are — a set-piece keeper
// is a metre out, a keeper rushing a one-on-one might be eight, and nothing puts
// him outside his own penalty area.
function makeKeeper(x: number, y = 0.8, rng?: () => number): Keeper {
  const kx = clamp(x, POST_L - 2.5, POST_R + 2.5);
  const r = rng ? rng() : 0.5;
  return {
    x: kx, y: clamp(y, 0.3, BOX_DEPTH - 2), startX: kx, targetX: kx,
    dive: 0, saves: 0, done: false, flash: 0,
    patrolT: r * 4,                 // start somewhere along the sweep, not always centre
    patrolSeed: r * Math.PI * 2,
    scrambling: false,
    saveLunge: 0,
    saveDir: 0,
    saveKind: null,
    idleT: r * 3,
  };
}

function makeRunner(to: Vec2, from: Vec2, speed = RUNNER_SPEED, role: "target" | "support" = "target"): Runner {
  return { pos: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, speed, moving: true, role, replanIn: 0, sprint: true };
}

// A poacher lurking around the penalty spot for a spill.
function makeFollower(rng: () => number, by: number): Follower {
  return {
    x: clamp(CX + (rng() < 0.5 ? -1 : 1) * (2 + rng() * 5), POST_L - 3, POST_R + 3),
    y: clamp(by * 0.5, SIX_DEPTH, PEN_SPOT_Y + 3),
    active: false, shot: false,
  };
}

// The offside line: the second-to-last defender is the outfield player nearest
// their own goal line (the keeper being the last). In these coordinates that is
// the SMALLEST y. An attacker is offside if they are nearer the goal line than
// that — i.e. their y is smaller still.
function offsideLineY(defenders: Vec2[]): number {
  if (defenders.length === 0) return BOX_DEPTH;
  return Math.min(...defenders.map(d => d.y));
}

// The camera. Canvas is a 3:4 portrait, so the viewport must be too, and it must
// use the SAME metres-per-pixel on both axes or every distance on screen lies.
// Framing is clamped to a sane zoom band so the pitch never appears wildly zoomed
// in on one chance and wildly zoomed out on the next.
const VIEW_ASPECT = 3 / 4;      // width / height
const VIEW_MIN_H = 30;          // metres of pitch visible vertically, closest zoom
const VIEW_MAX_H = 62;          // furthest zoom

function autoViewport(points: Vec2[], includeGoal: boolean): Viewport {
  const all = [...points];
  if (includeGoal) {
    all.push({ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH });
  }
  let x1 = Math.min(...all.map(p => p.x));
  let x2 = Math.max(...all.map(p => p.x));
  let y1 = Math.min(...all.map(p => p.y));
  let y2 = Math.max(...all.map(p => p.y));

  // Breathing room so nothing sits on the frame edge.
  x1 -= 4; x2 += 4; y1 -= 3.5; y2 += 3.5;

  // Grow to whichever the content demands, then hold the canvas aspect exactly.
  let h = Math.max(y2 - y1, (x2 - x1) / VIEW_ASPECT);
  h = clamp(h, VIEW_MIN_H, VIEW_MAX_H);
  const w = h * VIEW_ASPECT;

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  let vx1 = cx - w / 2, vx2 = cx + w / 2;
  let vy1 = cy - h / 2, vy2 = cy + h / 2;

  // Keep the frame over the pitch: slide (never squash) it back into bounds.
  const padX = 5, backPad = NET_DEPTH + 2.5, fwdPad = 6;
  if (vx1 < -padX) { const s = -padX - vx1; vx1 += s; vx2 += s; }
  if (vx2 > PITCH_W + padX) { const s = vx2 - (PITCH_W + padX); vx1 -= s; vx2 -= s; }
  if (vy1 < -backPad) { const s = -backPad - vy1; vy1 += s; vy2 += s; }
  if (vy2 > HALF_LEN + fwdPad) { const s = vy2 - (HALF_LEN + fwdPad); vy1 -= s; vy2 -= s; }

  return { x1: vx1, x2: vx2, y1: vy1, y2: vy2 };
}

function scenarioViewport(sc: {
  ball: Vec2; player: Vec2; defenders: Vec2[]; teammates: Vec2[];
  keeper: { x: number; y: number }; runner: Runner | null; secondaryRunners?: Runner[]; kind: ScenarioKind;
}): Viewport {
  const pts: Vec2[] = [sc.ball, sc.player];
  const showGoal = sc.kind !== "buildup" && sc.kind !== "midfield_pass";
  if (showGoal) pts.push({ x: sc.keeper.x, y: sc.keeper.y });
  for (const d of sc.defenders) pts.push(d);
  // Decorative team-mates (the crosser a volley or header came from) are
  // deliberately NOT framed. They stand out by the touchline, and letting them
  // drag the bounding box shoved the actual action — and the goal — into the
  // corner of the screen, which is what made the camera look so erratic.
  if (sc.runner) { pts.push(sc.runner.pos); pts.push(sc.runner.to); }
  for (const r of sc.secondaryRunners ?? []) { pts.push(r.pos); pts.push(r.to); }
  return autoViewport(pts, showGoal);
}

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

// A clean run in behind — the keeper races off his line to close the angle down.
function buildOneOnOne(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 12;
  const by = 13 + rng() * 7;
  // He comes to meet you, but stays inside his box and roughly on the shooting line.
  const keeperY = clamp(by * 0.42, 3.5, 9);
  const keeperX = clamp(CX + (bx - CX) * 0.45, POST_L - 1, POST_R + 1);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.2 },
    defenders: [
      { x: clamp(bx + (rng() - 0.5) * 6, 8, PITCH_W - 8), y: by + 3 + rng() * 4 }, // recovering behind you
    ],
    keeper: makeKeeper(keeperX, keeperY, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "one_on_one" as const, teammates: [], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Wide and close to the byline — an acute angle, keeper shading his near post.
function buildTightAngle(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = CX + side * (11 + rng() * 6);
  const by = 3 + rng() * 6;
  // Covers the near post — the far post is the opening.
  const keeperX = clamp(CX + side * 2.6, POST_L + 0.4, POST_R - 0.4);
  return {
    ball: { x: bx, y: by },
    player: { x: bx + side * 0.9, y: by + 0.9 },
    defenders: [
      { x: clamp(bx - side * 2.5, 6, PITCH_W - 6), y: clamp(by + 1.5, 2, 10) },
    ],
    keeper: makeKeeper(keeperX, 0.9 + rng() * 0.8, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "tight_angle" as const, teammates: [], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Well outside the box — needs pace, and a screen to bend or lift the ball over.
function buildLongRange(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 20;
  const by = 24 + rng() * 10;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders: [
      { x: clamp(bx + (rng() - 0.5) * 5, 10, PITCH_W - 10), y: by - 3 - rng() * 2 },
      { x: clamp(bx + (rng() - 0.5) * 12, 10, PITCH_W - 10), y: by - 6 - rng() * 3 },
    ],
    keeper: makeKeeper(CX + (rng() - 0.5) * 2, 1.6 + rng() * 1.4, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "long_range" as const, teammates: [], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Edge of the box, ball dropping from a cross — meet it first time.
function buildVolley(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 13;
  const by = 11 + rng() * 6;
  const side = rng() < 0.5 ? -1 : 1;
  const crosser = { x: side < 0 ? 4 + rng() * 5 : PITCH_W - 9 + rng() * 5, y: 5 + rng() * 5 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.0 },
    defenders: [
      { x: clamp(bx - 2.5 + rng() * 1.5, 10, PITCH_W - 10), y: clamp(by - 1.5, 5, by) },
      { x: clamp(bx + 3.5 - rng() * 1.5, 10, PITCH_W - 10), y: clamp(by - 2.5, 5, by) },
    ],
    keeper: makeKeeper(CX + (rng() - 0.5) * 2, 1.4 + rng() * 1.2, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "volley" as const, teammates: [crosser], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Inside the six-yard box, meeting a cross with your head — tight marking.
function buildHeader(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 9;
  const by = 3.5 + rng() * 3.5;
  const side = rng() < 0.5 ? -1 : 1;
  const crosser = { x: side < 0 ? 3 + rng() * 4 : PITCH_W - 7 + rng() * 4, y: 4 + rng() * 4 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.0 },
    defenders: [
      // Marking you goal-side, close but not standing inside you.
      { x: clamp(bx - side * (1.5 + rng() * 1.1), 8, PITCH_W - 8), y: clamp(by - 0.8, 1.5, 8) },
    ],
    keeper: makeKeeper(CX + (rng() - 0.5) * 2.5, 0.7 + rng() * 0.8, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "header" as const, teammates: [crosser], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Byline, squaring it back for a team-mate arriving at the spot. The ball is level
// with the goal line, so nobody in the middle can be offside — which is exactly
// why this is the safest ball in football.
function buildCutback(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = CX + side * (9 + rng() * 5);
  const by = 1 + rng() * 3;
  const to = { x: CX + (rng() - 0.5) * 7, y: PEN_SPOT_Y - 1 + rng() * 3 };
  const from = { x: to.x + (rng() - 0.5) * 3, y: to.y + 3.5 + rng() * 2 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx + side * 0.8, y: by + 0.9 },
    defenders: [
      { x: clamp(to.x - side * 3.5, 8, PITCH_W - 8), y: clamp(to.y - 1.5, 4, 12) },
    ],
    keeper: makeKeeper(CX + side * 1.5, 0.7 + rng() * 0.7, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "cutback" as const, teammates: [],
    runner: makeRunner(to, from), passTarget: to,
    receiver: rollReceiver("cutback", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// From the byline near the corner, whipped in for a run at the near/far post.
function buildBylineCross(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 2 + rng() * 4 : PITCH_W - 6 + rng() * 4;
  const by = 0.8 + rng() * 3;
  const to = { x: CX + (rng() - 0.5) * 11, y: 4.5 + rng() * 5 };
  const from = { x: to.x - side * 2.5, y: to.y + 4 + rng() * 2.5 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx + side * 0.8, y: by + 0.9 },
    defenders: [
      { x: clamp(to.x - side * 2.2, 8, PITCH_W - 8), y: clamp(to.y - 0.8, 3, 11) },
      { x: clamp(CX + side * 3, 8, PITCH_W - 8), y: clamp(to.y + 2.5, 5, 13) },
    ],
    keeper: makeKeeper(CX - side * 1.2, 1 + rng() * 0.9, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "byline_cross" as const, teammates: [],
    runner: makeRunner(to, from), passTarget: to,
    receiver: rollReceiver("byline_cross", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Splitting the defense for a team-mate breaking in behind. The runner STARTS
// level with or behind the second-to-last defender — onside, as the laws require,
// judged at the moment the ball is played — and only then runs beyond the line.
// (Spawning him already past the defence is what made every through-ball look
// like a blatant offside.)
function buildThroughBall(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 16;
  const by = 28 + rng() * 10;
  const lineY = clamp(by - 9 - rng() * 4, 15, 24);
  const defenders: Vec2[] = [
    { x: clamp(CX - 5 - rng() * 4, 10, PITCH_W - 10), y: lineY },
    { x: clamp(CX + 5 + rng() * 4, 10, PITCH_W - 10), y: lineY + 0.6 + rng() * 1.2 },
  ];
  const line = offsideLineY(defenders);
  // Onside by construction: level with the line, or a stride behind it.
  const startY = line + rng() * 2.0;
  const from = { x: clamp(CX + (rng() - 0.5) * 14, 12, PITCH_W - 12), y: startY };
  // The space he runs into, beyond the defence — legal, because he set off onside.
  const to = { x: clamp(from.x + (rng() - 0.5) * 6, 12, PITCH_W - 12), y: clamp(line - 5 - rng() * 4, 6, line - 2) };
  // Only a genuinely tight start is ever flagged, and then only sometimes.
  const marginToLine = startY - line;
  const offsideRisk = marginToLine < 0.6 ? 0.1 : 0;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders,
    keeper: makeKeeper(CX + (rng() - 0.5) * 2, 2 + rng() * 2, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "through_ball" as const, teammates: [],
    runner: makeRunner(to, from), passTarget: to,
    receiver: rollReceiver("through_ball", rng), receiverDone: false, teamRelationship,
    offsideRisk,
  } as unknown as Scenario;
}

// Deep and safe — simple recycling pass. No receiver, so it resolves as a plain
// completed/failed delivery rather than chaining a shot.
function buildMidfieldPass(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 14 + rng() * (PITCH_W - 28);
  const by = 34 + rng() * 12;
  const to = { x: clamp(bx + (rng() - 0.5) * 20, 8, PITCH_W - 8), y: clamp(by - 6 - rng() * 7, 24, 44) };
  const from = { x: to.x + (rng() - 0.5) * 3, y: to.y + 2 + rng() * 2 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders: [
      { x: clamp((bx + to.x) / 2 + (rng() - 0.5) * 7, 8, PITCH_W - 8), y: clamp((by + to.y) / 2, 28, 44) },
    ],
    keeper: makeKeeper(CX, 1.5, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "midfield_pass" as const, teammates: [],
    runner: makeRunner(to, from, RUNNER_SPEED * 0.55), passTarget: to,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Penalty — the spot is 11 m out, the keeper must stay on his line.
function buildPenalty(rng: () => number, keeperStrength: number, teamRelationship: number) {
  return {
    ball: { x: CX, y: PEN_SPOT_Y },
    player: { x: CX, y: PEN_SPOT_Y + 1.6 },
    defenders: [],
    keeper: makeKeeper(CX + (rng() - 0.5) * 1.2, 0.4, rng),
    keeperStrength, follower: { x: CX + 3, y: PEN_SPOT_Y + 2, active: false, shot: false } as Follower,
    goal: GOAL, crossbar: CROSSBAR,
    kind: "penalty" as const, teammates: [], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Free kick — the wall stands the regulation 9.15 m from the ball, on the line
// between the ball and the goal. Bend it round or lift it over.
function buildFreeKick(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 16;
  const by = 18 + rng() * 8;
  const toGoal = normalize({ x: CX - bx, y: -by });
  const wallCx = bx + toGoal.x * 9.15;
  const wallCy = by + toGoal.y * 9.15;
  const wallSize = 3 + (rng() < 0.4 ? 1 : 0);
  const defenders: Vec2[] = [];
  // Shoulder to shoulder across the shot line, spaced so they read as a wall of
  // individual players rather than one solid blob.
  const across = { x: -toGoal.y, y: toGoal.x };
  for (let i = 0; i < wallSize; i++) {
    const off = (i - (wallSize - 1) / 2) * 1.15;
    defenders.push({
      x: clamp(wallCx + across.x * off, 4, PITCH_W - 4),
      y: clamp(wallCy + across.y * off, 2, HALF_LEN),
    });
  }
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 2 },
    defenders,
    keeper: makeKeeper(CX + (rng() - 0.5) * 2.5, 1 + rng() * 0.8, rng),
    keeperStrength, follower: makeFollower(rng, by),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "free_kick" as const, teammates: [], runner: null, passTarget: null,
    receiver: null, receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Corner — taken from the corner arc, delivered into the box for a header.
function buildCorner(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const side = rng() < 0.5 ? -1 : 1;
  const bx = side < 0 ? 0.5 : PITCH_W - 0.5;
  const by = 0.5;
  const to = { x: CX + (rng() - 0.5) * 10, y: 4 + rng() * 5 };
  const from = { x: to.x - side * 3, y: to.y + 4 + rng() * 3 };
  return {
    ball: { x: bx, y: by },
    player: { x: bx + side * 1.2, y: by + 1.2 },
    defenders: [
      { x: clamp(to.x + (rng() - 0.5) * 4, 8, PITCH_W - 8), y: clamp(to.y + 0.8, 3, 11) },
      { x: clamp(CX - side * 3, 8, PITCH_W - 8), y: clamp(to.y + 2.5, 5, 13) },
    ],
    keeper: makeKeeper(CX + side * 1.5, 1.2 + rng() * 1, rng),
    keeperStrength, follower: makeFollower(rng, 9),
    goal: GOAL, crossbar: CROSSBAR,
    kind: "corner" as const, teammates: [],
    runner: makeRunner(to, from), passTarget: to,
    receiver: rollReceiver("corner", rng), receiverDone: false, teamRelationship,
  } as unknown as Scenario;
}

// Build-up play — deep in your own half, two options: a safe ball and a harder
// forward one. The harder one is likelier to win the ball straight back.
function buildBuildup(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = 14 + rng() * (PITCH_W - 28);
  const by = 40 + rng() * 11;
  const easyTo = { x: clamp(bx + (rng() - 0.5) * 15, 6, PITCH_W - 6), y: clamp(by + 2 + rng() * 5, 34, HALF_LEN + 4) };
  const hardTo = { x: clamp(CX + (rng() - 0.5) * 22, 10, PITCH_W - 10), y: clamp(by - 14 - rng() * 6, 18, 34) };
  const defenders: Vec2[] = [
    { x: clamp((bx + hardTo.x) / 2 + (rng() - 0.5) * 7, 8, PITCH_W - 8), y: clamp((by + hardTo.y) / 2, 24, 44) },
  ];
  if (rng() < 0.55) {
    defenders.push({ x: clamp(hardTo.x + (rng() - 0.5) * 9, 8, PITCH_W - 8), y: clamp(hardTo.y + 2.5, 20, 40) });
  }
  const hardRunner = makeRunner(hardTo, { x: hardTo.x + (rng() - 0.5) * 3, y: hardTo.y + 3 }, RUNNER_SPEED * 0.8);
  const easyRunner = makeRunner(easyTo, { x: easyTo.x, y: easyTo.y + 1.5 }, RUNNER_SPEED * 0.5);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders,
    keeper: makeKeeper(CX, 1.5, rng),
    keeperStrength, follower: { x: CX, y: 40, active: false, shot: false } as Follower,
    goal: GOAL, crossbar: CROSSBAR,
    kind: "buildup" as const,
    teammates: [],
    runner: hardRunner,
    passTarget: hardTo,
    secondaryRunners: [easyRunner],
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
  if (!sc.secondaryRunners) sc.secondaryRunners = [];
  if (sc.passDifficulty === undefined) sc.passDifficulty = 0;
  if (sc.offsideRisk === undefined) sc.offsideRisk = 0;
  if (sc.chainDepth === undefined) sc.chainDepth = 0;
  addSupport(sc, rng);
  if (!sc.viewport) sc.viewport = scenarioViewport(sc);
  return sc;
}

// How many team-mates come and make themselves available, by situation. Dead
// balls get none — a wall and a set piece are a still frame by design — and
// build-up already ships with two outlets of its own.
const SUPPORT_COUNT: Record<ScenarioKind, number> = {
  one_on_one: 1, tight_angle: 1, volley: 1, header: 1,
  long_range: 2, cutback: 2, byline_cross: 2, through_ball: 1,
  midfield_pass: 1, buildup: 0,
  penalty: 0, free_kick: 0, corner: 0,
};

/**
 * Give the attack some life.
 *
 * Team-mates were a decorative `Vec2[]`, so in a shooting scenario you had
 * exactly one option — hit it — while the defence closed you down. These are
 * real runners: they start somewhere plausible, immediately find the best space
 * available to them, and keep looking for a better spot while you hold the ball.
 */
function addSupport(sc: Scenario, rng: () => number) {
  const want = SUPPORT_COUNT[sc.kind] ?? 0;
  for (let i = 0; i < want; i++) {
    // A plausible starting point — level with or just behind the ball, off to
    // one side — which the space evaluation then improves on immediately.
    const side = i === 0 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.5 ? -1 : 1);
    const start = {
      x: clamp(sc.player.x + side * (7 + rng() * 7), 5, PITCH_W - 5),
      y: clamp(sc.player.y + (rng() - 0.35) * 10, 2.5, HALF_LEN + 4),
    };
    // Wide scenarios put the carrier near a touchline, where the clamp above
    // would fold the start position back on top of him.
    if (Math.hypot(start.x - sc.player.x, start.y - sc.player.y) < 5) {
      start.x = clamp(sc.player.x - side * (8 + rng() * 6), 5, PITCH_W - 5);
      if (Math.hypot(start.x - sc.player.x, start.y - sc.player.y) < 5) {
        start.x = clamp(CX + (CX - sc.player.x) * 0.5, 5, PITCH_W - 5);
        start.y = clamp(sc.player.y + 7 + rng() * 5, 2.5, HALF_LEN + 4);
      }
    }
    const r = makeRunner(bestSupportPoint(sc, sc.ball, start), start, RUNNER_SPEED * 0.95, "support");
    r.sprint = false;
    sc.secondaryRunners.push(r);
  }
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

/**
 * Pick a kind from a restricted set, still honouring the position weights.
 *
 * The hidden match decides which chances make football sense from where the
 * ball actually is; this decides which of THOSE a player in this position is
 * likeliest to be the one taking. A centre-back in the box gets the header far
 * more often than the one-on-one, without the box ever offering him a buildup.
 */
export function pickScenarioKindFrom(position: string, rng: () => number, allowed: ScenarioKind[]): ScenarioKind {
  if (allowed.length === 0) return pickScenarioKind(position, rng);
  const weights = POSITION_WEIGHTS[position] ?? DEFAULT_WEIGHTS;
  // A floor of 1: a position weighted to zero for this kind must still be able
  // to take it if the match hands him nothing else, rather than falling through.
  const total = allowed.reduce((sum, k) => sum + Math.max(1, weights[k]), 0);
  let roll = rng() * total;
  for (const k of allowed) {
    roll -= Math.max(1, weights[k]);
    if (roll <= 0) return k;
  }
  return allowed[allowed.length - 1];
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

// ── CHAINING ────────────────────────────────────────────────────────────────
//
// A completed pass used to END the move: outcome "delivered", credit a pass,
// next chance please. Only build-up had a follow-up, and even that jumped to a
// random attacking situation with no relationship to the pass you had just
// played. So passing was never a way of BUILDING anything — the only way to
// progress a move was to shoot.
//
// Now a pass that finds its man can hand the ball back to you further up, and
// the situation you get is read off where the ball actually arrived: play it
// into the corner and you get a cutback to deal with, find someone in the middle
// and you are shooting.

/** How many passes one move can be strung together from. */
export const CHAIN_MAX = 2;

/** The situation a completed pass has left you in. */
export function chainKindFor(at: Vec2, rng: () => number): ScenarioKind {
  const wide = Math.abs(at.x - CX) > 13;
  if (at.y < BOX_DEPTH + 2) {
    if (wide) return rng() < 0.55 ? "cutback" : "tight_angle";
    return rng() < 0.45 ? "one_on_one" : rng() < 0.6 ? "volley" : "tight_angle";
  }
  if (at.y < 32) {
    if (wide) return rng() < 0.6 ? "byline_cross" : "cutback";
    return rng() < 0.5 ? "through_ball" : "long_range";
  }
  return rng() < 0.55 ? "midfield_pass" : "buildup";
}

/**
 * How likely the ball comes back to you.
 *
 * A harder ball played to a better-connected team is likelier to come straight
 * back — the same relationship the old build-up return used, kept because it is
 * the one thing that made a difficult pass worth attempting.
 */
export function chainReturnChance(sc: Scenario): number {
  return clamp(0.22 + sc.passDifficulty * 0.42 + (sc.teamRelationship - 50) / 260, 0.1, 0.85);
}

// Where a ball on this heading will cross the goal line — what the keeper commits to.

const RECEIVER_CONTROL_T = 0.45; // seconds the teammate takes to control the ball before shooting

// A teammate who's just received a cutback/cross/through-ball takes their own shot.
// Quality is a real simulation input (accuracy spread, power, curl), not a probability
// roll — same physics as the player's own strike, driven by their role and how well
// the team combines (relationships.team).
function launchReceiverShot(ball: Ball, scenario: Scenario, rng: () => number) {
  const receiver = scenario.receiver;
  if (!receiver) return;

  const dist = Math.hypot(ball.pos.x - CX, ball.pos.y);
  const posQuality = clamp(1 - dist / 26, 0, 1);                    // closer to goal = better chance
  const teamQuality = clamp(scenario.teamRelationship / 100, 0, 1); // how well you two combine
  const composite = clamp(receiver.skill * 0.5 + posQuality * 50 + teamQuality * 25, 10, 96);

  const goalCx = (scenario.goal.x1 + scenario.goal.x2) / 2;
  const spread = 7 - composite * 0.05;   // metres of aim scatter across the mouth
  const aimX = goalCx + (rng() - 0.5) * spread;
  const baseDir = normalize({ x: aimX - ball.pos.x, y: -Math.max(ball.pos.y, 0.5) });
  const sigmaDeg = (1 - composite / 100) * 9;
  const dir = rotateDeg(baseDir, gaussian(rng) * sigmaDeg);

  const loft = clamp(0.16 + rng() * 0.22 - composite / 600, 0.03, 0.55);
  const Sh = (16 + composite * 0.16) * (1 - loft * 0.25);
  const vz = loft * (7 + composite * 0.04);
  const spin = (rng() - 0.5) * 0.9;

  ball.vel = { x: dir.x * Sh, y: dir.y * Sh };
  ball.vz = vz;
  ball.spin = spin;
  ball.z = 0.1;
  ball.loose = false;
  ball.contactCd = 0.15;
  ball.event = "receiverShot";
  // Deliberately does NOT tell the keeper where this is going. He keeps
  // patrolling; whether he is in the way is settled when the ball arrives.
}

// ── AERIAL DUEL ─────────────────────────────────────────────────────────────
// A header scenario has always placed a marker goal-side of you, and he did
// nothing: you struck the ball as though you were alone. He now challenges. He
// cannot be aimed away from — the ball is in the air and you are both jumping —
// so this is the one situation the player does not control, which is exactly
// what a header is.
const AERIAL_R = 2.8;          // metres — inside this he is up with you. Covers the
                               // whole range the marker is actually placed at; at
                               // 2.2 most headers were not contested at all.
const AERIAL_WIN_BASE = 0.3;   // his chance of winning it cleanly, at parity

function applyAerialContest(ball: Ball, scenario: Scenario, skills: KickSkills, rng: () => number) {
  if (scenario.kind !== "header") return;
  let nearest = Infinity;
  for (const d of scenario.defenders) {
    nearest = Math.min(nearest, Math.hypot(d.x - scenario.ball.x, d.y - scenario.ball.y));
  }
  if (nearest > AERIAL_R) return;

  const pressure = clamp(1 - nearest / AERIAL_R, 0, 1);
  const strength = clamp(skills.power / 100, 0, 1);
  const winProb = clamp(AERIAL_WIN_BASE + pressure * 0.42 - strength * 0.24, 0.05, 0.75);

  if (rng() < winProb) {
    // He gets there first and heads it clear — away from goal, up in the air,
    // and loose, so whoever reacts to the second ball has it.
    const away = normalize({ x: scenario.ball.x - CX, y: Math.max(scenario.ball.y, 1) });
    const sp = 9 + rng() * 7;
    ball.vel = { x: away.x * sp + (rng() - 0.5) * 4, y: away.y * sp };
    ball.vz = 3 + rng() * 2.5;
    ball.spin = 0;
    ball.loose = true;
    ball.owner = "none";
    return;
  }

  // You win it, but not cleanly: he is all over you.
  const off = rotateDeg({ x: ball.vel.x, y: ball.vel.y }, gaussian(rng) * pressure * 7);
  const damp = 1 - pressure * 0.22;
  ball.vel = { x: off.x * damp, y: off.y * damp };
  ball.vz *= damp;
}

// ── INFORMATION ECONOMY ─────────────────────────────────────────────────────
//
// Vision changes what you can SEE, not how accurately you strike the ball.
//
// The pitch is drawn in full either way — hiding players would read as a bug
// and would be unfair besides. What a low-vision player lacks is the KNOWLEDGE:
// he cannot pick out who is free, so the ball goes to whoever is obvious. A
// high-vision player has the same picture and reads three options off it,
// including the one on the far side he had to look up to find.

/** How many options a player of this vision can pick out at once. */
export function optionsSeen(vision: number): number {
  const v = clamp(vision, 0, 100);
  return v < 35 ? 1 : v < 65 ? 2 : 3;
}

/** How far up the pitch he is scanning, in metres. */
export function scanRange(vision: number): number {
  return 11 + clamp(vision, 0, 100) / 100 * 21;
}

/**
 * The options this player is actually aware of, best first.
 *
 * Everything outside his range, and everything past the number he can hold in
 * his head, is simply not surfaced — he can still hit it, he just is not being
 * told it is on.
 */
export function visibleOptions(scenario: Scenario, carrier: Vec2, vision: number): { runner: Runner; score: number }[] {
  const range = scanRange(vision);
  return [...(scenario.runner ? [scenario.runner] : []), ...scenario.secondaryRunners]
    .filter(r => Math.hypot(r.pos.x - carrier.x, r.pos.y - carrier.y) <= range)
    .map(r => ({ runner: r, score: spaceScore(r.pos, scenario, carrier) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, optionsSeen(vision));
}

/**
 * The touch you take when the ball comes back to you.
 *
 * Only ever applied to a chained scenario, because that is the only time you
 * are receiving rather than already in possession. It is not a dice roll: the
 * defence simply gets the time your touch cost them, using the same closing
 * behaviour it uses everywhere else. A poor touch means they are on you when
 * you look up.
 *
 * Returns the seconds it cost, so the UI can say so.
 */
export function applyFirstTouch(scenario: Scenario, technique: number, rng: () => number): number {
  const lost = clamp(0.8 - clamp(technique, 0, 100) / 100 * 0.55, 0.12, 0.85) * (0.85 + rng() * 0.3);
  const step = 1 / 60;
  for (let t = 0; t < lost; t += step) stepDefenders(scenario, step, scenario.player, false);
  return lost;
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

  // Horizontal launch speed, in m/s. A full-power strike from a 55-power player
  // leaves the boot around 28 m/s; a 100-power player nudges 36. Lofting bleeds
  // a little ground speed into the air.
  const Sh = power * (18 + skills.power * 0.18) * (1 - loft * 0.25);
  // Vertical launch speed from how low on the ball it was struck.
  const vz = loft * power * (7.5 + skills.power * 0.035);
  // Curl from striking the side of the ball, magnified by technique.
  const spin = contact.cx * (0.65 + tech / 100 * 1.2) * power;
  // Struck above the middle drives it on with topspin; struck underneath puts
  // backspin on it. Same contact point the loft already reads, used for how it
  // behaves off the turf.
  const topspin = clamp(-contact.cy, -1, 1) * (0.5 + tech / 200);

  // Keeper commits to the predicted crossing point.
  // No prediction here either — see stepKeeper. The keeper never learns the
  // aim, which is what lets curl and placement genuinely beat him.

  const ball: Ball = {
    pos: { x: scenario.ball.x, y: scenario.ball.y },
    vel: { x: d.x * Sh, y: d.y * Sh },
    z: 0.08,
    vz,
    spin,
    topspin,
    resting: false,
    loose: false,
    contactCd: 0,
    receiverControlT: 0,
    event: null,
    inNet: false,
  };
  // A marker challenging you in the air gets his say before anything else does.
  applyAerialContest(ball, scenario, skills, rng);
  // Decided here, once, from what you actually did with it — see isDriveAtGoal.
  ball.shot = isDriveAtGoal(ball, scenario);
  ball.owner = ball.loose ? "none" : "you";
  judgeOffside(scenario);
  return ball;
}

/**
 * Offside, judged at the moment the ball is played, against where the defence
 * actually is.
 *
 * It used to be a fixed probability baked in when the scenario was built, so
 * the defensive line could step up in front of you for two seconds and the risk
 * never moved. Now holding the ball while your runner strays past the last man
 * is a real cost — which is the other half of the decision window, and the only
 * thing that makes a defence stepping up mean anything.
 *
 * Only the through-ball is judged, and deliberately so: a scenario carries one
 * or two defenders, not a back four, so `min(defender.y)` is only a meaningful
 * offside line in the scenario that was BUILT around one. Applying it
 * everywhere flagged two thirds of ordinary midfield passes offside.
 */
function judgeOffside(scenario: Scenario) {
  const r = scenario.runner;
  if (!r || scenario.kind !== "through_ball") return;
  if (r.pos.y > scenario.ball.y - 4) return;     // not a forward ball

  const line = offsideLineY(scenario.defenders);
  const margin = r.pos.y - line;                 // positive = the right side of it
  scenario.offsideRisk = margin > 0.6 ? 0 : margin > -0.5 ? 0.3 : 0.85;
}

/**
 * Advance the keeper.
 *
 * Normally he simply patrols: a smooth, continuous sweep across his line that
 * runs whether or not a shot is on its way. He does NOT react to the ball. The
 * player is reading him, not the other way round.
 *
 * The one exception is a loose ball he has already spilled, where he scrambles
 * toward it — that is a visible chase, not a prediction.
 */
export function stepKeeper(scenario: Scenario, dt: number) {
  const k = scenario.keeper;
  if (k.flash > 0) k.flash = Math.max(0, k.flash - dt);
  // The lunge is pure animation, played out after an outcome is already decided.
  if (k.saveLunge > 0 && k.saveLunge < 1) k.saveLunge = Math.min(1, k.saveLunge + dt * 6);
  // Keeps ticking even once he is done, so a keeper who has just caught it is
  // still breathing rather than frozen mid-frame.
  k.idleT += k.done ? dt : 0;
  if (k.done) return;

  if (k.scrambling) {
    const target = clamp(k.targetX, k.startX - KEEPER_LATERAL_MAX, k.startX + KEEPER_LATERAL_MAX);
    const dx = target - k.x;
    const speed = KEEPER_DIVE_SPEED * (k.saves > 0 ? 0.78 : 1);
    k.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    const wanted = clamp(k.x - k.startX, -KEEPER_LATERAL_MAX, KEEPER_LATERAL_MAX);
    k.dive += (wanted - k.dive) * Math.min(1, dt * 12);
    return;
  }

  // ── Patrol ──
  // A dominant sweep plus a smaller one at an irrational-ish ratio, so the path
  // is smooth and learnable — the same rhythm every time — without being a
  // perfect metronome the player can solve once and forget. No snapping, no
  // instant reversals: both terms are sinusoids, so acceleration is continuous.
  const prevX = k.x;
  k.patrolT += dt;
  k.idleT += dt;
  const tier = KEEPER_TIERS[keeperTierFor(scenario.keeperStrength)];
  const w = (Math.PI * 2) / tier.period;
  const sweep =
    Math.sin(k.patrolT * w + k.patrolSeed) * 0.82 +
    Math.sin(k.patrolT * w * 1.618 + k.patrolSeed * 1.7) * 0.18;

  const want = k.startX + sweep * tier.amp;
  // Never past his own posts.
  k.x = clamp(want, POST_L + 0.35, POST_R - 0.35);

  // Lean into the direction of travel — the figure reads as gliding rather than
  // sliding, and it telegraphs which way he is going, which is the whole point.
  const vx = dt > 0 ? (k.x - prevX) / dt : 0;
  const lean = clamp(vx / KEEPER_DIVE_SPEED, -1, 1) * 0.85;
  k.dive += (lean - k.dive) * Math.min(1, dt * 8);
}

/**
 * THE PRESSURE CURVE
 *
 * Defenders used to be static dots, and the world was frozen while you aimed —
 * so a scenario had no time pressure at all and you could deliberate forever.
 * That is the single largest difference from the game this is modelled on,
 * where every moment on the ball is a shrinking window.
 *
 * Pressure now emerges from geometry alone. There is no clock and nothing on
 * screen counting down: the nearest defender closes you down, others slide onto
 * your passing lanes, and the longer you hold the ball the worse every option
 * becomes. Urgency without an artificial timer.
 *
 * Tackling is the CULMINATION of that, not a dice roll. A defender only takes
 * the ball after he has contained you and you have still not acted.
 */
const DEF_PRESS_SPEED = 4.3;   // m/s closing down. A jog into position, not a sprint.
const DEF_CONTAIN_R = 1.75;    // metres he stands off at. Patience — he contains
                               // rather than lunging, which is what makes the
                               // pressure feel like football instead of tag.
const DEF_TACKLE_S = 1.15;     // seconds contained before he commits to the tackle
const DEF_COVER_SPEED = 3.4;   // m/s sliding across to block a passing lane
const LOOSE_CONTEST_SPEED = 7;  // m/s — below this a loose ball can be won by hand
const LOOSE_WIN_R = 1.1;        // metres — how close is close enough to take it
const DEF_INTERCEPT_SPEED = 6.4;// m/s going for a ball he has read. Faster than a
                               // press (that is a jog into position) but short of
                               // a forward's sprint — he is reacting, not running
                               // a planned line.
const DEF_RECOVER_SPEED = 6.2; // m/s sprinting back after being played past
const DEF_RECOVER_GAP = 5;     // metres goal-side of the ball he tries to get to
const DEF_SUPPORT_BIAS = 0.85; // …and how far along it he sits when the man he is
                               // covering is a support player who can move. Close
                               // enough to him that outrunning the marker is
                               // possible, which at 0.62 it provably was not.
const DEF_LANE_BIAS = 0.62;    // how far along the lane a cover defender sits,
                               // 0 = beside you, 1 = on top of the receiver

/** Assign roles once, when a scenario starts. */
export function initDefenders(scenario: Scenario, rng: () => number) {
  const deadBall = scenario.kind === "penalty"
    || scenario.kind === "free_kick"
    || scenario.kind === "corner";

  // Nearest to the ball presses; the rest cover. On a dead ball nobody moves —
  // a wall that charged you before the whistle would be nonsense.
  const order = scenario.defenders
    .map((d, i) => ({ i, dist: Math.hypot(d.x - scenario.player.x, d.y - scenario.player.y) }))
    .sort((a, b) => a.dist - b.dist);

  scenario.defenders.forEach((d, i) => {
    d.homeX = d.x;
    d.homeY = d.y;
    d.containT = 0;
    // Small per-defender variation so a back four does not move as one object.
    d.speed = 1 + (rng() - 0.5) * 0.18;
    d.role = deadBall ? "hold" : (order[0]?.i === i ? "press" : "cover");
    d.baseRole = d.role;
    d.interceptTo = undefined;
  });
}

/**
 * Advance the defence. Runs during AIMING as well as flight — that is the
 * whole point, and the reason a decision window exists at all.
 *
 * Returns "tackled" when a contained carrier has dwelt too long.
 */
export function stepDefenders(
  scenario: Scenario,
  dt: number,
  carrier: Vec2,
  carrierHasBall: boolean,
  ball: Ball | null = null,
): Outcome | null {
  let lost: Outcome | null = null;

  // ── Reading the ball ──
  // A defender used to deflect a pass only if it happened to pass within a
  // metre of where he was already standing — he never went for it. Now he reads
  // the flight: if he can get to a point on its path, he goes, and the existing
  // deflection handles the contact when he arrives. That is what makes a slow
  // ball into a covered lane a genuine mistake rather than a free pass.
  //
  // A defender the ball has already gone past does the other thing a defender
  // does: turns and sprints back goal-side.
  const liveBall = !!ball && !ball.resting && !ball.inNet
    && Math.hypot(ball.vel.x, ball.vel.y) > 2;

  for (const d of scenario.defenders) {
    if (d.baseRole === "hold") continue;            // a wall stays a wall
    if (!liveBall || !ball) {
      if (d.role === "intercept" || d.role === "recover") d.role = d.baseRole ?? "cover";
      continue;
    }
    // Defenders read PASSES, not shots. A block stays a matter of already being
    // in the way — which is exactly what covering a lane earns you — rather than
    // a defender stepping into a strike he could not have anticipated.
    //
    // He also COMMITS. Re-solving every frame made him chase the earliest point
    // he could still theoretically reach, which moves away from him as fast as
    // the ball does, so he trailed it the whole way and almost never arrived —
    // 20,000 frames of chasing changed 7 passes in 500. He now keeps the point
    // he picked until the ball is past it, and the solver uses HIS speed, not a
    // nominal one, so a commitment is a commitment he can keep.
    const committed = d.role === "intercept" && d.interceptTo
      && (ball.vel.x * (d.interceptTo.x - ball.pos.x) + ball.vel.y * (d.interceptTo.y - ball.pos.y)) > 0;
    const p = ball.shot
      ? null
      : committed
        ? d.interceptTo!
        // 0.8 of his real pace, so he only leaves his covering position for an
        // interception he arrives at with something to spare. Measured: chasing
        // one he could only just theoretically reach was WORSE than standing on
        // the lane, because he vacated it and then did not get there.
        : interceptFrom(ball, d, DEF_INTERCEPT_SPEED * (d.speed ?? 1) * 0.8, DEF_BLOCK_R, PURSUIT_HORIZON * 0.7);
    if (p && ball.z < DEF_BLOCK_H + 0.6) {
      d.role = "intercept";
      d.interceptTo = p;
    } else if (d.y > ball.pos.y + 2.5) {
      d.role = "recover";
    } else {
      d.role = d.baseRole ?? "cover";
    }
  }

  // The most dangerous option to cut out: the runner a pass is aimed at, or
  // failing that the goal itself.
  const threat = scenario.runner?.pos
    ?? scenario.secondaryRunners.find(r => r.role !== "support")?.pos
    ?? { x: (scenario.goal.x1 + scenario.goal.x2) / 2, y: 0 };

  // The best of the support players, if there is a spare defender to worry
  // about him. He is marked at a bias much closer to himself than the scripted
  // threat is, which is what makes him beatable: at 0.62 the marker only has to
  // move 62% as far as he does, so no amount of running could ever open a lane.
  let secondThreat: Vec2 | null = null;
  if (scenario.defenders.length > 1) {
    let bestS = -1;
    for (const r of scenario.secondaryRunners) {
      if (r.role !== "support") continue;
      const s = spaceScore(r.pos, scenario, carrier);
      if (s > bestS) { bestS = s; secondThreat = r.pos; }
    }
  }
  let coverIndex = 0;

  for (const d of scenario.defenders) {
    const role = d.role ?? "hold";
    const spd = d.speed ?? 1;

    if (role === "press") {
      // Close to the containment ring and hold there. Approaching all the way
      // in would read as lunging, and would make every scenario a race rather
      // than a decision.
      const dx = carrier.x - d.x, dy = carrier.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const gap = dist - DEF_CONTAIN_R;
      if (gap > 0.02) {
        const step = Math.min(gap, DEF_PRESS_SPEED * spd * dt);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      }

      // Contained. Now patience runs out — but only while you still have it.
      if (carrierHasBall && dist <= DEF_CONTAIN_R + 0.35) {
        d.containT = (d.containT ?? 0) + dt;
        if ((d.containT ?? 0) >= DEF_TACKLE_S) lost = "tackled";
      } else {
        d.containT = 0;
      }
    } else if (role === "cover") {
      // Slide onto the line between the carrier and the danger, shrinking the
      // passing lane rather than chasing the ball. Every option gets worse.
      const mine = coverIndex === 0 || !secondThreat ? threat : secondThreat;
      const bias = mine === secondThreat ? DEF_SUPPORT_BIAS : DEF_LANE_BIAS;
      coverIndex += 1;
      const tx = carrier.x + (mine.x - carrier.x) * bias;
      const ty = carrier.y + (mine.y - carrier.y) * bias;
      const dx = tx - d.x, dy = ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const step = Math.min(dist, DEF_COVER_SPEED * spd * dt);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      }
    } else if (role === "intercept" && d.interceptTo) {
      const dx = d.interceptTo.x - d.x, dy = d.interceptTo.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.02) {
        const step = Math.min(dist, DEF_INTERCEPT_SPEED * spd * dt);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      }
    } else if (role === "recover") {
      // Get between the ball and the goal, not back to where you started.
      const goalC = { x: (scenario.goal.x1 + scenario.goal.x2) / 2, y: 0 };
      const bx = carrier.x, by = carrier.y;
      const gl = Math.hypot(goalC.x - bx, goalC.y - by) || 1;
      const tx = bx + (goalC.x - bx) / gl * DEF_RECOVER_GAP;
      const ty = by + (goalC.y - by) / gl * DEF_RECOVER_GAP;
      const dx = tx - d.x, dy = ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const step = Math.min(dist, DEF_RECOVER_SPEED * spd * dt);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      }
    }
    // "hold" defenders stay exactly where the scenario placed them.
  }

  return lost;
}

// ── SPACE, SUPPORT AND PURSUIT ───────────────────────────────────────────────
//
// Everything below exists because the attack used to be furniture. Team-mates
// were a `Vec2[]` the renderer drew and nothing read; the one runner a pass was
// aimed at ran a scripted line to a fixed point and ignored the ball unless it
// arrived on top of him. So while the defence closed you down, your options
// only ever got worse — there was no release valve, and a pass that was not
// struck perfectly was simply wasted, because nobody would come and get it.
//
// Now: support players read where the space is and move into it while you hold
// the ball, and everybody chases a ball that was not played straight to them.

/** Perpendicular distance from a point to the segment a→b. */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const sx = b.x - a.x, sy = b.y - a.y;
  const len2 = sx * sx + sy * sy;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * sx + (p.y - a.y) * sy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + sx * t), p.y - (a.y + sy * t));
}

/**
 * How open the ball's path from a to b is, in metres of clearance.
 *
 * A defender only blocks a lane he is actually IN. The man closing YOU down
 * stands within a couple of metres of the start of every lane at once, so
 * measuring raw distance-to-segment made him block every option equally — the
 * best available pass then fell by the same amount wherever a support player
 * ran, and moving was mathematically pointless. He is skipped here, which is
 * also just true: a defender at your feet is not between you and anybody.
 */
function laneClearance(a: Vec2, b: Vec2, defenders: Vec2[]): number {
  const sx = b.x - a.x, sy = b.y - a.y;
  const len2 = sx * sx + sy * sy;
  if (len2 < 1e-6) return 99;
  let worst = 99;
  for (const d of defenders) {
    const t = ((d.x - a.x) * sx + (d.y - a.y) * sy) / len2;
    if (t < 0.2 || t > 1.05) continue;              // not in this lane
    const cl = clamp(t, 0, 1);
    worst = Math.min(worst, Math.hypot(d.x - (a.x + sx * cl), d.y - (a.y + sy * cl)));
  }
  return worst;
}

const SUPPORT_MIN_PASS = 6;    // metres — closer than this and you may as well carry it
const SUPPORT_MAX_PASS = 26;   // …and beyond this it stops being a support option
const SUPPORT_REPLAN_S = 0.3;  // how often a support player re-reads the pitch
const SUPPORT_SPEED = 4.6;     // m/s — finding space is a jog, not a sprint
const PURSUIT_HORIZON = 2.6;   // seconds ahead a player will chase a ball
const PURSUIT_STEP = 0.08;     // seconds per prediction step

/**
 * How good a position is to receive a pass, 0..1.
 *
 * The five things a player actually weighs up, in the order they matter:
 * can the ball reach me (is the lane open), am I marked, is it worth playing
 * (am I further forward), am I in a sensible range, and am I standing in the
 * way of my own team-mate's shot. That last one is why a support player drifts
 * off the shooting line rather than blocking it — a real footballing concern
 * that also stops him eating shots you meant for the goal.
 */
export function spaceScore(p: Vec2, scenario: Scenario, carrier: Vec2): number {
  // Off the pitch is not space.
  if (p.x < 3 || p.x > PITCH_W - 3 || p.y < 1.5 || p.y > HALF_LEN + 6) return 0;

  const passLen = Math.hypot(p.x - carrier.x, p.y - carrier.y);
  if (passLen < SUPPORT_MIN_PASS * 0.5) return 0;

  let nearestDef = 99;
  for (const d of scenario.defenders) {
    nearestDef = Math.min(nearestDef, Math.hypot(d.x - p.x, d.y - p.y));
  }
  const lane = laneClearance(carrier, p, scenario.defenders);

  const laneOpen = clamp(lane / 3.5, 0, 1);
  const unmarked = clamp(nearestDef / 7, 0, 1);
  // Forward of the ball is worth more, but dropping in is still an option.
  const advance = clamp((carrier.y - p.y) / 18, -0.4, 1) * 0.5 + 0.5;
  // A bell over the sensible passing range.
  const range = passLen < SUPPORT_MIN_PASS
    ? passLen / SUPPORT_MIN_PASS
    : clamp(1 - (passLen - SUPPORT_MIN_PASS) / (SUPPORT_MAX_PASS - SUPPORT_MIN_PASS), 0, 1);

  const goalC = { x: (scenario.goal.x1 + scenario.goal.x2) / 2, y: 0 };
  const blocksShot = distToSegment(p, carrier, goalC) < 2.6 && p.y < carrier.y ? 1 : 0;

  return clamp(
    laneOpen * 0.34 + unmarked * 0.26 + advance * 0.2 + range * 0.2 - blocksShot * 0.3,
    0, 1,
  );
}

/**
 * Where a support player should go from where he is.
 *
 * Sampled rather than solved: three rings of candidate positions around him,
 * scored, best one wins. He only moves if the new spot is meaningfully better,
 * so he settles instead of drifting forever, and never more than one stride's
 * worth of decision per replan.
 */
export function bestSupportPoint(scenario: Scenario, carrier: Vec2, from: Vec2): Vec2 {
  let best = { x: from.x, y: from.y };
  let bestScore = spaceScore(from, scenario, carrier) + 0.04; // incumbency bonus
  for (const radius of [3.5, 7, 11]) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const p = { x: from.x + Math.cos(ang) * radius, y: from.y + Math.sin(ang) * radius };
      const s = spaceScore(p, scenario, carrier);
      if (s > bestScore) { bestScore = s; best = p; }
    }
  }
  return best;
}

/**
 * Where a moving ball will be in `t` seconds.
 *
 * The same integrator the real step uses, minus curl and collisions — close
 * enough to run onto, and deliberately not perfect: a player reading a curling
 * ball should be slightly wrong about it.
 */
function predictBall(ball: Ball, t: number): { pos: Vec2; z: number } {
  let x = ball.pos.x, y = ball.pos.y, z = ball.z;
  let vx = ball.vel.x, vy = ball.vel.y, vz = ball.vz;
  const dt = PURSUIT_STEP;
  for (let s = 0; s < t - 1e-6; s += dt) {
    if (z > 0.02) {
      const k = Math.max(0, 1 - AIR_DRAG * dt);
      vx *= k; vy *= k;
    }
    vz -= G * dt;
    z += vz * dt;
    x += vx * dt;
    y += vy * dt;
    if (z <= 0) {
      z = 0;
      if (vz < -MIN_BOUNCE_VZ) { vz = -vz * BOUNCE_VZ; vx *= BOUNCE_H; vy *= BOUNCE_H; }
      else {
        vz = 0;
        const sp = Math.hypot(vx, vy), drop = GROUND_FRICTION * dt;
        if (sp <= drop) { vx = 0; vy = 0; }
        else { const f = (sp - drop) / sp; vx *= f; vy *= f; }
      }
    }
  }
  return { pos: { x, y }, z };
}

/**
 * The soonest point on the ball's path this player can actually get to.
 *
 * Null when he cannot reach it at all, which is what makes an overhit pass a
 * genuine mistake rather than one the receiver silently rescues.
 */
export function interceptFrom(ball: Ball, from: Vec2, speed: number, reach: number, horizon = PURSUIT_HORIZON): Vec2 | null {
  for (let t = PURSUIT_STEP; t <= horizon; t += PURSUIT_STEP) {
    const b = predictBall(ball, t);
    if (b.z > 2.4) continue;                       // over his head at that moment
    const need = Math.hypot(b.pos.x - from.x, b.pos.y - from.y);
    if (need <= speed * t + reach) return b.pos;
  }
  return null;
}

export function interceptPoint(ball: Ball, r: Runner): Vec2 | null {
  return interceptFrom(ball, r.pos, r.speed, PASS_CONTROL_R * 0.7);
}

/**
 * Advance the attack.
 *
 * Two jobs, and which one applies is decided by whether the ball is live:
 *
 * BALL IN FLIGHT — everyone goes for it. A player who can reach the ball's path
 * before it passes him redirects onto the interception point instead of running
 * his scripted line, so a pass that was not struck straight at a man can still
 * be won, and a pass nobody can reach is genuinely wasted.
 *
 * BALL AT YOUR FEET — support players look for space. They re-read the pitch
 * every 0.4 s, so as the cover defenders slide across to shut your lane down,
 * the man they are covering moves somewhere they are not. This is the release
 * valve the Pressure Curve had been missing: options no longer only decay.
 */
/**
 * Is this ball your strike at goal rather than a ball for a team-mate?
 *
 * Judged on where it was struck and how hard, not on where it will end up: a
 * shot that curls, clips a defender or is parried is still your shot, and a
 * support player who wandered into it and "controlled" it would turn a goal
 * into a completed pass — much the worst thing this system could produce.
 *
 * A lay-off is slow, or played at a real angle away from goal. Anything driven
 * within a narrow cone of the goal belongs to you.
 */
const LAYOFF_MAX_SPEED = 10;        // m/s — below this it is a pass however it is aimed
const SHOT_MOUTH_PAD = 3;           // metres either side of the posts still counted as
                                    // a shot, so a mishit is still your mishit

export function isDriveAtGoal(ball: Ball, scenario: Scenario): boolean {
  // A rebound belongs to the poacher, never to a support player.
  if (ball.loose) return true;
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  if (speed < LAYOFF_MAX_SPEED) return false;
  if (ball.vel.y >= -1) return false;                 // not going that way at all
  // Where it would cross the line if nothing touched it. A cone around the goal
  // was the obvious test and it was wrong: from the byline EVERY forward pass
  // sits inside the cone, so a cutback to a team-mate was unplayable.
  const t = ball.pos.y / -ball.vel.y;
  const b = predictBall(ball, Math.min(t, 3));
  return b.pos.x > scenario.goal.x1 - SHOT_MOUTH_PAD
    && b.pos.x < scenario.goal.x2 + SHOT_MOUTH_PAD
    && b.z < scenario.crossbar + 3;
}

export function stepSupport(scenario: Scenario, ball: Ball | null, carrier: Vec2, dt: number) {
  const all: Runner[] = scenario.runner
    ? [scenario.runner, ...scenario.secondaryRunners]
    : [...scenario.secondaryRunners];
  if (all.length === 0) return;

  const live = !!ball && !ball.resting && !ball.inNet && !scenario.receiverDone
    && Math.hypot(ball.vel.x, ball.vel.y) > 1.5;
  // Nobody runs across their own team-mate's shot. Without this a support player
  // standing anywhere near the flight would collect it and the goal would be
  // stolen by his own side, which is the worst outcome this whole system could
  // produce.
  const shot = !!ball?.shot;

  for (const r of all) {
    r.replanIn = (r.replanIn ?? 0) - dt;

    if (live && ball && !(shot && r.role === "support")) {
      const p = interceptPoint(ball, r);
      if (p) {
        r.to = p;
        r.moving = true;
        r.sprint = true;
        continue;
      }
      // Cannot get there. A target man keeps running his line; a support player
      // stops chasing something he was never going to reach.
      if (r.role === "support") r.moving = false;
      continue;
    }
    if (live) continue;   // ball is in the air and this man is not going for it

    if (r.role !== "support") continue;
    if ((r.replanIn ?? 0) > 0) continue;
    r.replanIn = SUPPORT_REPLAN_S;
    const target = bestSupportPoint(scenario, carrier, r.pos);
    if (Math.hypot(target.x - r.pos.x, target.y - r.pos.y) > 0.6) {
      r.to = target;
      r.moving = true;
      r.sprint = false;
    }
  }
}

// Advance the team-mate making the run. They move at a real sprinting pace, which
// is what makes a through-ball a question of weight and timing rather than of
// hitting a static circle.
export function stepRunner(scenario: Scenario, dt: number) {
  const move = (r: Runner | null) => {
    if (!r || !r.moving) return;
    const dx = r.to.x - r.pos.x, dy = r.to.y - r.pos.y;
    const dist = Math.hypot(dx, dy);
    // Finding space is a jog; going after the ball is a sprint.
    const step = r.speed * (r.sprint === false ? 0.72 : 1) * dt;
    if (dist <= step) { r.pos.x = r.to.x; r.pos.y = r.to.y; r.moving = false; return; }
    r.pos.x += (dx / dist) * step;
    r.pos.y += (dy / dist) * step;
  };
  move(scenario.runner);
  for (const r of scenario.secondaryRunners) move(r);
}

// Advance the rebound poacher. Chases a loose ball and pokes a follow-up goalward.
export function stepFollower(scenario: Scenario, ball: Ball, rng: () => number, dt: number) {
  const f = scenario.follower;
  if (f.shot) return;

  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const dangerous = ball.loose && !ball.resting && ball.pos.y < BOX_DEPTH && speed < 24;
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
  if (dist < 1.2 && ball.z < 1.6) {
    const tx = POST_L + rng() * (POST_R - POST_L);
    const dir = normalize({ x: tx - ball.pos.x, y: -Math.max(ball.pos.y, 0.5) });
    const sp = 17 + rng() * 8;
    ball.vel = { x: dir.x * sp, y: dir.y * sp };
    ball.vz = 0.3 + rng() * 0.7;
    ball.spin *= 0.3;
    ball.loose = false;                         // a fresh shot — but it still counts as a rebound if it goes in
    ball.contactCd = 0.18;
    f.shot = true;
    // Keeper reacts late, already out of position from the first save.
    // Deliberately does NOT tell the keeper where this is going. He keeps
  // patrolling; whether he is in the way is settled when the ball arrives.
  }
}

/**
 * How far from the keeper a shot can cross the line and still be saved.
 *
 * Deliberately depends on the KEEPER and nothing else — not on the shot's pace,
 * not on which corner it is heading for, not on its height. Those all used to
 * carry their own penalty multipliers, which is a hidden hand on the scales.
 * They now matter for the honest reason instead:
 *
 *   · a fast shot gives him less time to patrol into the way;
 *   · a corner is simply further from wherever he is;
 *   · a high shot is further once height is scaled;
 *   · curl bends the ball away from the point he was heading for.
 *
 * Each prior save on the same ball leaves him grounded, which is the one
 * concession to a scramble rather than a first shot.
 */
function keeperSaveRadius(scenario: Scenario): number {
  // Blend of the smooth rating curve and the tier's headline number, so a
  // keeper still improves gradually within a tier rather than stepping.
  const smooth = KEEPER_SAVE_R_MIN
    + (clamp(scenario.keeperStrength, 0, 100) / 100) * (KEEPER_SAVE_R_MAX - KEEPER_SAVE_R_MIN);
  const tier = KEEPER_TIERS[keeperTierFor(scenario.keeperStrength)].radius;
  const base = smooth * 0.5 + tier * 0.5;
  const wear = Math.max(0.45, 1 - 0.35 * scenario.keeper.saves);
  return base * wear;
}

/**
 * Which save animation best fits a save that has ALREADY been decided.
 *
 * This is the spec's rule made literal: gameplay determines the animation, and
 * the animation never determines gameplay. By the time this is called the shot
 * is saved — all that is left is to pick the version of it that matches where
 * the ball actually was, so the keeper looks like he did the thing that just
 * happened.
 */
function classifySave(
  xCross: number, zCross: number, keeperX: number, margin: number, outcome: Outcome | null,
): SaveKind {
  const dx = Math.abs(xCross - keeperX);
  const dz = zCross - KEEPER_CENTRE_Z;

  // Right on the edge of his reach, or clawed away — fingertips.
  if (margin < 0.18 || outcome === "tipped") {
    return zCross > 1.6 ? "high" : "fingertip";
  }
  // Gathered cleanly and close to the body — a catch.
  if (outcome === "caught" && dx < 1.0 && Math.abs(dz) < 0.8) return "catch";
  // Straight at him: blocked with the body rather than dived at.
  if (dx < 0.7) return Math.abs(dz) < 0.7 ? "central" : (dz > 0 ? "high" : "low");
  // Otherwise it is a dive, and only the height decides which kind.
  if (zCross > 1.55) return "high";
  if (zCross < 0.6) return "low";
  return margin < 0.4 ? "fingertip" : "low";
}

/**
 * Is a ball crossing the plane at (x, z) inside the keeper's save volume?
 *
 * Height is scaled, so the volume is a flattened ellipse — wide across the line
 * and shallow upward. That is what makes the top corners the safest target
 * without giving them any explicit bonus.
 */
function keeperCovers(scenario: Scenario, xCross: number, zCross: number): { saved: boolean; margin: number } {
  const k = scenario.keeper;
  const r = keeperSaveRadius(scenario);
  const dx = xCross - k.x;
  const dz = (zCross - KEEPER_CENTRE_Z) * KEEPER_SAVE_Z_SCALE;
  const d = Math.hypot(dx, dz);
  // margin: 1 = straight at him, 0 = right on the edge of his reach.
  return { saved: d < r, margin: clamp((r - d) / r, 0, 1) };
}

// Resolve a keeper contact into catch / parry / tip. Returns a terminal Outcome
// for catch/tip, or null when the ball is parried and stays live.
function resolveKeeper(ball: Ball, scenario: Scenario, dist: number, reach: number, speed: number, rng: () => number): Outcome | null {
  const k = scenario.keeper;
  k.saves += 1;
  k.flash = 0.35;
  const marginNorm = clamp((reach - dist) / reach, 0, 1); // 1 = right at the body, 0 = full stretch
  const lowAndSlow = speed < 17 && ball.z < 1.2;

  // Comfortable, gathered save.
  if (marginNorm > 0.5 && lowAndSlow && rng() < 0.72) {
    ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.resting = true;
    k.done = true;
    return "caught";
  }

  // Full-stretch, high or fierce → tip it to safety (over the bar / around the post).
  if (marginNorm < 0.24 || ball.z > 1.85 || speed > 26) {
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
  // Keeper scrambles back toward where the ball spills — a visible chase, and
  // the only time he stops patrolling.
  k.targetX = ball.pos.x;
  k.scrambling = true;
  return null;
}

// A defender in the way deflects the ball rather than swallowing it.
function deflectOffDefender(ball: Ball, d: Vec2, rng: () => number): boolean {
  const n = normalize({ x: ball.pos.x - d.x, y: ball.pos.y - d.y }); // outward from defender
  const vn = ball.vel.x * n.x + ball.vel.y * n.y;
  if (vn >= 0) return false; // already moving away — no real contact
  // Reflect the incoming component, then damp: a genuine deflection, not a wall.
  const damp = 0.42 + rng() * 0.22;
  const jitter = (rng() - 0.5) * 3;
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
  let bouncedThisStep = false;
  if (ball.z <= 0) {
    ball.z = 0;
    if (ball.vz < -MIN_BOUNCE_VZ) {
      const top = clamp(ball.topspin ?? 0, -1, 1);
      // Topspin flattens the bounce and runs on; backspin sits up and checks.
      ball.vz = -ball.vz * BOUNCE_VZ * (1 - top * BOUNCE_TOPSPIN_VZ);
      const keep = BOUNCE_H * (1 + top * BOUNCE_TOPSPIN_H);
      ball.vel.x *= keep;
      ball.vel.y *= keep;

      // Sidespin bites on the turf and turns the ball a little off straight —
      // small enough to stay readable, big enough that a curler visibly keeps
      // working after it lands.
      if (Math.abs(ball.spin) > 0.0001) {
        const sp = Math.hypot(ball.vel.x, ball.vel.y);
        if (sp > 0.01) {
          const a = ball.spin * BOUNCE_SIDESPIN_TURN;
          const cos = Math.cos(a), sin = Math.sin(a);
          const vx = ball.vel.x, vy = ball.vel.y;
          ball.vel.x = vx * cos - vy * sin;
          ball.vel.y = vx * sin + vy * cos;
        }
      }
      // Curl survives the bounce rather than being wiped by it.
      ball.spin *= BOUNCE_SPIN_KEEP;
      bouncedThisStep = true;
    } else {
      ball.vz = 0;
    }
  }
  // Rolling resistance, and ONLY while genuinely rolling. Applying it on the
  // same step as a bounce charged a skipping ball twice and was part of why it
  // pulled up so sharply.
  if (ball.z <= 0.03 && !bouncedThisStep && ball.vz <= 0.01) {
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
  if (ball.contactCd <= 0 && ball.z < DEF_BLOCK_H && speed > 4) {
    for (const d of scenario.defenders) {
      if (Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y) < DEF_BLOCK_R) {
        deflectOffDefender(ball, d, rng);
        break;
      }
    }
  }

  // --- The 50-50 on a loose ball ---
  //
  // A deflection, a parry or a header lost in the air used to just roll until it
  // stopped and the chance fizzled out as "scrambled clear". A loose ball
  // belongs to nobody, so it is now genuinely contested: whoever is closest when
  // it slows down has it. Your poacher already races for these in the box; this
  // is the other half of that race, and it is why leaving a rebound rolling in
  // front of a defender costs you the ball.
  if (ball.loose && !ball.inNet && ball.contactCd <= 0 && ball.z < 1.4 && speed < LOOSE_CONTEST_SPEED && ball.pos.y > 0.2) {
    let dDef = Infinity;
    for (const d of scenario.defenders) {
      dDef = Math.min(dDef, Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y));
    }
    if (dDef < LOOSE_WIN_R) {
      let dAtk = Math.hypot(scenario.player.x - ball.pos.x, scenario.player.y - ball.pos.y);
      if (scenario.follower.active && !scenario.follower.shot) {
        dAtk = Math.min(dAtk, Math.hypot(scenario.follower.x - ball.pos.x, scenario.follower.y - ball.pos.y));
      }
      for (const r of [...(scenario.runner ? [scenario.runner] : []), ...scenario.secondaryRunners]) {
        dAtk = Math.min(dAtk, Math.hypot(r.pos.x - ball.pos.x, r.pos.y - ball.pos.y));
      }
      if (dDef < dAtk) {
        ball.owner = "opponent";
        return "tackled";
      }
    }
  }

  // --- Keeper body contact (a ball that physically runs into him) ---
  // NOT the shot-stopping test. That happens at the goal plane below, where the
  // ball's crossing point is compared against where he actually is. This is only
  // for a ball rolling or dribbled into the keeper himself — a smother — so it
  // uses his real body width and nothing else.
  const k = scenario.keeper;
  if (!k.done && ball.contactCd <= 0 && ball.z < KEEPER_VREACH && ball.pos.y > 0.1) {
    const dist = Math.hypot(k.x - ball.pos.x, k.y - ball.pos.y);
    if (dist < KEEPER_BODY_R) {
      const res = resolveKeeper(ball, scenario, dist, KEEPER_BODY_R, speed, rng);
      if (res) return res; // caught or tipped
      // parried — ball is loose, keep simulating this tick
    }
  }

  // --- Pass reception, tested against the RUNNER's live position ---
  // Swept along the ball's path so a fast pass can't tunnel past the player it
  // was aimed at. This is what stops a pass visually going straight through a
  // team-mate: the man and the reception test are now the same object.
  if (!scenario.receiverDone && ball.z < 2.6) {
    const candidates: Runner[] = scenario.runner
      ? [scenario.runner, ...scenario.secondaryRunners]
      : [...scenario.secondaryRunners];
    // A support player will not put his foot on a ball that is going in. He
    // steps out of the way of it, which is the only reason it is safe to have
    // team-mates standing in front of goal at all.
    const shotAtGoal = ball.shot === true;
    for (const r of candidates) {
      if (shotAtGoal && r.role === "support") continue;
      const tgt = r.pos;
      let swept = Math.hypot(tgt.x - ball.pos.x, tgt.y - ball.pos.y);
      const segX = ball.pos.x - prevX, segY = ball.pos.y - prevY;
      const segLen2 = segX * segX + segY * segY;
      if (segLen2 > 0.01) {
        const t = clamp(((tgt.x - prevX) * segX + (tgt.y - prevY) * segY) / segLen2, 0, 1);
        const closestX = prevX + segX * t, closestY = prevY + segY * t;
        swept = Math.min(swept, Math.hypot(tgt.x - closestX, tgt.y - closestY));
      }
      if (swept < PASS_CONTROL_R) {
        scenario.receiverDone = true;
        scenario.receivedAt = { x: tgt.x, y: tgt.y };
        r.moving = false;
        // How difficult was that ball? Forward + long = harder, and a harder ball
        // won back is likelier to come straight back to you.
        const passLen = Math.hypot(tgt.x - scenario.ball.x, tgt.y - scenario.ball.y);
        const forward = scenario.ball.y - tgt.y;
        scenario.passDifficulty = clamp(forward / 25 + passLen / 45, 0, 1);

        // Offside is judged at the moment the ball was played, and every runner is
        // built onside, so this only ever fires on a genuinely marginal start.
        if (scenario.offsideRisk > 0 && rng() < scenario.offsideRisk) return "offside";

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
    const crossbar = scenario.crossbar;
    if (insideGoalMouth(xCross)) {
      if (zCross > crossbar + BALL_R) return "over";
      if (zCross > crossbar - BALL_R) return "post"; // clipped the underside of the bar

      // ── THE SAVE DECISION ──
      // Gameplay first, animation second. Where the ball crosses is compared
      // against where the keeper actually is at this instant — he never knew
      // where it was going, so curl that bends away from him beats him, and a
      // corner beats him simply by being far from wherever he had patrolled to.
      if (!k.done) {
        const cover = keeperCovers(scenario, xCross, zCross);
        if (cover.saved) {
          // Only NOW is an animation picked, and it is chosen to match the
          // outcome that has already been decided: he lunges toward the ball so
          // the save reads as a save.
          k.saveDir = Math.sign(xCross - k.x) || 0;
          k.saveLunge = 0.001;
          k.scrambling = false;
          ball.pos.x = xCross;
          ball.pos.y = 0.02;
          ball.z = Math.max(0, zCross);
          const r = keeperSaveRadius(scenario);
          const outcome = resolveKeeper(ball, scenario, (1 - cover.margin) * r, r, speed, rng);
          // Animation LAST, and chosen to match the outcome that is now settled.
          k.saveKind = classifySave(xCross, zCross, k.x, cover.margin, outcome);
          return outcome ?? null;
        }
      }

      // Beat the keeper and crossed the line. Let it carry on into the netting so
      // the goal is SEEN rather than announced — the UI keeps stepping it while
      // the net slows it down.
      ball.inNet = true;
      ball.vel.x *= 0.55; ball.vel.y *= 0.55; ball.vz = Math.min(ball.vz, 0);
      return ball.loose ? "rebound" : "goal";
    }
    if (hitsPost(xCross)) return "post";
    return "wide";
  }

  // Out of bounds.
  if (ball.pos.x < -2 || ball.pos.x > PITCH_W + 2 || ball.pos.y > HALF_LEN + 8) return "out";

  if (ball.resting) return "short";
  return null;
}

// Keep a scored ball moving into the netting after the outcome has resolved.
// Purely cosmetic — no collisions, no outcome, just the ball settling in the goal.
export function stepBallInNet(ball: Ball, dt: number) {
  if (!ball.inNet) return;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.vz -= G * dt;
  ball.z = Math.max(0, ball.z + ball.vz * dt);
  // The net catches it.
  const drag = Math.max(0, 1 - 5.5 * dt);
  ball.vel.x *= drag;
  ball.vel.y *= drag;
  // Back netting.
  if (ball.pos.y < -NET_DEPTH + 0.35) {
    ball.pos.y = -NET_DEPTH + 0.35;
    ball.vel.x *= 0.4; ball.vel.y = 0;
  }
  // Side netting — a ball that crossed the line inside the posts stays inside
  // them. Without this its residual sideways pace carried it out through the
  // side of the goal, so a legitimate goal could finish drawn outside the net.
  const inL = POST_L + BALL_R, inR = POST_R - BALL_R;
  if (ball.pos.x < inL) { ball.pos.x = inL; ball.vel.x = Math.abs(ball.vel.x) * 0.25; }
  else if (ball.pos.x > inR) { ball.pos.x = inR; ball.vel.x = -Math.abs(ball.vel.x) * 0.25; }
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
  offside: { text: "OFFSIDE!", kind: "neutral" },
  tackled: { text: "DISPOSSESSED", kind: "miss" },
};
