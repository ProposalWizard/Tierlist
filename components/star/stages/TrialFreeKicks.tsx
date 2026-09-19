"use client";
import { useCallback } from "react";
import {
  buildScenario, initDefenders, clamp, VIEW_ASPECT,
  type Scenario, type Viewport,
} from "@/lib/star/canvasEngine";
import { CX, POST_L, POST_R, NET_DEPTH, PITCH_W, HALF_LEN } from "@/lib/star/pitch";
import { REPS, freeKickSetup, type FreeKickSetup } from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import { StrikeStage } from "./TrialPenalties";

/**
 * THE FREE KICKS STAGE.
 *
 * The same screen as the penalties — drag, pick your contact, watch it — with
 * a genuinely different problem in front of it: the ball is somewhere between
 * sixteen and thirty-odd metres out, often from an angle, and there are two
 * to five men standing 9.15 m in front of it who jump as you strike it. Bend
 * it round them or lift it over.
 *
 * ── How the picture is made ──
 *
 * `freeKickSetup` decides distance, offset, wall size and keeper, and the
 * engine already knows how to build a free kick. So this takes the engine's
 * own `free_kick` scenario for everything structural (the keeper on his line,
 * the follower, the receiver, the fields `stepBall` expects to exist) and
 * then overrides the four things the drill owns: where the ball is, who is in
 * the wall, how good the keeper is, and what the camera shows.
 *
 * The overrides have to be applied in that order — the wall is replaced
 * BEFORE `initDefenders`, because that is what gives each man his `hold` role
 * and the `containT` the jump is timed off. A wall built afterwards would
 * stand there and never leave the ground.
 */

/** Metres of room left behind the ball for the drag to pull back into. */
const BEHIND_BALL = 7;
/** Metres either side of the goal mouth and the ball that must stay visible. */
const SIDE_PAD = 2.5;
/**
 * The frame height the engine holds every ordinary situation at (VIEW_H in
 * canvasEngine.ts — not exported, so it is named here and kept in step by
 * hand; it is the one number this file duplicates).
 */
const BASE_VIEW_H = 42;

/**
 * The camera for a free kick from a given spot.
 *
 * ── Why this is not the engine's own framing ──
 *
 * `buildScenario` frames a free kick for the ball IT chose, so the moment the
 * ball is moved to the drill's own spot the frame is pointing at the wrong
 * place. The engine's answer to a situation that does not fit is `fitToView`:
 * hold the zoom fixed and pull everything inside the rectangle instead —
 * right for a match, where a tactics board that zoomed chance to chance would
 * read as the camera being erratic, and wrong here, because the ladder's
 * whole point is that a thirty-metre free kick is further away than a
 * sixteen-metre one. Pulling the ball in would draw them identically.
 *
 * So the frame grows when it has to. In practice it barely does: at the top
 * of the ladder the tallest frame this produces is about 43 m against the
 * engine's own 42, so a free kick still looks like the same camera as every
 * other situation in the game rather than a zoomed-out one.
 */
export function freeKickView(ball: { x: number; y: number }): Viewport {
  const back = NET_DEPTH + 2.5;              // room behind the goal line
  const needH = ball.y + BEHIND_BALL + back; // goal at the top, drag room past the ball
  // Across: the goal mouth AND the ball, both with a margin.
  const nx1 = Math.min(POST_L, ball.x) - SIDE_PAD;
  const nx2 = Math.max(POST_R, ball.x) + SIDE_PAD;
  const h = Math.max(BASE_VIEW_H, needH, (nx2 - nx1) / VIEW_ASPECT);
  const w = h * VIEW_ASPECT;

  // Centre on what has to be seen, then slide (never squash) the frame so it
  // still holds both the goal mouth and the ball after the pitch-edge clamp.
  let cx = (nx1 + nx2) / 2;
  cx = clamp(cx, -5 + w / 2, PITCH_W + 5 - w / 2);
  cx = clamp(cx, nx2 - w / 2, nx1 + w / 2);
  return { x1: cx - w / 2, x2: cx + w / 2, y1: -back, y2: -back + h };
}

/**
 * The wall: `setup.wall` men shoulder to shoulder across the shot line, the
 * regulation 9.15 m from the ball. The same construction `buildFreeKick`
 * uses, rebuilt here because the ball has moved and a wall in front of the
 * engine's own ball would be standing in an empty part of the pitch.
 */
export function freeKickWall(setup: FreeKickSetup): { x: number; y: number }[] {
  const dx = CX - setup.ball.x, dy = -setup.ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const to = { x: dx / len, y: dy / len };
  const across = { x: -to.y, y: to.x };
  const wallCx = setup.ball.x + to.x * 9.15;
  const wallCy = setup.ball.y + to.y * 9.15;
  const n = Math.max(1, Math.round(setup.wall));
  const men: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 1.15;
    men.push({
      x: clamp(wallCx + across.x * off, 4, PITCH_W - 4),
      y: clamp(wallCy + across.y * off, 2, HALF_LEN),
    });
  }
  return men;
}

/**
 * One rep's scenario, exported so it can be driven through the real engine in
 * a test rather than being re-derived there — a copy of these six lines in
 * `tests/star/trialStageScreens.mts` would pass happily while the component
 * itself was wrong, which is exactly the trap this codebase has been caught
 * by before (a castDefence test whose fixture encoded the bug).
 */
export function buildFreeKickScenario(
  trial: TrialProgress, rep: number, rng: () => number,
): Scenario {
  const setup = freeKickSetup(trial, rep);
  const sc = buildScenario("free_kick", rng, setup.keeperStrength, 60, 55);

  sc.ball = { ...setup.ball };
  // Standing over it, a stride behind — the same relationship
  // `buildFreeKick` gives the taker, kept so the drag has something to pull
  // back past.
  sc.player = { x: setup.ball.x, y: setup.ball.y + 2 };
  // Replacing the array rather than adding to it: `addCover` has already put
  // a couple of loose defenders somewhere in the engine's own picture, and a
  // drill's wall is the only thing that should be in the way.
  sc.defenders = freeKickWall(setup);
  sc.keeperStrength = setup.keeperStrength;
  // After the defenders, never before — see the note at the top of the file.
  initDefenders(sc, rng);
  sc.viewport = freeKickView(setup.ball);
  return sc;
}

export interface TrialFreeKicksProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
}

export default function TrialFreeKicks({
  trial, onDone, skills = { power: 55, technique: 55 },
}: TrialFreeKicksProps) {
  const build = useCallback(
    (rep: number, rng: () => number) => buildFreeKickScenario(trial, rep, rng),
    [trial],
  );

  return (
    <StrikeStage
      reps={REPS.freeKicks}
      build={build}
      skills={skills}
      seed={(trial.seed ^ 0x5f5e) >>> 0}
      title="Free kicks"
      hint="Bend it round the wall or lift it over — sides of the ball curl it, the bottom lifts it."
      teach={{
        headline: "There is no through the wall.",
        lines: [
          "Drag back to aim, pull further for power — same as the penalties.",
          "Then strike the SIDE of the ball to bend it round them, or the bottom to lift it over.",
        ],
      }}
      subtitle={rep => {
        const s = freeKickSetup(trial, rep);
        const men = Math.max(1, Math.round(s.wall));
        return `${Math.round(s.distance)} m out · ${men} in the wall`;
      }}
      onDone={onDone}
    />
  );
}
