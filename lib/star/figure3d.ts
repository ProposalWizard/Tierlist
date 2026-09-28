/**
 * THE "3D" SKIN FOR EVERY FOOTBALLER ON THE PITCH.
 *
 * The home screen's A2 avatar (heroFigure.ts), adapted to the match's camera.
 * Harry, 28 Sep 2026: "how ambitious is it to reskin the whole game to this
 * 3d skin". The avatar is one big man seen front-on; in a match a player is
 * about 40 px tall, seen from high up and behind, so this is not the avatar
 * shrunk — it is the same ideas at this size:
 *
 *   - shaded limbs, lit from the left with a dark right side (heroFigure's
 *     own `limb`, not a second copy of it)
 *   - a kit with a light and a dark side, folds, a shoulder highlight and a
 *     warm rim of light down its right edge
 *   - socks with a trim band, and boots with a shine on them
 *   - sleeves that follow the arm (heroFigure's `sleeve`)
 *   - a soft shadow rather than a flat disc
 *   - the face-fit head (faceFit.ts) where a photo can be read: cut out, its
 *     skin matched to the arms and legs, lit like the body. A photo that
 *     cannot be read (or while it loads) keeps the ordinary drawPlayerHead.
 *
 * THE SKELETON IS THE CLASSIC ONE. Every joint here — hips, feet, shoulders,
 * hands, where the head sits — is the same arithmetic as paintBody in
 * fiveASide/render.ts, so a 3d man stands, strides, kicks and dives in exactly
 * the classic man's shape, only drawn with more to him. It is a look; the
 * engine never reads any of it.
 *
 * COST. Drawn every frame for every man on the pitch, so it keeps to what is
 * cheap in a 2D canvas: a dozen small gradients and paths per figure, the
 * shadow is one cached sprite, and each fitted head is built once per photo
 * (one new photo per frame at most, so a pitch full of new faces never costs
 * a frame more than one fit) and kept at a few sizes so a 12-pixel head is not
 * squeezed out of a 180-pixel one every frame.
 */
import { drawPlayerHead } from "./drawPlayerHead";
import { fitFace, fitImage, type FittedHead } from "./faceFit";
import type { FaceStyle } from "./faceStyle";
import type { FakeFaceStyle } from "./fakeFaceStyle";
import { limb, sleeve, tint, rgba, along, luminance, type P } from "./heroFigure";

/** The anatomy paintBody uses, handed in so both skins share one skeleton. */
export interface Anatomy {
  FEET_Y: number;
  HIP_Y: number;
  SHOULDER_Y: number;
  NECK_Y: number;
  HEAD_BASE_R: number;
  HEAD_ANCHOR: number;
}

/** The subset of BodyPose this reads (the same fields paintBody does). */
export interface Pose3d {
  armSpread?: number;
  armLift?: number;
  gloves?: boolean;
  crouch?: number;
  legSwing?: number;
  kick?: number;
  armLead?: number;
}

export interface Look3d {
  shirt: string;
  shorts: string;
  trim: string;
  skin?: string;
  face?: HTMLImageElement;
  /** Who this is, for his drawn hair when there is no photo to show. */
  id?: string;
  label?: string;
}

/** Tunables for a by-eye pass, kept together. */
export const FIG3D = {
  /** Face fit: eyebrows-to-chin as a share of r, and how far above the
   *  classic neck line the chin sits. */
  faceH: 0.27,
  chinAboveNeck: 0.0,
  /** Soft shadow: how much wider/longer than the classic flat one. */
  shadowGrow: 1.25,
  shadowAlpha: 0.5,
  /** Rim light down the right edge of the shirt. */
  rim: "rgba(255,240,205,0.75)",
};

// ── Cached pieces ───────────────────────────────────────────────────────────

