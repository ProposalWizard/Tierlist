/**
 * THE HERO FIGURE FROM BEHIND — the back of the A2 home-screen player.
 *
 * Harry, 30 Sep 2026, on the Spin-your-player page: the back "does not work"
 * — it was a flat SVG stand-in, a different drawing from the front, and the
 * page said so itself. This paints the back in the SAME design space, the same
 * limb/sleeve shading and the same proportions as `paintHeroFigure`, so the
 * turn is one man: surname across the shoulders and the squad number big on
 * the shirt, as on a real back, and the back of his head.
 *
 * The hair colour is taken from his own photo (the face-fit head's crown),
 * so a dark-haired photo does not turn round blond. A photo whose crown is
 * mostly skin is drawn without hair. With no photo to read, the colour falls
 * back to the game's own per-player hair (figure3d.ts's `hairFor`).
 *
 * A still picture, like the front: painted once, again when something
 * changes. No animation loop.
 */
import { limb, sleeve, tint, rgba, luminance, type HeroLook, type P } from "./heroFigure";
import { looksLikeSkin, type FittedHead } from "./faceFit";
import { hairFor } from "./figure3d";

/** Where his hair is, read off the face-fit head's crown. */
type Hair = { colour: string } | "bald";
const hairCache = new WeakMap<HTMLCanvasElement, Hair | null>();

/** The crown of the fitted head: opaque pixels in its top fifth that are not
 *  skin. Mostly skin up there → bald. Too few pixels to say → null. */
export function hairFromFitted(fit: FittedHead): Hair | null {
  const cached = hairCache.get(fit.canvas);
  if (cached !== undefined) return cached;
  let out: Hair | null = null;
  try {
    const w = fit.canvas.width, h = fit.canvas.height;
    const ctx = fit.canvas.getContext("2d");
    if (ctx && w > 4 && h > 4) {
      const y1 = Math.max(2, Math.round(h * 0.2));
      const x0 = Math.round(w * 0.25), x1 = Math.round(w * 0.75);
      const data = ctx.getImageData(x0, 0, x1 - x0, y1).data;
      const hair: [number, number, number][] = [];
      let skin = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (looksLikeSkin(r, g, b)) skin++;
        else hair.push([r, g, b]);
      }
      const total = skin + hair.length;
      if (total >= 30) {
        if (skin > total * 0.6) out = "bald";
        else if (hair.length >= 20) {
          const med = (k: 0 | 1 | 2) => hair.map((p) => p[k]).sort((a, b) => a - b)[hair.length >> 1];
          const hex = (v: number) => v.toString(16).padStart(2, "0");
          out = { colour: `#${hex(med(0))}${hex(med(1))}${hex(med(2))}` };
        }
      }
    }
  } catch { /* an unreadable canvas: fall back below */ }
  hairCache.set(fit.canvas, out);
  return out;
}

