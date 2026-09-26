/**
 * The long-range ruleset — see ./index.ts for how rules plug into the match.
 *
 * Harry's working rules (26 Sep 2026), each with where it is enforced:
 *
 *   1. Struck from 17-25m out, now and then up to 30.        setup: bringCloser
 *   2. The ball roughly central, inside the box's width.     setup: bringCloser
 *   3. A recognisable trigger — the lay-off to the D.        setup: layOff
 *   4. The defence is set: no big hole in the back line.     setup: closeTheLine
 *   5. Somebody in, or closing, the shooting lane.           setup: screenTheLane
 *   6. The box is busy, so shooting vs passing is a choice.  setup: layOff keeps 2 of yours in it
 *   7. The keeper is on his line: no chip.                   setup: keeper
 *   8. 4-6% scored for an ordinary player, a specialist
 *      noticeably more through power AND curl.               strike/step: the keeper's read
 *   9. A repair never turns it into another chance.          setup: every move is checked
 *
 * ── Why the picture moves, rather than being redrawn ──
 *
 * Every long shot the game serves is one of the committed drawings laid over
 * the build (authoredChance.ts), and 96% of them sat 24-34m out, median
 * 28.9m. The drawings are Harry's and Mikey's and are never edited — so the
 * whole picture is brought closer to goal instead (bringCloser): every depth
 * shrinks by one share, and every man keeps how far he stood from the line of
 * your shot. Nobody changes side, nobody passes anybody — it is the same
 * drawing, with the defence sitting deeper, which is exactly the "space in
 * front of a deep defence" a long shot comes from. The camera's frame holds
 * the middle of the goal, so everything that was on screen stays on screen.
 *
 * Measured on 2,000 long shots served the in-game way, before → after:
 *   17-25m out            0.7% → 81%     (never over 30m; median 29.6 → 22.3m)
 *   11m+ hole in the line 35.6% → 0%
 *   nobody in/closing the lane 29% → 0%
 *   none of yours in the box 10.4% → 0.3%;  one of yours in your shot 24.9% → 0%
 *   keeper off his line   median 1.66m (46% over 2m) → 0.78m (never over 1.1m)
 *   a lay-off man beside/behind you 0.7% → 91%
 *
 * ── Why the keeper reads the flight (rule 8) ──
 *
 * Measured before this file: an ordinary player striking it hard and low
 * scored 28% of his long shots, a specialist 56%. The engine's keeper does not
 * move at all until the ball reaches him, so the only thing between a long
 * shot and the net was where he happened to be standing. A real keeper facing
 * a shot from 20-odd metres sees it the whole way. So at the strike he reacts
 * — after a real reaction time — to the ball's flight as he sees it, and
 * shuffles across toward where it is heading, at the engine's own shuffle pace
 * and range (Keeper.adjusting). He only ever reads what has already happened:
 * the line the ball is on right now. That is what makes both skills count:
 *
 *   · a harder strike gives him less time to get across;
 *   · curl is aimed wide of the post and bends back, so the line he chases
 *     is not where the ball ends up.
 *
 * lib/star/canvasEngine.ts is untouched: this only sets `keeper.adjusting`
 * and `keeper.targetX`, the public fields the engine already moves him by,
 * and reads the live ball each substep — it never steps a ball of its own.
 */
import type { Ball, Scenario, Vec2 } from "../canvasEngine";
import type { KindRule, StrikeDecision } from "./index";
import { fixBaseScenario } from "../baseScenario";
import { CX, POST_L, POST_R, BOX_DEPTH, BOX_L, BOX_R, PITCH_W } from "../pitch";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ── Rule 1/2: where it is struck from ─────────────────────────────────────

/** Distance to the middle of the goal the chance is struck from, most of the
 *  time: Harry's 17-25m. The low end stays clear of the box (see MIN_DEPTH). */
export const NEAR_BAND: [number, number] = [18, 25];
/** …and now and then: "sometimes 30". */
export const FAR_BAND: [number, number] = [25, 29.5];
/** How often it is the longer one. */
export const FAR_SHARE = 0.18;
/** Never inside this depth — the box is 16.5m, and baseScenario's own
 *  definition of a long shot is 17m (rule 9: it must stay a long shot). */