let shadowSprite: HTMLCanvasElement | null = null;
/** One soft shadow, drawn once and scaled for every man. */
function softShadow(): HTMLCanvasElement | null {
  if (shadowSprite) return shadowSprite;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(0,0,0,1)");
  rg.addColorStop(0.45, "rgba(0,0,0,0.75)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  shadowSprite = c;
  return c;
}

/** The soft ground shadow, centred on the boots at (x, groundY). */
export function drawSoftShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, rx: number, ry: number): void {
  const s = softShadow();
  if (!s) return;
  const w = rx * FIG3D.shadowGrow, h = ry * FIG3D.shadowGrow * 1.1;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * FIG3D.shadowAlpha;
  ctx.drawImage(s, x - w, groundY - h, w * 2, h * 2);
  ctx.globalAlpha = a;
}

export interface Fit3d { fit: FittedHead; mips: HTMLCanvasElement[] }
const fits = new Map<string, Fit3d | null>();
const queued = new Set<string>();
const queue: string[] = [];
let pumping = false;
/** How big a photo is shrunk to before it is fitted (see fitFace). */
const FIT_MAX_SIDE = 260;

/** Halve a canvas (a smoother small copy than one big downscale per frame). */
function halve(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const w = Math.max(4, Math.round(c.width / 2)), h = Math.max(4, Math.round(c.height / 2));
  const o = document.createElement("canvas");
  o.width = w; o.height = h;
  const g = o.getContext("2d");
  if (!g) return null;
  g.imageSmoothingQuality = "high";
  g.drawImage(c, 0, 0, w, h);
  return o;
}

/**
 * Fit the queued photos one at a time, BETWEEN frames (when the browser is
 * idle), never inside a frame — a fit is pixel work, and doing it in the
 * draw loop showed up as a stutter every time a new face came on screen.
 */
function pump(): void {
  if (pumping) return;
  pumping = true;
  const later = (f: () => void) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 1000 }); else window.setTimeout(f, 30);
  };
  const store = (url: string, fit: FittedHead | null) => {
    if (fit) {
      const mips: HTMLCanvasElement[] = [fit.canvas];
      let c: HTMLCanvasElement | null = fit.canvas;
      while (c && c.height > 24) { c = halve(c); if (c) mips.push(c); }
      fits.set(url, { fit, mips });
    } else {
      fits.set(url, null); // cannot be read (no CORS): the pasted photo it is
    }
    queued.delete(url);
  };
  const step = () => {
    const url = queue.shift();
    if (url === undefined) { pumping = false; return; }
    // Decode and shrink the photo OFF the main thread (a big photo's decode
    // was most of a fit's cost: ~66 ms a face at 4× slow-down, one dropped
    // frame each), then fit the small copy between frames.
    const decoded: Promise<ImageBitmap | null> = typeof createImageBitmap === "function"
      ? fetch(url, { mode: "cors" }).then((r) => (r.ok ? r.blob() : null))
        .then((b) => (b ? createImageBitmap(b, { resizeHeight: FIT_MAX_SIDE, resizeQuality: "medium" }) : null))
        .catch(() => null)
      : Promise.resolve(null);
    decoded.then((bmp) => {
      later(() => {
        if (bmp) { store(url, fitFace(bmp, FIT_MAX_SIDE)); bmp.close(); }
        else {
          // No off-thread decode: the readable <img> copy, as before.
          const img = fitImage(url);
          if (img.complete && img.naturalWidth) store(url, fitFace(img, FIT_MAX_SIDE));
          else if (img.complete) store(url, null);
          else queue.push(url);
        }
        if (queue.length) later(step); else pumping = false;
      });
    });
  };
  later(step);
}

/**
 * The fitted head for this photo, or null while it is being fitted (or if it
 * cannot be). Cheap every frame: the first ask only queues the photo.
 */
export function fittedHeadFor(face: HTMLImageElement | undefined): Fit3d | null {
  if (!face || typeof document === "undefined") return null;
  const url = face.src;
  if (!url) return null;
  const hit = fits.get(url);
  if (hit !== undefined) return hit;
  if (!queued.has(url)) {
    queued.add(url);
    queue.push(url);
    pump();
  }
  return null;
}

/** The smallest cached copy that is still at least `px` device pixels tall. */
export function mipFor(f: Fit3d, px: number): HTMLCanvasElement {
  let best = f.mips[0];
  for (const m of f.mips) if (m.height >= px) best = m;
  return best;
}

