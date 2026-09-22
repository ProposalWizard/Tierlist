import type { Vec2, Viewport } from "../canvasEngine";
import {
  BALL_R, CX, PEN_SPOT_Y, ARC_R,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
} from "../pitch";
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
  /** The ring OUTSIDE the white, so a white ball on a white line is still a
   *  ball. See drawBall. */
  ballEdge: "rgba(12,16,12,0.9)",
  shadow: "rgba(0,0,0,0.28)",
  skin: "#c68642",
  boot: "#1f2937",
};

/**
 * WHO IS WHO, THE SAME COLOUR EVERYWHERE.
 *
 * Reported directly: "game engine or nature or physics or style or whatever
 * is for some reason different across trial, training, and in game... its
 * similar sure but its not consistent or the same." A real, found instance
 * of exactly that: `CanvasMatch.tsx` and `trainingRender.ts` had each
 * independently hardcoded the identical you/mate/opp/gk values below — real
 * agreement, but by coincidence, not by a shared source — while the trial's
 * own `YOU_KIT`/`MATE_KIT`/`KIT`/`OPP` (TrialPenalties.tsx, TrialVision.tsx)
 * had drifted to different colours entirely (near-white for you, light grey
 * for a team-mate, dark blue for an opponent — the same blue the real match
 * uses for a TEAM-MATE). One player in green, red for the opposition, gold
 * for a keeper is the whole visual language this game uses to say "whose
 * man is that" at a glance; a trial or a drill that answers it differently
 * is teaching the wrong thing before the answer even matters.
 *
 * One export, every consumer (CanvasMatch.tsx, trainingRender.ts,
 * TrialPenalties.tsx, TrialVision.tsx) reads from here now instead of
 * keeping its own copy — a colour changed once reaches all four.
 */
