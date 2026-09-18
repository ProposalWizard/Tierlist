"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders,
  stepBallInNet, settleBall, stepBallPastBar, dragForFullPower, clamp,
  type Ball, type Outcome, type Scenario, type Viewport,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  CX, POST_L, POST_R, NET_DEPTH, PEN_SPOT_Y, SIX_L, SIX_R, SIX_DEPTH,
  BOX_L, BOX_R, BOX_DEPTH, GOAL_H, ARC_R,
} from "@/lib/star/pitch";
import { REPS, penaltySetup, strikeQuality, meanQuality } from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import ContactBall from "@/components/star/ContactBall";

/**
 * THE PENALTIES STAGE — and, in the second half of this file, the striking
 * machinery the FREE KICKS stage runs on too.
 *
 * ── Why the shared parts live here rather than in a lib module ──
 *
 * Penalties and free kicks are the same screen with a different picture in
 * front of it: drag to aim, pick a spot on the ball, watch it, score what
 * happened. The loop, the thumb, the paint and the rep bookkeeping are
 * identical, and duplicating three hundred lines of canvas across two files
 * so that each could own its own copy would be the worst of the options.
 *
 * The natural home for `StrikeStage` and `paintTrialScene` is a lib module,
 * and if this were a free hand that is where they would be. It is not: this
 * lane owns exactly three component files and no library file, and inventing
 * one would land in another agent's working tree. So the generic piece lives
 * in the first of the two files that uses it and is exported; TrialFreeKicks
 * imports it. Worth moving into `lib/star/` the next time somebody has the
 * whole tree to themselves.
 *
 * ── What this stage does NOT decide ──
 *
 * Everything that matters is `trialStages.ts`: how good the keeper is, which
 * way he is leaning, how many you take, and what each one was worth. This
 * screen reads those numbers and shows them. The one number it does choose is
 * how far off centre a lean of 1.0 actually stands the keeper — see
 * PENALTY_LEAN_M.
 */

// ── The look, ported from TrialPenalty.tsx ─────────────────────────────────
//
// The single-penalty trial screen already established what a trial's pitch
// looks like (real grass colour with a grain, IFAB lines, the five-surface
// goal, a pose-driven keeper) and it was arrived at by being told the earlier
// hand-rolled version read as "trash". Rather than re-derive any of that, the
// same drawing is ported here, minus the parts that were specific to the
// one-penalty scene (the four decorative players standing outside the D) and
// plus the one thing it never needed: a free-kick wall that jumps.
const SKIN = "#c68642";
const TC = {
  pitch: "#1f9006",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  gk: "#fbbf24",
  gkRim: "#92400e",
  goldSoft: "#fde68a",
};
const GRASS_TILE = 96;

export function makeGrassTile(): HTMLCanvasElement | null {
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
  return c;
}

/**
 * The same aim feel as a real match, and for the same reason TrialPenalty has
 * its own note about it: this pair quietly drifted once already, and a trial
 * that teaches a different gesture from the game it is the opening of is
 * worse than no trial. MIN_PULL is a dead zone so a tap is not a shot;
 * full power is computed from the striker's own power, never a flat constant.
 */
const MIN_PULL = 0.008;

/** How far off centre a keeper leaning all the way (|lean| = 1) actually
 *  stands, in metres. Sized against the engine's own numbers rather than by
 *  eye: he can cover KEEPER_LATERAL_MAX (3.2 m) either side of where he
 *  starts, and his save radius at the goal plane is about 2 m, so 1.5 m of
 *  lean genuinely opens one corner and genuinely shuts the other without
 *  making a full-lean penalty a free goal on the open side. */
const PENALTY_LEAN_M = 1.5;

/** Seconds of flight after which an attempt is called dead regardless.
 *  `stepBall` has its own dead-ball timeout and should always resolve, but
 *  this stage is one of five and a rep that never ends would strand the whole
 *  trial on a screen with no way forward — a guard worth having even though
 *  nothing is known to trip it. */
const FLIGHT_TIMEOUT = 9;

type Phase = "aim" | "contact" | "flight" | "result";

// ── The picture ────────────────────────────────────────────────────────────

/**
 * Draw one striking scene: the pitch, the goal, the wall (if there is one),
 * the keeper, the ball and — while a drag is live — the aim arrow and power
 * meter. Exported because the free-kick stage draws the identical scene.
 */
