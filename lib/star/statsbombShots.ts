/**
 * REAL SHOTS — StatsBomb's free open data, turned into our pitch and our
 * scenarios. TEST PAGE ONLY (/star-statsbomb-dev, Harry, 13 Oct 2026).
 *
 * The licence for a paid game is not cleared, so nothing in the real game
 * imports this file. The data is data/statsbomb/shots.json, made by
 * scripts/statsbomb/fetch_shots.py.
 *
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import { buildScenario, goalInView, VIEW_ASPECT, type Scenario, type ScenarioKind, type Vec2, type Viewport } from "./canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "./scenarioEdit";
import { frameFromScenario } from "./scenarioFrame";
import { mulberry32 } from "./season";
import { brainSetup, brainAim, brainOptionsHere } from "./keeperBrain";
import { enforceHardRules } from "./kindRules";
import { leadInEntities, ballAlong, LEAD_MAX_RUN, type LeadIn, type LeadEntity, type KeyPt, type LeadBallKey } from "./leadIn";
import { teamShapesAt } from "./sim90";
// Moved to leadIn.ts (shared with the build-ups, leadInGen.ts); still exported from here.
export { ballAlong, LEAD_MAX_RUN, type LeadBallKey } from "./leadIn";
import {
  PITCH_W, HALF_LEN, CX, GOAL_W, POST_L, POST_R, NET_DEPTH, BOX_DEPTH, BOX_L,
} from "./pitch";

export const STATSBOMB_CREDIT = "Data: StatsBomb open data (https://github.com/statsbomb/open-data)";

/** One real shot, as the file stores it. Positions are StatsBomb's own. */
export interface SbShot {
  id: string;
  comp: string;
  match: string;
  minute: number;
  player: string;
  team: string;
  outcome: string;
  xg: number;
  body: string;
  technique: string;
  type: string;
  /** [x, y] on StatsBomb's 120 x 80 pitch, attacking left to right. */
  loc: [number, number];
  end: [number, number] | null;
  /** Everyone near the shot: [x, y, teammate 0/1, keeper 0/1]. Not the shooter. */
  ff: [number, number, number, number][];
  /** The 360 camera's visible area, flat [x1, y1, x2, y2, ...]. */
  vis?: number[];
}

export interface SbFile { credit: string; shots: SbShot[] }

// ─────────────────────────────────────────────────────────────────────────
//  THE CONVERSION
// ─────────────────────────────────────────────────────────────────────────
//
// StatsBomb: 120 x 80 "yards", origin top-left, attacking left → right, so
// the goal being attacked is at x = 120, its posts at y = 36 and 44.
// Ours (lib/star/pitch.ts): metres, the attacking goal line is y = 0 and y
// grows upfield; x = 0 is the left touchline. The shooter's left is our left.
//
// StatsBomb's pitch is a fixed 120 x 80 whatever the real ground, but its
// markings are real yards: the box is 18 deep and 44 wide, the goal 8 wide,
// the spot 12 out. A plain stretch (68/80 across) made the goal 6.8 m, not
// 7.32. So the conversion is in two parts:
//   - inside the box's depth and width, real yards, scaled so every marking
//     lands exactly on ours (goal 7.32 m, spot 11 m, box 16.5 m);
//   - outside it, a straight stretch to our touchlines and halfway line, so
//     the corners land on our corners.

const SB_GOAL_X = 120;
const SB_MID_Y = 40;
const SB_BOX_DEPTH = 18;
const SB_BOX_HALF = 22;          // 44 yards wide
const SB_HALF = 60;
const DEPTH_YD = BOX_DEPTH / SB_BOX_DEPTH;      // 16.5 / 18
const WIDE_YD = GOAL_W / 8;                     // 7.32 / 8
const BOX_HALF_M = CX - BOX_L;                  // 20.16

/** Metres from our goal line for a StatsBomb x. */
function depthOf(sx: number): number {
  const d = SB_GOAL_X - sx;                     // yards from the goal line
  if (d <= SB_BOX_DEPTH) return d * DEPTH_YD;
  if (d <= SB_HALF) return BOX_DEPTH + (d - SB_BOX_DEPTH) * (HALF_LEN - BOX_DEPTH) / (SB_HALF - SB_BOX_DEPTH);
  return HALF_LEN + (d - SB_HALF) * HALF_LEN / SB_HALF;
}

/** Our x for a StatsBomb y. */
function acrossOf(sy: number): number {
  const off = sy - SB_MID_Y;
  const a = Math.abs(off);
  // Between the posts the goal is 8 yd = 7.32 m; from the post to the box's
  // edge is 18 yd = 16.5 m (the same scale as the box's depth).
  const m = a <= 4 ? a * WIDE_YD
    : a <= SB_BOX_HALF ? GOAL_W / 2 + (a - 4) * DEPTH_YD
    : BOX_HALF_M + (a - SB_BOX_HALF) * (CX - BOX_HALF_M) / (SB_MID_Y - SB_BOX_HALF);
  return CX + Math.sign(off) * m;
}

