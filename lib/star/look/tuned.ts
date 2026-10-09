/**
 * LOOK H's TUNED DIALS — written by the look-tuner (scripts/look-tuner/tune.mjs), not by hand.
 * One block per time of day; a missing dial stays at its base (lib/star/look/params.ts).
 */
import type { LookParams } from "./params";

// 9 Oct 2026 (Harry: "golden hour/mix quality everywhere"): day and night set to golden hour's QUALITY by eye
// and by a quality score against the golden-hour still (grass texture, contrast, shadow depth; not its colour).
// Day lost its S-curve (contrast 0.9 x 1.08 < 1 switches it off), most of its sun shadow (shade 0.36) and its
// blade texture to the old tuner; night's grey wash came from its LUT's flat mids (tools/look/derive_lut.py).
export const TUNED: Partial<Record<"day" | "golden" | "night", Partial<LookParams>>> = {
  night: {exposure: 0.95, sat: 1.35, vignette: 1.6, shade: 0.2, bounce: 1.6, bloom: 0.5, blades: 2.4, sharpen: 2.2},
  day: {exposure: 0.8, contrast: 1.02, sat: 1.22, bloom: 1.2, hemi: 0.2, blades: 2.0, sharpen: 1.7},
};
