import type { Vec2 } from "../canvasEngine";
import type { MatchRules } from "./rules";
import { clampToPitch } from "./geometry";
import { clearOfBall, defensiveShape, laneClearance, type DefendRole } from "./shape";
import { attackingShape } from "./attack";
import type { FiveWorld } from "./passage";

/**
 * THE FOOTBALL YOU ARE NOT PLAYING.
 *
 * The verdict on the first version of this stage was "useless", and the
 * diagnosis with it was exact:
 *
 *   "The big issue is that the highlights are essentially you passing and then
 *    respawning wherever the ball ends up. The CPUs have to be able to play
 *    without your input."
 *
 * That is the real match's model, and the five-a-side had thrown half of it
 * away. `CanvasMatch` plays one touch and `hiddenMatch.ts` plays the other
 * eighty-nine minutes; the five-a-side kept the engine and replaced the hidden
 * match with a single dice roll per turnover. So nobody moved between your
 * touches, the ball only ever went where your last pass left it, and you
 * arrived at the next "chance" standing on top of it.
 *
 * Measured, before this file existed: 250 matches, a player doing the right
 * thing every time, 3,000 touches — and not one shot. The ball travelled from
 * y=18.0 to y=16.0 across a WHOLE MATCH, 0.17 m per touch, with 83% of touches
 * gaining under a metre. The goal you are attacking was never once on screen.
 *
 * ── What this is ──
 *
 * `hiddenMatch.ts`'s model, on a 24 x 36 m pitch. The same five-band ladder
 * (own box -> defensive -> middle -> attacking -> their box), the same
 * possession-and-momentum shape, the same "you are pulled in only for the ones
 * that actually find you". Its constants are copied across and then re-tuned
 * against this pitch rather than re-derived, because the thing being reused is
 * the SHAPE — a model that produces the same number of involvements a real
 * ninety minutes does, from football rather than from a timer.
 *
 * ── What it adds, that the big match's own version does not need ──
 *
 * Positions. `hiddenMatch` never has to say where anybody is: the moment it
 * calls you in, `buildScenario` invents a fresh picture. A five-a-side cannot
 * do that — the whole point is that the eight outfielders are still standing
 * where they were a second ago — so this moves all ten of them, every beat,
 * into the shape the band calls for. That is what you watch between touches,
 * and it is why you rejoin play somewhere play took you rather than on the
 * ball.
 *
 * Pure, and it returns its beats rather than storing them: a snapshot per beat
 * is what the screen animates, and none of it belongs in a save.
 */

export type Band = "own_box" | "defensive" | "middle" | "attacking" | "box";
export type FlowSide = "you" | "them";

/** Up the pitch, from your goal to theirs — same order as hiddenMatch's. */
export const BAND_ORDER: Band[] = ["own_box", "defensive", "middle", "attacking", "box"];

/** The two bands from which each side's chances come. Mirrored deliberately. */
const YOUR_DANGER: Band[] = ["attacking", "box"];
const THEIR_DANGER: Band[] = ["defensive", "own_box"];

export interface FiveFlowState {
  possession: FlowSide;
  band: Band;
  /** -1 they are on top, +1 you are. Not the same as possession. */
  momentum: number;
  /** Beats since you last had a touch — stops long dead spells. */
  sinceInvolved: number;
  /**
   * WHICH JOB EACH OF THE DEFENDING FOUR IS DOING — see shape.ts.
   *
   * In the defending side's own index order: their four when you have it,
   * `[you, mate0, mate1, mate2]` when they have it. Optional, because a match
   * saved before this existed has none, and a beat played without it just
   * assigns jobs from scratch exactly as it used to.
   *
   * It is the shape's OWN answer rather than a second opinion:
   * `defensiveShape` returns its four spots in role order, and a man's job is
   * whichever of them he took — so the position and the role cannot disagree.
   * Recorded so that what a man is doing is inspectable rather than implied by
   * where he is standing; nothing in the match reads it back yet.
   *
   * Cleared whenever the ball changes hands, because the four men with jobs
   * are then the other four and nobody inherits anybody's position. See the
   * note on `assignRoles` for the stickier version of this that was built,
   * measured, and rejected.
   */
  defendRoles?: DefendRole[];
}

export interface FlowInputs {
  /** 0-1, how good they are this match. */
  difficulty: number;
  /** 0-100, the average of your own striking skills. Better players see more
   *  of the ball — exactly as in the big match. */
  playerSkill: number;
}

export function newFlow(kickOffToYou: boolean): FiveFlowState {
  return {
    possession: kickOffToYou ? "you" : "them",
    band: "middle",
    momentum: 0,
    // Treated as though you had already been waiting, so your first touch of
    // the match comes early rather than after a minute of watching. The same
    // trick, and the same reason, as hiddenMatch's own `sinceInvolved: 14`.
    sinceInvolved: 8,
  };
}

// ── Tuned constants ─────────────────────────────────────────────────────────
// Copied from hiddenMatch.ts and then MEASURED against this pitch, not
// re-derived by eye. tests/star/fiveASideFlow.mts holds the bounds.

/** How much of the clock one beat of football costs. */
export const MINUTES_PER_BEAT = 0.5;

/** Chance per beat that the ball changes hands. */
const TURNOVER = 0.5;
/** How much team quality tilts who wins it. This is what buys possession. */
const TURNOVER_EDGE = 0.3;
/** Base chance the side in possession moves a band up the pitch. */
const DRIVE = 0.52;
/** ...and the chance they are pushed a band back instead. */
const RETREAT = 0.26;
/**
 * How much harder each band is to get into. Without this the pitch behaves
 * like an unweighted random walk and play spends as long in the six-yard box
 * as in midfield.
 */
const ENTRY: Record<Band, number> = {
  own_box: 0.4, defensive: 0.8, middle: 1, attacking: 0.8, box: 0.4,
};
/** Per-beat chance the side in possession works a real chance, by area. */
const CHANCE_DEEP = 0.26;
const CHANCE_BOX = 0.55;
/** Beats ignored by the match before you go looking for the ball yourself. */
const STARVED = 16;

/**
 * ── THE FLAT ROLL THIS REPLACED, AND THE NUMBER IT WAS CALIBRATED TO ──
 *
 * `involvement` was a single probability — a base, a skill term and a starve
 * bonus — with nothing in it about where anybody was standing, because until
 * this round nobody was standing anywhere in particular: all four of your men
 * were in the same metre-wide column in the middle of the pitch, so there was
 * nothing for a shape to decide between.
 *
 * Its base was measured rather than guessed, and the target it was measured
 * against still stands and is still pinned by tests/star/fiveASideFlow.mts:
 * what was asked for was the same highlight count as a full match — "let's
 * make it exactly the same as a 90 min game highlights wise but cut the game
 * down to 45 minutes" — and a real ninety minutes calls the player in 7.79
 * times on average (400 simulated matches through `hiddenMatch`, median 7,
 * p10 5, p90 11), or 7.23 for a player who SHOOTS every chance he gets.
 *
 * `chanceFindsYou` below replaces it and keeps that target: see its own note.
 */

