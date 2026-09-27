/**
 * THE CHANCE MAKER — one function makes every chance you are served.
 *
 * Harry, 27 Sep 2026: "every single highlight should feel different." And,
 * on how it worked: "the current thing works pretty well I just don't like
 * how it works in game" — so the real match, the gallery's Sim and Infinite
 * Highlights all go through this one file, and a chance is made the same way
 * in all three.
 *
 * ── Two ways (v0.15, decided) ──
 *
 *   drawings   THE GAME. One of your drawings is the base, nudged (open play
 *              only — never a penalty or a free kick) and checked against its
 *              own rules, the gallery Sim's randomiser unchanged, then
 *              mirrored half the time. Nothing underneath it: no chance-
 *              formula plan is laid on first, and the drawing decides who is
 *              on the pitch (applyAuthoredShape: "the drawing is the team").
 *
 *   generator  A dev dial on the Play Area only (PlaySettings.chanceMaker),
 *              never a career. Every figure is sampled from the spread of
 *              that kind's drawings: the ball from one drawing, your stance
 *              from another, the keeper from a third, each defender from all
 *              the drawn defenders, carried with the ball. Only for open-play
 *              kinds with 10+ drawings; the rest are served "drawings".
 *
 * ── What both add ──
 *
 *   A rebuild on fault. The served picture is checked with the game's own
 *   checks (scenarioFaults) plus overlap, off-frame, keeper-beyond-the-ball
 *   and the kind's laws; a faulty one is rebuilt, up to 10 times.
 *
 *   A 5-picture memory per kind that survives the end of a match. A picture
 *   within 3 m of one of the last 5 of its kind is rebuilt. Measured (P8):
 *   with no memory a random tight angle still looks like one of the last
 *   five about 1 time in 3, because the 13 drawings put the ball within ~2 m
 *   of each other. The career and the dev tools keep separate memories.
 *
 *   Nobody stacked on anybody (lib/star/spacing.ts), on every chance.
 *
 * ── Which kind (one-on-ones "only on a break") ──
 *
 *   Harry: "a one-on-one is once a match, maybe … maybe one every three
 *   games". The kind is rolled once with the realism table (rollKind), and a
 *   one-on-one is only offered when the match says the move is a break ("They
 *   lose it — you break on them"); in settled play the middle of the box is a
 *   tight angle. A pass that comes back to you can still put you through.
 *   Volleys and headers stay switched off (switchedOffKinds.ts).
 *
 * canvasEngine.ts is not touched. Kinds with fewer than 5 drawings are made
 * by the builder and the chance formula, as before.
 */

import {
  buildScenario, buildAttackingScenario, buildWeightedScenario, pickScenarioKindFrom, chainKindFor, goalInView,
  type Scenario, type ScenarioKind, type Vec2,
} from "./canvasEngine";
import type { ScenarioRequest } from "./hiddenMatch";
import { selectChance, newSelectionMemory, FREQ, type SelectionMemory } from "./scenarioSelect";
import { applyChancePlan, type ChancePlan } from "./chanceFormula";
import { fixBaseScenario, scenarioFaults } from "./baseScenario";
import { applyFormationShape, type ShapeInput } from "./formationShape";
import { setupKind } from "./kindRules";
import { isSwitchedOff, playableKind, withoutSwitchedOff } from "./switchedOffKinds";
import {
  authoredPool, ruleSetFor, randomiseAuthored, applyAuthoredShape,
  keeperSharesOf, placeKeeper, sampleFromScenario, mirrorShape,
  type AuthoredShape,
} from "./authoredChance";
import {
  sampleFromAuthored, violations, outliersOf, MEASURES, MIN_SAMPLES_FOR_INVARIANT,
  type ShapeSample, type RuleSet,
} from "./scenarioRules";
import { separateBodies } from "./spacing";
import { CX, PITCH_W } from "./pitch";
import { mulberry32 } from "./season";
import { loadPlaySettings } from "./playArea";

// ─────────────────────────────────────────────────────────────────────────
//  THE ONE DIAL
// ─────────────────────────────────────────────────────────────────────────

/** "drawings" is the game; "generator" is a Play Area dev dial. */
export type ChanceMakerMode = "drawings" | "generator";
export const CHANCE_MAKER_MODES: ChanceMakerMode[] = ["drawings", "generator"];
export const DEFAULT_CHANCE_MAKER: ChanceMakerMode = "drawings";

/** How many served pictures of a kind are remembered (Harry: keep it). */
export const PICTURE_MEMORY = 5;

