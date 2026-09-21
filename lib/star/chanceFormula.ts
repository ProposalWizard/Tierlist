import {
  buildScenario, goalInView,
  type Scenario, type ScenarioKind, type Defender, type Runner, type Vec2, type Viewport,
} from "./canvasEngine";
import {
  CX, PITCH_W, POST_L, POST_R, HALF_LEN, NET_DEPTH, BOX_DEPTH, SIX_DEPTH,
} from "./pitch";
import { scenarioFaults, fixBaseScenario, offsideLineOf, inShotCone } from "./baseScenario";
import { targetBlock, defensiveLineOf, onTheBoxEdge, type ShapeInput } from "./formationShape";
import type { Lane, ChancePattern, ScenarioRequest } from "./hiddenMatch";

/**
 * THE CHANCE FORMULA — a generative parameter space that EXPANDS a correct base.
 *
 * Built to Fable's design spec (scratchpad/chance-formula-spec.md) with the
 * owner's own two corrections folded in:
 *
 *  1. "It's more important we get the base outcomes correct, and then we'll
 *     create some sort of formula to apply those to formations or playstyles."
 *     So the BASE is an input, not something this file owns. `buildScenario`
 *     builds it, `fixBaseScenario` (baseScenario.ts) repairs its defining
 *     property, and only then does this layer scale it across formation,
 *     playstyle, difficulty, pattern and camera. Change a base shape and the
 *     expansion follows automatically — nothing here re-states what a
 *     one-on-one or a cutback IS.
 *
 *  2. "the camera angle isn't always isolated to the middle, not the whole
 *     formation/backline is gonna be on screen at the same time — u could be
 *     on the left wing more zoomed in and only see a left back a cb and your
 *     striker in the box."
 *     So the FULL, COHERENT shape is generated in world space first, and the
 *     camera is an independent dimension that frames a slice of it. Two or
 *     three defenders on screen is a correct picture, not a missing one. The
 *     realism filter judges the WORLD shape; only the ball, you, the keeper
 *     (when the goal is in frame) and the pass target are required to be
 *     visible.
 *
 * ── Where the numbers come from ──
 *
 * scratchpad/research-SB360-measured.md, 653,890 StatsBomb-360 freeze frames:
 *  - Table 1: back line ≈ 0.66 × the ball's distance from goal; defenders
 *    inside the box collapse 7 → 4 → 2 → 0 as the ball goes 10 → 20 → 25 → 30 m
 *    out. DEFENDER_IN_BOX_BY_BAND below.
 *  - Table 6: regular play median 4 defenders in the box, a genuine counter 1,
 *    and only ~4% of shots come from one. That is `transition`.
 *  - Table 3: from 16-25 m a team-mate is in the shot's own lane in under a
 *    quarter of shots, and essentially never more than one.
 *  - Table 4: box occupation on crosses — near post 0.56 vs far post 0.15.
 *  - Table 5: keeper 1.7-3.9 m off his line for a 20-30 m ball, shading
 *    ~0.28 × the ball's lateral offset.
 * research-C-attacking-occupation §C3: no team-mate inside the ball→posts
 *    triangle for a shot from ≥14 m.
 * research-A-defensive-shape §A4/§A6: marking distances, and 4+ defenders
 *    behind the ball as the settled-shape threshold.
 *
 * ── Swappability ──
 *
 * PARAM_SPACE and FILTER_RULES are each ONE exported value. A replacement
 * parameter space replaces those two plus the band tables they name. Nothing
 * downstream (generation, selection, the geometry writer, the harness) reads a
 * hard-coded dimension.
 *
 * canvasEngine.ts is never modified. Only public fields are written.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const U = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T,>(rng: () => number, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

// ── THE DIMENSIONS ──────────────────────────────────────────────────────────

/** Ball distance from the goal line. Spec §1's six bands. */
export type DistanceBand = "six" | "golden" | "spot" | "edge" | "range" | "deep";
/** Lateral channel, |x - CX|. */
export type LateralBand = "centre" | "half_space" | "wide" | "touchline";
/** Nearest defender to the carrier. */
export type Engagement = "pressed" | "closing" | "free";
/** Where the keeper has set himself. */
export type KeeperSet = "set" | "stepped" | "out";
/** How the camera frames the world shape. The owner's correction: a real
 *  dimension, not derived from the middle of the pitch. */
export type FrameZoom = "tight" | "normal" | "wide";
/** What the camera is centred on. */
export type FrameAnchor = "ball" | "goal" | "between";
/** The opponent relative to you. */
export type StrengthBand = "weak" | "even" | "strong";

/** Metres from the goal line, [lo, hi]. */
export const DISTANCE_M: Record<DistanceBand, [number, number]> = {
  six: [1, 5.5],
  golden: [5.5, 11],      // 51.1% of open-play header goals land 6-12 yd [C]
  spot: [11, 16.5],
  edge: [16.5, 22],
  range: [22, 30],
  deep: [30, 38],         // never a shot kind
};

/** |x - CX| metres, [lo, hi]. Sign is a free mirror. */
export const LATERAL_M: Record<LateralBand, [number, number]> = {
  centre: [0, 4],
  half_space: [4, 12],
  wide: [12, 20],
  touchline: [20, 31],
};

/** Nearest defender's distance to the carrier, by engagement. */
export const ENGAGE_M: Record<Engagement, [number, number]> = {
  pressed: [1.5, 2.6],
  closing: [3.5, 5.0],
  free: [5.5, 9.0],
};

/** Keeper distance off his line. [M] Table 5 for "stepped". */
export const KEEPER_M: Record<KeeperSet, [number, number]> = {
  set: [0.5, 1.4],
  stepped: [1.7, 3.3],
  out: [4.0, 7.0],
};

/**
 * ONE VIEW HEIGHT, FOR EVERY CHANCE. The goal is exactly the same size in
 * every picture the game ever shows; the camera only ever slides.
 *
 * Reported directly: "the goal and camera angle of the goal always need to be
 * the same... it should move up, down, left, right, but it should never really
 * change how it looks." He was describing a real bug with two sources — the
 * Scenario Builder's free 10-52.5 m Zoom slider, and this table, which used to
 * read { tight: 30, normal: 42, wide: 54 }. Measured across the generated
 * space, 69.2% of chances were NOT framed at 42 m (30.7% at 30 m, 33.8% at
 * 54 m) and a further 10.0% grew beyond their own setting to keep the keeper
 * on screen. Nearly 2x between the smallest and largest goal on screen.
 *
 * 42 is not a new number: it is the engine's own `VIEW_MIN_H`/`VIEW_MAX_H`,
 * already equal to each other there, with the comment "the frame IS the
 * situation… anything it cannot hold gets pulled inside rather than the
 * rectangle growing". This brings the layer back in line with the engine.
 */
export const FIXED_VIEW_H = 42;
/** The frame is a 5:8 portrait, so one fixed height is one fixed width too. */
export const FIXED_VIEW_W = FIXED_VIEW_H * (5 / 8);
/** The tightest the formula's own camera may go — matches canvasEngine's
 *  VIEW_MIN_H, so a generated chance and a hand-built one frame the same way. */
export const FRAME_MIN_H = 28;
/** The kinds where you are shooting AT the keeper, so he has to be on screen. */
const KEEPER_MUST_BE_SEEN = new Set<ScenarioKind>([
  "one_on_one", "tight_angle", "long_range", "volley", "header",
]);
export const ZOOM_H: Record<FrameZoom, number> = { tight: 42, normal: 42, wide: 42 };

