import type { Vec2 } from "../canvasEngine";
import { BALL_R } from "../pitch";
import { drawPlayerHead } from "../drawPlayerHead";
import type { FaceStyle } from "../faceStyle";
import type { FakeFaceStyle } from "../fakeFaceStyle";
import type { MatchRules } from "./rules";
import { FIVE_HALFWAY_Y } from "./geometry";

/**
 * DRAWING A SMALL-SIDED MATCH.
 *
 * Pitch, goals, net, figures and ball, for a game that fits in one frame.
 *
 * ── Why this is its own renderer ──
 *
 * The match screen (`CanvasMatch.tsx`) is 4,500 lines and is the one component
 * in this game that must never break. Threading a "small-sided mode" through
 * it would mean every future match feature needing an "unless five-a-side"
 * guard, or silently breaking the trial. So this is a separate renderer, which
 * is this codebase's own settled answer — `CanvasMatchTest`, `TrialPenalty`
 * and `FirstPersonDribble` are all the same decision.
 *
 * ── The honest cost of that, stated ──
 *
 * It makes this the THIRD copy of "draw a pitch that looks like the real one".
 * That is a real maintenance cost: a change to how grass or a net looks now
 * has three homes. It is written as plain functions over a context rather than
 * baked into a component precisely so that, if a fourth ever wants it, the
 * extraction is a move rather than a rewrite.
 *
 * The markings are genuinely small-sided rather than a shrunken eleven-a-side
 * pitch: a halfway line with no centre circle worth drawing at this scale, and
 * a D-shaped area at each end instead of a six-yard and penalty box.
 */

const TC = {
  pitch: "#1f9006",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  post: "#f8fafc",
  net: "rgba(255,255,255,0.30)",
  ball: "#ffffff",
  ballSeam: "rgba(20,20,20,0.55)",
  shadow: "rgba(0,0,0,0.28)",
};

const GRASS_TILE = 96;
let grassTile: HTMLCanvasElement | null | undefined;

/** A very fine, fixed grain so the pitch does not read as printed card —
 *  tiled from one procedural pattern so it never shimmers between frames. */
function makeGrassTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "rgba(0,0,0,0)";
  g.fillRect(0, 0, GRASS_TILE, GRASS_TILE);
  // A fixed pseudo-random spatter, not Math.random — a tile that differed
  // between reloads would make the pitch look like it was breathing.
  let s = 1234567;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * GRASS_TILE, y = rnd() * GRASS_TILE;
    g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0.028)";
    g.fillRect(x, y, 1, 1);
  }
  return c;
}

/** Everything a draw call needs to turn pitch metres into pixels. */
export interface Projection {
  px: (x: number) => number;
  py: (y: number) => number;
  /** Pixels per metre — the same on both axes, or every distance on screen
   *  lies about itself. */
  unit: number;
  W: number;
  H: number;
}

export function projectionFor(rules: MatchRules, W: number, H: number): Projection {
  const vp = rules.view;
  const sx = W / (vp.x2 - vp.x1);
  const sy = H / (vp.y2 - vp.y1);
  return {
    px: (x: number) => (x - vp.x1) * sx,
    py: (y: number) => (y - vp.y1) * sy,
    unit: Math.min(sx, sy),
    W, H,
  };
}

export function drawPitch(ctx: CanvasRenderingContext2D, rules: MatchRules, p: Projection): void {
  const { px, py, unit, W, H } = p;
  const { pitch } = rules;

  ctx.fillStyle = TC.pitch;
  ctx.fillRect(0, 0, W, H);

  if (grassTile === undefined) grassTile = makeGrassTile();
  if (grassTile) {
    const pat = ctx.createPattern(grassTile, "repeat");
    if (pat) {
      ctx.save();
      ctx.translate(px(0) % GRASS_TILE, py(0) % GRASS_TILE);
      ctx.fillStyle = pat;
      ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
      ctx.restore();
    }
  }

  // Worn grass in front of each goal — the wear a season leaves, and most of
  // what stops a pitch looking printed.
  const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
    const cx = px(x), cy = py(y);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * unit);
    g.addColorStop(0, `rgba(120,132,26,${alpha})`);
    g.addColorStop(1, "rgba(120,132,26,0)");
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.fillRect(cx - rx * unit * 1.3, cy - rx * unit * 1.3, rx * unit * 2.6, rx * unit * 2.6);
    ctx.restore();
  };
  const goalMid = (rules.goal.x1 + rules.goal.x2) / 2;
  wear(goalMid, pitch.y1 + 1.6, 4.2, 1.8, 0.2);
  wear(goalMid, pitch.y2 - 1.6, 4.2, 1.8, 0.2);

  ctx.strokeStyle = TC.line;
  ctx.lineWidth = Math.max(1.5, unit * 0.1);

  // Touchlines and goal lines.
  ctx.strokeRect(px(pitch.x1), py(pitch.y1), (pitch.x2 - pitch.x1) * unit, (pitch.y2 - pitch.y1) * unit);

  // Halfway line. No centre circle: on a 24 m pitch a real 9.15 m circle would
  // be most of the width, and small-sided pitches do not have one.
  const mid = (pitch.y1 + pitch.y2) / 2;
  ctx.beginPath();
  ctx.moveTo(px(pitch.x1), py(mid));
  ctx.lineTo(px(pitch.x2), py(mid));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px((pitch.x1 + pitch.x2) / 2), py(mid), unit * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = TC.line;
  ctx.fill();

  // A D at each end instead of a box — the small-sided marking.
  const dR = Math.min(6, (pitch.x2 - pitch.x1) / 4);
  ctx.strokeStyle = TC.lineFaint;
  for (const [y, from, to] of [[pitch.y1, 0, Math.PI], [pitch.y2, Math.PI, Math.PI * 2]] as const) {
    ctx.beginPath();
    ctx.arc(px(goalMid), py(y), dR * unit, from, to);
    ctx.stroke();
  }
}

