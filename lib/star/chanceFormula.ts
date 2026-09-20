import {
  buildScenario, goalInView,
  type Scenario, type ScenarioKind, type Defender, type Runner, type Vec2,
} from "./canvasEngine";
import {
  CX, PITCH_W, POST_L, POST_R, HALF_LEN, NET_DEPTH, BOX_DEPTH, SIX_DEPTH,
} from "./pitch";

/**
 * THE CHANCE FORMULA — a generative parameter space, not a list of presets.
 *
 * Every chance the game has ever shown came from one of thirteen hand-written
 * builders in canvasEngine.ts, each rolling its own small internal variation.
 * That is thirteen situations wearing different random numbers, which is why
 * the measured highlight mix is so narrow (top-3 kinds ≈ 44% of everything).
 *
 * This file defines a PARAMETER SPACE over the dimensions a chance actually
 * varies along, crosses them, filters the crossings for football sense, and
 * hands back every survivor as a named, inspectable `ChanceSpec`. The engine
 * still builds the base Scenario — `buildScenario(kind, …)` — and this layer
 * only ever writes PUBLIC fields on top of it, exactly the discipline
 * formationShape.ts follows. canvasEngine.ts is never modified.
 *
 * ── Where the numbers come from ──
 *
 * scratchpad/research-SB360-measured.md (653,890 StatsBomb-360 freeze frames):
 *  - Table 1: the back line sits ≈ 0.66–0.7 × the ball's distance from goal,
 *    and the count of defenders INSIDE the box collapses with distance —
 *    median 7 at 10 m, 4 at 20 m, 2 at 25 m, 0 at 30 m and beyond. That table
 *    is what DEFENDER_COUNT_BY_BAND below encodes; it is also why a
 *    "six-defender wall" in open play is filtered out rather than tuned down.
 *  - Table 6: defenders inside the box by play pattern — regular play median
 *    4, a genuine counter median 1 [p25 0, p75 3], and only ~4% of real shots
 *    come from a counter. That is the `recovering` setup, and why it is rare.
 *  - Table 3: from 16–25 m, a team-mate is in the shot's own lane on fewer
 *    than 1 shot in 4, and essentially never more than one man.
 * research-C-attacking-occupation.md §C3: no team-mate is placed inside the
 *    ball→posts triangle for a shot from ≥14 m; support belongs either beyond
 *    ±3.66 m laterally or on a defender's shoulder inside the six.
 * research-A-defensive-shape.md §A6: 4+ defenders behind the ball is the
 *    threshold for a settled shape; a transition is 5–8 seconds of chaos.
 *
 * ── Swappability ──
 *
 * PARAM_SPACE is ONE exported data structure and FILTER_RULES is ONE exported
 * array. A replacement parameter space is a replacement of those two values
 * plus the band geometry tables they name; nothing downstream (generation,
 * selection, the geometry writer, the tests) reads a hard-coded dimension.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ── THE DIMENSIONS ──────────────────────────────────────────────────────────

/** How far from goal the ball is when the chance opens. */
export type DistanceBand = "in_box" | "edge_of_box" | "just_outside" | "long_range";
/** Where across the pitch it is. Half-spaces are the channels either side of centre. */
export type LateralBand = "left_wide" | "left_half" | "central" | "right_half" | "right_wide";
/** The framing. "straight" is the ordinary overhead view; the other two are the
 *  quarter-turned crossing frames the engine already builds for wide deliveries. */
export type CameraAngle = "straight" | "from_left" | "from_right";
/** How the defence is set when the ball arrives. */
export type DefensiveSetup = "deep_block" | "mid_block" | "high_line" | "recovering";
/** The back line the defending side actually defends with. */
export type BackLine = "back4" | "back5";
/** The opponent relative to you. */
export type StrengthBand = "weak" | "even" | "strong";
/** What help you have, and where it is. */
export type SupportPattern =
  | "lone" | "overlap" | "shoulder_runner" | "back_post_poacher" | "cutback_option";

