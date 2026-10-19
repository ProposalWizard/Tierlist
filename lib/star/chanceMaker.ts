/**
 * THE CHANCE MAKER — one function makes every chance you are served.
 *
 * Harry, 27 Sep 2026: "every single highlight should feel different." And,
 * on how it worked: "the current thing works pretty well I just don't like
 * how it works in game" — so the real match, the gallery's Sim and Infinite
 * Highlights all go through this one file, and a chance is made the same way
 * in all three.
 *
 * ── Drawings only (Harry, 12 Oct 2026) ──
 *   One of your drawings is the base, nudged (open play only — never a
 *   penalty or a free kick) and checked against its own rules, then mirrored
 *   half the time. The drawing decides who is on the pitch. The generator and
 *   the New chance library were deleted ("they're wrong"); see git before
 *   commit for them.
 * ── What it adds ──
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
 *   The camera's last word (lib/star/goalFrame.ts): the whole goal in frame
 *   and room below the ball for a full pull — by sliding the camera, or
 *   zooming it out, never by moving the chance.
 *
 * ── Which kind (one-on-ones mostly on a break) ──
 *
 *   Harry: "a one-on-one is once a match, maybe … maybe one every three
 *   games". The kind is rolled once with the realism table (rollKind), and a
 *   one-on-one is offered when the match says the move is a break ("They
 *   lose it — you break on them"), and in settled play only 1 time in 10
 *   (SETTLED_ONE_ON_ONE); otherwise the middle of the box is a tight angle. A pass that comes back to you can still put you through.
 *   Volleys and headers stay switched off (switchedOffKinds.ts).
 *
 * canvasEngine.ts is not touched. Kinds with fewer than 5 drawings are made
 * by the builder and the chance formula, as before.
 */

import {
  buildScenario, buildAttackingScenario, buildWeightedScenario, pickScenarioKindFrom, chainKindFor, goalInView,
  type Scenario, type ScenarioKind, type Vec2,
} from "./canvasEngine";
import { kindsForZone, type ScenarioRequest, type Zone } from "./hiddenMatch";
import { EVEN_KIND_MIX, EVEN_KINDS, newKindBag, nextEvenKind, guardedDeal, guardAllows, noteDealt } from "./kindMix";
import { newChancesOn } from "./newChances";
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
import { finishServedFrame } from "./goalFrame";
import { CX, PITCH_W } from "./pitch";
import { mulberry32 } from "./season";

// ─────────────────────────────────────────────────────────────────────────
//  THE ONE DIAL
// ─────────────────────────────────────────────────────────────────────────

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
    } catch {
      // Full (v0.25 item 15: a well-used test computer): keep only what the
      // rule reads — the last PICTURE_MEMORY of each kind — and try once more.
      // Still refused: the memory works for this visit, and visitSalt below
      // keeps the next visit from opening on the same picture.
      try {
        const small: Record<string, Picture[]> = {};
        for (const [k, v] of Object.entries(this.byKind)) small[k] = Array.isArray(v) ? v.slice(-PICTURE_MEMORY) : [];
        if (typeof window !== "undefined") window.localStorage.setItem(this.key(), JSON.stringify(small));
      } catch { /* blocked: this visit only */ }
    }
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

/**
 * THE SAME LONG SHOT EVERY TIME (v0.25 item 15). Harry: "on one computer the
 * same long-shot highlight comes up every time." A match is seeded by its
 * week, so starting the same match again asks for the same chance with the
 * same random numbers; only the memory above stops it being served again —
 * and on a browser whose storage is full or blocked the memory is gone at
 * every reload. Measured, 50 restarts of one match: 1 distinct opening long
 * shot with storage refused, 6 with storage working.
 *
 * So each page visit also gets its own small offset for WHICH drawing is
 * tried first. It draws no extra random numbers (the match plays out as
 * before) and is used only when a memory is passed — the game and the review
 * tools. A gallery cell (no memory) and a test (no browser) are unchanged.
 */
let visitSalt: number | undefined;
export function setVisitSalt(v: number | undefined): void { visitSalt = v; }
function saltFor(o: { memory?: PictureMemory | null }): number {
  if (!o.memory) return 0;
  if (visitSalt === undefined) {
    if (typeof window === "undefined") return 0;
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      visitSalt = a[0];
    } catch { visitSalt = Math.floor(Math.random() * 0x7fffffff); }
  }
  return visitSalt >>> 0;
}

