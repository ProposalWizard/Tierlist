/**
 * The 3D casino's painted surfaces (lib/star/casino3d/scene.ts): drawn on
 * canvases at load, so the room needs no picture files at all. Nothing
 * here imports three.js.
 */
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

/** The casino carpet: deep red with a gold diamond lattice and small rosettes. */
export function carpetCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  g.fillStyle = "#5c0b18";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(212,169,78,0.35)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(128, 0); g.lineTo(256, 128); g.lineTo(128, 256); g.lineTo(0, 128); g.closePath();
  g.stroke();
  g.strokeStyle = "rgba(20,4,8,0.5)";
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(128, 18); g.lineTo(238, 128); g.lineTo(128, 238); g.lineTo(18, 128); g.closePath();
  g.stroke();
  for (const [x, y] of [[128, 128], [0, 0], [256, 0], [0, 256], [256, 256]]) {
    g.fillStyle = "rgba(212,169,78,0.45)";
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Dark wood panelling for the lower walls. */
export function panelCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 128);
  g.fillStyle = "#3a2216";
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${i % 2 ? "20,10,5" : "90,55,35"},0.18)`;
    g.fillRect(0, Math.random() * 128, 256, 1 + Math.random() * 2);
  }
  g.strokeStyle = "rgba(212,169,78,0.6)";
  g.lineWidth = 3;
  g.strokeRect(14, 14, 100, 100);
  g.strokeRect(142, 14, 100, 100);
  return c;
}

const POCKETS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** The roulette wheel seen from above: 37 pockets, a gold centre. */
export function wheelCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 512);
  const r = 250, n = POCKETS.length;
  g.translate(256, 256);
  g.fillStyle = "#3b2414";
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const num = POCKETS[i];
    g.fillStyle = num === 0 ? "#0f7a3a" : REDS.has(num) ? "#b5121b" : "#121212";
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.9, a0, a1); g.closePath(); g.fill();
    g.save();
    g.rotate((a0 + a1) / 2);
    g.fillStyle = "#f5f0e0";
    g.font = `900 22px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.translate(r * 0.8, 0); g.rotate(Math.PI / 2);
    g.fillText(String(num), 0, 0);
    g.restore();
  }
  g.fillStyle = "#3b2414";
  g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, r * 0.5);
  gr.addColorStop(0, "#fff1b8"); gr.addColorStop(1, "#a87a24");
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#d4a94e"; g.lineWidth = 6;
  for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-r * 0.45, 0); g.lineTo(r * 0.45, 0); g.stroke(); }
  return c;
}

/** Green felt with a text across it (the blackjack table's "PAYS 3 TO 2"). */
export function feltCanvas(lines: string[], w = 512, h = 256): HTMLCanvasElement {
  const [c, g] = cv(w, h);
  const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, "#1b8a4c"); gr.addColorStop(1, "#0c5a30");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(255,236,170,0.85)";
  lines.forEach((t, i) => {
    g.font = `800 ${i === 0 ? 34 : 22}px ${FONT}`;
    g.fillText(t, w / 2, h * 0.42 + i * 36);
  });
  return c;
}