export interface ChanceParams {
  kind: ScenarioKind;
  distance: DistanceBand;
  lateral: LateralBand;
  camera: CameraAngle;
  /** Bodies between you and goal, on screen. */
  defenders: number;
  /** Team-mates on screen who are a real option (the poacher aside). */
  attackers: number;
  setup: DefensiveSetup;
  backLine: BackLine;
  strength: StrengthBand;
  support: SupportPattern;
}

/**
 * THE PARAMETER SPACE — one data structure, replaceable wholesale.
 *
 * Only the eight kinds a real defensive block and a real attacking shape
 * apply to. Dead balls (penalty/free_kick/corner) are fixed by the laws and
 * have their own bespoke setups; midfield_pass/buildup have no goal in frame,
 * so distance-from-goal and defensive-block shape mean nothing for them.
 * Both groups keep exactly today's behaviour — see APPLY_KINDS in
 * formationShape.ts, which draws the same line for the same reason.
 */
export const PARAM_SPACE = {
  kind: [
    "one_on_one", "tight_angle", "long_range", "volley",
    "header", "cutback", "byline_cross", "through_ball",
  ] as ScenarioKind[],
  distance: ["in_box", "edge_of_box", "just_outside", "long_range"] as DistanceBand[],
  lateral: ["left_wide", "left_half", "central", "right_half", "right_wide"] as LateralBand[],
  camera: ["straight", "from_left", "from_right"] as CameraAngle[],
  defenders: [1, 2, 3, 4, 5],
  attackers: [0, 1, 2, 3],
  setup: ["deep_block", "mid_block", "high_line", "recovering"] as DefensiveSetup[],
  backLine: ["back4", "back5"] as BackLine[],
  strength: ["weak", "even", "strong"] as StrengthBand[],
  support: [
    "lone", "overlap", "shoulder_runner", "back_post_poacher", "cutback_option",
  ] as SupportPattern[],
} as const;

// ── BAND GEOMETRY ───────────────────────────────────────────────────────────

/** Metres from the goal line, [min, max]. SB360 Table 1's own distance bands. */
export const DISTANCE_M: Record<DistanceBand, [number, number]> = {
  in_box: [6, 15],
  edge_of_box: [BOX_DEPTH, 20.5],       // 16.5–20.5
  just_outside: [20.5, 27],
  long_range: [27, 34],
};

/** Metres either side of the centre line, [min, max] of |offset|, with sign. */
export const LATERAL_M: Record<LateralBand, [number, number, number]> = {
  //                     min   max  sign
  left_wide: [17, 25, -1],
  left_half: [7.5, 15, -1],
  central: [0, 4.5, 1],
  right_half: [7.5, 15, 1],
  right_wide: [17, 25, 1],
};

/**
 * How many defenders are realistic on screen, by distance. Straight off SB360
 * Table 1's "defenders inside 16.5 m" column, widened by one either way to
 * cover the p25/p75 spread rather than pinning every chance to the median.
 */
export const DEFENDER_COUNT_BY_BAND: Record<DistanceBand, [number, number]> = {
  in_box: [2, 5],          // median 6–7 inside the box; the FRAME holds fewer
  edge_of_box: [2, 5],     // median 4 (Table 6, regular play)
  just_outside: [1, 4],    // median 2 at 25 m
  long_range: [1, 3],      // median 0 inside the box at 30 m
};

/** Where the back line sits, as a fraction of the ball's own distance from
 *  goal (SB360 Table 1's ≈0.66 baseline, moved by the side's setup). */
export const SETUP_LINE_RATIO: Record<DefensiveSetup, number> = {
  deep_block: 0.52,
  mid_block: 0.66,
  high_line: 0.80,
  recovering: 0.40,   // caught out — the last men are much closer to goal
};

// ── THE FILTER ──────────────────────────────────────────────────────────────