/** Defenders genuinely inside the box, by ball distance [M Table 1]. Used by
 *  the filter, not to add or remove bodies — the engine owns the count. */
export const DEFENDERS_IN_BOX: Record<DistanceBand, [number, number]> = {
  six: [4, 8], golden: [4, 8], spot: [3, 7],
  edge: [1, 6], range: [0, 4], deep: [0, 2],
};

/**
 * THE PARAMETER SPACE — one data structure, replaceable wholesale.
 */
export const PARAM_SPACE = {
  kind: [
    "one_on_one", "tight_angle", "long_range", "volley",
    "header", "cutback", "byline_cross", "through_ball",
  ] as ScenarioKind[],
  distance: ["six", "golden", "spot", "edge", "range", "deep"] as DistanceBand[],
  lateral: ["centre", "half_space", "wide", "touchline"] as LateralBand[],
  side: [-1, 1],
  engagement: ["pressed", "closing", "free"] as Engagement[],
  keeper: ["set", "stepped", "out"] as KeeperSet[],
  pattern: ["settled", "transition"] as ChancePattern[],
  // `zoom` is no longer a dimension: there is one view height (FIXED_VIEW_H)
  // and crossing it three ways only ever produced the same picture three
  // times. Kept as a single-member list rather than deleted so every existing
  // ChanceParams shape, signature and test still reads.
  zoom: ["normal"] as FrameZoom[],
  anchor: ["ball", "goal", "between"] as FrameAnchor[],
  strength: ["weak", "even", "strong"] as StrengthBand[],
  backLine: [4, 5],
} as const;

/** Spec §1's coupling table: which bands each kind can honestly occupy. */
export const COUPLING: Record<string, {
  distance: DistanceBand[];
  lateral: LateralBand[];
  keeper: KeeperSet[];
  pattern: ChancePattern[];
}> = {
  one_on_one:   { distance: ["golden", "spot", "edge"], lateral: ["centre", "half_space"], keeper: ["set", "stepped", "out"], pattern: ["settled", "transition"] },
  // Touchline dropped: at 20-31 m off centre the ball and the keeper cannot
  // both be inside one fixed 26.25 m-wide frame, and the frame is no longer
  // allowed to grow to fit them (see FIXED_VIEW_H). Measured cost of the whole
  // camera lock: 3.4% of cells, of which almost all were these.
  tight_angle:  { distance: ["six", "golden", "spot"],  lateral: ["wide"],                 keeper: ["set"],                   pattern: ["settled"] },
  long_range:   { distance: ["edge", "range"],          lateral: ["centre", "half_space", "wide"], keeper: ["set", "stepped"], pattern: ["settled", "transition"] },
  volley:       { distance: ["golden", "spot"],         lateral: ["centre", "half_space"], keeper: ["set"],                   pattern: ["settled"] },
  header:       { distance: ["six", "golden"],          lateral: ["centre", "half_space"], keeper: ["set"],                   pattern: ["settled"] },
  // A cutback is pulled back from around the corner of the six-yard box out
  // to the corner of the penalty area — NOT from the touchline. Measured with
  // touchline included, the ball averaged 20.2 m off centre against the base's
  // 11.5 m, and shooting at goal from there is close to impossible: conversion
  // 41.0% → 9.8%. Half-space + wide puts it back on the real 9-20 m range.
  cutback:      { distance: ["six"],                    lateral: ["half_space", "wide"],   keeper: ["set"],                   pattern: ["settled", "transition"] },
  byline_cross: { distance: ["six", "golden"],          lateral: ["wide", "touchline"],    keeper: ["set"],                   pattern: ["settled"] },
  through_ball: { distance: ["range", "deep"],          lateral: ["centre", "half_space", "wide"], keeper: ["stepped", "out"], pattern: ["settled", "transition"] },
};

// ── THE PLAN ────────────────────────────────────────────────────────────────

export interface ChanceParams {
  kind: ScenarioKind;
  distance: DistanceBand;
  lateral: LateralBand;
  side: -1 | 1;
  engagement: Engagement;
  keeper: KeeperSet;
  pattern: ChancePattern;
  zoom: FrameZoom;
  anchor: FrameAnchor;
  strength: StrengthBand;
  backLine: 4 | 5;
}

export interface ChancePlan {
  params: ChanceParams;
  kind: ScenarioKind;
  /** Readable, for the gallery and for hand-editing later. */
  name: string;
  /** The anti-repeat key: kind + distance + lateral + pattern. */
  signature: string;
  /** The full parameter vector, joined — a stable cell id. */
  id: string;
  /** Real world metres, computed once so applyChancePlan is deterministic. */
  ball: Vec2;
  lineY: number;
  span: number;
  blockShift: number;
  keeperY: number;
  /**
   * The formation / playstyle / strength-gap context this plan is expanded
   * against — attached by `withShape` at the call site. Absent (sandbox,
   * tests, an international fixture with nobody to scout) simply means the
   * block falls back to the same measured equations with no club-specific
   * bias, never that the plan stops working.
   */
  ctxShape?: ShapeInput | null;
}

export interface ChanceContext {
  /** Formation / playstyle / strength gap — the same input formationShape uses. */
  shape?: ShapeInput | null;
  /** The position you play, for selection weighting upstream. */
  position?: string;
}

const TITLE: Record<string, string> = {
  six: "six-yard", golden: "golden zone", spot: "penalty spot", edge: "edge of the box",
  range: "range", deep: "deep",
  centre: "central", half_space: "half-space", wide: "wide", touchline: "touchline",
  pressed: "pressed", closing: "closed down", free: "in space",
  set: "keeper set", stepped: "keeper stepped", out: "keeper out",
  tight: "tight camera", normal: "normal camera", wide2: "wide camera",
  settled: "settled", transition: "on the break",
};

function nameOf(p: ChanceParams): string {
  const kind = p.kind.replace(/_/g, " ");
  return `${kind[0].toUpperCase()}${kind.slice(1)} — ${TITLE[p.distance]}, `
    + `${p.side < 0 ? "left " : "right "}${TITLE[p.lateral]}, ${TITLE[p.engagement]}, `
    + `${TITLE[p.pattern]}, back ${p.backLine} (${p.zoom} frame)`;
}

// ── THE REALISM FILTER (spec §3, H1-H11) ────────────────────────────────────

export interface FilterRule {
  id: string;
  reason: string;
  /** True = this vector survives. Judged on the PARAMETERS. */
  test: (p: ChanceParams) => boolean;
}

/**
 * The parameter-level gate. Geometry-level faults (offside, an empty central
 * channel, a defender behind his keeper) are judged AFTER building, by
 * `planFaults` — which delegates to baseScenario.ts's `scenarioFaults` rather
 * than restating the same rules, so a base shape agreed later is picked up
 * automatically instead of contradicted here.
 */
