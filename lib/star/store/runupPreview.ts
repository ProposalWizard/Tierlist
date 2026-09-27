/**
 * THE LITTLE LOOPING PREVIEW ON EACH ANIMATION CARD — where the figure is at
 * each moment of one run-up.
 *
 * TODO wire preview to lib/star/runupStyles.ts — this is a stand-in drawing
 * for the store's test area only, a side-on sketch of each style so the cards
 * are not blank. When the animations build lands, the card should play the
 * real run-up instead.
 *
 * Pure: `runupPose(style, t)` for t in [0, 1) gives the figure's position,
 * how far into its stride it is and whether it is striking. The page samples
 * it into CSS keyframes (no canvas, no animation loop of its own).
 *
 * Coordinates: a 120 × 80 picture, ball on the grass at x = BALL_X. `depth`
 * 0 is the near side of the grass, 1 the far side (drawn higher and smaller)
 * — the curved and diagonal runs use it. Free-kick styles (`fk_…`) stand a
 * wall between the ball and the goal (WALL_X) and lift the ball over it.
 */
import type { AnimationId } from "./catalogue";

export const BALL_X = 84;
/** Where a free kick's wall stands. */
export const WALL_X = 95;
/** Where the kicker's body stands at the moment of the strike. */
export const STRIKE_X = BALL_X - 12;
/** Of the loop: when the foot meets the ball. Same for every style so the
 *  cards stay in step with each other on the page. */
export const KICK_T = 0.6;
/** How long the strike pose is held. */
export const KICK_HOLD = 0.08;
/** Seconds for one loop. */
export const LOOP_SECONDS = 2.8;

export interface RunupPose {
  x: number;
  /** 0 near … 1 far. */
  depth: number;
  /** Radians of stride phase — legs swing as sin(phase). */
  phase: number;
  /** How wide the legs swing, 0-1. */
  stride: number;
  /** Pixels off the grass (The Skip's hop). */
  hop: number;
  /** 0-1: the kicking leg thrown through the ball. */
  kick: number;
  /** Where the ball is and how high. */
  ballX: number;
  ballUp: number;
  /** Fades the whole picture out and back in at the end of the loop. */
  opacity: number;
}

interface Style {
  startX: number;
  /** When the run-up starts, as a share of the time before the kick. */
  begin: number;
  /** Stride cycles over the run-up. */
  cycles: number;
  stride: number;
  /** How hard the ball goes (how far it travels after the kick). */
  power: number;
  /** Progress along the run as time goes on (0-1 → 0-1). */
  ease: (u: number) => number;
  /** A pause in the run: [from, to] as shares of the run's time. */
  pause?: [number, number];
  hop?: boolean;
  arc?: boolean;
  /** A free kick: a wall is drawn, and the ball is lifted over it. */
  wall?: boolean;
  /** How high the ball climbs (1 = a penalty's low drive). */
  loft?: number;
  /** A knuckleball wobbles side to side in flight rather than curling. */
  knuckle?: boolean;
}

const linear = (u: number) => u;
const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