export interface FilterRule {
  id: string;
  /** Plain English: why a crossing this rejects is not football. */
  reason: string;
  /** True = this crossing survives. */
  test: (p: ChanceParams) => boolean;
}

const WIDE: LateralBand[] = ["left_wide", "right_wide"];
const HALF: LateralBand[] = ["left_half", "right_half"];
const sideOf = (l: LateralBand): -1 | 0 | 1 =>
  l === "left_wide" || l === "left_half" ? -1 : l === "central" ? 0 : 1;

/** Which distance bands each kind can honestly happen in. */
const KIND_DISTANCE: Record<string, DistanceBand[]> = {
  one_on_one: ["in_box", "edge_of_box"],
  tight_angle: ["in_box", "edge_of_box"],
  long_range: ["just_outside", "long_range"],
  volley: ["in_box", "edge_of_box"],
  header: ["in_box"],
  cutback: ["in_box", "edge_of_box"],
  byline_cross: ["in_box", "edge_of_box"],
  through_ball: ["edge_of_box", "just_outside", "long_range"],
};

/**
 * THE REALISM FILTER — as important as the generator.
 *
 * Each rule is a separate, named, testable predicate so the measurement can
 * report exactly how many crossings each one removed, rather than a single
 * opaque "is this sensible" function.
 */
export const FILTER_RULES: FilterRule[] = [
  {
    id: "kind-distance",
    reason: "No headers from 35 yards, no long-range strikes from six. Each kind only happens where it happens.",
    test: p => (KIND_DISTANCE[p.kind] ?? []).includes(p.distance),
  },
  {
    id: "tight-angle-is-wide",
    reason: "A tight angle IS the lateral position. Dead centre in front of goal is not a tight angle.",
    test: p => p.kind !== "tight_angle" || WIDE.includes(p.lateral) || HALF.includes(p.lateral),
  },
  {
    id: "delivery-is-wide",
    reason: "A cutback or a byline cross is played from wide or from the half-space, never from the middle of the D.",
    test: p => (p.kind !== "cutback" && p.kind !== "byline_cross")
      || WIDE.includes(p.lateral) || HALF.includes(p.lateral),
  },
  {
    id: "shooting-is-not-from-the-touchline",
    reason: "A one-on-one, a volley or a header from 22 m wide of the posts is not that chance.",
    test: p => !["one_on_one", "volley", "header", "long_range"].includes(p.kind)
      || !WIDE.includes(p.lateral),
  },
  {
    id: "camera-matches-the-delivery",
    reason: "The quarter-turned crossing frame is the engine's own wide-delivery view. Every other chance is watched straight on, and a turned frame must look down the side the ball is actually on.",
    test: p => p.camera === "straight"
      ? p.kind !== "byline_cross"
      : p.kind === "byline_cross" && sideOf(p.lateral) === (p.camera === "from_left" ? -1 : 1),
  },
  {
    id: "defender-count-by-distance",
    reason: "SB360 Table 1: the box empties as the ball goes out. Six-man walls in open play, and empty boxes at six yards, both filtered.",
    test: p => {
      const [lo, hi] = DEFENDER_COUNT_BY_BAND[p.distance];
      return p.defenders >= lo && p.defenders <= hi;
    },
  },
  {
    id: "setup-matches-the-count",
    reason: "A deep block is a crowd; a high line and a scrambling defence are not. SB360 Table 6: a genuine counter has a median of 1 defender in the box.",
    test: p =>
      p.setup === "deep_block" ? p.defenders >= 3
      : p.setup === "high_line" ? p.defenders <= 3
      : p.setup === "recovering" ? p.defenders <= 2
      : true,
  },
  {
    id: "back5-is-a-block",
    reason: "A back five defends deep and in numbers — it is not the shape a side caught in transition is standing in.",
    test: p => p.backLine !== "back5" || (p.setup !== "recovering" && p.defenders >= 3),
  },
  {
    id: "strength-picks-a-shape",
    reason: "The stronger side pushes up, the weaker side drops off. A favourite parking the bus, or a heavy underdog holding a high line, is not what the research shows.",
    test: p =>
      p.strength === "strong" ? p.setup !== "deep_block"
      : p.strength === "weak" ? p.setup !== "high_line"
      : true,
  },
  {
    id: "support-count-agrees",
    reason: "\"Lone\" means alone; every other pattern needs at least the man it names.",
    test: p => (p.support === "lone") === (p.attackers === 0),
  },
  {
    id: "support-fits-the-chance",
    reason: "An overlapping full-back needs a flank to overlap into; a cut-back option needs a byline to cut back from; a back-post poacher needs a ball coming across.",
    test: p =>
      p.support === "overlap" ? (WIDE.includes(p.lateral) || HALF.includes(p.lateral))
      : p.support === "cutback_option" ? ["cutback", "byline_cross", "tight_angle"].includes(p.kind)
      : p.support === "back_post_poacher" ? ["cutback", "byline_cross", "header", "volley"].includes(p.kind)
      : true,
  },
  {
    id: "a-pass-needs-someone-to-pass-to",
    reason: "A cutback, a cross and a through-ball all resolve against a team-mate. Playing one with nobody in the picture is not a chance.",
    test: p => !["cutback", "byline_cross", "through_ball"].includes(p.kind) || p.attackers >= 1,
  },
  {
    id: "crowded-box-needs-bodies",
    reason: "Three team-mates in the frame for a long-range shot is a crowd in the shooting lane (SB360 Table 3: 98% of real shots have 0 or 1).",
    test: p => p.distance === "in_box" || p.distance === "edge_of_box" || p.attackers <= 1,
  },
];

