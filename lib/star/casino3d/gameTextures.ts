/**
 * The painted surfaces of the 3D casino's playable games
 * (lib/star/casino3d/games3d.ts): the roulette wheel's numbers, the slot
 * reels' symbol strip, the playing cards. Canvases only, no picture files,
 * no three.js. The symbols are drawn, not emoji, so every phone shows the
 * same reel.
 */
import { ROULETTE_ORDER, isRed, SLOTS_SYMBOLS, type Card } from "../casinoRules";
import { POCKET_STEP } from "./motion";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

/**
 * The wheel seen from above. Pocket i (ROULETTE_ORDER[i]) runs from angle
 * i·step to (i+1)·step, angles counted anticlockwise from the right with the
 * picture's top as "up" — the same angles as motion.ts's pocketAngle, so the
 * ball's angle and the painted number agree.
 */
export function rouletteWheelCanvas(size = 1024): HTMLCanvasElement {
  const [c, g] = cv(size, size);
  const m = size / 2, R = m - 2;
  const at = (a: number, r: number): [number, number] => [m + r * Math.cos(a), m - r * Math.sin(a)];
  g.fillStyle = "#2a160b";
  g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.fill();
  ROULETTE_ORDER.forEach((n, i) => {
    const a0 = i * POCKET_STEP, a1 = (i + 1) * POCKET_STEP;
    const col = n === 0 ? "#0f8a45" : isRed(n) ? "#c2121c" : "#141414";
    // the number ring (outer) and the pocket (inner), same colour
    g.fillStyle = col;
    g.beginPath(); g.moveTo(m, m); g.arc(m, m, R * 0.98, -a1, -a0); g.closePath(); g.fill();
    // the pocket floor a touch darker
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath(); g.arc(m, m, R * 0.8, -a1, -a0); g.arc(m, m, R * 0.6, -a0, -a1, true); g.closePath(); g.fill();
    const mid = (a0 + a1) / 2;
    const [x, y] = at(mid, R * 0.89);
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 2 - mid);
    g.fillStyle = "#fbf3dc";
    g.font = `900 ${Math.round(size * 0.036)}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n), 0, 0);
    g.restore();
  });
  // gold lines between the numbers, and the rings
  g.strokeStyle = "#e3bd62"; g.lineWidth = size * 0.004;
  for (let i = 0; i < ROULETTE_ORDER.length; i++) {
    const a = i * POCKET_STEP;
    const [x0, y0] = at(a, R * 0.6), [x1, y1] = at(a, R * 0.98);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  for (const r of [0.98, 0.8, 0.6]) { g.beginPath(); g.arc(m, m, R * r, 0, Math.PI * 2); g.stroke(); }
  // the wooden cone in the middle with gold spokes
  const gr = g.createRadialGradient(m, m, 4, m, m, R * 0.6);
  gr.addColorStop(0, "#c48a3c"); gr.addColorStop(0.55, "#6a3f1c"); gr.addColorStop(1, "#3a2010");
  g.fillStyle = gr;
  g.beginPath(); g.arc(m, m, R * 0.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#e3bd62"; g.lineWidth = size * 0.012;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    const [x0, y0] = at(a, R * 0.45), [x1, y1] = at(a + Math.PI, R * 0.45);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  return c;
}

/** One reel symbol, drawn upright in a box centred on (0, 0), `s` across. */
function drawSymbol(g: CanvasRenderingContext2D, sym: string, s: number) {
  const k = s / 100;
  g.lineJoin = "round";
  if (sym === "🍒") {
    g.strokeStyle = "#2f7a1f"; g.lineWidth = 5 * k;
    g.beginPath(); g.moveTo(-18 * k, 12 * k); g.quadraticCurveTo(-6 * k, -20 * k, 10 * k, -34 * k); g.stroke();
    g.beginPath(); g.moveTo(18 * k, 16 * k); g.quadraticCurveTo(14 * k, -16 * k, 10 * k, -34 * k); g.stroke();
    for (const [x, y] of [[-20, 20], [18, 24]]) {
      const gr = g.createRadialGradient((x - 6) * k, (y - 6) * k, 2 * k, x * k, y * k, 18 * k);
      gr.addColorStop(0, "#ff8a8a"); gr.addColorStop(1, "#b00818");
      g.fillStyle = gr;
      g.beginPath(); g.arc(x * k, y * k, 17 * k, 0, Math.PI * 2); g.fill();
    }
  } else if (sym === "🍋") {
    const gr = g.createRadialGradient(-10 * k, -10 * k, 4 * k, 0, 0, 40 * k);
    gr.addColorStop(0, "#fff7a0"); gr.addColorStop(1, "#e2b800");
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, 38 * k, 27 * k, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-36 * k, 12 * k, 7 * k, 5 * k, -0.3, 0, Math.PI * 2); g.ellipse(36 * k, -12 * k, 7 * k, 5 * k, -0.3, 0, Math.PI * 2); g.fill();
  } else if (sym === "🍊") {
    const gr = g.createRadialGradient(-10 * k, -10 * k, 4 * k, 0, 0, 36 * k);
    gr.addColorStop(0, "#ffd08a"); gr.addColorStop(1, "#e2650a");
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 4 * k, 33 * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2f7a1f";
    g.beginPath(); g.ellipse(8 * k, -30 * k, 12 * k, 6 * k, -0.5, 0, Math.PI * 2); g.fill();
  } else if (sym === "🔔") {
    const gr = g.createLinearGradient(-30 * k, 0, 30 * k, 0);
    gr.addColorStop(0, "#a8740a"); gr.addColorStop(0.45, "#ffe27a"); gr.addColorStop(1, "#a8740a");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-34 * k, 24 * k);
    g.quadraticCurveTo(-26 * k, 14 * k, -24 * k, -6 * k);
    g.quadraticCurveTo(-20 * k, -34 * k, 0, -34 * k);
    g.quadraticCurveTo(20 * k, -34 * k, 24 * k, -6 * k);
    g.quadraticCurveTo(26 * k, 14 * k, 34 * k, 24 * k);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(0, 30 * k, 8 * k, 0, Math.PI * 2); g.fill();
  } else if (sym === "⭐") {
    g.fillStyle = "#ffcc1a"; g.strokeStyle = "#b07800"; g.lineWidth = 3 * k;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 16 : 38) * k, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill(); g.stroke();
  } else {
    g.font = `900 ${Math.round(84 * k)}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 6 * k; g.strokeStyle = "#5a0008";
    g.strokeText("7", 0, 4 * k);
    g.fillStyle = "#e3121e";
    g.fillText("7", 0, 4 * k);
  }
}

