/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HOUSE PLANTS WITH REAL LEAVES (Harry, 20 Nov 2026, on the faceted green egg in a pot: "one
 * thing that is constantly bugging me is this damn tree feature, I hate it. There must be a way
 * to have low polygon trees and leafs"). Four plants built in code, each under ~600 triangles:
 *
 *   snake     upright blades, banded dark and light green (a snake plant)
 *   monstera  big split leaves on long stems, fanning out
 *   fiddle    a thin trunk with broad oval leaves up it (a fiddle-leaf fig)
 *   palm      a few arching fronds of narrow leaflets
 *
 * Every leaf is its own thin curved blade (smooth-shaded, both sides drawn), in two or three
 * greens, on a visible stem, in a pot (ceramic, terracotta or charcoal) with soil. Everything is
 * painted in vertex colours and goes into the room's ONE plant draw (roomBuild.ts plantBin).
 * Seeded: the same spot always grows the same plant.
 */

export type PlantKind = "snake" | "monstera" | "fiddle" | "palm";
export const PLANT_KINDS: PlantKind[] = ["monstera", "snake", "fiddle", "palm"];

export interface PlantPart { geo: any; colour: string }

const GREENS = ["#2e6a35", "#3f8a46", "#57a35a", "#24552c"];

/** A seeded random from a number. */
function rnd(seed: number) { let s = (Math.floor(Math.abs(seed) * 9973) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/**
 * One leaf blade: a strip from its base (origin) along +y bending towards +z, `len` long,
 * `wid` at its widest, `seg` steps along and `cols` across each half, its width shaped by `shape`.
 * Across, the blade cups gently (a curve, not a V), so it reads round in any light. Split leaves
 * (monstera) cut slits from the edge in towards the midrib on alternate steps (the inner part stays).
 */
function blade(THREE: any, len: number, wid: number, bend: number, seg: number, shape: (t: number) => number, splits = 0, cols = 1): any {
  const pos: number[] = [];
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = bend * t;
    // the spine: up and over
    pts.push([0, Math.sin(Math.PI / 2 - a * 0.9) * len * t, (1 - Math.cos(a)) * len * 0.6 * t + Math.sin(a) * len * 0.35 * t]);
  }
  const cup = 0.16;
  const P = (i: number, side: number, u: number): [number, number, number] => {
    const w = (wid * shape(i / seg)) / 2, [x, y, z] = pts[i];
    return [x + side * w * u, y - w * cup * u * u, z + w * cup * 0.5 * u * u];
  };
  for (let i = 0; i < seg; i++) {
    for (const side of [-1, 1]) {
      const slit = splits && i > 1 && i < seg - 1 && (i + (side > 0 ? 0 : 1)) % 2 === 0;
      for (let j = 0; j < cols; j++) {
        const u0 = j / cols, u1 = (j + 1) / cols;
        if (slit && u0 >= 0.45) continue; // a slit: the outer part gone, the inner part stays
        const a = P(i, side, u0), b = P(i + 1, side, u0), c = P(i + 1, side, u1), d = P(i, side, u1);
        if (side < 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A broad heart-ish leaf outline: wide near the base, round shoulders, a short soft tip. */
const heart = (t: number) => (t < 0.32 ? 0.62 + 0.38 * Math.sin((t / 0.32) * Math.PI / 2) : Math.pow(Math.cos(((t - 0.32) / 0.68) * Math.PI / 2), 0.62));
/** An oval leaflet with a rounded end (the palm: soft, not spiky). */
const oval = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.9)), 0.5);

const at = (THREE: any, g: any, x: number, y: number, z: number, rx: number, ry: number, rz: number, s = 1) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), new THREE.Vector3(s, s, s)));
  return g;
};

/** A stem: a thin tapered tube (5 sides) from a to b. */
function stem(THREE: any, a: [number, number, number], b: [number, number, number], r0: number, r1: number) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r1, r0, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va, q, new THREE.Vector3(1, 1, 1)));
  return g.toNonIndexed();
}

