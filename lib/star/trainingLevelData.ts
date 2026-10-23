import type { Skills } from "./types";
import { TRAINING_LEVELS, levelDifficulty, levelSeed } from "./trainingLevels";
import { techniqueDrill, freeKickDrill, paceDrill, powerDrillForLevel } from "./trainingDrills";
import TABLE_JSON from "./data/trainingLevels.json";
import { PITCH_W } from "./pitch";

/**
 * TRAINING LEVELS AS DATA (Harry, 19 Oct 2026: "training levels have no way
 * of adapting them, like I would do in a scenario gallery … the final
 * training of, say, vision isn't hard enough").
 *
 * Every one of the 150 levels (5 games × 30) is a row of numbers in
 * `lib/star/data/trainingLevels.json`. The game reads the row; the drill
 * builds the picture from it and plays it on the real engine, as before.
 * Edits sit on top, newest first:
 *
 *   1. a level saved on the Training levels page (the shared
 *      star_training_levels table, cached on this device)
 *   2. the committed file (lib/star/data/trainingLevels.json)
 *   3. the built-in curve below (`defaultLevel`), only if a row is missing
 *
 * The built-in curve is the old one (trainingDrills.ts at rep 0) for levels
 * 1-19. Levels 20-30 climb to a harder top (20 Oct 2026): see TOP_LEVELS.
 * Vision has its own 1-30 curve since its rebuild (visionDefault).
 */

export type TrainingSkill = keyof Skills;
export const TRAINING_SKILLS: TrainingSkill[] = ["power", "technique", "freeKick", "pace", "vision", "aerial"];

/** The first level of the harder top end; 30 is the top. */
export const TOP_FROM = 20;

export interface PowerLevel {
  /** Metres from the goal line. */
  distance: number;
  /** Metres off-centre (minus = left). */
  offset: number;
  /** Men standing in the shooting lane. */
  blockers: number;
  /** false = an open goal, no keeper. */
  keeper: boolean;
  keeperStrength: number;
  /** Score a try needs (0.5 = any goal; higher = nearer a post). */
  pass: number;
  seed?: number;
  /** Where the men in the way stand, pitch metres — set by dragging them on
   *  the Training levels page. Absent: strung across the lane as before. */
  men?: Spot[];
}
export interface TechniqueLevel {
  gateDistance: number;
  gateWidth: number;
  /** How far the gate sits off your own line, metres (minus = left). */
  gateOffset: number;
  /** Above this height at the gate the ball went over the cones. */
  maxHeight: number;
  /** Score a try needs (0.25 = anywhere between the cones; 0.6 = near the middle). */
  pass: number;
  seed?: number;
  /** Where the ball sits, pitch metres — set by dragging it. Absent: centred,
   *  six metres behind the gate's distance, as before. */
  ball?: Spot;
}
export interface FreeKickLevel {
  distance: number;
  offset: number;
  wall: number;
  keeperStrength: number;
  pass: number;
  seed?: number;
  /** Where the men in the wall stand, pitch metres — set by dragging them.
   *  Absent: a wall 9.15 m from the ball, square to goal, as before. */
  men?: Spot[];
}
export interface PaceLevel {
  /** Men between you and the line, in waves of up to `waveMax`. */
  chasers: number;
  waveMax: number;
  /** How quick they are, 0-100. */
  oppStrength: number;
  /** How quick YOU run in this level, 0-100. */
  runPace: number;
  seed?: number;
  /** Each wave's men, metres across from the centre line — set by dragging
   *  them. Absent (or a wave missing): placed by the level's own seed. */
  lanes?: number[][];
}
/**
 * Vision: "who should I pass to?" on a real picture (lib/star/visionRound.ts).
 * Rebuilt 20 Oct 2026 (Harry: "real scenarios … have someone offside …
 * early on you tap, then you actually have to kick the ball"). The old
 * fields (markers, offsideShare, lineGap, tapRadius: the drawn 2D picture
 * with the yellow line) are gone; a saved row that still has them is an old
 * row and plays as the committed level instead (sanitizeLevel).
 */