export const FILTER_RULES: FilterRule[] = [
  {
    id: "H12-fits-the-frame",
    reason:
      "The camera never zooms, so a chance that cannot show the ball AND the keeper inside one " +
      "fixed 26.25 m-wide frame is not a picture the game can draw. Only shooting kinds need the " +
      "keeper on screen — a through ball resolves against the runner, and demanding both would " +
      "force a 40 m-plus camera on every one of them.",
    test: p => {
      if (!KEEPER_MUST_BE_SEEN.has(p.kind)) return true;
      // The keeper stands within ~2.6 m of centre; the frame is 26.25 m wide
      // and needs ~1.6 m of margin each side. So the ball can be at most
      // ~23 m off centre and still share the frame with him. "touchline"
      // reaches 33 m and cannot.
      return LATERAL_M[p.lateral][1] <= FIXED_VIEW_W - 3.2;
    },
  },
  {
    id: "H6-kind-geometry",
    reason: "No headers from 35 yards, no long-range strikes from six. Each kind only where it happens (spec §1 coupling table).",
    test: p => {
      const c = COUPLING[p.kind];
      return !!c && c.distance.includes(p.distance) && c.lateral.includes(p.lateral);
    },
  },
  {
    id: "H7-keeper-kind",
    reason: "A keeper rushing out is a one-on-one or a through ball, not a corner-flag cross.",
    test: p => (COUPLING[p.kind]?.keeper ?? []).includes(p.keeper),
  },
  {
    id: "H11-recovery-plausibility",
    reason: "A broken block and a whipped cross do not coexist — transition is never rolled for a header, volley or tight angle.",
    test: p => (COUPLING[p.kind]?.pattern ?? []).includes(p.pattern),
  },
  {
    id: "H5-lane-sanity",
    reason: "A presser is never inside the shot cone at close range (the volley-into-shins bug): pressed is only real from the edge out, or wide.",
    test: p => p.engagement !== "pressed"
      || p.distance === "edge" || p.distance === "range" || p.distance === "deep"
      || p.lateral === "wide" || p.lateral === "touchline",
  },
  {
    id: "H2-through-is-open",
    reason: "A one-on-one means only the keeper to beat. Being pressed is a different chance.",
    test: p => p.kind !== "one_on_one" || p.engagement !== "pressed",
  },
  {
    id: "back5-is-a-block",
    reason: "A back five defends deep and in numbers — not the shape a side caught in transition is standing in.",
    test: p => p.backLine !== 5 || p.pattern !== "transition",
  },
  {
    id: "strength-picks-a-shape",
    reason: "The stronger side pushes up and presses; the weaker side drops off. A heavy underdog pressing high, or a favourite giving you the freedom of the edge of its box, is not what the research shows.",
    test: p => !(p.strength === "weak" && p.engagement === "pressed")
      && !(p.strength === "strong" && p.engagement === "free" && (p.distance === "six" || p.distance === "golden")),
  },
  {
    id: "camera-frames-the-action",
    reason: "A tight frame anchored on the goal loses a ball struck from range; a wide frame on a six-yard scramble is all empty grass.",
    test: p => !(p.zoom === "tight" && p.anchor === "goal" && (p.distance === "range" || p.distance === "deep"))
      && !(p.zoom === "wide" && p.anchor === "ball" && p.distance === "six"),
  },
];

// ── GENERATION ──────────────────────────────────────────────────────────────

export interface GenerationReport {
  crossings: number;
  survivors: number;
  rejectedBy: Record<string, number>;
  byKind: Record<string, number>;
}

let CACHE: { plans: ChancePlan[]; report: GenerationReport } | null = null;

function paramsOf(v: ChanceParams): ChancePlan {
  // Deterministic representative geometry for the cell — the mid-point of each
  // band. `applyChancePlan` jitters inside the band with the scenario's own rng.
  const [dLo, dHi] = DISTANCE_M[v.distance];
  const [xLo, xHi] = LATERAL_M[v.lateral];
  const by = (dLo + dHi) / 2;
  const bx = clamp(CX + v.side * ((xLo + xHi) / 2), 1, PITCH_W - 1);
  return {
    params: v,
    kind: v.kind,
    name: nameOf(v),
    signature: `${v.kind}|${v.distance}|${v.lateral}|${v.pattern}`,
    id: [v.kind, v.distance, v.lateral, v.side > 0 ? "R" : "L", v.engagement, v.keeper,
      v.pattern, v.zoom, v.anchor, v.strength, `b${v.backLine}`].join("|"),
    ball: { x: bx, y: by },
    lineY: by * 0.66,
    span: clamp(16 + by * 0.22, 16, 25) * (v.backLine === 5 ? 1.28 : 1),
    blockShift: clamp((bx - CX) * 0.4, -8, 8),
    keeperY: (KEEPER_M[v.keeper][0] + KEEPER_M[v.keeper][1]) / 2,
  };
}

/** Cross every dimension, filter for football sense, keep the survivors. */
export function generateSpace(): { plans: ChancePlan[]; report: GenerationReport } {
  if (CACHE) return CACHE;
  const plans: ChancePlan[] = [];
  const rejectedBy: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const r of FILTER_RULES) rejectedBy[r.id] = 0;
  let crossings = 0;

  for (const kind of PARAM_SPACE.kind)
  for (const distance of PARAM_SPACE.distance)
  for (const lateral of PARAM_SPACE.lateral)
  for (const side of PARAM_SPACE.side)
  for (const engagement of PARAM_SPACE.engagement)
  for (const keeper of PARAM_SPACE.keeper)
  for (const pattern of PARAM_SPACE.pattern)
  for (const zoom of PARAM_SPACE.zoom)
  for (const anchor of PARAM_SPACE.anchor)
  for (const strength of PARAM_SPACE.strength)
  for (const backLine of PARAM_SPACE.backLine) {
    crossings++;
    const v: ChanceParams = {
      kind, distance, lateral, side: side as -1 | 1, engagement, keeper,
      pattern, zoom, anchor, strength, backLine: backLine as 4 | 5,
    };
    let rejected = "";
    for (const rule of FILTER_RULES) if (!rule.test(v)) { rejected = rule.id; break; }
    if (rejected) { rejectedBy[rejected]++; continue; }
    plans.push(paramsOf(v));
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }

  CACHE = { plans, report: { crossings, survivors: plans.length, rejectedBy, byKind } };
  return CACHE;
}

export function allPlans(): ChancePlan[] { return generateSpace().plans; }

/**
 * Pick a plan for this request. Returns null — and the caller falls through to
 * today's untouched path — for anything the formula has no cell for (a dead
 * ball, a dribble, a build-up, a zone with no attacking geometry).
 */
export function generateChance(
  req: Pick<ScenarioRequest, "zone" | "kinds" | "lane" | "pattern">,
  ctx: ChanceContext,
  rng: () => number,
  recent: string[] = [],
): ChancePlan | null {
  const bands = ZONE_BANDS[req.zone] ?? [];
  if (bands.length === 0) return null;
  const wantPattern: ChancePattern = req.pattern === "transition" ? "transition" : "settled";
  const laneSide: -1 | 0 | 1 = req.lane === "left" ? -1 : req.lane === "right" ? 1 : 0;

  const pool = allPlans().filter(p =>
    req.kinds.includes(p.kind)
    && bands.includes(p.params.distance)
    && p.params.pattern === wantPattern
    && (laneSide === 0
      ? p.params.lateral === "centre" || p.params.lateral === "half_space"
      : p.params.side === laneSide));
  if (pool.length === 0) return null;

  // §4.3 anti-repeat: identical to any of the last 3 is rejected outright,
  // then up to 4 redraws before accepting whatever comes up.
  const banned = new Set(recent.slice(0, 3));
  const fresh = pool.filter(p => !banned.has(p.signature));
  // When the last three have used up a narrow pool, relax to forbidding only
  // the one you were JUST shown — never fall all the way back to the whole
  // pool, which re-admits it. Measured with the full fallback: 2 immediate
  // repeats in 428 consecutive box chances, and redrawing 4 times cannot help
  // when the pool it is drawing from has one member.
  let from = fresh;
  if (from.length === 0) {
    const prev = recent[0];
    from = pool.filter(p => p.signature !== prev);
    // Some kinds have exactly ONE cell in a given zone and lane — a cutback in
    // the centre lane is only ever `cutback|six|half_space|settled` — so when
    // that one cell is also the one you were just shown, there is no variant
    // left to offer. Returning null hands the chance to the untouched path
    // rather than serving the same picture twice running, which is the thing
    // this whole mechanism exists to prevent.
    if (from.length === 0) return null;
  }
  let best = pick(rng, from);
  for (let i = 0; i < 4; i++) {
    if (!recent.slice(0, 1).includes(best.signature)) break;
    best = pick(rng, from);
  }
  return best;
}

