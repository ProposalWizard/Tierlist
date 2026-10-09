/**
 * THE 3D HOME'S PICTURES — every surface is a small canvas drawn once when
 * the home opens (no image files): floors, the walls' painted light, what the
 * windows look out on, the drive, and the cabinet's name plates.
 *
 * The light is painted in ("baked"): the walls get darker towards the floor
 * and the corners, a soft shade lies round the edge of the floor, and the
 * sun's patch from the window is a glow on the floor. The room has no lamp
 * that works out light live; see scene.ts.
 */
import type { FloorKind, WindowView } from "./homes";

const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
/** A small seeded random (the same picture every time). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** The floor, one tile of it (repeated across the room). */
export function floorCanvas(kind: FloorKind): HTMLCanvasElement {
  const [c, g] = canvas(512, 512);
  const r = rng(kind.length * 97 + 11);
  if (kind === "carpet") {
    g.fillStyle = "#8b7d6e"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 2, 2); }
    return c;
  }
  if (kind === "boards" || kind === "oak") {
    const base = kind === "boards" ? "#a88a66" : "#9a6b42";
    const bw = 64;
    for (let x = 0; x < 512; x += bw) {
      let y = -Math.floor(r() * 300);
      while (y < 512) {
        const len = 180 + r() * 200;
        g.fillStyle = shade(base, 0.86 + r() * 0.24);
        g.fillRect(x, y, bw, len);
        for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(60,35,15,${0.05 + r() * 0.08})`; g.lineWidth = 1; g.beginPath(); const gx = x + 4 + r() * (bw - 8); g.moveTo(gx, y); g.bezierCurveTo(gx + 6, y + len / 3, gx - 6, y + (2 * len) / 3, gx, y + len); g.stroke(); }
        g.fillStyle = "rgba(30,18,8,0.55)"; g.fillRect(x, y + len - 2, bw, 2);
        y += len;
      }
      g.fillStyle = "rgba(30,18,8,0.5)"; g.fillRect(x + bw - 2, 0, 2, 512);
    }
    return c;
  }
  if (kind === "stone") {
    // big pale limestone flags
    const s = 256;
    for (let y = 0; y < 512; y += s) for (let x = 0; x < 512; x += s) {
      g.fillStyle = shade("#d9cdb8", 0.94 + r() * 0.1); g.fillRect(x, y, s, s);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.06})`; g.fillRect(x + r() * s, y + r() * s, 3, 3); }
      g.fillStyle = "rgba(90,75,55,0.45)"; g.fillRect(x, y, s, 2); g.fillRect(x, y, 2, s);
    }
    return c;
  }
  // marble: white with soft grey veins, big tiles with a brass line
  g.fillStyle = "#ece8e1"; g.fillRect(0, 0, 512, 512);
  for (let v = 0; v < 9; v++) {
    g.strokeStyle = `rgba(120,115,110,${0.12 + r() * 0.18})`; g.lineWidth = 1 + r() * 2.5;
    g.beginPath(); let x = r() * 512, y = 0; g.moveTo(x, y);
    while (y < 512) { x += (r() - 0.5) * 60; y += 20 + r() * 40; g.lineTo(x, y); }
    g.stroke();
  }
  g.fillStyle = "rgba(176,141,70,0.8)"; g.fillRect(0, 0, 512, 3); g.fillRect(0, 0, 3, 512);
  return c;
}

/** A wall's painted light: brighter up high, a soft shade at the floor. */
export function wallCanvas(colour: string): HTMLCanvasElement {
  const [c, g] = canvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, shade(colour, 0.94));
  gr.addColorStop(0.35, shade(colour, 1.0));
  gr.addColorStop(0.85, shade(colour, 0.9));
  gr.addColorStop(1, shade(colour, 0.7));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  return c;
}

