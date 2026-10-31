/**
 * COLD EDITS — THE DRAWING (Leo's switch part "coldEdits"; the cuts are
 * editCold.ts). One frame: the same scene as every goal video (render.ts
 * drawScene, the recording from the shot's camera), moved by the beat (zoom
 * punch, shake), then graded and dressed the edit pages' way:
 *  - the grade: grey with the scorer's kit colour kept, contrast, a tint;
 *    an RGB split on the big hits (one pixel pass);
 *  - glow on the bright parts (aura), film grain, dark corners;
 *  - letterbox bars with the account and the match in small spaced capitals;
 *  - the freeze call-out: the picture dimmed round the scorer, a ring on him;
 *  - the tape look on a rewind (scan lines, a tracking band, ◀◀);
 *  - captions in the edit's own type, cards (stat card a row a beat, titles);
 *  - flashes on the beat.
 * Everything is read from the edit (look, hits, shot.fx.cold) and the time:
 * the same frame every time. Grain is seeded by the frame number.
 */
import { project } from "../firstPersonView";
import { rigFor } from "./cameras";
import { frameAt, type GoalTrack } from "./track";
import { momentAt, shotLength, type Edit, type EditMoment } from "./edit";
import { viewAt, anchorOf, applyView, type View } from "./betterView";
import { drawScene, roundRect, teamCode, FONT, type ClipCredit } from "./render";
import { scorerShirt, type EditLook, type BeatHit } from "./editCold";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

