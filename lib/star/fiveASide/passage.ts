import {
  type Scenario, type ScenarioKind, type Defender, type Keeper, type Follower,
  type Runner, type Identity, type Vec2, goalInView,
} from "../canvasEngine";
import { POST_L, POST_R, CX } from "../pitch";
import {
  FIVE_PITCH, FIVE_VIEW, FIVE_HALFWAY_Y, KICK_FLOOR_Y, clampToPitch, insideFivePitch,
  FIVE_GOAL, FIVE_CROSSBAR,
} from "./geometry";

/**
 * ONE TOUCH OF YOURS, AS THE ENGINE SEES IT.
 *
 * The match engine has no idea what a five-a-side is, and it is never going to
 * be told. What it understands is a `Scenario` — a picture of a moment, with a
 * ball, you, some team-mates, some opponents and a keeper — which it will then
 * simulate honestly when you strike the ball. This file builds one of those
 * pictures out of where the ten players currently are, so the engine can play
 * out your touch and hand back what happened.
 *
 * ── Why this does not call `buildScenario` ──
 *
 * `buildScenario` is the engine's own picture-maker, and it is wrong for us for
 * one specific reason: it INVENTS the picture. It rolls its own positions, its
 * own camera and its own cast every time. That is exactly right for a match,
 * where each chance is a new moment, and exactly wrong for a five-a-side, where
 * the whole point is that the ten players are still standing where they were a
 * second ago. Using it would produce the "run of unrelated chances" that was
 * explicitly rejected — and the same mistake has already been made once in this
 * codebase, when Touch Mode chained into a rebuilt scenario and was reported as
 * "IT ACTUALLY LITERALLY GIVES ME A NEW CHANCE! LIKE IN A DIFFERENT SITUATION
 * AND POSITION AND EVERYTHING!"
 *
 * So we build the literal ourselves. The cost of that is the subject of the
 * next note.
 *
 * ── The three rules `buildScenario` enforces privately ──
 *
 * Because we build our own, we do not inherit the placement rules it applies on
 * the way out, and every one of them exists for a real reason:
 *
 *   1. Nobody stands within `CLEAR_OF_BALL` of the ball. A defender on top of
 *      it is a tackle before you have kicked anything.
 *   2. The keeper stands off the ball and stays near his goal.
 *   3. You stand BESIDE the ball, not on it — the figure has to be somewhere,
 *      and on top of the ball it hides it.
 *
 * Those constants are private to the engine, so they are restated here. That is
 * a real (if small) risk of drift, and it is stated rather than hidden: the
 * tests assert the resulting picture obeys the rules, which catches us breaking
 * them, but could not catch the engine changing its own numbers underneath us.
 */

/** Restated from the engine, which keeps them private. See the note above. */
const CLEAR_OF_BALL = 1.8;
/**
 * How far YOUR OWN men stand off the ball, which is further.
 *
 * The engine's spacing rule (1.8 m) is narrower than its own pass-control
 * radius (`PASS_CONTROL_R = 2.0`), so a team-mate placed at exactly the legal
 * minimum is already inside the distance at which he controls a ball played
 * anywhere near him. Measured: 35 passages in 1,400 resolved as "delivered"
 * on the very first step — your own man swallowing the kick before the ball
 * had travelled at all.
 *
 * That is not wrong, exactly — a two-metre pass is a real pass — but it means
 * a strike that never gets to be a strike, which on screen reads as the kick
 * not having happened. Pushing your own men just outside control range keeps
 * every short pass available without any of them eating the ball off your toe.
 * Opponents stay at the engine's own 1.8, because a defender that close SHOULD
 * be able to take it off you.
 */
const MATE_CLEAR_OF_BALL = 2.2;
const KEEPER_BODY_R = 0.75;
const KEEPER_CLEAR_OF_BALL = KEEPER_BODY_R + 1.6;   // 2.35
const STANDOFF_SIDE = 1.3;
const RUNNER_SPEED = 7.0;

/** Where all ten players and the ball actually are. The thing that persists
 *  between touches, and the reason nobody teleports. */
export interface FiveWorld {
  ball: Vec2;
  you: Vec2;
  /** Your three outfield team-mates. */
  mates: [Vec2, Vec2, Vec2];
  yourKeeper: Vec2;
  /** Their four outfield players. */
  opps: [Vec2, Vec2, Vec2, Vec2];
  theirKeeper: Vec2;
}

/** Who everybody is. Optional throughout, exactly as the engine treats
 *  identity — without one, every figure falls back to its role label. */
