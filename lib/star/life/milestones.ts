/**
 * MILESTONES AND just(...) (story world plan part 2c, job B, 28 Nov 2026).
 *
 * `just(<milestone>)` is true for JUST_WEEKS (3) life weeks after the thing happened. No new hook in
 * app/star-dev/page.tsx: at each story moment (arcs.ts arcMoment, in a book with rarity tiers) the
 * life block compares a tiny snapshot of the career (`life.ms`) with the career now, and notes the
 * life week anything changed (`life.msw`). Entries older than JUST_WEEKS are dropped there, so the
 * part stays well under 0.1 KB.
 *
 *   birthday        you are a year older
 *   star-level      your Star Pass level crossed 10, 25, 50, 75 or 100 (starLevel reads an old
 *                   1-10 save on the same 1-100 scale: starPoints.ts isOldStarScale)
 *   new-club        your club changed
 *   first-call-up   your first international call-up (call-ups 0 → 1 or more)
 *   call-up         a later call-up
 *   trophy          you won something; trophy:<comp> (trophy:fa-cup, trophy:league) for one competition
 *   promoted        the season just over ended in promotion
 *   relegated       the season just over ended in relegation
 *
 * The first moment a save is seen only takes the snapshot: nothing is "just" from before it.
 */
import type { CareerState } from "../types";
import type { LifeState } from "./types";
import { clubSlug } from "./unlocks";
import { starLevel } from "../starPoints";

export const JUST_WEEKS = 3;
export const MILESTONES = ["birthday", "star-level", "new-club", "first-call-up", "call-up", "trophy", "promoted", "relegated"] as const;
export type Milestone = (typeof MILESTONES)[number];
/** Short keys in the save (life.msw). `tn` = how many trophies there were before the last `tr`. */
const KEY: Record<Milestone, string> = { birthday: "bd", "star-level": "sl", "new-club": "nc", "first-call-up": "fc", "call-up": "cu", trophy: "tr", promoted: "pr", relegated: "rl" };
const STAR_STEPS = [10, 25, 50, 75, 100];

/** A trophy's competition as the conditions name it (won(fa-cup), wonAt(league,sunderland)): its own
 *  slug ("fa-cup", "premier-league"), plus "league" for any division title. */
const LEAGUE_TITLES = new Set(["Premier League", "Championship", "League One", "League Two", "National League", "National League North", "National League South"]);
export function compSlugs(competition: string): string[] {
  const s = clubSlug(competition);
  return LEAGUE_TITLES.has(competition) ? ["league", s] : [s];
}
/** Every competition word won(...) / wonAt(...) / just(trophy:...) can use (the checker fails others). */
export const COMP_SLUGS: readonly string[] = [
  "league", "premier-league", "championship", "league-one", "league-two", "national-league", "national-league-north", "national-league-south",
  "fa-cup", "league-cup", "lower-league-trophy", "champions-league", "europa-league", "conference-league", "community-shield", "super-cup",
  "world-cup", "european-championship", "nations-league",
];

/** A club's code in the snapshot (the same 4 letters as a club person's id, people.ts clubCode). */
function code(club: string): string {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) h = Math.imul(h ^ club.charCodeAt(i), 16777619) >>> 0;
  return (h % 36 ** 4).toString(36).padStart(4, "0");
}

export function snapshotOf(c: CareerState): NonNullable<LifeState["ms"]> {
  return [c.player.age, starLevel(c), c.international?.callUps ?? 0, (c.trophies ?? []).length, (c.seasonHistory ?? []).length, code(c.player.club)];
}

/** Compare the snapshot with the career and note what just happened. Mutates `life`. */
export function noteMilestones(c: CareerState, life: LifeState, now: number): void {
  const cur = snapshotOf(c);
  const prev = life.ms;
  const w: Record<string, number> = { ...(life.msw ?? {}) };
  if (prev) {
    const [age, star, calls, troph, hist, club] = prev;
    if (cur[0] > age) w.bd = now;
    if (STAR_STEPS.some((t) => star < t && cur[1] >= t)) w.sl = now;
    if (cur[5] !== club) w.nc = now;
    if (cur[2] > calls) { if (calls === 0) w.fc = now; else w.cu = now; }
    if (cur[3] > troph) { w.tr = now; w.tn = troph; }
    if (cur[4] > hist) {
      const mv = c.seasonHistory?.[cur[4] - 1]?.move;
      if (mv === "promoted") w.pr = now;
      if (mv === "relegated") w.rl = now;
    }
  }
  for (const [k, at] of Object.entries(w)) if (k !== "tn" && now - at >= JUST_WEEKS) delete w[k];
  if (w.tr === undefined) delete w.tn;
  const same = !!prev && prev.every((x, i) => x === cur[i]);
  if (!same) life.ms = cur;
  if (Object.keys(w).length) life.msw = w;
  else delete life.msw;
}

/** Is just(<milestone>) true? `trophy:<comp>` needs the trophies (as compSlugs lists). */
export function justHolds(life: Pick<LifeState, "msw"> | undefined, m: string, now: number, trophies: [string[], string][]): boolean {
  const comp = m.startsWith("trophy:") ? m.slice(7) : null;
  const key = KEY[(comp ? "trophy" : m) as Milestone];
  const at = key ? life?.msw?.[key] : undefined;
  if (at === undefined || now - at >= JUST_WEEKS || now < at) return false;
  if (!comp) return true;
  return trophies.slice(life?.msw?.tn ?? 0).some(([cs]) => cs.includes(comp));
}

/** Is this a milestone word just(...) knows? */
export const isMilestone = (m: string): boolean => (MILESTONES as readonly string[]).includes(m) || (m.startsWith("trophy:") && COMP_SLUGS.includes(m.slice(7)));
