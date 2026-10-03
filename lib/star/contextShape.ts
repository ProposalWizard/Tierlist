/**
 * THE REST OF BOTH TEAMS — the men a chance does not need, so the new match
 * view (38 m × 71 m, lib/star/matchView.ts) looks like a real match.
 *
 * Harry, 3 Oct 2026: "the game currently sucks" in the new view. Measured
 * (v0.26 scenarios plan): every chance was drawn for the old 26 × 42 m frame,
 * so 6–12 men stand in the top third of the phone and 55–70% of the grass on
 * screen is more than 10 m from anybody. Real football at that zoom shows
 * 16–20 players.
 *
 * ── What decides what ──
 *
 *  - THE CHANCE is the drawing, untouched: the ball, you, the keeper and every
 *    man the drawing has. Nothing here moves any of them.
 *  - THE REST come from the two teams' formations (formations.ts, the same
 *    slots the team sheet uses) laid out with numbers that were measured, not
 *    guessed: the defending back line and its width from `targetBlock`
 *    (StatsBomb-360, formationShape.ts), the block's length from the
 *    playstyle's own `compactness` (25–35 m, playstyle.ts).
 *  - A drawn man fills the slot nearest him. Only the slots nobody drew get a
 *    context man, so a side never has more than ten outfield players.
 *
 * ── Why they cannot change the chance ──
 *
 * A man in this game reacts only when the ball comes within 9 m of him
 * (canvasEngine's REACT_R) and blocks only a ball that passes within about a
 * metre. So every context man is kept:
 *  - 10 m+ from the ball and from every man the chance can pass to,
 *  - out of the shot (the triangle from the ball to both posts, plus 4 m),
 *  - off every pass lane the chance has (6 m for a defender, 5 m for a mate),
 *  - never deeper than the drawn defence (the offside line stays the drawing's),
 *  - every team-mate onside,
 *  - and inside every "none of these" law the kind's drawings agree on
 *    (no defender goal-side of the ball in a one-on-one, and so on).
 * A slot that cannot be kept clear is slid up to 12 m to the nearest legal
 * spot, or left empty. Context men are REAL players (a ball sent their way
 * meets them), not decoration — that is why they must be kept clear, and why
 * the conversion is measured with them on.
 *
 * Nothing here is random: the same chance and the same formations always give
 * the same men, so a picture that was looked at is the picture served.
 *
 * canvasEngine.ts is not touched. Classic chances never call this.
 */
import { goalInView, type Defender, type Runner, type Scenario, type Vec2 } from "./canvasEngine";
import { CX, PITCH_W, POST_L, POST_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R } from "./pitch";
import { formationOf, type Formation, type Slot } from "./formations";
import { PLAYSTYLES, type PlaystyleProfile } from "./playstyle";
import { targetBlock } from "./formationShape";
import type { RuleSet } from "./scenarioRules";

/** Every context man carries this mark, so a reader (a test, a sheet, the
 *  picture memory) can tell the chance from the rest. A registered symbol,
 *  hidden from JSON and from spreads of the scenario, and the same symbol
 *  however many copies of this file a tool happens to load. */
const MARK = Symbol.for("knowitball.star.contextMan");
const CONTEXT = {
  add(o: object) { Object.defineProperty(o, MARK, { value: true, enumerable: false, configurable: true }); },
};
export const isContext = (o: object | null | undefined): boolean => !!o && (o as Record<symbol, unknown>)[MARK] === true;

/** Outfield players a side has. */
const OUTFIELD = 10;
/** Kept this far from the ball: one metre past the engine's 9 m react radius. */
export const CLEAR_OF_BALL = 10;
/** …and from any man the chance can pass to (a ball reaching him must not
 *  bring a context defender into range). */
const CLEAR_OF_TARGET = 10;
/** Off a pass lane: a defender far enough not to intercept, a mate far enough
 *  not to be the one the ball reaches first. */
