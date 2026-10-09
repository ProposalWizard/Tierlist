/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A FULL MATCHDAY STADIUM in the style kit's materials: a 105 × 68 pitch with
 * mown stripes and every marking, two goals with nets, corner flags, ad
 * boards, four stands with a card crowd (two instanced draws), roofs,
 * floodlight towers, a city backdrop and (Strikers) an electric cage.
 *
 * Coordinates (the same as play3d's picture): X = pitch x − 34, Y up,
 * Z = metres out from the near goal line (the far goal line at Z = 105).
 * Built again on every style change (it is cheap: about 40 draws).
 */
import type { Quality3d } from "../three3d/quality";
import type { StyleKit } from "./kit";

export const PITCH_LEN = 105;
export const PITCH_HALF_W = 34;
const GOAL_W = 7.32, GOAL_H = 2.44;

type Side = "N" | "S" | "W" | "E";

function rand(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function grassCanvas(stripes: [string, string], apron: string, pixel: boolean, real: boolean, worn = false): HTMLCanvasElement {
  // the plane is 84 × 121 m: pitch inset 8 m
  const W = pixel ? 84 : 420, H = pixel ? 121 : 605;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const k = W / 84;
  g.fillStyle = apron; g.fillRect(0, 0, W, H);
  const bands = 18;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = stripes[i % 2];
    g.fillRect(0, (8 + (i * 105) / bands) * k, W, (105 / bands) * k + 1);
  }
  if (worn) {
    // a scuffed, stylised pitch: blade strokes, bald patches in the goalmouths and the middle
    const r = rand(5);
    for (let i = 0; i < W * H * 0.01; i++) {
      const x = r() * W, y = r() * H;
      g.strokeStyle = r() < 0.5 ? "rgba(10,30,10,0.12)" : "rgba(220,255,160,0.06)";
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 4 * k * 0.25 - 2); g.stroke();
    }
    const patch = (cx: number, cy: number, n: number, rad: number) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = r() * rad;
        g.fillStyle = r() < 0.5 ? "rgba(120,86,40,0.45)" : "rgba(150,110,55,0.35)";
        g.beginPath(); g.ellipse((cx + Math.cos(a) * d) * k, (cy + Math.sin(a) * d * 0.6) * k, (0.4 + r() * 0.9) * k, (0.25 + r() * 0.5) * k, r() * 3, 0, Math.PI * 2); g.fill();
      }
    };
    patch(42, 8 + 5, 30, 4); patch(42, 8 + 105 - 5, 30, 4); patch(42, 8 + 52.5, 14, 5);
    for (let i = 0; i < 10; i++) patch(10 + r() * 64, 14 + r() * 92, 3, 1.5);
  }
  if (real) {
    // mown texture: speckle and (real) a faint diagonal cross-cut
    const r = rand(7);
    for (let i = 0; i < W * H * 0.08; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
      g.fillRect(r() * W, r() * H, 1.5, 1.5);
    }
    {
      g.globalAlpha = 0.05;
      for (let i = -H; i < W + H; i += 18 * k) { g.strokeStyle = "#ffffff"; g.lineWidth = 6 * k; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
      g.globalAlpha = 1;
    }
  }
  return c;
}

function adCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 32;
  const g = c.getContext("2d")!;
  const cols = ["#d62828", "#003049", "#f77f00", "#1d3557", "#2a9d8f", "#e9c46a", "#264653", "#e76f51"];
  const words = ["KNOWITBALL", "NS-BOOTS", "KIB", "STAR PASS", "MATCHDAY", "KNOWITBALL", "GOAL+", "KIB ENERGY"];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = cols[i]; g.fillRect(i * 128, 0, 128, 32);
    g.fillStyle = i % 2 ? "#ffffff" : "#ffe9a8";
    g.font = "bold 20px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(words[i], i * 128 + 64, 17);
  }
  return c;
}