// ─────────────────────────────────────────────────────────────────────────
//  THE PICTURE, AND "THE SAME PICTURE"
// ─────────────────────────────────────────────────────────────────────────

/** Everything you look at in a served chance, in pitch metres. */
export interface Picture {
  kind: string;
  ball: Vec2; you: Vec2; keeper: Vec2;
  defenders: Vec2[]; mates: Vec2[];
  /** The centre of the camera frame. */
  cam: Vec2;
}

/** The engine parks a figure it does not want on screen far off the pitch. */
const parked = (p: Vec2) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;
const hyp = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r1 = (v: number) => Math.round(v * 10) / 10;
const pt = (p: Vec2): Vec2 => ({ x: r1(p.x), y: r1(p.y) });

export function pictureOf(sc: Scenario): Picture {
  const s = sampleFromScenario(sc);
  const v = sc.viewport;
  return {
    kind: sc.kind,
    ball: pt(s.ball), you: pt(s.you), keeper: pt(s.keeper),
    defenders: s.defenders.filter((d) => !parked(d)).map(pt),
    mates: s.mates.filter((m) => !parked(m)).map(pt),
    cam: pt({ x: (v.x1 + v.x2) / 2, y: (v.y1 + v.y2) / 2 }),
  };
}

function setDist(A: Vec2[], B: Vec2[]): number {
  const countPen = Math.abs(A.length - B.length) * 3; // 3 m for every man one has and the other lacks
  if (!A.length || !B.length) return countPen;
  const nn = (P: Vec2[], Q: Vec2[]) => P.map((p) => Math.min(...Q.map((q) => hyp(p, q))));
  return (mean(nn(A, B)) + mean(nn(B, A))) / 2 + countPen;
}

/**
 * PICTURE DISTANCE, metres: roughly "how far everything you look at moved".
 * Ball and defenders count double (they ARE the chance), the camera half (it
 * slides with the ball anyway). The design's §1a, unchanged.
 */
export function pictureDistance(p: Picture, q: Picture): number {
  return (2 * hyp(p.ball, q.ball) + hyp(p.you, q.you) + hyp(p.keeper, q.keeper)
    + 2 * setDist(p.defenders, q.defenders) + setDist(p.mates, q.mates)
    + 0.5 * hyp(p.cam, q.cam)) / 7.5;
}

export function mirrorPicture(p: Picture): Picture {
  const m = (v: Vec2): Vec2 => ({ x: PITCH_W - v.x, y: v.y });
  return { ...p, ball: m(p.ball), you: m(p.you), keeper: m(p.keeper), defenders: p.defenders.map(m), mates: p.mates.map(m), cam: m(p.cam) };
}

/** 3 m: under this, every figure overlaps where he stood last time on a phone
 *  (the design's §1b calibration). */
export const SAME_PICTURE_M = 3;

/** The same picture, or its mirror image — a mirrored copy still reads as the
 *  same arrangement, so it counts. */
export function pictureGap(p: Picture, q: Picture): number {
  return Math.min(pictureDistance(p, q), pictureDistance(mirrorPicture(p), q));
}
export const samePicture = (p: Picture, q: Picture) => pictureGap(p, q) < SAME_PICTURE_M;

// ─────────────────────────────────────────────────────────────────────────
//  THE MEMORY — last N pictures of each kind, kept across matches
// ─────────────────────────────────────────────────────────────────────────

const MEMORY_KEEP = 20;

export class PictureMemory {
  private byKind: Record<string, Picture[]> = {};
  private loaded = false;
  constructor(readonly scope: string, private readonly persist: boolean) {}

  private key() { return `star-chance-memory-v1:${this.scope}`; }

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.persist) return;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(this.key()) : null;
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === "object") this.byKind = o;
      }
    } catch { /* corrupt or blocked: start empty */ }
  }

  private save() {
    if (!this.persist) return;
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(this.key(), JSON.stringify(this.byKind));
    } catch { /* full or blocked: memory still works for this visit */ }
  }

  recent(kind: string): Picture[] {
    this.load();
    return this.byKind[kind] ?? [];
  }

  /** The smallest gap to one of the last `n` of this kind (Infinity if none). */
  nearest(pic: Picture, n: number): number {
    if (n <= 0) return Infinity;
    const list = this.recent(pic.kind).slice(-n);
    return list.length ? Math.min(...list.map((q) => pictureGap(pic, q))) : Infinity;
  }

  hits(pic: Picture, n: number): boolean {
    return this.nearest(pic, n) < SAME_PICTURE_M;
  }

  remember(pic: Picture): void {
    this.load();
    const list = [...(this.byKind[pic.kind] ?? []), pic];
    this.byKind[pic.kind] = list.slice(-MEMORY_KEEP);
    this.save();
  }

  clear(): void {
    this.byKind = {};
    this.loaded = true;
    this.save();
  }
}