/** Which distance bands each hidden-match zone can put the ball in. */
export const ZONE_BANDS: Record<string, DistanceBand[]> = {
  box: ["six", "golden", "spot"],
  attacking: ["spot", "edge", "range"],
  middle: ["range", "deep"],
  defensive: [],
  own_box: [],
};

// ── APPLYING A PLAN ─────────────────────────────────────────────────────────

const VIEW_ASPECT = 5 / 8;
const INSET = 1.4;

/**
 * The base's own identity limits, mirroring `identityFault` in baseScenario.ts.
 * Where a parameter band is wider than the base's definition, the definition
 * wins — that is what "the base is the input" means in practice. These are the
 * one place this file restates a base rule, and they exist only so the ball is
 * GENERATED legal rather than flagged afterwards.
 */
const KIND_BALL_LIMITS: Partial<Record<ScenarioKind, [number, number]>> = {
  header: [1, 8],
  volley: [4, 18],
  tight_angle: [1, 15],
  long_range: [17.5, 38],
  cutback: [1, 6],
  byline_cross: [1, 6],
  through_ball: [20.5, 38],
};
const KIND_MIN_LATERAL: Partial<Record<ScenarioKind, number>> = {
  tight_angle: 9.5, cutback: 8.5, byline_cross: 8.5,
};

/** The kinds where YOU are the one shooting at goal — the only ones that
 *  require the keeper to be inside the frame. */
const SHOOTER_KINDS = new Set<ScenarioKind>(["one_on_one", "tight_angle", "long_range", "volley", "header"]);

/** A box scene, defended in zones, rather than a block defended in a line. */
const BOX_KINDS = new Set<ScenarioKind>(["cutback", "byline_cross", "header", "volley", "tight_angle"]);
function isBoxChance(kind: ScenarioKind, band: DistanceBand): boolean {
  return BOX_KINDS.has(kind) || band === "six" || band === "golden";
}

/**
 * The camera, as a real independent dimension (the owner's correction).
 *
 * Frames a SLICE of the world shape. Nothing is forced into it: a zoomed-in
 * left-wing chance showing a left-back, a centre-back and your striker is the
 * intended picture. The only guarantee is that the ball, you, the keeper (when
 * the goal is in frame) and the pass target are inside it — everyone else may
 * legitimately be off screen and still exists for the engine, which reads world
 * positions (the offside line is the second-last defender whether or not he is
 * drawn).
 */
export function frameFor(plan: ChancePlan, ball: Vec2, keeper?: { x: number; y: number } | null): Viewport {
  // REVERTED 21 Sep 2026 — see the CAMERA_MOVES_PLAYERS note in canvasEngine.ts.
  // This briefly fitted the frame to the situation within a 28-42 m band. On the
  // path the real match actually uses that dropped "goal fully in shot" from
  // 83.4% to 63.9%, and a tight angle from 57% to zero.
  const h = ZOOM_H[plan.params.zoom];
  const w = h * VIEW_ASPECT;
  const anchorY = plan.params.anchor === "ball" ? ball.y
    : plan.params.anchor === "goal" ? 0
    : (ball.y + 0) / 2;
  const anchorX = plan.params.anchor === "goal" ? CX
    : plan.params.anchor === "ball" ? ball.x
    : (ball.x + CX) / 2;
  let y1 = anchorY - h * 0.55, y2 = y1 + h;
  let x1 = anchorX - w / 2, x2 = x1 + w;
  const padX = 6, backPad = NET_DEPTH + 2.5, fwdPad = 6;
  if (x1 < -padX) { const s = -padX - x1; x1 += s; x2 += s; }
  if (x2 > PITCH_W + padX) { const s = x2 - (PITCH_W + padX); x1 -= s; x2 -= s; }
  if (y1 < -backPad) { const s = -backPad - y1; y1 += s; y2 += s; }
  if (y2 > HALF_LEN + fwdPad) { const s = y2 - (HALF_LEN + fwdPad); y1 -= s; y2 -= s; }
  // The camera MOVES to hold the ball; the ball is never dragged to the camera.
  // (Doing it the other way round pulled a touchline chance back toward the
  // middle and quietly turned a tight angle into a central one.)
  const need = 2.2;
  if (ball.x < x1 + need) { const s = x1 + need - ball.x; x1 -= s; x2 -= s; }
  if (ball.x > x2 - need) { const s = ball.x - (x2 - need); x1 += s; x2 += s; }
  if (ball.y < y1 + need) { const s = y1 + need - ball.y; y1 -= s; y2 -= s; }
  // The ball also keeps out of the bottom fifth — the room the aim drag needs.
  const floor = y2 - (y2 - y1) * 0.22;
  if (ball.y > floor) { const s = ball.y - floor; y1 += s; y2 += s; }
  // You must be able to see the man you are shooting past. Everyone else may
  // legitimately be off screen; the keeper, when the goal is the target, may
  // not.
  //
  // THE CAMERA SLIDES TO HIM — IT NEVER GROWS TO FIT HIM. This block used to
  // widen the rectangle (and rescale its height to keep the aspect), which is
  // a zoom by another name and is half of "the goal can be different sizes".
  // Measured: 10.0% of chances grew this way, on top of the 69.2% that were
  // already framed at something other than 42 m.
  //
  // The ball outranks the keeper, so its own constraints are re-applied after
  // this — a camera that slid so far to catch a keeper that it lost the ball
  // would have framed the wrong thing entirely.
  if (keeper) {
    if (keeper.x < x1 + 1.6) { const s = x1 + 1.6 - keeper.x; x1 -= s; x2 -= s; }
    else if (keeper.x > x2 - 1.6) { const s = keeper.x - (x2 - 1.6); x1 += s; x2 += s; }
    if (keeper.y < y1 + 1.2) { const s = y1 + 1.2 - keeper.y; y1 -= s; y2 -= s; }
  }

  // The ball has the last word, always.
  if (ball.x < x1 + need) { const s = x1 + need - ball.x; x1 -= s; x2 -= s; }
  if (ball.x > x2 - need) { const s = ball.x - (x2 - need); x1 += s; x2 += s; }
  if (ball.y < y1 + need) { const s = y1 + need - ball.y; y1 -= s; y2 -= s; }
  const floor2 = y2 - (y2 - y1) * 0.22;
  if (ball.y > floor2) { const s = ball.y - floor2; y1 += s; y2 += s; }

  return { x1, x2, y1, y2 };
}

/**
 * Write the plan's WORLD geometry onto a base Scenario, then frame it.
 *
 * The base must have been built by the real engine (`buildScenario(plan.kind,…)`)
 * and repaired by `fixBaseScenario`. This never constructs a Scenario and only
 * writes public fields. Order matters and is the offside fix: the block is
 * placed first, attackers second, camera last.
 */
