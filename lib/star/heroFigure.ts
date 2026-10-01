/**
 * THE HOME SCREEN'S HERO FIGURE — two looks for Harry to pick between.
 *
 * Harry, 28 Sep 2026: "the avatar being so 2D is also making it look not as
 * good, and it just has no flash to it." Two options, both drawn in code:
 *
 *   A1 "Lit 2D"     — the game's own figure (drawFigureAt, the same man on the
 *                     pitch), lit: a shading pass, a warm key-light rim on one
 *                     side and a club-colour rim on the other.
 *   A2 "Pseudo-3D"  — a new, more solid figure for this one screen: shaded
 *                     limbs, a kit with folds and highlights, a slight 3/4
 *                     turn and the squad number on the shorts. The face is
 *                     still drawn by drawPlayerHead, so it is cropped exactly
 *                     as the Face Editor says.
 *
 * A still picture either way: these functions paint once and are called
 * again only when something changes (the face photo arrives, a celebration
 * starts or ends). There is no animation loop here — breathing and the win
 * hop are CSS on the element (see components/star/HomeFx.tsx).
 */
import { drawPlayerHead } from "./drawPlayerHead";
import type { FittedHead } from "./faceFit";
import type { FaceStyle } from "./faceStyle";
import type { FakeFaceStyle } from "./fakeFaceStyle";

export type AvatarStyle = "A1" | "A2";

// ── Colour helpers ──────────────────────────────────────────────────────────

