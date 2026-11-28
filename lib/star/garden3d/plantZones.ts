/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GARDEN'S PLANTS, IN ZONES (28 Nov 2026). Every tree and bush is cut into a few zones (the
 * garden's four quarters, and the ring of trees outside the boundary in twelve slices). Each zone
 * is ONE draw: all its trees and bushes joined, one shared material (./lowPolyTrees.ts).
 *
 *   - A zone the camera can't see is not drawn at all (three's own frustum check works here,
 *     because each zone's bounds are tight; one big mesh or one instanced set spread over the whole
 *     garden always "touches" the view, so it was drawn even when every tree was behind you).
 *   - Each zone holds its trees three times, near / middle / far detail, one after another in the
 *     same buffer; the zone draws only the range its distance asks for. Nothing is loaded or thrown
 *     away as you turn (no hitches): it only changes which part of a buffer is drawn.
 *   - A zone wholly hidden behind the shop or the casino (every corner of its box out of sight
 *     behind one of them) is left out of the picture too (`behind()`, handed to
 *     three3d/tightCull.ts, which also skips zones outside the view by their real box). It still
 *     casts its shadow: it is only out while three sorts what to draw.
 *   - Shadows always come from the middle detail (stable, so the kept shadow picture stays right).
 */
import { addBush, addTree, binGeometry, newBin, placeSince, plantMaterial, type Bin, type Lod, type TreeShape, type TreeStyle } from "./lowPolyTrees";
import { addCardBush, addCardTree, cardGeometry, newCardBin, placeCardsSince, type CardBin } from "./cardTrees";
import type { Quality3d } from "../three3d/quality";

/** The garden's trees: "cards" (the scanned-leaf look, ./cardTrees.ts; the default) or a low-poly style (?trees=facet). */
export type PlantStyle = TreeStyle | "cards";

export interface TreeAt { x: number; z: number; s: number; ry: number; h: number; w: number; shape: TreeShape; seed: number; light?: string; dark?: string; tint?: string }
export interface BushAt { x: number; z: number; s: number; seed: number; light?: string; dark?: string; tint?: string }

/** From this many metres a zone draws its middle detail, and from this many its far detail. */
export const LOD_DIST: Record<Quality3d, [number, number]> = {
  high: [22, 55],
  medium: [12, 40],
  low: [6, 24],
};

/** The textured trees' distances: on Low always the far level (40 sprays), as asked (28 Nov 2026). */
export const CARD_LOD_DIST: Record<Quality3d, [number, number]> = {
  high: [22, 55],
  medium: [12, 40],
  low: [0, 0],
};

/** Which zone a spot is in: four quarters inside `inner` m of the middle, twelve slices of the ring outside. */
export function zoneOf(x: number, z: number, inner = 20): string {
  if (Math.hypot(x, z) < inner) return `in${x < 0 ? "W" : "E"}${z < 0 ? "N" : "S"}`;
  const a = Math.atan2(z, x);
  return `ring${Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 12}`;
}

/** Pick a detail level from a distance (pure; the budget test reads it). */
export function lodFor(dist: number, tier: Quality3d, table: Record<Quality3d, [number, number]> = LOD_DIST): Lod {
  const [a, b] = table[tier];
  return dist < a ? 0 : dist < b ? 1 : 2;
}

/** An axis box that hides what is behind it (a building). */
export interface Occluder { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/** Every corner of a box (`corners`) seen from `eye` is behind `occ`: each line of sight crosses it. */
export function hiddenBehind(eye: number[], corners: number[][], occ: Occluder): boolean {
  const lo = [occ.x0, occ.y0, occ.z0], hi = [occ.x1, occ.y1, occ.z1];
  for (const c of corners) {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = c[k] - eye[k];
      if (Math.abs(d) < 1e-9) { if (eye[k] < lo[k] || eye[k] > hi[k]) return false; continue; }
      let a = (lo[k] - eye[k]) / d, b = (hi[k] - eye[k]) / d;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false; // this corner's line misses the box: the corner is seen
    }
    if (t1 >= 1) return false; // the corner is inside the box itself
  }
  return true;
}

interface Zone { mesh: any; ranges: [number, number][]; box: number[]; corners: number[][]; lod: Lod; tris: number[]; hidden: boolean }

