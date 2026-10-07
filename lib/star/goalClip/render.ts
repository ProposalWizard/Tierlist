/**
 * ONE FRAME OF A GOAL VIDEO.
 *
 * Draws the recorded goal (track.ts) at one moment, from one camera
 * (cameras.ts), with the graphics the kind of post wants (edit.ts): the
 * stadium and pitch (scene.ts), every man as the game's own 3D figures
 * (sprites.ts — the ones the match draws, tinted to the club's kit), the
 * keeper's dive, the ball and its shadow, the net giving where the ball hit it.
 *
 * Positions come from the recording only. What a man is DOING (running,
 * kicking, diving, celebrating) is read off the recording too: his speed from
 * how far he moved between frames, a kick from the ball's own log of who
 * struck it and when. Nothing is invented and nothing is random, so the same
 * recording always draws the same frame.
 */
import type { FpCamera } from "../firstPersonView";
import { project } from "../firstPersonView";
import { CX, POST_L, POST_R, GOAL_H } from "../pitch";
import { kitsOf } from "../kits";
import { shortClub } from "../media/grammar";
import {
  drawSprite, spritesReady, keeperDiveClip, spriteKickStrikeT, spriteClipLength, type SpriteClip,
} from "../sprites";
import { drawFigureAt, figureRForHeight } from "../fiveASide/render";
import { DEFAULT_FACE_STYLE } from "../faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "../fakeFaceStyle";
import { frameAt, trackDuration, type GoalTrack, type FrameState } from "./track";
import { rigFor, type ClipAngle } from "./cameras";
import {
  drawSky, drawPitch, drawStadium, drawFloodlights, drawGoalPart, drawCornerFlags, goalPartAnchor, toCam,
  type GoalPart, type NetBulge, type SceneLook,
} from "./scene";
import { momentAt, type Edit, type EditMoment } from "./edit";

/** Who posted the video, for the watermark. */
export interface ClipCredit {
  handle?: string;
  name?: string;
}

// ── What the recording says each man is doing ───────────────────────────────

interface Prep {
  /** Metres each man has run by each frame (his run cycle keeps step with it). */
  ran: Float32Array;
  nb: number;
  keeperIdx: number;
  /** Clip time his save dive starts, and where he lands. */
  diveStart: number | null;
  landAt: { x: number; y: number } | null;
  /** Strikes per man: clip time and how. */
  kicks: Map<string, { t: number; mode?: string }[]>;
  look: SceneLook;
}

const preps = new WeakMap<GoalTrack, Prep>();

function idHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function prepOf(track: GoalTrack): Prep {
  const hit = preps.get(track);
  if (hit) return hit;
  const nb = track.bodies.length;
  const ran = new Float32Array(track.n * nb);
  let prev = frameAt(track, 0);
  for (let f = 1; f < track.n; f++) {
    const cur = frameAt(track, f / track.fps);
    for (let i = 0; i < nb; i++) {
      const d = Math.hypot(cur.bodies[i].x - prev.bodies[i].x, cur.bodies[i].y - prev.bodies[i].y);
      ran[f * nb + i] = ran[(f - 1) * nb + i] + d;
    }
    prev = cur;
  }
  const keeperIdx = track.bodies.findIndex(b => b.role === "keeper");
  let diveStart: number | null = null;
  let landAt: { x: number; y: number } | null = null;
  for (let f = 0; f < track.n; f++) {
    const fr = frameAt(track, f / track.fps);
    if (fr.keeper.lunge > 0.04 && fr.keeper.dir !== 0) { diveStart = f / track.fps; break; }
  }
  if (diveStart !== null && keeperIdx >= 0) {
    // The match stops him where the dive lands (he does not slide on after
    // the ball), about two-thirds of a second into it.
    const k = frameAt(track, Math.min(trackDuration(track), diveStart + 0.67)).bodies[keeperIdx];
    landAt = { x: k.x, y: k.y };
  }
  const kicks = new Map<string, { t: number; mode?: string }[]>();
  for (const e of track.events) {
    if (!e.who || (e.kind !== "shot" && e.kind !== "pass" && e.kind !== "clearance")) continue;
    const l = kicks.get(e.who) ?? [];
    l.push({ t: e.t, mode: e.mode });
    kicks.set(e.who, l);
  }
  const home = kitsOf(track.meta.home), away = kitsOf(track.meta.away);
  const look: SceneLook = {
    // Floodlights for about half of all matches, fixed per goal.
    night: track.meta.weather === "rain" ? false : idHash(track.meta.id) % 2 === 0,
    weather: track.meta.weather,
    homeColours: [home.home.shirt, home.home.shirt, home.home.trim],
    awayColours: [away.home.shirt, away.home.trim],
  };
  const p: Prep = { ran, nb, keeperIdx, diveStart, landAt, kicks, look };
  preps.set(track, p);
  return p;
}