const memories = new Map<string, PictureMemory>();
/**
 * One memory per scope: "game" for every real match (a career, Infinite
 * Match), "review" for the gallery's Sim and Infinite Highlights. Mirrored to
 * localStorage so it survives the end of a match (the old 3-drawing memory
 * lived on the match and was wiped every whistle).
 */
export function pictureMemory(scope: string): PictureMemory {
  let m = memories.get(scope);
  if (!m) { m = new PictureMemory(scope, true); memories.set(scope, m); }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────
//  WHAT IS WRONG WITH A SERVED PICTURE
// ─────────────────────────────────────────────────────────────────────────

/** Bodies nearer than this read as one on top of the other. A free-kick wall
 *  stands 1.0 m apart on purpose, so the line is a touch under it. */
const OVERLAP_M = 0.95;

/**
 * The game's own checks (scenarioFaults: the kind's identity, offside, the
 * empty channel, a defender behind his keeper) plus the ones Harry named by
 * eye — "overlapping bodies, stranded players, a man behind the keeper" —
 * and the kind's laws scanned off its drawings.
 */
export function servedFaults(sc: Scenario): string[] {
  const out = new Set<string>(scenarioFaults(sc));
  const s = sampleFromScenario(sc);
  const defs = s.defenders.filter((d) => !parked(d));
  const mates = s.mates.filter((m) => !parked(m));
  const bodies = [s.you, ...defs, ...mates, s.keeper];
  let closest = Infinity;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) closest = Math.min(closest, hyp(bodies[i], bodies[j]));
  if (closest < OVERLAP_M) out.add("two bodies on top of each other");
  const vp = sc.viewport;
  const off = (p: Vec2) => p.x < vp.x1 - 0.5 || p.x > vp.x2 + 0.5 || p.y < vp.y1 - 0.5 || p.y > vp.y2 + 0.5;
  if (defs.some(off) || mates.some(off)) out.add("a player outside the picture");
  if (off(s.ball)) out.add("ball outside the picture");
  if (off(s.you)) out.add("you outside the picture");
  if (goalInView(sc.kind) && sc.kind !== "corner" && s.keeper.y > s.ball.y) out.add("keeper beyond the ball");
  const set = ruleSetFor(sc.kind);
  if (set) for (const v of violations(s, set)) out.add(`breaks its rule: ${v}`);
  return Array.from(out);
}

// ─────────────────────────────────────────────────────────────────────────
//  THE DRAWINGS AS DATA
// ─────────────────────────────────────────────────────────────────────────

/** A dead ball keeps its spot: a corner on the flag (the men around it are
 *  still nudged, as today). */
const FIXED_BALL = new Set<string>(["corner"]);
/** A penalty is the same picture every time by definition (ball on the spot,
 *  keeper on his line, everyone outside the area): measured, a 3 m memory
 *  could never find a "different" one and rebuilt 8.6 times a penalty for
 *  nothing. So a penalty is only kept from being the IDENTICAL picture as the
 *  one just before it. */
const IDENTICAL_ONLY = new Set<string>(["penalty"]);

/** How a kind is remembered: how many back, and how close counts as "the same". */
export function memoryRule(kind: string): { n: number; within: number } {
  if (IDENTICAL_ONLY.has(kind)) return { n: 1, within: 0.5 };
  return { n: PICTURE_MEMORY, within: SAME_PICTURE_M };
}
/** Set pieces are always a drawing, never generated — a wall or a crowd at a
 *  corner has a structure per-figure sampling does not keep. */
const NEVER_GENERATED = new Set<string>(["corner", "penalty", "free_kick"]);
/** Below this many drawings the generator's clouds are too thin (design §6:
 *  cutback, with 6, still faulted 14% after rebuilding). */
export const GENERATOR_MIN_DRAWINGS = 10;
/** Tries at a clean, fresh picture before serving the best one found. */
export const MAX_TRIES = 10;

interface Drawn extends ShapeSample { id: string }

/** Every usable drawing of a kind, the named outliers left out (as today). */
function drawingsOf(kind: string, set: RuleSet): Drawn[] {
  const bad = new Set(outliersOf(set).map((o) => o.id));
  const all = authoredPool(kind)
    .map((ms) => { const s = sampleFromAuthored(ms); return s ? { id: ms.id, ...s } : null; })
    .filter((s): s is Drawn => !!s);
  const clean = all.filter((s) => !bad.has(s.id));
  return clean.length ? clean : all;
}