export interface FiveCast {
  you?: Identity;
  mates: (Identity | undefined)[];
  yourKeeper?: Identity;
  opps: (Identity | undefined)[];
  theirKeeper?: Identity;
}

export interface PassageOpts {
  kind?: ScenarioKind;
  cast?: FiveCast;
  /** 0-100, how good their keeper is. The one number that decides how well he
   *  actually keeps — see Scenario.keeperStrength. */
  keeperStrength: number;
  /** 0-100, how well your side combines. Feeds a team-mate's shot quality. */
  teamRelationship?: number;
  rng: () => number;
}

/**
 * Which kind of moment this is, from where the ball is.
 *
 * This matters more than it looks, because ONE engine rule keys off it: if the
 * goal is in view, whoever you pass to will shoot. That is right in the last
 * third — a square ball there is a lay-off and your man hits it — and wrong in
 * your own half, where a pass should just be a pass and the move continues.
 *
 * So the pitch is split at halfway, the same way the big match's own hidden
 * simulation splits it by zone.
 */
export function kindForBall(ball: Vec2): ScenarioKind {
  if (ball.y > FIVE_HALFWAY_Y) return "midfield_pass";
  if (ball.y > 12) return "buildup";
  // In the last third, how central you are decides what the moment is.
  const offCentre = Math.abs(ball.x - CX);
  if (offCentre > 8) return "tight_angle";
  return "one_on_one";
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Push a man far enough off the ball to satisfy the engine's own spacing,
 * keeping him as close as possible to where he really was.
 *
 * Deliberately a nudge along the line he already stands on rather than a
 * re-placement: he has a real position in the world, and moving him somewhere
 * else to satisfy a rule would be the teleport this whole design exists to
 * avoid. The tests cap how far anybody may be moved.
 */
function nudgeClear(p: Vec2, ball: Vec2, minR: number, rng: () => number): Vec2 {
  const d = dist(p, ball);
  if (d >= minR) return p;

  // ── Why this sweeps rather than pushing straight out ──
  //
  // The obvious version — push him along the line away from the ball, then
  // clamp him back onto the pitch — is wrong, and its own test caught it:
  // when the ball is near a touchline the push sends him OFF the pitch, and
  // the clamp then drags him straight back inside the radius he was just
  // moved out of. The result is a defender standing on the ball, which the
  // engine resolves as a tackle on the first step, before the kick has gone
  // anywhere. That was 34 passages in 1,400 ending instantly.
  //
  // So: try his own direction first, then sweep around the ball for the
  // nearest angle that is both clear of the ball AND actually on the pitch.
  // He ends up at the closest legal spot to where he really was, which is the
  // whole point — a man who has been shifted two metres is still that man,
  // and one who has been teleported across the pitch is not.
  const own = d < 1e-6 ? rng() * Math.PI * 2 : Math.atan2(p.y - ball.y, p.x - ball.x);
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) {
    // Alternate either side of his own bearing, widening — so the first angle
    // that works is the smallest possible turn from where he was.
    const off = Math.ceil(i / 2) * (Math.PI * 2 / STEPS) * (i % 2 === 0 ? 1 : -1);
    const ang = own + off;
    const cand = { x: ball.x + Math.cos(ang) * minR, y: ball.y + Math.sin(ang) * minR };
    if (insideFivePitch(cand)) return cand;
  }
  // The ball is in a corner tight enough that no point at this radius is on
  // the pitch. Standing clear of the ball matters more than standing on the
  // grass — the engine's spacing rule is what decides whether this passage is
  // playable at all, and the frame is wider than the pitch anyway.
  return { x: ball.x + Math.cos(own) * minR, y: ball.y + Math.sin(own) * minR };
}

/** The engine's keeper, standing where our world says, within the limits it
 *  applies to its own. */
function keeperFrom(pos: Vec2, ball: Vec2, rng: () => number, who?: Identity): Keeper {
  // Clamp him to his goal FIRST, then push him clear of the ball — the other
  // way round, the clamp undoes the push and he ends up stood on it. Same bug
  // as nudgeClear's own note, in a second place.
  const penned = {
    x: Math.max(POST_L - 2.5, Math.min(POST_R + 2.5, pos.x)),
    y: Math.max(0.3, Math.min(6, pos.y)),
  };
  const clear = nudgeClear(penned, ball, KEEPER_CLEAR_OF_BALL, rng);
  // Re-apply the goal limits only where doing so cannot put him back on the
  // ball: a keeper genuinely does come a long way out for a ball at his feet.
  const kx = dist({ x: Math.max(POST_L - 2.5, Math.min(POST_R + 2.5, clear.x)), y: clear.y }, ball) >= KEEPER_CLEAR_OF_BALL
    ? Math.max(POST_L - 2.5, Math.min(POST_R + 2.5, clear.x))
    : clear.x;
  const ky = clear.y;
  const r = rng();
  return {
    x: kx, y: ky, startX: kx, targetX: kx,
    dive: 0, saves: 0, done: false, flash: 0,
    patrolT: r * 4, patrolSeed: r * Math.PI * 2,
    scrambling: false, adjusting: false,
    saveLunge: 0, saveDir: 0, saveKind: null,
    idleT: r * 3, pendingDone: false,
    who,
  };
}