type Any2D = CanvasRenderingContext2D;
type Scratch = { c: HTMLCanvasElement | OffscreenCanvas; g: Any2D };
const scratches = new Map<string, Scratch>();
function scratch(name: string, w: number, h: number): Scratch | null {
  const key = `${name}|${w}x${h}`;
  const hit = scratches.get(key);
  if (hit) return hit;
  let c: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") c = new OffscreenCanvas(w, h);
  else if (typeof document !== "undefined") { const e = document.createElement("canvas"); e.width = w; e.height = h; c = e; }
  else return null;
  const g = c.getContext("2d") as unknown as Any2D | null;
  if (!g) return null;
  const s = { c, g };
  scratches.set(key, s);
  return s;
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The beat hits' pull at video time `t`: shake (px), punch (zoom), rgb (px), flash (0..1). */
export function hitsAt(hits: BeatHit[] | undefined, t: number, W: number): { sx: number; sy: number; punch: number; rgb: number; flash: number } {
  let sx = 0, sy = 0, punch = 1, rgb = 0, flash = 0;
  for (const h of hits ?? []) {
    const d = t - h.at;
    if (d < -1e-4 || d > 0.6) continue;
    const dd = Math.max(0, d);
    if (h.kind === "shake") {
      const amp = W * 0.03 * h.k * Math.exp(-dd * 11);
      const ph = h.at * 7.13;
      sx += amp * Math.sin(dd * 62 + ph);
      sy += amp * 0.8 * Math.sin(dd * 51 + ph * 1.7 + 1);
    } else if (h.kind === "punch") punch *= 1 + 0.12 * h.k * Math.exp(-dd * 9);
    else if (h.kind === "rgb") rgb += W * 0.022 * h.k * Math.exp(-dd * 8);
    else flash = Math.max(flash, h.k * Math.exp(-dd * 11));
  }
  return { sx, sy, punch, rgb, flash };
}

/** The framing at one moment: the better videos' zoom, then the beat's punch and shake. */
export function coldViewAt(edit: Edit, m: EditMoment, outT: number): View {
  const base = viewAt(edit, m);
  const h = hitsAt(edit.hits, outT, edit.w);
  if (h.punch === 1 && !h.sx && !h.sy) return base;
  const shot = edit.shots[m.shot];
  const track = edit.tracks[shot.track];
  const a = base.k !== 1 || base.dx || base.dy ? { x: base.ax, y: base.ay } : anchorOf(track, shot, m.t, edit.w, edit.h);
  let k = base.k * h.punch;
  // A shaking picture is made just big enough that its edges never show.
  if (h.sx || h.sy) {
    const room = Math.min(a.x, edit.w - a.x, a.y, edit.h - a.y);
    k = Math.max(k, Math.min(1.4, 1 + (Math.hypot(h.sx, h.sy) + 2) / Math.max(1, room)));
  }
  return { k, ax: a.x, ay: a.y, dx: base.dx + h.sx, dy: base.dy + h.sy };
}

/** Where the scorer is on the picture (or the ball), and how big a ring round him is. */
export function scorerOnScreen(edit: Edit, m: EditMoment, v: View): { x: number; y: number; r: number } | null {
  const shot = edit.shots[m.shot];
  const track = edit.tracks[shot?.track ?? 0];
  if (!shot || !track) return null;
  const rig = rigFor(track, shot.angle, m.t, edit.w, edit.h);
  const fr = frameAt(track, m.t);
  const i = track.bodies.findIndex(b => b.id === track.meta.scorerBody);
  const at = i >= 0 ? fr.bodies[i] : fr.ball;
  const p = project(rig.cam, at.x, at.y, i >= 0 ? 0.95 : at.z);
  if (!p) return null;
  const q = applyView(v, p.px, p.py);
  return { x: q.x, y: q.y, r: Math.max(edit.w * 0.06, Math.min(edit.w * 0.3, p.scale * 1.5 * v.k)) };
}

export function drawColdFrame(ctx: Any2D, edit: Edit, outT: number, credit?: ClipCredit, moment?: EditMoment): void {
  const W = edit.w, H = edit.h;
  const m = moment ?? momentAt(edit, outT);
  const shot = edit.shots[m.shot];
  const track = edit.tracks[shot?.track ?? 0];
  if (!shot || !track) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); return; }
  const look = edit.look!;
  const cfx = shot.fx?.cold ?? {};
  const v = coldViewAt(edit, m, outT);
  ctx.save();
  if (v.k !== 1 || v.dx || v.dy) {
    ctx.translate(v.ax + v.dx, v.ay + v.dy);
    ctx.scale(v.k, v.k);
    ctx.translate(-v.ax, -v.ay);
  }
  drawScene(ctx, W, H, track, shot.angle, m.t, edit.moves);
  ctx.restore();

  const hit = hitsAt(edit.hits, outT, W);
  grade(ctx, W, H, look, hit.rgb + (cfx.vhs ? W * 0.008 : 0));
  if (look.glow > 0) drawGlow(ctx, W, H, look.glow);
  if (cfx.spotlight) drawSpotlight(ctx, edit, m, v, track);
  if (cfx.vhs) drawVhs(ctx, W, H, outT);
  if (look.vignette > 0) drawVignette(ctx, W, H, look.vignette);
  if (look.grain > 0) drawGrain(ctx, W, H, look.grain, Math.round(outT * edit.fps));
  if (look.letterbox > 0) drawBars(ctx, W, H, look, track, credit);
  else drawCorner(ctx, W, credit);

  const beat = edit.music ? 60 / edit.music.bpm : 0.5;
  if (cfx.card === "stat") drawStatCard(ctx, W, H, edit, cfx.rows ?? [], cfx.title ?? "", m.intoShot, beat);
  else if (cfx.card === "end" || cfx.card === "title") drawTitleCard(ctx, W, H, look, cfx.title ?? "", cfx.sub ?? "", m.intoShot, yourKitShirt(track), cfx.card === "title");
  if (shot.caption && !cfx.card) drawColdCaption(ctx, W, H, look, shot.caption, captionClock(edit, m));
  if (cfx.tag) drawTagPill(ctx, W, H, look, cfx.tag, outT);
  if (cfx.counter) drawCounter(ctx, W, H, look, cfx.counter, m.intoShot);

  // Flashes last: the beat's, a goal's own (clip time), a flash cut.
  let flash = hit.flash;
  const fx = shot.fx ?? {};
  if (fx.flashCut && m.intoShot < 0.2) flash = Math.max(flash, 0.9 * (1 - m.intoShot / 0.2));
  if (fx.flashAt !== undefined && m.t >= fx.flashAt - 0.01) flash = Math.max(flash, 0.85 * Math.exp(-(m.t - fx.flashAt) * 9));
  if (flash > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, flash).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** The scorer's shirt as worn, or white when it is too pale to see on a dark card. */
function yourKitShirt(t: GoalTrack): string {
  const c = scorerShirt(t);
  const rgb = hexRgb(c);
  return rgb && rgb[0] + rgb[1] + rgb[2] > 690 ? "#ffffff" : c;
}

/** Seconds since this caption first showed (it runs on over shots that share it). */
function captionClock(edit: Edit, m: EditMoment): number {
  const cap = edit.shots[m.shot]?.caption;
  let t = m.intoShot;
  for (let i = m.shot - 1; i >= 0 && edit.shots[i].caption === cap; i--) t += shotLength(edit.shots[i]);
  return t;
}

// ── The grade (one pixel pass) ──────────────────────────────────────────────

/**
 * Grey with one colour kept, contrast, tint, and an RGB split of `rgb` pixels.
 * Exported for the tests (a pixel buffer in, a pixel buffer out).
 */
