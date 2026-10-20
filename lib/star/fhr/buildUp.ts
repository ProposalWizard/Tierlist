/**
 * PHASE 2 OF THE FULL HIGHLIGHTS REBUILD — a GENERATED 4–8 s build-up before
 * every open-play chance (Harry, 19 Oct 2026: "random build up generates
 * easily … generate different build-ups every time … every open-play chance
 * gets a build-up, show all of them for now; never penalties or free kicks").
 *
 * Only with Settings → "Full highlights rebuild: On (test)" (careerBuildUp in
 * leadInGen.ts asks this file only when fhrOn()). Off: today's game exactly.
 *
 * How one is made (all seeded by the chance itself, so the same chance always
 * gets the same build-up and two chances never share one):
 *
 *   1. HOW LONG AND HOW FAST. The length is drawn from how long real attacks
 *      that end in a shot last, and the forward speed from how fast they move
 *      (patterns.json `attack`, Wyscout, 1,941 matches), cut to 4–8 s. A break
 *      (the radar's "transition") is shorter and quicker than settled play.
 *   2. THE BALL'S ROUTE, worked back from the chance's own ball. The last one
 *      or two touches come from the real sequences that most often lead to a
 *      shot (or a cross) from that part of the pitch (`chains`, the 500 most
 *      common). Before that, each earlier touch is drawn from where real
 *      passes and carries INTO that zone come from (`moves`, zone-to-zone
 *      tables, by the team's tier), leaning the way the radar says the move
 *      goes (its lane) and back up the pitch as far as the speed asks for.
 *   3. EVERYONE ELSE, from the real team shape. Each man in the chance is
 *      matched to a role (LB, CB, DM … ST) and follows where that role stands
 *      for wherever the ball is (`roles`, tracking of 27 matches), in or out
 *      of possession, plus his own small offset, which grows into exactly his
 *      place in the chance by the end. The man nearest the ball when the move
 *      starts presses it from a real pressing distance (`press`).
 *   4. WHO PLAYS IT. Each touch is played by one of the chance's own
 *      team-mates when he can get there and back in time (a better passer is
 *      picked for a pass, a better dribbler for a carry), sometimes by you (a
 *      one-two), and otherwise by a team-mate who is only in the build-up,
 *      played from out of the chance's frame. The last touch is always yours.
 *   5. CHECKED, then retried with the next seed if anything is wrong: nobody
 *      faster than a man can run (his role's top speed, his pace), nobody
 *      running through anybody (they are eased apart), nobody between the
 *      keeper and his goal, the man on the ball always at it, and nobody who
 *      is only in the build-up still inside the chance's frame at the end.
 *
 * Everyone ends EXACTLY where the drawing has him and the ball on the
 * drawing's ball, so the playable moment is unchanged. Played by the real
 * match's lead-in replay (CanvasMatch's `leadIn` prop): nothing is stepped,
 * no physics, no new loop.
 *
 * Added in B2 (Harry, 20 Oct 2026), all still behind the switch:
 *   - PLAYERS ALREADY MOVING (FHR-1 phase 3): the men are still running at
 *     the hand-over. Each runs on a little past the moment (`runOnS`, at most
 *     FHR_RUNON_MAX_M) and eases into his place while you aim; the run-on is
 *     a replay too (CanvasMatch's run-on step), stopped the instant you kick.
 *   - THE EXTRA DEFENDER (FHR-3): when the defence is thin, a covering
 *     defender jogs, then sprints in from off the screen and ends behind the
 *     ball (so he never moves the offside line). `coverSpotFor` decides.
 *   - LONGER AT BIG MOMENTS: `momentDrama` (late, close, final) stretches the
 *     length and quickens the passing (`fhrTempo`); drama 0 is the old tempo
 *     exactly. FhrAdjust is the test pages' small Length/Intensity control.
 *   - FOULS BEFORE SET PIECES (FHR-4): foulBuildUp.ts, not this file.
 *
 * Pure: no React, no canvas. tests/star/fhr.mts measures it;
 * scripts/fhr/buildup-sheet.mts draws 48 of them to check by eye.
 */
import { goalInView, type Scenario, type ScenarioKind, type Vec2, type Viewport, type Identity } from "../canvasEngine";
import type { Zone } from "../hiddenMatch";
import { leadInEntities, leadInCamera, ballAlong, LEAD_MAX_RUN, type LeadIn, type LeadMoment, type LeadBallKey } from "../leadIn";
import { fhrIntel, type FhrIntel } from "./intel";
import { PITCH_W, CX, HALF_LEN, GOAL_W } from "../pitch";
import PJ from "./patterns.json";

interface Patterns {
  xEdges: number[]; yEdges: number[];
  moves: Record<string, { pass: number[][]; carry: number[][]; passLen: number[][] }>;
  chains: { acts: [string, number][]; end: number; endType: string; n: number }[];
  attack: Record<string, { seconds: number[]; speed: number[]; counterShare: number }>;
  roles: { in: Record<string, number[][]>; out: Record<string, number[][]> };
  speeds: Record<string, [number, number]>;
  press: number[][];
  credit: string[];
}
const P = PJ as unknown as Patterns;
/** The credit lines the data asks for (data/opendata/LICENCES.md). */
export const FHR_DATA_CREDIT: readonly string[] = P.credit;

// ─────────────────────────────────────────────────────────────────────────
//  The numbers
// ─────────────────────────────────────────────────────────────────────────

/** The shortest and longest build-up, seconds. */
export const FHR_MIN_S = 4;
export const FHR_MAX_S = 8;
/** A break is shorter: its longest, seconds. */
export const FHR_BREAK_MAX_S = 6.5;
/** After the last touch reaches you: the moment before the chance is yours, seconds. */
export const FHR_TAIL_S = 0.25;
/** Nobody runs faster than this (m/s), whatever his pace. */
export const FHR_TOP_SPEED = LEAD_MAX_RUN;
/** Two men never closer than this while the build-up plays (m): they are eased apart. */
export const FHR_SPACE_M = 1.6;
/** The checks call two men "through each other" below this (m). */
export const FHR_OVERLAP_M = 1.0;
/** Tries with the next seed before the best one is kept. */
export const FHR_TRIES = 24;
/** …and for each fallback (without the regain, without the covering defender). */
export const FHR_FALLBACK_TRIES = 10;
/** How often each man's path is stored, per second. */
const HZ = 15;

/**
 * PHASE 3 — PLAYERS ALREADY MOVING (Harry, 20 Oct 2026: "GO"). At the hand-over
 * the men in the chance are still running: each one eases to a stop on his
 * drawn spot over up to this long after the chance is yours, while you aim
 * (CanvasMatch's run-on). Strike it sooner and they stop where they are; from
 * the strike the engine moves everyone exactly as before.
 */
export const FHR_RUNON_S = 0.9;
/** The most a man is still short of his drawn spot at the hand-over (m). */
export const FHR_RUNON_MAX_M = 1.6;

// ─────────────────────────────────────────────────────────────────────────
//  HOW BIG THE MOMENT IS (Harry, 20 Oct 2026: "automatic and natural … in a
//  final, you get a big, longer build-up in the 90th minute")
// ─────────────────────────────────────────────────────────────────────────
//
// The match hands the build-up its minute, the score and what is at stake
// (LeadMoment.minute / scoreDiff / stakes). A late, level chance in a final
// gets the longest, most patient build-up; an ordinary chance gets exactly
// the 4–8 s it always had. Absent (the ruler, a test with no match): drama 0,
// so the route is drawn exactly as before this existed.

/** The longest a build-up runs at the biggest moment (a level final, 90th minute), seconds. */
export const FHR_BIG_MAX_S = 11.5;
/** Its shortest, then. */
export const FHR_BIG_MIN_S = 6.2;

/** The test pages' adjust (never the career): what moment to play, how long, how intense. */
export interface FhrAdjust {
  /** "auto": from the match; "normal": an ordinary moment; "big": a level final in the 90th minute. */
  moment?: "auto" | "normal" | "big";
  length?: "short" | "auto" | "long";
  intensity?: "calm" | "auto" | "high";
}
export const FHR_ADJUST_AUTO: Required<FhrAdjust> = { moment: "auto", length: "auto", intensity: "auto" };

/** How big a moment is, 0 (ordinary) to 1 (the 90th minute of a final, level). */
export function momentDrama(m: Pick<LeadMoment, "minute" | "scoreDiff" | "stakes">): number {
  const late = m.minute === undefined ? 0 : clamp((m.minute - 72) / 18, 0, 1);
  const d = m.scoreDiff === undefined ? 2 : Math.abs(m.scoreDiff);
  const close = d === 0 ? 1 : d === 1 ? 0.75 : 0.15;
  const stake = m.stakes === "final" ? 1 : m.stakes === "knockout" ? 0.55 : m.stakes === "league" ? 0.2 : 0;
  return clamp(late * close * (0.45 + 0.55 * stake) + 0.15 * stake * close, 0, 1);
}

/** The moment a test page's adjust stands for (auto: the match's own). */
export function adjustedMoment(m: LeadMoment, a?: FhrAdjust): LeadMoment {
  if (!a || !a.moment || a.moment === "auto") return m;
  if (a.moment === "big") return { ...m, minute: 90, scoreDiff: 0, stakes: "final" };
  return { ...m, minute: undefined, scoreDiff: undefined, stakes: undefined };
}

/** What the moment (and a test page's adjust) asks of the build-up. */
export interface FhrTempo {
  drama: number;
  /** Settled play: the length is drawn from the data between these (s). */
  minS: number;
  maxS: number;
  /** A break's. */
  breakMinS: number;
  breakMaxS: number;
  /** The shortest it may be once the touches are timed (s). */
  padS: number;
  /** × the time on the ball between touches (lower = quicker). */
  touch: number;
  /** × the distance the nearest defender presses from (lower = tighter). */
  press: number;
}

export function fhrTempo(m: LeadMoment, a?: FhrAdjust): FhrTempo {
  const d = momentDrama(m);
  const len = a?.length === "short" ? 0.72 : a?.length === "long" ? 1.3 : 1;
  const it = a?.intensity ?? "auto";
  const touch = it === "calm" ? 1.25 : it === "high" ? 0.8 : 1 - 0.12 * d;
  const press = it === "calm" ? 1.3 : it === "high" ? 0.72 : 1 - 0.22 * d;
  const by = (a0: number, b0: number) => a0 + (b0 - a0) * d;
  const sc = (v: number) => (len === 1 ? v : Math.max(3, v * len));
  return {
    drama: d,
    minS: sc(by(4.6, FHR_BIG_MIN_S)), maxS: sc(by(FHR_MAX_S, FHR_BIG_MAX_S)),
    breakMinS: sc(by(FHR_MIN_S, 5)), breakMaxS: sc(by(FHR_BREAK_MAX_S, 8.5)),
    padS: sc(by(FHR_MIN_S, 5.2)),
    touch, press,
  };
}

/** Set pieces never get a build-up. */
const SET_PIECES: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["penalty", "free_kick", "corner"]);

/** Whether a chance gets a generated build-up (when the switch is On). Every fresh open-play chance does. */
export function fhrWantsBuildUp(kind: ScenarioKind, moment: Pick<LeadMoment, "fresh" | "pattern">): boolean {
  return !!moment.fresh && !SET_PIECES.has(kind) && moment.pattern !== "set_piece";
}

// ─────────────────────────────────────────────────────────────────────────
//  The pitch and the data's frame
// ─────────────────────────────────────────────────────────────────────────

const LEN = 2 * HALF_LEN;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Vec2, b: Vec2, f: number): Vec2 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const smooth = (f: number) => { const c = clamp(f, 0, 1); return c * c * (3 - 2 * c); };

/** A point of ours in the data's frame (x 0..100 own goal → their goal, y 0..100 left → right). */
const toData = (p: Vec2) => ({ X: (LEN - p.y) / 1.05, Y: p.x / 0.68 });
/** The data's frame (attacking) back to the pitch. */
const fromData = (X: number, Y: number): Vec2 => ({ x: Y * 0.68, y: LEN - X * 1.05 });
/** The defending team's frame back to the pitch (their own goal is our y = 0). */
const fromDataDef = (X: number, Y: number): Vec2 => ({ x: PITCH_W - Y * 0.68, y: X * 1.05 });

