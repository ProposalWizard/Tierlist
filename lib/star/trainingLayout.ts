import { CX } from "./pitch";
import { mulberry32 } from "./season";
import {
  strikeSpot, conePositions, powerManSpots, wallSpots, placedMen, techniqueBallSpot,
} from "./trainingDrills";
import {
  LEVEL_FIELDS, levelSeedOf, PACE_LANE_HALF,
  type AnyLevel, type LevelBySkill, type Spot, type TrainingSkill,
  type TechniqueLevel, type PaceLevel,
} from "./trainingLevelData";
import { newRun, START_Y, CLEAR_Y, CORRIDOR_HALF } from "./firstPersonDribble";
import type { TrainingSceneOptions, TrainingViewport } from "./trainingRender";

/**
 * DRAG A TRAINING LEVEL ABOUT (Harry, 20 Oct 2026: "the training editor
 * should be drag and drop like the gallery").
 *
 * One place lists, per drill, what can be dragged on the level's picture and
 * what a drag changes in the level's numbers. The Training levels page draws
 * the picture from `layout` and calls `move` while a finger drags. Nothing
 * here touches the engine: it only edits the level's row, and the drill
 * builds the same picture from that row.
 *
 *   Power      the ball (distance, off centre) and each man in the way
 *   Technique  the ball, either cone (gap and distance) and the whole gate
 *   Free kick  the ball and each man in the wall
 *   Pace       each man, across his own wave's line (the gaps you run into)
 *   Vision     not yet — it is being rebuilt (B12). Add an entry here and
 *              the page picks it up.
 */

export interface LayoutHandle {
  /** "ball", "man-2", "coneL", "gate", "w1-0" (pace: wave 1, man 0)… */
  id: string;
  /** What the screen calls it ("the ball", "man 2"). */
  label: string;
  at: Spot;
  kind: "ball" | "man" | "cone" | "gate";
  /** "x": slides across only (Pace men stay on their wave's line). */
  axis?: "x";
}

export interface LevelLayout {
  viewport: TrainingViewport;
  /** What renderTrainingScene draws (everything but the viewport). */
  scene: Omit<TrainingSceneOptions, "viewport">;
  handles: LayoutHandle[];
  /** Extra lines the page draws on top: Pace's corridor and finish line. */
  lines?: { from: Spot; to: Spot; tone: "edge" | "finish" }[];
}