function runnerAt(pos: Vec2, who?: Identity): Runner {
  return {
    pos: { x: pos.x, y: pos.y },
    // Running onto the space in front of him, toward the goal being attacked.
    to: clampToPitch({ x: pos.x, y: Math.max(1.5, pos.y - 6) }),
    speed: RUNNER_SPEED, moving: false, role: "support", sprint: false, who,
  };
}

function followerAt(pos: Vec2, who?: Identity): Follower {
  return { x: pos.x, y: pos.y, active: false, shot: false, who };
}

/**
 * Build the engine's picture of this touch.
 *
 * Everything about it comes from `world` — nothing is invented, nothing is
 * re-rolled, and the only movement applied is the minimum needed to satisfy the
 * engine's own spacing rules.
 */
export function buildPassage(world: FiveWorld, opts: PassageOpts): Scenario {
  const { rng, keeperStrength, cast } = opts;
  const kind = opts.kind ?? kindForBall(world.ball);

  // The ball may not sit in the bottom fifth of the frame, or there is no room
  // to drag back and aim. See KICK_FLOOR_Y.
  const ball: Vec2 = { x: world.ball.x, y: Math.min(world.ball.y, KICK_FLOOR_Y) };

  // You stand beside the ball. Toward the middle of the pitch if you are wide,
  // so the figure never ends up drawn off the edge of the frame.
  const sideSign = world.you.x >= ball.x ? 1 : -1;
  const towardMiddle = ball.x > CX ? -1 : 1;
  const sx = ball.x + (Math.abs(ball.x - CX) > 9 ? towardMiddle : sideSign) * STANDOFF_SIDE;
  const player: Vec2 = { x: sx, y: ball.y };

  const mates = world.mates.map(m => nudgeClear(m, ball, MATE_CLEAR_OF_BALL, rng)) as [Vec2, Vec2, Vec2];
  const opps = world.opps.map(o => nudgeClear(o, ball, CLEAR_OF_BALL, rng)) as [Vec2, Vec2, Vec2, Vec2];

  const defenders: Defender[] = opps.map((o, i) => ({
    x: o.x, y: o.y, homeX: o.x, homeY: o.y, who: cast?.opps?.[i],
  }));

  // ── Where your three outfield men go, and why it depends on the kind ──
  //
  // The obvious cast — two pass options plus the engine's `follower` as the
  // man nearest goal, who also pounces on rebounds — is right in the final
  // third and QUIETLY WRONG everywhere else, because the engine gates the
  // follower on `goalInView(kind)` in three separate places: he is not a pass
  // candidate (canvasEngine.ts:5505), he is not clamped into the frame
  // (:1286), and `headedForGoal` ignores him (:4816). None of that applies to
  // a `midfield_pass` or a `buildup` — which, on a 36 m pitch split at
  // halfway, is roughly half of all play.
  //
  // Cast naively, then, half the five-a-side would silently be FOUR v five:
  // one of your men unable to receive a ball, drifting out of frame, and doing
  // nothing at all. Caught in review before it shipped.
  //
  // So the follower is only used where the engine genuinely treats him as a
  // man: in the final third he is your furthest-forward player, a real pass
  // option and the rebound poacher. In your own half all three are runners,
  // and the follower is left as a shadow of the same man that the engine will
  // ignore for every purpose — which is exactly what it does with it anyway.
  const order = [0, 1, 2].sort((a, b) => mates[a].y - mates[b].y);
  const poacherIdx = order[0];
  const goalIsInView = goalInView(kind);
  const runnerIdx = goalIsInView ? order.slice(1) : [0, 1, 2];

  const secondaryRunners: Runner[] = runnerIdx.map(i => runnerAt(mates[i], cast?.mates?.[i]));
  const follower = followerAt(mates[poacherIdx], cast?.mates?.[poacherIdx]);

  return {
    ball,
    player,
    defenders,
    keeper: keeperFrom(world.theirKeeper, ball, rng, cast?.theirKeeper),
    keeperStrength,
    follower,
    // A real small-sided goal. See FIVE_GOAL's own note for why it is this
    // size, and why setting it needed nothing added to the engine.
    goal: { ...FIVE_GOAL },
    crossbar: FIVE_CROSSBAR,
    kind,
    // Your own keeper is drawn and is genuinely somebody, but is never a pass
    // target — `teammates` is the engine's decorative list. Deliberately NOT
    // cast through the engine's own `castScenario`, which treats `teammates[0]`
    // as the crosser and would hand your goalkeeper credit for your assists.
    teammates: [{ x: world.yourKeeper.x, y: world.yourKeeper.y, who: cast?.yourKeeper }],
    runner: null,
    passTarget: null,
    receiver: null,
    receiverDone: false,
    teamRelationship: opts.teamRelationship ?? 55,
    viewport: { ...FIVE_VIEW },
    secondaryRunners,
    passDifficulty: 0,
    // ── Set by hand because only `buildScenario` normally sets it ──
    //
    // `forwardMostY` is how far forward the most advanced option was, and the
    // engine reads it at reception to work out `passAmbition`: WAS THAT THE
    // AMBITIOUS BALL, of the balls that were on? Left undefined, that term is
    // pinned to zero forever — and the five-a-side's own scoring reads it, so
    // half the signal for "how good was that pass" would have been silently
    // dead. Also caught in review rather than by playing it, which is exactly
    // the kind of thing that would never have shown up on screen.
    forwardMostY: secondaryRunners.length
      ? Math.min(...secondaryRunners.map(r => r.pos.y))
      : undefined,
    // One touch is one passage. The engine's own chain budget is for stringing
    // passes together inside a single move and has nothing to say here — the
    // clock is what ends a five-a-side, not a link counter.
    chainDepth: 0,
  };
}

