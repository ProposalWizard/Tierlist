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

/**
 * Which way the frame is turned.
 *
 * "up" is the ordinary view: you at the bottom, the goal at the top, the pitch
 * running away from you. "left" and "right" are the same rectangle rotated a
 * quarter turn, with the goal at that side of the screen — which is the only
 * way to look at a ball wide on the byline. From the ordinary camera a crossing
 * position puts the goal off in the corner and the whole box edge-on; turned,
 * you are looking straight across the six-yard box at everybody in it, which is
 * the decision a cross actually asks you to make.
 *
 * The rotation is a rotation, not a mirror: "right" is the ordinary view turned
 * clockwise, "left" turned anticlockwise, and each is chosen so that you end up
 * near the bottom of the screen the way you always are.
 */
export type Facing = "up" | "left" | "right";

// A moment worth narrating, surfaced from the physics tick to the UI once and consumed.
export type BallEvent = "received" | "receiverShot" | "post";

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
  /** Seconds this ball has been lying still, waiting for somebody to reach it. */
  restT?: number;
  /** How many times it has come back off the frame. Two is pinball; stop at one. */
  postHits?: number;
  /**
   * Where this ball will first touch the grass, worked out once at the moment it
   * was struck. Undefined for a ball that is already down.
   */
  landAt?: Vec2;
  /**
   * The move is over but the ball is still travelling — a save pushed clear.
   * The result phase keeps stepping it so you see where it went instead of
   * finding it already there.
   */
  settling?: boolean;
  /**
   * YOU struck this ball at goal.
   *
   * Decided once, at your contact, and never touched again. `shot` cannot answer
   * this question: `launchReceiverShot` sets it too, because a team-mate's shot
   * needs the same protection from your own players stepping in front of it. So
   * the moment a team-mate you found pulled the trigger, `shot` went true and
   * the credit read it as YOURS — you were given the goal, he was given nothing,
   * and the assist you had just played was never recorded. Every symptom of
   * "it counted as a team goal" came from this one line.
   */
  youStruckAtGoal?: boolean;
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
  /**
   * Who touched it last, and whether the move has been through a deflection.
   *
   * Both exist to NAME what happened, and neither changes any physics. A shot
   * the keeper pushed away and a defender then hoofed clear was reported as
   * "DISPOSSESSED"; the same shot rolling out of the frame was "Out of play";
   * one that struck the post and died in the six-yard box was "Scrambled
   * clear". In every case the thing that actually happened — a save, the
   * woodwork — went unmentioned, because the engine only ever described the
   * ball's last few metres.
   *
   * `lastTouch` is the ball's most recent contact and is read the tick AFTER
   * it is set, so a terminal outcome can be attributed to whoever stopped it.
   * `deflected` is sticky for the whole move: it survives a fresh strike,
   * which is what makes a follow-up finish a rebound rather than a plain goal.
   */
  lastTouch?: "attack" | "defence" | "keeper" | "frame";
  deflected?: "keeper" | "frame";
}

// A goalkeeper that slides + dives along its line and stretches to reach the ball.
/**
 * The keeper is a POSITION, not an opponent.
 *
 * He stands on his line and he stands still. Where he is, is the whole puzzle:
 * you look at him and you put the ball where he is not. He never reads your
 * aim, never tracks the flight, and does not move an inch before the save
 * animation — which is picked after the outcome has already been settled.
 *
 * Two things this replaced, in order. First a keeper that called
 * predictCrossX() the instant you struck it and dived straight to the crossing
 * point, so a save never felt avoidable. Then a keeper who swept his line
 * continuously — which was worse in a quieter way: it turned every shot from a
 * placement decision into a timing one, and on screen he was visibly gliding
 * back and forth across his six-yard box for no reason anyone could see.
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

  // ── Standing there ──
  // Kept for the idle animation's phase, so two keepers do not breathe in step.
  patrolT: number;
  patrolSeed: number;
  /** Chasing a spill rather than patrolling. */
  scrambling: boolean;
  /**
   * Sliding across because the ball has been played to somebody else.
   *
   * The keeper stands still, and that is the whole design — you look at where
   * he is and you put it where he is not, and he never reads your aim. But
   * "never moves" and "never reacts to the ball being somewhere else" are not
   * the same thing, and the engine had only the first.
   *
   * So the far side of the goal was free. He shades a post for a cross from the
   * byline, the ball goes across him to an unmarked man, and the man now has
   * five metres of undefended goal against two and a half metres of reach —
   * measured at 45% conversion on a byline cross, and the keeper standing
   * exactly where he had been when the ball was thirty yards away.
   *
   * He never tracks a SHOT. He tracks the ball being moved, in the beat before
   * it is struck, which is the one thing every real keeper is doing.
   */
  adjusting?: boolean;
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
/**
 * A real footballer, standing in one of the shirts on the pitch.
 *
 * Every team-mate figure in a situation carries one — see lib/star/lineup.ts.
 * The engine never invents a name and never looks one up: it is handed the
 * squad, it hands identities back out to the men it has already placed, and
 * whatever happens next happens to a person rather than to "the attacking
 * midfielder".
 *
 * Optional throughout, because the engine also runs with no career attached at
 * all (the sandbox, and every test in tests/star). Without one, everything falls
 * back to the role label it always used.
 */
export interface Identity {
  id: string;
  name: string;
  shortName: string;
  position: string;
}