export function applyChancePlan(sc: Scenario, plan: ChancePlan, rng: () => number = Math.random): void {
  const p = plan.params;
  const turned = sc.facing === "left" || sc.facing === "right";

  // ── 1. The ball, from the distance × lateral bands ──
  const [dLo, dHi] = DISTANCE_M[p.distance];
  const [xLo, xHi] = LATERAL_M[p.lateral];
  // The BASE's own definition wins over the band where the two overlap — a
  // header is met inside eight metres however wide the "golden zone" band is,
  // and a tight angle is inside fifteen. Read straight off baseScenario.ts's
  // identityFault rather than restated as a second set of numbers.
  const [kLo, kHi] = KIND_BALL_LIMITS[sc.kind] ?? [0, 60];
  const by = clamp(U(rng, dLo + 0.5, dHi - 0.5), kLo, kHi);
  const latMin = KIND_MIN_LATERAL[sc.kind] ?? 0;
  const bx = clamp(CX + p.side * Math.max(latMin, U(rng, xLo, xHi)), 1.5, PITCH_W - 1.5);

  if (!turned) {
    const dx = sc.player.x - sc.ball.x, dy = sc.player.y - sc.ball.y;
    sc.ball = { x: bx, y: by };
    sc.player = { x: clamp(bx + dx, 1, PITCH_W - 1), y: Math.max(0.4, by + dy) };
  }
  const ballX = sc.ball.x, ballY = sc.ball.y;
  const ballDist = clamp(ballY, 2, 45);

  // ── 2. The block, in WORLD space — the whole shape, not a framed subset ──
  //
  // targetBlock (formationShape.ts) owns the measured line/span/shift when a
  // real opponent is known; without one (sandbox, tests) the same equations
  // run off the plan's own back-line count. Either way the block is placed
  // across the real pitch, and the camera decides how much of it is seen.
  const shaped = plan.ctxShape ? targetBlock(plan.ctxShape, ballX, ballY) : null;
  // `onTheBoxEdge` applies to BOTH paths: targetBlock has already applied it
  // when a formation was supplied, and it is idempotent, so calling it again
  // here costs nothing and means the no-formation path cannot drift from the
  // shaped one. That drift is exactly what made the first version of this fix
  // measure as a no-op — the gallery never passes a formation.
  const rawLineY = clamp(shaped ? shaped.lineY : ballDist * 0.66, 3.2, Math.max(4, ballDist - 2.0));
  const lineY = onTheBoxEdge(rawLineY, ballDist, 3.2);
  const span = shaped ? shaped.span : clamp(16 + ballDist * 0.22, 16, 25) * (p.backLine === 5 ? 1.28 : 1);
  const shift = shaped ? shaped.blockShift : clamp((ballX - CX) * 0.4, -8, 8);

  const n = sc.defenders.length;
  if (n > 0 && !turned) {
    const backN = Math.min(n, p.backLine);
    // H10 [M Table 2b]: adjacent back-line gaps sit at 5.1-8.0 m. The SPAN is
    // what gives, never the number of men — a scenario with two defenders in it
    // is two men holding a normal gap, not two men stretched across the span a
    // back four would cover. (Measured: without this, a two-man line at range
    // opened a 21 m hole, which is exactly the "gap like that in the box" the
    // owner sent a screenshot of.)
    const gap = clamp(span / Math.max(1, p.backLine - 1), 3.2, 8.6);
    const useSpan = gap * Math.max(1, backN - 1);
    if (p.pattern === "transition") {
      // [M Table 6] a genuine counter has a median of 1 defender in the box:
      // most men are RECOVERING behind the ball, not screening in front of it.
      const keep = Math.max(1, Math.min(n, 2));
      for (let i = 0; i < n; i++) {
        const d = sc.defenders[i];
        if (i < keep) {
          const frac = keep <= 1 ? 0.5 : i / (keep - 1);
          d.x = clamp(CX + shift + (frac - 0.5) * gap * Math.max(1, keep - 1) * 1.3, 2, PITCH_W - 2);
          d.y = clamp(lineY + U(rng, -3, 3), 3.0, Math.max(3.5, ballDist - 1.4));
        } else {
          // Behind the ball, and never inside the shooting cone.
          const s: -1 | 1 = rng() < 0.5 ? -1 : 1;
          d.x = clamp(ballX + s * U(rng, 3, 7), 2, PITCH_W - 2);
          d.y = ballY + U(rng, 3, 8);
        }
      }
    } else if (isBoxChance(sc.kind, p.distance)) {
      // ── SETTLED BOX CHANCE (spec §2.3) — THE "far too open in the box" FIX ──
      //
      // A box scene is not a back line. Real defenders occupy ZONES: the near
      // post, the man on the ball's end point, the penalty spot (T4: 1.46
      // defenders per shot, the densest zone [M]), the far post, the second six
      // (1.72 [M]), and the edge. Placing a flat line across a byline chance
      // instead put bodies straight across the shot: measured, it sent the
      // blocked rate on a tight angle from 11.0% to 67.3%.
      const slots: Vec2[] = [
        { x: CX + p.side * U(rng, 2.5, 3.6), y: U(rng, 1.0, 3.0) },                 // near post
        { x: clamp(sc.player.x + p.side * U(rng, 0.5, 1.5), 3, PITCH_W - 3),
          y: Math.max(0.8, sc.player.y - U(rng, 0.5, 1.5)) },                       // marking you
        { x: CX + p.side * U(rng, 0, 2), y: U(rng, 9, 11.5) },                      // the spot
        { x: CX - p.side * U(rng, 3.0, 4.5), y: U(rng, 2, 5) },                     // far post
        { x: CX + p.side * U(rng, 3, 6), y: U(rng, 12, 15) },                       // second six
        { x: CX - p.side * U(rng, 0, 4), y: U(rng, 6, 9) },                         // second marker
        { x: CX + U(rng, -5, 5), y: U(rng, 16.5, 19) },                             // the edge
      ];
      // …with one measured exception. A tight angle and a cutback are BOTH
      // struck from the near-post corner, so a man standing on that post is
      // standing in the only line the chance has: measured, filling it sent
      // the blocked rate to 62.2% and 48.4% against a 11.0%/5.2% baseline,
      // which is a difficulty change by the back door — exactly what spec §5
      // forbids. For those two kinds the near-post slot is the keeper's job
      // and the defenders take the other zones.
      const useSlots = (sc.kind === "tight_angle" || sc.kind === "cutback") ? slots.slice(1) : slots;
      for (let i = 0; i < n; i++) {
        const s = useSlots[i % useSlots.length];
        sc.defenders[i].x = clamp(s.x, 2, PITCH_W - 2);
        sc.defenders[i].y = clamp(s.y, 1.0, 20);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const d = sc.defenders[i];
        if (i < backN) {
          const frac = backN <= 1 ? 0.5 : i / (backN - 1);
          const fromCentre = Math.abs(frac - 0.5) * 2;
          d.x = clamp(CX + shift + (frac - 0.5) * useSpan, 2, PITCH_W - 2);
          d.y = clamp(lineY - 1.2 + fromCentre * 2.4, 3.0, Math.max(3.5, ballDist - 1.4));
        } else {
          // A screening midfielder ahead of the line, ball-side in a wide
          // chance ("the cutback zone is the DM's").
          const wideChance = p.lateral === "wide" || p.lateral === "touchline";
          d.x = clamp(CX + shift * 0.6 + (wideChance ? p.side * 4 : U(rng, -3, 3)), 2, PITCH_W - 2);
          d.y = clamp(lineY + U(rng, 3, 7), 3.5, Math.max(4, ballDist - 1.2));
        }
      }
    }
    // The nearest man is where the ENGAGEMENT dimension actually lands: on the
    // line between the ball and the goal at the band's own distance, shown
    // outside when you are central and inside when you are wide [C].
    if (p.engagement !== "free") {
      const e = U(rng, ENGAGE_M[p.engagement][0], ENGAGE_M[p.engagement][1]);
      const toGoalX = CX - ballX, toGoalY = -ballY;
      const len = Math.hypot(toGoalX, toGoalY) || 1;
      const showSide = (p.lateral === "centre" || p.lateral === "half_space") ? p.side : -p.side as -1 | 1;
      // Nearest man to the ball takes the job, so the count never changes.
      let near = sc.defenders[0];
      for (const d of sc.defenders) {
        if (Math.hypot(d.x - ballX, d.y - ballY) < Math.hypot(near.x - ballX, near.y - ballY)) near = d;
      }
      near.x = clamp(ballX + (toGoalX / len) * e + showSide * 1.2, 2, PITCH_W - 2);
      near.y = clamp(ballY + (toGoalY / len) * e, 1.2, Math.max(1.5, ballY - 0.8));
    }
  }

  // ── 3. The keeper [M Table 5] ──
  //
  // §2.4, honoured: a one-on-one and a tight angle KEEP the engine's own
  // stance logic, because in those two the keeper's position IS the chance —
  // the engine's tuned 24/16/60 rush/stay/shade roll, not a uniform draw.
  //
  // Measured, overwriting it: one-on-one conversion 26.4% → 9.8% with the
  // blocked rate still at 0.0%, i.e. nothing was in the way and the keeper was
  // simply always perfectly positioned. That single line was most of this
  // layer's headline "it halves conversion".
  const KEEPER_IS_THE_CHANCE = sc.kind === "one_on_one" || sc.kind === "tight_angle";
  if (!turned && !KEEPER_IS_THE_CHANCE) {
    const kY = U(rng, KEEPER_M[p.keeper][0], KEEPER_M[p.keeper][1]);
    sc.keeper.y = clamp(kY, 0.5, Math.max(0.6, ballY - 1.5));
    // ONLY HIS DEPTH. How far off his line he has set himself is the
    // interesting, measured variety [M Table 5] and it is what this layer is
    // for. His SIDEWAYS position is left exactly as the engine placed it.
    //
    // Measured, taking that over too with the spec's own shade
    // (x = CX + 0.28 × ball lateral, itself a real measurement): a keeper
    // that well centred on every single chance sent headers from 16.3% to
    // 6.4% and cutbacks from 41.0% to 9.8% with almost none of it blocked —
    // he was simply always in the right place. The engine's finishing model
    // is tuned against the engine's OWN keeper placement, so replacing it
    // with a different-but-also-real one re-tunes the game by the back door.
    // That is the "only ever ADD to gameplay, never change it" rule.
  }

  // ── 3b. Nobody piled on the ball or on you, and the middle is covered ──
  if (!turned) tidyBlock(sc, p);

  // ── 4. The attackers — AFTER the line, which is what keeps them onside ──
  placeAttackers(sc, p, rng);

  // ── 5. The camera, last: it frames the shape, it never changes it ──
  if (!turned) {
    // The keeper only has to be on screen for a chance YOU shoot at goal. A
    // through ball from 35 m resolves against the runner, and demanding both
    // the ball and the keeper in one frame would force a 40 m-plus camera on
    // every one of them — which is exactly the "the whole formation doesn't
    // have to be on screen" the owner ruled out.
    sc.viewport = frameFor(plan, sc.ball, SHOOTER_KINDS.has(sc.kind) ? sc.keeper : null);
    const vp = sc.viewport;
    const fx = (x: number) => clamp(x, vp.x1 + INSET, vp.x2 - INSET);
    const fy = (y: number) => clamp(y, Math.max(vp.y1 + INSET, 0.3), vp.y2 - INSET);
    // The ball is NOT clamped — frameFor already moved the camera to hold it,
    // and clamping it here was quietly dragging a 32 m through-ball back to 25.
    sc.player = { x: fx(sc.player.x), y: fy(sc.player.y) };
    if (goalInView(sc.kind)) {
      sc.keeper.x = fx(sc.keeper.x);
      sc.keeper.startX = sc.keeper.x;
    }
    if (sc.runner) {
      sc.runner.pos = { x: fx(sc.runner.pos.x), y: fy(sc.runner.pos.y) };
      sc.runner.to = { x: fx(sc.runner.to.x), y: fy(sc.runner.to.y) };
      sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };
    }
  }

  // ── 6. The base's own rules get the last word ──
  //
  // fixBaseScenario (baseScenario.ts) repairs the kind's DEFINING property and
  // the universal illegalities. Running it last means a base shape agreed later
  // automatically wins over anything this layer did, which is the whole point
  // of the base being the input.
  fixBaseScenario(sc);
  // …and its own repairs can put a man back on top of the ball (measured: 155
  // of 19,636 cells), so the anti-pile-up pass runs once more after it.
  if (!turned) { tidyBlock(sc, p); fixBaseScenario(sc); }
  spaceOut(sc);
}

