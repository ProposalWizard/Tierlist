import { CX, POST_L, POST_R, GOAL_W } from "./pitch";

/**
 * TRAINING, AS A LADDER RATHER THAN A TOY.
 *
 * Reported directly: the training minigames were "extremely basic", they
 * "look terrible", and — the part that actually mattered — "the games are
 * unrelated to the abilities so much". They were: three of the five were the
 * same stop-the-sweeping-bar game wearing different overlays, Pace was a
 * reaction-time tap that had nothing to do with running fast, and NONE of
 * them ever read the player's actual stat. A pace-5 player and a pace-95
 * player were handed the identical drill at the identical difficulty, for
 * ever.
 *
 * The brief for the rebuild came with its own worked examples, from New Star
 * Soccer: a passing drill where "you have to kick the ball in between two
 * cones" and "every level up he went, the cones would be further back, and
 * maybe they'd also be further to the side… you had to curl the ball a bit";
 * and a power drill that "starts off very close in the early sessions, and
 * then slowly you move back on the pitch… keeps adding players in the way.
 * Maybe there's a player on the goal line as well to block the ball." Both
 * are the same idea: THE DRILL IS CALIBRATED TO THE STAT IT TRAINS, and it
 * gets harder as that stat climbs, so "if you're about to get to level one
 * hundred of your ability, it would be very difficult to complete".
 *
 * This file is that calibration, and only that: pure functions from a skill
 * value (0-100, the same number the player sees on the Training screen) to
 * the geometry of the session. No React, no canvas, no input — same split
 * `dribble.ts` and `firstPersonDribble.ts` already use, and for the same
 * reason: the difficulty curve is the part that has to be provably
 * monotonic, provably beatable at the bottom and provably brutal at the top,
 * and none of that needs a browser to check (see tests/star/trainingDrills.mts).
 *
 * ── The one design rule everything here follows ──
 *
 * Difficulty scales with the stat; EXECUTION still runs through the real
 * match engine with the player's real skills. That pairing is deliberate and
 * it is what makes the ladder honest rather than arbitrary. When the power
 * drill moves you back to thirty metres it is not decorating the screen: the
 * shot genuinely has to travel thirty metres, and `launch()` genuinely gates
 * how hard you can hit it on your real power stat. So a session at the top
 * of the ladder is hard for exactly the reason it should be — you are being
 * asked for more than you currently have — and training is what buys it.
 */

export type DrillKind = "pace" | "power" | "technique" | "vision" | "freeKick";

/** 0-1, how far up the ladder a given stat value sits. */
export function ladder(level: number): number {
  return Math.max(0, Math.min(100, level)) / 100;
}

/** Linear interpolation across the ladder — the shape almost every curve
 *  below wants, written once so a curve is a pair of endpoints rather than
 *  arithmetic to re-read. */
function ramp(level: number, atZero: number, atHundred: number): number {
  return atZero + (atHundred - atZero) * ladder(level);
}

// ── Power: the shooting ladder ──────────────────────────────────────────────

export interface PowerDrillConfig {
  /** Metres from the goal line the ball is placed. */
  distance: number;
  /** How far off-centre, metres (alternates side per rep). */
  offset: number;
  /** Outfield men standing between you and the goal. */
  blockers: number;
  /** 0-100, fed straight to buildScenario/keeperTierFor. */
  keeperStrength: number;
}

/**
 * "You start off very close in the early sessions, and then slowly you move
 * back on the pitch. It starts placing players in front of you… maybe
 * there's a player on the goal line as well."
 *
 * Ten metres (inside the box, a tap-in) up to thirty-four (the edge of the
 * centre circle — a genuine long-range effort). The blockers arrive in ones
 * rather than all at once, and the keeper improves the whole way up, so the
 * same shot that was a goal at level 20 is a comfortable save at level 80.
 */
export function powerDrill(level: number, rep: number): PowerDrillConfig {
  const l = ladder(level);
  return {
    distance: ramp(level, 10, 34) + rep * 1.2,
    // Alternating sides, widening with the ladder — a straight-on shot from
    // thirty metres is one problem; the same distance from the half-space is
    // a harder one, and it stops four reps in a row being one memorised shot.
    offset: (rep % 2 === 0 ? -1 : 1) * ramp(level, 0, 7) * (0.6 + (rep % 3) * 0.2),
    blockers: l < 0.25 ? 0 : l < 0.5 ? 1 : l < 0.7 ? 2 : l < 0.85 ? 3 : 4,
    keeperStrength: ramp(level, 38, 93),
  };
}

// ── Technique: the cone gate ────────────────────────────────────────────────

export interface TechniqueDrillConfig {
  /** Metres from the ball to the gate, along the run of play. */
  gateDistance: number;
  /** The gap between the two cones, metres. */
  gateWidth: number;
  /** How far the gate sits off the ball's own line, metres — this is what
   *  eventually forces a curled ball rather than a straight one. */
  gateOffset: number;
  /** Above this height (metres) at the gate, the ball has gone OVER the cones
   *  rather than through them — you cannot chip the problem away. */
  maxHeight: number;
}

