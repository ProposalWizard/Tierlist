import { project, horizonPx, type FpCamera } from "./firstPersonView";
import { OWN_GAIT_M, type FpDefender, type DefenderPhase } from "./firstPersonDribble";
import { drawPlayerHead } from "./drawPlayerHead";
import { DEFAULT_FACE_STYLE, type FaceStyle } from "./faceStyle";
import type { FakeFaceStyle } from "./fakeFaceStyle";
import { figureSkin } from "./figureSkin";
import { fittedHeadFor, drawSoftShadow, mipFor, drawStyledHead } from "./figure3d";
import { limb as litLimb, tint, rgba } from "./heroFigure";

/**
 * The "3d" skin (lib/star/figureSkin.ts), read once per frame by the two
 * render entry points below. Every figure helper in this file checks it: a
 * limb is lit across its width, the shirt and shorts get a light and a dark
 * side, folds and a rim light, the shadow is soft, boots shine, and a
 * defender with a readable photo gets the face-fit head. A look only — no
 * position, size or timing changes.
 */
let SKIN3D = false;

/**
 * DRAWING THE FIRST-PERSON MODES.
 *
 * Copies TECHNIQUE from `scenarioRender.ts`, not code — the same precedent
 * that file itself sets rather than importing from `CanvasMatch.tsx`
 * directly: this is a standalone renderer for a standalone dev sandbox, so
 * nothing here can put the real match's own delicate, tuned drawing code at
 * risk. What's actually copied: the palette (sampled off the same real
 * match reference), the `grassTile()` grain, and the hand-drawn figure
 * grammar — rebuilt here in elevation (front-on, through
 * `firstPersonView.ts`'s real camera) rather than the flat overhead `toPx`
 * the other two renderers use.
 *
 * Every coordinate here goes through `project()` — nothing is hand-placed
 * in screen space except the sky/HUD chrome and your own forearms, which
 * have no world position to speak of.
 *
 * The single most important thing drawn in this whole file is the mowing
 * stripes on the grass, keyed to distance run (`stride`), not to depth.
 * Everything else is scenery; that is the one detail that actually sells
 * "you are moving forward" in a first-person view — without it, running
 * at 6 m/s looks identical to standing still.
 *
 * ── No goal, deliberately ──
 *
 * Neither mode here runs toward a goal or ends in a shot — told directly:
 * "you're not even running towards a goal... it should just be to more
 * space." Both modes are purely about getting clear of the men you're
 * given, mirroring `dribble.ts`'s own original reasoning ("the goal is
 * nowhere in sight: getting through is what earns you the chance, it is
 * not the chance itself") — except here there is no chance built afterward
 * either. There is nothing goal-shaped drawn anywhere in this file.
 *
 * ── Two render functions, one shared toolbox ──
 *
 * `renderFirstPerson` draws the one-on-one DUEL mode (`firstPersonDribble.ts`
 * — three sequential defenders, each with a telegraph). `renderFirstPersonRoam`
 * draws the OPEN-RUN mode — a first-person camera over `dribble.ts`'s own,
 * completely unmodified mechanics (a swipe sets a heading in any direction;
 * several chasers wake independently within range and give chase; no
 * telegraph, no per-duel sequencing). They share the sky/ground/markings/
 * ball/body helpers below; only the "man in front of you" figure differs,
 * because a duel defender telegraphs and a roam chaser just runs.
 */

// Palette — same identity CanvasMatch.tsx/scenarioRender.ts already use.
const C = {
  pitch: "#1f9006",
  pitchDark: "#1b7f05",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.45)",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  oppAsleep: "#7a8a8f",
  oppAsleepRim: "#3f4a4e",
  you: "#10b981",
  youRim: "#065f46",
  skin: "#c68642",
  sky: "#0b1220",
  skyLow: "#16233a",
  stand: "#1a2a1e",
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * clamp(f, 0, 1);
}
function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

// ── Cached procedural tiles — built once, reused every frame ──────────────

const GRASS_TILE = 96;
let cachedGrass: HTMLCanvasElement | null = null;
function grassTile(): HTMLCanvasElement | null {
  if (cachedGrass) return cachedGrass;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);
  }
  g.putImageData(img, 0, 0);
  cachedGrass = c;
  return c;
}