export const ROLE_KIT = {
  you: "#10b981",
  youRim: "#065f46",
  mate: "#3b82f6",
  mateRim: "#1e3a5f",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  gk: "#fbbf24",
  gkRim: "#92400e",
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

/**
 * WHERE THE CAMERA IS, WHICH IS NOT WHERE THE ENGINE THINKS THE WORLD IS.
 *
 * These have to be two different rectangles, and the reason is not cosmetic:
 * the engine treats `scenario.viewport` AS the world — a ball more than a
 * metre outside it is out of play, and nobody reacts to it out there. So the
 * viewport handed to the engine must stay the fixed, whole-pitch frame, or
 * panning it would drag the touchlines around with it and call a ball out
 * halfway up the pitch.
 *
 * The camera is purely what gets drawn. Nothing in the engine has ever seen
 * it, and nothing ever should.
 *
 * This is also, incidentally, the piece `rules.ts` names as the one unsolved
 * thing standing between this layer and a continuous eleven-a-side match.
 */
export function cameraFor(
  rules: MatchRules,
  /** What to keep in shot — the ball. */
  on: Vec2,
  /** The canvas, in pixels. The camera takes its SHAPE from the screen it is
   *  drawn on, which is the whole point: the frame is a fixed tall rectangle
   *  and a phone is not. */
  W: number, H: number,
  /** Where the camera was last frame, so it eases rather than snaps. */
  prev?: Viewport,
  /** 0-1, how far toward the target this frame. */
  ease = 0.1,
): Viewport {
  const full = rules.view;
  const fullW = full.x2 - full.x1, fullH = full.y2 - full.y1;

  // ── Full width, always ──
  //
  // Sideways is where a player needs to see everything at once: the far post,
  // the man peeling off on the other flank. Lengthwise is where a real camera
  // follows play, and where a phone has no room. So the camera shows the whole
  // width of the frame and however much of its length the screen's shape
  // allows, which on a frame that is already taller than the screen means it
  // pans up and down and never sideways.
  //
  // On a screen at least as tall as the frame this returns the frame itself,
  // so a five-a-side on a big display is byte-identical to no camera at all.
  const h = Math.min(fullH, W > 0 ? (fullW * H) / W : fullH);

  const cy = Math.max(full.y1 + h / 2, Math.min(full.y2 - h / 2, on.y));
  const want: Viewport = {
    x1: full.x1, x2: full.x2,
    y1: cy - h / 2, y2: cy + h / 2,
  };

  if (!prev) return want;
  // Only ease if it is the same shape of camera — a resize (or the first
  // frame after one) should land, not slide.
  if (Math.abs((prev.y2 - prev.y1) - h) > 0.01) return want;
  const lerp = (a: number, b: number) => a + (b - a) * Math.max(0, Math.min(1, ease));
  return {
    x1: want.x1, x2: want.x2,
    y1: lerp(prev.y1, want.y1), y2: lerp(prev.y2, want.y2),
  };
}

/**
 * THE OTHER HALF OF THE SAME IDEA: make the SHOT fit the SCREEN, by containing
 * rather than by panning.
 *
 * `cameraFor` above is the right camera for continuous play: a fixed zoom that
 * follows the ball, because a tactics board that zoomed chance to chance would
 * read as the camera being erratic. It cannot be the camera for a dead ball.
 * A thirty-metre free kick and the goal mouth are forty metres apart; a phone
 * is not forty metres tall in any shape, so a fixed-height camera showing full
 * width either crops the goal or crops the ball, and a camera that panned
 * between them during a one-second flight would be seasick.
 *
 * So: take the rectangle that genuinely has to be visible — the goal, the ball,
 * and the room behind the ball the drag pulls back into — and grow it, never
 * crop it, to the shape of the canvas. Whichever axis the screen has room to
 * spare on simply shows more grass.
 *
 * Computed once per attempt, not per frame, so it holds still: the ball moves
 * inside a shot that does not move, which is exactly how a penalty is filmed.
 *
 * The returned rectangle always has the canvas's own aspect, so `projectionFor`
 * gets the same pixels-per-metre on both axes and a distance on screen means
 * the same thing whichever way it points.
 */
export function cameraContaining(must: Viewport, W: number, H: number): Viewport {
  const mw = Math.max(0.001, must.x2 - must.x1);
  const mh = Math.max(0.001, must.y2 - must.y1);
  // A canvas with no size yet (the first frame, before layout) has no shape to
  // take, so keep the rectangle as asked rather than dividing by zero.
  const aspect = W > 0 && H > 0 ? W / H : mw / mh;
  let w = mw, h = mh;
  if (mw / mh < aspect) w = mh * aspect;
  else h = mw / aspect;
  const cx = (must.x1 + must.x2) / 2, cy = (must.y1 + must.y2) / 2;
  return { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
}

export function projectionFor(
  rules: MatchRules, W: number, H: number,
  /** What the camera is looking at. Defaults to the whole frame. */
  camera?: Viewport,
): Projection {
  const vp = camera ?? rules.view;
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

  // ── The attacking third of a full-size pitch ──
  //
  // Real IFAB markings, so the trial's striking stages get the pitch they are
  // actually standing on rather than a small-sided one relabelled. Everything
  // else in this function is the small-sided default and is untouched.
  if (rules.markings === "penalty-area") {
    wear(goalMid, pitch.y1 + 1.9, 6.2, 2.4, 0.22);
    wear(goalMid, PEN_SPOT_Y, 3.2, 2.2, 0.16);

    ctx.strokeStyle = TC.line;
    ctx.lineWidth = Math.max(1.5, unit * 0.11);
    // The goal line, right across the frame — the one line that is always in
    // shot, whatever the camera is looking at.
    ctx.beginPath();
    ctx.moveTo(0, py(pitch.y1)); ctx.lineTo(W, py(pitch.y1));
    ctx.stroke();
    ctx.strokeRect(px(SIX_L), py(pitch.y1), (SIX_R - SIX_L) * unit, SIX_DEPTH * unit);
    ctx.strokeRect(px(BOX_L), py(pitch.y1), (BOX_R - BOX_L) * unit, BOX_DEPTH * unit);

    // The D: the part of the penalty arc that falls outside the box.
    const half = Math.acos(Math.max(-1, Math.min(1, (BOX_DEPTH - PEN_SPOT_Y) / ARC_R)));
    ctx.strokeStyle = TC.lineFaint;
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), ARC_R * unit, Math.PI / 2 - half, Math.PI / 2 + half);
    ctx.stroke();

    // The spot.
    ctx.fillStyle = TC.line;
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), Math.max(2, unit * 0.16), 0, Math.PI * 2);
    ctx.fill();

    // The touchlines, for a free kick wide enough to see one.
    ctx.strokeStyle = TC.lineFaint;
    ctx.lineWidth = Math.max(1.2, unit * 0.09);
    for (const x of [pitch.x1, pitch.x2]) {
      ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke();
    }
    return;
  }

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

/**
 * A goal that stands up off the line: back net, two sides, the roof, the frame.
 *
 * Built for the goal you ATTACK — the net goes back, away from the camera, at
 * `atY - depth`. That is the only goal a dead-ball stage ever draws standing
 * up, and it is why `drawGoal` only reaches this for a caller that asked for a
 * height.
 *
 * Ported wholesale from the penalties stage's own painter rather than
 * re-derived — that drawing was arrived at after the earlier hand-rolled one
 * was reported as reading like "trash", so it is the version that has actually
 * been looked at and approved. What changed is only where it lives: it is a
 * function over a projection here, so the vision stage and the free kicks draw
 * the same goal instead of each carrying a near-copy of it.
 */
