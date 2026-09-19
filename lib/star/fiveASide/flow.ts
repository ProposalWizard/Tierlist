import type { Vec2 } from "../canvasEngine";
import type { MatchRules } from "./rules";
import { clampToPitch } from "./geometry";
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
 * How often a chance your side works actually falls to YOU.
 *
 * The big match's own shape — a base, a skill term, and a starve bonus so you
 * are never stranded watching — with its energy and impact-sub terms dropped,
 * since neither exists in a trial.
 *
 * The BASE is not the big match's 0.36, and that is the point rather than a
 * drift. What was asked for was the same highlight count as a full match:
 *
 *   "let's make it exactly the same as a 90 min game highlights wise but cut
 *    the game down to 45 minutes."
 *
 * So it was measured, not copied. A real ninety minutes calls the player in
 * 7.79 times on average (400 simulated matches through `hiddenMatch`, median
 * 7, p10 5, p90 11) — and 7.23 for a player who SHOOTS every chance he gets,
 * because a shot hands the ball over and his side has to win it back. This
 * pitch has fewer beats to work with, so the big match's own 0.36 base
 * produced 6.0; 0.60 lands it at 7.8 played out through the pure reducers and
 * 6.9 for a real shooting striker measured through the live engine — either
 * way inside the range the real match gives the same player.
 * tests/star/fiveASideFlow.mts pins it to that range rather than to a figure.
 */
function involvement(flow: FiveFlowState, inputs: FlowInputs): number {
  return 0.60
    + (inputs.playerSkill / 100) * 0.26
    + Math.min(0.3, Math.max(0, flow.sinceInvolved - 6) * 0.03);
}

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
 * with a save radius of 2.04 m, a keeper shading 1.2 m leaves about 1.5 m of
 * far post uncovered — which is the same order as the 1.34 m a central keeper
 * leaves in the eleven-a-side game the engine was tuned for. Less than that and
 * there is nothing to aim at; much more and he is not guarding his goal.
 */
const KEEPER_SHADE = 1.2;

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

interface Slots {
  /** Attacking side, carrier first — the man the ball is with. */
  attack: Vec2[];
  /** Defending side, presser first. */
  defend: Vec2[];
}

/**
 * The attacking side's four, and the defending side's four, for a ball in this
 * band. Everything is in "attacking toward y1" terms and mirrored by the
 * caller when it is the other side's ball, so there is one shape and not two.
 */
function slotsFor(rules: MatchRules, ay: number, ballX: number, jitter: () => number): Slots {
  const { x1, x2, y1, y2 } = rules.pitch;
  const W = x2 - x1;
  const L = y2 - y1;
  const cx = (x1 + x2) / 2;
  const at = (x: number, y: number): Vec2 =>
    clampToPitch({ x, y: Math.max(y1 + L * 0.03, Math.min(y2 - L * 0.03, y)) }, 0.6);

  const j = (m: number) => (jitter() - 0.5) * m;
  // Which flank the move is on, so the shape leans the way the ball does.
  const lean = Math.max(-1, Math.min(1, (ballX - cx) / (W / 2)));

  const attack: Vec2[] = [
    // The carrier.
    at(cx + lean * W * 0.30 + j(W * 0.10), ay + j(L * 0.03)),
    // Running beyond him, off the far shoulder.
    at(cx - lean * W * 0.22 + j(W * 0.12), ay - L * 0.11 + j(L * 0.04)),
    // Square, on the near side.
    at(cx + lean * W * 0.34 + j(W * 0.12), ay + L * 0.03 + j(L * 0.04)),
    // The deep man, holding.
    at(cx + j(W * 0.20), ay + L * 0.20 + j(L * 0.04)),
  ];

  const defend: Vec2[] = [
    // Pressing the carrier, goal-side.
    at(attack[0].x + j(W * 0.08), attack[0].y - L * 0.055),
    // Covering the runner.
    at(attack[1].x + j(W * 0.10), attack[1].y - L * 0.05),
    // The second cover, holding the other side.
    at(cx - lean * W * 0.26 + j(W * 0.12), ay - L * 0.13 + j(L * 0.03)),
    // Last man.
    at(cx + j(W * 0.14), ay - L * 0.22 + j(L * 0.03)),
  ];

  return { attack, defend };
}