/**
 * The strip round a reel drum: SLOTS_SYMBOLS[k] in the k-th sixth of the
 * width. The drum turns about its own axis, which runs left-right on the
 * machine, so each symbol is painted turned a quarter (the width becomes
 * "up" on the machine).
 */
export function reelStripCanvas(): HTMLCanvasElement {
  const n = SLOTS_SYMBOLS.length;
  const cell = 192;
  const [c, g] = cv(cell * n, 192);
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, "#d9d6cf"); gr.addColorStop(0.5, "#ffffff"); gr.addColorStop(1, "#d9d6cf");
  g.fillStyle = gr;
  g.fillRect(0, 0, cell * n, 192);
  for (let k = 0; k < n; k++) {
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(k * cell, 0, 2, 192);
    g.save();
    g.translate(k * cell + cell / 2, 96);
    g.rotate(Math.PI / 2);
    drawSymbol(g, SLOTS_SYMBOLS[k], 150);
    g.restore();
  }
  return c;
}

/** A playing card's face. */
export function cardFaceCanvas(card: Card): HTMLCanvasElement {
  const [c, g] = cv(160, 224);
  g.fillStyle = "#fbfaf5";
  g.beginPath(); g.roundRect(2, 2, 156, 220, 14); g.fill();
  g.strokeStyle = "#c9c4b6"; g.lineWidth = 3; g.stroke();
  const red = card.suit === "♥" || card.suit === "♦";
  g.fillStyle = red ? "#c8102e" : "#141414";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 46px ${FONT}`;
  g.fillText(card.rank, 34, 34);
  g.font = `700 34px ${FONT}`;
  g.fillText(card.suit, 34, 74);
  g.save(); g.translate(126, 190); g.rotate(Math.PI);
  g.font = `900 46px ${FONT}`; g.fillText(card.rank, 0, 0);
  g.restore();
  g.font = `700 84px ${FONT}`;
  g.fillText(card.suit, 88, 128);
  return c;
}

/** The back of every card: navy with a gold lattice. */
export function cardBackCanvas(): HTMLCanvasElement {
  const [c, g] = cv(160, 224);
  g.fillStyle = "#fbfaf5";
  g.beginPath(); g.roundRect(2, 2, 156, 220, 14); g.fill();
  g.fillStyle = "#1c2f7a";
  g.beginPath(); g.roundRect(12, 12, 136, 200, 8); g.fill();
  g.strokeStyle = "rgba(255,214,120,0.55)"; g.lineWidth = 2;
  for (let k = -224; k < 224; k += 18) {
    g.beginPath(); g.moveTo(12 + k, 12); g.lineTo(12 + k + 200, 212); g.stroke();
    g.beginPath(); g.moveTo(148 - k, 12); g.lineTo(148 - k - 200, 212); g.stroke();
  }
  g.strokeStyle = "#e3bd62"; g.lineWidth = 4;
  g.beginPath(); g.roundRect(12, 12, 136, 200, 8); g.stroke();
  return c;
}
