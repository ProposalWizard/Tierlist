/**
 * YOUR SEASON IN ONE VIDEO — drawing one frame of the reel (reel.ts plans it).
 *
 * Goal shots are drawn from the recording by the goal videos' own scene
 * (render.ts drawScene), so a goal looks exactly as it does in the feed.
 * Everything else here is the reel's own graphics: the title card, the
 * caption under each goal, the card for a goal with no recording (a drawn
 * mini pitch), the "goal of the season" moment and the end card.
 *
 * Same plan + same time = same picture, so the screen and the saved file
 * match frame for frame. Sizes are worked out from the canvas width
 * (s = W / 360), so it draws the same at any size.
 */
import { kitsOf, kitLabelOnDark } from "../kits";
import { shortClub } from "../media/grammar";
import { CX, POST_L, POST_R, PITCH_W, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, ARC_R } from "../pitch";
import type { CareerGoal } from "../goalLog";
import { drawScene } from "./render";
import { drawFlatScene } from "./render2d";
import type { ClipMoves } from "./edit";
import type { ClipAngle } from "./cameras";
import type { GoalTrack } from "./track";
import { segAt, shotAt, goalCaption, endLine, type ReelPlan, type ReelSeg } from "./reel";

export interface ReelAssets {
  /** Recordings by clip id (only the ones on this phone). */
  tracks: Map<string, GoalTrack>;
  moves: ClipMoves;
  /** 2D goal videos (Leo's part "videos2d" with 2D picked): goals drawn from above
   *  (render2d.ts). Absent: as before. */
  flat?: boolean;
  /** The display face (a tall condensed font), e.g. Anton's family name. */
  display?: string;
  /** The club badge, drawn when loaded. */
  badge?: HTMLImageElement | null;
}

const BODY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const GOLD = "#facc15";
const INK = "#0b1020";

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;
const ease = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
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

function display(a: ReelAssets): string {
  return a.display ? `${a.display}, Impact, 'Arial Narrow', sans-serif` : "Impact, 'Arial Narrow', sans-serif";
}

/** The club's colours: the shirt, the trim, and a version of the shirt that reads on dark. */
function colours(club: string) {
  const k = kitsOf(club).home;
  return { shirt: k.shirt, trim: k.trim, onDark: kitLabelOnDark(k.shirt, k.trim) };
}