export const MIN_DEPTH = 17.5;
/** "Roughly central, inside the box's width": at most this far from the
 *  middle. The box's own half-width is 20.2m. */
export const MAX_LATERAL = 13;

// ── Rule 4: the back line ─────────────────────────────────────────────────

/** A defender within this of the deepest one is in the back line — the same
 *  4m baseScenario's hole check uses. */
const LINE_BAND = 4;
/** The biggest gap left between two men in the line. baseScenario flags 11m;
 *  a set defence keeps it well inside that. */
export const MAX_LINE_GAP = 9.5;

// ── Rule 5: the lane ──────────────────────────────────────────────────────

/** In the lane: within this of the line from the ball to the middle of goal. */
export const LANE_R = 2;
/** Closing it: a man goal-side of the ball and this close to it. */
export const CLOSING_R = 6;

// ── Rule 6: the box ───────────────────────────────────────────────────────

/** The fewest of your men left in the box — somebody to pass to, and
 *  somebody following the shot in. */
export const BUSY_BOX_MATES = 2;

// ── Rule 7: the keeper ────────────────────────────────────────────────────

/** How far off his line he stands. The engine's own "on his line" is up to
 *  0.55m (its sprite stands on its feet); a yard further is still a keeper
 *  set for a shot, and nowhere near far enough out to be chipped. */
export const KEEPER_Y: [number, number] = [0.45, 1.1];

// ── Rule 8: the read ──────────────────────────────────────────────────────

/**
 * The keeper's read, in two numbers.
 *
 *   react    seconds from the strike before he moves, from a good read to a
 *            late one: seeing it struck, setting his feet, pushing off. Tuned
 *            by measurement to Harry's 4-6% for an ordinary player: 0.30-0.45s
 *            gave 3.0% driven / 4.0% hard and low, 0.36-0.52s gives 4.3% /
 *            5.3%, with a specialist striking it hard on 14.3% (1,200 shots
 *            each — see tests/star/longRangeRules.mts).
 *   perPoint a better keeper reads it sooner — seconds per rating point
 *            above 60 (and later below it).
 *
 * Once moving he goes toward the line the ball is on, at the engine's own
 * shuffle pace and no further than its own shuffle range (Keeper.adjusting).
 * A delay on what he sees was tried as a third number and did nothing
 * measurable (0 to 0.35s: identical to the decimal), so it is not here.
 */
export const READ = { react: [0.36, 0.52] as [number, number], perPoint: 0.0025 };

// ─────────────────────────────────────────────────────────────────────────

/** Every figure the picture is made of, except the ball, you and the keeper. */
function bodies(sc: Scenario): Vec2[] {
  const out: Vec2[] = [...sc.defenders];
  if (sc.runner) out.push(sc.runner.pos, sc.runner.to);
  for (const r of sc.secondaryRunners) out.push(r.pos, r.to);
  out.push(sc.follower);
  for (const t of sc.teammates) out.push(t);
  if (sc.passTarget) out.push(sc.passTarget);
  // One object can be in two places (a builder's pass target IS its
  // runner's spot); moving it twice would move it too far.
  return Array.from(new Set(out));
}

/** Your side's men who stand on the pitch (not where they are running to). */
function mates(sc: Scenario): Vec2[] {
  const out: Vec2[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) out.push(r.pos);
  out.push(sc.follower);
  for (const t of sc.teammates) out.push(t);
  return out;
}

const inBox = (p: Vec2) => p.y <= BOX_DEPTH && p.x >= BOX_L && p.x <= BOX_R;

/** Distance from p to the segment ball→middle of goal, and how far along it. */
function laneOffset(ball: Vec2, p: Vec2): { t: number; d: number } {
  const vx = CX - ball.x, vy = -ball.y;
  const L2 = vx * vx + vy * vy || 1;
  const t = ((p.x - ball.x) * vx + (p.y - ball.y) * vy) / L2;
  const tt = clamp(t, 0, 1);
  return { t, d: Math.hypot(p.x - (ball.x + vx * tt), p.y - (ball.y + vy * tt)) };
}

