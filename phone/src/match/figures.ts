/**
 * HOW A PLAYER IS DRAWN ON THE PHONE'S PITCH — the website's match figure
 * (CanvasMatch paintFootballer → lib/star/matchFigure.ts drawMatchFigure, the
 * 3D sprite look): the soft contact shadow, then the sprite of the right clip,
 * facing and frame (match/sprites.ts). Which clip, as CanvasMatch's
 * spriteHint and keeper branch pick it (the old clips: Animations "New"
 * touch/pass/shot clips live in atlas 1, not bundled yet):
 *   - each man's speed and facing from how far he moved since last frame,
 *     with the same smoothing, hysteresis and thresholds;
 *   - sprint over 4.8 m/s, jog over 0.6, else idle (facing the ball);
 *   - you: the kick clip for KICK_POSE_S after your strike;
 *   - after a goal, the scorers' side celebrates;
 *   - the keeper: ready, a dive (diveL / diveR by side) once he lunges.
 * Sizes are the website's: a man is MATCH_FIGURE_R_MULT × NEW_FIGURE_SCALE ×
 * MATCH_FIGURE_HEIGHT_R × SPRITE_HEIGHT_K of the camera's metre, divided by
 * the fixed-figure zoom (matchView FIXED_FIGURES); the keeper is
 * MATCH_KEEPER_R_SHARE × NEW_KEEPER_GROW of that.
 * Until the sheet has loaded, the old shapes (a shadow, a shirt, a head).
 */
