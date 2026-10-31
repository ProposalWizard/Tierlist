/**
 * BETTER GOAL VIDEOS — THE DRAWING (Leo's switch part "betterVideos").
 *
 * One frame of a better edit (editBetter.ts): the same scene as every goal
 * video (render.ts drawScene: the recording, from the shot's camera), then
 * the digital zoom and shake (betterView.ts), then what each kind of account
 * lays over it:
 *  - broadcast: the score bug, a lower third with the scorer and the assist,
 *    the channel's name in the corner; on a replay a wipe in and out, a
 *    REPLAY tag and the camera's label;
 *  - highlights: a small score bug and the page's name, flash cuts, a
 *    full-time card at the end;
 *  - tiktok: captions popping in word by word in the top third (clear of the
 *    app's buttons), a flash on the goal, the player's name card at the end;
 *  - fan: the phone's grain, the heads in front, arms going up on the goal;
 *  - reverse: the page's caption, a SLOW-MO tag.
 * Pure drawing from the edit and the time: the same frame every time.
 */
import { kitsOf } from "../kits";
import { shortClub } from "../media/grammar";
import { momentAt, shotLength, type Edit, type EditMoment, type Shot } from "./edit";
import type { GoalTrack } from "./track";
import { viewAt } from "./betterView";
import { drawColdFrame } from "./coldRender";
import {
  drawScene, drawScoreBug, drawWipe, drawPhoneLook, drawCaption, drawTag, roundRect, teamCode, FONT,
  type ClipCredit,
} from "./render";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

function yourKit(track: GoalTrack) {
  return kitsOf(track.meta.youAreHome ? track.meta.home : track.meta.away).home;
}

function handleOf(credit?: ClipCredit): string {
  return credit?.handle ? `@${credit.handle.replace(/^@/, "")}` : "";
}

