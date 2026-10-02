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

/** Light oak boards, 1024², tiling. */
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
