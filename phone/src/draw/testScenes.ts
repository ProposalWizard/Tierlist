/**
 * The test pictures. tools/draw-check.ts draws them twice — once by a real browser
 * canvas (the website) and once by the phone's adapter (src/draw/ctx2d.ts on
 * Skia) — to compare them pixel by pixel. Each calls the same lib/star
 * drawers with the same arguments as the website's screens.
 */
import { drawFigureAt, drawKeeperAt } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { drawStyledHead } from "@/lib/star/figure3d";
import { drawManagerHead, managerLook } from "@/lib/star/managerFace";
import { drawMatchBall } from "@/lib/star/matchBall";
import { kitsOf } from "@/lib/star/kits";
import type { FittedHead } from "@/lib/star/faceFit";
import { paintHeadChip, paintPlayerFigure, type FigureArgs } from "./figurePaint";

export interface Env {
  layer(w: number, h: number): HTMLCanvasElement;
  /** The website's default fake face, fitted by lib/star/faceFit.ts fitFace on each side (null if it could not be). */
  fitted: FittedHead | null;
}
export interface Scene {
  name: string; w: number; h: number;
  /** Pixels per point the scene was made for (hero scenes size themselves like PlayerAvatar, at 2). Default 1. */
  dpr?: number;
  /** Draw as the phone would: false = no `document` while drawing (only PlayerFigure needs one... see offscreen). */
  offscreen: boolean;
  draw(ctx: CanvasRenderingContext2D, env: Env): void;
}

const ars = kitsOf("Arsenal").home, mun = kitsOf("Manchester United").home, hr = kitsOf("Hampton & Richmond Borough").home;

function hero(name: string, extra: Partial<FigureArgs>, kit = ars): Scene {
  const width = 150, height = 220, dpr = 2;
  return {
    name, w: width * dpr, h: height * dpr, dpr, offscreen: true,
    draw: (ctx, env) => paintPlayerFigure(ctx, {
      width, height, dpr, kit, skin: "#c68642", number: 9, fitted: null, look: "A2", celebrate: false,
      view: "front", ball: true, firstName: "Sam", lastName: "Carter", ...extra,
      ...(extra.fitted === undefined ? {} : { fitted: env.fitted }),
    }, env.layer),
  };
}