export interface VisionLevel {
  /** false: tap the man. true: kick the pass to him (aim, pull, strike: the real kick). */
  kick: boolean;
  /** Seconds: to tap him (tap levels), or to START the kick, your pull on the ball (kick levels). */
  window: number;
  /** Kick levels: seconds from starting the pull to letting go of it. */
  letGo: number;
  /** Team-mates on the picture, the right man included. */
  options: number;
  /** How many of the wrong men are traps: offside, a defender in the lane, or marked. */
  traps: number;
  /** How much better the right ball is than the next good one (the engine's spaceScore, 0-1). Small = two good options. */
  margin: number;
  /** One of the traps is a man standing offside. */
  offside: boolean;
  /** Real match moments (On) or the team's drawn chances (Off). */
  real: boolean;
  seed?: number;
}

/**
 * Aerial & Acrobatics (21 Oct 2026, Harry Q7/Q10): a cross met in the air,
 * on the real match's own header or volley chance (canvasEngine
 * buildHeader / buildVolley), scored like Power: a goal passes.
 */
export interface AerialLevel {
  /** true: a volley (the ball drops to you at the edge of the box). false: a header in the six-yard box. */
  volley: boolean;
  keeperStrength: number;
  /** The builder's one defender (the man marking you / covering the goal) is there. */
  marker: boolean;
  /** Score a try needs (0.5 = any goal; higher = nearer a post). */
  pass: number;
  /** A header level: how high the cross reaches you (m). Above your reach
   *  (aerial.ts headerReachM: 2.14 m at Aerial 30, 2.32 m at 60, 2.50 m at
   *  90) the header is met at a stretch, so the top levels need a high jump. */
  ballZ: number;
  seed?: number;
}

/** The first level where you kick the pass instead of tapping the man (the built-in curve). */
export const VISION_KICK_FROM = 10;
/** From this level the kick must start inside VISION_TOP_WINDOW seconds (the built-in curve). */
export const VISION_TOP_FROM = 28;
export const VISION_TOP_WINDOW = 0.3;

/** A spot on the pitch, metres (x across, y from the goal line). */
export interface Spot { x: number; y: number }

export interface LevelBySkill {
  power: PowerLevel;
  technique: TechniqueLevel;
  freeKick: FreeKickLevel;
  pace: PaceLevel;
  vision: VisionLevel;
  aerial: AerialLevel;
}
export type AnyLevel = LevelBySkill[TrainingSkill];
export type TrainingTable = { [S in TrainingSkill]: LevelBySkill[S][] };

// ── What the editor shows, and the limits every value is kept inside ────────

export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  int?: boolean;
  toggle?: boolean;
}

export const LEVEL_FIELDS: { [S in TrainingSkill]: FieldSpec[] } = {
  power: [
    { key: "distance", label: "Distance", min: 6, max: 40, step: 0.5, unit: "m" },
    { key: "offset", label: "Off centre", min: -20, max: 20, step: 0.5, unit: "m" },
    { key: "blockers", label: "Men in the way", min: 0, max: 6, step: 1, int: true },
    { key: "keeper", label: "Keeper", min: 0, max: 1, step: 1, toggle: true },
    { key: "keeperStrength", label: "Keeper strength", min: 0, max: 99, step: 1, int: true },
    { key: "pass", label: "Score to pass", min: 0.5, max: 0.95, step: 0.05 },
  ],
  technique: [
    { key: "gateDistance", label: "Gate distance", min: 6, max: 40, step: 0.5, unit: "m" },
    { key: "gateWidth", label: "Gate width", min: 0.8, max: 8, step: 0.1, unit: "m" },
    { key: "gateOffset", label: "Gate off line", min: -14, max: 14, step: 0.5, unit: "m" },
    { key: "maxHeight", label: "Max height", min: 0.5, max: 3, step: 0.1, unit: "m" },
    { key: "pass", label: "Score to pass", min: 0.25, max: 0.95, step: 0.05 },
  ],
  freeKick: [
    { key: "distance", label: "Distance", min: 12, max: 38, step: 0.5, unit: "m" },
    { key: "offset", label: "Off centre", min: -22, max: 22, step: 0.5, unit: "m" },
    { key: "wall", label: "Men in the wall", min: 0, max: 7, step: 1, int: true },
    { key: "keeperStrength", label: "Keeper strength", min: 0, max: 99, step: 1, int: true },
    { key: "pass", label: "Score to pass", min: 0.5, max: 0.95, step: 0.05 },
  ],
  pace: [
    { key: "chasers", label: "Men to beat", min: 1, max: 12, step: 1, int: true },
    { key: "waveMax", label: "Most in one wave", min: 1, max: 4, step: 1, int: true },
    { key: "oppStrength", label: "Their speed", min: 20, max: 100, step: 1, int: true },
    { key: "runPace", label: "Your speed", min: 20, max: 100, step: 1, int: true },
  ],
  vision: [
    { key: "kick", label: "Kick the pass (off: tap him)", min: 0, max: 1, step: 1, toggle: true },
    { key: "window", label: "Seconds to tap / start the kick", min: 0.2, max: 5, step: 0.05, unit: "s" },
    { key: "letGo", label: "Seconds to let go of the pull", min: 0.3, max: 3, step: 0.05, unit: "s" },
    { key: "options", label: "Team-mates", min: 2, max: 6, step: 1, int: true },
    { key: "traps", label: "Traps (offside, cut out, marked)", min: 0, max: 4, step: 1, int: true },
    { key: "margin", label: "How clear the right ball is", min: 0.02, max: 0.5, step: 0.01 },
    { key: "offside", label: "Someone offside", min: 0, max: 1, step: 1, toggle: true },
    { key: "real", label: "Real match moments (off: drawn)", min: 0, max: 1, step: 1, toggle: true },
  ],
  aerial: [
    { key: "volley", label: "Volley (off: header)", min: 0, max: 1, step: 1, toggle: true },
    { key: "keeperStrength", label: "Keeper strength", min: 0, max: 99, step: 1, int: true },
    { key: "marker", label: "Marker", min: 0, max: 1, step: 1, toggle: true },
    { key: "pass", label: "Score to pass", min: 0.5, max: 0.95, step: 0.05 },
    { key: "ballZ", label: "Header: ball height (m)", min: 1.5, max: 2.6, step: 0.05 },
  ],
};