/**
 * WHO THE CHANCE ACTUALLY FALLS TO — the shape decides, and the tie goes to
 * you.
 *
 * Asked for directly, and it is the whole of this half of the round:
 *
 *   "Shape decides, but bias to you. The attacking shape is real and a
 *    team-mate genuinely better placed can be the one the move finds — but
 *    when it is close, the tie goes to the player."
 *
 * So each of your four is scored where he actually stands — the room he has,
 * how much of the goal he can see from there, and how far up the pitch he is —
 * and how likely the ball is to find you follows from how you compare to the
 * best-placed of the other three. You carry `PLAYER_EDGE` on top, which is
 * what "the tie goes to the player" means as a number: a team-mate has to be
 * genuinely better placed, not merely equal, before it goes to him.
 *
 * Still a roll rather than a winner-takes-all, for a reason that is real: a
 * hard argmax makes the stage streaky, because the same man is best placed
 * several beats running, so you get everything or nothing.
 *
 * ── Retuned so team-mates genuinely shoot ──
 *
 * It was tuned to find you ~80% of the time, and paired with the fact that a
 * team-mate's chance was only ever a silent caption, that read exactly as the
 * bug reported: "teammates never shoot — every chance comes back to your feet."
 * `PLAYER_EDGE`/`FINDS_YOU_CEILING`/`FINDS_YOU_FLOOR` were brought down so a
 * team-mate genuinely better placed is now the man the move finds a real share
 * of the time — MEASURED, ~19-21% of your side's chances fall to a team-mate,
 * and (with the new `stop: "mate"` path) those near goal are played out and
 * watched rather than captioned. You are still the pivot the move looks for
 * most (~80%), and your own involvement count stays a real match's worth (~6.5,
 * against the ~7.8 a full ninety gives) — pinned by tests/star/fiveASideFlow.mts.
 * Pure realism — four men, one ball, nobody favoured — would be 25%.
 */
function chanceFindsYou(
  rules: MatchRules, w: FiveWorld, flow: FiveFlowState, inputs: FlowInputs,
): number {
  const placed = (p: Vec2): number => {
    let room = Infinity;
    for (const o of w.opps) room = Math.min(room, Math.hypot(o.x - p.x, o.y - p.y));
    const toGoal = Math.hypot(p.x - (rules.goal.x1 + rules.goal.x2) / 2, p.y - rules.pitch.y1);
    const sight = toGoal < SHOOTING_RANGE
      ? goalSight(p, rules, rules.pitch.y1, [...w.opps]) * SIGHT_WEIGHT
      : 0;
    // How far up the pitch he is. A man twenty metres from goal is not the man
    // the chance falls to, however much room he has.
    return Math.min(room, SPACE_ENOUGH) + sight - (p.y - rules.pitch.y1) * FORWARD_WEIGHT;
  };

  const you = placed(w.you) + PLAYER_EDGE + (inputs.playerSkill / 100) * SKILL_EDGE;
  let best = -Infinity;
  for (const m of w.mates) best = Math.max(best, placed(m));

  // ── …and the match is never allowed to forget you ──
  //
  // The same starve term the flat roll had, made into a real guarantee rather
  // than a nudge: it climbs from nothing at six beats to CERTAIN at `STARVED`,
  // which is eight minutes of football without a touch. A shape that decides
  // who gets the ball can strand a striker having a bad half, and this stage's
  // own tests pin that it must not — with the starve term left as the old
  // gentle nudge, a keep-ball player who never progresses the ball was
  // measured down to two touches in a whole match, against a floor of three.
  const starved = Math.max(0, flow.sinceInvolved - 6) / (STARVED - 6);
  if (starved >= 1) return 1;
  return Math.min(1, Math.max(
    FINDS_YOU_FLOOR,
    Math.min(FINDS_YOU_CEILING, 0.5 + (you - best) * FINDS_YOU_SLOPE),
  ) + starved * (1 - FINDS_YOU_FLOOR));
}

/** What "the tie goes to the player" is worth, in the units the score is
 *  measured in — metres of room. */
const PLAYER_EDGE = 0.6;
/** …and how much of that edge a better player earns for himself. Better
 *  players see more of the ball; the same idea the flat roll already had. */
const SKILL_EDGE = 1.2;
/** How steeply being better placed turns into getting the ball. */
const FINDS_YOU_SLOPE = 0.22;
/** It is never certain either way: a striker who has drifted into a bad spot
 *  still gets the odd one, and one standing in the perfect place still sees a
 *  team-mate take it. */
const FINDS_YOU_FLOOR = 0.18;
const FINDS_YOU_CEILING = 0.70;
/** How much a metre further from the goal costs a man, against a metre of
 *  room. */
const FORWARD_WEIGHT = 0.20;

/** How often a chance a TEAM-MATE takes ends in the net, by area. */
const MATE_CONVERT_DEEP = 0.09;
const MATE_CONVERT_BOX = 0.16;
/**
 * A flat conversion rate would mean nobody but you ever had a moment of real
 * quality. Same shape, and the same reason, as hiddenMatch's own.
 */
const QUALITY_CHANCE = 0.16;
const QUALITY_CONVERT = 0.36;
const convertRate = (base: number, rng: () => number) =>
  (rng() < QUALITY_CHANCE ? QUALITY_CONVERT : base);

const clamp1 = (n: number) => Math.max(-1, Math.min(1, n));
const shiftBand = (band: Band, by: number): Band => {
  const i = BAND_ORDER.indexOf(band);
  return BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, i + by))];
};

/** How far up the pitch a band sits, as a fraction of its length from the
 *  goal you are attacking. Read through the rules so the ladder is the shape
 *  of the pitch rather than four literals. */
const BAND_DEPTH: Record<Band, number> = {
  box: 0.12, attacking: 0.28, middle: 0.5, defensive: 0.72, own_box: 0.88,
};

/** The y the ball sits at in a given band. */
export function bandY(rules: MatchRules, band: Band): number {
  const { y1, y2 } = rules.pitch;
  return y1 + (y2 - y1) * BAND_DEPTH[band];
}

/** Which band a y belongs to — the inverse, for a ball the engine has just
 *  left somewhere. */