export function buildPlantZones(T: any, trees: TreeAt[], bushes: BushAt[], o: { style: PlantStyle; occluders?: Occluder[]; cardMaterial?: any }) {
  const cards = o.style === "cards";
  if (cards && !o.cardMaterial) throw new Error("plantZones: the textured trees need their material (cardTrees.ts cardMaterial)");
  const material = cards ? o.cardMaterial : plantMaterial(T);
  const dist = cards ? CARD_LOD_DIST : LOD_DIST;
  const group = new T.Group();
  group.name = "plants";
  group.userData.kind = "plants";
  const byZone = new Map<string, { trees: TreeAt[]; bushes: BushAt[] }>();
  for (const t of trees) { const k = zoneOf(t.x, t.z); if (!byZone.has(k)) byZone.set(k, { trees: [], bushes: [] }); byZone.get(k)!.trees.push(t); }
  for (const b of bushes) { const k = zoneOf(b.x, b.z); if (!byZone.has(k)) byZone.set(k, { trees: [], bushes: [] }); byZone.get(k)!.bushes.push(b); }
  const zones: Zone[] = [];
  byZone.forEach((list, name) => {
    const bin: Bin | CardBin = cards ? newCardBin() : newBin();
    const ranges: [number, number][] = [];
    const tris: number[] = [];
    for (const lod of [0, 1, 2] as Lod[]) {
      const start = bin.p.length / 3;
      for (const t of list.trees) {
        const from = bin.p.length / 9;
        if (cards) {
          addCardTree(T, bin as CardBin, { h: t.h, w: t.w, pine: t.shape === "pine", seed: t.seed, tint: t.tint, lod });
          placeCardsSince(bin as CardBin, from, t.x, 0, t.z, t.s, t.ry);
        } else {
          addTree(T, bin, { h: t.h, w: t.w, shape: t.shape, seed: t.seed, style: o.style as TreeStyle, lod, light: t.light, dark: t.dark });
          placeSince(bin, from, t.x, 0, t.z, t.s, t.ry);
        }
      }
      for (const b of list.bushes) {
        if (cards) addCardBush(T, bin as CardBin, { x: b.x, z: b.z, s: b.s, seed: b.seed, lod, tint: b.tint });
        else addBush(T, bin, { ...b, style: o.style as TreeStyle, lod });
      }
      ranges.push([start, bin.p.length / 3 - start]);
      tris.push((bin.p.length / 3 - start) / 3);
    }
    const geo = cards ? cardGeometry(T, bin as CardBin) : binGeometry(T, bin);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const mesh = new T.Mesh(geo, material);
    mesh.name = `plants-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = "plants";
    // cut-out leaves: the shadow is cut out by the leaves, not the card
    if (material.userData?.depth) { mesh.customDepthMaterial = material.userData.depth; mesh.customDistanceMaterial = material.userData.distance; }
    const z: Zone = {
      mesh, ranges, lod: 1, tris, hidden: false,
      box: [bb.min.x, bb.max.x, bb.min.z, bb.max.z],
      corners: [bb.min.x, bb.max.x].flatMap((x) => [bb.min.y, bb.max.y].flatMap((y) => [bb.min.z, bb.max.z].map((zz) => [x, y, zz]))),
    };
    const set = (lod: Lod) => { const [s, c] = z.ranges[lod]; geo.setDrawRange(s, c); };
    set(1);
    // the shadow always from one fixed detail (the kept shadow picture stays right): the textured trees
    // from the near one (a coarser crown shades itself darker than the old tree did), the low-poly from the middle
    const shadowLod: Lod = cards ? 0 : 1;
    mesh.onBeforeShadow = () => set(shadowLod);
    mesh.onAfterShadow = () => set(z.lod);
    zones.push(z);
    group.add(mesh);
  });
  let tick = 0;
  return {
    group,
    material,
    zones: zones.length,
    /** Each frame: pick each zone's detail by its distance from the camera, and which are behind a building. */
    update(camera: any, tier: Quality3d) {
      const e = camera.position;
      const eye = [e.x, e.y, e.z];
      const occ = o.occluders?.length && (tick++ % 4 === 0); // the hidden test every 4th frame is plenty
      for (const z of zones) {
        const dx = Math.max(z.box[0] - e.x, 0, e.x - z.box[1]), dz = Math.max(z.box[2] - e.z, 0, e.z - z.box[3]);
        const lod = lodFor(Math.hypot(dx, dz), tier, dist);
        if (lod !== z.lod) { z.lod = lod; z.mesh.geometry.setDrawRange(z.ranges[lod][0], z.ranges[lod][1]); }
        if (occ) z.hidden = o.occluders!.some((b) => hiddenBehind(eye, z.corners, b));
      }
    },
    /** The zones wholly behind a building now (for three3d/tightCull.ts extraHide). */
    behind() { return zones.filter((z) => z.hidden).map((z) => z.mesh); },
    /** Each zone's name, detail now, hidden or not, and triangles per detail. */
    stats() { return zones.map((z) => ({ name: z.mesh.name, lod: z.lod, hidden: z.hidden, tris: z.tris })); },
    dispose() { for (const z of zones) z.mesh.geometry.dispose(); material.dispose(); },
  };
}