// ── A drawn head, with hair ─────────────────────────────────────────────────
//
// Harry, 28 Sep 2026: "we need to try and recreate hair somehow, everyone
// can't be bald". A photo brings its own hair. Wherever there is no photo to
// show — faces switched off, a photo still loading, a man with none — the 3d
// skin draws a head in the A2 style with a hair piece, picked once per player
// (hashed from who he is, like fakeFaceFor) so it never changes frame to frame.

export type HairStyle = "short" | "curly" | "long" | "buzz" | "quiff";
const HAIR_STYLES: HairStyle[] = ["short", "curly", "short", "long", "buzz", "quiff", "curly", "short"];
const HAIR_COLOURS = ["#17110d", "#2b1b12", "#3d2616", "#5a3a22", "#7a4e2c", "#b88a4a", "#d7b26a", "#9c4a22", "#101010"];

function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  // Mix the bits, so "p1" and "p2" do not land on the same hair.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const SKIN_TONES = ["#f1c7a5", "#e0ac86", "#c68642", "#a8703f", "#8d5524", "#6b3e1f", "#d9a077"];
/** A skin tone for a man with no photo to take one from — stable per player. */
export function skinFor(key: string): string {
  return SKIN_TONES[(hashKey(key) >>> 16) % SKIN_TONES.length];
}

/** This player's hair, the same every time he is drawn. */
export function hairFor(key: string): { style: HairStyle; colour: string } {
  const h = hashKey(key);
  return { style: HAIR_STYLES[h % HAIR_STYLES.length], colour: HAIR_COLOURS[(h >>> 8) % HAIR_COLOURS.length] };
}

/**
 * A head in the A2 style, chin at (cx, chinY), `faceH` from eyebrows to chin
 * (the same size a fitted photo head is drawn at). `back` draws him from
 * behind (your own man in the chase camera): all hair, no face.
 */
