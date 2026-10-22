/**
 * REAL GOALS PATHS (Leo, 22 Oct 2026, plan part 7) — a level path per set of
 * goals, each like the World Cup one: 5 stages, easiest first, its own stars
 * and gates.
 *
 *   World Cup & Euro   the 232 tournament goals (exactly as before, its stars
 *                      stay in star-real-goals-progress-v2)
 *   5 league paths     Premier League, La Liga, Serie A, Bundesliga, Ligue 1
 *                      2017/18, 5 × 10 from each league's goals
 *   Worldies 17/18     the hardest goals of the 4,393 league goals: long
 *                      range, into a corner, a low chance (10 per league)
 *   Bangers            famous goals 2010-2025, drafted by us from public
 *                      record (data/realmoments/bangers.json), all of them
 *
 * Pure: no React. tests/star/realGoals.mts checks it.
 */
import { CX } from "./pitch";
import {
  buildLevels, difficultyOf, isTournament, realEnd, realStart, LEAGUES, STAGE_GATES, LEVELS_PER_STAGE,
  type Level, type Progress, type RealGoal, type Stage,
} from "./realGoals";

export type PathId = "wc" | "pl" | "liga" | "seriea" | "bundes" | "l1" | "worldies" | "bangers";

export interface RgPath {
  id: PathId;
  name: string;
  /** One short line under the name on its tile. */
  blurb: string;
  /** The tile's two colours (a league feel, no badge). */
  colours: [string, string];
  stageNames: string[];
}

/** League stage names: a season, from the first day to the last. */
export const LEAGUE_STAGES = ["Matchday 1", "Autumn", "Winter", "The run-in", "Title decider"];
export const WORLDIE_STAGES = ["Long shots", "Top bins", "Screamers", "Outrageous", "Impossible"];
export const BANGER_STAGES = ["Classics", "Golazos", "Puskás shortlist", "Goal of the season", "Goal of the decade"];

const LEAGUE_PATH: Record<string, PathId> = {
  "league-england": "pl", "league-spain": "liga", "league-italy": "seriea", "league-germany": "bundes", "league-france": "l1",
};
const LEAGUE_LOOK: Record<string, [string, string]> = {
  pl: ["#3d195b", "#00ff85"], liga: ["#ee2523", "#ffcc00"], seriea: ["#008fd7", "#0a2a59"], bundes: ["#d20515", "#111111"], l1: ["#091c3e", "#dae025"],
};

export const PATHS: RgPath[] = [
  { id: "wc", name: "World Cup & Euro", blurb: "World Cup 2018 · Euro 2016", colours: ["#0b3d2e", "#facc15"], stageNames: ["Group stage", "Round of 16", "Quarter-finals", "Semi-finals", "The final"] },
  ...LEAGUES.map((l): RgPath => {
    const id = LEAGUE_PATH[l.file];
    return { id, name: l.comp.replace(" 2017/18", ""), blurb: "2017/18 season", colours: LEAGUE_LOOK[id], stageNames: LEAGUE_STAGES };
  }),
  { id: "worldies", name: "Worldies 17/18", blurb: "The hardest goals of all five leagues", colours: ["#7c2d12", "#fb923c"], stageNames: WORLDIE_STAGES },
  { id: "bangers", name: "Bangers", blurb: "Famous goals 2010-2025", colours: ["#581c87", "#f0abfc"], stageNames: BANGER_STAGES },
];
export const pathOf = (id: string): RgPath | undefined => PATHS.find((p) => p.id === id);

/** The league comp each league path plays ("Premier League 2017/18"). */
export function compOfPath(id: PathId): string | null {
  const l = LEAGUES.find((q) => LEAGUE_PATH[q.file] === id);
  return l ? l.comp : null;
}

/** A banger (drafted by us from public record; its id starts "bg-"). */
export const isBanger = (g: RealGoal) => g.id.startsWith("bg-");

// ─────────────────────────────────────────────────────────────────────────
//  WORLDIES: the hardest league goals
// ─────────────────────────────────────────────────────────────────────────