function drawRaisedGoal(
  ctx: CanvasRenderingContext2D, p: Projection,
  goal: { x1: number; x2: number }, atY: number, depth: number, height: number,
): void {
  const { px, py, unit } = p;
  type Pt = { px: number; py: number };
  const hpx = height * unit;
  const bl: Pt = { px: px(goal.x1), py: py(atY) };
  const br: Pt = { px: px(goal.x2), py: py(atY) };
  const tl: Pt = { px: bl.px, py: bl.py - hpx }, tr: Pt = { px: br.px, py: br.py - hpx };
  const rl: Pt = { px: bl.px, py: py(atY - depth) }, rr: Pt = { px: br.px, py: py(atY - depth) };
  const ul: Pt = { px: rl.px, py: rl.py - hpx }, ur: Pt = { px: rr.px, py: rr.py - hpx };

  const path = (q: Pt[]) => {
    ctx.beginPath();
    ctx.moveTo(q[0].px, q[0].py);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
    ctx.closePath();
  };
  const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
  const seg = (a: Pt, b: Pt) => { ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke(); };
  const lerp = (a: Pt, b: Pt, f: number) => ({ px: a.px + (b.px - a.px) * f, py: a.py + (b.py - a.py) * f });
  const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
    ctx.save();
    path(q); ctx.clip();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = Math.max(0.7, unit * 0.028);
    for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
    for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
    ctx.restore();
  };

  const sh = unit * 0.5;
  quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
  quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
  quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
  netting([rl, rr, ur, ul], 34, 10, 0.42);
  ctx.strokeStyle = "#0f1a14";
  ctx.lineWidth = Math.max(1.8, unit * 0.15);
  seg(rl, ul); seg(rr, ur); seg(ul, ur);
  quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
  netting([tl, tr, ur, ul], 34, 5, 0.8);

  ctx.lineCap = "round";
  ctx.strokeStyle = TC.post;
  ctx.lineWidth = Math.max(1.8, unit * 0.12);
  seg(bl, tl); seg(br, tr);
  ctx.lineWidth = Math.max(2, unit * 0.16);
  seg(tl, tr);
  ctx.lineCap = "butt";

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, unit * 0.11);
  seg(bl, br);
}

/**
 * The goal you are attacking, at `y = pitch.y1`, with its net.
 *
 * `opts.height` is the one addition: given a real crossbar height it builds the
 * goal as five surfaces standing UP off the goal line — back net, two sides,
 * the roof and the frame — instead of the flat rectangle a small-sided goal is
 * drawn as. Omit it and every existing caller gets the flat goal it always got,
 * to the pixel.
 *
 * Which one is right is a question about the camera, not about the goal. The
 * five-a-side looks straight down on a whole pitch, where a two-metre goal is
 * a couple of pixels of height and drawing it standing up would just make the
 * net ambiguous. The trial's striking stages look at one end from behind the
 * ball, close enough that the bar is the thing you are aiming under or over,
 * and a flat rectangle there gives you nothing to judge height against.
 */
export function drawGoal(
  ctx: CanvasRenderingContext2D, rules: MatchRules, p: Projection,
  atY: number, depth = rules.netDepth ?? 1.2,
  opts?: { height?: number },
): void {
  const { px, py, unit } = p;
  const { goal } = rules;
  const behind = atY === rules.pitch.y1 ? -1 : 1;

  if (opts?.height && opts.height > 0) {
    drawRaisedGoal(ctx, p, goal, atY, depth, opts.height);
    return;
  }

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
  /** Skin, for arms, legs and a head with no photo behind it. */
  skin?: string;
  /** Drawn above the head when there is a real person here. */
  label?: string;
  face?: HTMLImageElement;
  /** A marker over your own figure, so you can always find yourself. */
  star?: boolean;
  /**
   * Metres off the ground — a free kick's wall as it jumps.
   *
   * The shadow stays on the grass while the body rises, which is the only
   * thing that makes height readable from directly above; it is the same trick
   * `drawBall` uses for a ball in the air, and the same factor, so a man a
   * metre up and a ball a metre up agree with each other.
   */
  lift?: number;
}

/**
 * HOW BIG A FOOTBALLER IS, AND WHY THESE NUMBERS AND NOT THE OLD ONES.
 *
 * Reported directly, about the trial: *"The graphics stink. Players are too
 * small, too big. The goalie doesn't look right."* Both halves of that are one
 * measurable fact. The old figure was `r = unit × 0.62` with a head drawn
 * through `drawPlayerHead` at `headBaseR = 0.3r` — and `drawPlayerHead`
 * multiplies by the Face Editor's own scale, which is **2.2** by default. So
 * the head came out at `0.66r` radius on a figure `2.2r` tall: a head SIXTY
 * PER CENT of the whole person. That is a bowling pin, and it is why a player
 * read as too small (the body was a third of him) and too big (the head filled
 * the space) at the same time.
 *
 * The numbers below are an anatomy rather than a set of offsets, measured in
 * multiples of `r` from the FEET, so the proportions can be read off the file:
 *
 *   feet  +0.26   hip  −0.34   shoulders  −1.00   neck  −1.10
 *
 * and a head whose DRAWN radius, after the default 2.2× face scale, is `0.25r`
 * — giving a head a shade over a quarter of the figure's height, which is the
 * stylised-but-human proportion the rest of this game's figures aim at.
 *
 * `FIGURE_R` then sizes the whole man in real metres instead of leaving him a
 * fraction of a pitch: at 1.05 he stands about 1.95 m tall with a head about
 * 0.5 m across. Life-size-ish and deliberately so — the old 0.62 drew a 1.37 m
 * man with an 0.8 m head.
 *
 * HEAD_ANCHOR is the one number that is not just anatomy: `drawPlayerHead`
 * also applies the Face Editor's `offsetY` (−1.45 head-radii by default), so
 * the point handed to it is NOT where the head lands. It is pre-compensated
 * here so that a default-styled head sits on the shoulders. A player who has
 * moved the slider in the Face Editor moves his head off them on purpose,
 * which is exactly what that slider is for.
 */
