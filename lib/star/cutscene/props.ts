/**
 * PROPS for cut scenes, each with the places a hand can hold it.
 *
 * Every prop is built in code (no files to download), lit like the people
 * (soft toon bands, warm outline) and carries:
 *   grips   where a hand goes: `pos` (the point that sits in the hand, prop
 *           metres), `along` (the way the fingers point), `palm` (the way the
 *           palm faces), and the hand pose to use. A pen's grip is `axis`:
 *           it lies along the line from the thumb-and-index pinch back over
 *           the web of the thumb, as a pen does.
 *   points  named spots on it (the pen's nib, the contract's signature line).
 *
 * Kinds: pen, contract, shirt, trophy, phone, microphone, ball, scarf.
 */
import type * as THREE from "three";
import type { HandPoseName } from "./hands";
import { newContractCanvas, drawContract, drawShirtNumber, CONTRACT_W, CONTRACT_H, CONTRACT_SIG } from "../signing3dTextures";
import type { SigningContract } from "../signing3dScene";

type Three = typeof import("three");
export type V3 = [number, number, number];

export interface Grip { pos: V3; along: V3; palm: V3; pose: HandPoseName; axis?: boolean }

export interface CutProp {
  kind: PropKind;
  obj: THREE.Group;
  grips: Record<string, Grip>;
  points: Record<string, V3>;
  /** Contract only: ink the signature up to k (0 … 1), and the SIGNED stamp. */
  setInk?(k: number, stamped: boolean): void;
  /** Contract only: a point on the paper from canvas pixels (prop metres). */
  paperPoint?(px: number, py: number): V3;
  /** Contract only: where the signature has got to at k (0 … 1) along its stroke (prop metres): the nib's path, matching setInk. */
  sigPoint?(k: number): V3;
  dispose(): void;
}

export type PropKind = "pen" | "contract" | "shirt" | "trophy" | "phone" | "microphone" | "ball" | "scarf";

export interface PropOptions {
  ramp: THREE.Texture;
  /** Club colours (shirt, scarf, contract). */
  kit?: { shirt: string; trim: string };
  /** Shirt: the name and number on the back. */
  name?: string;
  number?: number | null;
  /** Contract: the terms, and the signature as points in the signature box (0..1). */
  contract?: SigningContract;
  signature?: [number, number][];
}

function toon(T: Three, ramp: THREE.Texture, color: string | number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  return new T.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
}