export interface Follower {
  x: number;
  y: number;
  /** Who this is. See Identity. */
  who?: Identity;
  active: boolean;   // currently chasing a loose ball
  shot: boolean;     // already took its follow-up
  /** In an offside position at the last deliberate touch. See offsideSnapshot. */
  offside?: boolean;
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
   * support: making himself available. He stands in the space he found before
   *          the scenario opened, and stretches for a ball played near him.
   */
  role?: "target" | "support";
  /** True while he is reacting to a ball that has come near him. */
  sprint?: boolean;
  /** Who this is. See Identity. */
  who?: Identity;
  /**
   * He was in an offside POSITION at the last deliberate touch by your side.
   * Not an offence on its own — it becomes one the moment he plays the ball.
   */
  offside?: boolean;
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
  /**
   * Who actually got on the end of it.
   *
   * Set at reception, off the man the ball reached — not at kick-off, because
   * until the ball is played there is no telling which of them it finds. Whoever
   * this is is the man the commentary names and the man the goal goes to.
   */
  who?: Identity;
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
  /**
   * Height above the turf, metres. Only a free-kick wall ever leaves the ground:
   * they jump as the ball is struck, which is what makes going UNDER a wall a
   * real option and going over it a matter of clearing a moving target rather
   * than a fixed one.
   */
  z?: number;
  /** Vertical speed of that jump. */
  vz?: number;
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
  /** He has the ball AT HIS FEET right now. Cleared the instant he strikes it. */
  receiverDone: boolean;
  /**
   * The ball reached the man you played it to, at any point in this move.
   *
   * `receiverDone` is not that, and reading it as though it were is why the
   * commentary was exactly inverted on every chained chance. It is cleared when
   * he shoots, so by the time the move resolved it was false for every chance
   * where the pass had WORKED — and the line that fires on a failed pass ("Cut
   * out! A defender reads it well") fired on the one where you had picked him
   * out and his shot had been saved. It could not fire on a genuine failure,
   * because a pass that never arrives produces no team-mate shot to test.
   */
  receiverReached?: boolean;
  /** The team-mate has actually struck the resolving shot. Drives the stat credit. */
  receiverShot?: boolean;
  /** How many of them he has had. Two is a scramble; three is a farce. */
  receiverShots?: number;       // true once the ball has reached the runner (guards re-trigger)
  teamRelationship: number;    // 0-100 — how well the team combines, feeds the receiver's shot quality
  viewport: Viewport;
  /** Which way this situation's rectangle is turned. Defaults to "up". */
  facing?: Facing;
  /**
   * A crossing situation is watched from the side while the ball is in the air
   * and then cut to the ordinary view once it reaches the box, which is where
   * the thing you actually care about happens. This is the y it cuts at, and
   * the frame it cuts to.
   */
  crossSwitchY?: number;
  crossSwitchView?: Viewport;
  secondaryRunners: Runner[];  // extra options: support players and build-up outlets
  passDifficulty: number;      // 0-1, set when a pass resolves — harder pass = higher ball-return chance
  /**
   * Was that the ambitious ball, of the balls that were ON?
   *
   * 0-1, set when a pass resolves. Not the same question as `passDifficulty`,
   * which is absolute: a ten-metre ball forward in midfield is not a hard pass
   * by any measure, but if the man you found was the furthest forward option in
   * the picture then it was the ambitious choice, and that is what the player is
   * being asked to judge. Keying the reward off difficulty alone meant the
   * bravest ball available in a midfield situation was treated as a safe one,
   * because the situation is not built to contain a forty-metre pass.
   *
   * A ball that did not go forward at all scores zero, however long it was.
   */
  passAmbition?: number;
  /** The y of the most advanced man on offer when the situation was built. */
  forwardMostY?: number;
  /**
   * The man who put the ball into you, on the situations that have one — the
   * volley and the header arrive from somebody. He is who the assist belongs to
   * when YOU finish, and the reason the game no longer picks a name out of the
   * squad at random and calls it a creator.
   */
  crosser?: Identity;
  /**
   * An offside offence has been committed and the move is dead. Set the instant
   * a flagged attacker plays the ball; read at the top of the next stepBall.
   */
  offsideAgainst?: boolean;
  /** How many passes deep into one move this is. Chained scenarios count up. */
  chainDepth?: number;
  /** Where a completed pass was actually received. The next link starts here. */
  receivedAt?: Vec2;
  /**
   * The surface and the air. Absent means a perfect pitch in still air, which is
   * what every match in the game was until now — so nothing that does not set
   * this changes at all.
   */
  conditions?: { drag: number; friction: number; bounce: number; wind: number };
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
const DEAD_BALL_SETTLED = 1.2; // …or once a team-mate has already had his go
// Seconds a ball may lie untouched before the move is written off. Short,
// because the frame is small and everyone in it can reach anything in it — if
// this is firing at all, something is stuck, and six seconds of watching a
// stationary ball to find that out is five and a half too many.
const DEAD_BALL_TIMEOUT = 3;   // seconds a ball may lie untouched before the move
                               // is written off. Nobody should ever reach it.
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
// Shuffling across to cover a ball played to somebody else. Deliberately slower
// and shorter than a dive: this is a keeper adjusting his angle in the half
// second before a shot, not a keeper flying at one.
const KEEPER_SHUFFLE_SPEED = 3.4;
const KEEPER_SHUFFLE_MAX = 2.6;
// How far toward the ball's side he shades. A keeper does not stand on the line
// between the ball and the centre of his goal — he covers his near post and
// gives you the far one, which is why the far post is a finish at all.
const KEEPER_SHADE = 0.38;
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
// How much of the goal he covers from where he is standing — and therefore how
// far he has to dive to cover it.
//
// This went UP to 2.55–3.35 when the patrol was removed, on the reasoning that a
// stationary keeper needs to cover more or the goal is wide open. The reasoning
// was fine and the number was not: three metres is nearly half the goal, so a
// ball flying into the corner was "saved" by a keeper standing visibly nowhere
// near it. Three separate times it read as a goal that had not been given.
//
// It is back to a distance a dive actually covers, and the dive is now DRAWN
// covering it — see the save branch in resolveKeeper, which puts him at the ball.
const KEEPER_SAVE_R_MIN = 1.95;    // save radius at the goal plane, weakest keeper
const KEEPER_SAVE_R_MAX = 2.65;    // …and the strongest

/**
 * Difficulty tiers.
 *
 * One number does all the balancing now: how much of the goal he covers from
 * where he stands. Nothing here makes him cleverer or gives him foreknowledge —
 * a better keeper is simply a smaller gap to find.
 *
 * There used to be two more, `amp` and `period`, describing how far and how fast
 * he swept his line. He does not sweep his line.
 */
export type KeeperTier = "easy" | "normal" | "hard" | "expert";
export const KEEPER_TIERS: Record<KeeperTier, { radius: number }> = {
  easy:   { radius: 1.85 },
  normal: { radius: 2.25 },
  hard:   { radius: 2.55 },
  expert: { radius: 2.75 },
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
const WALL_TOP = 2.05;         // …but a wall keeps its arms down, so leaping does not raise the
                               // ceiling one-for-one. It lifts their feet instead, which is what
                               // makes a ball rolled UNDER a jumping wall a real free kick too.
/**
 * The wall jumps.
 *
 * It used to be four men rooted to the turf, so a free kick was a question of
 * going round the end of it and nothing else. They now leave the ground as the
 * ball is struck, which makes going UNDER the wall a real option — and makes
 * going over it a matter of clearing something that is on its way up.
 */
const WALL_JUMP_VZ = 3.6;      // m/s off the ground
const WALL_JUMP_DELAY = 0.1;   // seconds of reaction before they move

const RUNNER_SPEED = 7.0;      // m/s — the team-mate making the run

const PASS_CONTROL_R = 2.0;    // metres — how close the ball must get to be controlled
const BODY_R = 0.55;           // …and how close is close enough that it went through him
const SCRAMBLE_MAX = 4;        // runaway guard only — the keeper smothers it long before this

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
/**
 * How far off his line he may stand.
 *
 * USUALLY on it — that is what makes his position readable, and a keeper who
 * wanders looks like a bug. But not always: about one chance in five he has
 * come to the edge of his six-yard box, and that is a different question you are
 * being asked. It gives the ball somewhere to go that it would not otherwise
 * have, which is the whole reason the reference does it.
 *
 * Both numbers mean exactly what they say now that the sprite stands on its own
 * feet. When it hung off its own middle, a keeper "1.4 m off his line" had his
 * head on the line and his boots two metres in front of it, so this was pinned
 * at 0.55 to stop him looking like he had charged out.
 */
const KEEPER_LINE_MAX = 0.55;
const KEEPER_OFF_LINE_MAX = 5.5;   // …to the front edge of his six-yard box
const KEEPER_OFF_LINE_ODDS = 0.2;

function makeKeeper(x: number, y = 0.8, rng?: () => number): Keeper {
  const kx = clamp(x, POST_L - 2.5, POST_R + 2.5);
  const r = rng ? rng() : 0.5;
  const advanced = rng ? rng() < KEEPER_OFF_LINE_ODDS : false;
  const ky = advanced
    ? 1.6 + (rng ? rng() : 0.5) * (KEEPER_OFF_LINE_MAX - 1.6)
    : clamp(y, 0.3, KEEPER_LINE_MAX);
  return {
    x: kx, y: ky, startX: kx, targetX: kx,
    dive: 0, saves: 0, done: false, flash: 0,
    patrolT: r * 4,                 // start somewhere along the sweep, not always centre
    patrolSeed: r * Math.PI * 2,
    scrambling: false,
    adjusting: false,
    saveLunge: 0,
    saveDir: 0,
    saveKind: null,
    idleT: r * 3,
  };
}

function makeRunner(to: Vec2, from: Vec2, speed = RUNNER_SPEED, role: "target" | "support" = "target"): Runner {
  return { pos: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, speed, moving: false, role, sprint: false };
}

// A poacher lurking around the penalty spot for a spill.
function makeFollower(rng: () => number, by: number): Follower {
  return {
    x: clamp(CX + (rng() < 0.5 ? -1 : 1) * (2 + rng() * 5), POST_L - 3, POST_R + 3),
    y: clamp(by * 0.5, SIX_DEPTH, PEN_SPOT_Y + 3),
    active: false, shot: false,
  };
}

// The camera. Canvas is a 3:4 portrait, so the viewport must be too, and it must
// use the SAME metres-per-pixel on both axes or every distance on screen lies.
// Framing is clamped to a sane zoom band so the pitch never appears wildly zoomed
// in on one chance and wildly zoomed out on the next.
// The canvas is a tall slice, not a box — see the aspect on the pitch container.
// A shooting situation needs the goal and a player thirty metres off it in the
// same frame, and a tall frame buys that depth without having to zoom out to
// find it.
export const VIEW_ASPECT = 5 / 8;      // width / height
/**
 * How much the zoom may vary between one situation and the next: it does not.
 *
 * A tactics board does not zoom. Every situation is framed at the same height,
 * so a player is the same size and a metre is the same distance in every chance
 * you ever get — which is the whole point of an overhead camera, and is worth
 * more than fitting each situation snugly. Anything the frame cannot hold gets
 * pulled inside it by fitToView rather than the rectangle growing.
 *
 * It was a band (34-46, then 38-44) and even the narrow one was visible chance
 * to chance, reading as the camera being inconsistent rather than as the
 * situation being tighter.
 */
const VIEW_H = 42;
const VIEW_MIN_H = VIEW_H;      // metres of pitch visible vertically
// Furthest zoom. Held down hard, because the frame is the situation rather than
// a window onto a pitch — anything the framing cannot hold gets pulled inside it
// by fitToView instead of the rectangle growing to go and find it. At 62 a
// long-range chance showed the halfway line and everything in it was tiny.
const VIEW_MAX_H = VIEW_H;

/**
 * The rectangle a corner or a whipped cross happens in.
 *
 * Goal across the top, the D along the bottom, and just enough either side of
 * the six-yard box to swing a ball in from. Fixed, so every wide delivery looks
 * the same and you learn one picture instead of a new one each time.
 */
const WIDE_DELIVERY_VIEW: Viewport = (() => {
  const h = VIEW_H;
  const w = h * VIEW_ASPECT;
  return { x1: CX - w / 2, x2: CX + w / 2, y1: -4.5, y2: -4.5 + h };
})();
/** Where the ball is delivered from — just inside the near edge of that frame. */
const WIDE_DELIVERY_X = (side: number) => CX + side * (WIDE_DELIVERY_VIEW.x2 - CX - 3.4);

/**
 * The rectangle a cross is aimed from, turned a quarter turn.
 *
 * Across the screen: the goal and everybody in front of it. Down the screen:
 * the width of the pitch from the touchline you are on to beyond the far post.
 * Because it is rotated, the viewport's Y span is what fills the screen's WIDTH,
 * so it is the Y span that has to hold the canvas aspect.
 */
const CROSS_VIEW_X = VIEW_H;  // metres across the pitch, filling the screen's height
const CROSS_SWITCH_Y = 15; // …and where the ball has got close enough to cut

function crossViewport(side: number): Viewport {
  const h = CROSS_VIEW_X;
  const w = h * VIEW_ASPECT;          // metres up the pitch, filling the width
  // Held against the touchline you are crossing from.
  const x1 = side > 0 ? PITCH_W + 3 - h : -3;
  return { x1, x2: x1 + h, y1: -4.5, y2: -4.5 + w };
}


function autoViewport(points: Vec2[], includeGoal: boolean, pad = 4): Viewport {
  const all = [...points];
  if (includeGoal) {
    all.push({ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH });
  }
  let x1 = Math.min(...all.map(p => p.x));
  let x2 = Math.max(...all.map(p => p.x));
  let y1 = Math.min(...all.map(p => p.y));
  let y2 = Math.max(...all.map(p => p.y));

  // Breathing room so nothing sits on the frame edge.
  x1 -= pad; x2 += pad; y1 -= pad * 0.875; y2 += pad * 0.875;

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

/**
 * OFFSIDE
 *
 * The law, mapped onto what this game actually has, and nothing invented to
 * make it fit. There are no body parts here, no referee and no indirect free
 * kick — every entity is a single point, so a point is what gets compared.
 *
 * The two halves of the law are kept separate, because conflating them is what
 * makes offside systems wrong:
 *
 *   POSITION is a state, judged once, at the instant a team-mate deliberately
 *   plays the ball. Everyone's position is frozen for that judgement and
 *   nothing that happens afterwards changes it.
 *
 *   OFFENCE is an act. It happens only if a man who was in an offside position
 *   then plays the ball. Standing in an offside position is legal, and a man
 *   flagged at the snapshot who never touches the ball is never penalised.
 *
 * What creates a snapshot here — the deliberate touches your side has:
 *   · you strike the ball (launch)
 *   · the team-mate you found strikes it (launchReceiverShot)
 *   · the man in the box pokes in a rebound (stepReactions)
 * Each one takes a fresh snapshot against the positions at that moment, which
 * is OFF-006: every deliberate attacking touch is a new snapshot.
 *
 * What does NOT clear a flag: a save, a parry, the post, the crossbar, a
 * deflection off a defender. That is the "gains an advantage" clause, and it
 * falls out for free — the flag simply survives, so a flagged man who buries
 * the rebound is offside. What DOES clear it is a deliberate play by a
 * defender: winning a header, or clearing it, both of which reset everyone.
 *
 * A corner cannot produce offside directly, so it never takes a snapshot.
 *
 * Not modelled, and honestly so: "interferes with an opponent" — blocking a
 * keeper's line of sight, screening a defender. There is no line of sight in
 * this engine to block.
 */
const OFFSIDE_EPS = 0.05;   // level is onside, and the benefit goes to the attacker

/**
 * The opponents' positions up the pitch, nearest their own goal line first.
 *
 * The keeper is not special — the law says opponents, not goalkeepers — but he
 * only counts when he is part of the situation at all. A midfield rectangle has
 * no goal in it and therefore no keeper in it, and inventing one off-screen to
 * complete the line would be exactly the sort of fiction that made the last
 * attempt at this flag men who were plainly onside.
 */
function opponentLine(sc: Scenario): number[] {
  const ys = sc.defenders.map(d => d.y);
  if (goalInView(sc.kind)) ys.push(sc.keeper.y);
  return ys.sort((a, b) => a - b);
}

/** Every attacker whose position the law cares about. You are never one of them. */
function attackers(sc: Scenario): { pos: Vec2; flag: (v: boolean) => void }[] {
  const out: { pos: Vec2; flag: (v: boolean) => void }[] = [];
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    out.push({ pos: r.pos, flag: (v) => { r.offside = v; } });
  }
  out.push({ pos: { x: sc.follower.x, y: sc.follower.y }, flag: (v) => { sc.follower.offside = v; } });
  return out;
}

/**
 * Freeze the pitch and judge every attacker's POSITION. Called at the instant a
 * team-mate deliberately plays the ball, and at no other time.
 */
export function offsideSnapshot(sc: Scenario, ballAt: Vec2) {
  // A corner cannot produce offside directly.
  if (sc.kind === "corner") { clearOffside(sc); return; }
  // ── Nor can a situation with no goal in it ──
  //
  // Same argument as the one below, taken one step further. A build-up or a
  // midfield ball is framed on a piece of midfield: the goal is thirty metres
  // outside the picture and so is the defensive line that would be playing
  // anybody on. Its one or two opponents are midfielders. Judging the law
  // against them is judging it against fiction — and it would be an unwatchable
  // decision besides, because there is no goal on the screen for the flag to
  // mean anything against.
  if (!goalInView(sc.kind)) { clearOffside(sc); return; }

  const line = opponentLine(sc);
  // Without a second-last opponent there is no line to be beyond, and the
  // benefit of the doubt belongs to the attacker.
  if (line.length < 2) { clearOffside(sc); return; }
  const secondLast = line[1];

  for (const a of attackers(sc)) {
    const inTheirHalf = a.pos.y < HALF_LEN - OFFSIDE_EPS;
    const aheadOfBall = a.pos.y < ballAt.y - OFFSIDE_EPS;
    const aheadOfLine = a.pos.y < secondLast - OFFSIDE_EPS;
    a.flag(inTheirHalf && aheadOfBall && aheadOfLine);
  }
}

/** Is this man's touch an offence? Position plus involvement, and only then. */
function offsideOffence(sc: Scenario, flagged: boolean | undefined): boolean {
  if (!flagged) return false;
  sc.offsideAgainst = true;
  return true;
}

/** A deliberate play by a defender puts everybody onside again. */
export function clearOffside(sc: Scenario) {
  for (const a of attackers(sc)) a.flag(false);
}

/**
 * Start every attacker onside.
 *
 * Without this the flag goes up on nearly everything, and the reason is worth
 * writing down because it is the trap this rule sets for a game like ours.
 *
 * A real penalty area has a back four in it. Ours has one or two defenders, and
 * in a one-on-one the only one is BEHIND you, recovering — so the second-last
 * opponent sits twenty metres from goal, and every attacker in the box is
 * beyond him. Measured: 400 out of 400 one-on-ones flagged somebody, and 391 of
 * them ended in an offside. The law was being applied correctly to positions
 * that were fiction.
 *
 * The honest fix is not to weaken the rule but to place people legally, which
 * is what footballers do: a striker following a shot in does not stand
 * permanently beyond the last man, he times his run. So anybody built beyond
 * the second-last opponent is dropped back level with him — and he still gets
 * on the end of rebounds, because he reacts to the ball once it is struck.
 *
 * The one exception is the through-ball's target man. That situation is built
 * around the offside line on purpose: sometimes he has gone a yard early, and
 * playing him in then is an offence you can SEE, because he is drawn in front
 * of the last defender on a flat camera with nothing moving.
 *
 * ── And the second exception, which was doing real damage ──
 *
 * A situation with no goal in the rectangle has no offside line in it either.
 * `opponentLine` for a build-up or a midfield ball is one or two men standing
 * in FRONT of you in midfield — the goal is thirty metres outside the frame and
 * so is the defence that would be playing anybody on. Treating the nearest
 * midfielder as the second-last opponent dragged your most advanced team-mate
 * back level with him, every single time.
 *
 * That is why the ambitious ball never went anywhere. Build-up places its target
 * man at y 18-34 — the edge of the final third — and he was arriving at a
 * measured median of y 37, behind a covering midfielder. `chainKindFor` reads
 * the situation you are left in off where the ball ARRIVED, and its "you are in
 * the final third now" test is y < 32, which almost never fired. So the furthest
 * forward pass in the game returned another midfield pass: 4.9% of completed
 * build-up passes produced a chance, and five ambitious passes in a row produced
 * nothing at all 67% of the time. Reported as exactly that — seventy-five
 * minutes without a sight of goal.
 */
function settleOnside(sc: Scenario, rng: () => number) {
  const judged = goalInView(sc.kind);
  const line = opponentLine(sc);
  const secondLast = judged && line.length >= 2 ? line[1] : null;
  const vp = sc.viewport;
  const floor = vp ? vp.y2 - 1.4 : HALF_LEN;

  // Dropping back can land a man on the ball or on your shoulder, so he steps
  // aside as he does it. Nobody starts on top of anybody, offside or not.
  const settle = (p: Vec2) => {
    if (secondLast === null || p.y >= secondLast) return;
    p.y = Math.min(secondLast + 0.3 + rng() * 1.4, floor);
    for (let i = 0; i < 12; i++) {
      const near = Math.hypot(p.x - sc.player.x, p.y - sc.player.y) < 5
                || Math.hypot(p.x - sc.ball.x, p.y - sc.ball.y) < 5;
      if (!near) break;
      const away = p.x >= sc.ball.x ? 1 : -1;
      p.x = clamp(p.x + away * 1.6, vp ? vp.x1 + 1.4 : 2, vp ? vp.x2 - 1.4 : PITCH_W - 2);
      p.y = Math.min(p.y + 0.6, floor);
    }
  };

  // Support players are already placed onside — see addSupport, which searches
  // for space inside the legal area rather than being corrected out of it.
  for (const r of sc.secondaryRunners) { settle(r.pos); r.to = { ...r.pos }; }
  if (sc.runner && sc.kind !== "through_ball") { settle(sc.runner.pos); sc.runner.to = { ...sc.runner.pos }; }
  const f = { x: sc.follower.x, y: sc.follower.y };
  settle(f);
  sc.follower.x = f.x; sc.follower.y = f.y;

  // ── Last of all: nobody is standing on you ──
  //
  // This has to run here, because where YOU stand is not settled until standOff
  // has put you beside the ball — which happens after everybody else has been
  // placed. A team-mate positioned in perfectly good space can find you have
  // since been stood on his toes.
  const lox = vp ? vp.x1 + 1.4 : 2, hix = vp ? vp.x2 - 1.4 : PITCH_W - 2;
  // Stepping clear of you must not step him offside — and where there is no
  // line to be offside from, the top of the frame is the only limit.
  const loy = secondLast !== null ? secondLast + 0.3 : (vp ? Math.max(vp.y1 + 1.4, 0.3) : 1);
  const CLEAR = 4.5;
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    if (Math.hypot(r.pos.x - sc.player.x, r.pos.y - sc.player.y) >= CLEAR) { r.to = { ...r.pos }; continue; }
    // Walk a ring outward from you and take the first point that is far enough,
    // inside the frame and onside. Nudging him along one axis and hoping was not
    // enough: the cases that survived were the ones where YOU are in the corner
    // of a tight rectangle, and every push either hit the wall or came back.
    let best: Vec2 | null = null;
    outer:
    for (let ring = CLEAR; ring <= CLEAR + 7 && !best; ring += 1.2) {
      for (let k = 0; k < 16; k++) {
        const a2 = (k / 16) * Math.PI * 2;
        const p = { x: sc.player.x + Math.cos(a2) * ring, y: sc.player.y + Math.sin(a2) * ring };
        if (p.x < lox || p.x > hix || p.y < loy || p.y > floor) continue;
        best = p;
        break outer;
      }
    }
    if (best) r.pos = best;
    r.to = { ...r.pos };
  }
}

/**
 * Nothing exists outside the rectangle.
 *
 * The frame is the situation, so a man standing beyond its edge is not "off
 * camera" — he is not in the game, and since the camera never pans he will
 * never be seen. Anybody the builder placed outside is pulled to just inside.
 *
 * It matters most for the fixed frames: a whipped cross is delivered inside a
 * rectangle drawn on the goal, and its runners were still being scattered
 * across a penalty area wider than that rectangle, so most of the time the man
 * you were crossing to was somewhere off the side of the screen.
 */
function fitToView(sc: Scenario) {
  const vp = sc.viewport;
  const inset = 1.4;
  // You aim by dragging BACK from the ball, so a chance at the very bottom of
  // the frame is one you cannot pull the arrow far enough for — the drag ran
  // off the bottom of the canvas and the shot stuck. The ball is kept up out of
  // the bottom fifth, which is the room that gesture needs.
  // The bottom of the SCREEN, which in a turned frame is not the bottom of the
  // viewport. In a crossing view the screen's vertical axis is pitch x, and the
  // room the drag needs is along that.
  const turned = sc.facing === "left" || sc.facing === "right";
  const floor = turned ? vp.y2 - 1.4 : vp.y2 - (vp.y2 - vp.y1) * 0.2;
  const fx = (x: number) => clamp(x, vp.x1 + inset, vp.x2 - inset);
  const fy = (y: number) => clamp(y, Math.max(vp.y1 + inset, 0.3), vp.y2 - inset);
  for (const d of sc.defenders) { d.x = fx(d.x); d.y = fy(d.y); }
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    r.pos.x = fx(r.pos.x); r.pos.y = fy(r.pos.y);
    r.to.x = fx(r.to.x);   r.to.y = fy(r.to.y);
  }
  if (goalInView(sc.kind)) { sc.follower.x = fx(sc.follower.x); sc.follower.y = fy(sc.follower.y); }
  sc.ball = { x: fx(sc.ball.x), y: Math.min(fy(sc.ball.y), floor) };
  // You go last, and through standOff, so the ball is never squeezed onto your
  // feet by the clamp — a delivery from the very edge of the frame still leaves
  // room for you to be standing beside it.
  standOff(sc, vp.x1 + inset, vp.x2 - inset);
  sc.player = { x: sc.player.x, y: fy(sc.player.y) };
  syncPassTarget(sc, fx, fy);
  clearOfTheBall(sc);
}