/** A Vision row from before the rebuild (the drawn 2D picture): it has the old fields and no `kick`. */
export function isOldVisionRow(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return !("kick" in o) && ("tapRadius" in o || "lineGap" in o || "offsideShare" in o || "markers" in o);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Keep a row inside the editor's limits, fill anything missing from the
 *  built-in row, drop unknown keys. A malformed saved row can never break
 *  a drill. */
export function sanitizeLevel<S extends TrainingSkill>(skill: S, level: number, raw: unknown): LevelBySkill[S] {
  const base = defaultLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
  // An old Vision row means a different drill: none of its numbers carry over.
  if (skill === "vision" && isOldVisionRow(raw)) return base as unknown as LevelBySkill[S];
  const src = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
  const out: Record<string, number | boolean> = {};
  for (const f of LEVEL_FIELDS[skill]) {
    const v = src[f.key];
    if (f.toggle) {
      out[f.key] = typeof v === "boolean" ? v : Boolean(base[f.key]);
      continue;
    }
    let n = typeof v === "number" && Number.isFinite(v) ? v : Number(base[f.key]);
    n = Math.max(f.min, Math.min(f.max, n));
    out[f.key] = f.int ? Math.round(n) : round2(n);
  }
  if (typeof src.seed === "number" && Number.isFinite(src.seed)) out.seed = Math.abs(Math.round(src.seed)) >>> 0;
  return withPositions(skill, out, src) as unknown as LevelBySkill[S];
}

// ── Hand-placed positions (dragged on the Training levels page) ─────────────

/** A spot kept on the pitch (and rounded to the centimetre), or null. */
function cleanSpot(v: unknown): Spot | null {
  if (!v || typeof v !== "object") return null;
  const { x, y } = v as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: round2(Math.max(0.5, Math.min(PITCH_W - 0.5, x))), y: round2(Math.max(0.5, Math.min(52, y))) };
}

/** Most men any drill can place (the wall and the lane top out at 7 and 6). */
const MAX_MEN = 8;
/** Pace: how far across from the centre a man may stand (the run's corridor). */
export const PACE_LANE_HALF = 9;

