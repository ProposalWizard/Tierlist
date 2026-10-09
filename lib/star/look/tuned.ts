/**
 * LOOK H's TUNED DIALS — written by the look-tuner (scripts/look-tuner/tune.mjs), not by hand.
 * One block per time of day; a missing dial stays at its base (lib/star/look/params.ts).
 */
import type { LookParams } from "./params";

export const TUNED: Partial<Record<"day" | "golden" | "night", Partial<LookParams>>> = {
  // night: set by eye, not tuned (no night benchmark): the day's blade/rim/sharpen strengths washed the
  // floodlit grass grey (9 Oct still), so they are held lower here
  night: {blades: 1.3, stripes: 1.2, sharpen: 1.1, rim: 1.4},
  day: {exposure: 0.748, contrast: 0.9, sat: 1.198, bloom: 2.125, hemi: 0, lut: 0.82, shade: 0.36, bounce: 2.46, sharpen: 0.95, stripes: 1},
};