/** The dark background every card sits on, with a glow in the club's colour. */
function cardBg(ctx: CanvasRenderingContext2D, W: number, H: number, glow: string, glowY = 0.35): void {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * glowY, 0, W / 2, H * glowY, H * 0.75);
  g.addColorStop(0, hexA(glow, 0.55));
  g.addColorStop(1, hexA(glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** "#rrggbb" + alpha → rgba(). Anything else is passed through. */
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A diagonal band in the club's colours (title and end cards). */
function band(ctx: CanvasRenderingContext2D, W: number, H: number, y: number, k: number, shirt: string, trim: string): void {
  const s = W / 360;
  const x0 = -W * 0.3 + (1 - easeOut(k)) * -W * 1.2;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(-0.21);
  ctx.translate(-W / 2, -y);
  ctx.fillStyle = shirt;
  ctx.fillRect(x0, y - 70 * s, W * 1.6, 140 * s);
  ctx.fillStyle = trim;
  ctx.fillRect(x0, y + 70 * s, W * 1.6, 9 * s);
  ctx.fillRect(x0, y - 79 * s, W * 1.6, 4 * s);
  ctx.restore();
}

/** Text with a letter gap (canvas has none on older phones). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number): void {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, w) => a + w, 0) + gap * (chars.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + gap; });
  ctx.textAlign = align;
}

function badgeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, club: string, img: HTMLImageElement | null | undefined): void {
  const c = colours(club);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = r * 0.4;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
    ctx.restore();
  } else {
    ctx.fillStyle = c.shirt;
    ctx.beginPath(); ctx.arc(x, y, r * 0.88, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.trim;
    ctx.font = `900 ${r * 0.62}px ${BODY}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(shortClub(club).slice(0, 3).toUpperCase(), x, y);
  }
}

// ── The title card ─────────────────────────────────────────────────────────

function drawTitle(ctx: CanvasRenderingContext2D, W: number, H: number, plan: ReelPlan, into: number, a: ReelAssets): void {
  const s = W / 360;
  const c = colours(plan.club);
  cardBg(ctx, W, H, c.shirt, 0.4);
  band(ctx, W, H, H * 0.33, into / 0.55, c.shirt, c.trim);
  const pop = easeOut((into - 0.35) / 0.4);
  badgeCircle(ctx, W / 2, H * 0.33, 58 * s * (0.6 + 0.4 * pop), plan.club, a.badge);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const rise = (d: number) => (1 - easeOut((into - d) / 0.45)) * 24 * s;
  ctx.globalAlpha = clamp01((into - 0.6) / 0.35);
  ctx.fillStyle = GOLD;
  ctx.font = `900 ${14 * s}px ${BODY}`;
  spaced(ctx, "YOUR SEASON", W / 2, H * 0.515 + rise(0.6), 4 * s);
  ctx.globalAlpha = clamp01((into - 0.8) / 0.35);
  ctx.fillStyle = "#ffffff";
  ctx.font = `${86 * s}px ${display(a)}`;
  ctx.fillText(plan.seasonLabel, W / 2, H * 0.655 + rise(0.8), W * 0.9);
  ctx.globalAlpha = clamp01((into - 1.05) / 0.35);
  ctx.font = `800 ${20 * s}px ${BODY}`;
  ctx.fillStyle = c.onDark;
  ctx.fillText(plan.club.toUpperCase(), W / 2, H * 0.72 + rise(1.05), W * 0.88);
  ctx.globalAlpha = clamp01((into - 1.3) / 0.35);
  ctx.font = `600 ${15 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(plan.player, W / 2, H * 0.765 + rise(1.3), W * 0.88);
  ctx.globalAlpha = 1;
  // How many goals are coming.
  const n = plan.segs.filter((x) => x.kind === "goal").length;
  if (into > 1.7) {
    ctx.globalAlpha = clamp01((into - 1.7) / 0.3);
    ctx.font = `800 ${13 * s}px ${BODY}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    spaced(ctx, n === 0 ? "THE SEASON" : n === 1 ? "1 GOAL" : `${n} GOALS`, W / 2, H * 0.86, 3 * s);
    ctx.globalAlpha = 1;
  }
  watermark(ctx, W, H);
}

function watermark(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const s = W / 360;
  ctx.font = `900 ${10 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  spaced(ctx, "KNOWITBALL", W / 2, H - 18 * s, 3 * s);
}

// ── Over a goal shot ───────────────────────────────────────────────────────

/** A sweep across the screen as a new goal starts. */
function wipe(ctx: CanvasRenderingContext2D, W: number, H: number, into: number, colour: string): void {
  const dur = 0.38;
  if (into >= dur) return;
  const k = into / dur;
  const x = -W * 0.5 + W * 2.2 * k;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - W * 0.6, 0); ctx.lineTo(x + W * 0.2, 0); ctx.lineTo(x - W * 0.2, H); ctx.lineTo(x - W * 1.0, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The counter, top left: "GOAL 3 / 20". */
function counter(ctx: CanvasRenderingContext2D, W: number, n: number, of: number, club: string): void {
  const s = W / 360;
  const c = colours(club);
  const label = `GOAL ${n}`;
  ctx.font = `900 ${13 * s}px ${BODY}`;
  const lw = ctx.measureText(label).width;
  ctx.font = `700 ${12 * s}px ${BODY}`;
  const ow = ctx.measureText(` / ${of}`).width;
  const x = 14 * s, y = 16 * s, h = 26 * s, w = lw + ow + 22 * s;
  ctx.fillStyle = "rgba(8,10,18,0.82)";
  roundRect(ctx, x, y, w, h, 6 * s); ctx.fill();
  ctx.fillStyle = c.shirt;
  ctx.fillRect(x, y + 5 * s, 4 * s, h - 10 * s);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.font = `900 ${13 * s}px ${BODY}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x + 12 * s, y + h / 2 + 0.5 * s);
  ctx.font = `700 ${12 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(` / ${of}`, x + 12 * s + lw, y + h / 2 + 0.5 * s);
}

/** The caption, bottom: the minute big, "v Arsenal", then "FA Cup · 3-1". */
function lowerThird(ctx: CanvasRenderingContext2D, W: number, H: number, g: CareerGoal, into: number, a: ReelAssets, accent?: string): void {
  const s = W / 360;
  const c = colours(g.club);
  const k = easeOut((into - 0.12) / 0.35);
  if (k <= 0) return;
  // A dark fade so the words read over any picture.
  const fade = ctx.createLinearGradient(0, H * 0.7, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, `rgba(0,0,0,${0.78 * k})`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  const x = 18 * s - (1 - k) * 60 * s;
  const y = H - 74 * s;
  ctx.globalAlpha = k;
  ctx.fillStyle = accent ?? c.shirt;
  ctx.fillRect(x, y - 44 * s, 5 * s, 58 * s);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `${50 * s}px ${display(a)}`;
  const minute = `${g.minute}'`;
  ctx.fillText(minute, x + 14 * s, y + 10 * s);
  const mw = ctx.measureText(minute).width;
  const tx = x + 14 * s + mw + 16 * s;
  ctx.font = `900 ${19 * s}px ${BODY}`;
  ctx.fillText(`v ${shortClub(g.opponent)}`, tx, y - 14 * s, W - tx - 14 * s);
  ctx.font = `700 ${13 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(`${g.competition} · ${g.score}`, tx, y + 7 * s, W - tx - 14 * s);
  if (g.assist) {
    ctx.font = `600 ${12 * s}px ${BODY}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`Assist: ${g.assist}`, x + 14 * s, y + 32 * s, W - x - 28 * s);
  }
  ctx.globalAlpha = 1;
}

function tag(ctx: CanvasRenderingContext2D, W: number, label: string, bg: string, fg: string, y: number): void {
  const s = W / 360;
  ctx.font = `900 ${12 * s}px ${BODY}`;
  const tw = ctx.measureText(label).width + 20 * s;
  const x = W - tw - 14 * s;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, tw, 24 * s, 5 * s); ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + tw / 2, y + 12.5 * s);
}

/** The quick-fire counter, top left: "GOAL 31 · 32 · 33", the newest number
 *  popping in, the ones before it fading back. */
function quickCounter(ctx: CanvasRenderingContext2D, W: number, n: number, club: string, into: number, a: ReelAssets): void {
  const s = W / 360;
  const c = colours(club);
  const x = 14 * s, y = 16 * s, h = 34 * s;
  const nums = [n - 2, n - 1, n].filter((k) => k >= 1);
  ctx.font = `${22 * s}px ${display(a)}`;
  const parts = nums.map((k) => String(k));
  const gap = ctx.measureText(" · ").width;
  const ws = parts.map((p) => ctx.measureText(p).width);
  ctx.font = `900 ${12 * s}px ${BODY}`;
  const lw = ctx.measureText("GOAL").width;
  const w = 12 * s + lw + 10 * s + ws.reduce((t, v) => t + v, 0) + gap * (parts.length - 1) + 12 * s;
  ctx.fillStyle = "rgba(8,10,18,0.85)";
  roundRect(ctx, x, y, w, h, 7 * s); ctx.fill();
  ctx.fillStyle = c.shirt;
  ctx.fillRect(x, y + 6 * s, 4 * s, h - 12 * s);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = GOLD;
  ctx.fillText("GOAL", x + 12 * s, y + h / 2 + 0.5 * s);
  let cx = x + 12 * s + lw + 10 * s;
  ctx.font = `${22 * s}px ${display(a)}`;
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    const pop = last ? easeOut(into / 0.16) : 1;
    ctx.save();
    ctx.translate(cx + ws[i] / 2, y + h / 2 + 1.5 * s);
    ctx.scale(0.6 + 0.4 * pop + (last ? 0.18 * Math.sin(Math.PI * clamp01(into / 0.24)) : 0), 0.6 + 0.4 * pop);
    ctx.globalAlpha = last ? pop : 0.32 + 0.18 * i;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(p, 0, 0);
    ctx.restore();
    cx += ws[i];
    if (!last) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(" · ", cx, y + h / 2 + 1.5 * s);
      cx += gap;
    }
  });
  ctx.globalAlpha = 1;
}