/** Is somebody in the lane, or closing it? Rule 5's own test. */
export function laneCovered(sc: Scenario): boolean {
  return sc.defenders.some((d) => {
    if (d.y >= sc.ball.y) return false;
    const { t, d: off } = laneOffset(sc.ball, d);
    if (t > 0.05 && t < 0.95 && off <= LANE_R) return true;
    return Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) <= CLOSING_R;
  });
}

/** The widest gap in the back line (men within 4m of the deepest). */
export function lineGap(sc: Scenario): number {
  if (sc.defenders.length < 2) return 0;
  const deepest = Math.min(...sc.defenders.map((d) => d.y));
  const xs = sc.defenders.filter((d) => d.y - deepest <= LINE_BAND).map((d) => d.x).sort((a, b) => a - b);
  let g = 0;
  for (let i = 1; i < xs.length; i++) g = Math.max(g, xs[i] - xs[i - 1]);
  return g;
}

/**
 * Rules 1 and 2 — bring the whole picture closer to goal.
 *
 * Every depth shrinks by one share, so the defence sits deeper and tighter in
 * front of you. Across the pitch, every figure keeps exactly how far he stood
 * from the line of your shot: the goal is the same 7.32m wherever you shoot
 * from, so a pure zoom would have pulled every man toward your line and made
 * a block likelier purely because the chance moved (measured: 44% of shots
 * blocked became 60%). Instead each man slides across by however much the
 * line of the shot moved at his depth — nothing at the goal line, the full
 * move of the ball at the ball's own depth. A ball too wide also comes in
 * toward the middle (rule 2). You stay exactly where you were relative to the
 * ball — your stand-off is not a distance to goal.
 */
function bringCloser(sc: Scenario, rng: () => number): void {
  const far = rng() < FAR_SHARE;
  const band = far ? FAR_BAND : NEAR_BAND;
  const target = band[0] + rng() * (band[1] - band[0]);
  const lat = sc.ball.x - CX;
  const by = Math.max(sc.ball.y, 0.1);
  const dist = Math.hypot(lat, by);
  let s = Math.min(1, target / Math.max(dist, 0.1));
  s = Math.max(s, Math.min(1, MIN_DEPTH / by));
  const newLat = clamp(lat * s, -MAX_LATERAL, MAX_LATERAL);
  const shift = newLat - lat;               // how far the ball moves across
  if (s >= 0.999 && Math.abs(shift) < 0.01) return;
  const f = (p: Vec2) => { p.x = clamp(p.x + shift * (p.y / by), 1, PITCH_W - 1); p.y = p.y * s; };
  const youOff = { x: sc.player.x - sc.ball.x, y: sc.player.y - sc.ball.y };
  sc.ball.x = CX + newLat; sc.ball.y = by * s;
  sc.player.x = sc.ball.x + youOff.x; sc.player.y = sc.ball.y + youOff.y;
  for (const p of bodies(sc)) f(p);
  if (sc.forwardMostY !== undefined) sc.forwardMostY *= s;
}

/**
 * Pulling everybody toward the goal packs them closer together. Two men must
 * never stand inside each other: push apart any pair closer than this.
 */