const LANE_DEF = 6, LANE_MATE = 5;
/** Out of the shot: the ball→posts triangle widened by this much. */
const SHOT_CLEAR = 4;
/** No two men nearer than this. */
const GAP = 2.0;
/** The furthest a slot may be slid to find a legal spot. */
const SLIDE_MAX = 12;
/** Your side's length, back line to front line, when you have the ball. */
const ATTACK_LENGTH = 34;
/** Your side's width (full-back to full-back) when you have the ball. */
const ATTACK_WIDTH = 46;

/** Depth of a slot from its own goal line, in the formation's own units
 *  (formations.ts: the keeper at y = 0.94, a striker at 0.17). */
const depthOf = (s: Slot) => 0.94 - s.y;

const hyp = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const parked = (p: Vec2) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const sx = b.x - a.x, sy = b.y - a.y;
  const len2 = sx * sx + sy * sy;
  if (len2 < 1e-6) return hyp(p, a);
  const t = clamp(((p.x - a.x) * sx + (p.y - a.y) * sy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + sx * t), p.y - (a.y + sy * t));
}

/** Inside the shot: goal-side of the ball and within SHOT_CLEAR of the
 *  triangle from the ball to both posts. */
function inShot(p: Vec2, ball: Vec2): boolean {
  if (p.y >= ball.y + 1) return false;
  const t = ball.y <= 0 ? 0 : clamp((ball.y - p.y) / ball.y, 0, 1);
  const lo = ball.x + (POST_L - ball.x) * t, hi = ball.x + (POST_R - ball.x) * t;
  return p.x >= Math.min(lo, hi) - SHOT_CLEAR && p.x <= Math.max(lo, hi) + SHOT_CLEAR;
}

export interface ContextOptions {
  /** The defending side's formation (the opponent's real one in a match). */
  formation?: Formation | null;
  /** The defending side's playstyle (block length). */
  playstyle?: PlaystyleProfile | null;
  /** Your side's formation. */
  mine?: Formation | null;
  /** The kind's rule set, so its "none of these" laws hold for context men too. */
  laws?: RuleSet | null;
}

export interface ContextReport {
  defenders: number;
  mates: number;
  /** Slots that could not be kept clear of the chance and were left empty. */
  dropped: number;
}

/** The men a chance already has, in the shape this file reads. */
function chanceBodies(sc: Scenario) {
  const defs = sc.defenders.filter((d) => !parked(d));
  const mates: Vec2[] = [];
  if (sc.runner && !parked(sc.runner.pos)) mates.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) if (!parked(r.pos)) mates.push(r.pos);
  if (goalInView(sc.kind) && !parked(sc.follower)) mates.push(sc.follower);
  for (const t of sc.teammates) if (!parked(t)) mates.push(t);
  /** Where the ball can be played: to any of your men in the chance. Every
   *  one, not only the ones the builder made runners — which man the engine
   *  casts as the pass target changes from build to build, and the rest of
   *  the team must not (a picture that was looked at is the picture served). */
  const targets: Vec2[] = [...mates];
  return { defs, mates, targets };
}

/** Is a "none of these" law in force for this kind? */
function law(laws: RuleSet | null | undefined, id: string): boolean {
  const r = laws?.rules.find((x) => x.id === id);
  return !!r && r.invariant && r.at === 0;
}

/** Greedy nearest: which slots the drawn men already stand in. */
function freeSlots(spots: Vec2[], drawn: Vec2[], want: number): Vec2[] {
  const left = spots.map((p, i) => ({ p, i }));
  // In a fixed order (by spot, never by which man the engine cast as what),
  // so the same picture always frees the same slots.
  const order = [...drawn].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const d of order) {
    if (!left.length) break;
    let bi = 0, bd = Infinity;
    left.forEach((s, k) => { const dd = hyp(s.p, d); if (dd < bd) { bd = dd; bi = k; } });
    left.splice(bi, 1);
  }
  return left.slice(0, Math.max(0, want)).map((s) => s.p);
}

/**
 * The defending side's ten outfield spots for this ball, before anyone drawn
 * takes his: the measured back line (`targetBlock`), the rest of the
 * formation stacked in front of it over the playstyle's block length.
 */