import type { SkCanvas } from "@shopify/react-native-skia";
import { MATCH_FIGURE_R_MULT, MATCH_FIGURE_HEIGHT_R, MATCH_KEEPER_R_SHARE, FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import { NEW_FIGURE_SCALE, NEW_OUTFIELD_SHRINK, NEW_KEEPER_GROW, NEW_VIEW_WIDTH_M, REFERENCE_CAMERA_M } from "@/lib/star/matchView";
import { SPRITE_HEIGHT_K } from "@/lib/star/matchFigure";
import { sk, fill, stroke } from "./skiaApi";
import { toScreen, type Cam } from "./view";
import { drawSprite, drawFigureShadow, spritesReady, spriteKickStrikeT, keeperDiveClip, type SpriteClip, type SpriteKit } from "./sprites";

export type FigureRole = "you" | "mate" | "opp" | "keeper";
export interface FigureLook { shirt: string; trim: string }

/** stages/TrialPenalties KICK_POSE_S: how long your kick pose shows after the strike. */
const KICK_POSE_S = 0.28;
/** figureDivFor with FIXED_FIGURES on: the same man in metres whatever the camera. */
const FIG_DIV = NEW_VIEW_WIDTH_M / REFERENCE_CAMERA_M;

interface Motion { x: number; y: number; t: number; vx: number; vy: number; dist: number; facing: number }
const motion = new Map<string, Motion>();
let sceneKey: unknown = null;
let frame = { now: 0, ball: { x: 0, y: 0 }, celebrate: null as "us" | "them" | null, kickT: null as number | null };

/** Once per drawn frame: the clock (s), the ball, who scored, how long since your strike. A new chance clears the men's motion. */
export function beginFigures(key: unknown, f: typeof frame) {
  if (key !== sceneKey) { motion.clear(); sceneKey = key; }
  frame = f;
}

function spriteSeed(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return (Math.abs(h) % 997) / 97; }
function kitOf(look: FigureLook): SpriteKit { return { shirt: look.shirt, shorts: look.trim, socks: look.shirt }; }

/** The camera's px per metre across the screen. */
export function unitPx(cam: Cam): number {
  const across = cam.facing === "up" ? cam.vp.x2 - cam.vp.x1 : cam.vp.y2 - cam.vp.y1;
  return cam.W / across;
}
/** CanvasMatch R (a man's base radius) at a point, px. */
function manR(cam: Cam, k: number) { return (unitPx(cam) / FIG_DIV) * MATCH_FIGURE_R_MULT * NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK * k; }
/** figureRForHeight. */
const rForHeight = (h: number) => Math.max(6, h / FIGURE_HEIGHT_R);

/** One outfield man at pitch point `p`. `id` keeps his motion from frame to frame (CanvasMatch's sid). */
export function drawMan(c: SkCanvas, cam: Cam, id: string, p: { x: number; y: number }, role: FigureRole, look: FigureLook, highlight = false) {
  const s = toScreen(cam, p);
  const r = rForHeight(manR(cam, s.k) * MATCH_FIGURE_HEIGHT_R);
  if (!spritesReady()) { oldFigure(c, s.X, s.Y, r * 0.42, role, look, highlight); return; }
  const now = frame.now;
  let m = motion.get(id);
  if (!m) { m = { x: p.x, y: p.y, t: now, vx: 0, vy: 0, dist: 0, facing: NaN }; motion.set(id, m); }
  const dt = now - m.t;
  if (dt > 0) {
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
    if (dt < 0.25 && d < 4) {
      const k = Math.min(1, dt * 8);
      m.vx += (dx / dt - m.vx) * k; m.vy += (dy / dt - m.vy) * k;
      m.dist += d;
    } else { m.vx = 0; m.vy = 0; }
    m.x = p.x; m.y = p.y; m.t = now;
  }
  const angle = (wx: number, wy: number) => { const b = toScreen(cam, { x: wx, y: wy }); return Math.atan2(b.Y - s.Y, b.X - s.X); };
  const speed = Math.hypot(m.vx, m.vy);
  let facing: number;
  const ball = frame.ball;
  if (speed > 0.6) facing = angle(p.x + m.vx, p.y + m.vy);
  else if (Math.hypot(ball.x - p.x, ball.y - p.y) > 0.25) facing = angle(ball.x, ball.y);
  else facing = Number.isFinite(m.facing) ? m.facing : -Math.PI / 2;
  if (Number.isFinite(m.facing)) {
    const diff = Math.atan2(Math.sin(facing - m.facing), Math.cos(facing - m.facing));
    if (Math.abs(diff) < 0.3) facing = m.facing;
  }
  m.facing = facing;
  let clip: SpriteClip, t: number;
  const them = role === "opp";
  if (role === "you" && frame.kickT !== null && frame.kickT < KICK_POSE_S) {
    clip = "kick"; t = Math.max(0, spriteKickStrikeT() - 0.12 + frame.kickT);
  } else if (frame.celebrate && frame.celebrate === (them ? "them" : "us")) {
    clip = "celebrate"; t = now + spriteSeed(id);
  } else if (speed > 4.8) { clip = "sprint"; t = m.dist / 5.2; }
  else if (speed > 0.6) { clip = "jog"; t = m.dist / 2.8; }
  else { clip = "idle"; t = now + spriteSeed(id); }
  const height = r * FIGURE_HEIGHT_R * SPRITE_HEIGHT_K;
  drawFigureShadow(c, s.X, s.Y, r);
  drawSprite(c, s.X, s.Y, { char: "player", clip, t, facing, kit: kitOf(look), height });
  if (highlight) c.drawCircle(s.X, s.Y - height - r * 0.35, Math.max(2, r * 0.16), fill("#fde68a"));
}

let diveStart: { key: unknown; t: number } | null = null;
/** The keeper: standing ready, or diving once he lunges (CanvasMatch's keeper branch). `lunge` 0..1, `side` the dive's sign. */
export function drawKeeperFig(c: SkCanvas, cam: Cam, at: { x: number; y: number }, lunge: number, side: number, look: FigureLook) {
  const s = toScreen(cam, at);
  const KR = manR(cam, s.k) * MATCH_KEEPER_R_SHARE * (NEW_KEEPER_GROW / NEW_OUTFIELD_SHRINK);
  const kr = rForHeight(KR * MATCH_FIGURE_HEIGHT_R);
  if (!spritesReady()) { oldFigure(c, s.X, s.Y, kr * 0.42, "keeper", look, false); return; }
  const now = frame.now;
  const out = toScreen(cam, { x: at.x, y: at.y + 1 });
  const kFacing = Math.atan2(out.Y - s.Y, out.X - s.X);
  let clip: SpriteClip = "ready", t = now * 0.6, centre = 0;
  if (lunge > 0.04 && side !== 0) {
    if (!diveStart || diveStart.key !== sceneKey) diveStart = { key: sceneKey, t: now };
    t = Math.min(lunge * 0.6, (now - diveStart.t) * 0.75);
    const b = toScreen(cam, { x: at.x + side, y: at.y });
    clip = keeperDiveClip(kFacing, b.X - s.X, b.Y - s.Y);
    centre = Math.min(1, t / 0.4);
  } else diveStart = null;
  const height = kr * FIGURE_HEIGHT_R * SPRITE_HEIGHT_K;
  drawFigureShadow(c, s.X, s.Y, kr);
  drawSprite(c, s.X, s.Y, { char: "keeper", clip, t, facing: kFacing, kit: kitOf(look), height, centre });
}

/** The phone's first drawing, kept for the moment before the sheet has loaded. */
function oldFigure(c: SkCanvas, x: number, y: number, r: number, role: FigureRole, look: FigureLook, highlight: boolean) {
  c.drawOval(sk().XYWHRect(x - r * 1.1, y - r * 0.35, r * 2.2, r * 0.7), fill("rgba(0,0,0,0.28)"));
  c.drawCircle(x, y - r * 0.9, r, fill(look.shirt));
  c.drawCircle(x, y - r * 0.9, r, stroke(look.trim, Math.max(1, r * 0.18)));
  c.drawCircle(x, y - r * 2.05, r * 0.55, fill(role === "keeper" ? "#f1c27d" : "#e0ac69"));
  if (highlight) c.drawCircle(x, y - r * 0.9, r * 1.45, stroke("#f5c542", Math.max(1.5, r * 0.22)));
}