export function drawBetterFrame(ctx: CanvasRenderingContext2D, edit: Edit, outT: number, credit?: ClipCredit, moment?: EditMoment): void {
  // Cold edits (switch part "coldEdits"): graded, beat-cut, their own dressing.
  if (edit.look) { drawColdFrame(ctx, edit, outT, credit, moment); return; }
  const W = edit.w, H = edit.h;
  const m = moment ?? momentAt(edit, outT);
  const shot = edit.shots[m.shot];
  const track = edit.tracks[shot?.track ?? 0];
  if (!shot || !track) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const v = viewAt(edit, m);
  ctx.save();
  if (v.k !== 1 || v.dx || v.dy) {
    ctx.translate(v.ax + v.dx, v.ay + v.dy);
    ctx.scale(v.k, v.k);
    ctx.translate(-v.ax, -v.ay);
  }
  drawScene(ctx, W, H, track, shot.angle, m.t, edit.moves);
  ctx.restore();

  const fx = shot.fx ?? {};
  const accent = edit.accent ?? "#FACC15";
  const len = shotLength(shot);

  // The TV graphics a size up from the old videos: a 640-wide video plays
  // about 360 wide in the feed, where the old 13 px score bug read as 7 px.
  const UI = 1.35;
  if (fx.card) {
    if (fx.card === "name") drawNameCard(ctx, W, H, track, m.intoShot, accent, credit);
    else drawStatsCard(ctx, W, H, edit, m.intoShot, accent, credit);
  } else if (edit.style === "broadcast") {
    if (!shot.replay) {
      big(ctx, UI, 0, 0, () => drawScoreBug(ctx, W, track, m.t));
      drawLowerThird(ctx, W, H, track, m.t);
      drawWatermark(ctx, W, credit, "rgba(255,255,255,0.75)");
    } else {
      big(ctx, UI, W, 0, () => drawReplayLabels(ctx, W, "REPLAY", fx.label, "rgba(220,38,38,0.94)"));
      drawWipe(ctx, W, H, m.intoShot, yourKit(track).shirt);
      // And out again as the replay ends.
      if (len - m.intoShot < 0.42) drawWipe(ctx, W, H, 0.42 - (len - m.intoShot), yourKit(track).shirt);
    }
  } else if (edit.style === "highlights") {
    big(ctx, UI, 0, 0, () => drawScoreBug(ctx, W, track, m.t));
    if (shot.replay) big(ctx, UI, W, 0, () => drawReplayLabels(ctx, W, fx.label ?? "REPLAY", undefined, "rgba(17,24,39,0.92)"));
    else drawWatermark(ctx, W, credit, "rgba(255,255,255,0.85)");
  } else if (edit.style === "reverse") {
    drawCaption(ctx, W, H, track, credit);
    if (shot.replay) {
      big(ctx, UI, W, 0, () => drawTag(ctx, W, fx.label ?? "SLOW-MO", "rgba(17,24,39,0.9)"));
      drawWipe(ctx, W, H, m.intoShot, "rgba(255,255,255,0.9)");
    }
  } else if (edit.style === "tiktok") {
    drawTikTokChrome(ctx, W, H, track, credit);
    if (shot.caption) drawPopCaption(ctx, W, H, shot.caption, captionClock(edit, m), accent);
  } else {
    drawPhoneLook(ctx, W, H, m.t);
    drawArmsUp(ctx, W, H, track, m.t);
  }

  // Flashes last: a flash cut as the shot starts, and the white hit on the goal.
  let flash = 0;
  if (fx.flashCut && m.intoShot < 0.2) flash = Math.max(flash, 0.9 * (1 - m.intoShot / 0.2));
  if (fx.flashAt !== undefined && m.t >= fx.flashAt - 0.01) flash = Math.max(flash, 0.85 * Math.exp(-(m.t - fx.flashAt) * 9));
  if (flash > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${flash.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Draw `fn` a size up, scaled about the point (ax, ay) (a corner, so it stays in its corner). */
function big(ctx: CanvasRenderingContext2D, k: number, ax: number, ay: number, fn: () => void): void {
  ctx.save();
  ctx.translate(ax * (1 - k), ay * (1 - k));
  ctx.scale(k, k);
  fn();
  ctx.restore();
}

/** Seconds since this caption first showed (it runs on over shots that share it). */
function captionClock(edit: Edit, m: EditMoment): number {
  const cap = edit.shots[m.shot]?.caption;
  let t = m.intoShot;
  for (let i = m.shot - 1; i >= 0 && edit.shots[i].caption === cap; i--) t += shotLength(edit.shots[i]);
  return t;
}

/** Lines of words that fit `maxW` at the current font. */
function wrap(ctx: CanvasRenderingContext2D, words: string[], maxW: number): string[][] {
  const lines: string[][] = [[]];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const test = [...cur, w].join(" ");
    if (cur.length && ctx.measureText(test).width > maxW) lines.push([w]);
    else cur.push(w);
  }
  return lines;
}

/** The TikTok caption: big, bold, outlined, words popping in one by one;
 *  the last word in the account's colour. Top third, clear of the buttons. */
export function drawPopCaption(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, clock: number, accent: string): void {
  const s = W / 360;
  const words = text.split(/\s+/).filter(Boolean);
  let size = 36 * s;
  ctx.font = `900 ${size}px ${FONT}`;
  let lines = wrap(ctx, words, W * 0.84);
  if (lines.length > 2) { size = 30 * s; ctx.font = `900 ${size}px ${FONT}`; lines = wrap(ctx, words, W * 0.86); }
  const lh = size * 1.12;
  const top = H * 0.2 - ((lines.length - 1) * lh) / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  let k = 0;
  lines.forEach((line, li) => {
    const widths = line.map(w => ctx.measureText(w).width);
    const space = ctx.measureText(" ").width;
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = (W - total) / 2;
    const y = top + li * lh;
    line.forEach((w, wi) => {
      const shown = clock - k * 0.12;
      const lastWord = k === words.length - 1 && words.length > 1;
      k++;
      if (shown >= 0) {
        const pop = shown < 0.08 ? 0.6 + (shown / 0.08) * 0.55 : shown < 0.16 ? 1.15 - ((shown - 0.08) / 0.08) * 0.15 : 1;
        const cx = x + widths[wi] / 2;
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(pop, pop);
        ctx.lineWidth = 8 * s;
        ctx.strokeStyle = "#000";
        ctx.strokeText(w, -widths[wi] / 2, 0);
        ctx.fillStyle = lastWord ? accent : "#ffffff";
        ctx.fillText(w, -widths[wi] / 2, 0);
        ctx.restore();
      }
      x += widths[wi] + space;
    });
  });
}

/** The account and the match along the bottom, like the app shows them. */
function drawTikTokChrome(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, credit?: ClipCredit): void {
  const s = W / 360;
  const g = ctx.createLinearGradient(0, H * 0.74, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.74, W, H * 0.26);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const handle = handleOf(credit);
  if (handle) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${15 * s}px ${FONT}`;
    ctx.fillText(handle, 14 * s, H - 44 * s, W * 0.7);
  }
  ctx.font = `600 ${12.5 * s}px ${FONT}`;
  ctx.fillStyle = "#e5e7eb";
  const against = scoredByHome(track) ? track.meta.away : track.meta.home;
  ctx.fillText(`${track.meta.scorerShort || track.meta.scorer} v ${shortClub(against)} · #football #goal #fyp`, 14 * s, H - 24 * s, W * 0.74);
}

/** The broadcaster's lower third: the scorer, the assist, the minute. In a
 *  moment after the goal, out again after about four seconds. */
function drawLowerThird(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, t: number): void {
  const since = t - (track.goalT + 0.6);
  if (since < 0 || since > 4.2) return;
  const s = W / 640;
  const inK = easeOut(since / 0.3), outK = easeOut((4.2 - since) / 0.3);
  const k = Math.min(inK, outK);
  const assist = track.meta.assist && track.meta.assist !== track.meta.scorer ? track.meta.assist : "";
  const w = 400 * s, h = (assist ? 74 : 56) * s;
  const x = 22 * s - (w + 30 * s) * (1 - k), y = H - h - 20 * s;
  const kit = kitsOf(scoredByHome(track) ? track.meta.home : track.meta.away).home;
  ctx.save();
  ctx.fillStyle = "rgba(8,10,18,0.92)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = kit.shirt;
  ctx.fillRect(x, y, 7 * s, h);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x + 7 * s, y, w - 7 * s, 3 * s);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#facc15";
  ctx.font = `900 ${14 * s}px ${FONT}`;
  const club = scoredByHome(track) ? track.meta.home : track.meta.away;
  ctx.fillText(`GOAL · ${shortClub(club).toUpperCase()}`, x + 20 * s, y + 21 * s, w - 100 * s);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${25 * s}px ${FONT}`;
  ctx.fillText(track.meta.scorer.toUpperCase(), x + 20 * s, y + 48 * s, w - 100 * s);
  if (assist) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 ${15 * s}px ${FONT}`;
    ctx.fillText(`Assist: ${assist}`, x + 20 * s, y + 66 * s, w - 100 * s);
  }
  ctx.font = `900 ${26 * s}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${track.meta.minuteLabel}'`, x + w - 16 * s, y + 48 * s);
  ctx.restore();
}

