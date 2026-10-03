/**
 * The penalty ruleset — see ./index.ts for how rules plug into the match.
 *
 * Harry, playtest (26 Sep 2026), verbatim: "The goalie should always be in the
 * centre of his goal, on his line. These players should not be able to cross
 * the edge of the box line. They should be basically standing on that line,
 * and they shouldn't be able to go in the semicircle. The ball should always
 * be on the penalty spot and shouldn't be able to move it with your player
 * standing next to it, ready to kick it. The camera angle should be the same
 * every single time. It should never change for a penalty, and it should be
 * the camera angle that has it basically perfectly centred, like most of them
 * are." For the real match, Infinite Highlights, the gallery, the trial and
 * the shootout.
 *
 * ── What was wrong (measured, 200 served penalties per mode) ──
 *
 * The ten penalty drawings are served in the real match and in Infinite
 * Highlights, and the drawing layer (authoredChance.ts) floors every served
 * keeper at 1.6 m off his line, nudges the ball up to 1.2 m off the spot and
 * the other men up to 2 m — 165 of 200 real-match penalties had somebody
 * inside the box or the D, and the camera sat anywhere from 1.6 m left to
 * 1.8 m right of centre (135 different cameras in 200). The built picture
 * (gallery cards, the trial, the shootout) stands the keeper up to 0.6 m off
 * centre — the shootout keeper "one step to the left or right".
 *
 * ── The rules — applied LAST, to every penalty, whoever built it ──
 *
 *  1. The ball is on the spot.
 *  2. You stand BEHIND it, a short run-up back towards halfway (Harry, v0.15:
 *     not beside it — the drawings' 1.3 m to its right is gone).
 *  3. The keeper is in the middle of his goal, on his line: dead centre, at
 *     the engine's own goal-line depth (0.40 m — where every built penalty
 *     keeper already stands).
 *  4. Everybody else stands on the edge of the box: never across the line,
 *     never inside the D, never on top of each other (≥ 1.3 m apart), never
 *     off the picture. Each keeps his own side and roughly his own spot —
 *     which is all a drawing still decides for a penalty. So that no two
 *     penalties look the same (Harry, v0.15), a man being moved onto the
 *     line sometimes stands a step or two further back, and sometimes closes
 *     in toward the D so a few stand shoulder to shoulder. Seeded from where
 *     he was, so a replay (or applying the rules again) puts him in the same
 *     place; a man already legally on the line is left where he is.
 *  5. One camera, every time: centred on the spot, 42 m tall, hung from the
 *     goal — the builder's own penalty frame and the one all ten drawings use.
 *
 * How the keeper READS your kick is a different rule (lib/star/penaltyKeeper.ts)
 * and is left exactly as it is. Everything here is ADDED: people are moved and
 * the camera is set; canvasEngine.ts is not touched. These rules are for
 * PENALTIES ONLY: every other kind (a corner included) keeps its keeper where
 * its drawings put him. The Play Area's compare switch "Penalty rules" turns
 * them off on one device's test screens only (lib/star/compareSwitches.ts).
 */
import type { KindRule } from "./index";
import { VIEW_ASPECT, type Scenario, type Vec2, type Viewport } from "../canvasEngine";
import { CX, PEN_SPOT_Y, BOX_DEPTH, ARC_R, NET_DEPTH } from "../pitch";
import { switchOn } from "../compareSwitches";