function rgbOf(c: string): [number, number, number] | null {
  // tint() hands back "rgb(r,g,b)", so a tinted colour can be tinted again.
  const f = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.exec(c.trim());
  if (f) return [Number(f[1]), Number(f[2]), Number(f[3])];
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mix towards white (amt > 0) or black (amt < 0). */
export function tint(c: string, amt: number): string {
  const rgb = rgbOf(c);
  if (!rgb) return c;
  const t = amt > 0 ? 255 : 0, k = Math.abs(amt);
  const [r, g, b] = rgb.map((v) => Math.round(v + (t - v) * k));
  return `rgb(${r},${g},${b})`;
}
export function rgba(c: string, a: number): string {
  const rgb = rgbOf(c);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : c;
}
export function luminance(c: string): number {
  const rgb = rgbOf(c);
  if (!rgb) return 0.5;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

// ── A1: light a figure already painted on its own layer ─────────────────────

/**
 * `layer` holds only the figure (transparent round it). Shades it from the
 * top-left, then composites it onto `dst` with a rim of light on each side:
 * warm white on the key-light side (top right) and the club colour on the
 * other. `d` is the rim thickness in the layer's own pixels.
 */
export function compositeLit(
  dst: CanvasRenderingContext2D, layer: HTMLCanvasElement,
  { rim, d, shade = true }: { rim: string; d: number; shade?: boolean },
): void {
  const w = layer.width, h = layer.height;
  const lctx = layer.getContext("2d");
  if (!lctx) { dst.drawImage(layer, 0, 0); return; }
  // Shading: light falls from the top left, the legs sit in shadow.
  // (A2 already shades itself, so it passes shade: false and only gets rims.)
  if (shade) {
    lctx.save();
    lctx.globalCompositeOperation = "source-atop";
    const g = lctx.createLinearGradient(0, 0, w, h * 0.35);
    g.addColorStop(0, "rgba(255,255,255,0.24)");
    g.addColorStop(0.45, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.34)");
    lctx.fillStyle = g; lctx.fillRect(0, 0, w, h);
    const v = lctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.6, "rgba(0,0,0,0.04)");
    v.addColorStop(1, "rgba(0,0,0,0.32)");
    lctx.fillStyle = v; lctx.fillRect(0, 0, w, h);
    lctx.restore();
  }

  const edge = (ox: number, oy: number, color: string): HTMLCanvasElement | null => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    if (!x) return null;
    x.drawImage(layer, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "destination-out";
    x.drawImage(layer, ox, oy);
    return c;
  };
  // A pixel is on the right-hand edge when the pixel d to its right is empty:
  // draw the figure shifted LEFT by d and cut it out of itself.
  const key = edge(-d, d * 0.5, "rgba(255,244,214,1)");
  const fill = edge(d, d * 0.5, rim);
  // The club-colour rim glows a little outside the figure too, as if the
  // stadium light behind him spills round his edge.
  if (fill) {
    dst.save();
    dst.filter = `blur(${Math.max(2, d)}px)`;
    dst.globalAlpha = 0.9;
    dst.drawImage(fill, -d * 0.6, 0);
    dst.restore();
  }
  dst.drawImage(layer, 0, 0);
  dst.save();
  dst.globalAlpha = 1;
  if (key) dst.drawImage(key, 0, 0);
  dst.globalAlpha = 0.85;
  if (fill) dst.drawImage(fill, 0, 0);
  dst.restore();
}

// ── A2: the volumetric figure ───────────────────────────────────────────────

export interface HeroLook {
  shirt: string;
  shorts: string;
  trim: string;
  skin: string;
  face?: HTMLImageElement;
  number?: number | null;
  /** The face-fit head (faceFit.ts). When set it replaces the pasted photo. */
  fitted?: FittedHead | null;
}

/** Design space: 200 wide, 300 tall, boots on y = 290. */
export const HERO_W = 200, HERO_H = 300;
/** Where the crest sits on the chest, as fractions of the design box. */
/** The empty strip above the raised hands, cropped off by the avatar box. */
export const HERO_TOP = 12;
/** Face fit placement: eyebrows-to-chin height, and where the chin sits. */
export const HERO_FACE_H = 29, HERO_CHIN_Y = 80;
export const HERO_CREST = { x: 119 / HERO_W, y: 112 / HERO_H, size: 17 / HERO_W };

export type P = [number, number];
/** The point a fraction t of the way from a to b. */
export const along = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A limb from a to b, tapering w0 → w1, lit across its width. Shared with
 *  the in-match "3d" figure (figure3d.ts), which draws every player with it. */
export function limb(ctx: CanvasRenderingContext2D, a: P, b: P, w0: number, w1: number, color: string) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const g = ctx.createLinearGradient(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2, a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  // Light from the left: the side whose normal points left is the lit one.
  const litFirst = nx < 0;
  g.addColorStop(0, litFirst ? tint(color, 0.28) : tint(color, -0.32));
  g.addColorStop(0.45, color);
  g.addColorStop(1, litFirst ? tint(color, -0.32) : tint(color, 0.28));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  ctx.arc(b[0], b[1], w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
  ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  ctx.arc(a[0], a[1], w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  ctx.closePath();
  ctx.fill();
}

/**
 * A short sleeve on the upper arm from the shoulder `a` towards the elbow
 * `b`: it covers the first 70% of the upper arm, whatever angle the arm is
 * at, so a raised arm raises its sleeve too. A round cap at the shoulder
 * joins it to the body; the cuff is flat, in the trim colour.
 *
 * `u` scales the fold and cuff line widths: 1 in this file's design space;
 * the in-match "3d" figure (figure3d.ts) passes its own pixels-per-design-unit
 * so a sleeve 20 px long does not get a 3 px cuff.
 */
export function sleeve(ctx: CanvasRenderingContext2D, a: P, b: P, w0: number, w1: number, color: string, trim: string, u = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const e: P = [a[0] + dx * 0.7, a[1] + dy * 0.7];
  const g = ctx.createLinearGradient(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2, a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  const litFirst = nx < 0;
  g.addColorStop(0, litFirst ? tint(color, 0.26) : tint(color, -0.3));
  g.addColorStop(0.45, color);
  g.addColorStop(1, litFirst ? tint(color, -0.3) : tint(color, 0.26));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(a[0], a[1], w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) - Math.PI, true);
  ctx.lineTo(e[0] + nx * w1 / 2, e[1] + ny * w1 / 2);
  ctx.lineTo(e[0] - nx * w1 / 2, e[1] - ny * w1 / 2);
  ctx.closePath();
  ctx.fill();
  // A fold across the sleeve, and the cuff.
  ctx.strokeStyle = rgba(tint(color, -0.55), 0.3); ctx.lineWidth = 1.2 * u; ctx.lineCap = "round";
  const f: P = [a[0] + dx * 0.42, a[1] + dy * 0.42];
  ctx.beginPath(); ctx.moveTo(f[0] + nx * w1 * 0.3, f[1] + ny * w1 * 0.3); ctx.quadraticCurveTo(f[0] + ux * 2 * u, f[1] + uy * 2 * u, f[0] - nx * w1 * 0.25, f[1] - ny * w1 * 0.25); ctx.stroke();
  ctx.strokeStyle = trim; ctx.lineWidth = 3 * u; ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(e[0] + nx * w1 / 2 - ux * 1.4 * u, e[1] + ny * w1 / 2 - uy * 1.4 * u);
  ctx.lineTo(e[0] - nx * w1 / 2 - ux * 1.4 * u, e[1] - ny * w1 / 2 - uy * 1.4 * u);
  ctx.stroke();
}

function boot(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, s: number, stripe: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const g = ctx.createLinearGradient(0, -8, 0, 7);
  g.addColorStop(0, "#3a3f4a"); g.addColorStop(1, "#0b0d12");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.quadraticCurveTo(4, -9, 14, -2);
  ctx.quadraticCurveTo(17, 3, 12, 5);
  ctx.lineTo(-8, 5);
  ctx.quadraticCurveTo(-11, 0, -7, -7);
  ctx.fill();
  ctx.strokeStyle = stripe; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, -3); ctx.quadraticCurveTo(4, -4, 9, 0); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.ellipse(6, -5, 4, 1.3, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(-7, 4, 20, 1.6);
  ctx.restore();
}

/** The soft floor shadow under the A2 figure, in the same design space. */
export function paintHeroShadow(ctx: CanvasRenderingContext2D): void {
  const fs = ctx.createRadialGradient(100, 290, 2, 100, 290, 62);
  fs.addColorStop(0, "rgba(0,0,0,0.55)"); fs.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fs;
  ctx.beginPath(); ctx.ellipse(100, 290, 62, 11, 0, 0, Math.PI * 2); ctx.fill();
}

/**
 * Paint the A2 figure into `ctx`, already scaled so 1 unit = 1 design unit
 * (see HERO_W/HERO_H). `armsUp` is the win celebration.
 */
export function paintHeroFigure(
  ctx: CanvasRenderingContext2D, look: HeroLook,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  { armsUp = false, shadow = true, reach }: {
    armsUp?: boolean; shadow?: boolean;
    /** The far arm held out to (elbow, hand) instead of hanging — the
     *  handshake in the signing scene (SigningScene.tsx). */
    reach?: { elbow: P; hand: P };
  } = {},
): void {
  const { shirt, shorts, trim, skin } = look;
  const sock = shirt;
  const ink = luminance(shorts) > 0.6 ? tint(shirt, -0.2) : "#ffffff";

  if (shadow) paintHeroShadow(ctx);

  // ── Legs (far leg first) ──
  limb(ctx, [117, 206], [121, 244], 19, 14, skin);
  limb(ctx, [121, 244], [123, 276], 14, 10, skin);
  limb(ctx, [121, 247], [123, 276], 15, 11.5, sock);
  ctx.fillStyle = trim; ctx.fillRect(113.5, 247, 15, 3);
  boot(ctx, 125, 281, 1, 0.95, trim);

  limb(ctx, [84, 206], [80, 243], 21, 15, skin);
  limb(ctx, [80, 243], [77, 277], 15, 10.5, skin);
  limb(ctx, [80, 246], [77, 277], 16, 12, sock);
  ctx.fillStyle = trim; ctx.fillRect(71.5, 246, 16.5, 3);
  boot(ctx, 74, 283, -1, 1.05, trim);
  // Knee highlights, so the leg reads as round rather than a strip.
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.ellipse(77, 240, 3, 5, 0, 0, Math.PI * 2); ctx.fill();

  // ── Arms. One skeleton for every pose (shoulder → elbow → hand), so the
  // sleeve always follows the upper arm (Harry, 28 Sep: "the sleeves dont
  // match the avatar" — in the win pose the arms went up and the sleeves
  // stayed pointing down at the shoulders).
  const farSh: P = [140, 96], nearSh: P = [60, 97];
  const farElbow: P = reach ? reach.elbow : armsUp ? [161, 60] : [147, 140];
  const farHand: P = reach ? reach.hand : armsUp ? [171, 25] : [150, 184];
  // Held out, the far arm comes round in front of the body like a raised one.
  const farInFront = armsUp || !!reach;
  const nearElbow: P = armsUp ? [39, 60] : [52, 140];
  const nearHand: P = armsUp ? [29, 25] : [49, 184];
  const farArm = () => {
    limb(ctx, along(farSh, farElbow, 0.35), farElbow, 16, 14, skin); // starts under the sleeve
    limb(ctx, farElbow, farHand, 14, 11, skin);
    ctx.fillStyle = tint(skin, -0.12);
    ctx.beginPath(); ctx.arc(farHand[0], farHand[1] + (armsUp ? -2 : reach ? 0 : 2), 6.5, 0, Math.PI * 2); ctx.fill();
  };
  const nearArm = () => {
    limb(ctx, along(nearSh, nearElbow, 0.35), nearElbow, 17, 15, skin);
    limb(ctx, nearElbow, nearHand, 15, 11.5, skin);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(nearHand[0], nearHand[1] + (armsUp ? -2 : 2), 7.2, 0, Math.PI * 2); ctx.fill();
    if (!armsUp) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath(); ctx.ellipse(46.5, 160, 2, 9, 0.05, 0, Math.PI * 2); ctx.fill();
    }
  };
  // Down, the far arm hangs behind the body.
  if (!farInFront) farArm();

  // ── Shorts ──
  {
    const g = ctx.createLinearGradient(66, 0, 136, 0);
    g.addColorStop(0, tint(shorts, 0.18)); g.addColorStop(0.5, shorts); g.addColorStop(1, tint(shorts, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(71, 164); ctx.lineTo(131, 164);
    ctx.lineTo(136, 208); ctx.quadraticCurveTo(118, 214, 103, 211);
    ctx.lineTo(100, 194); ctx.lineTo(97, 211);
    ctx.quadraticCurveTo(80, 214, 65, 208);
    ctx.closePath(); ctx.fill();
    // Folds and a side stripe.
    ctx.strokeStyle = rgba(tint(shorts, -0.5), 0.35); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(90, 176); ctx.quadraticCurveTo(94, 188, 92, 204); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(112, 178); ctx.quadraticCurveTo(110, 190, 115, 205); ctx.stroke();
    ctx.strokeStyle = shirt; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(69, 172); ctx.lineTo(66.5, 206); ctx.stroke();
    // The squad number, on the near leg.
    if (look.number != null) {
      ctx.save();
      ctx.font = "900 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 2.5; ctx.strokeStyle = rgba("#000000", 0.25);
      ctx.strokeText(String(look.number), 82, 196);
      ctx.fillStyle = ink;
      ctx.fillText(String(look.number), 82, 196);
      ctx.restore();
    }
  }

  // ── Shirt ──
  // The body of the shirt; the sleeves are drawn along the arms (sleeve()).
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(88, 82);
    ctx.lineTo(68, 86);
    ctx.quadraticCurveTo(57, 89, 55, 100);
    ctx.lineTo(66, 118);
    ctx.lineTo(70, 168);
    ctx.quadraticCurveTo(101, 176, 132, 168);
    ctx.lineTo(134, 118);
    ctx.lineTo(145, 99);
    ctx.quadraticCurveTo(143, 89, 133, 86);
    ctx.lineTo(113, 82);
    ctx.quadraticCurveTo(101, 90, 88, 82);
    ctx.closePath();
  };
  {
    const g = ctx.createLinearGradient(44, 70, 156, 120);
    g.addColorStop(0, tint(shirt, 0.3)); g.addColorStop(0.42, shirt); g.addColorStop(1, tint(shirt, -0.38));
    ctx.fillStyle = g; torso(); ctx.fill();
    ctx.save(); torso(); ctx.clip();
    const v = ctx.createLinearGradient(0, 80, 0, 172);
    v.addColorStop(0, "rgba(255,255,255,0.10)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = v; ctx.fillRect(40, 78, 120, 100);
    // Folds: the cloth pulls from the chest to the waist.
    ctx.strokeStyle = rgba(tint(shirt, -0.55), 0.38); ctx.lineCap = "round";
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(78, 124); ctx.quadraticCurveTo(88, 144, 81, 166); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(122, 128); ctx.quadraticCurveTo(113, 148, 121, 166); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(90, 150); ctx.quadraticCurveTo(101, 156, 113, 149); ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(56, 112); ctx.quadraticCurveTo(60, 120, 57, 129); ctx.stroke();
    // Highlight across the near shoulder and chest.
    ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(52, 104); ctx.quadraticCurveTo(58, 90, 76, 87); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.ellipse(86, 112, 13, 18, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Arms first, then the sleeves over the top of the upper arms, in
  // every pose. (Down, the far arm already went on behind the body.)
  if (farInFront) farArm();
  nearArm();
  sleeve(ctx, farSh, farElbow, 21, 16.5, tint(shirt, -0.22), trim);
  sleeve(ctx, nearSh, nearElbow, 23, 19, shirt, trim);

  // ── Neck, head and collar ──
  const fit = look.fitted;
  if (fit) {
    // FACE FIT (faceFit.ts): the photo's head, cut, lit and graded to this
    // body, placed so every photo's chin and face size land in the same spot.
    const k = HERO_FACE_H / fit.faceH;
    const dx = 101 - fit.chinX * k, dy = HERO_CHIN_Y - fit.chinY * k;
    // The back of the collar behind the neck, then the neck in the matched
    // skin, up under the jaw.
    ctx.strokeStyle = tint(trim, -0.25); ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(90, 83); ctx.quadraticCurveTo(101, 77, 112, 83); ctx.stroke();
    limb(ctx, [101, HERO_CHIN_Y - 8], [101, 88], 16, 17, tint(skin, -0.2));
    ctx.drawImage(fit.canvas, dx, dy, fit.canvas.width * k, fit.canvas.height * k);
    // The head's shadow on the top of the neck, then the collar over it.
    const js = ctx.createRadialGradient(101, HERO_CHIN_Y + 1, 1, 101, HERO_CHIN_Y + 1, 10);
    js.addColorStop(0, "rgba(0,0,0,0.30)"); js.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = js;
    ctx.beginPath(); ctx.ellipse(101, HERO_CHIN_Y + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    limb(ctx, [101, 70], [101, 88], 17, 17, skin);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(101, 76, 8.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // The collar's V, over the neck.
  ctx.strokeStyle = trim; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(89, 82); ctx.lineTo(102, 97); ctx.lineTo(113, 82); ctx.stroke();

  if (!fit) {
    // The game's own head, so the face crop matches every other screen.
    // The figure unit r puts the head where render.ts puts it relative to
    // the shoulders (HEAD_ANCHOR − SHOULDER_Y = −0.184 r, base radius 0.114 r).
    const r = 104;
    drawPlayerHead(ctx, 101, 86 - 0.184 * r, 0.114 * r, r, look.face, faceStyle, fakeFaceStyle);
  }
}
