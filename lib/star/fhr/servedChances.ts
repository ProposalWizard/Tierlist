/**
 * The chances the real match serves, each with the moment the match would hand
 * a build-up (lib/star/fhr/buildUp.ts): for the ruler, the tests, the sheet of
 * build-ups and /star-fhr-dev. Pure.
 *
 * It plays whole matches through the real unseen match (hiddenMatch.ts) and
 * makes every chance with the real chance maker (chanceMaker.ts's makeChance),
 * like the ruler. The moment carries what CanvasMatch's loadScenario passes:
 * the radar's lane and pattern, fresh (a new chance, not a set piece), the
 * chance's seed, and the chance's frame as the match shows it (phase 1's
 * matchStill, a phone's canvas).
 */
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../hiddenMatch";
import type { Scenario } from "../canvasEngine";
import type { LeadMoment } from "../leadIn";
import { makeChance, PictureMemory } from "../chanceMaker";
import { newSelectionMemory } from "../scenarioSelect";
import { forceChancesMode, type ChancesMode } from "../newChances";
import { matchStill, matchCanvasHW } from "./stillCamera";
import { mulberry32, standInResult, RULER_INPUTS } from "./ruler";

export interface ServedChance { sc: Scenario; moment: LeadMoment; match: number; minute: number }

/** A phone's match canvas (390 px wide, about 700 px of room). */
export const PHONE_HW = matchCanvasHW(390, 700);

/** `count` open-play and set-piece chances as the match serves them (Chances: New unless told). */
export function servedChances(o: { count: number; seed?: number; chances?: ChancesMode; inputs?: HiddenMatchInputs }): ServedChance[] {
  const inputs = o.inputs ?? RULER_INPUTS;
  const prev = (globalThis as Record<string, unknown>).__starChancesForced as ChancesMode | null | undefined;
  forceChancesMode(o.chances ?? "new");
  const out: ServedChance[] = [];
  try {
    const memory = new PictureMemory("fhr-served", false);
    for (let m = 0; out.length < o.count && m < 10000; m++) {
      const seed = (o.seed ?? 3) + m * 7919;
      const rng = mulberry32(seed), engineRng = mulberry32(seed ^ 0x5eed);
      const state = newMatch(rng);
      const selection = newSelectionMemory();
      for (;;) {
        const step = advanceUntilInvolved(state, inputs, rng, 90);
        if (!step.request) break;
        const req = step.request;
        if (!req.dribble) {
          const sc = makeChance({ source: { from: "request", request: req, position: inputs.position ?? "ST" }, rng: engineRng, memory, selection }).sc;
          const setPiece = sc.kind === "penalty" || sc.kind === "free_kick" || sc.kind === "corner";
          const frame = matchStill(sc, PHONE_HW).frame.camera;
          out.push({
            sc, match: m, minute: state.minute,
            moment: {
              opening: false, fresh: !setPiece, lane: req.lane, pattern: req.pattern, seed,
              usStrength: inputs.teamStrength, themStrength: inputs.oppStrength,
              // B2b: how the ball was won, as the match had it (the build-up shows it).
              ...(req.regain ? { regain: req.regain } : {}),
              frame: { x1: frame.x1, x2: frame.x2, y1: frame.y1, y2: frame.y2 },
            },
          });
          if (out.length >= o.count) break;
        }
        resolveScenario(state, standInResult(req.zone, rng));
      }
    }
  } finally {
    forceChancesMode(prev ?? null);
  }
  return out;
}