const FIGURE_R = 1.05;
/** How far below a figure's pitch point his feet actually land, in units of
 *  `r`. Exported because a renderer with a ROTATED camera cannot hand a
 *  `Projection` to `drawFigure` and has to place the feet itself via
 *  `drawFigureAt` — and hardcoding 0.26 a second time is exactly the drift
 *  that having one renderer exists to stop. */
export const FEET_Y = 0.26;
const HIP_Y = -0.34;
const SHOULDER_Y = -1.00;
const NECK_Y = -1.10;
const HEAD_BASE_R = 0.114;
const HEAD_ANCHOR = -1.184;

/** How tall the drawn figure is, in units of `r` — feet to crown, at the
 *  default face scale. Exported so a test can check the proportion rather
 *  than trusting this comment. */
export const FIGURE_HEIGHT_R = 1.863;
/** …and how much of that is head, at the default face scale. */
export const FIGURE_HEAD_R = 0.503;

/**
 * One footballer, in LOCAL coordinates with the origin between his feet and
 * −y up the screen.
 *
 * Split out from `drawFigure` so the keeper can be the same man in a different
 * pose rather than a second, differently-proportioned figure drawn by a second
 * piece of code — which is what he was, and is most of why he "doesn't look
 * right": the keeper had his own head size, his own body and his own arms, all
 * slightly different from everybody else's on the same pitch.
 */
export interface BodyPose {
  /** 0 = arms by the sides, 1 = flung out wide. */
  armSpread?: number;
  /** −1 = arms down, 0 = level, 1 = above the head. */
  armLift?: number;
  /** Keeper's gloves on the ends of the arms. */
  gloves?: boolean;
  /** 0-1, how far he has sunk into a set position. */
  crouch?: number;
  /**
   * −1…1, the running scissor: the legs open one way and close the other, and
   * the arms counter-swing against them. Zero — the default — is the still
   * figure the trial and the five-a-side already draw, so every existing call
   * site is untouched.
   */
  legSwing?: number;
  /** 0-1, one leg thrown through a kick and the arms out for balance. */
  kick?: number;
  /**
   * −1…1: which arm is the leading one. A keeper thrown to his right reaches
   * with that hand and tucks the other; symmetric (0, the default) is what
   * everybody else does, so no existing figure changes.
   */
  armLead?: number;
}

/**
 * A FIGURE'S MOTION, THE SAME WAY EVERYWHERE.
 *
 * Reported directly: "game engine or nature or physics or style or whatever
 * is for some reason different across trial, training, and in game... it
 * seems like youve completely recreated and copied and made an entirely
 * different game." One real, measured piece of that: only `CanvasMatch.tsx`
 * ever animated a figure at all — every `drawFigure` call in the trial and
 * in training left `BodyPose` at its all-zero default (see that interface's
 * own `legSwing` doc above, "the still figure the trial and the five-a-side
 * already draw"), so every wall, every team-mate, every taker stood in a
 * fixed idle stance while only the real match's men visibly ran and struck
 * the ball. Only the keeper animated everywhere, because his dive already
 * read real engine state (`KeeperPose`) rather than a locally-invented pose.
 *
 * `FigurePose`/`runPhase`/`poseFor`/`bodyPoseFor` are CanvasMatch.tsx's own
 * real-match animation — a continuous per-entity running sine and a flat
 * kick window — pulled out to here so a drill or a trial stage can give its
 * own figures the same running/kicking motion instead of reinventing it,
 * and so CanvasMatch.tsx itself now reads from here too rather than keeping
 * a second copy that could drift from what every other screen calls.
 */
export type FigurePose = "idle" | "run" | "kick" | "receive";

/** A per-entity phase for the running sine below, offset by the entity's own
 *  position so a crowd of figures does not march in lockstep. `now` is
 *  `performance.now() / 1000`, read ONCE per frame by the caller and shared
 *  across every figure that frame — not re-read per figure. */
export function runPhase(now: number, seedX: number): number {
  return now * 9 + seedX * 1.7;
}

/**
 * Whether a figure is moving, derived from how far it actually travelled
 * since the last frame — cheaper and more reliable than threading a real
 * velocity out of every entity, and it works for the ones (a static wall
 * man, a taker before he runs up) that only ever expose a position.
 *
 * `motion` is a plain `Map` the CALLER owns (typically one `useRef(new
 * Map())` per component/screen) and passes in every call — this function
 * only reads and updates it, so several independent screens (a real match,
 * a trial stage, a training drill) never share or clash over one map.
 */
export function poseFor(
  motion: Map<string, { x: number; y: number }>,
  id: string, x: number, y: number,
): FigurePose {
  const prev = motion.get(id);
  motion.set(id, { x, y });
  if (!prev) return "idle";
  return Math.hypot(x - prev.x, y - prev.y) > 0.02 ? "run" : "idle";
}

