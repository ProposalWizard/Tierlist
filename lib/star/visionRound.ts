import {
  buildScenario, offsideSnapshot, spaceScore, goalInView,
  type Scenario, type ScenarioKind, type Vec2, type Runner, type Outcome, type Facing, type Viewport,
} from "./canvasEngine";
import { CX, PITCH_W, HALF_LEN } from "./pitch";
import { AUTHORED_SCENARIOS } from "./authoredScenarios";
import { OFF_PITCH } from "./scenarioEdit";
import { canvasToScreen, screenToCanvas, type Tilt } from "./cameraTilt";
import { mulberry32 } from "./season";

/**
 * VISION — "WHO SHOULD I PASS TO?" (Harry, 20 Oct 2026).
 *
 * "The vision skill is horrendous. It's cluttered, and the skill gap doesn't
 * increase. I don't like the line on the pitch. Instead, what would be an
 * actual good vision skill would be real scenarios: Who should I pass to in
 * this scenario? Have someone offside. Lessen the time. Maybe even make them
 * actually kick the ball … early on you tap, then you actually have to kick
 * the ball inside 0.3 seconds." And: "I don't like how it's in the old 2D style."
 *
 * So a rep is a REAL picture, played on the real match (EngineFeature in
 * components/star/TrainingMinigame.tsx draws it in the match's own new view):
 *
 *   - Real moments (lib/star/data/visionMoments.json, made by
 *     scripts/vision/build_vision_moments.mts from the tracking in
 *     data/realmoments): the instant a real pass was played that led straight
 *     to a real shot. Everyone stands where he really stood. The right answer
 *     is the man the real player picked.
 *   - The team's drawn chances (lib/star/authoredScenarios.json, the passing
 *     kinds): the right answer is the man the drawing marks TARGET.
 *
 * Nothing here places a man. A picture is CHOSEN from those two pools and
 * then cleaned: the men who don't matter are left out (a team-mate miles
 * away, a defender nowhere near a pass), never moved.
 *
 * Every man on offer is judged by the engine's own rules: offside by
 * `offsideSnapshot` (the law the match uses), how good a ball to him is by
 * `spaceScore` (the engine's own read of a receiving position: lane open,
 * unmarked, further forward, in range). A wrong answer is a TRAP when the
 * engine would punish it: offside, a defender standing in the pass lane, or
 * a defender on his back. The pass itself, on the kick levels, is judged by
 * the real engine as it plays (`judgeKick`).
 *
 * Pure: tests/star/vision.mts checks the answers, the traps and the
 * difficulty curve (with lib/star/visionModel.ts's modelled player).
 */

// ─────────────────────────────────────────────────────────────────────────
//  WORDS AND NUMBERS
// ─────────────────────────────────────────────────────────────────────────

/** Why a wrong man is wrong. */
export type TrapKind = "offside" | "lane" | "marked";

/** A defender this close to the straight line from the ball to a man cuts the pass out. */
export const LANE_CUT_M = 1.5;
/** A defender this close to a man is on his back: the ball to him is lost. */
export const MARKED_M = 1.6;
/** Team-mates further across than this from the ball are left out of the picture (the camera is 32–38 m wide). */
export const VIEW_HALF_W = 16.5;
/** A pass shorter than this is a tap to a man at your feet, longer than this is not a pass the drill asks for. */
export const MIN_PASS_M = 4;
export const MAX_PASS_M = 34;
/** The right man is never offside by less than this (tracking is ±0.3 m): no coin-flip answers. */
const ANSWER_ONSIDE_BY_M = 0.6;
/** An offside trap is beyond the line by at least this, so it can be read. */
const TRAP_OFFSIDE_BY_M = 0.4;
/** No other team-mate on the picture stands this close to the right ball's path (the engine's reception reach is 2 m). */
const MATE_CLEAR_M = 3;
/** Defenders kept in the picture: near a shown man, near a shown pass, near the ball. */
const KEEP_NEAR_MAN_M = 7.5;
const KEEP_NEAR_LANE_M = 3.6;
const KEEP_NEAR_BALL_M = 8;

/** The drawn kinds that ARE a pass decision (corners, shots and crosses are not). */
export const DRAWN_KINDS: readonly ScenarioKind[] = ["buildup", "midfield_pass", "through_ball"];

// ─────────────────────────────────────────────────────────────────────────
//  THE POOL — real passes and drawn chances, as they are
// ─────────────────────────────────────────────────────────────────────────

/** One picture as it came: everybody, before anything is left out. */
export interface VisionBase {
  id: string;
  source: "real" | "drawn";
  kind: ScenarioKind;
  ball: Vec2;
  mates: (Vec2 & { name?: string })[];
  /** Index into mates of the right answer (the real pick / the drawing's TARGET). */
  answer: number;
  opps: Vec2[];
  keeper: Vec2;
  /** Real moments: the match, the minute, who really played it, the data's source. */
  match?: string;
  minute?: number;
  passer?: string;
  src?: string;
}

interface MomentRow {
  id: string; src: string; comp: string; match: string; minute: number; team: string; opp: string;
  passer: string; to: string; ball: [number, number]; mates: [number, number][]; names: string[];
  real: number; opps: [number, number][]; keeper: [number, number]; end: [number, number]; passS: number;
}

