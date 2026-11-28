/**
 * THE GARDEN'S DRAW BUDGET (28 Nov 2026, Mikey's Galaxy S20 lagging in the garden; Harry: "everything
 * including 3D has to run as smoothly as possible in every scenario"). A frame of the garden on
 * Medium (every phone's start) may cost at most this many draw calls and triangles, wherever you
 * stand. The numbers below were measured with scripts/perf3d (the real scene, a 412×915 phone screen
 * at 2.625 pixels per point, an S20 browser name), standing still and walking; tests/star/gardenPlants.mts
 * checks them against the budget. Re-measure after a garden change:
 *   node scripts/perf3d/build.mjs && node scripts/perf3d/serve.mjs &
 *   then the garden in the harness (README: drive.mjs / tiers.mjs), stats() per view.
 */
export const GARDEN_BUDGET = {
  medium: { draws: 90, triangles: 80_000 },
  /** While walking the sun's shadow is redrawn too (only the movers, the kept picture under them). */
  mediumWalking: { draws: 110, triangles: 100_000 },
} as const;

export interface GardenMeasure { view: string; tier: "high" | "medium" | "low"; walking: boolean; draws: number; triangles: number }

/**
 * Before (27 Nov 2026: the old textured trees, instanced per kind, no tight culling), the low-poly
 * try (`facet`, 28 Nov, rejected by Harry: "the textured trees so much better") and after (28 Nov:
 * the textured trees made cheap, ./cardTrees.ts, plus every saving that does not depend on the look).
 */
export const GARDEN_MEASURED: { before: GardenMeasure[]; facet: GardenMeasure[]; after: GardenMeasure[] } = {
  before: [
    { view: "gate", tier: "medium", walking: false, draws: 129, triangles: 110_008 },
    { view: "fountain", tier: "medium", walking: false, draws: 105, triangles: 105_836 },
    { view: "shop", tier: "medium", walking: false, draws: 108, triangles: 106_490 },
    { view: "gate", tier: "medium", walking: true, draws: 241, triangles: 167_506 },
    { view: "shop", tier: "medium", walking: true, draws: 224, triangles: 164_084 },
    { view: "training", tier: "medium", walking: false, draws: 98, triangles: 109_152 },
    { view: "gate", tier: "high", walking: false, draws: 135, triangles: 126_726 },
    { view: "shop", tier: "high", walking: false, draws: 114, triangles: 123_208 },
    { view: "gate", tier: "low", walking: false, draws: 123, triangles: 110_228 },
    { view: "shop", tier: "low", walking: false, draws: 102, triangles: 106_710 },
  ],
  facet: [
    { view: "gate", tier: "medium", walking: false, draws: 86, triangles: 49_360 },
    { view: "fountain", tier: "medium", walking: false, draws: 68, triangles: 43_142 },
    { view: "shop", tier: "medium", walking: false, draws: 48, triangles: 40_922 },
    { view: "training", tier: "medium", walking: false, draws: 54, triangles: 40_114 },
    { view: "gate", tier: "medium", walking: true, draws: 85, triangles: 55_377 },
    { view: "shop", tier: "medium", walking: true, draws: 50, triangles: 46_615 },
  ],
  after: [
    { view: "gate", tier: "medium", walking: false, draws: 86, triangles: 50_516 },
    { view: "fountain", tier: "medium", walking: false, draws: 67, triangles: 42_934 },
    { view: "shop", tier: "medium", walking: false, draws: 47, triangles: 40_994 },
    { view: "training", tier: "medium", walking: false, draws: 55, triangles: 41_148 },
    { view: "gate", tier: "medium", walking: true, draws: 82, triangles: 55_735 },
    { view: "shop", tier: "medium", walking: true, draws: 49, triangles: 46_687 },
    { view: "gate", tier: "high", walking: false, draws: 92, triangles: 67_234 },
    { view: "shop", tier: "high", walking: false, draws: 53, triangles: 58_330 },
    { view: "gate", tier: "low", walking: false, draws: 81, triangles: 44_700 },
    { view: "shop", tier: "low", walking: false, draws: 42, triangles: 39_802 },
  ],
};

/**
 * GARDEN LEVELS (28 Nov 2026, lib/star/garden3d/levelZones.ts): the garden at each level, Medium, the same harness
 * and phone screen as above. `baselineOver`: the garden itself (level 1, the same view) is already over the draw
 * budget there, and the level may not add to it. Re-measure: .tmp-style driver in the build notes (H.garden with
 * opts.levels) or tests/star/gardenLevels.mts's header.
 */
export interface LevelMeasure { level: number; view: string; walking: boolean; draws: number; triangles: number; baselineOver?: number }
export const GARDEN_LEVELS_MEASURED: LevelMeasure[] = [];

/** The rider on the saddle, measured on the one body (scripts/perf3d H.rider → rideHorse.ts riderCheck), metres. */
export const RIDER_MEASURED = { kneeOut: [0.089, 0.087], footOut: [0.027, 0.04], ironGap: [0.076, 0.095], hipsOverSeat: 0 };