/** The back of the head: ears, skull, hair down to the nape, a neck. */
function backOfHead(ctx: CanvasRenderingContext2D, cx: number, chinY: number, faceH: number, skin: string, hair: Hair) {
  // Sized to the front's head (a fitted photo's head, chin at chinY): about
  // as wide as the face with its ears, the crown level with the front's hair.
  const rx = faceH * 0.74, ry = faceH * 0.84;
  const cy = chinY - faceH * 0.9;
  // Neck first, under the skull.
  limb(ctx, [cx, chinY - 8], [cx, 88], 17, 18, tint(skin, -0.12));
  // The skull, lit from the left like the body.
  const sg = ctx.createLinearGradient(cx - rx, cy - ry * 0.3, cx + rx, cy + ry * 0.3);
  sg.addColorStop(0, tint(skin, 0.16)); sg.addColorStop(0.5, skin); sg.addColorStop(1, tint(skin, -0.28));
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  const ears = () => {
    for (const side of [-1, 1]) {
      ctx.fillStyle = tint(skin, side < 0 ? -0.04 : -0.2);
      ctx.beginPath(); ctx.ellipse(cx + side * rx * 0.98, cy + ry * 0.22, rx * 0.18, ry * 0.24, side * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(tint(skin, -0.5), 0.35);
      ctx.beginPath(); ctx.ellipse(cx + side * rx * 1.0, cy + ry * 0.22, rx * 0.07, ry * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  if (hair === "bald") {
    ears();
    // A shine on the crown so a bald head still reads as round.
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.3, cy - ry * 0.45, rx * 0.32, ry * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
    return;
  }
  let colour = hair.colour;
  // Hair must read as hair at phone size: too close to the skin, take it darker.
  if (Math.abs(luminance(colour) - luminance(skin)) < 0.18) colour = tint(colour, -0.4);
  const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry * 0.4);
  hg.addColorStop(0, tint(colour, 0.3)); hg.addColorStop(0.5, colour); hg.addColorStop(1, tint(colour, -0.35));
  ctx.fillStyle = hg;
  // A short cut: over the crown, down the sides to the tops of the ears,
  // tapering in to a nape just above the neck.
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.02, cy + ry * 0.12);
  ctx.bezierCurveTo(cx - rx * 1.08, cy - ry * 0.75, cx - rx * 0.62, cy - ry * 1.07, cx, cy - ry * 1.07);
  ctx.bezierCurveTo(cx + rx * 0.62, cy - ry * 1.07, cx + rx * 1.08, cy - ry * 0.75, cx + rx * 1.02, cy + ry * 0.12);
  ctx.quadraticCurveTo(cx + rx * 0.95, cy + ry * 0.6, cx + rx * 0.5, cy + ry * 0.74);
  ctx.quadraticCurveTo(cx, cy + ry * 0.84, cx - rx * 0.5, cy + ry * 0.74);
  ctx.quadraticCurveTo(cx - rx * 0.95, cy + ry * 0.6, cx - rx * 1.02, cy + ry * 0.12);
  ctx.closePath(); ctx.fill();
  // The fade at the nape: a softer band where the hair meets the skin.
  ctx.strokeStyle = rgba(colour, 0.45); ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx - rx * 0.48, cy + ry * 0.8); ctx.quadraticCurveTo(cx, cy + ry * 0.9, cx + rx * 0.48, cy + ry * 0.8); ctx.stroke();
  // A crown swirl and a few strands, so it is hair and not a cap.
  ctx.strokeStyle = rgba(tint(colour, -0.55), 0.55); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(cx + rx * 0.08, cy - ry * 0.48, rx * 0.15, 0.3, Math.PI * 1.7); ctx.stroke();
  for (const [x0, b] of [[-0.55, 0.5], [-0.2, 0.66], [0.2, 0.66], [0.55, 0.5]] as const) {
    ctx.beginPath(); ctx.moveTo(cx + rx * x0 * 0.5, cy - ry * 0.3); ctx.quadraticCurveTo(cx + rx * x0 * 0.95, cy + ry * 0.1, cx + rx * x0 * 1.05, cy + ry * b); ctx.stroke();
  }
  ctx.strokeStyle = rgba(tint(colour, 0.5), 0.35); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - rx * 0.78, cy - ry * 0.2); ctx.quadraticCurveTo(cx - rx * 0.55, cy - ry * 0.85, cx - rx * 0.05, cy - ry * 0.96); ctx.stroke();
  // Ears stick out from the sides of the hair.
  ears();
}

/** A boot seen from behind: the heel counter and the sole. */
function heel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stripe: string) {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#3a3f4a"); g.addColorStop(1, "#0b0d12");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - 9);
  ctx.quadraticCurveTo(x, y - 12, x + w / 2, y - 9);
  ctx.lineTo(x + w / 2 + 1, y + 3);
  ctx.lineTo(x - w / 2 - 1, y + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = stripe; ctx.fillRect(x - 1.2, y - 10, 2.4, 9);
  ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x - w / 2 - 1, y + 3, w + 2, 1.8);
}

export interface HeroBackLook extends HeroLook {
  /** Printed across the shoulders. */
  surname?: string;
  /** Who he is, for his hair when there is no photo to read it from. */
  key?: string;
}

/**
 * Paint the A2 figure from behind into `ctx`, already scaled so 1 unit = 1
 * design unit (see HERO_W/HERO_H in heroFigure.ts), boots on y = 290.
 */
