import type * as THREE from "three";

/**
 * The big screen behind the awards-night stage (lib/star/awardsNight3d.ts):
 * the award's name, the nominees, the winner, written onto a picture the 3D
 * screen shows. Kept out of the 3D scene's own file so that file holds no 2D
 * canvas (the one-engine guard reads a 2D canvas plus a frame loop as a game loop).
 */
export interface ScreenWords {
  /** Small line at the top ("Season 3 Awards"). */
  kicker: string;
  /** The big line (the award, or the winner). */
  title: string;
  /** Up to three lines under it (the nominees). */
  lines?: string[];
  /** Gold glow when the winner is up. */
  gold?: boolean;
}

export function makeScreenTexture(T: typeof import("three")): { texture: THREE.CanvasTexture; draw(w: ScreenWords): void } {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d")!;
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  let last = "";
  const fit = (text: string, max: number, size: number, weight = 900) => {
    let s = size;
    g.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    while (g.measureText(text).width > max && s > 20) { s -= 4; g.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`; }
  };
  return {
    texture,
    draw(w) {
      const key = JSON.stringify(w);
      if (key === last) return;
      last = key;
      // A deep warm backdrop with a soft glow in the middle.
      const bg = g.createRadialGradient(512, 260, 40, 512, 288, 620);
      bg.addColorStop(0, w.gold ? "#4a2a06" : "#2a1410");
      bg.addColorStop(1, "#0b0606");
      g.fillStyle = bg;
      g.fillRect(0, 0, 1024, 576);
      g.strokeStyle = "rgba(246,196,69,.55)";
      g.lineWidth = 6;
      g.strokeRect(22, 22, 980, 532);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#f6c445";
      fit(w.kicker.toUpperCase(), 860, 40, 800);
      g.fillText(w.kicker.toUpperCase(), 512, 90);
      const lines = w.lines ?? [];
      g.fillStyle = "#ffffff";
      if (w.gold) { g.shadowColor = "rgba(251,191,36,.9)"; g.shadowBlur = 30; }
      fit(w.title.toUpperCase(), 900, lines.length ? 84 : 110);
      g.fillText(w.title.toUpperCase(), 512, lines.length ? 200 : 300);
      g.shadowBlur = 0;
      g.fillStyle = "#f3e3c3";
      lines.forEach((l, i) => { fit(l, 860, 50, 700); g.fillText(l, 512, 318 + i * 74); });
      texture.needsUpdate = true;
    },
  };
}