export function bandOf(rules: MatchRules, y: number): Band {
  let best: Band = "middle";
  let bestD = Infinity;
  for (const b of BAND_ORDER) {
    const d = Math.abs(bandY(rules, b) - y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

// ── Shape ───────────────────────────────────────────────────────────────────
//
// Where eight outfielders stand when the ball is where it is. Deliberately a
// SHAPE rather than a set of positions: everybody eases toward his slot a few
// metres a beat, so what you watch is a side moving up and dropping off rather
// than eight men snapping between two arrangements.

/** How far anybody may travel in one beat. A real sprint over a beat's worth
 *  of football, and a hard cap on the teleporting this whole layer exists to
 *  prevent. */
export const MAX_BEAT_MOVE = 5.5;

/**
 * How far you may run onto a pass that finds you.
 *
 * Deliberately longer than one ordinary beat's movement — a striker peeling
 * off a shoulder covers real ground in the seconds the ball is travelling —
 * and deliberately a HARD cap rather than a penalty, because the thing it is
 * preventing is a teleport, and a teleport you only pay a little for is still
 * a teleport.
 */
export const RECEIVE_RUN = 9;

/**
 * The furthest a keeper shades off centre to cover his near post.
 *
 * Measured against what it leaves open. On a 5.2 m goal (half-width 2.60 m)
 * with a save radius of 2.04 m, the keeper still leaves a real far-post gap to
 * aim at — the open post converts ~55% against the covered one's ~26% (MEASURED
 * over 500 real chances), so the far corner is very much a target — while
 * staying central enough to guard the middle himself.
 *
 * ── It was 1.2, and this is why it came down ──
 *
 * When the back four came off the goal line into a real diamond (see shape.ts),
 * the deepest man moved to ~4 m out and no longer sat in the deep central lane
 * — so a shot straight down the middle of a WIDE chance, which travels along
 * the ball side and only reaches the centre at the goal line, had nobody but
 * the keeper to beat. At a 1.2 m shade the keeper was too far toward the near
 * post to be that man, and the middle climbed to ~30% against the corner's
 * ~55% (ratio 1.8, below the 2× the placement guard demands). Bringing him to
 * 0.8 keeps him central enough to hold the middle himself — the job the
 * on-the-line heap used to do with defenders' bodies — and the middle dropped
 * back to ~24% (ratio ~2.3) with the far corner untouched at ~55%. That is the
 * lever that let the defence come off the line WITHOUT the middle becoming a
 * free shot: the keeper guards the centre, the diamond guards the space, and
 * the far corner stays the thing you aim for.
 */
const KEEPER_SHADE = 0.8;

/**
 * How close to your goal their chance has to be before it is worth stopping
 * the game to watch.
 *
 * Anything further out is rolled, exactly as a chance that falls to one of
 * your own team-mates is — both are moments you were not part of, and the ask
 * was specifically for the close ones: "if it's a close highlight or goal you
 * should watch it".
 */
const WATCHABLE_RANGE = 13;

/**
 * Where their chance would fall, worked out once and then asked about twice —
 * "is this worth stopping for" and, if it is, "put it there". Memoised on the
 * world it was computed from, because it consumes the seeded stream and
 * drawing from it twice would be two different chances.
 */
const CHANCE_CACHE = new WeakMap<FiveWorld, FiveWorld>();
function chance(rules: MatchRules, w: FiveWorld, flow: FiveFlowState, rng: () => number): FiveWorld {
  const had = CHANCE_CACHE.get(w);
  if (had) return had;
  const made = theirChanceInSpace(rules, w, flow, rng);
  CHANCE_CACHE.set(w, made);
  return made;
}

/**
 * Is that actually a chance?
 *
 * The band says the ball is in your box; whether their men have ACTUALLY got
 * there is a different question, because nobody covers more than
 * `MAX_BEAT_MOVE` in a beat and a counter can reach the band before the
 * players do. Measured as a real outlier before it shipped: a "chance in your
 * box" struck from 22 m out. Anything that far is a speculative effort, and is
 * rolled like one rather than stopping the game to watch it.
 */
function worthWatching(rules: MatchRules, w: FiveWorld): boolean {
  return w.ball.y >= rules.pitch.y2 - WATCHABLE_RANGE;
}

/** The same question for one of YOUR side's chances, at the other end: is the
 *  ball genuinely close to THEIR goal? A team-mate's speculative effort from
 *  distance is rolled, not watched — exactly as a distant chance of theirs is —
 *  so only a real chance near goal stops the game. */
function worthWatchingYours(rules: MatchRules, w: FiveWorld): boolean {
  return w.ball.y <= rules.pitch.y1 + WATCHABLE_RANGE;
}

/**
 * A TEAM-MATE's chance, worked into space near THEIR goal — the mirror of
 * `theirChanceInSpace`, and the thing you watch when the move finds a team-mate
 * rather than you. Memoised on the world so asking "is it worth watching" and
 * "put the ball there" are the same chance, not two draws from the stream.
 */
const MATE_CHANCE_CACHE = new WeakMap<FiveWorld, FiveWorld>();
function mateChance(rules: MatchRules, w: FiveWorld, flow: FiveFlowState, rng: () => number): FiveWorld {
  const had = MATE_CHANCE_CACHE.get(w);
  if (had) return had;
  const made = yourMateChanceInSpace(rules, w, flow, rng);
  MATE_CHANCE_CACHE.set(w, made);
  return made;
}

/**
 * How much room counts as "in space".
 *
 * A cap rather than a target, and the difference matters: without one, the
 * best receiving spot is always the emptiest corner of the band, so every
 * chance arrives completely unmarked and the stage is handing you the goal.
 *
 * MEASURED, over 250 matches with a player who aims perfectly inside the post
 * every time — the most generous shooter there is:
 *
 *   cap 7.0 m   73% of shots scored, 1.46 goals a match
 *   cap 5.5 m   65%,                 1.11
 *   cap 4.5 m   59%,                 0.93
 *
 * 5.5 is enough room to get your head up and strike it. It is also where the
 * scoreline stops having a favourite: 0-0, 1-0, 1-1, 2-0, 0-1 and 2-1 all land
 * between 8% and 16%, against the old model's 2-0 at 48%.
 */
const SPACE_ENOUGH = 5.5;

/**
 * How near the goal a run has to be made before a sight of it matters more
 * than having grass around you.
 *
 * See `intoSpace`. MEASURED, with room the only thing scored and the attack
 * genuinely spread across the pitch for the first time: 21.5% of your touches
 * arrived more than 8 m off centre, against 8.7% before — because the
 * emptiest spot within reach of a striker standing in front of goal is, every
 * single time, the corner nobody is defending.
 */
const SHOOTING_RANGE = 14;
/** How far a body has to be off the line to a piece of the net before that
 *  piece counts as visible. A man is about this wide with a leg out. */
const BODY_R = 0.95;
/** What a completely clear view of the goal is worth, against `SPACE_ENOUGH`
 *  metres of room. Measured — see the sweep in this round's write-up. */
const SIGHT_WEIGHT = 1.0;

// ── TRIED, MEASURED, AND NOT SHIPPED: just keep the chance nearer the middle
//
// A flat cost on drifting more than five metres off centre inside shooting
// range. It reads right — a striker's run in the box is toward the goal, not
// toward the corner flag — and it fixes the symptom outright: chances struck
// from more than 8 m off centre went back to 8.8%, from 21.5%, against a
// baseline of 8.7%.
//
// It also destroys the one number the defensive round was built to move.
// Pulling the chance to the middle REGARDLESS of where the defence is standing
// means where it is standing stops predicting where the ball ends up: over 400
// real chances, "does the defence follow the ball" fell from r=0.60 to r=0.26
// at a modest cost and r=0.19 at a firmer one. A stage whose chances all
// appear in the same place is the fault this round exists to remove, just
// moved from the shape to the chance.
//
// What shipped instead is `goalSight`, which gets to the same place by asking
// the football question — can I see the net from here — rather than by
// pulling on the coordinate.

/**
 * How much of the goal you can actually see from here: the fraction of the
 * mouth with nobody's body on the line to it.
 *
 * The honest version of "is this a shooting position". It falls away for the
 * two reasons a real chance falls away — somebody is in the way, and the angle
 * has closed — so it is one number for both, and from the byline both happen
 * at once, which is exactly why the emptiest grass near a goal is worth
 * nothing.
 *
 * Deliberately measured across the WHOLE mouth rather than to its centre. An
 * earlier version scored the lane to the middle of the goal, and that trains
 * the run to find precisely the chance a shot straight down the middle
 * converts from: MEASURED over 500 real chances, a central ball went from
 * 20.0% to 30.4% against an open post of 56.8%, narrowing the stage's own "a
 * shot straight at him must not be as good as a placed one" guard — whose
 * comment says it cost this project a round — from 2.7x to 1.9x, which is
 * inside the 2x the guard demands.
 */
function goalSight(from: Vec2, rules: MatchRules, goalY: number, markers: Vec2[]): number {
  const SAMPLES = 7;
  const gx1 = rules.goal.x1 + 0.3, gx2 = rules.goal.x2 - 0.3;
  let open = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const aim = { x: gx1 + ((gx2 - gx1) * i) / (SAMPLES - 1), y: goalY };
    let clear = true;
    for (const m of markers) {
      if (laneClearance(m, from, aim) < BODY_R) { clear = false; break; }
    }
    if (clear) open++;
  }
  return open / SAMPLES;
}

/**
 * The attacking side's four used to be built here, as `slotsFor`: four fixed
 * offsets from the middle of the pitch, scaled by `lean`, the ball's own
 * offset from that middle. They are now `attackingShape` (attack.ts), which
 * derives each man's spot from the band, the flank the move is on and where
 * the other side's four actually are — see that file's header for the
 * measurements that made the old version untenable, and for why a shape driven
 * by `lean` could not escape the centre circle from a kick-off.
 *
 * The DEFENDING four moved out to `defensiveShape` (shape.ts) the round
 * before, for the same reason.
 */

/** Turn a point round so "attacking y1" becomes "attacking y2". Not
 *  geometry.ts's `mirror`, which is about the engine's own frame — this is
 *  about the rules' pitch, and takes x as it finds it. */
function flip(rules: MatchRules, p: Vec2): Vec2 {
  return { x: p.x, y: rules.pitch.y1 + rules.pitch.y2 - p.y };
}

/** Move a man toward a target, never further than one beat's worth — or than
 *  `cap`, for a shift that happens INSIDE a beat rather than being one. */
function ease(from: Vec2, to: Vec2, cap = MAX_BEAT_MOVE): Vec2 {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1e-6) return { x: from.x, y: from.y };
  const step = Math.min(d, cap);
  return { x: from.x + (dx / d) * step, y: from.y + (dy / d) * step };
}

/**
 * Match each man to the slot he is already nearest, so a side keeps its shape
 * rather than swapping two players over every beat. Greedy, which on four men
 * is both optimal enough and obviously right to read.
 */
function assign(men: Vec2[], slots: Vec2[], cap = MAX_BEAT_MOVE): Vec2[] {
  const out: Vec2[] = men.map(m => ({ ...m }));
  const free = slots.map((s, i) => ({ s, i }));
  const order = men
    .map((m, i) => ({ i, d: Math.min(...free.map(f => Math.hypot(f.s.x - m.x, f.s.y - m.y))) }))
    .sort((a, b) => a.d - b.d);
  for (const { i } of order) {
    let bestK = 0, bestD = Infinity;
    for (let k = 0; k < free.length; k++) {
      const d = Math.hypot(free[k].s.x - men[i].x, free[k].s.y - men[i].y);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    if (!free.length) break;
    out[i] = ease(men[i], free[bestK].s, cap);
    free.splice(bestK, 1);
  }
  return out;
}

/**
 * The same thing, but reporting which job each man ended up with.
 *
 * `slots` comes back from `defensiveShape` in role order, so the slot a man is
 * matched to IS his job — the position and the role are one answer rather than
 * two that can disagree.
 */
function assignRoles(
  men: Vec2[], slots: Vec2[], roles: DefendRole[], cap = MAX_BEAT_MOVE,
): { men: Vec2[]; roles: DefendRole[] } {
  const out: Vec2[] = men.map(m => ({ ...m }));
  const got: DefendRole[] = men.map(() => "last");
  const free = slots.map((s, i) => ({ s, i }));

  // ── TRIED, MEASURED, AND NOT SHIPPED: the nearest man presses ──
  //
  // Everything here is nearest-SLOT matching, which keeps the side's shape and
  // keeps every man's run short. It has one result that looks wrong written
  // down: the press slot sits a few metres GOAL-SIDE of the ball, so the man
  // nearest that spot is often somebody already back, and the man actually
  // standing next to the carrier can be given a marking job instead. Measured
  // over 400 real chances, the man doing the pressing was the one nearest the
  // ball only 169 times.
  //
  // Giving the press to the nearest man instead genuinely improves the
  // picture — the back four's spread goes 1.68 m to 2.01 m, how well it tracks
  // the ball goes r=0.62 to r=0.74, and the nearest man to the ball goes 4.31
  // m to 3.55 m. It also shuts the stage down, because he then ARRIVES: a
  // short run puts a body in the shooting lane on every single chance, where
  // a longer one leaves him closing but not yet there, which is what a chance
  // worked in behind a defence actually looks like. Over 250 matches:
  //
  //                          blocked   open post   goals   stage
  //   nearest slot presses    30.3%      54.6%     1.620    73.1
  //   nearest man presses     37.0%      40.2%     1.308    65.2
  //
  // Pushing the press slot further out (to 4.2 m and 5.0 m) and shading him
  // harder across (to 2.4 m) were both tried on top and neither recovers it —
  // the best of six combinations was 36.1% blocked and 1.288 goals. A defence
  // that is merely better at blocking is the regression this whole round was
  // told not to ship, so it is not shipped, and it is written down instead of
  // being quietly dropped.
  const order = men
    .map((m, i) => ({ i, d: Math.min(...free.map(f => Math.hypot(f.s.x - m.x, f.s.y - m.y))) }))
    .sort((a, b) => a.d - b.d);
  for (const { i } of order) {
    if (!free.length) break;
    let bestK = 0, bestD = Infinity;
    for (let k = 0; k < free.length; k++) {
      const d = Math.hypot(free[k].s.x - men[i].x, free[k].s.y - men[i].y);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    out[i] = ease(men[i], free[bestK].s, cap);
    got[i] = roles[free[bestK].i] ?? "last";
    free.splice(bestK, 1);
  }
  return { men: out, roles: got };
}

// ── TRIED, MEASURED, AND NOT SHIPPED: making a man keep his job ─────────────
//
// Nearest-slot matching means a man can swap jobs from one beat to the next,
// and MEASURED over 36,292 man-beats with the same side defending throughout,
// he keeps the one he had only 44.1% of the time against 25% for picking at
// random. That reads like the other half of "each cpu should have an
// understanding of his position", so it was built: a per-man head start on the
// job he already had, so he only gives it up when somebody else is genuinely
// much better placed.
//
// It makes the football worse, and not marginally. A man sticking to a job he
// is no longer nearest to spends the beat running across the picture instead
// of standing in it. Over 250 matches each:
//
//   head start   your touches blocked   goals a match   stage score
//     none               30.3%              1.620          73.1
//     2 m                35.9%              1.552          70.2
//     4 m                34.6%              1.620          71.0
//
// So the continuity that actually matters is the one already there for free:
// the SHAPE moves smoothly, a man is matched to the slot he is nearest, and
// the job follows the spot rather than the other way round. What is kept from
// the attempt is `flow.defendRoles` — the record of which job each man has —
// because that is the shape's own answer and there is no second one to
// disagree with it.

/**
 * HOW FAR A DEFENCE SHIFTS WHILE THE BALL IS BEING PLAYED TO SOMEBODY.
 *
 * Not a beat — a beat is `MAX_BEAT_MOVE` and is half a minute of football.
 * This is the second or two a pass is in the air, and the reason it exists at
 * all is a real gap: `receiveInSpace` moves the receiver and the ball up to
 * `RECEIVE_RUN` metres into the emptiest spot it can find, and before this the
 * defending side did not so much as turn its head. The shape handed to the
 * picture-builder was therefore arranged around where the ball USED to be,
 * which is most of why it read as four men standing nowhere in particular.
 *
 * ── It was 3.2, and this is the one place the DEFENDING side's behaviour
 * ── changed this round. Said plainly rather than buried.
 *
 * Nothing in `shape.ts` moved. What moved is how far a defender is allowed to
 * travel while the ball is being played, and it moved because the ball now
 * travels much further: before `attackingShape`, the whole attack lived in a
 * 1.35 m-wide column and a "switch of play" was a couple of metres, so 3.2 m
 * of reaction covered it. With four men genuinely spread over ten metres the
 * same 3.2 m covers a third of a switch, and the defence stops having any
 * relationship to where the ball ended up.
 *
 * MEASURED over 400 real chances and 600 whole matches per setting, against
 * the defensive round's own published numbers (spread 1.67 m, nearest pair
 * 1.95 m, nearest man to the ball 4.33 m, tracks the ball r=0.60) and a
 * baseline of 1.635 goals and 1.042 conceded a match at stage score 72.0:
 *
 *   REACT_SHIFT   spread   pair   nearest  goal-side  tracks   goals  conc  stage
 *      3.2       2.20 m  2.76 m   4.60 m    1.66/4    r=0.42   1.870  1.082  74.5
 *      4.0       2.18 m  2.70 m   4.27 m    1.75/4    r=0.56   1.723  1.010  72.4
 *      4.2       2.19 m  2.63 m   4.24 m    1.79/4    r=0.63   1.747  0.990  73.8
 *      5.2       2.23 m  2.52 m   4.08 m    1.88/4    r=0.77   1.600  0.960  70.1
 *
 * 4.2 is where the defensive picture comes back to where the defensive round
 * left it — tracking at r=0.63 against its published 0.60 — while the attack
 * still scores more than it did. Leaving it at 3.2 scores more again (1.870,
 * +14% on the baseline against +7%) and leaves a defence that has largely
 * stopped following the ball, which is the thing the previous round was built
 * to fix. That is the trade, and it is a judgement rather than a measurement:
 * both settings are real, and 3.2 is a one-line change if more goals are worth
 * more than the defence reading properly.
 */
export const REACT_SHIFT = 4.2;

/**
 * One beat of football nobody is playing.
 *
 * Moves both sides into the shape the band asks for and puts the ball with
 * whoever has it. Which of the attacking slots is YOURS is the shape's own
 * answer (`AttackingShape.yours`) — the most advanced man who is not the one
 * being played to, so when the move finds you it finds you in front of goal
 * rather than at right back.
 */
function moveWorld(
  rules: MatchRules, world: FiveWorld, flow: FiveFlowState, rng: () => number,
): FiveWorld {
  const yours = flow.possession === "you";

  // ── The one that has to be got right, and was not ──
  //
  // Both shapes are written in a canonical frame where the attacking side is
  // going toward `y1`, and the caller turns them round when the attackers are
  // them. The anchor handed in must therefore be a distance from the goal
  // BEING ATTACKED, not a position on the pitch — and bands are named from
  // your point of view, so when it is their ball the depth is the other way
  // up.
  //
  // The first version passed `bandY` (a real position) and then flipped the
  // whole shape, which mirrors the depth twice. MEASURED: their chances were
  // being built with the ball 24.7 m from the goal they were attacking — the
  // far side of the halfway line — and 95.8% of them ended "tackled" on the
  // long way through your defence. They scored 0.00 goals a match across 250.
  const depth = yours ? BAND_DEPTH[flow.band] : 1 - BAND_DEPTH[flow.band];
  const L0 = rules.pitch.y2 - rules.pitch.y1;
  const canonBall = yours ? world.ball : flip(rules, world.ball);

  // ── Both shapes are built from the situation ──
  //
  // The attack reads where the DEFENDERS REALLY ARE, one beat old — their
  // actual positions rather than the spots `defensiveShape` is about to hand
  // them. That is deliberate twice over: a man's real position cannot be
  // wrong, and asking the defensive shape first would be circular, since it
  // takes the attack as its own input.
  const canonDefenders = (yours ? [...world.opps] : [world.you, ...world.mates])
    .map(p => (yours ? { ...p } : flip(rules, p)));
  const att = attackingShape(
    rules, rules.pitch.y1 + L0 * depth, canonBall, canonDefenders, rng,
  );
  const attack = att.slots;
  const shape = defensiveShape(rules, canonBall, attack, rng);

  // The attacking shape is written attacking y1, which is YOUR direction. When
  // it is their ball the whole picture turns round.
  const attackSlots = yours ? attack : attack.map(p => flip(rules, p));
  const defendSlots = yours ? shape.slots : shape.slots.map(p => flip(rules, p));

  // ── You get your slot first, and it is the striker's ──
  //
  // Greedy nearest-slot matching alone would put you wherever you happened to
  // be standing, which over a few beats leaves the one man the player is
  // actually controlling drifting to right back. You are a striker in this
  // stage, so when your side has it you take the run BEYOND the carrier (slot
  // 1) — which also means the ball is with somebody else, which is the whole
  // point of a beat you are not involved in — and when it does not, you are
  // the highest presser (defend slot 0).
  const mySlots = yours ? attackSlots : defendSlots;
  const myIdx = yours ? att.yours : 0;

  // ── Who is doing which job, and why it is remembered ──
  //
  // The defending four are matched to `defensiveShape`'s slots, which come
  // back in role order — so the slot a man takes IS his job, and there is no
  // second answer to disagree with the first. `flow.defendRoles` carries last
  // beat's answer in so he keeps it unless somebody is genuinely better placed
  // (see ROLE_STICK), and carries this beat's answer back out.
  let movedYours: Vec2[];
  let movedTheirs: Vec2[];
  if (yours) {
    const you = ease(world.you, mySlots[myIdx]);
    movedYours = [you, ...assign([...world.mates], mySlots.filter((_, i) => i !== myIdx))];
    const d = assignRoles([...world.opps], defendSlots, shape.roles);
    movedTheirs = d.men;
    flow.defendRoles = d.roles;
  } else {
    // Defending, and YOUR job is the press — you go and close the ball down.
    //
    // Kept as a fixed job rather than handed to `assignRoles` with the others,
    // and it was MEASURED rather than assumed: letting the shape decide which
    // of the four jobs is yours reads better on paper and costs real football.
    // You are the one man who leaves the defending picture the instant your
    // side wins it back, so parking you at the back changes where the ball
    // goes next — over 250 matches it took 1.600 goals a match down to 1.388
    // and the stage score from 72.3 to 65.2. The other three take the other
    // three jobs.
    const you = ease(world.you, defendSlots[0]);
    const d = assignRoles([...world.mates], defendSlots.slice(1), shape.roles.slice(1));
    movedYours = [you, ...d.men];
    flow.defendRoles = [shape.roles[0], ...d.roles];
    movedTheirs = assign([...world.opps], attackSlots);
  }

  // The ball is with whoever has it: the man nearest the slot the attacking
  // shape has decided the ball should be in this beat. `attackingShape`
  // guarantees that slot is never yours, so a beat never finds you already on
  // the ball — which is the whole point of the layer this lives in.
  const carrier = yours
    ? nearestOther(movedYours, attackSlots[att.carrier], 0)
    : nearestOther(movedTheirs, attackSlots[att.carrier], -1);

  return {
    ball: clampToPitch({ ...carrier }, 0.4),
    you: movedYours[0],
    mates: [movedYours[1], movedYours[2], movedYours[3]] as [Vec2, Vec2, Vec2],
    yourKeeper: keeperHome(rules, world.yourKeeper, rules.pitch.y2, flow, world.ball, rng),
    opps: [movedTheirs[0], movedTheirs[1], movedTheirs[2], movedTheirs[3]] as [Vec2, Vec2, Vec2, Vec2],
    theirKeeper: keeperHome(rules, world.theirKeeper, rules.pitch.y1, flow, world.ball, rng),
  };
}

/** Nearest man to a point, skipping one index (-1 skips nobody). */
function nearestOther(men: Vec2[], to: Vec2, skip: number): Vec2 {
  let best = men[skip === 0 ? 1 : 0];
  let bestD = Infinity;
  men.forEach((m, i) => {
    if (i === skip) return;
    const d = Math.hypot(m.x - to.x, m.y - to.y);
    if (d < bestD) { bestD = d; best = m; }
  });
  return best;
}

/**
 * Where a keeper stands.
 *
 * Two things, and the second is the one that makes the goal a goal.
 *
 * He barely leaves his line — see below. And he COVERS HIS NEAR POST: he
 * stands on the line between the ball and the middle of his goal, shaded
 * toward whichever side the ball is on, which is what a keeper does and is the
 * reason a far-post finish exists as a thing to aim for.
 *
 * ── Why that is load-bearing here and is not in the big match ──
 *
 * The engine's save radius is 2.04 m at the weakest setting, tuned against a
 * 7.32 m goal where it leaves 1.34 m of open net either side of a central
 * keeper. On this 5.2 m goal it leaves 0.56 m. MEASURED: with the keeper
 * central, a shot down the middle of a five-a-side goal converts 0.5% against
 * the real match's 48.2% — half the mouth is simply dead, and "placement" stops
 * being a choice between two live options and becomes a 0.56 m band you either
 * hit or do not.
 *
 * Shading him to the near post is not a difficulty dial, it is the thing that
 * puts a real target back on the pitch: a ball worked to one side leaves a far
 * corner you can genuinely pick out, which is what a five-a-side actually looks
 * like. The decision becomes "find the open side", which you can SEE, rather
 * than "hit a band you cannot".
 */
function keeperHome(
  rules: MatchRules, at: Vec2, lineY: number, flow: FiveFlowState, ball: Vec2, rng: () => number,
): Vec2 {
  const { y1, y2 } = rules.pitch;
  const L = y2 - y1;
  const cx = (rules.pitch.x1 + rules.pitch.x2) / 2;
  const toward = lineY === y1 ? 1 : -1;
  // How far up the pitch the ball is, from this keeper's point of view: 0 on
  // his own line, 1 at the far end.
  const away = Math.min(1, Math.max(0, Math.abs(bandY(rules, flow.band) - lineY) / L));
  // ── He barely leaves his line, and that is not timidity ──
  //
  // The engine judges a save at the keeper's own line, so every metre he
  // stands off it is a metre of angle taken away from the shooter before the
  // ball has started to diverge. A real match's own builders put their keepers
  // at 1.10-1.22 m; this used to drift out to nearly 4 and a corner-aimed
  // one-on-one converted 21% instead of the rate the goal is sized for.
  const out = lineY + toward * (L * 0.022 + away * L * 0.018);
  // How far he shades toward the ball's side. Proportional to how wide the
  // ball actually is, so a central chance still faces a central keeper — which
  // is correct, and is why a central one-on-one is the keeper's best case in
  // any game of football.
  const shade = Math.max(-KEEPER_SHADE, Math.min(KEEPER_SHADE, (ball.x - cx) * 0.55));
  return ease(at, clampToPitch({ x: cx + shade + (rng() - 0.5) * 0.7, y: out }, 0.4));
}

// ── Events ──────────────────────────────────────────────────────────────────

export interface FlowEvent {
  /** Already a caption — the match layer stamps the minute on. */
  text: string;
  goal?: "you" | "them";
}

/** A snapshot of the pitch, one per beat. What the screen animates. */
export interface FlowBeat {
  world: FiveWorld;
  band: Band;
  possession: FlowSide;
}

/** What the flow stopped for. */
export type FlowStop =
  /** The move found you — build a passage and let the player aim. */
  | "you"
  /** A TEAM-MATE has worked a chance — play it out through the engine and
   *  watch him take it. The other half of "the CPUs play without your input":
   *  not every chance your side works comes back to your feet, and the ones
   *  that fall to a team-mate near goal are now something you SEE finished
   *  rather than a caption you read. See `buildMateAttack` (passage.ts). */
  | "mate"
  /** They have worked a chance — play it out through the engine and watch. */
  | "them"
  /** Nothing left to play. */
  | "full-time";

export interface FlowResult {
  flow: FiveFlowState;
  world: FiveWorld;
  beats: FlowBeat[];
  events: FlowEvent[];
  stop: FlowStop;
  /** Beats actually played, so the caller can charge the clock for them. */
  beatsPlayed: number;
  /** Goals the simulation itself produced, yours first. */
  scored: [number, number];
}


/** A copy of the pitch as it stands. Copied rather than referenced, because a
 *  beat is a picture of a moment and the moment keeps moving. */
function snapshot(w: FiveWorld, flow: FiveFlowState): FlowBeat {
  return {
    world: {
      ball: { ...w.ball }, you: { ...w.you },
      mates: w.mates.map(m => ({ ...m })) as [Vec2, Vec2, Vec2],
      yourKeeper: { ...w.yourKeeper },
      opps: w.opps.map(o => ({ ...o })) as [Vec2, Vec2, Vec2, Vec2],
      theirKeeper: { ...w.theirKeeper },
    },
    band: flow.band,
    possession: flow.possession,
  };
}

const THEM_MISS = [
  "They drag one wide from distance.",
  "Your keeper watches it fly over.",
  "A shot from the edge, comfortably held.",
  "Blocked before it got near your goal.",
];

const MATE_MISS = [
  "A team-mate drags it wide.",
  "Their keeper holds it.",
  "Blocked on the line.",
  "Over the bar from close in.",
];

/**
 * Play on until somebody needs you.
 *
 * `beatBudget` is how many beats there is clock left for — the caller owns the
 * clock, so this never has to know what a minute is.
 */
export function playOn(
  rules: MatchRules,
  world: FiveWorld,
  flowIn: FiveFlowState,
  inputs: FlowInputs,
  rng: () => number,
  beatBudget: number,
): FlowResult {
  const flow: FiveFlowState = { ...flowIn };
  let w: FiveWorld = {
    ball: { ...world.ball }, you: { ...world.you },
    mates: world.mates.map(m => ({ ...m })) as [Vec2, Vec2, Vec2],
    yourKeeper: { ...world.yourKeeper },
    opps: world.opps.map(o => ({ ...o })) as [Vec2, Vec2, Vec2, Vec2],
    theirKeeper: { ...world.theirKeeper },
  };
  const beats: FlowBeat[] = [];
  const events: FlowEvent[] = [];
  const scored: [number, number] = [0, 0];

  const quality = clamp1((0.5 - inputs.difficulty) * 1.4);

  for (let n = 0; n < beatBudget; n++) {
    flow.sinceInvolved += 1;

    // ── Possession ──
    if (rng() < TURNOVER) {
      const youWin = rng() < 0.5 + quality * TURNOVER_EDGE + flow.momentum * 0.1;
      const next: FlowSide = youWin ? "you" : "them";
      if (next !== flow.possession) {
        flow.possession = next;
        // The four men with jobs are now the other four. Nobody inherits
        // anybody's position.
        flow.defendRoles = undefined;
        // Half of turnovers are a clearance or a counter, which moves the
        // ball; the rest are won on the spot.
        if (rng() < 0.5) flow.band = shiftBand(flow.band, next === "you" ? 1 : -1);
      }
    }

    // ── Territory ──
    const yours = flow.possession === "you";
    const dir = yours ? 1 : -1;
    const drive = (DRIVE + (yours ? quality : -quality) * 0.04
      + (yours ? flow.momentum : -flow.momentum) * 0.06) * ENTRY[shiftBand(flow.band, dir)];
    if (rng() < drive) flow.band = shiftBand(flow.band, dir);
    else if (rng() < RETREAT) flow.band = shiftBand(flow.band, -dir);

    // ── Momentum ──
    const danger = yours ? YOUR_DANGER : THEIR_DANGER;
    if (danger.includes(flow.band)) {
      flow.momentum += (flow.band === "box" || flow.band === "own_box" ? 0.08 : 0.05) * dir;
    }
    flow.momentum = clamp1(flow.momentum * 0.94);

    // ── Everybody moves ──
    w = moveWorld(rules, w, flow, rng);
    beats.push(snapshot(w, flow));

    // ── Does this beat produce a chance? ──
    const inBox = flow.band === "box" || flow.band === "own_box";
    if (danger.includes(flow.band)) {
      const rate = (inBox ? CHANCE_BOX : CHANCE_DEEP)
        * (1 + (yours ? quality : -quality) * 0.1)
        * (1 + Math.max(0, yours ? flow.momentum : -flow.momentum) * 0.2);

      if (rng() < rate) {
        if (yours) {
          if (rng() < chanceFindsYou(rules, w, flow, inputs)) {
            flow.sinceInvolved = 0;
            w = receiveInSpace(rules, w, flow, rng);
            beats.push(snapshot(w, flow));
            return { flow, world: w, beats, events, stop: "you", beatsPlayed: n + 1, scored };
          }
          // ── It fell to a team-mate — and near goal, you WATCH him take it ──
          //
          // The mirror of "the ones worth watching" below. A real chance a
          // team-mate works in their box is not a caption any more: it is handed
          // back to be played out through the real engine so you see him strike
          // it and their keeper genuinely dive — the other half of "the CPUs
          // play without your input", and the fix for a stage that funnelled
          // every chance back to your own feet.
          //
          // Only a real chance near goal (`worthWatchingYours`) — a team-mate's
          // speculative effort from distance is rolled, exactly as your own is
          // and as theirs is, rather than stopping the game for every half
          // chance.
          if (inBox && worthWatchingYours(rules, mateChance(rules, w, flow, rng))) {
            w = mateChance(rules, w, flow, rng);
            beats.push(snapshot(w, flow));
            return { flow, world: w, beats, events, stop: "mate", beatsPlayed: n + 1, scored };
          }
          // Further out, it is a caption either way, so the match still reads as
          // a match rather than a highlight reel of your own touches.
          const goal = rng() < convertRate(inBox ? MATE_CONVERT_BOX : MATE_CONVERT_DEEP, rng);
          if (goal) {
            scored[0] += 1;
            flow.momentum = clamp1(flow.momentum + 0.3);
            events.push({ text: "Your side score!", goal: "you" });
            kickOffBand(flow, "them");
          } else {
            events.push({ text: MATE_MISS[Math.floor(rng() * MATE_MISS.length)] });
            endOfMove(flow, "you");
          }
        } else if (inBox && worthWatching(rules, chance(rules, w, flow, rng))) {
          // ── The ones worth watching ──
          //
          // A real chance in your box is not rolled. It is handed back to be
          // played out through the real engine, mirrored, so your keeper
          // genuinely dives — see `buildTheirAttack`. That is the whole
          // difference between watching a match and reading a caption about
          // one, and it is what was asked for:
          //
          //   "if it's a close highlight or goal you should watch it"
          //
          // A speculative effort from outside is NOT one of those. It is
          // rolled, exactly as a chance that falls to one of your team-mates
          // is — both are moments you were not part of, and stopping the game
          // to watch every half-chance from twenty yards would be five or six
          // interruptions a match rather than three.
          w = chance(rules, w, flow, rng);
          beats.push(snapshot(w, flow));
          return { flow, world: w, beats, events, stop: "them", beatsPlayed: n + 1, scored };
        } else {
          const goal = rng() < convertRate(MATE_CONVERT_DEEP, rng);
          if (goal) {
            scored[1] += 1;
            flow.momentum = clamp1(flow.momentum - 0.3);
            events.push({ text: "They score from distance.", goal: "them" });
            kickOffBand(flow, "you");
          } else {
            events.push({ text: THEM_MISS[Math.floor(rng() * THEM_MISS.length)] });
            endOfMove(flow, "them");
          }
        }
      }
    }

    // ── Coming to get it ──
    // If the match has ignored you for a long time, you go and find the ball
    // rather than waiting for a chance that may never arrive.
    if (yours && flow.sinceInvolved >= STARVED && rng() < 0.45) {
      flow.sinceInvolved = 0;
      w = receiveInSpace(rules, w, flow, rng);
      beats.push(snapshot(w, flow));
      return { flow, world: w, beats, events, stop: "you", beatsPlayed: n + 1, scored };
    }
  }

  return { flow, world: w, beats, events, stop: "full-time", beatsPlayed: beatBudget, scored };
}

/** A move has finished: the defending side has it, where it was. */
function endOfMove(flow: FiveFlowState, attacker: FlowSide) {
  flow.possession = attacker === "you" ? "them" : "you";
  // The jobs belong to whoever is defending, and that is now the other four.
  flow.defendRoles = undefined;
}

/** A goal. Back to the middle, and the other side kick off. */
function kickOffBand(flow: FiveFlowState, to: FlowSide) {
  flow.possession = to;
  flow.band = "middle";
  flow.momentum = 0;
  flow.defendRoles = undefined;
}

/**
 * THE DEFENCE REACTS TO WHERE THE BALL HAS ACTUALLY GONE.
 *
 * A chance is made by moving the receiver and the ball into space — up to
 * `RECEIVE_RUN` metres of it, deliberately the emptiest spot available. Before
 * this, nothing on the defending side knew that had happened: the shape they
 * were standing in had been arranged around the ball's PREVIOUS position, one
 * beat earlier, and the picture handed to the engine was a stale one.
 *
 * So the defending four are re-shaped for the ball's real position, capped at
 * `REACT_SHIFT` — a shift, not a beat. Nobody sprints across; each man takes a
 * step or two toward the job the new situation gives him.
 *
 * `attacking` is which side has the ball. Returns a new world; the ball, the
 * keepers and the attacking side are untouched.
 */
function reactToBall(
  rules: MatchRules, world: FiveWorld, attacking: FlowSide,
  flow: FiveFlowState, rng: () => number,
): FiveWorld {
  const yours = attacking === "you";
  const canonBall = yours ? world.ball : flip(rules, world.ball);
  const attackers = (yours ? [world.you, ...world.mates] : [...world.opps])
    .map(p => (yours ? p : flip(rules, p)));
  const shape = defensiveShape(rules, canonBall, attackers, rng);
  const slots = yours ? shape.slots : shape.slots.map(p => flip(rules, p));

  // A man is only moved PART of the way to his slot, so "the slot is clear of
  // the ball" does not by itself mean HE is: somebody who was already on top
  // of it, whose slot is further than `REACT_SHIFT` away, is still on top of
  // it after his step. One chance in two thousand, measured, and the engine
  // resolves it as a tackle before the kick has travelled — so the same guard
  // the slots get is applied to the men.
  const clear = (men: Vec2[]) => men.map(m => clearOfBall(m, world.ball, rules));

  if (yours) {
    const d = assignRoles([...world.opps], slots, shape.roles, REACT_SHIFT);
    flow.defendRoles = d.roles;
    const moved = clear(d.men);
    return { ...world, opps: [moved[0], moved[1], moved[2], moved[3]] as [Vec2, Vec2, Vec2, Vec2] };
  }
  // Same split as `moveWorld`: the press is yours, the other three are theirs
  // to sort out between them.
  const you = clearOfBall(ease(world.you, slots[0], REACT_SHIFT), world.ball, rules);
  const d = assignRoles([...world.mates], slots.slice(1), shape.roles.slice(1), REACT_SHIFT);
  flow.defendRoles = [shape.roles[0], ...d.roles];
  const moved = clear(d.men);
  return {
    ...world,
    you,
    mates: [moved[0], moved[1], moved[2]] as [Vec2, Vec2, Vec2],
  };
}

/**
 * THE MOVE FINDS YOU.
 *
 * The one thing this file exists to get right. You do not appear on the ball;
 * the ball is played to you, into the space you made — so the picture you
 * rejoin has somewhere to go in it.
 *
 * Space is found rather than assumed: several receiving spots in the band are
 * sampled and the one furthest from the nearest opponent wins. That is an
 * honest model of making a run, and it is what stops the engine being handed a
 * picture with a defender already standing on the ball (which it resolves as a
 * tackle before the kick has travelled).
 */
function receiveInSpace(
  rules: MatchRules, world: FiveWorld, flow: FiveFlowState, rng: () => number,
): FiveWorld {
  // Keep the ball out of the bottom fifth of the frame, or there is no room to
  // drag back and aim (see KICK_FLOOR_Y). Respected here rather than left to
  // `buildPassage`, which would quietly move the ball and leave your own
  // figure standing where it was.
  const spot = intoSpace(
    rules, world.you, world.opps, bandY(rules, flow.band), rules.pitch.y1, rng, rules.kickFloorY,
  );
  // And they react to it — see `reactToBall`. Without this the four men you
  // are about to play against are arranged around where the ball was a beat
  // ago, which is where the "four men in a heap in the middle" came from.
  return reactToBall(rules, { ...world, you: { ...spot }, ball: { ...spot } }, "you", flow, rng);
}

/**
 * The same thing for THEM.
 *
 * Symmetry, and it is not a nicety. MEASURED, with this missing: your own
 * chances arrived through `receiveInSpace` — a real run into a real gap — and
 * theirs arrived with four of your men standing on the ball, so 88.6% of their
 * shots were blocked or tackled and they scored 7.3% of the time against your
 * 67%. The pitch has to be the same shape at both ends or the stage is not a
 * match, it is a shooting drill with a cutaway.
 *
 * Their carrier is moved rather than invented, and afterwards he is genuinely
 * the man nearest your goal — which is the man `buildTheirAttack` picks.
 */
function theirChanceInSpace(
  rules: MatchRules, world: FiveWorld, flow: FiveFlowState, rng: () => number,
): FiveWorld {
  const yours = [world.you, ...world.mates];
  // Whoever of theirs is nearest your goal is the one the chance falls to.
  let best = 0;
  world.opps.forEach((o, i) => { if (o.y > world.opps[best].y) best = i; });
  const spot = intoSpace(rules, world.opps[best], yours, bandY(rules, flow.band), rules.pitch.y2, rng);
  const opps = world.opps.map((o, i) => (i === best ? { ...spot } : o)) as [Vec2, Vec2, Vec2, Vec2];
  // Your side reacts to it too. The symmetry note above applies here as well:
  // the pitch has to be the same shape at both ends.
  return reactToBall(rules, { ...world, opps, ball: { ...spot } }, "them", flow, rng);
}

/**
 * A TEAM-MATE's chance — the exact mirror of `theirChanceInSpace`, for your own
 * side attacking their goal.
 *
 * The move found a team-mate rather than you: whichever of your three is nearest
 * THEIR goal is the one it falls to, moved into real space (not left standing on
 * the ball, which the engine tackles), and the opposition reacts to it. What
 * comes back is a picture `buildMateAttack` can hand straight to the engine so
 * the team-mate genuinely takes the shot and your screen watches him.
 */
function yourMateChanceInSpace(
  rules: MatchRules, world: FiveWorld, flow: FiveFlowState, rng: () => number,
): FiveWorld {
  // Whoever of your mates is nearest their goal (y1) is the one the chance
  // falls to.
  let best = 0;
  world.mates.forEach((m, i) => { if (m.y < world.mates[best].y) best = i; });
  const spot = intoSpace(rules, world.mates[best], [...world.opps], bandY(rules, flow.band), rules.pitch.y1, rng);
  const mates = world.mates.map((m, i) => (i === best ? { ...spot } : m)) as [Vec2, Vec2, Vec2];
  // The opposition reacts to it — the same symmetry `theirChanceInSpace` relies
  // on: the pitch has to be the same shape at both ends.
  return reactToBall(rules, { ...world, mates, ball: { ...spot } }, "you", flow, rng);
}

/**
 * Find the best receiving spot near a man: the emptiest point he could
 * plausibly have run to, pulled toward the band the move actually reached.
 *
 * `towardY` is the goal the receiving side is attacking, so "leaning forward"
 * means the same thing at both ends.
 */
function intoSpace(
  rules: MatchRules, from: Vec2, markers: Vec2[], ay: number, towardY: number, rng: () => number,
  maxY = Infinity,
): Vec2 {
  const { x1, x2 } = rules.pitch;
  const W = x2 - x1;
  const L = rules.pitch.y2 - rules.pitch.y1;
  const lean = towardY < ay ? -1 : 1;
  const gcx = (rules.goal.x1 + rules.goal.x2) / 2;

  let best = from;
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    // ── Sampled around where you already are, not around the pitch ──
    //
    // The first version sampled the whole width of the band and took the
    // emptiest spot, with only a soft penalty for distance. Measured: it moved
    // you up to 24 m in a single beat — a teleport, and exactly the "respawn
    // wherever the ball ends up" this file exists to remove, just with better
    // scenery. A run onto a pass is a run: RECEIVE_RUN metres, no further.
    const ang = rng() * Math.PI * 2;
    const reach = RECEIVE_RUN * Math.sqrt(rng());
    const cand = clampToPitch({
      x: from.x + Math.cos(ang) * reach,
      // Pulled toward the band the move actually reached, and leaning
      // forward — you are running onto it, not standing waiting for it.
      y: (from.y + Math.sin(ang) * reach) * 0.45
        + (ay + lean * L * 0.04) * 0.55,
    }, 1.2);
    if (cand.y > maxY) continue;
    let nearest = Infinity;
    for (const o of markers) nearest = Math.min(nearest, Math.hypot(o.x - cand.x, o.y - cand.y));
    // Space is the point, but the shorter run is still the better one.
    const travel = Math.hypot(cand.x - from.x, cand.y - from.y);
    if (travel > RECEIVE_RUN) continue;
    // ── …and near goal, a sight of it ──
    //
    // Room alone is the emptiest grass within reach, and the emptiest grass
    // near a goal is always the byline: everybody else is in front of the net,
    // so the corner flag scores perfectly and is worth nothing. A run made in
    // the last third is made to SHOOT from, and what makes a spot worth
    // shooting from is HOW MUCH OF THE GOAL YOU CAN SEE from it — which falls
    // away both when a body is in the way and when the angle closes, so it is
    // one number for the two things that actually ruin a chance.
    //
    // Only inside `SHOOTING_RANGE`: out in midfield a clear view of the goal
    // is not what the run is for, and weighting it there would drag every
    // build-up pass into the middle of the pitch, which is the fault this
    // whole round exists to remove.
    let sight = 0;
    const toGoal = Math.hypot(cand.x - gcx, cand.y - towardY);
    if (toGoal < SHOOTING_RANGE) {
      sight = goalSight(cand, rules, towardY, markers) * SIGHT_WEIGHT;
    }
    const score = Math.min(nearest, SPACE_ENOUGH) + sight - travel * 0.18;
    if (score > bestScore) { bestScore = score; best = cand; }
  }

  return best;
}

/**
 * Where the flow picks up after one of your touches has resolved.
 *
 * The band comes from where the ball actually finished, so territory you won
 * with a good ball is territory your side keeps — and a ball lost deep is lost
 * deep. That is the whole of "territory has to matter".
 */
export function flowAfterTouch(
  rules: MatchRules, flow: FiveFlowState, possession: FlowSide, ballY: number,
): FiveFlowState {
  return { ...flow, possession, band: bandOf(rules, ballY) };
}
