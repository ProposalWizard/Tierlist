import type { Skills } from "./types";
import { TRAINING_LEVELS, levelDifficulty, levelSeed } from "./trainingLevels";
import { techniqueDrill, freeKickDrill, paceDrill, visionDrill, powerDrillForLevel } from "./trainingDrills";
import { VISION_DEFAULTS } from "./visionRound";
import TABLE_JSON from "./data/trainingLevels.json";

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
 */

export type TrainingSkill = keyof Skills;
export const TRAINING_SKILLS: TrainingSkill[] = ["power", "technique", "freeKick", "pace", "vision"];

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
}
export interface FreeKickLevel {
  distance: number;
  offset: number;
  wall: number;
  keeperStrength: number;
  pass: number;
  seed?: number;
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
}
export interface VisionLevel {
  options: number;
  /** Seconds to pick. */
  window: number;
  /** How much more space the right man has than the next one, metres. */
  margin: number;
  /** Defenders on the picture. */
  markers: number;
  /** Share of team-mates standing offside, 0-1. */
  offsideShare: number;
  /** Nobody stands nearer the offside line than this, metres. */
  lineGap: number;
  /** How near a man a tap must land, metres. */
  tapRadius: number;
  seed?: number;
}

export interface LevelBySkill {
  power: PowerLevel;
  technique: TechniqueLevel;
  freeKick: FreeKickLevel;
  pace: PaceLevel;
  vision: VisionLevel;
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
    { key: "options", label: "Team-mates", min: 2, max: 12, step: 1, int: true },
    { key: "window", label: "Seconds to pick", min: 0.5, max: 5, step: 0.05, unit: "s" },
    { key: "margin", label: "Clear man's extra space", min: 0.2, max: 10, step: 0.1, unit: "m" },
    { key: "markers", label: "Defenders", min: 1, max: 14, step: 1, int: true },
    { key: "offsideShare", label: "Share offside", min: 0, max: 0.8, step: 0.05 },
    { key: "lineGap", label: "Closest to the line", min: 0.2, max: 4, step: 0.1, unit: "m" },
    { key: "tapRadius", label: "Tap target size", min: 1.2, max: 4, step: 0.1, unit: "m" },
  ],
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Keep a row inside the editor's limits, fill anything missing from the
 *  built-in row, drop unknown keys. A malformed saved row can never break
 *  a drill. */
export function sanitizeLevel<S extends TrainingSkill>(skill: S, level: number, raw: unknown): LevelBySkill[S] {
  const base = defaultLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
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
  return out as unknown as LevelBySkill[S];
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
 * the old curve stood at 20 to the harder top value at 30.
 *
 * What made the top flat or easy (20 Oct 2026, measured or read):
 *  - Vision: the same picture on all three tries, with the right man lit
 *    after each one, so try 2 was the answer. A modelled player got 99.9%
 *    of levels 20-30. Fixed in the drill (a new picture each try) and here.
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
  } else {
    const c = visionDrill(d, 0);
    const c20 = visionDrill(at20, 0);
    row = {
      options: t > 0 ? Math.round(lerp(c20.options, 11, t)) : c.options,
      window: t > 0 ? lerp(c20.window, 0.85, t) : c.window,
      margin: t > 0 ? lerp(c20.margin, 0.3, t) : c.margin,
      markers: t > 0 ? Math.round(lerp(Math.max(3, Math.round(c20.options * 0.8)), 13, t)) : Math.max(3, Math.round(c.options * 0.8)),
      offsideShare: t > 0 ? lerp(VISION_DEFAULTS.offsideShare, 0.55, t) : VISION_DEFAULTS.offsideShare,
      lineGap: t > 0 ? lerp(VISION_DEFAULTS.lineGap, 0.4, t) : VISION_DEFAULTS.lineGap,
      tapRadius: t > 0 ? lerp(VISION_DEFAULTS.tapRadius, 2.2, t) : VISION_DEFAULTS.tapRadius,
    } satisfies VisionLevel;
  }
  // Round to what the editor shows, so the committed file reads cleanly.
  const out: Record<string, number | boolean> = {};
  const ints = new Set(LEVEL_FIELDS[skill].filter(f => f.int).map(f => f.key));
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "number" ? (ints.has(k) ? Math.round(v) : round2(v)) : v;
  return out as unknown as LevelBySkill[S];
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
  return {
    ...own,
    distance: round2(mix(a.distance, b.distance)),
    offset: round2(mix(a.offset, b.offset)),
    blockers: own.blockers > 0 ? Math.max(1, Math.min(own.blockers, easedBlockers)) : 0,
    keeperStrength: round2(Math.min(own.keeperStrength, mix(a.keeperStrength, b.keeperStrength))),
  };
}

export { levelDifficulty };