/**
 * A `FigurePose` (running/kicking/idle) turned into the limb numbers
 * `paintBody` actually reads — the exact mapping `CanvasMatch.tsx`'s own
 * `footballer()` always used: running scissors the legs on a sine and
 * counter-swings the arms, a kick throws one leg through with the arms out
 * for balance, a man waiting to receive opens his arms, and idle is the
 * still figure every screen already drew.
 */
export function bodyPoseFor(
  pose: FigurePose, phase: number,
): Pick<BodyPose, "legSwing" | "kick" | "armSpread" | "armLift"> {
  const swing = pose === "run" ? Math.sin(phase) : 0;
  const kick = pose === "kick" ? 1 : 0;
  const open = pose === "receive" ? 1 : 0;
  return {
    legSwing: swing,
    kick,
    armSpread: open * 0.5 + kick * 0.3,
    armLift: -0.55 + open * 0.5,
  };
}

function paintBody(
  ctx: CanvasRenderingContext2D, r: number, look: FigureLook,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  pose?: BodyPose,
): void {
  const skin = look.skin ?? TC.skin;
  const spread = pose?.armSpread ?? 0;
  const lift = pose?.armLift ?? -0.55;
  const crouch = pose?.crouch ?? 0;
  const swing = pose?.legSwing ?? 0;
  const kick = pose?.kick ?? 0;
  // A crouch shortens the man rather than moving him: knees bend, head drops.
  const sink = crouch * r * 0.16;
  // How far the feet travel from their standing spot. The legs scissor apart
  // and back; a kick throws one leg right through. Both feet lift a little as
  // they open, which is what stops a stride reading as a man doing the splits.
  const stride = (swing * 0.42 + kick * 0.55) * r;
  const footRise = Math.abs(stride) * 0.15;

  // ── Legs ──
  ctx.lineCap = "round";
  ctx.strokeStyle = skin;
  ctx.lineWidth = Math.max(1.4, r * 0.15);
  const footY = FEET_Y * r - footRise;
  const footL = -r * 0.19 - stride * 0.35;
  const footR = r * 0.19 + stride * 0.35;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, HIP_Y * r + sink); ctx.lineTo(footL, footY);
  ctx.moveTo(r * 0.16, HIP_Y * r + sink); ctx.lineTo(footR, footY);
  ctx.stroke();
  // Boots, so the legs end in something rather than fading out.
  ctx.fillStyle = TC.boot;
  for (const fx of [footL, footR]) {
    ctx.beginPath();
    ctx.ellipse(fx, footY, r * 0.11, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Shorts ──
  ctx.fillStyle = look.shorts;
  const shortsTop = (HIP_Y - 0.10) * r + sink, shortsH = r * 0.3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-r * 0.31, shortsTop, r * 0.62, shortsH, r * 0.1);
  else ctx.rect(-r * 0.31, shortsTop, r * 0.62, shortsH);
  ctx.fill();

  // ── Shirt: shoulders genuinely wider than the waist ──
  //
  // Drawn as a tapered body rather than an ellipse. An ellipse has no
  // shoulders, and shoulders are most of what makes a shape read as a person
  // seen from behind rather than as a bean.
  const shY = SHOULDER_Y * r + sink, waistY = (HIP_Y - 0.04) * r + sink;
  const shW = r * 0.42, waistW = r * 0.29;
  ctx.beginPath();
  ctx.moveTo(-waistW, waistY);
  ctx.lineTo(-shW, shY + r * 0.1);
  ctx.quadraticCurveTo(-shW, shY - r * 0.04, -shW * 0.6, shY - r * 0.07);
  ctx.lineTo(shW * 0.6, shY - r * 0.07);
  ctx.quadraticCurveTo(shW, shY - r * 0.04, shW, shY + r * 0.1);
  ctx.lineTo(waistW, waistY);
  ctx.closePath();
  ctx.fillStyle = look.shirt;
  ctx.fill();
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();

  // ── Arms ──
  const armFromY = shY + r * 0.02;
  const armLen = r * (0.42 + spread * 0.5);
  const outX = r * 0.3 + armLen * (0.35 + spread * 0.65);
  const handY = armFromY + armLen * (0.62 - lift * 0.85) * (1 - spread * 0.45);
  // The arms counter-swing against the legs, which is what turns a scissor
  // into a run rather than a man being dragged along. Zero by default.
  const handYFor = (s: number) => handY - s * swing * r * 0.22;
  // The trailing arm of a dive stays tucked; without this a keeper thrown to
  // one side reaches equally far the other way and reads as a starfish.
  const lead = pose?.armLead ?? 0;
  const handXFor = (s: number) => s * outX * (lead === 0 || Math.sign(s) === Math.sign(lead) ? 1 : 0.62);
  ctx.strokeStyle = skin;
  ctx.lineWidth = Math.max(1.2, r * 0.115);
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * shW * 0.82, armFromY);
    ctx.lineTo(handXFor(s), handYFor(s));
  }
  ctx.stroke();
  // A sleeve, in the shirt colour, over the top half of each arm — otherwise a
  // pale kit and a bare arm are the same colour and the arms disappear.
  ctx.strokeStyle = look.shirt;
  ctx.lineWidth = Math.max(1.4, r * 0.145);
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * shW * 0.82, armFromY);
    ctx.lineTo(s * shW * 0.82 + (handXFor(s) - s * shW * 0.82) * 0.42, armFromY + (handYFor(s) - armFromY) * 0.42);
  }
  ctx.stroke();

  if (pose?.gloves) {
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(handXFor(s), handYFor(s), r * 0.14, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  // ── Head ──
  //
  // Through the one shared function every other screen draws a head with, so a
  // face is cropped and outlined exactly as the Face Editor says. See
  // HEAD_ANCHOR for why the y handed in is not where the head lands.
  drawPlayerHead(
    ctx, 0, HEAD_ANCHOR * r + sink, HEAD_BASE_R * r, r,
    look.face, faceStyle, fakeFaceStyle,
  );
  // A collar, tucked just under wherever the head actually sits, so the head
  // meets the body instead of hovering over it.
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, NECK_Y * r + sink);
  ctx.lineTo(r * 0.12, NECK_Y * r + sink);
  ctx.stroke();
}

