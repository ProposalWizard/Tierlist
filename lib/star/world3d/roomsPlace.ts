/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE COMPOUND'S RECEPTION AND CANTEEN, the 3D (28 Nov 2026). The plan is ./roomsPlan.ts (sizes, solids, chairs,
 * what the rooms say); this builds it, code-built in the compound's look (the timber cladding and the crest of the
 * building's front, the interior pictures that stood behind its glass: compoundPlace.ts interiorCanvas), no new
 * models. Every still piece is painted in vertex colours and joined into a few draws, as the gym (gymPlace.ts
 * painter): one matte, one metal, one lit, one glass; the pictures (the crest wall, the fixture screen, the menu
 * board, the cabinet's plaque) are one plane each.
 */
import { plantMesh, type PlantKind } from "../home3d/plants";
import { glowCanvas, wallCanvas, floorCanvas, viewCanvas } from "../home3d/textures";
import { painter, shadeOf } from "./gymPlace";
import { drawCrest, timberCanvas } from "./compoundPlace";
import { seatObject, standObject, type SmartObject } from "./smartObject";
import { RECEPTION, CANTEEN, ROOM_DOOR, canteenChairs, MATE_SEATS, CHAIR_FRONT, hipsOn, roomSolids, wallSolids, hasChef, type RoomId, type RoomInfo, type Solid } from "./roomsPlan";

export interface RoomEnv {
  THREE: any;
  scene: any;
  prof: { anisotropy: number; shadows: boolean };
  kit: { shirt: string; trim: string };
  club?: string;
  mergeGeometries: (g: any[]) => any;
  info: RoomInfo;
}
export interface RoomOut {
  objects: SmartObject[];
  solids: Solid[];
  bounds: [number, number, number, number];
  you: { x: number; z: number; yaw: number };
  ceil: number;
  camBox: [number, number, number, number];
  sun: any;
  /** The seat each team-mate sits on (by his lunch order) and the one beside him for you. */
  mateSeats: { mate: SmartObject; you: SmartObject }[];
  /** Meshes made (for the report). */
  meshes: number;
}

const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
const inkOn = (hex: string) => { const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? "#111318" : "#ffffff"; };
/** Text that fits a width (shrinks the font). */
function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, weight = 900) {
  let s = px;
  do { g.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
  g.fillText(text, x, y);
}

/** The reception's north wall: the timber cladding, the crest big in the middle, the club's name under it. */
function crestWallCanvas(club: string, shirt: string, trim: string): HTMLCanvasElement {
  const [c, g] = cv(1536, 768);
  const t = timberCanvas();
  for (let x = 0; x < 1536; x += 512) for (let y = 0; y < 768; y += 512) g.drawImage(t, x, y);
  // a soft light down the wall from the ceiling, darker at the floor
  const gr = g.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, "rgba(255,235,200,0.18)"); gr.addColorStop(0.6, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = gr; g.fillRect(0, 0, 1536, 768);
  // the crest's own lit panel: a slim backlit frame
  g.fillStyle = "rgba(255,244,220,0.22)"; g.fillRect(588, 70, 360, 380);
  drawCrest(g, 768, 250, 2.6, shirt, trim, club);
  g.fillStyle = "#f6efe3"; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, club.toUpperCase(), 768, 520, 1200, 84);
  g.fillStyle = "rgba(246,239,227,0.78)"; fit(g, "TRAINING CENTRE", 768, 600, 900, 40, 800);
  return c;
}

/** The fixture screen: the club's colour bar, NEXT MATCH, the teams, the date and time. */
function screenCanvas(s: RoomInfo["screen"], shirt: string): HTMLCanvasElement {
  const [c, g] = cv(768, 432);
  const gr = g.createLinearGradient(0, 0, 768, 432); gr.addColorStop(0, "#0d1422"); gr.addColorStop(1, "#1b2740");
  g.fillStyle = gr; g.fillRect(0, 0, 768, 432);
  g.fillStyle = shirt; g.fillRect(0, 0, 768, 64);
  g.fillStyle = inkOn(shirt); g.textAlign = "left"; g.textBaseline = "middle"; g.font = `900 34px ${FONT}`; g.fillText(s.title, 30, 34);
  g.fillStyle = "#facc15"; g.fillRect(30, 96, 90, 6);
  g.textAlign = "center"; g.fillStyle = "#ffffff";
  fit(g, s.lines[0] ?? "", 384, 190, 700, 58);
  g.fillStyle = "#cbd5e1"; fit(g, s.lines[1] ?? "", 384, 280, 700, 40, 800);
  g.fillStyle = "#facc15"; fit(g, (s.lines[2] ?? "").toUpperCase(), 384, 350, 700, 28, 800);
  return c;
}