/** A warm outline: the mesh pushed out a little, back faces only. */
function outlined(T: Three, mesh: THREE.Mesh, width = 0.0025): THREE.Mesh {
  const m = new T.MeshBasicMaterial({ color: 0x3b2416, side: T.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = vec3(position) + normalize(normal) * ${width.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => `cut-prop-outline-${width.toFixed(4)}`;
  const o = new T.Mesh(mesh.geometry, m);
  o.name = "outline";
  mesh.add(o);
  return mesh;
}

export function makeProp(T: Three, kind: PropKind, o: PropOptions): CutProp {
  const g = new T.Group();
  g.name = `prop-${kind}`;
  const owned: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X) => { owned.push(x); return x; };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, line = 0.0025) => {
    keep(geo); keep(mat);
    const m = new T.Mesh(geo, mat);
    if (line > 0) outlined(T, m, line);
    g.add(m);
    return m;
  };
  const shirtC = o.kit?.shirt ?? "#c8102e", trimC = o.kit?.trim ?? "#ffffff";
  const base: Omit<CutProp, "kind"> = { obj: g, grips: {}, points: {}, dispose: () => owned.forEach((x) => x.dispose()) };

  switch (kind) {
    case "pen": {
      // Along +y: the nib at the bottom, the cap end at the top. 14 cm.
      const body = mesh(new T.CylinderGeometry(0.0046, 0.0042, 0.11, 18), toon(T, o.ramp, "#141821"), 0.0012);
      body.position.y = 0.012;
      const band = mesh(new T.CylinderGeometry(0.0048, 0.0048, 0.008, 18), toon(T, o.ramp, "#d6a84a"), 0);
      band.position.y = 0.05;
      const clip = mesh(new T.BoxGeometry(0.0016, 0.04, 0.003), toon(T, o.ramp, "#d6a84a"), 0);
      clip.position.set(0, 0.045, 0.0052);
      const cone = mesh(new T.CylinderGeometry(0.0042, 0.0012, 0.022, 18), toon(T, o.ramp, "#d6a84a"), 0.0010);
      cone.position.y = -0.054;
      return { ...base, kind, points: { tip: [0, -0.066, 0] }, grips: { write: { pos: [0, -0.04, 0], along: [0, -1, 0], palm: [0, 0, -1], pose: "pen", axis: true } } };
    }
    case "contract": {
      // A4 lying flat in its own x–z (face up, +y); the top edge at −z.
      const W = 0.21, H = W * CONTRACT_H / CONTRACT_W;
      const canvas = newContractCanvas();
      const tex = keep(new T.CanvasTexture(canvas));
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 4;
      const sig = (o.signature ?? []).map(([x, y]) => [x * 300, y * 60] as [number, number]);
      const draw = (k: number, stamped: boolean) => {
        if (o.contract) drawContract(canvas, o.contract, sig, k, stamped);
        else { const x = canvas.getContext("2d")!; x.fillStyle = "#f8f3e6"; x.fillRect(0, 0, canvas.width, canvas.height); }
        tex.needsUpdate = true;
      };
      draw(0, false);
      const geo = new T.PlaneGeometry(W, H);
      geo.rotateX(-Math.PI / 2);
      const paper = mesh(geo, toon(T, o.ramp, 0xffffff, { map: tex }), 0);
      paper.position.y = 0.0006;
      const board = mesh(new T.BoxGeometry(W + 0.02, 0.004, H + 0.02), toon(T, o.ramp, "#3a2418"), 0.0015);
      board.position.y = -0.0015;
      const paperPoint = (px: number, py: number): V3 => [(px / CONTRACT_W - 0.5) * W, 0.001, (py / CONTRACT_H - 0.5) * H];
      return {
        ...base, kind, setInk: draw, paperPoint,
        sigPoint: (k: number) => {
          const pts = o.signature ?? [[0, 0.5], [1, 0.5]];
          const f = Math.max(0, Math.min(1, k)) * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
          return paperPoint(CONTRACT_SIG.x + x * CONTRACT_SIG.w, CONTRACT_SIG.y + y * CONTRACT_SIG.h);
        },
        points: {
          sigStart: paperPoint(CONTRACT_SIG.x, CONTRACT_SIG.y + CONTRACT_SIG.h * 0.6),
          sigMid: paperPoint(CONTRACT_SIG.x + CONTRACT_SIG.w / 2, CONTRACT_SIG.y + CONTRACT_SIG.h * 0.5),
        },
        grips: {
          // The other hand flat on the paper's left side, steadying it.
          steady: { pos: [-W * 0.33, 0.012, H * 0.12], along: [0.25, 0, -1], palm: [0, -1, 0], pose: "flat" },
          topL: { pos: [-W * 0.42, 0, -H * 0.46], along: [0, 0, -1], palm: [0, -1, 0], pose: "pinch" },
          topR: { pos: [W * 0.42, 0, -H * 0.46], along: [0, 0, -1], palm: [0, -1, 0], pose: "pinch" },
        },
      };
    }
    case "shirt": {
      // Held up facing +z (its BACK to the camera: name over the number).
      const s = new T.Shape();
      const P: [number, number][] = [
        [-0.09, 0.36], [-0.2, 0.33], [-0.31, 0.21], [-0.25, 0.14], [-0.2, 0.18], [-0.2, -0.3], [0.2, -0.3], [0.2, 0.18], [0.25, 0.14], [0.31, 0.21], [0.2, 0.33], [0.09, 0.36], [0.045, 0.34], [0, 0.335], [-0.045, 0.34],
      ];
      s.moveTo(P[0][0], P[0][1]);
      for (const [x, y] of P.slice(1)) s.lineTo(x, y);
      s.closePath();
      const geo = new T.ShapeGeometry(s, 8);
      // Tessellate for the drape, then curve it and add soft folds.
      const tess = tessellate(T, geo, 0.02);
      const pos = tess.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const z = -0.06 * (x / 0.3) ** 2 + 0.006 * Math.sin(x * 26 + y * 7) * Math.max(0, 0.3 - y) + 0.012 * Math.max(0, -y - 0.1) * Math.sin(x * 14);
        pos.setZ(i, z);
      }
      tess.computeVertexNormals();
      const uv = tess.getAttribute("uv");
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.31) / 0.62, (pos.getY(i) + 0.3) / 0.66);
      const c = document.createElement("canvas"); c.width = 512; c.height = 545;
      const x = c.getContext("2d")!;
      x.fillStyle = shirtC; x.fillRect(0, 0, c.width, c.height);
      // sleeve cuffs and collar in the trim
      x.fillStyle = trimC;
      x.fillRect(0, 95, 70, 22); x.fillRect(c.width - 70, 95, 70, 22);
      x.beginPath(); x.ellipse(256, 0, 80, 30, 0, 0, Math.PI); x.fill();
      x.fillStyle = shirtC; x.beginPath(); x.ellipse(256, 0, 66, 20, 0, 0, Math.PI); x.fill();
      // side panels
      x.globalAlpha = 0.22; x.fillStyle = "#000"; x.fillRect(90, 140, 10, 405); x.fillRect(412, 140, 10, 405); x.globalAlpha = 1;
      // name and number
      x.fillStyle = trimC; x.textAlign = "center"; x.textBaseline = "middle";
      const nm = (o.name ?? "").toUpperCase();
      let fs = 46; x.font = `900 ${fs}px system-ui, -apple-system, Segoe UI, sans-serif`;
      while (x.measureText(nm).width > 300 && fs > 22) { fs -= 2; x.font = `900 ${fs}px system-ui, sans-serif`; }
      x.fillText(nm, 256, 150);
      if (o.number != null) {
        const n = document.createElement("canvas"); n.width = 256; n.height = 256; drawShirtNumber(n, o.number);
        x.save(); x.globalCompositeOperation = "source-over";
        const t2 = document.createElement("canvas"); t2.width = 256; t2.height = 256;
        const y2 = t2.getContext("2d")!; y2.drawImage(n, 0, 0); y2.globalCompositeOperation = "source-in"; y2.fillStyle = trimC; y2.fillRect(0, 0, 256, 256);
        x.drawImage(t2, 256 - 150, 190, 300, 300); x.restore();
      }
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const front = mesh(tess, toon(T, o.ramp, 0xffffff, { map: tex, side: T.FrontSide }), 0.003);
      front.name = "shirt";
      const back = mesh(tess, toon(T, o.ramp, shirtC, { side: T.BackSide }), 0);
      back.name = "shirt-inside";
      return {
        ...base, kind, points: { centre: [0, 0.05, 0] },
        grips: {
          // Fingers behind the cloth, thumb on the front, hands pointing up.
          shoulderL: { pos: [0.19, 0.32, -0.028], along: [0.15, 1, 0], palm: [0, 0, 1], pose: "pinch" },
          shoulderR: { pos: [-0.19, 0.32, -0.028], along: [-0.15, 1, 0], palm: [0, 0, 1], pose: "pinch" },
        },
      };
    }
    case "trophy": {
      const gold = toon(T, o.ramp, "#e3b23c");
      const pts: [number, number][] = [[0, 0], [0.07, 0], [0.07, 0.03], [0.04, 0.04], [0.025, 0.1], [0.02, 0.2], [0.05, 0.24], [0.1, 0.3], [0.12, 0.42], [0.115, 0.45], [0.105, 0.45], [0.1, 0.33], [0.0, 0.3]];
      const cup = mesh(new T.LatheGeometry(pts.map(([a, b]) => new T.Vector2(a, b)), 40), gold, 0.003);
      cup.name = "cup";
      const base2 = mesh(new T.CylinderGeometry(0.085, 0.09, 0.05, 32), toon(T, o.ramp, "#2a1d16"), 0.0025);
      base2.position.y = -0.024;
      for (const sx of [-1, 1]) {
        const h = mesh(new T.TorusGeometry(0.055, 0.009, 10, 24, Math.PI * 1.2), gold, 0.002);
        h.position.set(sx * 0.125, 0.36, 0); h.rotation.z = sx > 0 ? -Math.PI * 0.6 : Math.PI * 0.4 + Math.PI;
      }
      return {
        ...base, kind, points: { top: [0, 0.45, 0] },
        grips: {
          handleL: { pos: [0.165, 0.36, 0], along: [0, 0, 1], palm: [-1, 0, 0], pose: "cup" },
          handleR: { pos: [-0.165, 0.36, 0], along: [0, 0, 1], palm: [1, 0, 0], pose: "cup" },
          stemL: { pos: [0.03, 0.12, 0.0], along: [0, 0, 1], palm: [-1, 0, 0], pose: "cup" },
          stemR: { pos: [-0.03, 0.12, 0.0], along: [0, 0, 1], palm: [1, 0, 0], pose: "cup" },
        },
      };
    }
    case "phone": {
      const ph = mesh(new T.BoxGeometry(0.074, 0.155, 0.008), toon(T, o.ramp, "#1b1d22"), 0.0015);
      const scr = mesh(new T.PlaneGeometry(0.066, 0.142), new T.MeshBasicMaterial({ color: "#6fa8dc" }), 0);
      scr.position.z = 0.0042;
      ph.name = "phone";
      return { ...base, kind, points: { screen: [0, 0, 0.005] }, grips: { hold: { pos: [0, -0.02, -0.004], along: [0, 1, 0], palm: [0, 0, 1], pose: "phone" } } };
    }
    case "microphone": {
      const h = mesh(new T.CylinderGeometry(0.014, 0.01, 0.17, 18), toon(T, o.ramp, "#1c1d22"), 0.0015);
      h.position.y = -0.05;
      const head = mesh(new T.SphereGeometry(0.026, 20, 14), toon(T, o.ramp, "#9aa0a8"), 0.0015);
      head.position.y = 0.05;
      const flag = mesh(new T.BoxGeometry(0.05, 0.045, 0.05), toon(T, o.ramp, shirtC), 0.0015);
      flag.position.y = 0.005;
      return { ...base, kind, points: { head: [0, 0.05, 0] }, grips: { hold: { pos: [0, -0.07, 0], along: [0, 0, 1], palm: [-1, 0, 0], pose: "mic" } } };
    }
    case "ball": {
      const c = document.createElement("canvas"); c.width = 256; c.height = 128;
      const x = c.getContext("2d")!; x.fillStyle = "#f5f2ea"; x.fillRect(0, 0, 256, 128);
      x.fillStyle = "#1b1b1f";
      for (let i = 0; i < 12; i++) { const cx = (i % 6) * 44 + (i >= 6 ? 22 : 0), cy = i >= 6 ? 88 : 36; x.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; x.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12 * 0.9); } x.fill(); }
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      mesh(new T.SphereGeometry(0.11, 32, 20), toon(T, o.ramp, 0xffffff, { map: tex }), 0.0025);
      return {
        ...base, kind, points: {},
        grips: {
          left: { pos: [0.11, 0, 0], along: [0, 1, 0.2], palm: [-1, 0, 0], pose: "ball" },
          right: { pos: [-0.11, 0, 0], along: [0, 1, 0.2], palm: [1, 0, 0], pose: "ball" },
        },
      };
    }
    case "scarf": {
      // A knitted bar scarf 1.3 m long, stretched along x, the stripes in the club's colours.
      const c = document.createElement("canvas"); c.width = 1024; c.height = 128;
      const x = c.getContext("2d")!;
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? trimC : shirtC; x.fillRect(i * 64, 0, 64, 128); }
      x.globalAlpha = 0.12; x.fillStyle = "#000";
      for (let yy = 0; yy < 128; yy += 6) x.fillRect(0, yy, 1024, 2);
      x.globalAlpha = 1;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const geo = new T.PlaneGeometry(1.3, 0.17, 40, 2);
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count; i++) { const xx = pos.getX(i); pos.setY(i, pos.getY(i) - 0.05 * (1 - (xx / 0.65) ** 2)); pos.setZ(i, 0.01 * Math.sin(xx * 30)); }
      geo.computeVertexNormals();
      mesh(geo, toon(T, o.ramp, 0xffffff, { map: tex, side: T.DoubleSide }), 0.002);
      return {
        ...base, kind, points: {},
        grips: {
          endL: { pos: [0.6, 0.06, -0.012], along: [0.2, 1, 0], palm: [0, 0, 1], pose: "pinch" },
          endR: { pos: [-0.6, 0.06, -0.012], along: [-0.2, 1, 0], palm: [0, 0, 1], pose: "pinch" },
        },
      };
    }
  }
}