// ── GENERATION ──────────────────────────────────────────────────────────────

export interface ChanceSpec {
  /** Stable, deterministic identifier — the parameter vector, joined. */
  id: string;
  /** The parameter vector itself, for filtering and inspection. */
  params: ChanceParams;
  /** Readable, e.g. "Cutback from the right byline, deep block, back post". */
  name: string;
  /** Kind, lifted out because everything selects on it. */
  kind: ScenarioKind;
  /**
   * The "situation" this is, coarser than its id — kind + distance + lateral.
   * The anti-repeat memory works on this, so two chances that only differ in
   * which defensive setup they meet are not treated as a repeat.
   */
  signature: string;
}

const TITLE: Record<string, string> = {
  in_box: "in the box", edge_of_box: "from the edge", just_outside: "from outside", long_range: "from range",
  left_wide: "wide left", left_half: "the left half-space", central: "centrally",
  right_half: "the right half-space", right_wide: "wide right",
  deep_block: "low block", mid_block: "mid block", high_line: "high line", recovering: "on the break",
  lone: "no support", overlap: "overlap", shoulder_runner: "runner off the shoulder",
  back_post_poacher: "back post", cutback_option: "cutback option",
};

function nameOf(p: ChanceParams): string {
  const kind = p.kind.replace(/_/g, " ");
  return `${kind[0].toUpperCase()}${kind.slice(1)} ${TITLE[p.distance]}, ${TITLE[p.lateral]} — `
    + `${TITLE[p.setup]} (${p.backLine === "back5" ? "back 5" : "back 4"}, ${p.defenders}v${p.attackers + 1}), ${TITLE[p.support]}`;
}

function specOf(p: ChanceParams): ChanceSpec {
  const id = [
    p.kind, p.distance, p.lateral, p.camera, `d${p.defenders}`, `a${p.attackers}`,
    p.setup, p.backLine, p.strength, p.support,
  ].join("|");
  return { id, params: p, name: nameOf(p), kind: p.kind, signature: `${p.kind}|${p.distance}|${p.lateral}` };
}

export interface GenerationReport {
  crossings: number;
  survivors: number;
  /** How many crossings each rule was the FIRST to reject. */
  rejectedBy: Record<string, number>;
  byKind: Record<string, number>;
}