/** The shade round the floor's edge (laid over the floor; transparent in the middle). */
export function floorShadeCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(256, 256);
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const e = Math.min(x, 255 - x, y, 255 - y) / 255; // 0 at the edge
    const a = Math.max(0, 1 - e / 0.12);
    const i = (y * 256 + x) * 4;
    img.data[i] = 20; img.data[i + 1] = 14; img.data[i + 2] = 8;
    img.data[i + 3] = Math.round(150 * a * a);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A soft round glow (a lamp's pool, the sun's patch): white, tinted by the material. */
export function glowCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
/** The sun's patch through a window: a soft-edged rectangle. */
export function patchCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(128, 128);
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const e = Math.min(x, 127 - x, y, 127 - y) / 64;
    const a = Math.min(1, e / 0.35);
    const i = (y * 128 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(255 * a * a);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** What a window looks out on, painted (a plane a few metres outside the glass). */
export function viewCanvas(view: WindowView): HTMLCanvasElement {
  const [c, g] = canvas(1024, 512);
  const r = rng(view.length * 131 + 7);
  const sky = (top: string, low: string, horizon = 0.62) => {
    const gr = g.createLinearGradient(0, 0, 0, 512 * horizon);
    gr.addColorStop(0, top); gr.addColorStop(1, low);
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  };
  const clouds = (n: number, alpha: number) => {
    for (let i = 0; i < n; i++) {
      const x = r() * 1024, y = 40 + r() * 160, w = 80 + r() * 160;
      g.fillStyle = `rgba(255,250,240,${alpha})`;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + k * w * 0.18, y + (r() - 0.5) * 10, w * 0.22, w * 0.09, 0, 0, Math.PI * 2); g.fill(); }
    }
  };
  if (view === "street" || view === "city" || view === "skyline") {
    sky(view === "skyline" ? "#6f9fd6" : "#86acd8", "#f2d7b0", view === "skyline" ? 0.8 : 0.7);
    clouds(view === "skyline" ? 7 : 4, 0.55);
    // buildings: near and low for a street, a block for the city, towers far below for the skyline
    const rows = view === "street" ? [{ y: 230, h: [150, 230], w: [110, 170], c: "#b9876a" }] :
      view === "city" ? [{ y: 150, h: [200, 330], w: [70, 140], c: "#8796a8" }, { y: 260, h: [170, 260], w: [90, 160], c: "#a9876c" }] :
        [{ y: 280, h: [60, 200], w: [30, 70], c: "#7f8ea3" }, { y: 360, h: [40, 140], w: [40, 90], c: "#6f7c8f" }];
    for (const row of rows) {
      let x = -20;
      while (x < 1024) {
        const w = row.w[0] + r() * (row.w[1] - row.w[0]);
        const h = row.h[0] + r() * (row.h[1] - row.h[0]);
        const top = Math.max(20, 512 - (512 - row.y) - h + (512 - row.y));
        const y0 = row.y + 260 - h;
        g.fillStyle = shade(row.c.startsWith("#") ? row.c : "#888888", 0.85 + r() * 0.3);
        g.fillRect(x, Math.min(top, y0), w, 600);
        // windows, a few lit
        g.fillStyle = "rgba(40,52,70,0.55)";
        for (let wy = Math.min(top, y0) + 12; wy < 512; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) {
          g.fillStyle = r() < 0.12 ? "rgba(255,214,140,0.9)" : "rgba(40,52,70,0.5)";
          g.fillRect(wx, wy, 8, 12);
        }
        x += w + 4 + r() * 10;
      }
    }
    if (view === "street") { g.fillStyle = "#4e5156"; g.fillRect(0, 470, 1024, 42); g.fillStyle = "#9aa0a6"; g.fillRect(0, 462, 1024, 8); }
    return c;
  }
  if (view === "sea") {
    sky("#5f97d4", "#f6dcb4", 0.55);
    clouds(5, 0.6);
    const sea = g.createLinearGradient(0, 280, 0, 512);
    sea.addColorStop(0, "#3f86b8"); sea.addColorStop(1, "#1f5f8c");
    g.fillStyle = sea; g.fillRect(0, 280, 1024, 232);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.25})`; g.fillRect(r() * 1024, 285 + r() * 200, 10 + r() * 30, 2); }
    g.fillStyle = "rgba(255,240,200,0.5)"; g.fillRect(480, 282, 120, 3);
    // a terrace rail and a palm on one side
    g.fillStyle = "#efe6d6"; g.fillRect(0, 470, 1024, 42);
    for (let x = 10; x < 1024; x += 34) g.fillRect(x, 420, 8, 52);
    g.fillRect(0, 414, 1024, 10);
    g.strokeStyle = "#5b4630"; g.lineWidth = 12; g.beginPath(); g.moveTo(900, 512); g.quadraticCurveTo(880, 300, 930, 180); g.stroke();
    g.fillStyle = "#2f6b3a";
    for (let k = 0; k < 7; k++) { g.save(); g.translate(930, 180); g.rotate(-1.2 + k * 0.45); g.beginPath(); g.ellipse(70, 0, 80, 14, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    return c;
  }
  // garden / grounds: lawn, trees, a far hedge (and a fountain for the grounds)
  sky("#6fa3dc", "#f4dcb6", 0.6);
  clouds(5, 0.55);
  g.fillStyle = view === "grounds" ? "#7c9a58" : "#86a35c"; g.fillRect(0, 300, 1024, 212);
  for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; g.fillRect(0, 300 + i * 12, 1024, 6); }
  for (let i = 0; i < 26; i++) {
    const x = r() * 1024, s = 30 + r() * (view === "grounds" ? 70 : 50), y = 300 - r() * 10;
    g.fillStyle = "#5b4630"; g.fillRect(x - 3, y - s * 0.3, 6, s * 0.4);
    g.fillStyle = shade("#3f6b34", 0.8 + r() * 0.4);
    g.beginPath(); g.ellipse(x, y - s * 0.6, s * 0.5, s * 0.6, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#3d6131"; g.fillRect(0, 290, 1024, 16);
  if (view === "grounds") {
    // a long gravel drive and a stone fountain in the middle distance
    g.fillStyle = "#cdbb98"; g.beginPath(); g.moveTo(470, 300); g.lineTo(554, 300); g.lineTo(760, 512); g.lineTo(264, 512); g.fill();
    g.fillStyle = "#d7d0c2"; g.beginPath(); g.ellipse(512, 380, 90, 22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#9cc4dd"; g.beginPath(); g.ellipse(512, 376, 74, 15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d7d0c2"; g.fillRect(504, 320, 16, 56);
  } else {
    g.fillStyle = "#b9a98a"; g.fillRect(0, 470, 1024, 42); // the patio
  }
  return c;
}

/** The backdrop behind the drive: the street opposite, a hedge, or the estate's trees. */
export function driveBackCanvas(kind: "street" | "drive" | "forecourt"): HTMLCanvasElement {
  const [c, g] = canvas(1024, 384);
  const r = rng(kind.length * 53 + 3);
  const gr = g.createLinearGradient(0, 0, 0, 260);
  gr.addColorStop(0, "#7aa8dc"); gr.addColorStop(1, "#f2dab4");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 384);
  if (kind === "street") {
    let x = 0;
    while (x < 1024) {
      const w = 140 + r() * 80, h = 170 + r() * 90;
      g.fillStyle = shade("#a7795c", 0.85 + r() * 0.3); g.fillRect(x, 384 - h, w, h);
      g.fillStyle = "#4a4f57"; g.beginPath(); g.moveTo(x - 6, 384 - h); g.lineTo(x + w / 2, 384 - h - 46); g.lineTo(x + w + 6, 384 - h); g.fill();
      for (let wy = 384 - h + 24; wy < 330; wy += 56) for (let wx = x + 18; wx < x + w - 30; wx += 46) { g.fillStyle = "#f4f1ea"; g.fillRect(wx - 3, wy - 3, 30, 38); g.fillStyle = "#4b5a6c"; g.fillRect(wx, wy, 24, 32); }
      x += w + 6;
    }
    return c;
  }
  // a tall clipped hedge, then trees above it
  for (let i = 0; i < 30; i++) {
    const x = r() * 1024, s = 60 + r() * (kind === "forecourt" ? 110 : 70);
    g.fillStyle = shade("#3f6b34", 0.75 + r() * 0.4);
    g.beginPath(); g.ellipse(x, 210 - s * 0.3, s * 0.6, s * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#2f5428"; g.fillRect(0, 230, 1024, 154);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "90,130,70" : "20,40,18"},0.35)`; g.fillRect(r() * 1024, 230 + r() * 154, 3, 3); }
  if (kind === "forecourt") {
    // stone gate piers with balls on top
    for (const x of [300, 724]) { g.fillStyle = "#d8cfbd"; g.fillRect(x - 22, 170, 44, 214); g.beginPath(); g.arc(x, 158, 18, 0, Math.PI * 2); g.fill(); }
  }
  return c;
}