/** Split a flat geometry's triangles until no edge is longer than `max` (for drape). */
function tessellate(T: Three, geo: THREE.BufferGeometry, max: number): THREE.BufferGeometry {
  const g0 = geo.index ? geo.toNonIndexed() : geo;
  let tris: number[] = Array.from(g0.getAttribute("position").array as Float32Array);
  for (let pass = 0; pass < 6; pass++) {
    const out: number[] = [];
    let split = false;
    for (let i = 0; i < tris.length; i += 9) {
      const a = tris.slice(i, i + 3), b = tris.slice(i + 3, i + 6), c = tris.slice(i + 6, i + 9);
      const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      const ab = d(a, b), bc = d(b, c), ca = d(c, a);
      const m = Math.max(ab, bc, ca);
      if (m <= max) { out.push(...a, ...b, ...c); continue; }
      split = true;
      const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
      if (m === ab) { const k = mid(a, b); out.push(...a, ...k, ...c, ...k, ...b, ...c); }
      else if (m === bc) { const k = mid(b, c); out.push(...a, ...b, ...k, ...a, ...k, ...c); }
      else { const k = mid(c, a); out.push(...a, ...b, ...k, ...k, ...b, ...c); }
    }
    tris = out;
    if (!split) break;
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(tris, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array((tris.length / 3) * 2), 2));
  geo.dispose();
  const merged = mergeClose(T, g);
  return merged;
}

/** Weld the duplicate corners a split leaves, so normals come out smooth. */
function mergeClose(T: Three, g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const map = new Map<string, number>();
  const verts: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let j = map.get(k);
    if (j === undefined) { j = verts.length / 3; map.set(k, j); verts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    index.push(j);
  }
  const out = new T.BufferGeometry();
  out.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  out.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array((verts.length / 3) * 2), 2));
  out.setIndex(index);
  g.dispose();
  return out;
}

/** An SVG signature path (a 300 × 60 box, as TrialReward's SIGNATURE_D) as
 *  points 0 … 1 across and down the contract's signature box, evenly spaced
 *  along the stroke: what the pen's nib follows and the ink is drawn from. */
export function signaturePoints(d: string, n = 120): [number, number][] {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const len = path.getTotalLength();
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const p = path.getPointAtLength((i / (n - 1)) * len); pts.push([p.x / 300, p.y / 60]); }
  svg.remove();
  return pts;
}
