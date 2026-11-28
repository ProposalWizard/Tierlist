/**
 * THE BODY FOLLOWS THE GYM (Harry, 28 Nov 2026: "it should also coincide with strength stats or physical stats
 * … if it's just a look it could just be based on how much you're working out"). Pure.
 *
 * The shape reads the gym's OWN points (progress.ts bodyPoints: Strength and Cardio as they stood a window
 * ago), so how he looks and what the gym says always agree, and a missed week never flickers his look.
 *   - Strength broadens him: across the shoulders, chest and arms up to +4.5% at the top (Strength 300 points,
 *     level 4), front to back up to +3%.
 *   - Cardio leans him out: up to -1.5% across and -2.5% front to back.
 *   - HEIGHT NEVER CHANGES (RUL-3D-006): the "up" scale is always exactly 1.
 * It rides on the body system's own build scale (style3d/toon/bodies.ts TOON_BUILD_SCALE, applied on the
 * person's inner group in people3d.ts), multiplied in: the skeleton, the clips, the cloth clothes (skinned to
 * the same bones) and the hands all scale together, so nothing is re-fitted. On the test page only for now,
 * behind GYM_CAREER_EFFECT for the career. Test: tests/star/gym.mts (bounds).
 */
import { MAX_POINTS } from "./progress";

export const BODY_MAX = { across: 0.045, front: 0.03, leanAcross: 0.015, leanFront: 0.025 } as const;

/** [across, up, front-to-back] to multiply into the build's scale. */
export function gymBodyScale(p: { strength: number; cardio: number }): [number, number, number] {
  const s = Math.max(0, Math.min(1, p.strength / MAX_POINTS)), c = Math.max(0, Math.min(1, p.cardio / MAX_POINTS));
  return [
    +(1 + BODY_MAX.across * s - BODY_MAX.leanAcross * c).toFixed(4),
    1,
    +(1 + BODY_MAX.front * s - BODY_MAX.leanFront * c).toFixed(4),
  ];
}

/** The test page's slider: a level 1..4 of both as points (level 1 = 0, level 4 = the top). */
export const pointsForLevel = (level: number) => Math.max(0, Math.min(MAX_POINTS, (level - 1) * 100));
