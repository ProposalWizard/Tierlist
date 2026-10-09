/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE SETS — every location preset built in code, in the style kit's
 * materials (look A's toon bands and painted lines come for free). Pitch,
 * tunnel and office use the real matchday stadium (style3d/stadium.ts):
 * the office sees it through the window, the tunnel opens onto it.
 *
 * Each set is its own origin, matching presets/locations.ts's marks.
 */
import type { LocationId, Vec3 } from "./types";
import type { StyleKit } from "../style3d/kit";
import type { Quality3d } from "../three3d/quality";
import { buildStadium, type Stadium } from "../style3d/stadium";
import { DESK } from "./presets/locations";
import { rng } from "./math";

export interface SetOpts { shirt: string; trim: string; club: string; lamps: { intensity: number; color: string }; seed: number; night: boolean }
export interface BuiltSet { group: any; stadium: Stadium | null; update(t: number, dt: number): void; dispose(): void }

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export function buildSet(T: any, kit: StyleKit, tier: Quality3d, id: LocationId, o: SetOpts): BuiltSet {
  const G = new T.Group();
  G.name = `set:${id}`;
  const disp: any[] = [];
  const updaters: ((t: number) => void)[] = [];
  const mat = (c: string, x: any = {}) => { const m = kit.mat(c, x); disp.push(m); return m; };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: any, parent = G) => {
    const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); disp.push(b.geometry); return b;
  };
  const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, m: any, seg = 16) => {
    const b = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; G.add(b); disp.push(b.geometry); return b;
  };
  const plane = (w: number, h: number, x: number, y: number, z: number, rx: number, ry: number, m: any) => {
    const p = new T.Mesh(new T.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; G.add(p); disp.push(p.geometry); return p;
  };
  const tex = (c: HTMLCanvasElement, rep?: [number, number]) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...rep); } disp.push(t); return t; };
  const light = (l: any, x: number, y: number, z: number) => { l.position.set(x, y, z); G.add(l); return l; };
  const L = o.lamps;
  let stadium: Stadium | null = null;
  const R = rng(o.seed + 7);

  /** A crowd of simple people (instanced): bodies in mixed colours (or a club's), heads, bobbing from t. */
  const crowd = (pts: Vec3[], colours: string[], face: Vec3 | null, scale = 1, bob = 0.04) => {
    const n = pts.length;
    if (!n) return;
    const bodyG = new T.CapsuleGeometry(0.2 * scale, 0.75 * scale, 3, 8);
    const headG = new T.SphereGeometry(0.12 * scale, 10, 8);
    disp.push(bodyG, headG);
    const bm = mat("#ffffff"), hm = mat("#ffffff");
    const bodies = new T.InstancedMesh(bodyG, bm, n), heads = new T.InstancedMesh(headG, hm, n);
    const skins = ["#c68642", "#8d5524", "#e0ac69", "#f1c27d", "#5c3a1e", "#a36a3e"];
    const ph: number[] = [];
    for (let i = 0; i < n; i++) {
      bodies.setColorAt(i, new T.Color(colours[i % colours.length]).offsetHSL(0, 0, (R.next() - 0.5) * 0.12));
      heads.setColorAt(i, new T.Color(skins[Math.floor(R.next() * skins.length)]));
      ph.push(R.next() * 6.28);
    }
    const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1), p = new T.Vector3();
    const place = (t: number) => {
      for (let i = 0; i < n; i++) {
        const [x, y, z] = pts[i];
        const b = Math.max(0, Math.sin(t * 5 + ph[i])) * bob;
        const yaw = face ? Math.atan2(face[0] - x, face[2] - z) : 0;
        q.setFromAxisAngle(new T.Vector3(0, 1, 0), yaw);
        p.set(x, y + 0.6 * scale + b, z); m4.compose(p, q, s); bodies.setMatrixAt(i, m4);
        p.set(x, y + 1.3 * scale + b, z); m4.compose(p, q, s); heads.setMatrixAt(i, m4);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    };
    place(0);
    G.add(bodies, heads);
    if (bob > 0) updaters.push(place);
  };

  if (id === "pitch") {
    stadium = buildStadium(T, kit, tier, {});
    G.add(stadium.group);
    // a little podium for presentations (only seen when used)
  } else if (id === "office") {
    const wood = mat("#7a4a2a", { rough: 0.45 }), dark = mat("#3a2418", { rough: 0.6 }), wall = mat("#d4bea2", { rough: 0.9 }), leather = mat("#231a16", { rough: 0.45 }), brass = mat("#c8942f", { metal: 0.8, rough: 0.3 });
    plane(9, 9, 0, 0, 0, -Math.PI / 2, 0, mat("#4a2e20", { rough: 0.7 }));
    const rug = plane(3.2, 2.4, 0, 0.004, 0.1, -Math.PI / 2, 0, mat("#6a2433", { rough: 0.95 })); void rug;
    const BACK = -2.2, FRONT = 2.5, SIDE = 2.4;
    // back wall: panelling, a wide window over the ground
    box(SIDE * 2, 0.95, 0.08, 0, 0.475, BACK, dark);
    box(SIDE * 2, 0.55, 0.08, 0, 3.0, BACK, wall);
    for (const s of [-1, 1]) box(SIDE - 1.8, 1.8, 0.08, s * (1.8 + (SIDE - 1.8) / 2), 1.85, BACK, wall);
    const frame = mat("#2b2724", { rough: 0.5, metal: 0.3 });
    for (const x of [-1.8, -0.6, 0.6, 1.8]) box(0.07, 1.8, 0.1, x, 1.85, BACK, frame);
    box(3.67, 0.07, 0.1, 0, 2.74, BACK, frame); box(3.67, 0.09, 0.14, 0, 0.98, BACK + 0.02, frame);
    // side and front walls
    for (const s of [-1, 1]) {
      plane(FRONT - BACK, 3.3, s * SIDE, 1.65, (FRONT + BACK) / 2, 0, -s * Math.PI / 2, wall);
      plane(FRONT - BACK, 0.95, s * (SIDE - 0.01), 0.475, (FRONT + BACK) / 2, 0, -s * Math.PI / 2, dark);
    }
    plane(SIDE * 2, 3.3, 0, 1.65, FRONT, 0, Math.PI, wall);
    plane(SIDE * 2, 3.3, 0, 3.27, 0, Math.PI / 2, 0, mat("#e9dcc8"));
    // framed shirts, a bookcase, a trophy cabinet, a plant, a club scarf on his chair
    const fs = canvas(256, 320); { const g = fs.getContext("2d")!; g.fillStyle = "#2b2016"; g.fillRect(0, 0, 256, 320); g.fillStyle = "#efe6d4"; g.fillRect(14, 14, 228, 292); g.fillStyle = o.shirt; g.beginPath(); g.moveTo(80, 60); g.lineTo(176, 60); g.lineTo(220, 110); g.lineTo(196, 130); g.lineTo(186, 120); g.lineTo(186, 270); g.lineTo(70, 270); g.lineTo(70, 120); g.lineTo(60, 130); g.lineTo(36, 110); g.closePath(); g.fill(); g.fillStyle = o.trim; g.fillRect(110, 60, 36, 10); }
    const shirtM = mat("#ffffff", { map: tex(fs) });
    for (const [x, z, ry] of [[-SIDE + 0.03, -0.9, Math.PI / 2], [SIDE - 0.03, -0.9, -Math.PI / 2], [-SIDE + 0.03, 0.6, Math.PI / 2]] as const) plane(0.56, 0.7, x, 1.8, z, 0, ry, shirtM);
    box(0.36, 2.0, 1.3, SIDE - 0.2, 1.0, 1.2, dark);
    const books = ["#7f1d1d", "#1e3a8a", "#14532d", "#a16207", "#334155", "#6b21a8"];
    for (let s = 0; s < 4; s++) { box(0.33, 0.025, 1.24, SIDE - 0.22, 0.25 + s * 0.45, 1.2, wood); let z = 0.62; let k = s * 3; while (z < 1.76) { const w = 0.035 + (k % 4) * 0.01, h = 0.24 + (k % 3) * 0.04; box(0.22, h, w, SIDE - 0.26, 0.26 + s * 0.45 + h / 2, z, mat(books[k % books.length])); z += w + 0.006; k++; } }
    // desk (the live signing's dimensions), chairs
    box(DESK.w, 0.04, DESK.d, 0, DESK.top - 0.02, 0, wood);
    for (const s of [-1, 1]) box(0.36, DESK.top - 0.04, DESK.d - 0.06, s * (DESK.w / 2 - 0.2), (DESK.top - 0.04) / 2, 0, wood);
    box(0.5, 0.004, 0.4, 0, DESK.top + 0.002, 0.07, mat("#18120f", { rough: 0.55 }));
    // lamp
    cyl(0.07, 0.08, 0.02, -0.55, DESK.top + 0.01, -0.16, brass);
    cyl(0.009, 0.009, 0.38, -0.55, DESK.top + 0.2, -0.16, brass);
    const shade = cyl(0.04, 0.1, 0.11, -0.55, DESK.top + 0.4, -0.16, mat("#2f5d3a", { side: T.DoubleSide })); void shade;
    const bulb = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new T.MeshBasicMaterial({ color: new T.Color(4, 3.2, 2) })); bulb.position.set(-0.55, DESK.top + 0.36, -0.16); G.add(bulb);
    light(new T.PointLight(L.color, 2.4 * L.intensity, 4, 1.6), -0.55, DESK.top + 0.32, -0.16);
    light(new T.PointLight("#ffe2c0", 1.5 * L.intensity, 7, 1.4), 1.2, 2.4, 1.6);
    const faceFill = new T.DirectionalLight("#fff1e0", 0.9); faceFill.position.set(0.5, 1.9, -2.6); faceFill.target.position.set(0, 1.2, 0.6); G.add(faceFill, faceFill.target);
    const chair = (z: number, yaw: number) => {
      const g = new T.Group();
      box(0.52, 0.09, 0.5, 0, 0.515, -0.23, leather, g); const back = box(0.52, 0.68, 0.1, 0, 0.93, -0.52, leather, g); back.rotation.x = -0.1;
      for (const s of [-1, 1]) box(0.05, 0.04, 0.4, s * 0.29, 0.72, -0.25, leather, g);
      box(0.06, 0.44, 0.06, 0, 0.25, -0.23, mat("#222222", { metal: 0.6, rough: 0.4 }), g);
      g.position.z = z; g.rotation.y = yaw; G.add(g); return g;
    };
    void chair; // the chairs are props (chair.you / chair.boss), so a scene can push them back
    // the scarf over the manager's chair back
    const sc = canvas(256, 32); { const g = sc.getContext("2d")!; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? o.trim : o.shirt; g.fillRect(i * 32, 0, 32, 32); } }
    const scarf = box(0.16, 0.7, 0.02, -0.18, 1.0, -0.98, mat("#ffffff", { map: tex(sc) })); scarf.rotation.set(-0.1, 0, 0.05);
    // plant
    cyl(0.17, 0.13, 0.36, -1.9, 0.18, -1.7, mat("#e5e0d8"));
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const leaf = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), mat("#2f6b34")); leaf.scale.set(0.55, 1.4, 0.3); leaf.position.set(-1.9 + Math.sin(a) * 0.12, 0.62 + (i % 3) * 0.14, -1.7 + Math.cos(a) * 0.12); leaf.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5); G.add(leaf); disp.push(leaf.geometry); }
    // the ground through the window: the real stadium, the near stand left out, below and far
    stadium = buildStadium(T, kit, tier, { skip: ["S"] });
    stadium.group.position.set(-6, -15, BACK - 9.5 - 105);
    G.add(stadium.group);
  } else if (id === "tunnel") {
    const conc = mat("#8d8579", { rough: 0.95 }), wallM = mat("#c9c1b4", { rough: 0.9 }), floor = mat("#3a3d42", { rough: 0.8 });
    plane(3.2, 22, 0, 0, 8, -Math.PI / 2, 0, floor);
    // kit-coloured stripe and a rubber runner
    plane(1.0, 20, 0, 0.003, 8, -Math.PI / 2, 0, mat("#1c1f24"));
    for (const s of [-1, 1]) {
      plane(20, 2.7, s * 1.6, 1.35, 8, 0, -s * Math.PI / 2, wallM);
      plane(20, 0.18, s * 1.59, 1.0, 8, 0, -s * Math.PI / 2, mat(o.shirt));
      plane(20, 0.05, s * 1.585, 1.12, 8, 0, -s * Math.PI / 2, mat(o.trim));
    }
    plane(3.2, 20, 0, 2.7, 8, Math.PI / 2, 0, conc);
    // strip lights
    for (let z = -1; z < 18; z += 2.2) {
      const strip = new T.Mesh(new T.BoxGeometry(0.16, 0.03, 1.2), new T.MeshBasicMaterial({ color: new T.Color(3, 2.9, 2.6) })); strip.position.set(0, 2.68, z); G.add(strip); disp.push(strip.geometry);
      if (tier !== "low" && Math.round(z) % 4 === 1) light(new T.PointLight("#fff1dc", 1.6 * L.intensity, 4.5, 1.6), 0, 2.4, z);
    }
    // the club's name over the mouth
    const nc = canvas(1024, 128); { const g = nc.getContext("2d")!; g.fillStyle = o.shirt; g.fillRect(0, 0, 1024, 128); g.fillStyle = o.trim; g.font = "900 70px system-ui"; g.textAlign = "center"; g.fillText(`THIS IS ${o.club.toUpperCase()}`.slice(0, 30), 512, 90); }
    plane(3.2, 0.4, 0, 2.48, 17.9, 0, Math.PI, mat("#ffffff", { map: tex(nc) }));
    plane(3.2, 0.4, 0, 2.48, 17.85, 0, 0, mat("#ffffff", { map: tex(nc) }));
    // the stadium beyond the mouth: its West touchline at the tunnel's end, pitch running across
    stadium = buildStadium(T, kit, tier, { skip: ["W"] });
    stadium.group.rotation.y = -Math.PI / 2;
    // stadium (X, Z) → world (52.5 − Z, X + 58): the halfway line straight ahead, the touchline 6 m past the mouth
    stadium.group.position.set(52.5, -0.01, 18 + 6 + 34);
    G.add(stadium.group);
  } else if (id === "dressing-room") {
    plane(6, 7, 0, 0, 0, -Math.PI / 2, 0, mat("#9aa4ad", { rough: 0.8 }));
    plane(6, 3, 0, 2.9, 0, Math.PI / 2, 0, mat("#e8e4dc"));
    const wl = mat("#e9e4da"), wood = mat("#8a5a34", { rough: 0.5 });
    for (const s of [-1, 1]) { plane(7, 3, s * 3, 1.5, 0, 0, -s * Math.PI / 2, wl); box(0.45, 0.06, 6, s * 2.65, 0.45, 0, wood); for (let z = -2.6; z < 2.8; z += 1.3) box(0.06, 0.45, 0.06, s * 2.65, 0.22, z, wood); }
    plane(6, 3, 0, 1.5, -3, 0, 0, wl); plane(6, 3, 0, 1.5, 3.4, 0, Math.PI, wl);
    // shirts on pegs, numbers on the backs
    const shirtTex = (n: number) => { const c = canvas(128, 160); const g = c.getContext("2d")!; g.fillStyle = o.shirt; g.beginPath(); g.moveTo(40, 6); g.lineTo(88, 6); g.lineTo(124, 36); g.lineTo(108, 50); g.lineTo(100, 44); g.lineTo(100, 156); g.lineTo(28, 156); g.lineTo(28, 44); g.lineTo(20, 50); g.lineTo(4, 36); g.closePath(); g.fill(); g.fillStyle = o.trim; g.font = "900 64px system-ui"; g.textAlign = "center"; g.fillText(String(n), 64, 112); return tex(c); };
    let n = 1;
    for (const s of [-1, 1]) for (let z = -2.4; z < 2.6; z += 0.75) { const m = mat("#ffffff", { map: shirtTex(n++), transparent: true, alphaTest: 0.4 }); plane(0.5, 0.62, s * 2.92, 1.5, z, 0, -s * Math.PI / 2, m); }
    // tactics board
    box(1.6, 1.0, 0.04, 0, 1.6, -2.95, mat("#f7f7f7"));
    light(new T.PointLight(L.color, 2.2 * L.intensity, 8, 1.4), 0, 2.6, 0);
    light(new T.PointLight(L.color, 1.4 * L.intensity, 6, 1.4), 0, 2.4, -2);
  } else if (id === "awards-stage") {
    plane(30, 30, 0, 0, 4, -Math.PI / 2, 0, mat("#120f18"));
    box(8, 0.9, 3.4, 0, 0.45, -0.8, mat("#1a1622", { rough: 0.4 }));
    box(8.2, 0.04, 3.6, 0, 0.9, -0.8, mat("#2a1f36", { rough: 0.3 }));
    for (let i = 0; i < 4; i++) box(1.2, 0.225, 0.3, -3.0, 0.1125 + i * 0.225, 1.05 - i * 0.3, mat("#1a1622"));
    // backdrop: gold arcs and the club's colours
    const bc = canvas(1024, 512); { const g = bc.getContext("2d")!; const gr = g.createRadialGradient(512, 280, 40, 512, 280, 600); gr.addColorStop(0, "#5a3a8a"); gr.addColorStop(1, "#0d0a14"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); g.strokeStyle = "#e0b23a"; g.lineWidth = 6; for (let r = 120; r < 700; r += 70) { g.beginPath(); g.arc(512, 560, r, Math.PI, 2 * Math.PI); g.stroke(); } g.fillStyle = "#f5e2a0"; g.font = "900 64px Georgia"; g.textAlign = "center"; g.fillText("THE AWARDS", 512, 120); }
    const bd = plane(9, 4.5, 0, 3.1, -2.6, 0, 0, new T.MeshBasicMaterial({ map: tex(bc) })); void bd;
    box(0.6, 1.1, 0.4, 1.35, 1.45, -0.2, mat("#2a1f36")).rotation.y = -0.5;
    // spotlights
    for (const [x, c] of [[-2.5, "#ffe2b8"], [2.5, "#ffd9f0"], [0, "#fff3dc"]] as const) {
      const sp = new T.SpotLight(c, 60 * L.intensity, 18, 0.32, 0.6, 1.4); sp.position.set(x, 7, 4); sp.target.position.set(x * 0.2, 0.9, -0.4); sp.castShadow = tier === "high"; G.add(sp, sp.target);
    }
    // the audience at round tables
    const pts: Vec3[] = [];
    for (let r = 0; r < 4; r++) for (let i = -6; i <= 6; i++) pts.push([i * 0.9 + (r % 2) * 0.45, 0, 3.4 + r * 1.3]);
    crowd(pts, ["#141414", "#1f2433", "#3a1f2a", "#20202a"], [0, 1, -1], 0.85, 0.02);
  } else if (id === "press-room") {
    plane(10, 10, 0, 0, 2, -Math.PI / 2, 0, mat("#2a3140"));
    // sponsor backdrop in the club's colours
    const bc = canvas(1024, 512); { const g = bc.getContext("2d")!; g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 1024, 512); for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) { const cx = x * 180 + (y % 2) * 90 + 40, cy = y * 110 + 50; g.fillStyle = (x + y) % 2 ? o.shirt : o.trim === "#ffffff" ? "#1f2433" : o.trim; g.font = "900 34px system-ui"; g.textAlign = "center"; g.fillText((x + y) % 2 ? o.club.toUpperCase().slice(0, 10) : "STAR", cx, cy); } }
    plane(8, 3.2, 0, 1.6, -1.25, 0, 0, mat("#ffffff", { map: tex(bc) }));
    box(3.6, 0.05, 0.8, 0, 0.74, -0.15, mat("#1f2433"));
    box(3.6, 0.7, 0.04, 0, 0.37, 0.22, mat(o.shirt));
    for (const x of [-0.45, 0.55, 1.4]) { box(0.5, 0.08, 0.5, x, 0.48, -0.62, mat("#18181b")); box(0.5, 0.6, 0.06, x, 0.82, -0.88, mat("#18181b")); }
    // journalists, seated rows
    const pts: Vec3[] = [];
    for (let r = 0; r < 3; r++) for (let i = -4; i <= 4; i++) if (!(r === 0 && i === -1)) pts.push([i * 0.75, 0, 2.6 + r]);
    crowd(pts, ["#1f2933", "#475569", "#7c2d12", "#334155", "#e7e5e4"], [0, 1, -1], 0.8, 0.01);
    // TV cameras on tripods at the back
    for (const x of [-1.6, 1.6]) { cyl(0.02, 0.02, 1.4, x, 0.7, 6, mat("#111")); box(0.25, 0.2, 0.45, x, 1.5, 6, mat("#222")); }
    light(new T.PointLight("#fff2dc", 3 * L.intensity, 9, 1.3), 0, 2.8, 1.6);
    light(new T.PointLight("#ffe7c4", 1.6 * L.intensity, 8, 1.3), -2.5, 2.5, 3);
  } else if (id === "training-ground" || id === "garden") {
    const gc = canvas(256, 256); { const g = gc.getContext("2d")!; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#5fae43" : "#55a23c"; g.fillRect(0, i * 32, 256, 32); } }
    plane(120, 120, 0, 0, 0, -Math.PI / 2, 0, mat("#ffffff", { map: tex(gc, [12, 12]) }));
    const tree = (x: number, z: number, s: number) => { cyl(0.12 * s, 0.18 * s, 2 * s, x, s, z, mat("#5a3d24")); const top = new T.Mesh(new T.IcosahedronGeometry(1.3 * s, 0), mat("#3f7a3a")); top.position.set(x, 2.6 * s, z); top.castShadow = true; G.add(top); disp.push(top.geometry); };
    for (let i = 0; i < 26; i++) { const a = R.next() * Math.PI * 2, d = 22 + R.next() * 18; tree(Math.sin(a) * d, Math.cos(a) * d - 10, 0.9 + R.next() * 0.9); }
    if (id === "training-ground") {
      for (let i = 0; i < 8; i++) { const c = new T.Mesh(new T.ConeGeometry(0.11, 0.24, 12), mat("#f97316")); c.position.set(-3 + (i % 4) * 1.4, 0.12, 4 + Math.floor(i / 4) * 1.4); G.add(c); disp.push(c.geometry); }
      const post = mat("#f4f4f4");
      box(7.32, 0.1, 0.1, 0, 2.44, -12, post); for (const s of [-1, 1]) box(0.1, 2.44, 0.1, s * 3.66, 1.22, -12, post);
      for (let i = 0; i < 3; i++) { const m = new T.Mesh(new T.CapsuleGeometry(0.22, 1.2, 3, 8), mat("#facc15")); m.position.set(-1 + i * 0.8, 0.9, -7); G.add(m); disp.push(m.geometry); }
      for (let x = -30; x <= 30; x += 3) box(0.06, 2.5, 0.06, x, 1.25, -20, mat("#2b3a2b"));
      box(60, 2.4, 0.02, 0, 1.25, -20, mat("#355a38", { transparent: true, opacity: 0.55 }));
    } else {
      // the house, a patio, a hedge
      box(10, 5, 0.3, 0, 2.5, -3.5, mat("#d9c7a6"));
      box(2.4, 2.3, 0.06, 0, 1.15, -3.33, mat("#c9e2f0", { transparent: true, opacity: 0.7 }));
      plane(8, 4, 0, 0.01, -1.4, -Math.PI / 2, 0, mat("#b8a98e"));
      for (const s of [-1, 1]) box(0.8, 1.4, 14, s * 7, 0.7, 4, mat("#2f5d34"));
      box(1.6, 0.06, 0.45, -2.5, 0.45, 2, mat("#7a5230"));
    }
  } else if (id === "airport") {
    plane(20, 20, 0, 0, 0, -Math.PI / 2, 0, mat("#c9c6bf", { rough: 0.35 }));
    plane(20, 6, 0, 3, -7, 0, 0, mat("#9fb8c8", { transparent: true, opacity: 0.55 }));
    box(20, 0.2, 0.3, 0, 5.9, -7, mat("#5b6470"));
    for (let x = -9; x <= 9; x += 3) box(0.2, 6, 0.3, x, 3, -7, mat("#5b6470"));
    box(3, 0.2, 0.2, 0, 2.6, -5.6, mat("#3b4450"));
    for (const s of [-1, 1]) for (let z = -4; z <= 6; z += 1) { box(0.04, 1.0, 0.04, s * 1.9, 0.5, z, mat("#c0c4c8", { metal: 0.6 })); }
    for (const s of [-1, 1]) box(0.02, 0.06, 11, s * 1.9, 1.0, 1, mat("#c0c4c8", { metal: 0.6 }));
    // fans behind the barriers in the club's colours
    const pts: Vec3[] = [];
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let z = -4; z <= 6; z += 0.6) pts.push([s * (2.4 + r * 0.55), 0, z + r * 0.2]);
    crowd(pts, [o.shirt, o.shirt, o.trim, "#1f2433", o.shirt], [0, 1, 0], 1, 0.09);
    light(new T.PointLight("#fff4e0", 2.4 * L.intensity, 14, 1.2), 0, 4.5, 0);
  }
  return {
    group: G, stadium,
    update(t, dt) { for (const u of updaters) u(t); stadium?.update(dt, t); },
    dispose() { for (const d of disp) d.dispose?.(); },
  };
}
