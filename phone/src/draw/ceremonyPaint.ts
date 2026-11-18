/**
 * THE CEREMONIES' STILL PARTS, AS PLAIN CANVAS PAINTING (no screen code, so
 * tools/ceremony-stills.ts can draw them in node): the Golden Ball stage
 * (BallonDorNight.tsx StageDrawn's wall, ring, floor, podiums, beams and the
 * host's SVG) and the Season Awards room (SeasonAwardsNight.tsx RoomDrawn),
 * their CSS turned into the same shapes and gradients. Used by
 * screens/career/Ceremonies.tsx.
 */

/** One podium: where (% across), how tall (px), its beam's strength, and whether it is the winner's. */
export interface PodiumPaint { left: number; px: number; beam: number; win: boolean }

export function paintStageBack(g: CanvasRenderingContext2D, W: number, H: number, glow: boolean): void {
  // linear-gradient(180deg, #05060c 0%, #10121c 60%, #07080d 100%)
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, "#05060c"); lg.addColorStop(0.6, "#10121c"); lg.addColorStop(1, "#07080d");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  // radial-gradient(60% 40% at 50% 34%, rgba(246,196,69,.16), transparent 70%)
  g.save();
  g.translate(W / 2, H * 0.34); g.scale(1, (H * 0.4) / (W * 0.6));
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.6);
  rg.addColorStop(0, "rgba(246,196,69,0.16)"); rg.addColorStop(0.7, "rgba(246,196,69,0)");
  g.fillStyle = rg; g.fillRect(-W, -W, W * 2, W * 2);
  g.restore();
  // The wall's light strips: repeating-linear-gradient(90deg, transparent 0 34px, rgba(109,134,255,.25) 34px 36px).
  g.fillStyle = "rgba(109,134,255,0.25)";
  for (let x = 34; x < W; x += 36) g.fillRect(x, H * 0.12, 2, H * 0.48);
  // The gold ring: 150 px across, a 5 px rim, glowing.
  const cx = W / 2, cy = H * 0.19 + 75;
  g.save();
  g.shadowColor = "rgba(246,196,69,0.6)"; g.shadowBlur = glow ? 50 : 24;
  g.strokeStyle = "#f6c445"; g.lineWidth = 5;
  g.beginPath(); g.arc(cx, cy, 72.5, 0, Math.PI * 2); g.stroke();
  g.restore();
  // The stage floor and its gold edge.
  const fy = H * 0.66;
  const fg = g.createLinearGradient(0, fy, 0, H);
  fg.addColorStop(0, "#0c0d12"); fg.addColorStop(1, "#050507");
  g.fillStyle = fg; g.fillRect(0, fy, W, H - fy);
  g.save();
  g.shadowColor = "#f6c445"; g.shadowBlur = 12;
  g.fillStyle = "#f6c445"; g.fillRect(0, fy - 3, W, 3);
  g.restore();
}

export function paintPodiums(g: CanvasRenderingContext2D, W: number, H: number, items: PodiumPaint[]): void {
  const floor = H * 0.66;
  for (const it of items) {
    const cx = (it.left / 100) * W;
    if (it.beam > 0) {
      // 120 px wide at the floor, 16% of that at the top (clip-path polygon(42% 0, 58% 0, 100% 100%, 0 100%)).
      const gr = g.createLinearGradient(0, 0, 0, floor);
      // "transparent" fades in the beam's own colour (a browser blends gradients premultiplied).
      gr.addColorStop(0, it.win ? "rgba(255,211,107,0)" : "rgba(191,210,255,0)");
      gr.addColorStop(1, it.win ? "rgba(255,211,107,0.9)" : "rgba(191,210,255,0.8)");
      g.save(); g.globalAlpha = it.beam; g.fillStyle = gr;
      g.beginPath(); g.moveTo(cx - 60 + 120 * 0.42, 0); g.lineTo(cx - 60 + 120 * 0.58, 0); g.lineTo(cx + 60, floor); g.lineTo(cx - 60, floor); g.closePath(); g.fill();
      g.restore();
    }
  }
  for (const it of items) {
    const cx = (it.left / 100) * W, top = floor - it.px;
    // linear-gradient(90deg, #0d0e14, #23252f 50%, #0d0e14), a gold top edge glowing.
    const gr = g.createLinearGradient(cx - 42, 0, cx + 42, 0);
    gr.addColorStop(0, "#0d0e14"); gr.addColorStop(0.5, "#23252f"); gr.addColorStop(1, "#0d0e14");
    g.fillStyle = gr; g.fillRect(cx - 42, top, 84, it.px);
    g.save(); g.shadowColor = "rgba(246,196,69,0.35)"; g.shadowBlur = 10; g.shadowOffsetY = -2;
    g.fillStyle = "#f6c445"; g.fillRect(cx - 42, top, 84, 3);
    g.restore();
  }
}

