/**
 * Flat pictures the shopping street paints on its surfaces (lib/star/street3d/scene.ts): the
 * road, rendered walls, the shop fascias, what is behind the boutique's and the barber's glass,
 * the barber's "coming soon" card, the clock, the street name and the fingerpost back to the
 * garden. Drawn once when the street opens; no image files. Seeded, so every visit looks the same.
 */

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
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
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/** Worn tarmac: fine grit, darker patches, a few repairs. One tile (about 4 m). */
export function asphaltCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 512);
  const r = rnd(41);
  g.fillStyle = "#3d3f43";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "20,20,22" : "80,80,84"},${0.06 + r() * 0.08})`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 40 + r() * 120, 20 + r() * 70, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 26000; i++) {
    const v = 40 + r() * 70;
    g.fillStyle = `rgba(${v | 0},${v | 0},${(v + 4) | 0},${0.35 + r() * 0.4})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  // a patched trench and a crack or two
  g.fillStyle = "rgba(25,25,28,0.35)";
  g.fillRect(300, 0, 46, 512);
  g.strokeStyle = "rgba(18,18,20,0.6)";
  g.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    let x = r() * 512, y = r() * 512;
    g.moveTo(x, y);
    for (let s = 0; s < 9; s++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

/** Painted render (stucco) in a colour: soft mottling and a little dirt towards the bottom. */
export function renderCanvas(base: string, seed = 7): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  const r = rnd(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "255,250,240" : "60,50,40"},${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 4);
  }
  const grd = g.createLinearGradient(0, 180, 0, 256);
  grd.addColorStop(0, "rgba(40,30,20,0)");
  grd.addColorStop(1, "rgba(40,30,20,0.10)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return c;
}

/** A shop fascia: the name in raised gilt on a painted board, with a thin gold line round it. */
export function fasciaCanvas(text: string, board: string, ink = "#f3d27a", opts: { serif?: boolean; sub?: string } = {}): HTMLCanvasElement {
  const [c, g] = cv(1024, 160);
  g.fillStyle = board;
  g.fillRect(0, 0, 1024, 160);
  const sh = g.createLinearGradient(0, 0, 0, 160);
  sh.addColorStop(0, "rgba(255,255,255,0.10)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = sh;
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = ink; g.globalAlpha = 0.7; g.lineWidth = 4;
  g.strokeRect(14, 14, 996, 132);
  g.globalAlpha = 1;
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = opts.sub ? 78 : 92;
  const face = opts.serif ? SERIF : FONT;
  g.font = `${opts.serif ? "700" : "900"} ${size}px ${face}`;
  while (g.measureText(text).width > 900 && size > 30) { size -= 4; g.font = `${opts.serif ? "700" : "900"} ${size}px ${face}`; }
  const y = opts.sub ? 66 : 84;
  // the gilt: a dark edge under, then the gold
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillText(text, 512 + 2, y + 3);
  const gold = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  gold.addColorStop(0, "#fff3c2"); gold.addColorStop(0.45, ink); gold.addColorStop(1, "#9c7424");
  g.fillStyle = gold;
  g.fillText(text, 512, y);
  if (opts.sub) {
    g.font = `800 30px ${FONT}`;
    g.fillStyle = ink;
    g.fillText(opts.sub, 512, 128);
  }
  return c;
}

/** Behind the boutique's glass: a warm lit room, a rail of clothes, folded knits on a table. */
export function boutiqueCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 384);
  const r = rnd(53);
  const wall = g.createLinearGradient(0, 0, 0, 384);
  wall.addColorStop(0, "#f6e7cf"); wall.addColorStop(1, "#d9c2a0");
  g.fillStyle = wall; g.fillRect(0, 0, 512, 384);
  // spotlights' pools on the back wall
  for (const x of [110, 260, 410]) {
    const p = g.createRadialGradient(x, 40, 4, x, 120, 160);
    p.addColorStop(0, "rgba(255,250,230,0.9)"); p.addColorStop(1, "rgba(255,250,230,0)");
    g.fillStyle = p; g.fillRect(0, 0, 512, 384);
  }
  // the floor
  g.fillStyle = "#6f4d33"; g.fillRect(0, 330, 512, 54);
  // a chrome rail with garments on hangers
  g.fillStyle = "#c9ccd1"; g.fillRect(30, 96, 452, 6);
  const cols = ["#1f2937", "#7c2d12", "#e5e7eb", "#0f766e", "#a16207", "#312e81", "#be123c", "#f5f5f4", "#374151"];
  for (let i = 0; i < 9; i++) {
    const x = 50 + i * 47 + (r() - 0.5) * 6, w = 40, top = 104, len = 120 + r() * 70;
    g.strokeStyle = "#8b8f96"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + w / 2, 98); g.lineTo(x + w / 2, 104); g.stroke();
    g.fillStyle = cols[i];
    g.beginPath();
    g.moveTo(x + 6, top); g.lineTo(x + w - 6, top); g.lineTo(x + w, top + 18); g.lineTo(x + w - 2, top + len); g.lineTo(x + 2, top + len); g.lineTo(x, top + 18); g.closePath();
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x + w - 8, top + 4, 6, len - 6);
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 3, top + 4, 5, len - 6);
  }
  // a low table with folded knits
  g.fillStyle = "#3b2a1e"; g.fillRect(150, 286, 212, 12); g.fillRect(160, 298, 10, 34); g.fillRect(342, 298, 10, 34);
  const knits = ["#d6d3d1", "#57534e", "#b45309", "#1e3a8a", "#e7e5e4"];
  for (let i = 0; i < 5; i++) { g.fillStyle = knits[i]; g.fillRect(165 + i * 38, 268 - (i % 2) * 8, 34, 18 + (i % 2) * 8); g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(165 + i * 38, 282, 34, 4); }
  return c;
}