export function drawStyledHead(
  ctx: CanvasRenderingContext2D, cx: number, chinY: number, faceH: number,
  skin: string, key: string, back = false,
): void {
  const picked = hairFor(key);
  const style = picked.style;
  // Hair must read as hair at 12 px: a buzz cut, or a colour close to the
  // skin (blond on fair skin), is taken darker, or he reads as bald.
  const close = Math.abs(luminance(picked.colour) - luminance(skin)) < 0.22;
  const colour = style === "buzz" || close ? tint(picked.colour, -0.45) : picked.colour;
  const rx = faceH * 0.68, ry = faceH * 0.93;
  const cy = chinY - ry;
  const hairLit = tint(colour, 0.28), hairDark = tint(colour, -0.35);

  // Long hair hangs behind the head and neck.
  if (style === "long") {
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, hairLit); g.addColorStop(0.5, colour); g.addColorStop(1, hairDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.08, cy - ry * 0.1);
    ctx.quadraticCurveTo(cx - rx * 1.2, chinY + ry * 0.35, cx - rx * 0.55, chinY + ry * 0.42);
    ctx.lineTo(cx + rx * 0.55, chinY + ry * 0.42);
    ctx.quadraticCurveTo(cx + rx * 1.2, chinY + ry * 0.35, cx + rx * 1.08, cy - ry * 0.1);
    ctx.closePath(); ctx.fill();
  }

  // Ears, then the face: lit from the left like the body.
  ctx.fillStyle = tint(skin, -0.12);
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.97, cy + ry * 0.12, rx * 0.17, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + rx * 0.97, cy + ry * 0.12, rx * 0.17, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  const fg = ctx.createLinearGradient(cx - rx, cy - ry * 0.3, cx + rx, cy + ry * 0.3);
  fg.addColorStop(0, tint(skin, 0.16)); fg.addColorStop(0.5, skin); fg.addColorStop(1, tint(skin, -0.26));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(cx, chinY);
  ctx.bezierCurveTo(cx - rx * 0.75, chinY, cx - rx, cy + ry * 0.45, cx - rx, cy);
  ctx.bezierCurveTo(cx - rx, cy - ry * 0.62, cx - rx * 0.55, cy - ry, cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.55, cy - ry, cx + rx, cy - ry * 0.62, cx + rx, cy);
  ctx.bezierCurveTo(cx + rx, cy + ry * 0.45, cx + rx * 0.75, chinY, cx, chinY);
  ctx.closePath(); ctx.fill();

  if (!back) {
    // Brows, eyes, a nose shadow and a mouth — enough to read as a face.
    const eyeY = cy + ry * 0.12, ex = rx * 0.38;
    ctx.fillStyle = "#1a1210";
    ctx.beginPath(); ctx.ellipse(cx - ex, eyeY, rx * 0.1, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + ex, eyeY, rx * 0.1, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hairDark; ctx.lineCap = "round"; ctx.lineWidth = Math.max(0.6, ry * 0.07);
    ctx.beginPath(); ctx.moveTo(cx - ex - rx * 0.16, eyeY - ry * 0.16); ctx.lineTo(cx - ex + rx * 0.14, eyeY - ry * 0.19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + ex - rx * 0.14, eyeY - ry * 0.19); ctx.lineTo(cx + ex + rx * 0.16, eyeY - ry * 0.16); ctx.stroke();
    ctx.fillStyle = rgba(tint(skin, -0.5), 0.35);
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.06, eyeY + ry * 0.3, rx * 0.08, ry * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(tint(skin, -0.55), 0.55); ctx.lineWidth = Math.max(0.5, ry * 0.05);
    ctx.beginPath(); ctx.moveTo(cx - rx * 0.2, eyeY + ry * 0.58); ctx.quadraticCurveTo(cx, eyeY + ry * 0.64, cx + rx * 0.2, eyeY + ry * 0.58); ctx.stroke();
  }

  // The hair piece.
  const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy);
  hg.addColorStop(0, hairLit); hg.addColorStop(0.5, colour); hg.addColorStop(1, hairDark);
  ctx.fillStyle = hg;
  // How far down the forehead the hairline comes (fraction of ry above cy).
  const line = style === "buzz" ? 0.62 : style === "quiff" ? 0.5 : 0.42;
  const top = style === "quiff" ? 1.24 : style === "curly" ? 1.12 : style === "buzz" ? 1.01 : 1.07;
  const alpha = ctx.globalAlpha;
  if (style === "buzz") ctx.globalAlpha = alpha * 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.02, cy + ry * (back ? 0.55 : 0.05));
  ctx.bezierCurveTo(cx - rx * 1.06, cy - ry * 0.8, cx - rx * 0.6, cy - ry * top, cx, cy - ry * top);
  ctx.bezierCurveTo(cx + rx * 0.6, cy - ry * top, cx + rx * 1.06, cy - ry * 0.8, cx + rx * 1.02, cy + ry * (back ? 0.55 : 0.05));
  if (back) {
    ctx.quadraticCurveTo(cx, cy + ry * 0.75, cx - rx * 1.02, cy + ry * 0.55);
  } else {
    ctx.quadraticCurveTo(cx + rx * 0.7, cy - ry * line, cx + rx * 0.2, cy - ry * line);
    ctx.quadraticCurveTo(cx - rx * 0.25, cy - ry * (line - 0.08), cx - rx * 0.75, cy - ry * (line - 0.1));
    ctx.quadraticCurveTo(cx - rx * 0.95, cy - ry * 0.15, cx - rx * 1.02, cy + ry * 0.05);
  }
  ctx.closePath(); ctx.fill();
  if (style === "curly") {
    // A ring of curls round the crown.
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI * (1.17 + i * 0.132);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.95, rx * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = alpha;
  // A shine on the lit side.
  ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = Math.max(0.6, ry * 0.08); ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx - rx * 0.1, cy - ry * 0.1, ry * 0.78, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
}

// ── The figure ──────────────────────────────────────────────────────────────

type HeadMode = "fit" | "photo" | "drawn";