/** The quick-fire caption: one short line, bottom left ("63' v Spurs"). */
function quickCaption(ctx: CanvasRenderingContext2D, W: number, H: number, g: CareerGoal, a: ReelAssets): void {
  const s = W / 360;
  const fade = ctx.createLinearGradient(0, H * 0.8, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, H * 0.8, W, H * 0.2);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `${34 * s}px ${display(a)}`;
  const minute = `${g.minute}'`;
  ctx.fillText(minute, 18 * s, H - 40 * s);
  const mw = ctx.measureText(minute).width;
  ctx.font = `900 ${16 * s}px ${BODY}`;
  ctx.fillText(`v ${shortClub(g.opponent)}`, 18 * s + mw + 10 * s, H - 44 * s, W - mw - 50 * s);
}

/**
 * The goal videos' scene, framed for the reel's tall picture. The TV camera
 * looks level-ish across the pitch, so in 9:16 its top third is stand. The
 * reel draws it a little taller than the canvas and lifts it, cropping that
 * stand off the top: the play sits higher, more grass below for the caption.
 * cameras.ts is untouched (the goal videos frame exactly as before).
 */
const LIFT: Partial<Record<ClipAngle, number>> = { tv: 0.26 };
function reelScene(ctx: CanvasRenderingContext2D, W: number, H: number, tr: GoalTrack, angle: ClipAngle, t: number, moves: ClipMoves, flat?: boolean): void {
  if (flat) { drawFlatScene(ctx, W, H, tr, angle, t, moves); return; }
  const k = LIFT[angle] ?? 0;
  if (!k) { drawScene(ctx, W, H, tr, angle, t, moves); return; }
  ctx.save();
  ctx.translate(0, -H * k);
  drawScene(ctx, W, H * (1 + k), tr, angle, t, moves);
  ctx.restore();
}