/**
 * Read the world back out of a scenario the engine has just finished with.
 *
 * This is the other half of "nobody teleports": everybody moved during the
 * passage — defenders pressed, team-mates made their runs, the keeper came off
 * his line — and where they ended up is where they start the next one.
 */
export function worldFromScenario(sc: Scenario, ballAt: Vec2, prev: FiveWorld): FiveWorld {
  const supports = sc.secondaryRunners.map(r => ({ x: r.pos.x, y: r.pos.y }));
  const poacher = { x: sc.follower.x, y: sc.follower.y };
  // Put the three back in their original slots, so a given team-mate stays the
  // same person from touch to touch rather than being re-sorted each time.
  const mates = [...prev.mates] as [Vec2, Vec2, Vec2];
  const order = [0, 1, 2].sort((a, b) => prev.mates[a].y - prev.mates[b].y);
  mates[order[0]] = poacher;
  order.slice(1).forEach((slot, i) => { if (supports[i]) mates[slot] = supports[i]; });

  return {
    ball: clampToPitch(ballAt),
    you: { x: sc.player.x, y: sc.player.y },
    mates: mates.map(m => clampToPitch(m)) as [Vec2, Vec2, Vec2],
    yourKeeper: prev.yourKeeper,
    opps: sc.defenders.slice(0, 4).map(d => clampToPitch({ x: d.x, y: d.y })) as [Vec2, Vec2, Vec2, Vec2],
    theirKeeper: clampToPitch({ x: sc.keeper.x, y: sc.keeper.y }),
  };
}

/** A kick-off shape: your side spread in your own half, theirs in theirs. */
export function kickOffWorld(toYou: boolean): FiveWorld {
  const L = FIVE_PITCH.x1, W = FIVE_PITCH.x2 - FIVE_PITCH.x1;
  const at = (fx: number, y: number): Vec2 => ({ x: L + W * fx, y });
  return {
    ball: { x: CX, y: FIVE_HALFWAY_Y },
    you: toYou ? { x: CX - 1.3, y: FIVE_HALFWAY_Y } : at(0.5, 24),
    mates: [at(0.2, 22), at(0.8, 22), at(0.5, 14)],
    yourKeeper: { x: CX, y: 34 },
    opps: [at(0.2, 12), at(0.8, 12), at(0.35, 8), at(0.65, 8)],
    theirKeeper: { x: CX, y: 1.5 },
  };
}

/** Whether a team-mate you find will shoot rather than keep the move going —
 *  the one engine rule `kind` decides. Re-exported so the match layer can
 *  reason about it without importing the engine itself. */
export function passLeadsToShot(kind: ScenarioKind): boolean {
  return goalInView(kind);
}