let CACHE: { specs: ChanceSpec[]; report: GenerationReport } | null = null;

/** Cross every dimension, filter for football sense, keep the survivors. */
export function generateChances(): { specs: ChanceSpec[]; report: GenerationReport } {
  if (CACHE) return CACHE;
  const specs: ChanceSpec[] = [];
  const rejectedBy: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const r of FILTER_RULES) rejectedBy[r.id] = 0;
  let crossings = 0;

  for (const kind of PARAM_SPACE.kind)
  for (const distance of PARAM_SPACE.distance)
  for (const lateral of PARAM_SPACE.lateral)
  for (const camera of PARAM_SPACE.camera)
  for (const defenders of PARAM_SPACE.defenders)
  for (const attackers of PARAM_SPACE.attackers)
  for (const setup of PARAM_SPACE.setup)
  for (const backLine of PARAM_SPACE.backLine)
  for (const strength of PARAM_SPACE.strength)
  for (const support of PARAM_SPACE.support) {
    crossings++;
    const p: ChanceParams = {
      kind, distance, lateral, camera, defenders, attackers, setup, backLine, strength, support,
    };
    let rejected = "";
    for (const rule of FILTER_RULES) {
      if (!rule.test(p)) { rejected = rule.id; break; }
    }
    if (rejected) { rejectedBy[rejected]++; continue; }
    specs.push(specOf(p));
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }

  CACHE = { specs, report: { crossings, survivors: specs.length, rejectedBy, byKind } };
  return CACHE;
}

/** Every surviving scenario, in a stable order. */
export function allChances(): ChanceSpec[] { return generateChances().specs; }

// ── APPLYING ONE ────────────────────────────────────────────────────────────

/**
 * The frame, restated here rather than imported — canvasEngine.ts keeps its own
 * copies private and is not to be modified. Same numbers, same aspect, same
 * clamping rules; the measurement asserts every applied scenario still sits
 * inside its own viewport, so a drift would be caught rather than shipped.
 */
const VIEW_H = 42;
const VIEW_ASPECT = 5 / 8;
const INSET = 1.4;

function reframe(sc: Scenario, ballY: number): void {
  const h = VIEW_H, w = h * VIEW_ASPECT;
  // Centre the frame on the midpoint of the goal and the ball, which is what
  // autoViewport's bounding box comes to for a chance with the goal in it.
  const cy = (ballY + (-NET_DEPTH)) / 2;
  const cx = (sc.ball.x + CX) / 2;
  let vy1 = cy - h / 2, vy2 = cy + h / 2;
  let vx1 = cx - w / 2, vx2 = cx + w / 2;
  const padX = 5, backPad = NET_DEPTH + 2.5, fwdPad = 6;
  if (vx1 < -padX) { const s = -padX - vx1; vx1 += s; vx2 += s; }
  if (vx2 > PITCH_W + padX) { const s = vx2 - (PITCH_W + padX); vx1 -= s; vx2 -= s; }
  if (vy1 < -backPad) { const s = -backPad - vy1; vy1 += s; vy2 += s; }
  if (vy2 > HALF_LEN + fwdPad) { const s = vy2 - (HALF_LEN + fwdPad); vy1 -= s; vy2 -= s; }
  sc.viewport = { x1: vx1, x2: vx2, y1: vy1, y2: vy2 };
}

const bandValue = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

function makeRunnerAt(at: Vec2, from: Vec2, role: "target" | "support"): Runner {
  return {
    pos: { x: from.x, y: from.y }, to: { x: at.x, y: at.y },
    speed: role === "target" ? 6.6 : 6.2, moving: false, role, sprint: false,
  };
}

/**
 * Write a generated chance's geometry onto a base Scenario.
 *
 * The Scenario must have been built by the real engine
 * (`buildScenario(spec.kind, …)`) — this never constructs one, and only ever
 * writes public fields on it. Runs BEFORE applyFormationShape, so the block
 * layer then shapes whatever defenders this leaves on the pitch; it also
 * enforces both of that layer's invariants itself (a covered central channel
 * and nobody offside) so a scenario is legal even in a sandbox or a test where
 * there is no formation to apply.
 */