/**
 * There is always a ball ON.
 *
 * The companion to the rule below, and it exists for exactly the same reason: a
 * situation you cannot play is not a situation. A build-up or a midfield ball is
 * a scenario whose entire content is one pass — there is no goal in the frame to
 * shoot at — so a defender standing in the only lane there is makes it a chance
 * that was over before you touched the ball.
 *
 * It went unnoticed for as long as it did because `settleOnside` was hiding it.
 * It dropped the target man back level with the deepest defender, so the line to
 * him never had to pass anybody: measured, the nearest defender to the passing
 * lane sat a median 3.6 m off it. Stop dragging him back — which is the fix for
 * the ambitious pass leading nowhere — and the same measurement reads 1.2 m,
 * with a man inside 1.5 m of the lane in 62% of build-ups. Half of every
 * ambitious ball was cut out by somebody the builder had put there.
 *
 * So the men in the lane step off it. Not out of the situation — a metre and a
 * half either way, which is the difference between a pass that has to be
 * threaded and a pass that cannot be played. What is left of the risk lives in
 * the weight of the ball, which is yours: struck firmly it finds him 95% of the
 * time, under-hit it is read 67% of the time.
 */
const LANE_CLEAR = 1.7;

function clearThePassingLane(sc: Scenario) {
  // Only where the pass IS the situation. Bodies in front of goal are the point
  // of every other kind, and this must not tidy them out of the way.
  if (goalInView(sc.kind)) return;
  const t = sc.runner ? sc.runner.pos : sc.passTarget;
  if (!t) return;
  const vp = sc.viewport;
  const inset = 1.4;
  const lox = vp ? vp.x1 + inset : 2, hix = vp ? vp.x2 - inset : PITCH_W - 2;

  const vx = t.x - sc.ball.x, vy = t.y - sc.ball.y;
  const len = Math.hypot(vx, vy);
  if (len < 1) return;
  const ux = vx / len, uy = vy / len;

  for (const d of sc.defenders) {
    const px = d.x - sc.ball.x, py = d.y - sc.ball.y;
    const along = px * ux + py * uy;
    // Only the men actually between the two of you. Somebody behind the ball or
    // beyond the receiver is not in the lane whatever his sideways offset.
    if (along < 0.5 || along > len - 0.5) continue;
    const off = px * -uy + py * ux;
    if (Math.abs(off) >= LANE_CLEAR) continue;
    // Out the way he was already leaning, and back the other way if the frame
    // will not take him.
    const side = off >= 0 ? 1 : -1;
    const place = (s: number) => ({
      x: sc.ball.x + ux * along + -uy * s * LANE_CLEAR,
      y: sc.ball.y + uy * along + ux * s * LANE_CLEAR,
    });
    let to = place(side);
    if (to.x < lox || to.x > hix) to = place(-side);
    d.x = clamp(to.x, lox, hix);
    d.y = to.y;
  }
}

/**
 * Nobody is standing ON the ball when the whistle goes.
 *
 * The clamps above squeeze everybody toward the middle, and at the edges of the
 * frame they squeeze two people onto the same square metre. Measured: a defender
 * inside 1.2 m of the ball in 5.4% of tight angles, the keeper inside 1.5 m in
 * 2.3% of headers. A defender within DEF_BLOCK_R takes it on the first frame,
 * so the chance was over before the strike had left the boot — and nothing you
 * could have done would have changed it, which is the one thing a situation must
 * never be.
 *
 * He is pushed straight off the ball, and back the other way if that would put
 * him through the side of the rectangle.
 */
const CLEAR_OF_BALL = 1.8;

function clearOfTheBall(sc: Scenario) {
  const vp = sc.viewport;
  const inset = 1.4;
  const fx = (x: number) => (vp ? clamp(x, vp.x1 + inset, vp.x2 - inset) : x);
  const fy = (y: number) => (vp ? clamp(y, Math.max(vp.y1 + inset, 0.3), vp.y2 - inset) : Math.max(y, 0.3));
  const push = (p: { x: number; y: number }, want: number) => {
    const dx = p.x - sc.ball.x, dy = p.y - sc.ball.y;
    const d = Math.hypot(dx, dy);
    if (d >= want) return;
    // Straight out from the ball, or straight up the pitch if he is on top of it.
    const ux = d > 0.01 ? dx / d : 0, uy = d > 0.01 ? dy / d : 1;
    const to = { x: fx(sc.ball.x + ux * want), y: fy(sc.ball.y + uy * want) };
    // Clamped back onto the ball by the frame? Go the other way instead.
    if (Math.hypot(to.x - sc.ball.x, to.y - sc.ball.y) < want - 0.05) {
      to.x = fx(sc.ball.x - ux * want);
      to.y = fy(sc.ball.y - uy * want);
    }
    p.x = to.x; p.y = to.y;
  };
  for (const d of sc.defenders) push(d, CLEAR_OF_BALL);

  // ── And the keeper, who retreats rather than being shoved ──
  //
  // He is off his line one time in five, and a header is met three to seven
  // metres out — so a keeper five and a half metres off his line was standing on
  // the ball. Measured at its worst: 32 centimetres. He smothers anything inside
  // KEEPER_BODY_R on the first frame, so that header was over before it was
  // struck.
  //
  // He is not pushed away like a defender: a goalkeeper who needs room always
  // has the same room available to him, which is his own goal. He drops back
  // toward the line first, and only steps across if being ON the line still
  // leaves him underneath it.
  const k = sc.keeper;
  const want = KEEPER_BODY_R + 1.6;
  const off = () => Math.hypot(k.x - sc.ball.x, k.y - sc.ball.y);
  if (off() < want) {
    k.y = clamp(Math.min(k.y, sc.ball.y - want), 0.35, k.y);
    if (off() < want) {
      const dy = Math.abs(k.y - sc.ball.y);
      const need = Math.sqrt(Math.max(0, want * want - dy * dy)) + 0.05;
      const side = Math.sign(k.x - sc.ball.x) || 1;
      const across = (s: number) => fx(clamp(sc.ball.x + s * need, POST_L - 2.5, POST_R + 2.5));
      k.x = across(side);
      if (off() < want) k.x = across(-side);
    }
    k.startX = k.x;
  }
}

/**
 * The marker you aim at is where the man is actually going.
 *
 * `passTarget` is documented as "where the runner is heading" and is drawn as
 * the aim marker — but the builders hand it a DIFFERENT object from the one they
 * hand the runner, so every clamp that pulled the runner inside the rectangle
 * left the marker behind. Measured: the target was off the frame in 7.3% of
 * build-ups and 4.3% of byline crosses. You were being asked to pick out a man
 * on a part of the pitch the camera will never show you, which is the exact
 * thing the fixed frame exists to make impossible.
 */
function syncPassTarget(sc: Scenario, fx: (x: number) => number, fy: (y: number) => number) {
  if (!sc.passTarget) return;
  const to = sc.runner ? sc.runner.to : sc.passTarget;
  sc.passTarget = { x: fx(to.x), y: fy(to.y) };
}

/**
 * Everybody except the crosser lives inside the frame it CUTS to.
 *
 * A crossing situation has two rectangles: the wide one you aim from and the
 * ordinary one it cuts to when the ball arrives. Anybody who matters after the
 * cut has to be inside the second as well as the first, or half the box would
 * be off-screen the moment the picture changed — and worse, the engine treats
 * outside-the-frame as not-in-the-game, so they would stop going for the ball.
 *
 * You are the exception, and rightly: you are out on the touchline, and once
 * the ball has gone you are not part of what happens next.
 */
function keepInsideTheCut(sc: Scenario) {
  const cut = sc.crossSwitchView;
  if (!cut) return;
  const inset = 1.4;
  const fx = (x: number) => clamp(x, cut.x1 + inset, cut.x2 - inset);
  const fy = (y: number) => clamp(y, Math.max(cut.y1 + inset, 0.3), cut.y2 - inset);
  for (const d of sc.defenders) { d.x = fx(d.x); d.y = fy(d.y); }
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    r.pos.x = fx(r.pos.x); r.pos.y = fy(r.pos.y);
    r.to = { ...r.pos };
  }
  sc.follower.x = fx(sc.follower.x);
  sc.follower.y = fy(sc.follower.y);
  sc.keeper.x = fx(sc.keeper.x);

  // Squeezing the box into a second, narrower rectangle can put a man back on
  // the crosser's shoulder — so the same ring search that keeps everybody clear
  // of you elsewhere runs once more, against this frame.
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    if (Math.hypot(r.pos.x - sc.player.x, r.pos.y - sc.player.y) >= 4.5) continue;
    for (let ring = 4.5; ring <= 11; ring += 1.2) {
      let placed = false;
      for (let k = 0; k < 16 && !placed; k++) {
        const a = (k / 16) * Math.PI * 2;
        const p = { x: sc.player.x + Math.cos(a) * ring, y: sc.player.y + Math.sin(a) * ring };
        if (p.x < cut.x1 + inset || p.x > cut.x2 - inset) continue;
        if (p.y < Math.max(cut.y1 + inset, 0.3) || p.y > cut.y2 - inset) continue;
        r.pos = p; r.to = { ...p }; placed = true;
      }
      if (placed) break;
    }
  }
  syncPassTarget(sc, fx, fy);
}

/**
 * Where you stand relative to the ball.
 *
 * BESIDE it, and this is the whole trick. The camera looks down the pitch, so
 * "in front of you" is "up the screen" — and a figure is also drawn up the
 * screen from the point it stands on. Any ball placed in front of you therefore
 * climbs toward your head, and past about a metre it is level with it: at a
 * standoff of 1.2 it read as a ball resting on your head, and at 2.6 it read as
 * a ball floating above it. There is no distance directly in front that looks
 * like a ball at your feet, because the two directions are the same direction.
 *
 * Sideways is a different axis. A ball a stride off your standing foot, barely
 * ahead of you, reads exactly as what it is.
 */
const STANDOFF_SIDE = 1.3;     // metres across — the one that does the work
const STANDOFF_BACK = 0.15;    // …and level with your boots, not ahead of them

/**
 * Stand beside the ball, on a side that is actually in the frame.
 *
 * Keeping whichever side the builder chose was not enough on its own: with the
 * ball near the edge of a tight rectangle, the far side put you outside it, the
 * clamp pulled you straight back — and where it pulled you back TO was the ball.
 * You ended up standing on it, which on screen is the ball on your chest.
 */
function standOff(sc: Scenario, lo?: number, hi?: number) {
  // ── Beside him ON SCREEN ──
  //
  // "Beside" is a fact about the picture, not about the pitch: it is the axis
  // that runs ACROSS the screen, because the figure is drawn up the screen from
  // its boots and anything on that axis climbs into it. In the ordinary view
  // that axis is pitch x. In a crossing view the frame is turned a quarter
  // turn, so it is pitch y — and placing him along x there would have put the
  // ball back on his chest, in the one situation built to show it off.
  if (sc.facing === "left" || sc.facing === "right") {
    const prefer = sc.player.y >= sc.ball.y ? 1 : -1;
    sc.player = {
      x: clamp(sc.ball.x + STANDOFF_BACK * (sc.ball.x > CX ? 1 : -1), 1, PITCH_W - 1),
      y: clamp(sc.ball.y + prefer * STANDOFF_SIDE, 0.5, HALF_LEN + 6),
    };
    return;
  }
  const minX = lo ?? 1, maxX = hi ?? PITCH_W - 1;
  const prefer = sc.player.x >= sc.ball.x ? 1 : -1;
  // The preferred side unless it does not fit, and then the other one.
  const fits = (side: number) => {
    const x = sc.ball.x + side * STANDOFF_SIDE;
    return x >= minX && x <= maxX;
  };
  const side = fits(prefer) ? prefer : fits(-prefer) ? -prefer : prefer;
  sc.player = {
    x: clamp(sc.ball.x + side * STANDOFF_SIDE, minX, maxX),
    y: clamp(sc.ball.y + STANDOFF_BACK, 0.5, HALF_LEN + 6),
  };
}

/**
 * Is the goal on screen in this situation?
 *
 * One question, one answer, used by both the camera and the finisher — they
 * must never disagree. If you can see the goal, a team-mate you find will shoot
 * at it; if you cannot, the ball is a pass and nothing more.
 */
export function goalInView(kind: ScenarioKind): boolean {
  return kind !== "buildup" && kind !== "midfield_pass";
}

function scenarioViewport(sc: {
  ball: Vec2; player: Vec2; defenders: Vec2[]; teammates: Vec2[];
  keeper: { x: number; y: number }; runner: Runner | null; secondaryRunners?: Runner[]; kind: ScenarioKind;
}): Viewport {
  const pts: Vec2[] = [sc.ball, sc.player];
  const showGoal = goalInView(sc.kind);
  if (showGoal) pts.push({ x: sc.keeper.x, y: sc.keeper.y });
  for (const d of sc.defenders) pts.push(d);
  // Decorative team-mates (the crosser a volley or header came from) are
  // deliberately NOT framed. They stand out by the touchline, and letting them
  // drag the bounding box shoved the actual action — and the goal — into the
  // corner of the screen, which is what made the camera look so erratic.
  if (sc.runner) { pts.push(sc.runner.pos); pts.push(sc.runner.to); }
  for (const r of sc.secondaryRunners ?? []) { pts.push(r.pos); pts.push(r.to); }

  // ── A wide delivery is a fixed rectangle ──
  //
  // The frame comes first and the situation is built to fit inside it, which is
  // the opposite of how this worked. It used to frame everybody on the field —
  // and a corner taken from the flag is thirty-four metres off centre, so the
  // frame had to be wide enough to hold the flag AND the far post. At a 3:4
  // portrait canvas that width buys fifty-odd metres of depth: you could see the
  // halfway line, and the goal was the size of a stamp. Widening how far behind
  // the goal the camera could sit only moved the waste from one end to the
  // other.
  //
  // There is no pitch outside the rectangle to be faithful to. So the rectangle
  // is the goal, the six-yard box, the penalty spot and the D — and the ball is
  // delivered from the corner of THAT, not from a flag forty metres away.
  if (sc.kind === "corner" || sc.kind === "byline_cross") return WIDE_DELIVERY_VIEW;

  return autoViewport(pts, showGoal);
}

/**
 * Who is on the end of the ball, and how well he finishes.
 *
 * The rule, and it is absolute: **if the goal is on screen, whoever you find
 * shoots.** There is no such thing as passing to a man in an attacking position
 * and having the move simply stop. You laid it off inside the box and the
 * highlight ended with a shrug — that is not football, and it made finding a
 * team-mate feel like throwing the chance away.
 *
 * Only the two situations built without a goal in sight — the midfield pass and
 * the build-up ball — resolve as a plain delivery, because there is nothing for
 * anyone to shoot at.
 */
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
  one_on_one: [
    { label: "the striker", skillMin: 58, skillMax: 88 },
    { label: "the attacking midfielder", skillMin: 52, skillMax: 82 },
  ],
  tight_angle: [
    { label: "the striker", skillMin: 58, skillMax: 88 },
    { label: "the far-post runner", skillMin: 50, skillMax: 80 },
  ],
  long_range: [
    { label: "the attacking midfielder", skillMin: 55, skillMax: 85 },
    { label: "the striker", skillMin: 58, skillMax: 88 },
  ],
  volley: [
    { label: "the striker", skillMin: 55, skillMax: 85 },
    { label: "the midfielder arriving", skillMin: 48, skillMax: 78 },
  ],
  header: [
    { label: "the striker", skillMin: 55, skillMax: 85 },
    { label: "the center-back", skillMin: 42, skillMax: 70 },
  ],
  free_kick: [
    { label: "the striker", skillMin: 52, skillMax: 84 },
    { label: "the center-back", skillMin: 42, skillMax: 70 },
  ],
  penalty: [
    { label: "the striker", skillMin: 58, skillMax: 88 },
  ],
};

/**
 * How cleanly a receiver can strike what you have played him, by situation.
 *
 * Not a difficulty dial bolted on to tune conversion — it is the one fact about
 * these chances the engine had no representation of at all. Every receiver
 * finished every chance with the same technique, so a centre-back heading a
 * corner in a crowd was as composed as a striker with the ball rolled across
 * the six-yard box, and the only thing separating them was a skill number.
 *
 * Scales what he AIMS for and divides into the error he makes, so a hard
 * chance is both less ambitious and less accurate — which is what makes a
 * cutback the best ball in football and a corner mostly a way of losing
 * possession.
 */
