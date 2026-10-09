/**
 * THE 3D CASINO'S CAMERA LIMIT (Casino look: New). Harry, 9 Oct 2026, on his
 * iPhone: "the camera got too close and sat inside the lamp; there is no
 * camera limit" — the follow camera only clamped x/z to the room, so it went
 * through chandeliers, and one bulb filled the screen.
 *
 * The camera's boom runs from his head out to where the camera wants to be.
 * Walk it in small steps; the first step that is inside a wall margin, too
 * near the ceiling, or inside a chandelier's keep-out ball ends it there.
 * Pure (no three.js): tests/star/casino3dCamera.mts.
 */
export type V3 = [number, number, number];

/** Keep-out round each chandelier (metres from its centre). */
export const LAMP_KEEP_OUT = 1.05;
/** Keep the camera this far inside the walls. */
export const WALL_MARGIN = 0.35;
/** And this far under the ceiling. */
export const CEILING_MARGIN = 0.35;
/** Never closer to his head than this (the boom can shorten no further). */
export const MIN_BOOM = 1.1;

export interface Room { x: number; z: number; h: number }

const free = (p: V3, room: Room, lamps: V3[]): boolean => {
  if (Math.abs(p[0]) > room.x - WALL_MARGIN || Math.abs(p[2]) > room.z - WALL_MARGIN) return false;
  if (p[1] > room.h - CEILING_MARGIN || p[1] < 0.4) return false;
  for (const l of lamps) if (Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]) < LAMP_KEEP_OUT) return false;
  return true;
};

/**
 * Where the camera may sit: `want` if the whole boom from `head` is clear,
 * else the last clear point along it (never nearer than MIN_BOOM; if even
 * that is blocked, that point dropped under the lamps).
 */
export function clampBoom(head: V3, want: V3, room: Room, lamps: V3[], steps = 32): V3 {
  const d: V3 = [want[0] - head[0], want[1] - head[1], want[2] - head[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return want;
  let best: V3 | null = null;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p: V3 = [head[0] + d[0] * t, head[1] + d[1] * t, head[2] + d[2] * t];
    if (!free(p, room, lamps)) break;
    best = p;
  }
  const minT = Math.min(1, MIN_BOOM / len);
  if (best && Math.hypot(best[0] - head[0], best[1] - head[1], best[2] - head[2]) >= MIN_BOOM - 1e-6) return best;
  // too short: the near point, lowered until it is out of every lamp's ball
  const p: V3 = [head[0] + d[0] * minT, head[1] + d[1] * minT, head[2] + d[2] * minT];
  const mx = room.x - WALL_MARGIN, mz = room.z - WALL_MARGIN;
  p[0] = Math.max(-mx, Math.min(mx, p[0])); p[2] = Math.max(-mz, Math.min(mz, p[2]));
  p[1] = Math.min(p[1], room.h - CEILING_MARGIN);
  for (let k = 0; k < 20 && !free(p, room, lamps); k++) p[1] -= 0.1;
  return p;
}

/** How visible a glow halo should be with the camera `dist` metres from it: gone inside 1.2 m, full past 2.6 m. */
export function haloFade(dist: number): number {
  return Math.max(0, Math.min(1, (dist - 1.2) / 1.4));
}
