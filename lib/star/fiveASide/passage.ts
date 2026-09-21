import {
  type Scenario, type ScenarioKind, type Defender, type Keeper, type Follower,
  type Runner, type Identity, type Vec2, goalInView,
} from "../canvasEngine";
import { POST_L, POST_R, CX } from "../pitch";
import {
  FIVE_PITCH, FIVE_VIEW, FIVE_HALFWAY_Y, KICK_FLOOR_Y, clampToPitch, insideFivePitch,
  FIVE_GOAL, FIVE_CROSSBAR, FIVE_KEEPER_REACH, mirror,
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
/** How far off his line a keeper may be found. The real match's own builders
 *  put theirs at 1.10-1.22; this is that, with a little room. */
const KEEPER_MAX_OFF_LINE = 1.8;
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
 * WHICH OF YOUR THREE MEN ENDED UP IN WHICH ENGINE SLOT.
 *
 * Recorded when the picture is built, and read back when it is finished, so a
 * team-mate is the same person from touch to touch.
 *
 * ── Why this is recorded rather than worked out again ──
 *
 * The cast depends on the kind (see buildPassage): in the last third one of
 * your men is the engine's poacher and the other two are runners; in your own
 * half all three are runners. `worldFromScenario` used to re-derive that by
 * sorting the PREVIOUS world and assuming the last-third shape — which is
 * right half the time and silently wrong the other half, dropping one run
 * and writing two mates into each other's positions. Measured effect: about a
 * fourteen-metre lateral swap on a twenty-four-metre pitch, which is exactly
 * the teleporting this whole design exists to prevent, and the "nobody
 * teleports" test allowed thirty metres of movement so it could never see it.
 *
 * Caught in review. Held in a WeakMap rather than on the Scenario so nothing
 * is added to an engine type for a caller's bookkeeping.
 */
interface PassageSlots {
  /** Slot index in `FiveWorld.mates` for each entry of `secondaryRunners`. */
  runners: number[];
  /** Slot index for the follower, or null when he is not one of your three
   *  (which is every passage where the goal is not in view). */
  poacher: number | null;
}
const SLOTS = new WeakMap<Scenario, PassageSlots>();

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
  // ── How far off his line he may stand ──
  //
  // It was six metres, which sounds like nothing and is not. The engine judges
  // a save AT THE KEEPER'S OWN LINE (see "THE KEEPER'S OWN LINE",
  // canvasEngine.ts), so a keeper standing off it meets the ball before it has
  // diverged from the middle — which narrows the angle enormously, and on a
  // small-sided goal closes it outright.
  //
  // MEASURED: a real match's own `buildScenario` puts its keeper at y = 1.10
  // to 1.22 for every close-range chance it builds. This one was standing at
  // 2.2 to 6, and a corner-aimed one-on-one converted 21%. Brought onto his
  // line like the real thing, it converts at the rate the goal was sized for.
  // Clamped to HIS OWN goal, which on a small-sided pitch is not the
  // eleven-a-side one: POST_L/POST_R are ±3.66 m, so the old clamp let a
  // five-a-side keeper stand three metres outside his own post.
  const penned = {
    x: Math.max(FIVE_GOAL.x1 - 1.2, Math.min(FIVE_GOAL.x2 + 1.2, pos.x)),
    y: Math.max(0.3, Math.min(KEEPER_MAX_OFF_LINE, pos.y)),
  };
  const clear = nudgeClear(penned, ball, KEEPER_CLEAR_OF_BALL, rng);
  // Re-apply the goal limits only where doing so cannot put him back on the
  // ball: a keeper genuinely does come a long way out for a ball at his feet.
  const pen = (x: number) => Math.max(FIVE_GOAL.x1 - 1.2, Math.min(FIVE_GOAL.x2 + 1.2, x));
  const kx = dist({ x: pen(clear.x), y: clear.y }, ball) >= KEEPER_CLEAR_OF_BALL
    ? pen(clear.x)
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
  const slots: PassageSlots = {
    runners: runnerIdx,
    poacher: goalIsInView ? poacherIdx : null,
  };

  const scenario: Scenario = {
    ball,
    player,
    defenders,
    keeper: keeperFrom(world.theirKeeper, ball, rng, cast?.theirKeeper),
    keeperStrength,
    // A 5.2 m goal needs a keeper scaled to it, or the middle of the net is
    // dead. See FIVE_KEEPER_REACH for the measured before/after.
    keeperReach: FIVE_KEEPER_REACH,
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
  SLOTS.set(scenario, slots);
  return scenario;
}

/**
 * Read the world back out of a scenario the engine has just finished with.
 *
 * This is the other half of "nobody teleports": everybody moved during the
 * passage — defenders pressed, team-mates made their runs, the keeper came off
 * his line — and where they ended up is where they start the next one.
 */
export function worldFromScenario(sc: Scenario, ballAt: Vec2, prev: FiveWorld): FiveWorld {
  const mates = [...prev.mates] as [Vec2, Vec2, Vec2];
  // The mapping this exact picture was built with — see PassageSlots. Falling
  // back to leaving everybody where they were is the safe answer for a
  // scenario this file did not build: standing still is wrong, but it is far
  // less wrong than writing two men into each other's positions.
  const slots = SLOTS.get(sc);
  if (slots) {
    slots.runners.forEach((slot, i) => {
      const r = sc.secondaryRunners[i];
      if (r) mates[slot] = { x: r.pos.x, y: r.pos.y };
    });
    if (slots.poacher !== null) {
      mates[slots.poacher] = { x: sc.follower.x, y: sc.follower.y };
    }
  }

  return {
    ball: clampToPitch(ballAt),
    you: { x: sc.player.x, y: sc.player.y },
    mates: mates.map(m => clampToPitch(m)) as [Vec2, Vec2, Vec2],
    yourKeeper: prev.yourKeeper,
    opps: sc.defenders.slice(0, 4).map(d => clampToPitch({ x: d.x, y: d.y })) as [Vec2, Vec2, Vec2, Vec2],
    theirKeeper: clampToPitch({ x: sc.keeper.x, y: sc.keeper.y }),
  };
}

/**
 * A TEAM-MATE'S CHANCE, AS THE ENGINE SEES IT.
 *
 * The other half of "the CPUs play without your input": when the move finds a
 * team-mate near their goal rather than you (see `flow.ts`'s `stop: "mate"`),
 * this builds the picture of HIM taking it, played through the real engine so
 * you watch the shot rather than reading a caption.
 *
 * Unlike `buildTheirAttack` this needs no mirror: your side attacks `y = 0`,
 * which is the engine's own direction. The only real difference from
 * `buildPassage` is that the man on the ball is a TEAM-MATE (`sc.player`),
 * struck by the engine's own aim (`aimTheirShot`, which is generic — it aims at
 * `sc.goal` from `sc.ball`), and YOU are one of the supporting runners.
 */
interface MateSlots {
  /** Which of `world.mates` is on the ball (drawn as `sc.player`). */
  shooter: number;
  /** For each `secondaryRunners` entry: the support man's world slot — `-1` for
   *  you, else an index into `world.mates`. */
  runners: number[];
  /** The support man in the follower slot, same encoding, or null when the
   *  follower is a shadow the engine ignores (goal not in view). */
  poacher: number | null;
}
const MATE_SLOTS = new WeakMap<Scenario, MateSlots>();

export function buildMateAttack(world: FiveWorld, opts: PassageOpts): Scenario {
  const { rng, keeperStrength, cast } = opts;

  // The team-mate on the ball is the one nearest it — the flow has already
  // moved whoever the chance fell to onto the ball (see `yourMateChanceInSpace`).
  let shooter = 0;
  world.mates.forEach((m, i) => {
    if (Math.hypot(m.x - world.ball.x, m.y - world.ball.y)
      < Math.hypot(world.mates[shooter].x - world.ball.x, world.mates[shooter].y - world.ball.y)) shooter = i;
  });

  const ball: Vec2 = { x: world.ball.x, y: Math.min(world.ball.y, KICK_FLOOR_Y) };
  const kind = opts.kind ?? kindForBall(ball);

  // He stands beside the ball, toward the middle if he is wide, so his figure is
  // never drawn off the edge of the frame.
  const towardMiddle = ball.x > CX ? -1 : 1;
  const sideSign = world.mates[shooter].x >= ball.x ? 1 : -1;
  const sx = ball.x + (Math.abs(ball.x - CX) > 9 ? towardMiddle : sideSign) * STANDOFF_SIDE;
  const player: Vec2 = { x: sx, y: ball.y };

  // The three supporting men — YOU and the other two mates — with their world
  // slots recorded so `worldFromMateAttack` can read them back to the right
  // person. `-1` is you.
  const support: { slot: number; pos: Vec2 }[] = [
    { slot: -1, pos: world.you },
    ...world.mates.flatMap((m, i) => (i === shooter ? [] : [{ slot: i, pos: m }])),
  ];
  const supportPts = support.map(s => nudgeClear(s.pos, ball, MATE_CLEAR_OF_BALL, rng));
  const opps = world.opps.map(o => nudgeClear(o, ball, CLEAR_OF_BALL, rng)) as [Vec2, Vec2, Vec2, Vec2];

  const defenders: Defender[] = opps.map((o, i) => ({
    x: o.x, y: o.y, homeX: o.x, homeY: o.y, who: cast?.opps?.[i],
  }));

  // The follower is only a real man when the goal is in view — same gate as
  // `buildPassage`. In the last third he is the furthest-forward support man.
  const order = support.map((_, i) => i).sort((a, b) => supportPts[a].y - supportPts[b].y);
  const poacherOrderIdx = order[0];
  const goalIsInView = goalInView(kind);
  const runnerOrderIdxs = goalIsInView ? order.slice(1) : order;

  const idFor = (s: number) => (s === -1 ? cast?.you : cast?.mates?.[s]);
  const secondaryRunners: Runner[] = runnerOrderIdxs.map(oi => runnerAt(supportPts[oi], idFor(support[oi].slot)));
  const follower = followerAt(supportPts[poacherOrderIdx], idFor(support[poacherOrderIdx].slot));
  const slots: MateSlots = {
    shooter,
    runners: runnerOrderIdxs.map(oi => support[oi].slot),
    poacher: goalIsInView ? support[poacherOrderIdx].slot : null,
  };

  const scenario: Scenario = {
    ball,
    player,
    defenders,
    keeper: keeperFrom(world.theirKeeper, ball, rng, cast?.theirKeeper),
    keeperStrength,
    keeperReach: FIVE_KEEPER_REACH,
    follower,
    goal: { ...FIVE_GOAL },
    crossbar: FIVE_CROSSBAR,
    kind,
    // Your own keeper is decorative here, exactly as in `buildPassage`.
    teammates: [{ x: world.yourKeeper.x, y: world.yourKeeper.y, who: cast?.yourKeeper }],
    runner: null,
    passTarget: null,
    receiver: null,
    receiverDone: false,
    teamRelationship: opts.teamRelationship ?? 55,
    viewport: { ...FIVE_VIEW },
    secondaryRunners,
    passDifficulty: 0,
    forwardMostY: secondaryRunners.length
      ? Math.min(...secondaryRunners.map(r => r.pos.y))
      : undefined,
    chainDepth: 0,
  };
  MATE_SLOTS.set(scenario, slots);
  return scenario;
}

/**
 * Read the world back out of a team-mate's finished chance.
 *
 * The shooter goes back to his own slot in `world.mates`; the supporting men —
 * you and the other two mates — go back to whoever the slot map says they were.
 */
export function worldFromMateAttack(sc: Scenario, ballAt: Vec2, prev: FiveWorld): FiveWorld {
  const mates = [...prev.mates] as [Vec2, Vec2, Vec2];
  // Default everybody to where they were — the safe answer if the slot map is
  // ever missing, the same fallback `worldFromScenario` uses.
  let you = { ...prev.you };
  const slots = MATE_SLOTS.get(sc);
  if (slots) {
    mates[slots.shooter] = { x: sc.player.x, y: sc.player.y };
    const place = (slot: number, pos: Vec2) => {
      if (slot === -1) you = { x: pos.x, y: pos.y };
      else mates[slot] = { x: pos.x, y: pos.y };
    };
    slots.runners.forEach((slot, i) => {
      const r = sc.secondaryRunners[i];
      if (r) place(slot, r.pos);
    });
    if (slots.poacher !== null) place(slots.poacher, { x: sc.follower.x, y: sc.follower.y });
  }
  return {
    ball: clampToPitch(ballAt),
    you: clampToPitch(you),
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

/**
 * THEIR ATTACK, AS THE ENGINE SEES IT.
 *
 * ── Why this can exist without the engine learning there are two goals ──
 *
 * The engine knows exactly one direction: you attack `y = 0`. Teaching it a
 * second goal would be a rewrite of the thing every other match in the game
 * depends on. So their move is handed to it MIRRORED — `geometry.ts`'s
 * `mirror`, which is an involution and was written for precisely this — played
 * out by the real physics, and mirrored back for the screen. From the engine's
 * side it is an ordinary attack at an ordinary goal, and the keeper it has to
 * beat happens to be yours.
 *
 * This replaces a single fair dice roll: "their quality against your keeper's,
 * goal or no goal", which is what made two-nil down the single likeliest
 * scoreline and made a conceded goal a caption rather than something you
 * watched happen.
 *
 * What comes back is a real `Outcome`, from their point of view — see
 * `applyTheirAttack`.
 */
export function buildTheirAttack(world: FiveWorld, opts: PassageOpts): Scenario {
  const { rng, keeperStrength, cast } = opts;

  // ── The man on the ball is the man with the ball ──
  //
  // It used to pick their most advanced man instead, on the reasoning that he
  // is the one in on goal. Nearly always the same man — but not always, and
  // the exception is ugly: the flow puts the ball at its carrier's feet, so
  // when somebody else happened to be a yard further forward the chance was
  // built around HIM, twenty-two metres from goal, with the ball teleported to
  // him. Measured as a real outlier before it shipped. Reading the ball is both
  // simpler and exactly right.
  const order = [0, 1, 2, 3].sort((a, b) =>
    Math.hypot(world.opps[a].x - world.ball.x, world.opps[a].y - world.ball.y)
    - Math.hypot(world.opps[b].x - world.ball.x, world.opps[b].y - world.ball.y));
  const onBall = mirror(world.ball);
  const ball: Vec2 = { x: onBall.x, y: Math.min(Math.max(onBall.y, 1.2), KICK_FLOOR_Y) };

  const sideSign = ball.x >= CX ? -1 : 1;
  const player: Vec2 = { x: ball.x + sideSign * STANDOFF_SIDE, y: ball.y };

  const theirOthers = order.slice(1).map(i => nudgeClear(mirror(world.opps[i]), ball, MATE_CLEAR_OF_BALL, rng));
  const yours = world.mates.concat([world.you])
    .map(m => nudgeClear(mirror(m), ball, CLEAR_OF_BALL, rng));

  const defenders: Defender[] = yours.map(o => ({ x: o.x, y: o.y, homeX: o.x, homeY: o.y }));
  const kind = kindForBall(ball);
  const goalIsInView = goalInView(kind);

  const runnerPts = goalIsInView ? theirOthers.slice(1) : theirOthers;
  const secondaryRunners: Runner[] = runnerPts.map((p, i) => runnerAt(p, cast?.opps?.[order[i + 1]]));
  const follower = followerAt(theirOthers[0] ?? ball, cast?.opps?.[order[1]]);

  const scenario: Scenario = {
    ball,
    player,
    defenders,
    // YOUR keeper is the one being shot at. His own rating decides how well he
    // keeps, which is why a good keeper is worth having.
    keeper: keeperFrom(mirror(world.yourKeeper), ball, rng, cast?.yourKeeper),
    keeperStrength,
    // A 5.2 m goal needs a keeper scaled to it, or the middle of the net is
    // dead. See FIVE_KEEPER_REACH for the measured before/after.
    keeperReach: FIVE_KEEPER_REACH,
    follower,
    goal: { ...FIVE_GOAL },
    crossbar: FIVE_CROSSBAR,
    kind,
    teammates: [{ x: mirror(world.theirKeeper).x, y: mirror(world.theirKeeper).y, who: cast?.theirKeeper }],
    runner: null,
    passTarget: null,
    receiver: null,
    receiverDone: false,
    teamRelationship: opts.teamRelationship ?? 55,
    viewport: { ...FIVE_VIEW },
    secondaryRunners,
    passDifficulty: 0,
    forwardMostY: secondaryRunners.length
      ? Math.min(...secondaryRunners.map(r => r.pos.y))
      : undefined,
    chainDepth: 0,
  };
  return scenario;
}

/**
 * How they strike it.
 *
 * A real aim rather than a random one — they are trying to score, and a
 * better side finds the corner more often — but never a perfect one, which is
 * what leaves your keeper something to do. The numbers are the same shape the
 * measurement harnesses in tests/star/fiveASide.mts use for a competent
 * player's shot, because that is what this is.
 */
export function aimTheirShot(
  sc: Scenario, difficulty: number, rng: () => number,
): { dir: Vec2; power: number; contact: { cx: number; cy: number }; skills: { power: number; technique: number } } {
  const centre = (sc.goal.x1 + sc.goal.x2) / 2;
  const half = (sc.goal.x2 - sc.goal.x1) / 2;
  const side = rng() < 0.5 ? -1 : 1;
  // A better side aims nearer the post. A worse one drifts back toward the
  // middle, where the keeper is.
  const reach = Math.max(0.2, half - 0.35) * (0.35 + difficulty * 0.55 + rng() * 0.25);
  const spray = (1.6 - difficulty) * 1.1;
  const tx = centre + side * reach + (rng() - 0.5) * spray;
  const dist = Math.hypot(sc.ball.x - centre, sc.ball.y);
  return {
    dir: { x: tx - sc.ball.x, y: -Math.max(sc.ball.y, 1) },
    power: Math.min(1, 0.40 + dist / 42) * (0.85 + rng() * 0.3),
    contact: { cx: (rng() - 0.5) * 0.7, cy: -0.1 - rng() * 0.45 },
    skills: { power: 45 + difficulty * 45, technique: 45 + difficulty * 45 },
  };
}

/**
 * Read the world back out of one of THEIR attacks.
 *
 * The other half of `buildTheirAttack`: everybody moved during it — your
 * defenders closed, their runners ran, your keeper came out — and where they
 * ended up is where they start whatever happens next. Mirrored back on the way
 * out, because `mirror` is an involution and the engine only ever worked in
 * the turned-round picture.
 *
 * The slot mapping is positional and is fixed by `buildTheirAttack`:
 * `defenders` is your three mates and then you.
 */
export function worldFromTheirAttack(sc: Scenario, ballAt: Vec2, prev: FiveWorld): FiveWorld {
  const d = sc.defenders;
  const back = (p: Vec2) => clampToPitch(mirror(p));
  return {
    ball: back(ballAt),
    you: d[3] ? back({ x: d[3].x, y: d[3].y }) : prev.you,
    mates: [0, 1, 2].map(i =>
      d[i] ? back({ x: d[i].x, y: d[i].y }) : prev.mates[i]) as [Vec2, Vec2, Vec2],
    yourKeeper: back({ x: sc.keeper.x, y: sc.keeper.y }),
    // Their four: the man who struck it, then whoever the engine had running.
    opps: [
      back({ x: sc.ball.x, y: sc.ball.y }),
      back({ x: sc.follower.x, y: sc.follower.y }),
      ...([0, 1].map(i => {
        const r = sc.secondaryRunners[i];
        return r ? back({ x: r.pos.x, y: r.pos.y }) : prev.opps[i + 2];
      })),
    ].slice(0, 4) as [Vec2, Vec2, Vec2, Vec2],
    theirKeeper: prev.theirKeeper,
  };
}