/** A white flash: at a cut (quick-fire) and the instant the ball goes in. */
function flash(ctx: CanvasRenderingContext2D, W: number, H: number, k: number, peak: number): void {
  if (k < 0 || k >= 1) return;
  ctx.fillStyle = `rgba(255,255,255,${peak * (1 - k) * (1 - k)})`;
  ctx.fillRect(0, 0, W, H);
}

function drawGoalShot(ctx: CanvasRenderingContext2D, W: number, H: number, seg: Extract<ReelSeg, { kind: "goal" | "best" }>, into: number, a: ReelAssets, plan: ReelPlan): boolean {
  const tr = seg.goal.clipId ? a.tracks.get(seg.goal.clipId) : undefined;
  const at = shotAt(seg.shots, into);
  if (!tr || !at) return false;
  // The instant it goes in: a small punch-in on the picture and a flash
  // (live shots only; the slow replay is left clean).
  const since = at.t - tr.goalT;
  const hit = !at.shot.replay && since >= 0 && since < 0.35 ? since / 0.35 : -1;
  if (hit >= 0) {
    const z = 1 + 0.045 * (1 - hit) * (1 - hit);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    reelScene(ctx, W, H, tr, at.shot.angle, at.t, a.moves, a.flat);
    ctx.restore();
  } else {
    reelScene(ctx, W, H, tr, at.shot.angle, at.t, a.moves, a.flat);
  }
  if (hit >= 0) flash(ctx, W, H, hit / 0.5, 0.42);
  const s = W / 360;
  const c = colours(plan.club);
  if (seg.kind === "goal" && seg.quick) {
    quickCaption(ctx, W, H, seg.goal, a);
    quickCounter(ctx, W, seg.n, plan.club, into, a);
    flash(ctx, W, H, into / 0.14, 0.6);
  } else if (seg.kind === "goal") {
    counter(ctx, W, seg.n, seg.of, plan.club);
    lowerThird(ctx, W, H, seg.goal, into, a);
    wipe(ctx, W, H, into, c.shirt);
  } else {
    // The goal of the season: gold, and letterboxed for the slow replay.
    if (at.shot.replay) {
      const bar = 46 * s * easeOut(at.intoShot / 0.3);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      tag(ctx, W, "SLOW-MO", "rgba(220,38,38,0.95)", "#fff", 56 * s);
      wipe(ctx, W, H, at.intoShot, GOLD);
    }
    goldPill(ctx, W, a);
    lowerThird(ctx, W, H - (at.shot.replay ? 40 * s : 0), seg.goal, into, a, GOLD);
  }
  return true;
}