/** The goal you are attacking, at `y = pitch.y1`, with its net. */
export function drawGoal(
  ctx: CanvasRenderingContext2D, rules: MatchRules, p: Projection,
  atY: number, depth = 1.2,
): void {
  const { px, py, unit } = p;
  const { goal } = rules;
  const behind = atY === rules.pitch.y1 ? -1 : 1;

  // Net.
  ctx.save();
  ctx.beginPath();
  ctx.rect(px(goal.x1), py(atY + (behind < 0 ? -depth : 0)), (goal.x2 - goal.x1) * unit, depth * unit);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(px(goal.x1), py(atY - depth), (goal.x2 - goal.x1) * unit, depth * 2 * unit);
  ctx.strokeStyle = TC.net;
  ctx.lineWidth = 1;
  const step = Math.max(4, unit * 0.32);
  for (let x = px(goal.x1); x <= px(goal.x2); x += step) {
    ctx.beginPath(); ctx.moveTo(x, py(atY - depth)); ctx.lineTo(x, py(atY + depth)); ctx.stroke();
  }
  for (let y = py(atY - depth); y <= py(atY + depth); y += step) {
    ctx.beginPath(); ctx.moveTo(px(goal.x1), y); ctx.lineTo(px(goal.x2), y); ctx.stroke();
  }
  ctx.restore();

  // Posts.
  ctx.strokeStyle = TC.post;
  ctx.lineWidth = Math.max(2, unit * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px(goal.x1), py(atY));
  ctx.lineTo(px(goal.x1), py(atY + behind * -depth));
  ctx.moveTo(px(goal.x2), py(atY));
  ctx.lineTo(px(goal.x2), py(atY + behind * -depth));
  ctx.moveTo(px(goal.x1), py(atY));
  ctx.lineTo(px(goal.x2), py(atY));
  ctx.stroke();
  ctx.lineCap = "butt";
}

export interface FigureLook {
  shirt: string;
  shorts: string;
  trim: string;
  /** Drawn above the head when there is a real person here. */
  label?: string;
  face?: HTMLImageElement;
  /** A marker over your own figure, so you can always find yourself. */
  star?: boolean;
}

/**
 * One footballer, seen from above and slightly behind — the same read as the
 * main match's figures: a shirt, shorts, two legs and a head.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D, p: Projection, at: Vec2, look: FigureLook,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
): void {
  const { px, py, unit } = p;
  const x = px(at.x), y = py(at.y);
  const r = Math.max(6, unit * 0.62);

  // Shadow first, so everybody stands ON the pitch rather than floating.
  ctx.fillStyle = TC.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.18, r * 0.62, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs.
  ctx.strokeStyle = look.shorts;
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.2, y - r * 0.05); ctx.lineTo(x - r * 0.24, y + r * 0.2);
  ctx.moveTo(x + r * 0.2, y - r * 0.05); ctx.lineTo(x + r * 0.24, y + r * 0.2);
  ctx.stroke();

  // Shirt.
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.28, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();

  // Head — through the one shared function every other screen draws a head
  // with, so a face is cropped and outlined exactly as the Face Editor says.
  drawPlayerHead(ctx, x, y - r * 0.92, r * 0.3, r, look.face, faceStyle, fakeFaceStyle);

  if (look.star) {
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    const sr = r * 0.26, sy = y - r * 1.5;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? sr : sr * 0.45;
      const fx = x + Math.cos(a) * rad, fy = sy + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (look.label) {
    ctx.font = `700 ${Math.max(8, r * 0.36)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText(look.label, x, y - r * (look.star ? 1.95 : 1.42));
    ctx.fillStyle = "#ffffff";
    ctx.fillText(look.label, x, y - r * (look.star ? 1.95 : 1.42));
    ctx.textAlign = "start";
  }
}

export function drawBall(
  ctx: CanvasRenderingContext2D, p: Projection, at: Vec2, z = 0,
): void {
  const { px, py, unit } = p;
  const x = px(at.x), y = py(at.y);
  const lift = z * unit * 0.5;
  const r = Math.max(2.5, unit * BALL_R * 2.6 * (1 + z * 0.06));

  // Its shadow stays on the grass while it climbs, which is the only thing
  // that makes height readable from directly above.
  ctx.fillStyle = TC.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (1 - Math.min(0.4, z * 0.05)), r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TC.ball;
  ctx.beginPath();
  ctx.arc(x, y - lift, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TC.ballSeam;
  ctx.lineWidth = Math.max(0.6, r * 0.22);
  ctx.beginPath();
  ctx.arc(x - r * 0.18, y - lift - r * 0.18, r * 0.42, 0.4, 2.6);
  ctx.stroke();
}

/** The aim arrow, while you are dragging back from the ball. */
export function drawAim(
  ctx: CanvasRenderingContext2D, p: Projection, from: Vec2, dir: Vec2, power: number,
): void {
  const { px, py, unit } = p;
  const len = unit * (3 + power * 9);
  const n = Math.hypot(dir.x, dir.y) || 1;
  const ex = px(from.x) + (dir.x / n) * len;
  const ey = py(from.y) + (dir.y / n) * len;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + power * 0.4})`;
  ctx.lineWidth = Math.max(2, unit * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px(from.x), py(from.y));
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.lineCap = "butt";
}

export { TC as FIVE_COLOURS, FIVE_HALFWAY_Y };