/** The drive's surface: tarmac with a kerb line, gravel, or stone setts. */
export function driveCanvas(kind: "street" | "drive" | "forecourt"): HTMLCanvasElement {
  const [c, g] = canvas(256, 256);
  const r = rng(kind.length * 7 + 1);
  if (kind === "street") {
    g.fillStyle = "#55585d"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
    return c;
  }
  if (kind === "drive") {
    g.fillStyle = "#b9a888"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,250,235" : "90,75,55"},${0.15 + r() * 0.25})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
    return c;
  }
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < 256; x += 32) {
    g.fillStyle = shade("#c9bfae", 0.88 + r() * 0.18); g.fillRect(x + 1, y + 1, 30, 30);
  }
  return c;
}

/**
 * The cabinet's name plates, all on one picture (a column of plates, read by
 * UV): each a brass plate with the trophy's name and "×3", or, for a spot you
 * have not filled, "Win it to fill this".
 */
export function platesCanvas(plates: { name: string; count: number; won: boolean }[]): { canvas: HTMLCanvasElement; rows: number } {
  const rows = Math.max(1, plates.length);
  const W = 512, H = 96;
  const [c, g] = canvas(W, H * rows);
  plates.forEach((p, i) => {
    const y = i * H;
    g.fillStyle = p.won ? "#c9a24a" : "#4a443c";
    g.fillRect(4, y + 6, W - 8, H - 12);
    g.strokeStyle = p.won ? "#f3d98a" : "#6f675b"; g.lineWidth = 4; g.strokeRect(8, y + 10, W - 16, H - 20);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = p.won ? "#2a1d08" : "#cfc6b6";
    let size = p.won ? 40 : 30;
    const text = p.won ? (p.count > 1 ? `${p.name}  ×${p.count}` : p.name) : p.name;
    g.font = `900 ${size}px ${FONT}`;
    while (g.measureText(text).width > W - 40 && size > 18) { size -= 2; g.font = `900 ${size}px ${FONT}`; }
    if (p.won) g.fillText(text, W / 2, y + H / 2 + 1);
    else {
      g.fillText(text, W / 2, y + H / 2 - 12);
      g.font = `700 22px ${FONT}`; g.fillStyle = "#a99f8f";
      g.fillText("Win it to fill this", W / 2, y + H / 2 + 18);
    }
  });
  return { canvas: c, rows };
}

/** A sign over the door out to the garden. */
export function signCanvas(text: string): HTMLCanvasElement {
  const [c, g] = canvas(512, 128);
  g.fillStyle = "rgba(20,16,12,0.85)"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = "#f7f1e8"; g.font = `900 56px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 68);
  return c;
}
