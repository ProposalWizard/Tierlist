import type { CareerState, SponsorDeal, MatchStats } from "./types";
import { mulberry32 } from "./season";

/**
 * SPONSORS WITH SOMETHING TO ASK
 *
 * A `SponsorDeal` was `{ category, perMatch, active }` — passive money that
 * unlocked by counting. Nothing was ever asked of you, so the sponsors screen
 * was a list of numbers going up on its own and money had nothing to chase.
 *
 * A deal now comes with a target and a term. Hit it and there is a real payment
 * at the end of it; miss it and the deal lapses, which costs you the retainer
 * AND some standing with the next sponsor who looks at you. It is the one place
 * in the career where money is a goal rather than a consequence.
 */

export type ObjectiveKind = "goals" | "assists" | "appearances" | "starMan" | "rating";

export interface SponsorObjective {
  kind: ObjectiveKind;
  target: number;
  progress: number;
  /** Seasons left to do it in. Counted down at the rollover. */
  seasonsLeft: number;
  /** Paid on completion. */
  bonus: number;
  done: boolean;
}

const LABEL: Record<ObjectiveKind, (n: number) => string> = {
  goals: n => `Score ${n} goals`,
  assists: n => `Register ${n} assists`,
  appearances: n => `Play ${n} matches`,
  starMan: n => `Win ${n} Star Man awards`,
  rating: n => `Average ${(n / 10).toFixed(1)} across the season`,
};

export function objectiveLabel(o: SponsorObjective): string {
  return LABEL[o.kind](o.target);
}

/**
 * What a sponsor asks for when they sign you.
 *
 * Scaled to what you already are, so the same deal is a stretch for a teenager
 * and a formality for a star — and pitched deliberately just above your current
 * season's rate, because a target you would hit anyway is not an objective.
 */
export function makeObjective(career: CareerState, index: number, rng: () => number): SponsorObjective {
  const kinds: ObjectiveKind[] = ["goals", "assists", "appearances", "starMan", "rating"];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const rep = Math.max(0.4, career.starRating / 3);
  const seasons = 1 + Math.floor(rng() * 2);

  const target = kind === "goals" ? Math.max(4, Math.round(8 * rep * seasons))
    : kind === "assists" ? Math.max(3, Math.round(5 * rep * seasons))
      : kind === "appearances" ? Math.max(8, Math.round(14 * seasons))
        : kind === "starMan" ? Math.max(2, Math.round(3 * rep * seasons))
          : 70 + Math.round(rng() * 8);   // rating, stored ×10

  return {
    kind,
    target,
    progress: 0,
    seasonsLeft: seasons,
    bonus: Math.max(3, Math.round((6 + index * 2) * rep * seasons)),
    done: false,
  };
}

/**
 * Move every live objective on by one match.
 *
 * Rating is the odd one out: it is an average rather than a tally, so progress
 * holds the season's average ×10 rather than accumulating. Everything else adds
 * up, which is why a season target survives a bad month.
 */
export function progressObjectives(
  sponsors: SponsorDeal[],
  stats: MatchStats,
  seasonStats: CareerState["seasonStats"],
): { sponsors: SponsorDeal[]; earned: number; completed: string[] } {
  let earned = 0;
  const completed: string[] = [];

  const next = sponsors.map(s => {
    const o = s.objective;
    if (!s.active || !o || o.done) return s;

    const progress = o.kind === "goals" ? o.progress + stats.goals
      : o.kind === "assists" ? o.progress + stats.assists
        : o.kind === "appearances" ? o.progress + 1
          : o.kind === "starMan" ? o.progress + (stats.starMan ? 1 : 0)
            : Math.round((seasonStats.ratingCount > 0 ? seasonStats.totalRating / seasonStats.ratingCount : 0) * 10);

    if (progress >= o.target) {
      earned += o.bonus;
      completed.push(`${s.category}: ${objectiveLabel(o)} — ★${o.bonus}`);
      return { ...s, objective: { ...o, progress, done: true } };
    }
    return { ...s, objective: { ...o, progress } };
  });

  return { sponsors: next, earned, completed };
}

/**
 * The end of a season: terms run down, and a deal that was not delivered lapses.
 *
 * Losing one costs the retainer and a little standing with everybody else, which
 * is the only thing that makes an objective worth chasing rather than ignoring.
 */
export function rollSponsorSeason(career: CareerState): {
  sponsors: SponsorDeal[];
  lapsed: string[];
  standingHit: number;
} {
  const lapsed: string[] = [];
  const sponsors = (career.sponsors ?? []).map(s => {
    const o = s.objective;
    if (!s.active || !o) return s;
    if (o.done) return { ...s, objective: undefined };
    const seasonsLeft = o.seasonsLeft - 1;
    if (seasonsLeft > 0) {
      // A season tally resets; a multi-season one carries on.
      return { ...s, objective: { ...o, seasonsLeft } };
    }
    lapsed.push(`${s.category}: ${objectiveLabel(o)} — not delivered`);
    return { ...s, active: false, perMatch: 0, objective: undefined };
  });

  return { sponsors, lapsed, standingHit: lapsed.length * 6 };
}

/** A newly activated deal gets something to ask for. */
export function attachObjective(career: CareerState, sponsors: SponsorDeal[]): SponsorDeal[] {
  const rng = mulberry32(career.season * 4211 + career.week * 17);
  return sponsors.map((s, i) => (s.active && !s.objective ? { ...s, objective: makeObjective(career, i, rng) } : s));
}