const RECEIVER_CONTROL: Partial<Record<ScenarioKind, number>> = {
  cutback: 1.0,        // on the floor, into his stride, facing goal
  one_on_one: 0.95,
  through_ball: 0.8,   // running onto it with a keeper coming
  tight_angle: 0.7,
  byline_cross: 0.5,   // meeting it first time, in the air
  volley: 0.5,
  header: 0.45,
  corner: 0.3,         // a header in traffic — nobody picks the top corner
};

function rollReceiver(kind: ScenarioKind, rng: () => number): Receiver | null {
  const options = RECEIVER_ROLES[kind];
  if (!options) return null;
  const pick = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
  return { skill: pick.skillMin + rng() * (pick.skillMax - pick.skillMin), roleLabel: pick.label };
}

// A clean run in behind. The keeper narrows the angle by shading across toward
// the shooting line, not by charging out to meet you — he is on his line here
// like he is everywhere else, and how far across he has shaded is what you read.
function buildOneOnOne(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 12;
  const by = 13 + rng() * 7;
  const keeperY = 0.5 + rng() * 0.8;
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
  // ── A block, in front of their own goal ──
  //
  // They used to be placed relative to YOU — three and six metres up the pitch
  // from wherever you were standing — which put a defence thirty metres from
  // its own goal for no reason a defender would recognise. Worse, the offside
  // line went with them: your team-mates are not allowed past the second-last
  // opponent, so they settled level with a line drawn round your feet, and the
  // whole situation collapsed into a knot of six players with twenty-five metres
  // of open grass between it and the goal.
  //
  // The line belongs to the goal it is defending. It drops as you come deeper,
  // the way a real one does, but it never comes out to meet you.
  const line = clamp(by * 0.42, 8, 17);
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.3 },
    defenders: [
      { x: clamp(CX - 3.5 - rng() * 7, 9, PITCH_W - 9), y: line + rng() * 1.8 },
      { x: clamp(CX + 3.5 + rng() * 7, 9, PITCH_W - 9), y: line + 1.2 + rng() * 2.4 },
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
  // ── The men in the box belong to the box ──
  //
  // These two were placed off YOU — one a metre and a half to your left, one
  // three to your right, both a stride in front — so a volley was struck into a
  // pair of shins from two metres, and 47.5% of them were blocked. That is not a
  // defence; it is two men standing on the ball. It is the same mistake
  // buildLongRange documents and addCover avoids, left in the one situation
  // where being crowded hurts most: a volley is a chance BECAUSE nobody is
  // close enough to stop you hitting it.
  //
  // They cover the goal instead, spread across the mouth and dropping with the
  // ball the way the back line does. You still have to beat them — there is now
  // room to try.
  // One of them, not two. Two spread across a seven-metre mouth is a screen, and
  // between them they covered the goal: the block rate barely moved when they
  // were pushed back, because it was never about the distance — it was about
  // there being no lane left. One man shades one side and leaves the other open,
  // which is a question you can answer.
  const line = clamp(by * 0.45, 5.5, 9.5);
  const shade = rng() < 0.5 ? -1 : 1;
  return {
    ball: { x: bx, y: by },
    player: { x: bx, y: by + 1.0 },
    defenders: [
      { x: clamp(CX + shade * (2 + rng() * 3.5), 10, PITCH_W - 10), y: line + rng() * 1.8 },
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
  const from = { x: to.x + (rng() - 0.5) * 3, y: to.y + 2.5 + rng() * 1.5 };
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
  const bx = WIDE_DELIVERY_X(side);
  const by = 1 + rng() * 3.5;
  const to = { x: CX + (rng() - 0.5) * 11, y: 4.5 + rng() * 5 };
  const from = { x: to.x - side * 2.5, y: to.y + 2.5 + rng() * 1.5 };
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

// Splitting the defence for a team-mate on the shoulder of the last man. He is
// level with or behind the second-to-last defender — onside, as the laws
// require, judged at the moment the ball is played. (Spawning him already past
// the defence is what made every through-ball look like a blatant offside.)
//
// He does not set off and run onto it: nothing moves until you kick the ball.
// The space you are being asked to find is the yard or two in front of him, and
// he stretches into it — so the target sits just ahead of his feet rather than
// ten metres beyond the line where nobody will ever be.
function buildThroughBall(rng: () => number, keeperStrength: number, teamRelationship: number) {
  const bx = CX + (rng() - 0.5) * 16;
  const by = 28 + rng() * 10;
  const lineY = clamp(by - 9 - rng() * 4, 15, 24);
  const defenders: Vec2[] = [
    { x: clamp(CX - 5 - rng() * 4, 10, PITCH_W - 10), y: lineY },
    { x: clamp(CX + 5 + rng() * 4, 10, PITCH_W - 10), y: lineY + 0.6 + rng() * 1.2 },
  ];
  // ── The one situation built around the offside line ──
  //
  // The second-last opponent here is the deeper of these two defenders — the
  // keeper is behind both — so that is the line the runner is measured against.
  // Usually he is onside, level with it or a stride behind. Sometimes he has
  // gone a yard early, and then playing him in is offside and you can SEE that
  // it is: he is drawn in front of the last man, on a flat camera, with nothing
  // moving. Nowhere else in the game is a man built beyond the line.
  const line = [...defenders.map(d => d.y), 2].sort((a, b) => a - b)[1];
  const early = rng() < 0.18;
  const startY = early ? line - (0.4 + rng() * 1.6) : line + 0.15 + rng() * 2.2;
  const from = { x: clamp(CX + (rng() - 0.5) * 14, 12, PITCH_W - 12), y: startY };
  // The yard in front of him, between him and the goal.
  const to = { x: clamp(from.x + (rng() - 0.5) * 4, 12, PITCH_W - 12), y: clamp(from.y - 2 - rng() * 2, 6, HALF_LEN) };
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
  // On the byline at the edge of the frame rather than out at the flag. The
  // situation is the rectangle; a taker forty metres outside it is not part of
  // it, and framing him meant framing half the pitch.
  const bx = WIDE_DELIVERY_X(side);
  const by = 0.4;
  const to = { x: CX + (rng() - 0.5) * 10, y: 4 + rng() * 5 };
  const from = { x: to.x - side * 2.2, y: to.y + 2.5 + rng() * 1.5 };
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
  // ── The second man marks him, GOAL-side ──
  //
  // He used to stand 2.5 m in front of the target on the ball side, which is
  // not where a marker stands — it is where a man cutting the pass out stands,
  // and having him there by construction took the decision out of the
  // situation. It did not show while the target man was being dropped back
  // behind him by settleOnside; the moment the target was allowed to stay
  // forward he was sitting in the lane.
  if (rng() < 0.55) {
    defenders.push({ x: clamp(hardTo.x + (rng() - 0.5) * 9, 8, PITCH_W - 8), y: clamp(hardTo.y - 2.5, 12, 40) });
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
export function buildScenario(kind: ScenarioKind, rng: () => number, keeperStrength = 62, teamRelationship = 60, vision = 55): Scenario {
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
  addCover(sc, rng);
  standOff(sc);
  // If the goal is on screen, whoever you find shoots. Set here rather than in
  // thirteen builders so it cannot be forgotten in one of them — which is
  // exactly how laying it off inside the box used to end the highlight with
  // nobody having done anything.
  if (!sc.receiver && goalInView(kind)) sc.receiver = rollReceiver(kind, rng);
  // A fixed-frame situation knows its rectangle before anybody is placed in it,
  // and everything placed afterwards is placed INSIDE that rectangle. Doing it
  // the other way round — scatter people across a penalty area, then squeeze
  // them into a frame two thirds as wide — piled them onto the taker in the
  // corner.
  if (kind === "corner" || kind === "byline_cross") {
    // Watched from the side, then cut to the ordinary view when it arrives.
    const side = sc.ball.x >= CX ? 1 : -1;
    sc.facing = side > 0 ? "right" : "left";
    sc.viewport = crossViewport(side);
    sc.crossSwitchY = CROSS_SWITCH_Y;
    sc.crossSwitchView = WIDE_DELIVERY_VIEW;
  }
  if (sc.passDifficulty === undefined) sc.passDifficulty = 0;
  if (sc.chainDepth === undefined) sc.chainDepth = 0;
  addSupport(sc, rng, vision);
  if (!sc.viewport) sc.viewport = scenarioViewport(sc);
  fitToView(sc);
  settleOnside(sc, rng);
  // ── The guide points at the man, not at where he used to be ──
  //
  // `fitToView` syncs the pass target to the runner, and then `settleOnside`
  // MOVES the runner — dropping him back onside, or stepping him clear of you.
  // Nothing re-synced afterwards, so the target sat wherever he had been: in a
  // build-up, measured eight metres in front of him. You aimed where the game
  // told you to and the ball went over his head.
  if (sc.viewport) {
    const vp = sc.viewport, inset = 1.4;
    syncPassTarget(
      sc,
      (x) => clamp(x, vp.x1 + inset, vp.x2 - inset),
      (y) => clamp(y, Math.max(vp.y1 + inset, 0.3), vp.y2 - inset),
    );
  }
  keepInsideTheCut(sc);
  clearThePassingLane(sc);
  // Who was the ambitious ball, now that everybody has stopped being moved
  // around. Read once here rather than at reception, because by reception the
  // runners have run and "the furthest forward option" would mean the furthest
  // forward option NOW, which is not the choice you were offered.
  {
    const opts = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    sc.forwardMostY = opts.length ? Math.min(...opts.map(r => r.pos.y)) : undefined;
  }
  return sc;
}

// How many team-mates come and make themselves available, by situation. Dead
// balls get none — a wall and a set piece are a still frame by design — and
// build-up already ships with two outlets of its own.
/**
 * How many team-mates come and make themselves available — before vision.
 *
 * Fewer than there were, and deliberately. Counting the players in the game this
 * is modelled on: four to seven opponents in a chance, and ONE team-mate beside
 * you, sometimes two. Ours had it exactly the wrong way round — two or three
 * team-mates and one or two defenders — which is why the pitch looked empty at
 * the goal end and crowded around the ball, and why the offside line was a
 * fiction.
 */
const SUPPORT_COUNT: Record<ScenarioKind, number> = {
  // A shooting chance comes with the man in the box and nobody else, unless you
  // can see further than that. In the reference there are two blue shirts on the
  // screen: you, and one other.
  one_on_one: 0, tight_angle: 0, volley: 0, header: 0, long_range: 0,
  // A ball that has to be played to somebody already HAS somebody to play it to
  // — the target runner is not counted here — so these add nobody of their own.
  cutback: 0, byline_cross: 0, through_ball: 0, corner: 0,
  midfield_pass: 1, buildup: 0,
  penalty: 0, free_kick: 0,
};

/**
 * …and how many of them you can actually SEE.
 *
 * §13.1 again — vision is meant to widen your vocabulary rather than raise a
 * hidden percentage, and the player's own words for it were "vision gives you
 * more players to pass to in scenarios". So it does, literally: at 30 you have
 * the obvious man, at 90 you have three. It used to draw rings over people
 * instead, which is a HUD feature wearing an attribute's clothes.
 */
export function supportSeen(vision: number): number {
  const v = clamp(vision, 0, 100);
  return v < 40 ? 0 : v < 70 ? 1 : 2;
}

/**
 * Give the DEFENCE some numbers.
 *
 * Counting the players in the game this is modelled on: four to seven opponents
 * in a chance, and one team-mate beside you. Ours had one or two defenders, and
 * the consequences ran a long way — the goal end of the pitch was empty, the
 * offside line was drawn round the nearest recovering full-back, and shooting
 * from anywhere was a question of beating the keeper and nobody else.
 *
 * These are the men between the ball and the goal that the builders do not
 * place: a covering pair in front of the keeper, and a body or two further out.
 * They are laid out relative to the GOAL, never relative to you, for the same
 * reason the back line is — a defence that arranges itself around wherever the
 * ball happens to be is not a defence.
 */
const COVER_COUNT: Record<ScenarioKind, number> = {
  one_on_one: 2, tight_angle: 3, volley: 2, header: 3,
  long_range: 3, cutback: 3, byline_cross: 3, through_ball: 2,
  midfield_pass: 1, buildup: 1,
  // A free kick already has a wall of three or four in front of it, and they
  // ARE the cover. Adding more put bodies across the flight of a ball lifted
  // over the wall, so the one free kick that is supposed to work could not.
  penalty: 0, free_kick: 0, corner: 3,
};

function addCover(sc: Scenario, rng: () => number) {
  const want = COVER_COUNT[sc.kind] ?? 0;
  // ── The one situation whose line is already drawn ──
  //
  // A through-ball is built around its offside line: the runner is placed
  // against the deeper of two defenders on purpose, sometimes a yard the wrong
  // side of it. Dropping a covering man in FRONT of that line makes him the
  // second-last opponent, moves the line to him, and puts the runner comfortably
  // onside every time — which is how a fifth of through-balls went from being
  // offside to none of them being.
  //
  // So here he covers from behind, as a midfielder tracking back would.
  const behind = sc.kind === "through_ball";
  const existing = sc.defenders.map(d => d.y).sort((a, b) => a - b);
  for (let i = 0; i < want; i++) {
    // Otherwise a cover defender lives between the goal and the ball, spread
    // across the width of the box, deeper than the men already placed.
    const deepest = Math.min(...sc.defenders.map(d => d.y), sc.ball.y);
    const band = behind
      ? (existing[existing.length - 1] ?? sc.ball.y * 0.6) + 1.5 + rng() * 4
      : goalInView(sc.kind)
        ? clamp(deepest * (0.35 + 0.3 * (i / Math.max(1, want))), 3.5, 15)
        // No goal in the rectangle means no goal to defend: a midfield man
        // covers the space just ahead of the ball. Sending him back to guard a
        // penalty area thirty metres outside the frame dragged the frame down
        // there with him, and a ball driven up the pitch reached that goal
        // instead of leaving the situation.
        : clamp(sc.ball.y - 6 - rng() * 8, 6, Math.max(7, sc.ball.y - 3));

    // ── Across the width, and never behind the keeper ──
    //
    // They used to alternate left, right, left off a random spread, so three of
    // them put two on the same side a stride apart, marking nobody. And the
    // depth was free to land in front of the keeper — defenders standing
    // between him and his own goal line, which is not a thing that happens.
    const lane = want <= 1 ? 0 : (i / (want - 1)) - 0.5;   // -0.5 … +0.5
    const floorY = behind ? 2.5 : Math.max(3.5, sc.keeper.y + 2);
    const at = {
      x: clamp(CX + lane * 26 + (rng() - 0.5) * 5, 8, PITCH_W - 8),
      y: clamp(band + (rng() - 0.5) * 2.5, floorY, Math.max(floorY, sc.ball.y - 1)),
    };
    // Not on top of the keeper, not on top of each other, and not on top of you.
    if (Math.hypot(at.x - sc.keeper.x, at.y - sc.keeper.y) < 2.5) at.y += 2.5;
    for (let k = 0; k < 8; k++) {
      const clash = sc.defenders.some(d => Math.hypot(d.x - at.x, d.y - at.y) < 3)
        || Math.hypot(at.x - sc.player.x, at.y - sc.player.y) < 4.5
        || Math.hypot(at.x - sc.ball.x, at.y - sc.ball.y) < 4;
      if (!clash) break;
      at.x = clamp(at.x + (lane >= 0 ? 2.6 : -2.6), 8, PITCH_W - 8);
      at.y = clamp(at.y + 1.1, floorY, HALF_LEN);
    }
    sc.defenders.push(at);
  }
}

/**
 * Give the attack some life.
 *
 * Team-mates were a decorative `Vec2[]`, so in a shooting scenario you had
 * exactly one option — hit it — while the defence closed you down. These are
 * real runners: they start somewhere plausible, immediately find the best space
 * available to them, and keep looking for a better spot while you hold the ball.
 */
function addSupport(sc: Scenario, rng: () => number, vision = 55) {
  const base = SUPPORT_COUNT[sc.kind] ?? 0;
  // Dead balls are a still frame by design and gain nobody from vision.
  const dead = sc.kind === "penalty" || sc.kind === "free_kick";
  const want = dead ? base : base + supportSeen(vision);
  // Where a man may stand: the rectangle if this situation already has one, the
  // pitch otherwise.
  const vp = sc.viewport;
  // …and no nearer the goal than the offside line, so the space he is offered in
  // is space he is allowed to be standing in. Correcting him afterwards was
  // worse: it dropped him onto a spot chosen for legality rather than for space,
  // and a support player offered in no space at all is not an option.
  const line = opponentLine(sc);
  const onsideY = line.length >= 2 ? line[1] + 0.3 : 0;
  const lo = {
    x: vp ? vp.x1 + 2.5 : 5,
    y: Math.max(onsideY, vp ? Math.max(vp.y1 + 2.5, 2.5) : 2.5),
  };
  const hi = { x: vp ? vp.x2 - 2.5 : PITCH_W - 5, y: vp ? vp.y2 - 2.5 : HALF_LEN + 4 };
  if (hi.y < lo.y) lo.y = hi.y;

  for (let i = 0; i < want; i++) {
    // A plausible starting point — level with or just behind the ball, off to
    // one side — which the space evaluation then improves on immediately.
    const side = i === 0 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.5 ? -1 : 1);
    // ── Where a forward stands ──
    //
    // On the shoulder of the last man when the defence is set in front of you,
    // not loitering beside you. Starting the space search from your own position
    // meant that with a block eighteen metres ahead, the best spot it could find
    // was six metres from your feet — so nobody was ever ahead of the ball and
    // there was nothing to aim at but the keeper.
    const onShoulder = onsideY > 0 && sc.player.y - onsideY > 6;
    const start = {
      x: clamp(sc.player.x + side * (7 + rng() * 7), lo.x, hi.x),
      y: onShoulder
        ? clamp(onsideY + 0.5 + rng() * 4.5, lo.y, hi.y)
        : clamp(sc.player.y + (rng() - 0.35) * 10, lo.y, hi.y),
    };
    // Wide situations put the carrier at the edge of the frame, where the clamp
    // above would fold the start position back on top of him. Try the other
    // side, then the middle, then give up and go and stand in front of goal —
    // which on a cross is where he was always going to end up anyway.
    if (Math.hypot(start.x - sc.player.x, start.y - sc.player.y) < 5) {
      start.x = clamp(sc.player.x - side * (8 + rng() * 6), lo.x, hi.x);
      if (Math.hypot(start.x - sc.player.x, start.y - sc.player.y) < 5) {
        start.x = clamp(CX + (CX - sc.player.x) * 0.5, lo.x, hi.x);
        start.y = clamp(sc.player.y + 7 + rng() * 5, lo.y, hi.y);
      }
      if (Math.hypot(start.x - sc.player.x, start.y - sc.player.y) < 5) {
        start.x = clamp(CX + (rng() - 0.5) * 9, lo.x, hi.x);
        start.y = clamp(SIX_DEPTH + rng() * 5, lo.y, hi.y);
      }
    }
    // Nobody moves until you kick it, so a support player has to be standing
    // somewhere worth finding from the moment the scenario opens. He is placed
    // at the best point near where he broke from rather than setting off for it.
    //
    // The space search knows about the pitch, not about the rectangle — so on a
    // tight frame it would happily send him just outside it, and the clamp that
    // pulled him back in landed him on the taker's shoulder. Kept inside, and if
    // the best available spot is still on top of you, he goes and stands in the
    // middle of the goal instead, which on a cross is a better idea anyway.
    const spot = bestSupportPoint(sc, sc.ball, start);
    spot.x = clamp(spot.x, lo.x, hi.x);
    spot.y = clamp(spot.y, lo.y, hi.y);
    // The space search will happily walk him back down the pitch to find a
    // cleaner lane, which is good reasoning and the wrong shape: a forward
    // holds the line and moves ACROSS to find the angle. Kept within a few
    // metres of the shoulder; the search still picks which side of it.
    if (onShoulder) spot.y = Math.min(spot.y, lo.y + 5);
    // Nobody starts on top of you. The fallback spot is in front of goal, which
    // on a cross is where he was going anyway — but in a situation whose offside
    // line is a long way out, in front of goal is not somewhere he may stand, so
    // it walks back down the pitch until it is both clear of you and legal.
    for (let tries = 0; tries < 14; tries++) {
      if (Math.hypot(spot.x - sc.player.x, spot.y - sc.player.y) >= 5) break;
      spot.x = clamp(CX + (rng() - 0.5) * 11, lo.x, hi.x);
      spot.y = clamp(Math.max(SIX_DEPTH + 1, lo.y) + rng() * 6 + tries * 1.6, lo.y, hi.y);
    }
    const r = makeRunner(spot, spot, RUNNER_SPEED * 0.95, "support");
    r.moving = false;
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
export function buildWeightedScenario(rng: () => number, position: string, keeperStrength = 62, teamRelationship = 60, vision = 55): Scenario {
  const kind = pickScenarioKind(position, rng);
  return buildScenario(kind, rng, keeperStrength, teamRelationship, vision);
}

// After a successful build-up pass, the ball returns in an attacking situation.
const ATTACKING_KINDS: ScenarioKind[] = [
  "one_on_one", "tight_angle", "long_range", "volley", "header",
  "cutback", "byline_cross", "through_ball",
];
export function buildAttackingScenario(rng: () => number, keeperStrength = 62, teamRelationship = 60, vision = 55): Scenario {
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

/**
 * The situation a completed pass has left you in.
 *
 * Two things decide it, and it used to be only the first: WHERE the ball ended
 * up, and WHAT you played to get it there. Position alone was a hard line at
 * y = 32 — one metre the wrong side of it and the ambitious ball that had just
 * broken the opposition midfield returned you another build-up.
 *
 * Now the line is a ramp, and the pass gets a vote. A ball into the final third
 * is an attack whatever it was; a ball that found the furthest forward man is an
 * attack because of what it was.
 */
export function chainKindFor(at: Vec2, rng: () => number, ambition = 0): ScenarioKind {
  const wide = Math.abs(at.x - CX) > 13;
  if (at.y < BOX_DEPTH + 2) {
    if (wide) return rng() < 0.55 ? "cutback" : "tight_angle";
    return rng() < 0.45 ? "one_on_one" : rng() < 0.6 ? "volley" : "tight_angle";
  }
  // y 44 is your own half and none of it; y 33 is the edge of the final third
  // and all of it.
  const byPosition = clamp((44 - at.y) / 11, 0, 1);
  if (rng() < Math.max(byPosition, ambition * 0.95)) {
    if (wide) return rng() < 0.6 ? "byline_cross" : "cutback";
    return rng() < 0.5 ? "through_ball" : "long_range";
  }
  return rng() < 0.55 ? "midfield_pass" : "buildup";
}

/**
 * How likely the ball comes back to you.
 *
 * The rule this has to satisfy, in the words it was reported in: play the right
 * ball and you should always have a chance of the move coming to something;
 * play the ambitious one and you should be as good as guaranteed it. It did not
 * come close — a completed build-up pass came back 52% of the time, and 5% of
 * them produced a chance.
 *
 * So it is keyed off the braver of the two readings of the ball you played: how
 * hard it was in absolute terms, and whether it was the furthest forward man on
 * offer. The second matters because a midfield situation is not built to contain
 * a difficult pass, and the player who picks the bravest ball in it deserves the
 * same answer as the player who picks the bravest ball in a build-up.
 */
export function chainReturnChance(sc: Scenario): number {
  const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
  return clamp(0.30 + ambition * 0.72 + (sc.teamRelationship - 50) / 260, 0.2, 1);
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

  /**
   * How much the situation lets him DO with it.
   *
   * The first attempt at fixing the aim used `composite` for placement, and
   * composite folds in how close to goal he is — so being six yards out made
   * him both more ambitious and more accurate while the keeper got no better,
   * and a corner converted at 55%. Distance is not the difficulty here. What
   * the ball is doing when it reaches him is.
   *
   * A cutback arrives on the floor, into his stride, facing goal: he can pick
   * his spot. A cross has to be met first time. A corner is a header in
   * traffic, and nobody heads a ball into the top corner on purpose. So
   * `control` scales what he aims for AND divides into the error he makes —
   * a hard chance is both less ambitious and more sprayed.
   */
  const control = RECEIVER_CONTROL[scenario.kind] ?? 0.85;
  // His striking quality, which is his own and the understanding between you —
  // and deliberately NOT where he is standing.
  const quality = clamp(clamp(receiver.skill, 0, 100) / 100 * 0.72 + teamQuality * 0.28, 0, 1);

  // ── HE AIMS AT THE GOAL, NOT AT THE GOALKEEPER ──
  //
  // This used to scatter him around the CENTRE of the mouth, in a window that
  // narrowed as he got better:
  //
  //     spread = 7 - composite * 0.05        aimX = centre ± spread/2
  //
  // At composite 96 that is ±1.10 m — and the keeper reaches about 2.4 m either
  // side of where he is standing. So the better the finisher, the more certainly
  // he shot straight at him. Measured over 1,500 chances per situation: mean aim
  // 0.9-1.05 m from the centre spot, and 97.6% of cutbacks, 98.9% of corners and
  // 99.8% of crosses crossing the line within 2.4 m of the middle. On target
  // 100% of the time and saved almost all of it.
  //
  // The only situation that converted respectably was the through-ball, and for
  // an accidental reason: it is struck from further out, so the ANGULAR error had
  // more distance to work over and sprayed him off the keeper. Being worse at it
  // was the only thing that made it work.
  //
  // A finisher looks at the goalkeeper and puts it where he is not. So: pick a
  // side — usually the one the keeper is not shading — and place it toward the
  // frame, with how near the frame he dares aim RISING with quality and the
  // execution error still falling with it. Reading the keeper's position is not
  // the engine cheating on his behalf; it is the same thing the player does by
  // looking at the screen before he drags.
  const goalCx = (scenario.goal.x1 + scenario.goal.x2) / 2;
  const halfMouth = (POST_R - POST_L) / 2;
  const keeperSide = Math.sign(scenario.keeper.x - goalCx) || (rng() < 0.5 ? -1 : 1);
  // Mostly away from him — but only as reliably as the contact allows. A
  // striker with the ball rolled across him looks up and picks the other side;
  // a defender heading a corner is aiming at the goal and hoping. Letting the
  // header read the keeper as well as the cutback did was worth twenty-eight
  // points of conversion on its own.
  const readsKeeper = 0.5 + control * 0.36;
  const side = rng() < readsKeeper ? -keeperSide : keeperSide;
  // Where he is trying to put it, as a fraction of the half-mouth: barely off
  // centre for a defender heading a corner, close to the frame for a striker
  // with a cutback laid into his stride.
  const placement = (0.22 + quality * 0.62) * control;
  const aimX = clamp(
    goalCx + side * placement * (halfMouth - BALL_R * 2),
    POST_L + BALL_R * 2, POST_R - BALL_R * 2,
  );
  const baseDir = normalize({ x: aimX - ball.pos.x, y: -Math.max(ball.pos.y, 0.5) });
  // …and how far off it he ends up. Quality tightens it; a difficult contact
  // widens it. Over ten metres a degree is about 17 centimetres, so this is the
  // number that decides whether aiming at the corner finds it or misses the
  // target altogether — which is exactly the trade a finisher is making.
  const sigmaDeg = (1 - quality * 0.82) * 7.5 / Math.max(0.45, control);
  const dir = rotateDeg(baseDir, gaussian(rng) * sigmaDeg);

  // …and he is allowed to lift it. Loft used to be SUBTRACTED for quality, so
  // every good finish was along the floor: measured mean height at the line was
  // 7 to 13 centimetres. The keeper's save volume is flattened, so height is
  // only a modest help — but a game where no team-mate ever scores above knee
  // height reads as broken long before anybody works out why.
  const loft = clamp(0.10 + rng() * 0.26 + (composite / 100) * 0.14, 0.03, 0.62);
  const Sh = (16 + composite * 0.16) * (1 - loft * 0.25);
  const vz = loft * (7 + composite * 0.04);
  const spin = (rng() - 0.5) * 0.9;

  ball.vel = { x: dir.x * Sh, y: dir.y * Sh };
  ball.vz = vz;
  ball.spin = spin;
  ball.z = 0.1;
  ball.loose = false;
  ball.contactCd = 0.15;
  ball.lastTouch = "attack";
  markLanding(ball, scenario);
  ball.event = "receiverShot";
  scenario.keeper.adjusting = false;
  // It is a shot at goal, so it gets the same protection yours does: a support
  // player steps out of the way of it rather than controlling it. Without this,
  // now that a ball can be collected again after a team-mate has struck it, his
  // shot was being intercepted by another of your own players on the way in.
  ball.shot = true;
  scenario.receiverShot = true;
  scenario.receiverShots = (scenario.receiverShots ?? 0) + 1;
  // ── The ball is live again ──
  //
  // He has struck it; he no longer has it. Leaving receiverDone set meant that
  // once ANY team-mate had touched the ball, nobody could ever collect it again
  // — so a shot the keeper parried away rolled to a stop with your players
  // walking toward it and the move was cut off before the nearest of them got
  // there. It read, correctly, as your side declining to chase a loose ball.
  scenario.receiverDone = false;
  // His touch is a new deliberate play, so it is a new snapshot — judged
  // against where everybody is NOW, which is not where they were when you
  // played it. This is where offside actually arises in a game whose pitch is
  // frozen until somebody kicks the ball.
  offsideSnapshot(scenario, { x: ball.pos.x, y: ball.pos.y });
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

/**
 * A defender winning the header is a deliberate play, not a deflection, so it
 * puts every attacker onside again. A save, a parry, the post and an accidental
 * ricochet deliberately do NOT — that is the "gains an advantage" clause, and it
 * works by the flags simply surviving.
 */
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
    ball.lastTouch = "defence";
    clearOffside(scenario);
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
 * are receiving rather than already in possession.
 *
 * It used to work by advancing the defence for however long your touch cost
 * them — which is meaningless now that nobody moves until you kick it. A heavy
 * touch instead pushes the BALL away from where you wanted it, so you strike
 * from a worse angle and a longer way out. The cost is in the position, which
 * is a thing you can see, rather than in a clock you cannot.
 *
 * Returns the metres it got away from you.
 */
export function applyFirstTouch(scenario: Scenario, technique: number, rng: () => number): number {
  // How far the ball got away from you. A good first touch kills it dead; a
  // poor one bobbles a yard or two and you strike it from somewhere worse.
  const heavy = clamp(1 - clamp(technique, 0, 100) / 100, 0, 1);
  const away = heavy * (0.6 + rng() * 2.4);
  const ang = rng() * Math.PI * 2;
  const vp = scenario.viewport;
  const inset = 1.4;
  scenario.ball = {
    x: clamp(scenario.ball.x + Math.cos(ang) * away, vp ? vp.x1 + inset : 2, vp ? vp.x2 - inset : PITCH_W - 2),
    y: clamp(scenario.ball.y + Math.sin(ang) * away, 1, vp ? vp.y2 - inset : HALF_LEN),
  };
  // Beside it, the same as everywhere else. This used to plant you 1.2 m
  // straight BEHIND the ball — the old model, left behind here when the rest of
  // the game moved to standing alongside — so every chance that came out of a
  // completed pass, which is most of the good ones, put the ball on your chest.
  standOff(scenario, vp ? vp.x1 + inset : undefined, vp ? vp.x2 - inset : undefined);
  // A heavy touch moves the ball up to three metres, and it can move it onto
  // somebody. Everywhere else the whistle goes with nobody standing on it; a
  // bad first touch was the one way back into a chance that could not be played.
  clearOfTheBall(scenario);
  return away;
}


/**
 * ATTRIBUTES AS EXPANDERS
 *
 * Specification §13.1: "Attributes should increase the player's football
 * vocabulary, not simply increase their success rate… If upgrading an attribute
 * only increases hidden percentages without changing player behaviour, the
 * system has failed its design goal."
 *
 * And §13.7 on Technique specifically: "Rather than increasing generic accuracy,
 * Technique expands the player's available shot and pass types — curled
 * finishes, chipped passes, lofted balls, dipping strikes."
 *
 * Ours did precisely the named failure case: technique's main job was shrinking
 * the launch-angle error. It now decides how much of the ball you can actually
 * USE. Strike the extreme edge with poor technique and you get a fraction of the
 * bend a better player gets from the identical contact — the shot you are trying
 * to play simply is not in your range yet. A little accuracy coupling remains,
 * because a beginner does miskick, but it is no longer the point of the stat.
 */
export function curlRange(technique: number): number {
  return 0.42 + clamp(technique, 0, 100) / 100 * 0.58;
}

/** The same, for how much lift and dip you can put on it. */
export function loftRange(technique: number): number {
  return 0.55 + clamp(technique, 0, 100) / 100 * 0.45;
}

/**
 * How long a drag buys full power, as a fraction of the screen.
 *
 * Power's job used to be entirely inside the launch speed. It now also makes the
 * arrow more generous: a stronger player reaches everything he has with a
 * shorter pull, so the same flick of the thumb is worth more of a shot. This is
 * the player's own description of what the attribute should feel like, and it is
 * an expander rather than a multiplier — a weak player can still hit it as hard
 * as he is able, he just has to ask for it.
 *
 * ── Why it is 0.18 and not 0.42 ──
 *
 * Because 0.42 could not be reached with a thumb. `fitToView` keeps the ball out
 * of the bottom fifth of the frame, so the room below it — which is all the room
 * a straight pull has — is at worst exactly 20% of the screen. Asking for 34% of
 * the screen (0.42 at a typical power) meant the gesture had to leave the canvas
 * entirely and finish somewhere down the page, and on a phone that is the edge of
 * the device, the navigation bar, or the back-swipe gutter.
 *
 * Measured across all thirteen situations: 24% of chances could not be pulled to
 * full power without leaving the canvas, and for the three framed hardest against
 * the floor — a shot from distance, a through-ball, a build-up — it was none of
 * them. Reported as "it's hard to actually pull the power arrow back to anywhere
 * near 100% on mobile".
 *
 * 0.18 fits inside that worst-case 20% with a little room to spare, so every
 * situation in the game can be struck at full power with the thumb still on the
 * pitch. The cost, accepted knowingly, is resolution: the same range of power now
 * lives in about half the travel, so choosing 60% rather than 70% is a finer
 * movement than it was.
 */
export function dragForFullPower(power: number): number {
  return 0.18 - clamp(power, 0, 100) / 100 * 0.06;
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
  const tech = skills.technique;
  // How much of the ball this player can actually use. Struck at the very
  // bottom, a technique-20 player gets a little over half the lift a
  // technique-100 player gets from the same contact.
  const usableCy = contact.cy * loftRange(tech);
  const loft = clamp((usableCy + 1) / 2, 0, 1); // 0 = struck top (driven), 1 = struck bottom (lofted)

  // Accuracy: a little, so a beginner does miskick — but technique is no longer
  // primarily an accuracy stat. See curlRange/loftRange above and §13.7.
  const sigmaDeg = (1 - tech / 100) * 2.2 + power * (1 - tech / 100) * 1.6;
  const noise = gaussian(rng) * sigmaDeg;
  const d = rotateDeg(normalize(dir), noise);

  // Horizontal launch speed, in m/s. A full-power strike from a 55-power player
  // leaves the boot around 28 m/s; a 100-power player nudges 36. Lofting bleeds
  // a little ground speed into the air.
  const Sh = power * (18 + skills.power * 0.18) * (1 - loft * 0.25);
  // Vertical launch speed from how low on the ball it was struck.
  const vz = loft * power * (7.5 + skills.power * 0.035);
  // Curl from striking the side of the ball. Technique decides how much of that
  // side is available to you at all, which is what makes a curled finish
  // something you unlock rather than something you are simply better at.
  const spin = contact.cx * curlRange(tech) * 1.85 * power;
  // Struck above the middle drives it on with topspin; struck underneath puts
  // backspin on it. Same contact point the loft already reads, used for how it
  // behaves off the turf.
  const topspin = clamp(-usableCy, -1, 1) * (0.5 + tech / 200);

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
    lastTouch: "attack",
    receiverControlT: 0,
    event: null,
    inNet: false,
  };
  // Your touch, judged first: the pitch is frozen and every attacker's position
  // is taken down. Then the marker gets his say — and if he wins the header,
  // that is a deliberate play by a defender and it wipes the snapshot again.
  offsideSnapshot(scenario, { x: scenario.ball.x, y: scenario.ball.y });
  applyAerialContest(ball, scenario, skills, rng);
  // Decided here, once, from what you actually did with it — see isDriveAtGoal.
  ball.shot = isDriveAtGoal(ball, scenario);
  // …and remembered separately, because `shot` does not stay yours. See
  // Ball.youStruckAtGoal.
  ball.youStruckAtGoal = ball.shot;
  ball.owner = ball.loose ? "none" : "you";
  markLanding(ball, scenario);
  return ball;
}

/**
 * Advance the keeper.
 *
 * He does not advance. He breathes — see the Keeper doc above.
 *
 * The one exception is a ball he has already spilled, where he scrambles after
 * it, and that is the point: everything he does is a consequence of something
 * that has already happened, never an anticipation of something that has not.
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

  // ── Covering the angle to where the ball actually is ──
  if (k.adjusting && !k.scrambling) {
    const target = clamp(k.targetX, k.startX - KEEPER_SHUFFLE_MAX, k.startX + KEEPER_SHUFFLE_MAX);
    const dx = target - k.x;
    k.x += Math.sign(dx) * Math.min(Math.abs(dx), KEEPER_SHUFFLE_SPEED * dt);
    k.idleT += dt;
    k.patrolT += dt;
    k.dive += (0 - k.dive) * Math.min(1, dt * 8);
    return;
  }

  if (k.scrambling) {
    const target = clamp(k.targetX, k.startX - KEEPER_LATERAL_MAX, k.startX + KEEPER_LATERAL_MAX);
    const dx = target - k.x;
    const speed = KEEPER_DIVE_SPEED * (k.saves > 0 ? 0.78 : 1);
    k.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    const wanted = clamp(k.x - k.startX, -KEEPER_LATERAL_MAX, KEEPER_LATERAL_MAX);
    k.dive += (wanted - k.dive) * Math.min(1, dt * 12);
    return;
  }

  // ── He stands still ──
  // Not a figure of speech: nothing here moves him. The idle clock keeps him
  // breathing and shifting his weight so he reads as alive rather than as a
  // cardboard cutout, and any lean left over from a scramble settles back to
  // upright. That is the whole function.
  k.idleT += dt;
  k.patrolT += dt;
  k.dive += (0 - k.dive) * Math.min(1, dt * 8);
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
/**
 * The defence, which now does exactly one thing: a free-kick wall jumps.
 *
 * This used to press the carrier, slide onto passing lanes, commit to
 * interceptions and make recovery runs — a whole Pressure Curve that ran WHILE
 * you were still aiming. Nobody moves until you kick the ball; what happens
 * after that is stepReactions.
 */
export function stepDefenders(
  scenario: Scenario,
  dt: number,
  _carrier: Vec2,
  _carrierHasBall: boolean,
  ball: Ball | null = null,
): Outcome | null {
  if (scenario.kind !== "free_kick") return null;
  for (const d of scenario.defenders) {
    if (d.baseRole !== "hold") continue;
    if (d.z === undefined) { d.z = 0; d.vz = 0; }
    // The jump only STARTS while the ball is live, but gravity runs regardless
    // or the wall hangs in the air over the freeze frame.
    if (ball && d.z === 0 && (d.vz ?? 0) === 0 && (d.containT ?? 0) >= WALL_JUMP_DELAY) {
      d.vz = WALL_JUMP_VZ;
    }
    if (ball) d.containT = (d.containT ?? 0) + dt;
    if ((d.z ?? 0) > 0 || (d.vz ?? 0) > 0) {
      d.vz = (d.vz ?? 0) - 9.8 * dt;
      d.z = Math.max(0, (d.z ?? 0) + (d.vz ?? 0) * dt);
      if (d.z === 0) d.vz = 0;
    }
  }
  return null;
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
const PREDICT_STEP = 0.08;     // seconds per step when projecting where a ball will be

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
  const dt = PREDICT_STEP;
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

/**
 * Where a ball in the air will first touch the grass.
 *
 * Runs the SAME flight the ball is about to fly — curl, drag and the wind
 * included — so the answer is where it lands rather than an estimate of where
 * it lands. That matters because of how the mark is used: it is worked out once,
 * at the kick, and pinned there.
 *
 * Recomputing it every frame from the ball's current state was the obvious
 * thing and it was wrong. A curling ball's straight-line projection sweeps round
 * as the curl bites, so the mark crawled across the grass and chased the ball
 * in. You are told where it is going to land, once, and then it lands there.
 *
 * The first bounce and no further: after that it is a rolling ball and you can
 * see perfectly well where that is going.
 */
export function firstBounceAt(ball: Ball, conditions?: Scenario["conditions"], horizon = 5): Vec2 | null {
  if (ball.z <= 0.25 && ball.vz <= 0) return null;
  let x = ball.pos.x, y = ball.pos.y, z = ball.z;
  let vx = ball.vel.x, vy = ball.vel.y, vz = ball.vz;
  // The SAME step the match loop integrates at. At the coarse step used for
  // reading passing lanes this came out a metre and a bit long, every time —
  // a systematic offset rather than noise, because a bigger step under gravity
  // consistently overshoots. It runs once per kick, so it can afford the steps.
  const dt = 1 / 180;
  for (let t = 0; t < horizon; t += dt) {
    const sp = Math.hypot(vx, vy);
    if (sp > 0.01 && Math.abs(ball.spin) > 0.0001) {
      const ax = ball.spin * CURL_K * vy;
      const ay = ball.spin * CURL_K * -vx;
      vx += ax * dt; vy += ay * dt;
    }
    if (z > 0.02) {
      const k = Math.max(0, 1 - AIR_DRAG * (conditions?.drag ?? 1) * dt);
      vx *= k; vy *= k;
      if (conditions?.wind) vx += conditions.wind * dt;
    }
    vz -= G * dt;
    const nz = z + vz * dt;
    x += vx * dt; y += vy * dt;
    if (nz <= 0) {
      // Land it on the exact crossing rather than a step past it.
      const f = z / (z - nz || 1);
      return { x: x - vx * dt * (1 - f), y: y - vy * dt * (1 - f) };
    }
    z = nz;
  }
  return null;
}

/** Work out where this ball will land and pin it. Called whenever one is struck. */
export function markLanding(ball: Ball, scenario: Scenario) {
  ball.landAt = firstBounceAt(ball, scenario.conditions) ?? undefined;
}

export function isDriveAtGoal(ball: Ball, scenario: Scenario): boolean {
  // A rebound belongs to the poacher, never to a support player.
  if (ball.loose) return true;
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  if (speed < LAYOFF_MAX_SPEED) return false;
  if (ball.vel.y >= -1) return false;                 // not going that way at all

  // ── A man standing on the line is a man you were passing to ──
  //
  // Without this, hitting a team-mate firmly — which is what you do when he is
  // ten metres away and there are defenders about — got the ball flagged as
  // your shot, and a support player steps out of the way of your shot. So the
  // pass went cleanly THROUGH the man you aimed at, every time, and then rolled
  // away with nobody allowed to touch it. It was the most-reported bug in the
  // game and it was this line missing.
  // What separates a shot from a pass is not how far away he is, it is whether
  // you aimed AT him. He has to be on the line of the ball, and reached before
  // the goal is — a forward on the shoulder of the last man is eighteen metres
  // away and finding him is still a pass.
  //
  // This was bounded to fourteen metres for a while, which was the wrong lever:
  // it fixed a team-mate loitering in front of goal absorbing long shots, and it
  // did it by making a long ball to a forward unplayable. The tolerance below is
  // the real one — aim at the corner and the ball's line passes clear of him.
  const toGoal = ball.pos.y / -ball.vel.y * speed;
  const mates: Vec2[] = [
    ...(scenario.runner ? [scenario.runner.pos] : []),
    ...scenario.secondaryRunners.map(r => r.pos),
  ];
  if (!scenario.follower.shot) mates.push({ x: scenario.follower.x, y: scenario.follower.y });
  for (const pos of mates) {
    const dx = pos.x - ball.pos.x, dy = pos.y - ball.pos.y;
    const t = (dx * ball.vel.x + dy * ball.vel.y) / (speed * speed);
    if (t <= 0 || t * speed > toGoal) continue;   // behind you, or past the goal
    const offX = dx - ball.vel.x * t, offY = dy - ball.vel.y * t;
    // ── How near his line a man has to be for it to be a ball TO him ──
    //
    // A flat 2.4 m regardless of pace, and the poacher is placed at half the
    // distance to the goal in the same width band your shot travels through —
    // so in a one-on-one your own striker was standing in your shooting line and
    // the engine read 43% of your clean-through chances as passes to him. He
    // then took the shot, and scored more of them than you did.
    //
    // A rolled ball near a man is a pass. A ball struck at twenty-five metres a
    // second is a shot he would have to step INTO, and it is not his.
    const lane = PASS_CONTROL_R * 1.2 * clamp(1.35 - speed / 34, 0.35, 1.2);
    if (Math.hypot(offX, offY) < lane) return false;
  }

  // Where it would cross the line if nothing touched it. A cone around the goal
  // was the obvious test and it was wrong: from the byline EVERY forward pass
  // sits inside the cone, so a cutback to a team-mate was unplayable.
  const t = ball.pos.y / -ball.vel.y;
  const b = predictBall(ball, Math.min(t, 3));
  return b.pos.x > scenario.goal.x1 - SHOT_MOUTH_PAD
    && b.pos.x < scenario.goal.x2 + SHOT_MOUTH_PAD
    && b.z < scenario.crossbar + 3;
}

/**
 * REACTIONS
 *
 * Nobody moves until you kick the ball — not the defence, not your team-mates,
 * not by an inch. You have unlimited time to decide, and the only action you
 * take in a scenario is the strike itself.
 *
 * Once it is struck, a player reacts ONLY when the ball comes inside his radius,
 * and then he moves slowly. It is a stretch and a step, not a sprint: if the
 * pass is close enough that a yard would reach it he gets there, and if it is
 * not, he does not. Both sides move at the same pace, so who wins a loose ball
 * is a question of where it went rather than of who is quicker.
 *
 * A ball that has stopped is the exception — the nearest man of either side
 * walks to it however far away he is, because otherwise it sits on the grass
 * and the move never ends.
 */
const REACT_R = 9;         // metres — he notices the ball inside this
const REACT_SPEED = 2.6;   // m/s — a stretch and a step, not a chase
const WALK_SPEED = 4.6;    // …and the jog he breaks into for one that has stopped
const FETCH_SPEED = 7;     // …which becomes a run once it is a long way off
const FETCH_FAR = 12;      // metres — beyond this, fetching it is worth running for
const DEAD_BALL_SPEED = 4; // m/s — below this the ball is going nowhere
const CONTROL_R = 1.15;    // metres — close enough to take it

export function stepReactions(scenario: Scenario, ball: Ball, dt: number, rng: () => number = Math.random) {
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const dead = ball.resting || (speed < DEAD_BALL_SPEED && ball.z < 0.4);

  // Nobody walks off the edge of the situation after it. If it has left the
  // frame it is gone; stepBall ends the move on the same tick, and until it
  // does, everyone stays where they are.
  //
  // The margin has to be the SAME one stepBall calls "out" on. It was a metre
  // tighter, which left a one-metre band around the frame where the ball was
  // still in play but everybody had stopped going for it: a ball that stopped
  // in that band sat there until the dead-ball timer wrote it off, with the
  // nearest man standing five metres away doing nothing.
  const vp = scenario.viewport;
  if (vp && (ball.pos.x < vp.x1 - 1 || ball.pos.x > vp.x2 + 1
             || ball.pos.y < vp.y1 - 1 || ball.pos.y > vp.y2 + 1)) return;

  const move = (p: { x: number; y: number }, pace: number) => {
    const dx = ball.pos.x - p.x, dy = ball.pos.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = Math.min(dist, pace * dt);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
  };

  // Fetching a ball that has stopped is a jog, or a run if it is a long way off.
  // Not because anybody is racing — because nobody wants to watch a man walk
  // thirty metres before the move can end.
  const fetch = (dist: number) => (dist > FETCH_FAR ? FETCH_SPEED : WALK_SPEED);

  for (const r of [...(scenario.runner ? [scenario.runner] : []), ...scenario.secondaryRunners]) {
    const dist = Math.hypot(ball.pos.x - r.pos.x, ball.pos.y - r.pos.y);
    if (dead) { move(r.pos, fetch(dist)); r.moving = true; continue; }
    if (dist > REACT_R) { r.moving = false; continue; }
    move(r.pos, REACT_SPEED);
    r.moving = true;
    r.sprint = false;
  }

  // The poacher is another team-mate now rather than sprinting onto every
  // rebound at seven metres a second. He reaches a rebound in the box the same
  // way anybody reaches anything — by being near it — and if he gets there he
  // does what a striker does with a loose ball six yards out.
  {
    const f = scenario.follower;
    const dist = Math.hypot(ball.pos.x - f.x, ball.pos.y - f.y);
    // He walks to a stopped ball whether or not he has already had a go at it.
    // Skipping him once he had shot meant a ball could come to rest five metres
    // from the only man near it and simply be given up on.
    if (dead) { move(f, fetch(dist)); f.active = true; }
    else if (!f.shot && dist <= REACT_R) { move(f, REACT_SPEED); f.active = true; }

    if (!f.shot && f.active && ball.loose && !ball.inNet && ball.z < 1.6
        && ball.pos.y < BOX_DEPTH && ball.contactCd <= 0
        && Math.hypot(ball.pos.x - f.x, ball.pos.y - f.y) < CONTROL_R
        // Flagged at the last touch and now playing the ball: position plus
        // involvement, which is the offence. A save does not wipe the flag, so
        // this is also the "gains an advantage" clause doing its job.
        && !offsideOffence(scenario, f.offside)) {
      const tx = POST_L + rng() * (POST_R - POST_L);
      const dir = normalize({ x: tx - ball.pos.x, y: -Math.max(ball.pos.y, 0.5) });
      const sp = 17 + rng() * 8;
      ball.vel = { x: dir.x * sp, y: dir.y * sp };
      ball.vz = 0.3 + rng() * 0.7;
      ball.spin *= 0.3;
      ball.loose = false;      // a fresh strike — it still counts as a rebound if it goes in
      ball.contactCd = 0.18;
      ball.lastTouch = "attack";
      markLanding(ball, scenario);
      f.shot = true;
      // Deliberately does NOT tell the keeper where this is going. He keeps
      // patrolling; whether he is in the way is settled when the ball arrives.
    }
  }

  for (const d of scenario.defenders) {
    // A wall stays a wall while the free kick is live. Once the ball has stopped
    // there is no wall any more, only somebody who ought to go and get it.
    if (d.baseRole === "hold" && !dead) continue;
    const dist = Math.hypot(ball.pos.x - d.x, ball.pos.y - d.y);
    if (dead) { move(d, fetch(dist)); continue; }
    if (dist > REACT_R) continue;
    move(d, REACT_SPEED);
  }
}

/**
 * A defender has it. He does not knock it back into play for you to have
 * another go at — he puts it as far from his own goal as he can.
 */
export function clearBall(ball: Ball, rng: () => number, scenario?: Scenario) {
  // A deliberate clearance is a deliberate play, and it puts every attacker
  // onside again. It also ends the move, so this matters only for tidiness —
  // but the law is the law.
  if (scenario) clearOffside(scenario);
  const away = normalize({ x: (rng() - 0.5) * 0.8, y: 1 });
  const sp = 18 + rng() * 8;
  ball.vel = { x: away.x * sp, y: away.y * sp };
  ball.vz = 4 + rng() * 3;
  ball.spin = 0;
  ball.loose = false;
  ball.owner = "opponent";
  ball.lastTouch = "defence";
  if (scenario) scenario.keeper.adjusting = false;
}

/**
 * Is this ball, right now, on its way into the goal?
 *
 * Not "did somebody shoot" — the flight itself, extrapolated to the line. It is
 * what separates a defender BLOCKING something from a defender cutting a pass
 * out, and it holds however the ball came to be travelling: your strike, a
 * team-mate's, or a poacher's stab at a rebound.
 *
 * Deliberately generous at the edges. A defender who gets a foot to a ball that
 * would have shaved the post has blocked a shot, and being a metre out on the
 * counterfactual is not worth calling it something else.
 */
function headedForGoal(ball: Ball, scenario: Scenario): boolean {
  // In midfield the goal is forty metres off the top of the frame. A forward
  // pass extrapolated that far will sometimes land between the posts, and a
  // defender cutting it out is not blocking a shot — nobody was shooting.
  if (!goalInView(scenario.kind)) return false;
  if (ball.vel.y >= -1) return false;                       // not going that way
  if (Math.hypot(ball.vel.x, ball.vel.y) < 8) return false; // not going anywhere
  const t = ball.pos.y / -ball.vel.y;
  const xAt = ball.pos.x + ball.vel.x * t;
  const zAt = ball.z + ball.vz * t - 0.5 * G * t * t;
  return xAt > POST_L - 1.2 && xAt < POST_R + 1.2 && zAt < scenario.crossbar + 1.0;
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
  // Whatever he does with it from here, he got to it — so if the move dies
  // afterwards it died because of the save, and says so.
  ball.lastTouch = "keeper";
  ball.deflected = "keeper";
  const marginNorm = clamp((reach - dist) / reach, 0, 1); // 1 = right at the body, 0 = full stretch
  // ── What a keeper can hold ──
  //
  // This was `speed < 17 && z < 1.2`, and the median shot he gets a hand to
  // travels at 21.2 m/s — so the gate sat down at the tenth percentile and he
  // caught 7 balls in 2,484. Everything else was tipped or spilled. A keeper who
  // never holds one is not a hard keeper, he is a broken one: it made every save
  // a rebound or a corner, and it left the catch animation and two lines of
  // commentary written for something that could not happen.
  //
  // Chest-high or below, hit at a pace a man can absorb, and inside his reach
  // rather than at full stretch — that is a ball you catch.
  const lowAndSlow = speed < 23 && ball.z < 1.5;

  // ── Where a saved ball ENDS UP ──
  //
  // Both of these used to freeze the ball exactly where it was when the save
  // was decided — and the shot-stopping test decides at the goal plane, having
  // just moved the ball to (crossing point, y = 0.02). So a save left the ball
  // sitting in the middle of the goal mouth, on the line, motionless. It looked
  // for all the world like a goal that had not been given, and was reported as
  // one. Gameplay was right and the picture was a lie, which is the worst way
  // round to have it.

  // Comfortable, gathered save — it ends up in his gloves.
  // …and how near "at him" has to be. This was 0.5, which sounds like half his
  // reach and is not: height is scaled into the same distance, so a shot along
  // the ground already spends 1.09 m of a 2.4 m budget before it has moved
  // sideways at all. Half a metre either side of his boots was the entire catch
  // window. At 0.35 it is a metre or so — a ball at the body — and he holds one
  // in ten, palms two thirds clear and spills the rest back into play.
  if (marginNorm > 0.35 && lowAndSlow && rng() < 0.72) {
    ball.pos = { x: k.x, y: Math.max(k.y, 0.4) };
    ball.z = 0.55;
    ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.resting = true;
    k.done = true;
    return "caught";
  }

  // Full-stretch, high or fierce → pushed away to safety, and it has to LOOK
  // like safety.
  //
  // Two goes at this and both were wrong for the same reason. Behind the line
  // and outside the post is where a tipped ball really goes, and from directly
  // above that reads as the ball sitting in the side netting. Setting it down
  // out in front of the goal instead read as the ball being TELEPORTED there,
  // because that is what it was: the outcome is terminal, so wherever the ball
  // is put is where it appears, instantly, with nothing in between.
  //
  // So he does not put it anywhere. He hits it — away from his goal, from the
  // point he reached it — and the result phase keeps stepping it until it
  // stops. You watch it go, which is the whole of the difference.
  if (marginNorm < 0.24 || ball.z > 1.85 || speed > 26) {
    const side = ball.pos.x < CX ? -1 : 1;
    const away = normalize({ x: side * (0.7 + rng() * 0.5), y: 1 });
    // A push to safety, not a clearance. At 9-16 m/s a tipped ball ran for the
    // better part of forty metres and was off the screen long before it stopped
    // — which is not what "you watch it go" was supposed to mean. This dies
    // inside the rectangle, most of the time without needing the touchline.
    const sp = 6 + rng() * 6;
    ball.vel = { x: away.x * sp, y: away.y * sp };
    ball.vz = 1.4 + rng() * 2.2;
    ball.spin *= 0.2;
    ball.resting = false;
    ball.settling = true;
    k.done = true;
    return "tipped";
  }

  // ── He smothers it ──
  //
  // A keeper who has already been beaten twice in one move does not palm it
  // back out a third time; he falls on it. Without this the goalmouth scramble
  // was a perpetual motion machine, and the mechanism was neat: he scrambles
  // ACROSS to the ball he has spilled, your team-mate collects it at that same
  // spot, and so shoots from directly on top of him — which he saves, and
  // spills, and so on. Measured, it never once broke out: a move either had no
  // team-mate shot at all or ran to the cap, 306 times in 1200, and never one,
  // two or three.
  if (k.saves >= 3) {
    ball.pos = { x: k.x, y: Math.max(k.y, 0.4) };
    ball.z = 0.55;
    ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.resting = true;
    k.done = true;
    return "caught";
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
  markLanding(ball, scenario);
  ball.spin *= 0.4;
  ball.loose = true;
  // ── It stopped being your shot the moment he touched it ──
  //
  // `shot` is sticky so a team-mate cannot wander into a ball that is going in
  // and turn your goal into a completed pass. That is right while it is still
  // your shot — and a ball the keeper has just pushed away is not. Leaving the
  // flag on meant every one of your players stepped aside from the rebound: it
  // rolled visibly THROUGH them, 862 times in 1047 parries, until somebody the
  // rule did not cover finally picked it up.
  ball.shot = false;
  ball.contactCd = 0.28;
  // Keeper scrambles back toward where the ball spills — a visible chase, and
  // the only time he stops patrolling.
  k.targetX = ball.pos.x;
  k.scrambling = true;
  return null;
}


/**
 * The ball comes back off the frame.
 *
 * Woodwork used to end the highlight, which is not what hitting the post looks
 * like — it cannons back out with most of the pace still on it and the nearest
 * man has a decision to make. It is loose from that moment: your poacher can
 * follow it in, and a defender who gets there first hoofs it away like any
 * other loose ball.
 *
 * Returns false the second time, because a ball ricocheting between the uprights
 * is pinball rather than football.
 */
const POST_KEEP = 0.78;        // how much of the pace survives the impact

function reboundOffFrame(ball: Ball, xCross: number, rng: () => number, scenario?: Scenario): boolean {
  if ((ball.postHits ?? 0) >= 1) return false;
  ball.postHits = (ball.postHits ?? 0) + 1;

  // Which upright, and therefore which way it spits out. A ball striking the
  // inside of the post comes back across goal; the outside of it goes wide.
  const post = Math.abs(xCross - POST_L) < Math.abs(xCross - POST_R) ? POST_L : POST_R;
  const side = Math.sign(xCross - post) || (rng() < 0.5 ? -1 : 1);

  ball.pos.y = 0.35;
  ball.pos.x = post + side * 0.35;
  ball.vel.y = Math.abs(ball.vel.y) * POST_KEEP;                 // straight back out
  ball.vel.x = ball.vel.x * POST_KEEP + side * (1.5 + rng() * 3.5);
  ball.vz = Math.max(ball.vz * 0.4, 0.4);
  ball.spin *= 0.25;
  ball.loose = true;
  ball.owner = "none";
  // Off the woodwork it is a loose ball, not your shot — see the parry.
  ball.shot = false;
  ball.contactCd = 0.25;
  ball.lastTouch = "frame";
  ball.deflected = "frame";
  ball.event = "post";
  if (scenario) markLanding(ball, scenario);
  return true;
}

/**
 * Roll on after the whistle.
 *
 * No collisions, no outcomes, no keeper — just gravity, a bounce and friction,
 * so a ball the keeper has pushed clear is SEEN going clear. Anything that
 * could change the result has already happened.
 */
export function settleBall(ball: Ball, dt: number, scenario?: Scenario) {
  if (!ball.settling || ball.resting) return;
  const cond = scenario?.conditions;
  ball.vz -= G * dt;
  ball.z += ball.vz * dt;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  if (ball.z <= 0) {
    ball.z = 0;
    // The surface is the surface after the whistle too. This used to use the
    // bare constants, so a ball pushed clear on a bog skipped away exactly as it
    // would in August.
    if (ball.vz < -MIN_BOUNCE_VZ) {
      ball.vz = -ball.vz * BOUNCE_VZ * (cond?.bounce ?? 1);
      ball.vel.x *= BOUNCE_H; ball.vel.y *= BOUNCE_H;
    } else ball.vz = 0;
  }
  if (ball.z <= 0.03 && ball.vz <= 0.01) {
    const s = Math.hypot(ball.vel.x, ball.vel.y);
    const drop = GROUND_FRICTION * (cond?.friction ?? 1) * dt;
    if (s <= drop) { ball.vel.x = 0; ball.vel.y = 0; ball.resting = true; }
    else { const f = (s - drop) / s; ball.vel.x *= f; ball.vel.y *= f; }
  }

  // ── It stops at the edge of the situation ──
  //
  // A keeper's tip leaves at 9-16 m/s and rolling resistance is 1.9 m/s², so it
  // runs for the better part of forty metres. Measured: 74% of settling balls
  // were off the visible frame within two and a half seconds, some of them
  // seventeen metres past it, still rolling. The point of settling the ball was
  // that you SEE where it went — instead you watched it leave and then watched
  // an empty rectangle.
  //
  // There is no pitch outside the frame. stepBall already says so, and calls a
  // ball that leaves it "out"; the whistle has already gone here, so it simply
  // pulls up on the touchline and stays where you can see it.
  const vp = scenario?.viewport;
  if (vp) {
    const m = 0.6;   // the ball's own width in from the edge
    if (ball.pos.x < vp.x1 + m) { ball.pos.x = vp.x1 + m; ball.vel.x = 0; ball.vel.y *= 0.4; }
    else if (ball.pos.x > vp.x2 - m) { ball.pos.x = vp.x2 - m; ball.vel.x = 0; ball.vel.y *= 0.4; }
    if (ball.pos.y > vp.y2 - m) { ball.pos.y = vp.y2 - m; ball.vel.y = 0; ball.vel.x *= 0.4; }
    else if (ball.pos.y < vp.y1 + m) { ball.pos.y = vp.y1 + m; ball.vel.y = 0; ball.vel.x *= 0.4; }
  }
}

/**
 * Advance the ball one tick and return an Outcome if the play has resolved.
 *
 * The physics live in `stepBallRaw`, which reports where the ball ended up. This
 * reports what HAPPENED, which is not always the same sentence — a shot the
 * keeper turned onto the post and a defender then belted into row Z ends up
 * "out of play", and calling it that is technically true and completely useless.
 *
 * Four outcomes the engine declares were unreachable before this: `saved`,
 * `blocked`, `rebound` and `post`. All four had commentary written for them, and
 * three of them had sound and screen-shake wired up to fire and never fired
 * once in 11,700 simulated chances. The keeper made saves and they were reported
 * as the ball running out of play; the woodwork was hit and the highlight said
 * the move had been scrambled clear; every rebound finish was filed as an
 * ordinary goal.
 */
export function stepBall(ball: Ball, scenario: Scenario, rng: () => number, dt: number): Outcome | null {
  // Read BEFORE the tick: the touch that ends a move happens on an earlier tick
  // than the outcome it causes, and the tick that reports "out" may itself have
  // set lastTouch to the defender who put it there.
  const touchedLast = ball.lastTouch;
  const res = stepBallRaw(ball, scenario, rng, dt);
  if (res === null) return null;

  // A finish from a second phase is a rebound, whoever struck it. `deflected`
  // is sticky precisely so that a fresh strike does not erase where the chance
  // came from — the old test read `ball.loose`, which every re-strike clears
  // before the ball reaches the line, so it could never be true here.
  if (res === "goal" && ball.deflected) return "rebound";

  // The move died after a save or off the woodwork, and nobody in your shirt
  // touched it in between. Name it for the thing that stopped it.
  if (res === "short" || res === "out" || res === "tackled" || res === "wide") {
    if (touchedLast === "keeper") return "saved";
    if (touchedLast === "frame") return "post";
  }
  return res;
}

function stepBallRaw(ball: Ball, scenario: Scenario, rng: () => number, dt: number): Outcome | null {
  // An offside offence was committed on a previous tick (the poacher playing a
  // ball he was flagged for). The move is dead.
  if (scenario.offsideAgainst) return "offside";

  // A teammate is controlling a pass they've just received — hold the ball, then strike.
  if (ball.receiverControlT > 0) {
    ball.receiverControlT = Math.max(0, ball.receiverControlT - dt);
    if (ball.receiverControlT <= 0) launchReceiverShot(ball, scenario, rng);
    return null;
  }

  // A ball that has stopped does NOT end the move. It sits on the grass and
  // everybody walks to it (see stepReactions); whoever gets there settles it —
  // a team-mate collects, a defender clears. The timer below is only a backstop
  // for a ball that has somehow ended up somewhere nobody can reach.
  if (ball.resting) ball.restT = (ball.restT ?? 0) + dt;

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

  // --- Air drag while airborne, and the wind ---
  const cond = scenario.conditions;
  if (ball.z > 0.02) {
    const k = Math.max(0, 1 - AIR_DRAG * (cond?.drag ?? 1) * dt);
    ball.vel.x *= k;
    ball.vel.y *= k;
    // Wind only touches a ball that is off the ground, which is why a driven
    // shot is unaffected and a chip is at its mercy.
    if (cond?.wind) ball.vel.x += cond.wind * dt;
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
      // A wet pitch skids and a heavy one deadens, both through this one number.
      ball.vz = -ball.vz * BOUNCE_VZ * (cond?.bounce ?? 1) * (1 - top * BOUNCE_TOPSPIN_VZ);
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
    const drop = GROUND_FRICTION * (cond?.friction ?? 1) * dt;
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

  // --- A defender gets to it ---
  //
  // Blocking a shot, cutting out a pass, or simply arriving at a loose ball
  // first: possession is gone either way, and he boots it clear. He reaches from
  // his feet to head height, raised by however far off the ground he is — only a
  // free-kick wall ever leaves the turf.
  //
  // This replaced a damped deflection that left the ball live, which turned
  // every block into a scramble the attack usually still won.
  if (ball.contactCd <= 0) {
    for (const d of scenario.defenders) {
      const foot = d.z ?? 0;
      const top = d.baseRole === "hold"
        ? Math.min(foot + DEF_BLOCK_H, WALL_TOP)
        : foot + DEF_BLOCK_H;
      if (ball.z < foot || ball.z > top) continue;
      // Right on top of a ball travelling at pace; merely near a slow one.
      const reach = speed > 12 ? DEF_BLOCK_R : CONTROL_R;
      if (Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y) < reach) {
        // A defender in the way of a ball going in has BLOCKED it; a defender
        // in the way of anything else has cut it out. Both cost you the ball and
        // always did — but the game reported them identically, so a shot charged
        // down on the line and a pass read and intercepted in midfield produced
        // the same three words. It is the same distinction the commentary has
        // always drawn and never been given the outcome to draw it with.
        const wasGoingIn = headedForGoal(ball, scenario);
        clearBall(ball, rng, scenario);
        ball.contactCd = 0.4;
        return wasGoingIn ? "blocked" : "tackled";
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
        ball.lastTouch = "defence";
        ball.settling = true;   // let the last metre of it be seen
        // Losing a 50-50 on a ball that is already loose is not a tackle and
        // never was one — nobody took anything off you. It is the scramble
        // going the other way, and the outcome that reads "Scrambled clear" is
        // the one that describes it. Calling it DISPOSSESSED put the blame for
        // a keeper's parry on your last touch.
        return "short";
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
  // ── …and not on the same tick somebody struck it ──
  //
  // Every other contact test in this function respects contactCd; reception did
  // not, and it is the one place it mattered most. A team-mate who shoots is
  // standing ON the ball he has just hit, so on the very next frame he was
  // inside his own two-metre control radius and collected it again — then
  // shot, then collected, then shot. A move either had no team-mate shot at all
  // or ran to the cap: 306 of 1200, and never one, two or three of them.
  if (!scenario.receiverDone && ball.z < 2.6 && ball.contactCd <= 0) {
    // Was this played TO him, or has he run it down? It changes what he does
    // with it when he gets there.
    const scrambled = ball.loose || ball.resting || speed < DEAD_BALL_SPEED;
    // ── Everybody in a blue shirt, including the man in the box ──
    //
    // He was drawn like a team-mate, stood where a team-mate stands and was the
    // obvious ball in half the chances in the game — and he was not on this
    // list, so a pass hit straight at his feet went through him and rolled away.
    // "I passed it into his feet and he let it run by": he was not allowed to
    // want it. His only job used to be poking in a loose ball in the six-yard
    // box, which is a poacher's job, not a whole player's.
    const poacher: Runner = {
      pos: { x: scenario.follower.x, y: scenario.follower.y },
      to: { x: scenario.follower.x, y: scenario.follower.y },
      // "support", so he steps out of the way of a ball that is going in — the
      // same protection every other team-mate gets. He is on the line-of-the-
      // ball check in isDriveAtGoal too, so a ball aimed AT him is still read as
      // a pass and he takes it.
      speed: RUNNER_SPEED, moving: false, role: "support",
      offside: scenario.follower.offside,
      // He is somebody too. A tap-in off a parry is still a goal for the man
      // who put it away.
      who: scenario.follower.who,
    };
    const candidates: Runner[] = scenario.runner
      ? [scenario.runner, ...scenario.secondaryRunners]
      : [...scenario.secondaryRunners];
    if (goalInView(scenario.kind) && !scenario.follower.shot) candidates.push(poacher);
    // A support player will not put his foot on a ball that is going in. He
    // steps out of the way of it, which is the only reason it is safe to have
    // team-mates standing in front of goal at all.
    // …but only while it is still going somewhere. Once a shot has died on the
    // grass there is nothing left to steal, and somebody has to be able to pick
    // it up or the move never ends.
    const ballIsDead = ball.resting || (speed < DEAD_BALL_SPEED && ball.z < 0.4);
    const shotAtGoal = ball.shot === true && !ballIsDead;
    for (const r of candidates) {
      const tgt = r.pos;
      let swept = Math.hypot(tgt.x - ball.pos.x, tgt.y - ball.pos.y);
      const segX = ball.pos.x - prevX, segY = ball.pos.y - prevY;
      const segLen2 = segX * segX + segY * segY;
      if (segLen2 > 0.01) {
        const t = clamp(((tgt.x - prevX) * segX + (tgt.y - prevY) * segY) / segLen2, 0, 1);
        const closestX = prevX + segX * t, closestY = prevY + segY * t;
        swept = Math.min(swept, Math.hypot(tgt.x - closestX, tgt.y - closestY));
      }
      // A support player steps out of the way of a ball that is going in — but
      // only out of the way. He does not become intangible: a ball that would
      // pass through his body is a ball he has, whatever it was aimed at. "If
      // the ball goes anywhere within my player, he should have the ball."
      if (shotAtGoal && r.role === "support" && swept > BODY_R) continue;

      if (swept < PASS_CONTROL_R) {
        // Position plus involvement. He was beyond the second-last opponent
        // when the ball was played and he has now played it.
        if (offsideOffence(scenario, r.offside)) return "offside";
        scenario.receiverDone = true;
        scenario.receiverReached = true;
        // Whoever it reached is who is about to shoot. Rolled at kick-off it
        // could only ever be a role, because until the ball is played there is
        // no telling which of the men in front of you it finds.
        if (scenario.receiver && r.who) scenario.receiver.who = r.who;
        scenario.receivedAt = { x: tgt.x, y: tgt.y };
        // The ball is somewhere else now, and the keeper has the beat before it
        // is struck to do something about it. See Keeper.adjusting.
        if (goalInView(scenario.kind) && !scenario.keeper.done) {
          const gcx = (scenario.goal.x1 + scenario.goal.x2) / 2;
          scenario.keeper.targetX = clamp(gcx + (tgt.x - gcx) * KEEPER_SHADE, POST_L - 0.6, POST_R + 0.6);
          scenario.keeper.adjusting = true;
        }
        r.moving = false;
        ball.lastTouch = "attack";
        // How difficult was that ball? Forward + long = harder, and a harder ball
        // won back is likelier to come straight back to you.
        const passLen = Math.hypot(tgt.x - scenario.ball.x, tgt.y - scenario.ball.y);
        const forward = scenario.ball.y - tgt.y;
        scenario.passDifficulty = clamp(forward / 25 + passLen / 45, 0, 1);
        // …and whether it was the brave one. Full marks for the furthest forward
        // man in the picture, nothing for a ball that went sideways or back —
        // and nothing at all if he was eight metres short of the man who was on.
        scenario.passAmbition = forward > 2 && scenario.forwardMostY !== undefined
          ? clamp(1 - (tgt.y - scenario.forwardMostY) / 8, 0, 1)
          : 0;

        // ── No offside ──
        //
        // It is switched off, deliberately and completely. A scenario carries
        // one or two defenders rather than a back four, so there is no real
        // offside line to judge anything against — the flag went up on men who
        // were plainly onside and stayed down on men who were plainly not, and
        // a rule that fires at random is worse than no rule. `offsideRisk` is
        // computed and ignored; when there is a defensive line worth the name,
        // this is where it goes back in.

        // ── If he has it and there is a goal, he shoots ──
        //
        // The cap is a runaway guard and nothing more. It used to be two, which
        // is not a runaway — it is a normal goalmouth scramble, and it bit
        // often: your shot, parried, collected, shot, parried, collected, shot,
        // parried, collected, and then a team-mate stood on the ball six yards
        // out and the highlight ended saying PASS. It says four now, which no
        // real scramble reaches.
        if (scenario.receiver && (scenario.receiverShots ?? 0) < SCRAMBLE_MAX) {
          ball.pos = { x: tgt.x, y: tgt.y };
          ball.vel = { x: 0, y: 0 }; ball.vz = 0; ball.z = 0.08; ball.spin = 0;
          // ── A ball you chase down is hit first time ──
          //
          // The touch to control it belongs to a pass played INTO him, in
          // stride, and it is worth the beat. A ball that has come loose and
          // been run down is not that: he arrives at it with defenders closing,
          // and standing over it for half a second while they get there is not a
          // decision anybody would take. It looked like a bug, because it was
          // one — the pause was written for the other case and applied to both.
          if (scrambled) {
            launchReceiverShot(ball, scenario, rng);
          } else {
            ball.receiverControlT = RECEIVER_CONTROL_T;
            ball.event = "received";
          }
          return null;
        }
        // Nobody left to shoot: the move has petered out in the six-yard box,
        // and that is a scramble ending, not a pass you completed. Saying
        // "delivered" credited you with a pass you never played and put PASS on
        // the screen at the end of a shot.
        if (scenario.receiver) return "short";
        return "delivered";
      }
    }
  }

  // ── THE KEEPER'S OWN LINE ──
  //
  // A save is judged where the KEEPER is, not at the goal line. He is usually on
  // it, so most of the time these are the same test — but about one chance in
  // five he has come out, and then they are not remotely the same. Judging at
  // the goal line meant a keeper standing five metres off it could save a ball
  // that had sailed past him three metres wide: it flew visibly beyond him, and
  // was then compared against his x once it reached a line he was nowhere near.
  //
  // He is a man standing somewhere with arms of a certain length. The ball
  // either comes within reach of him as it passes him, or it does not, and if it
  // does not he has been beaten and nothing later can change that.
  if (!k.done && prevY > k.y && ball.pos.y <= k.y && ball.pos.y > -0.6) {
    const f = (prevY - k.y) / (prevY - ball.pos.y || 1);
    const xAt = prevX + (ball.pos.x - prevX) * f;
    const zAt = prevZ + (ball.z - prevZ) * f;
    const cover = keeperCovers(scenario, xAt, zAt);
    if (cover.saved) {
      k.saveDir = Math.sign(xAt - k.x) || 0;
      k.saveLunge = 0.001;
      k.scrambling = false;
      ball.pos.x = xAt;
      ball.pos.y = Math.max(k.y, 0.02);
      ball.z = Math.max(0, zAt);
      const r = keeperSaveRadius(scenario);
      const standingAt = k.x;
      // He dives to it. The decision was made against where he was standing;
      // this is only the picture agreeing with it.
      k.x = clamp(xAt, POST_L - 2.5, POST_R + 2.5);
      const outcome = resolveKeeper(ball, scenario, (1 - cover.margin) * r, r, speed, rng);
      k.saveKind = classifySave(xAt, zAt, standingAt, cover.margin, outcome);
      if (outcome) return outcome;
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
      if (zCross > crossbar - BALL_R) {
        // Off the underside of the bar. It comes back down and stays live.
        const again = reboundOffFrame(ball, xCross, rng, scenario);
        if (again) { ball.z = Math.max(0.2, crossbar - 0.35); ball.vz = -Math.abs(ball.vz) * 0.5 - 1.5; return null; }
        return "post";
      }

      // The keeper has already had his say — at his own line, not this one.
      // See "THE KEEPER'S OWN LINE" above. If the ball is still going when it
      // gets here, he has been beaten.

      // Beat the keeper and crossed the line. Let it carry on into the netting so
      // the goal is SEEN rather than announced — the UI keeps stepping it while
      // the net slows it down.
      ball.inNet = true;
      ball.vel.x *= 0.55; ball.vel.y *= 0.55; ball.vz = Math.min(ball.vz, 0);
      return ball.loose ? "rebound" : "goal";
    }
    if (hitsPost(xCross)) {
      const again = reboundOffFrame(ball, xCross, rng, scenario);
      if (again) return null;
      return "post";
    }
    return "wide";
  }

  // ── Out ──
  //
  // Out of the FRAME, not out of the pitch. There is no pitch outside the frame
  // — nothing out there is drawn, nothing out there can be reached, and the
  // camera will never go and look. A ball that leaves is gone, and the move is
  // over the moment it does. It used to keep rolling around out of sight with
  // every player on the field jogging off the screen after it.
  const vp = scenario.viewport;
  if (vp && (ball.pos.x < vp.x1 - 1 || ball.pos.x > vp.x2 + 1
             || ball.pos.y > vp.y2 + 1 || ball.pos.y < vp.y1 - 1)) return "out";
  if (ball.pos.x < -2 || ball.pos.x > PITCH_W + 2 || ball.pos.y > HALF_LEN + 8) return "out";

  // Once there is genuinely nobody left whose turn it is, the move is over and
  // sitting on the ball is dead air. While somebody can still collect it, the
  // ordinary timeout stands as a backstop for a ball nobody can reach.
  if (ball.resting) {
    const settled = scenario.receiverDone || (scenario.receiverShots ?? 0) >= 2;
    const limit = settled ? DEAD_BALL_SETTLED : DEAD_BALL_TIMEOUT;
    if ((ball.restT ?? 0) > limit) return "short";
  }
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
  // A defender reading a ball you played to somebody. Distinct from `blocked`,
  // which is a defender in the way of one you played at the goal.
  tackled: { text: "Intercepted!", kind: "miss" },
};