/** A StatsBomb point in our pitch metres. Pure; tested in tests/star/statsbomb.mts. */
export function sbToPitch(p: readonly number[]): Vec2 {
  return { x: acrossOf(p[1]), y: depthOf(p[0]) };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHO IS WHERE
// ─────────────────────────────────────────────────────────────────────────

export interface ShotPeople {
  ball: Vec2;
  end: Vec2 | null;
  keeper: Vec2 | null;
  opps: Vec2[];
  mates: Vec2[];
}

export function peopleOf(s: SbShot): ShotPeople {
  const ball = sbToPitch(s.loc);
  let keeper: Vec2 | null = null;
  const opps: Vec2[] = [], mates: Vec2[] = [];
  for (const [x, y, mate, gk] of s.ff) {
    const at = sbToPitch([x, y]);
    if (!mate && gk && !keeper) keeper = at;
    else if (mate) mates.push(at);
    else opps.push(at);
  }
  return { ball, end: s.end ? sbToPitch(s.end) : null, keeper, opps, mates };
}

/** Our closest chance kind. The kind is only the container (camera, rules);
 *  the people are the real ones. Headers and close crowded shots go in
 *  "volley", the close-range kind defined only as "inside 18 m", the same
 *  choice tools/statsbomb/convert.mts makes. */
export function kindForShot(s: SbShot): ScenarioKind {
  if (s.type === "Penalty") return "penalty";
  if (s.type === "Free Kick") return "free_kick";
  const { ball, opps } = peopleOf(s);
  if (ball.y >= 17) return "long_range";
  if (Math.abs(ball.x - CX) >= 9 && ball.y <= 15) return "tight_angle";
  if (s.body === "Head" || s.technique === "Volley" || s.technique === "Half Volley") return "volley";
  return blockersOf(ball, opps) === 0 ? "one_on_one" : "volley";
}

/**
 * The kind the ENGINE plays the shot as. Same as kindForShot, except a
 * crowded close shot struck off the ground: "volley" makes the ball drop out
 * of the air (the airborne strike), which is only right for a real header or
 * volley. Seen on the page: a side-foot in a crowded box played as a ball
 * falling from the sky. Those play as "one_on_one" (the real defenders are
 * still all there; no kind rule moves them).
 */
export function playKindForShot(s: SbShot): ScenarioKind {
  const k = kindForShot(s);
  if (k === "volley" && s.body !== "Head" && s.technique !== "Volley" && s.technique !== "Half Volley") return "one_on_one";
  return k;
}

export const KIND_LABEL: Partial<Record<ScenarioKind, string>> = {
  one_on_one: "One-on-one", volley: "In the box", tight_angle: "Tight angle",
  long_range: "Long range", penalty: "Penalty", free_kick: "Free kick",
};

// ─────────────────────────────────────────────────────────────────────────
//  THE MEASURES — the same four numbers for a real shot and for ours
// ─────────────────────────────────────────────────────────────────────────

/** Opponents inside the triangle ball → near post → far post (the keeper
 *  is not counted: he is measured on his own). */
export function blockersOf(ball: Vec2, opps: Vec2[]): number {
  const a = ball, b = { x: POST_L, y: 0 }, c = { x: POST_R, y: 0 };
  const sgn = (p: Vec2, q: Vec2, r: Vec2) => (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y);
  return opps.filter((p) => {
    const d1 = sgn(p, a, b), d2 = sgn(p, b, c), d3 = sgn(p, c, a);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }).length;
}

export interface ShotMeasure {
  /** Metres from the ball to the centre of the goal. */
  distance: number;
  /** Opponents between the ball and the goal mouth. */
  blockers: number;
  /** Metres to the nearest opponent (not the keeper). Null: nobody near. */
  nearest: number | null;
  /** Metres the keeper stands off his line. Null: no keeper in the frame. */
  keeperOff: number | null;
}

export function measureOf(ball: Vec2, opps: Vec2[], keeper: Vec2 | null): ShotMeasure {
  const near = opps.map((o) => Math.hypot(o.x - ball.x, o.y - ball.y));
  return {
    distance: Math.hypot(ball.x - CX, ball.y),
    blockers: blockersOf(ball, opps),
    nearest: near.length ? Math.min(...near) : null,
    keeperOff: keeper ? Math.max(0, keeper.y) : null,
  };
}

export function measureReal(s: SbShot): ShotMeasure {
  const p = peopleOf(s);
  return measureOf(p.ball, p.opps, p.keeper);
}

export function measureScenario(sc: Scenario): ShotMeasure {
  return measureOf(sc.ball, sc.defenders.map((d) => ({ x: d.x, y: d.y })), { x: sc.keeper.x, y: sc.keeper.y });
}

/** Our own chances of a kind, the way the game builds them (seeds 1..n). */
export function ourMeasures(kind: ScenarioKind, n = 200): ShotMeasure[] {
  const out: ShotMeasure[] = [];
  for (let i = 1; i <= n; i++) out.push(measureScenario(buildScenario(kind, mulberry32(i * 7919 + 11))));
  return out;
}

export interface MeasureMeans { n: number; distance: number; blockers: number; nearest: number; keeperOff: number }

export function meansOf(ms: ShotMeasure[]): MeasureMeans {
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;   // NaN: nobody to measure
  };
  return {
    n: ms.length,
    distance: avg(ms.map((m) => m.distance)),
    blockers: avg(ms.map((m) => m.blockers)),
    nearest: avg(ms.map((m) => m.nearest)),
    keeperOff: avg(ms.map((m) => m.keeperOff)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  A REAL SHOT AS ONE OF OUR SCENARIOS
// ─────────────────────────────────────────────────────────────────────────
//
// The gallery's own path (the same one /star-real-moments-dev uses): the
// engine builds its own chance of the kind, and a PosOverride puts the real
// people on top — the shooter is YOU with the ball at his feet, the real
// keeper, and every real opponent and team-mate inside the camera.

const r2 = (v: number) => Math.round(v * 100) / 100;
const rv = (v: Vec2): Vec2 => ({ x: r2(v.x), y: r2(v.y) });

/** Real people this close to the ball are always in the picture (Harry, 14 Oct 2026). */
export const FRAME_PEOPLE_M = 20;
/** Grass kept round the outermost man / post, in metres. */
const FRAME_PAD_M = 3;

/**
 * A 5:8 frame (the game's) holding the whole goal, the ball, the keeper and
 * every real player within FRAME_PEOPLE_M of the ball. The page plays it with
 * `scene.ownFrame`, so this is the camera on screen (the canvas only ever
 * grows it to its own shape). A wide man used to be cut off by the old
 * 42 m-tall cap; there is no cap now beyond what the people need.
 */
export function cameraFor(ball: Vec2, keeper: Vec2 | null, people: Vec2[] = []): Viewport {
  const near = people.filter((q) => Math.hypot(q.x - ball.x, q.y - ball.y) <= FRAME_PEOPLE_M);
  const pts = [ball, ...(keeper ? [keeper] : []), ...near, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH }];
  const pad = FRAME_PAD_M;
  const x1 = Math.min(...pts.map((p) => p.x)) - pad, x2 = Math.max(...pts.map((p) => p.x)) + pad;
  const y1 = Math.min(-NET_DEPTH - 2, Math.min(...pts.map((p) => p.y)) - pad);
  const yBot = Math.max(...pts.map((p) => p.y)) + pad + 3; // room below the lowest man to pull back into
  const h = Math.max(28, yBot - y1, (x2 - x1) / VIEW_ASPECT);
  const w = h * VIEW_ASPECT;
  // Centred on the people; nudged onto the pitch only while that keeps them all in.
  let cx = (x1 + x2) / 2;
  const lo = -3 + w / 2, hi = PITCH_W + 3 - w / 2;
  const a = Math.max(lo, x2 - w / 2), b = Math.min(hi, x1 + w / 2);
  if (a <= b) cx = Math.min(Math.max(cx, a), b);
  return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
}

/** Is `q` on screen in `v` (a man's centre at least `m` metres inside)? */
export function onScreen(v: Viewport, q: Vec2, m = 0.8): boolean {
  return q.x > v.x1 + m && q.x < v.x2 - m && q.y > v.y1 + m && q.y < v.y2 - m;
}

/** Every real player within FRAME_PEOPLE_M of the ball, the keeper and the whole goal on screen in `v`? */
export function frameHoldsShot(s: SbShot, v: Viewport): boolean {
  const p = peopleOf(s);
  const need = [...(p.keeper ? [p.keeper] : []), ...[...p.opps, ...p.mates].filter((q) => Math.hypot(q.x - p.ball.x, q.y - p.ball.y) <= FRAME_PEOPLE_M), p.ball];
  const goal = [{ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: POST_L, y: -NET_DEPTH }, { x: POST_R, y: -NET_DEPTH }];
  return need.every((q) => onScreen(v, q)) && goal.every((q) => onScreen(v, q, 0));
}

export function seedForShot(s: SbShot): number {
  return Math.abs(s.id.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
}

/**
 * The close camera (13 Oct 2026): ball, keeper and goal only, at most 42 m
 * tall. The Moving highlight keeps it (its lead-in camera glides to it).
 */
function closeCameraFor(ball: Vec2, keeper: Vec2 | null): Viewport {
  const pts = [ball, ...(keeper ? [keeper] : []), { x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH }];
  const pad = 4;
  const x1 = Math.min(...pts.map((p) => p.x)) - pad, x2 = Math.max(...pts.map((p) => p.x)) + pad;
  const yTop = Math.min(...pts.map((p) => p.y)) - pad * 0.875, yBot = Math.max(...pts.map((p) => p.y)) + pad * 0.875 + 6;
  const h = Math.min(42, Math.max(28, yBot - yTop, (x2 - x1) / VIEW_ASPECT));
  const w = h * VIEW_ASPECT;
  const cx = Math.min(PITCH_W + 3 - w / 2, Math.max(-3 + w / 2, (x1 + x2) / 2));
  let y1 = -NET_DEPTH - 2;
  if (ball.y + pad > y1 + h) y1 = ball.y + pad - h;
  return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
}

/** `wide`: the Play camera (cameraFor: everyone within 20 m). Absent: the close camera. */
export function overrideForShot(s: SbShot, kind: ScenarioKind, seed: number, wide = false, allPeople = false): PosOverride {
  const p = peopleOf(s);
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);
  // A penalty keeps the game's own penalty camera (the spot never moves).
  const camera = goalInView(kind) && kind !== "penalty" ? (wide ? cameraFor(p.ball, p.keeper, [...p.opps, ...p.mates]) : closeCameraFor(p.ball, p.keeper)) : sc.viewport;
  // allPeople (the Real Goals page): every real man in the frame, on screen or not, so the build-up never has to make one vanish.
  const inside = (q: Vec2) => allPeople || !camera || (q.x > camera.x1 + 0.8 && q.x < camera.x2 - 0.8 && q.y > camera.y1 + 0.8 && q.y < camera.y2 - 0.8);
  const ov: PosOverride = { items: {}, removed: [], added: [], ball: rv(p.ball) };
  if (camera) ov.camera = camera;
  for (const it of frame.items) if (it.removable) ov.removed!.push(it.id);
  const keeperItem = frame.items.find((it) => it.keeper);
  const youItem = frame.items.find((it) => it.side === "you");
  if (keeperItem && p.keeper) ov.items[keeperItem.id] = rv(p.keeper);
  // YOU stand just behind the ball, on the side away from goal.
  const away = { x: p.ball.x - CX, y: p.ball.y };
  const len = Math.hypot(away.x, away.y) || 1;
  if (youItem) ov.items[youItem.id] = rv({ x: p.ball.x + away.x / len * 0.9, y: p.ball.y + away.y / len * 0.9 });
  let n = 0;
  for (const [q, mate] of [...p.opps.map((o) => [o, false] as const), ...p.mates.map((m) => [m, true] as const)]) {
    if (!inside(q) || Math.hypot(q.x - p.ball.x, q.y - p.ball.y) < 0.6) continue;
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(q);
  }
  return ov;
}

/**
 * The real shot as one of our scenarios, built fresh every call.
 * `wideFrame`: the Play tab's camera (every real man within 20 m and the whole
 * goal; played with `scene.ownFrame`). Absent: the close camera.
 */
export function scenarioForShot(s: SbShot, opts: { wideFrame?: boolean; allPeople?: boolean } = {}): Scenario {
  const kind = playKindForShot(s);
  const seed = seedForShot(s);
  const sc = buildScenario(kind, mulberry32(seed));
  applyOverrideToScenario(sc, overrideForShot(s, kind, seed, !!opts.wideFrame, !!opts.allPeople));
  // The real keeper starts where he really stood (keeperHoldsStart): the keeper
  // brain would otherwise walk him to OUR set spot while you aim (measured:
  // 2.15 m off his line real → 1.91 m after 2 s of aiming, all 2,741 shots).
  if (peopleOf(s).keeper) sc.keeperHoldsStart = true;
  return sc;
}

/**
 * Where the real keeper is after `aimS` seconds of you aiming, when the real
 * shot is played in our engine (the keeper brain's set walk, as CanvasMatch
 * runs it: hard rules, brainSetup, then brainAim every frame). Metres off his
 * line. `hold` false = as before the fix (he walks to our set spot).
 * Null: no keeper in the freeze frame.
 */
export function playedKeeperOff(s: SbShot, aimS = 2, hold = true): number | null {
  if (!peopleOf(s).keeper) return null;
  const sc = scenarioForShot(s);
  if (!hold) delete sc.keeperHoldsStart;
  enforceHardRules(sc);
  brainSetup(sc, (seedForShot(s) ^ 0x4b7e) >>> 0, sc.keeperStrength, brainOptionsHere());
  for (let t = 0; t < aimS; t += 1 / 60) brainAim(sc, 1 / 60);
  return Math.max(0, sc.keeper.y);
}

// ─────────────────────────────────────────────────────────────────────────
//  THE MOVING LEAD-IN — the 2-3 passes before the shot (display only)
// ─────────────────────────────────────────────────────────────────────────
//
// Harry, 13 Oct 2026: "passes 2/3 times before receiving the ball moving
// highlight". data/statsbomb/leadins.json holds, per shot, the last 2-3
// completed passes of the same move and, where StatsBomb has one, the 360
// frame of the first of them. The page draws it as keyframes with CSS
// transitions (no game loop, no physics): the ball goes pass to pass, and
// everyone drifts from where the 360 frame had them to where the shot's
// freeze frame has them. Then the real engine takes over at the shot.

/** One pass: [seconds before the shot, from, to, passer, recipient]. */
export type SbPass = [number, [number, number], [number, number], string, string];

export interface SbLeadin {
  passes: SbPass[];
  /** Earlier touches of the move, [minute (decimal), x, y] — the radar's path. */
  path: [number, number, number][];
  /** The 360 frame of the first pass: [x, y, teammate, keeper, actor]. */
  start?: [number, number, number, number, number][];
}

export interface SbLeadinFile { credit: string; leadins: Record<string, SbLeadin> }

/** A point the ball reaches, and how long it takes to get there. */
export interface LeadKey { ms: number; ball: Vec2; text: string }

/** One person in the lead-in, from where he starts to where the shot has him. */
export interface LeadDot { id: string; side: "you" | "mate" | "opp" | "keeper"; from: Vec2; to: Vec2 }

export interface LeadPlan {
  keys: LeadKey[];
  dots: LeadDot[];
  /** How far through the lead-in (0..1) each key is. */
  at: number[];
}

const passMs = (a: Vec2, b: Vec2) => Math.round(Math.min(1500, Math.max(450, Math.hypot(a.x - b.x, a.y - b.y) * 55)));
const carryMs = (a: Vec2, b: Vec2) => Math.round(Math.min(1600, Math.max(250, Math.hypot(a.x - b.x, a.y - b.y) * 160)));
const lastName = (n: string) => n.split(" ").slice(-1)[0];

export function leadinPlan(s: SbShot, lead: SbLeadin): LeadPlan {
  const shotAt = sbToPitch(s.loc);
  const keys: LeadKey[] = [];
  let ball = sbToPitch(lead.passes[0][1]);
  keys.push({ ms: 0, ball, text: `${lastName(lead.passes[0][3])} on the ball` });
  lead.passes.forEach((p, i) => {
    const from = sbToPitch(p[1]), to = sbToPitch(p[2]);
    if (i > 0 && Math.hypot(from.x - ball.x, from.y - ball.y) > 0.5) {
      keys.push({ ms: carryMs(ball, from), ball: from, text: `${lastName(p[3])} carries it` });
    }
    keys.push({ ms: passMs(from, to), ball: to, text: `${lastName(p[3])} → ${lastName(p[4])}` });
    ball = to;
  });
  if (Math.hypot(shotAt.x - ball.x, shotAt.y - ball.y) > 0.5) {
    keys.push({ ms: carryMs(ball, shotAt), ball: shotAt, text: `${lastName(s.player)} sets himself` });
  }
  const total = keys.reduce((a, k) => a + k.ms, 0) || 1;
  let run = 0;
  const at = keys.map((k) => (run += k.ms) / total);

  // Where everyone ends: the shot's freeze frame, and the shooter on the ball.
  const dots: LeadDot[] = [{ id: "you", side: "you", from: shotAt, to: shotAt }];
  s.ff.forEach(([x, y, mate, gk], i) => {
    const to = sbToPitch([x, y]);
    dots.push({ id: `p${i}`, side: mate ? "mate" : gk ? "keeper" : "opp", from: to, to });
  });
  const lastTo = sbToPitch(lead.passes[lead.passes.length - 1][2]);
  if (!lead.start) {
    // No 360 frame: only the shooter moves, from where the last pass found him.
    dots[0].from = lastTo;
    return { keys, dots, at };
  }
  // Where they started: the 360 frame of the first pass, matched to the end
  // positions by nearest unused man on the same side (frames carry no names).
  const starts = lead.start.map(([x, y, mate, gk]) => ({
    at: sbToPitch([x, y]), side: (mate ? "mate" : gk ? "keeper" : "opp") as LeadDot["side"], used: false,
  }));
  const take = (side: LeadDot["side"], near: Vec2): Vec2 | null => {
    let best = -1, bd = Infinity;
    starts.forEach((st, i) => {
      if (st.used || st.side !== side) return;
      const d = Math.hypot(st.at.x - near.x, st.at.y - near.y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0 || bd > 14) return null;
    starts[best].used = true;
    return starts[best].at;
  };
  // A team's shape travels with the ball. Where the 360 frame has nobody
  // near enough to be this man, he starts where his shape would have put him
  // (shifted back along the ball's journey: attackers more, defenders less,
  // the keeper not at all). Seen on the page: a move from a goal kick left
  // everyone standing in the box 90 m from the ball.
  const ball0 = keys[0].ball;
  const shift = { x: ball0.x - shotAt.x, y: ball0.y - shotAt.y };
  const share: Record<LeadDot["side"], number> = { you: 0.6, mate: 0.6, opp: 0.4, keeper: 0 };
  const guess = (d: LeadDot): Vec2 => ({
    x: Math.min(PITCH_W, Math.max(0, d.to.x + shift.x * share[d.side])),
    y: Math.min(2 * HALF_LEN, Math.max(0, d.to.y + shift.y * share[d.side])),
  });
  // The shooter is the man the last pass found: start him nearest that spot.
  dots[0].from = take("mate", lastTo) ?? lastTo;
  for (const d of dots.slice(1)) d.from = take(d.side, guess(d)) ?? guess(d);
  return { keys, dots, at };
}

export const lerpVec = (a: Vec2, b: Vec2, f: number): Vec2 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

// ─────────────────────────────────────────────────────────────────────────
//  THE LEAD-IN IN THE MATCH'S OWN PICTURE (2D and 3D)
// ─────────────────────────────────────────────────────────────────────────
//
// Harry, 13 Oct 2026: "the 3 shots in real shot and all of it should be in 3d
// aswell and needs to be playable in 2d/3d. u need to actually see the 3 moves
// before u". The real match plays this (CanvasMatch's `leadIn`, lib/star/leadIn.ts)
// as a replay of the recorded positions, then the chance starts where it ends.

/** Seconds a pass of this length takes. */
const passFlightS = (d: number) => Math.min(1.8, Math.max(0.35, d / 16));
/** Seconds a carry of this length takes (0: no carry). */
const carryS = (d: number) => (d < 0.5 ? 0 : Math.min(2.2, Math.max(0.2, d / 6)));
/** A lead-in longer than this is played faster (the same shape, quicker). */
export const LEAD_MAX_S = 12;
/** The pause on the ball before the first pass. */
export const LEAD_HOLD_S = 0.45;

/**
 * The ball's timeline at the real timing: each pass starts the real number of
 * seconds before the shot that StatsBomb has (pushed later only where the ball
 * could not have got there in time), and the whole is sped up only when it
 * would last longer than LEAD_MAX_S. Ends on `end` (the chance's ball).
 */
export function leadinBallKeys(s: SbShot, lead: SbLeadin, end: Vec2): LeadBallKey[] {
  const s0 = lead.passes[0][0];
  const keys: LeadBallKey[] = [];
  let t = 0;
  let ball = sbToPitch(lead.passes[0][1]);
  keys.push({ t: 0, p: ball });
  lead.passes.forEach((p, i) => {
    const from = sbToPitch(p[1]), to = sbToPitch(p[2]);
    const real = LEAD_HOLD_S + (s0 - p[0]);
    const carry = carryS(Math.hypot(from.x - ball.x, from.y - ball.y));
    // Carried to where the next pass is played from, arriving just before it.
    if (carry > 0) { t = Math.max(t + carry, real - 0.15); keys.push({ t, p: from }); }
    t = Math.max(t + (i === 0 ? LEAD_HOLD_S : 0.12), real);
    if (keys[keys.length - 1].t < t) keys.push({ t, p: from });
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    t += passFlightS(d);
    keys.push({ t, p: to, pass: { h: d > 22 ? Math.min(5, d * 0.1) : 0 } });
    ball = to;
  });
  const shotReal = LEAD_HOLD_S + s0;
  const last = carryS(Math.hypot(end.x - ball.x, end.y - ball.y));
  t = Math.max(t + Math.max(0.35, last), shotReal);
  keys.push({ t, p: { ...end } });
  if (t > LEAD_MAX_S) { const k = LEAD_MAX_S / t; for (const q of keys) q.t *= k; }
  return keys;
}

const lastNameOf = (n: string) => n.split(" ").slice(-1)[0];

export type LeadTrack = LeadIn & {
  ballKeys: LeadBallKey[];
  /** Each man's path: where he is at each key time (eased between). */
  paths: Map<string, KeyPt[]>;
  /** Who plays each pass (an entity key), and when each pass starts and arrives. */
  holders: (string | null)[];
  passStart: number[];
  passEnd: number[];
};

// ─────────────────────────────────────────────────────────────────────────
//  WHO MOVES, AND HOW (Harry, 14 Oct 2026: "use the tech you used for build
//  up, as in real shots they don't pass, they just run after the ball
//  endlessly")
// ─────────────────────────────────────────────────────────────────────────
//
// The same way the career's build-ups move people (leadInGen.ts):
//   - the BALL follows the real passes, at the real timing (leadinBallKeys);
//   - the man who plays each real pass is ON the ball from the moment the
//     pass before reaches him until he plays his own; YOU take the last one
//     and carry it onto the shot's spot;
//   - EVERYONE ELSE moves on one eased path from where he started (StatsBomb's
//     360 frame of the first pass; without one, his team's shape for where the
//     ball is then, sim90's teamShapesAt) straight to where the shot's freeze
//     frame has him. Nobody else runs at the ball;
//   - nobody runs faster than LEAD_MAX_RUN (9 m/s): a start is pulled in only
//     as far as he needs to get there in time. A man on the ball goes at the
//     ball's own (real) speed.
// The men who play the passes are chosen by name (one man plays every pass a
// name plays): the team-mate who can be on the ball each time without running
// faster than a man can and with his start moved least. Nobody can: a
// team-mate who is in the move but not in the shot's picture (extra0…).

/** Half a smooth start-and-stop, half steady (leadInGen.ts): top speed is 1.25 × the average. */
const leadEase = (f: number) => { const c = Math.min(1, Math.max(0, f)); return 0.5 * c + 0.5 * c * c * (3 - 2 * c); };
/** The average speed along one stretch that keeps his top speed under LEAD_MAX_RUN. */
const LEAD_RUN_AVG = (LEAD_MAX_RUN / 1.25) * 0.97;
/** How far a man's 360 start may be moved to make him the passer (m); a team-shape guess may move further. */
const MOVE_360_M = 9, MOVE_GUESS_M = 28;

function alongEased(keys: KeyPt[], t: number): Vec2 {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const g = b.t > a.t ? leadEase((t - a.t) / (b.t - a.t)) : 1;
      return { x: a.p.x + (b.p.x - a.p.x) * g, y: a.p.y + (b.p.y - a.p.y) * g };
    }
  }
  return { ...keys[keys.length - 1].p };
}
/** A start no further from `to` than a man covers in `s` seconds. */
const reachFrom = (from: Vec2, to: Vec2, s: number): Vec2 => {
  const dd = Math.hypot(from.x - to.x, from.y - to.y), r = LEAD_RUN_AVG * Math.max(0, s);
  if (dd <= r) return { ...from };
  const k = r / dd;
  return { x: to.x + (from.x - to.x) * k, y: to.y + (from.y - to.y) * k };
};
/** Greedy nearest pairs: each end spot gets the nearest unused shape slot. */
function nearestSlots(ends: Vec2[], slots: Vec2[]): (Vec2 | null)[] {
  const pairs: { i: number; j: number; d: number }[] = [];
  ends.forEach((e, i) => slots.forEach((s, j) => pairs.push({ i, j, d: Math.hypot(e.x - s.x, e.y - s.y) })));
  pairs.sort((a, b) => a.d - b.d);
  const out: (Vec2 | null)[] = ends.map(() => null);
  const usedJ = new Set<number>();
  for (const pr of pairs) {
    if (out[pr.i] || usedJ.has(pr.j)) continue;
    out[pr.i] = { ...slots[pr.j] };
    usedJ.add(pr.j);
  }
  return out;
}

/**
 * The real shot's lead-in for the chance `sc` (scenarioForShot, once the match
 * has set it up): the ball at the real timing, each passer on the ball from
 * the pass before until his own, YOU taking the last one, and everyone else
 * walking or jogging from his start (360 frame, else team shape) to exactly
 * where the chance has him. See "WHO MOVES, AND HOW" above.
 */
export function leadinTrack(
  s: SbShot, lead: SbLeadin, sc: Scenario,
  /** The Real Goals page: the ball's own timeline (every pass and carry at the real timing). Absent: leadinBallKeys. */
  opts: { ballKeys?: (end: Vec2) => LeadBallKey[]; isNamed?: (key: string, passer: string) => boolean | undefined } = {},
): LeadTrack {
  const plan = leadinPlan(s, lead);
  const end = { x: sc.ball.x, y: sc.ball.y };
  const ballKeys = opts.ballKeys ? opts.ballKeys(end) : leadinBallKeys(s, lead, end);
  const durS = ballKeys[ballKeys.length - 1].t;
  const ballAt = (t: number) => ballAlong(ballKeys, t);
  const ents = leadInEntities(sc);
  const passStart: number[] = [], passEnd: number[] = [];
  for (let i = 1; i < ballKeys.length; i++) if (ballKeys[i].pass) { passStart.push(ballKeys[i - 1].t); passEnd.push(ballKeys[i].t); }
  const n = lead.passes.length;
  const endOf = new Map<string, Vec2>(ents.map((e) => [e.key, e.get()]));
  // The chance has you just behind the ball: the man on the ball stands there too.
  const youEnd = endOf.get("you")!;
  const off = { x: youEnd.x - end.x, y: youEnd.y - end.y };
  const onBall = (t: number): Vec2 => { const b = ballAt(t); return { x: b.x + off.x, y: b.y + off.y }; };

  // ── Where each man starts: the 360 frame, else his team's shape ──
  const used = new Set<string>();
  const dotFor = (side: LeadEntity["side"], at: Vec2): LeadDot | null => {
    let best: LeadDot | null = null, bd = 1.2;
    for (const d of plan.dots) {
      if (used.has(d.id) || d.id === "you") continue;
      if ((d.side === "mate") !== (side === "mate") || (d.side === "keeper") !== (side === "keeper")) continue;
      const dd = Math.hypot(d.to.x - at.x, d.to.y - at.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (best) used.add(best.id);
    return best;
  };
  const shapes = teamShapesAt({ us: s.team, them: "Opponents", ball: ballKeys[0].p, seed: seedForShot(s) });
  const shapeOf = new Map<string, Vec2>();
  const keeperEnt = ents.find((e) => e.side === "keeper")!;
  const opps = ents.filter((e) => e.side === "opp");
  const mates = ents.filter((e) => e.side === "mate" || e.side === "you");
  shapeOf.set(keeperEnt.key, { ...shapes.them[0] });
  nearestSlots(opps.map((e) => endOf.get(e.key)!), shapes.them.slice(1)).forEach((p, i) => { if (p) shapeOf.set(opps[i].key, p); });
  nearestSlots(mates.map((e) => endOf.get(e.key)!), shapes.us.slice(1)).forEach((p, i) => { if (p) shapeOf.set(mates[i].key, p); });
  const base = new Map<string, Vec2>();
  /** Men whose start is a guess (no 360 man for them): their start may move further. */
  const guessed = new Set<string>();
  for (const e of ents) {
    const to = e.get();
    const dot = e.key === "you" ? null : dotFor(e.side, to);
    if (dot) base.set(e.key, dot.from);
    else if (e.key === "you" && lead.start) base.set(e.key, plan.dots[0].from);
    else { guessed.add(e.key); base.set(e.key, shapeOf.get(e.key) ?? to); }
  }

  // ── When each name is on the ball ──
  // The passer of pass i has it from the moment pass i-1 arrives (the first
  // passer from the start) until he plays it. YOU: from the last pass to the shot.
  interface Spell { t0: number; t1: number }
  const spellsOf = new Map<string, Spell[]>();
  const nameOf = (i: number) => (lead.passes[i][3] === s.player ? s.player : lead.passes[i][3]);
  lead.passes.forEach((p, i) => {
    const name = nameOf(i);
    const list = spellsOf.get(name) ?? [];
    list.push({ t0: i === 0 ? 0 : passEnd[i - 1], t1: passStart[i] });
    spellsOf.set(name, list);
  });
  const shooterSpells = spellsOf.get(s.player) ?? [];
  shooterSpells.push({ t0: passEnd[n - 1], t1: durS });
  spellsOf.set(s.player, shooterSpells);

  /** A man's path keys through his spells, from `start` to `fin`. Null when he cannot make it without running faster than a man can. */
  const pathThrough = (start: Vec2, fin: Vec2, spells: Spell[], freeStart: boolean, force = false): { keys: KeyPt[]; moved: number } | null => {
    const keys: KeyPt[] = [];
    const first = spells[0];
    const S = freeStart ? reachFrom(start, onBall(first.t0), first.t0) : start;
    const moved = Math.hypot(S.x - start.x, S.y - start.y);
    keys.push({ t: 0, p: S });
    let last: KeyPt = keys[0];
    const fits = (a: KeyPt, b: KeyPt) => force || Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) <= LEAD_RUN_AVG * (b.t - a.t) + 1e-6;
    for (const sp of spells) {
      const k0 = { t: sp.t0, p: onBall(sp.t0) }, k1 = { t: sp.t1, p: onBall(sp.t1) };
      if (!fits(last, k0)) return null;
      if (k0.t > last.t) keys.push(k0); else keys[keys.length - 1] = k0;
      keys.push(k1);
      last = k1;
    }
    const kEnd = { t: durS, p: { ...fin } };
    if (last.t < durS) { if (!fits(last, kEnd)) return null; keys.push(kEnd); }
    return { keys, moved };
  };

  const paths = new Map<string, KeyPt[]>();
  const spellsByKey = new Map<string, Spell[]>();
  const nameKey = new Map<string, string>([[s.player, "you"]]);
  let extraMates = 0;
  // YOU: the shot's own man (his start moves as far as he needs, he is the shooter).
  {
    const pth = pathThrough(base.get("you")!, youEnd, shooterSpells, true)
      // (A one-two too quick for one man at 9 m/s: the real touches win.)
      ?? pathThrough(base.get("you")!, youEnd, shooterSpells, true, true)!;
    paths.set("you", pth.keys);
    spellsByKey.set("you", shooterSpells);
  }
  // The other names, in the order they first touch it.
  const names = Array.from(new Set(lead.passes.map((_, i) => nameOf(i)))).filter((nm) => nm !== s.player);
  for (const name of names) {
    const spells = spellsOf.get(name)!;
    let best: { key: string; keys: KeyPt[]; cost: number } | null = null;
    for (const e of ents) {
      if (e.side !== "mate" || paths.has(e.key)) continue;
      const pth = pathThrough(base.get(e.key)!, endOf.get(e.key)!, spells, true);
      if (!pth) continue;
      const cap = guessed.has(e.key) ? MOVE_GUESS_M : MOVE_360_M;
      // The Real Goals page: the man wearing the passer's real name plays his pass, if he can get there;
      // a man wearing ANOTHER real name never does (undefined: he has no name).
      const match = opts.isNamed?.(e.key, name);
      if (match === false) continue;
      const named = match === true;
      if (pth.moved > cap && !named) continue;
      const cost = pth.moved + (guessed.has(e.key) ? 2 : 0) - (named ? 1000 : 0);
      if (!best || cost < best.cost) best = { key: e.key, keys: pth.keys, cost };
    }
    if (best) {
      paths.set(best.key, best.keys);
      spellsByKey.set(best.key, spells);
      nameKey.set(name, best.key);
      continue;
    }
    // Nobody: a team-mate who is only in the move. He stands where he gets it,
    // and after his last pass jogs a little after the move.
    const key = `extra${extraMates++}`;
    const lastSpell = spells[spells.length - 1];
    const after = onBall(lastSpell.t1);
    const fwd = { x: end.x - after.x, y: end.y - after.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
    const jog = Math.min(2, LEAD_RUN_AVG * 0.3 * (durS - lastSpell.t1));
    const fin = { x: after.x + (fwd.x / fn) * jog, y: after.y + (fwd.y / fn) * jog };
    const pth = pathThrough(onBall(spells[0].t0), fin, spells, true)
      // (Two touches too far apart in time for one man: the real touches win.)
      ?? pathThrough(onBall(spells[0].t0), fin, spells, true, true)!;
    paths.set(key, pth.keys);
    spellsByKey.set(key, spells);
    nameKey.set(name, key);
  }
  const holders: (string | null)[] = lead.passes.map((_, i) => nameKey.get(nameOf(i)) ?? null);

  // ── Everyone else: one eased path from his start to his place in the shot ──
  for (const e of ents) {
    if (paths.has(e.key)) continue;
    const to = endOf.get(e.key)!;
    paths.set(e.key, [{ t: 0, p: reachFrom(base.get(e.key)!, to, durS) }, { t: durS, p: { ...to } }]);
  }

  const captionAt = (t: number) => {
    for (let i = n - 1; i >= 0; i--) {
      if (t < passStart[i]) continue;
      const p = lead.passes[i];
      if (t < passEnd[i]) return `${lastNameOf(p[3])} → ${lastNameOf(i === n - 1 ? s.player : p[4])}`;
      return i === n - 1 ? `${lastNameOf(s.player)} — that's you` : `${lastNameOf(p[4])} on the ball`;
    }
    return `${lastNameOf(lead.passes[0][3])} on the ball`;
  };
  return {
    durS, ballKeys, paths, holders, passStart, passEnd, captionAt, extraMates,
    // The TV camera (leadIn.ts LEAD_TV_*): both ends of each pass on screen, wider than the shot's frame.
    camera: "tv",
    ballAt,
    posAt: (key, t) => {
      const path = paths.get(key);
      if (!path) return null;
      if (t >= durS) return { ...path[path.length - 1].p };
      // On the ball: just behind it, wherever the real ball goes.
      for (const sp of spellsByKey.get(key) ?? []) if (t >= sp.t0 && t <= sp.t1) return onBall(t);
      return alongEased(path, t);
    },
  };
}
