import { project, horizonPx, type FpCamera } from "./firstPersonView";
import type { FpDefender, DefenderPhase } from "./firstPersonDribble";

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
function quad(ctx: CanvasRenderingContext2D, q: Pt[], fill: string) {
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

// ── Sky, stands, ground ────────────────────────────────────────────────────

function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, C.sky);
  g.addColorStop(1, C.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon);
  const bandTop = horizon * 0.55;
  ctx.fillStyle = C.stand;
  ctx.fillRect(0, bandTop, W, horizon - bandTop);
  const crowd = crowdTile();
  if (crowd) {
    const pat = ctx.createPattern(crowd, "repeat");
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, bandTop, W, horizon - bandTop); }
  }
}

/** The moving mowing stripes — the single detail that sells forward motion.
 *  Bands are drawn in WORLD depth, keyed off `stride` (metres run), never
 *  off wall-clock time, so they can never drift out of sync with speed. */
function drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, cam: FpCamera, stride: number, minX: number, maxX: number) {
  const horizon = horizonPx(cam);
  ctx.fillStyle = C.pitch;
  ctx.fillRect(0, horizon, W, H - horizon);

  const STRIPE_M = 5;
  const offset = stride % (STRIPE_M * 2);
  let d0 = -offset;
  // Walk out from just in front of the camera to the far distance, alternating
  // shade — each band is a trapezoid between two projected lateral lines,
  // drawn across a lateral span wide enough that turning never reveals a
  // gap at the edge of the stripes.
  const wide = Math.max(maxX - minX, 30);
  for (let i = 0; i < 24; i++) {
    const near = d0 + i * STRIPE_M;
    const far = near + STRIPE_M;
    if (far <= 0.4) continue;
    const dNear = Math.max(near, 0.4);
    const y1 = cam.y - dNear, y2 = cam.y - far;
    const a1 = project(cam, minX - wide, y1, 0), b1 = project(cam, maxX + wide, y1, 0);
    const a2 = project(cam, minX - wide, y2, 0), b2 = project(cam, maxX + wide, y2, 0);
    if (!a1 || !b1 || !a2 || !b2) continue;
    quad(ctx, [a1, b1, b2, a2], i % 2 === 0 ? C.pitch : C.pitchDark);
  }

  const grass = grassTile();
  if (grass) {
    const pat = ctx.createPattern(grass, "repeat");
    if (pat) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pat;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.restore();
    }
  }
}

/** The two edges of the corridor — the only "markings" either mode draws.
 *  No goal, no boxes: neither mode runs toward one (see the file header). */
function drawCorridorGuides(ctx: CanvasRenderingContext2D, cam: FpCamera, minX: number, maxX: number) {
  ctx.lineWidth = Math.max(1, cam.W * 0.005);
  ctx.strokeStyle = C.lineFaint;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const a = project(cam, x1, y1, 0), b = project(cam, x2, y2, 0);
    if (!a || !b) return;
    seg(ctx, a, b);
  };
  const far = cam.y - 40;
  line(minX, cam.y - 1, minX, far);
  line(maxX, cam.y - 1, maxX, far);
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

/** The shared front-on figure — legs, shorts, shirt, arms, head, all
 *  projected from the given world position with an optional lateral shear
 *  (the duel mode's telegraph lean; always 0 for a plain roam chaser). */