function personCard(head: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 48;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  if (head) { g.beginPath(); g.arc(16, 12, 8, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.moveTo(3, 48); g.lineTo(5, 26); g.quadraticCurveTo(16, 18, 27, 26); g.lineTo(29, 48); g.fill(); }
  return c;
}

/** Riveted steel panels with rust running down them. */
function rustCanvas(base: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4a4c52"; g.fillRect(0, 0, 256, 128);
  const r = rand(17);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = r() < 0.5 ? "#55585f" : "#43454b"; g.fillRect(x + 1, 0, 30, 128);
    g.fillStyle = "#2a2b30"; g.fillRect(x, 0, 1.5, 128);
    for (let y = 6; y < 128; y += 20) { g.fillStyle = "#6a6d74"; g.fillRect(x + 4, y, 2, 2); g.fillRect(x + 26, y, 2, 2); }
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * 256, y = r() * 60, h = 20 + r() * 80;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, base); gr.addColorStop(1, "rgba(120,60,20,0)");
    g.globalAlpha = 0.35 + r() * 0.4; g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 5, h);
  }
  g.globalAlpha = 1;
  return c;
}

function windowsCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 128);
  const r = rand(3);
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) { g.fillStyle = r() < 0.35 ? "#ffe2a8" : "#7c8796"; g.fillRect(x, y, 4, 5); }
  return c;
}

export interface StadiumOptions {
  skip?: Side[];
  /** The goals (off for a scene that only needs the bowl). */
  goals?: boolean;
}

export interface Stadium {
  group: any;
  update(dt: number, t: number): void;
}

