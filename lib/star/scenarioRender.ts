import {
  PITCH_W, HALF_LEN, CX, POST_L, POST_R, NET_DEPTH, GOAL_H,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
  PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R,
} from "./pitch";
import type { ScenarioSide } from "./scenarios";

/**
 * DRAWING A SCENARIO THE WAY A REAL MATCH LOOKS.
 *
 * Requested directly, with a real gameplay screenshot as the reference: the
 * scenario editor drew a flat schematic (plain coloured dots on a lined
 * diagram) and it should instead look like an actual highlight — grass,
 * kit-coloured players drawn as real little figures, the goal — so a
 * scenario can be judged by eye the way a real one would be.
 *
 * This is a SEPARATE, standalone renderer, not an import from
 * CanvasMatch.tsx — deliberately. That component's rendering is the one
 * players actually see every match, already tuned against a real reference
 * image across many sessions, and its drawing code is threaded through
 * live refs (canvas size, camera shake, a spinning ball image, motion-
 * inferred running poses) that exist for a live 90-minute simulation, not a
 * static, hand-placed layout. Reusing it directly would mean either
 * touching that delicate code for a second, unrelated caller, or wiring up
 * a pile of fake refs just to satisfy its signature — real risk to the one
 * thing that must never break, for a dev-only editor's sake. This file
 * copies the VISUAL technique instead: the same palette, the same "flat
 * overhead camera, one metre is one metre everywhere" projection
 * (`toPx`/`Viewport`/`Facing`, matching canvasEngine.ts's own model
 * exactly), and the same hand-drawn stick-figure kit — so a scenario looks
 * like the real thing without either file depending on the other.
 */

export interface Viewport {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Which way the frame is turned — the exact three the real match supports,
 *  a discrete quarter-turn rather than a free angle (see ScenarioCamera's
 *  own note on why: there is no free-rotation camera in the real engine to
 *  match against). */
export type Facing = "up" | "left" | "right";

// Knowitball match identity — sampled off the same real reference
// CanvasMatch.tsx's own palette was, so a scenario built here and a real
// highlight are lit the same way.
const C = {
  pitch: "#1f9006",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  you: "#10b981",
  youRim: "#065f46",
  mate: "#3b82f6",
  mateRim: "#1e3a5f",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
};

const SIDE_KIT: Record<ScenarioSide, { shirt: string; rim: string }> = {
  you: { shirt: C.you, rim: C.youRim },
  teammate: { shirt: C.mate, rim: C.mateRim },
  opponent: { shirt: C.opp, rim: C.oppRim },
};

const GRASS_TILE = 96;
let cachedGrassTile: HTMLCanvasElement | null = null;

/** A near-invisible tile of grass grain — see CanvasMatch.tsx's own copy of
 *  this for the measurements behind it. Cached module-wide: it is a fixed
 *  pattern, not randomised per paint, so there is only ever one to build. */
function grassTile(): HTMLCanvasElement | null {
  if (cachedGrassTile) return cachedGrassTile;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);
  }
  g.putImageData(img, 0, 0);
  cachedGrassTile = c;
  return c;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface ScenarioRenderPlayer {
  x: number;
  y: number;
  side: ScenarioSide;
  selected?: boolean;
}

export interface RenderScenarioOptions {
  viewport: Viewport;
  facing: Facing;
  players: ScenarioRenderPlayer[];
  /** Always drawn last (on top) and marked with the star — the human player
   *  is unambiguous even in a crowd, exactly as the real match marks him. */
  ball: { x: number; y: number };
  /** The same real ball photo the live match uses, if it happens to be
   *  loaded — falls back to a plain white disc otherwise, same as
   *  CanvasMatch.tsx does for the one frame before it loads. */
  ballImage?: HTMLImageElement | null;
}

/**
 * Paint one static frame of a scenario onto `canvas`, sized to whatever the
 * canvas's own pixel dimensions already are (set those before calling this,
 * typically to match its CSS box times devicePixelRatio).
 */