function goldPill(ctx: CanvasRenderingContext2D, W: number, a: ReelAssets): void {
  const s = W / 360;
  const label = "GOAL OF THE SEASON";
  ctx.font = `${17 * s}px ${display(a)}`;
  const tw = ctx.measureText(label).width + 26 * s;
  const x = 14 * s, y = 14 * s, h = 30 * s;
  ctx.fillStyle = GOLD;
  roundRect(ctx, x, y, tw, h, 6 * s); ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + 13 * s, y + h / 2 + 1 * s);
}

// ── A goal with no recording: a drawn mini pitch ────────────────────────────

interface Sketch { shooter: { x: number; y: number }; from?: { x: number; y: number }; target: { x: number } }

/** Where the goal was scored from: seeded off the goal, the distance kept. */
export function sketchOf(g: CareerGoal): Sketch {
  const h = hash(g.id);
  const r = (k: number) => ((h >>> (k * 5)) % 1000) / 1000;
  const how = (g.how ?? "").toLowerCase();
  if (how.includes("pen")) return { shooter: { x: CX, y: PEN_SPOT_Y }, target: { x: CX + (r(1) < 0.5 ? -2.6 : 2.6) } };
  const d = Math.max(6, Math.min(32, g.distance ?? 9 + r(0) * 12));
  const ang = (r(2) - 0.5) * (d < 12 ? 1.3 : 0.9);
  const shooter = { x: CX + Math.sin(ang) * d, y: Math.cos(ang) * d };
  const target = { x: CX + (shooter.x < CX ? 1 : -1) * (1.2 + r(3) * 2) };
  const from = g.assist ? { x: shooter.x < CX ? BOX_R + 2 + r(4) * 6 : BOX_L - 2 - r(4) * 6, y: 8 + r(5) * 14 } : undefined;
  return { shooter, from, target };
}