/**
 * The last word on the block: nobody standing on the ball or on you, nobody
 * goal-side of his own keeper, and — with the ball in or near the box — never
 * an empty central channel. Same three rules `formationShape.ts` enforces;
 * run here because the block layer is deliberately skipped when a plan applied.
 */
/**
 * H10 [M Table 2b]: no adjacent back-line gap over ~10 m. Pulls the two men
 * either side of a hole toward each other — never drops or adds a body, which
 * is the engine's own count to own.
 */
function closeTheLine(sc: Scenario): void {
  if (sc.defenders.length < 2) return;
  const deepest = Math.min(...sc.defenders.map(d => d.y));
  const line = sc.defenders.filter(d => d.y - deepest <= 4).sort((a, b) => a.x - b.x);
  for (let i = 1; i < line.length; i++) {
    if (line[i].x - line[i - 1].x <= 10) continue;
    const mid = (line[i].x + line[i - 1].x) / 2;
    line[i - 1].x = clamp(mid - 4.6, 1.5, PITCH_W - 1.5);
    line[i].x = clamp(mid + 4.6, 1.5, PITCH_W - 1.5);
  }
}

/**
 * How close to the line of the shot a defender has to be before he counts as
 * standing in it. THE difficulty dial of this whole layer: every metre of it
 * is a defender who either blocks the shot or steps aside for it. 1.8 m is
 * about a body's width either side of the ball's path.
 */
const SHOT_LANE_R = 1.8;