export function applyChanceShape(sc: Scenario, spec: ChanceSpec, rng: () => number): void {
  const p = spec.params;
  // A turned crossing frame is the engine's own fixed rectangle and everything
  // in it is placed relative to that; leave its camera alone and shape only
  // what is safe to shape.
  const turned = sc.facing === "left" || sc.facing === "right";

  // ── 1. The ball, from the distance × lateral bands ──
  const [dLo, dHi] = DISTANCE_M[p.distance];
  const ballY = bandValue(rng, dLo, dHi);
  const [xLo, xHi, sign] = LATERAL_M[p.lateral];
  const off = bandValue(rng, xLo, xHi) * (p.lateral === "central" ? (rng() < 0.5 ? -1 : 1) : sign);
  const ballX = clamp(CX + off, 3, PITCH_W - 3);

  if (!turned) {
    const dx = sc.player.x - sc.ball.x, dy = sc.player.y - sc.ball.y;
    sc.ball = { x: ballX, y: ballY };
    // You keep the stand-off stance the builder gave you (0.8–2.0 m off the
    // ball) — see CanvasMatch's touch-mode note on why that gap is real.
    sc.player = { x: ballX + dx, y: ballY + dy };
    reframe(sc, ballY);
  }

  const vp = sc.viewport;
  const fx = (x: number) => clamp(x, vp.x1 + INSET, vp.x2 - INSET);
  const fy = (y: number) => clamp(y, Math.max(vp.y1 + INSET, 0.3), vp.y2 - INSET);
  if (!turned) {
    // A wide chance can put the ball near the edge of the frame; you stand a
    // stride off it, and that stride must not fall off the screen.
    sc.ball = { x: fx(sc.ball.x), y: fy(sc.ball.y) };
    sc.player = { x: fx(sc.player.x), y: fy(sc.player.y) };
  }
  const bd = clamp(sc.ball.y, 6, 45);

  // ── 2. The defenders: the count is the dimension, the shape is the setup ──
  //
  // A turned crossing frame is the one case where the count is ALL this layer
  // touches. The ball sits on the byline, so "goal-side of the ball" stops
  // meaning anything, and the box crowd a cross is delivered into is the
  // engine's own carefully-built picture inside its own fixed rectangle —
  // reshaping it into a back line would put defenders behind the goal line.
  if (turned) {
    const wantT = clamp(p.defenders, 1, 6);
    while (sc.defenders.length > wantT) sc.defenders.pop();
    while (sc.defenders.length < wantT) {
      const from = sc.defenders[sc.defenders.length - 1] ?? { x: CX, y: 6 };
      sc.defenders.push({ x: fx(from.x + 2.6), y: fy(from.y + 2.2) });
    }
    spreadOut(sc, fx, fy);
    // Spreading them apart can nudge a man goal-side of his own keeper; in a
    // box crowd that reads as a defender standing in the net.
    for (const d of sc.defenders) d.y = Math.max(d.y, sc.keeper.y + 0.5);
    applySupport(sc, p, fx, fy, rng);
    enforceOnside(sc);
    return;
  }
  //
  // Never below 1: the engine's own COVER_RANGE tuning assumes somebody is
  // there, and a chance with an empty picture is not a chance.
  const want = clamp(p.defenders, 1, 6);
  while (sc.defenders.length > want) sc.defenders.pop();
  const lineY = clamp(bd * SETUP_LINE_RATIO[p.setup], 4.5, Math.max(5, bd - 2.2));
  const span = (p.backLine === "back5" ? 1.28 : 1) * clamp(16 + bd * 0.22, 16, 25);
  while (sc.defenders.length < want) {
    const d: Defender = { x: CX, y: lineY };
    sc.defenders.push(d);
  }
  const n = sc.defenders.length;
  const shift = clamp((sc.ball.x - CX) * 0.4, -8, 8);
  for (let i = 0; i < n; i++) {
    const d = sc.defenders[i];
    const frac = n <= 1 ? 0.5 : i / (n - 1);
    const fromCentre = Math.abs(frac - 0.5) * 2;
    d.x = fx(CX + shift + (frac - 0.5) * span);
    d.y = fy(lineY - 1.2 + fromCentre * 2.4);
  }
  spreadOut(sc, fx, fy);
  clearOfBall(sc, fx, fy);
  coverCentre(sc, bd, fx);

  // ── 3. The support: how many, and where ──
  applySupport(sc, p, fx, fy, rng);

  // ── 4. Nobody offside. LAST, always — the line has just moved. ──
  enforceOnside(sc);
}

