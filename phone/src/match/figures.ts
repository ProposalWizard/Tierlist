/**
 * HOW A PLAYER IS DRAWN ON THE PHONE'S PITCH — the website's match figure
 * (CanvasMatch paintFootballer / spriteHint and its keeper branch →
 * lib/star/matchFigure.ts drawMatchFigure, the 3D sprite look): the soft
 * contact shadow, then the sprite of the right clip, facing and frame
 * (match/sprites.ts). Which clip, as CanvasMatch picks it:
 *   - each man's speed and facing from how far he moved since last frame,
 *     with the same smoothing, hysteresis and thresholds;
 *   - Animations: New (always New on the website): every touch the engine
 *     writes in the ball's action log goes to the man who made it
 *     (lib/star/actionAnim.ts animFromAction), drawn as its 3D twin from
 *     atlas 1 (lib/star/sprite3dAnim.ts outfieldSpriteClip: touch, pass,
 *     shot, volley, chip, header, block, clearance), or the old kick clip
 *     (kickClipU) and a lean until that atlas is in;
 *   - you: the kick clip for KICK_POSE_S after your strike, mirrored for a
 *     left-footer; your aerial move (lib/star/aerialMoves.ts, atlas 3): its
 *     own clip, facing, frame and jump;
 *   - after a goal, the scorers' side celebrates;
 *   - sprint over 4.8 m/s, jog over 0.6, else idle (facing the ball);
 *   - the keeper: ready (facing out of his goal), the new dives (one-hand
 *     stretch, low dive, parry), the old dive until atlas 1 is in, lying where
 *     he landed, getting back up, a ball held to his chest or spilled, a jog
 *     across for a ball going well wide; drawn at 92% as the website does.
 *
 * THE CAMERA TILT. The website draws the match flat and tips the finished
 * canvas back 20 degrees with a CSS perspective (lib/star/cameraTilt.ts), so
 * every sprite is foreshortened with the grass. The phone draws the lines and
 * ball through the same sums point by point (view.ts toScreen); a figure is
 * drawn in the flat canvas's own pixels under that very perspective matrix
 * (view.ts tiltMatrix), so it leans back and shrinks exactly as on the website.
 *
 * Sizes are the website's: a man is MATCH_FIGURE_R_MULT × NEW_FIGURE_SCALE ×
 * MATCH_FIGURE_HEIGHT_R × SPRITE_HEIGHT_K of the camera's metre, divided by
 * the fixed-figure zoom (matchView FIXED_FIGURES); the keeper is
 * MATCH_KEEPER_R_SHARE × NEW_KEEPER_GROW of that.
 * Until the sheet has loaded, the old shapes (a shadow, a shirt, a head).
 */