export function renderScenario(canvas: HTMLCanvasElement, opts: RenderScenarioOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const vp = opts.viewport;
  const facing = opts.facing;
  const turned = facing !== "up";
  const unit = turned ? H / (vp.x2 - vp.x1) : W / (vp.x2 - vp.x1);
  const uy = turned ? W / (vp.y2 - vp.y1) : H / (vp.y2 - vp.y1);
  const heightScale = uy;

  // The exact same flat, one-metre-is-one-metre-everywhere projection the
  // real match uses (canvasEngine.ts's Viewport/Facing model) — see
  // CanvasMatch.tsx's own long note on why there is no perspective here at
  // all: the reference this whole game is built against is shot dead flat.
  const toPx = (x: number, y: number): { px: number; py: number; scale: number } => {
    const fx = (x - vp.x1) / (vp.x2 - vp.x1);
    const fy = (y - vp.y1) / (vp.y2 - vp.y1);
    if (facing === "right") return { px: (1 - fy) * W, py: fx * H, scale: 1 };
    if (facing === "left") return { px: fy * W, py: (1 - fx) * H, scale: 1 };
    return { px: fx * W, py: fy * H, scale: 1 };
  };

  const P = toPx;
  const pLine = (x1: number, y1: number, x2: number, y2: number) => {
    const a = P(x1, y1), b = P(x2, y2);
    ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
  };
  const pRect = (x1: number, y1: number, x2: number, y2: number) => {
    const a = P(x1, y1), b = P(x2, y2);
    ctx.strokeRect(a.px, a.py, b.px - a.px, b.py - a.py);
  };

  // ── Pitch ──
  ctx.fillStyle = C.pitch;
  ctx.fillRect(0, 0, W, H);

  const grass = grassTile();
  if (grass) {
    const pat = ctx.createPattern(grass, "repeat");
    if (pat) {
      const o = P(0, 0);
      ctx.save();
      ctx.translate(o.px % GRASS_TILE, o.py % GRASS_TILE);
      ctx.fillStyle = pat;
      ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
      ctx.restore();
    }
  }

  // Worn grass at the goalmouth, the spot, the centre — same measured
  // patches CanvasMatch.tsx uses.
  {
    const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
      const c = P(x, y);
      const g = ctx.createRadialGradient(c.px, c.py, 0, c.px, c.py, Math.max(rx, ry) * unit);
      g.addColorStop(0, `rgba(120,132,26,${alpha})`);
      g.addColorStop(1, "rgba(120,132,26,0)");
      ctx.save();
      ctx.translate(c.px, c.py);
      ctx.scale(1, ry / rx);
      ctx.translate(-c.px, -c.py);
      ctx.fillStyle = g;
      ctx.fillRect(c.px - rx * unit * 1.2, c.py - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
      ctx.restore();
    };
    wear(CX, 1.9, 6.2, 2.4, 0.22);
    wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16);
    wear(CX, HALF_LEN, 3.4, 2.4, 0.14);
  }

  // ── Markings ── every line at its real IFAB distance.
  const arcAngle = (pitchAngle: number) =>
    pitchAngle + (facing === "right" ? Math.PI / 2 : facing === "left" ? -Math.PI / 2 : 0);
  const lw = Math.max(1, unit * 0.12);
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.line;

  pLine(0, 0, PITCH_W, 0);
  pLine(0, 0, 0, HALF_LEN);
  pLine(PITCH_W, 0, PITCH_W, HALF_LEN);
  pRect(BOX_L, 0, BOX_R, BOX_DEPTH);
  pRect(SIX_L, 0, SIX_R, SIX_DEPTH);
  {
    const spot = P(CX, PEN_SPOT_Y);
    ctx.beginPath();
    ctx.arc(spot.px, spot.py, Math.max(1.5, unit * 0.11), 0, Math.PI * 2);
    ctx.fillStyle = C.line;
    ctx.fill();
    const half = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
    ctx.beginPath();
    ctx.arc(spot.px, spot.py, unit * ARC_R, arcAngle(Math.PI / 2 - half), arcAngle(Math.PI / 2 + half));
    ctx.stroke();
  }
  {
    const c1 = P(0, 0), c2 = P(PITCH_W, 0);
    ctx.beginPath(); ctx.arc(c1.px, c1.py, unit * CORNER_R, arcAngle(0), arcAngle(Math.PI / 2)); ctx.stroke();
    ctx.beginPath(); ctx.arc(c2.px, c2.py, unit * CORNER_R, arcAngle(Math.PI / 2), arcAngle(Math.PI)); ctx.stroke();
  }
  ctx.strokeStyle = C.lineFaint;
  pLine(0, HALF_LEN, PITCH_W, HALF_LEN);
  {
    const cc = P(CX, HALF_LEN);
    ctx.beginPath();
    ctx.arc(cc.px, cc.py, unit * CENTRE_R, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── The goal — the one this scenario faces, at the near goal line ──
  {
    const hpx = GOAL_H * heightScale;
    const bl = P(POST_L, 0), br = P(POST_R, 0);
    const tl = { px: bl.px, py: bl.py - hpx };
    const tr = { px: br.px, py: br.py - hpx };
    const rl = P(POST_L, -NET_DEPTH), rr = P(POST_R, -NET_DEPTH);
    const ul = { px: rl.px, py: rl.py - hpx };
    const ur = { px: rr.px, py: rr.py - hpx };

    type Pt = { px: number; py: number };
    const path = (q: Pt[]) => {
      ctx.beginPath();
      ctx.moveTo(q[0].px, q[0].py);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
      ctx.closePath();
    };
    const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
    const seg = (a2: Pt, b2: Pt) => { ctx.beginPath(); ctx.moveTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.stroke(); };
    const lerp = (a2: Pt, b2: Pt, f: number) => ({ px: a2.px + (b2.px - a2.px) * f, py: a2.py + (b2.py - a2.py) * f });
    const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
      ctx.save();
      path(q); ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = Math.max(0.7, unit * 0.028);
      for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
      for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
      ctx.restore();
    };

    const shOff = unit * 0.5;
    quad([rl, rr, br, bl].map(q => ({ px: q.px + shOff, py: q.py + shOff * 0.3 })), "rgba(0,0,0,0.09)");
    quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
    quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
    netting([rl, rr, ur, ul], 34, 10, 0.42);
    ctx.strokeStyle = "#0f1a14";
    ctx.lineWidth = Math.max(1.8, unit * 0.15);
    seg(rl, ul); seg(rr, ur); seg(ul, ur);
    quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
    netting([tl, tr, ur, ul], 34, 5, 0.8);

    ctx.lineCap = "round";
    ctx.strokeStyle = "#f6faf7";
    ctx.lineWidth = Math.max(1.8, unit * 0.12);
    seg(bl, tl); seg(br, tr);
    ctx.lineWidth = Math.max(2, unit * 0.16);
    seg(tl, tr);
    ctx.lineCap = "butt";

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1.5, unit * 0.11);
    pLine(POST_L, 0, POST_R, 0);
  }

  // ── Footballers — the same hand-drawn figure CanvasMatch.tsx uses ──
  const SKIN = "#c68642";
  const footballer = (x: number, y: number, rBase: number, shirt: string, rim: string, opts: {
    star?: boolean; shorts?: string;
  } = {}) => {
    const { px, py, scale } = toPx(x, y);
    const r = rBase * scale;
    const shorts = opts.shorts ?? rim;
    const lwLimb = Math.max(1.3, r * 0.24);

    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fill();

    ctx.save();
    ctx.translate(px, py - r * 0.8);
    ctx.lineCap = "round";
    ctx.lineWidth = lwLimb;

    ctx.strokeStyle = SKIN;
    const hipY = r * 0.18, legL = r * 0.62;
    ctx.beginPath(); ctx.moveTo(-r * 0.24, hipY); ctx.lineTo(-r * 0.24, hipY + legL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.24, hipY); ctx.lineTo(r * 0.24, hipY + legL); ctx.stroke();

    ctx.fillStyle = shorts;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36, r * 0.12);
    if (!ctx.roundRect) ctx.rect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36);
    ctx.fill();

    ctx.strokeStyle = SKIN;
    ctx.lineWidth = lwLimb * 0.85;
    const armOut = r * 0.52, armDrop = r * 0.24;
    ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.30); ctx.lineTo(-armOut, armDrop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.30); ctx.lineTo(armOut, armDrop); ctx.stroke();

    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72, r * 0.17);
    if (!ctx.roundRect) ctx.rect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = rim;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -r * 0.76, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.10);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
    ctx.restore();

    if (opts.star) {
      const sr = r * 0.23;
      const cx = px, cy = py - r * 2.15;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? sr : sr * 0.44;
        const sx = cx + Math.cos(ang) * rad, sy = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.5, sr * 0.34);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.restore();
    }
  };

  const rBase = Math.max(6, unit * 1.0);
  for (const p of opts.players) {
    const kit = SIDE_KIT[p.side];
    footballer(p.x, p.y, rBase, kit.shirt, kit.rim, { star: p.side === "you" });
    if (p.selected) {
      const { px, py, scale } = toPx(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, rBase * scale * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = Math.max(1.5, rBase * scale * 0.1);
      ctx.setLineDash([rBase * scale * 0.25, rBase * scale * 0.2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Ball — always drawn last, at the human player's feet ──
  {
    const { px, py, scale } = toPx(opts.ball.x, opts.ball.y);
    const bScale = Math.max(4.5, unit * 0.5) * scale;
    ctx.beginPath();
    ctx.ellipse(px, py, bScale * 1.05, bScale * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fill();
    const img = opts.ballImage;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, px - bScale, py - bScale, bScale * 2, bScale * 2);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, bScale, 0, Math.PI * 2);
      ctx.fillStyle = "#fefefe";
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
    }
  }
}

/**
 * Turn a scenario's own (centerX, centerY, viewHeight) framing into the
 * {x1,x2,y1,y2} rectangle `renderScenario` reads — the same relationship
 * canvasEngine.ts's own Viewport already has to a centre + height, using
 * the real match's own aspect ratio so a scenario built here previews at
 * the same width-to-height shape the real game actually frames a shot in.
 */
export const VIEW_ASPECT = 5 / 8;

export function viewportFor(centerX: number, centerY: number, viewHeight: number): Viewport {
  const w = viewHeight * VIEW_ASPECT;
  return {
    x1: centerX - w / 2, x2: centerX + w / 2,
    y1: centerY - viewHeight / 2, y2: centerY + viewHeight / 2,
  };
}

/** The exact inverse of `renderScenario`'s own projection — screen pixel
 *  (relative to the canvas's own drawing-buffer size) back to pitch metres.
 *  Used for hit-testing and dragging against the canvas. */
export function pitchFromPx(px: number, py: number, W: number, H: number, vp: Viewport, facing: Facing): { x: number; y: number } {
  const fx0 = px / W, fy0 = py / H;
  let fx: number, fy: number;
  if (facing === "right") { fx = fy0; fy = 1 - fx0; }
  else if (facing === "left") { fx = 1 - fy0; fy = fx0; }
  else { fx = fx0; fy = fy0; }
  return {
    x: clamp(fx * (vp.x2 - vp.x1) + vp.x1, 0, PITCH_W),
    y: clamp(fy * (vp.y2 - vp.y1) + vp.y1, 0, HALF_LEN * 2),
  };
}

/** The exact forward projection, for hit-testing "which player is under the
 *  pointer" against their real on-screen position. */
export function pxFromPitch(x: number, y: number, W: number, H: number, vp: Viewport, facing: Facing): { px: number; py: number } {
  const fx = (x - vp.x1) / (vp.x2 - vp.x1);
  const fy = (y - vp.y1) / (vp.y2 - vp.y1);
  if (facing === "right") return { px: (1 - fy) * W, py: fx * H };
  if (facing === "left") return { px: fy * W, py: (1 - fx) * H };
  return { px: fx * W, py: fy * H };
}