/**
 * One footballer, seen from above and slightly behind — the same read as the
 * main match's figures: a shirt with shoulders, shorts, two legs with boots on
 * them, arms, and a head.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D, p: Projection, at: Vec2, look: FigureLook,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  /** A running/kicking limb pose (see `bodyPoseFor`) and/or a facing
   *  rotation — optional, additive: every call site that omits this argument
   *  behaves exactly as before (the still, all-zero-pose figure). `scale`
   *  multiplies the base radius — pass `MATCH_SCALE` to draw at the real
   *  match's own size; omitted, the figure is unchanged from before. */
  opts?: { pose?: BodyPose; facing?: number; scale?: number },
): void {
  const { px, py, unit } = p;
  const r = Math.max(7, unit * FIGURE_R * (opts?.scale ?? 1));
  const lift = Math.max(0, look.lift ?? 0);
  drawFigureAt(ctx, px(at.x), py(at.y) + r * FEET_Y, r, look, faceStyle, fakeFaceStyle, {
    liftPx: lift * unit * 0.55,
    shadowR: r * 0.34 * (1 - Math.min(0.35, lift * 0.12)),
    label: look.label,
    star: look.star,
    pose: opts?.pose,
    facing: opts?.facing,
  });
}

/**
 * HOW BIG TO DRAW A FIGURE WHEN SOMETHING ELSE ALREADY DECIDED HIS HEIGHT.
 *
 * `drawFigure` sizes a man in metres, which is right for a renderer that owns
 * its own camera. The main match does not: `CanvasMatch` has drawn its figures
 * at a fixed, deliberately larger-than-life height for a long time, tuned
 * against a reference frame, and shrinking every player by a third to make him
 * life-size would be a gameplay-legibility change rather than a cosmetic one.
 *
 * So it asks for the radius that yields the height it already draws, and only
 * the PROPORTIONS change. Everything downstream of `r` is anatomy.
 */
export function figureRForHeight(heightPx: number): number {
  return Math.max(6, heightPx / FIGURE_HEIGHT_R);
}

/**
 * THE 46% HEAD, AND WHY THE FULL-MATCH FIGURES ARE THE SAME HEIGHT AS BEFORE.
 *
 * `CanvasMatch` and its `/star-match-dev` fork drew their figures here, by
 * hand, separately from every other screen — and the real match's had drifted
 * into the shape the trial's had. Measured rather than eyeballed: the old
 * anatomy put the boots 0.80r below the body origin and, once `drawPlayerHead`
 * applied the Face Editor's own default scale of 2.2 and offset of −1.45, the
 * crown 1.709r above it. A figure 2.509r tall wearing a head 1.144r across —
 * a head FORTY-SIX PER CENT of the whole person. The keeper, drawn by a second
 * piece of code with his own numbers, was fifty. Both read as bowling pins.
 *
 * What deliberately did NOT change is how TALL a player is drawn. `drawFigure`
 * sizes a man in real metres (~1.95 m); that camera has always drawn
 * deliberately larger-than-life figures, tuned against a reference frame, and
 * shrinking every player by a third is a legibility change to a game people
 * play rather than the cosmetic one that was asked for. So the old drawn
 * height is kept exactly, and only the proportions move: the head shrinks by
 * more than half, and the body grows by about a third into the space it was
 * taking.
 *
 * Both full-match renderers read it from here rather than each keeping a copy,
 * which is the whole reason they diverged in the first place.
 */
export const MATCH_FIGURE_HEIGHT_R = 2.509;

/**
 * CanvasMatch.tsx's own outfield base-radius multiplier — was a private
 * `const R = unit * 1.15` there; exported here so it is one real number
 * instead of two, and CanvasMatch itself now reads it from here.
 */
export const MATCH_FIGURE_R_MULT = 1.15;