/** Behind the barber's glass: the mirror wall, a red leather chair, the shelf of tins, a lamp. */
export function barberCanvas(): HTMLCanvasElement {
  const [c, g] = cv(384, 384);
  g.fillStyle = "#e9e2d2"; g.fillRect(0, 0, 384, 384);
  // black-and-white tiles below, the floor
  for (let y = 300; y < 384; y += 21) for (let x = 0; x < 384; x += 21) { g.fillStyle = ((x + y) / 21) % 2 ? "#1c1c1c" : "#f1efe8"; g.fillRect(x, y, 21, 21); }
  // the mirror in a wooden frame
  g.fillStyle = "#5a3b25"; g.fillRect(60, 40, 264, 170);
  const m = g.createLinearGradient(66, 46, 318, 204);
  m.addColorStop(0, "#c8d6dc"); m.addColorStop(0.5, "#eef4f6"); m.addColorStop(1, "#9fb2ba");
  g.fillStyle = m; g.fillRect(68, 48, 248, 154);
  // the shelf, tins and bottles
  g.fillStyle = "#5a3b25"; g.fillRect(60, 214, 264, 8);
  const tins = ["#b91c1c", "#1d4ed8", "#e5e7eb", "#065f46", "#b45309", "#111827"];
  tins.forEach((t, i) => { g.fillStyle = t; g.fillRect(78 + i * 40, 194, 22, 20); });
  // the chair: chrome base, red seat and back
  g.fillStyle = "#9aa0a6"; g.fillRect(176, 286, 32, 14); g.fillRect(186, 262, 12, 26);
  g.fillStyle = "#8b1a1a"; g.fillRect(146, 232, 92, 32); g.fillRect(156, 170, 72, 66);
  g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(160, 174, 8, 58);
  g.fillStyle = "#2b2b2b"; g.fillRect(140, 228, 104, 6);
  // a warm lamp glow at the top
  const p = g.createRadialGradient(192, 10, 4, 192, 40, 200);
  p.addColorStop(0, "rgba(255,236,190,0.75)"); p.addColorStop(1, "rgba(255,236,190,0)");
  g.fillStyle = p; g.fillRect(0, 0, 384, 384);
  return c;
}

/** The card in the barber's door: "Opening soon". */
export function soonCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 320);
  g.fillStyle = "#fbf7ee"; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = "#8b1a1a"; g.lineWidth = 8; g.strokeRect(10, 10, 236, 300);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#8b1a1a"; g.font = `900 46px ${FONT}`;
  g.fillText("OPENING", 128, 112);
  g.fillText("SOON", 128, 166);
  g.fillStyle = "#1c1c1c"; g.font = `700 24px ${SERIF}`;
  g.fillText("Cuts · Fades · Shaves", 128, 232);
  return c;
}

/** A clock face (Roman hours, black hands at ten to five: golden hour). */
export function clockCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  g.fillStyle = "#f4efe2"; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#1c1c1c"; g.lineWidth = 6; g.stroke();
  g.fillStyle = "#1c1c1c"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 26px ${SERIF}`;
  const R = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(R[i], 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); }
  const hand = (a: number, len: number, w: number) => { g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); g.stroke(); };
  hand(((4 + 50 / 60) / 12) * Math.PI * 2, 58, 8);
  hand((50 / 60) * Math.PI * 2, 86, 5);
  g.beginPath(); g.arc(128, 128, 8, 0, Math.PI * 2); g.fill();
  return c;
}

/** A street name plate (white enamel, black capitals, a thin border). */
export function namePlateCanvas(text: string, sub?: string): HTMLCanvasElement {
  const [c, g] = cv(512, 128);
  g.fillStyle = "#fbfbf7"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#111"; g.lineWidth = 6; g.strokeRect(10, 10, 492, 108);
  g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 ${sub ? 50 : 60}px ${FONT}`;
  g.fillText(text, 256, sub ? 54 : 66);
  if (sub) { g.font = `700 24px ${FONT}`; g.fillStyle = "#b91c1c"; g.fillText(sub, 256, 96); }
  return c;
}