/** The trophy cabinet's plaque: one line per trophy, or where they will stand. */
function plaqueCanvas(trophies: string[]): HTMLCanvasElement {
  const [c, g] = cv(512, 256);
  g.fillStyle = "#1c1a17"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 6; g.strokeRect(8, 8, 496, 240);
  g.fillStyle = "#e8c66a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 30px ${FONT}`; g.fillText("HONOURS", 256, 42);
  g.fillStyle = "#f1e9da";
  if (!trophies.length) { g.font = `800 24px ${FONT}`; g.fillText("Your trophies", 256, 118); g.fillText("will stand here.", 256, 154); }
  else trophies.slice(0, 5).forEach((t, i) => fit(g, t, 256, 92 + i * 34, 460, 22, 800));
  return c;
}

/** The canteen's back wall: white tiles, the menu board (the hall's own words: life/lunch.ts hallOf). */
function menuWallCanvas(hall: RoomInfo["hall"], shirt: string): HTMLCanvasElement {
  const [c, g] = cv(1536, 512);
  g.fillStyle = "#eef0ee"; g.fillRect(0, 0, 1536, 512);
  for (let x = 0; x < 1536; x += 48) { g.fillStyle = "rgba(120,128,130,0.35)"; g.fillRect(x, 0, 2, 512); }
  for (let y = 0; y < 512; y += 24) { g.fillStyle = "rgba(120,128,130,0.3)"; g.fillRect(0, y, 1536, 2); }
  // the board: dark, framed, the hall's title and today's four plates
  const bx = 330, by = 40, bw = 876, bh = 260;
  g.fillStyle = "#1d211f"; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = "#6b5440"; g.lineWidth = 12; g.strokeRect(bx, by, bw, bh);
  g.fillStyle = shirt; g.fillRect(bx + 6, by + 6, bw - 12, 10);
  g.fillStyle = "#f5f1e6"; g.textAlign = "center"; g.textBaseline = "middle"; fit(g, hall.title.toUpperCase(), bx + bw / 2, by + 52, bw - 60, 44);
  g.textAlign = "left";
  hall.menu.forEach(([plate, food], i) => {
    const y = by + 112 + i * 38;
    g.fillStyle = "#facc15"; g.font = `900 24px ${FONT}`; g.fillText(plate.toUpperCase(), bx + 40, y);
    g.fillStyle = "#f5f1e6"; g.font = `700 25px ${FONT}`;
    const w = bw - 260; let s = 25; while (g.measureText(food).width > w && s > 14) { s -= 1; g.font = `700 ${s}px ${FONT}`; }
    g.fillText(food, bx + 210, y);
  });
  return c;
}

