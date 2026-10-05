/**
 * Small canvas textures for the 3D garden: the mown lawn, gravel, the path,
 * straw for the hay, a sky gradient, and the shelf labels in the trophy
 * cabinet. Drawn once when the garden opens; no image files.
 */

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

/** A seeded random, so the lawn looks the same every visit. */
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mown stripes with blades of grass: one tile, repeated over the lawn. */
export function lawnCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 512);
  const r = rnd(7);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#4f8f3a" : "#5c9e43";
    g.fillRect(0, i * 128, 512, 128);
  }
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512;
    const light = 40 + r() * 22;
    g.strokeStyle = `hsla(${95 + r() * 18}, 45%, ${light}%, 0.55)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4);
    g.stroke();
  }
  return c;
}

/** Pale gravel for the drive and the paths. */
export function gravelCanvas(base = "#cdbfa6"): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(11);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(r() * 90);
    g.fillStyle = `rgba(${v},${v - 8},${v - 22},0.8)`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 0.6 + r() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Square stone paving slabs. */
export function pavingCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(5);
  g.fillStyle = "#8d8577";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const v = 180 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
      g.fillRect(x * 128 + 4, y * 128 + 4, 120, 120);
      for (let i = 0; i < 200; i++) {
        g.fillStyle = `rgba(90,80,70,${r() * 0.15})`;
        g.fillRect(x * 128 + 4 + r() * 120, y * 128 + 4 + r() * 120, 2, 2);
      }
    }
  }
  return c;
}

/** Straw: golden streaks, for the hay bales. */
export function strawCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(3);
  g.fillStyle = "#d9b45a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = `hsla(${38 + r() * 12}, 60%, ${45 + r() * 30}%, 0.7)`;
    g.lineWidth = 1 + r();
    const x = r() * 256, y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 6 + r() * 14, y + (r() - 0.5) * 4);
    g.stroke();
  }
  return c;
}

/** Wooden boards, for the stable and the gazebo. */
export function boardsCanvas(base = "#8a5a36"): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(9);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(x, 0, 2, 256);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(${r() > 0.5 ? "255,230,200" : "40,20,10"},${0.05 + r() * 0.08})`;
      g.beginPath();
      const yy = r() * 256;
      g.moveTo(x + 3, yy);
      g.lineTo(x + 30, yy + (r() - 0.5) * 8);
      g.stroke();
    }
  }
  return c;
}

/** The sky: a vertical gradient for the inside of the sky dome. */
export function skyCanvas(top: string, mid: string, low: string): HTMLCanvasElement {
  const [c, g] = cv(16, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, mid);
  gr.addColorStop(1, low);
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 512);
  return c;
}

/** "×3" under a trophy on the cabinet shelf. */
export function countCanvas(n: number): HTMLCanvasElement {
  const [c, g] = cv(128, 64);
  g.fillStyle = "rgba(15,12,9,0.82)";
  g.beginPath();
  g.roundRect(8, 8, 112, 48, 24);
  g.fill();
  g.fillStyle = "#facc15";
  g.font = "900 34px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(`×${n}`, 64, 34);
  return c;
}

/** A soft round glow, for lamp light on the ground and the sun. */
export function glowCanvas(rgb = "255,220,160"): HTMLCanvasElement {
  const [c, g] = cv(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.35, `rgba(${rgb},0.45)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
}

// ── The 5 Oct 2026 look pass (scene.ts's New garden; sceneOld.ts never uses these) ──

/** A softer mown lawn: wide pale/dark bands, fine blades, a little clover. */
export function lawnCanvasSoft(): HTMLCanvasElement {
  const [c, g] = cv(512, 512);
  const r = rnd(17);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#4a7f33" : "#56903b";
    g.fillRect(0, i * 128, 512, 128);
  }
  // soft edges between the bands, as a mower leaves them
  for (let i = 0; i < 4; i++) {
    const gr = g.createLinearGradient(0, i * 128 - 10, 0, i * 128 + 10);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.5, "rgba(40,70,25,0.18)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, i * 128 - 10, 512, 20);
  }
  for (let i = 0; i < 14000; i++) {
    const x = r() * 512, y = r() * 512;
    g.strokeStyle = `hsla(${88 + r() * 22}, ${38 + r() * 14}%, ${30 + r() * 26}%, 0.5)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 2.5, y - 2 - r() * 3);
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "236,232,200" : "60,110,40"},${0.25 + r() * 0.25})`;
    g.beginPath();
    g.arc(r() * 512, r() * 512, 0.8 + r() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Long uncut meadow beyond the boundary: warmer, patchier, no stripes. */
export function meadowCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(23);
  g.fillStyle = "#62813a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "150,150,70" : "50,85,35"},${0.12 + r() * 0.15})`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 18, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 5000; i++) {
    const x = r() * 256, y = r() * 256;
    g.strokeStyle = `hsla(${62 + r() * 40}, 40%, ${28 + r() * 30}%, 0.55)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5);
    g.stroke();
  }
  return c;
}

/** Red-brown brick in stretcher bond. One tile is 4 courses × 2 bricks. */
export function brickCanvas(base = "#9a5138"): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(29);
  g.fillStyle = "#cbbca4"; // mortar
  g.fillRect(0, 0, 256, 256);
  const rows = 8, h = 256 / rows, w = 128;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? w / 2 : 0;
    for (let x = -1; x < 3; x++) {
      const bx = x * w + off, by = y * h;
      const k = 0.82 + r() * 0.3;
      const col = parseInt(base.slice(1), 16);
      const R = Math.min(255, ((col >> 16) & 255) * k), G = Math.min(255, ((col >> 8) & 255) * k), B = Math.min(255, (col & 255) * k);
      g.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      g.fillRect(bx + 2, by + 2, w - 4, h - 4);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(${r() > 0.5 ? "255,220,190" : "40,15,10"},${r() * 0.12})`;
        g.fillRect(bx + 2 + r() * (w - 6), by + 2 + r() * (h - 6), 2, 2);
      }
    }
  }
  return c;
}

/** A clipped yew/box hedge face: dense small leaves, darker in the gaps. */
export function hedgeCanvas(base = "#2f5e27"): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(31);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const l = 18 + r() * 26;
    g.fillStyle = `hsla(${96 + r() * 24}, ${35 + r() * 20}%, ${l}%, 0.8)`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 1.5 + r() * 2.5, 1 + r() * 1.6, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Awning canvas: two-colour stripes running down the slope. */
export function stripeCanvas(a: string, b: string): HTMLCanvasElement {
  const [c, g] = cv(256, 32);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(i * 32, 0, 32, 32);
  }
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 8; i++) g.fillRect(i * 32, 0, 1, 32);
  return c;
}

/** Slate roof tiles: rows of overlapping grey-blue slates. */
export function slateCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(37);
  g.fillStyle = "#3a3f47";
  g.fillRect(0, 0, 256, 256);
  const rows = 8, h = 32, w = 32;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? w / 2 : 0;
    for (let x = -1; x < 9; x++) {
      const v = 70 + r() * 30;
      g.fillStyle = `rgb(${v | 0},${(v + 6) | 0},${(v + 16) | 0})`;
      g.fillRect(x * w + off + 1, y * h + 1, w - 2, h - 3);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x * w + off + 1, y * h + h - 3, w - 2, 2);
    }
  }
  return c;
}