/**
 * HOW MUCH BIGGER THE MATCH DRAWS A FIGURE THAN THE SHARED ANATOMY DOES ON
 * ITS OWN, at the same camera `unit` (px per metre) — the real, measured
 * ~2x gap behind "it seems like an entirely different game": a match figure
 * came out 40px tall at real phone size against the trial's 20px, at
 * cameras zoomed within 1.2% of each other.
 *
 * Derived, not a third hand-typed number: `drawFigure`'s own total drawn
 * height is `unit * FIGURE_R * FIGURE_HEIGHT_R`; the match's is
 * `unit * MATCH_FIGURE_R_MULT * MATCH_FIGURE_HEIGHT_R` (see `footballer()`'s
 * own `figureRForHeight(rBase * scale * MATCH_FIGURE_HEIGHT_R)` in
 * CanvasMatch.tsx — an inverse-then-forward trick for "the r that reaches
 * this many pixels tall", using the SAME shared anatomy both renderers
 * already draw with). Passed as `drawFigure`/`drawKeeper`'s own `scale` opt
 * so a trial or training figure reaches the match's real size without
 * duplicating its anatomy or its R-multiplier trick.
 */
export const MATCH_SCALE = (MATCH_FIGURE_R_MULT * MATCH_FIGURE_HEIGHT_R) / (FIGURE_R * FIGURE_HEIGHT_R);

/**
 * Radians. A keeper at full stretch is horizontal. He is not upside down.
 *
 * The match's own dive commitment runs to 2.15 on a fingertip save, which
 * against that save's lean of 1.30 is 2.8 radians — a hundred and sixty
 * degrees, head below his boots. That is what it has always drawn; it was
 * survivable while he was a blob with two white dots for hands and has no
 * chance of being survivable now he has shoulders and a face. Purely the
 * artwork: the lean is a rotation and nothing in the engine reads it, so where
 * a save is made and whether it is made are untouched.
 */
export const MAX_KEEPER_LEAN = 1.75;

export interface FigureDrawOpts {
  /** Radians. Turns the whole man about his ankles to face where he is
   *  going — the main match's figures do, the five-a-side's do not. */
  facing?: number;
  pose?: BodyPose;
  /** Pixels the body is raised off the grass; his shadow stays behind. */
  liftPx?: number;
  /** Horizontal radius of the ground shadow. Defaults to the standing one. */
  shadowR?: number;
  label?: string;
  /** Defaults to white, as the five-a-side and the trial draw it. */
  labelColor?: string;
  star?: boolean;
  /**
   * A dark rim under the star. Off by default — the trial's figures stand on
   * grass with nothing behind them. The main match asks for it because a gold
   * star on a bright shirt or against a floodlit sky dissolves without one.
   */
  starRim?: string;
}

/**
 * One footballer, at a point on the SCREEN rather than a point on a pitch:
 * `(x, groundY)` is where his boots are, `r` is the anatomy unit above.
 *
 * This is the same drawing `drawFigure` does — that function is now a thin
 * wrapper that works out the two numbers from a projection — split out so a
 * renderer with its own camera, its own idea of how big a player is and its
 * own poses can still draw the ONE figure this game has agreed on rather than
 * growing a fourth hand-drawn man of its own.
 */