function tidyBlock(sc: Scenario, p: ChanceParams): void {
  const CLEAR_BALL = 2.0, CLEAR_YOU = 1.8;
  closeTheLine(sc);
  for (let pass = 0; pass < 3; pass++) {
    for (const d of sc.defenders) {
      d.y = Math.max(d.y, sc.keeper.y + 2.0);
      const push = (to: Vec2, want: number) => {
        const dx = d.x - to.x, dy = d.y - to.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= want) return;
        const ux = dist > 0.01 ? dx / dist : (d.x >= CX ? 1 : -1), uy = dist > 0.01 ? dy / dist : 1;
        d.x = clamp(to.x + ux * want, 1.5, PITCH_W - 1.5);
        d.y = Math.max(to.y + uy * want, sc.keeper.y + 2.0);
      };
      push(sc.ball, CLEAR_BALL);
      push(sc.player, CLEAR_YOU);
    }
  }

  // H5, and the single most expensive thing this layer can get wrong.
  //
  // Measured before this existed: putting the engagement man on the ball→goal
  // line sent the blocked rate from 11.0% to 73.7% on a tight angle and 5.2%
  // to 56.6% on a cutback — the "volley into the shins" the spec names, and a
  // difficulty change by the back door. A defender showing you a side stands
  // BESIDE the lane, not in it; anyone the placement left inside the cone and
  // close to the ball steps out of it.
  // H2 FIRST, THEN THE LANE. Filling the central channel moves a man to the
  // middle, and from a cutback or a tight angle the middle IS the shot — so
  // doing it after the lane clearing quietly undid the clearing. Measured
  // that way round: capping the lane moved a cutback's blocked rate by 0.0 pp.
  //
  // A one-on-one and a through ball are DEFINED by the middle being open —
  // baseScenario.ts exempts them, and so does this.
  const skipChannel = sc.kind === "one_on_one" || sc.kind === "through_ball";
  if (!skipChannel && sc.ball.y <= 24 && sc.defenders.length > 0) coverCentre(sc);

  //
  // H5, and the single most expensive thing this layer can get wrong.
  //
  // Measured before this existed: putting the engagement man on the ball→goal
  // line sent the blocked rate from 11.0% to 73.7% on a tight angle and 5.2%
  // to 56.6% on a cutback — the "volley into the shins" the spec names, and a
  // difficulty change by the back door. A defender showing you a side stands
  // BESIDE the lane, not in it.
  //
  // Two corrections on the first version of this, both measured:
  //
  //  - THE RADIUS WAS TOO SMALL. It only cleared men within 6.5 m of the ball.
  //    A tight angle's cone is long and thin down the byline and a through
  //    ball's is 30 m deep, so a defender well outside that circle was still
  //    standing squarely in the shot. Blocked rose on exactly those kinds
  //    (through_ball 8.9% → 21.0%, tight_angle 11.0% → 25.7%).
  //
  //  - A RADIUS IS THE WRONG RULE ANYWAY. H5's own rule is a COUNT — at most
  //    three opponents in the lane [M Table 3, p75 = 2] — so that is what is
  //    enforced, with the men nearest the shot moving out first so the picture
  //    keeps its depth rather than being swept clean.
  //  - AND THE CONE ITSELF IS THE WRONG TEST FOR A SHALLOW SHOT. The triangle
  //    from ball to posts is a SLIVER near its own apex, so a man level with
  //    the ball and 2.4 m to the side reads as "not in the way" — while a
  //    cutback struck from the byline travels sideways across the box and
  //    flies straight past him. Measured: of 300 cutbacks, `inShotCone` found
  //    0 defenders in the way; 223 of them had a man within 1.5 m of the line
  //    the ball actually travels, and 156 of 157 real blocks were one of those
  //    men. So the test is distance to the SHOT LINE, which is right for a
  //    shallow shot and a straight one alike.
  const origin = sc.ball;
  const GOAL_MOUTH: Vec2 = { x: CX, y: 0 };
  /** How far this man is from the line the ball will actually travel. */
  const offLine = (d: Vec2): number => {
    const vx = GOAL_MOUTH.x - origin.x, vy = GOAL_MOUTH.y - origin.y;
    const len2 = vx * vx + vy * vy || 1;
    let t = ((d.x - origin.x) * vx + (d.y - origin.y) * vy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(d.x - (origin.x + vx * t), d.y - (origin.y + vy * t));
  };
  /** In the way of the shot: on its line, or inside the cone to the posts. */
  const inTheWay = (d: Vec2) => offLine(d) < SHOT_LANE_R || inShotCone(sc, d);
  const stepOut = (d: Vec2) => {
    // Perpendicular to the shot, on the side he is already on — a defender
    // showing you a side stands BESIDE the lane, he does not back away down it.
    const vx = GOAL_MOUTH.x - origin.x, vy = GOAL_MOUTH.y - origin.y;
    const nlen = Math.hypot(-vy, vx) || 1;
    const nx = -vy / nlen, ny = vx / nlen;
    let guard = 0;
    while (inTheWay(d) && guard++ < 12) {
      let t = ((d.x - origin.x) * vx + (d.y - origin.y) * vy) / ((vx * vx + vy * vy) || 1);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const sign = ((d.x - (origin.x + vx * t)) * nx + (d.y - (origin.y + vy * t)) * ny) >= 0 ? 1 : -1;
      d.x = clamp(d.x + sign * nx * 0.9, 1.5, PITCH_W - 1.5);
      d.y = Math.max(d.y + sign * ny * 0.9, sc.keeper.y + 2.0);
    }
  };
  // H5, LITERALLY: nobody is standing ON you as you strike it. Only the men
  // within 3.5 m of the ball — the "volley into the shins" the spec names.
  //
  // Measured sweeping the whole lane clean instead: blocked fell to 0.3% on a
  // volley and 0.4% on a cutback, against a base of 17.8% and 5.2%. A shot
  // that can never be blocked is as wrong as one that always is, and it is a
  // difficulty change by the back door in the other direction.
  for (const d of sc.defenders) {
    if (Math.hypot(d.x - origin.x, d.y - origin.y) > 3.5) continue;
    stepOut(d);
  }
  // AND NOBODY STANDS LITERALLY ON THE LINE OF THE SHOT, at any distance.
  //
  // The cone to the posts is a wide triangle and legitimately holds bodies —
  // that is depth, and the cap below is what limits it. The LINE is a metre
  // and a bit either side of where the ball will actually travel, and a man
  // standing there is not defending, he is a wall. Measured on a through ball
  // once the camera stopped zooming out: 210 of 212 blocks had a defender on
  // that line at the moment of the kick, against 50 of 50 in the base — the
  // count cap alone could not fix it, because a cap of two still leaves two
  // men standing directly in front of you.
  // SCOPED to the two kinds that are DEFINED by being through. Applied to
  // every kind it was far too strong — measured, it sent blocked to 0.3% on a
  // cutback and 3.1% on a long-range shot against bases of 5.2% and 34.6%. A
  // shot that can never be blocked is as wrong as one that always is, and
  // this file has now made that mistake in both directions. A man standing in
  // the cone is depth and stays; a man standing in the lane of a ball played
  // THROUGH the line contradicts the chance itself.
  if (sc.kind === "through_ball" || sc.kind === "one_on_one") {
    for (const d of sc.defenders) if (offLine(d) < SHOT_LANE_R) stepOut(d);
  }
  // Beyond that the lane simply has a ceiling [M Table 3: p75 = 2 opponents in
  // the lane, 98% ≤ 3]. The men nearest the shot move out first, so what is
  // left is depth rather than a wall on the ball.
  // TWO inside the box, and two for a through ball as well: being played in
  // BEHIND the line is the whole chance, so three bodies across the lane
  // contradicts the situation rather than defending it. Measured with a cap
  // of 3 there, once the camera stopped zooming out: blocked 23.8% -> 29.1%,
  // past the +16 pp bar. Everywhere else three stands [M Table 3, 98% <= 3].
  const laneCap = (sc.ball.y <= 16.5 || sc.kind === "through_ball") ? 2 : 3;
  const laneMen = sc.defenders.filter(inTheWay);
  if (laneMen.length > laneCap) {
    laneMen
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
      .slice(0, laneMen.length - laneCap)
      .forEach(stepOut);
  }

}