/** Every number in one place. */
export const PENALTY = {
  /** Rule 1 — the spot. */
  spot: { x: CX, y: PEN_SPOT_Y } as Vec2,
  /** Rule 2 — where you stand, from the ball: straight behind it, a short
   *  run-up back towards halfway. */
  you: { dx: 0, dy: 1.8 },
  /** Rule 3 — the keeper: centre, on the engine's goal line (0.40 m). */
  keeper: { x: CX, y: 0.4 } as Vec2,
  /** Rule 4 — how far behind the box line a man's feet are: "basically
   *  standing on that line", never across it. */
  lineY: BOX_DEPTH + 0.35,
  /** …how far clear of the D's arc he stays. */
  dClear: 0.6,
  /** …how close two men may stand along the line. */
  spacing: 1.3,
  /** …how far inside the picture's side edges (his name is drawn above him). */
  inset: 1.6,
  /** Variety (v0.15): the share of men moved onto the line who stand further
   *  back, and how far back (metres behind the line, beyond `lineY`). */
  backShare: 0.18,
  backMax: 2.0,
  /** …and the share who close in toward the D, so a few stand side by side. */
  pullShare: 0.5,
  /** Rule 5 — the camera's height, as every other chance (canvasEngine VIEW_H). */
  viewH: 42,
};

/**
 * Rule 5 — the one penalty camera: centred on the spot, 42 m tall, its top
 * edge 3.7 m behind the goal line (the builder's own frame for a penalty,
 * measured on 200 of 200 built penalties; the ten drawings: centre 34 / 17.3,
 * height 42).
 */
export const PENALTY_VIEW: Viewport = (() => {
  const w = PENALTY.viewH * VIEW_ASPECT;
  const y1 = -(NET_DEPTH + 2.5);
  return { x1: CX - w / 2, x2: CX + w / 2, y1, y2: y1 + PENALTY.viewH };
})();

/** How far either side of the spot the D reaches at depth `y`. */
export function dHalfWidth(y: number): number {
  const dy = y - PEN_SPOT_Y;
  return Math.abs(dy) >= ARC_R ? 0 : Math.sqrt(ARC_R * ARC_R - dy * dy);
}

/** The nearest a man may stand to the middle along the line, and the furthest. */
export function lineBounds(view: Viewport = PENALTY_VIEW): { min: number; max: number } {
  const min = dHalfWidth(PENALTY.lineY) + PENALTY.dClear;
  const max = Math.min(CX - (view.x1 + PENALTY.inset), view.x2 - PENALTY.inset - CX);
  return { min, max: Math.max(min, max) };
}

/**
 * Rule 4 for a group of men: each one's x on the edge of the box, in the same
 * order they came in. Keeps his side and, as near as the law allows, his own
 * spot; pushed out of the D, kept on the picture, spaced so nobody stands in
 * anybody. A side that is full sends its extra man to the other side.
 */
export function lineSpots(xs: number[], view: Viewport = PENALTY_VIEW): number[] {
  const { min, max } = lineBounds(view);
  const cap = Math.max(1, Math.floor((max - min) / PENALTY.spacing) + 1);
  const sides: { i: number; d: number }[][] = [[], []]; // 0 = left, 1 = right
  xs.forEach((x, i) => {
    const off = x - CX;
    let s = off < 0 ? 0 : off > 0 ? 1 : (sides[0].length <= sides[1].length ? 0 : 1);
    if (sides[s].length >= cap && sides[1 - s].length < cap) s = 1 - s;
    sides[s].push({ i, d: Math.min(max, Math.max(min, Math.abs(off))) });
  });
  const out = xs.slice();
  sides.forEach((group, s) => {
    group.sort((a, b) => a.d - b.d);
    // Outward: nobody closer than `spacing` to the man inside him.
    for (let k = 1; k < group.length; k++) group[k].d = Math.max(group[k].d, group[k - 1].d + PENALTY.spacing);
    // Past the edge of the picture: pull the whole side back in.
    if (group.length && group[group.length - 1].d > max) {
      group[group.length - 1].d = max;
      for (let k = group.length - 2; k >= 0; k--) group[k].d = Math.min(group[k].d, group[k + 1].d - PENALTY.spacing);
      for (let k = 0; k < group.length; k++) group[k].d = Math.max(group[k].d, min + k * PENALTY.spacing);
    }
    for (const g of group) out[g.i] = CX + (s === 0 ? -1 : 1) * g.d;
  });
  return out;
}