const XE = P.xEdges, YE = P.yEdges;
const binOf = (v: number, edges: number[]) => { for (let i = 1; i < edges.length - 1; i++) if (v < edges[i]) return i - 1; return edges.length - 2; };
/** The coarse zone (0..29) a pitch point is in, our frame. */
export function zoneOf(p: Vec2): number { const d = toData(p); return binOf(d.X, XE) * 5 + binOf(d.Y, YE); }
const mirrorZone = (z: number) => Math.floor(z / 5) * 5 + (4 - (z % 5));
/** A zone's box on the pitch. */
function zoneBox(z: number) {
  const ix = Math.floor(z / 5), iy = z % 5;
  const a = fromData(XE[ix], YE[iy]), b = fromData(XE[ix + 1], YE[iy + 1]);
  return { x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x), y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y) };
}
const zoneCentre = (z: number): Vec2 => { const b = zoneBox(z); return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }; };
const inPitch = (p: Vec2, m = 2): Vec2 => ({ x: clamp(p.x, m, PITCH_W - m), y: clamp(p.y, m + 1, LEN - m) });

// Zone centres (data units) for the role spots, which are kept per zone.
const XC = XE.slice(0, -1).map((e, i) => (e + XE[i + 1]) / 2);
const YC = YE.slice(0, -1).map((e, i) => (e + YE[i + 1]) / 2);
type RoleTable = Record<string, number[][]>;
const ROLES = P.roles as { in: RoleTable; out: RoleTable };
/** A role's average spot (and spread) for a ball at (X, Y), both in the team's own frame: blended between zone centres. */
function roleSpot(phase: "in" | "out", role: string, X: number, Y: number): [number, number, number, number] {
  const tab = ROLES[phase][role] ?? ROLES[phase].CM ?? ROLES[phase].DM;
  const fi = (v: number, c: number[]) => {
    if (v <= c[0]) return [0, 0, 0] as const;
    for (let i = 0; i < c.length - 1; i++) if (v <= c[i + 1]) return [i, i + 1, (v - c[i]) / (c[i + 1] - c[i])] as const;
    return [c.length - 1, c.length - 1, 0] as const;
  };
  const [x0, x1, fx] = fi(X, XC), [y0, y1, fy] = fi(Y, YC);
  const at = (ix: number, iy: number) => tab[ix * 5 + iy];
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const a = at(x0, y0)[k] * (1 - fy) + at(x0, y1)[k] * fy;
    const b = at(x1, y0)[k] * (1 - fy) + at(x1, y1)[k] * fy;
    out[k] = a * (1 - fx) + b * fx;
  }
  return out;
}

/** One team's ten outfield roles (a 4-3-3; both centre-backs come from the CB spot, split across). */
const SHAPE: { role: string; dy: number }[] = [
  { role: "LB", dy: 0 }, { role: "CB", dy: -9 }, { role: "CB", dy: 9 }, { role: "RB", dy: 0 },
  { role: "DM", dy: 0 }, { role: "CM", dy: 0 }, { role: "AM", dy: 0 },
  { role: "LW", dy: 0 }, { role: "ST", dy: 0 }, { role: "RW", dy: 0 },
];

// ─────────────────────────────────────────────────────────────────────────
//  Sampling from the data
// ─────────────────────────────────────────────────────────────────────────

/** A seeded random stream (mulberry32). */
function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const gauss = (r: Rng) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function pick<T>(items: T[], w: number[], r: Rng): T {
  let tot = 0;
  for (const x of w) tot += Math.max(0, x);
  if (!(tot > 0)) return items[Math.floor(r() * items.length)];
  let u = r() * tot;
  for (let i = 0; i < items.length; i++) { u -= Math.max(0, w[i]); if (u <= 0) return items[i]; }
  return items[items.length - 1];
}
/** The quantile curve p10 / p25 / p50 / p75 / p90 as a function of u (straight between, flat past the ends). */
const QU = [0.1, 0.25, 0.5, 0.75, 0.9];
function quantile(q: number[], u: number): number {
  if (u <= QU[0]) return q[0];
  for (let i = 0; i < QU.length - 1; i++) if (u <= QU[i + 1]) return q[i] + ((q[i + 1] - q[i]) * (u - QU[i])) / (QU[i + 1] - QU[i]);
  return q[q.length - 1];
}
function cdf(q: number[], v: number): number {
  if (v <= q[0]) return QU[0];
  for (let i = 0; i < q.length - 1; i++) if (v <= q[i + 1]) return QU[i] + ((QU[i + 1] - QU[i]) * (v - q[i])) / Math.max(1e-6, q[i + 1] - q[i]);
  return QU[QU.length - 1];
}
/** A value from the data's distribution, kept between lo and hi (drawn inside that slice of it). */
const drawBetween = (q: number[], lo: number, hi: number, r: Rng) => {
  const a = cdf(q, lo), b = cdf(q, hi);
  return clamp(quantile(q, a + (b - a) * r()), lo, hi);
};

type Tier = "top" | "mid" | "bottom" | "all";
type Moves = { pass: number[][]; carry: number[][]; passLen: number[][] };
const MOVES = P.moves as Record<Tier, Moves>;
type Chain = { acts: [string, number][]; end: number; endType: string; n: number };
const CHAINS = P.chains as Chain[];
const ATTACK = P.attack as Record<Tier, { seconds: number[]; speed: number[]; counterShare: number }>;

/**
 * B2b: the real teams the route is drawn from, blended by how the two sides
 * compare (intel.ts `tiers`: a much better side passes like the top of the
 * league, a much worse one like the bottom, smoothly in between). Strengths
 * unknown: the whole league's tables, as before. Each tier's tables count
 * equally (scaled by its own total), passes and carries together, so the
 * carry share inside a tier is its own.
 */
const blendCache = new Map<string, { mv: Moves; at: { seconds: number[]; speed: number[] } }>();
function dataFor(ix: FhrIntel): { mv: Moves; at: { seconds: number[]; speed: number[] } } {
  if (!ix.known) return { mv: MOVES.all, at: ATTACK.all };
  const key = `${ix.tiers.top.toFixed(2)}/${ix.tiers.bottom.toFixed(2)}`;
  const hit = blendCache.get(key);
  if (hit) return hit;
  const ws: [Tier, number][] = (["top", "mid", "bottom"] as Tier[]).map((t) => [t, ix.tiers[t as "top" | "mid" | "bottom"]]);
  const tot = (t: Tier) => { let n = 0; for (const r of MOVES[t].pass) for (const v of r) n += v; for (const r of MOVES[t].carry) for (const v of r) n += v; return n || 1; };
  const grid = (pick: (m: Moves) => number[][]) => pick(MOVES.mid).map((row, i) => row.map((_, j) => ws.reduce((s0, [t, w]) => s0 + (w ? (w * pick(MOVES[t])[i][j]) / tot(t) : 0), 0) * 1e6));
  const avg = (pick: (t: Tier) => number[]) => pick("mid").map((_, i) => ws.reduce((s0, [t, w]) => s0 + w * pick(t)[i], 0));
  const out = {
    mv: { pass: grid((m) => m.pass), carry: grid((m) => m.carry), passLen: MOVES.mid.passLen.map((row, i) => row.map((_, j) => ws.reduce((s0, [t, w]) => s0 + w * MOVES[t].passLen[i][j], 0))) },
    at: { seconds: avg((t) => ATTACK[t].seconds), speed: avg((t) => ATTACK[t].speed) },
  };
  blendCache.set(key, out);
  return out;
}
const SPEEDS = P.speeds as Record<string, [number, number]>;
const PRESS = P.press as number[][];

/** A chain's action type → how the ball moves. */
const isCarryType = (t: string) => t === "touch" || t === "dribble" || t === "acceleration";

// ─────────────────────────────────────────────────────────────────────────
//  The ball's route
// ─────────────────────────────────────────────────────────────────────────

/** One touch of the ball: a pass or a carry from `from` to `to`. */
export interface FhrAction {
  type: "pass" | "carry";
  from: Vec2;
  to: Vec2;
  /** A pass in the air: its top height (m). */
  h: number;
  /** From the data: "chain" (a real sequence into the chance) or "moves" (the zone tables). */
  src: "chain" | "moves" | "break";
  /**
   * B2b: the last ball to you into the box or down the side, played into
   * space ahead of your run (slower, so you can be onside when it is hit and
   * still get there first). Absent: a pass to feet.
   */
  through?: boolean;
  t0: number;
  t1: number;
}

const passSpeed = (len: number, h: number) => (h > 0 ? clamp(10 + 0.28 * len, 14, 21) : clamp(9 + 0.3 * len, 10, 19));
/** B2b: a ball into space runs this much slower than one to feet. */
export const THROUGH_BALL_PACE = 0.72;
/** …and it is the last ball to you when the chance's ball is this near their goal line (m), or the chance is a run in behind. */
const THROUGH_BALL_Y = 16;
const THROUGH_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["one_on_one", "through_ball", "cutback", "tight_angle", "byline_cross"]);
const CARRY_SPEED = 6.2;
const BREAK_CARRY_SPEED = 6.8;

/**
 * B2b: WHERE THE BALL WAS WON (the match's own regain, hiddenMatch.ts's
 * request `regain`). When the match had your side win it back this minute,
 * the build-up starts with it: their man on the ball, yours pressing, the
 * ball won in the regain zone (`band` on the pitch, higher up for the better
 * side), then the move from there.
 */
interface RegainPlan {
  /** The regain zone on the pitch: metres from their goal line. */
  band: { y1: number; y2: number };
  /** Where in it the route should start (metres from their goal line). */
  targetY: number;
  /** How long they have the ball before it is won (s). */
  spellS: number;
}

/** The zones on the pitch, metres from their goal line (ours is at 105). */
export const REGAIN_BAND: Record<Zone, { y1: number; y2: number }> = {
  box: { y1: 5, y2: 16 }, attacking: { y1: 17, y2: 35 }, middle: { y1: 36, y2: 66 },
  defensive: { y1: 67, y2: 86 }, own_box: { y1: 87, y2: 99 },
};

interface Route { acts: FhrAction[]; durS: number; hold: number; regain?: RegainPlan }