/**
 * Nobody piled on the ball or standing on you — run as the VERY LAST thing,
 * after every other repair including fixBaseScenario's own, because those can
 * legitimately move a man back on top of something. Measured with this inside
 * tidyBlock instead, where fixBaseScenario still had the last word: 3 cells in
 * 6,612 still had a defender on the ball or on the player.
 */
export function spaceOut(sc: Scenario): void {
  for (let pass = 0; pass < 3; pass++) {
    for (const d of sc.defenders) {
      d.y = Math.max(d.y, sc.keeper.y + 2.0);
      const push = (to: Vec2, want: number) => {
        const dx = d.x - to.x, dy = d.y - to.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= want) return;
        const ux = dist > 0.01 ? dx / dist : (d.x >= CX ? 1 : -1), uy = dist > 0.01 ? dy / dist : 1;
        d.x = clamp(to.x + ux * want, 1.5, PITCH_W - 1.5);
        d.y = Math.max(to.y + uy * want, sc.keeper.y + 2.0);
      };
      push(sc.ball, 2.0);
      push(sc.player, 1.8);
    }
  }
}

/**
 * H2: with the ball in or near the box, the central channel is never empty —
 * the "far too open in the box" screenshot as one rule. Same shape the block
 * layer enforces, kept local because that layer is deliberately skipped
 * whenever a chance plan has placed the picture itself.
 */
function coverCentre(sc: Scenario): void {
  if (sc.defenders.some(d => Math.abs(d.x - CX) <= 6.4)) return;
  let best = sc.defenders[0];
  for (const d of sc.defenders) if (Math.abs(d.x - CX) < Math.abs(best.x - CX)) best = d;
  best.x = CX + (best.x >= CX ? 1 : -1) * 3.5;
}

/**
 * Where your team-mates stand. §C3's lane rule, applied literally: for a shot
 * from ≥14 m nobody is parked inside the ball→posts triangle.
 */
function placeAttackers(sc: Scenario, p: ChanceParams, rng: () => number): void {
  const runners: Runner[] = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
  if (runners.length === 0) return;
  const side = p.side;
  const bd = sc.ball.y;

  // Zone fill by kind — [M Table 4] near post 0.56 vs far post 0.15 on crosses.
  const spots: Vec2[] = [];
  if (p.kind === "cutback") {
    spots.push({ x: CX + U(rng, -3, 3), y: U(rng, 8, 12) });            // second six
    spots.push({ x: CX + U(rng, -1.5, 1.5), y: U(rng, 9, 11.5) });      // the spot
    spots.push({ x: CX - side * U(rng, 0, 4), y: U(rng, 16.5, 19) });   // edge
  } else if (p.kind === "byline_cross" || p.kind === "header" || p.kind === "volley") {
    spots.push({ x: CX + side * U(rng, 2.5, 4), y: U(rng, 1.5, 4) });   // near post
    spots.push({ x: CX - side * U(rng, 3, 5), y: U(rng, 2, 6) });       // far post
    spots.push({ x: CX + U(rng, -1.5, 1.5), y: U(rng, 9, 12) });        // spot
  } else if (p.kind === "through_ball") {
    spots.push({ x: CX + side * U(rng, 0, 6), y: Math.max(8, bd - U(rng, 6, 12)) });
    spots.push({ x: CX - side * U(rng, 4, 9), y: Math.max(6, bd - U(rng, 4, 10)) });
    spots.push({ x: CX + side * U(rng, 6, 12), y: Math.max(10, bd - U(rng, 2, 8)) });
  } else {
    // A shooting chance: support stays OUT of the lane — wide of the goal's own
    // width, or on a defender's shoulder inside the six.
    spots.push({ x: CX + side * U(rng, 5, 9), y: Math.max(2, bd - U(rng, 3, 8)) });
    spots.push({ x: CX - side * U(rng, 5, 9), y: U(rng, 2, 6) });
    spots.push({ x: CX + side * U(rng, 8, 14), y: Math.max(3, bd - U(rng, 0, 6)) });
  }

  // Placed AFTER the line, so the offside line is already final — this
  // ordering IS the offside fix (spec §2.5), not a repair afterwards.
  const line = offsideLineOf(sc);
  const onsideY = line === null ? 0 : line + 0.3;
  for (let i = 0; i < runners.length; i++) {
    const at = spots[i % spots.length];
    const to = { x: clamp(at.x, 2, PITCH_W - 2), y: Math.max(0.8, at.y) };
    // §C3: never parked in the open lane of a shot from distance.
    if (bd >= 14 && Math.abs(to.x - CX) < 4 && to.y < bd) to.x = CX + side * -4.4;
    to.y = Math.max(to.y, onsideY);
    runners[i].to = { x: to.x, y: to.y };
    runners[i].pos = { x: to.x, y: Math.max(to.y + 1.4, onsideY) };
  }
  if (sc.runner) sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };

  // The poacher lurks for a spill, always onside of the line as it now stands.
  sc.follower.x = clamp(CX + side * U(rng, 1.5, 5), POST_L - 3, POST_R + 3);
  sc.follower.y = Math.max(U(rng, SIX_DEPTH, 12), onsideY);
}

// ── THE WHOLE PIPELINE ──────────────────────────────────────────────────────

/**
 * Build one generated chance end to end, the way CanvasMatch does it:
 * the real engine's base, repaired to its own defining property, then expanded.
 */
export function buildChance(
  plan: ChancePlan, rng: () => number,
  keeperStrength = 62, teamRelationship = 60, vision = 55,
): Scenario {
  const sc = buildScenario(plan.kind, rng, keeperStrength, teamRelationship, vision);
  fixBaseScenario(sc);
  applyChancePlan(sc, plan, rng);
  return sc;
}

/**
 * Everything wrong with a generated picture. Delegates the world-shape rules to
 * `scenarioFaults` (baseScenario.ts) so the base's own agreed definitions are
 * the authority, and adds only what is specific to this layer: the camera must
 * hold the actors that decide the chance, and nothing may be piled on the ball.
 */
export function planFaults(sc: Scenario, plan: ChancePlan): string[] {
  // A through ball's runner timing his move a yard early IS the chance —
  // baseScenario.ts deliberately exempts it from the onside repair for that
  // reason, and the gallery already draws it amber rather than red. This
  // function was the one place that still counted it as broken.
  const out = scenarioFaults(sc).filter(f =>
    !(sc.kind === "through_ball" && f === "attacker offside"));
  const vp = sc.viewport;
  const inFrame = (q: Vec2) => q.x >= vp.x1 - 0.1 && q.x <= vp.x2 + 0.1 && q.y >= vp.y1 - 0.1 && q.y <= vp.y2 + 0.1;
  if (!inFrame(sc.ball)) out.push("ball off screen");
  if (!inFrame(sc.player)) out.push("you are off screen");
  if (SHOOTER_KINDS.has(sc.kind) && (sc.keeper.x < vp.x1 - 0.1 || sc.keeper.x > vp.x2 + 0.1)) out.push("keeper off screen");
  if (sc.runner && !inFrame(sc.runner.pos)) out.push("the pass target is off screen");
  for (const d of sc.defenders) {
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 1.4) out.push("defender piled on the ball");
    if (Math.hypot(d.x - sc.player.x, d.y - sc.player.y) < 1.2) out.push("defender standing on you");
  }
  return out;
}

/** Attach the formation/playstyle/strength context a plan expands against. */
export function withShape(plan: ChancePlan, shape: ShapeInput | null | undefined): ChancePlan {
  return { ...plan, ctxShape: shape ?? null };
}
