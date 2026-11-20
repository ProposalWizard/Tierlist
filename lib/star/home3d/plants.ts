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
 * `wid` at its widest, `seg` steps, its width shaped by `shape`. Split leaves (monstera) leave gaps.
 */
function blade(THREE: any, len: number, wid: number, bend: number, seg: number, shape: (t: number) => number, splits = 0): any {
  const pos: number[] = [];
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = bend * t;
    // the spine: up and over
    pts.push([0, Math.sin(Math.PI / 2 - a * 0.9) * len * t, (1 - Math.cos(a)) * len * 0.6 * t + Math.sin(a) * len * 0.35 * t]);
  }
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const w0 = wid * shape(t0) / 2, w1 = wid * shape(t1) / 2;
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    // a gentle V across the blade (its midrib), so it catches light
    const v = 0.08;
    for (const side of [-1, 1]) {
      if (splits && i > 1 && i < seg - 1 && (i + (side > 0 ? 0 : 1)) % 2 === 0) continue; // a slit
      const a: [number, number, number] = [x0, y0, z0], b: [number, number, number] = [x1, y1, z1];
      const c: [number, number, number] = [x1 + side * w1, y1 - w1 * v, z1 + w1 * v * 0.5];
      const d: [number, number, number] = [x0 + side * w0, y0 - w0 * v, z0 + w0 * v * 0.5];
      if (side < 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

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
export function plantParts(THREE: any, kind: PlantKind, seed: number, h = 1.3, pot = "#e9e4da"): PlantPart[] {
  const r = rnd(seed + 1);
  const out: PlantPart[] = [];
  const green = () => GREENS[Math.floor(r() * 3)];
  // the pot: a tapered cylinder, a rim, the soil
  const potH = Math.min(0.42, h * 0.3), potR = kind === "palm" ? 0.24 : 0.2;
  out.push({ geo: new THREE.CylinderGeometry(potR, potR * 0.78, potH, 12, 1, true).translate(0, potH / 2, 0).toNonIndexed(), colour: pot });
  out.push({ geo: new THREE.TorusGeometry(potR - 0.005, 0.018, 3, 12).rotateX(Math.PI / 2).translate(0, potH, 0).toNonIndexed(), colour: pot });
  out.push({ geo: new THREE.CircleGeometry(potR - 0.02, 12).rotateX(-Math.PI / 2).translate(0, potH - 0.03, 0).toNonIndexed(), colour: "#3b2a1e" });
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
      const g = blade(THREE, 0.38 + r() * 0.1, 0.5 + r() * 0.1, 0.8 + r() * 0.4, 8, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.12)), 0.38) * (1 - 0.15 * t), 1);
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
      const rib = blade(THREE, fl, 0.02, 1.4, 4, () => 1);
      out.push({ geo: at(THREE, rib, 0.03, trunkTop, 0.02, 0.5, ang, 0), colour: "#3f7a3a" });
      for (let j = 1; j < 5; j++) {
        const u = j / 5;
        for (const side of [-1, 1]) {
          const leaf = blade(THREE, 0.24 * (1 - u * 0.35), 0.085, 0.5, 3, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.6));
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
