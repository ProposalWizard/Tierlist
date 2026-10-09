/**
 * Flat pictures the 3D shop paints onto its surfaces: shop signs, the floor
 * boards, the shirt number. Each is drawn ONCE into an offscreen canvas when
 * the shop opens — there is no animation here; the 3D view's own render
 * loop lives in scene.ts and draws with WebGL.
 */

export function signCanvas(text: string, opts: { bg: string; ink: string; w?: number; h?: number; font?: number }): HTMLCanvasElement {
  const w = opts.w ?? 512, h = opts.h ?? 128;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = opts.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = opts.ink;
  g.font = `900 ${opts.font ?? Math.round(h * 0.56)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + h * 0.03);
  return c;
}

/** Wooden boards, 512², tiling. Tinted darker by the floor material. */
export function floorCanvas(): HTMLCanvasElement {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 200;
    while (x < s) {
      const L = 140 + rnd() * 160;
      const l = 62 + rnd() * 10;
      g.fillStyle = `hsl(32, ${34 + rnd() * 10}%, ${l}%)`;
      g.fillRect(x, (r * s) / rows, L, s / rows);
      g.fillStyle = "rgba(60,35,15,0.35)";
      g.fillRect(x, (r * s) / rows, 2, s / rows);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = `rgba(90,55,25,${0.04 + rnd() * 0.05})`;
        g.fillRect(x, (r * s) / rows + rnd() * (s / rows), L, 1 + rnd() * 2);
      }
      x += L;
    }
    g.fillStyle = "rgba(50,30,12,0.45)";
    g.fillRect(0, (r * s) / rows, s, 2);
  }
  return c;
}

/** A shirt number for the back, white-on-transparent. */
export function numberCanvas(n: number, ink: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = ink;
  g.font = "900 200px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), 128, 140);
  return c;
}

const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** A floating price tag: the item's name, its price, and a green "Owned"
 *  chip when the career has it. Transparent round the edges. */
export function labelCanvas(name: string, price: string, tag?: string | null, scale = 1): HTMLCanvasElement {
  const w = 512, h = 168;
  const c = document.createElement("canvas");
  // drawn in 512×168 units; scale 2 makes a 1024×336 canvas, so the text stays sharp up close
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  const r = 34;
  g.beginPath();
  g.moveTo(r, 6); g.lineTo(w - r, 6); g.quadraticCurveTo(w - 6, 6, w - 6, r);
  g.lineTo(w - 6, h - r); g.quadraticCurveTo(w - 6, h - 6, w - r, h - 6);
  g.lineTo(r, h - 6); g.quadraticCurveTo(6, h - 6, 6, h - r);
  g.lineTo(6, r); g.quadraticCurveTo(6, 6, r, 6);
  g.fillStyle = "rgba(14,12,10,0.86)";
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "rgba(250,204,21,0.75)";
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 56;
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(name).width > w - 60 && size > 30) { size -= 2; g.font = `900 ${size}px ${FONT}`; }
  g.fillStyle = "#ffffff";
  g.fillText(name, w / 2, tag ? 52 : 60);
  g.font = `800 40px ${FONT}`;
  g.fillStyle = "#fde047";
  if (tag) {
    const pw = g.measureText(price).width;
    g.font = `900 30px ${FONT}`;
    const tw = g.measureText(tag).width + 28;
    const x0 = w / 2 - (pw + 16 + tw) / 2;
    g.font = `800 40px ${FONT}`;
    g.textAlign = "left";
    g.fillText(price, x0, 118);
    g.fillStyle = "#16a34a";
    const tx = x0 + pw + 16;
    g.beginPath();
    g.roundRect?.(tx, 98, tw, 42, 21);
    if (!g.roundRect) g.rect(tx, 98, tw, 42);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `900 30px ${FONT}`;
    g.fillText(tag, tx + 14, 120);
  } else {
    g.fillText(price, w / 2, 120);
  }
  return c;
}

/** A soft round shadow to lay under things (cheap, and there on every phone). */
export function blobCanvas(): HTMLCanvasElement {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, "rgba(0,0,0,0.62)");
  gr.addColorStop(0.55, "rgba(0,0,0,0.32)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return c;
}

/**
 * A spotlight's pool of light, drawn once (white, soft edge; the material
 * tints it and adds it on top). Stands in for a real light: see the shop's
 * "baked pools". `stretch` > 1 makes a tall cone (a wash up a wall).
 */
export function poolCanvas(stretch = 1): HTMLCanvasElement {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s; c.height = Math.round(s * stretch);
  const g = c.getContext("2d")!;
  g.scale(1, stretch);
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,0.7)");
  gr.addColorStop(0.7, "rgba(255,255,255,0.22)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return c;
}

/** A neon word on a see-through background: the glow is drawn in. */
export function neonCanvas(text: string, ink: string, w = 1024, h = 192): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = Math.round(h * 0.58);
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(text).width > w * 0.9 && size > 20) { size -= 4; g.font = `900 ${size}px ${FONT}`; }
  g.shadowColor = ink;
  for (const b of [36, 18, 6]) {
    g.shadowBlur = b;
    g.fillStyle = ink;
    g.fillText(text, w / 2, h / 2);
  }
  g.shadowBlur = 0;
  g.fillStyle = "#fffdf5";
  g.globalAlpha = 0.85;
  g.fillText(text, w / 2, h / 2);
  return c;
}