export function gradePixels(d: Uint8ClampedArray, W: number, H: number, look: EditLook, rgb: number): void {
  const keep = look.keep ? hexRgb(look.keep) : null;
  let kx = 0, ky = 0, kz = 0, kn = 0;
  if (keep) {
    const kl = 0.299 * keep[0] + 0.587 * keep[1] + 0.114 * keep[2];
    kx = keep[0] - kl; ky = keep[1] - kl; kz = keep[2] - kl;
    kn = Math.hypot(kx, ky, kz);
  }
  const useKeep = kn > 30;
  const [tr, tg, tb] = look.tint;
  const c = look.contrast;
  const shift = Math.round(rgb);
  const src = shift ? d.slice() : d;
  const desat = look.desat;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      const i = row + x * 4;
      let r = src[i], g = src[i + 1], b = src[i + 2];
      if (shift) {
        const xr = Math.min(W - 1, x + shift), xb = Math.max(0, x - shift);
        r = src[row + xr * 4];
        b = src[row + xb * 4 + 2];
      }
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      let cr = r - l, cg = g - l, cb = b - l;
      let sat = 1 - desat;
      if (useKeep) {
        const n = Math.hypot(cr, cg, cb);
        if (n > 12) {
          const cos = (cr * kx + cg * ky + cb * kz) / (n * kn);
          const w = clamp01((cos - 0.8) / 0.15) * clamp01((n - 12) / 30);
          sat = sat + (1.15 - sat) * w;
        }
      }
      cr *= sat; cg *= sat; cb *= sat;
      d[i] = ((l + cr - 128) * c + 128) * tr;
      d[i + 1] = ((l + cg - 128) * c + 128) * tg;
      d[i + 2] = ((l + cb - 128) * c + 128) * tb;
    }
  }
}

function grade(ctx: Any2D, W: number, H: number, look: EditLook, rgb: number): void {
  if (look.desat === 0 && look.contrast === 1 && look.tint.every(x => x === 1) && rgb < 0.5) return;
  try {
    const img = ctx.getImageData(0, 0, W, H);
    gradePixels(img.data, W, H, look, rgb);
    ctx.putImageData(img, 0, 0);
  } catch { /* a tainted or lost canvas: left ungraded */ }
}

/** Bloom: the bright parts, shrunk (a cheap blur), laid back over on top. */
function drawGlow(ctx: Any2D, W: number, H: number, k: number): void {
  const sw = Math.max(8, Math.round(W / 10)), sh = Math.max(8, Math.round(H / 10));
  const s = scratch("glow", sw, sh);
  if (!s) return;
  try {
    s.g.clearRect(0, 0, sw, sh);
    s.g.imageSmoothingEnabled = true;
    s.g.drawImage(ctx.canvas as CanvasImageSource, 0, 0, sw, sh);
    const img = s.g.getImageData(0, 0, sw, sh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const keep = clamp01((l - 120) / 110);
      d[i] *= keep; d[i + 1] *= keep; d[i + 2] *= keep;
    }
    s.g.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.75 * k;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.c as CanvasImageSource, -W * 0.02, -H * 0.02, W * 1.04, H * 1.04);
    ctx.restore();
  } catch { /* no glow */ }
}