/** Turn a point round so "attacking y1" becomes "attacking y2". Not
 *  geometry.ts's `mirror`, which is about the engine's own frame — this is
 *  about the rules' pitch, and takes x as it finds it. */
function flip(rules: MatchRules, p: Vec2): Vec2 {
  return { x: p.x, y: rules.pitch.y1 + rules.pitch.y2 - p.y };
}

/** Move a man toward a target, never further than one beat's worth. */
function ease(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1e-6) return { x: from.x, y: from.y };
  const step = Math.min(d, MAX_BEAT_MOVE);
  return { x: from.x + (dx / d) * step, y: from.y + (dy / d) * step };
}

/**
 * Match each man to the slot he is already nearest, so a side keeps its shape
 * rather than swapping two players over every beat. Greedy, which on four men
 * is both optimal enough and obviously right to read.
 */
function assign(men: Vec2[], slots: Vec2[]): Vec2[] {
  const out: Vec2[] = men.map(m => ({ ...m }));
  const free = slots.map((s, i) => ({ s, i }));
  const order = men
    .map((m, i) => ({ i, d: Math.min(...slots.map(s => Math.hypot(s.x - m.x, s.y - m.y))) }))
    .sort((a, b) => a.d - b.d);
  for (const { i } of order) {
    let bestK = 0, bestD = Infinity;
    for (let k = 0; k < free.length; k++) {
      const d = Math.hypot(free[k].s.x - men[i].x, free[k].s.y - men[i].y);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    if (!free.length) break;
    out[i] = ease(men[i], free[bestK].s);
    free.splice(bestK, 1);
  }
  return out;
}

/**
 * One beat of football nobody is playing.
 *
 * Moves both sides into the shape the band asks for and puts the ball with
 * whoever has it. `youAttackingSlot` is which of the attacking slots is YOURS
 * when it is your team's ball — the striker's, so when the move finds you it
 * finds you in front of goal rather than at right back.
 */
function moveWorld(
  rules: MatchRules, world: FiveWorld, flow: FiveFlowState, rng: () => number,
): FiveWorld {
  const yours = flow.possession === "you";

  // ── The one that has to be got right, and was not ──
  //
  // `slotsFor` writes its shape in a canonical frame where the attacking side
  // is going toward `y1`, and the caller turns it round when the attackers are
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
  const { attack, defend } = slotsFor(
    rules, rules.pitch.y1 + L0 * depth, world.ball.x, rng,
  );

  // The attacking shape is written attacking y1, which is YOUR direction. When
  // it is their ball the whole picture turns round.
  const attackSlots = yours ? attack : attack.map(p => flip(rules, p));
  const defendSlots = yours ? defend : defend.map(p => flip(rules, p));

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
  const myIdx = yours ? 1 : 0;
  const you = ease(world.you, mySlots[myIdx]);
  const mates = assign([...world.mates], mySlots.filter((_, i) => i !== myIdx));
  const movedYours = [you, ...mates];
  const movedTheirs = assign([...world.opps], yours ? defendSlots : attackSlots);

  // The ball is with whoever has it: the attacking carrier.
  const carrier = yours
    ? nearestOther(movedYours, attackSlots[0], 0)
    : nearestOther(movedTheirs, attackSlots[0], -1);

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
          if (rng() < involvement(flow, inputs)) {
            flow.sinceInvolved = 0;
            w = receiveInSpace(rules, w, flow, rng);
            beats.push(snapshot(w, flow));
            return { flow, world: w, beats, events, stop: "you", beatsPlayed: n + 1, scored };
          }
          // It fell to somebody else. Reported either way, so the match reads
          // as a match rather than a highlight reel of your own touches.
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
}

/** A goal. Back to the middle, and the other side kick off. */
function kickOffBand(flow: FiveFlowState, to: FlowSide) {
  flow.possession = to;
  flow.band = "middle";
  flow.momentum = 0;
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
  return { ...world, you: { ...spot }, ball: { ...spot } };
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
  return { ...world, opps, ball: { ...spot } };
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
    const score = Math.min(nearest, SPACE_ENOUGH) - travel * 0.18;
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