/** The route of the ball, worked back from the chance's ball `R`. */
function routeFor(sc: Scenario, moment: LeadMoment, r: Rng, frame: Viewport, tp: FhrTempo, ix: { intel: FhrIntel; regain?: RegainPlan }): Route | null {
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const brk = moment.pattern === "transition";
  const { mv, at } = dataFor(ix.intel);
  const rg = ix.regain;
  // 1. How long, how fast.
  let T = brk ? drawBetween(at.seconds, tp.breakMinS, tp.breakMaxS, r) : drawBetween(at.seconds, tp.minS, tp.maxS, r);
  const speed = brk ? quantile(at.speed, 0.5 + 0.42 * r()) : quantile(at.speed, 0.15 + 0.5 * r());
  const room = LEN - 6 - R.y;
  let F = clamp(speed * T, Math.min(10, room), Math.max(10, room));
  if (rg) {
    // From where the ball was won, in the time their spell leaves (a little longer overall).
    T = Math.max(2.6, T - 0.55 * rg.spellS);
    F = Math.max(0, rg.targetY - R.y);
  }
  const touch = () => (brk ? 0.22 + 0.35 * r() : 0.4 + 0.65 * r()) * tp.touch * ix.intel.touch;
  const laneX = moment.lane === "left" ? 13.5 : moment.lane === "right" ? 54.5 : moment.lane === "centre" ? CX : null;

  // Backward: the touch that ends at `to`, from a point in zone `z`.
  const back: FhrAction[] = [];
  let cur = R;
  let used = FHR_TAIL_S; // seconds the route takes so far, the tail included
  const pointIn = (z: number, to: Vec2, type: "pass" | "carry", lenWant: number, forwardOnly: boolean): Vec2 | null => {
    const b = zoneBox(z);
    let best: Vec2 | null = null, bs = Infinity;
    for (let k = 0; k < 14; k++) {
      const p = inPitch({ x: b.x1 + (b.x2 - b.x1) * r(), y: b.y1 + (b.y2 - b.y1) * r() }, 3);
      const L = dist(p, to);
      if (type === "pass" && L < 6) continue;
      if (type === "carry" && (L < 3 || L > 18)) continue;
      // A carry goes forward (towards goal); a pass may go square or back a little.
      if (forwardOnly && p.y < to.y + 1.5) continue;
      if (!forwardOnly && p.y < to.y - 9) continue;
      // Never from inside the six-yard box, nor from on the goal line.
      if (p.y < 6 && Math.abs(p.x - CX) < 12) continue;
      const s = Math.abs(L - lenWant) + (laneX !== null ? Math.abs(p.x - laneX) * 0.08 : 0);
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  };
  const durOf = (a: Omit<FhrAction, "t0" | "t1">) => { const L = dist(a.from, a.to); return a.type === "pass" ? L / (passSpeed(L, a.h) * (a.through ? THROUGH_BALL_PACE : 1)) : L / (brk ? BREAK_CARRY_SPEED : CARRY_SPEED); };
  // The last ball to you, in behind or to the byline, goes into space (B2b: so your run can be onside).
  const throughLast = THROUGH_KINDS.has(sc.kind) && R.y < THROUGH_BALL_Y + (sc.kind === "one_on_one" || sc.kind === "through_ball" ? 10 : 0);
  const push = (a0: Omit<FhrAction, "t0" | "t1">) => {
    const a = !back.length && throughLast && a0.type === "pass" ? { ...a0, through: true } : a0;
    used += durOf(a) + (back.length ? touch() : 0);
    back.push({ ...a, t0: 0, t1: 0 });
    cur = a.from;
  };
  const lenFor = (z: number, type: "pass" | "carry") => {
    if (type === "carry") return 5 + 9 * r();
    const q = mv.passLen[z];
    return clamp(q[0] + (q[2] - q[0]) * r(), 7, 34);
  };
  const loft = (L: number, t: string) => (t === "high" || t === "head" || t === "cross" || L > 28 ? Math.min(5, 1.2 + L * 0.11) : 0);
  // A regain: the route is far enough back once its start is in the regain zone.
  const inBand = (p: Vec2) => !!rg && p.y >= rg.band.y1 - 1.5 && p.y <= rg.band.y2 + 1.5;
  const farEnough = () => !!rg && inBand(cur) && used >= Math.min(T * 0.5, 2.2);

  // 2a. The last touches: a real sequence into a shot (or a cross) from here.
  const zR = zoneOf(R);
  const endType = sc.kind === "byline_cross" || sc.kind === "cutback" ? "cross" : (sc.kind === "one_on_one" || sc.kind === "tight_angle" || sc.kind === "long_range" || sc.kind === "volley" || sc.kind === "header") ? "shot" : null;
  if (endType && r() < 0.8) {
    const cands = CHAINS.flatMap((c) => c.endType !== endType ? [] : c.end === zR ? [{ c, m: false }] : mirrorZone(c.end) === zR ? [{ c, m: true }] : []);
    if (cands.length) {
      const { c, m } = pick(cands, cands.map((x) => x.c.n), r);
      for (let i = c.acts.length - 1; i >= 0; i--) {
        const [ty, z0] = c.acts[i];
        const z = m ? mirrorZone(z0) : z0;
        const type = isCarryType(ty) ? "carry" : "pass";
        // A chain may say the move began where the ball already is: then it is a carry within the zone.
        const p = pointIn(z, cur, type, lenFor(z, type), type === "carry") ?? (type === "pass" ? pointIn(z, cur, "carry", 8, true) : null);
        if (!p) break;
        const realType = dist(p, cur) < 6 ? "carry" : type;
        push({ type: realType, from: p, to: cur, h: realType === "pass" ? loft(dist(p, cur), ty) : 0, src: "chain" });
        if (used > T - 0.5 || farEnough()) break;
      }
    }
  }
  // 2b. A break: a long ball from deep, then the touches after it.
  // 2c. Earlier touches from the zone tables until the time is used.
  let guard = 0;
  while (used < T - 0.55 && guard++ < (T > FHR_MAX_S ? 20 : 12) && !farEnough()) {
    const z = zoneOf(cur);
    const left = T - used;
    const progressWant = Math.max(0, F - (cur.y - R.y));
    // A regain behind the route already: no further back than it.
    if (rg && cur.y > rg.band.y2 + 1.5) break;
    // Break: the first touch of the move is a long ball from deep when there is room.
    if (brk && left < 2.4 && progressWant > 12 && back.every((a) => a.src !== "break")) {
      const L = clamp(22 + 14 * r(), 18, 40);
      const fromY = Math.min(LEN - 8, cur.y + L * (0.75 + 0.2 * r()));
      const dx = Math.sqrt(Math.max(0, L * L - (fromY - cur.y) ** 2)) * (r() < 0.5 ? -1 : 1);
      const p = inPitch({ x: cur.x + dx, y: fromY }, 4);
      push({ type: "pass", from: p, to: cur, h: loft(dist(p, cur), "high"), src: "break" });
      break;
    }
    const passIn = mv.pass.reduce((s, row) => s + row[z], 0), carryIn = mv.carry.reduce((s, row) => s + row[z], 0);
    const carryShare = clamp((carryIn / Math.max(1, passIn + carryIn)) * (brk ? 4 : 2.5), 0.08, 0.4);
    const type: "pass" | "carry" = back.length && back[back.length - 1].type === "carry" ? "pass" : r() < carryShare ? "carry" : "pass";
    const M = type === "pass" ? mv.pass : mv.carry;
    // Where touches into zone z come from, leaning back up the pitch as far as the speed asks.
    const stepsLeft = Math.max(1, Math.round(left / 1.5));
    const dyWant = progressWant / stepsLeft;
    const zs: number[] = [], ws: number[] = [];
    for (let i = 0; i < 30; i++) {
      const w0 = M[i][z];
      if (!w0) continue;
      const c = zoneCentre(i);
      const dy = c.y - cur.y;
      let w = w0 * Math.exp(-((dy - dyWant) ** 2) / (2 * 13 * 13));
      if (laneX !== null) w *= Math.exp(-Math.abs(c.x - laneX) / 30);
      zs.push(i); ws.push(w);
    }
    if (!zs.length) break;
    const zi = pick(zs, ws, r);
    const p = pointIn(zi, cur, type, lenFor(zi, type), type === "carry");
    if (!p) continue;
    push({ type, from: p, to: cur, h: type === "pass" ? loft(dist(p, cur), "simple") : 0, src: "moves" });
  }
  if (rg) {
    // The move must start where the ball was won: one more touch from the regain zone onto it if not.
    if (!inBand(cur)) {
      if (cur.y > rg.band.y2 + 12) return null;
      let best: Vec2 | null = null, bs = Infinity;
      for (let k = 0; k < 16; k++) {
        const p = inPitch({ x: cur.x + (r() - 0.5) * 22, y: clamp(rg.targetY + (r() - 0.5) * 5, rg.band.y1, rg.band.y2) }, 3);
        const L = dist(p, cur);
        if (L < 3 || L > 42) continue;
        if (L < 10 && p.y < cur.y + 1.5) continue; // a carry goes forward
        if (p.y < 6 && Math.abs(p.x - CX) < 12) continue;
        const s0 = Math.abs(L - (L < 10 ? 6 : 18)) + (laneX !== null ? Math.abs(p.x - laneX) * 0.08 : 0);
        if (s0 < bs) { bs = s0; best = p; }
      }
      if (!best) return null;
      const L = dist(best, cur);
      push(L < 10 ? { type: "carry", from: best, to: cur, h: 0, src: "moves" } : { type: "pass", from: best, to: cur, h: loft(L, "simple"), src: "moves" });
    }
    // Won right where the chance is: a short carry onto it.
    if (!back.length) {
      const p = inPitch({ x: cur.x + (r() - 0.5) * 3, y: cur.y + 3 + 2 * r() }, 3);
      push({ type: "carry", from: p, to: cur, h: 0, src: "moves" });
    }
  }
  if (!back.length) return null;

  // 3. Forward: the times. A pause on the ball first, then each touch in turn.
  // (A regain: their spell first, then a touch to settle it.)
  const acts = back.reverse();
  let t = rg ? rg.spellS + (0.12 + 0.22 * r()) * ix.intel.touch : 0.3 + 0.3 * r();
  const hold = t;
  acts.forEach((a, k) => {
    if (k > 0) t += touch();
    a.t0 = t;
    t += durOf(a);
    a.t1 = t;
  });
  let durS = t + FHR_TAIL_S;
  // A regain may run a little longer: their spell is extra.
  const maxS = rg ? tp.maxS + 0.5 * rg.spellS + 0.6 : tp.maxS;
  // Too long: drop the earliest touches (and shift time back) — never the regain's own.
  while (!rg && durS > maxS && acts.length > 1) {
    const cut = acts[1].t0 - 0.3;
    acts.shift();
    acts.forEach((a) => { a.t0 -= cut; a.t1 -= cut; });
    durS -= cut;
  }
  // Too short: the first pause and the touches are longer (a slower, patient move).
  const padS = rg ? Math.min(maxS, tp.padS + 0.5 * rg.spellS) : tp.padS;
  if (durS < padS) {
    const need = padS - durS;
    const slots = acts.length; // the first pause + each touch
    const per = need / slots;
    acts.forEach((a, k) => { const sh = per * (k + 1); a.t0 += sh; a.t1 += sh; });
    durS = padS;
  }
  if (durS > maxS + 1e-6) return null;
  void frame;
  return { acts, durS, hold, ...(rg ? { regain: rg } : {}) };
}

// ─────────────────────────────────────────────────────────────────────────
//  The people
// ─────────────────────────────────────────────────────────────────────────

interface Person {
  key: string;
  /** "oppx": an opponent only in the build-up (B2b: the man your side wins the ball from). */
  side: "you" | "mate" | "opp" | "keeper" | "extra" | "oppx";
  who?: Identity;
  end: Vec2;
  role: string;
  /** His top speed, m/s. */
  vmax: number;
  /** Positions on the HZ grid, index 0 = t 0. */
  path: Vec2[];
  /** 1 = held to the ball (on it, or arriving at it) at that sample: never moved by the easing-apart. */
  pin: number[];
}

/** Who the chance's people are (their stats, where the database has them). */
function identityOf(sc: Scenario, key: string): Identity | undefined {
  const s = sc as unknown as { keeper?: { who?: Identity } };
  if (key === "keeper") return s.keeper?.who;
  if (key.startsWith("def")) return (sc.defenders[Number(key.slice(3))] as { who?: Identity } | undefined)?.who;
  if (key.startsWith("mate")) return sc.teammates[Number(key.slice(4))]?.who;
  if (key === "run") return sc.runner?.who;
  if (key.startsWith("sec")) return sc.secondaryRunners[Number(key.slice(3))]?.who;
  if (key === "follower") return sc.follower?.who;
  return undefined;
}
const stat = (who: Identity | undefined, k: "pace" | "passing" | "dribbling") => who?.[k] ?? who?.overall ?? 65;

/** The role's top speed (data p50), moved by his pace, never past FHR_TOP_SPEED. */
const topSpeedOf = (role: string, who?: Identity) => Math.min(FHR_TOP_SPEED, (SPEEDS[role]?.[0] ?? 8.2) + ((stat(who, "pace") - 65) / 35) * 0.6);

/** A finished generated build-up. */
export interface FhrBuildUp extends LeadIn {
  acts: FhrAction[];
  /** Who plays each touch (person keys; extraN = only in the build-up). */
  owners: string[];
  /** Who plays each touch, one per touch in `acts`. */
  actOwners: string[];
  /** Each person's role in the shape. */
  roles: Record<string, string>;
  /** Everyone's stored path (HZ a second), for the checks and the sheet. */
  people: { key: string; side: Person["side"]; role: string; vmax: number; path: Vec2[] }[];
  /** The checks it passed, or what was wrong with the best try. */
  problems: string[];
  /** Which try (0 = the first seed) it is. */
  tries: number;
  /** A short name for the route: P/C (pass, carry) @ zone, in order — for counting distinct build-ups. */
  signature: string;
  /** The chance's own frame it ends on. */
  frame: Viewport;
  /** How big the moment was (0 ordinary … 1 a level final, 90th minute). */
  drama: number;
  /** FHR-3: the covering defender who ran in from off the screen and stays in the chance, if one did. */
  cover: { end: Vec2; enterS: number } | null;
  /** B2b: how the two sides compared for this build-up (intel.ts). */
  gap: number;
  /**
   * B2b: the regain it starts with — the match's own (its request's
   * `regain`, won this minute) — or null when the match had none this minute
   * (or it would not fit cleanly: then the move is shown from after it).
   * `heightM`: metres from their goal line (lower = higher up the pitch).
   */
  regain: { spot: Vec2; at: number; spellS: number; scrappy: boolean; by: string; from: string; heightM: number } | null;
  /**
   * B2b: every pass, judged by the law at the moment it was played: who it
   * went to, how far he was behind their second-last man (+, onside) or
   * beyond him (−), whether the law applied (a goal in the picture, the law
   * not abolished), and whether the flag went up. A pass to a man in an
   * offside position is ALWAYS called: never `offside && !called`.
   */
  passChecks: { pass: number; by: string; behindLineM: number; judged: boolean; offside: boolean; called: boolean }[];
  /** B2b: at your touches in the last 45 m that their nearest man pressed: how close he got (m, mean). */
  pressM: number | null;
  /** B2b: the share of your touches in the last 45 m that were pressed. */
  pressShare: number | null;
}

/** Level is onside (the engine's own OFFSIDE_EPS). */
const OFF_EPS = 0.05;
/** A touch counts as pressed (measured) when their nearest man is this close (m). */
export const PRESSED_M = 4.5;
/** After a called offside: the flag this long after he takes the ball, then the picture holds (s). */
export const OFFSIDE_FLAG_S = 0.25;
export const OFFSIDE_HOLD_S = 1.6;

// ─────────────────────────────────────────────────────────────────────────
//  FHR-3 — A COVERING DEFENDER FROM OFF THE SCREEN (Harry, 20 Oct 2026: "If
//  it makes sense for an extra defender to come off screen and help defend,
//  then sure.")
// ─────────────────────────────────────────────────────────────────────────
//
// When it makes sense: the drawing's defence near the ball is thin (at most
// one defender goal-side within COVER_NEAR_M of the ball) and the drawing has
// at least one outfield defender already. Then, on COVER_SHARE of those
// chances, a defender who was out of the picture sprints back into it during
// the build-up and JOINS the chance, recovering behind the ball (never between
// the ball and the goal, never in the drawn pass lanes), still running at the
// hand-over. Behind the ball, he never moves the offside line: an attacker
// ahead of the ball is already beyond him, and the drawing's own defender
// stays the second-last man. The drawing's people never move for him.

/** Share of the chances where it makes sense that get one. */
export const COVER_SHARE = 0.65;
/** "Near the ball", for how thin the defence is (m). */
export const COVER_NEAR_M = 16;
/** He ends at least this far from anyone in the chance (m). */
export const COVER_CLEAR_M = 2.8;
/** …and at least this far from a drawn pass lane (m). */
export const COVER_LANE_M = 2.4;
/** Only with the ball at least this far from the goal line (m): nearer, "behind the ball" is beside the goal. */
export const COVER_MIN_BALL_Y = 10;
/** Open-play kinds with the goal in view, where a recovering defender makes sense. */
const COVER_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["one_on_one", "tight_angle", "long_range", "cutback", "byline_cross", "through_ball", "volley", "header"]);