export function paintTrialScene(
  ctx: CanvasRenderingContext2D,
  sc: Scenario,
  opts: {
    W: number; H: number;
    ball: Ball | null;
    /** Where the thumb is now, in pitch metres — null when not dragging. */
    drag: { x: number; y: number } | null;
    power: number;
    ballImg: HTMLImageElement | null;
    grass: HTMLCanvasElement | null;
  },
) {
  const { W, H, ball, drag, power, ballImg, grass } = opts;
  const vp = sc.viewport;
  const sx = W / (vp.x2 - vp.x1), sy = H / (vp.y2 - vp.y1);
  const px = (x: number) => (x - vp.x1) * sx;
  const py = (y: number) => (y - vp.y1) * sy;
  const unit = Math.min(sx, sy);

  // ── Grass ──
  ctx.fillStyle = TC.pitch;
  ctx.fillRect(0, 0, W, H);
  if (grass) {
    const pat = ctx.createPattern(grass, "repeat");
    if (pat) {
      ctx.save();
      ctx.translate(px(0) % GRASS_TILE, py(0) % GRASS_TILE);
      ctx.fillStyle = pat;
      ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
      ctx.restore();
    }
  }
  {
    const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
      const cx2 = px(x), cy2 = py(y);
      const g = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(rx, ry) * unit);
      g.addColorStop(0, `rgba(120,132,26,${alpha})`);
      g.addColorStop(1, "rgba(120,132,26,0)");
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.scale(1, ry / rx);
      ctx.translate(-cx2, -cy2);
      ctx.fillStyle = g;
      ctx.fillRect(cx2 - rx * unit * 1.2, cy2 - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
      ctx.restore();
    };
    wear(CX, 1.9, 6.2, 2.4, 0.22);
    wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16);
  }

  ctx.strokeStyle = TC.line;
  ctx.lineWidth = Math.max(1.5, unit * 0.12);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
  };
  line(vp.x1, 0, vp.x2, 0);
  ctx.strokeRect(px(SIX_L), py(0), (SIX_R - SIX_L) * sx, SIX_DEPTH * sy);
  ctx.strokeRect(px(BOX_L), py(0), (BOX_R - BOX_L) * sx, BOX_DEPTH * sy);

  // The D — real IFAB geometry, the arc clipped to the part beyond the box.
  ctx.strokeStyle = TC.lineFaint;
  ctx.beginPath();
  const halfD = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
  ctx.arc(px(CX), py(PEN_SPOT_Y), ARC_R * unit, Math.PI / 2 - halfD, Math.PI / 2 + halfD);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px(CX), py(PEN_SPOT_Y), Math.max(2, unit * 0.16), 0, Math.PI * 2);
  ctx.fillStyle = TC.line;
  ctx.fill();

  // ── The goal: five surfaces, back to front ──
  {
    const hpx = GOAL_H * sy;
    const bl = { px: px(POST_L), py: py(0) }, br2 = { px: px(POST_R), py: py(0) };
    const tl = { px: bl.px, py: bl.py - hpx }, tr = { px: br2.px, py: br2.py - hpx };
    const rl = { px: px(POST_L), py: py(-NET_DEPTH) }, rr = { px: px(POST_R), py: py(-NET_DEPTH) };
    const ul = { px: rl.px, py: rl.py - hpx }, ur = { px: rr.px, py: rr.py - hpx };

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

    const sh = unit * 0.5;
    quad([rl, rr, br2, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
    quad([bl, br2, rr, rl], "rgba(20,50,32,0.05)");
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
    seg(bl, tl); seg(br2, tr);
    ctx.lineWidth = Math.max(2, unit * 0.16);
    seg(tl, tr);
    ctx.lineCap = "butt";

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1.5, unit * 0.11);
    line(POST_L, 0, POST_R, 0);
  }

  // ── The men in the way ──
  //
  // A penalty's two defenders stand at the D and never move; a free-kick wall
  // stands in front of the ball and JUMPS as it is struck (`stepDefenders`
  // gives each of them a real z/vz). Drawing the lift — the shadow stays on
  // the grass, the figure rises off it — is what makes going under a wall
  // read as a real option rather than a coincidence.
  for (const d of sc.defenders) {
    const lift = Math.max(0, d.z ?? 0);
    const dpx = px(d.x), dpy = py(d.y);
    const r = unit * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(dpx, dpy + r * 0.9, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    // Same height-to-screen factor the ball uses below, so a man a metre off
    // the ground and a ball a metre off the ground agree with each other.
    ctx.translate(0, -lift * sy * 0.55);
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(dpx - r * 0.14, dpy + r * 0.1);
    ctx.lineTo(dpx - r * 0.18, dpy + r * 0.82);
    ctx.moveTo(dpx + r * 0.14, dpy + r * 0.1);
    ctx.lineTo(dpx + r * 0.18, dpy + r * 0.82);
    ctx.stroke();
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.roundRect?.(dpx - r * 0.42, dpy - r * 0.55, r * 0.84, r * 0.7, r * 0.16);
    if (!ctx.roundRect) ctx.rect(dpx - r * 0.42, dpy - r * 0.55, r * 0.84, r * 0.7);
    ctx.fill();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dpx, dpy - r * 0.78, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.restore();
  }

  // ── The keeper — the same pose-driven figure a real match draws ──
  {
    const kk = sc.keeper;
    const kpx = px(kk.x), kpy = py(kk.y);
    const lunge = kk.saveLunge > 0 ? kk.saveLunge : 0;
    const KIND = {
      catch:     { lean: 0.15, armUp:  0.25, spread: 0.45, reachK: 0.55, crouch: 0.10 },
      central:   { lean: 0.05, armUp: -0.10, spread: 1.05, reachK: 0.80, crouch: 0.22 },
      low:       { lean: 1.15, armUp: -0.85, spread: 0.95, reachK: 1.35, crouch: 0.30 },
      high:      { lean: 0.55, armUp:  1.00, spread: 0.80, reachK: 1.30, crouch: -0.35 },
      fingertip: { lean: 1.30, armUp:  0.35, spread: 0.70, reachK: 1.70, crouch: 0.05 },
    } as const;
    const kind = kk.saveKind ?? null;
    const K = kind ? KIND[kind] : null;

    const breathe = Math.sin(kk.idleT * 2.1) * 0.02;
    const weight = Math.sin(kk.idleT * 0.9) * 0.05;

    const diveN = clamp(Math.abs(kk.dive) / 1.6, 0, 1) * 0.45 + lunge * (K ? K.reachK : 0.55);
    const sign = kk.saveLunge > 0 ? (kk.saveDir || 1) : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
    const KR = unit * 1.15 * 0.82;
    const lean = sign * diveN * (K ? K.lean : 0.9);
    const cx2 = kpx + sign * KR * lunge * (K ? K.reachK : 1.0) * 0.3;
    const cyOff = KR * ((K ? K.crouch : 0) * lunge + breathe);
    const gloveR = KR * 0.24;

    ctx.save();
    ctx.globalAlpha = 0.92;

    ctx.beginPath();
    ctx.ellipse(cx2, kpy, KR * (0.7 + diveN * 0.5), KR * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    ctx.translate(cx2 + KR * weight * (1 - lunge), kpy - KR * 0.8 + cyOff);
    ctx.rotate(lean);
    ctx.lineCap = "round";

    ctx.strokeStyle = SKIN;
    ctx.lineWidth = Math.max(1.2, KR * 0.28);
    ctx.beginPath();
    ctx.moveTo(-KR * 0.22, KR * 0.16);
    ctx.lineTo(-KR * 0.30 - diveN * KR * 0.3, KR * 0.76);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(KR * 0.22, KR * 0.16);
    ctx.lineTo(KR * 0.30 + diveN * KR * 0.3, KR * 0.76);
    ctx.stroke();

    ctx.fillStyle = TC.gkRim;
    ctx.beginPath();
    ctx.roundRect?.(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34, KR * 0.12);
    if (!ctx.roundRect) ctx.rect(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34);
    ctx.fill();

    const spread = K ? K.spread : 1;
    const armUp = K ? K.armUp : 0;
    const reach = KR * (0.62 + diveN * 0.85) * (0.55 + spread * 0.45);
    const armY = -KR * 0.28 - armUp * diveN * KR * 0.85;
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = Math.max(1.1, KR * 0.24);
    const gloves: { x: number; y: number }[] = [];
    for (const s2 of [-1, 1]) {
      const leading = sign === 0 || Math.sign(s2) === sign;
      const ex2 = s2 * reach * (leading ? 1 : 0.62);
      const ey2 = armY - (leading ? diveN * KR * 0.2 : 0);
      ctx.beginPath();
      ctx.moveTo(s2 * KR * 0.32, -KR * 0.28);
      ctx.lineTo(ex2, ey2);
      ctx.stroke();
      gloves.push({ x: ex2, y: ey2 });
    }

    ctx.fillStyle = TC.gk;
    ctx.beginPath();
    ctx.roundRect?.(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58, KR * 0.15);
    if (!ctx.roundRect) ctx.rect(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58);
    ctx.fill();
    ctx.lineWidth = Math.max(1, KR * 0.11);
    ctx.strokeStyle = TC.gkRim;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = TC.gkRim;
    ctx.lineWidth = Math.max(1, KR * 0.09);
    for (const g of gloves) {
      ctx.beginPath();
      ctx.arc(g.x, g.y, gloveR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, -KR * 0.70, KR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.lineWidth = Math.max(1, KR * 0.09);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();

    ctx.restore();
  }

  // ── The ball ──
  const bx = ball ? px(ball.pos.x) : px(sc.ball.x);
  const by = ball ? py(ball.pos.y) : py(sc.ball.y);
  const lift = ball ? Math.max(0, ball.z) : 0;
  const br = Math.max(4.5, unit * 0.5 * (1 + Math.min(lift, 8) * 0.055));
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(bx, by, br * 0.95, br * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const drawnY = by - lift * sy * 0.55;
  if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
    ctx.drawImage(ballImg, bx - br, drawnY - br, br * 2, br * 2);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(bx, drawnY, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = Math.max(1, br * 0.16);
    ctx.stroke();
  }

  // ── The aim arrow and power meter ──
  if (drag) {
    const dx = sc.ball.x - drag.x, dy = sc.ball.y - drag.y;
    const len = Math.hypot(dx, dy) || 1;
    const shown = power * (vp.y2 - vp.y1) * 0.11;
    const ax = px(sc.ball.x), ay = py(sc.ball.y);
    const bx2 = px(sc.ball.x + (dx / len) * shown);
    const by2 = py(sc.ball.y + (dy / len) * shown);

    const ang = Math.atan2(by2 - ay, bx2 - ax);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    const arrowLen = Math.hypot(bx2 - ax, by2 - ay) || 1;
    const headLen = clamp(W * 0.045, W * 0.02, arrowLen * 0.45);
    const headHalf = W * 0.022;
    const shaftW = W * 0.014;
    const hbx = bx2 - ux * headLen, hby = by2 - uy * headLen;

    const shaftGrad = ctx.createLinearGradient(ax, ay, bx2, by2);
    shaftGrad.addColorStop(0, "#fb923c");
    shaftGrad.addColorStop(1, "#ea580c");
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = shaftW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(hbx, hby);
    ctx.stroke();
    ctx.lineCap = "butt";

    ctx.beginPath();
    ctx.moveTo(bx2, by2);
    ctx.lineTo(hbx + nx * headHalf, hby + ny * headHalf);
    ctx.lineTo(hbx - nx * headHalf, hby - ny * headHalf);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, unit * 0.22);
    ctx.strokeStyle = "rgba(124,45,18,0.6)";
    ctx.stroke();

    const meterX = W * 0.045, meterTop = H * 0.15, meterH = H * 0.7, meterW = W * 0.055;
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    ctx.fillRect(meterX, meterTop, meterW, meterH);
    const fillH = meterH * power;
    const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
    grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
    ctx.fillStyle = grad;
    ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterTop, meterW, meterH);
    ctx.fillStyle = TC.goldSoft;
    ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterW / 2, meterTop - W * 0.022);
  }
}

/** What to say about an attempt once it has resolved. Never "failed" — a
 *  trial stage is a mean of several attempts, and a stage that scolds you
 *  four times out of five reads as broken rather than as hard. */
export const OUTCOME_LINE: Partial<Record<Outcome, string>> = {
  goal: "Scored!",
  rebound: "In off the rebound!",
  saved: "Saved.",
  tipped: "Tipped away.",
  caught: "Caught.",
  wide: "Wide.",
  over: "Over the bar.",
  post: "Off the post!",
  short: "Not enough on it.",
  blocked: "Into the wall.",
  tackled: "Charged down.",
  offside: "Flag up.",
  delivered: "Cleared.",
};

// ── The generic striking stage ─────────────────────────────────────────────

export interface StrikeStageProps {
  /** How many attempts. */
  reps: number;
  /** Build the scenario for one rep. Everything stage-specific lives here:
   *  the ball's spot, the keeper, the wall, the camera. */
  build: (rep: number, rng: () => number) => Scenario;
  /** Fed straight to the engine's striking model, and to `dragForFullPower`
   *  so the drag reaches full power at the same distance a real match does. */
  skills: { power: number; technique: number };
  /** Seeds the per-rep RNG, so the same attempt is the same attempt however
   *  many times the app is closed and re-opened — the rule the whole trial is
   *  built on (see trial.ts). */
  seed: number;
  title: string;
  hint: string;
  /** Extra line under the rep counter: distance, wall size, whatever the
   *  stage wants the player to actually read before he strikes it. */
  subtitle?: (rep: number) => string;
  onDone: (quality: number) => void;
}

export function StrikeStage({
  reps, build, skills, seed, title, hint, subtitle, onDone,
}: StrikeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const phaseRef = useRef<Phase>("aim");
  const outcomeRef = useRef<Outcome | null>(null);
  const resolvedRef = useRef(false);
  const flightTRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const repRef = useRef(0);
  const doneRef = useRef(false);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  const grassRef = useRef<HTMLCanvasElement | null>(null);

  const [rep, setRep] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("aim");
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [resultText, setResultText] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  /** Full power is reached at the same drag distance a real match uses for a
   *  striker with these legs. */
  const fullPowerPull = useMemo(() => dragForFullPower(skills.power), [skills.power]);

  // A fresh attempt. Keyed on `rep` so it runs once per attempt and never
  // mid-flight.
  useEffect(() => {
    // Each rep gets its own stream. Mixing the rep into the seed (rather than
    // drawing a rep's scenario from one long-running stream) means attempt
    // three is the same attempt three whether or not you sat out attempt two
    // — the same reproducibility rule `penaltySetup` follows for its own
    // keeper lean.
    const rng = mulberry32((seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0);
    rngRef.current = rng;
    const sc = build(rep, rng);
    scRef.current = sc;
    ballRef.current = null;
    outcomeRef.current = null;
    resolvedRef.current = false;
    flightTRef.current = 0;
    dragRef.current = null;
    draggingRef.current = false;
    repRef.current = rep;
    setAim(null);
    setResultText("");
    setPhase("aim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, seed]);

  // ── The thumb ──────────────────────────────────────────────────────────
  const pitchFromPointer = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const sc = scRef.current;
    if (!c || !sc) return { x: CX, y: PEN_SPOT_Y };
    const vp = sc.viewport;
    const r = c.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return { x: vp.x1 + fx * (vp.x2 - vp.x1), y: vp.y1 + fy * (vp.y2 - vp.y1) };
  };

  /** Pull length as a fraction of the canvas height, so power reads the same
   *  however the scene is scaled. */
  const screenPull = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) => {
    const h = vp.y2 - vp.y1, w = vp.x2 - vp.x1;
    const aspect = w / h;
    return Math.hypot(((drag.x - ball.x) / w) * aspect, (drag.y - ball.y) / h);
  };
  const powerFrom = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) =>
    clamp(screenPull(drag, ball, vp) / fullPowerPull, 0, 1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    draggingRef.current = true;
    dragRef.current = pitchFromPointer(e);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    const sc = scRef.current;
    dragRef.current = null;
    if (!d || !sc) return;
    if (screenPull(d, sc.ball, sc.viewport) < MIN_PULL) return;
    const power = powerFrom(d, sc.ball, sc.viewport);
    if (power < 0.05) return;
    setAim({ dir: { x: sc.ball.x - d.x, y: sc.ball.y - d.y }, power });
    setPhase("contact");
  };

  const handleContact = (contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc || !aim) return;
    ballRef.current = launch(sc, aim.dir, aim.power, contact, skills, rngRef.current);
    setAim(null);
    flightTRef.current = 0;
    setPhase("flight");
  };

  /** One attempt is over. Score it and move on. */
  const finishAttempt = useCallback((outcome: Outcome) => {
    const sc = scRef.current, ball = ballRef.current;
    // Placement only means something for a ball that actually reached the
    // goal line; anything else has no crossing point to grade.
    const crossX = ball && (outcome === "goal" || outcome === "rebound"
      || outcome === "wide" || outcome === "over" || outcome === "post")
      ? ball.pos.x : null;

    // ── Somebody else finishing it ──
    //
    // In a real match a team-mate can get on the end of a rebound, and a
    // clean team-mate finish reports as "goal" exactly like yours would —
    // `receiverShot` is the one reliable signal that somebody else struck it
    // (TrialPenalty had to make the same distinction). Crediting that as a
    // goal of YOURS is wrong here: this stage measures your striking, and a
    // scuffed kick a striker rescued would otherwise score a perfect 1.0. It
    // is graded as a save instead — the ball was struck, something stopped it
    // going straight in, and the rebound is not yours to claim.
    //
    // It genuinely fires, and it was worth measuring rather than reasoning
    // about: leaving `stepReactions` out of the loop looked like it should
    // make a team-mate finish impossible, and it does not — `stepBall` has
    // its own path onto a loose ball that does not need reactions at all.
    // About one struck attempt in forty ends this way
    // (tests/star/trialStageScreens.mts measures it on the real engine), so
    // without this guard roughly that many scuffed kicks a trial would score
    // a perfect 1.0.
    const yours = !sc?.receiverShot;
    const quality = yours ? strikeQuality(outcome, crossX) : strikeQuality("saved", null);

    scoresRef.current = [...scoresRef.current, quality];
    setResultText(
      !yours ? "A team-mate gets on the end of it."
        : (OUTCOME_LINE[outcome] ?? "Away."),
    );
    setPhase("result");
    window.setTimeout(() => {
      if (repRef.current + 1 >= reps) {
        if (doneRef.current) return;
        doneRef.current = true;
        onDone(meanQuality(scoresRef.current));
      } else {
        setRep(r => r + 1);
      }
    }, 1200);
  }, [onDone, reps]);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let settle = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;
      if (!sc) return;

      if (phaseRef.current === "aim") {
        // He breathes and shifts his weight rather than standing frozen.
        stepKeeper(sc, dt);
      } else if (phaseRef.current === "flight" && ballRef.current) {
        const ball = ballRef.current;
        flightTRef.current += dt;
        if (ball.inNet) {
          stepBallInNet(ball, dt);
        } else if (!outcomeRef.current) {
          // Three substeps per frame, the same split every other screen on
          // this engine uses. One coarse step per frame is measurably worse
          // at the boundary checks — over the bar, in the net, off the post —
          // that decide the outcome.
          //
          // `stepReactions` is deliberately absent, following TrialPenalty
          // rather than FiveASide. It is what sends team-mates chasing a
          // loose ball, and a drill that judges YOUR strike should not be
          // decided by somebody following it in — the more so because
          // neither dead-ball scenario draws those men, so a goal one of
          // them scored would arrive from nowhere on screen. It makes a
          // team-mate finish rare rather than impossible; `finishAttempt`'s
          // own guard is what actually handles the rest.
          for (let i = 0; i < 3; i++) {
            const h = dt / 3;
            // The wall jumps as the ball is struck. A no-op for anything that
            // is not a free kick, so it is called unconditionally rather than
            // branching on the scenario kind.
            stepDefenders(sc, h, sc.player, false, ball);
            stepKeeper(sc, h);
            const res = stepBall(ball, sc, rngRef.current, h);
            if (res) {
              outcomeRef.current = res;
              settle = 0;
              // The outcome is decided; the ball must not stop dead on the
              // frame it was decided. `settling` is what gates `settleBall`
              // below, and the engine only ever sets it itself for a loose
              // ball won by a defender.
              if (!ball.overBar) ball.settling = true;
              break;
            }
          }
          if (!outcomeRef.current && flightTRef.current > FLIGHT_TIMEOUT) {
            outcomeRef.current = "short";
            settle = 0;
            ball.settling = true;
          }
        } else {
          if (ball.settling) settleBall(ball, dt, sc);
          if (ball.overBar) stepBallPastBar(ball, dt);
        }
        if (outcomeRef.current) {
          settle += dt;
          if (settle > 1.0 && !resolvedRef.current) {
            resolvedRef.current = true;
            finishAttempt(outcomeRef.current);
          }
        }
      } else if (phaseRef.current === "result") {
        // Keep everything moving through the beat after the outcome, so a
        // goal is SEEN going in and a keeper is not frozen mid-dive.
        const ball = ballRef.current;
        if (ball) {
          if (ball.inNet) stepBallInNet(ball, dt);
          else if (ball.overBar) stepBallPastBar(ball, dt);
          else if (ball.settling) settleBall(ball, dt, sc);
        }
        if (!sc.keeper.done) stepKeeper(sc, dt);
      }

      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishAttempt]);

  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current, sc = scRef.current;
    if (!c || !wrap || !sc) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!grassRef.current) grassRef.current = makeGrassTile();

    const dragging = phaseRef.current === "aim" && draggingRef.current ? dragRef.current : null;
    paintTrialScene(ctx, sc, {
      W: cssW, H: cssH,
      ball: ballRef.current,
      drag: dragging,
      power: dragging ? powerFrom(dragging, sc.ball, sc.viewport) : 0,
      ballImg: ballImgRef.current,
      grass: grassRef.current,
    });
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/80">{title}</span>
        <span className="text-[11px] font-black tabular-nums text-white/60">
          {Math.min(rep + 1, reps)} / {reps}
        </span>
      </div>
      {subtitle && (
        <div className="mb-1.5 text-[11px] font-bold text-white/55">{subtitle(rep)}</div>
      )}

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border border-white/15"
        style={{ aspectRatio: "5 / 8" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* The hint sits in the strip a drag never reaches: full power only
            ever needs `dragForFullPower` (about 14 %) of the canvas height,
            and it is pointer-transparent besides. */}
        {phase === "aim" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
            <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
              {hint}
            </p>
          </div>
        )}

        {phase === "contact" && aim && (
          <ContactBall power={aim.power} onContact={handleContact} />
        )}

        {phase === "result" && resultText && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-40 flex justify-center px-4">
            <div className="rounded-xl bg-black/65 px-4 py-2 text-center text-lg font-black text-amber-300">
              {resultText}
            </div>
          </div>
        )}
      </div>

      {/* What each attempt was worth, as a row of pips — the mean of these is
          the stage's whole score, so seeing them fill up is seeing the score
          being built rather than a number arriving from nowhere at the end. */}
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: reps }, (_, i) => {
          const q = scoresRef.current[i];
          return (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              {q !== undefined && (
                <div
                  className={`h-full ${q >= 0.55 ? "bg-emerald-400" : q >= 0.3 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(8, q * 100)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── The penalties stage itself ─────────────────────────────────────────────

export interface TrialPenaltiesProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
}

/**
 * One rep's scenario, exported so a test can drive the real thing through the
 * engine rather than re-deriving it — a copy of these lines in the test would
 * pass happily while this one was wrong.
 */
export function buildPenaltyScenario(
  trial: TrialProgress, rep: number, rng: () => number,
): Scenario {
  const setup = penaltySetup(trial, rep);
  // The engine's own penalty, with the trial's keeper in it: strength and
  // lean both come from `penaltySetup`, everything else — the spot, the two
  // men on the edge of the D, the camera — is the picture a real match
  // already builds for a penalty.
  const sc = buildScenario("penalty", rng, setup.keeperStrength, 60, 55);
  initDefenders(sc, rng);
  sc.ball = { ...setup.ball };

  // He is standing off centre before you have even started your run-up —
  // which is the whole decision the stage asks for. Moving `startX` as well
  // as `x` is what makes it a real commitment rather than a pose: his dive is
  // bounded relative to where he started (KEEPER_LATERAL_MAX in the engine),
  // so leaning one way genuinely shuts that corner and genuinely opens the
  // other.
  const lean = clamp(setup.keeperLean, -1, 1) * PENALTY_LEAN_M;
  const kx = clamp(sc.keeper.x + lean, POST_L - 2.5, POST_R + 2.5);
  sc.keeper.x = kx;
  sc.keeper.startX = kx;
  sc.keeper.targetX = kx;
  return sc;
}

export default function TrialPenalties({
  trial, onDone, skills = { power: 55, technique: 55 },
}: TrialPenaltiesProps) {
  const build = useCallback(
    (rep: number, rng: () => number) => buildPenaltyScenario(trial, rep, rng),
    [trial],
  );

  return (
    <StrikeStage
      reps={REPS.penalties}
      build={build}
      skills={skills}
      seed={trial.seed}
      title="Penalties"
      hint="Drag back from the ball to aim, and pull further for more power."
      subtitle={rep => {
        const s = penaltySetup(trial, rep);
        // What the picture already shows, said out loud: he is drawn off
        // centre, so this is a reading of the scene rather than a hint
        // that gives anything away.
        return s.keeperLean > 0.25 ? "He has gone early to your right."
          : s.keeperLean < -0.25 ? "He has gone early to your left."
          : "He has not shown you a thing.";
      }}
      onDone={onDone}
    />
  );
}