/**
 * The match's own random numbers, turned by the visit salt: every draw is
 * moved round the [0, 1) circle by the same amount, so exactly as many
 * numbers are drawn as before and each is still evenly spread. No salt
 * (a test, a gallery cell): the stream itself, untouched.
 */
export function saltedRng(rng: () => number, salt: number): () => number {
  if (!salt) return rng;
  const shift = ((salt >>> 0) % 1000003) / 1000003;
  return () => { const v = rng() + shift; return v - Math.floor(v); };
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
  const onBall = defenderOnTheBall(s, set);
  if (onBall) out.add(onBall);
  return Array.from(out);
}

/**
 * A DEFENDER NEARER THE BALL THAN ANY DRAWING PUTS ONE (v0.24, Harry's first
 * National League match).
 *
 * Harry: "this is a bad highlight where you always get intercepted … I'm
 * definitely not gonna get to do this." Filmed: a tight angle served with a
 * defender standing on the ball, between it and the goal and every team-mate.
 * The ball was hidden under him. Every kick went into him.
 *
 * The drawings never do this. The closest any tight-angle drawing puts a
 * defender is 1.56 m (cutback 2.53 m, one-on-one 1.92 m). The serving's 2 m
 * nudge, and the spacing pass that moves a defender off YOU, can walk him onto
 * the ball. Measured over 250 served tight angles: 4% had a defender within
 * 1 m, and with him there the obvious plays worked 60% of the time against
 * 100% with nobody within 2 m.
 *
 * No new number: the floor is the kind's own "Nearest defender to the ball"
 * minimum, scanned off its drawings (scenarioRules.ts's defNearest). Only with
 * enough drawings to call it a range (MIN_SAMPLES_FOR_INVARIANT).
 */