/**
 * The real moments (about 180 KB) and the engine's pass checks are loaded
 * when Vision is first played, so the career does not carry them until then:
 * `loadVisionMoments` in the browser; a test hands the files' contents to
 * `setVisionMoments` / `setVisionChecks`.
 */
let momentRows: MomentRow[] | null = null;
export function setVisionMoments(file: unknown): void {
  const rows = file && typeof file === "object" ? (file as { moments?: unknown }).moments : null;
  momentRows = Array.isArray(rows) ? rows.filter(isMomentRow) : [];
  realCache = null;
  clearPictureCaches();
}

/**
 * THE ENGINE'S PASS CHECKS (lib/star/data/visionChecks.json, made by
 * scripts/vision/check_passes.mts): per picture, per team-mate, how many of
 * `goes` good passes to him the real engine let through. Absent for a
 * picture (a drawing committed since): the geometry stands in.
 */
let passChecks: { goes: number; checks: Record<string, number[]> } | null = null;
export function setVisionChecks(file: unknown): void {
  const f = file as { goes?: unknown; checks?: unknown } | null;
  passChecks = f && typeof f.goes === "number" && f.goes > 0 && f.checks && typeof f.checks === "object"
    ? { goes: f.goes, checks: f.checks as Record<string, number[]> } : null;
  clearPictureCaches();
}
function clearPictureCaches(): void {
  candidateCache.clear();
  judgeCache.clear();
  levelChain.length = 0;
}
/** How often a good pass to man `i` of picture `id` gets there on the engine, 0..1, or undefined. */
export function passReach(id: string, i: number): number | undefined {
  const row = passChecks?.checks[id];
  const v = row?.[i];
  return typeof v === "number" && passChecks ? v / passChecks.goes : undefined;
}

export function visionMomentsReady(): boolean { return momentRows !== null; }
let loading: Promise<void> | null = null;
export function loadVisionMoments(): Promise<void> {
  if (momentRows) return Promise.resolve();
  if (!loading) {
    const def = (m: unknown) => (m as { default?: unknown }).default ?? m;
    loading = Promise.all([
      import("./data/visionMoments.json").then((m) => setVisionMoments(def(m)), () => setVisionMoments(null)),
      import("./data/visionChecks.json").then((m) => setVisionChecks(def(m)), () => setVisionChecks(null)),
    ]).then(() => undefined);
  }
  return loading;
}
function isMomentRow(r: unknown): r is MomentRow {
  const o = r as MomentRow;
  return !!o && typeof o.id === "string" && Array.isArray(o.ball) && Array.isArray(o.mates) && Array.isArray(o.opps)
    && Array.isArray(o.keeper) && Number.isInteger(o.real) && o.real >= 0 && o.real < o.mates.length;
}

let realCache: VisionBase[] | null = null;
export function realBases(): VisionBase[] {
  if (realCache) return realCache;
  const rows = momentRows ?? [];
  realCache = rows.map((r) => ({
    id: r.id, source: "real" as const, kind: "through_ball" as const,
    ball: { x: r.ball[0], y: r.ball[1] },
    mates: r.mates.map(([x, y], i) => ({ x, y, name: r.names?.[i] })),
    answer: r.real,
    opps: r.opps.map(([x, y]) => ({ x, y })),
    keeper: { x: r.keeper[0], y: r.keeper[1] },
    match: r.match, minute: r.minute, passer: r.passer, src: r.src,
  }));
  return realCache;
}

