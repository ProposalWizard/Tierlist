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

/** A 5:8 frame (the game's) holding the goal, the ball and the keeper. */
function cameraFor(ball: Vec2, keeper: Vec2 | null): Viewport {
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

export function seedForShot(s: SbShot): number {
  return Math.abs(s.id.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
}

export function overrideForShot(s: SbShot, kind: ScenarioKind, seed: number): PosOverride {
  const p = peopleOf(s);
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);
  // A penalty keeps the game's own penalty camera (the spot never moves).
  const camera = goalInView(kind) && kind !== "penalty" ? cameraFor(p.ball, p.keeper) : sc.viewport;
  const inside = (q: Vec2) => !camera || (q.x > camera.x1 + 0.8 && q.x < camera.x2 - 0.8 && q.y > camera.y1 + 0.8 && q.y < camera.y2 - 0.8);
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

/** The real shot as one of our scenarios, built fresh every call. */
export function scenarioForShot(s: SbShot): Scenario {
  const kind = playKindForShot(s);
  const seed = seedForShot(s);
  const sc = buildScenario(kind, mulberry32(seed));
  applyOverrideToScenario(sc, overrideForShot(s, kind, seed));
  return sc;
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