/** Copy the hand-placed positions a skill understands; drop anything broken. */
function withPositions(skill: TrainingSkill, out: Record<string, unknown>, src: Record<string, unknown>): Record<string, unknown> {
  if (skill === "power" || skill === "freeKick") {
    if (Array.isArray(src.men)) {
      const men = src.men.map(cleanSpot).filter((m): m is Spot => !!m).slice(0, MAX_MEN);
      if (men.length) out.men = men;
    }
  } else if (skill === "technique") {
    const ball = cleanSpot(src.ball);
    if (ball) out.ball = ball;
  } else if (skill === "pace") {
    if (Array.isArray(src.lanes)) {
      const lanes = src.lanes.slice(0, 12).map(w => (Array.isArray(w) ? w : [])
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
        .slice(0, 4)
        .map(x => round2(Math.max(-PACE_LANE_HALF, Math.min(PACE_LANE_HALF, x)))));
      if (lanes.some(w => w.length)) out.lanes = lanes;
    }
  }
  return out;
}

/** The same row with every hand-placed position taken off (Shuffle, Level's own). */
export function withoutPositions<T extends AnyLevel>(row: T): T {
  const r = { ...(row as unknown as Record<string, unknown>) };
  delete r.men; delete r.ball; delete r.lanes;
  return r as unknown as T;
}

/** True when this row carries any dragged position. */
export function hasPositions(row: AnyLevel): boolean {
  const r = row as unknown as Record<string, unknown>;
  return r.men !== undefined || r.ball !== undefined || r.lanes !== undefined;
}

// ── The built-in curve ──────────────────────────────────────────────────────

