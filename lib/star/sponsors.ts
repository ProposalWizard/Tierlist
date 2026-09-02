import type { CareerState, SponsorDeal, MatchStats } from "./types";
import { mulberry32 } from "./season";
import { clubExpectation, type Ambition } from "./expectations";

/**
 * SPONSORS WITH SOMETHING TO ASK
 *
 * A `SponsorDeal` was `{ category, perMatch, active }` — passive money that
 * unlocked by counting relationship points in a fixed order (Boots first,
 * Car last, always) regardless of who you were. Fame existed on CareerState
 * but did nothing — the sponsors screen's own footer text claimed "grow your
 * fame... to unlock sponsors" while nothing in the code read it — and the
 * `perMatch` figure it showed was never actually paid into `career.money`
 * anywhere. Asked directly: how do you actually get one of these?
 *
 * The answer now: every category has its own real requirement — fame plus
 * one thing that fits the brand (a boot deal cares what you've put on the
 * pitch; a jewellery deal cares what you've put in the garage) — see
 * `sponsorEligible`. Eligible-but-unsigned is a real state the Sponsors
 * screen shows and the player acts on (`signSponsor`), not a silent flag
 * flip. Money is a real, one-time fee: paid the moment you sign, and paid
 * again at the start of every season the deal is still active — not a
 * per-match retainer that was only ever a number on screen.
 *
 * A deal still comes with a target and a term on top of that (`objective`
 * below) — hit it and there is a bonus at the end of it; miss it and the
 * deal lapses, which costs the next season's fee AND some standing with
 * whichever sponsor looks at you next.
 */

/** Fame alone would make every category interchangeable — the same number
 *  unlocking Boots and a Rolex on the same day. Each brand also wants
 *  something that actually fits it, read straight off stats that already
 *  exist rather than anything invented for this. */
interface SponsorRequirement {
  /** Fame needed before this brand will even look at you. */
  fame: number;
  /** What the fee is worth before fame/club scale it up — see `sponsorFee`. */
  baseFee: number;
  /** The category's own condition, on top of the fame floor. */
  extra: (career: CareerState) => boolean;
  /** Plain-English version of `extra`, for the locked row. */
  describe: string;
}

/** Sum of every lifestyle purchase ever made — the closest thing this career
 *  has to "how much of a star's life do you actually live", which is what
 *  the vanity brands (Cosmetics, Watch, Jewelry, Car) are really buying. */
export function lifestyleScore(career: CareerState): number {
  return (career.ownedItems ?? []).reduce((sum, i) => sum + i.lifestyleValue, 0);
}

const SPONSOR_REQUIREMENTS: Record<string, SponsorRequirement> = {
  // Grounded, performance-first brands — reachable early, on output alone.
  Boots: {
    fame: 10, baseFee: 6,
    extra: c => c.seasonStats.goals + c.seasonStats.assists >= 3 || c.careerStats.goals + c.careerStats.assists >= 10,
    describe: "3 goal involvements this season (or 10 for your career)",
  },
  "Sports Drink": {
    fame: 15, baseFee: 7,
    extra: c => c.seasonStats.appearances >= 6,
    describe: "6 appearances this season",
  },
  Food: {
    fame: 18, baseFee: 8,
    extra: c => c.happiness >= 45,
    describe: "45 happiness — a face people like seeing",
  },
  // The fan-facing brands — care about being liked, not just good.
  "Sports Clothing": {
    fame: 25, baseFee: 10,
    extra: c => c.relationships.fans >= 45,
    describe: "45 Fans relationship",
  },
  "Casual Clothing": {
    fame: 30, baseFee: 12,
    extra: c => c.relationships.fans >= 55,
    describe: "55 Fans relationship",
  },
  // A winner's endorsement — cares about the cabinet, not the crowd.
  Electronics: {
    fame: 40, baseFee: 16,
    extra: c => c.trophies.length >= 1,
    describe: "a trophy on the cabinet",
  },
  // The vanity brands — care about the lifestyle you can already afford.
  Cosmetics: {
    fame: 35, baseFee: 14,
    extra: c => lifestyleScore(c) >= 25,
    describe: "★25 of lifestyle purchases",
  },
  Watch: {
    fame: 50, baseFee: 20,
    extra: c => lifestyleScore(c) >= 45,
    describe: "★45 of lifestyle purchases",
  },
  Jewelry: {
    fame: 58, baseFee: 26,
    extra: c => lifestyleScore(c) >= 60,
    describe: "★60 of lifestyle purchases",
  },
  // The one that wants the whole picture — famous, flush, AND playing
  // somewhere that matters.
  Car: {
    fame: 65, baseFee: 34,
    extra: c => {
      const amb = clubExpectation(c).ambition;
      return (amb === "Title" || amb === "Europe") && lifestyleScore(c) >= 40;
    },
    describe: "★40 of lifestyle purchases, at a club chasing the title or Europe",
  },
};