const MIN_SPACING = 1.1;
function unstack(sc: Scenario): void {
  const ps: Vec2[] = [...sc.defenders, ...mates(sc)];
  const fixed: Vec2[] = [sc.ball, sc.player];
  for (let it = 0; it < 6; it++) {
    let moved = false;
    for (let i = 0; i < ps.length; i++) {
      for (const q of [...ps.slice(i + 1), ...fixed]) {
        const p = ps[i];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d = Math.hypot(dx, dy);
        const want = fixed.includes(q) ? 1.4 : MIN_SPACING;
        if (d >= want) continue;
        const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
        const push = want - d;
        if (fixed.includes(q)) { p.x += ux * push; p.y += uy * push; } else {
          p.x += ux * push / 2; p.y += uy * push / 2; q.x -= ux * push / 2; q.y -= uy * push / 2;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * Rule 4 — no big hole in the back line. A set defence is compact: where the
 * line (men within 4m of the deepest) still has a gap over MAX_LINE_GAP, the
 * line tightens around its own middle until it has not. Men only slide
 * across; nobody changes depth, so the line and the offside line are the same
 * line they were.
 */
function closeTheLine(sc: Scenario): void {
  if (sc.defenders.length < 2) return;
  for (let it = 0; it < 4 && lineGap(sc) > MAX_LINE_GAP; it++) {
    const deepest = Math.min(...sc.defenders.map((d) => d.y));
    const line = sc.defenders.filter((d) => d.y - deepest <= LINE_BAND);
    const mid = line.reduce((a, d) => a + d.x, 0) / line.length;
    const k = MAX_LINE_GAP / lineGap(sc);
    for (const d of line) d.x = mid + (d.x - mid) * k;
  }
}

/**
 * Rule 5 — at least one man in, or closing, the shooting lane, so a block is
 * a real thing. Only when nobody already is: the nearest defender who is not
 * holding the back line steps into the lane, five to eight metres in front of
 * the ball, covering one side of the goal — close enough to block, not
 * standing on the ball.
 */
function screenTheLane(sc: Scenario, rng: () => number): void {
  if (!sc.defenders.length || laneCovered(sc)) return;
  const deepest = Math.min(...sc.defenders.map((d) => d.y));
  const line = new Set(sc.defenders.filter((d) => d.y - deepest <= LINE_BAND));
  // Prefer a midfielder; a back line of everybody gives up its highest man.
  const pool = sc.defenders.filter((d) => !line.has(d));
  const from = pool.length ? pool : [...sc.defenders].sort((a, b) => b.y - a.y).slice(0, 1);
  let man = from[0], best = Infinity;
  for (const d of from) {
    const dd = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y);
    if (dd < best) { best = dd; man = d; }
  }
  // Five to eight metres in front of you, on the line to goal…
  const dist = Math.hypot(sc.ball.x - CX, sc.ball.y);
  const along = (5 + rng() * 3) / dist;
  const ly = sc.ball.y * (1 - along);
  // …and showing you a side, like the man thinTheLane leaves in the lane.
  const c = coneAt(sc.ball, ly);
  const mid = (c.lo + c.hi) / 2, half = (c.hi - c.lo) / 2 + 0.6;
  const side = man.x >= mid ? 1 : -1;
  man.x = clamp(mid + side * half * (SHOW_A_SIDE[0] + rng() * (SHOW_A_SIDE[1] - SHOW_A_SIDE[0])), 2, PITCH_W - 2);
  man.y = Math.max(ly, deepest + 1);
}

/** How many men may stand in the triangle from the ball to the posts. */
export const MAX_CONE_BLOCKERS = 1;
/** …and how often a second one is left there too. */
export const SECOND_BLOCKER_SHARE = 0.3;
/** Where across the triangle the man left in it stands: a share of its
 *  half-width from its middle. Over ~0.5 he covers one post, not both. */
export const SHOW_A_SIDE: [number, number] = [0.55, 0.95];
/** Men this close to the goal line are the keeper's business, not a block. */
const CONE_FROM_Y = 4;

/** Where the triangle from the ball to the posts runs, at depth y. */
function coneAt(ball: Vec2, y: number): { lo: number; hi: number } {
  const t = (ball.y - y) / (ball.y || 1);
  const a = ball.x + (POST_L - ball.x) * t, b = ball.x + (POST_R - ball.x) * t;
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

export function coneBlockers(sc: Scenario): Vec2[] {
  return sc.defenders.filter((d) => {
    if (d.y >= sc.ball.y || d.y <= CONE_FROM_Y) return false;
    const c = coneAt(sc.ball, d.y);
    return d.x >= c.lo - 0.6 && d.x <= c.hi + 0.6;
  });
}

/**
 * Rule 5's other half: a block is REAL, not certain. Measured before this
 * file, 44% of an ordinary player's long shots hit a defender first, and
 * 60% once the chance had been brought closer — a leg is the same length
 * however far out the chance is, and a ball struck from nearer is still low
 * when it reaches him. So one man (sometimes two) stays in the triangle from
 * the ball to the posts — the nearest to you — and anybody else in it takes a
 * stride out of it, to his own side. He is still there, still able to react;
 * he is just no longer standing on your shot.
 */
function thinTheLane(sc: Scenario, rng: () => number): void {
  const keep = MAX_CONE_BLOCKERS + (rng() < SECOND_BLOCKER_SHARE ? 1 : 0);
  const inCone = coneBlockers(sc)
    .sort((p, q) => Math.hypot(p.x - sc.ball.x, p.y - sc.ball.y) - Math.hypot(q.x - sc.ball.x, q.y - sc.ball.y));
  // The man (or two) left in it shows you a side, as a defender closing a
  // shot down does — he covers one half of the goal, not the whole lot.
  for (const d of inCone.slice(0, keep)) {
    const c = coneAt(sc.ball, d.y);
    const mid = (c.lo + c.hi) / 2, half = (c.hi - c.lo) / 2 + 0.6;
    const side = d.x >= mid ? 1 : -1;
    const want = half * (SHOW_A_SIDE[0] + rng() * (SHOW_A_SIDE[1] - SHOW_A_SIDE[0]));
    if (Math.abs(d.x - mid) < want) tryMove(sc, d, [mid + side * want, mid - side * want]);
  }
  for (const d of inCone.slice(keep)) {
    const c = coneAt(sc.ball, d.y);
    const mid = (c.lo + c.hi) / 2;
    const out = 0.9 + rng() * 0.9;
    const own = d.x >= mid ? c.hi + 0.6 + out : c.lo - 0.6 - out;
    const other = d.x >= mid ? c.lo - 0.6 - out : c.hi + 0.6 + out;
    tryMove(sc, d, [own, other]);
  }
}

/** A stride across, to the first of these spots that does not open a hole in
 *  the back line bigger than baseScenario's own 11m (rule 4 wins). If none
 *  would do, he stays where he is. */
const HOLE_LIMIT = 10.7;
function tryMove(sc: Scenario, d: Vec2, xs: number[]): void {
  const was = d.x;
  for (const x of xs) {
    d.x = clamp(x, 2, PITCH_W - 2);
    if (lineGap(sc) <= Math.max(HOLE_LIMIT, gapBefore(sc, d, was))) return;
  }
  d.x = was;
}
/** The line's widest gap with this man back where he was. */
function gapBefore(sc: Scenario, d: Vec2, was: number): number {
  const now = d.x; d.x = was; const g = lineGap(sc); d.x = now; return g;
}

/**
 * Rule 3 — the trigger, in the picture: the team-mate who has just laid it
 * off to you, a few yards to one side and level or a little behind. Taken
 * from your men OUTSIDE the box where there is one, so the box stays as busy
 * as it was; otherwise the box gives up its highest man, as long as
 * BUSY_BOX_MATES of yours are still in it. He is a real option — you can play
 * it back to him — which is half of what makes shooting a decision.
 */
function layOff(sc: Scenario, rng: () => number): boolean {
  let cands = sc.secondaryRunners.filter((r) => !inBox(r.pos));
  if (!cands.length) {
    const inside = mates(sc).filter(inBox).length;
    if (inside - 1 < BUSY_BOX_MATES) return false;
    cands = [...sc.secondaryRunners].sort((a, b) => b.pos.y - a.pos.y).slice(0, 1);
  }
  if (!cands.length) return false;
  // The one who is already nearest — he moves least.
  let man = cands[0], best = Infinity;
  for (const r of cands) {
    const d = Math.hypot(r.pos.x - sc.ball.x, r.pos.y - sc.ball.y);
    if (d < best) { best = d; man = r; }
  }
  const vp = sc.viewport;
  const side = man.pos.x >= sc.ball.x ? 1 : -1;
  const place = (sd: number) => ({
    x: sc.ball.x + sd * (5 + rng() * 3),
    y: sc.ball.y + 0.5 + rng() * 3,
  });
  const inFrame = (p: Vec2) => !vp || (p.x >= vp.x1 + 1.5 && p.x <= vp.x2 - 1.5 && p.y <= vp.y2 - 1.5);
  let spot = place(side);
  if (!inFrame(spot)) spot = place(-side);
  if (!inFrame(spot)) return false;
  man.pos.x = spot.x; man.pos.y = spot.y;
  man.to.x = spot.x; man.to.y = spot.y;
  man.moving = false;
  return true;
}

// ── Setup ─────────────────────────────────────────────────────────────────

/** What setup did, for the measurement and the gallery. */
export interface LongRangeSetup {
  scale: number;
  laidOff: boolean;
  screened: boolean;
}

export function setupLongRange(sc: Scenario, rng: () => number): LongRangeSetup {
  const before = sc.ball.y;
  bringCloser(sc, rng);
  const scale = sc.ball.y / Math.max(before, 0.01);

  // Rule 7 — the keeper on his line, where the drawing put him across it.
  sc.keeper.y = KEEPER_Y[0] + rng() * (KEEPER_Y[1] - KEEPER_Y[0]);
  sc.keeper.x = clamp(sc.keeper.x, POST_L + 0.6, POST_R - 0.6);
  sc.keeper.startX = sc.keeper.x;
  sc.keeper.targetX = sc.keeper.x;
  sc.keeper.adjusting = false;

  closeTheLine(sc);
  const covered = laneCovered(sc);
  thinTheLane(sc, rng);
  screenTheLane(sc, rng);
  const laidOff = layOff(sc, rng);
  // The man a pass would be aimed at is on screen — a leftover from the
  // build could stand just outside the frame (0.7% of served long shots).
  if (sc.runner && sc.viewport) {
    const vp = sc.viewport, r = sc.runner;
    r.pos.x = clamp(r.pos.x, vp.x1 + 1.4, vp.x2 - 1.4); r.pos.y = clamp(r.pos.y, Math.max(vp.y1 + 1.4, 0.8), vp.y2 - 1.4);
    r.to.x = clamp(r.to.x, vp.x1 + 1.4, vp.x2 - 1.4); r.to.y = clamp(r.to.y, Math.max(vp.y1 + 1.4, 0.8), vp.y2 - 1.4);
  }
  unstack(sc);
  // Nobody behind his own keeper, nobody offside, none of yours in your shot —
  // the universal repairs, last, so they act on where everyone ended up.
  fixBaseScenario(sc);
  // Those repairs can move a man into or out of the back line; the line is
  // tightened once more, sideways only, and the lane rechecked.
  closeTheLine(sc);
  thinTheLane(sc, rng);
  screenTheLane(sc, rng);
  if (sc.runner) sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };
  {
    const opts = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    sc.forwardMostY = opts.length ? Math.min(...opts.map((r) => r.pos.y)) : undefined;
  }
  return { scale, laidOff, screened: !covered };
}

// ── The keeper's read ─────────────────────────────────────────────────────

const reads = new WeakMap<Ball, { t: number }>();

/** How long he takes to react, from a uniform draw and his rating. */
export function reactionFor(draw: number, keeperStrength: number): number {
  const base = READ.react[0] + draw * (READ.react[1] - READ.react[0]);
  return clamp(base - (keeperStrength - 60) * READ.perPoint, 0.1, 0.8);
}

export const longRangeRules: KindRule = {
  setup(sc, rng) {
    if (sc.kind !== "long_range") return;
    setupLongRange(sc, rng);
  },
  draws: 1,
  decide(sc, ball, draws, ctx): StrikeDecision | null {
    // Your shot at goal only. A pass is not his business until it is a shot.
    if (!ball.youStruckAtGoal || ball.vel.y >= 0) return null;
    return { kind: "long_range", data: { react: reactionFor(draws[0], ctx.keeperStrength) } };
  },
  apply(_sc, ball) {
    // Fresh per strike, so a replay starts from nothing exactly as the live
    // strike did; nothing is written into the saved decision.
    reads.set(ball, { t: 0 });
  },
  step(sc, ball, dt, d) {
    const st = reads.get(ball);
    if (!st) return;
    const k = sc.keeper;
    st.t += dt;
    // Only the shot you struck, only while it is still coming at him. A
    // deflection, a save or a scramble is the engine's business again.
    if (k.done || k.scrambling || ball.lastTouch !== "attack" || ball.loose || ball.pos.y <= k.y) {
      if (k.adjusting && !k.scrambling) k.adjusting = false;
      reads.delete(ball);
      return;
    }
    if (st.t < Number(d.data.react ?? READ.react[1])) return;
    if (ball.vel.y >= -0.5) return;
    // The line the ball is on now, carried on to his own line.
    const xAt = ball.pos.x + ball.vel.x * ((ball.pos.y - k.y) / -ball.vel.y);
    k.targetX = clamp(xAt, POST_L - 0.8, POST_R + 0.8);
    k.adjusting = true;
  },
};