export function drawFigureAt(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, r: number,
  look: FigureLook,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  opts: FigureDrawOpts = {},
): void {
  const up = opts.liftPx ?? 0;

  // Shadow first, and on the GRASS — a man in the air leaves his behind.
  ctx.fillStyle = TC.shadow;
  ctx.beginPath();
  ctx.ellipse(x, groundY, opts.shadowR ?? r * 0.34, r * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, groundY - r * FEET_Y - up);
  if (opts.facing) ctx.rotate(opts.facing);
  paintBody(ctx, r, look, faceStyle, fakeFaceStyle, opts.pose);
  ctx.restore();

  // Both markers are drawn upright in screen space, outside the rotation —
  // a name that leaned with the man it names would be unreadable.
  const crown = groundY - up - r * FIGURE_HEIGHT_R;
  if (opts.star) {
    ctx.save();
    ctx.beginPath();
    const sr = r * 0.22, sy = crown - sr * 1.3;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? sr : sr * 0.45;
      const fx = x + Math.cos(a) * rad, fy = sy + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    if (opts.starRim) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.5, sr * 0.34);
      ctx.strokeStyle = opts.starRim;
      ctx.stroke();
    }
    ctx.fillStyle = "#fde68a";
    ctx.fill();
    ctx.restore();
  }

  if (opts.label) {
    ctx.font = `700 ${Math.max(8, r * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    // Pinned, not inherited: a caller that last drew a scoreboard may well
    // have left the baseline somewhere else, and a name half a head out of
    // place reads as a bug rather than as a setting.
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    const ly = crown - r * (opts.star ? 0.78 : 0.16);
    ctx.strokeText(opts.label, x, ly);
    ctx.fillStyle = opts.labelColor ?? "#ffffff";
    ctx.fillText(opts.label, x, ly);
    ctx.textAlign = "start";
  }
}

/**
 * THE GOALKEEPER.
 *
 * The same man as everybody else — same anatomy, same head, same shared
 * `drawPlayerHead` — in a keeper's pose: set and low with his hands out while
 * he waits, thrown across and full stretch once he goes.
 *
 * He had his own figure before, hand-drawn separately in the penalties stage,
 * with his own head size and his own arms. That is why he read as a different
 * species standing in the same goal, and it is exactly the sort of thing three
 * renderers for one game produces.
 */
export interface KeeperPose {
  /** −1 (his right, your left) … 1, how far across he is thrown. */
  dive: number;
  /** 0-1, how far into the save he is — 0 is set on his line. */
  lunge: number;
}

export function drawKeeper(
  ctx: CanvasRenderingContext2D, p: Projection, at: Vec2, look: FigureLook,
  pose: KeeperPose, faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  /** Same `scale` as `drawFigure` — pass `MATCH_SCALE` to match the real
   *  match's own size. Omitted, the keeper is unchanged from before. */
  opts?: { scale?: number },
): void {
  const { px, py, unit } = p;
  const r = Math.max(7, unit * FIGURE_R * (opts?.scale ?? 1));
  drawKeeperAt(ctx, px(at.x), py(at.y) + r * FEET_Y, r, look, pose, faceStyle, fakeFaceStyle);
}

/**
 * The keeper, at a point on the SCREEN — `drawKeeper`'s body, for a renderer
 * with its own camera. See `drawFigureAt`, of which this is the goalkeeping
 * pose: the same anatomy, the same head, the same shared `drawPlayerHead`.
 */
export function drawKeeperAt(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, r: number,
  look: FigureLook, pose: KeeperPose,
  faceStyle: FaceStyle, fakeFaceStyle: FakeFaceStyle,
  opts: FigureDrawOpts = {},
): void {
  const dive = Math.max(-1, Math.min(1, pose.dive));
  const lunge = Math.max(0, Math.min(1, pose.lunge));
  // He leans into the dive and, at full stretch, is nearly horizontal — the
  // one thing that makes a save read as a save from directly above.
  const lean = dive * (0.25 + lunge * 0.95);

  drawFigureAt(ctx, x, groundY, r, look, faceStyle, fakeFaceStyle, {
    ...opts,
    facing: lean + (opts.facing ?? 0),
    shadowR: opts.shadowR ?? r * (0.34 + lunge * 0.5),
    pose: {
      // Set: hands out and a little low. Diving: flung out over his head.
      // Set, his hands are genuinely OUT — measured off a screenshot rather
      // than guessed: at a narrower spread the arms ran barely half a head's
      // width before the glove, the sleeve covered most of that, and he read
      // as a blob with two white dots stuck to it. Going, they are over his
      // head and at full stretch, which is the shape you actually judge a
      // save by.
      armSpread: 0.75 + lunge * 0.25,
      armLift: 0.15 + lunge * 0.9,
      gloves: true,
      crouch: 0.55 - lunge * 0.55,
      ...opts.pose,
    },
  });
}

/**
 * The smallest a ball may be drawn, in pixels.
 *
 * The same idea as `drawFigure`'s own 7 px floor, and for the same reason: a
 * regulation ball at this camera's scale is a smudge, and the one thing on the
 * screen that everything else is about cannot be a smudge. Named rather than
 * inlined because it is a legibility decision, not a magic number.
 */
export const BALL_MIN_R = 6;

export function drawBall(
  ctx: CanvasRenderingContext2D, p: Projection, at: Vec2, z = 0,
): void {
  const { px, py, unit } = p;
  const x = px(at.x), y = py(at.y);
  const lift = z * unit * 0.5;
  /**
   * ── A real minimum, the way a figure already has one ──
   *
   * `drawFigure` floors its radius at 7 px because a man drawn to scale on a
   * phone is a smudge. The ball had a floor of 2.5, which is not a floor at
   * all: MEASURED against the camera this stage actually uses, it drew 7.8 px
   * across, and once the rim below takes its 16% there is about a pixel and a
   * half of white left in the middle. At kick-off it sits on the halfway line,
   * which is also white — so the one thing the whole screen is about was
   * invisible against the one line it starts on.
   *
   * A ball is not to scale for the same reason a player is not: it has to be
   * findable. This is the size the eye needs, not the size the laws of the
   * game specify.
   */
  const r = Math.max(BALL_MIN_R, unit * BALL_R * 2.6 * (1 + z * 0.06));

  // Its shadow stays on the grass while it climbs, which is the only thing
  // that makes height readable from directly above.
  ctx.fillStyle = TC.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (1 - Math.min(0.4, z * 0.05)), r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // A dark ring right round the outside, OUTSIDE the white, so the ball reads
  // against a white line as well as against grass. The old rim was drawn
  // inside the ball and ate most of it at this size.
  ctx.fillStyle = TC.ballEdge;
  ctx.beginPath();
  ctx.arc(x, y - lift, r + Math.max(1, r * 0.18), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TC.ball;
  ctx.beginPath();
  ctx.arc(x, y - lift, r, 0, Math.PI * 2);
  ctx.fill();
  // ── A rim and a panel, not a seam ──
  //
  // It used to be a single fat arc across the lower half. At the size a
  // five-a-side draws a ball that is invisible; at the size the trial's
  // penalty spot draws one it is unmistakably a MOUTH, which is what a
  // screenshot showed. A thin full rim plus one dark panel reads as a football
  // at every size this renderer is ever asked for and can never read as a face.
  ctx.fillStyle = TC.ballSeam;
  ctx.beginPath();
  ctx.arc(x, y - lift, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
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