import type { SkCanvas } from "@shopify/react-native-skia";
import { createCtx2D, type FontFor } from "../draw/ctx2d";
import { MATCH_FIGURE_R_MULT, MATCH_FIGURE_HEIGHT_R, MATCH_KEEPER_R_SHARE, FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import { NEW_FIGURE_SCALE, NEW_OUTFIELD_SHRINK, NEW_KEEPER_GROW, NEW_VIEW_WIDTH_M, REFERENCE_CAMERA_M } from "@/lib/star/matchView";
import { SPRITE_HEIGHT_K } from "@/lib/star/matchFigure";
import { animFromAction, outfieldAnimFrame, keeperAnimFrame, type ActorAnim } from "@/lib/star/actionAnim";
import { outfieldSpriteClip, keeperDiveClipNew, keeperStandingClip, keeperGetUpT, sideOfDive } from "@/lib/star/sprite3dAnim";
import { animSettings, type AnimFamily } from "@/lib/star/animDials";
import { KEEPER_SAVE_KIND } from "@/lib/star/keeperSaveKinds";
import { AERIAL_SPECS, aerialFacing, aerialRise, aerialFollow, liftToMeet, type AerialMove } from "@/lib/star/aerialMoves";
import { airZOf } from "@/lib/star/airDrawings";
import { POST_L, POST_R, CX } from "@/lib/star/pitch";
import type { Scenario, Ball } from "@/lib/star/canvasEngine";
import { sk, fill, stroke } from "./skiaApi";
import { toScreen, toCanvasPx, tiltMatrix, type Cam } from "./view";
import {
  drawSprite, drawFigureShadow, spritesReady, spriteKickStrikeT, keeperDiveClip, spriteClipReady, spriteClipFps, spriteClipFrames, spritePoints,
  type SpriteClip, type SpriteKit,
} from "./sprites";

export type FigureRole = "you" | "mate" | "opp" | "keeper";
export interface FigureLook { shirt: string; trim: string }

/** stages/TrialPenalties KICK_POSE_S: how long your kick pose shows after the strike. */
const KICK_POSE_S = 0.28;
/** figureDivFor with FIXED_FIGURES on: the same man in metres whatever the camera. */
const FIG_DIV = NEW_VIEW_WIDTH_M / REFERENCE_CAMERA_M;

interface Motion { x: number; y: number; t: number; vx: number; vy: number; dist: number; facing: number }
const motion = new Map<string, Motion>();
/** Each man's current animation (CanvasMatch actorAnimRef). */
const anims = new Map<string, ActorAnim>();
let seen: { ball: Ball | null; seq: number } = { ball: null, seq: 0 };
let sceneKey: unknown = null;
/** The keeper's dive: when it started, and where he landed (CanvasMatch keeperDiveStartRef, keeperLandRef). */
let diveStart: number | null = null;
let land: { x: number; y: number; offR: number; clip: SpriteClip } | null = null;

export interface FigureFrame {
  /** The clock, seconds. */
  now: number;
  ball: { x: number; y: number };
  celebrate: "us" | "them" | null;
  /** Seconds since your strike (the kick pose), or null. */
  kickT: number | null;
  /** The live ball (its action log), or null. */
  live?: Ball | null;
  sc?: Scenario | null;
  /** Your foot: 1 right, -1 left (a left-footer's kick is drawn mirrored). */
  foot?: number;
  /** Your aerial move this chance (driver.aerialNow()). */
  aerial?: { move: AerialMove; e: number; preS: number; struckAt: number | null } | null;
}
let frame: FigureFrame = { now: 0, ball: { x: 0, y: 0 }, celebrate: null, kickT: null };

/** Once per drawn frame. A new chance clears the men's motion and animations. */
export function beginFigures(key: unknown, f: FigureFrame) {
  if (key !== sceneKey) { motion.clear(); anims.clear(); sceneKey = key; diveStart = null; land = null; }
  frame = f;
  // Every touch the engine wrote down since last frame goes to the man who made it,
  // started at the moment it happened (Ball.clock), not at the end of the frame.
  const bl = f.live ?? null;
  if (bl && bl !== seen.ball) seen = { ball: bl, seq: 0 };
  if (bl?.actionLog) {
    for (const a of bl.actionLog) {
      if (a.seq <= seen.seq) continue;
      seen.seq = a.seq;
      if (a.actor === "you") continue;
      anims.set(a.actor, animFromAction(a, f.now - Math.max(0, (bl.clock ?? 0) - a.t), (f.sc ?? sceneKey) as object));
    }
  }
}

function spriteSeed(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return (Math.abs(h) % 997) / 97; }
function kitOf(look: FigureLook): SpriteKit { return { shirt: look.shirt, shorts: look.trim, socks: look.shirt }; }
function familyOf(a: ActorAnim): AnimFamily {
  return a.kind === "touch" ? "touch" : a.mode === "header" ? "headers" : a.kind === "block" || a.kind === "clearance" ? "blocks" : a.kind === "pass" ? "passes" : "shots";
}

/** The camera's px per metre across the flat canvas. */
export function unitPx(cam: Cam): number {
  const across = cam.facing === "up" ? cam.vp.x2 - cam.vp.x1 : cam.vp.y2 - cam.vp.y1;
  return cam.W / across;
}
/** CanvasMatch R (a man's base radius) in flat-canvas px. */
export function manR(cam: Cam) { return (unitPx(cam) / FIG_DIV) * MATCH_FIGURE_R_MULT * NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK; }
/** figureRForHeight. */
const rForHeight = (h: number) => Math.max(6, h / FIGURE_HEIGHT_R);

/** Draw in the flat canvas's pixels under the camera's tilt (the website's CSS perspective). */
function tilted(c: SkCanvas, cam: Cam, paint: () => void) {
  const m = tiltMatrix(cam);
  if (!m) { paint(); return; }
  c.save();
  c.concat(m);
  paint();
  c.restore();
}

/** One outfield man at pitch point `p`. `id` is CanvasMatch's sid (you, mate0, run0, def0, follower…). */
export function drawMan(c: SkCanvas, cam: Cam, id: string, p: { x: number; y: number }, role: FigureRole, look: FigureLook, highlight = false, label?: string) {
  if (!spritesReady()) { const s = toScreen(cam, p); oldFigure(c, s.X, s.Y, rForHeight(manR(cam) * s.k * MATCH_FIGURE_HEIGHT_R) * 0.42, role, look, highlight); return; }
  const s = toCanvasPx(cam, p);
  const r = rForHeight(manR(cam) * MATCH_FIGURE_HEIGHT_R);
  const height = r * FIGURE_HEIGHT_R * SPRITE_HEIGHT_K;
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
  const angle = (wx: number, wy: number) => { const b = toCanvasPx(cam, { x: wx, y: wy }); return Math.atan2(b.Y - s.Y, b.X - s.X); };
  const speed = Math.hypot(m.vx, m.vy);
  const kit = kitOf(look);
  let lift = 0;

  // Your aerial move: its own clip and frame, never the running clips (aerialMoves.ts).
  const aer = id === "you" ? frame.aerial : null;
  if (aer) {
    const spec = AERIAL_SPECS[aer.move];
    const clip = spec.clip;
    if (spriteClipReady("player", clip)) {
      const sc = frame.sc;
      const fps = spriteClipFps("player", clip) || 10;
      const goalAng = angle(CX, 0);
      const mate = sc?.teammates[0];
      const fromAng = mate ? angle(mate.x, mate.y) : goalAng + Math.PI / 2;
      const foot = frame.foot ?? 1;
      const facing = aerialFacing(aer.move, goalAng, fromAng, foot);
      const ph = aer.struckAt !== null ? aerialFollow(aer.move, Math.max(0, now - aer.struckAt)) : aerialRise(aer.move, Math.max(0, aer.e - aer.preS));
      const tFrame = (ph.frame + 0.5) / fps;
      const tHit = (spec.contactFrame + 0.5) / fps;
      const pts = spritePoints("player", clip, tHit, facing, height, foot < 0);
      const P = pts ? pts[spec.point] : null;
      const unitH = unitPx(cam);
      const cy = P ? P.y : -0.9 * height;
      const meet = liftToMeet(aer.move, (sc ? airZOf(sc) : 1) * unitH, (P ? P.g : 0) - cy, unitH);
      lift = meet.liftPx * ph.liftK;
      tilted(c, cam, () => {
        drawFigureShadow(c, s.X, s.Y, r);
        drawSprite(c, s.X, s.Y - lift, { char: "player", clip, t: tFrame, facingRad: facing, kit, height, mirror: foot < 0 });
        if (highlight) marker(c, s.X, s.Y - lift - height, r);
      });
      return;
    }
  }

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

  const them = role === "opp";
  const settings = animSettings();
  const a = anims.get(id);
  const live = a && a.scene === (frame.sc ?? sceneKey) && settings.on[familyOf(a)] ? a : undefined;
  const e = live ? now - live.start : 0;
  const nc = live ? outfieldSpriteClip(live, e, (cl) => spriteClipFps("player", cl)) : null;
  const yourKick = id === "you" && frame.kickT !== null && frame.kickT < KICK_POSE_S;
  const newClip = !!nc && !yourKick && spriteClipReady("player", nc.clip);
  // The drawn move's numbers (outfieldAnimFrame): the old kick clip and the lean until the New clips are in.
  const fr = live && !newClip ? outfieldAnimFrame(live, e, (frame.foot ?? 1) >= 0 ? 1 : -1, settings.dials) : null;
  let clip: SpriteClip, t: number;
  if (newClip && nc) { clip = nc.clip; t = nc.t; }
  else if (yourKick) { clip = "kick"; t = Math.max(0, spriteKickStrikeT() - 0.12 + frame.kickT!); }
  else if (fr && fr.kickClipU !== null) { clip = "kick"; t = Math.max(0, spriteKickStrikeT() * fr.kickClipU); }
  else if (frame.celebrate && frame.celebrate === (them ? "them" : "us")) { clip = "celebrate"; t = now + spriteSeed(id); }
  else if (speed > 4.8) { clip = "sprint"; t = m.dist / 5.2; }
  else if (speed > 0.6) { clip = "jog"; t = m.dist / 2.8; }
  else { clip = "idle"; t = now + spriteSeed(id); }
  if (fr && fr.liftR > 0) lift = fr.liftR * r;
  const mirror = clip === "kick" && id === "you" && (frame.foot ?? 1) < 0;
  const lean = !newClip && fr?.lean ? fr.lean : 0;
  tilted(c, cam, () => {
    drawFigureShadow(c, s.X, s.Y, r);
    const gy = s.Y - lift;
    if (lean) { c.save(); c.translate(s.X, gy); c.rotate((lean * 180) / Math.PI, 0, 0); c.translate(-s.X, -gy); }
    drawSprite(c, s.X, gy, { char: "player", clip, t, facingRad: facing, kit, height, mirror });
    if (lean) c.restore();
    if (highlight) marker(c, s.X, gy - height, r);
    if (label) nameLabel(c, label, s.X, gy - height, r, highlight);
  });
}

/** Fonts for the drawn names (the phone's matchFont, set by the screen; none headless: no names). */
let labelFontFor: FontFor | null = null;
export function setFigureFonts(f: FontFor | null) { labelFontFor = f; }
/**
 * A taker's name over his head (matchFigure drawMarkers' label): 700 weight, max(8, 0.3 r) px,
 * a dark outline, white, upright above his crown. The packed app (the reference) shows this
 * size; the website's newer labelBig (15 px and up) is not in it.
 */
function nameLabel(c: SkCanvas, text: string, x: number, crown: number, r: number, star: boolean) {
  if (!labelFontFor) return;
  const g = createCtx2D(sk(), c, { width: 1, height: 1, fontFor: labelFontFor }) as unknown as CanvasRenderingContext2D;
  g.font = `700 ${Math.max(8, r * 0.3)}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.lineWidth = Math.max(2, r * 0.1);
  g.lineJoin = "round";
  g.strokeStyle = "rgba(0,0,0,0.65)";
  const ly = crown - r * (star ? 0.78 : 0.16);
  g.strokeText(text, x, ly);
  g.fillStyle = "#ffffff";
  g.fillText(text, x, ly);
}

/** The star over your head (matchFigure drawMarkers), upright above his crown. */
function marker(c: SkCanvas, x: number, crown: number, r: number) {
  const S = sk();
  const sr = r * 0.22, sy = crown - sr * 1.3;
  const b = S.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? sr : sr * 0.45;
    const fx = x + Math.cos(a) * rad, fy = sy + Math.sin(a) * rad;
    if (i === 0) b.moveTo(fx, fy); else b.lineTo(fx, fy);
  }
  b.close();
  const path = b.build();
  c.drawPath(path, stroke("rgba(0,0,0,0.55)", Math.max(1.5, sr * 0.34)));
  c.drawPath(path, fill("#fde68a"));
}

/**
 * The keeper (CanvasMatch's keeper branch, new view). `kk` is the scenario's
 * keeper; `look` the kit he wears.
 */
export function drawKeeperFig(c: SkCanvas, cam: Cam, kk: Scenario["keeper"], look: FigureLook) {
  const s = toCanvasPx(cam, kk);
  const KR = manR(cam) * MATCH_KEEPER_R_SHARE * (NEW_KEEPER_GROW / NEW_OUTFIELD_SHRINK);
  const kr = rForHeight(KR * MATCH_FIGURE_HEIGHT_R);
  const lunge = kk.saveLunge > 0 ? kk.saveLunge : 0;
  const sign = kk.saveLunge > 0 ? (kk.saveDir || 1) : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
  const kind = (kk.saveKind ?? null) as keyof typeof KEEPER_SAVE_KIND | null;
  const K = kind ? KEEPER_SAVE_KIND[kind] : null;
  const weight = Math.sin(kk.idleT * 0.9) * 0.05;
  const cx = s.X + sign * KR * lunge * (K ? K.reachK : 1.0) * 0.3;
  if (!spritesReady()) { const q = toScreen(cam, kk); oldFigure(c, q.X, q.Y, kr * 0.42 * q.k, "keeper", look, false); return; }
  const now = frame.now;
  const f = cam.facing;
  const kFacing = f === "right" ? Math.PI : f === "left" ? 0 : Math.PI / 2;
  const kit = kitOf(look);
  const settings = animSettings();
  const ka = anims.get("keeper");
  const kFamilyOn = !!ka && (ka.save === "catch" || ka.save === "fumble" ? settings.on.keeperCatch : settings.on.keeperSaves);
  const kAnim = ka && ka.scene === (frame.sc ?? sceneKey) && ka.kind === "save" && kFamilyOn
    ? keeperAnimFrame(ka, now - ka.start, kind === "high" || kind === "fingertip", settings.dials) : null;
  const landAt = (l: { x: number; y: number; offR: number }) => { const q = toCanvasPx(cam, l); return { x: q.X + l.offR * KR, y: q.Y }; };
  let at: { x: number; y: number } | null = null;
  let clip: SpriteClip = "ready", t = kk.idleT * 0.6, centre = 0, facing = kFacing;
  const bl = frame.live;
  const wideOfGoal = !!bl && kk.saves === 0 && Math.abs(bl.pos.x - (POST_L + POST_R) / 2) > (POST_R - POST_L) / 2 + 2.5;
  if (lunge > 0.04 && sign !== 0 && wideOfGoal && !land) {
    const b = toCanvasPx(cam, { x: kk.x + sign, y: kk.y });
    diveStart = null;
    clip = "jog"; t = kk.idleT; facing = Math.atan2(b.Y - s.Y, b.X - s.X);
  } else if (lunge > 0.04 && sign !== 0) {
    const b = toCanvasPx(cam, { x: kk.x + sign, y: kk.y });
    if (diveStart === null) diveStart = ka && kAnim ? Math.min(now, ka.start) : now;
    t = Math.min(lunge * 0.6, (now - diveStart) * 0.75);
    clip = keeperDiveClip(kFacing, b.X - s.X, b.Y - s.Y);
    if (kAnim && ka) {
      const nc = keeperDiveClipNew(ka.save, ka.at?.z ?? 0, kind === "high" || kind === "fingertip", sideOfDive(clip));
      if (nc && spriteClipReady("keeper", nc)) clip = nc;
    }
    if (t >= 0.55 && !land) land = { x: kk.x, y: kk.y, offR: (cx + KR * weight * (1 - lunge) - s.X) / (KR || 1), clip };
    if (land) at = landAt(land);
    centre = Math.min(1, t / 0.4);
  } else if (land) {
    at = landAt(land);
    clip = land.clip; t = 1; centre = 1;
    const upClip: SpriteClip = sideOfDive(land.clip) === "R" ? "getUpR" : "getUpL";
    if (kAnim && kAnim.getUp > 0 && spriteClipReady("keeper", upClip)) {
      clip = upClip; t = keeperGetUpT(kAnim.getUp, spriteClipFrames("keeper", upClip), spriteClipFps("keeper", upClip)); centre = 1 - kAnim.getUp;
    }
  } else {
    diveStart = null;
    const sc3 = kAnim && ka ? keeperStandingClip(ka.save) : null;
    if (sc3 && ka && spriteClipReady("keeper", sc3)) { clip = sc3; t = now - ka.start; }
  }
  const x = at ? at.x : cx + KR * weight * (1 - lunge), y = at ? at.y : s.Y;
  const height = kr * FIGURE_HEIGHT_R * SPRITE_HEIGHT_K;
  tilted(c, cam, () => {
    drawFigureShadow(c, x, y, kr);
    drawSprite(c, x, y, { char: "keeper", clip, t, facingRad: facing, kit, height, centre, alpha: 0.92 });
  });
}

/** The phone's first drawing, kept for the moment before the sheet has loaded. */
function oldFigure(c: SkCanvas, x: number, y: number, r: number, role: FigureRole, look: FigureLook, highlight: boolean) {
  c.drawOval(sk().XYWHRect(x - r * 1.1, y - r * 0.35, r * 2.2, r * 0.7), fill("rgba(0,0,0,0.28)"));
  c.drawCircle(x, y - r * 0.9, r, fill(look.shirt));
  c.drawCircle(x, y - r * 0.9, r, stroke(look.trim, Math.max(1, r * 0.18)));
  c.drawCircle(x, y - r * 2.05, r * 0.55, fill(role === "keeper" ? "#f1c27d" : "#e0ac69"));
  if (highlight) c.drawCircle(x, y - r * 0.9, r * 1.45, stroke("#f5c542", Math.max(1.5, r * 0.22)));
}