function ranAt(p: Prep, track: GoalTrack, i: number, t: number): number {
  const pos = Math.max(0, Math.min(track.n - 1, t * track.fps));
  const f0 = Math.floor(pos), f1 = Math.min(track.n - 1, f0 + 1), k = pos - f0;
  return p.ran[f0 * p.nb + i] * (1 - k) + p.ran[f1 * p.nb + i] * k;
}

/** The screen angle a man faces (sprites.ts convention: 0 right, PI/2 down),
 *  given the way he faces on the pitch. */
function screenFacing(cam: FpCamera, dx: number, dy: number): number {
  const fwd = cam.forward ?? { x: 0, y: -1 };
  const u = dx * -fwd.y + dy * fwd.x;
  const w = dx * fwd.x + dy * fwd.y;
  return Math.atan2(-w, u);
}

// ── Drawing ─────────────────────────────────────────────────────────────────

interface Drawable { d: number; draw: () => void }

const FIG_H = 1.85;
/** Men drawn a touch bigger than life, so they read on a phone. */
const FIG_K = 1.1;

function shadow(ctx: CanvasRenderingContext2D, cam: FpCamera, x: number, y: number, rM: number, alpha: number): void {
  const c = project(cam, x, y, 0);
  const a = project(cam, x + rM, y, 0), b = project(cam, x, y + rM, 0);
  if (!c || !a || !b) return;
  const rx = Math.max(1, Math.hypot(a.px - c.px, a.py - c.py));
  const ry = Math.max(0.6, Math.hypot(b.px - c.px, b.py - c.py));
  const rot = Math.atan2(a.py - c.py, a.px - c.px);
  ctx.save();
  ctx.translate(c.px, c.py);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMan(
  ctx: CanvasRenderingContext2D, cam: FpCamera, track: GoalTrack, p: Prep, fr: FrameState, i: number, t: number,
): Drawable | null {
  const body = track.bodies[i];
  let pos = fr.bodies[i];
  const keeper = body.role === "keeper";
  // A keeper who has landed stays where he landed.
  const diving = keeper && p.diveStart !== null && t >= p.diveStart;
  const diveT = diving ? Math.min(0.66, (t - (p.diveStart ?? 0)) * 0.75 + 0.05) : 0;
  if (diving && diveT >= 0.55 && p.landAt) pos = { x: p.landAt.x, y: p.landAt.y, z: 0 };
  const feet = project(cam, pos.x, pos.y, 0);
  if (!feet) return null;
  const { W, H } = cam;
  if (feet.px < -W * 0.3 || feet.px > W * 1.3 || feet.py < -H * 0.3 || feet.py > H * 1.6) return null;
  const height = FIG_H * feet.scale * FIG_K;
  if (height < 2) return null;
  const depth = toCam(cam, pos.x, pos.y, 1).d;

  // What he is doing.
  const v = (() => {
    const h = 1 / track.fps;
    const a = frameAt(track, Math.max(0, t - h)).bodies[i], b = frameAt(track, Math.min(trackDuration(track), t + h)).bodies[i];
    return { vx: (b.x - a.x) / (2 * h), vy: (b.y - a.y) / (2 * h) };
  })();
  const speed = Math.hypot(v.vx, v.vy);
  let facing: number;
  let clip: SpriteClip;
  let clipT: number;
  let centre = 0;
  let lift = 0;
  if (keeper) {
    facing = screenFacing(cam, 0, 1);
    if (diving) {
      const a = project(cam, pos.x, pos.y, 0), b = project(cam, pos.x + (fr.keeper.dir || 1), pos.y, 0);
      clip = a && b ? keeperDiveClip(facing, b.px - a.px, b.py - a.py) : "diveR";
      clipT = diveT;
      centre = Math.min(1, diveT / 0.4);
    } else {
      clip = "ready";
      clipT = t * 0.6;
    }
  } else {
    const ball = fr.ball;
    const toBall = { x: ball.x - pos.x, y: ball.y - pos.y };
    facing = speed > 0.8 ? screenFacing(cam, v.vx, v.vy) : screenFacing(cam, toBall.x, toBall.y);
    const ran = ranAt(p, track, i, t);
    clip = speed > 5.2 ? "sprint" : speed > 0.7 ? "jog" : "idle";
    clipT = clip === "sprint" ? ran / 6.5 : clip === "jog" ? ran / 3.4 : t;
    // A strike: the kick clip, timed so the boot meets the ball on the frame
    // the ball's log says he struck it. A header is a jump instead.
    const strikeAt = spriteKickStrikeT() || 0.33;
    const kickLen = spriteClipLength("player", "kick") || 0.67;
    for (const k of p.kicks.get(body.id) ?? []) {
      if (k.mode === "header") {
        const u = (t - (k.t - 0.28)) / 0.56;
        if (u >= 0 && u <= 1) { lift = Math.sin(Math.PI * u) * 0.55; clip = "idle"; clipT = 0; }
        continue;
      }
      const s = t - (k.t - strikeAt);
      if (s >= 0 && s <= kickLen) {
        clip = "kick";
        clipT = s;
        facing = screenFacing(cam, toBall.x || 0.01, toBall.y);
      }
    }
    // The man who scored, once it has gone in.
    if (body.id === track.meta.scorerBody && t > track.goalT + 0.35) {
      clip = "celebrate";
      clipT = t - (track.goalT + 0.35);
      facing = screenFacing(cam, -(cam.forward?.x ?? 0), -(cam.forward?.y ?? -1));
    }
    lift += pos.z * 0.9;   // a wall man in the air
  }
  return {
    d: depth,
    draw: () => {
      shadow(ctx, cam, pos.x, pos.y, keeper && diving ? 0.7 : 0.42, 0.3);
      const liftPx = lift * feet.scale;
      const kit = { shirt: body.kit.shirt, shorts: body.kit.shorts, socks: body.kit.socks ?? body.kit.shirt };
      const drawn = spritesReady() && drawSprite(ctx, feet.px, feet.py - liftPx, {
        char: keeper ? "keeper" : "player", clip, t: Math.max(0, clipT), facingRad: facing, kit, height, centre,
      });
      if (!drawn) {
        // Before the figures have loaded: the game's drawn man, same kit.
        drawFigureAt(ctx, feet.px, feet.py, figureRForHeight(height), {
          shirt: kit.shirt, shorts: kit.shorts, trim: kit.shorts,
        }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { liftPx, shadowR: 0 });
      }
    },
  };
}

function drawBall(ctx: CanvasRenderingContext2D, cam: FpCamera, track: GoalTrack, t: number, ball: { x: number; y: number; z: number }): Drawable | null {
  const p = project(cam, ball.x, ball.y, ball.z);
  if (!p) return null;
  const depth = toCam(cam, ball.x, ball.y, ball.z).d;
  return {
    d: depth,
    draw: () => {
      const r = Math.max(2.6, 0.11 * 2.1 * p.scale);
      // Its shadow, fainter the higher it is.
      shadow(ctx, cam, ball.x, ball.y, 0.13 * 1.7, Math.max(0.08, 0.32 - ball.z * 0.05));
      // A streak behind a ball that is flying.
      const h = 1 / 60;
      const back = frameAt(track, Math.max(0, t - 3 * h)).ball;
      const sp = Math.hypot(ball.x - back.x, ball.y - back.y, ball.z - back.z) / (3 * h);
      if (sp > 10) {
        for (let k = 3; k >= 1; k--) {
          const g = frameAt(track, Math.max(0, t - k * h * 1.6)).ball;
          const q = project(cam, g.x, g.y, g.z);
          if (!q) continue;
          ctx.fillStyle = `rgba(255,255,255,${0.12 * (4 - k) / 3})`;
          ctx.beginPath(); ctx.arc(q.px, q.py, r * (1 - k * 0.12), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = "rgba(15,15,15,0.85)";
      ctx.beginPath(); ctx.arc(p.px, p.py, r * 1.12, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(p.px - r * 0.35, p.py - r * 0.4, r * 0.1, p.px, p.py, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#cfd4da");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2); ctx.fill();
      if (r > 3) {
        ctx.fillStyle = "rgba(30,30,30,0.6)";
        const spin = t * 9;
        for (let k = 0; k < 2; k++) {
          const a = spin + k * Math.PI;
          ctx.beginPath(); ctx.arc(p.px + Math.cos(a) * r * 0.45, p.py + Math.sin(a) * r * 0.45, r * 0.26, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  };
}

/** The scene at clip time `t` from `angle`. */
export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, angle: ClipAngle, t: number): FpCamera {
  const p = prepOf(track);
  const rig = rigFor(track, angle, t, W, H);
  const cam = rig.cam;
  ctx.save();
  if (rig.roll) {
    // A hand-held phone: turn the picture, a little bigger so no corner shows.
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rig.roll);
    ctx.scale(1.06, 1.06);
    ctx.translate(-W / 2, -H / 2);
  }
  drawSky(ctx, cam, p.look);
  drawPitch(ctx, cam, p.look);
  drawStadium(ctx, cam, p.look, rig.skip);
  drawFloodlights(ctx, cam, p.look);
  drawCornerFlags(ctx, cam);

  const fr = frameAt(track, t);
  const items: Drawable[] = [];
  for (let i = 0; i < track.bodies.length; i++) {
    const m = drawMan(ctx, cam, track, p, fr, i, t);
    if (m) items.push(m);
  }
  const b = drawBall(ctx, cam, track, t, fr.ball);
  if (b) items.push(b);
  // The net gives where the ball has gone into it.
  const inNet = fr.ball.y < -0.15 && fr.ball.x > POST_L - 0.3 && fr.ball.x < POST_R + 0.3 && fr.ball.z < GOAL_H + 0.3;
  const bulge: NetBulge | null = inNet ? { x: fr.ball.x, z: Math.max(0.25, fr.ball.z), depth: Math.min(0.32, Math.max(0, (-fr.ball.y - 0.5) * 0.45)) } : null;
  for (const part of ["back", "left", "right", "roof", "frame"] as GoalPart[]) {
    const a = goalPartAnchor(part);
    items.push({ d: toCam(cam, a[0], a[1], a[2]).d, draw: () => drawGoalPart(ctx, cam, part, bulge) });
  }
  items.sort((x, y) => y.d - x.d);
  for (const it of items) it.draw();

  // Weather over the top.
  if (p.look.weather === "rain") {
    ctx.strokeStyle = "rgba(220,230,240,0.35)";
    ctx.lineWidth = 1;
    const seed = Math.floor(t * 30);
    for (let k = 0; k < 90; k++) {
      const h = idHash(`${seed}:${k}`);
      const x = (h % 1000) / 1000 * W, y = ((h >>> 10) % 1000) / 1000 * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke();
    }
  } else if (p.look.weather === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let k = 0; k < 70; k++) {
      const h = idHash(`s${k}`);
      const x = ((h % 1000) / 1000 * W + Math.sin(t * 0.8 + k) * 8 + W) % W;
      const y = (((h >>> 10) % 1000) / 1000 * H + t * 40) % H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
  return cam;
}

// ── The graphics a broadcaster, a page or a fan puts over it ────────────────

const CODE: Record<string, string> = {
  "Arsenal": "ARS", "AFC Bournemouth": "BOU", "Liverpool": "LIV", "Leeds United": "LEE", "Crystal Palace": "CRY",
  "Brentford": "BRE", "Hull City": "HUL", "Brighton & Hove Albion": "BHA", "Everton": "EVE", "Newcastle United": "NEW",
  "Nottingham Forest": "NFO", "Ipswich Town": "IPS", "Manchester City": "MCI", "Tottenham Hotspur": "TOT",
  "Aston Villa": "AVL", "Chelsea": "CHE", "Fulham FC": "FUL", "Sunderland": "SUN", "Manchester United": "MUN",
  "Coventry City": "COV", "West Ham United": "WHU", "Wolverhampton Wanderers": "WOL", "Burnley": "BUR",
  "Queens Park Rangers": "QPR", "West Bromwich Albion": "WBA", "Sheffield United": "SHU",
};

/** A three-letter code for a scoreboard: the real one for the clubs that
 *  have one here, else the first letters of the short name. */
export function teamCode(club: string): string {
  if (CODE[club]) return CODE[club];
  const s = shortClub(club).replace(/[^A-Za-z ]/g, "").trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return s.slice(0, 3).toUpperCase() || "FC";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function scoreNow(track: GoalTrack, t: number): [number, number] {
  const after = track.meta.scoreAfter ?? [0, 0];
  if (t >= track.goalT) return after;
  // Before it goes in, the side that scores is one fewer.
  const usHome = track.meta.youAreHome;
  return usHome ? [Math.max(0, after[0] - 1), after[1]] : [after[0], Math.max(0, after[1] - 1)];
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function drawScoreBug(ctx: CanvasRenderingContext2D, W: number, track: GoalTrack, t: number): void {
  const s = W / 640;
  const [h, a] = scoreNow(track, t);
  const x = 14 * s, y = 12 * s, hgt = 22 * s;
  const home = teamCode(track.meta.home), away = teamCode(track.meta.away);
  ctx.font = `800 ${13 * s}px ${FONT}`;
  const wTeam = 34 * s, wScore = 42 * s, wMin = 40 * s;
  const kh = kitsOf(track.meta.home).home, ka = kitsOf(track.meta.away).home;
  ctx.fillStyle = "rgba(10,12,20,0.88)";
  roundRect(ctx, x, y, wTeam * 2 + wScore + wMin, hgt, 4 * s);
  ctx.fill();
  ctx.fillStyle = kh.shirt; ctx.fillRect(x + 3 * s, y + 4 * s, 3 * s, hgt - 8 * s);
  ctx.fillStyle = ka.shirt; ctx.fillRect(x + wTeam + wScore + wTeam - 6 * s, y + 4 * s, 3 * s, hgt - 8 * s);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(home, x + wTeam / 2 + 3 * s, y + hgt / 2);
  // The score flashes in when it changes.
  const flash = t >= track.goalT && t < track.goalT + 1.2 ? 0.5 + 0.5 * Math.cos((t - track.goalT) * 10) : 0;
  ctx.fillStyle = flash > 0 ? `rgba(250,204,21,${0.35 + 0.5 * flash})` : "rgba(255,255,255,0.12)";
  ctx.fillRect(x + wTeam, y + 2 * s, wScore, hgt - 4 * s);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${h}-${a}`, x + wTeam + wScore / 2, y + hgt / 2);
  ctx.fillText(away, x + wTeam + wScore + wTeam / 2 - 3 * s, y + hgt / 2);
  ctx.font = `700 ${12 * s}px ${FONT}`;
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText(`${track.meta.minuteLabel}'`, x + wTeam * 2 + wScore + wMin / 2, y + hgt / 2);
}

function drawGoalBanner(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, t: number): void {
  const since = t - (track.goalT + 0.55);
  if (since < 0) return;
  const s = W / 640;
  const slide = Math.min(1, since / 0.3);
  const ease = 1 - (1 - slide) ** 3;
  const w = 300 * s, h = 46 * s;
  const x = -w + (w + 22 * s) * ease, y = H - h - 22 * s;
  const kit = kitsOf(track.meta.youAreHome ? track.meta.home : track.meta.away).home;
  ctx.fillStyle = "rgba(10,12,20,0.9)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = kit.shirt;
  ctx.fillRect(x, y, 8 * s, h);
  ctx.fillStyle = "#facc15";
  ctx.font = `900 ${12 * s}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("GOAL", x + 18 * s, y + 17 * s);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${18 * s}px ${FONT}`;
  ctx.fillText(track.meta.scorer.toUpperCase(), x + 18 * s, y + 37 * s, w - 80 * s);
  ctx.font = `800 ${16 * s}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`${track.meta.minuteLabel}'`, x + w - 14 * s, y + 37 * s);
}

function drawTag(ctx: CanvasRenderingContext2D, W: number, label: string, colour: string): void {
  const s = W / 640;
  ctx.font = `900 ${12 * s}px ${FONT}`;
  const tw = ctx.measureText(label).width + 16 * s;
  const x = W - tw - 14 * s, y = 12 * s;
  ctx.fillStyle = colour;
  roundRect(ctx, x, y, tw, 22 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + tw / 2, y + 11 * s);
}

function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, credit: ClipCredit | undefined): void {
  const s = W / 640;
  const h = 54 * s;
  const g = ctx.createLinearGradient(0, H - h * 1.6, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - h * 1.6, W, h * 1.6);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${22 * s}px ${FONT}`;
  ctx.fillText(track.meta.scorer.toUpperCase(), 18 * s, H - 26 * s, W * 0.7);
  ctx.font = `700 ${13 * s}px ${FONT}`;
  ctx.fillStyle = "#d1d5db";
  const [hs, as] = track.meta.scoreAfter ?? [0, 0];
  ctx.fillText(`${track.meta.minuteLabel}' · ${shortClub(track.meta.home)} ${hs}-${as} ${shortClub(track.meta.away)}`, 18 * s, H - 9 * s, W * 0.8);
  if (credit?.handle) {
    // Top left (the replay's tag has the top right), on a dark pill so it
    // reads over a busy crowd.
    const label = `@${credit.handle.replace(/^@/, "")}`;
    ctx.font = `800 ${12 * s}px ${FONT}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, 10 * s, 11 * s, tw + 12 * s, 21 * s, 4 * s);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, 16 * s, 21.5 * s);
  }
}

/** A sweep across the screen as a replay starts (a broadcaster's wipe). */
function drawWipe(ctx: CanvasRenderingContext2D, W: number, H: number, into: number, colour: string): void {
  const dur = 0.42;
  if (into >= dur) return;
  const k = into / dur;
  const x = -W * 0.4 + (W * 1.8) * k;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - W * 0.25, 0); ctx.lineTo(x + W * 0.15, 0); ctx.lineTo(x - W * 0.05, H); ctx.lineTo(x - W * 0.45, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A faint grain and vignette on a phone video. */
function drawPhoneLook(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Heads of the people in front, along the bottom.
  ctx.fillStyle = "rgba(12,12,16,0.92)";
  const base = H * 0.965;
  for (let k = 0; k < 6; k++) {
    const cx = (k + 0.5) / 6 * W + Math.sin(t * 0.7 + k * 1.7) * W * 0.012;
    const r = W * (0.075 + 0.02 * ((k * 37) % 3));
    ctx.beginPath();
    ctx.arc(cx, base - r * 0.2 + Math.sin(t * 1.3 + k) * 2, r, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - r * 1.4, base - r * 0.2, r * 2.8, H - base + r);
  }
}

/** One finished frame of an edit, at video time `outT`. */
export function drawEditFrame(ctx: CanvasRenderingContext2D, edit: Edit, outT: number, credit?: ClipCredit, moment?: EditMoment): void {
  const W = edit.w, H = edit.h;
  const m = moment ?? momentAt(edit, outT);
  const shot = edit.shots[m.shot];
  const track = edit.tracks[shot?.track ?? 0];
  if (!shot || !track) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  drawScene(ctx, W, H, track, shot.angle, m.t);
  const kit = kitsOf(track.meta.youAreHome ? track.meta.home : track.meta.away).home;
  if (edit.style === "broadcast") {
    if (!shot.replay) {
      drawScoreBug(ctx, W, track, m.t);
      drawGoalBanner(ctx, W, H, track, m.t);
    } else {
      drawTag(ctx, W, "REPLAY", "rgba(220,38,38,0.92)");
      drawWipe(ctx, W, H, m.intoShot, kit.shirt);
    }
  } else if (edit.style === "reverse") {
    drawCaption(ctx, W, H, track, credit);
    if (shot.replay) {
      drawTag(ctx, W, "SLOW-MO", "rgba(17,24,39,0.9)");
      drawWipe(ctx, W, H, m.intoShot, "rgba(255,255,255,0.9)");
    }
  } else {
    drawPhoneLook(ctx, W, H, m.t);
  }
}

/** Where a goal sits in the frame for a still of it (the post's picture). */
export function goalCentreOnScreen(cam: FpCamera): { px: number; py: number } | null {
  const p = project(cam, CX, 0, 1.2);
  return p ? { px: p.px, py: p.py } : null;
}