export interface DrillLayoutSpec<S extends TrainingSkill> {
  layout(row: LevelBySkill[S], level: number): LevelLayout;
  /** The row with handle `id` moved to `to` (pitch metres). */
  move(row: LevelBySkill[S], level: number, id: string, to: Spot): LevelBySkill[S];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
function limitOf(skill: TrainingSkill, key: string): { min: number; max: number } {
  const f = LEVEL_FIELDS[skill].find(x => x.key === key)!;
  return { min: f.min, max: f.max };
}
function within(skill: TrainingSkill, key: string, v: number): number {
  const { min, max } = limitOf(skill, key);
  return round2(Math.max(min, Math.min(max, v)));
}

/** A 5:8 (width:height) window holding every point, with room round the edge. */
export function fitViewport(points: Spot[], pad = 4, minH = 30): TrainingViewport {
  let x1 = Math.min(...points.map(p => p.x)) - pad, x2 = Math.max(...points.map(p => p.x)) + pad;
  let y1 = Math.min(...points.map(p => p.y)) - pad, y2 = Math.max(...points.map(p => p.y)) + pad;
  let h = Math.max(minH, y2 - y1, (x2 - x1) * 8 / 5);
  const w = h * 5 / 8;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  x1 = cx - w / 2; x2 = cx + w / 2;
  y1 = cy - h / 2; y2 = cy + h / 2;
  if (y1 < -3) { y2 += -3 - y1; y1 = -3; }
  h = y2 - y1;
  return { x1, x2, y1, y2 };
}

const men = (spots: Spot[], prefix = "man"): LayoutHandle[] =>
  spots.map((at, i) => ({ id: `${prefix}-${i}`, label: `man ${i + 1}`, at, kind: "man" as const }));
const manIndex = (id: string) => Number(id.split("-")[1]);

// ── Power ─────────────────────────────────────────────────────────────────
const power: DrillLayoutSpec<"power"> = {
  layout(row) {
    const ball = strikeSpot(row.distance, row.offset);
    const spots = placedMen(powerManSpots(ball, row.blockers), row.men, row.blockers);
    const keeper = row.keeper ? { x: CX, y: 1.2 } : null;
    return {
      viewport: fitViewport([ball, { x: CX - 4, y: 0 }, { x: CX + 4, y: 0 }, ...spots]),
      scene: { goal: true, keeper, defenders: spots, you: { x: ball.x, y: ball.y + 0.8 }, ball: { ...ball, z: 0 } },
      handles: [{ id: "ball", label: "the ball", at: ball, kind: "ball" }, ...men(spots)],
    };
  },
  move(row, _level, id, to) {
    if (id === "ball") return { ...row, distance: within("power", "distance", to.y), offset: within("power", "offset", to.x - CX) };
    const ball = strikeSpot(row.distance, row.offset);
    const spots = placedMen(powerManSpots(ball, row.blockers), row.men, row.blockers).map(s => ({ x: round2(s.x), y: round2(s.y) }));
    spots[manIndex(id)] = { x: round2(to.x), y: round2(Math.max(0.5, to.y)) };
    return { ...row, men: spots };
  },
};

// ── Free kick ─────────────────────────────────────────────────────────────
const freeKick: DrillLayoutSpec<"freeKick"> = {
  layout(row) {
    const ball = strikeSpot(row.distance, row.offset);
    const spots = placedMen(wallSpots(ball, row.wall), row.men, row.wall);
    return {
      viewport: fitViewport([ball, { x: CX - 4, y: 0 }, { x: CX + 4, y: 0 }, ...spots]),
      scene: { goal: true, keeper: { x: CX, y: 1.2 }, defenders: spots, you: { x: ball.x, y: ball.y + 0.8 }, ball: { ...ball, z: 0 } },
      handles: [{ id: "ball", label: "the ball", at: ball, kind: "ball" }, ...men(spots)],
    };
  },
  move(row, _level, id, to) {
    if (id === "ball") return { ...row, distance: within("freeKick", "distance", to.y), offset: within("freeKick", "offset", to.x - CX) };
    const ball = strikeSpot(row.distance, row.offset);
    const spots = placedMen(wallSpots(ball, row.wall), row.men, row.wall).map(s => ({ x: round2(s.x), y: round2(s.y) }));
    spots[manIndex(id)] = { x: round2(to.x), y: round2(Math.max(0.5, to.y)) };
    return { ...row, men: spots };
  },
};

// ── Technique ─────────────────────────────────────────────────────────────
const technique: DrillLayoutSpec<"technique"> = {
  layout(row) {
    const ball = techniqueBallSpot(row);
    const gate = conePositions(ball, row);
    return {
      viewport: fitViewport([ball, gate.left, gate.right], 5, 26),
      scene: { goal: false, gate, you: { x: ball.x, y: ball.y + 0.8 }, ball: { ...ball, z: 0 } },
      handles: [
        { id: "ball", label: "the ball", at: ball, kind: "ball" },
        { id: "coneL", label: "the left cone", at: gate.left, kind: "cone" },
        { id: "coneR", label: "the right cone", at: gate.right, kind: "cone" },
        { id: "gate", label: "the gate", at: gate.centre, kind: "gate" },
      ],
    };
  },
  move(row, _level, id, to) {
    const ball = techniqueBallSpot(row);
    const gate = conePositions(ball, row);
    // Keep the gate where it stands and work its numbers out from the ball;
    // the ball is pinned where it is, so moving the gate never moves it.
    const gateAt = (b: Spot, centre: Spot, width: number): TechniqueLevel => ({
      ...row,
      ball: { x: round2(b.x), y: round2(b.y) },
      gateDistance: within("technique", "gateDistance", b.y - centre.y),
      gateOffset: within("technique", "gateOffset", centre.x - b.x),
      gateWidth: within("technique", "gateWidth", width),
    });
    if (id === "ball") {
      const b = { x: round2(Math.max(3, Math.min(65, to.x))), y: round2(Math.max(8, Math.min(46, to.y))) };
      return { ...gateAt(b, gate.centre, row.gateWidth), ball: b };
    }
    if (id === "gate") return gateAt(ball, to, row.gateWidth);
    const other = id === "coneL" ? gate.right : gate.left;
    const width = Math.abs(other.x - to.x);
    return gateAt(ball, { x: (other.x + to.x) / 2, y: to.y }, width);
  },
};

// ── Pace ──────────────────────────────────────────────────────────────────
export function paceWaveSizes(row: PaceLevel): number[] {
  const out: number[] = [];
  const max = Math.max(1, row.waveMax);
  for (let left = row.chasers; left > 0; left -= max) out.push(Math.min(max, left));
  return out;
}
/** Where the drill stands every man, from the level's own seed and any placed lanes. */
export function paceMen(row: PaceLevel, level: number): { x: number; y: number; wave: number; index: number }[] {
  const s = newRun({
    pace: row.runPace, oppStrength: row.oppStrength, waveSizes: paceWaveSizes(row),
    rng: mulberry32(levelSeedOf("pace", level, row)), lanes: row.lanes,
  });
  const seen: number[] = [];
  return s.defenders.map(d => {
    const index = seen[d.round] ?? 0;
    seen[d.round] = index + 1;
    return { x: d.x, y: d.y, wave: d.round, index };
  });
}
const pace: DrillLayoutSpec<"pace"> = {
  layout(row, level) {
    const all = paceMen(row, level);
    const you = { x: CX, y: START_Y };
    const top = Math.min(CLEAR_Y, ...all.map(m => m.y));
    return {
      viewport: fitViewport([you, { x: CX - CORRIDOR_HALF, y: top }, { x: CX + CORRIDOR_HALF, y: top }], 3.5, 30),
      scene: { goal: false, defenders: all.map(m => ({ x: m.x, y: m.y, awake: true })), you, ball: { x: CX, y: START_Y - 0.9, z: 0 } },
      handles: all.map(m => ({ id: `w${m.wave}-${m.index}`, label: `wave ${m.wave + 1}, man ${m.index + 1}`, at: { x: m.x, y: m.y }, kind: "man" as const, axis: "x" as const })),
      lines: [
        { from: { x: CX - CORRIDOR_HALF, y: top - 2 }, to: { x: CX - CORRIDOR_HALF, y: START_Y + 2 }, tone: "edge" },
        { from: { x: CX + CORRIDOR_HALF, y: top - 2 }, to: { x: CX + CORRIDOR_HALF, y: START_Y + 2 }, tone: "edge" },
        { from: { x: CX - CORRIDOR_HALF, y: CLEAR_Y }, to: { x: CX + CORRIDOR_HALF, y: CLEAR_Y }, tone: "finish" },
      ],
    };
  },
  move(row, level, id, to) {
    const all = paceMen(row, level);
    const sizes = paceWaveSizes(row);
    const lanes = sizes.map((n, w) => Array.from({ length: n }, (_, i) => {
      const m = all.find(a => a.wave === w && a.index === i);
      return round2((m?.x ?? CX) - CX);
    }));
    const [w, i] = id.slice(1).split("-").map(Number);
    if (lanes[w] && i < lanes[w].length) lanes[w][i] = round2(Math.max(-PACE_LANE_HALF, Math.min(PACE_LANE_HALF, to.x - CX)));
    return { ...row, lanes };
  },
};

/** The drills you can drag about, by skill. Vision: not yet (being rebuilt). */
export const DRILL_LAYOUTS: { [S in TrainingSkill]?: DrillLayoutSpec<S> } = { power, technique, freeKick, pace };

/** The picture and handles for any drill that has a layout, else null. */
export function levelLayout(skill: TrainingSkill, row: AnyLevel, level: number): LevelLayout | null {
  const spec = DRILL_LAYOUTS[skill] as DrillLayoutSpec<TrainingSkill> | undefined;
  return spec ? spec.layout(row as never, level) : null;
}

/** Move one handle; the row unchanged for a drill with no layout. */
export function moveHandle(skill: TrainingSkill, row: AnyLevel, level: number, id: string, to: Spot): AnyLevel {
  const spec = DRILL_LAYOUTS[skill] as DrillLayoutSpec<TrainingSkill> | undefined;
  return spec ? (spec.move(row as never, level, id, to) as AnyLevel) : row;
}