/**
 * One footballer in LOCAL coordinates, origin at the body origin and −y up —
 * a drop-in for paintBody (fiveASide/render.ts), same arguments, same joints.
 *
 * DRAWN ONCE, THEN REUSED. A figure's body (kit, limbs, collar, and a drawn
 * head) only changes with his kit, his skin, his size and his pose, so it is
 * painted once into a small picture per (kit, skin, size, pose step) and later
 * frames stamp that picture. Measured on the real match at phone size (4×
 * CPU slow-down): drawn afresh every frame, the bodies cost ~210 gradients a
 * frame and 3d frames were 30-45% slower than classic. A photo head goes on
 * top every frame (it is already a picture).
 */
export function paintBody3d(
  ctx: CanvasRenderingContext2D, r: number, look: Look3d,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  pose: Pose3d | undefined, A: Anatomy, fallbackSkin: string,
): void {
  const photoShown = faceStyle.facesEnabled && !!look.face && look.face.complete && look.face.naturalWidth > 0;
  const fitted = photoShown ? fittedHeadFor(look.face) : null;
  // A drawn head (no photo to show) gets its own skin tone too, so a squad
  // with no photos is not eleven of the same man.
  const hk = headKey(look);
  const skin = fitted?.fit.skin ?? (photoShown ? look.skin ?? fallbackSkin : skinFor(hk));
  const mode: HeadMode = fitted ? "fit" : photoShown ? "photo" : "drawn";

  // The pose in small steps (what makes a picture reusable; a step is under
  // a frame's worth of movement, so the run cycle still reads smooth).
  const q = (v: number | undefined, d: number, st: number) => Math.round((v ?? d) / st) * st;
  const qp: Pose3d = {
    armSpread: q(pose?.armSpread, 0, 0.05), armLift: q(pose?.armLift, -0.55, 0.05),
    crouch: q(pose?.crouch, 0, 0.05), legSwing: q(pose?.legSwing, 0, 0.125), kick: q(pose?.kick, 0, 0.25),
    armLead: Math.sign(pose?.armLead ?? 0), gloves: !!pose?.gloves,
  };
  const t = ctx.getTransform();
  const k = Math.hypot(t.a, t.b) || 1; // device pixels per local unit
  const rDev = r * k;
  if (rDev <= 160 && typeof document !== "undefined") {
    // Size in 2-device-pixel steps, then stamp the cached picture scaled to r.
    const rq = Math.max(2, Math.round(rDev / 2) * 2) / k;
    const key = [look.shirt, look.shorts, look.trim, skin, mode, mode === "drawn" ? hk : "",
      qp.armSpread, qp.armLift, qp.crouch, qp.legSwing, qp.kick, qp.armLead, qp.gloves ? 1 : 0, Math.round(rq * k)].join("|");
    let sp = sprites.get(key);
    if (sp) { sprites.delete(key); sprites.set(key, sp); }
    else {
      const ox = SPRITE_X * rq, oy = SPRITE_UP * rq;
      const c = document.createElement("canvas");
      c.width = Math.ceil(2 * ox * k); c.height = Math.ceil((SPRITE_UP + SPRITE_DOWN) * rq * k);
      const g = c.getContext("2d");
      if (g) {
        g.setTransform(k, 0, 0, k, ox * k, oy * k);
        drawBody3d(g, rq, look, skin, qp, A, mode, hk);
      }
      sp = { c, ox, oy };
      sprites.set(key, sp);
      if (sprites.size > SPRITE_LIMIT) sprites.delete(sprites.keys().next().value as string);
    }
    const f = r / rq;
    ctx.drawImage(sp.c, -sp.ox * f, -sp.oy * f, (sp.c.width / k) * f, (sp.c.height / k) * f);
  } else {
    drawBody3d(ctx, r, look, skin, qp, A, mode, hk);
  }

  // ── The photo head, on top, every frame ──
  const sink = (qp.crouch ?? 0) * r * 0.16;
  const neckY = A.NECK_Y * r + sink;
  if (fitted) {
    const chinY = neckY - FIG3D.chinAboveNeck * r;
    const kk = (FIG3D.faceH * r) / fitted.fit.faceH;
    const hw = fitted.fit.canvas.width * kk, hh = fitted.fit.canvas.height * kk;
    const img = mipFor(fitted, hh * k);
    ctx.drawImage(img, -fitted.fit.chinX * kk, chinY - fitted.fit.chinY * kk, hw, hh);
  } else if (photoShown) {
    // A photo that cannot be fitted (or not yet): pasted as ever — it
    // brings its own hair.
    drawPlayerHead(ctx, 0, A.HEAD_ANCHOR * r + sink, A.HEAD_BASE_R * r, r, look.face, faceStyle, fakeFaceStyle);
  }
}

