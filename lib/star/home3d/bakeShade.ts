/**
 * THE FLOOR'S BAKED SHADE (Harry, 20 Nov 2026: "the lighting and contrast is a bit much at times";
 * the weak point: "no baked light, rooms use a painted corner shade"). When a living room is built,
 * its floor gets one shade picture worked out from what is really in it: soft and dark right where a
 * wall meets the floor, and under and round every solid thing (the sofa, the bed, the cabinets, the
 * kitchen island), fading out over a hand's width. It is laid over the floor as one see-through
 * plane, so it costs nothing a frame: it is computed once, here, while the room is built (a few ms).
 *
 * tools/bake3d's real light bake needs Blender and a fixed set; the rooms are built in code from the
 * career, so this is the cheap equivalent. Pure: an alpha grid; the canvas is the caller's.
 */
import type { Box2 } from "./roomBuild";
import type { Wall } from "./rooms";

export interface FloorShade { nx: number; nz: number; alpha: Float32Array }

/** How dark it gets (0..1 of black): at a wall's foot, and at the edge of a solid thing. */
export const SHADE_WALL = 0.42;
export const SHADE_UNDER = 0.5;
/** How far it spreads (m): from a wall, and out from under a thing. */
export const SPREAD_WALL = 0.5;
export const SPREAD_UNDER = 0.22;

/** Box-blur a grid in place, radius r cells, along x then z. */
function blur(a: Float32Array, nx: number, nz: number, r: number) {
  if (r < 1) return;
  const t = new Float32Array(a.length);
  for (let z = 0; z < nz; z++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[z * nx + Math.max(0, Math.min(nx - 1, x))];
    for (let x = 0; x < nx; x++) {
      t[z * nx + x] = s / (2 * r + 1);
      s += a[z * nx + Math.min(nx - 1, x + r + 1)] - a[z * nx + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < nx; x++) {
    let s = 0;
    for (let z = -r; z <= r; z++) s += t[Math.max(0, Math.min(nz - 1, z)) * nx + x];
    for (let z = 0; z < nz; z++) {
      a[z * nx + x] = s / (2 * r + 1);
      s += t[Math.min(nz - 1, z + r + 1) * nx + x] - t[Math.max(0, z - r) * nx + x];
    }
  }
}

/**
 * The shade over a room's floor (w by d metres, centred on 0,0): `solids` are the footprints of the
 * things on it, `open` the sides with no wall (a terrace). Cell (i, j) covers x = -w/2 + (i + .5) * cell.
 */
export function floorShade(w: number, d: number, solids: Box2[], open: Wall[] = [], cell = 0.04): FloorShade {
  const nx = Math.max(8, Math.round(w / cell)), nz = Math.max(8, Math.round(d / cell));
  const cx = w / nx, cz = d / nz;
  // under things: how covered each cell is, then spread out softly (twice: a rounder fall-off)
  const under = new Float32Array(nx * nz);
  for (const [x0, x1, z0, z1] of solids) {
    const i0 = Math.max(0, Math.floor((x0 + w / 2) / cx)), i1 = Math.min(nx - 1, Math.ceil((x1 + w / 2) / cx) - 1);
    const j0 = Math.max(0, Math.floor((z0 + d / 2) / cz)), j1 = Math.min(nz - 1, Math.ceil((z1 + d / 2) / cz) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) under[j * nx + i] = 1;
  }
  const r = Math.max(1, Math.round(SPREAD_UNDER / 2 / Math.min(cx, cz)));
  blur(under, nx, nz, r);
  blur(under, nx, nz, r);
  const alpha = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = -d / 2 + (j + 0.5) * cz;
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + (i + 0.5) * cx;
      // the walls: the nearest closed one, a smooth fall-off
      let wall = 0;
      const dists: [Wall, number][] = [["n", z + d / 2], ["s", d / 2 - z], ["w", x + w / 2], ["e", w / 2 - x]];
      for (const [wl, dist] of dists) {
        if (open.includes(wl)) continue;
        const t = Math.max(0, 1 - dist / SPREAD_WALL);
        wall = Math.max(wall, t * t);
      }
      // under a thing: dark at its edge, a little lighter deep under it (light gets in under legs)
      const u = under[j * nx + i];
      const und = u > 0.5 ? 1 - (u - 0.5) * 0.5 : u * 2;
      const a = 1 - (1 - SHADE_WALL * wall) * (1 - SHADE_UNDER * Math.min(1, und));
      alpha[j * nx + i] = a;
    }
  }
  return { nx, nz, alpha };
}