export const DEFENDER_ON_BALL = "a defender nearer the ball than any drawing puts one";
export function defenderOnTheBall(s: ShapeSample, set: RuleSet | null): string | null {
  if (!set || set.n < MIN_SAMPLES_FOR_INVARIANT) return null;
  const rule = set.rules.find((r) => r.id === "defNearest");
  const m = MEASURES.find((x) => x.id === "defNearest");
  if (!rule || !m) return null;
  const defs = s.defenders.filter((d) => !parked(d));
  if (!defs.length) return null;
  const v = m.of({ ...s, defenders: defs });
  // A centimetre of rounding either way is the same picture. The words carry
  // no number: drawingOwnFaults matches a fault by its exact text.
  return v < rule.min - 0.01 ? DEFENDER_ON_BALL : null;
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

const mirrorV = (v: Vec2): Vec2 => ({ x: PITCH_W - v.x, y: v.y });
function mirrorSample<T extends ShapeSample>(s: T): T {
  return { ...s, ball: mirrorV(s.ball), you: mirrorV(s.you), keeper: mirrorV(s.keeper), defenders: s.defenders.map(mirrorV), mates: s.mates.map(mirrorV) };
}
function onSide<T extends ShapeSample>(s: T, side: -1 | 1): T {
  return sideOf(s.ball) === side ? s : mirrorSample(s);
}
/** Which half of the pitch, across: -1 the left (x < CX, the "left" lane), 1 the right. */
export const sideOf = (p: Vec2): -1 | 1 => (p.x >= CX ? 1 : -1);

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
  kind: string, rng: () => number, stableKey?: number, salt = 0, side?: -1 | 1,
): DrawnShape | null {
  const set = ruleSetFor(kind);
  if (!set || set.n < MIN_SAMPLES_FOR_INVARIANT) return null;
  const pool = authoredPool(kind);
  const bad = new Set(outliersOf(set).map((o) => o.id));
  const clean = pool.filter((s) => !bad.has(s.id));
  const from = clean.length ? clean : pool;
  // `salt` (visitSalt) only turns the starting drawing; the same one rng() is drawn.
  const start = stableKey === undefined ? (Math.floor(rng() * from.length) + salt) % from.length : stableIndex(from.map((s) => s.id), stableKey);
  for (let i = 0; i < from.length; i++) {
    const base = from[(start + i) % from.length];
    // (A penalty and a free kick are served exactly as drawn — see
    // randomiseAuthored's DEAD_BALL_EXACT.)
    const shape = randomiseAuthored(base, set, rng, { fixedBall: FIXED_BALL.has(kind) });
    if (!shape) continue;
    // The visit salt can flip the side too (same one rng() drawn).
    const coin = (rng() < 0.5) !== (((salt >>> 16) & 1) === 1);
    // Chances: New — the side the match says the move is on (the same one
    // rng() is still drawn, so the stream is the same length).
    const mirrored = side === undefined ? coin : sideOf(shape.ball) !== side;
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
//  THE MIX — which KIND of chance (the one-on-one switch)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The kinds a request offers. Volleys and headers stay switched off, and a
 * one-on-one is on offer when the move is a break (the hidden match's
 * "transition" pattern) — and, in settled play, only SETTLED_ONE_ON_ONE of
 * the time. A dribble's own request is separate: it becomes the first-person
 * run, not a picture. Where a one-on-one was the only thing on offer, it
 * stays.
 */
function offeredKinds(kinds: ScenarioKind[], req: ScenarioRequest | undefined, rng: () => number): ScenarioKind[] {
  let out = withoutSwitchedOff(kinds);
  if (req && req.pattern !== "transition" && !req.dribble && out.includes("one_on_one")) {
    // Its own draw, only when there is a one-on-one to keep or drop.
    if (rng() >= SETTLED_ONE_ON_ONE) {
      const kept = out.filter((k) => k !== "one_on_one");
      if (kept.length) out = kept;
    }
  }
  return out;
}

/**
 * How often settled play may still offer a one-on-one. Harry, v0.15: about
 * one every 3 games for a striker — "only on a break" alone gave one every
 * 5.6, so settled play keeps it on offer this share of the time.
 */
export const SETTLED_ONE_ON_ONE = 0.1;

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
  /** A gallery cell: keep its base drawing as the pool grows. */
  stableKey?: number;
  /** Deal open play from the real mix, not the even one (kindMix.ts's
   *  REAL_MIX; Settings → Match → Chance mix). Absent: the even mix. */
  realMix?: boolean;
}

export interface MadeChance {
  sc: Scenario;
  /** The drawn/generated shape laid on (null for a plan or the builder). */
  shape: AuthoredShape | null;
  how: "drawing" | "plan" | "builder";
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
}

/**
 * Make the next chance. Everything that decides where anybody STANDS happens
 * here — the kind's own rules (the free-kick wall) included — so the caller
 * only has faces, roles and the camera left to do.
 */
export function makeChance(o: MakeChanceOptions): MadeChance {
  const rng = o.rng;
  const ks = o.strength?.keeper ?? 62, tr = o.strength?.team ?? 60, vis = o.strength?.vision ?? 55;
  const build = (k: ScenarioKind) => buildScenario(k, rng, ks, tr, vis);

  // ── 1. The kind (and, for a kind with no drawings, its plan) ──
  let kind: ScenarioKind;
  let plan: ChancePlan | null = null;
  let first: Scenario | null = null;
  const src = o.source;
  // Settings → Chances: New (lib/star/newChances.ts). Off: everything below
  // runs exactly as before; every New line is behind this one flag.
  const nc = newChancesOn();
  // New: the side of the pitch the drawing goes on (undefined = the coin flip).
  let side: -1 | 1 | undefined;
  // Harry, 3 Oct 2026 — an even mix of highlights for now (lib/star/kindMix.ts):
  // open play and a move that carries on are dealt from a shuffled bag.
  const evenDeal = (): ScenarioKind => {
    if (!o.selection) return EVEN_KINDS[Math.floor(rng() * EVEN_KINDS.length) % EVEN_KINDS.length];
    o.selection.kindBag ??= newKindBag();
    return nextEvenKind(o.selection.kindBag, rng, !!o.realMix);
  };
  if (nc && src.from === "request") {
    const r = newRequestKind(src.request, src.position, rng, o.selection);
    kind = r.kind;
    side = r.side;
  } else if (src.from === "request") {
    const offered = offeredKinds(src.request.kinds, src.request, rng);
    const openPlay = EVEN_KIND_MIX && !src.request.dribble && src.request.pattern !== "set_piece" && src.request.kinds.length > 1;
    const req = openPlay ? { ...src.request, kinds: [evenDeal()] } : { ...src.request, kinds: offered };
    kind = openPlay ? req.kinds[0] : rollKind(req, src.position, rng);
    if (!servesDrawings(kind)) {
      // The visit salt turns the plan too (v0.25 item 12) — see saltedRng.
      plan = selectChance({ request: { ...req, kinds: [kind] }, position: src.position, rng: saltedRng(rng, saltFor(o)), memory: o.selection ?? newSelectionMemory(), shape: o.formation ?? null });
    }
  } else if (src.from === "chain") {
    // Built from where the pass actually arrived, so playing it into the
    // corner gives you a cutback and finding someone central a shot.
    kind = EVEN_KIND_MIX ? evenDeal() : playableKind(chainKindFor(src.pos, rng, src.ambition), rng);
    // New: the move carries on on the side the pass went to (the thin-kind
    // swap below covers the kind).
    if (nc) side = sideOf(src.pos);
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
  // New: no chance of a kind with fewer than 5 drawings is left to the
  // hand-written builder — it becomes the nearest kind that has drawings.
  // (A dev tool asking for a kind by name still gets that kind.)
  if (nc && src.from !== "kind") {
    const k2 = drawnKindFor(kind);
    if (k2 !== kind) { kind = k2; plan = null; first = null; }
    if (o.selection) noteDealt((o.selection.dealt ??= []), kind);
  }

  // ── 2. A kind with fewer than 5 drawings: the formula's plan or the builder ──
  if (!servesDrawings(kind)) {
    // A kind with no drawings is laid out by the builder or the formula's
    // plan, from the match's own random numbers — and a match is seeded by
    // its week. So the visit salt has to reach this path as well, or the
    // same match restarted opens on the same picture every time. Seen
    // (v0.25 item 12, Harry: "the same long-shot highlight keeps coming"):
    // a National League opening chance restarted 6 times, the ball on the
    // same pixel all 6, and the picture memory empty — this path never
    // used the salt or the memory. saltedRng draws the same count.
    const salt = saltFor(o);
    const prng = saltedRng(rng, salt);
    const sbuild = (k: ScenarioKind) => buildScenario(k, prng, ks, tr, vis);
    let sc: Scenario;
    let appliedPlan = false;
    if (plan && plan.kind === kind) {
      sc = sbuild(kind);
      fixBaseScenario(sc);
      applyChancePlan(sc, plan, prng);
      appliedPlan = true;
    } else {
      sc = (salt && first) ? sbuild(kind) : first ?? sbuild(kind);
    }
    if (!appliedPlan) applyFormationShape(sc, o.formation ?? null);
    setupKind(sc, prng, { appliedAuthored: false, appliedPlan, keeperStrength: ks });
    const separated = separateBodies(sc);
    finishServedFrame(sc);
    return {
      sc, shape: null, how: appliedPlan ? "plan" : "builder", appliedPlan, appliedAuthored: false, sourceId: null,
      faultRebuilds: 0, memoryRebuilds: 0, faults: [], nearestRecent: Infinity, separated,
    };
  }

  // ── 3. A drawn kind, rebuilt until clean and fresh ──
  const rule = memoryRule(kind);
  let best: { sc: Scenario; shape: AuthoredShape; faults: string[]; gap: number; how: "drawing"; separated: number } | null = null;
  let faultRebuilds = 0, memoryRebuilds = 0;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let sc = attempt === 0 && first ? first : build(kind);
    // New: a corner or a byline cross is filmed from the builder's flag and
    // its drawing is laid on that flag (applyAuthoredShape), so the builder
    // has to pick the flag on the match's side. A few rebuilds, New only.
    if (side !== undefined && (kind === "corner" || kind === "byline_cross")) {
      for (let t = 0; t < 8 && sideOf(sc.ball) !== side; t++) sc = build(kind);
    }
    const how = "drawing" as const;
    let own: string[] = [];
    const shape = drawingShape(kind, rng, attempt === 0 ? o.stableKey : undefined, saltFor(o), side);
    if (shape) own = drawingOwnFaults(kind, shape.sourceId, shape.mirrored);
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
    finishServedFrame(sc);
    return { sc, shape: null, how: "builder", appliedPlan: false, appliedAuthored: false, sourceId: null, faultRebuilds, memoryRebuilds, faults: [], nearestRecent: Infinity, separated };
  }
  // The camera's last word (v0.15 items 12 and 20): the whole goal, and room
  // to pull back — the camera moves, never the chance (lib/star/goalFrame.ts).
  finishServedFrame(best.sc);
  o.memory?.remember(pictureOf(best.sc));
  return {
    sc: best.sc, shape: best.shape, how: best.how, appliedPlan: false, appliedAuthored: true, sourceId: best.shape.sourceId,
    faultRebuilds, memoryRebuilds, faults: best.faults, nearestRecent: best.gap, separated: best.separated,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  CHANCES: NEW (Settings → Chances; lib/star/newChances.ts). Harry, 14 Oct
//  2026. Reached only when newChancesOn() is true.
// ─────────────────────────────────────────────────────────────────────────

/** The radar's zones, own goal to theirs (hiddenMatch.ts's ZONE_ORDER). */
const ZONES: Zone[] = ["own_box", "defensive", "middle", "attacking", "box"];

/** Your position's own side of the pitch: -1 left, 1 right, 0 a centre player. */
export function positionSide(position: string | undefined): -1 | 0 | 1 {
  const p = (position ?? "").toUpperCase();
  if (/^L(W|M|B|WB|F|CM|CB|AM)$/.test(p)) return -1;
  if (/^R(W|M|B|WB|F|CM|CB|AM)$/.test(p)) return 1;
  return 0;
}

/**
 * The side a request's drawing goes on: the radar's lane; in the centre lane,
 * your own side (a centre player: undefined, today's coin flip).
 */
export function requestSide(req: ScenarioRequest, position: string | undefined): -1 | 1 | undefined {
  if (req.lane === "left") return -1;
  if (req.lane === "right") return 1;
  const own = positionSide(position);
  return own === 0 ? undefined : own;
}

/** Open-play kinds with 5+ drawings — what a thin kind can turn into. */
function drawnOpenKinds(): ScenarioKind[] {
  return EVEN_KINDS.filter((k) => servesDrawings(k));
}

/** Where a kind's ball sits: across from the middle and depth from goal,
 *  averaged over its drawings (side-free: the picture gets mirrored anyway). */
function kindCentroid(kind: ScenarioKind): { lat: number; depth: number } {
  const balls = authoredPool(kind).map((ms) => sampleFromAuthored(ms)).filter((x): x is ShapeSample => !!x).map((x) => x.ball);
  // No drawing at all: the builder's own ball, on a fixed stream of its own.
  if (!balls.length) balls.push(buildScenario(kind, mulberry32(0x5eed)).ball);
  return { lat: mean(balls.map((b) => Math.abs(b.x - CX))), depth: mean(balls.map((b) => b.y)) };
}

const drawnKindCache = new Map<string, ScenarioKind>();
/**
 * A kind with fewer than 5 drawings (through ball, build-up) swapped for the
 * nearest open-play kind that has drawings, by where the ball sits. On the
 * current drawings: through ball → long range, build-up → midfield pass.
 * A kind that has drawings comes back as it is. Never a set piece.
 */
export function drawnKindFor(kind: ScenarioKind): ScenarioKind {
  if (servesDrawings(kind)) return kind;
  const pool = drawnOpenKinds();
  if (!pool.length) return kind;
  const key = `${kind}|${pool.map((k) => `${k}:${ruleSetFor(k)?.n ?? 0}`).join(",")}|${ruleSetFor(kind)?.n ?? 0}`;
  const hit = drawnKindCache.get(key);
  if (hit) return hit;
  const c = kindCentroid(kind);
  let best = pool[0], bestD = Infinity;
  for (const k of pool) {
    const d = kindCentroid(k);
    const dist = Math.hypot(d.lat - c.lat, d.depth - c.depth);
    if (dist < bestD) { bestD = dist; best = k; }
  }
  drawnKindCache.set(key, best);
  return best;
}

/**
 * New only: at most this many crosses and cutbacks TOGETHER in any 8 chances
 * (on top of the per-kind guard), and a lighter weight. Harry, 14 Oct 2026: "there's probably a bit
 * too much crossing and cutbacks right now" — New dealt them 32.9% of open
 * play against Old's 26.8% (tests/star/chanceJudge.mts, 40 matches). While the
 * cap is reached, a cross is swapped for the zone's other kinds, then the
 * zones either side (as the guard already does).
 */
export const NEW_CROSS_MAX_IN_8 = 2;
/** Their weight in the deal next to the other kinds (the radar's own = 1),
 *  so the cap is reached less often and fewer chances have to leave the zone. */
export const NEW_CROSS_WEIGHT = 0.6;
const CROSS_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["byline_cross", "cutback"]);
/** Copies are the deal's weights: every kind ×10, a cross or cutback ×10·weight. */
function weighCrosses(ks: readonly ScenarioKind[]): ScenarioKind[] {
  const n = Math.round(10 * NEW_CROSS_WEIGHT);
  return ks.flatMap((k) => Array<ScenarioKind>(CROSS_KINDS.has(k) ? n : 10).fill(k));
}
function crossesCapped(dealt: readonly ScenarioKind[]): boolean {
  return dealt.slice(-7).filter((k) => CROSS_KINDS.has(k)).length >= NEW_CROSS_MAX_IN_8;
}

/**
 * New: the kind for a request, and the side it goes on. Open play is dealt
 * from the radar's own weighted kinds (request.kinds: weightKinds' copies)
 * with the guard (never twice in a row, at most 2 of a kind in any 8); a set
 * piece or a single-kind request is rolled as before. Thin kinds are swapped
 * for the nearest kind with drawings first, so their weight carries over.
 */
function newRequestKind(
  req: ScenarioRequest, position: string, rng: () => number, mem: SelectionMemory | undefined,
): { kind: ScenarioKind; side: -1 | 1 | undefined } {
  const side = requestSide(req, position);
  const offered = offeredKinds(req.kinds, req, rng);
  const openPlay = !req.dribble && req.pattern !== "set_piece" && req.kinds.length > 1;
  if (!openPlay) return { kind: drawnKindFor(rollKind({ ...req, kinds: offered }, position, rng)), side };
  const swap = (ks: ScenarioKind[]) => withoutSwitchedOff(ks).map(drawnKindFor);
  // For when the guard blocks every offered kind: the zone's own kinds (both
  // lanes), then the zones either side. A one-on-one is never added this way
  // (it is once a match).
  const zoneKinds = (z: Zone) => Array.from(new Set(swap([...kindsForZone(z, "centre"), ...kindsForZone(z, "left")])))
    .filter((k) => k !== "one_on_one");
  const zi = ZONES.indexOf(req.zone);
  const near = [ZONES[zi + 1], ZONES[zi - 1]].filter((z): z is Zone => !!z);
  const wider = [zoneKinds(req.zone), Array.from(new Set(near.flatMap(zoneKinds)))];
  const dealt = mem?.dealt ?? [];
  const off = weighCrosses(swap(offered)), wid = wider.map(weighCrosses);
  if (crossesCapped(dealt)) {
    const noCross = (ks: ScenarioKind[]) => ks.filter((k) => !CROSS_KINDS.has(k));
    const offC = noCross(off), widC = wid.map(noCross);
    // The cap gives way to the kind guard: it bites only while something that
    // is not a cross still passes the guard.
    if ([offC, ...widC].some((ks) => ks.some((k) => guardAllows(k, dealt)))) {
      return { kind: guardedDeal(offC, widC, dealt, rng), side };
    }
  }
  return { kind: guardedDeal(off, wid, dealt, rng), side };
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

/** One Sim of a drawn kind, rebuilt from its seed alone (a cell never wanders). */
export function buildDrawnSim(kind: ScenarioKind, seed: number): MadeChance {
  return makeChance({
    source: { from: "kind", kind },
    rng: mulberry32(seed),
    memory: null,
    stableKey: seed,
  });
}

/**
 * The next Sim of a drawn kind, fresh against the review memory: a new seed
 * until the picture is not one of the last few (up to 10 tries, then the
 * least-alike of them). The memory is checked here, not inside the build, so
 * a seed still rebuilds to the same picture forever.
 */
export function nextDrawnSeed(
  kind: ScenarioKind, rng: () => number, memory: PictureMemory,
): { seed: number; made: MadeChance; tries: number } {
  const rule = memoryRule(kind);
  let best: { seed: number; made: MadeChance; gap: number } | null = null;
  let tries = 0;
  for (; tries < MAX_TRIES; tries++) {
    const seed = Math.floor(rng() * 2_000_000_000) + 1;
    const made = buildDrawnSim(kind, seed);
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
