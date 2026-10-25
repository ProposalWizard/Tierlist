/**
 * REAL GOALS INDEX — what the Real Goals home needs, small enough to ship with
 * the page (data/realmoments/rg_index.json, built by
 * scripts/realmoments/build_rg_index.mts; chat 5, 22 Oct 2026). The home
 * draws its path tiles and the daily card from this alone; the big shot files
 * (6 MB in all) load only when a path or a goal is opened.
 *
 * Pure: no React. tests/star/realGoals.mts checks the file matches a fresh build.
 */
import { DAILY_LIST } from "./realGoalDaily";
import { PATHS, buildPath, pathMaxStars, type PathId } from "./realGoalPaths";
import { realEnd, sideKits, type RealGoal } from "./realGoals";

/** Which data file holds a goal: "wc" (World Cup + Euro), "bangers", or a league file. */
export type RgFileKey = "wc" | "bangers" | "league-england" | "league-spain" | "league-italy" | "league-germany" | "league-france";

/** A daily goal's card: just what the home shows. */
export interface RgCard {
  file: RgFileKey;
  player: string;
  team: string;
  minute: number;
  home: string;
  away: string;
  score: [number, number];
  /** The banger's label, else the competition. */
  label: string;
  /** Where it went in: x across, z up (metres). */
  end: [number, number];
  /** The scorer's shirt and trim (the card's swatch). */
  kit: [string, string];
}

export interface RgIndex {
  /** Per path: levels and the most stars. */
  paths: Record<PathId, { levels: number; max: number }>;
  /** Per daily goal id: its card. */
  daily: Record<string, RgCard>;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The index from every goal, by the file that holds it. */
export function buildRgIndex(files: Record<string, RealGoal[]>): RgIndex {
  const all = Object.values(files).flat();
  const fileOf = new Map<string, RgFileKey>();
  for (const [k, gs] of Object.entries(files)) for (const g of gs) fileOf.set(g.id, k as RgFileKey);
  const paths = {} as RgIndex["paths"];
  for (const p of PATHS) {
    const st = buildPath(p.id, all);
    paths[p.id] = { levels: st.reduce((a, s) => a + s.levels.length, 0), max: pathMaxStars(st) };
  }
  const daily: Record<string, RgCard> = {};
  const byId = new Map(all.map((g) => [g.id, g]));
  for (const id of DAILY_LIST) {
    const g = byId.get(id);
    if (!g) continue;
    const e = realEnd(g);
    const k = sideKits(g.shot.team).home;
    daily[id] = {
      file: fileOf.get(id)!, player: g.shot.player, team: g.shot.team, minute: g.shot.minute,
      home: g.x.home, away: g.x.away, score: g.x.score, label: g.x.label || g.x.comp,
      end: [r2(e.x), r2(e.z)], kit: [k.shirt, k.trim],
    };
  }
  return { paths, daily };
}