/** 0 below TOP_FROM, then 0 → 1 from level 20 to level 30. */
function topT(level: number): number {
  return Math.max(0, Math.min(1, (level - TOP_FROM) / (TRAINING_LEVELS - TOP_FROM)));
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The built-in numbers for one level. Levels 1-19 are exactly the old drill
 * (trainingDrills.ts at rep 0). From level 20 each value walks from where
 * the old curve stood at 20 to the harder top value at 30. Vision is its
 * own curve, 1 → 30, since its rebuild (visionDefault below).
 *
 * What made the top flat or easy (20 Oct 2026, measured or read):
 *  - Pace: YOUR run speed was the level number, so it rose faster than
 *    theirs: at level 30 you ran at 100 against 95. Now the gap closes.
 *  - Free kick: the wall stopped growing at 5 from level 22.
 */
export function defaultLevel<S extends TrainingSkill>(skill: S, level: number): LevelBySkill[S] {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  const d = levelDifficulty(n);
  const t = topT(n);
  const at20 = levelDifficulty(TOP_FROM);
  let row: AnyLevel;
  if (skill === "power") {
    const c = powerDrillForLevel(n, 0);
    const c20 = powerDrillForLevel(TOP_FROM, 0);
    row = {
      distance: t > 0 ? lerp(c20.distance, 35, t) : c.distance,
      offset: t > 0 ? lerp(c20.offset, -5.5, t) : c.offset,
      blockers: t > 0 ? Math.round(lerp(c20.blockers, 5, t)) : c.blockers,
      keeper: c.keeper,
      // An open-goal level keeps the strength its keeper WOULD have, so a
      // Power behind the level blends smoothly (easePowerLevel).
      keeperStrength: t > 0 ? lerp(c20.keeperStrength, 96, t) : c.keeper ? c.keeperStrength : 25 + 70 * ((n - 1) / (TRAINING_LEVELS - 1)),
      // The top three levels want it placed, not just in.
      pass: n >= 28 ? lerp(0.6, 0.75, (n - 28) / 2) : 0.5,
    } satisfies PowerLevel;
  } else if (skill === "technique") {
    const c = techniqueDrill(d, 0);
    const c20 = techniqueDrill(at20, 0);
    row = {
      gateDistance: t > 0 ? lerp(c20.gateDistance, 33, t) : c.gateDistance,
      gateWidth: t > 0 ? lerp(c20.gateWidth, 1.6, t) : c.gateWidth,
      gateOffset: t > 0 ? lerp(c20.gateOffset, 8, t) : c.gateOffset,
      maxHeight: c.maxHeight,
      pass: 0.25,
    } satisfies TechniqueLevel;
  } else if (skill === "freeKick") {
    const c = freeKickDrill(d, 0);
    const c20 = freeKickDrill(at20, 0);
    row = {
      distance: t > 0 ? lerp(c20.distance, 31, t) : c.distance,
      offset: t > 0 ? lerp(c20.offset, -8.5, t) : c.offset,
      // 4 at 20, then one more man every few levels, up to 6.
      wall: t > 0 ? Math.round(lerp(c20.wall, 6, t)) : c.wall,
      keeperStrength: t > 0 ? lerp(c20.keeperStrength, 96, t) : c.keeperStrength,
      pass: n >= 28 ? lerp(0.6, 0.7, (n - 28) / 2) : 0.5,
    } satisfies FreeKickLevel;
  } else if (skill === "pace") {
    const c = paceDrill(d, 0);
    const c20 = paceDrill(at20, 0);
    row = {
      chasers: t > 0 ? Math.round(lerp(c20.chasers, 11, t)) : c.chasers,
      waveMax: 3,
      oppStrength: t > 0 ? lerp(c20.oppStrength, 99, t) : c.oppStrength,
      // You used to run at the level's own number, which outran the men at
      // the top. From 20 you stay where 20 put you and they catch up.
      runPace: t > 0 ? lerp(at20, 85, t) : d,
    } satisfies PaceLevel;
  } else if (skill === "aerial") {
    row = aerialDefault(n);
  } else {
    row = visionDefault(n);
  }
  // Round to what the editor shows, so the committed file reads cleanly.
  const out: Record<string, number | boolean> = {};
  const ints = new Set(LEVEL_FIELDS[skill].filter(f => f.int).map(f => f.key));
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "number" ? (ints.has(k) ? Math.round(v) : round2(v)) : v;
  return out as unknown as LevelBySkill[S];
}

/**
 * The built-in Vision curve (20 Oct 2026). One smooth climb, 1 → 30:
 *  - levels 1-9 you TAP the man; from VISION_KICK_FROM you KICK the pass;
 *  - the window shrinks all the way (tap: 4 s → 1.3 s; the kick's start:
 *    1.8 s → VISION_TOP_WINDOW from VISION_TOP_FROM, by the same share each
 *    level), and letting go of the pull 2 s → 0.7 s;
 *  - more men (2 → 6), more of them traps (0 → 3), and the right ball only
 *    just better than the next (0.40 → 0.03 of the engine's spaceScore);
 *  - someone offside on every odd level from 5;
 *  - the team's drawn chances on levels 1, 2 and the first kick level (clean
 *    pictures to learn on), real match moments everywhere else.
 * Measured with the modelled player (tests/star/visionBot.ts): see
 * tests/star/vision.mts and scripts/vision/curve.mts.
 */
function visionDefault(n: number): VisionLevel {
  const kick = n >= VISION_KICK_FROM;
  // Tap levels: 1..9. Kick levels: 10..30.
  const tapT = (n - 1) / (VISION_KICK_FROM - 2);
  const kickT = (n - VISION_KICK_FROM) / (TRAINING_LEVELS - VISION_KICK_FROM);
  // The kick's window shrinks by the same share each level (2 s → 0.3 s), so
  // the squeeze is felt from the middle levels, not only at the very top.
  const window = !kick ? lerp(4.0, 1.3, tapT)
    : 1.8 * Math.pow(VISION_TOP_WINDOW / 1.8, Math.min(1, (n - VISION_KICK_FROM) / (VISION_TOP_FROM - VISION_KICK_FROM)));
  const letGo = kick ? lerp(2.0, 0.7, kickT) : 2;
  // The kick levels start a little easier than the last tap level: the kick is new.
  const climb = !kick ? tapT * 0.45 : 0.25 + kickT * 0.75;
  const options = n <= 2 ? 2 : n === VISION_KICK_FROM ? 2 : Math.round(lerp(3, 6, Math.min(1, climb / 0.85)));
  // Traps climb to 3; with 6 men that leaves two good balls besides the right one at the top.
  const traps = n <= 3 || n === VISION_KICK_FROM ? 0 : Math.min(options - 1, Math.round(lerp(1, 3, Math.max(0, (climb - 0.1) / 0.9))));
  const margin = n === VISION_KICK_FROM ? 0.3 : lerp(0.4, 0.03, Math.pow(Math.min(1, climb), 0.8));
  const offside = n >= 5 && n % 2 === 1;
  const real = !(n <= 2 || n === VISION_KICK_FROM);
  return { kick, window, letGo, options, traps, margin, offside, real };
}

/**
 * The built-in Aerial curve (21 Oct 2026): headers on odd levels, volleys on
 * even ones; the keeper climbs 20 -> 96 across the 30 levels; the marker
 * joins from level 7; the top three want it placed, not just in. A design
 * curve, not yet measured with a bot (the other five's were).
 */
function aerialDefault(n: number): AerialLevel {
  return {
    volley: n % 2 === 0,
    keeperStrength: lerp(20, 96, (n - 1) / (TRAINING_LEVELS - 1)),
    marker: n >= 7,
    pass: n >= 28 ? lerp(0.6, 0.7, (n - 28) / 2) : 0.5,
    // The jump (Harry, 22 Oct 2026): 1.75 m (no jump) at level 1 up to 2.55 m
    // at 30, which only an Aerial of about 87+ reaches cleanly.
    ballZ: lerp(1.75, 2.55, (n - 1) / (TRAINING_LEVELS - 1)),
  };
}

export function defaultTable(): TrainingTable {
  const t = {} as Record<TrainingSkill, AnyLevel[]>;
  for (const s of TRAINING_SKILLS) t[s] = Array.from({ length: TRAINING_LEVELS }, (_, i) => defaultLevel(s, i + 1));
  return t as TrainingTable;
}

// ── The committed file ─────────────────────────────────────────────────────

export interface TrainingFile {
  /** Shown in the file so nobody edits it by hand without knowing. */
  note?: string;
  levels: Partial<Record<TrainingSkill, unknown[]>>;
}

/** Parse the committed file; any row that is missing or broken is the built-in one. */
export function tableFromFile(file: unknown): TrainingTable {
  const levels = (file && typeof file === "object" ? (file as TrainingFile).levels : undefined) ?? {};
  const t = {} as Record<TrainingSkill, AnyLevel[]>;
  for (const s of TRAINING_SKILLS) {
    const rows = Array.isArray(levels[s]) ? levels[s]! : [];
    t[s] = Array.from({ length: TRAINING_LEVELS }, (_, i) => rows[i] ? sanitizeLevel(s, i + 1, rows[i]) : defaultLevel(s, i + 1));
  }
  return t as TrainingTable;
}

export const FILE_NOTE =
  "Training levels: one row per level, 30 per game. Edited on /star-training-dev (Edit level → Commit). " +
  "Saved edits in the star_training_levels table sit on top of this file.";

/** The committed file as text, stable key order so diffs stay small. */
export function fileText(table: TrainingTable): string {
  const lines: string[] = ["{", `  "note": ${JSON.stringify(FILE_NOTE)},`, `  "levels": {`];
  TRAINING_SKILLS.forEach((s, si) => {
    lines.push(`    ${JSON.stringify(s)}: [`);
    table[s].forEach((row, i) => {
      lines.push(`      ${JSON.stringify(row)}${i < table[s].length - 1 ? "," : ""}`);
    });
    lines.push(`    ]${si < TRAINING_SKILLS.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}", "");
  return lines.join("\n");
}

export interface LevelEdit { skill: TrainingSkill; level: number; config: unknown }

/** Write some edited levels into the committed file's text. Rows not sent
 *  are kept as the file has them. A missing or broken file starts from the
 *  built-in table, so a commit never writes a half-empty file. */
export function mergeTrainingFile(text: string, edits: LevelEdit[]): { text: string; ids: string[] } {
  let parsed: unknown = null;
  try { parsed = text.trim() ? JSON.parse(text) : null; } catch { parsed = null; }
  const table = tableFromFile(parsed);
  const ids: string[] = [];
  for (const e of edits) {
    if (!TRAINING_SKILLS.includes(e.skill)) continue;
    const n = Math.round(e.level);
    if (!(n >= 1 && n <= TRAINING_LEVELS)) continue;
    (table[e.skill] as AnyLevel[])[n - 1] = sanitizeLevel(e.skill, n, e.config);
    ids.push(levelId(e.skill, n));
  }
  return { text: fileText(table), ids };
}

export function levelId(skill: TrainingSkill, level: number): string {
  return `${skill}:${level}`;
}
export function parseLevelId(id: string): { skill: TrainingSkill; level: number } | null {
  const [s, l] = id.split(":");
  const n = Number(l);
  if (!TRAINING_SKILLS.includes(s as TrainingSkill) || !Number.isInteger(n) || n < 1 || n > TRAINING_LEVELS) return null;
  return { skill: s as TrainingSkill, level: n };
}

// ── What the game reads ────────────────────────────────────────────────────

const FILE_TABLE: TrainingTable = tableFromFile(TABLE_JSON);

/** Saved edits (shared table, cached on this device) by levelId. Set by
 *  trainingLevelStore.ts; empty in tests and on the server. */
let overlay: Record<string, unknown> = {};
export function setTrainingOverlay(next: Record<string, unknown>) { overlay = { ...next }; }
export function trainingOverlay(): Record<string, unknown> { return overlay; }

/** The committed row only (no saved edits on top). */
export function committedLevel<S extends TrainingSkill>(skill: S, level: number): LevelBySkill[S] {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  return (FILE_TABLE[skill] as LevelBySkill[S][])[n - 1];
}

/** THE level the game plays: a saved edit, else the committed row. */
export function levelConfig<S extends TrainingSkill>(skill: S, level: number, edits: Record<string, unknown> = overlay): LevelBySkill[S] {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  const saved = edits[levelId(skill, n)];
  // A Vision edit saved before the rebuild is for a drill that is gone: play the committed level.
  if (skill === "vision" && isOldVisionRow(saved)) return committedLevel(skill, n);
  return saved ? sanitizeLevel(skill, n, saved) : committedLevel(skill, n);
}

/** The seed a level's picture is built from (a row may pin its own). */
export function levelSeedOf(skill: TrainingSkill, level: number, cfg: { seed?: number }): number {
  return typeof cfg.seed === "number" ? cfg.seed >>> 0 : levelSeed(skill, level);
}

/**
 * Power, scaled to YOUR Power (Harry, 2 Oct 2026): when your Power stands
 * below the level, three quarters of the gap is taken off by blending this
 * level's row toward the row your Power stands at. At or above it, the row
 * is played as it is. Same rule as powerDrillForLevel, read off the rows.
 */
export const POWER_EASE_SHARE = 0.75;
export function easePowerLevel(level: number, power: number | undefined, rowAt: (n: number) => PowerLevel): PowerLevel {
  const n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)));
  const own = rowAt(n);
  if (power === undefined || !Number.isFinite(power)) return own;
  const atPower = 1 + Math.max(0, Math.min(1, (power - 40) / 60)) * (TRAINING_LEVELS - 1);
  if (atPower >= n) return own;
  const target = n - POWER_EASE_SHARE * (n - atPower);
  const lo = Math.max(1, Math.floor(target)), hi = Math.min(TRAINING_LEVELS, lo + 1), f = target - lo;
  const a = rowAt(lo), b = rowAt(hi);
  const mix = (x: number, y: number) => x + (y - x) * f;
  const easedBlockers = Math.round(mix(a.blockers, b.blockers));
  const eased: PowerLevel = {
    ...own,
    distance: round2(mix(a.distance, b.distance)),
    offset: round2(mix(a.offset, b.offset)),
    blockers: own.blockers > 0 ? Math.max(1, Math.min(own.blockers, easedBlockers)) : 0,
    keeperStrength: round2(Math.min(own.keeperStrength, mix(a.keeperStrength, b.keeperStrength))),
  };
  // Men placed by hand move with the ball: the same spots in the lane, the
  // lane shortened (and turned) about the middle of the goal.
  if (own.men?.length) eased.men = carryMen(own.men, own, eased);
  return eased;
}

/** Hand-placed men, carried from one ball spot to another: scaled and turned
 *  about the middle of the goal line, so each keeps his place in the lane. */
function carryMen(men: Spot[], from: { distance: number; offset: number }, to: { distance: number; offset: number }): Spot[] {
  const fx = from.offset, fy = Math.max(6, from.distance);
  const tx = to.offset, ty = Math.max(6, to.distance);
  const fl = Math.hypot(fx, fy) || 1, tl = Math.hypot(tx, ty) || 1;
  const k = tl / fl;
  const ang = Math.atan2(ty, tx) - Math.atan2(fy, fx);
  const c = Math.cos(ang), sn = Math.sin(ang);
  const goalX = PITCH_W / 2;
  return men.map(m => {
    const rx = m.x - goalX, ry = m.y;
    return { x: round2(goalX + k * (c * rx - sn * ry)), y: round2(Math.max(0.5, k * (sn * rx + c * ry))) };
  });
}

export { levelDifficulty };
