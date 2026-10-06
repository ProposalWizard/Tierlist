/**
 * THE KEEPER'S DRAWN SAVE SHAPES — moved out of CanvasMatch's keeper drawing
 * (unchanged numbers) so the animation test page (/star-animations-dev) draws
 * the same keeper the match does instead of a guessed copy.
 *
 * Purely the artwork: nothing in the engine reads any of this.
 */
import { MAX_KEEPER_LEAN } from "./fiveASide/render";

/**
 * Which save is being played (Keeper.saveKind). Set by the engine only after
 * the outcome was decided, so the pose always matches what actually happened.
 * lean   : how far the body pitches over
 * armUp  : -1 arms driven down, +1 thrown up
 * spread : how wide the arms go
 * reachK : how far the leading glove extends
 * crouch : vertical drop of the whole body
 */
export const KEEPER_SAVE_KIND = {
  catch:     { lean: 0.15, armUp:  0.25, spread: 0.45, reachK: 0.55, crouch: 0.10 },
  central:   { lean: 0.05, armUp: -0.10, spread: 1.05, reachK: 0.80, crouch: 0.22 },
  low:       { lean: 1.15, armUp: -0.85, spread: 0.95, reachK: 1.35, crouch: 0.30 },
  high:      { lean: 0.55, armUp:  1.00, spread: 0.80, reachK: 1.30, crouch: -0.35 },
  fingertip: { lean: 1.30, armUp:  0.35, spread: 0.70, reachK: 1.70, crouch: 0.05 },
} as const;

export type KeeperSaveKind = keyof typeof KEEPER_SAVE_KIND;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * His lean and arms for a dive, before any animation on top. `diveN` is how
 * far he is committed (0-1+), `lunge` the save lunge (0-1), `sign` which way.
 * armSpread is NOT yet clamped: the caller adds the animation's spread first.
 */
export function keeperBasePose(kind: KeeperSaveKind | null, lunge: number, diveN: number, sign: number) {
  const K = kind ? KEEPER_SAVE_KIND[kind] : null;
  const spread = K ? K.spread : 1;
  const armUp = K ? K.armUp : 0;
  return {
    leanRaw: clamp(sign * diveN * (K ? K.lean : 0.9), -MAX_KEEPER_LEAN, MAX_KEEPER_LEAN),
    armSpread: 0.45 + spread * 0.35 + diveN * 0.4,
    armLift: 0.15 + armUp * diveN * 0.85 + lunge * 0.5,
  };
}