const segDist = (p: Vec2, a: Vec2, b: Vec2) => {
  const sx = b.x - a.x, sy = b.y - a.y, l2 = sx * sx + sy * sy;
  if (l2 < 1e-6) return dist(p, a);
  const t = clamp(((p.x - a.x) * sx + (p.y - a.y) * sy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + sx * t), p.y - (a.y + sy * t));
};

/** Where the covering defender ends in the chance, or null when the situation doesn't call for one. Own seeded stream. */
export function coverSpotFor(sc: Scenario, moment: LeadMoment, seed: number): Vec2 | null {
  if (!COVER_KINDS.has(sc.kind)) return null;
  const r = rngOf((seed ^ 0xc0ae5d1) >>> 0);
  if (r() >= COVER_SHARE) return null;
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  // A ball at the byline (a cutback, a tight angle): "behind the ball" is the
  // six-yard box, beside the goal. Seen on the sheet (20 Oct 2026): he ended at
  // the near post. Only with the ball this far out.
  if (R.y < COVER_MIN_BALL_Y) return null;
  const onPitch = (p: Vec2) => p.x > -1 && p.x < PITCH_W + 1 && p.y > -1 && p.y < LEN + 1;
  const defs = sc.defenders.filter((d) => onPitch(d));
  if (defs.length < 1) return null;
  const goalSide = defs.filter((d) => d.y < R.y + 1 && dist(d, R) < COVER_NEAR_M).length;
  if (goalSide > 1) return null;
  const frame = moment.frame ?? sc.viewport;
  const ends = leadInEntities(sc).map((e) => e.get()).filter(onPitch);
  const mates: Vec2[] = [
    ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((x) => x.pos),
    ...(onPitch(sc.follower) ? [sc.follower] : []), ...sc.teammates, ...(sc.passTarget ? [sc.passTarget] : []),
  ].filter(onPitch);
  const inward = R.x < CX ? 1 : -1;
  let best: Vec2 | null = null, bestScore = -Infinity;
  for (let k = 0; k < 36; k++) {
    const side = k % 3 === 2 ? -inward : inward;
    const p = { x: R.x + side * (2.5 + 5 * r()), y: R.y + 1.5 + 4.5 * r() };
    if (p.x < frame.x1 + 2.5 || p.x > frame.x2 - 2.5 || p.y < frame.y1 + 2.5 || p.y > frame.y2 - 2.5) continue;
    if (p.x < 2 || p.x > PITCH_W - 2 || p.y > LEN - 2) continue;
    let clear = Infinity;
    for (const e of ends) clear = Math.min(clear, dist(p, e));
    clear = Math.min(clear, dist(p, R));
    if (clear < COVER_CLEAR_M) continue;
    let lane = Infinity;
    for (const m of mates) lane = Math.min(lane, segDist(p, R, m));
    if (lane < COVER_LANE_M) continue;
    // Nearer the ball is more help; more room from everyone is a cleaner picture.
    const score = Math.min(clear, 6) + Math.min(lane, 6) * 0.5 - dist(p, R) * 0.35;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/** The chance's own seed (CanvasMatch hands every chance of a match the same match seed): mixed with where the chance is. */
export function chanceSeed(sc: Scenario, seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const mix = (v: number) => { h = Math.imul(h ^ Math.round(v * 100), 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; };
  mix(sc.ball.x); mix(sc.ball.y); mix(sc.player.x); mix(sc.player.y); mix(sc.keeper.x);
  for (const d of sc.defenders) { mix(d.x); mix(d.y); }
  for (const c of sc.kind) mix(c.charCodeAt(0));
  return h >>> 0;
}

/**
 * THE GENERATED BUILD-UP for a chance `sc` (every man where the drawing put
 * him) at the radar's `moment`. Never null: if no try passes every check, the
 * best try is returned with its problems listed (tests count these).
 *
 * B2b: how the sides compare (moment.usStrength / themStrength, intel.ts)
 * shapes the passing, the pressing, the regain and the runs. The match's own
 * regain this minute (moment.regain) is shown first. Every pass is judged by
 * the offside law; a run that is offside is either timed (held back so he is
 * onside when the ball is played) or mistimed — and then the flag goes up,
 * the move ends, and there is no chance (`offside` on the lead-in). A run
 * that can't be timed cleanly in any try is called, never left uncalled.
 */
export function fhrBuildUpFor(sc: Scenario, moment0: LeadMoment, adjust?: FhrAdjust): FhrBuildUp {
  const moment = adjustedMoment(moment0, adjust);
  const tp = fhrTempo(moment, adjust);
  const intel = fhrIntel(moment.usStrength, moment.themStrength);
  const base = chanceSeed(sc, moment.seed);
  const cover = coverSpotFor(sc, moment, base);
  // The match's own regain, this minute: shown first.
  const showRegain = !!moment.regain && moment.regain.ago === 0;
  // Is a run that needs timing mistimed? Decided once for the build-up, on its own stream.
  const caught = rngOf((base ^ 0x0ff51de) >>> 0)() < intel.mistime;
  const seedOf = (k: number) => (base + k * 0x632be5ab) >>> 0;
  let best: FhrBuildUp | null = null;
  let bestSeed = 0, bestOpts: AttemptOpts | null = null, bestCover: Vec2 | null = null;
  // The regain and the covering defender are kept when they fit cleanly; else left out (in that order), never forced in.
  const plans: [Vec2 | null, boolean][] = [[cover, showRegain]];
  if (cover) plans.push([null, showRegain]);
  if (showRegain) { plans.push([cover, false]); if (cover) plans.push([null, false]); }
  for (let pi = 0; pi < plans.length; pi++) {
    const [cv, rg] = plans[pi];
    const o: AttemptOpts = { intel, regain: rg, caught };
    // (The fallbacks get fewer tries: the generator stays about as quick as before B2b.)
    for (let k = 0; k < (pi === 0 ? FHR_TRIES : FHR_FALLBACK_TRIES); k++) {
      const b = attempt(sc, moment, seedOf(k), k, tp, cv, o);
      if (!b) continue;
      if (!b.problems.length) return b;
      if (!best || b.problems.length < best.problems.length) { best = b; bestSeed = seedOf(k); bestOpts = o; bestCover = cv; }
    }
  }
  if (best && bestOpts && best.problems.some((p) => p.startsWith(UNTIMED))) {
    // Offside and it could not be timed in any try: the flag goes up (never an uncalled offside).
    const b = attempt(sc, moment, bestSeed, best.tries, tp, bestCover, { ...bestOpts, callUntimed: true });
    if (b) return b;
  }
  if (best) return best;
  // Nothing at all could be made (never seen): a single pass to you from out of the frame.
  return attempt(sc, { ...moment, pattern: "transition" }, base ^ 0x55, FHR_TRIES, tp, null, { intel, regain: false, caught: false, callUntimed: true }, true)!;
}

interface AttemptOpts {
  intel: FhrIntel;
  /** Show the match's regain (moment.regain) first. */
  regain: boolean;
  /** A run that needs timing is mistimed: the first offside pass is called. */
  caught: boolean;
  /** A run that can't be timed is called (the last resort; never left uncalled). */
  callUntimed?: boolean;
}
/** The problem a try lists when a run is offside and can't be held back in time. */
const UNTIMED = "offside run not timed";

function attempt(sc: Scenario, moment: LeadMoment, seed: number, tryNo: number, tp: FhrTempo, coverEnd: Vec2 | null, o: AttemptOpts, force = false): FhrBuildUp | null {
  const r = rngOf(seed);
  const frame = moment.frame ?? sc.viewport;
  // ── B2b: where the ball was won (the match's own regain), how high up, how long they had it ──
  let plan: RegainPlan | undefined;
  if (o.regain && moment.regain) {
    const band = REGAIN_BAND[moment.regain.zone] ?? REGAIN_BAND.middle;
    const h = clamp(o.intel.regainHigh + (r() - 0.5) * 0.5, 0.03, 0.97);
    const [s0, s1] = o.intel.oppSpellS;
    plan = { band, targetY: band.y2 - (band.y2 - band.y1) * h, spellS: s0 + (s1 - s0) * r() };
  }
  const route = routeFor(sc, moment, r, frame, tp, { intel: o.intel, regain: plan });
  if (!route && !force) return null;
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const acts: FhrAction[] = route?.acts ?? [{ type: "pass", from: inPitch({ x: R.x, y: R.y + 30 }), to: R, h: 3, src: "break", t0: 0.4, t1: 2 }];
  let durS = route?.durS ?? FHR_MIN_S;
  let N = Math.ceil(durS * HZ);
  const tOf = (i: number) => Math.min(durS, i / HZ);
  const idx = (t: number) => clamp(Math.round(t * HZ), 0, N);

  // ── B2b: their spell on the ball, and the regain ──
  // Their man carries it at your goal; yours presses from goal-side and wins
  // it (a clean steal), or pokes it loose and it runs on (scrappy); then the
  // move. The better your side against theirs, the shorter their spell, the
  // closer your press, the higher up and the cleaner the regain (intel.ts).
  const rgn = route?.regain;
  let spell: { P0: Vec2; G0: Vec2; dirA: Vec2; carryT0: number; tackleT: number; scrappy: boolean; pressStart: Vec2 } | null = null;
  if (rgn) {
    const G = acts[0].from;
    const scrappy = r() < o.intel.scrappy;
    const tackleT = scrappy ? Math.max(0.55, rgn.spellS - 0.45) : rgn.spellS;
    const ang = (r() - 0.5) * 0.8;
    const dirA = { x: Math.sin(ang), y: Math.cos(ang) }; // their attack: towards your goal (+y)
    // (A scrappy one: the challenge a couple of metres off where your man gathers it — on the side that keeps it in the match's zone.)
    const off = 1.8 + 1.2 * r(), flip = G.y - off < rgn.band.y1 ? -1 : 1;
    const G0 = scrappy ? inPitch({ x: G.x - dirA.x * 2 * flip + (r() - 0.5) * 1.4, y: G.y - dirA.y * off * flip }, 2) : { ...G };
    const vA = 3.6 + 1.2 * r();
    const carryS = Math.max(0.2, Math.min(tackleT - 0.25, (2.5 + 3 * r()) / vA));
    const P0 = inPitch({ x: G0.x - dirA.x * vA * carryS, y: G0.y - dirA.y * vA * carryS }, 2);
    const [d0, d1] = o.intel.pressOnThemM;
    const d = d0 + (d1 - d0) * r();
    const side = r() < 0.5 ? -1 : 1;
    const pressStart = inPitch({ x: P0.x + dirA.x * (d + 0.6) + side * (0.6 + 0.8 * r()), y: P0.y + dirA.y * (d + 0.6) }, 1.5);
    spell = { P0, G0, dirA, carryT0: tackleT - carryS, tackleT, scrappy, pressStart };
  }

  // ── The ball ──
  const ballKeys: LeadBallKey[] = [];
  if (spell) {
    ballKeys.push({ t: 0, p: { ...spell.P0 } }, { t: spell.carryT0, p: { ...spell.P0 } }, { t: spell.tackleT, p: { ...spell.G0 } });
    if (spell.scrappy) ballKeys.push({ t: rgn!.spellS, p: { ...acts[0].from }, pass: { h: 0 } });
  } else ballKeys.push({ t: 0, p: { ...acts[0].from } });
  for (const a of acts) {
    ballKeys.push({ t: a.t0, p: { ...a.from } });
    ballKeys.push(a.type === "pass" ? { t: a.t1, p: { ...a.to }, pass: { h: a.h } } : { t: a.t1, p: { ...a.to } });
  }
  ballKeys.push({ t: durS, p: { ...R } });
  let ballAt = (t: number) => (t >= durS ? { x: R.x, y: R.y, z: 0 } : ballAlong(ballKeys, t));
  // Where the shape thinks the ball is: it reacts a little behind the ball.
  const lagBall: Vec2[] = [];
  {
    const b0 = ballAt(0);
    let q: Vec2 = { x: b0.x, y: b0.y };
    const k = 1 - Math.exp(-1 / HZ / 0.9);
    for (let i = 0; i <= N; i++) { const b = ballAt(tOf(i)); q = { x: q.x + (b.x - q.x) * k, y: q.y + (b.y - q.y) * k }; lagBall.push(q); }
  }

  // ── The people, and their roles in the shape ──
  // (A man parked off the pitch — a removed poacher — is not in it: he stays where the chance has him.)
  const onPitch = (p: Vec2) => p.x > -3 && p.x < PITCH_W + 3 && p.y > -3 && p.y < LEN + 3;
  const ents = leadInEntities(sc).filter((e) => onPitch(e.get()));
  const people: Person[] = ents.map((e) => {
    const who = identityOf(sc, e.key);
    return { key: e.key, side: e.side, who, end: e.get(), role: "", vmax: 8, path: [], pin: [] };
  });
  const endBall = toData(lagBall[N]);
  const shapeSpot = (side: "us" | "them", slot: number, bd: { X: number; Y: number }): Vec2 => {
    const s = SHAPE[slot];
    if (side === "us") { const [mx, my] = roleSpot("in", s.role, bd.X, bd.Y); return fromData(mx, clamp(my + s.dy, 2, 98)); }
    const [mx, my] = roleSpot("out", s.role, 100 - bd.X, 100 - bd.Y);
    return fromDataDef(mx, clamp(my + s.dy, 2, 98));
  };
  const assign = (group: Person[], side: "us" | "them") => {
    const pairs: { i: number; j: number; d: number }[] = [];
    group.forEach((p, i) => SHAPE.forEach((_, j) => pairs.push({ i, j, d: dist(p.end, shapeSpot(side, j, endBall)) })));
    pairs.sort((a, b) => a.d - b.d);
    const usedJ = new Set<number>(), slotOf = new Map<number, number>();
    for (const pr of pairs) { if (slotOf.has(pr.i) || usedJ.has(pr.j)) continue; slotOf.set(pr.i, pr.j); usedJ.add(pr.j); }
    return slotOf;
  };
  const ours = people.filter((p) => p.side === "you" || p.side === "mate");
  const theirs = people.filter((p) => p.side === "opp");
  const keeper = people.find((p) => p.side === "keeper")!;
  const slotOurs = assign(ours, "us"), slotTheirs = assign(theirs, "them");
  // A whole-team push up or drop off (real back lines sit 21–46 m from their own goal, p25–p75).
  const teamShift = { us: gauss(r) * 3.5, them: gauss(r) * 3.5 };

  // Base path: the role's spot for where the ball is (a little behind it), plus
  // his own small offset, which grows (evenly) into exactly his place in the
  // chance. If that is faster than he can run, the whole shape he follows is
  // taken as already part-way toward the chance's ball at the start (as if the
  // team read where the move was going), a quarter more each time — never his
  // own offset dragged back, which would pull a whole line across the pitch.
  const baseOf = (p: Person, spotOf: (b: Vec2) => Vec2, shiftY: number, jitter: Vec2): Vec2[] => {
    const endSpot = spotOf(lagBall[N]);
    const offEnd = { x: p.end.x - endSpot.x, y: p.end.y - endSpot.y };
    const offStart = { x: jitter.x, y: jitter.y + shiftY };
    let path: Vec2[] = [];
    for (let k = 0; k <= 4; k++) {
      const a0 = k / 4;
      const raw: Vec2[] = [];
      for (let i = 0; i <= N; i++) {
        const f = i / N, g = 0.5 * f + 0.5 * smooth(f);
        const s = spotOf(lerp(lagBall[i], lagBall[N], a0 * (1 - f)));
        raw.push({ x: s.x + offStart.x + (offEnd.x - offStart.x) * g, y: s.y + offStart.y + (offEnd.y - offStart.y) * g });
      }
      // Smoothed over ±0.33 s (a man does not twitch with every pass), still ending exactly on his place.
      path = raw.map((_, i) => {
        let sx = 0, sy = 0, w = 0;
        for (let j = Math.max(0, i - 5); j <= Math.min(N, i + 5); j++) { const wj = 6 - Math.abs(j - i); sx += raw[j].x * wj; sy += raw[j].y * wj; w += wj; }
        return { x: sx / w, y: sy / w };
      });
      const fix = { x: p.end.x - path[N].x, y: p.end.y - path[N].y };
      path = path.map((q, i) => {
        const g = (i / N) ** 2;
        const v = { x: q.x + fix.x * g, y: q.y + fix.y * g };
        // On the pitch (the end may be on the goal line: a keeper's is).
        return { x: clamp(v.x, Math.min(0.5, p.end.x), Math.max(PITCH_W - 0.5, p.end.x)), y: clamp(v.y, Math.min(0.5, p.end.y), Math.max(LEN - 0.5, p.end.y)) };
      });
      path[N] = { ...p.end };
      if (maxSpeed(path) <= p.vmax * 0.82) break;
    }
    return path;
  };
  for (const [group, slots, side] of [[ours, slotOurs, "us"], [theirs, slotTheirs, "them"]] as const) {
    group.forEach((p, i) => {
      const slot = slots.get(i);
      p.role = slot === undefined ? "CM" : SHAPE[slot].role;
      p.vmax = topSpeedOf(p.role, p.who);
      // B2b: their shape squeezes onto the ball — tighter the better they are (intel.squeeze).
      const sq = side === "them" ? o.intel.squeeze : 0;
      const spotOf = (b: Vec2) => (slot === undefined ? p.end : sq ? lerp(shapeSpot(side, slot, toData(b)), b, sq) : shapeSpot(side, slot, toData(b)));
      const [, , sdx, sdy] = roleSpot(side === "us" ? "in" : "out", p.role, endBall.X, endBall.Y);
      const jit = { x: clamp(gauss(r) * sdy * 0.68 * 0.3, -4, 4), y: clamp(gauss(r) * sdx * 1.05 * 0.3, -4, 4) };
      p.path = baseOf(p, spotOf, side === "us" ? teamShift.us : -teamShift.them, jit);
      p.pin = new Array(N + 1).fill(0);
    });
  }
  keeper.role = "GK";
  keeper.vmax = topSpeedOf("GK", keeper.who);
  keeper.path = baseOf(keeper, (b) => { const bd = toData(b); const [mx, my] = roleSpot("out", "GK", 100 - bd.X, 100 - bd.Y); return fromDataDef(mx, my); }, 0, { x: 0, y: 0 });
  keeper.pin = new Array(N + 1).fill(0);

  // ── B2b: the man who loses it ──
  // Near the chance, one of its own defenders (he then recovers to his place);
  // further back, a man who is only in the build-up (and stays out of the
  // chance's picture). He is held to the ball until it is won.
  let loser: Person | null = null;
  const inFrame = (p: Vec2, m = 3) => p.x > frame.x1 - m && p.x < frame.x2 + m && p.y > frame.y1 - m && p.y < frame.y2 + m;
  if (spell) {
    const iT = idx(spell.tackleT);
    let near: Person | null = null, nd = Infinity;
    for (const p of theirs) { const dd = dist(p.path[iT], spell.G0); if (dd < nd) { nd = dd; near = p; } }
    const carryAt = (t: number) => { const b = ballAt(Math.min(t, spell!.tackleT)); return { x: b.x - spell!.dirA.x * 0.62, y: b.y - spell!.dirA.y * 0.62 }; };
    // After the challenge: he stumbles to a stop (0.35 s).
    const vA = { x: (spell.G0.x - spell.P0.x) / Math.max(0.2, spell.tackleT - spell.carryT0), y: (spell.G0.y - spell.P0.y) / Math.max(0.2, spell.tackleT - spell.carryT0) };
    const stumble = (t: number) => { const tau = Math.min(Math.max(0, t - spell!.tackleT), 0.35); const f = tau - (tau * tau) / 0.7; const a0 = carryAt(spell!.tackleT); return { x: a0.x + vA.x * f, y: a0.y + vA.y * f }; };
    const useDrawn = near && (nd < 8 || (inFrame(spell.G0, 3) && nd < 16));
    if (useDrawn && near) {
      const base0 = near.path.slice();
      let ok = false;
      for (let W = 8; W <= N - iT && !ok; W += 4) {
        const out = base0.map((q, i) => {
          const t = tOf(i);
          if (t <= spell!.tackleT) return carryAt(t);
          if (i >= iT + W) return q;
          return lerp(stumble(t), q, smooth((i - iT) / W));
        });
        out[N] = { ...near.end };
        if (maxSpeed(out) <= near.vmax * 0.97) { near.path = out; ok = true; }
      }
      if (ok) {
        loser = near;
        for (let i = 0; i <= iT; i++) near.pin[i] = 1;
      }
    }
    if (!loser) {
      const path: Vec2[] = [], pin: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = tOf(i);
        if (t <= spell.tackleT) { path.push(carryAt(t)); pin.push(1); continue; }
        // Beaten: he stops, then trots back after it, slowly.
        const s0 = stumble(t), back = Math.max(0, t - spell.tackleT - 0.6) * 1.4;
        path.push(inPitch({ x: s0.x, y: s0.y - back }, 1));
        pin.push(0);
      }
      loser = { key: "oppx0", side: "oppx", end: path[N], role: "CM", vmax: 8.5, path, pin };
    }
  }

  // THEIR PRESS (B2b: "how tight the opposition presses"). At every touch of
  // your move their nearest man steps toward the ball, to a real pressing
  // distance for that part of the pitch (`press`, from tracking data) —
  // closer when they are the better side (intel.pressOnUs) — then drops back
  // into his shape. Only as far as he can run; never the keeper, never the
  // man who has just lost it, and never in the last second (the drawing's).
  const pressDists: number[] = [];
  let pressedN = 0, pressTouches = 0;
  for (let k = 0; k < acts.length; k++) {
    const b0 = acts[k].from;
    const iP = idx(acts[k].t0);
    if (iP > N - Math.round(1.1 * HZ)) break;
    const zDef = zoneOf({ x: PITCH_W - b0.x, y: LEN - b0.y }); // the ball's zone in the defending team's frame
    const q = PRESS[zDef] ?? [3, 5, 8];
    const want = clamp((q[0] + (q[2] - q[0]) * r()) * tp.press * o.intel.pressOnUs, 1.8, 12);
    let near: Person | null = null, nd = Infinity;
    for (const p of theirs) { if (p === loser) continue; const d = dist(p.path[iP], b0); if (d < nd) { nd = d; near = p; } }
    if (!near) continue;
    // Goal-side of the ball, between it and his goal.
    const toGoal = { x: CX - b0.x, y: 0 - b0.y }, n = Math.hypot(toGoal.x, toGoal.y) || 1;
    const spot = inPitch({ x: b0.x + (toGoal.x / n) * want + gauss(r) * 0.8, y: b0.y + (toGoal.y / n) * want });
    const need = dist(near.path[iP], spot);
    if (nd > want && need < o.intel.pressReachM) {
      const old = near.path;
      const dx = spot.x - old[iP].x, dy = spot.y - old[iP].y;
      // He gets there at a jog-to-run on top of his shape (about 5 m/s more), and drops back off over a second.
      const inN = Math.max(3, Math.min(iP, Math.round(Math.max(0.9, need / 3.4) * HZ)));
      // Back in his shape before the last second (the drawing's).
      const outN = Math.min(Math.round(Math.max(1.0, need / 3.4) * HZ), N - Math.round(1.0 * HZ) - iP);
      if (outN >= Math.round(0.6 * HZ)) {
        const trial = old.map((p0, i) => {
          const w = i <= iP ? (i < iP - inN ? 0 : smooth((i - (iP - inN)) / inN)) : i < iP + outN ? 1 - smooth((i - iP) / outN) : 0;
          return w > 0 ? { x: p0.x + dx * w, y: p0.y + dy * w } : p0;
        });
        const lo = Math.max(0, iP - inN - 4), hi = Math.min(N, iP + outN + 4) + 1;
        if (maxSpeed(trial.slice(lo, hi)) <= Math.max(near.vmax * 0.96, maxSpeed(old.slice(lo, hi)))) { near.path = trial; nd = dist(trial[iP], b0); }
      }
    }
    // (Measured where their drawn defence is: your touches in the last 45 m.)
    if (b0.y < 45) { pressTouches++; if (nd <= PRESSED_M) { pressedN++; pressDists.push(nd); } }
  }
  const pressM = pressDists.length ? pressDists.reduce((a0, b1) => a0 + b1, 0) / pressDists.length : null;
  const pressShare = pressTouches ? pressedN / pressTouches : null;

  // ── Who plays each touch ──
  // Possession spells: a pass ends one and starts the next; a carry stays with its man.
  interface Spell { first: number; last: number; tIn: number; tOut: number; atIn: Vec2; atOut: Vec2 }
  const spells: Spell[] = [];
  acts.forEach((a, k) => {
    if (k === 0 || acts[k - 1].type === "pass") spells.push({ first: k, last: k, tIn: k === 0 ? (spell ? spell.tackleT : 0) : acts[k - 1].t1, tOut: a.t0, atIn: k === 0 && spell ? spell.G0 : a.from, atOut: a.from });
    const s = spells[spells.length - 1];
    s.last = k;
    if (a.type === "carry") s.atOut = a.to;
    if (a.type === "pass") { s.tOut = a.t0; s.atOut = a.from; }
  });
  // The last spell is yours: you receive the last pass (or carry it in) and keep it.
  const lastAct = acts[acts.length - 1];
  if (lastAct.type === "pass") spells.push({ first: acts.length, last: acts.length, tIn: lastAct.t1, tOut: durS, atIn: R, atOut: R });
  else { const s = spells[spells.length - 1]; s.tOut = durS; s.atOut = R; }
  const youSpell = spells[spells.length - 1];
  const owners: string[] = new Array(spells.length).fill("");
  owners[spells.length - 1] = "you";
  const you = people.find((p) => p.key === "you")!;
  const youOff = { x: you.end.x - R.x, y: you.end.y - R.y };
  // Where a man on the ball stands: just behind it, from where it goes next.
  const ownerSpot = (t: number, next: Vec2 | null): Vec2 => {
    const b = ballAt(t);
    if (!next) return { x: b.x, y: b.y + 0.6 };
    const dx = b.x - next.x, dy = b.y - next.y, n = Math.hypot(dx, dy) || 1;
    return { x: b.x + (dx / n) * 0.65, y: b.y + (dy / n) * 0.65 };
  };
  const nextOf = (s: Spell, t: number): Vec2 | null => {
    // The carry in progress, else the pass he will play.
    for (let k = s.first; k <= Math.min(s.last, acts.length - 1); k++) { const a = acts[k]; if (t <= a.t1) return a.to; }
    return null;
  };
  /**
   * Where a man on the ball is from sample iA to iB: at the ball, his side of it
   * eased round over ±0.27 s as the ball's next direction changes (a carry, then
   * the pass), so he turns with it instead of jumping round it.
   */
  const heldSpots = (iA: number, iB: number, spotAt: (t: number) => Vec2): Vec2[] => {
    const raw: Vec2[] = [], off: Vec2[] = [];
    for (let i = iA; i <= iB; i++) { const t = tOf(i), b = ballAt(t), s = spotAt(t); raw.push(b); off.push({ x: s.x - b.x, y: s.y - b.y }); }
    const K = 4;
    return raw.map((b, k) => {
      let sx = 0, sy = 0, w = 0;
      for (let j = Math.max(0, k - K); j <= Math.min(off.length - 1, k + K); j++) { const wj = K + 1 - Math.abs(j - k); sx += off[j].x * wj; sy += off[j].y * wj; w += wj; }
      // (Turning right round — a carry, then a pass back — he steps over the ball rather than jumping round it.)
      return { x: b.x + sx / w, y: b.y + sy / w };
    });
  };
  const spotFor = (key: string, s: Spell) => (t: number): Vec2 => {
    const tt = clamp(t, s.tIn, s.tOut);
    if (key === "you" && s === youSpell) {
      // On the ball (behind it as you carry it), easing into the drawing's stance over the last half second.
      const b = ballAt(tt), stance = { x: b.x + youOff.x, y: b.y + youOff.y };
      const k = smooth((tt - (durS - 0.55)) / 0.5);
      return k >= 1 ? stance : lerp(ownerSpot(tt, nextOf(s, tt) ?? (tt < durS - 0.05 ? R : null)), stance, k);
    }
    return ownerSpot(tt, nextOf(s, tt));
  };
  /** B2b: the regainer presses their man from goal-side, onto the ball at the challenge. */
  const pressed = (path: Vec2[], s: Spell, key: string): Vec2[] => {
    if (!spell || s !== spells[0]) return path;
    const out = path.slice(), iA = idx(s.tIn), tgt = spotFor(key, s)(s.tIn);
    for (let i = 0; i < iA; i++) out[i] = lerp(spell.pressStart, tgt, smooth(i / Math.max(1, iA)));
    return out;
  };
  /**
   * Man `p` takes spell `s`: held to the ball from s.tIn to s.tOut, running
   * onto it before (as late as he can at his speed, so it looks like a run)
   * and back onto his own path after (`back`). Null: he can't make it.
   */
  const onSpell = (path: Vec2[], vmax: number, s: Spell, spotAt: (t: number) => Vec2, back: boolean): { path: Vec2[]; pin: number[] } | null => {
    const iA = idx(s.tIn), iB = idx(s.tOut);
    const out = path.slice(), pin: number[] = [];
    const held = heldSpots(iA, iB, spotAt);
    for (let i = iA; i <= iB; i++) { out[i] = held[i - iA]; pin.push(i); }
    // (The regainer: held for the last moments of his press too, so nobody is eased off the challenge.)
    if (spell && s === spells[0]) for (let i = idx(s.tIn - 0.35); i < iA; i++) pin.push(i);
    const cap = vmax * 0.97;
    const okAround = (lo: number, hi: number) => maxSpeed(out.slice(Math.max(0, lo), Math.min(N, hi) + 1)) <= cap;
    if (iA > 0) {
      const target = out[iA];
      let ok = false;
      for (let W = Math.min(5, iA); ; W = Math.min(iA, W + 2)) {
        for (let i = iA - W; i < iA; i++) out[i] = lerp(path[i], target, smooth((i - (iA - W)) / W));
        if (okAround(iA - W - 4, iA + 4)) { ok = true; break; }
        if (W >= iA) break;
      }
      if (!ok) return null;
    }
    if (back && iB < N) {
      const from = out[iB];
      const room = N - iB;
      let ok = false;
      for (let W = Math.min(5, room); ; W = Math.min(room, W + 2)) {
        for (let i = iB + 1; i <= N; i++) out[i] = i <= iB + W ? lerp(from, path[i], smooth((i - iB) / W)) : path[i];
        if (okAround(iB - 4, iB + W + 4)) { ok = true; break; }
        if (W >= room) break;
      }
      if (!ok) return null;
    }
    return { path: out, pin };
  };
  const put = (p: Person, s: Spell, back: boolean): boolean => {
    const res = onSpell(pressed(p.path, s, p.key), p.vmax, s, spotFor(p.key, s), back);
    if (!res) return false;
    p.path = res.path;
    for (const i of res.pin) p.pin[i] = 1;
    p.path[N] = { ...p.end };
    return true;
  };
  /**
   * A team-mate who is only in the build-up plays spell `s`: after his pass he
   * jogs on, and if that leaves him inside the chance's frame he runs on out of
   * it (he must be off the screen when the chance starts: he is not in it).
   * Null: he could not get out in time — then one of the chance's own men must play it.
   */
  const extraPlan = (s: Spell): { after: Vec2 } | null => {
    const pOut = ownerSpot(s.tOut, nextOf(s, s.tOut));
    const nxt = acts[s.last].to;
    const fwd = { x: nxt.x - pOut.x, y: nxt.y - pOut.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
    const time = Math.max(0, durS - s.tOut - 0.15);
    const jog = Math.min(2.5, 1.2 * time);
    const after = { x: pOut.x + (fwd.x / fn) * jog, y: pOut.y + (fwd.y / fn) * jog };
    if (!inFrame(after, 2)) return { after };
    const exits: Vec2[] = [
      { x: frame.x1 - 3, y: pOut.y }, { x: frame.x2 + 3, y: pOut.y }, { x: pOut.x, y: frame.y2 + 3 },
    ].filter((e) => e.x > 0.5 && e.x < PITCH_W - 0.5 && e.y < LEN - 1);
    let best: Vec2 | null = null;
    for (const e of exits) if (dist(e, pOut) <= 5 * time && (!best || dist(e, pOut) < dist(best, pOut))) best = e;
    return best ? { after: best } : null;
  };
  const extrasAt: { spell: number }[] = [];
  const taken = new Set<string>(["you"]);
  const problems: string[] = [];
  // You run onto the last pass (or are on the ball already for your carry).
  if (!put(you, youSpell, false)) problems.push("you can't get onto the last touch in time");
  for (let j = spells.length - 2; j >= 0; j--) {
    const s = spells[j];
    const carry = acts.slice(s.first, s.last + 1).some((a) => a.type === "carry");
    const passLen = acts[s.last].type === "pass" ? dist(acts[s.last].from, acts[s.last].to) : 0;
    let best: Person | null = null, bestCost = Infinity;
    for (const p of ours) {
      if (taken.has(p.key) && p.key !== "you") continue;
      // You may give it and go (a one-two): only the touch before the one you get back.
      if (p.key === "you" && (j !== spells.length - 3 || r() < 0.4)) continue;
      if (!onSpell(pressed(p.path, s, p.key), p.vmax, s, spotFor(p.key, s), true)) continue;
      const skill = carry ? stat(p.who, "dribbling") : passLen > 22 ? stat(p.who, "passing") : 65;
      const cost = dist(p.path[idx(s.tIn)], spotFor(p.key, s)(s.tIn)) - (skill - 65) * 0.08;
      if (cost < bestCost) { bestCost = cost; best = p; }
    }
    const outside = extraPlan(s) !== null;
    // A man of the chance when one is near enough; otherwise one who is only in the build-up, out of the frame.
    if (best && (bestCost < 14 || !outside)) {
      put(best, s, true);
      owners[j] = best.key; taken.add(best.key);
    } else {
      if (!outside) problems.push(`nobody can play touch ${j + 1} inside the chance's frame`);
      owners[j] = `extra${extrasAt.length}`;
      extrasAt.push({ spell: j });
    }
  }

  // ── The men who are only in the build-up ──
  const extras: Person[] = extrasAt.map(({ spell: si }, n) => {
    const s = spells[si];
    const pIn = ownerSpot(s.tIn, nextOf(s, s.tIn));
    const pOut = ownerSpot(s.tOut, nextOf(s, s.tOut));
    // Where the next pass goes: he jogs on after it a little, then holds.
    const after = (extraPlan(s) ?? { after: pOut }).after;
    // He comes onto the ball from 6 m further back (as far as he can run in time) — or, winning it back, from his press.
    const regainer = !!spell && si === 0;
    const from = regainer ? spell!.pressStart : s.tIn <= 0 ? pIn : (() => { const back = { x: pIn.x + (pIn.x - CX) * 0.05, y: pIn.y + 6 }; const d = dist(back, pIn), m = 5 * s.tIn; return d <= m ? back : lerp(pIn, back, m / d); })();
    const path: Vec2[] = [], pin: number[] = [];
    const iA = idx(s.tIn);
    const held = heldSpots(iA, idx(s.tOut), (t) => ownerSpot(t, nextOf(s, t)));
    for (let i = 0; i <= N; i++) {
      const t = tOf(i);
      if (t < s.tIn) { path.push(lerp(from, pIn, smooth(t / Math.max(0.01, s.tIn)))); pin.push(regainer && t >= s.tIn - 0.35 ? 1 : 0); }
      else if (i - iA < held.length && i >= iA) { path.push(held[i - iA]); pin.push(1); }
      else { path.push(lerp(pOut, after, smooth((t - s.tOut) / Math.max(0.3, durS - s.tOut)))); pin.push(0); }
    }
    return { key: `extra${n}`, side: "extra", end: path[N], role: "CM", vmax: 8.5, path, pin };
  });

  // ── FHR-3: the covering defender, in from off the screen ──
  // The build-up's own camera (the match plays it with leadInCamera, framed on
  // the ball and the pass) says where the screen is at each moment: he waits
  // out of it, then sprints in and arrives at his place in the chance still
  // running. No way in that keeps him off the screen first: no cover.
  let cover: Person | null = null, coverEnter = 0;
  if (coverEnd) {
    const cam = leadInCamera({ durS, ballAt, posAt: () => null, passStart: acts.map((a) => a.t0), passEnd: acts.map((a) => a.t1) }, []);
    const frames: Viewport[] = [];
    for (let i = 0; i <= N; i++) frames.push(cam.at(tOf(i), frame));
    const offScreen = (p: Vec2, i: number, m = 1.5) => { const f = frames[clamp(i, 0, N)]; return p.x < f.x1 - m || p.x > f.x2 + m || p.y < f.y1 - m || p.y > f.y2 + m; };
    const vmax = topSpeedOf("CB");
    const vRun = Math.min(7.4, vmax * 0.86), vJog = 2;
    const inward = coverEnd.x < CX ? -1 : 1; // he comes from the middle of the pitch, behind the play
    let bestPlan: { path: Vec2[]; enter: number } | null = null;
    for (const ang of [0, 25, -25, 45, -45, 65, -65, 80, -80]) {
      const a = (ang * inward * Math.PI) / 180;
      const u = { x: Math.sin(a), y: Math.cos(a) }; // from his place, back up the pitch
      for (let Trun = Math.min(durS - 0.3, 5.5); Trun >= 2; Trun -= 0.25) {
        const t0 = durS - Trun;
        // Speed through the build-up: a jog, then (from t0) up to a sprint over 0.6 s.
        const speedAt = (t: number) => (t < t0 ? vJog : vJog + (vRun - vJog) * smooth((t - t0) / 0.6));
        const remaining: number[] = new Array(N + 1).fill(0);
        for (let i = N - 1; i >= 0; i--) remaining[i] = remaining[i + 1] + (speedAt(tOf(i)) + speedAt(tOf(i + 1))) / 2 / HZ;
        const path = remaining.map((d) => ({ x: coverEnd.x + u.x * d, y: coverEnd.y + u.y * d }));
        if (path.some((q) => q.x < 0.5 || q.x > PITCH_W - 0.5 || q.y < 0.5 || q.y > LEN - 0.5)) continue;
        // Off the screen until he starts his sprint (and a moment after), then in it.
        const i0 = Math.round(t0 * HZ);
        let hidden = true;
        for (let i = 0; i <= Math.min(N, i0 + 3) && hidden; i++) hidden = offScreen(path[i], i);
        if (!hidden) continue;
        let enter = -1;
        for (let i = i0; i <= N; i++) if (!offScreen(path[i], i, 0)) { enter = i; break; }
        if (enter < 0 || (N - enter) / HZ < 1.0) continue;
        bestPlan = { path, enter };
        break;
      }
      if (bestPlan) break;
    }
    if (bestPlan) {
      cover = { key: "cover0", side: "opp", end: { ...coverEnd }, role: "CB", vmax, path: bestPlan.path, pin: new Array(N + 1).fill(0) };
      coverEnter = bestPlan.enter / HZ;
    }
  }
  const oppx = loser && loser.side === "oppx" ? [loser] : [];
  const all = [...people, ...extras, ...oppx, ...(cover ? [cover] : [])];

  // ── Ease everybody apart ──
  separate(all, N, durS);
  // …which can leave a short burst too quick: smoothed out where it is (never a held sample, nor the end).
  for (const p of all) calmBursts(p.path, p.pin, p.vmax, N);

  // ── Phase 3: still running at the hand-over ──
  // Each man of the chance (not you, not the keeper) keeps the speed he
  // arrives with: at the hand-over he is a little short of his drawn spot
  // (at most FHR_RUNON_MAX_M, eased in over his last unheld stretch so his
  // speed is unchanged), then he slows evenly to a stop EXACTLY on it over
  // up to FHR_RUNON_S. A man standing still has nothing to carry on.
  // (A called offside, below, takes them away again: no chance to hand over to.)
  const runOnKeys: string[] = [];
  let runOnS = 0;
  for (const p of all) {
    if (p.side === "you" || p.side === "keeper" || p.side === "extra" || p.side === "oppx") continue;
    const n = N;
    if (n < 4) continue;
    const v = { x: ((p.path[n].x - p.path[n - 3].x) * HZ) / 3, y: ((p.path[n].y - p.path[n - 3].y) * HZ) / 3 };
    const sp = Math.hypot(v.x, v.y);
    if (sp < 0.8) continue;
    let lastPin = -1;
    for (let i = 0; i <= n; i++) if (p.pin[i]) lastPin = i;
    const i0 = Math.max(lastPin + 1, n - Math.round(1.6 * HZ), 1);
    const tr = (n - i0) / HZ;
    // How far short he is: the run-on's own distance (v·G/2), capped so easing it in never adds more than ~1.2 m/s.
    const cap = Math.min(FHR_RUNON_MAX_M, 0.8 * tr, (sp * FHR_RUNON_S) / 2);
    if ((2 * cap) / sp < 0.2) continue;
    // Whole samples: he slows over ng samples, so his speed at the hand-over is exactly v.
    const ng = Math.max(3, Math.round(((2 * cap) / sp) * HZ));
    const G = ng / HZ;
    const backM = (sp * G) / 2;
    const back = { x: (v.x / sp) * backM, y: (v.y / sp) * backM };
    for (let i = i0; i <= n; i++) {
      const w = smooth((i - i0) / Math.max(1, n - i0));
      p.path[i] = { x: p.path[i].x - back.x * w, y: p.path[i].y - back.y * w };
    }
    const q = p.path[n];
    for (let k = 1; k <= ng; k++) {
      const s = k / ng;
      p.path.push({ x: q.x + v.x * G * (s - 0.5 * s * s), y: q.y + v.y * G * (s - 0.5 * s * s) });
      p.pin.push(0);
    }
    p.path[p.path.length - 1] = { ...p.end };
    runOnKeys.push(p.key);
    runOnS = Math.max(runOnS, ng / HZ);
  }

  // ── B2b: OFFSIDE, judged at every pass ──
  // The law: at the moment the ball is played, a team-mate it goes to who is in
  // their half, nearer their goal line than both the ball and their
  // second-last man (the keeper counts) is offside. The engine's own rule,
  // read the same way (a goal in the picture; never when the law is off).
  // Such a run is either TIMED — he holds his run so he is level or just
  // behind the line when it is played, then goes (intel.onsideM: cleverer
  // team-mates sit closer to the line) — or MISTIMED (o.caught, intel.mistime:
  // likelier against a better side): the flag goes up when he takes it, the
  // free kick is theirs and the move ends there.
  const judged = !moment.offsideOff && goalInView(sc.kind);
  const opps = all.filter((p) => p.side === "opp" || p.side === "keeper" || p.side === "oppx");
  const lineAt = (t: number) => { const ys = opps.map((p) => atT(p, t).y).sort((a, b) => a - b); return ys.length >= 2 ? ys[1] : -Infinity; };
  const spellOfAct = (k: number) => spells.findIndex((s) => k >= s.first && k <= s.last);
  const byKeyNow = (key: string) => all.find((q) => q.key === key) ?? null;
  // Where a man is at t, read exactly as the lead-in's posAt reads his path.
  const atT = (p: Person, t: number): Vec2 => {
    const f = t * HZ, i = Math.floor(f), g = f - i, L = p.path.length - 1;
    const a0 = p.path[Math.min(L, Math.min(N, i))], b0 = p.path[Math.min(L, Math.min(N, i + 1))];
    return { x: a0.x + (b0.x - a0.x) * g, y: a0.y + (b0.y - a0.y) * g };
  };
  const passChecks: FhrBuildUp["passChecks"] = [];
  let called: { k: number; by: string; why: "mistimed" | "untimed" } | null = null;
  // Hold a run back by D metres at sample i0 (the pass), eased in before and made up by iPin (the ball reaching him).
  const timeRun = (p: Person, i0: number, iPin: number, D: number): boolean => {
    let lastPin = -1;
    for (let i = 0; i < i0; i++) if (p.pin[i]) lastPin = i;
    if (iPin <= i0 + 1) return false;
    const old = p.path.slice();
    for (const span of [22, 16, 10, 6]) {
      const iS = Math.max(lastPin + 1, i0 - span);
      if (iS >= i0) continue;
      const out = old.map((q, i) => {
        if (i < iS || i >= iPin) return q;
        const w = i <= i0 ? smooth((i - iS) / Math.max(1, i0 - iS)) : 1 - smooth((i - i0) / (iPin - i0));
        return { x: q.x, y: clamp(q.y + D * w, 0.3, LEN - 0.3) };
      });
      if (maxSpeed(out) <= p.vmax * 0.98) { p.path = out; return true; }
    }
    return false;
  };
  for (let k = 0; k < acts.length && !called; k++) {
    const a = acts[k];
    if (a.type !== "pass") continue;
    const by = owners[spellOfAct(k) + 1];
    const P = by ? byKeyNow(by) : null;
    if (!P) continue;
    const i0 = idx(a.t0);
    const line = lineAt(a.t0);
    const y = atT(P, a.t0).y;
    const isOff = (yy: number) => judged && yy < HALF_LEN - OFF_EPS && yy < a.from.y - OFF_EPS && yy < line - OFF_EPS;
    const row = { pass: k, by, behindLineM: y - line, judged, offside: isOff(y), called: false };
    if (row.offside) {
      if (o.caught) { row.called = true; called = { k, by, why: "mistimed" }; }
      else {
        const [m0, m1] = o.intel.onsideM;
        const D = Math.min(line, a.from.y) + m0 + (m1 - m0) * r() - y;
        if (timeRun(P, i0, idx(a.t1), D) && !isOff(atT(P, a.t0).y - 0.1)) { row.offside = false; row.behindLineM = atT(P, a.t0).y - line; }
        else if (o.callUntimed) { row.called = true; called = { k, by, why: "untimed" }; }
        else problems.push(`${UNTIMED}: ${by} for touch ${k + 1}`);
      }
    }
    passChecks.push(row);
  }

  // ── A called offside: the move ends there ──
  // He takes it, the flag goes up (the whistle), and everyone slows to a stop.
  // No chance follows: the lead-in ends here, on its own picture.
  let offside: FhrBuildUp["offside"];
  if (called) {
    const a = acts[called.k];
    const tFlag = a.t1 + OFFSIDE_FLAG_S;
    const tEnd = a.t1 + OFFSIDE_HOLD_S;
    const dirP = { x: (a.to.x - a.from.x) / (dist(a.from, a.to) || 1), y: (a.to.y - a.from.y) / (dist(a.from, a.to) || 1) };
    const stopAt = inPitch({ x: a.to.x + dirP.x * 0.9, y: a.to.y + dirP.y * 0.9 }, 0.5);
    const oldBall = ballAt;
    ballAt = (t: number) => {
      if (t <= a.t1) return oldBall(t);
      const f = smooth((t - a.t1) / 0.5);
      return { x: a.to.x + (stopAt.x - a.to.x) * f, y: a.to.y + (stopAt.y - a.to.y) * f, z: 0 };
    };
    const iF = Math.round(a.t1 * HZ);
    const Nn = Math.ceil(tEnd * HZ);
    for (const p of all) {
      const iv = Math.max(3, Math.min(iF, p.path.length - 1));
      const v = { x: ((p.path[iv].x - p.path[iv - 3].x) * HZ) / 3, y: ((p.path[iv].y - p.path[iv - 3].y) * HZ) / 3 };
      const at0 = p.path[Math.min(iF, p.path.length - 1)];
      const out: Vec2[] = p.path.slice(0, Math.min(iF, p.path.length - 1) + 1);
      const pin: number[] = p.pin.slice(0, out.length);
      for (let i = out.length; i <= Nn; i++) {
        const t = i / HZ;
        if (p.key === called.by) { const b = ballAt(t); out.push({ x: b.x - dirP.x * 0.6, y: b.y - dirP.y * 0.6 }); pin.push(1); continue; }
        const tau = Math.min(t - a.t1, 0.8), f = tau - (tau * tau) / 1.6;
        out.push(inPitch({ x: at0.x + v.x * f, y: at0.y + v.y * f }, 0.3));
        pin.push(0);
      }
      p.path = out; p.pin = pin;
    }
    durS = tEnd; N = Nn;
    runOnKeys.length = 0; runOnS = 0;
    offside = { at: tFlag, by: called.by, pass: called.k, spot: { ...a.to }, why: called.why };
  }

  // ── The checks ──
  for (const p of all) {
    const v = maxSpeed(p.path);
    if (v > p.vmax + 0.05) problems.push(`${p.key} runs ${v.toFixed(1)} m/s (top ${p.vmax.toFixed(1)})`);
    for (const q of p.path) if (q.x < -1 || q.x > PITCH_W + 1 || q.y < -1 || q.y > LEN + 1) { problems.push(`${p.key} leaves the pitch`); break; }
  }
  if (!called) {
    for (const e of [...extras, ...oppx]) if (inFrame(e.path[N], 1.5)) problems.push(`${e.key} is still in the chance's frame at the end`);
  }
  const overlap = minGap(all, Math.max(...all.map((p) => p.path.length - 1)), durS, spell && loser ? { a: loser.key, b: owners[0], until: Math.round((spell.tackleT + 0.5) * HZ) } : null);
  if (overlap.d < FHR_OVERLAP_M) problems.push(`${overlap.a} and ${overlap.b} ${overlap.d.toFixed(2)} m apart at ${(overlap.i / HZ).toFixed(1)} s`);
  // Nobody between the keeper and his goal (unless the drawing has him there at the end).
  for (const p of all) {
    if (p === keeper) continue;
    const endBehind = p.end.y < keeper.end.y - 0.3 && p.end.y < 6 && Math.abs(p.end.x - CX) < GOAL_W / 2 + 3;
    if (endBehind) continue;
    for (let i = 0; i < N - Math.round(0.6 * HZ); i++) {
      const q = p.path[i], k = keeper.path[i];
      if (q.y < k.y - 0.3 && q.y < 6 && Math.abs(q.x - CX) < GOAL_W / 2 + 3) { problems.push(`${p.key} behind the keeper at ${(i / HZ).toFixed(1)} s`); break; }
    }
  }
  // The man on the ball is at it when he plays it, and the receiver when it arrives.
  const posOf = (key: string, t: number) => { const p = all.find((q) => q.key === key)!; return p.path[Math.min(idx(t), p.path.length - 1)]; };
  const shown = called ? acts.slice(0, called.k + 1) : acts;
  shown.forEach((a, k) => {
    const sp = spellOfAct(k);
    const ow = owners[sp];
    // (You ease into the drawing's stance over the last half second: that far from it is allowed then.)
    const reach = (who: string, t: number) => (!called && who === "you" && t > durS - 0.6 ? Math.max(1.6, Math.hypot(youOff.x, youOff.y) + 0.3) : 1.6);
    if (dist(posOf(ow, a.t0), a.from) > reach(ow, a.t0)) problems.push(`${ow} is not on the ball for touch ${k + 1}`);
    if (a.type === "pass") {
      const rcv = owners[sp + 1];
      if (rcv && dist(posOf(rcv, a.t1), a.to) > reach(rcv, a.t1) + 0.2) problems.push(`${rcv} is not there to take touch ${k + 1}`);
    }
  });
  // The man who loses it is on the ball until he does, and the man who wins it is there.
  if (spell && loser) {
    for (let t = 0; t <= spell.tackleT; t += 0.2) if (dist(posOf(loser.key, t), ballAt(t)) > 1.2) { problems.push(`${loser.key} is not on the ball before it is won`); break; }
    if (dist(posOf(owners[0], spell.tackleT), ballAt(spell.tackleT)) > 1.6) problems.push(`${owners[0]} is not there to win it`);
  }

  // ── The lead-in the match plays ──
  const byKey = new Map(all.map((p) => [p.key, p]));
  // A man who carries on (phase 3) has samples past durS; everyone else stops at durS.
  // (Samples 0…N-1 are at i/HZ, sample N at durS; a run-on's sample N+k at durS + k/HZ.)
  const posAt = (key: string, t: number): Vec2 | null => {
    const p = byKey.get(key);
    if (!p) return null;
    const last = p.path.length - 1;
    if (t <= 0) return { ...p.path[0] };
    if (t >= durS) {
      const f = N + (t - durS) * HZ;
      if (f >= last) return { ...p.path[last] };
      const i = Math.floor(f), g = f - i;
      const a = p.path[i], b = p.path[i + 1];
      return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g };
    }
    const f = t * HZ, i = Math.floor(f), g = f - i;
    const a = p.path[Math.min(N, i)], b = p.path[Math.min(N, i + 1)];
    return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g };
  };
  const roles: Record<string, string> = {};
  for (const p of all) roles[p.key] = p.side === "keeper" ? "GK" : p.role;
  const signature = shown.map((a) => `${a.type === "pass" ? "P" : "C"}${zoneOf(a.from)}`).join("-") + `>${zoneOf(R)}` + (spell ? "R" : "") + (called ? "OFF" : "");
  const brk = moment.pattern === "transition";
  // The biggest moments say so (a level final, the 90th minute).
  const lastAttack = tp.drama >= 0.6 && (moment.minute ?? 0) >= 85;
  const caption = (t: number) => (offside && t >= offside.at ? "Offside!" : lastAttack ? "One last attack" : brk ? "On the break" : "Build-up");
  return {
    durS, ballAt, posAt,
    extraMates: extras.length,
    ...(oppx.length ? { extraOpps: oppx.length } : {}),
    passStart: shown.map((a) => a.t0),
    passEnd: shown.map((a) => a.t1),
    skippable: true,
    captionAt: caption,
    captionShown: true,
    ...(offside ? { offside, whistleAt: offside.at } : {}),
    ...(runOnKeys.length ? { runOnS, runOnKeys } : {}),
    ...(cover ? { joiners: [{ key: cover.key, side: "opp" as const, end: { ...cover.end } }] } : {}),
    acts: shown, owners, roles,
    actOwners: shown.map((_, k) => owners[spellOfAct(k)] ?? "you"),
    people: all.map((p) => ({ key: p.key, side: p.side, role: roles[p.key], vmax: p.vmax, path: p.path })),
    problems, tries: tryNo, signature, frame,
    drama: tp.drama,
    cover: cover ? { end: { ...cover.end }, enterS: coverEnter } : null,
    gap: o.intel.gap,
    regain: spell && loser ? { spot: { ...spell.G0 }, at: spell.tackleT, spellS: rgn!.spellS, scrappy: spell.scrappy, by: owners[0], from: loser.key, heightM: spell.G0.y } : null,
    passChecks,
    pressM, pressShare,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Paths: speed, spacing
// ─────────────────────────────────────────────────────────────────────────

/** The fastest a stored path moves (m/s), over 0.2 s stretches. */
export function maxSpeed(path: Vec2[]): number {
  const w = 3; // 0.2 s at HZ
  let v = 0;
  for (let i = w; i < path.length; i++) v = Math.max(v, (dist(path[i], path[i - w]) * HZ) / w);
  return v;
}

/** Smooths a path where it is briefly faster than `vmax` (held samples and the two ends stay put). */
export function calmBursts(path: Vec2[], pin: number[], vmax: number, N: number) {
  const w = 3;
  for (let it = 0; it < 40; it++) {
    const bad: number[] = [];
    for (let i = w; i <= N; i++) if ((dist(path[i], path[i - w]) * HZ) / w > vmax * 0.985) bad.push(i);
    if (!bad.length) return;
    const touch = new Set<number>();
    for (const i of bad) for (let k = i - w - 3; k <= i + 3; k++) if (k > 0 && k < N && !pin[k]) touch.add(k);
    if (!touch.size) return;
    const old = path.slice();
    for (const k of Array.from(touch)) path[k] = { x: 0.5 * old[k].x + 0.25 * (old[k - 1].x + old[k + 1].x), y: 0.5 * old[k].y + 0.25 * (old[k - 1].y + old[k + 1].y) };
  }
}

/** The closest two men come (not counting the last 0.6 s, where the drawing decides). */
function minGap(all: { key: string; path: Vec2[] }[], N: number, durS: number, challenge: { a: string; b: string; until: number } | null = null) {
  let best = { d: Infinity, a: "", b: "", i: 0 };
  const stop = Math.max(0, N - Math.round(0.6 * HZ));
  // (A man who stopped at durS stays where he stopped while the others carry on.)
  const at = (p: Vec2[], i: number) => p[Math.min(i, p.length - 1)];
  // Two men the drawing stands close together (a marker and his man) arrive
  // that way: theirs to decide in the last second before the hand-over too,
  // now that the men still running arrive after it (phase 3).
  const late = Math.round((durS - 1) * HZ);
  for (let i = 0; i < stop; i++) {
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const pa = all[a].path, pb = all[b].path;
      if (i >= late && (pa.length > late + HZ || pb.length > late + HZ) && dist(pa[pa.length - 1], pb[pb.length - 1]) < FHR_SPACE_M) continue;
      // B2b: the two in a challenge for the ball meet (until just after it is won).
      if (challenge && i <= challenge.until && ((all[a].key === challenge.a && all[b].key === challenge.b) || (all[a].key === challenge.b && all[b].key === challenge.a))) continue;
      const d = dist(at(pa, i), at(pb, i));
      if (d < best.d) best = { d, a: all[a].key, b: all[b].key, i };
    }
  }
  return best;
}

/**
 * Eases men apart who come closer than FHR_SPACE_M: a man held to the ball is
 * never moved; nearer the end the push fades, so everyone still ends exactly
 * where the drawing has him. The push is smoothed over time, so nobody jerks.
 */
export function separate(all: { path: Vec2[]; pin: number[] }[], N: number, durS: number) {
  const fade = (i: number) => clamp((durS - i / HZ) / 0.8, 0, 1);
  for (let it = 0; it < 6; it++) {
    const push: Vec2[][] = all.map(() => Array.from({ length: N + 1 }, () => ({ x: 0, y: 0 })));
    let any = false;
    for (let i = 0; i < N; i++) {
      const f = fade(i);
      if (f <= 0) continue;
      for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
        const pa = all[a].path[i], pb = all[b].path[i];
        let dx = pb.x - pa.x, dy = pb.y - pa.y;
        let d = Math.hypot(dx, dy);
        if (d >= FHR_SPACE_M) continue;
        if (d < 1e-3) { dx = (a % 2 ? 1 : -1) * 0.01; dy = 0.01; d = Math.hypot(dx, dy); }
        const need = (FHR_SPACE_M - d) * f;
        const la = all[a].pin[i] ? 0 : 1, lb = all[b].pin[i] ? 0 : 1;
        if (!la && !lb) continue;
        const sa = la / (la + lb), sb = lb / (la + lb);
        push[a][i].x -= (dx / d) * need * sa; push[a][i].y -= (dy / d) * need * sa;
        push[b][i].x += (dx / d) * need * sb; push[b][i].y += (dy / d) * need * sb;
        any = true;
      }
    }
    if (!any) break;
    // Smooth each man's push over ±0.4 s, then apply (never to a held sample, nor at the end).
    const K = 6;
    all.forEach((p, a) => {
      const sm: Vec2[] = [];
      for (let i = 0; i <= N; i++) {
        let sx = 0, sy = 0, w = 0;
        for (let k = -K; k <= K; k++) {
          const j = i + k;
          if (j < 0 || j > N) continue;
          const wk = K + 1 - Math.abs(k);
          sx += push[a][j].x * wk; sy += push[a][j].y * wk; w += wk;
        }
        sm.push({ x: (sx / w) * 2.2, y: (sy / w) * 2.2 });
      }
      for (let i = 0; i < N; i++) {
        if (p.pin[i]) continue;
        const f = fade(i);
        p.path[i] = { x: clamp(p.path[i].x + sm[i].x * f, 0.3, PITCH_W - 0.3), y: clamp(p.path[i].y + sm[i].y * f, 0.3, LEN - 0.3) };
      }
    });
  }
}