function miniPitch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, g: CareerGoal, into: number, accent: string): void {
  // The attacking third, goal at the top: 40 m deep, the pitch's full width.
  const depth = 40;
  const px = (mx: number) => x + (mx / PITCH_W) * w;
  const py = (my: number) => y + (my / depth) * h;
  const s = w / 300;
  ctx.save();
  roundRect(ctx, x, y, w, h, 14 * s); ctx.clip();
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#2a8448" : "#2f9150";
    ctx.fillRect(x, y + (i * h) / 8, w, h / 8 + 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(px(BOX_L), py(0), px(BOX_R) - px(BOX_L), py(BOX_DEPTH) - py(0));
  ctx.strokeRect(px(SIX_L), py(0), px(SIX_R) - px(SIX_L), py(SIX_DEPTH) - py(0));
  ctx.beginPath(); ctx.moveTo(x, py(0)); ctx.lineTo(x + w, py(0)); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(CX), py(PEN_SPOT_Y), (ARC_R / PITCH_W) * w, (ARC_R / depth) * h, 0, Math.asin(Math.min(1, (BOX_DEPTH - PEN_SPOT_Y) / ARC_R)), Math.PI - Math.asin(Math.min(1, (BOX_DEPTH - PEN_SPOT_Y) / ARC_R)));
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(px(CX), py(PEN_SPOT_Y), 2 * s, 0, Math.PI * 2); ctx.fill();
  // The goal.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(px(POST_L), py(0) - 7 * s, px(POST_R) - px(POST_L), 7 * s);
  ctx.restore();

  const sk = sketchOf(g);
  const shooter = { x: px(sk.shooter.x), y: py(sk.shooter.y) };
  const goal = { x: px(sk.target.x), y: py(0) - 3 * s };
  // The assist, then the strike, drawn as the ball travels.
  const passK = sk.from ? ease((into - 0.15) / 0.5) : 1;
  const shotK = ease((into - (sk.from ? 0.7 : 0.25)) / 0.45);
  ctx.lineCap = "round";
  if (sk.from) {
    const f = { x: px(sk.from.x), y: py(sk.from.y) };
    ctx.setLineDash([5 * s, 5 * s]);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + (shooter.x - f.x) * passK, f.y + (shooter.y - f.y) * passK); ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, f.x, f.y, 7 * s, "rgba(255,255,255,0.85)", "#1f2937");
  }
  if (shotK > 0) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(shooter.x, shooter.y);
    // A little curve for a curler or a chip.
    const mx = (shooter.x + goal.x) / 2 + (g.finish === "curl" ? (shooter.x < goal.x ? -1 : 1) * 22 * s : 0);
    const my = (shooter.y + goal.y) / 2;
    const bx = (1 - shotK) ** 2 * shooter.x + 2 * (1 - shotK) * shotK * mx + shotK ** 2 * goal.x;
    const by = (1 - shotK) ** 2 * shooter.y + 2 * (1 - shotK) * shotK * my + shotK ** 2 * goal.y;
    ctx.quadraticCurveTo(
      shooter.x + (mx - shooter.x) * shotK, shooter.y + (my - shooter.y) * shotK, bx, by,
    );
    ctx.stroke();
    dot(ctx, bx, by, 5 * s, "#ffffff", "#111");
  }
  dot(ctx, shooter.x, shooter.y, 9 * s, accent, "#ffffff");
  // The net flashes as it goes in.
  if (shotK >= 1) {
    const f = clamp01(1 - (into - (sk.from ? 1.15 : 0.7)) / 0.5);
    if (f > 0) {
      ctx.fillStyle = `rgba(250,204,21,${0.7 * f})`;
      ctx.beginPath(); ctx.arc(goal.x, goal.y, 26 * s * (1.4 - f * 0.4), 0, Math.PI * 2); ctx.fill();
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring: string): void {
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawGoalCard(ctx: CanvasRenderingContext2D, W: number, H: number, seg: Extract<ReelSeg, { kind: "goal" | "best" }>, into: number, a: ReelAssets, plan: ReelPlan): void {
  const s = W / 360;
  const c = colours(plan.club);
  const best = seg.kind === "best";
  const quick = seg.kind === "goal" && !!seg.quick;
  // A quick-fire card plays its drawn strike at double speed.
  if (quick) into *= 1.7;
  const accent = best ? GOLD : c.onDark;
  cardBg(ctx, W, H, best ? "#b45309" : c.shirt, 0.3);
  const pw = W - 56 * s, ph = pw * 0.62;
  const py = H * 0.17;
  miniPitch(ctx, 28 * s, py, pw, ph, seg.goal, into, accent);
  if (seg.kind === "goal" && seg.quick) quickCounter(ctx, W, seg.n, plan.club, into / 1.7, a);
  else if (seg.kind === "goal") counter(ctx, W, seg.n, seg.of, plan.club);
  else goldPill(ctx, W, a);
  // The words, big, under the pitch.
  const k = easeOut((into - 0.1) / 0.35);
  ctx.globalAlpha = k;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const y0 = py + ph + 92 * s - (1 - k) * 16 * s;
  ctx.fillStyle = "#ffffff";
  ctx.font = `${78 * s}px ${display(a)}`;
  ctx.fillText(`${seg.goal.minute}'`, W / 2, y0);
  ctx.font = `900 ${24 * s}px ${BODY}`;
  ctx.fillText(`v ${shortClub(seg.goal.opponent)}`, W / 2, y0 + 36 * s, W * 0.9);
  ctx.font = `700 ${15 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${seg.goal.competition} · ${seg.goal.score}`, W / 2, y0 + 62 * s, W * 0.9);
  const extra = [seg.goal.assist ? `Assist: ${seg.goal.assist}` : "", howWords(seg.goal)].filter(Boolean).join(" · ");
  if (extra) {
    ctx.font = `600 ${13 * s}px ${BODY}`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(extra, W / 2, y0 + 86 * s, W * 0.9);
  }
  ctx.globalAlpha = 1;
  if (quick) flash(ctx, W, H, into / 0.24, 0.6);
  else if (seg.kind === "goal") wipe(ctx, W, H, into, c.shirt);
  watermark(ctx, W, H);
}

/** "Curler from 24 m", "Penalty", "Header": a few words on how it went in. */
export function howWords(g: CareerGoal): string {
  const how = (g.how ?? "").toLowerCase().replace(/_/g, " ");
  const d = g.distance ? `${Math.round(g.distance)} m` : "";
  if (how.includes("pen")) return "Penalty";
  if (how.includes("free")) return d ? `Free kick from ${d}` : "Free kick";
  if (how.includes("header")) return "Header";
  if (how.includes("volley")) return "Volley";
  if (g.finish === "chip") return d ? `Chip from ${d}` : "Chip";
  if (g.finish === "curl") return d ? `Curler from ${d}` : "Curler";
  if (g.distance && g.distance >= 20) return `From ${d}`;
  return "";
}

// ── The goal of the season, its intro ──────────────────────────────────────

function drawBestIntro(ctx: CanvasRenderingContext2D, W: number, H: number, seg: Extract<ReelSeg, { kind: "bestIntro" }>, into: number, a: ReelAssets): void {
  const s = W / 360;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, H * 0.55);
  const k = easeOut(into / 0.5);
  glow.addColorStop(0, `rgba(250,204,21,${0.5 * k})`);
  glow.addColorStop(1, "rgba(250,204,21,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Rays turning slowly behind the words.
  ctx.save();
  ctx.translate(W / 2, H * 0.46);
  ctx.rotate(into * 0.25);
  ctx.fillStyle = `rgba(250,204,21,${0.08 * k})`;
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30 * s, -H); ctx.lineTo(30 * s, -H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const sc = 0.85 + 0.15 * easeOut((into - 0.05) / 0.45);
  ctx.save();
  ctx.translate(W / 2, H * 0.46);
  ctx.scale(sc, sc);
  ctx.globalAlpha = clamp01(into / 0.3);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${15 * s}px ${BODY}`;
  spaced(ctx, "GOAL OF THE", 0, -58 * s, 5 * s);
  ctx.fillStyle = GOLD;
  ctx.font = `${88 * s}px ${display(a)}`;
  ctx.fillText("SEASON", 0, 22 * s, W * 0.92);
  ctx.restore();
  ctx.globalAlpha = clamp01((into - 0.5) / 0.3);
  ctx.font = `700 ${15 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(goalCaption(seg.goal, shortClub), W / 2, H * 0.46 + 70 * s, W * 0.9);
  ctx.globalAlpha = 1;
}

// ── The end card ───────────────────────────────────────────────────────────

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.42, y - h * 0.5);
  ctx.lineTo(x + h * 0.42, y - h * 0.5);
  ctx.quadraticCurveTo(x + h * 0.4, y + h * 0.05, x + h * 0.08, y + h * 0.15);
  ctx.lineTo(x + h * 0.08, y + h * 0.32);
  ctx.lineTo(x + h * 0.26, y + h * 0.42);
  ctx.lineTo(x - h * 0.26, y + h * 0.42);
  ctx.lineTo(x - h * 0.08, y + h * 0.32);
  ctx.lineTo(x - h * 0.08, y + h * 0.15);
  ctx.quadraticCurveTo(x - h * 0.4, y + h * 0.05, x - h * 0.42, y - h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = h * 0.08;
  ctx.beginPath(); ctx.arc(x - h * 0.42, y - h * 0.28, h * 0.17, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + h * 0.42, y - h * 0.28, h * 0.17, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
}

function drawEnd(ctx: CanvasRenderingContext2D, W: number, H: number, plan: ReelPlan, into: number, a: ReelAssets): void {
  const s = W / 360;
  const c = colours(plan.club);
  cardBg(ctx, W, H, c.shirt, 0.2);
  // The club's stripe along the top.
  ctx.fillStyle = c.shirt; ctx.fillRect(0, 0, W, 8 * s);
  ctx.fillStyle = c.trim; ctx.fillRect(0, 8 * s, W, 3 * s);
  badgeCircle(ctx, W / 2, 70 * s, 30 * s, plan.club, a.badge);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `900 ${13 * s}px ${BODY}`;
  spaced(ctx, `${plan.seasonLabel} · ${shortClub(plan.club).toUpperCase()}`, W / 2, 128 * s, 3 * s);
  ctx.fillStyle = "#ffffff";
  ctx.font = `${40 * s}px ${display(a)}`;
  ctx.fillText("YOUR SEASON", W / 2, 170 * s, W * 0.9);

  const st = plan.stats;
  const count = (v: number, d: number) => v * easeOut((into - d) / 1.1);
  const tiles: [string, string][] = [
    ["GOALS", String(Math.round(count(st.goals, 0.2)))],
    ["ASSISTS", String(Math.round(count(st.assists, 0.35)))],
    ["AVG RATING", st.avgRating > 0 ? count(st.avgRating, 0.5).toFixed(1) : "–"],
    ["APPS", String(Math.round(count(st.apps, 0.65)))],
  ];
  const gx = 22 * s, gy = 196 * s, gw = (W - gx * 2 - 12 * s) / 2, gh = 92 * s;
  tiles.forEach(([label, value], i) => {
    const x = gx + (i % 2) * (gw + 12 * s);
    const y = gy + Math.floor(i / 2) * (gh + 12 * s);
    const k = easeOut((into - 0.1 - i * 0.12) / 0.4);
    ctx.globalAlpha = k;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y + (1 - k) * 14 * s, gw, gh, 12 * s); ctx.fill();
    ctx.fillStyle = i === 0 ? c.onDark : "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y + (1 - k) * 14 * s + 14 * s, 4 * s, gh - 28 * s);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${50 * s}px ${display(a)}`;
    ctx.fillText(value, x + gw / 2, y + 60 * s + (1 - k) * 14 * s);
    ctx.font = `800 ${11 * s}px ${BODY}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    spaced(ctx, label, x + gw / 2, y + 80 * s + (1 - k) * 14 * s, 2 * s);
  });
  ctx.globalAlpha = 1;

  // Trophies, one row each (at most four; then "+2 more").
  let y = gy + 2 * gh + 12 * s + 40 * s;
  if (st.trophies.length) {
    const shown = st.trophies.slice(0, 4);
    shown.forEach((name, i) => {
      const k = easeOut((into - 1.2 - i * 0.25) / 0.35);
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = `900 ${18 * s}px ${BODY}`;
      const label = name.toUpperCase();
      const tw = ctx.measureText(label).width;
      cup(ctx, -tw / 2 - 18 * s, -6 * s, 24 * s);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(label, -tw / 2 + 2 * s, 0);
      ctx.restore();
      y += 34 * s;
    });
    if (st.trophies.length > shown.length) {
      ctx.font = `700 ${13 * s}px ${BODY}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(`+${st.trophies.length - shown.length} more`, W / 2, y);
      y += 26 * s;
    }
    ctx.globalAlpha = 1;
  } else {
    y += 4 * s;
  }
  const k = clamp01((into - (st.trophies.length ? 2.0 : 1.3)) / 0.4);
  ctx.globalAlpha = k;
  ctx.textAlign = "center";
  ctx.font = `800 ${18 * s}px ${BODY}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(endLine(plan), W / 2, Math.max(y + 16 * s, H * 0.8), W * 0.9);
  ctx.font = `600 ${14 * s}px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(plan.player, W / 2, Math.max(y + 42 * s, H * 0.8 + 26 * s), W * 0.9);
  ctx.globalAlpha = 1;
  watermark(ctx, W, H);
}

// ── One frame ──────────────────────────────────────────────────────────────

/** The reel at time `t` (seconds), drawn into a W×H canvas. */
export function drawReelFrame(ctx: CanvasRenderingContext2D, W: number, H: number, plan: ReelPlan, t: number, a: ReelAssets): void {
  const { seg, into } = segAt(plan, t);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  switch (seg.kind) {
    case "title": drawTitle(ctx, W, H, plan, into, a); break;
    case "goal":
    case "best":
      if (!drawGoalShot(ctx, W, H, seg, into, a, plan)) drawGoalCard(ctx, W, H, seg, into, a, plan);
      break;
    case "bestIntro": drawBestIntro(ctx, W, H, seg, into, a); break;
    case "end": drawEnd(ctx, W, H, plan, into, a); break;
  }
  // A quick fade from black at the very start, and to black at the very end.
  const fadeIn = 1 - clamp01(t / 0.4);
  const fadeOut = clamp01((t - (plan.duration - 0.6)) / 0.6);
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

/**
 * Paint the reel's frame at time t onto a canvas on screen. Plays back the
 * recordings only (no ball physics), like every goal video.
 */
export function paintReelOn(canvas: HTMLCanvasElement | null, W: number, H: number, plan: ReelPlan, t: number, a: ReelAssets): void {
  const ctx = canvas?.getContext("2d");
  if (ctx) drawReelFrame(ctx, W, H, plan, t, a);
}