/** Build a room into env.scene. */
export function buildRoom(id: RoomId, env: RoomEnv): RoomOut {
  const { THREE, scene, prof, kit } = env;
  const R = id === "reception" ? RECEPTION : CANTEEN;
  const { W2, D2, H } = R;
  const club = env.club ?? "Club";
  const top = id === "canteen" ? hasChef(env.info.hall.kind) : true; // the canteen's finish follows the club's size
  const premier = id === "canteen" && env.info.hall.kind === "chef";
  let meshes = 0;
  const tex = (c: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const mesh = (g: any, m: any, o: { cast?: boolean; receive?: boolean } = {}) => { const me = new THREE.Mesh(g, m); me.castShadow = !!o.cast; me.receiveShadow = o.receive ?? true; meshes++; scene.add(me); return me; };
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, ry = 0) => { const p = mesh(new THREE.PlaneGeometry(w, h), m, { receive: false }); p.position.set(x, y, z); p.rotation.y = ry; return p; };

  scene.background = new THREE.Color("#14120f");
  // ── light: a warm room light from above, daylight from the door's side ──
  scene.add(new THREE.HemisphereLight(id === "reception" ? "#fff3e4" : "#fff1dc", "#4a3e32", 1.2));
  const sun = new THREE.DirectionalLight("#ffe6c4", 1.35);
  sun.position.set(-2.5, 6.5, D2 + 2.5);
  sun.target.position.set(0.5, 0, -0.5);
  scene.add(sun, sun.target);
  sun.castShadow = prof.shadows;
  { const r = Math.max(W2, D2) + 1; Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 22 }); }
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;

  // ── floor, walls, ceiling ──
  const floorKind = id === "reception" ? "stone" : premier ? "oak" : "boards";
  const floor = mesh(new THREE.PlaneGeometry(W2 * 2, D2 * 2), new THREE.MeshStandardMaterial({ map: tex(floorCanvas(floorKind), [W2, D2]), roughness: floorKind === "stone" ? 0.38 : 0.62 }));
  floor.rotation.x = -Math.PI / 2;
  const wallPaint = id === "reception" ? "#e6e3dc" : premier ? "#d8c7a8" : top ? "#d9d2c2" : "#cfd7d2";
  const wallParts: any[] = [];
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (y - h / 2 + uv.getY(i) * h) / H);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
    wallParts.push(g);
  };
  const d = ROOM_DOOR.w2, dh = ROOM_DOOR.h;
  wall(W2 * 2, H, 0, H / 2, -D2, 0);
  wall(D2 * 2, H, -W2, H / 2, 0, Math.PI / 2);
  wall(D2 * 2, H, W2, H / 2, 0, -Math.PI / 2);
  wall(W2 - d, H, -(W2 + d) / 2, H / 2, D2, Math.PI);
  wall(W2 - d, H, (W2 + d) / 2, H / 2, D2, Math.PI);
  wall(d * 2, H - dh, 0, dh + (H - dh) / 2, D2, Math.PI);
  mesh(env.mergeGeometries(wallParts), new THREE.MeshStandardMaterial({ map: tex(wallCanvas(wallPaint)), roughness: 0.9 }));
  for (const g of wallParts) g.dispose();
  const ceil = mesh(new THREE.PlaneGeometry(W2 * 2, D2 * 2), new THREE.MeshStandardMaterial({ color: "#efebe3", roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;

  const P = painter(THREE, env.mergeGeometries); // matte
  const S = painter(THREE, env.mergeGeometries); // metal
  const L = painter(THREE, env.mergeGeometries); // lit
  const Gl = painter(THREE, env.mergeGeometries); // glass
  const glows: any[] = [];
  const glow = (x: number, z: number, w: number, dd: number) => { const g = new THREE.PlaneGeometry(w, dd); g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2)); g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0.006, z)); glows.push(g); };
  const shirt = kit.shirt, trim = kit.trim;
  const dark = "#26282d", trimC = "#3a3631";

  // skirting round the walls, the door's frame, and through the door: the forecourt's daylight
  for (const [w, x, z, ry] of [[W2 * 2, 0, -D2 + 0.006, 0], [D2 * 2, -W2 + 0.006, 0, Math.PI / 2], [D2 * 2, W2 - 0.006, 0, Math.PI / 2]] as [number, number, number, number][]) P.box(w, 0.1, 0.012, trimC, x, 0.05, z, 0, ry);
  for (const sx of [-1, 1]) P.box(0.09, dh, 0.18, dark, sx * (d + 0.045), dh / 2, D2 - 0.02);
  P.box(d * 2 + 0.18, 0.09, 0.18, dark, 0, dh + 0.045, D2 - 0.02);
  // the glass doors stood open, and the bright forecourt beyond (never black)
  for (const sx of [-1, 1]) { Gl.box(0.9, dh - 0.1, 0.02, "#bfd7e4", sx * (d + 0.55), dh / 2, D2 - 0.25, 0, sx * 1.15); S.box(0.04, dh - 0.1, 0.04, "#9aa0a8", sx * (d + 0.12), dh / 2, D2 - 0.1); }
  L.box(d * 2 + 1.6, dh + 0.6, 0.02, "#e9ecef", 0, (dh + 0.6) / 2, D2 + 1.6);
  P.box(d * 2 + 1.6, 0.02, 1.6, "#bdb7ac", 0, 0.002, D2 + 0.8);
  for (const sx of [-1, 1]) L.box(0.02, dh + 0.6, 1.6, "#d6d2c8", sx * (d + 0.8), (dh + 0.6) / 2, D2 + 0.8);
  L.box(d * 2 + 1.6, 0.02, 1.6, "#f2efe8", 0, dh + 0.6, D2 + 0.8);

  // ceiling downlights in rows, each with a soft glow on the floor (no light of their own: the governor's rule)
  const lightRows = id === "reception" ? [-2.6, 0, 2.6] : [-1.5, 1.1, 3.4];
  const lightCols = id === "reception" ? [-3.8, -1.3, 1.3, 3.8] : [-4.2, -1.4, 1.4, 4.2];
  if (id === "canteen" && !premier) {
    // a club canteen: long strip lights
    for (const z of lightRows) for (const x of [-3.3, 3.0]) { L.box(1.6, 0.03, 0.14, "#f6f8fb", x, H - 0.02, z); P.box(1.7, 0.05, 0.2, "#c8c4bc", x, H - 0.005, z); glow(x, z, 3, 1.6); }
  } else {
    for (const z of lightRows) for (const x of lightCols) { L.cyl(0.09, 0.09, 0.02, "#fff6dc", x, H - 0.01, z, 0, 0, 0, 12); glow(x, z, 1.6, 1.6); }
  }

  const objects: SmartObject[] = [];
  const mateSeats: { mate: SmartObject; you: SmartObject }[] = [];
  const plants: [number, number, PlantKind, number][] = [];

  if (id === "reception") {
    const Rc = RECEPTION;
    // ── the crest wall (north): timber, the crest, the club's name ──
    plane(W2 * 2 - 0.02, H - 0.02, new THREE.MeshStandardMaterial({ map: tex(crestWallCanvas(club, shirt, trim)), roughness: 0.75 }), 0, H / 2, -D2 + 0.012);
    // a slim lit line along its top and its foot
    L.box(W2 * 2 - 0.2, 0.025, 0.04, "#ffe7bf", 0, H - 0.1, -D2 + 0.05);
    // ── the desk: white with a band of the club's colour, a dark ledge, a lit strip under it, the worktop behind ──
    const Dk = Rc.desk, dw = Dk.x1 - Dk.x0, dz = (Dk.z0 + Dk.z1) / 2;
    P.box(dw, Dk.ledge - 0.06, Dk.z1 - Dk.z0, "#f1efe9", 0, (Dk.ledge - 0.06) / 2, dz);
    P.box(dw + 0.04, 0.16, 0.02, shirt, 0, Dk.ledge - 0.3, Dk.z1 + 0.005);
    P.box(dw + 0.1, 0.05, 0.36, "#2a2d33", 0, Dk.ledge - 0.03, Dk.z1 - 0.1);
    L.box(dw - 0.1, 0.02, 0.02, "#ffe9c4", 0, 0.08, Dk.z1 + 0.02);
    P.box(dw - 0.2, 0.04, 0.55, "#e7e3da", 0, Dk.top, Dk.z0 - 0.2);
    // the desk's sign, its two monitors and a phone
    L.box(0.9, 0.16, 0.012, shirt, 0, Dk.ledge - 0.3, Dk.z1 + 0.018);
    for (const x of [-0.45, 0.95]) { S.box(0.5, 0.3, 0.03, "#16181c", x, Dk.top + 0.27, Dk.z0 - 0.3); L.box(0.46, 0.26, 0.005, "#2b4a6e", x, Dk.top + 0.27, Dk.z0 - 0.283); S.box(0.04, 0.1, 0.04, "#16181c", x, Dk.top + 0.07, Dk.z0 - 0.32); }
    P.box(0.18, 0.05, 0.14, "#1b1d21", -1.15, Dk.top + 0.04, Dk.z0 - 0.15);
    // a vase of flowers and a sign-in tablet on the ledge
    P.cyl(0.06, 0.05, 0.22, "#e9e4da", -1.4, Dk.ledge + 0.11, Dk.z1 - 0.12);
    for (let k = 0; k < 5; k++) P.ball(0.05, ["#f2c14e", "#ffffff", shirt][k % 3], -1.4 + Math.sin(k * 1.3) * 0.06, Dk.ledge + 0.26 + (k % 2) * 0.04, Dk.z1 - 0.12 + Math.cos(k * 1.3) * 0.06, 8);
    S.box(0.26, 0.02, 0.18, "#1b1d21", 1.2, Dk.ledge + 0.01, Dk.z1 - 0.12, -0.25);
    L.box(0.22, 0.004, 0.14, "#5aa1e6", 1.2, Dk.ledge + 0.022, Dk.z1 - 0.12, -0.25);
    // ── the trophy cabinet (west wall): a dark frame, glass, lit shelves, the trophies ──
    const Cb = Rc.cabinet, cx = (Cb.x0 + Cb.x1) / 2, cz = (Cb.z0 + Cb.z1) / 2, cd = Cb.x1 - Cb.x0, cl = Cb.z1 - Cb.z0;
    P.box(cd, 0.5, cl, "#2a241e", cx, 0.25, cz);
    P.box(cd, 0.08, cl, "#2a241e", cx, Cb.h - 0.04, cz);
    for (const s of [-1, 1]) P.box(cd, Cb.h, 0.06, "#2a241e", cx, Cb.h / 2, cz + s * (cl / 2 - 0.03));
    P.box(0.04, Cb.h - 0.58, cl - 0.1, "#3b332b", Cb.x0 + 0.03, 0.5 + (Cb.h - 0.58) / 2, cz);
    const shelves = [0.95, 1.45];
    for (const y of [0.5, ...shelves]) { Gl.box(cd - 0.08, 0.015, cl - 0.12, "#dfeaf0", cx, y + 0.008, cz); }
    L.box(0.02, 0.02, cl - 0.14, "#fff1d2", Cb.x1 - 0.06, Cb.h - 0.1, cz);
    Gl.box(0.012, Cb.h - 0.58, cl - 0.1, "#cfe2ec", Cb.x1 - 0.01, 0.5 + (Cb.h - 0.58) / 2, cz);
    const cups = Math.min(8, env.info.trophies.length);
    const cupAt = (i: number): [number, number] => [[0.5, 0.95, 1.45][Math.floor(i / 3) % 3], cz - 0.9 + (i % 3) * 0.9];
    for (let i = 0; i < cups; i++) {
      const [y, z] = cupAt(i), gold = "#d8b04a";
      S.cyl(0.06, 0.08, 0.04, gold, cx, y + 0.03, z); S.cyl(0.02, 0.02, 0.12, gold, cx, y + 0.11, z); S.cyl(0.11, 0.05, 0.16, gold, cx, y + 0.25, z);
      for (const s of [-1, 1]) S.ring(0.045, 0.01, gold, cx, y + 0.26, z + s * 0.12, 0, Math.PI / 2);
    }
    // the rest of the shelves: signed balls, a framed shirt in the club's colours, a pennant (never an empty shelf)
    for (let i = cups; i < 9; i++) {
      const [y, z] = cupAt(i);
      if (i % 3 === 1) { P.box(0.04, 0.34, 0.3, "#f4f1ea", cx - 0.12, y + 0.18, z, 0, 0, 0.12); P.box(0.03, 0.26, 0.22, shirt, cx - 0.1, y + 0.18, z, 0, 0, 0.12); P.box(0.032, 0.05, 0.22, trim, cx - 0.1, y + 0.3, z, 0, 0, 0.12); }
      else { P.ball(0.11, "#f6f6f2", cx, y + 0.13, z, 12); P.cyl(0.07, 0.08, 0.03, "#2a241e", cx, y + 0.015, z, 0, 0, 0, 10); }
    }
    plane(0.62, 0.31, new THREE.MeshBasicMaterial({ map: tex(plaqueCanvas(env.info.trophies)), toneMapped: false }), Cb.x1 + 0.005, 0.32, cz, Math.PI / 2);
    // ── the fixture screen (east wall): a dark bezel, the picture ──
    const Sc = Rc.screen;
    S.box(0.06, Sc.h + 0.1, Sc.w + 0.1, "#111216", W2 - 0.04, Sc.y, Sc.z);
    plane(Sc.w, Sc.h, new THREE.MeshBasicMaterial({ map: tex(screenCanvas(env.info.screen, shirt)), toneMapped: false }), W2 - 0.075, Sc.y, Sc.z, -Math.PI / 2);
    // ── the sofa (dark, facing the screen), two armchairs in the club's colour, a coffee table, a rug ──
    const Sf = Rc.sofa, sb = Sf.box, sl = sb[3] - sb[2];
    P.box(0.6, 0.26, sl, "#2a2d33", (sb[0] + sb[1]) / 2 + 0.05, 0.22, (sb[2] + sb[3]) / 2);
    P.box(0.2, 0.72, sl, "#2a2d33", sb[0] + 0.1, 0.42, (sb[2] + sb[3]) / 2);
    for (const s of [-1, 1]) P.box(0.66, 0.56, 0.16, "#24272c", (sb[0] + sb[1]) / 2, 0.28, (sb[2] + sb[3]) / 2 + s * (sl / 2 - 0.08));
    for (let k = 0; k < 3; k++) P.box(0.42, 0.08, 0.58, "#33373e", Sf.at[0] - 0.05, Sf.y - 0.04, Sf.at[1] + (k - 1) * Sf.spacing);
    P.box(0.14, 0.34, 0.34, trim, sb[0] + 0.28, 0.62, Sf.at[1] - 0.6, 0, 0, -0.25); P.box(0.14, 0.34, 0.34, shirt, sb[0] + 0.28, 0.62, Sf.at[1] + 0.6, 0, 0, -0.25);
    for (const ch of Rc.chairs) {
      const [x0, x1, z0, z1] = ch.box, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, back = ch.facing === 0 ? z0 + 0.08 : z1 - 0.08;
      P.box(x1 - x0, 0.3, z1 - z0, shadeOf(shirt, 0.8), mx, 0.25, mz);
      P.box(x1 - x0, 0.48, 0.16, shadeOf(shirt, 0.7), mx, 0.58, back);
      for (const s of [-1, 1]) P.box(0.12, 0.26, z1 - z0, shadeOf(shirt, 0.65), mx + s * ((x1 - x0) / 2 - 0.06), 0.53, mz);
    }
    const Tb = Rc.table, tx = (Tb[0] + Tb[1]) / 2, tz = (Tb[2] + Tb[3]) / 2;
    P.box(Tb[1] - Tb[0], 0.05, Tb[3] - Tb[2], "#6b4f36", tx, 0.4, tz);
    S.box(Tb[1] - Tb[0] - 0.1, 0.36, 0.04, "#1c1d21", tx, 0.2, tz);
    P.box(0.3, 0.02, 0.22, "#f2f2ee", tx - 0.1, 0.435, tz - 0.25, 0, 0.3); P.box(0.28, 0.02, 0.2, shirt, tx + 0.15, 0.435, tz + 0.2, 0, -0.2);
    P.box(2.6, 0.01, 3.6, "#5d5a55", 2.95, 0.004, 0.2);
    P.box(2.4, 0.012, 3.4, "#77736b", 2.95, 0.005, 0.2);
    plants.push(...Rc.plants.map(([x, z], i): [number, number, PlantKind, number] => [x, z, (["fiddle", "monstera", "snake", "palm"] as PlantKind[])[i], [1.7, 1.2, 1.0, 1.6][i]]));
    // ── what you can use ──
    objects.push(standObject({ id: "desk", kind: "counter", label: "Reception desk", front: Rc.talk, face: Rc.clerk.at, verb: "Talk", lines: env.info.desk, pickR: 1.6, pickH: 1.3, who: "you" }));
    objects.push(seatObject({ id: "sofa", label: "Sofa", at: Sf.at, facing: Sf.facing, seats: Sf.seats, y: Sf.y, spacing: Sf.spacing, front: 0.16, verb: "Sit down", lines: ["Watch the screen for a bit."], who: "anyone" }));
    for (const ch of Rc.chairs) objects.push(seatObject({ id: ch.id, label: "Armchair", at: [ch.at[0], ch.at[1] + (ch.facing === 0 ? -0.04 : 0.04)], facing: ch.facing, seats: 1, y: 0.42, front: 0.16, verb: "Sit down", lines: ["A comfy seat by the screen."], who: "anyone" }));
    objects.push(standObject({ id: "cabinet", kind: "spot", label: "Trophy cabinet", front: [Cb.x1 + 0.85, cz], face: [Cb.x0, cz], verb: "Look", lines: env.info.trophies.length ? env.info.trophies.slice(0, 4) : ["No trophies of yours yet.", "Win something and it stands here."], pickR: 1.2, pickH: 2.2, who: "you" }));
    objects.push(standObject({ id: "screen", kind: "tv", label: "Next match", front: [4.45, Sc.z], face: [W2, Sc.z], verb: "Look", lines: env.info.screen.lines.slice(0, 2), pickR: 1.2, pickH: 2.6, who: "you" }));
  } else {
    const C = CANTEEN;
    const hall = env.info.hall;
    // ── the back wall: tiles and the menu board ──
    plane(W2 * 2 - 0.02, 2.0, new THREE.MeshStandardMaterial({ map: tex(menuWallCanvas(hall, shirt)), roughness: 0.5 }), 0, 1.0 + 0.9, -D2 + 0.012);
    // ── the window (east wall): the pitches outside ──
    const ww = 4.2, wh = 1.5, wy = 1.55;
    plane(ww, wh, new THREE.MeshBasicMaterial({ map: tex(viewCanvas("grounds")), toneMapped: false }), W2 - 0.014, wy, -0.4, -Math.PI / 2);
    for (const dy of [-1, 1]) P.box(0.08, 0.07, ww + 0.14, dark, W2 - 0.03, wy + dy * (wh / 2 + 0.035), -0.4);
    for (const dz of [-1, 0, 1]) P.box(0.08, wh + 0.14, 0.07, dark, W2 - 0.03, wy, -0.4 + dz * (ww / 2 + 0.035) * (dz ? 1 : 0));
    P.box(0.2, 0.05, ww + 0.2, "#e9e4da", W2 - 0.1, wy - wh / 2 - 0.06, -0.4);
    // ── the serving counter: steel, a timber front, the hot plates under a glass guard ──
    const Ct = C.counter, cw = Ct.x1 - Ct.x0, cmx = (Ct.x0 + Ct.x1) / 2, cmz = (Ct.z0 + Ct.z1) / 2;
    P.box(cw, Ct.top - 0.04, Ct.z1 - Ct.z0, premier ? "#7a5a3e" : "#a9b0b4", cmx, (Ct.top - 0.04) / 2, cmz);
    if (premier) for (let x = Ct.x0 + 0.08; x < Ct.x1; x += 0.16) P.box(0.02, Ct.top - 0.12, 0.012, "#5c432e", x, Ct.top / 2, Ct.z1 + 0.004);
    else P.box(cw, 0.12, 0.012, shirt, cmx, Ct.top - 0.2, Ct.z1 + 0.004);
    S.box(cw + 0.06, 0.04, Ct.z1 - Ct.z0 + 0.1, "#c9cdd3", cmx, Ct.top - 0.02, cmz);
    S.box(cw - 0.1, 0.03, 0.26, "#c9cdd3", cmx, Ct.top + 0.02, Ct.z1 + 0.1); // the tray slide
    L.box(cw - 0.2, 0.02, 0.02, "#ffe9c4", cmx, 0.1, Ct.z1 + 0.02);
    // the hot plates: steel trays of food along the counter (each a colour: greens, rice, pasta, salmon, chicken, pud)
    const food = top ? ["#4f8a3a", "#efe6cf", "#d9a441", "#f08b6a", "#e9c58a", "#7a3e24"] : ["#e7cf9a", "#d9b27a", "#e8e0c8"];
    const trayX0 = Ct.x0 + 0.5, trayN = food.length, step = (cw - (top ? 2.3 : 3.2)) / trayN;
    food.forEach((f, i) => {
      const x = trayX0 + i * step + step / 2;
      S.box(step - 0.06, 0.06, 0.44, "#8d949b", x, Ct.top + 0.01, cmz - 0.05);
      P.box(step - 0.12, 0.05, 0.36, f, x, Ct.top + 0.045, cmz - 0.05);
      if (top) for (let k = 0; k < 3; k++) P.ball(0.035, shadeOf(f, 0.85), x - 0.08 + k * 0.08, Ct.top + 0.075, cmz - 0.05 + (k - 1) * 0.08, 7);
    });
    // the sneeze guard: a glass sheet on posts over the food
    const gLen = trayN * step + 0.1;
    Gl.box(gLen, 0.02, 0.5, "#d7e8ef", trayX0 + gLen / 2 - 0.05, Ct.top + 0.42, cmz + 0.05);
    for (const x of [trayX0 - 0.02, trayX0 + gLen - 0.08]) S.cyl(0.015, 0.015, 0.42, "#c9cdd3", x, Ct.top + 0.21, Ct.z1 - 0.05);
    // a stack of white plates and trays at the start of the line, cutlery pots
    for (let k = 0; k < 8; k++) P.cyl(0.13, 0.11, 0.015, "#f6f6f2", Ct.x0 + 0.25, Ct.top + 0.02 + k * 0.018, cmz + 0.05, 0, 0, 0, 16);
    for (let k = 0; k < 6; k++) P.box(0.42, 0.012, 0.32, k % 2 ? shirt : "#2a2d33", Ct.x1 - 0.5, Ct.top + 0.012 + k * 0.014, cmz);
    for (const dx of [-0.1, 0.02, 0.14]) { S.cyl(0.04, 0.04, 0.12, "#c9cdd3", Ct.x1 - 1.05 + dx, Ct.top + 0.06, cmz + 0.12, 0, 0, 0, 10); S.cyl(0.006, 0.006, 0.14, "#e6e8ea", Ct.x1 - 1.05 + dx, Ct.top + 0.14, cmz + 0.12, 0, 0, 0.2, 5); }
    if (!top || !hasChef(hall.kind)) {
      // the lower leagues: a tea urn, cups, a tray of sandwiches under film
      const [ux, uz] = C.urn;
      S.cyl(0.16, 0.16, 0.48, "#c9cdd3", ux, Ct.top + 0.24, uz, 0, 0, 0, 18); S.cyl(0.1, 0.16, 0.08, "#c9cdd3", ux, Ct.top + 0.52, uz, 0, 0, 0, 18);
      P.ball(0.035, "#1b1d21", ux, Ct.top + 0.58, uz, 8);
      S.box(0.03, 0.03, 0.1, "#1b1d21", ux, Ct.top + 0.1, uz + 0.19); P.box(0.05, 0.03, 0.03, "#1b1d21", ux, Ct.top + 0.12, uz + 0.25);
      for (let k = 0; k < 6; k++) P.cyl(0.04, 0.035, 0.08, "#f2efe8", ux - 0.35 + (k % 3) * 0.1, Ct.top + 0.04 + Math.floor(k / 3) * 0.085, uz + 0.1, 0, 0, 0, 10);
      S.box(0.7, 0.02, 0.4, "#c9cdd3", ux + 0.55, Ct.top + 0.01, uz + 0.05);
      for (let k = 0; k < 8; k++) P.box(0.12, 0.06, 0.12, k % 2 ? "#e9d6a8" : "#f1e2bf", ux + 0.3 + (k % 4) * 0.14, Ct.top + 0.05, uz - 0.05 + Math.floor(k / 4) * 0.16, 0, 0.785, 0.5);
    }
    // behind the counter: the kitchen's back bench, pans on it, a hood
    P.box(cw, 0.9, 0.55, "#b8bdc1", cmx, 0.45, -D2 + 0.3);
    S.box(cw, 0.04, 0.6, "#c9cdd3", cmx, 0.92, -D2 + 0.3);
    if (top) for (const x of [-3.2, -2.4, 0.6, 1.4]) { S.cyl(0.15, 0.13, 0.16, "#8d949b", x, 1.02, -D2 + 0.3, 0, 0, 0, 14); S.box(0.24, 0.02, 0.03, "#1b1d21", x + 0.24, 1.08, -D2 + 0.3); }
    // ── tables and chairs: pedestal tables, chairs pulled out ──
    const topC = premier ? "#7a5a3e" : top ? "#d9d2c4" : "#e8e4da", chairC = premier ? shirt : top ? shadeOf(shirt, 0.85) : "#7c8389";
    for (const [tx, tz] of C.tables) {
      P.box(C.tableW2 * 2, 0.04, C.tableD2 * 2, topC, tx, C.tableH - 0.02, tz);
      S.cyl(0.05, 0.05, C.tableH - 0.04, "#2a2b30", tx, (C.tableH - 0.04) / 2, tz, 0, 0, 0, 10);
      S.box(0.9, 0.03, 0.5, "#2a2b30", tx, 0.015, tz);
    }
    const chairs = canteenChairs();
    for (const ch of chairs) {
      const f = ch.facing === 0 ? 1 : -1; // the way he looks along z
      // the seat (0.4 deep) ends CHAIR_FRONT in front of the sitter's hips: his knees hang clear past its edge
      const [x, hz] = hipsOn(ch), z = hz + f * (CHAIR_FRONT - 0.2);
      P.box(0.44, 0.05, 0.4, chairC, x, C.seatY - 0.025, z);
      P.box(0.44, 0.42, 0.04, chairC, x, C.seatY + 0.24, z - f * 0.2, -f * 0.12);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.cyl(0.012, 0.012, C.seatY - 0.05, "#2a2b30", x + sx * 0.19, (C.seatY - 0.05) / 2, z + sz * 0.17, 0, 0, 0, 6);
    }
    // the mates' plates (food on them), glasses, and for each the chair beside him (yours)
    const byId = new Map(chairs.map((c) => [c.id, c]));
    MATE_SEATS.forEach((ms, i) => {
      const mc = byId.get(ms.mate)!, yc = byId.get(ms.you)!;
      const tz = CANTEEN.tables[mc.table][1], f = mc.facing === 0 ? -1 : 1;
      const pz = tz + f * 0.2;
      if (i < env.info.mates.length) {
        P.cyl(0.13, 0.11, 0.02, "#f6f6f2", mc.at[0], C.tableH + 0.01, pz, 0, 0, 0, 16);
        P.ball(0.06, ["#d9a441", "#f08b6a", "#4f8a3a"][i % 3], mc.at[0] - 0.03, C.tableH + 0.04, pz, 8); P.ball(0.045, "#efe6cf", mc.at[0] + 0.05, C.tableH + 0.035, pz + 0.03, 7);
        Gl.cyl(0.035, 0.03, 0.12, "#d7e8ef", mc.at[0] + 0.2, C.tableH + 0.06, pz - f * 0.08);
      }
      const name = env.info.mates[i]?.name;
      const mate = seatObject({ id: `mseat-${i}`, label: "Chair", at: hipsOn(mc), facing: mc.facing, seats: 1, y: C.seatY, front: CHAIR_FRONT, who: "people" });
      mate.pick = { at: [99, 99], r: 0, h: 0 };
      const you = seatObject({ id: `seat-${i}`, label: name ? `Sit with ${name}` : "Chair", at: hipsOn(yc), facing: yc.facing, seats: 1, y: C.seatY, front: CHAIR_FRONT, verb: "Sit down", lines: name ? [`Eat with ${name}.`] : ["A free seat."], who: "you" });
      objects.push(mate, you);
      mateSeats.push({ mate, you });
    });
    // pendant lamps over the tables (the top two levels), in the club's colour
    // (one a table, high and small: low and big they hid the room from camera D)
    if (top) for (const [tx, tz] of C.tables) {
      const ly = H - 0.55;
      S.cyl(0.004, 0.004, H - ly, "#1b1d21", tx, (H + ly) / 2, tz, 0, 0, 0, 4);
      P.cyl(0.04, 0.15, 0.16, premier ? shirt : "#2a2b30", tx, ly, tz, 0, 0, 0, 14);
      L.cyl(0.13, 0.13, 0.01, "#ffe9c4", tx, ly - 0.08, tz, 0, 0, 0, 14);
      glow(tx, tz, 2.0, 1.4);
    }
    plants.push([-W2 + 0.45, D2 - 0.45, "fiddle", 1.6], [W2 - 0.45, D2 - 0.45, "monstera", 1.2]);
    objects.push(standObject({ id: "counter", kind: "counter", label: hall.title, front: C.serve, face: [C.serve[0], C.counter.z0], verb: "Pick a plate", lines: ["One plate a day, from half twelve."], pickR: 1.8, pickH: 1.6, who: "you" }));
  }

  // ── the plants (real leaves: home3d/plants.ts), one draw ──
  const solids: Solid[] = [...wallSolids(id), ...roomSolids(id)];
  if (plants.length) {
    const parts: any[] = [];
    for (const [x, z, kind, h] of plants) {
      const pm = plantMesh(THREE, kind, Math.abs(x * 31 + z * 17), { h, pot: "#2b2c30" });
      const g = pm.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0, z));
      parts.push(g); pm.geometry.dispose(); (pm.material as any)?.dispose?.();
    }
    mesh(env.mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.72, envMapIntensity: 0.6 }), { cast: true });
    for (const g of parts) g.dispose();
  }
  // ── join the painters ──
  mesh(P.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { cast: true });
  mesh(S.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.3 }), { cast: true });
  mesh(L.merged(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { receive: false });
  const gl = Gl.merged();
  if (gl) { const m = mesh(gl, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.3, depthWrite: false }), { receive: false }); m.renderOrder = 3; }
  if (glows.length) {
    const gm = mesh(env.mergeGeometries(glows), new THREE.MeshBasicMaterial({ map: tex(glowCanvas()), color: new THREE.Color("#ffe8c8").multiplyScalar(0.12), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), { receive: false });
    gm.renderOrder = 2;
    for (const g of glows) g.dispose();
  }
  return {
    objects, solids, mateSeats, meshes,
    bounds: [-W2, W2, -D2, D2],
    you: { x: R.you.x, z: R.you.z, yaw: R.you.yaw },
    ceil: H - 0.15,
    camBox: [-W2 + 0.25, W2 - 0.25, -D2 + 0.25, D2 - 0.25],
    sun,
  };
}
