/**
 * THE GROUND THE REPLAY IS FILMED IN — a stadium, a pitch and a goal, drawn in
 * true perspective from any camera.
 *
 * A goal video looks at the recorded goal (track.ts) from where a television
 * camera, a fan in the stand or a camera behind the net would be. Those are
 * real camera positions, so this draws the ground the way a lens sees it: the
 * same `project()` the first-person modes use (lib/star/firstPersonView.ts),
 * with one addition — anything that reaches behind the lens (a stretch of
 * grass running under the camera) is cut at the near plane instead of being
 * dropped, so a pitch stays a pitch whichever way the camera points.
 *
 * Everything is in pitch metres (lib/star/pitch.ts): x across, y up the pitch
 * from the goal line, z up. Nothing here moves, simulates or draws a random
 * number at draw time: the crowd is placed once, from a fixed seed.
 */
import { project, type FpCamera } from "../firstPersonView";
import {
  PITCH_W, HALF_LEN, CX, POST_L, POST_R, GOAL_H, SIX_L, SIX_R, SIX_DEPTH,
  BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R, CENTRE_R,
} from "../pitch";
import { mulberry32 } from "../season";

/** Nothing nearer the lens than this is drawn. */
export const CLIP_NEAR = 0.25;

export interface CamPt { u: number; v: number; d: number }
export interface ScreenPt { px: number; py: number; scale: number }

/** A world point in the camera's own frame (right, up, depth) — the same
 *  maths as project() before its divide. */
export function toCam(cam: FpCamera, x: number, y: number, z: number): CamPt {
  const fwd = cam.forward ?? { x: 0, y: -1 };
  const relX = x - cam.x, relY = y - cam.y, relZ = z - cam.eye;
  const d0 = relX * fwd.x + relY * fwd.y;
  const u = relX * -fwd.y + relY * fwd.x;
  const p = cam.pitch ?? 0;
  if (!p) return { u, v: relZ, d: d0 };
  const c = Math.cos(p), s = Math.sin(p);
  return { u, v: d0 * s + relZ * c, d: d0 * c - relZ * s };
}

export function fromCam(cam: FpCamera, q: CamPt): ScreenPt | null {
  if (q.d <= CLIP_NEAR * 0.999) return null;
  const scale = cam.focal / q.d;
  return { px: cam.W / 2 + q.u * scale, py: cam.horizon - q.v * scale, scale };
}

/** A world point on the screen, or null behind the lens. */
export function at(cam: FpCamera, x: number, y: number, z: number): ScreenPt | null {
  return project(cam, x, y, z);
}

type P3 = [number, number, number];

/** A world polygon on the screen, cut at the near plane. */
export function clipPolygon(cam: FpCamera, pts: P3[]): ScreenPt[] {
  const cp = pts.map(([x, y, z]) => toCam(cam, x, y, z));
  const out: CamPt[] = [];
  for (let i = 0; i < cp.length; i++) {
    const a = cp[i], b = cp[(i + 1) % cp.length];
    const ain = a.d >= CLIP_NEAR, bin = b.d >= CLIP_NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const k = (CLIP_NEAR - a.d) / (b.d - a.d);
      out.push({ u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k, d: CLIP_NEAR });
    }
  }
  const sp: ScreenPt[] = [];
  for (const q of out) { const s = fromCam(cam, q); if (s) sp.push(s); }
  return sp;
}

export function fillPolygon(ctx: CanvasRenderingContext2D, cam: FpCamera, pts: P3[], fill: string | CanvasGradient): boolean {
  const sp = clipPolygon(cam, pts);
  if (sp.length < 3) return false;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(sp[0].px, sp[0].py);
  for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].px, sp[i].py);
  ctx.closePath();
  ctx.fill();
  return true;
}