/** Keep the keeper's own space, the ball's own space, and each other's. */
function clearOfBall(sc: Scenario, fx: (x: number) => number, fy: (y: number) => number): void {
  const CLEAR = 1.8;
  for (const d of sc.defenders) {
    const dx = d.x - sc.ball.x, dy = d.y - sc.ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= CLEAR) continue;
    const ux = dist > 0.01 ? dx / dist : 0, uy = dist > 0.01 ? dy / dist : 1;
    d.x = fx(sc.ball.x + ux * CLEAR);
    d.y = fy(sc.ball.y + uy * CLEAR);
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < CLEAR - 0.05) {
      d.x = fx(sc.ball.x - ux * CLEAR);
      d.y = fy(sc.ball.y - uy * CLEAR);
    }
  }
  // A keeper who has come a long way off his line has nowhere to put a defender
  // when the ball is only six yards out: "never behind the keeper" and "always
  // goal-side of the ball" cross over, and one of them has to give. He retreats
  // rather than a defender being shoved past the ball — the same call the
  // engine's own clearOfBall makes for the same reason.
  const room = sc.ball.y - 3.5;
  if (sc.keeper.y > room) sc.keeper.y = clamp(room, 0.8, sc.keeper.y);
  // Never goal-side of his own keeper, never past the ball.
  const yLo = sc.keeper.y + 2.2;
  const yHi = Math.max(yLo, sc.ball.y - 1.3);
  for (const d of sc.defenders) d.y = clamp(d.y, yLo, yHi);
}