export const WORLDIES_PER_LEAGUE = 10;
/** A worldie: struck with a foot from 18-35 m (further out is mostly an empty net), a chance of 6% or less, into a corner or high. */
export function isWorldieCandidate(g: RealGoal): boolean {
  if (g.shot.body === "Head" || g.shot.xg > 0.06) return false;
  const b = realStart(g), e = realEnd(g);
  const dist = Math.hypot(b.x - CX, b.y);
  if (dist < 18 || dist > 35) return false;
  return e.z > 1.5 || Math.abs(e.x - CX) > 2.2;
}

/** The 50 worldies: the hardest 10 of each league by difficulty. Deterministic. */
export function pickWorldies(leagueGoals: RealGoal[]): RealGoal[] {
  const out: RealGoal[] = [];
  for (const l of LEAGUES) {
    const pool = leagueGoals.filter((g) => g.x.comp === l.comp && isWorldieCandidate(g))
      .map((g) => ({ g, d: difficultyOf(g) }))
      .sort((a, b) => b.d - a.d || a.g.id.localeCompare(b.g.id));
    out.push(...pool.slice(0, WORLDIES_PER_LEAGUE).map((q) => q.g));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
//  BUILDING A PATH
// ─────────────────────────────────────────────────────────────────────────

const NO_FEATURED = new Set<string>();
/** The gates scaled to the path's size (the World Cup's 0/6/15/26/38 for 50 levels). */
export const gatesFor = (perStage: number) => STAGE_GATES.map((g) => Math.round((g * perStage) / LEVELS_PER_STAGE));

/**
 * The path's stages from every goal loaded. The World Cup path is exactly the
 * old level map (buildLevels with no options); a league path takes 5 × 10 from
 * its league; Worldies the 50 hardest; Bangers every banger (5 stages of a
 * fifth each). Empty when its goals are not loaded yet.
 */
export function buildPath(id: PathId, all: RealGoal[]): Stage[] {
  if (id === "wc") return buildLevels(all.filter(isTournament));
  const p = pathOf(id)!;
  if (id === "worldies") {
    const w = pickWorldies(all.filter((g) => !isTournament(g) && !isBanger(g)));
    return w.length ? buildLevels(w, { names: p.stageNames, featured: NO_FEATURED }) : [];
  }
  if (id === "bangers") {
    const b = all.filter(isBanger);
    if (!b.length) return [];
    const per = Math.ceil(b.length / p.stageNames.length);
    return buildLevels(b, { names: p.stageNames, perStage: per, gates: gatesFor(per), featured: NO_FEATURED });
  }
  const comp = compOfPath(id);
  const pool = all.filter((g) => g.x.comp === comp);
  return pool.length ? buildLevels(pool, { names: p.stageNames, featured: NO_FEATURED }) : [];
}

/** The stars won on this path's own levels (its gates count only these). */
export function pathStars(stages: Stage[], p: Progress): number {
  let n = 0;
  for (const s of stages) for (const l of s.levels) n += p[l.goal.id]?.stars ?? 0;
  return n;
}
export const pathMaxStars = (stages: Stage[]) => stages.reduce((a, s) => a + s.levels.length * 3, 0);

/** The level to offer next: the first open one without three stars, else the first. */
export function nextLevelOf(stages: Stage[], p: Progress, open: (lv: Level) => boolean): Level | undefined {
  const all = stages.flatMap((s) => s.levels);
  return all.find((l) => open(l) && (p[l.goal.id]?.stars ?? 0) < 3) ?? all[0];
}

// ─────────────────────────────────────────────────────────────────────────
//  STARS SAVED ON THE PHONE (one store for the new paths; the World Cup's stays as it was)
// ─────────────────────────────────────────────────────────────────────────

const PATHS_KEY = "star-real-goals-paths-v1";
export type PathProgress = Partial<Record<PathId, Progress>>;
export function loadPathProgress(): PathProgress {
  try {
    const raw = localStorage.getItem(PATHS_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}
export function savePathProgress(p: PathProgress): void {
  try { localStorage.setItem(PATHS_KEY, JSON.stringify(p)); } catch { /* private window: this visit only */ }
}