/** A world segment on the screen, cut at the near plane. */
export function clipSegment(cam: FpCamera, a: P3, b: P3): [ScreenPt, ScreenPt] | null {
  let ca = toCam(cam, a[0], a[1], a[2]), cb = toCam(cam, b[0], b[1], b[2]);
  if (ca.d < CLIP_NEAR && cb.d < CLIP_NEAR) return null;
  if (ca.d < CLIP_NEAR || cb.d < CLIP_NEAR) {
    const k = (CLIP_NEAR - ca.d) / (cb.d - ca.d);
    const m = { u: ca.u + (cb.u - ca.u) * k, v: ca.v + (cb.v - ca.v) * k, d: CLIP_NEAR };
    if (ca.d < CLIP_NEAR) ca = m; else cb = m;
  }
  const sa = fromCam(cam, ca), sb = fromCam(cam, cb);
  return sa && sb ? [sa, sb] : null;
}

/** A painted line `widthM` metres wide, thinner with distance, never < 0.6 px. */
function line(ctx: CanvasRenderingContext2D, cam: FpCamera, a: P3, b: P3, widthM: number): void {
  // Long lines are cut into pieces so each piece gets its own thickness.
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(1, Math.min(24, Math.ceil(len / 6)));
  for (let i = 0; i < n; i++) {
    const k0 = i / n, k1 = (i + 1) / n;
    const p: P3 = [a[0] + (b[0] - a[0]) * k0, a[1] + (b[1] - a[1]) * k0, a[2] + (b[2] - a[2]) * k0];
    const q: P3 = [a[0] + (b[0] - a[0]) * k1, a[1] + (b[1] - a[1]) * k1, a[2] + (b[2] - a[2]) * k1];
    const seg = clipSegment(cam, p, q);
    if (!seg) continue;
    const sc = (seg[0].scale + seg[1].scale) / 2;
    ctx.lineWidth = Math.max(0.6, widthM * sc);
    ctx.beginPath();
    ctx.moveTo(seg[0].px, seg[0].py);
    ctx.lineTo(seg[1].px, seg[1].py);
    ctx.stroke();
  }
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number, keep?: (x: number, y: number) => boolean): P3[][] {
  // Returns runs of points (a run breaks where `keep` says no).
  const runs: P3[][] = [];
  let cur: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (!keep || keep(x, y)) cur.push([x, y, 0]);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

// ── The look ────────────────────────────────────────────────────────────────

export interface SceneLook {
  /** Floodlit evening (true) or daylight. */
  night: boolean;
  weather?: string;
  /** Shirt colours in the crowd: most wear the home side's, a corner the away side's. */
  homeColours: string[];
  awayColours: string[];
}

const GRASS_A = "#2f8f3a";
const GRASS_B = "#287f33";
const SURROUND = "#24702d";

/** Sky and the light over the ground. */
export function drawSky(ctx: CanvasRenderingContext2D, cam: FpCamera, look: SceneLook): void {
  const { W, H } = cam;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (look.night) {
    g.addColorStop(0, "#050b1a");
    g.addColorStop(0.55, "#0f1d3a");
    g.addColorStop(1, "#1a2a46");
  } else if (look.weather === "rain" || look.weather === "snow") {
    g.addColorStop(0, "#5c6673");
    g.addColorStop(1, "#9aa3ad");
  } else {
    g.addColorStop(0, "#5b8ec4");
    g.addColorStop(1, "#b9d3ea");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ── The crowd: placed once ──────────────────────────────────────────────────

export type StandId = "end" | "far" | "near" | "farEnd";

interface Stand {
  id: StandId;
  /** Corners of the seating rake: front-left, front-right, back-right, back-left. */
  front: [P3, P3];
  back: [P3, P3];
  /** The roof's leading edge (a dark band above the back row). */
  roof: number;
  seats: Float32Array; // s, r pairs in 0..1
  colourIdx: Uint8Array;
  away: boolean;
}

function makeStand(id: StandId, front: [P3, P3], back: [P3, P3], roof: number, seed: number, rows: number, cols: number, away: boolean): Stand {
  const rng = mulberry32(seed);
  const n = rows * cols;
  const seats = new Float32Array(n * 2);
  const colourIdx = new Uint8Array(n);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Empty seats: a few gaps so it reads as people, not wallpaper.
      if (rng() < 0.06) { colourIdx[k] = 255; }
      else colourIdx[k] = Math.floor(rng() * 250);
      seats[k * 2] = (c + 0.5 + (rng() - 0.5) * 0.5) / cols;
      seats[k * 2 + 1] = (r + 0.5 + (rng() - 0.5) * 0.3) / rows;
      k++;
    }
  }
  return { id, front, back, roof, seats, colourIdx, away };
}

const L = -6, R = PITCH_W + 6;          // the side stands' front edges
const END = -6.5;                        // the end stand's front edge (behind the goal)
const STANDS: Stand[] = [
  // Behind the goal: the home end, packed.
  makeStand("end", [[L - 4, END, 0.8], [R + 4, END, 0.8]], [[L - 14, END - 26, 17], [R + 14, END - 26, 17]], 3, 11, 30, 110, false),
  // The far touchline (x beyond PITCH_W): the main stand opposite the cameras.
  makeStand("far", [[R, -2, 0.8], [R, 108, 0.8]], [[R + 26, -12, 18], [R + 26, 118, 18]], 3, 23, 30, 150, false),
  // The near touchline (x < 0), behind the television gantry.
  makeStand("near", [[L, 108, 0.8], [L, -2, 0.8]], [[L - 26, 118, 18], [L - 26, -12, 18]], 3, 37, 30, 150, false),
  // The far end, a long way off.
  makeStand("farEnd", [[R + 4, 111, 0.8], [L - 4, 111, 0.8]], [[R + 14, 137, 17], [L - 14, 137, 17]], 3, 53, 22, 90, true),
];

function lerp3(a: P3, b: P3, k: number): P3 {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function standPoint(st: Stand, s: number, r: number): P3 {
  const f = lerp3(st.front[0], st.front[1], s);
  const b = lerp3(st.back[0], st.back[1], s);
  return lerp3(f, b, r);
}

const SKIN = ["#f1c9a5", "#d9a77c", "#a8754a", "#6b4426", "#e8b896"];

function drawStand(ctx: CanvasRenderingContext2D, cam: FpCamera, st: Stand, look: SceneLook): void {
  // The concrete rake, darker at the back.
  const fl = st.front[0], fr = st.front[1], br = st.back[1], bl = st.back[0];
  fillPolygon(ctx, cam, [fl, fr, br, bl], look.night ? "#141a24" : "#3a4250");
  // The roof: a dark slab over the back rows.
  const rb: P3 = [bl[0], bl[1], bl[2] + st.roof], rbr: P3 = [br[0], br[1], br[2] + st.roof];
  const lip = 0.35;
  const rfl = standPoint(st, 0, 1 - lip), rfr = standPoint(st, 1, 1 - lip);
  fillPolygon(ctx, cam, [[rfl[0], rfl[1], bl[2] + st.roof * 0.8], [rfr[0], rfr[1], br[2] + st.roof * 0.8], rbr, rb], look.night ? "#0b0f16" : "#252b35");

  // The people. Each is projected; one too small to see is a shirt-coloured
  // dot, a bigger one a shirt and a head.
  const home = look.homeColours, away = look.awayColours;
  const n = st.colourIdx.length;
  const { W, H } = cam;
  for (let i = 0; i < n; i++) {
    const ci = st.colourIdx[i];
    if (ci === 255) continue;
    const s = st.seats[i * 2], r = st.seats[i * 2 + 1];
    const f0 = st.front[0], f1 = st.front[1], b0 = st.back[0], b1 = st.back[1];
    const fx = f0[0] + (f1[0] - f0[0]) * s, fy = f0[1] + (f1[1] - f0[1]) * s, fz = f0[2] + (f1[2] - f0[2]) * s;
    const bx = b0[0] + (b1[0] - b0[0]) * s, by = b0[1] + (b1[1] - b0[1]) * s, bz = b0[2] + (b1[2] - b0[2]) * s;
    const sp = project(cam, fx + (bx - fx) * r, fy + (by - fy) * r, fz + (bz - fz) * r + 0.55);
    if (!sp || sp.px < -4 || sp.px > W + 4 || sp.py < -4 || sp.py > H + 4) continue;
    const size = 0.5 * sp.scale;
    if (size < 0.35) continue;
    const pool = st.away ? away : home;
    const shirt = ci < 170 ? pool[ci % pool.length] : ci < 205 ? "#f8fafc" : ci < 230 ? "#111827" : "#9ca3af";
    ctx.fillStyle = shirt;
    if (size < 2.2) {
      const w = Math.max(1, size);
      ctx.fillRect(sp.px - w / 2, sp.py - w / 2, w, w);
    } else {
      ctx.fillRect(sp.px - size * 0.45, sp.py - size * 0.2, size * 0.9, size * 0.9);
      ctx.fillStyle = SKIN[ci % SKIN.length];
      ctx.beginPath();
      ctx.arc(sp.px, sp.py - size * 0.42, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Advertising boards round the pitch: bright blocks with a light band. */
function drawBoards(ctx: CanvasRenderingContext2D, cam: FpCamera, look: SceneLook): void {
  const H = 0.9;
  const cols = ["#dc2626", "#1d4ed8", "#f59e0b", "#059669", "#7c3aed", "#0ea5e9", "#e11d48"];
  const runs: { a: P3; b: P3; n: number }[] = [
    { a: [-4, -4.5, 0], b: [PITCH_W + 4, -4.5, 0], n: 12 },
    { a: [-4, -4.5, 0], b: [-4, 70, 0], n: 12 },
    { a: [PITCH_W + 4, -4.5, 0], b: [PITCH_W + 4, 70, 0], n: 12 },
  ];
  let c = 0;
  for (const run of runs) {
    for (let i = 0; i < run.n; i++) {
      const p = lerp3(run.a, run.b, i / run.n), q = lerp3(run.a, run.b, (i + 1) / run.n);
      const col = cols[c++ % cols.length];
      fillPolygon(ctx, cam, [p, q, [q[0], q[1], H], [p[0], p[1], H]], col);
      // A light strip where the sponsor's name would be.
      fillPolygon(ctx, cam,
        [[p[0], p[1], H * 0.38], [q[0], q[1], H * 0.38], [q[0], q[1], H * 0.62], [p[0], p[1], H * 0.62]],
        look.night ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.45)");
    }
  }
}

/** Grass, mowing stripes and every line at its real distance. */
export function drawPitch(ctx: CanvasRenderingContext2D, cam: FpCamera, look: SceneLook): void {
  // The surround, then the pitch, then the stripes.
  fillPolygon(ctx, cam, [[-60, -60, 0], [PITCH_W + 60, -60, 0], [PITCH_W + 60, 170, 0], [-60, 170, 0]], SURROUND);
  fillPolygon(ctx, cam, [[0, -2.5, 0], [PITCH_W, -2.5, 0], [PITCH_W, 105, 0], [0, 105, 0]], GRASS_A);
  const band = 105 / 20;
  for (let i = 0; i < 20; i += 2) {
    const y0 = i * band, y1 = (i + 1) * band;
    fillPolygon(ctx, cam, [[0, y0, 0], [PITCH_W, y0, 0], [PITCH_W, y1, 0], [0, y1, 0]], GRASS_B);
  }
  // Worn turf in the goalmouth.
  fillPolygon(ctx, cam, [[POST_L - 1, 0, 0], [POST_R + 1, 0, 0], [POST_R + 0.4, 3.2, 0], [POST_L - 0.4, 3.2, 0]], "rgba(150,140,60,0.28)");

  ctx.strokeStyle = look.night ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.88)";
  ctx.lineCap = "round";
  const W12 = 0.12;
  // Touchlines, goal line, halfway line.
  line(ctx, cam, [0, 0, 0], [PITCH_W, 0, 0], W12);
  line(ctx, cam, [0, 0, 0], [0, 105, 0], W12);
  line(ctx, cam, [PITCH_W, 0, 0], [PITCH_W, 105, 0], W12);
  line(ctx, cam, [0, HALF_LEN, 0], [PITCH_W, HALF_LEN, 0], W12);
  // Penalty area and six-yard box.
  for (const [l, r, d] of [[BOX_L, BOX_R, BOX_DEPTH], [SIX_L, SIX_R, SIX_DEPTH]] as const) {
    line(ctx, cam, [l, 0, 0], [l, d, 0], W12);
    line(ctx, cam, [r, 0, 0], [r, d, 0], W12);
    line(ctx, cam, [l, d, 0], [r, d, 0], W12);
  }
  // The D, outside the box only; the centre circle; the corner arcs.
  const curve = (runs: P3[][]) => { for (const run of runs) for (let i = 1; i < run.length; i++) line(ctx, cam, run[i - 1], run[i], W12); };
  curve(arcPts(CX, PEN_SPOT_Y, ARC_R, 0, Math.PI, 28, (_x, y) => y >= BOX_DEPTH));
  curve(arcPts(CX, HALF_LEN, CENTRE_R, 0, Math.PI * 2, 40));
  curve(arcPts(0, 0, 1, 0, Math.PI / 2, 6));
  curve(arcPts(PITCH_W, 0, 1, Math.PI / 2, Math.PI, 6));
  // The spots.
  for (const [x, y] of [[CX, PEN_SPOT_Y], [CX, HALF_LEN]] as const) {
    const ptsSpot: P3[] = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ptsSpot.push([x + Math.cos(a) * 0.14, y + Math.sin(a) * 0.14, 0]); }
    fillPolygon(ctx, cam, ptsSpot, "rgba(255,255,255,0.9)");
  }
}

/** Everything round the pitch: stands, crowd, boards. Drawn after the grass
 *  (the stands sit on the ground beyond it) and before the men. `skip` names
 *  the stand the camera itself is in. */
export function drawStadium(ctx: CanvasRenderingContext2D, cam: FpCamera, look: SceneLook, skip: StandId[] = []): void {
  // Far stands first so near ones cover them.
  const order = STANDS
    .filter(st => !skip.includes(st.id))
    .map(st => {
      const c = standPoint(st, 0.5, 0.5);
      const q = toCam(cam, c[0], c[1], c[2]);
      return { st, d: q.d };
    })
    .sort((a, b) => b.d - a.d);
  for (const { st, d } of order) if (d > -40) drawStand(ctx, cam, st, look);
  drawBoards(ctx, cam, look);
}

/** Floodlight glare over a night sky. */
export function drawFloodlights(ctx: CanvasRenderingContext2D, cam: FpCamera, look: SceneLook): void {
  if (!look.night) return;
  const towers: P3[] = [[-16, -16, 34], [PITCH_W + 16, -16, 34], [-16, 120, 34], [PITCH_W + 16, 120, 34]];
  for (const t of towers) {
    const p = project(cam, t[0], t[1], t[2]);
    if (!p) continue;
    const r = Math.max(10, 5 * p.scale);
    const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r);
    g.addColorStop(0, "rgba(255,255,240,0.95)");
    g.addColorStop(0.2, "rgba(255,250,220,0.45)");
    g.addColorStop(1, "rgba(255,250,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.px - r, p.py - r, r * 2, r * 2);
  }
}

// ── The goal ────────────────────────────────────────────────────────────────

/** How deep the net's floor and roof run behind the line (m). The ball stops
 *  at NET_DEPTH (1.2 m) in the match, inside this. */
export const NET_FLOOR_D = 1.6;
export const NET_ROOF_D = 0.95;

/** Where the back of the net is at height z (the back panel slopes). */
function backY(z: number, bulge = 0): number {
  return -(NET_FLOOR_D - (NET_FLOOR_D - NET_ROOF_D) * Math.min(1, z / GOAL_H)) - bulge;
}

/** A soft dent in the back of the net where the ball has hit it. */
export interface NetBulge { x: number; z: number; depth: number }

function netGrid(ctx: CanvasRenderingContext2D, cam: FpCamera, corner: (s: number, r: number) => P3, ns: number, nr: number, alpha: number): void {
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i <= ns; i++) {
    for (let j = 0; j < nr; j++) {
      const seg = clipSegment(cam, corner(i / ns, j / nr), corner(i / ns, (j + 1) / nr));
      if (!seg) continue;
      ctx.lineWidth = Math.max(0.5, 0.025 * seg[0].scale);
      ctx.beginPath(); ctx.moveTo(seg[0].px, seg[0].py); ctx.lineTo(seg[1].px, seg[1].py); ctx.stroke();
    }
  }
  for (let j = 0; j <= nr; j++) {
    for (let i = 0; i < ns; i++) {
      const seg = clipSegment(cam, corner(i / ns, j / nr), corner((i + 1) / ns, j / nr));
      if (!seg) continue;
      ctx.lineWidth = Math.max(0.5, 0.025 * seg[0].scale);
      ctx.beginPath(); ctx.moveTo(seg[0].px, seg[0].py); ctx.lineTo(seg[1].px, seg[1].py); ctx.stroke();
    }
  }
}

/** The parts of the goal, each drawn on its own so the replay can put the
 *  ball and the men between them in depth order. */
export type GoalPart = "back" | "left" | "right" | "roof" | "frame";

/** A point to sort each part by, in the world. */
export function goalPartAnchor(part: GoalPart): P3 {
  switch (part) {
    case "back": return [CX, -1.3, 1.1];
    case "left": return [POST_L, -0.7, 1.1];
    case "right": return [POST_R, -0.7, 1.1];
    case "roof": return [CX, -0.5, GOAL_H];
    case "frame": return [CX, 0, 1.2];
  }
}

export function drawGoalPart(ctx: CanvasRenderingContext2D, cam: FpCamera, part: GoalPart, bulge: NetBulge | null): void {
  const dent = (x: number, z: number) => {
    if (!bulge) return 0;
    const dd = (x - bulge.x) ** 2 + (z - bulge.z) ** 2;
    return bulge.depth * Math.exp(-dd / 0.55);
  };
  const back = (s: number, r: number): P3 => {
    const x = POST_L + (POST_R - POST_L) * s, z = GOAL_H * (1 - r);
    return [x, backY(z, dent(x, z)), z];
  };
  if (part === "back") {
    fillPolygon(ctx, cam, [back(0, 1), back(1, 1), back(1, 0), back(0, 0)], "rgba(255,255,255,0.07)");
    netGrid(ctx, cam, back, 22, 8, 0.42);
    return;
  }
  if (part === "left" || part === "right") {
    const x = part === "left" ? POST_L : POST_R;
    const side = (s: number, r: number): P3 => {
      const z = GOAL_H * (1 - r);
      return [x, backY(z) * s, z];
    };
    fillPolygon(ctx, cam, [side(0, 0), side(1, 0), side(1, 1), side(0, 1)], "rgba(255,255,255,0.05)");
    netGrid(ctx, cam, side, 5, 8, 0.36);
    return;
  }
  if (part === "roof") {
    const roof = (s: number, r: number): P3 => {
      const x = POST_L + (POST_R - POST_L) * s;
      return [x, backY(GOAL_H) * r, GOAL_H];
    };
    netGrid(ctx, cam, roof, 22, 3, 0.36);
    return;
  }
  // Posts and bar: thick white, rounded.
  ctx.strokeStyle = "#f8fafc";
  ctx.lineCap = "round";
  const post = 0.12;
  line(ctx, cam, [POST_L, 0, 0], [POST_L, 0, GOAL_H], post);
  line(ctx, cam, [POST_R, 0, 0], [POST_R, 0, GOAL_H], post);
  line(ctx, cam, [POST_L, 0, GOAL_H], [POST_R, 0, GOAL_H], post);
  // The stanchions running back to the net.
  ctx.strokeStyle = "rgba(230,232,236,0.8)";
  line(ctx, cam, [POST_L, 0, GOAL_H], [POST_L, backY(GOAL_H), GOAL_H], 0.05);
  line(ctx, cam, [POST_R, 0, GOAL_H], [POST_R, backY(GOAL_H), GOAL_H], 0.05);
}

/** The two corner flags at this end. */
export function drawCornerFlags(ctx: CanvasRenderingContext2D, cam: FpCamera): void {
  for (const x of [0, PITCH_W]) {
    ctx.strokeStyle = "#e5e7eb";
    line(ctx, cam, [x, 0, 0], [x, 0, 1.5], 0.04);
    fillPolygon(ctx, cam, [[x, 0, 1.5], [x, 0, 1.15], [x + (x === 0 ? 0.45 : -0.45), 0.25, 1.3]], "#facc15");
  }
}