/**
 * "You have to kick the ball in between two cones. And every level up, the
 * cones would be further back, and maybe they'd also be further to the side.
 * Maybe they'd be placed in a way that you had to curl the ball a bit."
 *
 * All three of those, on one ladder: twelve metres out through a five-metre
 * gate dead ahead (hard to miss) up to thirty-two metres out through a
 * gap barely wider than two ball-widths, pushed nine metres off your own
 * line — at which point the only ball that gets through it is a bent one,
 * and `curlRange(technique)` in the real engine decides how much bend you
 * actually have. The height ceiling exists so the answer to a narrowing gate
 * is never "hit it over the top".
 */
export function techniqueDrill(level: number, rep: number): TechniqueDrillConfig {
  return {
    gateDistance: ramp(level, 12, 32) + rep * 0.8,
    gateWidth: Math.max(1.6, ramp(level, 5.0, 1.9) - rep * 0.12),
    // The per-rep variation swings the gate to alternating sides and varies
    // how far, so four reps are four different balls rather than one shot
    // memorised — but the multiplier floor is high enough that at the TOP of
    // the ladder even the mildest rep is well off your own line. A rep that
    // let you pass it straight would be a hole in the ladder.
    gateOffset: (rep % 2 === 0 ? 1 : -1) * ramp(level, 0, 9) * (0.75 + (rep % 3) * 0.2),
    maxHeight: 1.6,
  };
}

// ── Free kick: the wall ─────────────────────────────────────────────────────

export interface FreeKickDrillConfig {
  /** Metres from the goal line. */
  distance: number;
  /** Metres off-centre — a wide free kick is a different problem. */
  offset: number;
  /** Men in the wall. */
  wall: number;
  keeperStrength: number;
}

/**
 * The set piece, on the same ladder: from a straight sixteen metres with a
 * token two-man wall, out to thirty metres from a wide angle with five men
 * in front of you and a keeper who saves nearly everything he reaches. The
 * wall is the reason a free kick is not just a long shot — it has to be bent
 * round it or lifted over it, and the engine already jumps a wall as the
 * ball is struck (Defender.z/vz), so "over" is a moving target.
 */
export function freeKickDrill(level: number, rep: number): FreeKickDrillConfig {
  return {
    distance: ramp(level, 16, 30) + rep * 0.9,
    offset: (rep % 2 === 0 ? -1 : 1) * ramp(level, 1.5, 14) * (0.5 + (rep % 3) * 0.25),
    wall: Math.round(ramp(level, 2, 5)),
    keeperStrength: ramp(level, 45, 95),
  };
}

// ── Pace: the gauntlet ──────────────────────────────────────────────────────

export interface PaceDrillConfig {
  /** How many men are between you and the line. */
  chasers: number;
  /** 0-100, how quick they are — fed to newDribble. */
  oppStrength: number;
}

/**
 * The one drill that needed no new mechanic at all, only pointing at the
 * right one: `dribble.ts` is already a run through men who wake as you come
 * near, it is already what the real match uses, and `dribbleSpeed(pace)` in
 * it already means YOUR PACE STAT IS YOUR RUNNING SPEED. The old Pace drill
 * was a traffic-light reaction tap that read none of that.
 *
 * Two defenders at walking pace at the bottom of the ladder; six quick ones
 * at the top, which is a genuinely hard run even with the speed a pace-95
 * player is bringing to it.
 */
export function paceDrill(level: number, rep: number): PaceDrillConfig {
  return {
    chasers: Math.round(ramp(level, 2, 6)) + (rep >= 2 ? 1 : 0),
    oppStrength: ramp(level, 35, 95),
  };
}

// ── Vision: reading the run ─────────────────────────────────────────────────

export interface VisionDrillConfig {
  /** How many team-mates are on offer. */
  options: number;
  /** Seconds before the chance is gone. */
  window: number;
  /**
   * How much clearer the best option is than the next best, in metres of
   * space. Big at the bottom (one man is obviously free), nearly nothing at
   * the top (you are picking between two similar balls under time pressure).
   */
  margin: number;
}

/**
 * Vision is the one stat with no ball-striking in it at all, so it keeps a
 * perception mechanic rather than borrowing one — but as an actual football
 * picture (team-mates, markers, an offside line) instead of coloured dots,
 * and with the thing that makes it a VISION test rather than a memory test:
 * at the top of the ladder the right pass is only marginally better than the
 * wrong one, and you have under a second to see which.
 */
