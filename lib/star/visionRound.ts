import { CX } from "./pitch";
import type { TrainingViewport } from "./trainingRender";

/**
 * ONE VISION PICTURE ("Read the Run"), moved out of TrainingMinigame.tsx
 * (20 Oct 2026) so the Training levels page can edit it, a test can check
 * it, and a bot can measure how hard it is. Same picture, same random order:
 * with the old numbers (`VISION_DEFAULTS`) it draws exactly what the drill
 * drew before.
 *
 * Built rather than randomised into existence: mates and markers are thrown
 * down, everyone's space is measured, and then the best onside option is
 * pushed clear until it leads the next-best by `margin`. Big margin: the
 * right ball is obvious. Tiny margin: you are picking between two similar
 * balls with the clock running.
 */

export interface VisionRoundConfig {
  /** Team-mates on offer. */
  options: number;
  /** How much more space the best onside man has than the next one, metres. */
  margin: number;
  /** Defenders on the picture (the decoys you read space against). */
  markers?: number;
  /** Share of team-mates standing beyond the line (offside), 0-1. */
  offsideShare?: number;
  /** Nobody stands nearer the offside line than this, metres. Small = hard to read. */
  lineGap?: number;
}

/** The numbers the drill used before they were editable. */
export const VISION_DEFAULTS = { offsideShare: 0.42, lineGap: 1.5, tapRadius: 3.2 } as const;

export function visionMarkers(cfg: VisionRoundConfig): number {
  return cfg.markers ?? Math.max(3, Math.round(cfg.options * 0.8));
}

export interface VisionMate { x: number; y: number; space: number; onside: boolean; }
export interface VisionRound {
  mates: VisionMate[];
  defenders: { x: number; y: number }[];
  line: number;
  best: number;
  viewport: TrainingViewport;
}

export function buildVisionRound(cfg: VisionRoundConfig, rng: () => number): VisionRound {
  const line = 26 + rng() * 6;
  const n = Math.max(2, Math.round(cfg.options));
  const share = cfg.offsideShare ?? VISION_DEFAULTS.offsideShare;
  const gap = cfg.lineGap ?? VISION_DEFAULTS.lineGap;
  // The frame is decided FIRST and everybody is placed inside it. Doing it
  // the other way round — scatter across the full 68 m pitch, then fit a
  // 5:8 frame to the spread — put half the options off the side of a
  // portrait canvas, where they could neither be read nor tapped.
  const viewW = 34;
  const x1 = CX - viewW / 2, x2 = CX + viewW / 2;
  const viewH = viewW / (5 / 8);
  const y1 = line - 12;
  const y2 = y1 + viewH;
  const spanX = (f: number) => x1 + 3 + f * (viewW - 6);

  const defenders = Array.from({ length: Math.max(1, Math.round(visionMarkers(cfg))) }, () => ({
    x: spanX(rng()),
    y: line + (rng() - 0.5) * 7,
  }));
  const mates: VisionMate[] = Array.from({ length: n }, () => {
    // Some of them run beyond the line — those are the ones you must NOT
    // pick, however much space they are standing in.
    const beyond = rng() < share;
    const y = beyond ? line - gap - rng() * 7 : line + gap + rng() * 11;
    return { x: spanX(rng()), y, space: 0, onside: !beyond };
  });
  const spaceOf = (m: VisionMate) =>
    defenders.reduce((min, d) => Math.min(min, Math.hypot(d.x - m.x, d.y - m.y)), 99);
  for (const m of mates) m.space = spaceOf(m);

  const onside = mates.map((m, i) => ({ m, i })).filter(o => o.m.onside);
  if (onside.length === 0) {
    // Unlikely, but a round with no legal pass is not a round.
    mates[0].onside = true;
    mates[0].y = line + 3;
    mates[0].space = spaceOf(mates[0]);
    onside.push({ m: mates[0], i: 0 });
  }
  onside.sort((a, b) => b.m.space - a.m.space);
  const best = onside[0];
  const runnerUp = onside[1]?.m.space ?? 0;
  // Push the best option clear of the field by the margin — walking it away
  // from its nearest marker rather than teleporting it, so the picture still
  // looks like a real one.
  let guard = 0;
  while (best.m.space < runnerUp + cfg.margin && guard++ < 40) {
    const near = defenders.reduce((a, d) =>
      Math.hypot(d.x - best.m.x, d.y - best.m.y) < Math.hypot(a.x - best.m.x, a.y - best.m.y) ? d : a, defenders[0]);
    const dx = best.m.x - near.x, dy = best.m.y - near.y;
    const l = Math.hypot(dx, dy) || 1;
    // Clamped to the fixed frame, not the whole pitch — the frame is what
    // has to stay readable, and this is the only step that can walk a mate
    // outside it.
    best.m.x = Math.max(x1 + 2, Math.min(x2 - 2, best.m.x + (dx / l) * 0.8));
    best.m.y = Math.max(line + Math.min(1.2, gap), Math.min(y2 - 2, best.m.y + (dy / l) * 0.8));
    best.m.space = spaceOf(best.m);
  }

  return {
    mates, defenders, line, best: best.i,
    viewport: { x1, x2, y1, y2 },
  };
}

/** Which mate a tap at pitch (x, y) picks: the nearest within `radius`, or -1. */
export function visionTapPick(round: VisionRound, x: number, y: number, radius: number): number {
  let bestI = -1, bestD = radius;
  round.mates.forEach((m, i) => {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) { bestD = d; bestI = i; }
  });
  return bestI;
}