/** A fixed pseudo-random share in [0,1) from a man's old spot — no stream, so
 *  a replay (or the rules applied twice) lands him in the same place. */
function spotHash(p: Vec2, k: number): number {
  const v = Math.sin(p.x * 12.9898 + p.y * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Already standing where rule 4 lets him: on the line, or a little behind it. */
const onTheLine = (p: Vec2) => p.y >= PENALTY.lineY - 1e-6 && p.y <= PENALTY.lineY + PENALTY.backMax + 1e-6;

/**
 * Rule 4 for everyone else, with the variety: x along the edge of the box
 * (`lineSpots`), y on the line or a step or two behind it. A man already
 * legally placed keeps his depth, so this is idempotent.
 */
export function arrangeOthers(ps: Vec2[], view: Viewport = PENALTY_VIEW): Vec2[] {
  const pref = ps.map((p) => {
    if (onTheLine(p)) return p.x;
    // Some close in toward the D, so a few end up shoulder to shoulder.
    if (spotHash(p, 1) < PENALTY.pullShare) return CX + (p.x - CX) * (0.3 + 0.5 * spotHash(p, 2));
    return p.x;
  });
  const xs = lineSpots(pref, view);
  return ps.map((p, i) => {
    if (onTheLine(p)) return { x: xs[i], y: p.y };
    const h = spotHash(p, 3);
    const back = h < PENALTY.backShare ? 0.6 + (h / PENALTY.backShare) * (PENALTY.backMax - 0.6) : 0;
    return { x: xs[i], y: PENALTY.lineY + back };
  });
}

/** Off the picture on purpose (a poacher the editor took out). */
const parked = (p: Vec2) => p.x < -100 || p.x > 200 || p.y > 200 || p.y < -100;

/**
 * Put a live penalty scenario under the rules. Idempotent — a penalty that
 * already obeys them is unchanged. Off (does nothing) when the compare
 * switch is off on this device's test screens.
 */
export function enforcePenalty(sc: Scenario): void {
  if (sc.kind !== "penalty" || !switchOn("penaltyRules")) return;
  // Rules 1 and 2.
  sc.ball.x = PENALTY.spot.x; sc.ball.y = PENALTY.spot.y;
  sc.player.x = PENALTY.spot.x + PENALTY.you.dx; sc.player.y = PENALTY.spot.y + PENALTY.you.dy;
  // Rule 3.
  const k = sc.keeper;
  k.x = PENALTY.keeper.x; k.startX = PENALTY.keeper.x; k.targetX = PENALTY.keeper.x;
  k.y = PENALTY.keeper.y;
  k.adjusting = false; k.scrambling = false; k.dive = 0;
  // Rule 5.
  sc.viewport = { ...PENALTY_VIEW };
  sc.facing = "up";
  sc.crossSwitchY = undefined; sc.crossSwitchView = undefined;
  // Rule 4: everybody else, in one group so they space out against each other.
  const bodies: Vec2[] = [];
  for (const d of sc.defenders) bodies.push(d);
  if (sc.runner) bodies.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) bodies.push(r.pos);
  if (!parked(sc.follower)) bodies.push(sc.follower);
  for (const t of sc.teammates) bodies.push(t);
  const at = arrangeOthers(bodies, sc.viewport);
  bodies.forEach((b, i) => { b.x = at[i].x; b.y = at[i].y; });
  for (const d of sc.defenders) { if (d.homeX !== undefined) { d.homeX = d.x; d.homeY = d.y; } }
  // A runner's `to` is where he is RUNNING — left alone he would sprint back
  // to a spot inside the box the moment the ball is struck.
  if (sc.runner) { sc.runner.to = { ...sc.runner.pos }; sc.passTarget = null; }
  for (const r of sc.secondaryRunners) r.to = { ...r.pos };
}

/** The same rules on a picture (a gallery / highlights frame), returned new. */
export function penaltyFrame<F extends {
  items: { at: Vec2; keeper?: boolean; side: string }[];
  ball: Vec2;
  camera: Viewport;
  facing?: "up" | "left" | "right";
  kind?: string;
}>(frame: F): F {
  if (frame.kind !== "penalty" || !switchOn("penaltyRules")) return frame;
  const others = frame.items.map((it, i) => ({ it, i })).filter(({ it }) => !it.keeper && it.side !== "you" && !parked(it.at));
  const at = arrangeOthers(others.map(({ it }) => it.at), PENALTY_VIEW);
  const place = new Map<number, Vec2>();
  others.forEach(({ i }, n) => place.set(i, at[n]));
  const items = frame.items.map((it, i) => {
    if (it.keeper) return { ...it, at: { ...PENALTY.keeper } };
    if (it.side === "you") return { ...it, at: { x: PENALTY.spot.x + PENALTY.you.dx, y: PENALTY.spot.y + PENALTY.you.dy } };
    const p = place.get(i);
    return p ? { ...it, at: p } : it;
  });
  return { ...frame, items, ball: { ...PENALTY.spot }, camera: { ...PENALTY_VIEW }, facing: "up" };
}

/**
 * Where a man being dragged in the editor may stand: along the edge of the
 * box only, out of the D, on the picture. (Spacing is settled when he is let
 * go, with everybody else — `penaltyFrame`.)
 */
export function penaltyDragSpot(x: number, view: Viewport = PENALTY_VIEW): Vec2 {
  const { min, max } = lineBounds(view);
  const off = x - CX;
  const side = off < 0 ? -1 : 1;
  return { x: CX + side * Math.min(max, Math.max(min, Math.abs(off))), y: PENALTY.lineY };
}

/**
 * The variety, for a served penalty (v0.15 A2). The serving no longer nudges
 * a penalty (the open-play nudge put the ball off the spot every time), so
 * "no two penalties look the same" is this rule's own: before the men are put
 * on the edge of the box, each slides along it — up to PENALTY_SLIDE_M either
 * way, from the chance's own stream. Nobody leaves his side of the D because
 * of it (lineSpots keeps sides), and the ball, you and the keeper never move.
 */
export const PENALTY_SLIDE_M = 2.0;
function slideAlongTheLine(sc: Scenario, rngIn: () => number): void {
  // One draw from the chance's stream seeds its own, so the rest of the
  // chance draws exactly what it would have.
  let a = Math.floor(rngIn() * 4294967296) >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bodies: Vec2[] = [...sc.defenders];
  if (sc.runner) bodies.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) bodies.push(r.pos);
  if (!parked(sc.follower)) bodies.push(sc.follower);
  for (const t of sc.teammates) bodies.push(t);
  // Each man's step comes from his SPOT's place in the line, not from which
  // part the engine cast him in (v0.26): the same drawing then always gives
  // the same penalty, whichever man the build made the runner. Same steps,
  // same spread — only who gets which draw is fixed.
  bodies.sort((p, q) => p.x - q.x || p.y - q.y);
  for (const b of bodies) {
    if (parked(b)) continue;
    const side = Math.sign(b.x - CX) || 1;
    const nx = b.x + (rng() * 2 - 1) * PENALTY_SLIDE_M;
    // Stays on his own side of the middle.
    b.x = (nx - CX) * side > 0.5 ? nx : CX + side * 0.5;
    // …and a touch up or down, which only decides whether rule 4's variety
    // stands him a step back or has him close in (it reads his spot).
    b.y += (rng() * 2 - 1) * 0.5;
  }
}

export const penaltyRules: KindRule = {
  setup(sc, rng) {
    if (sc.kind !== "penalty" || !switchOn("penaltyRules")) return;
    slideAlongTheLine(sc, rng);
    enforcePenalty(sc);
  },
  enforce(sc) { enforcePenalty(sc); },
};
