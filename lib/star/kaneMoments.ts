/**
 * KANE DRAWINGS — Settings → Match → "Kane drawings (testing)": New | Old.
 *
 * Mikey, 9 Oct 2026: "creating a lot of scenarios for each type of scenario
 * ... based upon the actual data ... games that Harry Kane is in ... the
 * players on his team ... and the opposition, their positions ... make this
 * a setting you can switch into, don't apply to the current scenarios yet."
 *
 * Every one of Kane's passes and shots in 21 recent matches (StatsBomb's free
 * data: Euro 2020, World Cup 2022, Euro 2024, Bayern v Leverkusen 2023/24)
 * is a drawing: Kane is you, and everyone the camera saw stands where they
 * stood. Made by tools/statsbomb/kane.mts into public/star/kane-moments.json,
 * fetched only when the setting is on. Testing only.
 *
 * With the setting on, a chance of a kind that has Kane drawings is one of
 * them, dealt so a drawing does not come back until the rest of its kind
 * have been dealt. A kind with none (a byline cross) is made as before.
 */
import { buildScenario, type Scenario, type ScenarioKind, type Vec2 } from "./canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "./scenarioEdit";
import { mulberry32 } from "./season";

export interface KaneMoment {
  id: string;
  kind: ScenarioKind;
  seed: number;
  override: PosOverride;
  /** A pass: where the ball really went (the target runs there). */
  runnerTo?: Vec2;
  meta: { comp: string; match: string; minute: number; what: string; xg?: number };
  /** What the gallery's rules say about the picture (offside left out). */
  faults: string[];
}

/** The scenario for one Kane drawing, built fresh every call. */
export function buildKaneMoment(m: KaneMoment): Scenario {
  const sc = buildScenario(m.kind, mulberry32(m.seed));
  applyOverrideToScenario(sc, m.override);
  if (m.runnerTo && sc.runner) {
    sc.runner.to = { ...m.runnerTo };
    sc.passTarget = { ...m.runnerTo };
  }
  return sc;
}

export const KANE_MOMENTS_URL = "/star/kane-moments.json";

let loaded: KaneMoment[] | null = null;
let loading: Promise<KaneMoment[]> | null = null;

/** Fetch the drawings once (safe to call often). */
export function loadKaneMoments(): Promise<KaneMoment[]> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = fetch(KANE_MOMENTS_URL)
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((j: { moments?: KaneMoment[] }) => (loaded = Array.isArray(j.moments) ? j.moments : []))
      .catch(() => { loading = null; return []; });
  }
  return loading;
}

/** The drawings, if they have arrived. */
export function kaneMomentsReady(): KaneMoment[] | null {
  return loaded;
}

/** For tests and the dev page: hand the drawings over directly. */
export function setKaneMoments(ms: KaneMoment[]): void {
  loaded = ms;
}

const dealt = new Map<ScenarioKind, Set<string>>();

/**
 * The next Kane drawing of this kind, or null when there is none (or they
 * have not arrived). Never the same one twice until every one of the kind
 * has been dealt.
 */
export function dealKaneMoment(kind: ScenarioKind, rng: () => number, from = loaded): KaneMoment | null {
  const all = (from ?? []).filter((m) => m.kind === kind);
  if (!all.length) return null;
  let seen = dealt.get(kind);
  if (!seen || seen.size >= all.length) { seen = new Set(); dealt.set(kind, seen); }
  const fresh = all.filter((m) => !seen!.has(m.id));
  const pick = fresh[Math.floor(rng() * fresh.length) % fresh.length];
  seen.add(pick.id);
  return pick;
}