export function paintHeroBack(ctx: CanvasRenderingContext2D, look: HeroBackLook): void {
  const { shirt, shorts, trim, skin } = look;
  const ink = luminance(shirt) > 0.6 ? tint(trim, -0.15) : "#ffffff";
  const fit = look.fitted ?? null;
  const hair: Hair = (fit && hairFromFitted(fit)) || { colour: hairFor(look.key ?? look.surname ?? "you").colour };

  // ── Legs: calves, socks, heels ──
  for (const [hip, knee, ankle, w] of [
    [[84, 206], [82, 243], [80, 277], 1] as const,
    [[117, 206], [119, 244], [121, 276], 0.94] as const,
  ]) {
    limb(ctx, hip as P, knee as P, 21 * w, 15 * w, skin);
    limb(ctx, knee as P, ankle as P, 15 * w, 10.5 * w, skin);
    limb(ctx, [knee[0], knee[1] + 3], ankle as P, 16 * w, 12 * w, shirt);
    ctx.fillStyle = trim; ctx.fillRect(knee[0] - 8 * w, knee[1] + 3, 16 * w, 3);
    // The back of the knee: a soft crease.
    ctx.strokeStyle = rgba(tint(skin, -0.5), 0.35); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(knee[0] - 4, knee[1] - 4); ctx.quadraticCurveTo(knee[0], knee[1] - 1, knee[0] + 4, knee[1] - 4); ctx.stroke();
    heel(ctx, ankle[0], ankle[1] + 7, 17 * w, trim);
  }

  // ── Arms hanging, both behind the body's edge ──
  const lSh: P = [60, 97], rSh: P = [140, 96];
  const lEl: P = [52, 140], rEl: P = [148, 140];
  const lHa: P = [49, 184], rHa: P = [151, 184];
  for (const [sh, el, ha] of [[lSh, lEl, lHa], [rSh, rEl, rHa]] as const) {
    limb(ctx, [sh[0] + (el[0] - sh[0]) * 0.35, sh[1] + (el[1] - sh[1]) * 0.35], el, 17, 15, skin);
    limb(ctx, el, ha, 15, 11.5, skin);
    ctx.fillStyle = tint(skin, -0.08);
    ctx.beginPath(); ctx.arc(ha[0], ha[1] + 2, 7, 0, Math.PI * 2); ctx.fill();
  }

  // ── Shorts, seen from behind ──
  {
    const g = ctx.createLinearGradient(66, 0, 136, 0);
    g.addColorStop(0, tint(shorts, 0.18)); g.addColorStop(0.5, shorts); g.addColorStop(1, tint(shorts, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(70, 164); ctx.lineTo(132, 164);
    ctx.lineTo(136, 208); ctx.quadraticCurveTo(118, 214, 103, 211);
    ctx.lineTo(101, 196); ctx.lineTo(99, 211);
    ctx.quadraticCurveTo(82, 214, 65, 208);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(tint(shorts, -0.5), 0.35); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(101, 168); ctx.lineTo(101, 196); ctx.stroke();
    ctx.strokeStyle = shirt; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(68, 172); ctx.lineTo(66, 206); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(133, 172); ctx.lineTo(135, 206); ctx.stroke();
  }

  // ── The shirt's back: a round neck, no V ──
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(88, 82);
    ctx.lineTo(68, 86);
    ctx.quadraticCurveTo(57, 89, 55, 100);
    ctx.lineTo(66, 118);
    ctx.lineTo(70, 168);
    ctx.quadraticCurveTo(101, 174, 132, 168);
    ctx.lineTo(134, 118);
    ctx.lineTo(145, 99);
    ctx.quadraticCurveTo(143, 89, 133, 86);
    ctx.lineTo(113, 82);
    ctx.quadraticCurveTo(101, 86, 88, 82);
    ctx.closePath();
  };
  {
    const g = ctx.createLinearGradient(44, 70, 156, 120);
    g.addColorStop(0, tint(shirt, 0.26)); g.addColorStop(0.45, shirt); g.addColorStop(1, tint(shirt, -0.36));
    ctx.fillStyle = g; torso(); ctx.fill();
    ctx.save(); torso(); ctx.clip();
    const v = ctx.createLinearGradient(0, 80, 0, 172);
    v.addColorStop(0, "rgba(255,255,255,0.08)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = v; ctx.fillRect(40, 78, 120, 100);
    // The shoulder blades and the spine, faintly.
    ctx.strokeStyle = rgba(tint(shirt, -0.55), 0.3); ctx.lineCap = "round"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(76, 100); ctx.quadraticCurveTo(84, 112, 80, 124); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(126, 100); ctx.quadraticCurveTo(118, 112, 122, 124); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(84, 158); ctx.quadraticCurveTo(101, 164, 118, 158); ctx.stroke();
    ctx.restore();
  }

  // ── Surname across the shoulders, number big in the middle ──
  const name = (look.surname ?? "").toUpperCase().trim();
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (name) {
    let size = 12;
    ctx.font = `900 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    const maxW = 58;
    const w0 = ctx.measureText(name).width;
    if (w0 > maxW) { size = Math.max(7, size * maxW / w0); ctx.font = `900 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`; }
    // A gentle arch, the way names sit on a real shirt.
    const chars = Array.from(name);
    const widths = chars.map((c) => ctx.measureText(c).width + size * 0.08);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 101 - total / 2;
    for (let i = 0; i < chars.length; i++) {
      const mid = x + widths[i] / 2;
      const t = (mid - 101) / Math.max(1, total / 2);
      const y = 107 + t * t * 3.2;
      ctx.save();
      ctx.translate(mid, y); ctx.rotate(t * 0.09);
      ctx.lineWidth = 2.2; ctx.strokeStyle = rgba("#000000", 0.25); ctx.strokeText(chars[i], 0, 0);
      ctx.fillStyle = ink; ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      x += widths[i];
    }
  }
  if (look.number != null) {
    ctx.font = "900 44px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.lineWidth = 4; ctx.strokeStyle = rgba("#000000", 0.22);
    ctx.strokeText(String(look.number), 101, 140);
    ctx.fillStyle = ink;
    ctx.fillText(String(look.number), 101, 140);
    // The number's own trim edge, in the kit's second colour, when it shows.
    if (luminance(trim) !== luminance(shirt)) {
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(trim, 0.7);
      ctx.strokeText(String(look.number), 101, 140);
    }
  }
  ctx.restore();

  // ── Sleeves over the upper arms ──
  sleeve(ctx, lSh, lEl, 23, 19, shirt, trim);
  sleeve(ctx, rSh, rEl, 21, 16.5, tint(shirt, -0.22), trim);

  // ── The round collar at the back of the neck, then the head ──
  backOfHead(ctx, 101, 80, 29, fit?.skin ?? skin, hair);
  ctx.strokeStyle = trim; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(89, 83); ctx.quadraticCurveTo(101, 89, 113, 83); ctx.stroke();
}