function drawFigure(
  ctx: CanvasRenderingContext2D, cam: FpCamera,
  pos: { x: number; y: number }, shear: number,
  colors: { shirt: string; rim: string },
  opts: { legSpread?: number; armFlungSide?: -1 | 1 | 0; armFlungAmount?: number } = {},
) {
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  const bodyX = (dx: number, z: number) => project(cam, pos.x + dx + shear, pos.y, z);

  ctx.beginPath();
  ctx.ellipse(feet.px, feet.py, 0.42 * sc, 0.14 * sc, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();

  const legSpread = opts.legSpread ?? 0.16;
  const hipL = bodyX(-legSpread, 0.95), hipR = bodyX(legSpread, 0.95);
  const footL = bodyX(-legSpread * 1.3, 0), footR = bodyX(legSpread * 1.3, 0);
  ctx.strokeStyle = C.skin;
  ctx.lineWidth = Math.max(1.4, sc * 0.10);
  ctx.lineCap = "round";
  if (hipL && footL) seg(ctx, hipL, footL);
  if (hipR && footR) seg(ctx, hipR, footR);

  const shortsA = bodyX(-0.24, 0.82), shortsB = bodyX(0.24, 1.02);
  if (shortsA && shortsB) {
    ctx.fillStyle = colors.rim;
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shortsA.px, shortsB.px), Math.min(shortsA.py, shortsB.py),
      Math.abs(shortsB.px - shortsA.px), Math.abs(shortsB.py - shortsA.py), sc * 0.08);
    if (!ctx.roundRect) ctx.rect(Math.min(shortsA.px, shortsB.px), Math.min(shortsA.py, shortsB.py),
      Math.abs(shortsB.px - shortsA.px), Math.abs(shortsB.py - shortsA.py));
    ctx.fill();
  }

  const shirtA = bodyX(-0.26, 1.05), shirtB = bodyX(0.26, 1.50);
  if (shirtA && shirtB) {
    ctx.fillStyle = colors.shirt;
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py), sc * 0.06);
    if (!ctx.roundRect) ctx.rect(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py));
    ctx.fill();
    ctx.strokeStyle = colors.rim;
    ctx.lineWidth = Math.max(1, sc * 0.05);
    ctx.stroke();
  }

  const shoulderL = bodyX(-0.28, 1.45), shoulderR = bodyX(0.28, 1.45);
  const flung = opts.armFlungAmount ?? 0;
  const handL = opts.armFlungSide === -1
    ? bodyX(-0.55 - flung, 1.55) : bodyX(-0.55, 1.15);
  const handR = opts.armFlungSide === 1
    ? bodyX(0.55 + flung, 1.55) : bodyX(0.55, 1.15);
  ctx.strokeStyle = C.skin;
  ctx.lineWidth = Math.max(1.2, sc * 0.09);
  if (shoulderL && handL) seg(ctx, shoulderL, handL);
  if (shoulderR && handR) seg(ctx, shoulderR, handR);

  const head = bodyX(0, 1.62);
  if (head) {
    ctx.beginPath();
    ctx.arc(head.px, head.py, Math.max(1.5, 0.11 * sc), 0, Math.PI * 2);
    ctx.fillStyle = C.skin;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = Math.max(1, sc * 0.03);
    ctx.stroke();
  }
}

function drawDefender(ctx: CanvasRenderingContext2D, cam: FpCamera, def: FpDefender, assist: boolean) {
  if (def.phase === "waiting") return;
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
  drawFigure(ctx, cam, def, shear, { shirt: C.opp, rim: C.oppRim }, {
    legSpread,
    armFlungSide: def.phase === "committed" ? def.commitSide : 0,
    armFlungAmount: flungOut,
  });
}

/** A roam-mode chaser — no telegraph, no lean, just a man either standing
 *  off (dimmed, not yet a threat) or fully awake and coming for the ball. */
function drawChaser(ctx: CanvasRenderingContext2D, cam: FpCamera, chaser: { x: number; y: number; awake: boolean }) {
  const colors = chaser.awake ? { shirt: C.opp, rim: C.oppRim } : { shirt: C.oppAsleep, rim: C.oppAsleepRim };
  drawFigure(ctx, cam, chaser, 0, colors);
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
}

/** The one-on-one duel mode. */
export function renderFirstPerson(canvas: HTMLCanvasElement, opts: RenderFirstPersonOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cam = opts.cam;

  drawSky(ctx, W, H, horizonPx(cam));
  drawGround(ctx, W, H, cam, opts.reducedMotion ? 0 : opts.stride, opts.minX, opts.maxX);
  drawCorridorGuides(ctx, cam, opts.minX, opts.maxX);

  for (const def of opts.defenders) drawDefender(ctx, cam, def, opts.assist);
  if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);

  const bob = opts.reducedMotion ? 0 : Math.sin(opts.stride * 1.9);
  drawOwnBody(ctx, W, H, bob);

  if (opts.hud) drawHud(ctx, W, H, opts.hud.text, opts.hud.pips);
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
  const W = canvas.width, H = canvas.height;
  const cam = opts.cam;

  drawSky(ctx, W, H, horizonPx(cam));
  drawGround(ctx, W, H, cam, opts.reducedMotion ? 0 : opts.stride, opts.minX, opts.maxX);
  drawCorridorGuides(ctx, cam, opts.minX, opts.maxX);

  for (const chaser of opts.chasers) drawChaser(ctx, cam, chaser);
  if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);

  const bob = opts.reducedMotion ? 0 : Math.sin(opts.stride * 1.9);
  drawOwnBody(ctx, W, H, bob);

  if (opts.hud) drawHud(ctx, W, H, opts.hud.text);
}

export type { DefenderPhase };