function defendingSpots(ball: Vec2, f: Formation, ps: PlaystyleProfile, beaten: boolean, deepestDrawn: number): Vec2[] {
  const out = f.slots.filter((s) => s.role !== "GK");
  const t = targetBlock({ formation: f, playstyle: ps, attackerStrength: 60, defenderStrength: 60 }, ball.x, clamp(ball.y, 6, 60));
  const back = Math.min(...out.map(depthOf));
  const front = Math.max(...out.map(depthOf));
  const k = ps.compactness / Math.max(0.1, front - back);
  // The back line: the measured one, or — for a ball in the box, where the
  // drawn defence IS the back line — level with the drawn men. A beaten
  // defence (a one-on-one) is chasing back behind the ball.
  let lineY = Math.max(t.lineY, deepestDrawn);
  if (beaten) lineY = Math.max(lineY, ball.y + 4);
  const xs = out.map((s) => s.x);
  const half = Math.max(0.2, (Math.max(...xs) - Math.min(...xs)) / 2);
  return out.map((s) => {
    const d = depthOf(s) - back;
    // Midfield lines stretch a little wider than the back line; strikers sit
    // narrower (measured back-four width from targetBlock; the rest reasoned).
    const widen = d < 0.05 ? 1 : d < 0.5 ? 1.25 : 0.8;
    return {
      x: CX + t.blockShift + ((s.x - 0.5) / half) * (t.span / 2) * widen,
      y: lineY + d * k,
    };
  });
}

/** Your side's ten outfield spots: front line level with their back line,
 *  the rest behind it over ATTACK_LENGTH, ATTACK_WIDTH wide. */
function attackingSpots(ball: Vec2, f: Formation, frontY: number): Vec2[] {
  const out = f.slots.filter((s) => s.role !== "GK");
  const back = Math.min(...out.map(depthOf));
  const front = Math.max(...out.map(depthOf));
  const k = ATTACK_LENGTH / Math.max(0.1, front - back);
  const shift = clamp((ball.x - CX) * 0.25, -6, 6);
  return out.map((s) => ({
    x: CX + shift + (s.x - 0.5) * ATTACK_WIDTH,
    y: frontY + (front - depthOf(s)) * k,
  }));
}

/**
 * A line of real players is never ruler-straight. Each spot gets its own
 * small, fixed offset (up to 1.4 m across, 1.0 m up or down), worked out from
 * the ball's depth and the spot itself (never the order men were placed in),
 * so the same chance always gives the same offsets and a picture that was
 * looked at is the picture served.
 */
function loosen(p: Vec2, ball: Vec2, side: number): Vec2 {
  let h = (Math.round(ball.y * 4) * 73856093) ^ (Math.round(p.x * 4) * 19349663) ^ (Math.round(p.y * 4) * 83492791) ^ (side * 2654435761);
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
    return ((h >>> 0) / 4294967296) * 2 - 1;
  };
  return { x: p.x + next() * 1.4, y: p.y + next() * 1.0 };
}

/** Set pieces have no formation to read: their own spots, by the laws. */
function setPieceSpots(kind: string, b: Vec2, side: "def" | "att"): Vec2[] {
  if (kind === "penalty") {
    // Everyone else outside the area and the D, behind the ball (Law 14):
    // along the edge of the box, then a second row further out.
    const row: Vec2[] = [];
    for (const y of [18.5, 21, 26]) for (let i = 0; i < 9; i++) {
      const x = CX + (i % 2 ? 1 : -1) * (5 + Math.floor(i / 2) * 4.5) + (side === "att" ? 2.2 : 0);
      if (Math.hypot(x - CX, y - PEN_SPOT_Y) < ARC_R + 1) continue;
      row.push({ x, y });
    }
    return row;
  }
  if (kind === "corner") {
    // Defending: forwards left up for the counter. Attacking: the edge of the
    // box for the second ball, then the centre-backs holding at halfway.
    return side === "def"
      ? [{ x: CX - 4, y: 34 }, { x: CX + 6, y: 38 }, { x: CX, y: 24 }, { x: CX - 12, y: 26 }, { x: CX + 12, y: 27 }]
      : [{ x: CX + 2, y: 23 }, { x: CX - 9, y: 44 }, { x: CX + 9, y: 46 }, { x: CX - 20, y: 36 }, { x: CX + 20, y: 37 }];
  }
  // A free kick: the rest stand behind the ball, well clear of the strike.
  const s = b.x >= CX ? -1 : 1;
  return side === "def"
    ? [{ x: CX + s * 4, y: b.y + 14 }, { x: CX - s * 6, y: b.y + 20 }, { x: CX + s * 14, y: b.y + 8 }, { x: CX - s * 16, y: b.y + 10 }, { x: CX, y: b.y + 28 }, { x: CX + s * 10, y: b.y + 24 }]
    : [{ x: CX - s * 8, y: b.y + 12 }, { x: CX + s * 9, y: b.y + 26 }, { x: CX - s * 9, y: b.y + 30 }, { x: CX + s * 18, y: b.y + 18 }, { x: CX - s * 20, y: b.y + 20 }, { x: CX, y: b.y + 38 }];
}