/** A fingerpost arm: dark green board, white words, a pointed end. */
export function fingerCanvas(text: string, pointLeft = false): HTMLCanvasElement {
  const [c, g] = cv(512, 96);
  g.fillStyle = "#1f3d2c";
  g.beginPath();
  if (pointLeft) { g.moveTo(512, 0); g.lineTo(62, 0); g.lineTo(0, 48); g.lineTo(62, 96); g.lineTo(512, 96); }
  else { g.moveTo(0, 0); g.lineTo(450, 0); g.lineTo(512, 48); g.lineTo(450, 96); g.lineTo(0, 96); }
  g.closePath(); g.fill();
  g.strokeStyle = "#f4f1e8"; g.lineWidth = 4; g.stroke();
  g.fillStyle = "#f4f1e8"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 44px ${FONT}`;
  g.fillText(text, pointLeft ? 282 : 230, 50);
  return c;
}

/** The showroom's price stand: the car's name and its shop price (from the shop's own data). */
export function priceStandCanvas(name: string, price: string): HTMLCanvasElement {
  const [c, g] = cv(512, 200);
  g.fillStyle = "#0e1116"; g.fillRect(0, 0, 512, 200);
  g.fillStyle = "#f3d27a"; g.fillRect(0, 0, 512, 6); g.fillRect(0, 194, 512, 6);
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = 62;
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(name).width > 470 && size > 28) { size -= 2; g.font = `900 ${size}px ${FONT}`; }
  g.fillStyle = "#ffffff"; g.fillText(name, 256, 72);
  g.font = `800 52px ${FONT}`; g.fillStyle = "#fde047"; g.fillText(price, 256, 146);
  return c;
}

/** A window pane by day: the sky's reflection, lighter at the top, a soft diagonal sheen. */
export function paneCanvas(): HTMLCanvasElement {
  const [c, g] = cv(128, 192);
  const sky = g.createLinearGradient(0, 0, 0, 192);
  sky.addColorStop(0, "#9fb6c6"); sky.addColorStop(0.45, "#5d7383"); sky.addColorStop(1, "#2c3a44");
  g.fillStyle = sky; g.fillRect(0, 0, 128, 192);
  g.fillStyle = "rgba(255,255,255,0.10)";
  g.beginPath(); g.moveTo(0, 60); g.lineTo(128, 0); g.lineTo(128, 26); g.lineTo(0, 92); g.closePath(); g.fill();
  // a net curtain's hem low down, faintly
  g.fillStyle = "rgba(235,235,230,0.10)"; g.fillRect(0, 140, 128, 52);
  return c;
}

/** A window with a lamp on inside: warm room, curtains drawn back at the sides, the lamp's glow. */
export function litPaneCanvas(): HTMLCanvasElement {
  const [c, g] = cv(128, 192);
  const room = g.createLinearGradient(0, 0, 0, 192);
  room.addColorStop(0, "#ffe1a8"); room.addColorStop(0.6, "#e3a961"); room.addColorStop(1, "#7a4f2a");
  g.fillStyle = room; g.fillRect(0, 0, 128, 192);
  const p = g.createRadialGradient(70, 40, 4, 70, 50, 90);
  p.addColorStop(0, "rgba(255,248,225,0.9)"); p.addColorStop(1, "rgba(255,248,225,0)");
  g.fillStyle = p; g.fillRect(0, 0, 128, 192);
  // a picture on the back wall and the curtains
  g.fillStyle = "rgba(60,40,25,0.55)"; g.fillRect(48, 70, 34, 26);
  for (const [x, w] of [[0, 26], [102, 26]]) {
    const cg = g.createLinearGradient(x, 0, x + w, 0);
    cg.addColorStop(0, "#5b2a2a"); cg.addColorStop(0.5, "#8b3a3a"); cg.addColorStop(1, "#4a2020");
    g.fillStyle = cg; g.fillRect(x, 0, w, 192);
  }
  return c;
}

/** Through an open shop door: the shop's own inside (shelves of stock, a counter, warm light). */
export function doorwayCanvas(kind: "shop" | "drip", accent: string): HTMLCanvasElement {
  const [c, g] = cv(256, 384);
  const r = rnd(kind === "shop" ? 61 : 67);
  const wall = g.createLinearGradient(0, 0, 0, 384);
  wall.addColorStop(0, kind === "shop" ? "#f7e8cc" : "#f3e7d6"); wall.addColorStop(1, kind === "shop" ? "#e0c08e" : "#d8c3a2");
  g.fillStyle = wall; g.fillRect(0, 0, 256, 384);
  const p = g.createRadialGradient(128, 20, 4, 128, 80, 220);
  p.addColorStop(0, "rgba(255,252,238,0.95)"); p.addColorStop(1, "rgba(255,252,238,0)");
  g.fillStyle = p; g.fillRect(0, 0, 256, 384);
  // the floor going back
  g.fillStyle = kind === "shop" ? "#7a5232" : "#5c4330"; g.fillRect(0, 300, 256, 84);
  g.fillStyle = "rgba(0,0,0,0.12)"; for (let k = 0; k < 6; k++) g.fillRect(0, 300 + k * 14, 256, 1);
  if (kind === "shop") {
    // shelves of boot boxes and cans down both sides, a counter at the back
    for (const x of [8, 188]) for (let k = 0; k < 4; k++) {
      g.fillStyle = "#6b4528"; g.fillRect(x, 80 + k * 52, 60, 6);
      for (let i = 0; i < 4; i++) { g.fillStyle = ["#1f4a35", "#c9a14f", accent, "#f4f4f4", "#b91c1c"][Math.floor(r() * 5)]; g.fillRect(x + 2 + i * 15, 60 + k * 52, 12, 20); }
    }
    g.fillStyle = "#1f4a35"; g.fillRect(80, 232, 96, 70); g.fillStyle = "#c9a14f"; g.fillRect(80, 232, 96, 6);
    // a shirt on the back wall in your colours
    g.fillStyle = accent; g.beginPath(); g.moveTo(104, 110); g.lineTo(152, 110); g.lineTo(166, 126); g.lineTo(156, 136); g.lineTo(150, 130); g.lineTo(150, 176); g.lineTo(106, 176); g.lineTo(106, 130); g.lineTo(100, 136); g.lineTo(90, 126); g.closePath(); g.fill();
  } else {
    // a rail of jackets, a mirror, a glass counter with watches
    g.fillStyle = "#c9ccd1"; g.fillRect(14, 90, 80, 4);
    for (let i = 0; i < 6; i++) { g.fillStyle = ["#1f2937", "#7c2d12", "#e5e7eb", "#0f766e", "#312e81", "#a16207"][i]; g.fillRect(16 + i * 13, 94, 11, 90 + (i % 2) * 20); }
    g.fillStyle = "#c9a14f"; g.fillRect(160, 60, 70, 150); g.fillStyle = "#dfe8ec"; g.fillRect(166, 66, 58, 138);
    g.fillStyle = "rgba(200,220,230,0.7)"; g.fillRect(96, 240, 120, 56); g.fillStyle = "#121212"; g.fillRect(96, 290, 120, 10);
    for (let i = 0; i < 5; i++) { g.fillStyle = "#e9cf86"; g.beginPath(); g.arc(110 + i * 22, 266, 5, 0, Math.PI * 2); g.fill(); }
  }
  return c;
}

/** Crisp letters on clear glass (a modern fascia): no glow, a soft shadow so they read on dark cladding. */
export function lettersCanvas(text: string, ink: string, w = 1024, h = 192): HTMLCanvasElement {
  const [c, g] = cv(w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = Math.round(h * 0.6);
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(text).width > w * 0.92 && size > 20) { size -= 4; g.font = `900 ${size}px ${FONT}`; }
  g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.fillStyle = ink;
  g.fillText(text, w / 2, h / 2);
  return c;
}

/** A small swing tag for a boutique piece: name and price. */
export function tagCanvas(name: string, price: string): HTMLCanvasElement {
  const [c, g] = cv(320, 140);
  g.fillStyle = "#f8f4ea"; g.fillRect(0, 0, 320, 140);
  g.strokeStyle = "#1c1c1c"; g.lineWidth = 4; g.strokeRect(6, 6, 308, 128);
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = 38; g.font = `800 ${size}px ${SERIF}`;
  while (g.measureText(name).width > 290 && size > 18) { size -= 2; g.font = `800 ${size}px ${SERIF}`; }
  g.fillStyle = "#1c1c1c"; g.fillText(name, 160, 50);
  g.font = `900 36px ${FONT}`; g.fillStyle = "#8b1a1a"; g.fillText(price, 160, 100);
  return c;
}
