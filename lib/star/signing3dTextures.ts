/**
 * The flat pictures the 3D signing scene paints onto things: the contract
 * (live, from the career's terms), the shirt number, the desk's wood grain,
 * the framed shirts, the manager's name plate, the soft shadow patch, and
 * the average colour of a texture (so a tint lands on the skin tone asked
 * for). Plain 2D canvas drawing, run once or when the ink moves; nothing
 * here animates or plays football. Used by lib/star/signing3dScene.ts.
 */
import type { SigningContract } from "./signing3dScene";

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};

/** The average colour of a picture, in linear light (dark and see-through pixels left out). */
export function averageColour(img: CanvasImageSource | undefined): [number, number, number] {
  if (!img) return [0.5, 0.4, 0.35];
  const c = canvasOf(48, 48);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    if (d[i] + d[i + 1] + d[i + 2] < 60) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return n ? [lin(r / n), lin(g / n), lin(b / n)] : [0.5, 0.4, 0.35];
}

/** The shirt number, white on clear, for the back of the shirt. */
export function drawShirtNumber(c: HTMLCanvasElement, n: number | null | undefined) {
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, c.width, c.height);
  if (n == null) return;
  x.fillStyle = "#fff";
  x.font = `900 ${Math.round(c.height * 0.58)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(String(n), c.width / 2, c.height / 2);
}

export function newNumberCanvas(): HTMLCanvasElement { return canvasOf(256, 256); }

/** Warm desk wood with a few seeded grain lines. */
export function woodGrainCanvas(): HTMLCanvasElement {
  const c = canvasOf(512, 256);
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, "#7a3e1d"); g.addColorStop(0.5, "#8a4a22"); g.addColorStop(1, "#713819");
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 90; i++) {
    const y0 = rnd() * 256;
    x.strokeStyle = `rgba(${rnd() < 0.5 ? "40,16,4" : "150,80,40"},${0.08 + rnd() * 0.12})`;
    x.lineWidth = 0.6 + rnd() * 2;
    x.beginPath(); x.moveTo(0, y0);
    for (let px = 0; px <= 512; px += 32) x.lineTo(px, y0 + Math.sin(px / 60 + i) * 3 + (rnd() - 0.5) * 2);
    x.stroke();
  }
  return c;
}

/** A club shirt in a frame (the club's colours, no badge). */
export function framedShirtCanvas(colour: string, trim: string): HTMLCanvasElement {
  const c = canvasOf(160, 200);
  const g = c.getContext("2d")!;
  g.fillStyle = "#13233f"; g.fillRect(0, 0, 160, 200);
  g.strokeStyle = "#c9a14a"; g.lineWidth = 8; g.strokeRect(4, 4, 152, 192);
  g.fillStyle = colour;
  g.beginPath(); g.moveTo(52, 38); g.lineTo(18, 60); g.lineTo(30, 92); g.lineTo(46, 84); g.lineTo(46, 168); g.lineTo(114, 168);
  g.lineTo(114, 84); g.lineTo(130, 92); g.lineTo(142, 60); g.lineTo(108, 38); g.quadraticCurveTo(80, 56, 52, 38); g.fill();
  g.strokeStyle = trim; g.lineWidth = 4; g.beginPath(); g.moveTo(54, 40); g.quadraticCurveTo(80, 58, 106, 40); g.stroke();
  return c;
}

/** "Keith Andrews" → "K. Andrews". */
export function plateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && !/^the$/i.test(parts[0]) ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

/** The brass plate on the desk with the manager's name. */
export function namePlateCanvas(managerName: string): HTMLCanvasElement {
  const c = canvasOf(512, 96);
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, "#f0d58a"); gr.addColorStop(1, "#b48a37");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#2a1c08"; g.textAlign = "center";
  g.font = "bold 40px Georgia, serif"; g.fillText(plateName(managerName), 256, 50);
  g.font = "bold 20px Georgia, serif"; g.fillText("MANAGER", 256, 80);
  return c;
}

/** A soft round dark patch, for under people and things (no shadow maps). */
export function softShadowCanvas(): HTMLCanvasElement {
  const c = canvasOf(64, 64);
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
}

// ── The contract ──

/** The paper, in pixels, and where your name goes on it. */
export const CONTRACT_W = 640, CONTRACT_H = 886;
export const CONTRACT_SIG = { x: 330, y: 700, w: 260, h: 62 };

export function newContractCanvas(): HTMLCanvasElement { return canvasOf(CONTRACT_W, CONTRACT_H); }

/**
 * Draw the contract: the club, who it is between, every term, the club's
 * signature already on it, yours as far as the pen has got (`inkUpTo`, 0-1,
 * along `sigPts`, a 300x60 path), and the red SIGNED stamp once it has landed.
 */
export function drawContract(
  canvas: HTMLCanvasElement, c: SigningContract, sigPts: [number, number][], inkUpTo: number, stamped: boolean,
) {
  const CW = CONTRACT_W, CH = CONTRACT_H, SIG = CONTRACT_SIG;
  const g = canvas.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, "#fbf8f0"); bg.addColorStop(1, "#eee7d6");
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = "rgba(160,120,40,.55)"; g.lineWidth = 6; g.strokeRect(14, 14, CW - 28, CH - 28);
  g.fillStyle = c.shirt; g.fillRect(14, 14, CW - 28, 18);
  g.fillStyle = c.trim; g.fillRect(14, 32, CW - 28, 6);
  g.textAlign = "center"; g.fillStyle = "#8a6a23";
  g.font = "bold 22px Georgia, serif"; g.fillText("PROFESSIONAL CONTRACT", CW / 2, 84);
  g.fillStyle = "#1b140a";
  let size = 56;
  g.font = `900 ${size}px Georgia, serif`;
  while (g.measureText(c.club).width > CW - 80 && size > 26) { size -= 2; g.font = `900 ${size}px Georgia, serif`; }
  g.fillText(c.club, CW / 2, 150);
  g.font = "italic 22px Georgia, serif"; g.fillStyle = "#4b3b20";
  g.fillText(`between the club and ${c.playerName}`, CW / 2, 188);
  // The terms.
  g.textAlign = "left";
  let y = 250;
  for (const [label, value] of c.rows) {
    g.fillStyle = "#6b5630"; g.font = "bold 22px Georgia, serif"; g.fillText(label.toUpperCase(), 60, y);
    g.fillStyle = "#1b140a"; g.font = "900 34px Georgia, serif";
    g.textAlign = "right"; g.fillText(value, CW - 60, y + 2); g.textAlign = "left";
    g.strokeStyle = "rgba(59,47,28,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(60, y + 16); g.lineTo(CW - 60, y + 16); g.stroke();
    y += 62;
  }
  // Two signature lines: the club has signed; yours waits.
  g.strokeStyle = "rgba(59,47,28,.8)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(50, 770); g.lineTo(290, 770); g.moveTo(330, 770); g.lineTo(590, 770); g.stroke();
  g.fillStyle = "#5b4a2c"; g.font = "bold 18px Georgia, serif";
  g.fillText(`FOR ${c.club.toUpperCase()}`.slice(0, 24), 50, 796);
  g.fillText(c.playerName.toUpperCase().slice(0, 24), 330, 796);
  // The club's signature (already there).
  g.strokeStyle = "#1e3a8a"; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath();
  sigPts.forEach((p, i) => {
    const px = 60 + (p[0] / 300) * 200, py = 712 + (p[1] / 60) * 50;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  g.stroke();
  // Yours, as far as the pen has got.
  if (inkUpTo > 0) {
    g.strokeStyle = "#0f172a"; g.lineWidth = 5;
    g.beginPath();
    const n = Math.max(1, Math.floor(inkUpTo * (sigPts.length - 1)));
    for (let i = 0; i <= n; i++) {
      const p = sigPts[i];
      const px = SIG.x + (p[0] / 300) * SIG.w, py = SIG.y + (p[1] / 60) * SIG.h;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  } else {
    g.fillStyle = "#b45309"; g.font = "bold 20px system-ui, sans-serif"; g.fillText("✕ sign here", SIG.x + 6, 755);
  }
  if (stamped) {
    g.save();
    g.translate(CW / 2 + 70, 560); g.rotate(-0.16);
    g.strokeStyle = "rgba(190,24,40,.85)"; g.lineWidth = 9; g.strokeRect(-150, -48, 300, 96);
    g.fillStyle = "rgba(190,24,40,.85)"; g.textAlign = "center"; g.font = "900 64px system-ui, sans-serif";
    g.fillText("SIGNED", 0, 24);
    g.restore();
  }
}
