/**
 * KANE DRAWINGS — Settings → Match → "Kane drawings (testing)": New | Old.
 *
 * Mikey, 9 Oct 2026: "creating a lot of scenarios for each type of scenario
 * ... based upon the actual data ... games that Harry Kane is in ... the
 * players on his team ... and the opposition, their positions ... make this
 * a setting you can switch into, don't apply to the current scenarios yet."
 *
 * Real strikers' passes and shots from every free StatsBomb set with 360
 * frames (Mikey: "only use strikers"), Harry Kane's dealt more often. The
 * striker is you, and everyone the camera saw near the play stands where
 * they stood (opponents kept off the ball). Graded easy / normal / hard and
 * dealt 50 / 35 / 15. Made by tools/statsbomb/kane.mts into public/star/kane-moments.json,
 * fetched only when the setting is on. Testing only.
 *
 * With the setting on, a chance of a kind that has Kane drawings is one of
 * them. A kind with none is made as before.
 */
import { buildScenario, type Scenario, type ScenarioKind, type Vec2 } from "./canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "./scenarioEdit";
import { mulberry32 } from "./season";

/** How hard the moment was: the room he had, and whether the real pass or shot worked. */
export type KaneGrade = "easy" | "normal" | "hard";
/** How often each grade is dealt (Mikey, 9 Oct 2026: hard ones "should be a bit more rare"). */
export const GRADE_SHARE: Record<KaneGrade, number> = { easy: 0.5, normal: 0.35, hard: 0.15 };
/** Kane's own moments are dealt this many times as often as another striker's. */
export const KANE_WEIGHT = 3;

export interface KaneMoment {
  id: string;
  grade?: KaneGrade;
  /** Harry Kane's own moment (dealt KANE_WEIGHT times as often). */
  kane?: boolean;
  kind: ScenarioKind;
  seed: number;
  override: PosOverride;
  /** A pass: where the ball really went (the target runs there). */
  runnerTo?: Vec2;
  meta: { comp: string; match: string; minute: number; what: string; xg?: number; player?: string };
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

const dealt = new Map<string, Map<string, number>>();

/** For tests: forget what has been dealt. */
export function resetKaneDeals(): void {
  dealt.clear();
}

/**
 * The next drawing of this kind, or null when there is none (or they have not
 * arrived). The grade is picked first (easy 50%, normal 35%, hard 15%, shared
 * out among the grades the kind has), then a drawing of that grade, Kane's
 * dealt KANE_WEIGHT times a round, the rest once. Nothing comes back until
 * the round of its kind and grade is used up.
 */
export function dealKaneMoment(kind: ScenarioKind, rng: () => number, from = loaded): KaneMoment | null {
  const all = (from ?? []).filter((m) => m.kind === kind);
  if (!all.length) return null;
  const gradeOf = (m: KaneMoment): KaneGrade => m.grade ?? "normal";
  const grades = (Object.keys(GRADE_SHARE) as KaneGrade[]).filter((g) => all.some((m) => gradeOf(m) === g));
  const total = grades.reduce((a, g) => a + GRADE_SHARE[g], 0);
  let roll = rng() * total;
  let grade = grades[grades.length - 1];
  for (const g of grades) { if (roll < GRADE_SHARE[g]) { grade = g; break; } roll -= GRADE_SHARE[g]; }
  const pool = all.filter((m) => gradeOf(m) === grade);
  const key = `${kind}|${grade}`;
  const w = (m: KaneMoment) => (m.kane ? KANE_WEIGHT : 1);
  // A round deals every drawing once, and each of Kane's KANE_WEIGHT times.
  let used = dealt.get(key);
  const left = (m: KaneMoment) => w(m) - (used?.get(m.id) ?? 0);
  if (!used || pool.every((m) => left(m) <= 0)) { used = new Map(); dealt.set(key, used); }
  const fresh = pool.filter((m) => left(m) > 0);
  let r = rng() * fresh.reduce((a, m) => a + left(m), 0);
  let pick = fresh[fresh.length - 1];
  for (const m of fresh) { if (r < left(m)) { pick = m; break; } r -= left(m); }
  used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
  return pick;
}
