"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders,
  stepBallInNet, settleBall, stepBallPastBar, dragForFullPower, clamp,
  type Ball, type Outcome, type Scenario, type Viewport,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, POST_L, POST_R, NET_DEPTH, PEN_SPOT_Y } from "@/lib/star/pitch";
import {
  REPS, penaltySetup, strikeQuality, weightedQuality,
  teachSeen, markTeachSeen, type TeachableDrill,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import ContactBall from "@/components/star/ContactBall";
import { ELEVEN_A_SIDE_ATTACK } from "@/lib/star/fiveASide/rules";
import {
  cameraContaining, projectionFor, drawPitch, drawGoal, drawFigure, drawKeeper,
  drawBall, drawAim, ROLE_KIT, bodyPoseFor, MATCH_SCALE,
} from "@/lib/star/fiveASide/render";
import { loadFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { createFaceImageCache, type FaceImageCache } from "@/lib/star/faceImageCache";
import { fakeFaceFor } from "@/lib/star/fakeFaces";

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

// ── What the picture is drawn WITH ─────────────────────────────────────────
//
// Nothing, any more. This file used to carry three hundred lines of its own
// grass, its own IFAB lines, its own five-surface goal, its own wall figures
// and its own hand-drawn keeper — a second art style, with the vision stage
// carrying a third, so a new player met three different-looking games inside
// the first six minutes of his career.
//
// All of it now goes through `lib/star/fiveASide/render.ts`, the cleanest
// renderer in the opening: plain functions over a context, heads drawn through
// the shared `drawPlayerHead` so real photos and the Face Editor's own
// settings simply work. The geometry it draws from is `ELEVEN_A_SIDE_ATTACK`
// (rules.ts) — a real penalty area, a real 7.32 m goal, a real 2.44 m bar —
// so the striking stages get a full-size goal out of the same functions the
// five-a-side gets a small one out of, rather than a second copy of them.

/** The two men on the edge of the D, and a free kick's wall: not your team,
 *  not the opposition you can name — just bodies in the way. */
const WALL_KIT = { shirt: "#374151", shorts: "#1f2937", trim: "#e5e7eb" };
// KEEPER_KIT/YOU_KIT/MATE_KIT below all read from the shared ROLE_KIT
// (fiveASide/render.ts) now — the same real-match/training identity colours
// (gold keeper, green you, blue team-mate), not this screen's own drifted
// copies. Reported directly: this file's own YOU_KIT was near-white and
// MATE_KIT was light grey — neither matched the real match at all, and the
// trial is meant to be the first look at what this game actually looks
// like. See ROLE_KIT's own doc for the fuller before/after.
const KEEPER_KIT = { shirt: ROLE_KIT.gk, shorts: ROLE_KIT.gkRim, trim: ROLE_KIT.gkRim };
/**
 * ── THE PEOPLE WHO WERE THERE ALL ALONG AND WERE NEVER DRAWN ──
 *
 * Reported from a real playthrough of the free kicks: *"there are invisible
 * people there… it's probably just taking a regular free kick where you have
 * players around you, and it's just made them invisible."* That is exactly
 * what it was, and the bodies were real rather than a draw call going wrong.
 *
 * Every scenario the engine builds carries more than a wall and a keeper. A
 * free kick also has `player` (you, standing over it) and `follower` — the
 * one interactive rebound-chaser every scenario gets, placed 9-18 m from
 * goal, roughly central, i.e. straight down the flight path. A penalty has
 * `player`, `follower` AND `teammates[0]`, the pair on the edge of the D that
 * `buildPenalty`'s own comment says are "drawn but cannot poach". This screen
 * drew the defenders and the keeper and nothing else, so on a free kick the
 * ball sat alone on the grass with a man in front of goal nobody could see.
 *
 * He is not decoration: `stepBall` has the poacher on its reception candidate
 * list for any scenario with the goal in view. Measured over 1,080 real
 * strikes through the real engine, moving him off the pitch took "a team-mate
 * struck it" from **7.3 % to 0.0 %**, "saved" from 2.6 % to 0.0 % and
 * "Flag up" (offside, on a free-kick drill) from 0.8 % to 0.0 %. So about one
 * free kick in ten was being decided by somebody who was not on screen, and
 * the banner then said "A team-mate gets on the end of it" with nobody there.
 *
 * Drawing them is a picture change and nothing else — no position, camera or
 * outcome moves. Checked rather than assumed: across 900 real scenarios every
 * one of these bodies already falls inside `strikeCamera`'s frame, so the
 * camera does NOT have to grow to hold them. That matters more than it looks:
 * the frame is what `powerFrom` normalises the drag against, so a wider one
 * would quietly have retuned the power of every kick in the trial.
 */
const YOU_KIT = { shirt: ROLE_KIT.you, shorts: ROLE_KIT.youRim, trim: ROLE_KIT.youRim };
const MATE_KIT = { shirt: ROLE_KIT.mate, shorts: ROLE_KIT.mateRim, trim: ROLE_KIT.mateRim };

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

/**
 * How long the ball is watched after the outcome is decided, before the
 * result banner goes up.
 *
 * This used to be a full second, and the real match has no such gate at all —
 * `CanvasMatch` shows its banner the instant `stepBall` returns. Measured, the
 * trial's banner landed +983 ms after the outcome on every single attempt, on
 * top of the engine's own multi-second loose-ball resolution: a saved penalty
 * averaged 4.30 s to decide and 5.28 s to say so, and the worst case measured
 * was 8.52 s. Reported directly as the drills taking "ten seconds to say off
 * the post".
 *
 * Not taken all the way to zero, deliberately. Unlike the match, this screen
 * has no `stepReactions` — nobody chases a loose ball here, by design, so that
 * a drill judging YOUR strike is never decided by somebody following it in —
 * and a short beat is what lets a goal actually be SEEN crossing the line and
 * the keeper's dive be seen finishing (it completes ~150 ms after the ball
 * crosses, now that he is stepped through it at all). A quarter of a second
 * covers that and cuts three quarters of the delay.
 */
export const SETTLE_BEFORE_BANNER = 0.25;

/**
 * HOW LONG THE AIM ARROW IS DRAWN — moved to `fiveASide/render.ts` (see
 * `drawAim`) so the match, both striking trials AND five-a-side all draw the
 * same arrow rather than independent copies that drift, which is exactly how
 * five-a-side ended up with no arrowhead at all and training ended up stuck
 * on the old 0.11. Re-exported here so the existing import in
 * `tests/star/trialStageScreens.mts` keeps working unchanged.
 */
export { AIM_ARROW_LENGTH } from "@/lib/star/fiveASide/render";

/**
 * HOW LONG THE TAKER'S FIGURE HOLDS A KICKING POSE AFTER THE BALL IS STRUCK.
 *
 * The same real bug as `AIM_ARROW_LENGTH` above, one level deeper: reported
 * directly — "it seems like youve completely recreated and copied and made
 * an entirely different game" — and one measured piece of that was that only
 * `CanvasMatch.tsx` ever animated a figure at all; every taker on this screen
 * stood in the same still, idle stance whether he was lining up the shot or
 * had just struck it.
 *
 * Pinned to CanvasMatch.tsx's own `KICK_POSE_S`, not re-derived, for the same
 * reason the arrow length is pinned rather than guessed: the swing has to be
 * the match's swing. That file counts this DOWN from a ref reset at the
 * moment of contact; this screen already has `flightTRef`, which counts UP
 * from zero at the identical moment (see `handleContact`) and only while the
 * ball is actually in flight — so the equivalent check here is
 * `flightTRef.current < KICK_POSE_S`, not `> 0`.
 */
export const KICK_POSE_S = 0.28;

/**
 * Whether the taker's figure should be drawn mid-kick right now — pure and
 * exported so the decision can be tested without a canvas, the same split
 * this file's own opening comment draws between what a test can and cannot
 * reach. `flightT` is `undefined` before a kick has actually happened this
 * rep (see `draw()`'s own `struck` gate) — never a number that happens to be
 * small, so "just lined up" can never be misread as "just struck".
 */
export function isTakerKicking(flightT: number | undefined): boolean {
  return flightT !== undefined && flightT < KICK_POSE_S;
}

type Phase = "aim" | "contact" | "flight" | "result";

// ── The picture ────────────────────────────────────────────────────────────

/**
 * WHAT HAS TO BE IN SHOT, and why the box is not the frame.
 *
 * The scenario's own `viewport` is the WORLD, not the camera — the engine
 * calls a ball more than a metre outside it out of play — so it has to stay
 * the tall 5:8 rectangle the engine built. What it must not also be is the
 * shape of the canvas. It was, and measured on a phone the canvas ran 108 px
 * off the bottom of the screen: the first thing a new career shows you, and a
 * third of it below the fold, with the bottom half of what WAS on screen empty
 * grass nobody ever kicks a ball into.
 *
 * So the drawn camera is computed from what genuinely has to be visible — the
 * goal with its net, the ball, and the room behind the ball the drag pulls
 * back into — and `cameraContaining` grows that to the canvas's own shape.
 * Nothing is cropped, the empty third of the pitch is simply not filmed, and
 * a penalty is framed like a penalty instead of like a map.
 */
const CAMERA_SIDE_PAD = 6;
const CAMERA_BEHIND_BALL = 7;

export function strikeCamera(
  sc: Scenario, ball: { x: number; y: number }, W: number, H: number,
): Viewport {
  // The men in the way count. A penalty's two defenders stand on the edge of
  // the D, BEHIND the spot, and a frame that stopped at the drag room drew
  // both of them sliced off at the bottom edge — seen in a screenshot after
  // the first version of this shipped, not reasoned about.
  let x1 = Math.min(POST_L, ball.x), x2 = Math.max(POST_R, ball.x);
  let y2 = ball.y + CAMERA_BEHIND_BALL;
  for (const d of sc.defenders) {
    x1 = Math.min(x1, d.x); x2 = Math.max(x2, d.x);
    y2 = Math.max(y2, d.y + 2.5);
  }
  return cameraContaining({
    x1: x1 - CAMERA_SIDE_PAD, x2: x2 + CAMERA_SIDE_PAD,
    y1: -NET_DEPTH - 1.5, y2,
  }, W, H);
}

/**
 * EVERY BODY ON YOUR OWN SIDE THAT THE SCENARIO ACTUALLY HAS, in draw order —
 * furthest from the camera first, the same y-sort the rest of the game uses.
 *
 * Exported so `tests/star/trialStageScreens.mts` can hold it against real
 * scenarios rather than re-deriving "who should be on screen" locally. That
 * matters here more than usual: the bug this exists to fix was a body the
 * screen simply never listed, and a test with its own copy of the list would
 * have agreed with the bug. The taker is NOT in it — he is drawn last and
 * separately, in his own kit, at `takerSpot`.
 */
export function ownSideBodies(sc: Scenario): { x: number; y: number }[] {
  return [
    { x: sc.follower.x, y: sc.follower.y },
    ...sc.teammates.map(t => ({ x: t.x, y: t.y })),
    ...(sc.runner ? [{ x: sc.runner.pos.x, y: sc.runner.pos.y }] : []),
    ...(sc.secondaryRunners ?? []).map(r => ({ x: r.pos.x, y: r.pos.y })),
  ].sort((a, b) => a.y - b.y);
}

/**
 * WHERE THE TAKER IS DRAWN, which is not quite where he is.
 *
 * Both drills stand him a stride DIRECTLY behind the ball — `buildPenalty`
 * puts him at `PEN_SPOT_Y + 1.6`, `buildFreeKickScenario` at `ball.y + 2`.
 * A figure is drawn UP the screen from its boots, so at this camera (about
 * 13.5 px to the metre, a figure a hundred-odd px tall) a man 2 m behind the
 * ball has his head exactly on it: the first version of this drew the ball
 * sitting on top of his face, and the ball is the thing you have to find and
 * drag back from. Same class of problem as the teach card that used to sit on
 * it — a screenshot is the only thing that says so.
 *
 * So he is drawn a couple of metres to one side, the way the engine's own
 * `standOff` puts a carrier beside the ball in every other situation in the
 * game. `scenario.player` itself is NOT moved: it is real state the engine
 * reads (`stepDefenders`, the loose-ball 50-50), and a drawing routine has no
 * business writing to it. Which side: away from the middle of the goal, so he
 * never stands in the line you are about to aim down.
 */
const TAKER_DRAW_OFFSET = 2.3;

export function takerSpot(sc: Scenario): { x: number; y: number } {
  const dx = sc.player.x - sc.ball.x;
  // Already standing off to one side (an ordinary scenario would be) — leave
  // him exactly where he is.
  if (Math.abs(dx) >= TAKER_DRAW_OFFSET) return { x: sc.player.x, y: sc.player.y };
  const side = sc.ball.x >= CX ? 1 : -1;
  return { x: sc.ball.x + side * TAKER_DRAW_OFFSET, y: sc.player.y };
}

/**
 * ── THE DIVE, LATCHED, BECAUSE THE ENGINE RESTARTS IT HALFWAY THROUGH ──
 *
 * Reported from a real playthrough of the penalties: *"he's just not even
 * diving the right way. It's a little bit buggy. That didn't make sense."*
 * Traced by stepping a real trial penalty frame by frame, and it is a real
 * collision rather than a keeper who guessed wrong.
 *
 * `commitKeeperGuess` (below) makes him pick a side the instant the ball is
 * struck: `saveDir` is the side, `saveLunge` starts the dive, and he travels.
 * Measured on rep 2 of trial seed 77, where he did commit:
 *
 *   t=0.10  x=33.41  lunge=0.63  dir=-1      ← fully committed, going left
 *   t=0.20  x=32.87  lunge=1.00  dir=-1      ← at full stretch
 *   t=0.50  x=32.64  lunge=0.07  dir=+1      ← the ball reaches his line
 *
 * At that last line the engine's own save test runs, and it unconditionally
 * writes `k.saveDir = Math.sign(xAt − k.x)` and `k.saveLunge = 0.001`
 * (canvasEngine.ts, "He throws himself at it"). That is right for a match,
 * where nobody has committed beforehand and this IS the start of his dive.
 * Here it lands on a dive already fully played: on screen he snaps bolt
 * upright out of a full-stretch dive to his left and starts a fresh one to
 * his right, in one frame, as the ball goes past. Measured across the three
 * reps of that trial: 1 lunge reset and 1 direction flip, both on the one rep
 * where he had actually committed.
 *
 * So the drawing latches. Once a dive has started, its DIRECTION is whatever
 * it started as and its extension never goes backwards, for the rest of that
 * attempt. Nothing about the save, his travel or the outcome is touched —
 * `k.x`, `k.targetX` and `keeperAttempt` are all exactly as they were, and
 * the engine is not modified. This is the picture of the dive, and only that.
 *
 * Latched per keeper OBJECT rather than per component: `build(rep)` makes a
 * whole new scenario (and so a new keeper) for every attempt, so the latch
 * cannot leak from one kick into the next, and a `WeakMap` means nothing to
 * clear.
 */
const DIVE_LATCH = new WeakMap<object, { dir: number; lunge: number }>();

export function keeperDive(kk: Scenario["keeper"]): { dive: number; lunge: number } {
  const raw = kk.saveLunge > 0 ? Math.min(1, kk.saveLunge) : 0;
  const rawSign = kk.saveLunge > 0
    ? (kk.saveDir || 1)
    : (kk.dive === 0 ? 0 : Math.sign(kk.dive));

  const held = DIVE_LATCH.get(kk);
  // Before he has committed to anything there is nothing to hold: he is
  // stood up, leaning with whatever `stepKeeper` has left in `dive`.
  if (raw <= 0 && !held) {
    const reach = clamp(Math.abs(kk.dive) / 1.6, 0, 1);
    return { dive: rawSign * reach, lunge: 0 };
  }
  const dir = held ? held.dir : (rawSign || 1);
  const lunge = held ? Math.max(held.lunge, raw) : raw;
  DIVE_LATCH.set(kk, { dir, lunge });
  // `lunge` alone once he is diving, deliberately: the other term is derived
  // from `k.x − k.startX`, and a keeper dragged back across his own starting
  // point by the engine's final stretch would read as a BIGGER dive the way
  // he came from. Where his body actually is, is drawn by his position.
  return { dive: dir * lunge, lunge };
}

/**
 * Draw one striking scene: the pitch, the goal, the wall (if there is one),
 * the keeper, the ball and — while a drag is live — the aim arrow. Exported
 * because the free-kick stage draws the identical scene.
 *
 * Every mark on the grass and every figure on it now comes from
 * `fiveASide/render.ts`. What is left here is the one thing that belongs to
 * this screen rather than to football: the aim arrow.
 */
export function paintTrialScene(
  ctx: CanvasRenderingContext2D,
  sc: Scenario,
  opts: {
    W: number; H: number;
    /** What the camera is looking at — see `strikeCamera`. */
    camera: Viewport;
    ball: Ball | null;
    /** Where the thumb is now, in pitch metres — null when not dragging. */
    drag: { x: number; y: number } | null;
    power: number;
    faceStyle: FaceStyle;
    fakeFaceStyle: FakeFaceStyle;
    /** Resolves a decorative body's fake face — see `fake()` below. */
    faces: FaceImageCache;
    /**
     * Seconds since the ball was struck — `flightTRef.current`, valid only
     * once the phase has actually moved past "aim"/"contact" (the caller
     * passes `undefined` before then; see `draw()`'s own `struck` check —
     * the same ref reads 0 both before any kick and at the instant of one,
     * so "aim"/"contact" can't be told apart from "just kicked" without it).
     * Omitted, or past `KICK_POSE_S`, both draw the taker in his ordinary
     * still stance — see `KICK_POSE_S`'s own doc comment for why this counts
     * up, not down.
     */
    flightT?: number;
  },
) {
  const { W, H, camera, ball, drag, power, faceStyle, fakeFaceStyle, flightT, faces } = opts;
  const rules = ELEVEN_A_SIDE_ATTACK;
  const p = projectionFor(rules, W, H, camera);
  const { px, py, unit } = p;

  drawPitch(ctx, rules, p);
  drawGoal(ctx, rules, p, 0, NET_DEPTH, { height: rules.crossbar });

  // ── The men in the way ──
  //
  // A penalty's two defenders stand at the D and never move; a free-kick wall
  // stands in front of the ball and JUMPS as it is struck (`stepDefenders`
  // gives each of them a real z/vz). Drawing the lift — the shadow stays on
  // the grass, the figure rises off it — is what makes going under a wall
  // read as a real option rather than a coincidence.
  // No real identity reaches this screen at all — a trial happens before you
  // have even joined a club, so nobody here has a squad photo to draw. A
  // stable fake face per body, never the blank backing circle that used to
  // show instead — reported directly: "i dont EVER wanna see a blank circle
  // face, ALWAYS a fake face at least." `fake()` below is the one place that
  // decides, keyed by role so the same body keeps the same face frame to
  // frame without needing any real identity data at all.
  const fake = (key: string) => faces.get(fakeFaceFor(key));

  sc.defenders.forEach((d, i) => {
    drawFigure(
      ctx, p, d, { ...WALL_KIT, lift: Math.max(0, d.z ?? 0), face: fake(`wall-${i}`) },
      faceStyle, fakeFaceStyle, { scale: MATCH_SCALE },
    );
  });

  // ── The keeper ──
  //
  // The same man as everybody else on the pitch, in a keeper's pose — see
  // `drawKeeper`. He used to be drawn here, by hand, with his own head size
  // and his own arms, which is most of why he read as not quite right.
  {
    const kk = sc.keeper;
    const d = keeperDive(kk);
    drawKeeper(
      ctx, p, { x: kk.x, y: kk.y }, { ...KEEPER_KIT, face: fake("keeper") },
      { dive: d.dive, lunge: d.lunge },
      faceStyle, fakeFaceStyle, { scale: MATCH_SCALE },
    );
  }

  // ── …and the men in your own shirt ──
  //
  // See YOU_KIT above for what these are and why they were missing. Drawn
  // after the keeper, because every one of them stands nearer the camera than
  // he does, and among themselves furthest-from-camera first — the same
  // y-sort the rest of this game draws figures by.
  ownSideBodies(sc).forEach((m, i) => {
    drawFigure(ctx, p, m, { ...MATE_KIT, face: fake(`mate-${i}`) }, faceStyle, fakeFaceStyle, { scale: MATCH_SCALE });
  });
  // You, standing over it. Last of your own side, because you are the
  // nearest body to the camera on every one of these screens — and with the
  // same star the real match puts over your own figure, because your kit and
  // a team-mate's kit are the same kit and a first screenshot of this had two
  // identical white men on it with no way to tell which one was you.
  drawFigure(
    ctx, p, takerSpot(sc), { ...YOU_KIT, star: true, face: fake("you") }, faceStyle, fakeFaceStyle,
    { scale: MATCH_SCALE, pose: isTakerKicking(flightT) ? bodyPoseFor("kick", 0) : undefined },
  );

  // ── The ball ──
  drawBall(ctx, p, ball ? ball.pos : sc.ball, ball ? Math.max(0, ball.z) : 0, MATCH_SCALE);

  // ── The aim arrow ──
  //
  // Now the ONE shared `drawAim` (fiveASide/render.ts) — the match, both
  // striking trials and five-a-side all draw this exact arrow. This used to
  // be a hand-rolled copy of it living only here, which is exactly how a
  // future re-tune of the match's own arrow could drift out of step with
  // this screen again without anyone noticing.
  if (drag) {
    const dx = sc.ball.x - drag.x, dy = sc.ball.y - drag.y;
    drawAim(ctx, p, sc.ball, { x: dx, y: dy }, power);
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
  /**
   * The instruction shown, properly and at a readable size, on the FIRST rep
   * of the stage — see `TeachCard`.
   *
   * Optional only so `StrikeStage` stays a generic component; both stages
   * that use it pass one, because a first rep with nothing on it is the case
   * this exists to remove.
   */
  teach?: { headline: string; lines: string[]; short?: string };
  /** Which drill this is, for remembering that its teaching has been
   *  dismissed. See `teachSeen` in trialStages.ts. */
  drill: TeachableDrill;
  /**
   * Called the instant the ball is actually struck, with the live scenario.
   *
   * The one hook a stage gets into the flight it is about to watch. Penalties
   * uses it to make the keeper commit to a side and genuinely travel — see
   * `commitKeeperGuess`. Free kicks does not pass one: a keeper setting
   * himself against a wall is not guessing a corner blind, and nothing was
   * measured about that case.
   */
  onStrike?: (sc: Scenario, rep: number) => void;
  onDone: (quality: number) => void;
  /**
   * ── FOR A DRILL WHERE THE BALL MOVES DOWN THE SCREEN ──
   *
   * Measured directly, on `freeKicks`: `TEACH_PERSISTS` is `false`, so this
   * card only ever shows on rep 0 — but rep 0's own distance still ranges
   * 16-33 m depending on the day's difficulty, and the FULL card (headline
   * plus its two lines) is tall enough to sit on top of the ball at every
   * distance in that range, not just the hard end. A screenshot at the
   * EASIEST free kick (16 m) showed the ball's own circle drawn through the
   * middle of the "IT COUNTS" badge — this is not an edge case, it is the
   * ordinary first free kick of an ordinary trial.
   *
   * Penalties never needs this: the spot is fixed close to goal, and its own
   * screenshot at rep 0 clears the card by a comfortable margin every time.
   * So this is a prop, not a hardcoded change to `TeachCard` itself — only
   * the drill that actually moves the ball down the frame forces its one
   * rep-0 card into the compact, one-row form the OLD (now-unreachable,
   * `TEACH_PERSISTS`-only) later-rep logic already built for exactly this
   * shape of problem.
   */
  forceCompactTeach?: boolean;
}

/**
 * ── THE FIRST REP TEACHES, AND IT STILL COUNTS ──
 *
 * Decided directly: "I do think the first rep of each drill should count
 * towards your score, even though it's tutorial… Just give them a second to
 * understand what's happening." So this is not a practice go and nothing
 * anywhere treats it as one — rep 1 is scored by exactly the same
 * `strikeQuality` as every other rep and carries the lightest weight in
 * `REP_WEIGHT_RAMP` only because it is the EASIEST rep, never because it is
 * the tutorial one.
 *
 * What changes is what you are told before you take it. The stage's own hint
 * was an 11px grey line in a black pill along the bottom edge, which is the
 * size of thing you put a reminder in, not the size of thing you teach a
 * gesture with — and this is the first ball anybody in this game ever kicks.
 * They asked for "a proper graphic", so: a real card, the drag drawn rather
 * than described, and the stage's own instruction underneath it.
 *
 * ── IT MUST NOT COVER THE BALL IT IS TALKING ABOUT ──
 *
 * Reported as "boxing on the penalties", and measured: the card was an
 * `absolute inset-0` overlay whose panel covered roughly the bottom 45 % of
 * the play area, with its top edge at about 50 % of the canvas and the
 * penalty spot at 59 % — so it sat directly on top of the ball you are being
 * told to drag back from, on the first ball anybody in this game ever kicks.
 *
 * It is now pinned to the bottom strip and kept short: the drawn gesture is a
 * 24 px glyph on the badge row rather than a 56 px block beside the text, the
 * copy is tightened, and the wrapper only spans the bottom edge instead of
 * the whole canvas. That is the same strip the ordinary hint already lives in
 * and is documented as safe — full power only ever needs `dragForFullPower`
 * (about 14 %) of the canvas height behind the ball.
 *
 * Pointer-transparent throughout, EXCEPT the one button on it. It sits over
 * the canvas and the canvas owns every pointer event on this screen; a card
 * that swallowed the first drag would teach the gesture and then refuse it.
 * The dismiss button re-enables pointers on itself alone (`pointer-events-auto`
 * on a child of a `pointer-events-none` parent), so the small area it occupies
 * is the only part of the canvas a drag cannot BEGIN in. That is safe here
 * because a drag begins at the ball, which is well above this card, and a
 * pointer already captured by the canvas keeps moving over the button without
 * it ever seeing the gesture — the button can only ever take a fresh press.
 *
 * ── Dismissing it is teaching only ──
 *
 * "You should be able to get rid of the little tutorial." What goes is the
 * card: the headline, the drawn gesture, the instruction. What does NOT go is
 * anything live — the rep counter, the subtitle telling you how much of the
 * keeper's guess there is to read, the hint line, the score pips. The card is
 * replaced by the ordinary hint the other reps already show, so dismissing it
 * leaves the screen in the state rep 2 is in rather than in a state nothing
 * else in the game produces.
 */
export type TeachGesture = "drag" | "tap" | "flick";

/**
 * The gesture, drawn. The one thing a sentence is worst at describing, and
 * the reason these cards exist at all rather than a longer hint line.
 *
 * One per gesture the trial actually asks for, because a drag arrow on the
 * stage you tap is a wrong instruction rather than a missing one:
 *
 *   drag  — a ball, the thumb pulled back off it, the arrow showing where it
 *           goes. Penalties and free kicks.
 *   tap   — a finger on a man, with the ring a tap makes. Finding the pass.
 *   flick — a finger on the ball and a quick swipe past. Taking a man on.
 */
function TeachGlyph({ gesture, compact }: { gesture: TeachGesture; compact: boolean }) {
  const cls = compact ? "h-5 w-6 shrink-0" : "h-6 w-8 shrink-0";
  if (gesture === "tap") {
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <circle cx="30" cy="24" r="13" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="30" cy="24" r="6.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M44 38 L52 30 L58 42 Z" fill="#f97316" />
      </svg>
    );
  }
  if (gesture === "flick") {
    return (
      <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
        <circle cx="18" cy="30" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <line x1="26" y1="30" x2="52" y2="18" stroke="#fbbf24" strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray="5 3" />
        <path d="M56 16 L48 12 L50 22 Z" fill="#f97316" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
      <line x1="46" y1="30" x2="12" y2="42" stroke="#fbbf24" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray="4 3" />
      <circle cx="12" cy="42" r="4.5" fill="none" stroke="#fbbf24" strokeWidth="2" />
      <line x1="46" y1="30" x2="46" y2="10" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 5 L51 14 L41 14 Z" fill="#f97316" />
      <circle cx="46" cy="30" r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
    </svg>
  );
}

export function TeachCard(
  { headline, lines, short, onDismiss, compact = false, inline = false, gesture = "drag" }: {
    headline: string; lines: string[]; onDismiss: () => void;
    /**
     * The headline again, short enough for the one-row compact card.
     *
     * Not optional out of politeness — measured. The compact row leaves about
     * 215 px for text on a 390 px phone, which is around 30 characters at
     * this weight. "There is no through the wall." (30) fit to the pixel;
     * "Drag back from the ball, then let go." (38) rendered as "Drag back
     * from the ball, then l…" and lost the instruction's verb. A drill whose
     * headline is already short can leave this out.
     */
    short?: string;
    /** Headline only, no paragraph — see `TEACH_COMPACT_AFTER_REP`. */
    compact?: boolean;
    /** Render the panel alone, with no positioning of its own, for a caller
     *  that already has an overlay to put it in (the vision stage). */
    inline?: boolean;
    /** Which gesture to draw on the badge row. A drag arrow on a stage you
     *  tap is worse than no picture at all — it is a wrong instruction in the
     *  one place a card is meant to be clearer than words. */
    gesture?: TeachGesture;
  },
) {
  const panel = (
    <div
      className={
        "teach-card w-full rounded-xl border border-amber-300/40 bg-black/85 shadow-lg "
        + (compact ? "px-2 py-1" : "px-3 py-2")
      }
    >
      {/* Self-contained so the shared tailwind config stays untouched; a
          duplicated @keyframes block is harmless CSS. Slow and small on
          purpose — this now stays on screen until it is tapped, so anything
          faster than a breath would be a nuisance rather than a nudge. */}
      <style>{TEACH_CARD_CSS}</style>
      <div className="flex items-center gap-1.5">
        {/* Inline on the badge row, 24 px. It used to be a 56 px block
            beside the text, which is most of what made this card tall enough
            to cover the ball. See `TeachGlyph`. */}
        <TeachGlyph gesture={gesture} compact={compact} />
        {compact
          // One row, headline and all — see `TEACH_COMPACT_AFTER_REP`. The
          // badge goes too: the headline is already the shortest possible
          // statement of what the drill wants, and a label above it saying
          // "how to play" is a second line to say what the first line says.
          ? (
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-black leading-tight text-white">
              {short ?? headline}
            </span>
          )
          : (
            <>
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                How to play
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                It counts
              </span>
            </>
          )}
        <button
          type="button"
          onClick={onDismiss}
          className="teach-dismiss pointer-events-auto -my-1 -mr-1 ml-auto shrink-0 rounded-lg border border-amber-300/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200 transition hover:bg-white/10 hover:text-white"
        >
          Got it ✕
        </button>
      </div>

      {!compact && (
        <>
          <div className="mt-1.5 text-[12px] font-black leading-tight text-white">{headline}</div>
          {lines.map(l => (
            <p key={l} className="mt-0.5 text-[10.5px] font-bold leading-snug text-white/80">{l}</p>
          ))}
        </>
      )}
    </div>
  );

  if (inline) return panel;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2">
      {panel}
    </div>
  );
}

/**
 * The nudge. Two things, both deliberately slow.
 *
 * The card breathes — a faint amber glow that rises and falls over two and a
 * half seconds — and the dismiss button pulses very slightly in step with it,
 * so the eye is drawn to the one part of the card that is a control rather
 * than to the card as a whole.
 *
 * Asked for directly: "give the box a small animation until clicked." The
 * animation IS the until-clicked signal now that the card no longer times
 * itself out — it is the only thing on the screen saying this is waiting on
 * you rather than on the next kick.
 *
 * `prefers-reduced-motion` turns both off and leaves the card at its resting
 * state, which is legible on its own.
 */
const TEACH_CARD_CSS = `
@keyframes teachBreathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
  50%      { box-shadow: 0 0 14px 1px rgba(251,191,36,0.32); }
}
@keyframes teachNudge {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); }
}
.teach-card { animation: teachBreathe 2.4s ease-in-out infinite; }
.teach-dismiss { animation: teachNudge 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .teach-card, .teach-dismiss { animation: none; }
}
`;

/**
 * From this rep on the card drops its paragraph and keeps its headline.
 *
 * ── Why it has to shrink at all ──
 *
 * The card used to vanish when the rep counter moved off 1, so it only ever
 * had to fit above the FIRST ball of a stage. It now stays until it is
 * tapped, which means it has to fit above the LAST one — and on the striking
 * stages the ball moves down the screen as the stage gets harder.
 *
 * Read off the real view maths (`freeKickView`, `BEHIND_BALL = 7`): a first
 * free kick at 16 m leaves 51 % of the canvas below the ball, and the hardest
 * rep of the hardest trial — 30 m of ladder, +0.9 m a rep, plus the
 * long-range adversity event — leaves about 16 %. So a card that persisted at
 * full height would sit on the ball at exactly the moment the kick is
 * hardest, which is the "boxing on the penalties" complaint all over again
 * one stage later.
 *
 * ── The first compact card was still too tall, and only a screenshot said so
 *
 * That 16 % was then called "roughly 80 px" here, against a compact card
 * "about 45 px", and both halves of that arithmetic were wrong. Driven in a
 * real browser on an iPhone 13 viewport, the last free kick of an ordinary
 * run (23 m) cleared the card by 17.8 px, and the genuine worst case — 33 m,
 * reached by the reload difficulty escalation, which is a real mechanic
 * rather than a contrived state — measured **-2.2 px**: the ball sitting on
 * the card's top border.
 *
 * So compact is now ONE ROW — glyph, headline, button — rather than a badge
 * row with the headline under it, and it loses the outer padding a step as
 * well. That is about 29 px back, which turns the worst case from a graze
 * into real clearance. The headline is truncated rather than wrapped,
 * because a card that grows a second line under pressure is the same bug
 * returning by another route.
 *
 * Worth keeping in mind for anything else that ever gets pinned to this
 * strip: the ball is not in a fixed place on the striking stages. It moves
 * down the screen as the stage gets harder, and the only reliable way to
 * know whether something clears it is to look at the hardest rep, not the
 * first one.
 */
export const TEACH_COMPACT_AFTER_REP = 1;

/**
 * Does the teaching card stay up across the whole stage, or only the first
 * attempt?
 *
 * `false` — the shipped answer — means the first attempt only, and the card
 * goes when that attempt ends whether or not it was tapped. Tapping it is
 * still worth doing and does something different: it writes `teachSeen`, so
 * the drill never teaches you again on this device.
 *
 * ── Why this is a switch and not a deletion ──
 *
 * Both behaviours were built and both were measured in a real browser. It
 * stayed-until-tapped first, then was looked at and changed — "the box should
 * automatically leave after the first attempt imo" — which is a taste call
 * about a screen, exactly the kind that gets looked at again.
 *
 * Flipping this to `true` restores the persistent card in full, including the
 * compact one-row form it needs to clear the free-kick ball on the later
 * attempts (`TEACH_COMPACT_AFTER_REP`) and the short headlines each drill
 * carries for that row. None of that is reachable while this is `false`, and
 * it is kept rather than deleted because the sizing behind it cost two rounds
 * of real browser measurement to get right and would have to be re-taken.
 *
 * Same idiom as `USE_FIRST_PERSON_DRIBBLE` in CanvasMatch.tsx: one constant,
 * both paths real, the off one documented rather than rotting.
 */
export const TEACH_PERSISTS = false;

export function StrikeStage({
  reps, build, skills, seed, title, hint, subtitle, teach, drill, onStrike, onDone,
  forceCompactTeach = false,
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
  // Read once, not per frame: the Face Editor's settings are a localStorage
  // read, and every figure on the pitch draws its head through them.
  const camRef = useRef<Viewport | null>(null);
  const camKeyRef = useRef("");
  const faceStyleRef = useRef<FaceStyle>(loadFaceStyle());
  const fakeFaceStyleRef = useRef<FakeFaceStyle>(loadFakeFaceStyle());
  // Decorative bodies (the wall, the keeper, team-mates, you) have no real
  // identity in a trial — this resolves a stable fake face for each instead
  // of the blank backing circle they drew before. See `fake()` in
  // `paintTrialScene`.
  const facesRef = useRef<FaceImageCache>(createFaceImageCache());

  /**
   * THE BOX'S HEIGHT, MEASURED IN JS — NOT `aspect-[5/8] max-h-[64vh]`.
   *
   * Measured in a real browser: that Tailwind pair does not just cap the
   * box's HEIGHT once it bites — it shrinks its WIDTH too, down to 266px on
   * an iPhone 13 against the 366px `w-full` gives every other screen in this
   * game (match, training). That is most of a real, measured ~2x gap in how
   * tall a figure draws here versus everywhere else — the aim arrow's own
   * `unit` (px per metre) comes out 10.0 here against the match's 13.9 for
   * framing within 1.2% of the same real metres, purely because this box is
   * narrower, not because the camera is doing anything different.
   *
   * The fix: `w-full` alone decides width, same as everywhere else; height
   * is computed HERE, in JS, from that real measured width — capped at the
   * same 64vh this box has always used (see the "phone-shaped box" comment
   * below for the full, measured derivation of that number) — so the cap
   * can still stop the canvas running off a short phone without also
   * squeezing width down to get there.
   */
  const [boxH, setBoxH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      if (w <= 0) return;
      setBoxH(Math.min(w * (8 / 5), window.innerHeight * 0.64));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const [rep, setRep] = useState(0);
  /**
   * Whether the teaching is still being shown.
   *
   * Seeded from `localStorage` in an effect rather than in the initialiser:
   * this is a client component but Next still renders it once on the server,
   * where `window` does not exist — reading storage in `useState`'s
   * initialiser would throw there, and `useState(() => teachSeen(...))` would
   * also hand the first client render a value the server's HTML disagrees
   * with. Starting "not yet dismissed" and correcting on mount means the
   * server and the first client render always agree, and a returning player
   * loses the card a frame later rather than never.
   */
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen(drill)) setTeachDone(true); }, [drill]);
  const dismissTeach = useCallback(() => {
    markTeachSeen(drill);
    setTeachDone(true);
  }, [drill]);

  const [phase, setPhaseState] = useState<Phase>("aim");
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [resultText, setResultText] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

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
    camKeyRef.current = "";
    setAim(null);
    setResultText("");
    setPhase("aim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, seed]);

  // ── The thumb ──────────────────────────────────────────────────────────
  // ── A thumb lands where it LOOKS like it landed ──
  //
  // Through the CAMERA, not the scenario's viewport. Those used to be the same
  // rectangle and are not any more, and using the wrong one would put the drag
  // somewhere other than under the finger — the aim would be wrong by whatever
  // the camera had cropped, silently, on every kick.
  const pitchFromPointer = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const sc = scRef.current;
    if (!c || !sc) return { x: CX, y: PEN_SPOT_Y };
    const vp = camRef.current ?? sc.viewport;
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
    const vp = camRef.current ?? sc.viewport;
    if (screenPull(d, sc.ball, vp) < MIN_PULL) return;
    const power = powerFrom(d, sc.ball, vp);
    if (power < 0.05) return;
    setAim({ dir: { x: sc.ball.x - d.x, y: sc.ball.y - d.y }, power });
    setPhase("contact");
  };

  const handleContact = (contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc || !aim) return;
    ballRef.current = launch(sc, aim.dir, aim.power, contact, skills, rngRef.current);
    // The stage's one chance to react to the ball actually being hit, before
    // a single frame of flight is simulated — see `onStrike`.
    onStrike?.(sc, repRef.current);
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
        // Weighted, not a flat mean: the last kick of this stage is the
        // hardest one in it (a ball walked backwards, or a keeper who has
        // stopped telling you anything) and surviving it is worth more than
        // surviving the opener. See `weightedQuality`.
        onDone(weightedQuality(scoresRef.current));
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
          // ── HE MUST KEEP DIVING AFTER THE BALL IS IN ──
          //
          // Reported directly: "he dives after the ball goes in the net."
          // Measured over 200 penalties, the same scenarios and the same
          // strikes through both screens' loops, and the split is clean:
          //
          //                                        trial     real match
          //   dive STARTS, vs the ball crossing     −7 ms       −7 ms
          //   dive at FULL STRETCH                +1117 ms     +150 ms
          //
          // The start is identical, and is the engine's own rule (the save is
          // judged at the keeper's own line, which on a penalty is one substep
          // before the goal line) — not a trial bug. The stretch is, and it is
          // this: once `stepBall` returns an outcome the loop stays in the
          // `flight` phase for the settle beat below, and NEITHER of the two
          // branches it can now take used to call `stepKeeper`. He stopped
          // dead at 13 % of the dive, held there for 967 ms, and then finished
          // it as the banner appeared.
          //
          // `CanvasMatch.tsx` fixed exactly this for the real match, and its
          // own comment quotes the same complaint almost word for word ("so a
          // goal is SEEN going in and a keeper is not frozen mid-dive"). This
          // screen simply never inherited it. `pendingDone` is what stops him
          // arriving early, so gating on `done` is all that is needed here.
          if (!sc.keeper.done) stepKeeper(sc, dt);
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
          // The other post-outcome branch, and the same fix — see above. A
          // save, a post and a ball flying over all leave him mid-dive too.
          if (!sc.keeper.done) stepKeeper(sc, dt);
        }
        if (outcomeRef.current) {
          settle += dt;
          if (settle > SETTLE_BEFORE_BANNER && !resolvedRef.current) {
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

    // The camera is fixed for the whole attempt — framed off where the ball
    // STARTS, never off where it is now, so the shot holds still while the ball
    // moves inside it instead of chasing it toward goal. Recomputed only when
    // the canvas changes size or a new rep sets the ball down somewhere else.
    const want = `${cssW}x${cssH}:${sc.ball.x.toFixed(2)},${sc.ball.y.toFixed(2)}`;
    if (camKeyRef.current !== want) {
      camKeyRef.current = want;
      camRef.current = strikeCamera(sc, sc.ball, cssW, cssH);
    }
    const camera = camRef.current ?? strikeCamera(sc, sc.ball, cssW, cssH);

    const dragging = phaseRef.current === "aim" && draggingRef.current ? dragRef.current : null;
    // `flightTRef` is reset to 0 both at the START of a rep (nothing struck
    // yet) and at the instant of the strike itself — the same 0 means two
    // different things, so it is only a real "seconds since contact" signal
    // once the phase has actually moved past "aim"/"contact". Passed through
    // for "result" too, matching CanvasMatch.tsx's own choice to keep pose
    // state live into its result phase rather than freezing it at the cut.
    const struck = phaseRef.current === "flight" || phaseRef.current === "result";
    paintTrialScene(ctx, sc, {
      W: cssW, H: cssH,
      camera,
      ball: ballRef.current,
      drag: dragging,
      power: dragging ? powerFrom(dragging, sc.ball, camera) : 0,
      faceStyle: faceStyleRef.current,
      fakeFaceStyle: fakeFaceStyleRef.current,
      faces: facesRef.current,
      flightT: struck ? flightTRef.current : undefined,
    });
  };

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/80">{title}</span>
        <span className="text-[11px] font-black tabular-nums text-white/60">
          {Math.min(rep + 1, reps)} / {reps}
        </span>
      </div>
      {subtitle && (
        <div className="mb-1 text-[11px] font-bold text-white/55">{subtitle(rep)}</div>
      )}

      {/* ── A phone-shaped box, not a frame-shaped one ──
          5:8 with no height cap ran 108 px off the bottom of an iPhone 13 —
          measured, not guessed, and the first screen of a new career. The
          same fix the five-a-side already made: keep the box a comfortable
          shape, cap it against the viewport, and let the camera decide what
          of the pitch is in it. `strikeCamera` shows whatever shape this
          ends up being, so the cap can bite without cropping anything.

          ── The cap overshot, and the declared aspect was dead ──
          Reported as the gameplay screen being far smaller than the real
          match's, and measured: `max-h-[52vh]` (345 px on an iPhone 13's
          664 px viewport) ALWAYS bit before `aspect-[4/5]` (which wants
          447 px), so the declared 0.800 box was really a 1.037 one — wider
          than tall — against the real match's 0.625. The zoom was never
          different (both draw at 13.56 px/m and the goal is 99 px wide on
          both); what differed is how much pitch got screen, 25 m against
          42 m.
          So: the declared shape is now the match's own 5:8, and the cap was
          62vh — the same cap the five-a-side next door uses, which was the
          precedent for how much of one of these screens a phone can give.

          ── Raised again once the chrome above it was trimmed ──
          62vh (412 px) was measured against the header this screen used to
          carry: a "Trial day / Stage N of 5" line the pip bar already said,
          16 px of top padding a canvas-first screen didn't need, and a dev
          panel sized for a screen that wasn't fighting a canvas for room.
          Trimmed, the same header costs about half what it did — see
          TrialSequence.tsx's `progress` and DevTrialPanel.tsx's collapsed
          button.

          The real ceiling is NOT "how much header did we save" — it is the
          STICKY global nav (GlobalNav.tsx, not this file's to touch), which
          occupies the first 102 px of every screen permanently, scrolled or
          not. Re-measured on a real iPhone 13 (664 px viewport) after the
          trim above: 664 − 102 (nav) − 106 (this screen's own header down to
          the box) − 18 (the score-pip row and the container's bottom
          padding below the box, trimmed alongside this) = 438 px is the
          hard ceiling for the box itself to still leave the pip row on
          screen too. 64vh is 425 px — a real ~13 px of slack, not a number
          pinned to the exact edge — up from the original 412 px. An earlier
          pass here read the nav's own height out of the sum by mistake and
          shipped 76vh (505 px), which drove the canvas 46 px past the
          bottom of the viewport; caught by re-measuring in a real browser
          rather than trusting the arithmetic, which is the whole reason this
          file insists on measuring rather than assuming. Re-measure the
          header/footer figures above before raising this further; either
          one growing again eats straight into the 13 px that is left.

          ── The 64vh itself was always right; how it was applied was not ──
          All of the above is still the real derivation of 64vh — that
          number is unchanged. What changed is HOW it caps the box: applying
          it as CSS `max-h-[64vh]` alongside `aspect-[5/8]` measurably shrunk
          the box's WIDTH too, the moment the cap bit — 266px on an iPhone
          13, not the 366px `w-full` gives every other screen in this game.
          See `boxH` above: height is now computed in JS from the box's own
          real measured width, capped at the same `window.innerHeight*0.64`,
          and applied as an explicit style — width stays `w-full`, full
          stop, exactly like the match and training screens. */}
      <div
        ref={wrapRef}
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-white/15"
        style={{ height: boxH ?? "auto", aspectRatio: boxH == null ? "5 / 8" : undefined }}
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
        {/* ── The first attempt only, with the tap as an early out ──
            Built first as "stays until tapped", then looked at and changed:
            "the box should automatically leave after the first attempt imo."
            So the rep gate is back — but the tap is not just cosmetic, and
            the two do different jobs:

              the ATTEMPT ending hides it for this stage
              the TAP hides it for this drill, permanently, on this device

            That distinction is the reason both exist. Somebody meeting the
            drill for the first time gets a whole attempt to read it without
            having to do anything; somebody on their fourth career taps once
            and never sees it again. `teachSeen` is what makes the second one
            stick, and only the button writes it. */}
        {phase === "aim" && (
          (TEACH_PERSISTS || rep === 0) && teach && !teachDone
            ? (
              <TeachCard
                headline={teach.headline}
                lines={teach.lines}
                short={teach.short}
                compact={forceCompactTeach || rep >= TEACH_COMPACT_AFTER_REP}
                onDismiss={dismissTeach}
              />
            )
            : (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
                <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
                  {hint}
                </p>
              </div>
            )
        )}

        {phase === "contact" && aim && (
          // The three contact badges and the line under them: the strike
          // screen's own tutorial copy, which has a prop for exactly this
          // and — checked at every call site — has never once been passed
          // by anybody. Not shown at all to somebody who has already
          // dismissed this drill's teaching, since the contact badges are the
          // same lesson one screen later.
          //
          // Same gate as the aim card it belongs to: one drill's teaching is
          // one thing, and it is the first attempt's. A contact tutorial that
          // outlived the aim card would be a box with no button on it.
          <ContactBall
            power={aim.power}
            onContact={handleContact}
            tutorial={(TEACH_PERSISTS || rep === 0) && !teachDone}
          />
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
      <div className="mt-1 flex items-center gap-1">
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

/**
 * ── HE GUESSES, AND HE ACTUALLY GOES ──
 *
 * The trial penalty was very nearly unmissable, and measuring it turned up
 * something more interesting than "the keeper needs to be better".
 *
 * Conversion of a real trial penalty through the real engine, by how far off
 * centre the ball was aimed (n = 300 a point):
 *
 *   0.0 m  2.7 %      2.0 m  52.3 %      3.0 m  85.7 %
 *   1.0 m 13.0 %      2.5 m  75.0 %      3.3 m  88.0 %   ← the corner
 *
 * And with the stage's own tell in play (n = 400 each): read the lean and
 * shoot the other corner, 99.8 %. Remove the lean entirely, 99.5 %. **The
 * tell was worth 0.3 points.** So the lean ramp was not the lever, and
 * shrinking it would have fixed nothing — worth knowing before touching it.
 *
 * The real cause is geometry. `keeperAttempt` only fires when the ball reaches
 * the keeper's OWN line, which on a penalty is about one substep before the
 * goal line, and until then nothing moves him. So the save collapses into a
 * static test of `|xCross − keeper.x|` against a save radius that measures
 * 2.37 m on a real trial penalty, against a goal half-width of 3.66 m. **A
 * band roughly 1.0-1.3 m inside each post cannot be saved at any keeper
 * strength** — even a 99-rated keeper's radius is 2.65 m, still a metre short
 * of the post. Raising `keeperStrength` genuinely cannot reach it; the same
 * aimed corner converts 64-71 % in a real match's `one_on_one`, against 92 %
 * here.
 *
 * ── The fix, and why it needs nothing from the engine ──
 *
 * A penalty is a guess made before the ball is struck, and the engine already
 * has the machinery for a keeper travelling along his line: `stepKeeper`'s
 * `scrambling` branch moves him toward `targetX` at KEEPER_DIVE_SPEED, bounded
 * to KEEPER_LATERAL_MAX either side of `startX`. Nothing was reaching for it.
 * `scrambling` / `targetX` / `saveDir` / `saveLunge` are all plain public
 * fields on `Scenario.keeper`, and this screen already writes three of them
 * for the lean, so committing him at the moment of the strike is a screen
 * change and nothing else. `pendingDone` stays false, so `stepKeeper` never
 * marks him `done` early and he keeps going for the whole flight.
 *
 * ── Which way he goes is not a new dice roll ──
 *
 * It is `keeperLean`'s own sign, which is already exactly that: `penaltySetup`
 * draws a side, and `penaltyTell` decides how much of it you can SEE. The
 * magnitude was always the ramp (rep 1 committed, rep 2 shading, rep 3+
 * nothing) and the side was always the random part. Reusing the sign as his
 * real guess makes the tell mean what the subtitle has always claimed it
 * means — "he has already guessed" — instead of being decoration. On rep 1
 * you can read him and go the other way; by rep 3 you cannot see it.
 *
 * HOW FAR he goes, and whether he goes at all, is `penaltyCommit`
 * (trialStages.ts) — both numbers measured, including one first attempt that
 * was measurably worse than the bug. Read that note before changing either.
 *
 * ── What this deliberately does NOT do ──
 *
 * Free kicks. `TrialFreeKicks` passes no `onStrike`, because a keeper setting
 * himself against a wall is not guessing a corner blind, and nothing about
 * that case was measured. Penalties only.
 */
export function commitKeeperGuess(sc: Scenario, lean: number, metres: number) {
  const k = sc.keeper;
  // Never override a keeper the engine has already finished with, and never
  // start a scramble for a rep where he is backing himself to react instead.
  if (k.done || !(metres > 0)) return;
  const side = lean >= 0 ? 1 : -1;
  // `stepKeeper` clamps this to its own KEEPER_LATERAL_MAX either side of
  // `startX`, so a distance longer than he can cover is capped by the engine
  // rather than by a copy of its constant living here that could drift.
  k.targetX = k.startX + side * metres;
  k.scrambling = true;
  k.saveDir = side;
  // Anything above 0 starts the dive animation and `stepKeeper` carries it to
  // 1. This is what makes him go WITH the strike rather than 7 ms before the
  // ball crosses the line — the other half of the "he dives late" report, and
  // measured: the dive is 98 % played as the ball crosses, against 12 % before.
  if (k.saveLunge <= 0) k.saveLunge = 0.001;
}

export default function TrialPenalties({
  trial, onDone, skills = { power: 55, technique: 55 },
}: TrialPenaltiesProps) {
  const build = useCallback(
    (rep: number, rng: () => number) => buildPenaltyScenario(trial, rep, rng),
    [trial],
  );
  // He commits the instant it is struck, to the side he was already leaning.
  const onStrike = useCallback(
    (sc: Scenario, rep: number) => {
      const s = penaltySetup(trial, rep);
      commitKeeperGuess(sc, s.keeperLean, s.keeperCommit);
    },
    [trial],
  );

  return (
    <StrikeStage
      reps={REPS.penalties}
      build={build}
      skills={skills}
      seed={trial.seed}
      drill="penalties"
      onStrike={onStrike}
      title="Penalties"
      hint="Drag back from the ball to aim, and pull further for more power."
      teach={{
        headline: "Drag back from the ball, then let go.",
        short: "Drag back, then let go.",
        lines: [
          "Pull further for more power. The arrow is where it is going.",
          "Watch the keeper before you strike it — he has already guessed.",
        ],
      }}
      subtitle={rep => {
        const s = penaltySetup(trial, rep);
        // ── It never names the side ──
        //
        // It used to: "He has gone early to your right." Between that line and
        // a keeper drawn visibly off centre, the stage was not a penalty at
        // all — it was a caption telling you which way to shoot, five times in
        // a row. And because the lean GREW with difficulty, the harder the day
        // the louder the caption; a hard trial was the easy one.
        //
        // What is left says how much there is to SEE, never what it is. That
        // is real information a taker has — you can tell a keeper who has
        // committed from one who has not — and it tells you which skill this
        // kick is asking for, without answering it for you. The lean itself
        // now shrinks as the trial hardens (PENALTY_TELL_EASY/HARD,
        // trialStages.ts), so at the top of the ladder there genuinely is
        // almost nothing to read and this line says so.
        // ── …and it no longer claims something it cannot know ──
        //
        // It used to read "He's committed early." That is a promise about
        // what he is ABOUT to do, and the line had no access to it: whether
        // he actually sets off is `penaltyCommit`, a completely separate
        // seeded draw from the lean, which comes back 0 — he holds his
        // ground and does not move a millimetre — on 35 % of reps at the
        // easy end of the ladder and 5 % at the hard end. So roughly one
        // opening penalty in three told you he had committed and then showed
        // you a statue, which is a large part of "the keeper is a bit buggy".
        //
        // What this line CAN see is where he is standing, which is real
        // information a taker has and is all the lean ever was. It now says
        // that and nothing more. Deliberately not fixed by leaking
        // `keeperCommit` into the wording — that would hand over the one
        // thing the stage is asking you to risk being wrong about.
        const tell = Math.abs(s.keeperLean);
        return tell > 0.55 ? "He's set himself well to one side."
          : tell > 0.22 ? "He's shading one way. Look hard."
          : "He hasn't shown you a thing.";
      }}
      onDone={onDone}
    />
  );
}
