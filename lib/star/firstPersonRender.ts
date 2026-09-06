import { PITCH_W, POST_L, POST_R, NET_DEPTH, GOAL_H, BOX_DEPTH } from "./pitch";
import { project, type FpCamera } from "./firstPersonView";
import type { FpDefender, DefenderPhase } from "./firstPersonDribble";

/**
 * DRAWING THE FIRST-PERSON RUN.
 *
 * Copies TECHNIQUE from `scenarioRender.ts`, not code — the same precedent
 * that file itself sets rather than importing from `CanvasMatch.tsx`
 * directly: this is a standalone renderer for a standalone dev sandbox, so
 * nothing here can put the real match's own delicate, tuned drawing code at
 * risk. What's actually copied: the palette (sampled off the same real
 * match reference), the `grassTile()` grain and the `netting()` quad
 * helper verbatim, and the hand-drawn figure grammar — rebuilt here in
 * elevation (front-on, through `firstPersonView.ts`'s real camera) rather
 * than the flat overhead `toPx` the other two renderers use.
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
 */

// Palette — same identity CanvasMatch.tsx/scenarioRender.ts already use.
const C = {
  pitch: "#1f9006",
  pitchDark: "#1b7f05",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.45)",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  mate: "#3b82f6",
  mateRim: "#1e3a5f",
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
function path(ctx: CanvasRenderingContext2D, q: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(q[0].px, q[0].py);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
  ctx.closePath();
}
function quad(ctx: CanvasRenderingContext2D, q: Pt[], fill: string) {
  path(ctx, q); ctx.fillStyle = fill; ctx.fill();
}
function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
}
function ptLerp(a: Pt, b: Pt, f: number): Pt {
  return { px: a.px + (b.px - a.px) * f, py: a.py + (b.py - a.py) * f };
}
/** Ported verbatim from scenarioRender.ts's own `netting()` — a generic
 *  four-corner lerp grid, clipped to its own quad. Works unchanged here. */
function netting(ctx: CanvasRenderingContext2D, q: Pt[], cols: number, rows: number, alpha: number) {
  ctx.save();
  path(ctx, q); ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i <= cols; i++) { const f = i / cols; seg(ctx, ptLerp(q[0], q[1], f), ptLerp(q[3], q[2], f)); }
  for (let j = 0; j <= rows; j++) { const f = j / rows; seg(ctx, ptLerp(q[0], q[3], f), ptLerp(q[1], q[2], f)); }
  ctx.restore();
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
  ctx.fillStyle = C.pitch;
  ctx.fillRect(0, cam.horizon, W, H - cam.horizon);

  const STRIPE_M = 5;
  const offset = stride % (STRIPE_M * 2);
  let d0 = -offset;
  // Walk out from just in front of the camera to the far distance, alternating
  // shade — each band is a trapezoid between two projected lateral lines.
  for (let i = 0; i < 24; i++) {
    const near = d0 + i * STRIPE_M;
    const far = near + STRIPE_M;
    if (far <= 0.4) continue;
    const dNear = Math.max(near, 0.4);
    const y1 = cam.y - dNear, y2 = cam.y - far;
    const a1 = project(cam, minX - 4, y1, 0), b1 = project(cam, maxX + 20, y1, 0);
    const a2 = project(cam, minX - 4, y2, 0), b2 = project(cam, maxX + 20, y2, 0);
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
      ctx.fillRect(0, cam.horizon, W, H - cam.horizon);
      ctx.restore();
    }
  }
}

function drawMarkings(ctx: CanvasRenderingContext2D, cam: FpCamera, minX: number, maxX: number) {
  ctx.lineWidth = Math.max(1, cam.W * 0.006);
  ctx.strokeStyle = C.line;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const a = project(cam, x1, y1, 0), b = project(cam, x2, y2, 0);
    if (!a || !b) return;
    seg(ctx, a, b);
  };
  // Goal line and the near edges of the six-yard/penalty boxes — real IFAB
  // geometry (pitch.ts), always ahead of the camera by construction.
  line(0, 0, PITCH_W, 0);
  const SIX_L = POST_L - 5.5, SIX_R = POST_R + 5.5;
  const BOX_L = POST_L - 16.5, BOX_R = POST_R + 16.5;
  line(SIX_L, 0, SIX_L, 5.5); line(SIX_R, 0, SIX_R, 5.5); line(SIX_L, 5.5, SIX_R, 5.5);
  line(BOX_L, 0, BOX_L, BOX_DEPTH); line(BOX_R, 0, BOX_R, BOX_DEPTH); line(BOX_L, BOX_DEPTH, BOX_R, BOX_DEPTH);

  // Corridor guides — the edges of the run, faint, running out to the
  // horizon's own vanishing point automatically (a straight world line
  // always projects to a straight screen line; no special-casing needed).
  ctx.strokeStyle = C.lineFaint;
  line(minX, Math.max(0, cam.y - 1), minX, 0);
  line(maxX, Math.max(0, cam.y - 1), maxX, 0);
}