export function paintHost(g: CanvasRenderingContext2D, k: number, arm: number): void {
  g.scale(k, k);
  g.fillStyle = "#101119"; g.fillRect(6, 70, 52, 50);
  g.strokeStyle = "#f6c445"; g.lineWidth = 2; g.strokeRect(6, 70, 52, 50);
  g.fillStyle = "#c8946b"; g.beginPath(); g.arc(32, 16, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#9ca3af"; g.beginPath(); g.moveTo(22, 12); g.quadraticCurveTo(32, 2, 42, 12); g.lineTo(42, 9); g.quadraticCurveTo(32, -1, 22, 9); g.closePath(); g.fill();
  g.fillStyle = "#111827"; g.beginPath(); g.moveTo(16, 30); g.quadraticCurveTo(32, 24, 48, 30); g.lineTo(50, 72); g.lineTo(14, 72); g.closePath(); g.fill();
  g.fillStyle = "#f8fafc"; g.beginPath(); g.moveTo(28, 28); g.lineTo(32, 44); g.lineTo(36, 28); g.closePath(); g.fill();
  g.fillStyle = "#111"; g.beginPath(); g.moveTo(30, 29); g.lineTo(32, 33); g.lineTo(34, 29); g.closePath(); g.fill();
  g.save();
  g.translate(46, 32); g.rotate((arm * Math.PI) / 180); g.translate(-46, -32);
  g.fillStyle = "#111827"; g.beginPath(); g.roundRect(44, 30, 6, 26, 3); g.fill();
  g.fillStyle = "#374151"; g.fillRect(45, 54, 4, 9);
  g.fillStyle = "#6b7280"; g.beginPath(); g.arc(47, 65, 3.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function paintRoomBack(g: CanvasRenderingContext2D, W: number, H: number): void {
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, "#1a0f0a"); lg.addColorStop(0.55, "#2a1810"); lg.addColorStop(1, "#120a07");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H * 0.3); g.scale(1, (H * 0.4) / (W * 0.7));
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.7);
  rg.addColorStop(0, "rgba(255,170,80,0.18)"); rg.addColorStop(0.7, "rgba(255,170,80,0)");
  g.fillStyle = rg; g.fillRect(-W * 2, -W * 2, W * 4, W * 4);
  g.restore();
  // The bulbs overhead: radial-gradient(circle, #ffd28a 0 2px, transparent 3px) every 26 px, 80% strong.
  g.save(); g.globalAlpha = 0.8; g.fillStyle = "#ffd28a";
  for (let x = 13; x < W + 13; x += 26) { g.beginPath(); g.arc(x, H * 0.13 + 6, 2.5, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // The screen (its words are laid over it).
  const sx = W * 0.13, sy = H * 0.2, sw = W * 0.74, sh = H * 0.17;
  g.save(); g.shadowColor = "rgba(255,170,80,0.25)"; g.shadowBlur = 30;
  const sg = g.createRadialGradient(sx + sw / 2, sy + sh * 0.45, 0, sx + sw / 2, sy + sh * 0.45, Math.max(sw, sh) * 0.6);
  sg.addColorStop(0, "#3a1e10"); sg.addColorStop(1, "#0b0606");
  g.fillStyle = sg; g.fillRect(sx, sy, sw, sh);
  g.restore();
  g.strokeStyle = "#0b0806"; g.lineWidth = 3; g.strokeRect(sx - 2.5, sy - 2.5, sw + 5, sh + 5);
  g.strokeStyle = "rgba(246,196,69,0.5)"; g.lineWidth = 1; g.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  // Curtains: repeating-linear-gradient(90deg, #4a0e12 0 8px, #2d070a 8px 14px).
  const cw = W * 0.09, cy = H * 0.08, ch = H * 0.52;
  for (const x0 of [0, W - cw]) {
    g.save(); g.beginPath(); g.rect(x0, cy, cw, ch); g.clip();
    for (let x = x0; x < x0 + cw; x += 14) { g.fillStyle = "#4a0e12"; g.fillRect(x, cy, 8, ch); g.fillStyle = "#2d070a"; g.fillRect(x + 8, cy, 6, ch); }
    g.restore();
  }
  // The stage and its glowing edge.
  const stg = g.createLinearGradient(0, H * 0.52, 0, H * 0.6);
  stg.addColorStop(0, "#5a1418"); stg.addColorStop(1, "#2a0a0c");
  g.fillStyle = stg; g.fillRect(W * 0.06, H * 0.52, W * 0.88, H * 0.08);
  g.save(); g.shadowColor = "#ffc46b"; g.shadowBlur = 10; g.fillStyle = "#ffc46b"; g.fillRect(W * 0.06, H * 0.6, W * 0.88, 3); g.restore();
  // The lectern.
  const lx = W - W * 0.16 - W * 0.13, ly = H * 0.42, lw = W * 0.13, lh = H * 0.18;
  const lgr = g.createLinearGradient(lx, 0, lx + lw, 0);
  lgr.addColorStop(0, "#3a2214"); lgr.addColorStop(1, "#5a3820");
  g.fillStyle = lgr; g.fillRect(lx, ly, lw, lh);
  g.fillStyle = "#f6c445"; g.fillRect(lx, ly, lw, 3);
  // Round tables with lamps in the dark in front.
  for (const [px, py] of [[14, 74], [50, 78], [86, 74], [30, 90], [70, 90]]) {
    const x = (px / 100) * W, y = (py / 100) * H;
    g.save(); g.shadowColor = "rgba(255,160,64,0.45)"; g.shadowBlur = 24;
    g.fillStyle = "#ffcf7a"; g.beginPath(); g.arc(x, y + 6, 6, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save(); g.globalAlpha = 0.85; g.fillStyle = "#e8dfcf";
    g.beginPath(); g.ellipse(x, y + 12 + 11, 55, 11, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