/** The channel's name, small, top right (as a TV channel's clip on X). */
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, credit: ClipCredit | undefined, colour: string): void {
  const label = handleOf(credit);
  if (!label) return;
  const s = W / 640;
  ctx.save();
  ctx.font = `800 ${16 * s}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4 * s;
  ctx.fillStyle = colour;
  ctx.fillText(label, W - 16 * s, 28 * s);
  ctx.restore();
}

/** The REPLAY tag, top right, and the camera's name under it. */
function drawReplayLabels(ctx: CanvasRenderingContext2D, W: number, tag: string, label: string | undefined, colour: string): void {
  drawTag(ctx, W, tag, colour);
  if (!label || label === tag) return;
  const s = W / 640;
  ctx.save();
  ctx.font = `800 ${10.5 * s}px ${FONT}`;
  const tw = ctx.measureText(label).width + 14 * s;
  const x = W - tw - 14 * s, y = 38 * s;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, x, y, tw, 17 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + tw / 2, y + 8.5 * s);
  ctx.restore();
}

/** The fans in front throw their arms up when it goes in: three people
 *  (shoulders, then upper arm and forearm, bent at the elbow, open hands),
 *  one still holding a phone up. Dark, out of focus, in front of the lens. */
function drawArmsUp(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, t: number): void {
  const since = t - (track.goalT + 0.12);
  if (since < 0) return;
  const up = easeOut(since / 0.4);
  const ink = "rgba(14,14,20,0.95)";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const people = [0.18, 0.55, 0.88];
  people.forEach((px, k) => {
    const cx = px * W;
    const reach = H * (0.2 + 0.05 * k) * up;
    const bounce = Math.abs(Math.sin(since * 6.5 + k * 1.3)) * H * 0.018 * up;
    for (const side of [-1, 1]) {
      const sh = { x: cx + side * W * 0.075, y: H + W * 0.02 };
      const wave = Math.sin(since * (7 + k) + side + k) * W * 0.02 * up;
      const hand = { x: sh.x + side * W * (0.05 + 0.03 * up) + wave, y: H - reach - bounce };
      const elbow = { x: (sh.x + hand.x) / 2 + side * W * 0.035, y: (sh.y + hand.y) / 2 };
      ctx.strokeStyle = ink;
      ctx.lineWidth = W * 0.052;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(elbow.x, elbow.y); ctx.stroke();
      ctx.lineWidth = W * 0.04;
      ctx.beginPath(); ctx.moveTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
      if (k === 1 && side === 1) {
        // Still filming: a phone held up, its screen lit.
        ctx.save();
        ctx.translate(hand.x, hand.y - W * 0.03);
        ctx.rotate(side * 0.12);
        ctx.fillStyle = ink;
        roundRect(ctx, -W * 0.032, -W * 0.06, W * 0.064, W * 0.11, W * 0.01);
        ctx.fill();
        ctx.fillStyle = "rgba(120,170,255,0.55)";
        roundRect(ctx, -W * 0.025, -W * 0.052, W * 0.05, W * 0.094, W * 0.006);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.ellipse(hand.x, hand.y - W * 0.012, W * 0.026, W * 0.032, side * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  ctx.restore();
}

/** Darken the still behind a card. */
function dim(ctx: CanvasRenderingContext2D, W: number, H: number, k: number): void {
  ctx.fillStyle = `rgba(6,8,14,${(0.62 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

/** The TikTok end card: the player's name, huge, in the account's colour. */
function drawNameCard(ctx: CanvasRenderingContext2D, W: number, H: number, track: GoalTrack, into: number, accent: string, credit?: ClipCredit): void {
  const s = W / 360;
  dim(ctx, W, H, easeOut(into / 0.2));
  const k = easeOut(into / 0.28);
  const name = (track.meta.scorerShort || track.meta.scorer).toUpperCase();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 64 * s;
  ctx.font = `900 ${size}px ${FONT}`;
  while (ctx.measureText(name).width > W * 0.88 && size > 28 * s) { size -= 2 * s; ctx.font = `900 ${size}px ${FONT}`; }
  const y = H * 0.44;
  ctx.globalAlpha = k;
  ctx.translate((1 - k) * -W * 0.25, 0);
  ctx.lineJoin = "round";
  ctx.lineWidth = 8 * s;
  ctx.strokeStyle = "#000";
  ctx.strokeText(name, W / 2, y);
  ctx.fillStyle = accent;
  ctx.fillText(name, W / 2, y);
  ctx.fillStyle = accent;
  ctx.fillRect(W * 0.3, y + size * 0.6, W * 0.4, 4 * s);
  ctx.font = `800 ${17 * s}px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  const [h, a] = track.meta.scoreAfter ?? [0, 0];
  ctx.fillText(`${track.meta.minuteLabel}' · ${shortClub(track.meta.home)} ${h}-${a} ${shortClub(track.meta.away)}`, W / 2, y + size * 0.6 + 26 * s, W * 0.9);
  const handle = handleOf(credit);
  if (handle) {
    ctx.font = `700 ${14 * s}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(`follow ${handle}`, W / 2, H * 0.8, W * 0.9);
  }
  ctx.restore();
}

/** The full-time card: the score, and who scored when, under the clubs. */
function drawStatsCard(ctx: CanvasRenderingContext2D, W: number, H: number, edit: Edit, into: number, accent: string, credit?: ClipCredit): void {
  const s = W / 640;
  dim(ctx, W, H, easeOut(into / 0.2));
  const tracks = edit.tracks;
  const first = tracks[0];
  const lastT = tracks[tracks.length - 1];
  const oneMatch = tracks.every(t => t.meta.home === first.meta.home && t.meta.away === first.meta.away);
  const k = easeOut(into / 0.3);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 18 * s);
  const pw = 470 * s, ph = Math.min(H - 30 * s, (176 + 26 * Math.min(5, Math.ceil(tracks.length / 2) + 1)) * s);
  const px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = "rgba(10,12,20,0.94)";
  roundRect(ctx, px, py, pw, ph, 10 * s);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(px, py, pw, 4 * s);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accent;
  ctx.font = `900 ${17 * s}px ${FONT}`;
  const title = !oneMatch ? `${tracks.length} GOALS` : tracks.length > 1 ? "FULL TIME" : "GOAL";
  ctx.fillText(lastT.meta.competition ? `${title} · ${lastT.meta.competition.toUpperCase()}` : title, W / 2, py + 26 * s, pw - 20 * s);
  // The score line (the last goal's score) with the two clubs' colours.
  const t0 = oneMatch ? lastT : first;
  const [h, a] = t0.meta.scoreAfter ?? [0, 0];
  const kh = kitsOf(t0.meta.home).home, ka = kitsOf(t0.meta.away).home;
  const cy = py + 74 * s;
  ctx.font = `900 ${42 * s}px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${h} - ${a}`, W / 2, cy);
  ctx.font = `900 ${28 * s}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(teamCode(t0.meta.home), W / 2 - 74 * s, cy);
  ctx.textAlign = "left";
  ctx.fillText(teamCode(t0.meta.away), W / 2 + 74 * s, cy);
  ctx.fillStyle = kh.shirt; ctx.fillRect(W / 2 - 185 * s, cy - 17 * s, 10 * s, 34 * s);
  ctx.fillStyle = ka.shirt; ctx.fillRect(W / 2 + 175 * s, cy - 17 * s, 10 * s, 34 * s);
  // Who scored: home side on the left, away on the right.
  ctx.font = `700 ${19 * s}px ${FONT}`;
  ctx.fillStyle = "#e5e7eb";
  let hy = cy + 46 * s, ay = cy + 46 * s;
  for (const t of tracks.slice(0, 8)) {
    const homeGoal = scoredByHome(t);
    const line = `${t.meta.scorerShort || t.meta.scorer} ${t.meta.minuteLabel}'`;
    if (homeGoal) { ctx.textAlign = "right"; ctx.fillText(line, W / 2 - 24 * s, hy, pw / 2 - 30 * s); hy += 25 * s; }
    else { ctx.textAlign = "left"; ctx.fillText(line, W / 2 + 24 * s, ay, pw / 2 - 30 * s); ay += 25 * s; }
  }
  const handle = handleOf(credit);
  if (handle) {
    ctx.textAlign = "center";
    ctx.font = `800 ${14 * s}px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(handle, W / 2, py + ph - 16 * s);
  }
  ctx.restore();
}

/** Did the home side score this goal? (The scorer's side on the recording.) */
function scoredByHome(t: GoalTrack): boolean {
  const b = t.bodies.find(x => x.id === t.meta.scorerBody);
  const ours = b ? b.side === "us" : true;
  return ours === t.meta.youAreHome;
}

export type { Shot };