/** The roulette layout: the numbers grid on felt. */
export function layoutCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 256);
  g.fillStyle = "#0f6b39";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(255,240,200,0.8)";
  g.lineWidth = 2;
  const x0 = 60, y0 = 30, cw = 36, ch = 56;
  g.fillStyle = "#0f7a3a";
  g.fillRect(20, y0, 40, ch * 3);
  g.strokeRect(20, y0, 40, ch * 3);
  g.font = `800 18px ${FONT}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#fff"; g.fillText("0", 40, y0 + ch * 1.5);
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const n = col * 3 + (3 - row);
      g.fillStyle = REDS.has(n) ? "#b5121b" : "#151515";
      g.fillRect(x0 + col * cw + 3, y0 + row * ch + 3, cw - 6, ch - 6);
      g.strokeRect(x0 + col * cw, y0 + row * ch, cw, ch);
      g.fillStyle = "#fff";
      g.fillText(String(n), x0 + col * cw + cw / 2, y0 + row * ch + ch / 2);
    }
  }
  g.font = `800 16px ${FONT}`;
  ["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].forEach((t, i) => {
    g.strokeRect(x0 + i * cw * 2, y0 + ch * 3 + 6, cw * 2, 34);
    g.fillStyle = t === "RED" ? "#e0313b" : "#fff";
    g.fillText(t, x0 + i * cw * 2 + cw, y0 + ch * 3 + 23);
  });
  return c;
}

/** A slot machine's glass: three reels and a pay line. */
export function slotScreenCanvas(seed: number): HTMLCanvasElement {
  const [c, g] = cv(256, 160);
  g.fillStyle = "#120a12";
  g.fillRect(0, 0, 256, 160);
  const syms = ["7", "★", "🍒", "BAR", "🔔", "7"];
  for (let k = 0; k < 3; k++) {
    const x = 14 + k * 80;
    const gr = g.createLinearGradient(0, 14, 0, 146);
    gr.addColorStop(0, "#9a9a9a"); gr.addColorStop(0.5, "#ffffff"); gr.addColorStop(1, "#9a9a9a");
    g.fillStyle = gr;
    g.fillRect(x, 14, 68, 132);
    g.textAlign = "center"; g.textBaseline = "middle";
    const s = syms[(seed + k * 2) % syms.length];
    g.font = `900 ${s.length > 2 ? 26 : 48}px ${FONT}`;
    g.fillStyle = s === "7" ? "#d1121e" : "#1b1b1b";
    g.fillText(s, x + 34, 80);
  }
  g.fillStyle = "rgba(255,40,60,0.85)";
  g.fillRect(6, 78, 244, 4);
  return c;
}

/** A light box with a word (the slots' toppers, the cabinet's marquee). */
export function marqueeCanvas(text: string, bg: string, ink: string, w = 512, h = 160): HTMLCanvasElement {
  const [c, g] = cv(w, h);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, bg); gr.addColorStop(1, "#000000");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = Math.round(h * 0.55);
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(text).width > w * 0.88 && size > 14) { size -= 3; g.font = `900 ${size}px ${FONT}`; }
  g.shadowColor = ink; g.shadowBlur = 18;
  g.fillStyle = ink;
  g.fillText(text, w / 2, h / 2);
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillText(text, w / 2, h / 2);
  for (let k = 0; k < w; k += 32) {
    g.fillStyle = "#ffe08a";
    g.beginPath(); g.arc(k + 16, 8, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(k + 16, h - 8, 4, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** The betting counter's board: competitions and a price for each. */
export function oddsBoardCanvas(): HTMLCanvasElement {
  const [c, g] = cv(512, 320);
  g.fillStyle = "#0b1020";
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = "#d4a94e"; g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 308);
  g.textBaseline = "middle";
  g.font = `900 40px ${FONT}`;
  g.fillStyle = "#facc15";
  g.textAlign = "center";
  g.fillText("COMPETITION BETS", 256, 48);
  const rows: [string, string][] = [["League", "5/2"], ["FA Cup", "8/1"], ["League Cup", "6/1"], ["Europe", "12/1"]];
  g.font = `800 30px ${FONT}`;
  rows.forEach(([a, b], i) => {
    const y = 110 + i * 52;
    g.textAlign = "left"; g.fillStyle = "#e8eefc"; g.fillText(a, 40, y);
    g.textAlign = "right"; g.fillStyle = "#7df59a"; g.fillText(b, 472, y);
  });
  return c;
}

/** The horse-racing screen, drawn again as the race runs: `t` is seconds. */
export function drawRaceScreen(c: HTMLCanvasElement, t: number) {
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height;
  g.fillStyle = "#2f6e2a";
  g.fillRect(0, 0, w, h);
  // the rails and the lanes
  const lanes = 6, top = h * 0.2, lh = (h * 0.72) / lanes;
  g.fillStyle = "#3d8a34";
  for (let k = 0; k < lanes; k += 2) g.fillRect(0, top + k * lh, w, lh);
  g.fillStyle = "#f5f5f5";
  g.fillRect(0, top - 4, w, 4);
  g.fillRect(0, top + lanes * lh, w, 4);
  // the finishing post
  g.fillStyle = "#ffffff";
  g.fillRect(w * 0.9, top, 6, lanes * lh);
  // a header
  g.fillStyle = "#0b1020";
  g.fillRect(0, 0, w, top - 6);
  g.fillStyle = "#facc15";
  g.font = `900 ${Math.round(top * 0.5)}px ${FONT}`;
  g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText("HORSE RACING · LIVE", 16, (top - 6) / 2);
  // the runners: each a coloured horse that bobs, racing on a loop
  const cols = ["#e11d48", "#2563eb", "#f59e0b", "#7c3aed", "#0ea5e9", "#f97316"];
  const lap = 14;
  const p = (t % lap) / lap;
  for (let k = 0; k < lanes; k++) {
    const pace = 0.82 + 0.18 * Math.sin(k * 1.7 + 0.6);
    const x = -40 + (w * 0.95) * Math.min(1, p * pace * 1.15) + 6 * Math.sin(t * 3 + k);
    const y = top + k * lh + lh / 2 + Math.sin(t * 12 + k) * 2;
    g.fillStyle = "#4a2e1c";
    g.beginPath(); g.ellipse(x, y, lh * 0.55, lh * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + lh * 0.55, y - lh * 0.18, lh * 0.22, lh * 0.12, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = cols[k];
    g.beginPath(); g.arc(x, y - lh * 0.28, lh * 0.15, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff";
    g.font = `800 ${Math.round(lh * 0.35)}px ${FONT}`;
    g.fillText(String(k + 1), 8, y);
  }
}

/** The goalie cabinet's screen: a goal, a ball on its way, two gloves. */
export function goalieScreenCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 192);
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, "#0b2a4a"); gr.addColorStop(1, "#14532d");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = "#ffffff"; g.lineWidth = 6;
  g.strokeRect(36, 50, 184, 100);
  g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1;
  for (let x = 40; x < 220; x += 12) { g.beginPath(); g.moveTo(x, 52); g.lineTo(x, 148); g.stroke(); }
  for (let y = 54; y < 150; y += 12) { g.beginPath(); g.moveTo(38, y); g.lineTo(218, y); g.stroke(); }
  g.fillStyle = "#38bdf8";
  for (const x of [96, 160]) { g.beginPath(); g.arc(x, 112, 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(196, 76, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#facc15";
  g.font = `900 22px ${FONT}`;
  g.textAlign = "center";
  g.fillText("SAVE IT!", 128, 30);
  return c;
}