function drawGoal(ctx: CanvasRenderingContext2D, cam: FpCamera) {
  const bl = project(cam, POST_L, 0, 0), br = project(cam, POST_R, 0, 0);
  const tl = project(cam, POST_L, 0, GOAL_H), tr = project(cam, POST_R, 0, GOAL_H);
  const rl = project(cam, POST_L, -NET_DEPTH, 0), rr = project(cam, POST_R, -NET_DEPTH, 0);
  const ul = project(cam, POST_L, -NET_DEPTH, GOAL_H), ur = project(cam, POST_R, -NET_DEPTH, GOAL_H);
  if (!bl || !br || !tl || !tr || !rl || !rr || !ul || !ur) return;

  quad(ctx, [bl, br, rr, rl], "rgba(20,50,32,0.10)");
  quad(ctx, [rl, rr, ur, ul], "rgba(22,52,34,0.22)");
  netting(ctx, [rl, rr, ur, ul], 22, 8, 0.42);
  ctx.strokeStyle = "#0f1a14";
  ctx.lineWidth = Math.max(1.2, cam.W * 0.004);
  seg(ctx, rl, ul); seg(ctx, rr, ur); seg(ctx, ul, ur);
  quad(ctx, [tl, tr, ur, ul], "rgba(236,245,239,0.28)");
  netting(ctx, [tl, tr, ur, ul], 22, 5, 0.75);

  ctx.lineCap = "round";
  ctx.strokeStyle = "#f6faf7";
  ctx.lineWidth = Math.max(2, cam.W * 0.01);
  seg(ctx, bl, tl); seg(ctx, br, tr);
  ctx.lineWidth = Math.max(2.4, cam.W * 0.013);
  seg(ctx, tl, tr);
  ctx.lineCap = "butt";
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

function drawDefender(ctx: CanvasRenderingContext2D, cam: FpCamera, def: FpDefender, assist: boolean) {
  if (def.phase === "waiting") return;
  const feet = project(cam, def.x, def.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  const shear = shearFor(def);
  const bodyX = (dx: number, z: number) => project(cam, def.x + dx + shear, def.y, z);

  // Shadow.
  ctx.beginPath();
  ctx.ellipse(feet.px, feet.py, 0.42 * sc, 0.14 * sc, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();

  // Ground chevron — the telegraph's clearest cue: which way he's going,
  // drawn where the eye already is (the turf), amber running to red as the
  // window closes.
  if (def.phase === "telegraph") {
    const f = 1 - clamp(def.tell / def.tellT, 0, 1);
    const chev = project(cam, def.x + def.commitSide * (0.55 + 0.35 * f), def.y, 0);
    if (chev) {
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
  const hipL = bodyX(-legSpread, 0.95), hipR = bodyX(legSpread, 0.95);
  const footL = bodyX(-legSpread * 1.3, 0), footR = bodyX(legSpread * 1.3, 0);
  ctx.strokeStyle = C.skin;
  ctx.lineWidth = Math.max(1.4, sc * 0.10);
  ctx.lineCap = "round";
  if (hipL && footL) seg(ctx, hipL, footL);
  if (hipR && footR) seg(ctx, hipR, footR);

  const shortsA = bodyX(-0.24, 0.82), shortsB = bodyX(0.24, 1.02);
  if (shortsA && shortsB) {
    ctx.fillStyle = C.oppRim;
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shortsA.px, shortsB.px), Math.min(shortsA.py, shortsB.py),
      Math.abs(shortsB.px - shortsA.px), Math.abs(shortsB.py - shortsA.py), sc * 0.08);
    if (!ctx.roundRect) ctx.rect(Math.min(shortsA.px, shortsB.px), Math.min(shortsA.py, shortsB.py),
      Math.abs(shortsB.px - shortsA.px), Math.abs(shortsB.py - shortsA.py));
    ctx.fill();
  }

  const shirtA = bodyX(-0.26, 1.05), shirtB = bodyX(0.26, 1.50);
  if (shirtA && shirtB) {
    ctx.fillStyle = C.opp;
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py), sc * 0.06);
    if (!ctx.roundRect) ctx.rect(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py));
    ctx.fill();
    ctx.strokeStyle = C.oppRim;
    ctx.lineWidth = Math.max(1, sc * 0.05);
    ctx.stroke();
  }

  // Arms — the committed side flings out, the classic "diving the wrong
  // way" silhouette once he's fully lunged.
  const shoulderL = bodyX(-0.28, 1.45), shoulderR = bodyX(0.28, 1.45);
  const flungOut = def.phase === "committed" ? 0.75 * easeOutCubic(def.lunge) : 0.30;
  const handL = def.commitSide === -1 && def.phase === "committed"
    ? bodyX(-flungOut, 1.55) : bodyX(-0.55, 1.15);
  const handR = def.commitSide === 1 && def.phase === "committed"
    ? bodyX(flungOut, 1.55) : bodyX(0.55, 1.15);
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

function drawKeeper(ctx: CanvasRenderingContext2D, cam: FpCamera, pos: { x: number; y: number }) {
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  const shirtA = project(cam, pos.x - 0.30, pos.y, 1.00);
  const shirtB = project(cam, pos.x + 0.30, pos.y, 1.55);
  const head = project(cam, pos.x, pos.y, 1.68);
  ctx.beginPath();
  ctx.ellipse(feet.px, feet.py, 0.45 * sc, 0.15 * sc, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  if (shirtA && shirtB) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py), sc * 0.06);
    if (!ctx.roundRect) ctx.rect(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py));
    ctx.fill();
    ctx.strokeStyle = "#92400e";
    ctx.stroke();
  }
  if (head) {
    ctx.beginPath();
    ctx.arc(head.px, head.py, Math.max(1.5, 0.11 * sc), 0, Math.PI * 2);
    ctx.fillStyle = C.skin;
    ctx.fill();
  }
}