/** Does this kind get served from drawings at all? The same bar as today. */
export function servesDrawings(kind: string): boolean {
  const set = ruleSetFor(kind);
  return !!set && set.n >= MIN_SAMPLES_FOR_INVARIANT;
}

export function canGenerate(kind: string): boolean {
  if (NEVER_GENERATED.has(kind)) return false;
  const set = ruleSetFor(kind);
  return !!set && drawingsOf(kind, set).length >= GENERATOR_MIN_DRAWINGS;
}

const mirrorV = (v: Vec2): Vec2 => ({ x: PITCH_W - v.x, y: v.y });
function mirrorSample<T extends ShapeSample>(s: T): T {
  return { ...s, ball: mirrorV(s.ball), you: mirrorV(s.you), keeper: mirrorV(s.keeper), defenders: s.defenders.map(mirrorV), mates: s.mates.map(mirrorV) };
}
function onSide<T extends ShapeSample>(s: T, side: -1 | 1): T {
  return (s.ball.x >= CX ? 1 : -1) === side ? s : mirrorSample(s);
}

function gauss(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const inPitch = (p: Vec2): Vec2 => ({ x: clamp(p.x, 1, PITCH_W - 1), y: clamp(p.y, 0.5, 100) });

/** How much a figure follows the ball (near it) rather than the goal (near it). */
function anchor(p: Vec2, ball: Vec2): number {
  const dGoal = Math.hypot(p.x - CX, p.y), dBall = hyp(p, ball);
  return dGoal / (dGoal + dBall + 1e-6);
}
/** A figure drawn against a ball at `from`, moved to go with a ball at `to`. */
function carry(p: Vec2, from: Vec2, to: Vec2): Vec2 {
  const l = anchor(p, from);
  return { x: p.x + l * (to.x - from.x), y: p.y + l * (to.y - from.y) };
}
function closestPair(s: ShapeSample): number {
  const ps = [s.you, ...s.defenders, ...s.mates];
  let best = Infinity;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) best = Math.min(best, hyp(ps[i], ps[j]));
  return best;
}
/** The ball stays inside the depth and width the drawings span (a little over). */
function ballInRange(s: ShapeSample, set: RuleSet, slack: number): boolean {
  for (const id of ["ballDepth", "ballLateral"]) {
    const r = set.rules.find((x) => x.id === id), m = MEASURES.find((x) => x.id === id);
    if (!r || !m) continue;
    const v = m.of(s);
    if (v < r.min - slack || v > r.max + slack) return false;
  }
  return true;
}


const DEFAULT_CAMERA = { centerX: CX, centerY: 17, viewHeight: 42, facing: "up" } as AuthoredShape["camera"];

// ─────────────────────────────────────────────────────────────────────────
//  "YOUR DRAWINGS" — one drawing, nudged and checked, mirrored half the time
// ─────────────────────────────────────────────────────────────────────────

/**
 * The gallery Sim's randomiser (`randomiseAuthored`: a 2 m nudge, the ball
 * and you 1.2 m, checked against the kind's rules, smaller and smaller nudges
 * until one is legal, the drawing itself last), plus a 50/50 mirror.
 * `stableKey` keeps a gallery cell on the same drawing as the pool grows.
 */
export type DrawnShape = AuthoredShape & { mirrored: boolean };

export function drawingShape(
  kind: string, rng: () => number, stableKey?: number,
): DrawnShape | null {
  const set = ruleSetFor(kind);
  if (!set || set.n < MIN_SAMPLES_FOR_INVARIANT) return null;
  const pool = authoredPool(kind);
  const bad = new Set(outliersOf(set).map((o) => o.id));
  const clean = pool.filter((s) => !bad.has(s.id));
  const from = clean.length ? clean : pool;
  const start = stableKey === undefined ? Math.floor(rng() * from.length) % from.length : stableIndex(from.map((s) => s.id), stableKey);
  for (let i = 0; i < from.length; i++) {
    const base = from[(start + i) % from.length];
    // (A penalty and a free kick are served exactly as drawn — see
    // randomiseAuthored's DEAD_BALL_EXACT.)
    const shape = randomiseAuthored(base, set, rng, { fixedBall: FIXED_BALL.has(kind) });
    if (!shape) continue;
    const mirrored = rng() < 0.5;
    return { ...(mirrored ? mirrorShape(shape) : shape), mirrored };
  }
  return null;
}