/** The cached body pictures: most recently used last. */
const sprites = new Map<string, { c: HTMLCanvasElement; ox: number; oy: number }>();
const SPRITE_LIMIT = 320;
/** A body's picture box, in r: half-width (arms flung wide, gloves), above
 *  the body origin (hands over the head, a drawn head's hair), below it (boots). */
const SPRITE_X = 1.5, SPRITE_UP = 1.75, SPRITE_DOWN = 0.5;

/** Everything but a photo head: kit, limbs, collar, neck, and a drawn head. */
function drawBody3d(
  ctx: CanvasRenderingContext2D, r: number, look: Look3d, skin: string,
  pose: Pose3d, A: Anatomy, mode: HeadMode, hk: string,
): void {
  const { shirt, shorts, trim } = look;
  const sock = shirt;
  const u = r / 107; // heroFigure design units → pixels (its shoulders are 90 wide; ours 0.84 r)

  const spread = pose?.armSpread ?? 0;
  const lift = pose?.armLift ?? -0.55;
  const crouch = pose?.crouch ?? 0;
  const swing = pose?.legSwing ?? 0;
  const kick = pose?.kick ?? 0;
  const sink = crouch * r * 0.16;
  const stride = (swing * 0.42 + kick * 0.55) * r;
  const footRise = Math.abs(stride) * 0.15;
  const footY = A.FEET_Y * r - footRise;
  const footL = -r * 0.19 - stride * 0.35;
  const footR = r * 0.19 + stride * 0.35;
  const hipY = A.HIP_Y * r + sink;

  // ── Legs: thigh, shin, sock with a trim band, boot ──
  for (const [hx, fx] of [[-r * 0.16, footL], [r * 0.16, footR]] as const) {
    const hip: P = [hx, hipY];
    const ankle: P = [fx, footY - r * 0.07];
    // A little outward bend at the knee, so a leg is two pieces, not a pole.
    const knee: P = [(hx + fx) / 2 + Math.sign(hx) * r * 0.025, (hipY + ankle[1]) / 2];
    limb(ctx, hip, knee, r * 0.2, r * 0.155, skin);
    limb(ctx, knee, ankle, r * 0.155, r * 0.11, skin);
    const sockTop = along(knee, ankle, 0.22);
    limb(ctx, sockTop, ankle, r * 0.165, r * 0.125, sock);
    ctx.strokeStyle = trim; ctx.lineWidth = Math.max(0.8, r * 0.035); ctx.lineCap = "butt";
    const dx = ankle[0] - knee[0], dy = ankle[1] - knee[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, w = r * 0.085;
    ctx.beginPath();
    ctx.moveTo(sockTop[0] + nx * w, sockTop[1] + ny * w);
    ctx.lineTo(sockTop[0] - nx * w, sockTop[1] - ny * w);
    ctx.stroke();
    // Boot: dark, with a shine on the toe and a trim flash.
    const bx = fx, by = footY;
    const bg = ctx.createLinearGradient(bx, by - r * 0.08, bx, by + r * 0.07);
    bg.addColorStop(0, "#474d5a"); bg.addColorStop(1, "#07090d");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(bx, by, r * 0.12, r * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath(); ctx.ellipse(bx - r * 0.035, by - r * 0.03, r * 0.045, r * 0.017, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = Math.max(0.6, r * 0.022); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx - r * 0.06, by + r * 0.01); ctx.lineTo(bx + r * 0.06, by + r * 0.01); ctx.stroke();
  }

  // ── Shorts: lit left, dark right, a split between the legs and a fold ──
  {
    const top = (A.HIP_Y - 0.10) * r + sink, h = r * 0.31;
    const g = ctx.createLinearGradient(-r * 0.33, 0, r * 0.33, 0);
    g.addColorStop(0, tint(shorts, 0.2)); g.addColorStop(0.5, shorts); g.addColorStop(1, tint(shorts, -0.32));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, top);
    ctx.lineTo(r * 0.3, top);
    ctx.lineTo(r * 0.34, top + h);
    ctx.quadraticCurveTo(r * 0.17, top + h * 1.07, r * 0.03, top + h);
    ctx.lineTo(0, top + h * 0.62);
    ctx.lineTo(-r * 0.03, top + h);
    ctx.quadraticCurveTo(-r * 0.17, top + h * 1.07, -r * 0.34, top + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(tint(shorts, -0.55), 0.4); ctx.lineWidth = Math.max(0.6, r * 0.025); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-r * 0.13, top + h * 0.25); ctx.quadraticCurveTo(-r * 0.1, top + h * 0.6, -r * 0.13, top + h * 0.95); ctx.stroke();
    ctx.strokeStyle = sock; ctx.lineWidth = Math.max(0.7, r * 0.035);
    ctx.beginPath(); ctx.moveTo(-r * 0.3, top + h * 0.1); ctx.lineTo(-r * 0.33, top + h * 0.92); ctx.stroke();
  }

  // ── Arms (behind the shirt), then the shirt, then sleeves over the top ──
  const shY = A.SHOULDER_Y * r + sink, waistY = (A.HIP_Y - 0.04) * r + sink;
  const shW = r * 0.42, waistW = r * 0.29;
  const armFromY = shY + r * 0.02;
  const armLen = r * (0.42 + spread * 0.5);
  const outX = r * 0.3 + armLen * (0.35 + spread * 0.65);
  const handY = armFromY + armLen * (0.62 - lift * 0.85) * (1 - spread * 0.45);
  const handYFor = (s: number) => handY - s * swing * r * 0.22;
  const lead = pose?.armLead ?? 0;
  const handXFor = (s: number) => s * outX * (lead === 0 || Math.sign(s) === Math.sign(lead) ? 1 : 0.62);
  const arm = (s: number) => {
    const sh: P = [s * shW * 0.82, armFromY];
    const hand: P = [handXFor(s), handYFor(s)];
    const elbow: P = [(sh[0] + hand[0]) / 2 + s * r * 0.035, (sh[1] + hand[1]) / 2];
    return { sh, elbow, hand };
  };
  const arms = [arm(-1), arm(1)];
  for (const { sh, elbow, hand } of arms) {
    limb(ctx, along(sh, elbow, 0.3), elbow, r * 0.13, r * 0.115, skin);
    limb(ctx, elbow, hand, r * 0.115, r * 0.09, skin);
    if (!pose?.gloves) {
      ctx.fillStyle = tint(skin, -0.12);
      ctx.beginPath(); ctx.arc(hand[0], hand[1], r * 0.065, 0, Math.PI * 2); ctx.fill();
    }
  }

  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(-waistW, waistY);
    ctx.lineTo(-shW, shY + r * 0.1);
    ctx.quadraticCurveTo(-shW, shY - r * 0.04, -shW * 0.6, shY - r * 0.07);
    ctx.lineTo(shW * 0.6, shY - r * 0.07);
    ctx.quadraticCurveTo(shW, shY - r * 0.04, shW, shY + r * 0.1);
    ctx.lineTo(waistW, waistY);
    ctx.closePath();
  };
  {
    const g = ctx.createLinearGradient(-shW, shY, shW, waistY);
    g.addColorStop(0, tint(shirt, 0.32)); g.addColorStop(0.45, shirt); g.addColorStop(1, tint(shirt, -0.4));
    ctx.fillStyle = g; torso(); ctx.fill();
    ctx.save(); torso(); ctx.clip();
    const v = ctx.createLinearGradient(0, shY, 0, waistY);
    v.addColorStop(0, "rgba(255,255,255,0.10)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = v; ctx.fillRect(-shW, shY - r * 0.1, shW * 2, waistY - shY + r * 0.2);
    // Folds: cloth pulling from the shoulder blades to the waist.
    ctx.strokeStyle = rgba(tint(shirt, -0.55), 0.42); ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.6, r * 0.028);
    ctx.beginPath(); ctx.moveTo(-r * 0.2, shY + r * 0.2); ctx.quadraticCurveTo(-r * 0.1, shY + r * 0.42, -r * 0.17, waistY - r * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.22, shY + r * 0.24); ctx.quadraticCurveTo(r * 0.12, shY + r * 0.44, r * 0.19, waistY - r * 0.02); ctx.stroke();
    // Highlight across the lit shoulder.
    ctx.strokeStyle = "rgba(255,255,255,0.34)"; ctx.lineWidth = Math.max(0.8, r * 0.04);
    ctx.beginPath(); ctx.moveTo(-shW * 0.95, shY + r * 0.08); ctx.quadraticCurveTo(-shW * 0.85, shY - r * 0.04, -shW * 0.35, shY - r * 0.05); ctx.stroke();
    // Rim light down the right-hand edge (the stadium light behind him).
    ctx.strokeStyle = FIG3D.rim; ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.beginPath(); ctx.moveTo(shW * 0.98, shY + r * 0.1); ctx.lineTo(waistW * 0.98, waistY); ctx.stroke();
    ctx.restore();
    // A thin dark edge so the shape holds against the grass.
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = Math.max(0.6, r * 0.03); ctx.lineJoin = "round";
    torso(); ctx.stroke();
  }

  // Sleeves over the upper arms; the dark side's a shade darker.
  arms.forEach(({ sh, elbow }, i) => {
    sleeve(ctx, sh, elbow, r * 0.19, r * 0.155, i === 0 ? shirt : tint(shirt, -0.2), trim, u);
  });

  if (pose?.gloves) {
    for (const { hand } of arms) {
      const gg = ctx.createRadialGradient(hand[0] - r * 0.05, hand[1] - r * 0.05, r * 0.02, hand[0], hand[1], r * 0.15);
      gg.addColorStop(0, "#ffffff"); gg.addColorStop(1, "#b8c2d0");
      ctx.fillStyle = gg;
      ctx.strokeStyle = trim; ctx.lineWidth = Math.max(0.8, r * 0.04);
      ctx.beginPath(); ctx.arc(hand[0], hand[1], r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // ── Collar and neck (the head: a drawn one here, a photo on top) ──
  // The collar goes on first, as a band across the top of the shirt; the neck
  // then covers its middle, so what shows is trim either side of the neck — a
  // collar, not a ring round the throat.
  const neckY = A.NECK_Y * r + sink;
  ctx.strokeStyle = trim; ctx.lineWidth = Math.max(0.8, r * 0.05); ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, neckY + r * 0.035);
  ctx.quadraticCurveTo(0, neckY + r * 0.1, r * 0.15, neckY + r * 0.035);
  ctx.stroke();
  if (mode === "fit") {
    const chinY = neckY - FIG3D.chinAboveNeck * r;
    limb(ctx, [0, chinY], [0, neckY + r * 0.06], r * 0.14, r * 0.16, tint(skin, -0.22));
  } else if (mode === "drawn") {
    // No photo to show: a drawn head with this player's own hair.
    limb(ctx, [0, neckY - r * 0.02], [0, neckY + r * 0.06], r * 0.14, r * 0.16, tint(skin, -0.22));
    drawStyledHead(ctx, 0, neckY - FIG3D.chinAboveNeck * r, FIG3D.faceH * r, skin, hk);
  }
}

/** Who a figure is, for his hair: his own id, else his photo's address (known
 *  before it loads), else his name, else his kit. */
export function headKey(look: Look3d): string {
  return look.id ?? look.face?.src ?? look.label ?? `${look.shirt}${look.trim}`;
}