/** The freeze call-out: dim round the scorer, a ring on him, his name. */
function drawSpotlight(ctx: Any2D, edit: Edit, m: EditMoment, v: View, track: GoalTrack): void {
  const W = edit.w, H = edit.h;
  const at = scorerOnScreen(edit, m, v);
  if (!at) return;
  const k = easeOut(m.intoShot / 0.15);
  const s = W / 360;
  ctx.save();
  const g = ctx.createRadialGradient(at.x, at.y, at.r * 0.9, at.x, at.y, at.r * 2.4);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(0.62 * k).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 10 * s;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, at.r * (1.25 - 0.25 * k), at.r * (1.25 - 0.25 * k) * 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // His name on a short line up from the ring.
  const name = (track.meta.scorerShort || track.meta.scorer).toUpperCase();
  const ly = Math.max(H * 0.14, at.y - at.r * 1.2 - 34 * s);
  ctx.beginPath();
  ctx.moveTo(at.x, at.y - at.r * 1.2);
  ctx.lineTo(at.x, ly + 10 * s);
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.font = `800 ${13 * s}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(name).width + 14 * s;
  const lx = Math.max(tw / 2 + 6 * s, Math.min(W - tw / 2 - 6 * s, at.x));
  ctx.globalAlpha = k;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, lx - tw / 2, ly - 9 * s, tw, 19 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.fillText(name, lx, ly + 0.5 * s);
  ctx.restore();
}

/** Tape: scan lines, a rolling tracking band, a slight wash. */
function drawVhs(ctx: Any2D, W: number, H: number, t: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  const by = ((t * 0.9) % 1) * H * 1.2 - H * 0.1;
  const g = ctx.createLinearGradient(0, by - 14, 0, by + 14);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, by - 14, W, 28);
  ctx.fillStyle = "rgba(40,20,80,0.12)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx: Any2D, W: number, H: number, k: number): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(0.7 * k).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** A seeded noise tile, laid over at a different place each frame. */
function drawGrain(ctx: Any2D, W: number, H: number, k: number, frame: number): void {
  const T = 128;
  const s = scratch("grain", T, T);
  if (!s) return;
  if (!(s as Scratch & { made?: boolean }).made) {
    const img = s.g.createImageData(T, T);
    let seed = 987654321;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const n = 128 + (((seed >>> 16) & 255) - 128) * 0.9;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    s.g.putImageData(img, 0, 0);
    (s as Scratch & { made?: boolean }).made = true;
  }
  let h = (frame * 2654435761) >>> 0;
  const ox = h % T; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  const oy = h % T;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(1, k * 0.55);
  for (let y = -oy; y < H; y += T) for (let x = -ox; x < W; x += T) ctx.drawImage(s.c as CanvasImageSource, x, y);
  ctx.restore();
}

function captionFont(look: EditLook, px: number): string {
  if (look.font === "cold") return `italic 700 ${px}px Georgia, 'Times New Roman', serif`;
  if (look.font === "aura") return `italic 400 ${px}px Georgia, 'Times New Roman', serif`;
  if (look.font === "tape") return `700 ${px}px 'Courier New', Courier, monospace`;
  return `900 ${px}px ${FONT}`;
}

/** The letterbox bars: the account up top, the match along the bottom, small spaced capitals. */
function drawBars(ctx: Any2D, W: number, H: number, look: EditLook, track: GoalTrack, credit?: ClipCredit): void {
  const bh = Math.round(H * look.letterbox);
  const s = W / 360;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, bh);
  ctx.fillRect(0, H - bh, W, bh);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `600 ${10 * s}px ${FONT}`;
  const handle = credit?.handle ? `@${credit.handle.replace(/^@/, "")}` : "";
  if (handle) spaced(ctx, handle.toUpperCase(), W / 2, bh / 2, 1.6 * s);
  const [h, a] = track.meta.scoreAfter ?? [0, 0];
  const minute = track.meta.minute > 0 ? `  ·  ${track.meta.minuteLabel}'` : "";
  spaced(ctx, `${(track.meta.scorerShort || track.meta.scorer).toUpperCase()}${minute}  ·  ${teamCode(track.meta.home)} ${h}-${a} ${teamCode(track.meta.away)}`, W / 2, H - bh / 2, 1.4 * s);
  ctx.restore();
}

/** No bars: the account, small, top left. */
function drawCorner(ctx: Any2D, W: number, credit?: ClipCredit): void {
  const handle = credit?.handle ? `@${credit.handle.replace(/^@/, "")}` : "";
  if (!handle) return;
  const s = W / 360;
  ctx.save();
  ctx.font = `800 ${12 * s}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4 * s;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(handle, 12 * s, 20 * s, W * 0.6);
  ctx.restore();
}

/** Text drawn with extra space between the letters (centred on x). */
function spaced(ctx: Any2D, text: string, x: number, y: number, gap: number): void {
  const chars = Array.from(text);
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((p, q) => p + q, 0) + gap * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + gap; });
  ctx.textAlign = align;
}

/** The edit's caption: one or two words, big, centred low, eased in. */
function drawColdCaption(ctx: Any2D, W: number, H: number, look: EditLook, text: string, clock: number): void {
  const s = W / 360;
  const k = easeOut(clock / 0.16);
  let size = (look.font === "clean" ? 34 : 44) * s;
  ctx.save();
  ctx.font = captionFont(look, size);
  while (ctx.measureText(text).width > W * 0.86 && size > 18 * s) { size -= 2 * s; ctx.font = captionFont(look, size); }
  const y = H * (look.letterbox > 0 ? 0.74 : 0.72);
  ctx.translate(W / 2, y);
  const sc = 1.25 - 0.25 * k;
  ctx.scale(sc, sc);
  ctx.globalAlpha = k;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (look.font === "aura") { ctx.shadowColor = "rgba(255,220,150,0.95)"; ctx.shadowBlur = 18 * s; }
  else { ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10 * s; }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A small tag, top right: "◀◀ REWIND", "CAM 2", "87 KM/H". */
function drawTagPill(ctx: Any2D, W: number, H: number, look: EditLook, tag: string, t: number): void {
  const s = W / 360;
  const top = Math.round(H * look.letterbox) + 14 * s;
  // The tape's tag blinks.
  if (look.font === "tape" && tag.startsWith("◀◀") && Math.floor(t * 3) % 2 === 1) return;
  ctx.save();
  ctx.font = look.font === "tape" ? `700 ${15 * s}px 'Courier New', Courier, monospace` : `800 ${11 * s}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 4 * s;
  ctx.fillStyle = "#ffffff";
  if (look.font === "tape") ctx.fillText(tag, W - 14 * s, top + 6 * s);
  else spacedRight(ctx, tag, W - 14 * s, top + 6 * s, 1.5 * s);
  ctx.restore();
}