let cachedCrowd: HTMLCanvasElement | null = null;
function crowdTile(): HTMLCanvasElement | null {
  if (cachedCrowd) return cachedCrowd;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 24;
  const g = c.getContext("2d");
  if (!g) return null;
  let seed = 0x9e3779b9;
  for (let y = 0; y < 24; y += 3) {
    for (let x = 0; x < 64; x += 3) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed >>> 16) & 0xff;
      g.fillStyle = `rgba(${180 + (n % 60)},${180 + (n % 50)},${190 + (n % 40)},${0.10 + (n % 30) / 200})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  cachedCrowd = c;
  return c;
}

type Pt = { px: number; py: number };
function quad(ctx: CanvasRenderingContext2D, q: Pt[], fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.moveTo(q[0].px, q[0].py);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
}

/** A tapered limb segment (thigh, shin, upper/lower arm) as a filled quad in
 *  screen space, not a stroked line — the direct fix for "a stick man":
 *  each end is projected separately and widened by ITS OWN scale, so the
 *  limb still tapers correctly with perspective rather than being a
 *  constant screen-space width. */
function limb(
  ctx: CanvasRenderingContext2D, cam: FpCamera,
  a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number },
  widthA: number, widthB: number, fill: string,
) {
  const pa = project(cam, a.x, a.y, a.z), pb = project(cam, b.x, b.y, b.z);
  if (!pa || !pb) return;
  const dx = pb.px - pa.px, dy = pb.py - pa.py;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const wa = widthA * pa.scale, wb = widthB * pb.scale;
  if (SKIN3D) {
    // Lit across its width (heroFigure's own limb, full widths not halves).
    litLimb(ctx, [pa.px, pa.py], [pb.px, pb.py], wa * 2, wb * 2, fill);
    return;
  }
  quad(ctx, [
    { px: pa.px + nx * wa, py: pa.py + ny * wa },
    { px: pb.px + nx * wb, py: pb.py + ny * wb },
    { px: pb.px - nx * wb, py: pb.py - ny * wb },
    { px: pa.px - nx * wa, py: pa.py - ny * wa },
  ], fill);
}

// ── The stadium, the pitch and its markings ─────────────────────────────────
//
// Harry, 2 Oct 2026: "we gotta get this dribbling screen looking better".
// The old picture was a flat dark band for a stand and one flat green for the
// pitch. Now: a sunset sky, a real painted stand (the home screen's own
// sunset stadium, `public/home/scene-sunset.webp`, cut to the roof, crowd and
// hoardings) standing behind the far goal line IN THE WORLD, so it grows as
// you run at it; two floodlight towers; a pitch mown in real stripes fixed to
// the turf; real white lines (touchlines, halfway line, centre circle);
// evening light and a vignette. Still nothing goal-shaped (see the header).
// A look only: nothing here is read by the run.

/** Pitch y of the far stand's front (behind the goal line, metres). */
const STAND_Y = -8;
/** Metres from the turf to the roof edge of that stand. */
const STAND_H = 15;
/** Metres of stand one copy of the painted strip covers. */
const STAND_TILE_W = 26.8;
/** Mowing stripe width, metres, fixed to the pitch. */
const STRIPE_M = 5.25;
/** Nothing nearer than this (camera-depth metres) is drawn on the turf. */
const GROUND_NEAR = 0.45;

/** The part of scene-sunset.webp used for the stand (fractions of the image). */
const STRIP_SRC = { x0: 100 / 900, x1: 800 / 900, y0: 400 / 1609, y1: 794 / 1609 };

interface StandStrip { a: HTMLCanvasElement; b: HTMLCanvasElement }
const strips = new WeakMap<HTMLImageElement, StandStrip | null>();

/** The stand cut out of the painted backdrop, once per image: its top fades
 *  into the sky, and a mirrored copy so tiles join without a hard seam. */
function standStrip(img: HTMLImageElement | null | undefined): StandStrip | null {
  if (!img || !img.complete || img.naturalWidth === 0 || typeof document === "undefined") return null;
  const hit = strips.get(img);
  if (hit !== undefined) return hit;
  const sx = img.naturalWidth * STRIP_SRC.x0, sw = img.naturalWidth * (STRIP_SRC.x1 - STRIP_SRC.x0);
  const sy = img.naturalHeight * STRIP_SRC.y0, sh = img.naturalHeight * (STRIP_SRC.y1 - STRIP_SRC.y0);
  const w = Math.round(sw), h = Math.round(sh);
  const make = (flip: boolean): HTMLCanvasElement | null => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (!g) return null;
    if (flip) { g.translate(w, 0); g.scale(-1, 1); }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-out";
    const fade = g.createLinearGradient(0, 0, 0, h * 0.16);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h * 0.16);
    return c;
  };
  const a = make(false), b = make(true);
  const out = a && b ? { a, b } : null;
  strips.set(img, out);
  return out;
}

/** Depth along the camera's view of a point on the turf (matches project()). */
function groundDepth(cam: FpCamera, x: number, y: number): number {
  const fwd = cam.forward ?? { x: 0, y: -1 };
  const d0 = (x - cam.x) * fwd.x + (y - cam.y) * fwd.y;
  const p = cam.pitch ?? 0;
  return d0 * Math.cos(p) + cam.eye * Math.sin(p);
}

/** A polygon on the turf (world x/y), clipped at the near plane, projected
 *  and filled. The clip matters: under the leaning camera a wide band's far
 *  corner can sit behind the lens, and a band that just skipped itself left a
 *  hole in the grass. */
function groundPoly(ctx: CanvasRenderingContext2D, cam: FpCamera, pts: { x: number; y: number }[], fill: string | CanvasGradient) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = groundDepth(cam, a.x, a.y) - GROUND_NEAR, db = groundDepth(cam, b.x, b.y) - GROUND_NEAR;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  if (out.length < 3) return;
  const proj: Pt[] = [];
  for (const p of out) {
    const q = project(cam, p.x, p.y, 0);
    if (!q) return;
    proj.push(q);
  }
  quad(ctx, proj, fill);
}

/** A painted line on the turf, `w` metres wide, from a to b. */
function groundLine(ctx: CanvasRenderingContext2D, cam: FpCamera, ax: number, ay: number, bx: number, by: number, w: number, fill: string) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * w / 2, ny = ((bx - ax) / len) * w / 2;
  groundPoly(ctx, cam, [
    { x: ax + nx, y: ay + ny }, { x: bx + nx, y: by + ny },
    { x: bx - nx, y: by - ny }, { x: ax - nx, y: ay - ny },
  ], fill);
}

/** Screen x of the camera's own vanishing point (straight down its view). */
function vanishX(cam: FpCamera): number {
  const fwd = cam.forward ?? { x: 0, y: -1 };
  const p = project(cam, cam.x + fwd.x * 400, cam.y + fwd.y * 400, cam.eye);
  return p ? p.px : cam.W / 2;
}

/** Sunset sky, the far stand (painted, or drawn when the picture is not in
 *  yet), and two floodlight towers above it. */
function drawStadium(ctx: CanvasRenderingContext2D, cam: FpCamera, W: number, H: number, backdrop?: HTMLImageElement | null) {
  const horizon = horizonPx(cam);
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
  sky.addColorStop(0, "#2a1d55");
  sky.addColorStop(0.38, "#6d3a77");
  sky.addColorStop(0.72, "#d8684f");
  sky.addColorStop(1, "#f8ad4c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.max(horizon, 1) + 2);
  // The low sun, straight down the pitch.
  const vx = vanishX(cam);
  const sun = ctx.createRadialGradient(vx, horizon, 0, vx, horizon, W * 0.75);
  sun.addColorStop(0, "rgba(255,226,150,0.75)");
  sun.addColorStop(0.35, "rgba(255,170,90,0.25)");
  sun.addColorStop(1, "rgba(255,150,80,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, horizon + 2);

  // Floodlight towers, behind the stand's two ends.
  for (const tx of [12, 56]) {
    const base = project(cam, tx, STAND_Y - 6, 0), top = project(cam, tx, STAND_Y - 6, 19);
    if (!base || !top) continue;
    const s = top.scale;
    ctx.strokeStyle = "rgba(30,22,40,0.9)";
    ctx.lineWidth = Math.max(1, 0.7 * s);
    ctx.beginPath(); ctx.moveTo(base.px, base.py); ctx.lineTo(top.px, top.py); ctx.stroke();
    const bw = 7 * s, bh = 3.2 * s;
    ctx.fillStyle = "#2a2236";
    ctx.fillRect(top.px - bw / 2, top.py - bh, bw, bh);
    ctx.fillStyle = "#fff4c4";
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      ctx.fillRect(top.px - bw / 2 + bw * (0.04 + c * 0.24), top.py - bh + bh * (0.08 + r * 0.46), bw * 0.2, bh * 0.38);
    }
    // The lamps' glare, over the lamp bank so it reads as light, not a box.
    const gx = top.px, gy = top.py - bh / 2, gr = bw * 2.6;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, "rgba(255,252,235,0.95)");
    glow.addColorStop(0.2, "rgba(255,244,205,0.6)");
    glow.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  const strip = standStrip(backdrop);
  if (strip) {
    // The painted stand, in slices so it stays square to the camera's lean.
    const SLICES = 12;
    const sliceW = STAND_TILE_W / SLICES, srcW = strip.a.width / SLICES;
    for (let k = -4; k <= 7; k++) {
      const x0 = -40 + k * STAND_TILE_W;
      const src = (k & 1) ? strip.b : strip.a;
      for (let j = 0; j < SLICES; j++) {
        const xa = x0 + j * sliceW, xb = xa + sliceW;
        const pa = project(cam, xa, STAND_Y, 0), pb = project(cam, xb, STAND_Y, 0);
        const ta = project(cam, xa, STAND_Y, STAND_H);
        if (!pa || !pb || !ta) continue;
        const dw = pb.px - pa.px;
        if (dw <= 0 || pb.px < -2 || pa.px > W + 2) continue;
        // +0.6 px each way so neighbouring slices never show a hairline gap.
        ctx.drawImage(src, j * srcW, 0, srcW, src.height, pa.px - 0.6, ta.py, dw + 1.2, pa.py - ta.py);
      }
    }
    // Advertising boards along the foot of the stand, lit by the evening.
    const BOARD = 6, colours = ["#1d3b8f", "#eef2f8", "#c81e3a", "#eef2f8", "#0f7a5a", "#f2b632"];
    for (let k = -14; k <= 26; k++) {
      const xa = k * BOARD, xb = xa + BOARD - 0.15;
      const a0 = project(cam, xa, STAND_Y + 1.2, 0), b0 = project(cam, xb, STAND_Y + 1.2, 0);
      const a1 = project(cam, xa, STAND_Y + 1.2, 0.95), b1 = project(cam, xb, STAND_Y + 1.2, 0.95);
      if (!a0 || !b0 || !a1 || !b1 || b0.px < 0 || a0.px > W) continue;
      const col = colours[((k % colours.length) + colours.length) % colours.length];
      quad(ctx, [a1, b1, b0, a0], col);
      quad(ctx, [a1, b1, { px: b1.px, py: b1.py + (b0.py - b1.py) * 0.18 }, { px: a1.px, py: a1.py + (a0.py - a1.py) * 0.18 }], "rgba(255,255,255,0.35)");
    }
  } else {
    // No picture yet (or the open-run mode, which turns): a drawn stand.
    const yb = horizon + 3;
    const yt = horizon - H * 0.14;
    const g = ctx.createLinearGradient(0, yt, 0, yb);
    g.addColorStop(0, "#241a2e");
    g.addColorStop(1, "#3a2c38");
    ctx.fillStyle = g;
    ctx.fillRect(0, yt, W, yb - yt);
    const crowd = crowdTile();
    if (crowd) {
      const pat = ctx.createPattern(crowd, "repeat");
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, yt + (yb - yt) * 0.12, W, (yb - yt) * 0.76); }
    }
    ctx.fillStyle = "#1b1424";
    ctx.fillRect(0, yt - 3, W, 5);
    ctx.fillStyle = "rgba(255,236,190,0.9)";
    for (let x = W * 0.04; x < W; x += W * 0.09) ctx.fillRect(x, yt - 2, Math.max(2, W * 0.012), 2);
    const hb = Math.max(3, (yb - yt) * 0.12);
    for (let i = 0, x = 0; x < W; i++, x += W / 6) {
      ctx.fillStyle = i % 2 ? "#e8edf5" : "#1f3a8a";
      ctx.fillRect(x, yb - hb, W / 6, hb);
    }
  }
}

/** The pitch: lit turf, stripes fixed to the pitch, grain, the lines. */
function drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, cam: FpCamera, minX: number, maxX: number, pitchLines = true) {
  const horizon = horizonPx(cam);
  const base = ctx.createLinearGradient(0, horizon, 0, H);
  base.addColorStop(0, "#8fae4a");
  base.addColorStop(0.12, "#58a02c");
  base.addColorStop(0.55, "#3a8d1f");
  base.addColorStop(1, "#2b7517");
  ctx.fillStyle = base;
  ctx.fillRect(0, horizon, W, H - horizon);

  // Mown stripes, fixed to the turf: they slide past at exactly your speed,
  // which is what sells the run (see the file header).
  const xl = cam.x - 90, xr = cam.x + 90;
  const nearY = cam.y + 2;
  const first = Math.floor(STAND_Y / STRIPE_M), last = Math.ceil(nearY / STRIPE_M);
  for (let k = first; k <= last; k++) {
    const y1 = k * STRIPE_M, y2 = y1 + STRIPE_M;
    groundPoly(ctx, cam, [{ x: xl, y: y1 }, { x: xr, y: y1 }, { x: xr, y: y2 }, { x: xl, y: y2 }],
      k % 2 === 0 ? "rgba(255,255,215,0.075)" : "rgba(0,30,0,0.10)");
  }

  const grass = grassTile();
  if (grass) {
    const pat = ctx.createPattern(grass, "repeat");
    if (pat) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = pat;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.restore();
    }
  }

  // Evening light coming down the pitch at you.
  const vx = vanishX(cam);
  const glare = ctx.createRadialGradient(vx, horizon, 0, vx, horizon, W * 0.9);
  glare.addColorStop(0, "rgba(255,214,140,0.42)");
  glare.addColorStop(0.45, "rgba(255,190,110,0.12)");
  glare.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(0, horizon, W, H - horizon);

  // The lines — a real pitch's, minus anything at the far end (no goal).
  // The duel runs on real pitch metres (CX = 34, the run starts 48 m out);
  // the open-run mode turns and has its own frame, so it keeps only its guides.
  const LINE = "rgba(250,250,240,0.86)", LW = 0.12;
  if (pitchLines) {
  groundLine(ctx, cam, 0, 60, 0, STAND_Y + 6, LW, LINE);
  groundLine(ctx, cam, 68, 60, 68, STAND_Y + 6, LW, LINE);
  groundLine(ctx, cam, 0, 52.5, 68, 52.5, LW, LINE);
  const N = 56;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    groundLine(ctx, cam, 34 + Math.cos(a0) * 9.15, 52.5 + Math.sin(a0) * 9.15, 34 + Math.cos(a1) * 9.15, 52.5 + Math.sin(a1) * 9.15, LW, LINE);
  }
  const spot: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) spot.push({ x: 34 + Math.cos((i / 12) * Math.PI * 2) * 0.2, y: 52.5 + Math.sin((i / 12) * Math.PI * 2) * 0.2 });
  groundPoly(ctx, cam, spot, LINE);
  }
  // The run's own lane edges: a faint guide, not a pitch line.
  const guideFar = pitchLines ? STAND_Y + 6 : cam.y - 60;
  groundLine(ctx, cam, minX, nearY, minX, guideFar, 0.06, "rgba(255,255,250,0.16)");
  groundLine(ctx, cam, maxX, nearY, maxX, guideFar, 0.06, "rgba(255,255,250,0.16)");

  // Haze where the turf meets the stand.
  const sb = pitchLines ? project(cam, cam.x, STAND_Y, 0) : null;
  if (sb) {
    const hz = ctx.createLinearGradient(0, sb.py - H * 0.03, 0, sb.py + H * 0.06);
    hz.addColorStop(0, "rgba(255,196,140,0)");
    hz.addColorStop(0.4, "rgba(255,196,140,0.28)");
    hz.addColorStop(1, "rgba(255,196,140,0)");
    ctx.fillStyle = hz;
    ctx.fillRect(0, sb.py - H * 0.03, W, H * 0.09);
  }
}

/** A soft darkening at the corners, drawn over everything but the HUD. */
function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const v = ctx.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.42, W / 2, H * 0.52, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, "rgba(10,6,20,0)");
  v.addColorStop(1, "rgba(10,6,20,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}


// ── Defenders, front-on ─────────────────────────────────────────────────────

/** How far his shoulder/torso shears toward the side he's about to go. */
function shearFor(def: FpDefender): number {
  if (def.phase === "telegraph") {
    return def.commitSide * 0.20 * (1 - clamp(def.tell / def.tellT, 0, 1));
  }
  if (def.phase === "committed") {
    return def.commitSide * (0.20 + 0.30 * easeOutCubic(def.lunge));
  }
  return 0;
}

/**
 * HOW BIG A FOOTBALLER IS IN HERE, AND WHY THESE NUMBERS.
 *
 * The same anatomy the trial's shared renderer (`lib/star/fiveASide/render.ts`)
 * was rebuilt onto after the product owner said its figures read as bowling
 * pins — ported as PROPORTIONS, not as code. That file draws from above and
 * slightly behind through a flat `toPx`; this one draws in elevation through a
 * real divide-by-depth camera (`firstPersonView.ts`), so there is no shared
 * `drawFigure` to call. What is shared is the shape: every number below is
 * `fiveASide/render.ts`'s own value for that landmark, expressed as a fraction
 * of its `FIGURE_HEIGHT_R` and multiplied by `FIGURE_HEIGHT` here. Change one
 * there and this should follow; `tests/star/firstPersonFigure.mts` pins the
 * two together so a drift fails rather than quietly diverging.
 *
 * Coordinates are WORLD METRES ABOVE THE TURF (+z up), not local canvas units,
 * so the whole man is life-size and the camera decides how big he lands.
 *
 * ── The head, and the trap in drawPlayerHead ──
 *
 * `drawPlayerHead` multiplies the radius it is handed by the Face Editor's own
 * `scale` — 2.2 by default — and its doc says so: pass an UNSCALED base radius.
 * `HEAD_BASE_R` is that base. `HEAD_DRAWN_R` is what actually lands.
 *
 * The bug this replaced was NOT that the base was wrong. 0.11 m is very nearly
 * exactly right for a 1.80 m man at this proportion, and that is what was being
 * passed. It was that the NO-PHOTO branch drew its own circle at that same
 * number as a FINAL radius — so a defender with a real photo had a head 2.2×
 * the size of the identical defender standing next to him without one — and
 * that nothing pre-compensated for `offsetY`, so the photo head floated a clear
 * 0.16 m above the shoulders with the neck stub showing underneath. Both are
 * visible side by side in the same frame and both are fixed here: one geometry
 * (`headGeometry`) now decides the size and the centre, and both branches draw
 * to it.
 *
 * `HEAD_ANCHOR_Z` is the one number that is not anatomy: it is `HEAD_CENTRE_Z`
 * pushed DOWN by the default `offsetY` so that a default-styled head lands on
 * the shoulders. Somebody who has moved that slider moves his head off them on
 * purpose — same deliberate behaviour `fiveASide/render.ts` documents.
 */
/** Feet to crown, metres, at the default face scale. */
export const FIGURE_HEIGHT = 1.80;
/** The whole figure's own `r`, the way fiveASide/render.ts means it —
 *  `FIGURE_HEIGHT / FIGURE_HEIGHT_R`. Only `drawPlayerHead`'s outline
 *  thickness is a fraction of this rather than of the head. */
const FIGURE_R = FIGURE_HEIGHT / 1.863;

const SOLE_Z = 0.0;
const ANKLE_Z = 0.10;
const KNEE_Z = 0.30;
/** 0.3221 of the height — where the legs meet the shorts. */
const HIP_Z = 0.3221 * FIGURE_HEIGHT;
/** 0.3435 — the torso's own bottom edge, a shade above the leg join. */
const WAIST_Z = 0.3435 * FIGURE_HEIGHT;
/** 0.3757 — the waistband. */
const SHORTS_TOP_Z = 0.3757 * FIGURE_HEIGHT;
/** 0.2147 — the hem. */
const SHORTS_BOT_Z = 0.2147 * FIGURE_HEIGHT;
const SHOULDER_Z = 0.6763 * FIGURE_HEIGHT;
const NECK_Z = 0.7300 * FIGURE_HEIGHT;
const HEAD_CENTRE_Z = 0.8638 * FIGURE_HEIGHT;
/** 0.0612 of the height — UNSCALED; see the note above. */
const HEAD_BASE_R = 0.0612 * FIGURE_HEIGHT;
/** Where `drawPlayerHead` is actually handed, pre-compensated for the default
 *  `offsetY` (−1.45 head-radii) so the head lands at `HEAD_CENTRE_Z`. */
const HEAD_ANCHOR_Z = HEAD_CENTRE_Z + DEFAULT_FACE_STYLE.offsetY * HEAD_BASE_R;

/**
 * Where the head actually ends up, for a given style — the ONE answer both
 * the photo branch and the no-photo branch draw to.
 *
 * `drawPlayerHead` works in screen pixels, but every offset it applies is a
 * multiple of the base radius it was handed, and a world metre at the
 * figure's own depth is exactly one `scale` of pixels — so a screen offset of
 * `offsetY · headBaseR` pixels is the same thing as `offsetY · HEAD_BASE_R`
 * metres of height, and the two can be reasoned about in world units without
 * approximating anything. Screen `y` grows downward, so a negative `offsetY`
 * raises the head, which is why `anchorZ` sits BELOW `centreZ`.
 */
function headGeometry(style?: FaceStyle): { anchorZ: number; centreZ: number; drawnR: number } {
  const s = style ?? DEFAULT_FACE_STYLE;
  // The anchor is a fixed part of the anatomy: a player who has moved the
  // Face Editor's slider moves his head off his shoulders on purpose.
  const anchorZ = HEAD_ANCHOR_Z;
  return {
    anchorZ,
    centreZ: anchorZ - s.offsetY * HEAD_BASE_R,
    drawnR: HEAD_BASE_R * s.scale,
  };
}

/** Half-widths, metres — fiveASide's 0.42r / 0.29r / 0.31r shoulder, waist
 *  and shorts, which is the taper that makes a shape read as a person seen
 *  from behind rather than as a slab. */
const SHOULDER_HALF = 0.2254 * FIGURE_HEIGHT;
const WAIST_HALF = 0.1557 * FIGURE_HEIGHT;
const SHORTS_HALF = 0.1664 * FIGURE_HEIGHT;
const HEM_HALF = 0.1520 * FIGURE_HEIGHT;

/**
 * The anatomy above, in one object, so a test can measure it rather than
 * trusting this file's comments. `tests/star/firstPersonFigure.mts` checks it
 * against `fiveASide/render.ts`'s own exported proportions — the two figures
 * are meant to be the same man drawn by two cameras, and a drift should fail
 * rather than quietly happen.
 */
export const FP_ANATOMY = {
  height: FIGURE_HEIGHT,
  figureR: FIGURE_R,
  hipZ: HIP_Z,
  shoulderZ: SHOULDER_Z,
  neckZ: NECK_Z,
  headCentreZ: HEAD_CENTRE_Z,
  headAnchorZ: HEAD_ANCHOR_Z,
  headBaseR: HEAD_BASE_R,
  shoulderHalf: SHOULDER_HALF,
  waistHalf: WAIST_HALF,
} as const;


/** How far down the knee→ankle line the sock starts. A footballer's sock
 *  tops sit just below the knee, not on it. */
const SOCK_TOP_F = 0.34;

/** Metres a foot swings forward/back from under the hip, and how high it
 *  lifts while swinging through — the whole stylised running gait is these
 *  two numbers fed through one sine each. Trimmed with the hip: the old 0.16
 *  lift was set against a hip 0.34 m higher than this one, and kept there it
 *  swung the foot up past its own knee. */
const STRIDE_REACH = 0.24;
const LIFT_H = 0.12;

/** One limb's forward/back + lift offset at a given phase (radians). Used
 *  for both legs and arms — an arm just passes `lift = 0`, since only a
 *  planted foot needs to visibly clear the turf. */
function gait(phase: number, reach: number, lift: number): { fwd: number; up: number } {
  const off = Math.sin(phase);
  return { fwd: -off * reach, up: Math.max(0, off) * lift };
}

interface LegOpts {
  legSpread?: number; runPhase?: number;
  /** Which side the near leg reaches toward, as if poking the ball — the
   *  foot's stride still cycles normally (see the header below on why),
   *  only its lateral position pulls toward this side. 0 (or omitted)
   *  runs the ordinary gait with no bias. */
  reachSide?: -1 | 1 | 0;
  /** 0-1, how far into that reach — driven by how hard the ball is
   *  currently being touched (e.g. FirstPersonDribble.tsx's `ownLean`,
   *  normalised). Ignored when `reachSide` is 0. */
  reachAmount?: number;
}

interface LegPoints {
  hip: { x: number; y: number; z: number };
  knee: { x: number; y: number; z: number };
  ankle: { x: number; y: number; z: number };
  soleMid: { x: number; y: number; z: number };
  toe: { x: number; y: number; z: number };
  heel: { x: number; y: number; z: number };
}

/**
 * Where both legs actually are this frame — split out from drawing itself
 * so the ball can be sandwiched between the shins and everything else (see
 * `renderFirstPerson`'s own comment on why).
 */
function computeLegs(
  pos: { x: number; y: number }, shear: number, opts: LegOpts,
): { bounce: number; legs: LegPoints[] } {
  const phase = opts.runPhase ?? 0;
  const P = (dx: number, dy: number, z: number) => ({ x: pos.x + dx + shear, y: pos.y + dy, z });
  const baseSpread = opts.legSpread ?? 0.15;
  const hipZ = HIP_Z;
  // A small double-bounce per stride (two footfalls per full gait cycle) —
  // cheap, but it's the difference between "gliding" and "running".
  const bounce = Math.max(0, Math.sin(phase * 2)) * 0.03;
  const reachSide = opts.reachSide ?? 0;
  const reachAmt = reachSide ? clamp(opts.reachAmount ?? 0, 0, 1) : 0;

  const legs: LegPoints[] = [];
  for (const side of [-1, 1] as const) {
    const g = gait(phase + (side === 1 ? Math.PI : 0), STRIDE_REACH, LIFT_H);
    // The touching leg's stride keeps running its ORDINARY cycle (fwd/up
    // unchanged) — only its lateral position pulls toward the ball. An
    // earlier version replaced fwd/up outright with a fixed "poke" target
    // while reaching, which froze that foot in place for as long as the
    // touch lasted while the other leg kept running alone — reported
    // directly as "that leg doesn't really move... only the standing leg
    // moves." Both legs always keep moving; the touch only steers where
    // the near one's swing lands.
    const reaching = side === reachSide;
    const fwd = g.fwd, up = g.up;
    // Reported directly, with `ownLean` held near its max for as long as
    // you keep steering one way (not just a brief touch impulse): "flicking
    // upwardly... like a donkey kick, over and over again." The knee below
    // used to stay at the ordinary stance width while ONLY the ankle got
    // pulled out by this — for however many strides the steer lasted, the
    // shin was kinked hard sideways off a knee that hadn't moved, and that
    // fixed kink cycling through the normal swing's forward/up lift every
    // stride is exactly what read as a repeated kick. The knee now shares
    // half the same pull, so the leg leans together the way the torso
    // already does via `shear`, rather than bending unnaturally at the knee.
    const reachLateral = reaching ? reachSide * 0.30 * reachAmt : 0;
    const lateral = side * baseSpread * 1.4 + reachLateral;

    const hip = P(side * baseSpread, 0, hipZ + bounce);
    const knee = P(side * baseSpread * 1.1 + reachLateral * 0.5, fwd * 0.45, KNEE_Z + up * 0.5 + bounce * 0.5);
    const ankle = P(lateral, fwd, ANKLE_Z + up);
    // Forward (the direction of travel) is DECREASING world y — see gait():
    // a positive sin phase swings the foot forward via a NEGATIVE fwd
    // offset. So the toe (points forward) needs the smaller/more-negative
    // offset and the heel (behind the ankle) the larger one. Both use the
    // SAME `+ up` lift as the ankle above them — an earlier version scaled
    // the boot's lift down (`up * 0.6`) so the boot rose slower than the
    // sock during a swing and visibly detached from it mid-stride.
    const soleZ = Math.max(SOLE_Z, ankle.z - (ANKLE_Z - SOLE_Z));
    legs.push({
      hip, knee, ankle,
      soleMid: P(lateral, fwd, soleZ),
      toe: P(lateral, fwd - 0.16, soleZ),
      heel: P(lateral, fwd + 0.06, soleZ + 0.02),
    });
  }
  return { bounce, legs };
}

/** Bare thighs — shorts cover them from above. Drawn separately from the
 *  shins (see `drawShins`) because only the shins ever need to sandwich
 *  the ball; the thighs sit well above where a ground-level ball could
 *  ever plausibly be. */
function drawThighs(ctx: CanvasRenderingContext2D, cam: FpCamera, legs: LegPoints[]) {
  for (const L of legs) limb(ctx, cam, L.hip, L.knee, 0.075, 0.06, C.skin);
}

/** Sock-covered shin + boot, for both legs — deliberately the LAST thing
 *  drawn over a carried ball (see `renderFirstPerson`): this is the one
 *  part of the figure that's actually at ground level with the ball, so
 *  it's the one part allowed to hide it. */
function drawShins(ctx: CanvasRenderingContext2D, cam: FpCamera, legs: LegPoints[], colors: { shirt: string; rim: string }) {
  for (const L of legs) {
    // Bare shin from the knee down to where a real sock actually starts —
    // a sock drawn from the knee itself leaves almost no skin below the
    // shorts' hem, so the whole leg reads as one coloured tube.
    const sockTop = {
      x: L.knee.x + (L.ankle.x - L.knee.x) * SOCK_TOP_F,
      y: L.knee.y + (L.ankle.y - L.knee.y) * SOCK_TOP_F,
      z: L.knee.z + (L.ankle.z - L.knee.z) * SOCK_TOP_F,
    };
    limb(ctx, cam, L.knee, sockTop, 0.062, 0.058, C.skin);
    // Sock — covers the rest of the shin, team-trim coloured, same taper the
    // skin tube had before so it still reads as a leg, not a separate cylinder.
    limb(ctx, cam, sockTop, L.ankle, 0.058, 0.05, colors.rim);
    // Boot — an ankle-to-sole "cuff" closes the gap the sock leaves above
    // the sole (an earlier version placed the boot at a fixed depth well
    // below the ankle with nothing drawn in between, which read as a
    // separate object floating under the leg whenever the foot lifted mid-
    // stride), plus a real taper along the sole itself: narrow at the heel,
    // wider at the toe, not a constant-width stub. Sole line on top for a
    // cheap highlight.
    limb(ctx, cam, L.ankle, L.soleMid, 0.05, 0.06, "#15181f");
    limb(ctx, cam, L.heel, L.toe, 0.045, 0.075, "#15181f");
    limb(ctx, cam, L.heel, L.toe, 0.02, 0.03, "#3a3f4a");
  }
}

/**
 * The long evening shadow. The low sun is straight down the pitch (the
 * stadium picture), so every man's shadow falls back toward the camera — a
 * soft, layered streak on the turf, then a dark contact patch under the
 * boots. The contact patch is what plants a figure on the grass; without it
 * the men read as stood on top of the picture.
 */
function drawCastShadow(ctx: CanvasRenderingContext2D, cam: FpCamera, pos: { x: number; y: number }) {
  const layers = [[0.38, 0.8, 0.06], [0.29, 0.62, 0.08], [0.2, 0.45, 0.1]] as const;
  for (const [rx, len, a] of layers) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2;
      pts.push({ x: pos.x + 0.06 + Math.cos(t) * rx, y: pos.y + len * 0.62 + Math.sin(t) * len * 0.75 });
    }
    groundPoly(ctx, cam, pts, `rgba(18,28,12,${a})`);
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, cam: FpCamera, pos: { x: number; y: number }) {
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  drawCastShadow(ctx, cam, pos);
  if (SKIN3D) {
    drawSoftShadow(ctx, feet.px, feet.py, 0.36 * sc, 0.13 * sc);
    ctx.beginPath();
    ctx.ellipse(feet.px, feet.py, 0.26 * sc, 0.075 * sc, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,14,6,0.32)";
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(feet.px, feet.py, 0.36 * sc, 0.13 * sc, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();
}

/** Shorts, shirt, neck, arms, head — everything ABOVE the shins. Never
 *  drawn on either side of the ball specially: at this camera's distance
 *  the torso alone is tall/wide enough to cover almost the ball's entire
 *  screen footprint for the whole run if it's allowed to occlude it (
 *  measured directly — see `renderFirstPerson`'s own comment), so only the
 *  shins (drawn separately, see `drawShins`) ever get to hide it. */
function drawUpperBody(
  ctx: CanvasRenderingContext2D, cam: FpCamera,
  pos: { x: number; y: number }, shear: number,
  colors: { shirt: string; rim: string },
  opts: {
    armFlungSide?: -1 | 1 | 0; armFlungAmount?: number; runPhase?: number; bounce?: number;
    /** A real, loaded photo — see drawDefender's own doc. Absent (every
     *  chaser, every defender with no real identity, the roam mode, "own")
     *  keeps the original flat fill/hair-cap/stroke below, untouched. */
    face?: HTMLImageElement;
    faceStyle?: FaceStyle;
    fakeFaceStyle?: FakeFaceStyle;
    /** 3d only: who this is, for his drawn hair when there is no photo, and
     *  whether the camera sees the back of his head (you, in the chase cam). */
    headKey?: string;
    back?: boolean;
  },
) {
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  const phase = opts.runPhase ?? 0;
  const bounce = opts.bounce ?? Math.max(0, Math.sin(phase * 2)) * 0.03;
  const P = (dx: number, dy: number, z: number) => ({ x: pos.x + dx + shear, y: pos.y + dy, z });

  // Shorts — a filled trapezoid on the hips, not a rounded rectangle.
  // Narrower than the torso's own waist rather than wider than it: hips that
  // stick out past the body read as a nappy, which is what these were doing.
  const shortsTL = project(cam, pos.x - SHORTS_HALF + shear, pos.y, SHORTS_TOP_Z + bounce);
  const shortsTR = project(cam, pos.x + SHORTS_HALF + shear, pos.y, SHORTS_TOP_Z + bounce);
  const shortsBR = project(cam, pos.x + HEM_HALF + shear, pos.y, SHORTS_BOT_Z + bounce);
  const shortsBL = project(cam, pos.x - HEM_HALF + shear, pos.y, SHORTS_BOT_Z + bounce);
  if (shortsTL && shortsTR && shortsBR && shortsBL) {
    if (SKIN3D) {
      const g = ctx.createLinearGradient(shortsTL.px, 0, shortsTR.px, 0);
      g.addColorStop(0, tint(colors.rim, 0.22)); g.addColorStop(0.5, colors.rim); g.addColorStop(1, tint(colors.rim, -0.3));
      quad(ctx, [shortsTL, shortsTR, shortsBR, shortsBL], g);
    } else {
      quad(ctx, [shortsTL, shortsTR, shortsBR, shortsBL], colors.rim);
    }
  }

  // Torso — tapered (shoulders genuinely wider than the waist) and shaded
  // with a light-to-dark sweep so it reads as a rounded body, not a flat
  // card. The old numbers tapered 0.28 → 0.22, which at this camera is not a
  // taper you can see; these are fiveASide's own 0.42r → 0.29r.
  const shoulderL = project(cam, pos.x - SHOULDER_HALF + shear, pos.y, SHOULDER_Z - 0.05 + bounce);
  const shoulderR = project(cam, pos.x + SHOULDER_HALF + shear, pos.y, SHOULDER_Z - 0.05 + bounce);
  const capL = project(cam, pos.x - SHOULDER_HALF * 0.58 + shear, pos.y, SHOULDER_Z + 0.02 + bounce);
  const capR = project(cam, pos.x + SHOULDER_HALF * 0.58 + shear, pos.y, SHOULDER_Z + 0.02 + bounce);
  const waistR = project(cam, pos.x + WAIST_HALF + shear, pos.y, WAIST_Z + bounce);
  const waistL = project(cam, pos.x - WAIST_HALF + shear, pos.y, WAIST_Z + bounce);
  if (shoulderL && shoulderR && capL && capR && waistR && waistL) {
    const grad = ctx.createLinearGradient(shoulderL.px, 0, shoulderR.px, 0);
    if (SKIN3D) {
      grad.addColorStop(0, tint(colors.shirt, 0.3));
      grad.addColorStop(0.45, colors.shirt);
      grad.addColorStop(1, tint(colors.shirt, -0.42));
    } else {
      grad.addColorStop(0, colors.shirt);
      grad.addColorStop(0.55, colors.shirt);
      grad.addColorStop(1, colors.rim);
    }
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(waistL.px, waistL.py);
      ctx.lineTo(shoulderL.px, shoulderL.py);
      ctx.quadraticCurveTo(shoulderL.px, capL.py, capL.px, capL.py);
      ctx.lineTo(capR.px, capR.py);
      ctx.quadraticCurveTo(shoulderR.px, capR.py, shoulderR.px, shoulderR.py);
      ctx.lineTo(waistR.px, waistR.py);
      ctx.closePath();
    };
    torso();
    ctx.fillStyle = grad;
    ctx.fill();
    if (SKIN3D) {
      // Shading down the body, two folds, a shoulder highlight and a rim of
      // light down the right edge — the in-match 3d figure's shirt.
      const w = shoulderR.px - shoulderL.px, h = waistL.py - capL.py;
      ctx.save(); torso(); ctx.clip();
      const v = ctx.createLinearGradient(0, capL.py, 0, waistL.py);
      v.addColorStop(0, "rgba(255,255,255,0.10)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.26)");
      ctx.fillStyle = v; ctx.fillRect(shoulderL.px, capL.py, w, h);
      ctx.strokeStyle = rgba(tint(colors.shirt, -0.55), 0.42); ctx.lineCap = "round";
      ctx.lineWidth = Math.max(0.8, w * 0.03);
      const fx = (f: number) => shoulderL.px + w * f, fy = (f: number) => capL.py + h * f;
      ctx.beginPath(); ctx.moveTo(fx(0.3), fy(0.25)); ctx.quadraticCurveTo(fx(0.38), fy(0.55), fx(0.33), fy(0.97)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx(0.72), fy(0.28)); ctx.quadraticCurveTo(fx(0.63), fy(0.58), fx(0.68), fy(0.97)); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = Math.max(1, w * 0.045);
      ctx.beginPath(); ctx.moveTo(fx(0.03), fy(0.2)); ctx.quadraticCurveTo(fx(0.08), fy(0.02), fx(0.33), fy(0.01)); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,205,0.7)"; ctx.lineWidth = Math.max(1, w * 0.05);
      ctx.beginPath(); ctx.moveTo(shoulderR.px - w * 0.01, shoulderR.py); ctx.lineTo(waistR.px - w * 0.01, waistR.py); ctx.stroke();
      // The low sun behind: a warm rim down the other edge and over the
      // shoulders too, so he sits in the same evening light as the stadium.
      ctx.strokeStyle = "rgba(255,196,130,0.4)"; ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.beginPath(); ctx.moveTo(shoulderL.px + w * 0.01, shoulderL.py); ctx.lineTo(waistL.px + w * 0.01, waistL.py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(capL.px, capL.py + w * 0.01); ctx.lineTo(capR.px, capR.py + w * 0.01); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = Math.max(0.8, w * 0.025); ctx.lineJoin = "round";
      torso(); ctx.stroke();
    }
  }

  // Neck — the head used to sit floating directly on the shoulders with no
  // join at all. A short skin-toned taper closes that gap.
  limb(ctx, cam, P(0, 0, SHOULDER_Z - 0.03 + bounce), P(0, 0, NECK_Z + 0.02 + bounce),
    HEAD_BASE_R * 0.80, HEAD_BASE_R * 0.62, C.skin);

  // Arms — swing opposite the same-side leg (a natural gait is
  // contralateral). A committed defender's flung arm — his dive telegraph —
  // overrides its own side's target instead of the ordinary running swing;
  // the other arm keeps running normally.
  //
  // Each arm is drawn TWICE: bare skin end to end, then a shorter shirt-
  // coloured sleeve over the top of the upper arm. Without it the arm leaves
  // the shoulder as bare skin and the shirt has no sleeves at all — which is
  // exactly how these read, two tan planks hung off a slab.
  const flung = opts.armFlungAmount ?? 0;
  const armTopZ = SHOULDER_Z - 0.02;
  for (const side of [-1, 1] as const) {
    const shoulder = P(side * SHOULDER_HALF * 0.80, 0, armTopZ + bounce);
    let elbow: { x: number; y: number; z: number };
    let hand: { x: number; y: number; z: number };
    if (opts.armFlungSide === side) {
      elbow = P(side * (SHOULDER_HALF * 1.5 + flung * 0.5), 0.1, armTopZ - 0.12 + bounce);
      hand = P(side * (SHOULDER_HALF * 2.1 + flung), 0.15, armTopZ + 0.03 + bounce);
    } else {
      const g = gait(phase + (side === 1 ? 0 : Math.PI), 0.20, 0);
      elbow = P(side * SHOULDER_HALF * 0.98, g.fwd, armTopZ - 0.24 + bounce);
      hand = P(side * SHOULDER_HALF * 1.04, g.fwd * 1.4, armTopZ - 0.45 + bounce);
    }
    limb(ctx, cam, shoulder, elbow, 0.055, 0.05, C.skin);
    limb(ctx, cam, elbow, hand, 0.05, 0.045, C.skin);
    // Sleeve: the top ~45% of the upper arm, a shade thicker than the skin
    // under it so it reads as cloth over the arm rather than a stripe on it.
    const sleeveEnd = {
      x: shoulder.x + (elbow.x - shoulder.x) * 0.62,
      y: shoulder.y + (elbow.y - shoulder.y) * 0.62,
      z: shoulder.z + (elbow.z - shoulder.z) * 0.62,
    };
    limb(ctx, cam, P(side * SHOULDER_HALF * 0.70, 0, armTopZ - 0.02 + bounce), sleeveEnd,
      0.078, 0.060, colors.shirt);
  }

  // Head — a real photo, when one is known and loaded, drawn through
  // drawPlayerHead (lib/star/drawPlayerHead.ts) — the exact same function a
  // real match draws every head with, so a defender here looks exactly as
  // consistent (same crop, same outline, same everything the Face Editor
  // controls) as one on the actual pitch, never a second competing
  // drawing routine that could quietly disagree with it.
  //
  // BOTH branches now draw to ONE geometry (`headGeometry`). They did not:
  // `drawPlayerHead` multiplies the base radius it is handed by the Face
  // Editor's `scale` (2.2 by default) and the no-photo branch below used the
  // same number as a finished radius, so two identical defenders standing
  // side by side had heads 2.2× different, and the photo one floated a clear
  // 0.16 m above its own shoulders because nothing compensated for `offsetY`.
  // See the anatomy block at the top of this file.
  const geo = headGeometry(opts.faceStyle);
  const head = project(cam, pos.x + shear, pos.y, geo.anchorZ + bounce);
  // 3d: the face-fit head (faceFit.ts) — cut out, skin matched, lit like the
  // body — with its chin on the neck. Falls through to the ordinary head
  // while the photo loads or if it cannot be read.
  const fit = SKIN3D && (opts.faceStyle ?? DEFAULT_FACE_STYLE).facesEnabled && opts.face && opts.face.complete && opts.face.naturalWidth > 0
    ? fittedHeadFor(opts.face) : null;
  const chin = fit ? project(cam, pos.x + shear, pos.y, NECK_Z + 0.02 + bounce) : null;
  if (fit && chin) {
    const k = (0.27 * FIGURE_R * chin.scale) / fit.fit.faceH;
    const img = mipFor(fit, fit.fit.canvas.height * k);
    ctx.drawImage(img, chin.px - fit.fit.chinX * k, chin.py - fit.fit.chinY * k, fit.fit.canvas.width * k, fit.fit.canvas.height * k);
  } else if (head) {
    if (opts.face && opts.face.complete && opts.face.naturalWidth > 0) {
      drawPlayerHead(
        ctx, head.px, head.py,
        Math.max(1, HEAD_BASE_R * sc), Math.max(1, FIGURE_R * sc),
        opts.face, opts.faceStyle, opts.fakeFaceStyle,
      );
    } else if (SKIN3D) {
      // 3d, no photo: a drawn head with this man's own hair (never bald).
      const chinAt = project(cam, pos.x + shear, pos.y, NECK_Z + 0.02 + bounce) ?? head;
      drawStyledHead(ctx, chinAt.px, chinAt.py, 0.27 * FIGURE_R * chinAt.scale, C.skin, opts.headKey ?? "fp", !!opts.back);
    } else {
      // No photo: the same circle, at the same drawn size, in the same place
      // — plus the dark hair cap, which is the one thing this branch has that
      // a photo does not need.
      const centre = project(cam, pos.x + shear, pos.y, geo.centreZ + bounce) ?? head;
      const r = Math.max(1.5, geo.drawnR * sc);
      ctx.beginPath();
      ctx.arc(centre.px, centre.py, r, 0, Math.PI * 2);
      ctx.fillStyle = C.skin;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(centre.px, centre.py, r, Math.PI, 0);
      ctx.quadraticCurveTo(centre.px, centre.py - r * 0.34, centre.px - r, centre.py);
      ctx.closePath();
      ctx.fillStyle = "rgba(28,20,14,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(1, FIGURE_R * sc * 0.03);
      ctx.beginPath();
      ctx.arc(centre.px, centre.py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/**
 * The shared figure — boots, socks, legs, shorts, shirt, neck, arms, head,
 * all projected from the given world position with an optional lateral
 * shear (a defender's telegraph lean, or the ball-carrier leaning toward
 * whichever side he's currently touching the ball — see
 * FirstPersonDribble.tsx's `ownLean`). A convenience wrapper around
 * `computeLegs`/`drawThighs`/`drawUpperBody`/`drawShins` for callers with
 * no ball to sandwich between the shins and everything else (every
 * defender, every roam-mode chaser) — `renderFirstPerson` calls those four
 * directly for the ball carrier instead, see its own comment on why.
 *
 * Rebuilt from a straight-line stick figure into filled, tapered limbs (see
 * `limb()`) with a real running gait (`runPhase`, radians — legs and arms
 * swing from it, contralaterally, the way a person actually runs) and a
 * shaded, tapered torso instead of a flat rectangle. Reported directly as
 * "this weird stick man type of figure" — this was the first vector-art
 * fix. Reported again after actually playing the redesigned duel — "it
 * doesn't really look like you made any changes to how the player actually
 * looks" — so a second pass added boots, socks and a neck. A genuinely
 * illustrated or 3D-modelled character remains a separate asset this
 * codebase has no pipeline for (no image-generation/3D tool was reachable
 * this session either — see the session's own reply on that), so it stays
 * procedural, same as every other figure in this file and in
 * scenarioRender.ts.
 */
function drawFigure(
  ctx: CanvasRenderingContext2D, cam: FpCamera,
  pos: { x: number; y: number }, shear: number,
  colors: { shirt: string; rim: string },
  opts: LegOpts & {
    armFlungSide?: -1 | 1 | 0; armFlungAmount?: number;
    face?: HTMLImageElement; faceStyle?: FaceStyle; fakeFaceStyle?: FakeFaceStyle;
    headKey?: string; back?: boolean;
  } = {},
) {
  drawShadow(ctx, cam, pos);
  const { bounce, legs } = computeLegs(pos, shear, opts);
  drawThighs(ctx, cam, legs);
  drawUpperBody(ctx, cam, pos, shear, colors, { ...opts, bounce });
  drawShins(ctx, cam, legs, colors);
}

function drawDefender(
  ctx: CanvasRenderingContext2D, cam: FpCamera, def: FpDefender, assist: boolean,
  getFace?: (url: string | undefined) => HTMLImageElement | undefined, faceStyle?: FaceStyle,
  fakeFaceStyle?: FakeFaceStyle, kit: { shirt: string; rim: string } = { shirt: C.opp, rim: C.oppRim },
) {
  // Drawn even while "waiting" — his wave was PLACED, not sprung on you
  // (see firstPersonDribble.ts's own header), so he's meant to be visible,
  // standing, from a distance before he ever engages.
  const shear = shearFor(def);

  // Ground chevron — the telegraph's clearest cue: which way he's going,
  // drawn where the eye already is (the turf), amber running to red as the
  // window closes.
  if (def.phase === "telegraph") {
    const f = 1 - clamp(def.tell / def.tellT, 0, 1);
    const feet = project(cam, def.x, def.y, 0);
    const chev = project(cam, def.x + def.commitSide * (0.55 + 0.35 * f), def.y, 0);
    if (chev && feet) {
      const sc = feet.scale;
      const col = `rgba(${Math.round(lerp(251, 239, f))},${Math.round(lerp(191, 68, f))},${Math.round(lerp(36, 68, f))},${0.55 + f * 0.35})`;
      ctx.fillStyle = col;
      ctx.beginPath();
      const r = 0.30 * sc;
      ctx.moveTo(chev.px + def.commitSide * r, chev.py);
      ctx.lineTo(chev.px - def.commitSide * r * 0.4, chev.py - r * 0.6);
      ctx.lineTo(chev.px - def.commitSide * r * 0.4, chev.py + r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    if (assist) {
      const openSide: "left" | "right" = def.commitSide > 0 ? "left" : "right";
      const gw = cam.W * 0.16;
      const grad = ctx.createLinearGradient(
        openSide === "left" ? 0 : cam.W, 0,
        openSide === "left" ? gw : cam.W - gw, 0,
      );
      const a = 0.10 + f * 0.16;
      grad.addColorStop(0, `rgba(52,211,153,${a})`);
      grad.addColorStop(1, "rgba(52,211,153,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(openSide === "left" ? 0 : cam.W - gw, 0, gw, cam.H);
    }
  }

  const legSpread = 0.16 + (def.phase === "committed" ? 0.10 * easeOutCubic(def.lunge) : 0);
  const flungOut = def.phase === "committed" ? 0.75 * easeOutCubic(def.lunge) : -0.25;
  // A running phase keyed to distance closed, not wall-clock — same
  // discipline `stride` already uses for the ground stripes, so it can
  // never drift out of sync with how fast he's actually closing you down.
  // A neutral standing pose while "waiting", since his depth (and so this
  // phase) genuinely never changes until he engages.
  const runPhase = def.phase === "waiting" ? 0 : (-def.y / 1.5) * Math.PI * 2;
  drawFigure(ctx, cam, def, shear, kit, {
    legSpread,
    armFlungSide: def.phase === "committed" ? def.commitSide : 0,
    armFlungAmount: flungOut,
    runPhase,
    face: getFace?.(def.who?.face),
    faceStyle,
    fakeFaceStyle,
    headKey: def.who?.id ?? def.who?.face ?? `def-${Math.round(def.x * 10)}`,
  });
}

/** A roam-mode chaser — no telegraph, no lean, just a man either standing
 *  off (dimmed, not yet a threat) or fully awake and coming for the ball. */
function drawChaser(ctx: CanvasRenderingContext2D, cam: FpCamera, chaser: { x: number; y: number; awake: boolean }, index = 0) {
  const colors = chaser.awake ? { shirt: C.opp, rim: C.oppRim } : { shirt: C.oppAsleep, rim: C.oppAsleepRim };
  const runPhase = (-chaser.y / 1.5) * Math.PI * 2;
  drawFigure(ctx, cam, chaser, 0, colors, { runPhase, headKey: `chaser-${index}` });
}

// ── Ball, hands, HUD ─────────────────────────────────────────────────────

function drawBall(
  ctx: CanvasRenderingContext2D, cam: FpCamera,
  ball: { x: number; y: number; z: number }, ballImage?: HTMLImageElement | null,
) {
  const proj = project(cam, ball.x, ball.y, ball.z + 0.11);
  const ground = project(cam, ball.x, ball.y, 0);
  if (!proj || !ground) return;
  const r = Math.max(3, 0.11 * proj.scale);
  if (SKIN3D) {
    // 3d: a soft shadow, the ball rolling with the distance it has covered,
    // and lit from the left like everything else (a shine and a shaded side).
    drawSoftShadow(ctx, ground.px, ground.py, r * 1.1, r * 0.4);
    ctx.save();
    ctx.translate(proj.px, proj.py);
    ctx.save();
    ctx.rotate(-ball.y / 0.11);
    if (ballImage && ballImage.complete && ballImage.naturalWidth > 0) ctx.drawImage(ballImage, -r, -r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = "#fefefe"; ctx.fill(); }
    ctx.restore();
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.02);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.35, "rgba(255,255,255,0)");
    g.addColorStop(0.75, "rgba(0,0,0,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(ground.px, ground.py, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  if (ballImage && ballImage.complete && ballImage.naturalWidth > 0) {
    ctx.drawImage(ballImage, proj.px - r, proj.py - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.arc(proj.px, proj.py, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fefefe";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
  }
}

/** Two forearms and a hint of boot tips at the bottom edge — screen-space
 *  only, no world position. The difference between "through his eyes" and
 *  a floating camera. */
function drawOwnBody(ctx: CanvasRenderingContext2D, W: number, H: number, bob: number) {
  ctx.fillStyle = C.skin;
  const armY = H * (0.97 + bob * 0.006);
  ctx.beginPath();
  ctx.ellipse(W * 0.14, armY, W * 0.11, H * 0.045, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.86, armY, W * 0.11, H * 0.045, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(W * 0.40, H * 0.995, W * 0.09, H * 0.02);
  ctx.fillRect(W * 0.51, H * 0.995, W * 0.09, H * 0.02);
}

export type DuelPip = "pending" | "active" | "beaten" | "won";

function drawHud(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, pips?: DuelPip[]) {
  ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(W * 0.045)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(text, W / 2, H * 0.07);

  if (!pips || pips.length === 0) return;
  const pipColor: Record<DuelPip, string> = {
    pending: "rgba(255,255,255,0.35)",
    active: "#fbbf24",
    beaten: "#34d399",
    won: "#ef4444",
  };
  const cx0 = W / 2 - (pips.length - 1) * W * 0.035;
  pips.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(cx0 + i * W * 0.07, H * 0.10, W * 0.014, 0, Math.PI * 2);
    ctx.fillStyle = pipColor[p];
    ctx.fill();
  });
}

// ── The composed frames ──────────────────────────────────────────────────────

export interface RenderFirstPersonOptions {
  cam: FpCamera;
  defenders: FpDefender[];
  stride: number;
  minX: number;
  maxX: number;
  ball: { x: number; y: number; z: number } | null;
  ballImage?: HTMLImageElement | null;
  assist: boolean;
  reducedMotion: boolean;
  hud?: { text: string; pips?: DuelPip[] } | null;
  /**
   * Your own world position, for a THIRD-person chase camera sitting
   * behind and above you — see FirstPersonDribble.tsx's own header on why
   * this exists. Draws you as a real figure (the same drawFigure() every
   * defender already uses, in "you" green) instead of the flat first-
   * person forearms-at-the-bottom-edge, which have no world position and
   * would make no sense once the camera isn't AT your eyes any more.
   * Omit (or null) for the plain first-person view — unchanged, and what
   * the open-run mode still uses.
   */
  own?: { x: number; y: number } | null;
  /** Leave your own figure out — the ball, the men and the camera are unchanged
   *  (the v0.23 trial: "outside of penalties and free kicks we just don't have
   *  him"). Off by default; the real match never sets it. */
  hideYou?: boolean;
  /**
   * Lean the "own" figure sideways — reuses the same lateral `shear` a
   * defender's telegraph already draws with, driven instead by which way
   * the ball is currently being touched (see FirstPersonDribble.tsx), so
   * the body visibly reaches toward it rather than always standing bolt
   * upright while the ball moves independently of it. Ignored when `own`
   * is null.
   */
  ownLean?: number;
  /**
   * Resolves a defender's `who.face` URL to a real, loaded image — see
   * drawDefender's own doc. Omit (the roam mode never passes one) and
   * every defender draws exactly as before, whether or not `newRun` was
   * given a roster: a real identity with no resolver is exactly as
   * anonymous-looking as no identity at all.
   */
  getFace?: (url: string | undefined) => HTMLImageElement | undefined;
  /** The shared FaceStyle every real photo draws through — same object a
   *  real match reads, so a defender here looks exactly as tuned as one on
   *  the actual pitch. Omit to fall back to drawPlayerHead's own default. */
  faceStyle?: FaceStyle;
  /** The shared FakeFaceStyle every one of the seven fake headshots draws
   *  through — see drawPlayerHead.ts's own doc. Omit to fall back to its
   *  default, same as `faceStyle`. */
  fakeFaceStyle?: FakeFaceStyle;
  /** The painted stadium (public/home/scene-sunset.webp, loaded by the
   *  caller). Until it has loaded, a drawn stand stands in. */
  backdrop?: HTMLImageElement | null;
  /** Draw the carried ball in its true depth (behind your body). The chase
   *  cameras C1-C3 set it; the old "today" camera does not — see drawOwn. */
  ballBehindYou?: boolean;
  /** Shirt and shorts for you and for them. Omit for the game's role
   *  colours (you green, them red — lib/star/fiveASide/render.ts ROLE_KIT). */
  kits?: FpKits;
}

export interface FpKit { shirt: string; shorts: string }
export interface FpKits { you?: FpKit; opp?: FpKit }

/** The one-on-one duel mode.
 *
 * Everyone is drawn far to near (true depth), the way a camera sees them: a
 * man you have just beaten, now beside or behind you, is drawn over you, not
 * under you. With `ballBehindYou` the carried ball is drawn in its true place
 * too — behind your body, since it is always ahead of you. See
 * firstPersonDribble.ts's CARRY on why that no longer hides it. */
export function renderFirstPerson(canvas: HTMLCanvasElement, opts: RenderFirstPersonOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  SKIN3D = figureSkin() === "3d";
  const W = canvas.width, H = canvas.height;
  const cam = opts.cam;

  // Turf first, then the sky and stand over its far edge: the stand stands
  // on the grass a little below the horizon, so it must cover the far turf.
  drawGround(ctx, W, H, cam, opts.minX, opts.maxX);
  drawStadium(ctx, cam, W, H, opts.backdrop);

  const oppKit = opts.kits?.opp ? { shirt: opts.kits.opp.shirt, rim: opts.kits.opp.shorts } : { shirt: C.opp, rim: C.oppRim };
  const youKit = opts.kits?.you ? { shirt: opts.kits.you.shirt, rim: opts.kits.you.shorts } : { shirt: C.you, rim: C.youRim };

  const items: { s: number; draw: () => void }[] = [];
  for (const def of opts.defenders) {
    const p = project(cam, def.x, def.y, 0);
    if (!p) continue;
    items.push({ s: p.scale, draw: () => drawDefender(ctx, cam, def, opts.assist, opts.getFace, opts.faceStyle, opts.fakeFaceStyle, oppKit) });
  }

  if (opts.own && opts.hideYou) {
    // Just the ball, on the grass in front of the camera.
    const ball = opts.ball;
    const p = ball ? project(cam, ball.x, ball.y, 0) : null;
    if (ball && p) items.push({ s: p.scale, draw: () => drawBall(ctx, cam, ball, opts.ballImage) });
  } else if (opts.own) {
    const own = opts.own;
    const p = project(cam, own.x, own.y, 0);
    if (p) items.push({ s: p.scale, draw: () => drawOwn(ctx, cam, opts, own, youKit) });
  } else {
    const bob = opts.reducedMotion ? 0 : Math.sin(opts.stride * 1.9);
    items.push({ s: Infinity, draw: () => {
      drawOwnBody(ctx, W, H, bob);
      // No world position for the plain first-person forearms, so no leg to
      // sandwich the ball with — unchanged from before, drawn on top.
      if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);
    } });
  }

  items.sort((a, b) => a.s - b.s);
  for (const it of items) it.draw();

  drawVignette(ctx, W, H);
  if (opts.hud) drawHud(ctx, W, H, opts.hud.text, opts.hud.pips);
}

/** You, from behind, with the ball you are carrying. */
function drawOwn(
  ctx: CanvasRenderingContext2D, cam: FpCamera, opts: RenderFirstPersonOptions,
  own: { x: number; y: number }, colors: { shirt: string; rim: string },
) {
  const ownRunPhase = (opts.stride / OWN_GAIT_M) * Math.PI * 2;
  const lean = opts.ownLean ?? 0;
  // The near leg visibly reaches toward the ball while it's being
  // touched — see drawFigure's own header — reusing the same lean signal
  // that already leans the whole body, so a hard touch shows in the feet
  // and legs, not just a sideways tilt.
  const reachSide: -1 | 1 | 0 = Math.abs(lean) > 0.05 ? (lean > 0 ? 1 : -1) : 0;
  const reachAmount = clamp(Math.abs(lean) / 0.35, 0, 1);

  drawShadow(ctx, cam, own);
  const { bounce, legs } = computeLegs(own, lean, { runPhase: ownRunPhase, reachSide, reachAmount });
  if (opts.ballBehindYou) {
    // True depth: the ball is ahead of you, so farther from the camera than
    // any part of you. Your body covers it only where it really would; the
    // carry (firstPersonDribble.ts CARRY) keeps it out beside your boot, so
    // what crosses it is your own boot as it touches it.
    if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);
    drawThighs(ctx, cam, legs);
    drawUpperBody(ctx, cam, own, lean, colors, { runPhase: ownRunPhase, bounce, headKey: "you", back: true });
    drawShins(ctx, cam, legs, colors);
    return;
  }
  // The old camera ("today", the dev sandbox): the ball sits dead ahead of
  // you, so in true depth your torso would hide it — only the shins are
  // allowed to (the earlier fix, kept for that camera).
  drawThighs(ctx, cam, legs);
  drawUpperBody(ctx, cam, own, lean, colors, { runPhase: ownRunPhase, bounce, headKey: "you", back: true });
  if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);
  drawShins(ctx, cam, legs, colors);
}

export interface RenderRoamOptions {
  cam: FpCamera;
  chasers: { x: number; y: number; awake: boolean }[];
  stride: number;
  minX: number;
  maxX: number;
  ball: { x: number; y: number; z: number } | null;
  ballImage?: HTMLImageElement | null;
  reducedMotion: boolean;
  hud?: { text: string } | null;
}

/** The open-run mode — dribble.ts's own mechanics, seen through the eyes. */
export function renderFirstPersonRoam(canvas: HTMLCanvasElement, opts: RenderRoamOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  SKIN3D = figureSkin() === "3d";
  const W = canvas.width, H = canvas.height;
  const cam = opts.cam;

  drawGround(ctx, W, H, cam, opts.minX, opts.maxX, false);
  drawStadium(ctx, cam, W, H, null);

  opts.chasers.forEach((chaser, i) => drawChaser(ctx, cam, chaser, i));
  if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);

  const bob = opts.reducedMotion ? 0 : Math.sin(opts.stride * 1.9);
  drawOwnBody(ctx, W, H, bob);

  if (opts.hud) drawHud(ctx, W, H, opts.hud.text);
}

export type { DefenderPhase };