export function buildStadium(T: any, kit: StyleKit, tier: Quality3d, o: StadiumOptions = {}): Stadium {
  const def = kit.def;
  const G = new T.Group();
  G.name = "stadium";
  const pixel = def.post.pixel > 0;
  const skip = new Set(o.skip ?? []);
  const disposables: any[] = [];
  const tex = (c: HTMLCanvasElement, near = false) => {
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    if (near) { t.minFilter = T.NearestFilter; t.magFilter = T.NearestFilter; t.generateMipmaps = false; }
    else t.anisotropy = 4;
    disposables.push(t);
    return t;
  };

  // ── ground, grass, lines ──
  const outer = new T.Mesh(new T.PlaneGeometry(600, 600), kit.mat(def.cage ? "#1d1a2a" : "#5a5a52"));
  outer.rotation.x = -Math.PI / 2; outer.position.set(0, -0.02, PITCH_LEN / 2); outer.receiveShadow = true; G.add(outer);
  const grassMap = tex(grassCanvas(def.grass, def.apron, pixel, def.mat === "pbr", !!def.worn), pixel);
  const grass = new T.Mesh(new T.PlaneGeometry(84, 121), kit.mat("#ffffff", { map: grassMap, rough: def.glossy ? 0.55 : 0.95 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0, PITCH_LEN / 2); grass.receiveShadow = true; G.add(grass);

  const lineMat = new T.MeshBasicMaterial({ color: "#f3f3ea" });
  const LW = pixel ? 0.22 : 0.12;
  const strip = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new T.Mesh(new T.PlaneGeometry(len + LW, LW), lineMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2); G.add(m);
  };
  const ring = (cx: number, cz: number, r: number, a0: number, a1: number) => {
    const m = new T.Mesh(new T.RingGeometry(r - LW / 2, r + LW / 2, 48, 1, a0, a1 - a0), lineMat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.01, cz); G.add(m);
  };
  const W = PITCH_HALF_W, L = PITCH_LEN;
  strip(-W, 0, W, 0); strip(-W, L, W, L); strip(-W, 0, -W, L); strip(W, 0, W, L); strip(-W, L / 2, W, L / 2);
  ring(0, L / 2, 9.15, 0, Math.PI * 2);
  const spot = (z: number) => { const s = new T.Mesh(new T.CircleGeometry(0.15, 12), lineMat); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.01, z); G.add(s); };
  spot(L / 2); spot(11); spot(L - 11);
  for (const end of [0, 1]) {
    const z0 = end ? L : 0, dir = end ? -1 : 1;
    const six = GOAL_W / 2 + 5.5, box = GOAL_W / 2 + 16.5;
    strip(-six, z0, -six, z0 + dir * 5.5); strip(six, z0, six, z0 + dir * 5.5); strip(-six, z0 + dir * 5.5, six, z0 + dir * 5.5);
    strip(-box, z0, -box, z0 + dir * 16.5); strip(box, z0, box, z0 + dir * 16.5); strip(-box, z0 + dir * 16.5, box, z0 + dir * 16.5);
    // the D: the part of the 9.15 m circle round the spot outside the box
    const half = Math.acos((16.5 - 11) / 9.15);
    // RingGeometry angles run from +x towards the plane's +y (= world −z after the turn)
    if (end) ring(0, L - 11, 9.15, Math.PI / 2 - half, Math.PI / 2 + half);
    else ring(0, 11, 9.15, -Math.PI / 2 - half, -Math.PI / 2 + half);
    for (const sx of [-1, 1]) {
      // corner arcs
      const a = end ? (sx < 0 ? 0 : Math.PI / 2) : (sx < 0 ? -Math.PI / 2 : Math.PI);
      ring(sx * W, z0, 1, a, a + Math.PI / 2);
    }
  }

  // ── goals ──
  const frameMat = def.goalGlow ? new T.MeshBasicMaterial({ color: new T.Color(def.goalGlow).multiplyScalar(2.4) }) : kit.mat("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.25, rough: 0.35 });
  const netMat = new T.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: pixel ? 0.8 : 0.5 });
  const netBack = kit.mat("#ffffff", { transparent: true, opacity: 0.12, side: T.DoubleSide });
  if (o.goals !== false) for (const end of [0, 1]) {
    const g = new T.Group();
    const R = def.goalGlow ? 0.13 : 0.06, HW = GOAL_W / 2, D = 2.0;
    for (const sx of [-1, 1]) {
      const post = new T.Mesh(new T.CylinderGeometry(R, R, GOAL_H + R, 12), frameMat);
      post.position.set(sx * HW, (GOAL_H + R) / 2, 0); post.castShadow = true; g.add(post);
    }
    const bar = new T.Mesh(new T.CylinderGeometry(R, R, GOAL_W + 2 * R, 12), frameMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, GOAL_H, 0); bar.castShadow = true; g.add(bar);
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    const S = pixel ? 0.4 : 0.22;
    for (let x = -HW; x <= HW + 1e-6; x += S) seg([x, GOAL_H, 0], [x, GOAL_H * 0.85, -D * 0.5]), seg([x, GOAL_H * 0.85, -D * 0.5], [x, 0, -D]);
    for (let t = 0; t <= 1 + 1e-6; t += 0.06) { const y = GOAL_H * (1 - t), z = -D * t; seg([-HW, y, z], [HW, y, z]); }
    for (const sx of [-1, 1]) for (let z = 0; z >= -D; z -= S) seg([sx * HW, 0, z], [sx * HW, GOAL_H * (1 + z / D), z]);
    const ng = new T.BufferGeometry();
    ng.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(ng, netMat));
    const back = new T.Mesh(new T.PlaneGeometry(GOAL_W, Math.hypot(D, GOAL_H)), netBack);
    back.rotation.x = Math.atan2(D, GOAL_H) - Math.PI / 2; back.position.set(0, GOAL_H / 2, -D / 2); g.add(back);
    if (end) { g.rotation.y = Math.PI; g.position.z = L; }
    G.add(g);
  }

  // ── corner flags ──
  const poleMat = kit.mat("#f5f5f0");
  const flagMat = kit.mat("#e63946", { side: T.DoubleSide });
  for (const z of [0, L]) for (const sx of [-1, 1]) {
    const pole = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.6, 6), poleMat);
    pole.position.set(sx * W, 0.8, z); pole.castShadow = true; G.add(pole);
    const flag = new T.Mesh(new T.PlaneGeometry(0.42, 0.3), flagMat);
    flag.position.set(sx * W + 0.21, 1.42, z); G.add(flag);
  }

  // ── ad boards ──
  const adMap = tex(adCanvas(), pixel);
  adMap.wrapS = T.RepeatWrapping;
  const boardMat = new T.MeshBasicMaterial({ map: adMap, color: def.floodOn ? "#ffffff" : "#e6e6e6" });
  const board = (len: number, x: number, z: number, ry: number) => {
    const m = new T.Mesh(new T.BoxGeometry(len, 0.9, 0.15), [kit.mat("#222"), kit.mat("#222"), kit.mat("#222"), kit.mat("#222"), boardMat, kit.mat("#222")]);
    const t = m.material[4].map.clone(); t.repeat.set(len / 30, 1); t.needsUpdate = true; disposables.push(t); m.material[4] = new T.MeshBasicMaterial({ map: t, color: boardMat.color });
    m.position.set(x, 0.45, z); m.rotation.y = ry; m.castShadow = true; G.add(m);
  };
  board(80, 0, -4, 0); board(80, 0, L + 4, Math.PI); board(L + 6, -W - 4, L / 2, Math.PI / 2); board(L + 6, W + 4, L / 2, -Math.PI / 2);

  // ── stands, crowd, roofs ──
  const rows = 24, stepD = 0.82, stepH = 0.5, gap = 9;
  const standMat = def.rusty ? kit.mat("#ffffff", { map: tex(rustCanvas(def.stand), pixel), rough: 0.7, metal: 0.5 }) : kit.mat(def.stand, { rough: 0.9 });
  const roofMat = kit.mat(def.roof, { rough: 0.6, metal: 0.2 });
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i < rows; i++) { shape.lineTo(i * stepD, (i + 1) * stepH + 0.4); shape.lineTo((i + 1) * stepD, (i + 1) * stepH + 0.4); }
  shape.lineTo(rows * stepD, rows * stepH + 4); shape.lineTo(rows * stepD + 1, rows * stepH + 4); shape.lineTo(rows * stepD + 1, 0); shape.lineTo(0, 0);
  const density = tier === "high" ? 0.9 : tier === "medium" ? 0.55 : 0.28;
  const r = rand(11);
  const seats: { x: number; y: number; z: number; ry: number }[] = [];
  const sides: { s: Side; len: number; at: (along: number, depth: number) => [number, number]; ry: number }[] = [
    { s: "N", len: 2 * W + 2 * gap, at: (a, d) => [a, -gap - d], ry: 0 },
    { s: "S", len: 2 * W + 2 * gap, at: (a, d) => [-a, L + gap + d], ry: Math.PI },
    { s: "W", len: L, at: (a, d) => [-W - gap - d, L / 2 - a], ry: Math.PI / 2 },
    { s: "E", len: L, at: (a, d) => [W + gap + d, L / 2 + a], ry: -Math.PI / 2 },
  ];
  for (const sd of sides) {
    if (skip.has(sd.s)) continue;
    const geo = new T.ExtrudeGeometry(shape, { depth: sd.len, bevelEnabled: false, steps: 1 });
    // shape: x = depth back from the pitch, y = up; extrude along z = along the stand
    geo.translate(0, 0, -sd.len / 2);
    const m = new T.Mesh(geo, standMat);
    // turn so the shape's +x points away from the pitch
    const [x0, z0] = sd.at(0, 0);
    m.position.set(x0, 0, z0);
    m.rotation.y = sd.ry + Math.PI / 2;
    m.castShadow = tier === "high"; m.receiveShadow = true;
    G.add(m);
    // roof
    const roof = new T.Mesh(new T.BoxGeometry(sd.len + 2, 0.4, rows * stepD * 0.5), roofMat);
    const [rx, rz] = sd.at(0, rows * stepD * 0.8);
    roof.position.set(rx, rows * stepH + 9, rz); roof.rotation.y = sd.ry; roof.castShadow = tier !== "low"; G.add(roof);
    for (let a = -sd.len / 2; a <= sd.len / 2 + 1e-6; a += sd.len / 4) {
      const [px, pz] = sd.at(a, rows * stepD + 0.5);
      const col = new T.Mesh(new T.BoxGeometry(0.4, rows * stepH + 9, 0.4), roofMat);
      col.position.set(px, (rows * stepH + 9) / 2, pz); G.add(col);
    }
    // seats
    for (let i = 1; i < rows; i++) for (let a = -sd.len / 2 + 0.4; a < sd.len / 2 - 0.4; a += 0.62) {
      if (r() > density) continue;
      const [sx, sz] = sd.at(a + (r() - 0.5) * 0.12, i * stepD + 0.35);
      seats.push({ x: sx, y: (i + 1) * stepH + 0.4, z: sz, ry: sd.ry });
    }
  }
  const bodyMap = tex(personCard(false), pixel), headMap = tex(personCard(true), pixel);
  const cardGeo = new T.PlaneGeometry(0.62, 0.92); cardGeo.translate(0, 0.46, 0);
  const crowdBody = new T.InstancedMesh(cardGeo, kit.mat("#ffffff", { map: bodyMap, alphaTest: 0.5, side: T.DoubleSide }), Math.max(1, seats.length));
  const crowdHead = new T.InstancedMesh(cardGeo, kit.mat("#ffffff", { map: headMap, alphaTest: 0.5, side: T.DoubleSide }), Math.max(1, seats.length));
  const skins = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a1e", "#ffdbac"];
  const mtx = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), sc = new T.Vector3(1, 1, 1), pos = new T.Vector3(), col = new T.Color();
  const bob: number[] = [];
  seats.forEach((s, i) => {
    q.setFromAxisAngle(up, s.ry);
    pos.set(s.x, s.y, s.z);
    const k = 0.9 + r() * 0.2; sc.set(k, k, k);
    mtx.compose(pos, q, sc);
    crowdBody.setMatrixAt(i, mtx); crowdHead.setMatrixAt(i, mtx);
    crowdBody.setColorAt(i, col.set(def.crowd[Math.floor(r() * def.crowd.length)]));
    crowdHead.setColorAt(i, col.set(skins[Math.floor(r() * skins.length)]));
    bob.push(r() * 6.28);
  });
  crowdBody.count = crowdHead.count = seats.length;
  if (crowdBody.instanceColor) crowdBody.instanceColor.needsUpdate = true;
  if (crowdHead.instanceColor) crowdHead.instanceColor.needsUpdate = true;
  G.add(crowdBody, crowdHead);

  // ── floodlights ──
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(220,235,255,0.55)"); gr.addColorStop(1, "rgba(200,220,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
  })();
  if (def.floodlights) {
    const towerMat = kit.mat("#8a8f98", { metal: 0.4, rough: 0.5 });
    const lampMat = new T.MeshBasicMaterial({ color: def.floodOn ? new T.Color(6, 6, 5.5) : new T.Color("#d9d9d0") });
    for (const [x, z] of [[-W - 22, -20], [W + 22, -20], [-W - 22, L + 20], [W + 22, L + 20]]) {
      const h = rows * stepH + 26;
      const tw = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, h, 8), towerMat);
      tw.position.set(x, h / 2, z); G.add(tw);
      const head = new T.Group();
      const back = new T.Mesh(new T.BoxGeometry(7, 4, 0.5), towerMat); head.add(back);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const lamp = new T.Mesh(new T.BoxGeometry(1.3, 0.9, 0.2), lampMat);
        lamp.position.set(-2.4 + i * 1.6, -1.1 + j * 1.1, 0.35); head.add(lamp);
      }
      head.position.set(x, h + 1.5, z);
      head.lookAt(0, 0, L / 2);
      G.add(head);
      if (def.floodOn) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: "#e8f0ff", blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        sp.position.copy(head.position); sp.scale.set(26, 26, 1); G.add(sp);
      }
    }
  }

  // ── backdrop ──
  if (def.backdrop === "city") {
    const wmap = tex(windowsCanvas(), pixel);
    const rr = rand(21);
    const bm = kit.mat("#9aa3b0", { map: wmap, rough: 0.8 });
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rr() * 0.05;
      const d = 135 + rr() * 50;
      const h = 14 + rr() * 46, w = 10 + rr() * 16;
      const b = new T.Mesh(new T.BoxGeometry(w, h, w), bm);
      b.position.set(Math.cos(a) * d, h / 2, L / 2 + Math.sin(a) * d * 1.1);
      b.rotation.y = rr() * Math.PI;
      G.add(b);
    }
  }

  // ── the cage (Strikers): posts, chain-link, rails that glow, sparks crawling along the top ──
  let crackle: any = null;
  const cageTop: [number, number, number, number][] = [];
  if (def.cage) {
    const cw = W + 6, z0 = -7, z1 = L + 7, H = 3.4;
    const link = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 32;
      const g = c.getContext("2d")!; g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 16); g.lineTo(16, 0); g.lineTo(32, 16); g.lineTo(16, 32); g.closePath(); g.stroke();
      return c;
    })();
    const linkMap = tex(link, pixel); linkMap.wrapS = linkMap.wrapT = T.RepeatWrapping;
    const metal = kit.mat("#6b7186", { metal: 0.6, rough: 0.4 });
    const glowMat = new T.MeshBasicMaterial({ color: new T.Color(def.cage.glow).multiplyScalar(3.2), fog: false });
    const runs: [number, number, number, number][] = [[-cw, z0, cw, z0], [cw, z0, cw, z1], [cw, z1, -cw, z1], [-cw, z1, -cw, z0]];
    for (const [x1, za, x2, zb] of runs) {
      const len = Math.hypot(x2 - x1, zb - za), ang = Math.atan2(zb - za, x2 - x1);
      const mesh = (geo: any, m: any, y: number) => { const o = new T.Mesh(geo, m); o.position.set((x1 + x2) / 2, y, (za + zb) / 2); o.rotation.y = -ang; G.add(o); return o; };
      const lm = kit.mat("#9aa6c8", { map: linkMap.clone(), alphaTest: 0.4, side: T.DoubleSide, metal: 0.5, rough: 0.5 });
      lm.map.repeat.set(len / 0.7, H / 0.7); lm.map.needsUpdate = true; disposables.push(lm.map);
      mesh(new T.PlaneGeometry(len, H), lm, H / 2);
      mesh(new T.BoxGeometry(len, 0.12, 0.12), glowMat, H);
      mesh(new T.BoxGeometry(len, 0.08, 0.08), metal, H * 0.5);
      for (let d = 0; d <= len + 1e-6; d += 6) {
        const px = x1 + Math.cos(ang) * d, pz = za + Math.sin(ang) * d;
        const post = new T.Mesh(new T.BoxGeometry(0.2, H + 0.4, 0.2), metal); post.position.set(px, (H + 0.4) / 2, pz); G.add(post);
        const cap = new T.Mesh(new T.BoxGeometry(0.32, 0.18, 0.32), glowMat); cap.position.set(px, H + 0.45, pz); G.add(cap);
      }
      cageTop.push([x1, za, x2, zb]);
    }
    if (def.cage.crackle) {
      const N = 48 * 6;
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(new Float32Array(N * 3), 3));
      crackle = new T.LineSegments(geo, new T.LineBasicMaterial({ color: new T.Color("#e0f4ff").multiplyScalar(4), fog: false, transparent: true, opacity: 0.95 }));
      crackle.frustumCulled = false;
      crackle.userData.H = H;
      G.add(crackle);
    }
  }
  let crackT = 0;
  const reCrackle = () => {
    if (!crackle) return;
    const pos = crackle.geometry.attributes.position.array as Float32Array;
    const H = crackle.userData.H as number;
    let i = 0;
    for (let b = 0; b < 48; b++) {
      const [x1, z1, x2, z2] = cageTop[Math.floor(r() * cageTop.length)];
      const t0 = r();
      let px = x1 + (x2 - x1) * t0, pz = z1 + (z2 - z1) * t0, py = H;
      const dx = (x2 - x1), dz = (z2 - z1), dl = Math.hypot(dx, dz) || 1;
      for (let k = 0; k < 3; k++) {
        const step = 0.5 + r() * 0.9;
        const nx = px + (dx / dl) * step, nz = pz + (dz / dl) * step, ny = H + (r() - 0.5) * 0.7 - (k === 2 ? 0.3 : 0);
        pos.set([px, py, pz, nx, ny, nz], i); i += 6;
        px = nx; py = ny; pz = nz;
      }
    }
    crackle.geometry.attributes.position.needsUpdate = true;
  };
  reCrackle();

  let clock = 0;
  return {
    group: G,
    update(dt) {
      clock += dt;
      crackT += dt;
      if (crackle && crackT > 0.09) { crackT = 0; reCrackle(); crackle.visible = r() < 0.85; }
      // the crowd sways a little (every 4th seat, a cheap matrix pass on Medium/High)
      if (tier === "low" || !seats.length) return;
      for (let i = (Math.floor(clock * 20) % 4); i < seats.length; i += 4) {
        const s = seats[i];
        q.setFromAxisAngle(up, s.ry);
        pos.set(s.x, s.y + Math.max(0, Math.sin(clock * 3 + bob[i])) * 0.12, s.z);
        sc.set(1, 1, 1);
        mtx.compose(pos, q, sc);
        crowdBody.setMatrixAt(i, mtx); crowdHead.setMatrixAt(i, mtx);
      }
      crowdBody.instanceMatrix.needsUpdate = true; crowdHead.instanceMatrix.needsUpdate = true;
    },
  };
}