export const SCENES: Scene[] = [
  {
    name: "api-basics", w: 320, h: 220, offscreen: false,
    draw: (g) => {
      g.fillStyle = "#14532d"; g.fillRect(0, 0, 320, 220);
      // gradients
      const lg = g.createLinearGradient(10, 10, 110, 60);
      lg.addColorStop(0, "gold"); lg.addColorStop(0.5, "rgba(255,0,0,0.5)"); lg.addColorStop(1, "hsl(220 80% 50%)");
      g.fillStyle = lg; g.fillRect(10, 10, 100, 50);
      const rg = g.createRadialGradient(170, 40, 4, 175, 45, 34);
      rg.addColorStop(0, "#fff"); rg.addColorStop(1, "rgba(0,0,80,0.2)");
      g.fillStyle = rg; g.beginPath(); g.arc(170, 40, 30, 0, Math.PI * 2); g.fill();
      // arcs, ellipse, roundRect, arcTo under a skewed, rotated transform
      g.save(); g.translate(250, 45); g.rotate(0.3); g.transform(1, 0, 0.3, 1, 0, 0);
      g.strokeStyle = "#fde68a"; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); g.ellipse(0, 0, 35, 18, 0.4, 0.2, Math.PI * 1.6); g.stroke();
      g.restore();
      g.fillStyle = "#38bdf8"; g.beginPath(); g.roundRect(12, 75, 90, 40, [12, 4, 20, 0]); g.fill();
      g.strokeStyle = "white"; g.lineWidth = 3; g.beginPath(); g.moveTo(120, 115); g.arcTo(160, 70, 200, 115, 18); g.lineTo(200, 115); g.stroke();
      // dashes and a quadratic/bezier
      g.setLineDash([8, 5]); g.lineDashOffset = 2; g.strokeStyle = "#f472b6"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(215, 80); g.quadraticCurveTo(260, 60, 305, 100); g.bezierCurveTo(280, 130, 240, 90, 215, 120); g.stroke();
      g.setLineDash([]);
      // clip (evenodd ring) + alpha
      g.save(); g.beginPath(); g.arc(50, 170, 36, 0, Math.PI * 2); g.arc(50, 170, 16, 0, Math.PI * 2); g.clip("evenodd");
      g.globalAlpha = 0.7; g.fillStyle = "#facc15"; g.fillRect(0, 120, 110, 100); g.restore();
      // composite modes on their own layer
      g.save(); g.beginPath(); g.rect(110, 130, 100, 80); g.clip();
      g.fillStyle = "#ef4444"; g.beginPath(); g.arc(145, 170, 28, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-atop"; g.fillStyle = "#3b82f6"; g.fillRect(150, 140, 50, 60);
      g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(140, 165, 10, 0, Math.PI * 2); g.fill();
      g.restore();
      // text
      g.font = "bold 22px DejaVu Sans"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,0.6)"; g.strokeText("GOAL 9", 265, 170); g.fillStyle = "#fff"; g.fillText("GOAL 9", 265, 170);
      g.strokeStyle = "#000"; g.lineWidth = 1; g.strokeRect(215.5, 145.5, 100, 50);
      g.clearRect(300, 200, 20, 20);
    },
  },
  ...[["p-101", ars], ["p-202", mun], ["Jordan Smith", hr]].map(([id, k], i): Scene => ({
    name: `head-chip-${i}`, w: 96, h: 96, offscreen: false,
    draw: (g) => paintHeadChip(g, { id: id as string, shirt: (k as typeof ars).shirt, shorts: (k as typeof ars).trim, trim: (k as typeof ars).trim, size: 96 }),
  })),
  {
    name: "figure-3d", w: 200, h: 220, offscreen: false,
    draw: (g) => {
      g.fillStyle = "#166534"; g.fillRect(0, 0, 200, 220);
      drawFigureAt(g, 60, 190, 60, { shirt: mun.shirt, shorts: "#ffffff", trim: mun.trim, id: "p-7", label: "Rashford", star: true }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { label: "Rashford", star: true, starRim: "#000" });
      drawKeeperAt(g, 150, 190, 50, { shirt: "#22c55e", shorts: "#111827", trim: "#000000", id: "gk-1" }, { dive: 0.6, lunge: 0.7 }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE);
    },
  },
  {
    name: "figure-classic", w: 160, h: 200, offscreen: false,
    draw: (g) => {
      g.fillStyle = "#166534"; g.fillRect(0, 0, 160, 200);
      drawFigureAt(g, 80, 180, 55, { shirt: ars.shirt, shorts: "#ffffff", trim: ars.trim }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { skin: "classic", facing: 0.3 });
    },
  },
  {
    name: "styled-heads", w: 300, h: 110, offscreen: false,
    draw: (g) => {
      ["a", "b", "carl", "dee", "eve"].forEach((k, i) => drawStyledHead(g, 30 + i * 60, 95, 55, ["#f1c7a5", "#c68642", "#8d5524", "#e0ac86", "#6b3e1f"][i], k));
    },
  },
  {
    name: "manager-head", w: 120, h: 130, offscreen: false,
    draw: (g) => drawManagerHead(g, 60, 115, 70, managerLook("Gary Neville")),
  },
  {
    name: "match-ball", w: 120, h: 120, offscreen: false,
    draw: (g) => { g.fillStyle = "#15803d"; g.fillRect(0, 0, 120, 120); drawMatchBall(g, 55, 75, 55, 22, 0.7, 1.2, 1); },
  },
  hero("hero-a2", {}),
  hero("hero-a2-celebrate", { celebrate: true }, mun),
  hero("hero-back", { view: "back" }),
  hero("hero-a1", { look: "A1" }, hr),
  // `fitted: null` here means "use env.fitted": his photo fitted to the body (the website's Home default).
  hero("hero-a2-fitted", { fitted: null }),
  hero("hero-back-fitted", { fitted: null, view: "back" }, mun),
];