/** Plain-English requirement for a locked category — the fame floor first,
 *  then whatever else that brand wants. */
export function sponsorRequirementText(category: string): string {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return "";
  return `★${r.fame} fame, ${r.describe}`;
}

/** Whether this category would sign you right now. */
export function sponsorEligible(category: string, career: CareerState): boolean {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return false;
  return career.fame >= r.fame && r.extra(career);
}

// A famous player at a club chasing the league is worth more to every brand
// than the same fame at a relegation battler — the fee scales with both.
const AMBITION_FEE_MULT: Record<Ambition, number> = {
  Title: 1.4, Europe: 1.2, "Mid-table": 1.0, Survival: 0.85,
};

/**
 * What this category is worth, right now.
 *
 * Recomputed fresh every time it's needed rather than frozen at signing — a
 * deal you signed as a squad player is worth more once you're an England
 * regular, and the Sponsors screen showing that live is the point: the
 * number you see for an active deal is exactly what it pays at the next
 * season's fee.
 */
export function sponsorFee(category: string, career: CareerState): number {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return 0;
  const mult = AMBITION_FEE_MULT[clubExpectation(career).ambition] ?? 1;
  return Math.max(1, Math.round((r.baseFee + career.fame / 6) * mult));
}

/**
 * Sign an eligible category. A real action, not a threshold crossing
 * quietly in the background — the fee is paid immediately, the same as it
 * will be again at the start of every season this deal stays active (see
 * `rollSponsorSeason`).
 */
export function signSponsor(career: CareerState, category: string): CareerState {
  const idx = career.sponsors.findIndex(s => s.category === category);
  if (idx < 0 || career.sponsors[idx].active || !sponsorEligible(category, career)) return career;
  const activated = career.sponsors.map((s, i) => (i === idx ? { ...s, active: true } : s));
  const sponsors = attachObjective(career, activated);
  return { ...career, sponsors, money: career.money + sponsorFee(category, career) };
}

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
 * The end of a season: terms run down, a deal that was not delivered lapses,
 * and every deal still standing is paid again — the "at the start of every
 * season" half of the fee, on top of the one already paid at signing.
 *
 * Losing a deal costs next season's fee AND a little standing with everybody
 * else, which is the only thing that makes an objective worth chasing rather
 * than ignoring.
 */
export function rollSponsorSeason(career: CareerState): {
  sponsors: SponsorDeal[];
  lapsed: string[];
  standingHit: number;
  /** Paid into `career.money` by the caller — see careerFlow.ts's
   *  advanceSeason. Computed off `career` (the season just finished), the
   *  same standing that earned the deal its keep. */
  seasonFees: { category: string; fee: number }[];
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
    return { ...s, active: false, objective: undefined };
  });

  const seasonFees = sponsors
    .filter(s => s.active)
    .map(s => ({ category: s.category, fee: sponsorFee(s.category, career) }));

  return { sponsors, lapsed, standingHit: lapsed.length * 6, seasonFees };
}

/** A newly activated deal gets something to ask for. */
export function attachObjective(career: CareerState, sponsors: SponsorDeal[]): SponsorDeal[] {
  const rng = mulberry32(career.season * 4211 + career.week * 17);
  return sponsors.map((s, i) => (s.active && !s.objective ? { ...s, objective: makeObjective(career, i, rng) } : s));
}