export function visionDrill(level: number, rep: number): VisionDrillConfig {
  return {
    options: Math.round(ramp(level, 3, 8)) + (rep >= 3 ? 1 : 0),
    window: Math.max(0.85, ramp(level, 2.6, 0.95) - rep * 0.06),
    margin: Math.max(0.6, ramp(level, 7, 1.1)),
  };
}

// ── Where the ball goes, and where the gate stands ──────────────────────────

/**
 * The ball's own spot for a striking drill, in real pitch metres — clamped
 * so a wide angle at the top of the ladder still leaves the ball on the
 * actual pitch rather than in the stand.
 */
export function strikeSpot(distance: number, offset: number): { x: number; y: number } {
  return {
    x: Math.max(3, Math.min(65, CX + offset)),
    y: Math.max(6, distance),
  };
}

/**
 * The two cones, from a gate config and the ball's own spot. The gate sits
 * `gateDistance` nearer the goal than the ball and `gateOffset` across from
 * it, and the pair are returned already ordered left-to-right so a crossing
 * test is a simple between-these-two-x check.
 */
export function conePositions(
  ball: { x: number; y: number },
  cfg: TechniqueDrillConfig,
): { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } } {
  const centre = {
    x: Math.max(4, Math.min(64, ball.x + cfg.gateOffset)),
    y: Math.max(2, ball.y - cfg.gateDistance),
  };
  return {
    left: { x: centre.x - cfg.gateWidth / 2, y: centre.y },
    right: { x: centre.x + cfg.gateWidth / 2, y: centre.y },
    centre,
  };
}

/**
 * Did the ball actually go through the gate?
 *
 * Takes the two consecutive ball samples that straddle the gate's own line
 * and interpolates the crossing, so a fast shot that skips past the gate
 * between two frames is still judged on where it really crossed rather than
 * on whichever side of the line it happened to be sampled. Height is checked
 * at the same interpolated instant, so lofting it over the cones fails on
 * the same test rather than needing its own.
 *
 * Returns null when these two samples do not straddle the gate at all.
 */
export function gateCrossing(
  prev: { x: number; y: number; z: number },
  now: { x: number; y: number; z: number },
  gateY: number,
): { x: number; z: number } | null {
  // Moving toward the goal means y decreasing; the gate is crossed when the
  // samples sit either side of gateY.
  if (prev.y === now.y) return null;
  if ((prev.y - gateY) * (now.y - gateY) > 0) return null;
  const f = (prev.y - gateY) / (prev.y - now.y);
  if (f < 0 || f > 1) return null;
  return {
    x: prev.x + (now.x - prev.x) * f,
    z: prev.z + (now.z - prev.z) * f,
  };
}

/**
 * Score one gate attempt, 0-1.
 *
 * Dead centre is a 1; clipping a cone is close to zero rather than exactly
 * zero, because a ball that shaved the cone was a far better attempt than
 * one that missed the gate by ten metres, and a drill that scores those two
 * the same teaches nothing.
 */
export function gateQuality(
  crossing: { x: number; z: number } | null,
  cfg: TechniqueDrillConfig,
  centreX: number,
): number {
  if (!crossing) return 0;
  if (crossing.z > cfg.maxHeight) return 0;
  const off = Math.abs(crossing.x - centreX);
  const half = cfg.gateWidth / 2;
  if (off > half) {
    // Outside the cones — a sliver of credit for being close, nothing beyond
    // a gate's width out.
    return Math.max(0, 0.18 * (1 - (off - half) / Math.max(1, cfg.gateWidth)));
  }
  return Math.max(0.25, 1 - (off / half) * 0.75);
}

/**
 * Score one shooting attempt, 0-1, from the engine's own Outcome plus where
 * it crossed the line.
 *
 * A goal is never less than 0.55 however scruffy, because the drill asked
 * for a goal and it got one; placement takes it the rest of the way, with
 * the corners worth the most. Everything that stays out is graded on how
 * close it came rather than lumped into a single zero — the difference
 * between forcing a save and ballooning it over is exactly what the session
 * is measuring.
 */
export function shotQuality(outcome: string, crossX: number | null): number {
  if (outcome === "goal" || outcome === "rebound") {
    if (crossX === null) return 0.7;
    // How far toward a post, 0 (dead centre) → 1 (right against one).
    const fromCentre = Math.abs(crossX - CX) / (GOAL_W / 2);
    return Math.max(0.55, Math.min(1, 0.55 + fromCentre * 0.45));
  }
  if (outcome === "saved" || outcome === "tipped") return 0.34;
  if (outcome === "caught") return 0.24;
  if (outcome === "post") return 0.42;
  if (outcome === "blocked") return 0.16;
  if (outcome === "wide" || outcome === "over") {
    if (crossX === null) return 0.08;
    const miss = crossX < POST_L ? POST_L - crossX : crossX > POST_R ? crossX - POST_R : 0;
    return Math.max(0.04, 0.2 * Math.max(0, 1 - miss / 4));
  }
  return 0.05;
}