let drawnCache: VisionBase[] | null = null;
export function drawnBases(): VisionBase[] {
  if (drawnCache) return drawnCache;
  const out: VisionBase[] = [];
  for (const s of Object.values(AUTHORED_SCENARIOS)) {
    const kind = s.source?.kind as ScenarioKind | undefined;
    if (!kind || !DRAWN_KINDS.includes(kind)) continue;
    if ((s.camera?.facing ?? "up") !== "up") continue;
    const mates: (Vec2 & { name?: string })[] = [];
    let answer = -1;
    const opps: Vec2[] = [];
    let keeper: Vec2 | null = null;
    for (const p of s.players) {
      if (p.side === "teammate") {
        if (p.label === "TARGET") answer = mates.length;
        mates.push({ x: p.x, y: p.y });
      } else if (p.side === "opponent") {
        if (p.label === "GK") keeper = { x: p.x, y: p.y };
        else opps.push({ x: p.x, y: p.y });
      }
    }
    if (answer < 0 || mates.length < 2) continue;
    out.push({
      id: s.id, source: "drawn", kind, ball: { x: s.ball.x, y: s.ball.y }, mates, answer, opps,
      keeper: keeper ?? { x: CX, y: 1 },
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  drawnCache = out;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
//  JUDGING A MAN — the engine's own rules
// ─────────────────────────────────────────────────────────────────────────

export interface VisionOption extends Vec2 {
  name?: string;
  /** The engine's offside law at the moment of the pass. */
  onside: boolean;
  /** Metres beyond (minus) or behind (plus) the offside line; Infinity where the law does not apply. */
  lineGap: number;
  /** Nearest defender to him, metres. */
  space: number;
  /** Nearest defender to the straight pass lane, metres. */
  lane: number;
  /** spaceScore: how good a ball to him is, 0..1 (0 when offside). */
  score: number;
  /** How often a good pass to him gets there on the engine (the pass checks), when known. */
  reach?: number;
  /** Why he is a wrong answer the engine would punish, or null. */
  trap: TrapKind | null;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The pass lane is the stretch the ball rolls along: not the first 1.5 m at your feet, not the man himself. */
function laneGap(ball: Vec2, to: Vec2, opps: Vec2[]): number {
  const len = Math.hypot(to.x - ball.x, to.y - ball.y) || 1;
  const ux = (to.x - ball.x) / len, uy = (to.y - ball.y) / len;
  const a = { x: ball.x + ux * 1.5, y: ball.y + uy * 1.5 };
  const b = { x: to.x - ux * 1.2, y: to.y - uy * 1.2 };
  let worst = 99;
  for (const d of opps) worst = Math.min(worst, distToSegment(d, a, b));
  return worst;
}

/**
 * The engine's Scenario for a picture: the ball at your feet, your team-mates
 * as the men you can pass to, their men as defenders, their keeper. Built on
 * the engine's own `buildScenario` of the picture's kind (so every field the
 * match needs is the engine's), then the people are put where the picture
 * has them. Used for judging here and played by EngineFeature in the drill.
 */
export function visionScenario(
  pic: { kind: ScenarioKind; ball: Vec2; options: Vec2[]; defenders: Vec2[]; keeper: Vec2 },
  seed = 1,
): Scenario {
  const sc = buildScenario(pic.kind, mulberry32(seed >>> 0), 62, 60);
  sc.ball = { x: pic.ball.x, y: pic.ball.y };
  sc.player = { x: pic.ball.x, y: pic.ball.y + 0.8 };
  sc.defenders = pic.defenders.map((d) => ({ x: d.x, y: d.y }));
  const k = sc.keeper;
  k.x = k.startX = k.targetX = pic.keeper.x;
  k.y = pic.keeper.y;
  // A real keeper stands where he really stood while you aim.
  sc.keeperHoldsStart = true;
  sc.runner = null;
  sc.passTarget = null;
  sc.teammates = [];
  sc.relayTo = null;
  sc.secondaryRunners = pic.options.map((o): Runner => ({
    pos: { x: o.x, y: o.y }, to: { x: o.x, y: o.y }, speed: 7, moving: false, role: "support",
  }));
  // The poacher would be a man to pass to as well: the options are the men on offer.
  sc.follower.x = OFF_PITCH.x;
  sc.follower.y = OFF_PITCH.y;
  sc.facing = "up" as Facing;
  sc.viewport = engineFrameFor(pic);
  sc.chainDepth = 0;
  return sc;
}

/** The rectangle the chance lives in (the engine's frame): everyone shown, with room. */
function engineFrameFor(pic: { kind: ScenarioKind; ball: Vec2; options: Vec2[]; defenders: Vec2[] }): Viewport {
  const pts = [pic.ball, ...pic.options, ...pic.defenders];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x1 = Math.max(-2, Math.min(...xs) - 5), x2 = Math.min(PITCH_W + 2, Math.max(...xs) + 5);
  const y1 = goalInView(pic.kind) ? -2 : Math.min(...ys) - 6;
  const y2 = Math.min(HALF_LEN + 30, Math.max(...ys) + 8);
  return { x1, x2, y1, y2 };
}

/** A ball the engine lets through less often than this is a trap: it gets cut out. */
export const REACH_TRAP = 0.4;
/** The right man: a good ball to him gets there at least this often on the engine. */
export const REACH_ANSWER = 0.8;

/**
 * Judge every man in a picture with the engine's rules. `reach` (optional,
 * per man): how often the engine lets a good pass to him through
 * (passReach); without it, a defender within LANE_CUT_M of the lane cuts it out.
 */
export function judgeMen(
  kind: ScenarioKind, ball: Vec2, men: Vec2[], opps: Vec2[], keeper: Vec2, reach: (number | undefined)[] = [],
): VisionOption[] {
  const sc = visionScenario({ kind, ball, options: men, defenders: opps, keeper });
  offsideSnapshot(sc, { x: ball.x, y: ball.y });
  // The line itself, for how far beyond it a man is (the same second-last
  // opponent the law reads, keeper included where there is a goal).
  const line = goalInView(kind) ? [...opps.map((d) => d.y), keeper.y].sort((a, b) => a - b)[1] : undefined;
  return men.map((m, i) => {
    const onside = !sc.secondaryRunners[i].offside;
    const space = opps.reduce((s, d) => Math.min(s, Math.hypot(d.x - m.x, d.y - m.y)), 99);
    const lane = laneGap(ball, m, opps);
    const score = onside ? spaceScore(m, sc, sc.player) : 0;
    const r = reach[i];
    const lost = r !== undefined ? r < REACH_TRAP : lane < LANE_CUT_M || space < MARKED_M;
    const trap: TrapKind | null = !onside ? "offside"
      : !lost ? null
      : space < MARKED_M + 0.4 && (r !== undefined || lane >= LANE_CUT_M) ? "marked" : "lane";
    return {
      x: m.x, y: m.y, onside,
      lineGap: line === undefined ? Infinity : m.y - line,
      space, lane, score, trap,
      ...(r !== undefined ? { reach: r } : {}),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  A PICTURE FOR A LEVEL
// ─────────────────────────────────────────────────────────────────────────

/** The numbers a Vision level's picture is chosen by (the level's row). */
export interface VisionPictureAsk {
  /** Team-mates on the picture, the right man included. */
  options: number;
  /** How many of the wrong men are traps (offside, a defender in the lane, marked). */
  traps: number;
  /** How much better the right ball is than the next good one (spaceScore points; small = two good options). */
  margin: number;
  /** Real match moments (true) or the team's drawn chances (false). */
  real: boolean;
  /** One of the traps must be a man standing offside. */
  offside?: boolean;
}

/** A level's row → what its pictures are chosen by. */
export function visionAsk(row: { options: number; traps: number; margin: number; real: boolean; offside: boolean }): VisionPictureAsk {
  return { options: row.options, traps: row.traps, margin: row.margin, real: row.real, offside: row.offside };
}

export interface VisionPicture {
  id: string;
  source: "real" | "drawn";
  kind: ScenarioKind;
  ball: Vec2;
  /** The men on offer; options[best] is the right answer. */
  options: (VisionOption & { name?: string })[];
  best: number;
  defenders: Vec2[];
  keeper: Vec2;
  /** The right ball's score minus the next good (non-trap) man's; 1 when every other man is a trap. */
  margin: number;
  /** How many of the shown wrong men are traps. */
  traps: number;
  match?: string;
  minute?: number;
  passer?: string;
  src?: string;
}

/** Is this man close enough to be in the picture at all? */
function inView(ball: Vec2, m: Vec2): boolean {
  const d = Math.hypot(m.x - ball.x, m.y - ball.y);
  return Math.abs(m.x - ball.x) <= VIEW_HALF_W && d >= MIN_PASS_M && d <= MAX_PASS_M && m.y >= 0.5 && m.y <= HALF_LEN + 8;
}

/** The defenders worth drawing: near a shown man, near a shown pass, near the ball, and the two that make the offside line. */
function keptDefenders(kind: ScenarioKind, ball: Vec2, shown: Vec2[], opps: Vec2[], keeper: Vec2): Vec2[] {
  const keep = new Set<number>();
  opps.forEach((d, i) => {
    if (Math.hypot(d.x - ball.x, d.y - ball.y) <= KEEP_NEAR_BALL_M) keep.add(i);
    for (const m of shown) {
      if (Math.hypot(d.x - m.x, d.y - m.y) <= KEEP_NEAR_MAN_M || laneGap(ball, m, [d]) <= KEEP_NEAR_LANE_M) keep.add(i);
    }
  });
  if (goalInView(kind)) {
    // The offside line is read off the second-last of them (their keeper
    // counts): both of the two deepest stay, or the law would change.
    const order = opps.map((d, i) => ({ i, y: d.y })).sort((a, b) => a.y - b.y);
    const deepest = [...order.map((o) => o.y), keeper.y].sort((a, b) => a - b);
    for (const o of order) if (o.y <= deepest[1] + 1e-6) keep.add(o.i);
  }
  return opps.filter((_, i) => keep.has(i));
}

/**
 * One way of showing a base picture to this ask, or null when it can't be
 * shown honestly (the right man is not clearly the right man).
 */
// A base's judgements, kept: every man (the same for every level), and the
// men as shown (the same for every level that shows the same men).
const judgeCache = new Map<string, VisionOption[]>();
function judgedOnce(key: string, judge: () => VisionOption[]): VisionOption[] {
  let v = judgeCache.get(key);
  if (!v) { v = judge(); judgeCache.set(key, v); }
  return v;
}

export function pictureFromBase(base: VisionBase, ask: VisionPictureAsk): VisionPicture | null {
  const reach = base.mates.map((_, i) => passReach(base.id, i));
  const all = judgedOnce(`${base.source}:${base.id}`, () => judgeMen(base.kind, base.ball, base.mates, base.opps, base.keeper, reach));
  const A = all[base.answer];
  const am = base.mates[base.answer];
  // The right man must be plainly right: onside by a clear yard, a good
  // ball to him gets there on the engine, not on a defender's toes, and in
  // the picture.
  if (!A.onside || A.lineGap < ANSWER_ONSIDE_BY_M || A.trap || A.score < 0.3 || !inView(base.ball, am)) return null;
  if (A.reach !== undefined ? A.reach < REACH_ANSWER : A.lane < LANE_CUT_M + 0.5) return null;

  // Nobody stands in the right ball's path: a team-mate within reach of it
  // would take it himself (the engine gives the ball to whoever it reaches).
  const inAnswersPath = (m: Vec2) => {
    const len = Math.hypot(am.x - base.ball.x, am.y - base.ball.y) || 1;
    const t = ((m.x - base.ball.x) * (am.x - base.ball.x) + (m.y - base.ball.y) * (am.y - base.ball.y)) / (len * len);
    return t > 0.05 && t < 1.1 && distToSegment(m, base.ball, am) < MATE_CLEAR_M;
  };
  const others = all.map((o, i) => ({ o, i }))
    .filter(({ i }) => i !== base.answer && inView(base.ball, base.mates[i]) && !inAnswersPath(base.mates[i]));
  // A trap must look like one: offside by a readable margin.
  const traps = others.filter(({ o }) => o.trap && (o.trap !== "offside" || o.lineGap <= -TRAP_OFFSIDE_BY_M));
  // A lesser ball: onside, open, and genuinely worse than the right one, by
  // at least about half what the level asks (a closer call than that is left
  // out rather than shown: it would make the level much harder than asked).
  const minGap = Math.max(0.015, Math.min(0.1, ask.margin * 0.5));
  const lesser = others.filter(({ o }) => !o.trap && o.score < A.score - minGap);

  const want = Math.max(1, Math.round(ask.options)) - 1;
  const wantTraps = Math.max(ask.offside ? 1 : 0, Math.min(want, Math.round(ask.traps)));
  if (ask.offside && !traps.some((t) => t.o.trap === "offside")) return null;
  // Traps first, a mix of kinds (offside, lane, marked in turn).
  const byKind: Record<TrapKind, typeof traps> = { offside: [], lane: [], marked: [] };
  for (const t of traps) byKind[t.o.trap as TrapKind].push(t);
  for (const k of Object.keys(byKind) as TrapKind[]) byKind[k].sort((a, b) => b.o.score - a.o.score || a.i - b.i);
  const pickedTraps: typeof traps = [];
  for (let round = 0; pickedTraps.length < wantTraps && round < 6; round++) {
    for (const k of ["offside", "lane", "marked"] as TrapKind[]) {
      if (pickedTraps.length >= wantTraps) break;
      const t = byKind[k][round];
      if (t) pickedTraps.push(t);
    }
  }
  // Then the lesser balls: the closest rival to the ask's margin first, then
  // the next closest to the right one (a hard level shows two good options).
  const wantLesser = want - pickedTraps.length;
  const target = A.score - ask.margin;
  const sorted = [...lesser].sort((a, b) => Math.abs(a.o.score - target) - Math.abs(b.o.score - target) || a.i - b.i);
  const pickedLesser: typeof lesser = [];
  if (wantLesser > 0 && sorted.length) {
    pickedLesser.push(sorted[0]);
    const rest = lesser.filter((x) => x !== sorted[0]).sort((a, b) => b.o.score - a.o.score || a.i - b.i);
    for (const r of rest) { if (pickedLesser.length >= wantLesser) break; pickedLesser.push(r); }
  }
  const shownIdx = [base.answer, ...pickedTraps.map((t) => t.i), ...pickedLesser.map((l) => l.i)];
  if (shownIdx.length < 2) return null;
  // Left to right, so the right man is not always first.
  shownIdx.sort((a, b) => base.mates[a].x - base.mates[b].x || a - b);
  const shownMen = shownIdx.map((i) => base.mates[i]);
  const defenders = keptDefenders(base.kind, base.ball, shownMen, base.opps, base.keeper);
  // Judge the picture AS SHOWN: what you see is what counts.
  const judged = judgedOnce(`${base.source}:${base.id}|${shownIdx.join(",")}`,
    () => judgeMen(base.kind, base.ball, shownMen, defenders, base.keeper, shownIdx.map((i) => reach[i])));
  const best = shownIdx.indexOf(base.answer);
  const B = judged[best];
  if (!B.onside || B.trap) return null;
  let rival = 0, trapsShown = 0;
  judged.forEach((o, i) => {
    if (i === best) return;
    if (o.trap) trapsShown++;
    else rival = Math.max(rival, o.score);
  });
  if (rival >= B.score - 0.01) return null;
  return {
    id: base.id, source: base.source, kind: base.kind, ball: { ...base.ball },
    options: judged.map((o, i) => ({ ...o, name: shownMen[i].name })),
    best, defenders, keeper: { ...base.keeper },
    margin: rival > 0 ? B.score - rival : 1,
    traps: trapsShown,
    match: base.match, minute: base.minute, passer: base.passer, src: base.src,
  };
}

/** How far a picture is from what the level asks for (0 = exactly it). */
export function askMismatch(p: VisionPicture, ask: VisionPictureAsk): number {
  // Every other man a trap (no second good ball): as clear as a big lead.
  const m = Math.min(0.45, p.margin);
  // An easy level wants a right man nobody could mistake: the ball to him
  // gets there every time, and nobody near him.
  const A = p.options[p.best];
  const easy = Math.max(0, Math.min(1, (ask.margin - 0.15) / 0.2));
  const unclear = (1 - (A.reach ?? 0.9)) * 4 + Math.max(0, 4 - A.space) * 0.4;
  // A closer call than asked spoils an easy level more than a clearer one
  // spoils a hard level: under the ask counts double.
  const off = m - ask.margin;
  return Math.abs(p.options.length - ask.options) * 1.2
    + Math.abs(p.traps - ask.traps) * 0.8
    + (off < 0 ? -off * 10 : off * 5)
    + easy * unclear;
}

const candidateCache = new Map<string, VisionPicture[]>();
/** Every picture that can be shown for this ask, best match first. */
export function visionCandidates(ask: VisionPictureAsk): VisionPicture[] {
  const key = JSON.stringify([ask.options, ask.traps, ask.margin, ask.real, !!ask.offside, momentRows?.length ?? -1]);
  const hit = candidateCache.get(key);
  if (hit) return hit;
  const pool = ask.real ? realBases() : drawnBases();
  const out: VisionPicture[] = [];
  for (const b of pool) {
    const p = pictureFromBase(b, ask);
    if (p) out.push(p);
  }
  out.sort((a, b) => askMismatch(a, ask) - askMismatch(b, ask) || a.id.localeCompare(b.id));
  candidateCache.set(key, out);
  return out;
}

/** How many of the best-matching pictures a level picks its three from. */
export const PICK_FROM = 8;

/**
 * The three pictures of a level (one per try), fixed by the level's seed so a
 * level plays the same every time. Three different pictures: a missed try
 * never shows the answer to the next one.
 *
 * Someone offside: ONE of the three tries (which one is the level's own) is
 * the closest picture with a man stood offside, the others are the level's
 * usual pictures. Real football rarely has a man stood offside as the pass
 * is played (5 readable ones in the 263 real passes), so they are kept for
 * one try a level rather than spent three at a time.
 *
 * `level` (the level's number) shares the real moments out between levels:
 * a real pass belongs to one of LEVEL_SHARES groups, and a level picks from
 * its own group, so the next few levels never show the picture you have
 * just learnt. A group too small for the ask lends to the rest.
 *
 * `shown` (the pictures the levels before this one showed, see
 * visionLevelPictures) counts a pass already shown as a worse match, more so
 * if it was shown in the last few levels: a pass comes back only where the
 * good ones for the ask have run out.
 */
export const LEVEL_SHARES = 5;
const OWN_SHARE_BONUS = 1.2;
/** A pass already shown at an earlier level: this much worse a match, per time shown. */
const SHOWN_COST = 1.0;
/** ...and this much more if it was shown in the last SHOWN_RECENT levels. */
const SHOWN_RECENT_COST = 1.0;
const SHOWN_RECENT = 5;
/** The same real pass is kept at two frames (as played, and 0.6 s before): one pass. */
const passOf = (p: VisionPicture) => p.id.replace(/b$/, "");
export type ShownBefore = ReadonlyMap<string, { times: number; last: number }>;
export function visionPictures(ask: VisionPictureAsk, seed: number, tries = 3, level?: number, shown?: ShownBefore): VisionPicture[] {
  const r = mulberry32((seed ^ 0x51ed) >>> 0);
  const share = (p: VisionPicture) => {
    let h = 2166136261;
    for (const ch of passOf(p)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h % LEVEL_SHARES;
  };
  const shownCost = (p: VisionPicture) => {
    const s = shown?.get(passOf(p));
    if (!s) return 0;
    return SHOWN_COST * s.times + (level !== undefined && level - s.last <= SHOWN_RECENT ? SHOWN_RECENT_COST : 0);
  };
  // A level's own share counts as a closer match (soft: a much closer
  // picture from another share still wins where good ones are rare).
  const fit = (p: VisionPicture, a: VisionPictureAsk) =>
    askMismatch(p, a) + shownCost(p) - (level !== undefined && p.source === "real" && share(p) === level % LEVEL_SHARES ? OWN_SHARE_BONUS : 0);
  // Picked from the closest matches only: up to PICK_FROM of them, and none
  // much further from the ask than the third closest.
  const shuffled = (all: VisionPicture[], a: VisionPictureAsk) => {
    const list = [...all].sort((x, y) => fit(x, a) - fit(y, a) || x.id.localeCompare(y.id));
    const bar = list.length ? fit(list[Math.min(list.length, tries) - 1], a) + 0.8 : 0;
    return list.slice(0, Math.max(tries, PICK_FROM)).filter((p, i) => i < tries || fit(p, a) <= bar)
      .map((p, i) => ({ p, k: r(), i })).sort((x, y) => x.k - y.k || x.i - y.i).map((x) => x.p);
  };
  const plain = { ...ask, offside: false };
  let order = shuffled(visionCandidates(plain), plain);
  if (!order.length && !ask.real) order = shuffled(visionCandidates({ ...plain, real: true }), { ...plain, real: true });
  // One of the three closest pictures with a man offside (the level's seed picks).
  const offAsk = visionCandidates(ask).length ? ask : { ...ask, real: true };
  const offCands = ask.offside
    ? [...visionCandidates(offAsk)].sort((x, y) => askMismatch(x, offAsk) + shownCost(x) - askMismatch(y, offAsk) - shownCost(y) || x.id.localeCompare(y.id))
    : [];
  const offsideFirst = offCands.length ? offCands[Math.floor(r() * Math.min(3, offCands.length))] : undefined;
  if (!order.length && !offsideFirst) return [];
  const out: VisionPicture[] = [];
  const used = new Set<string>();
  if (offsideFirst) used.add(passOf(offsideFirst));
  for (const p of order) {
    if (out.length >= tries - (offsideFirst ? 1 : 0)) break;
    if (used.has(passOf(p))) continue;
    used.add(passOf(p));
    out.push(p);
  }
  if (offsideFirst) out.splice(Math.floor(r() * tries) % (out.length + 1), 0, offsideFirst);
  const fill = order.length ? order : [offsideFirst!];
  for (let t = 0; out.length < tries; t++) out.push(fill[t % fill.length]);
  return out;
}

/** A level's ask and seed (the level editor's numbers for that level). */
export interface VisionLevelAsk { ask: VisionPictureAsk; seed: number }

// Levels 1..n built in order, kept between calls: a row stays good while its
// own ask and seed, and every row before it, are unchanged.
const levelChain: { key: string; pics: VisionPicture[] }[] = [];

/** Build levels 1..level in order, each one told what the levels before it showed. Yields before each level it has to build. */
function* buildLevels(level: number, levelOf: (n: number) => VisionLevelAsk, tries: number): Generator<void, VisionPicture[]> {
  const shown = new Map<string, { times: number; last: number }>();
  for (let n = 1; n <= level; n++) {
    const { ask, seed } = levelOf(n);
    const key = JSON.stringify([ask, seed, tries, momentRows?.length ?? -1, passChecks === null]);
    if (levelChain[n - 1]?.key !== key) {
      yield;
      levelChain.length = n - 1; // every later level was built on the old one
      levelChain.push({ key, pics: visionPictures(ask, seed, tries, n, shown) });
    }
    for (const p of levelChain[n - 1].pics) {
      const s = shown.get(passOf(p));
      shown.set(passOf(p), { times: (s?.times ?? 0) + 1, last: n });
    }
  }
  return levelChain[level - 1]?.pics ?? [];
}

/**
 * The three pictures of a level as a player climbing from level 1 meets them:
 * each level avoids the passes the levels before it showed (see `shown` on
 * visionPictures), so a picture you have learnt comes back as rarely as the
 * pictures allow. Fixed by the levels' asks and seeds.
 */
export function visionLevelPictures(level: number, levelOf: (n: number) => VisionLevelAsk, tries = 3): VisionPicture[] {
  const it = buildLevels(level, levelOf, tries);
  for (;;) {
    const s = it.next();
    if (s.done) return s.value;
  }
}

/** visionLevelPictures, giving the screen a frame between levels (the first play of a high level builds every level below it). */
export async function visionLevelPicturesAsync(level: number, levelOf: (n: number) => VisionLevelAsk, tries = 3): Promise<VisionPicture[]> {
  const it = buildLevels(level, levelOf, tries);
  for (;;) {
    const s = it.next();
    if (s.done) return s.value;
    await new Promise((res) => setTimeout(res, 0));
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  WHAT HAPPENED — one line after each try
// ─────────────────────────────────────────────────────────────────────────

export type VisionResult = "right" | "offside" | "cut" | "marked" | "wrong" | "missed" | "slow";

export interface VisionVerdict {
  ok: boolean;
  result: VisionResult;
  /** The big word on the pitch. */
  word: string;
  /** The one line under it: what happened, in plain words. */
  line: string;
}

/** A man's surname, or his shirt number ("No. 65") where the data has no name. */
const nameOf = (p: VisionPicture, i: number) => {
  const n = p.options[i]?.name?.trim() ?? "";
  return /^No\.\s*\d+$/.test(n) ? n : n.split(" ").slice(-1)[0] ?? "";
};

function verdict(p: VisionPicture, result: VisionResult, picked: number | null): VisionVerdict {
  const right = nameOf(p, p.best);
  const him = picked !== null ? nameOf(p, picked) : "";
  const rightMan = right ? `The pass was on to ${right}` : "The pass was on to the free man";
  switch (result) {
    case "right": return { ok: true, result, word: "RIGHT MAN", line: right ? `${right}: onside, free and the lane open.` : "Onside, free and the lane open." };
    case "offside": return { ok: false, result, word: "OFFSIDE", line: `${him || "He"} was beyond the last man. ${rightMan}.` };
    case "cut": return { ok: false, result, word: "CUT OUT", line: `A defender was in the lane. ${rightMan}.` };
    case "marked": return { ok: false, result, word: "MARKED", line: `${him || "He"} had a man on his back. ${rightMan}.` };
    case "wrong": return { ok: false, result, word: "NOT THE BALL", line: `${him ? `${him} was on, but ` : ""}${right || "the highlighted man"} was the better ball.` };
    case "missed": return { ok: false, result, word: "MISPLACED", line: `The pass didn't find him. ${rightMan}.` };
    case "slow": return { ok: false, result, word: "TOO SLOW", line: `${rightMan}.` };
  }
}

/** A tap on man `i` (or no tap in time). Early levels: the choice is the test. */
export function judgeTap(p: VisionPicture, i: number | null): VisionVerdict {
  if (i === null) return verdict(p, "slow", null);
  if (i === p.best) return verdict(p, "right", i);
  const t = p.options[i]?.trap;
  return verdict(p, t === "offside" ? "offside" : t === "lane" ? "cut" : t === "marked" ? "marked" : "wrong", i);
}

/**
 * A real kick, as the real engine played it (`sc` is the live scenario the
 * match played, `outcome` its resolution, or null while it is still going).
 * Returns null while there is nothing to say yet.
 *
 * The engine decides everything: whether the ball reached a man (and which),
 * whether he was offside when it was played, whether a defender or the keeper
 * got there first, whether it went out or died.
 */
export function judgeKick(
  p: VisionPicture, sc: Scenario, outcome: Outcome | null, aimedAt: number | null = null,
  /** The engine's offside flags as the ball was struck (a defender's touch clears them later). */
  offsideAtStrike?: boolean[],
): VisionVerdict | null {
  if (sc.offsideAgainst || outcome === "offside") {
    const off = sc.secondaryRunners.findIndex((r) => r.offside && r === sc.receivedBy);
    return verdict(p, "offside", off >= 0 ? off : aimedAt);
  }
  const by = sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : -1;
  if (by >= 0) {
    if (by === p.best) return verdict(p, "right", by);
    const t = p.options[by]?.trap;
    return verdict(p, t === "marked" ? "marked" : t === "lane" ? "cut" : "wrong", by);
  }
  if (outcome === null) return null;
  // Nobody took it. If you played it to a man the law had stood offside the
  // moment you struck it (the engine's own flag, set at the strike), that is
  // the lesson, whether or not the line also cut it out.
  if (aimedAt !== null && (offsideAtStrike?.[aimedAt] ?? sc.secondaryRunners[aimedAt]?.offside)) return verdict(p, "offside", aimedAt);
  if (outcome === "tackled" || outcome === "blocked" || outcome === "caught" || outcome === "saved" || outcome === "tipped") return verdict(p, "cut", aimedAt);
  return verdict(p, "missed", aimedAt);
}

/** The man a kick was aimed at: the one nearest the line of the aim arrow (within 25°), or null. */
export function aimedMan(p: VisionPicture, dir: Vec2): number | null {
  const L = Math.hypot(dir.x, dir.y);
  if (!(L > 1e-6)) return null;
  let best: number | null = null, bestA = (25 * Math.PI) / 180;
  p.options.forEach((o, i) => {
    const dx = o.x - p.ball.x, dy = o.y - p.ball.y;
    const a = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y) / ((Math.hypot(dx, dy) || 1) * L))));
    if (a < bestA) { bestA = a; best = i; }
  });
  return best;
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE A MAN IS ON THE GLASS — read off the match's own frame
// ─────────────────────────────────────────────────────────────────────────

/** The match's camera as a frame reader gets it (lib/star/engineFrame.ts EngineFrameCamera). */
export interface FrameCam { viewport: Viewport; facing: Facing; tilt: Tilt | null; W: number; H: number }

/**
 * A pitch point -> px inside the match's pitch box. The same sum the match
 * makes for its own touches (CanvasMatch pitchToClient, and the 3D view's
 * to2dClient): the camera's frame, its turn, then its tilt.
 */
export function camToBox(cam: FrameCam, p: Vec2): { x: number; y: number } {
  const v = cam.viewport, f = cam.facing;
  const fx = (p.x - v.x1) / (v.x2 - v.x1), fy = (p.y - v.y1) / (v.y2 - v.y1);
  const sx = f === "right" ? 1 - fy : f === "left" ? fy : fx;
  const sy = f === "right" ? fx : f === "left" ? 1 - fx : fy;
  const g = canvasToScreen(cam.tilt, sx, sy, cam.W, cam.H);
  return { x: g.X, y: g.Y };
}

/** px inside the pitch box -> the pitch point under it (the exact inverse). */
export function boxToCam(cam: FrameCam, X: number, Y: number): Vec2 {
  const { sx, sy } = screenToCanvas(cam.tilt, X, Y, cam.W, cam.H);
  const f = cam.facing, v = cam.viewport;
  const fx = f === "right" ? sy : f === "left" ? 1 - sy : sx;
  const fy = f === "right" ? 1 - sx : f === "left" ? sx : sy;
  return { x: fx * (v.x2 - v.x1) + v.x1, y: fy * (v.y2 - v.y1) + v.y1 };
}

/**
 * Which man a tap at (X, Y) in the pitch box picks: the nearest whose body
 * (feet up to head, as drawn) is within `reachPx`, or -1. A finger lands on a
 * man's shirt, not his boots, so the body counts, not just the spot he stands on.
 */
export function tapPick(cam: FrameCam, men: Vec2[], X: number, Y: number, reachPx = 26): number {
  const pxPerM = cam.W / Math.max(1, cam.viewport.x2 - cam.viewport.x1);
  const bodyPx = Math.max(30, 2.4 * pxPerM);
  let best = -1, bd = reachPx;
  men.forEach((m, i) => {
    const f = camToBox(cam, m);
    const dy = Y > f.y ? Y - f.y : Y < f.y - bodyPx ? f.y - bodyPx - Y : 0;
    const d = Math.hypot(X - f.x, dy);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