export const RUNUP_PREVIEW: Record<AnimationId, Style> = {
  standard: { startX: 34, begin: 0.1, cycles: 3.5, stride: 0.7, power: 1, ease: linear },
  stroll: { startX: 46, begin: 0.05, cycles: 2.5, stride: 0.35, power: 0.8, ease: easeOut },
  skip: { startX: 36, begin: 0.12, cycles: 3, stride: 0.65, power: 1, ease: linear, hop: true },
  sprint: { startX: 4, begin: 0.05, cycles: 6, stride: 1, power: 1.6, ease: easeIn },
  stutter: { startX: 36, begin: 0.05, cycles: 3, stride: 0.6, power: 1, ease: linear, pause: [0.55, 0.85] },
  two_step: { startX: 62, begin: 0.55, cycles: 1, stride: 0.75, power: 1, ease: linear },
  arc: { startX: 30, begin: 0.08, cycles: 4, stride: 0.7, power: 1.2, ease: linear, arc: true },

  // Free kicks — a wall between ball and goal, the ball lifted over it.
  fk_standard: { startX: 58, begin: 0.2, cycles: 2, stride: 0.6, power: 1, ease: linear, wall: true, loft: 2 },
  // Stands in the stance for most of the loop, then a few big strides.
  fk_power_stance: { startX: 56, begin: 0.55, cycles: 1.5, stride: 0.9, power: 1.6, ease: easeIn, wall: true, loft: 1.8, knuckle: true },
  fk_bale: { startX: 46, begin: 0.35, cycles: 2.5, stride: 0.9, power: 1.5, ease: easeIn, wall: true, loft: 1.8, knuckle: true },
  fk_messi: { startX: 66, begin: 0.45, cycles: 1.2, stride: 0.4, power: 0.9, ease: easeOut, wall: true, loft: 2.6 },
  fk_neymar: { startX: 58, begin: 0.15, cycles: 2, stride: 0.55, power: 1, ease: linear, pause: [0.4, 0.7], wall: true, loft: 2.3 },
  fk_maddison: { startX: 50, begin: 0.2, cycles: 2.5, stride: 0.65, power: 1.1, ease: linear, arc: true, wall: true, loft: 2.2 },
  fk_trent: { startX: 22, begin: 0.05, cycles: 4, stride: 0.7, power: 1.2, ease: linear, arc: true, wall: true, loft: 2.4 },
};

/** Does this style's preview stand a wall in front of the ball? */
export function hasWall(style: AnimationId): boolean {
  return !!RUNUP_PREVIEW[style]?.wall;
}

export function runupPose(style: AnimationId, tRaw: number): RunupPose {
  const s = RUNUP_PREVIEW[style] ?? RUNUP_PREVIEW.standard;
  const t = ((tRaw % 1) + 1) % 1;

  // ── The run itself: [begin·KICK_T, KICK_T) ──
  const runFrom = s.begin * KICK_T;
  let u = t <= runFrom ? 0 : t >= KICK_T ? 1 : (t - runFrom) / (KICK_T - runFrom);

  // A pause stops the body and the legs; the rest of the run is squeezed
  // either side of it so the kick still lands at KICK_T.
  let moving = t > runFrom && t < KICK_T;
  if (s.pause && u > 0 && u < 1) {
    const [a, b] = s.pause;
    if (u >= a && u <= b) { u = a / (1 - (b - a)); moving = false; }
    else if (u > b) u = (u - (b - a)) / (1 - (b - a));
    else u = u / (1 - (b - a));
  }

  const along = s.ease(Math.max(0, Math.min(1, u)));
  const x = s.startX + (STRIKE_X - s.startX) * along;
  // The Arc comes in from the far side and curls round onto the ball.
  const depth = s.arc ? Math.sin((1 - along) * (Math.PI / 2)) * 0.9 : 0;
  const phase = along * s.cycles * Math.PI * 2;
  const hop = s.hop && u > 0.72 && u < 1 ? Math.sin(((u - 0.72) / 0.28) * Math.PI) * 7 : 0;

  // ── The strike and the ball ──
  const since = t - KICK_T;
  const kick = since >= 0 && since < KICK_HOLD ? 1 : since >= KICK_HOLD && since < KICK_HOLD * 2.5 ? 1 - (since - KICK_HOLD) / (KICK_HOLD * 1.5) : 0;
  const flight = Math.max(0, since);
  const loft = s.loft ?? 1;
  const ballX = BALL_X + flight * 110 * s.power + (s.knuckle && flight > 0 ? Math.sin(flight * 70) * 1.2 : 0);
  const ballUp = flight > 0 ? Math.min(18 * loft, flight * 70 * s.power * loft) - flight * flight * 40 : 0;

  const opacity = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.08) : t < 0.04 ? t / 0.04 : 1;

  return {
    x, depth, phase, stride: moving ? s.stride : 0, hop, kick,
    ballX, ballUp: Math.max(0, ballUp), opacity,
  };
}