function drawTeammate(ctx: CanvasRenderingContext2D, cam: FpCamera, pos: { x: number; y: number }) {
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return;
  const sc = feet.scale;
  const shirtA = project(cam, pos.x - 0.26, pos.y, 1.05);
  const shirtB = project(cam, pos.x + 0.26, pos.y, 1.50);
  const head = project(cam, pos.x, pos.y, 1.62);
  ctx.beginPath();
  ctx.ellipse(feet.px, feet.py, 0.4 * sc, 0.13 * sc, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  if (shirtA && shirtB) {
    ctx.fillStyle = C.mate;
    ctx.beginPath();
    ctx.roundRect?.(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py), sc * 0.06);
    if (!ctx.roundRect) ctx.rect(Math.min(shirtA.px, shirtB.px), Math.min(shirtA.py, shirtB.py),
      Math.abs(shirtB.px - shirtA.px), Math.abs(shirtB.py - shirtA.py));
    ctx.fill();
    ctx.strokeStyle = C.mateRim;
    ctx.stroke();
  }
  if (head) {
    ctx.beginPath();
    ctx.arc(head.px, head.py, Math.max(1.5, 0.11 * sc), 0, Math.PI * 2);
    ctx.fillStyle = C.skin;
    ctx.fill();
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

function drawAimCrosshair(ctx: CanvasRenderingContext2D, cam: FpCamera, target: { x: number; z: number }) {
  const p = project(cam, target.x, 0, target.z);
  if (!p) return;
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = Math.max(1.5, cam.W * 0.006);
  const r = cam.W * 0.022;
  ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.px - r * 1.6, p.py); ctx.lineTo(p.px - r * 0.5, p.py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.px + r * 0.5, p.py); ctx.lineTo(p.px + r * 1.6, p.py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.px, p.py - r * 1.6); ctx.lineTo(p.px, p.py - r * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.px, p.py + r * 0.5); ctx.lineTo(p.px, p.py + r * 1.6); ctx.stroke();
}

export type DuelPip = "pending" | "active" | "beaten" | "won";

function drawHud(ctx: CanvasRenderingContext2D, W: number, H: number, metresToBox: number, pips: DuelPip[]) {
  ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(W * 0.045)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`${Math.max(0, Math.round(metresToBox))}m to the box`, W / 2, H * 0.07);

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

// ── The composed frame ──────────────────────────────────────────────────────

export interface RenderFirstPersonOptions {
  cam: FpCamera;
  defenders: FpDefender[];
  stride: number;
  minX: number;
  maxX: number;
  ball: { x: number; y: number; z: number } | null;
  ballImage?: HTMLImageElement | null;
  keeper?: { x: number; y: number } | null;
  teammate?: { x: number; y: number } | null;
  aimTarget?: { x: number; z: number } | null;
  assist: boolean;
  reducedMotion: boolean;
  hud?: { metresToBox: number; pips: DuelPip[] } | null;
}

export function renderFirstPerson(canvas: HTMLCanvasElement, opts: RenderFirstPersonOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cam = opts.cam;

  drawSky(ctx, W, H, cam.horizon);
  drawGround(ctx, W, H, cam, opts.reducedMotion ? 0 : opts.stride, opts.minX, opts.maxX);
  drawMarkings(ctx, cam, opts.minX, opts.maxX);
  drawGoal(ctx, cam);
  if (opts.keeper) drawKeeper(ctx, cam, opts.keeper);

  for (const def of opts.defenders) drawDefender(ctx, cam, def, opts.assist);
  if (opts.teammate) drawTeammate(ctx, cam, opts.teammate);
  if (opts.ball) drawBall(ctx, cam, opts.ball, opts.ballImage);
  if (opts.aimTarget) drawAimCrosshair(ctx, cam, opts.aimTarget);

  const bob = opts.reducedMotion ? 0 : Math.sin(opts.stride * 1.9);
  drawOwnBody(ctx, W, H, bob);

  if (opts.hud) drawHud(ctx, W, H, opts.hud.metresToBox, opts.hud.pips);
}

export type { DefenderPhase };