/**
 * Lay the rest of both teams around a chance that is already made. Returns
 * how many men were added. Safe to call on a chance with no room: it adds
 * nobody rather than anybody in the way.
 */
export function addContext(sc: Scenario, o: ContextOptions = {}): ContextReport {
  const report: ContextReport = { defenders: 0, mates: 0, dropped: 0 };
  // Everything is worked out with the ball on the RIGHT, and mirrored back at
  // the end: the same picture taken from the other side (a corner from the
  // other flag) then gets exactly the mirror image of the same men.
  const flip = sc.ball.x < CX;
  // Rounded to a micron, so a picture laid on from the other flag (68 − x,
  // twice) lands on exactly the same numbers as the original.
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const M = (p: Vec2): Vec2 => (flip ? { x: r6(PITCH_W - p.x), y: r6(p.y) } : { x: r6(p.x), y: r6(p.y) });
  const raw = chanceBodies(sc);
  const defs = raw.defs.map(M), mates = raw.mates.map(M), targets = raw.targets.map(M);
  const ball = M(sc.ball), you = M(sc.player), keeper = M(sc.keeper);
  const goal = goalInView(sc.kind);
  const deadBall = sc.kind === "corner" || sc.kind === "penalty" || sc.kind === "free_kick";
  // The formations are read in the same (ball-on-the-right) frame, never
  // mirrored, so both flags give exact mirror images.
  const f = o.formation ?? formationOf("442");
  const ps = o.playstyle ?? PLAYSTYLES["mid-block"];
  const mine = o.mine ?? formationOf("433");
  const noneGoalSide = law(o.laws, "defGoalSide");
  // Never deeper than the drawn defence: the offside line stays the drawing's.
  const outfieldYs = defs.map((d) => d.y).sort((a, b) => a - b);
  const deepest = outfieldYs.length ? outfieldYs[0] : Math.max(4, ball.y * 0.6);
  // The line your men must stay behind: the second-last defender (the keeper
  // is the last), or the ball if that is further back.
  const offsideY = Math.min(ball.y, deepest);
  const lanes: [Vec2, Vec2][] = targets.map((t) => [ball, t]);

  const placed: Vec2[] = [];
  const everyone = (): Vec2[] => [ball, you, keeper, ...defs, ...mates, ...placed];

  const legal = (p: Vec2, side: "def" | "att"): boolean => {
    if (p.x < 1.5 || p.x > PITCH_W - 1.5 || p.y < 1 || p.y > 95) return false;
    // A free kick's wall is "whoever stands within 12.5 m of the ball"
    // (kindRules/freeKick.ts), so there the rest keep 13 m off.
    const clear = sc.kind === "free_kick" ? 13 : CLEAR_OF_BALL;
    if (hyp(p, ball) < clear || hyp(p, you) < clear - 2) return false;
    if (sc.kind !== "penalty" && targets.some((t) => hyp(p, t) < (side === "def" ? CLEAR_OF_TARGET : 6))) return false;
    if (goal && inShot(p, ball)) return false;
    if (lanes.some(([a, b]) => distToSegment(p, a, b) < (side === "def" ? LANE_DEF : LANE_MATE))) return false;
    if (everyone().some((q) => hyp(p, q) < GAP)) return false;
    if (p.y < keeper.y + 2) return false;
    if (side === "def") {
      if (defs.length && p.y < deepest + 0.5) return false;
      if (noneGoalSide && p.y < ball.y + 1) return false;
    } else {
      if (p.y < offsideY + 0.5) return false;
    }
    if (sc.kind === "penalty") {
      // Law 14: outside the area, outside the D, behind the ball.
      const inArea = p.y < BOX_DEPTH + 0.5 && p.x > 13.3 && p.x < PITCH_W - 13.3;
      if (inArea || Math.hypot(p.x - CX, p.y - PEN_SPOT_Y) < ARC_R + 0.5 || p.y < PEN_SPOT_Y) return false;
    }
    return true;
  };

  /** The slot itself, or the nearest legal spot within SLIDE_MAX — searched
   *  away from the ball first. */
  const settle = (spot: Vec2, side: "def" | "att"): Vec2 | null => {
    const s = { x: clamp(spot.x, 2, PITCH_W - 2), y: clamp(spot.y, 2, 94) };
    if (legal(s, side)) return s;
    const away = Math.atan2(s.y - ball.y, s.x - ball.x);
    for (let r = 1.5; r <= SLIDE_MAX; r += 1.5) {
      for (let a = 0; a < 16; a++) {
        const ang = away + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * (Math.PI / 8);
        const p = { x: s.x + Math.cos(ang) * r, y: s.y + Math.sin(ang) * r };
        if (legal(p, side)) return p;
      }
    }
    return null;
  };

  // ── The defending side ──
  const wantD = OUTFIELD - defs.length;
  const dSpots = deadBall
    ? setPieceSpots(sc.kind, ball, "def").slice(0, wantD)
    : freeSlots(defendingSpots(ball, f, ps, noneGoalSide, deepest), defs, wantD);
  for (let i = 0; i < dSpots.length; i++) {
    const p = settle(loosen(dSpots[i], ball, 1), "def");
    if (!p) { report.dropped++; continue; }
    const at = M(p);
    const d: Defender = { x: at.x, y: at.y };
    CONTEXT.add(d);
    sc.defenders.push(d);
    placed.push(p);
    report.defenders++;
  }

  // ── Your side ──
  const wantM = OUTFIELD - 1 - mates.length;
  const frontY = Math.max(offsideY + 1, deepest + 1);
  const mSpots = deadBall
    ? setPieceSpots(sc.kind, ball, "att").slice(0, wantM)
    : freeSlots(attackingSpots(ball, mine, frontY), [you, ...mates], wantM);
  for (let i = 0; i < mSpots.length; i++) {
    const p = settle(loosen(mSpots[i], ball, 2), "att");
    if (!p) { report.dropped++; continue; }
    const at = M(p);
    placed.push(p);
    if (deadBall) {
      // At a dead ball the extra men stand, as a drawing's own extras do.
      const t = { x: at.x, y: at.y };
      CONTEXT.add(t);
      sc.teammates.push(t);
    } else {
      // In open play a team-mate is a real support runner you can pass to.
      const r: Runner = {
        pos: { x: at.x, y: at.y }, to: { x: at.x, y: at.y },
        speed: sc.runner?.speed ?? 6.65, moving: false, role: "support", sprint: false,
      };
      CONTEXT.add(r);
      CONTEXT.add(r.pos);
      sc.secondaryRunners.push(r);
    }
    report.mates++;
  }
  return report;
}

/** The chance without its context men, for anything that measures the chance
 *  itself (the picture memory, the rule sets, the tests). */
export function withoutContext(sc: Scenario): Scenario {
  return {
    ...sc,
    defenders: sc.defenders.filter((d) => !isContext(d)),
    secondaryRunners: sc.secondaryRunners.filter((r) => !isContext(r)),
    teammates: sc.teammates.filter((t) => !isContext(t)),
  };
}