/**
 * THE DRAWING'S OWN FAULTS — what the checks say about the drawing itself,
 * served exactly (no nudge). Measured: 4 of 5 byline crosses fail the
 * hand-written "ball near the byline" rule, 4 of 6 cutbacks and 4 of 9
 * corners have a drawn man outside the frame, every time. Rejecting those
 * would quietly drop Harry's drawings from the game — the opposite of "the
 * drawings decide". So a served picture is only rebuilt for a fault the
 * SERVING added; a fault the drawing already has is left for a person to
 * look at (the sheet flags it).
 *
 * "Has it" = in at least 2 of 3 builds (the frame's size comes from the
 * builder, so one build is not enough). Cached per drawing and pool.
 */
const ownFaultCache = new Map<string, string[]>();
export function drawingOwnFaults(kind: ScenarioKind, id: string, mirrored: boolean): string[] {
  const set = ruleSetFor(kind);
  const ms = authoredPool(kind).find((x) => x.id === id);
  if (!set || !ms) return [];
  const key = `${kind}|${id}|${ms.updatedAt ?? 0}|${mirrored}|${set.n}`;
  const hit = ownFaultCache.get(key);
  if (hit) return hit;
  const counts = new Map<string, number>();
  for (let b = 0; b < 3; b++) {
    const rng = mulberry32(0x0f00d + b * 7919);
    const sc = buildScenario(kind, rng);
    const exact = randomiseAuthored(ms, set, rng, { noNudge: true });
    if (!exact) continue;
    applyAuthoredShape(sc, mirrored ? mirrorShape(exact) : exact);
    setupKind(sc, rng, { appliedAuthored: true, appliedPlan: false, keeperStrength: 62 });
    for (const f of servedFaults(sc)) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const own = Array.from(counts.entries()).filter(([, n]) => n >= 2).map(([f]) => f);
  ownFaultCache.set(key, own);
  return own;
}

/** Rendezvous pick (same idea as authoredChance's stableBase). */
function stableIndex(ids: string[], key: number): number {
  let best = 0, bestScore = -1;
  ids.forEach((id, i) => {
    let h = 5381;
    for (let k = 0; k < id.length; k++) h = ((h * 33) ^ id.charCodeAt(k)) >>> 0;
    h = (h ^ (key >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    if (h > bestScore) { bestScore = h; best = i; }
  });
  return best;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE GENERATOR — every figure from the drawings' spread (design's B)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ball: one drawing's ball ± 1.6 m, inside the drawn range. You: another
 * drawing's stance relative to its ball. Keeper: a third drawing's two shares.
 * Defender and
 * team-mate counts from a fourth and fifth. Each defender: a random drawn
 * defender of this kind, carried with the ball, ± 1.2 m, never within 1.5 m
 * of another body. Nothing hand-written places anyone.
 */
export function generatorShape(
  kind: string, rng: () => number,
): AuthoredShape | null {
  const set = ruleSetFor(kind);
  if (!set) return null;
  const base = drawingsOf(kind, set);
  if (base.length < GENERATOR_MIN_DRAWINGS) return null;
  const side: -1 | 1 = rng() < 0.5 ? -1 : 1;
  const pool = base.map((s) => onSide(s, side));
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
  const defCloud = pool.flatMap((s) => s.defenders.map((d) => ({ p: d, ball: s.ball })));
  const mateCloud = pool.flatMap((s) => s.mates.map((m) => ({ p: m, ball: s.ball })));
  for (let attempt = 0; attempt < 60; attempt++) {
    const bsrc = pick(pool);
    const ball = inPitch({ x: bsrc.ball.x + gauss(rng) * 1.6, y: bsrc.ball.y + gauss(rng) * 1.6 });
    const ysrc = pick(pool);
    const you = { x: ball.x + (ysrc.you.x - ysrc.ball.x) + gauss(rng) * 0.1, y: ball.y + (ysrc.you.y - ysrc.ball.y) + gauss(rng) * 0.1 };
    const ksrc = pick(pool);
    const keeper = placeKeeper(ball, keeperSharesOf(ksrc), ksrc.keeper, kind);
    const nD = pick(pool).defenders.length, nM = pick(pool).mates.length;
    const defenders: Vec2[] = [], mates: Vec2[] = [];
    let ok = true;
    const place = (cloud: { p: Vec2; ball: Vec2 }[], into: Vec2[]) => {
      for (let t = 0; t < 12; t++) {
        const c = pick(cloud);
        const p0 = carry(c.p, c.ball, ball);
        const p = inPitch({ x: p0.x + gauss(rng) * 1.2, y: p0.y + gauss(rng) * 1.2 });
        if ([you, ...defenders, ...mates].every((q) => hyp(p, q) >= 1.5) && hyp(p, ball) > 1.4) { into.push(p); return true; }
      }
      return false;
    };
    for (let i = 0; i < nD && ok; i++) ok = defCloud.length > 0 && place(defCloud, defenders);
    for (let i = 0; i < nM && ok; i++) ok = mateCloud.length > 0 && place(mateCloud, mates);
    if (!ok) continue;
    const cand: ShapeSample = { ball, you, keeper, defenders, mates };
    if (!ballInRange(cand, set, 0.5)) continue;
    if (closestPair(cand) + 0.05 < 1.0) continue;
    if (violations(cand, set).length) continue;
    return { sourceId: `gen:${bsrc.id}`, ...cand, camera: DEFAULT_CAMERA, jitter: 1, rejected: attempt };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE MIX — which KIND of chance (the one-on-one switch)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The kinds a request offers. Volleys and headers stay switched off, and a
 * one-on-one is only on offer when the move is a break (the hidden match's
 * "transition" pattern). A dribble's own request is separate: it becomes the
 * first-person run, not a picture. Where a one-on-one was the only thing on
 * offer, it stays.
 */
function offeredKinds(kinds: ScenarioKind[], req?: ScenarioRequest): ScenarioKind[] {
  let out = withoutSwitchedOff(kinds);
  if (req && req.pattern !== "transition" && !req.dribble) {
    const kept = out.filter((k) => k !== "one_on_one");
    if (kept.length) out = kept;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
//  makeChance
// ─────────────────────────────────────────────────────────────────────────

export type ChanceSource =
  /** The hidden match has handed you a situation. */
  | { from: "request"; request: ScenarioRequest; position: string }
  /** A completed pass came back to you where it arrived. */
  | { from: "chain"; pos: Vec2; ambition: number; position?: string }
  /** The engine's own "an attacking situation" pick. */
  | { from: "attacking" }
  /** No request at all (a sandbox): the position's own weighted pick. */
  | { from: "weighted"; position: string }
  /** A dev tool asking for one of THESE (gallery Sim, Infinite Highlights). */
  | { from: "kind"; kind: ScenarioKind; plan?: ChancePlan | null };

export interface MakeChanceOptions {
  source: ChanceSource;
  rng: () => number;
  strength?: { keeper: number; team: number; vision: number };
  /** The kept-across-matches picture memory. */
  memory?: PictureMemory | null;
  /** The chance formula's own 8-deep plan memory (kinds with no drawings). */
  selection?: SelectionMemory;
  /** The opponent's block, for kinds with no drawing (formationShape.ts). */
  formation?: ShapeInput | null;
  /** Drawings (the game) unless a Play Area dial says generator. */
  mode?: ChanceMakerMode;
  /** A gallery cell: keep its base drawing as the pool grows. */
  stableKey?: number;
}

export interface MadeChance {
  sc: Scenario;
  /** The drawn/generated shape laid on (null for a plan or the builder). */
  shape: AuthoredShape | null;
  how: "drawing" | "generator" | "plan" | "builder";
  appliedPlan: boolean;
  appliedAuthored: boolean;
  sourceId: string | null;
  /** Rebuilt because the picture was faulty. */
  faultRebuilds: number;
  /** Rebuilt because it looked like one of the last few. */
  memoryRebuilds: number;
  /** What is still wrong with the one served (empty when it is clean). */
  faults: string[];
  /** Nearest of the last N of its kind, metres (Infinity with no memory). */
  nearestRecent: number;
  /** Figures moved apart because two stood on one spot (spacing.ts). */
  separated: number;
  mode: ChanceMakerMode;
}

/**
 * Make the next chance. Everything that decides where anybody STANDS happens
 * here — the kind's own rules (the free-kick wall) included — so the caller
 * only has faces, roles and the camera left to do.
 */
export function makeChance(o: MakeChanceOptions): MadeChance {
  const mode = o.mode ?? DEFAULT_CHANCE_MAKER;
  const rng = o.rng;
  const ks = o.strength?.keeper ?? 62, tr = o.strength?.team ?? 60, vis = o.strength?.vision ?? 55;
  const build = (k: ScenarioKind) => buildScenario(k, rng, ks, tr, vis);

  // ── 1. The kind (and, for a kind with no drawings, its plan) ──
  let kind: ScenarioKind;
  let plan: ChancePlan | null = null;
  let first: Scenario | null = null;
  const src = o.source;
  if (src.from === "request") {
    const offered = offeredKinds(src.request.kinds, src.request);
    const req = { ...src.request, kinds: offered };
    kind = rollKind(req, src.position, rng);
    if (!servesDrawings(kind)) {
      plan = selectChance({ request: { ...req, kinds: [kind] }, position: src.position, rng, memory: o.selection ?? newSelectionMemory(), shape: o.formation ?? null });
    }
  } else if (src.from === "chain") {
    // Built from where the pass actually arrived, so playing it into the
    // corner gives you a cutback and finding someone central a shot.
    kind = playableKind(chainKindFor(src.pos, rng, src.ambition), rng);
  } else if (src.from === "attacking") {
    first = buildAttackingScenario(rng, ks, tr, vis);
    kind = first.kind;
  } else if (src.from === "weighted") {
    first = buildWeightedScenario(rng, src.position, ks, tr, vis);
    kind = first.kind;
  } else {
    kind = src.kind;
    plan = src.plan ?? null;
  }
  // A switched-off kind (volley, header) is swapped before it is ever shown.
  if (isSwitchedOff(kind)) {
    kind = playableKind(kind, rng);
    plan = null;
    first = null;
  }

  // ── 2. A kind with fewer than 5 drawings: the formula's plan or the builder ──
  if (!servesDrawings(kind)) {
    let sc: Scenario;
    let appliedPlan = false;
    if (plan && plan.kind === kind) {
      sc = build(kind);
      fixBaseScenario(sc);
      applyChancePlan(sc, plan, rng);
      appliedPlan = true;
    } else {
      sc = first ?? build(kind);
    }
    if (!appliedPlan) applyFormationShape(sc, o.formation ?? null);
    setupKind(sc, rng, { appliedAuthored: false, appliedPlan, keeperStrength: ks });
    const separated = separateBodies(sc);
    return {
      sc, shape: null, how: appliedPlan ? "plan" : "builder", appliedPlan, appliedAuthored: false, sourceId: null,
      faultRebuilds: 0, memoryRebuilds: 0, faults: [], nearestRecent: Infinity, separated, mode,
    };
  }

  // ── 3. A drawn kind, rebuilt until clean and fresh ──
  const useGen = mode === "generator" && canGenerate(kind);
  const rule = memoryRule(kind);
  let best: { sc: Scenario; shape: AuthoredShape; faults: string[]; gap: number; how: "drawing" | "generator"; separated: number } | null = null;
  let faultRebuilds = 0, memoryRebuilds = 0;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const sc = attempt === 0 && first ? first : build(kind);
    let how: "drawing" | "generator" = "drawing";
    let shape: AuthoredShape | null = null;
    let own: string[] = [];
    if (useGen) { shape = generatorShape(kind, rng); how = "generator"; }
    if (!shape) {
      const d = drawingShape(kind, rng, attempt === 0 ? o.stableKey : undefined);
      if (d) own = drawingOwnFaults(kind, d.sourceId, d.mirrored);
      shape = d;
      how = "drawing";
    }
    if (!shape) break;
    // The drawing is the team; the keeper stands, and leans, where drawn.
    applyAuthoredShape(sc, shape);
    setupKind(sc, rng, { appliedAuthored: true, appliedPlan: false, keeperStrength: ks });
    const separated = separateBodies(sc);
    // Only what the serving ADDED counts against it (see drawingOwnFaults).
    const faults = servedFaults(sc).filter((f) => !own.includes(f));
    const gap = o.memory ? o.memory.nearest(pictureOf(sc), rule.n) : Infinity;
    const fresh = gap >= rule.within;
    // Best so far: fewest faults, then fresh over familiar, then furthest
    // from anything remembered.
    const rank = (f: number, g: number) => [-f, g >= rule.within ? 1 : 0, Math.min(g, 1e6)];
    const a = rank(faults.length, gap), b = best ? rank(best.faults.length, best.gap) : null;
    const better = !b || a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
    if (better) best = { sc, shape, faults, gap, how, separated };
    if (faults.length === 0 && fresh) break;
    if (faults.length) faultRebuilds++; else memoryRebuilds++;
  }
  if (!best) {
    // No drawing could be laid on at all (unreachable with 5+ drawings).
    const sc = first ?? build(kind);
    applyFormationShape(sc, o.formation ?? null);
    setupKind(sc, rng, { appliedAuthored: false, appliedPlan: false, keeperStrength: ks });
    const separated = separateBodies(sc);
    return { sc, shape: null, how: "builder", appliedPlan: false, appliedAuthored: false, sourceId: null, faultRebuilds, memoryRebuilds, faults: [], nearestRecent: Infinity, separated, mode };
  }
  o.memory?.remember(pictureOf(best.sc));
  return {
    sc: best.sc, shape: best.shape, how: best.how, appliedPlan: false, appliedAuthored: true, sourceId: best.shape.sourceId,
    faultRebuilds, memoryRebuilds, faults: best.faults, nearestRecent: best.gap, separated: best.separated, mode,
  };
}

/**
 * The kind, rolled ONCE with the realism table (`FREQ` via selectChance's own
 * weighting) and the position's weights — without today's second roll.
 *
 * Today, when the formula has no plan for the rolled kind (a tight angle in
 * the centre lane never has one: its cells are all wide), the kind is rolled
 * AGAIN over everything offered, without the realism table, and a striker's
 * one-on-one weight (20) wins that roll most of the time. That second roll is
 * where most of the one-on-ones come from.
 */
export function rollKind(req: ScenarioRequest, position: string, rng: () => number): ScenarioKind {
  // scenarioSelect's own realism table, read through its export: one table.
  const prior = FREQ[`${req.zone}|${(req.lane ?? "centre") === "centre" ? "centre" : "wide"}`] ?? {};
  const pool: ScenarioKind[] = [];
  for (const k of req.kinds) {
    const entries = Math.max(1, Math.round(((prior as Record<string, number>)[k] ?? 0.5) * 4));
    for (let i = 0; i < entries; i++) pool.push(k);
  }
  return pickScenarioKindFrom(position, rng, pool);
}


// ─────────────────────────────────────────────────────────────────────────
//  THE DEV TOOLS — the gallery's Sim and Infinite Highlights
// ─────────────────────────────────────────────────────────────────────────

/**
 * The dev tools' chance maker: the Play Area's own dial on this device
 * (PlaySettings.chanceMaker). The gallery's Sim and Infinite Highlights read
 * it; a career never does — CanvasMatch takes it as a prop, and only the
 * Play Area's engine mount (EnginePlay) passes anything but "drawings".
 */
export function devChanceMaker(): ChanceMakerMode {
  return loadPlaySettings().chanceMaker;
}

/** One Sim of a drawn kind, rebuilt from its seed alone (a cell never wanders). */
export function buildDrawnSim(kind: ScenarioKind, seed: number, mode: ChanceMakerMode = devChanceMaker()): MadeChance {
  return makeChance({
    source: { from: "kind", kind },
    rng: mulberry32(seed),
    memory: null,
    stableKey: seed,
    mode,
  });
}

/**
 * The next Sim of a drawn kind, fresh against the review memory: a new seed
 * until the picture is not one of the last few (up to 10 tries, then the
 * least-alike of them). The memory is checked here, not inside the build, so
 * a seed still rebuilds to the same picture forever.
 */
export function nextDrawnSeed(
  kind: ScenarioKind, rng: () => number, memory: PictureMemory, mode: ChanceMakerMode = devChanceMaker(),
): { seed: number; made: MadeChance; tries: number } {
  const rule = memoryRule(kind);
  let best: { seed: number; made: MadeChance; gap: number } | null = null;
  let tries = 0;
  for (; tries < MAX_TRIES; tries++) {
    const seed = Math.floor(rng() * 2_000_000_000) + 1;
    const made = buildDrawnSim(kind, seed, mode);
    const gap = memory.nearest(pictureOf(made.sc), rule.n);
    if (!best || gap > best.gap) best = { seed, made, gap };
    if (gap >= rule.within) break;
  }
  memory.remember(pictureOf(best!.made.sc));
  return { seed: best!.seed, made: best!.made, tries };
}

/** Is a dev tool's Sim of this kind made here (a drawn kind), rather than
 *  by the chance formula's plan? */
export function simIsMadeHere(kind: string): boolean {
  return servesDrawings(kind);
}

/** Which drawings a served picture is nearest, for a sheet's labels. */
export function nearestDrawing(pic: Picture): { id: string; gap: number } | null {
  const set = ruleSetFor(pic.kind);
  if (!set) return null;
  let best: { id: string; gap: number } | null = null;
  for (const d of drawingsOf(pic.kind, set)) {
    const dp: Picture = { kind: pic.kind, ball: d.ball, you: d.you, keeper: d.keeper, defenders: d.defenders, mates: d.mates, cam: pic.cam };
    const g = pictureGap({ ...pic }, dp);
    if (!best || g < best.gap) best = { id: d.id, gap: g };
  }
  return best;
}
