/**
 * 2D GOAL VIDEOS — THE SAME RECORDING, SEEN FROM ABOVE (Leo's switch part
 * "videos2d", lib/star/leoUpdate.ts; Leo, 31 Oct 2026: "have a 2d option").
 *
 * In place of the TV picture (render.ts drawScene: stadium, 3D-style camera),
 * this draws the recorded goal (track.ts) top-down on a flat striped pitch,
 * like the 2D match: the game's own figures (sprites.ts, made for a camera
 * above the pitch) in the club kits, a contact shadow, the keeper's dive,
 * the ball with its shadow (higher = further from it, bigger) and a trail
 * behind it, the net rippling where the ball went in.
 *
 * Only the picture under the graphics changes. The edit (edit.ts /
 * editBetter.ts: which shots, how slow, the replays, captions, cards, zoom
 * punch, shake, flashes) and the sound are the same, because drawEditFrame
 * and drawBetterFrame call this in place of drawScene when `edit.flat`.
 *
 * The camera follows the ball with a gentle zoom and always keeps the ball
 * (on a "tight" shot: the scorer) in the picture. A shot's camera name
 * (edit.ts ClipAngle) only changes how close and which way up: a replay
 * "from behind the goal" is closer to the goal, a "reverse angle" is turned
 * round. Any camera name it does not know is the plain follow, so a new
 * edit style works with no change here.
 *
 * Pure drawing from the recording and the clip time: no DOM (runs in the
 * video worker on an OffscreenCanvas), nothing random, the same frame every time.
 */
import { CX, POST_L, POST_R, PITCH_W, HALF_LEN, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R } from "../pitch";
import {
  drawSprite, drawSpriteShadow, spritesReady, spriteKickStrikeT, spriteClipLength, spriteClipReady, spriteClipFps,
  keeperDiveClip, type SpriteClip,
} from "../sprites";
import { outfieldSpriteClip, keeperDiveClipNew, sideOfDive } from "../sprite3dAnim";
import { drawFigureAt, figureRForHeight } from "../fiveASide/render";
import { DEFAULT_FACE_STYLE } from "../faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "../fakeFaceStyle";
import { planCelebration, celebAt, CELEB_SPECS, type CelebrationMove } from "../celebration";
import { frameAt, trackDuration, type GoalTrack, type FrameState } from "./track";
import { smoothBall, type ClipAngle } from "./cameras";
import { prepOf, ranAt, type Prep } from "./render";
import type { Edit, Shot } from "./edit";

/** Turn an edit into its 2D version (or leave it exactly as it is). */
export function withFlat(edit: Edit, on: boolean): Edit {
  return on ? { ...edit, flat: true } : edit;
}

// ── The camera ─────────────────────────────────────────────────────────────

export interface Cam2D {
  /** The pitch point (metres) at the middle of the picture. */
  cx: number;
  cy: number;
  /** Pixels per metre. */
  unit: number;
  /** How far the pitch is turned on screen (0: the goal at the top). */
  rot: number;
  W: number;
  H: number;
}

/** Metres of pitch across the picture's short side, before any zoom. */
const ACROSS_TALL = 34;
const ACROSS_WIDE = 27;
/** How a shot's camera name changes the 2D camera. Unknown names: the plain follow. */
const LOOK: Partial<Record<ClipAngle, { zoom: number; flip?: boolean; goal?: number }>> = {
  high: { zoom: 0.88 }, spider: { zoom: 0.88 }, match: { zoom: 0.7 },
  net: { zoom: 1.28, goal: 0.25 }, reverse: { zoom: 1.12, flip: true }, side: { zoom: 1.15 },
  strike: { zoom: 1.45 }, tight: { zoom: 1.55 }, follow: { zoom: 1.08 },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth01 = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };

function scorerIndex(track: GoalTrack): number {
  const id = track.meta.scorerBody ?? (track.meta.isYou ? "you" : undefined);
  return id ? track.bodies.findIndex(b => b.id === id) : -1;
}

