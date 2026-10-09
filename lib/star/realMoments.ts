/**
 * REAL MOMENTS — real match positions played in our engine. TESTING ONLY.
 *
 * Mikey, 9 Oct 2026: "the best scenario maker in the game … take a screenshot
 * of where those players are … recreate that as a scenario". The positions
 * come from StatsBomb's free open data (tools/statsbomb/), are converted
 * on a developer's machine, and are loaded into /star-real-moments-dev from
 * a file. None of the data is in the repo or reaches the live game.
 *
 * A moment is the gallery's own save shape: a chance kind + seed the engine
 * builds, and a PosOverride that puts the real people on top of it.
 */
import { buildScenario, type Scenario, type ScenarioKind } from "./canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "./scenarioEdit";
import { mulberry32 } from "./season";

export interface RealMoment {
  id: string;
  source: "pl1516" | "kane";
  kind: ScenarioKind;
  seed: number;
  override: PosOverride;
  meta: {
    player?: string; team?: string; match: string; minute: number;
    xg?: number; outcome?: string; body?: string; technique?: string;
    /** "shot" (a real shot) or "touch" (Kane receiving the ball). */
    what: string;
  };
  faults: string[];
}

/** The scenario for a real moment, built fresh every call. */
export function buildRealMoment(m: RealMoment): Scenario {
  const sc = buildScenario(m.kind, mulberry32(m.seed));
  applyOverrideToScenario(sc, m.override);
  return sc;
}

/** A file is a list of moments, or nothing usable. */
export function parseRealMoments(text: string): RealMoment[] | null {
  try {
    const v = JSON.parse(text);
    if (!Array.isArray(v)) return null;
    return v.filter((m) => m && typeof m.kind === "string" && typeof m.seed === "number" && m.override?.items);
  } catch {
    return null;
  }
}