function spacedRight(ctx: Any2D, text: string, right: number, y: number, gap: number): void {
  const chars = Array.from(text);
  const total = chars.reduce((p, c) => p + ctx.measureText(c).width, 0) + gap * (chars.length - 1);
  spaced(ctx, text, right - total / 2, y, gap);
}

/** "3/7", big, top left. */
function drawCounter(ctx: Any2D, W: number, H: number, look: EditLook, text: string, into: number): void {
  const s = W / 360;
  const k = easeOut(into / 0.12);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.font = `900 ${30 * s}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5 * s;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  const y = Math.round(H * look.letterbox) + 34 * s;
  ctx.strokeText(text, 14 * s, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 14 * s, y);
  ctx.restore();
}

/** A title over a held picture: the montage's opening, an edit's last frame. */
function drawTitleCard(ctx: Any2D, W: number, H: number, look: EditLook, title: string, sub: string, into: number, shirt: string, opening: boolean): void {
  const s = W / 360;
  const k = easeOut(into / 0.25);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(0.5 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = (opening ? 46 : 58) * s;
  ctx.font = captionFont(look, size);
  while (ctx.measureText(title).width > W * 0.88 && size > 22 * s) { size -= 2 * s; ctx.font = captionFont(look, size); }
  const y = H * 0.46;
  if (look.font === "aura") { ctx.shadowColor = "rgba(255,220,150,0.95)"; ctx.shadowBlur = 22 * s; }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, W / 2, y + (1 - k) * 12 * s);
  ctx.shadowBlur = 0;
  ctx.fillStyle = shirt;
  ctx.fillRect(W / 2 - W * 0.12 * k, y + size * 0.62, W * 0.24 * k, 3 * s);
  if (sub) {
    ctx.font = `700 ${16 * s}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    spaced(ctx, sub, W / 2, y + size * 0.62 + 24 * s, 2 * s);
  }
  ctx.restore();
}

/** The stat card: a row a beat, sliding in from the right. */
function drawStatCard(ctx: Any2D, W: number, H: number, edit: Edit, rows: [string, string][], title: string, into: number, beat: number): void {
  const s = W / 360;
  const accent = edit.accent ?? "#22D3EE";
  const k = easeOut(into / 0.2);
  const pw = W * 0.84, rh = 34 * s, ph = 46 * s + rows.length * rh + 10 * s;
  const px = (W - pw) / 2, py = H - ph - 24 * s;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = "rgba(8,10,16,0.88)";
  roundRect(ctx, px, py, pw, ph, 10 * s);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(px, py, pw, 3 * s);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `900 ${13 * s}px ${FONT}`;
  ctx.fillStyle = accent;
  spacedLeft(ctx, title, px + 16 * s, py + 22 * s, 2 * s);
  rows.forEach(([label, value], i) => {
    const showAt = (i + 1) * beat;
    const r = easeOut((into - showAt) / 0.15);
    if (r <= 0) return;
    const y = py + 46 * s + i * rh + rh / 2;
    ctx.save();
    ctx.globalAlpha = k * r;
    ctx.translate((1 - r) * 40 * s, 0);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(px + 10 * s, y + rh / 2 - 1, pw - 20 * s, 1);
    ctx.font = `700 ${12 * s}px ${FONT}`;
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "left";
    ctx.fillText(label, px + 16 * s, y);
    ctx.font = `900 ${22 * s}px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(value, px + pw - 16 * s, y, pw * 0.55);
    ctx.restore();
  });
  ctx.restore();
}

function spacedLeft(ctx: Any2D, text: string, left: number, y: number, gap: number): void {
  const chars = Array.from(text);
  const total = chars.reduce((p, c) => p + ctx.measureText(c).width, 0) + gap * (chars.length - 1);
  spaced(ctx, text, left + total / 2, y, gap);
}