/** The 2D camera for `angle` at clip time `t`, for a W×H picture. */
export function flatCamera(track: GoalTrack, angle: ClipAngle, t: number, W: number, H: number): Cam2D {
  const look = LOOK[angle] ?? { zoom: 1 };
  const wide = W > H;
  const rot = (wide ? Math.PI / 2 : 0) + (look.flip ? Math.PI : 0);
  const dur = trackDuration(track);
  // The subject: the ball, or on a tight shot the scorer.
  const si = angle === "tight" ? scorerIndex(track) : -1;
  const at = (tt: number) => {
    const c = clamp(tt, 0, dur);
    const f = frameAt(track, c);
    return si >= 0 ? f.bodies[si] : f.ball;
  };
  let sx: number, sy: number;
  if (si >= 0) {
    sx = 0; sy = 0;
    for (let k = -3; k <= 3; k++) { const p = at(t + k * 0.08); sx += p.x / 7; sy += p.y / 7; }
  } else {
    const b = smoothBall(track, t, -0.45, 0.35, 10);
    sx = b.x; sy = b.y;
  }
  // Near the goal: a touch closer, and leaning towards the goal.
  const d = Math.hypot(sx - CX, Math.max(0, sy));
  const near = smooth01((28 - d) / 20);
  const unit = (Math.min(W, H) / (wide ? ACROSS_WIDE : ACROSS_TALL)) * look.zoom * (1 + 0.14 * near);
  // Half the picture in pitch metres, along pitch x and pitch y.
  const turned = Math.abs(Math.sin(rot)) > 0.5;
  const halfX = (turned ? H : W) / 2 / unit, halfY = (turned ? W : H) / 2 / unit;
  // Leaning towards the goal: near it, the goal line sits about 30% in from
  // the picture's goal end (clear of the captions at the very top).
  const pull = clamp((30 - d) / 30, 0, 1) * 0.3 + (look.goal ?? 0);
  let cx = sx + (CX - sx) * pull * 0.5;
  let cy = sy + (0.4 * halfY - sy) * pull;
  // Not much past the stands: behind the goal at most 60% of half the
  // picture (a tall phone picture shows the crowd behind it), 6 m past a touchline.
  const behind = Math.max(7, halfY * 0.6);
  cx = halfX >= 40 ? CX : clamp(cx, -6 + halfX, PITCH_W + 6 - halfX);
  cy = clamp(cy, halfY - behind, 2 * HALF_LEN + behind - halfY);

  // The subject always in the picture, a little ahead (where it is going in
  // the next third of a second), clear of the edges where the graphics sit.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const up = { x: -Math.sin(rot), y: -Math.cos(rot) };   // the pitch way that is "up the picture"
  for (const o of [-0.12, 0, 0.1, 0.2, 0.3]) {
    const p = at(t + o);
    // The ball is drawn raised (up the picture) by its height: count both.
    const lift = si >= 0 ? 0 : p.z * BALL_LIFT;
    for (const q of [{ x: p.x, y: p.y }, { x: p.x + up.x * lift, y: p.y + up.y * lift }]) {
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
  }
  const mX = halfX * 0.26, mY = halfY * 0.26;
  cx = x1 - x0 > 2 * (halfX - mX) ? (x0 + x1) / 2 : clamp(cx, x1 - halfX + mX, x0 + halfX - mX);
  cy = y1 - y0 > 2 * (halfY - mY) ? (y0 + y1) / 2 : clamp(cy, y1 - halfY + mY, y0 + halfY - mY);
  return { cx, cy, unit, rot, W, H };
}

/** A pitch point (metres, on the grass) on the picture. */
export function toScreen(c: Cam2D, x: number, y: number): { px: number; py: number } {
  const rx = x - c.cx, ry = y - c.cy;
  const co = Math.cos(c.rot), sn = Math.sin(c.rot);
  return { px: c.W / 2 + (rx * co - ry * sn) * c.unit, py: c.H / 2 + (rx * sn + ry * co) * c.unit };
}

/** A pitch direction (dx, dy) as a screen angle (sprites.ts: 0 right, PI/2 down). */
function screenAngle(c: Cam2D, dx: number, dy: number): number {
  return Math.atan2(dy, dx) + c.rot;
}

/** Metres a ball in the air is drawn up the screen per metre of height. */
const BALL_LIFT = 0.45;

/** Where the ball is drawn on the picture (its height lifts it up the screen). */
export function flatBallOnScreen(c: Cam2D, b: { x: number; y: number; z: number }): { px: number; py: number } {
  const p = toScreen(c, b.x, b.y);
  return { px: p.px, py: p.py - b.z * BALL_LIFT * c.unit };
}

/** The point a better edit's zoom holds still (betterView.ts anchorOf, in 2D). */
export function flatAnchor(track: GoalTrack, shot: Shot, t: number, W: number, H: number): { x: number; y: number } {
  const c = flatCamera(track, shot.angle, t, W, H);
  const b = shot.angle === "tight" ? frameAt(track, t).ball : smoothBall(track, t, -0.1, 0.1, 6);
  const p = flatBallOnScreen(c, b);
  return { x: clamp(p.px, W * 0.08, W * 0.92), y: clamp(p.py, H * 0.08, H * 0.92) };
}

// ── What is worked out once per recording ─────────────────────────────────

interface Flat {
  /** Clip time the ball first went into the net (the ripple starts), or null. */
  netT: number | null;
  netAt: { x: number; y: number } | null;
}
const flats = new WeakMap<GoalTrack, Flat>();
function flatOf(track: GoalTrack): Flat {
  const hit = flats.get(track);
  if (hit) return hit;
  let netT: number | null = null, netAt: Flat["netAt"] = null;
  for (let f = 0; f < track.n; f++) {
    const b = frameAt(track, f / track.fps).ball;
    if (b.y < -0.1 && b.x > POST_L - 0.2 && b.x < POST_R + 0.2) { netT = f / track.fps; netAt = { x: b.x, y: b.y }; break; }
  }
  const out = { netT, netAt };
  flats.set(track, out);
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

// ── The pitch ──────────────────────────────────────────────────────────────

const GRASS = "#24940d";
const STRIPE = "rgba(160,235,100,0.10)";
const SURROUND = "#1d7d0b";
const LINE = "rgba(255,255,255,0.92)";
/** How deep the net is drawn (m): a little deeper than the frame's floor, so a ball in it sits inside. */
const NET_D = 2.0;
const STRIPE_M = 5.25;

/** The visible pitch rectangle (metres), from the camera. */
function visible(c: Cam2D): { x0: number; x1: number; y0: number; y1: number } {
  const turned = Math.abs(Math.sin(c.rot)) > 0.5;
  const hx = (turned ? c.H : c.W) / 2 / c.unit + 1, hy = (turned ? c.W : c.H) / 2 / c.unit + 1;
  return { x0: c.cx - hx, x1: c.cx + hx, y0: c.cy - hy, y1: c.cy + hy };
}

function drawGround(ctx: CanvasRenderingContext2D, c: Cam2D, track: GoalTrack, p: Prep): void {
  const v = visible(c);
  const px = 1 / c.unit;   // one pixel, in metres
  // The stands round the pitch: dark, with the crowd as dots in both clubs' colours.
  ctx.fillStyle = "#151821";
  ctx.fillRect(v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4);
  const cols = [...p.look.homeColours, ...p.look.awayColours, "#e5e7eb", "#9ca3af", "#374151"];
  const inStand = (x: number, y: number) => x < -7 || x > PITCH_W + 7 || y < -8 || y > 2 * HALF_LEN + 8;
  const step = 0.8;
  // Dimmed, so the crowd sits back behind the play rather than sparkling.
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * 0.6;
  for (let y = Math.floor(v.y0 / step) * step; y < v.y1; y += step) {
    for (let x = Math.floor(v.x0 / step) * step; x < v.x1; x += step) {
      if (!inStand(x, y)) continue;
      const h = hash(`${Math.round(x / step)}:${Math.round(y / step)}`);
      if (h % 7 === 0) continue;   // an empty seat
      ctx.fillStyle = cols[h % cols.length];
      ctx.fillRect(x + ((h >>> 8) % 10) * 0.02, y + ((h >>> 12) % 10) * 0.02, 0.42, 0.42);
    }
  }
  ctx.globalAlpha = was;
  // Grass to the boards, then the pitch, mown in stripes across it.
  ctx.fillStyle = SURROUND;
  ctx.fillRect(-7, -8, PITCH_W + 14, 2 * HALF_LEN + 16);
  ctx.fillStyle = GRASS;
  ctx.fillRect(-4, -5, PITCH_W + 8, 2 * HALF_LEN + 10);
  ctx.fillStyle = STRIPE;
  for (let k = Math.floor(Math.max(v.y0, -5) / STRIPE_M); k * STRIPE_M < Math.min(v.y1, 2 * HALF_LEN + 5); k++) {
    if (k % 2 === 0) continue;
    const y0 = Math.max(-5, k * STRIPE_M), y1 = Math.min(2 * HALF_LEN + 5, (k + 1) * STRIPE_M);
    ctx.fillRect(-4, y0, PITCH_W + 8, y1 - y0);
  }
  // Worn grass in the goalmouth and on the spot.
  for (const [x, y, r, a] of [[CX, 2.5, 5, 0.22], [CX, PEN_SPOT_Y, 2, 0.16]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(120,132,26,${a})`);
    g.addColorStop(1, "rgba(120,132,26,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Advertising boards round the pitch, in the two clubs' colours.
  const home = p.look.homeColours[0], away = p.look.awayColours[0];
  const board = (x: number, y: number, w: number, h: number, i: number) => {
    ctx.fillStyle = i % 3 === 0 ? home : i % 3 === 1 ? "#0f172a" : away;
    ctx.fillRect(x, y, w, h);
  };
  for (let i = 0, x = -6; x < PITCH_W + 6; x += 6, i++) { board(x, -6.6, 5.9, 0.5, i); board(x, 2 * HALF_LEN + 6.1, 5.9, 0.5, i + 1); }
  for (let i = 0, y = -6; y < 2 * HALF_LEN + 6; y += 6, i++) { board(-5.6, y, 0.5, 5.9, i + 2); board(PITCH_W + 5.1, y, 0.5, 5.9, i); }

  // The lines.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1.3 * px, 0.12);
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.rect(0, 0, PITCH_W, 2 * HALF_LEN);
  ctx.moveTo(0, HALF_LEN); ctx.lineTo(PITCH_W, HALF_LEN);
  for (const end of [0, 1]) {
    const yy = (d: number) => (end ? 2 * HALF_LEN - d : d);
    ctx.moveTo(BOX_L, yy(0)); ctx.lineTo(BOX_L, yy(BOX_DEPTH)); ctx.lineTo(BOX_R, yy(BOX_DEPTH)); ctx.lineTo(BOX_R, yy(0));
    ctx.moveTo(SIX_L, yy(0)); ctx.lineTo(SIX_L, yy(SIX_DEPTH)); ctx.lineTo(SIX_R, yy(SIX_DEPTH)); ctx.lineTo(SIX_R, yy(0));
    // The D: the part of the circle round the spot outside the box.
    const a = Math.acos((BOX_DEPTH - PEN_SPOT_Y) / ARC_R);
    const sy = yy(PEN_SPOT_Y);
    if (end) { ctx.moveTo(CX + ARC_R * Math.cos(-Math.PI / 2 - a), sy + ARC_R * Math.sin(-Math.PI / 2 - a)); ctx.arc(CX, sy, ARC_R, -Math.PI / 2 - a, -Math.PI / 2 + a); }
    else { ctx.moveTo(CX + ARC_R * Math.cos(Math.PI / 2 - a), sy + ARC_R * Math.sin(Math.PI / 2 - a)); ctx.arc(CX, sy, ARC_R, Math.PI / 2 - a, Math.PI / 2 + a); }
  }
  ctx.moveTo(CX + CENTRE_R, HALF_LEN); ctx.arc(CX, HALF_LEN, CENTRE_R, 0, Math.PI * 2);
  for (const [x, y, a0] of [[0, 0, 0], [PITCH_W, 0, Math.PI / 2], [0, 2 * HALF_LEN, -Math.PI / 2], [PITCH_W, 2 * HALF_LEN, Math.PI]] as const) {
    ctx.moveTo(x + CORNER_R * Math.cos(a0), y + CORNER_R * Math.sin(a0));
    ctx.arc(x, y, CORNER_R, a0, a0 + Math.PI / 2);
  }
  ctx.stroke();
  ctx.fillStyle = LINE;
  for (const y of [PEN_SPOT_Y, 2 * HALF_LEN - PEN_SPOT_Y, HALF_LEN]) { ctx.beginPath(); ctx.arc(CX, y, Math.max(0.18, 2 * px), 0, Math.PI * 2); ctx.fill(); }
}

/** How far the net is pushed back at (x, y) at clip time t (metres): the ball's dent, then a ripple. */
function netPush(fl: Flat, ball: { x: number; y: number }, t: number, x: number, y: number): number {
  if (fl.netT === null || !fl.netAt || t < fl.netT) return 0;
  const s = t - fl.netT;
  // Where the ball is now (it stays in the net), the dent follows it for a moment.
  const bx = s < 0.6 ? ball.x : fl.netAt.x;
  const d2 = (x - bx) ** 2 + ((y - -NET_D) * 0.6) ** 2;
  const dent = 0.55 * Math.exp(-d2 / 1.1) * Math.exp(-s * 1.6);
  // Rings running out from where it hit, dying away.
  const r = Math.sqrt((x - fl.netAt.x) ** 2 + (y - Math.max(-NET_D, fl.netAt.y)) ** 2);
  const ring = 0.12 * Math.sin((r - s * 5.5) * 3.2) * Math.exp(-s * 1.8) * Math.exp(-Math.max(0, r - s * 5.5) * 1.5) * (r < s * 5.5 + 0.4 ? 1 : 0);
  return dent + ring;
}

function drawGoal(ctx: CanvasRenderingContext2D, c: Cam2D, fl: Flat, ball: { x: number; y: number }, t: number, end: 0 | 1): void {
  const px = 1 / c.unit;
  // The far goal is the near one turned half round the centre spot.
  ctx.save();
  if (end) { ctx.translate(PITCH_W, 2 * HALF_LEN); ctx.rotate(Math.PI); }
  const push = (x: number, y: number) => (end ? 0 : netPush(fl, ball, t, x, y));
  // The net's floor, faintly shaded.
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(POST_L, -NET_D, POST_R - POST_L, NET_D);
  // The mesh: lines along and across, each point pushed back by the ball.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(0.7 * px, 0.03);
  const STEP = 0.3;
  ctx.beginPath();
  for (let x = POST_L; x <= POST_R + 1e-6; x += STEP) {
    for (let y = 0; y >= -NET_D - 1e-6; y -= STEP / 2) {
      const yy = y - push(x, y) * (-y / NET_D);
      if (y === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
  }
  for (let y = -STEP; y >= -NET_D - 1e-6; y -= STEP) {
    for (let x = POST_L; x <= POST_R + 1e-6; x += STEP / 2) {
      const yy = y - push(x, y) * (-y / NET_D);
      if (x === POST_L) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
  }
  ctx.stroke();
  // The back of the net and its sides, a firmer line (bulging where the ball is).
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1.1 * px, 0.06);
  ctx.beginPath();
  ctx.moveTo(POST_L, 0);
  ctx.lineTo(POST_L, -NET_D - push(POST_L, -NET_D));
  for (let x = POST_L; x <= POST_R + 1e-6; x += 0.15) ctx.lineTo(x, -NET_D - push(x, -NET_D));
  ctx.lineTo(POST_R, 0);
  ctx.stroke();
  // The frame: the crossbar over the line, the posts.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.4 * px, 0.16);
  ctx.beginPath(); ctx.moveTo(POST_L, 0); ctx.lineTo(POST_R, 0); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  for (const x of [POST_L, POST_R]) { ctx.beginPath(); ctx.arc(x, 0, Math.max(2 * px, 0.14), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ── The men ────────────────────────────────────────────────────────────────

/** A standing man's height on the picture, in metres of pitch (the 2D match draws them big so they read). */
const FIG_M = 2.35;

interface Item { y: number; draw: () => void }

function man(ctx: CanvasRenderingContext2D, c: Cam2D, track: GoalTrack, p: Prep, fr: FrameState, i: number, t: number, moves: "new" | "old"): Item | null {
  const body = track.bodies[i];
  let pos = fr.bodies[i];
  const keeper = body.role === "keeper";
  const dive = keeper ? p.dives.find(d => d.who === i && t >= d.start && t < d.end) ?? null : null;
  const diveT = dive ? Math.min(0.66, (t - dive.start) * 0.75 + 0.05) : 0;
  if (dive && diveT >= 0.55 && dive.landAt) pos = { x: dive.landAt.x, y: dive.landAt.y, z: 0 };
  const at = toScreen(c, pos.x, pos.y);
  if (at.px < -60 || at.px > c.W + 60 || at.py < -60 || at.py > c.H + 80) return null;
  const height = FIG_M * c.unit;
  const h = 1 / track.fps;
  const a = frameAt(track, Math.max(0, t - h)).bodies[i], b = frameAt(track, Math.min(trackDuration(track), t + h)).bodies[i];
  const vx = (b.x - a.x) / (2 * h), vy = (b.y - a.y) / (2 * h);
  const speed = Math.hypot(vx, vy);
  let facing: number, clip: SpriteClip, clipT: number, centre = 0, lift = 0;
  const ball = fr.ball;
  if (keeper) {
    facing = screenAngle(c, 0, pos.y > HALF_LEN ? -1 : 1);
    if (dive) {
      const dir = fr.keeper.dir || 1;
      const d = toScreen(c, pos.x + dir, pos.y);
      clip = keeperDiveClip(facing, d.px - at.px, d.py - at.py);
      const fresh = moves === "new" ? keeperDiveClipNew(dive.result ?? "beaten", dive.result ? dive.z : ball.z, dive.high, sideOfDive(clip)) : null;
      if (fresh && spriteClipReady("keeper", fresh)) clip = fresh;
      clipT = diveT;
      centre = Math.min(1, diveT / 0.4);
    } else {
      clip = "ready";
      clipT = t * 0.6;
    }
  } else {
    const toBall = { x: ball.x - pos.x || 0.01, y: ball.y - pos.y };
    facing = speed > 0.8 ? screenAngle(c, vx, vy) : screenAngle(c, toBall.x, toBall.y);
    const ran = ranAt(p, track, i, t);
    clip = speed > 5.2 ? "sprint" : speed > 0.7 ? "jog" : "idle";
    clipT = clip === "sprint" ? ran / 6.5 : clip === "jog" ? ran / 3.4 : t;
    const strikeAt = spriteKickStrikeT() || 0.33;
    const kickLen = spriteClipLength("player", "kick") || 0.67;
    for (const k of p.kicks.get(body.id) ?? []) {
      if (k.mode === "header") {
        const u = (t - (k.t - 0.28)) / 0.56;
        if (u >= 0 && u <= 1) { lift = Math.sin(Math.PI * u) * 0.55; clip = "idle"; clipT = 0; }
        continue;
      }
      const s = t - (k.t - strikeAt);
      if (s >= 0 && s <= kickLen) { clip = "kick"; clipT = s; facing = screenAngle(c, toBall.x, toBall.y); }
    }
    for (const act of moves === "new" ? p.acts.get(body.id) ?? [] : []) {
      const sc = outfieldSpriteClip({ kind: act.kind, mode: act.mode }, t - act.t, (cl) => spriteClipFps("player", cl));
      if (sc && spriteClipReady("player", sc.clip)) { clip = sc.clip; clipT = sc.t; lift = 0; facing = screenAngle(c, toBall.x, toBall.y); }
    }
    const cel = track.meta.celebration;
    const celSt = cel && body.id === "you" && cel.move in CELEB_SPECS
      ? celebAt(planCelebration({ x: cel.from[0], y: cel.from[1] }, cel.move as CelebrationMove), t - (track.goalT + cel.at)) : null;
    if (cel && body.id === "you" && t >= track.goalT + cel.at) {
      if (celSt && (celSt.phase === "move" || celSt.phase === "done")) {
        const spec = CELEB_SPECS[cel.move as CelebrationMove];
        const sp = spec.sprite as SpriteClip;
        const ok = sp !== "celebrate" && spriteClipReady("player", sp);
        clip = ok ? sp : "celebrate";
        clipT = ok ? celSt.clipT : celSt.moveT;
        lift = 0;
        // Seen from above he turns to the crowd: down the screen reads best.
        facing = spec.travel(spec.playS) > 0 ? screenAngle(c, celSt.x - cel.from[0] || 0.01, celSt.y - cel.from[1]) : Math.PI / 2;
      }
    } else if (body.id === track.meta.scorerBody && t > track.goalT + 0.35) {
      clip = "celebrate";
      clipT = t - (track.goalT + 0.35);
      facing = Math.PI / 2;
    }
    lift += pos.z * 0.9;
  }
  const you = body.id === "you";
  return {
    y: at.py,
    draw: () => {
      // His shadow on the grass, and a ring under you so you are easy to find.
      drawSpriteShadow(ctx, at.px, at.py, height * (dive ? 1.4 : 1));
      if (you) {
        ctx.strokeStyle = "rgba(250,204,21,0.85)";
        ctx.lineWidth = Math.max(1.2, height * 0.06);
        ctx.beginPath(); ctx.ellipse(at.px, at.py, height * 0.32, height * 0.13, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const liftPx = lift * c.unit * BALL_LIFT;
      const kit = { shirt: body.kit.shirt, shorts: body.kit.shorts, socks: body.kit.socks ?? body.kit.shirt };
      const ok = spritesReady() && drawSprite(ctx, at.px, at.py - liftPx, { char: keeper ? "keeper" : "player", clip, t: Math.max(0, clipT), facingRad: facing, kit, height, centre });
      if (!ok) {
        drawFigureAt(ctx, at.px, at.py, figureRForHeight(height), { shirt: kit.shirt, shorts: kit.shorts, trim: kit.shorts },
          DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { liftPx, shadowR: 0 });
      }
    },
  };
}

// ── The ball ───────────────────────────────────────────────────────────────

function ballItems(ctx: CanvasRenderingContext2D, c: Cam2D, track: GoalTrack, t: number, ball: { x: number; y: number; z: number }): Item {
  const r = Math.max(3.2, c.unit * 0.3);
  const ground = toScreen(c, ball.x, ball.y);
  const at = flatBallOnScreen(c, ball);
  return {
    y: ground.py + 0.5,
    draw: () => {
      // The trail: where it has been in the last 0.4 s, fading, only while it flies.
      const STEPS = 16, back = 0.4;
      let prev: { px: number; py: number } | null = null;
      let prevB = frameAt(track, Math.max(0, t - back)).ball;
      ctx.lineCap = "round";
      for (let k = STEPS - 1; k >= 0; k--) {
        const tt = t - (back * k) / STEPS;
        if (tt < 0) { prev = null; continue; }
        const b = frameAt(track, tt).ball;
        const q = flatBallOnScreen(c, b);
        const sp = Math.hypot(b.x - prevB.x, b.y - prevB.y, b.z - prevB.z) / (back / STEPS);
        prevB = b;
        if (prev && sp > 7) {
          const age = k / STEPS;
          ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - age)).toFixed(3)})`;
          ctx.lineWidth = Math.max(1, r * 1.5 * (1 - age));
          ctx.beginPath(); ctx.moveTo(prev.px, prev.py); ctx.lineTo(q.px, q.py); ctx.stroke();
        }
        prev = q;
      }
      ctx.lineCap = "butt";
      // Its shadow, under it on the grass: fainter and wider the higher it is.
      const sh = Math.max(0.12, 0.4 - ball.z * 0.05);
      ctx.fillStyle = `rgba(0,0,0,${sh.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(ground.px + r * 0.25, ground.py + r * 0.15, r * (1 + ball.z * 0.08), r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      // The ball: a little bigger the higher it is (nearer the camera).
      const rr = r * (1 + Math.min(0.6, ball.z * 0.09));
      ctx.fillStyle = "rgba(15,15,15,0.9)";
      ctx.beginPath(); ctx.arc(at.px, at.py, rr * 1.15, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(at.px - rr * 0.35, at.py - rr * 0.4, rr * 0.1, at.px, at.py, rr);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#cfd4da");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(at.px, at.py, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(30,30,30,0.6)";
      const spin = t * 9;
      for (let k = 0; k < 2; k++) {
        const a = spin + k * Math.PI;
        ctx.beginPath(); ctx.arc(at.px + Math.cos(a) * rr * 0.45, at.py + Math.sin(a) * rr * 0.45, rr * 0.26, 0, Math.PI * 2); ctx.fill();
      }
    },
  };
}

// ── The whole picture ──────────────────────────────────────────────────────

/** The 2D picture of the recording at clip time `t` (drawScene's place). */
export function drawFlatScene(
  ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, angle: ClipAngle, t: number, moves: "new" | "old" = "old",
): Cam2D {
  const p = prepOf(track);
  const fl = flatOf(track);
  const c = flatCamera(track, angle, t, W, H);
  const fr = frameAt(track, t);
  ctx.save();
  // Pitch space: metres, turned and centred as the camera says.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(c.rot);
  ctx.scale(c.unit, c.unit);
  ctx.translate(-c.cx, -c.cy);
  drawGround(ctx, c, track, p);
  drawGoal(ctx, c, fl, fr.ball, t, 0);
  const v = visible(c);
  if (v.y1 > 2 * HALF_LEN - 3) drawGoal(ctx, c, fl, fr.ball, t, 1);
  ctx.restore();

  // The men and the ball, drawn upright on the picture, nearest the bottom last.
  const items: Item[] = [];
  for (let i = 0; i < track.bodies.length; i++) {
    const m = man(ctx, c, track, p, fr, i, t, moves);
    if (m) items.push(m);
  }
  items.push(ballItems(ctx, c, track, t, fr.ball));
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // Night: the floodlit look. Every match: a soft vignette.
  if (p.look.night) {
    ctx.fillStyle = "rgba(5,12,35,0.18)";
    ctx.fillRect(0, 0, W, H);
  }
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Weather from above: rain as quick streaks, snow drifting.
  if (p.look.weather === "rain") {
    ctx.strokeStyle = "rgba(220,230,240,0.32)";
    ctx.lineWidth = 1;
    const seed = Math.floor(t * 30);
    for (let k = 0; k < 70; k++) {
      const h = hash(`${seed}:${k}`);
      const x = (h % 1000) / 1000 * W, y = ((h >>> 10) % 1000) / 1000 * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 7); ctx.stroke();
    }
  } else if (p.look.weather === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let k = 0; k < 60; k++) {
      const h = hash(`s${k}`);
      const x = ((h % 1000) / 1000 * W + Math.sin(t * 0.8 + k) * 8 + W) % W;
      const y = (((h >>> 10) % 1000) / 1000 * H + t * 30) % H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
  return c;
}