function spreadOut(sc: Scenario, fx: (x: number) => number, fy: (y: number) => number): void {
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let a = 0; a < sc.defenders.length; a++) {
      for (let b = a + 1; b < sc.defenders.length; b++) {
        const da = sc.defenders[a], db = sc.defenders[b];
        const dx = db.x - da.x, dy = db.y - da.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= 3 || dist === 0) continue;
        const push = (3 - dist) / 2 + 0.05;
        const ux = dx / dist, uy = dy / dist;
        da.x = fx(da.x - ux * push); db.x = fx(db.x + ux * push);
        da.y = fy(da.y - uy * push); db.y = fy(db.y + uy * push);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** A defending side never leaves the middle of its own box empty. */
function coverCentre(sc: Scenario, ballDist: number, fx: (x: number) => number): void {
  if (ballDist > 24 || sc.defenders.length === 0) return;
  const HALF_W = 6.5;
  if (sc.defenders.some(d => Math.abs(d.x - CX) <= HALF_W)) return;
  let best = sc.defenders[0];
  for (const d of sc.defenders) if (Math.abs(d.x - CX) < Math.abs(best.x - CX)) best = d;
  best.x = fx(CX + (best.x >= CX ? 1 : -1) * HALF_W * 0.55);
}

/**
 * Where your team-mates stand — research-C §C3's rule, applied literally.
 *
 * Never inside the ball→posts triangle for a shot from ≥14 m: support goes
 * either beyond the goal's own width laterally, or inside the six on a
 * defender's shoulder, which is goal-side rather than in the way.
 */
function applySupport(
  sc: Scenario, p: ChanceParams,
  fx: (x: number) => number, fy: (y: number) => number,
  rng: () => number,
): void {
  const side = sideOf(p.lateral) || (rng() < 0.5 ? -1 : 1);
  const bd = sc.ball.y;
  const spot = (): Vec2 => {
    switch (p.support) {
      case "overlap":            // outside you, a stride further on
        return { x: CX + side * clamp(Math.abs(sc.ball.x - CX) + 4.5, 8, 26), y: Math.max(3, bd - 6) };
      case "shoulder_runner":    // on the last man's shoulder, in the channel
        return { x: CX + side * (4 + rng() * 4), y: clamp(bd - 8 - rng() * 4, SIX_DEPTH, bd - 2) };
      case "back_post_poacher":  // far post, away from the delivery
        return { x: CX - side * (5 + rng() * 3), y: clamp(4 + rng() * 3, 2.5, 9) };
      case "cutback_option":     // the edge of the six, arriving
        return { x: CX + (rng() - 0.5) * 6, y: clamp(9 + rng() * 5, SIX_DEPTH, 15) };
      default:
        return { x: CX + side * 9, y: Math.max(3, bd - 5) };
    }
  };

  const wanted = p.attackers;
  const runners: Runner[] = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
  while (runners.length > wanted) runners.pop();
  while (runners.length < wanted) {
    const at = spot();
    runners.push(makeRunnerAt(at, { x: at.x, y: at.y + 2.4 }, runners.length === 0 ? "target" : "support"));
  }

  // The named pattern owns the first man; anybody else spreads off him.
  for (let i = 0; i < runners.length; i++) {
    const at = i === 0 ? spot() : { x: CX - side * (6 + i * 4 + rng() * 3), y: Math.max(3, bd - 4 - i * 5) };
    // §C3: never parked in the open lane between a distance shot and the goal.
    if (bd >= 14 && Math.abs(at.x - CX) < 4 && at.y < bd) at.x = CX + side * -4.4;
    const r = runners[i];
    r.to = { x: fx(at.x), y: fy(at.y) };
    r.pos = { x: fx(at.x), y: fy(at.y + 1.6) };
  }

  if (runners.length > 0) {
    sc.runner = runners[0];
    sc.secondaryRunners = runners.slice(1);
    sc.passTarget = { x: runners[0].to.x, y: runners[0].to.y };
  } else {
    sc.runner = null;
    sc.secondaryRunners = [];
    sc.passTarget = null;
  }
}

/** Nobody attacking is left standing offside once the line has finished moving. */
function enforceOnside(sc: Scenario): void {
  if (!goalInView(sc.kind) || sc.kind === "corner") return;
  const ys = sc.defenders.map(d => d.y);
  ys.push(sc.keeper.y);
  if (ys.length < 2) return;
  ys.sort((a, b) => a - b);
  const line = ys[1];
  const onside = (q: { y: number }) => { if (q.y < line + 0.3) q.y = line + 0.3; };
  if (sc.runner) { onside(sc.runner.pos); onside(sc.runner.to); }
  for (const r of sc.secondaryRunners) { onside(r.pos); onside(r.to); }
  onside(sc.follower);
  if (sc.passTarget) onside(sc.passTarget);
}

/**
 * Build one generated chance end to end: the real engine's Scenario, then this
 * layer's geometry. The one entry point CanvasMatch needs.
 */
export function buildChance(
  spec: ChanceSpec, rng: () => number,
  keeperStrength = 62, teamRelationship = 60, vision = 55,
): Scenario {
  const sc = buildScenario(spec.kind, rng, keeperStrength, teamRelationship, vision);
  applyChanceShape(sc, spec, rng);
  return sc;
}

/** Everything the gallery / a future hand-editor needs to inspect one. */
export const POST_L_X = POST_L;
export const POST_R_X = POST_R;