/** The parts of one plant in a pot, standing at the origin, about `h` tall. */
export function plantParts(THREE: any, kind: PlantKind, seed: number, h = 1.3, pot: string | null = "#e9e4da"): PlantPart[] {
  const r = rnd(seed + 1);
  const out: PlantPart[] = [];
  const green = () => GREENS[Math.floor(r() * 3)];
  // the pot: a tapered cylinder, a rim, the soil (none: planted in the ground, a tree)
  const potH = pot === null ? 0.03 : Math.min(0.42, h * 0.3), potR = kind === "palm" ? 0.24 : 0.2;
  if (pot !== null) out.push({ geo: new THREE.CylinderGeometry(potR, potR * 0.78, potH, 12, 1, true).translate(0, potH / 2, 0).toNonIndexed(), colour: pot });
  if (pot !== null) out.push({ geo: new THREE.TorusGeometry(potR - 0.005, 0.018, 3, 12).rotateX(Math.PI / 2).translate(0, potH, 0).toNonIndexed(), colour: pot });
  if (pot !== null) out.push({ geo: new THREE.CircleGeometry(potR - 0.02, 12).rotateX(-Math.PI / 2).translate(0, potH - 0.03, 0).toNonIndexed(), colour: "#3b2a1e" });
  const top = potH - 0.03;
  const leafH = h - potH;
  if (kind === "snake") {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.5, off = 0.03 + r() * 0.09;
      const len = leafH * (0.65 + r() * 0.4);
      const g = blade(THREE, len, 0.075 + r() * 0.03, 0.25 + r() * 0.2, 4, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.55));
      out.push({ geo: at(THREE, g, Math.sin(ang) * off, top, Math.cos(ang) * off, 0, ang, 0), colour: i % 3 === 0 ? "#6f9a4a" : i % 2 ? "#2a5a32" : "#3c7a3e" });
    }
  } else if (kind === "monstera") {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.6;
      const sl = leafH * (0.45 + r() * 0.35), tilt = 0.35 + r() * 0.4;
      const base: [number, number, number] = [0, top, 0];
      const tip: [number, number, number] = [Math.sin(ang) * sl * Math.sin(tilt), top + sl * Math.cos(tilt), Math.cos(ang) * sl * Math.sin(tilt)];
      out.push({ geo: stem(THREE, base, tip, 0.012, 0.008), colour: "#3f7a3a" });
      // a heart-shaped leaf, split from the edge in towards the midrib (the monstera's holes)
      const g = blade(THREE, 0.36 + r() * 0.1, 0.48 + r() * 0.1, 0.7 + r() * 0.35, 8, heart, 1, 2);
      out.push({ geo: at(THREE, g, tip[0], tip[1], tip[2], 0.25 + tilt * 0.6, ang, 0), colour: ["#2e6a35", "#24552c", "#357a3c"][i % 3] });
    }
  } else if (kind === "fiddle") {
    const trunkTop = top + leafH * 0.95;
    out.push({ geo: stem(THREE, [0, top, 0], [0.02, trunkTop, -0.02], 0.022, 0.012), colour: "#6b4a32" });
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = 0.3 + (i / n) * 0.7, ang = i * 2.4 + r() * 0.3;
      const y = top + leafH * t;
      const g = blade(THREE, 0.22 + r() * 0.06, 0.17 + r() * 0.04, 0.8 + r() * 0.5, 3, (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)), 0.7));
      out.push({ geo: at(THREE, g, Math.sin(ang) * 0.03, y, Math.cos(ang) * 0.03, 0.9 + r() * 0.4, ang, 0), colour: green() });
    }
  } else {
    const trunkTop = top + leafH * 0.55;
    out.push({ geo: stem(THREE, [0, top, 0], [0.03, trunkTop, 0.02], 0.045, 0.03), colour: "#7a5a3a" });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.4;
      // a frond: a rib with leaflets down both sides (each a narrow blade)
      const fl = leafH * (0.55 + r() * 0.2);
      const rib = blade(THREE, fl * 0.74, 0.02, 1.5, 4, () => 1);
      out.push({ geo: at(THREE, rib, 0.03, trunkTop, 0.02, 0.5, ang, 0), colour: "#4a8a42" });
      for (let j = 1; j < 6; j++) {
        const u = j / 6.2;
        for (const side of [-1, 1]) {
          const leaf = blade(THREE, 0.2 * (1 - u * 0.3), 0.11, 0.7, 3, oval);
          // along the frond: up and out, then drooping
          const a = 0.5 + 1.4 * u;
          const fx = Math.sin(a * 0.9) * fl * u * 0.75, fy = Math.cos(a * 0.75) * fl * u * 0.55;
          out.push({ geo: at(THREE, leaf, 0.03 + Math.sin(ang) * fx, trunkTop + fy, 0.02 + Math.cos(ang) * fx, 1.2, ang + side * 1.1, side * 0.3), colour: j % 2 ? "#3f8a46" : "#57a35a" });
        }
      }
    }
  }
  return out;
}

/** Which plant a spot grows (the same spot, the same plant). */
export function plantAt(x: number, z: number): PlantKind {
  return PLANT_KINDS[Math.abs(Math.round(x * 7 + z * 13)) % PLANT_KINDS.length];
}

/**
 * One plant as ONE mesh (vertex colours, both sides), for a place that is not a living-house room
 * (the 3D shop, the world kit's test garden): the same real leaves, no merge helper needed.
 * `pot` null: in the ground (a tree). `scale`: the whole plant bigger (a garden tree from a palm).
 */
export function plantMesh(THREE: any, kind: PlantKind, seed: number, o: { h?: number; pot?: string | null; scale?: number; material?: any } = {}): any {
  const parts = plantParts(THREE, kind, seed, o.h ?? 1.3, o.pot === undefined ? "#e9e4da" : o.pot);
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    c.set(p.colour);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    if (g !== p.geo) g.dispose();
    p.geo.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const me = new THREE.Mesh(geo, o.material ?? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.72, envMapIntensity: 0.6 }));
  if (o.scale) me.scale.setScalar(o.scale);
  me.castShadow = true; me.receiveShadow = true;
  return me;
}
