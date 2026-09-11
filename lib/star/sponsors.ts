import type { CareerState, SponsorDeal, MatchStats } from "./types";
import { mulberry32 } from "./season";
import { clubExpectation, type Ambition } from "./expectations";
import { getTuning } from "./tuningStore";

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
  Title: getTuning("sponsors.ambitionTitle"),
  Europe: getTuning("sponsors.ambitionEurope"),
  "Mid-table": getTuning("sponsors.ambitionMidTable"),
  Survival: getTuning("sponsors.ambitionSurvival"),
};

/**
 * What this category is worth, right now.
 *
 * Recomputed fresh every time it's needed rather than frozen at signing — a
 * deal you signed as a squad player is worth more once you're an England
 * regular, and the Sponsors screen showing that live is the point: the
 * number you see for an active deal is exactly what it pays at the next
 * season's fee.
 *
 * ── Upgrades ──
 *
 * Requested directly: completing a tough objective shouldn't just pay its
 * one-off bonus, it should make the DEAL itself worth more from then on —
 * "your sponsorship increases to get you more money." `SponsorDeal.level`
 * (bumped in `progressObjectives` the instant an objective completes) is
 * read straight off `career.sponsors` here rather than threaded through as
 * a parameter, so every existing call site keeps working unchanged. Level 1
 * (never completed anything, or a deal saved before this existed) is
 * exactly the old, un-upgraded fee — `(1 + rate)^0 = 1`. Compounding, not
 * additive, so a deal that keeps delivering keeps meaningfully outpacing
 * one that doesn't, capped at `upgradeMaxLevel` so it can't run away over a
 * very long career.
 */
export function sponsorFee(category: string, career: CareerState): number {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return 0;
  const mult = AMBITION_FEE_MULT[clubExpectation(career).ambition] ?? 1;
  const level = Math.min(
    career.sponsors.find(s => s.category === category)?.level ?? 1,
    getTuning("sponsors.upgradeMaxLevel"),
  );
  const upgrade = Math.pow(1 + getTuning("sponsors.upgradeFeeMultiplier"), Math.max(0, level - 1));
  return Math.max(1, Math.round((r.baseFee + career.fame / getTuning("sponsors.fameDivisor")) * mult * upgrade));
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
  const activated = career.sponsors.map((s, i) => (i === idx ? { ...s, active: true, level: s.level ?? 1 } : s));
  const sponsors = attachObjective(career, activated);
  return { ...career, sponsors, money: career.money + sponsorFee(category, career) };
}

export type ObjectiveKind =
  | "goals" | "assists" | "appearances" | "starMan" | "rating"
  | "goalStreak" | "startStreak" | "cleanSheets";

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
  goalStreak: n => `Score in ${n} consecutive appearances`,
  startStreak: n => `Start ${n} matches in a row`,
  cleanSheets: n => `Keep ${n} clean sheets while you're on the pitch`,
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
 *
 * ── Difficulty scales with what the deal is actually worth ──
 *
 * Requested directly: "for more expensive sponsorships, which give you more
 * money... you provide a lot more difficult bonuses... the difficulty
 * increases with the value of the deal." `category`'s own `baseFee` (the
 * same number that sets the fee — see `SPONSOR_REQUIREMENTS`) drives
 * `difficulty` below: a Boots deal (cheap) asks something close to the old
 * flat numbers, a Car deal (the most expensive) asks noticeably more of
 * everything. Optional and defaulting to a mid-value assumption only so a
 * caller that genuinely has no category to hand (there is none left in this
 * codebase, but the signature was public) doesn't crash.
 *
 * The three streak/count kinds (goalStreak, startStreak, cleanSheets) are
 * new — requested directly, real examples given ("score in eleven games in
 * a row", "start twenty-seven games this season", "clean sheets in your
 * next fifteen games") — alongside the original five. A streak's target
 * does not multiply by `seasons` the way a cumulative tally does: the term
 * length is how long you have to pull it off ONCE, not a quota that grows
 * the longer you're given.
 */
export function makeObjective(career: CareerState, index: number, rng: () => number, category?: string): SponsorObjective {
  const kinds: ObjectiveKind[] = [
    "goals", "assists", "appearances", "starMan", "rating",
    "goalStreak", "startStreak", "cleanSheets",
  ];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const rep = Math.max(0.4, career.starRating / 3);
  const seasonsMin = getTuning("sponsors.objectiveSeasonsMin");
  const seasonsMax = Math.max(seasonsMin, getTuning("sponsors.objectiveSeasonsMax"));
  const seasons = seasonsMin + Math.floor(rng() * (seasonsMax - seasonsMin + 1));

  const baseFee = (category ? SPONSOR_REQUIREMENTS[category]?.baseFee : undefined) ?? 12;
  const difficulty = 1 + baseFee * getTuning("sponsors.objectiveDifficultyPerFee");
  // Streak/count targets use the SQUARE ROOT of difficulty — a linear scale
  // on top of an already-exponential-feeling "N in a row" would make the
  // most expensive deals' streak objectives absurd (a Car deal wanting a
  // 20+ game scoring streak) rather than just harder.
  const streakDifficulty = Math.sqrt(difficulty);

  const target =
    kind === "goals" ? Math.max(4, Math.round(getTuning("sponsors.objectiveGoalsBase") * rep * seasons * difficulty))
    : kind === "assists" ? Math.max(3, Math.round(getTuning("sponsors.objectiveAssistsBase") * rep * seasons * difficulty))
    : kind === "appearances" ? Math.max(8, Math.round(getTuning("sponsors.objectiveAppearancesBase") * seasons * difficulty))
    : kind === "starMan" ? Math.max(2, Math.round(getTuning("sponsors.objectiveStarManBase") * rep * seasons * difficulty))
    : kind === "goalStreak" ? Math.max(3, Math.round(getTuning("sponsors.objectiveGoalStreakBase") * streakDifficulty))
    : kind === "startStreak" ? Math.max(5, Math.round(getTuning("sponsors.objectiveStartStreakBase") * streakDifficulty))
    : kind === "cleanSheets" ? Math.max(3, Math.round(getTuning("sponsors.objectiveCleanSheetsBase") * seasons * streakDifficulty))
    : getTuning("sponsors.objectiveRatingBase") + Math.round(rng() * getTuning("sponsors.objectiveRatingSpread")); // rating, stored ×10

  return {
    kind,
    target,
    progress: 0,
    seasonsLeft: seasons,
    bonus: Math.max(3, Math.round((getTuning("sponsors.objectiveBonusBase") + index * getTuning("sponsors.objectiveBonusPerIndex")) * rep * seasons * difficulty)),
    done: false,
  };
}

/**
 * Move every live objective on by one match.
 *
 * Rating is the odd one out: it is an average rather than a tally, so progress
 * holds the season's average ×10 rather than accumulating. `goals`/`assists`/
 * `appearances`/`starMan` are cumulative tallies that never reset on their
 * own — a "50 goals, two seasons to do it in" objective is just `goals` with
 * `seasonsLeft: 2`; the season boundary only matters to `rollSponsorSeason`'s
 * countdown, not to this function.
 *
 * `goalStreak`/`startStreak` are genuinely different: a STREAK, which BREAKS
 * (resets to 0) the moment the run stops, not a tally that only ever grows.
 * `cleanSheets` sits in between — a cumulative COUNT (like appearances), just
 * of a different real-world thing than the original five.
 *
 * `match`, when given, is `{ home }` for the fixture just played — the only
 * way to know which scoreline number was YOUR goals conceded, needed for
 * `cleanSheets`. Optional so a caller with no fixture in hand (there is none
 * left in this codebase — see careerFlow.ts's own call site) simply can't
 * progress that one kind rather than crashing.
 */
export function progressObjectives(
  sponsors: SponsorDeal[],
  stats: MatchStats,
  seasonStats: CareerState["seasonStats"],
  match?: { home: boolean },
): { sponsors: SponsorDeal[]; earned: number; completed: string[] } {
  let earned = 0;
  const completed: string[] = [];

  const startThreshold = getTuning("sponsors.startThresholdMinutes");
  const minutes = stats.minutes ?? 90; // absent means the full 90, same convention careerFlow.ts already uses
  const started = minutes >= startThreshold;
  const conceded = match ? (match.home ? stats.awayScore : stats.homeScore) : undefined;

  const next = sponsors.map(s => {
    const o = s.objective;
    if (!s.active || !o || o.done) return s;

    const progress =
      o.kind === "goals" ? o.progress + stats.goals
      : o.kind === "assists" ? o.progress + stats.assists
      : o.kind === "appearances" ? o.progress + 1
      : o.kind === "starMan" ? o.progress + (stats.starMan ? 1 : 0)
      : o.kind === "rating" ? Math.round((seasonStats.ratingCount > 0 ? seasonStats.totalRating / seasonStats.ratingCount : 0) * 10)
      // A scoreless appearance breaks the streak outright; a goal extends it.
      : o.kind === "goalStreak" ? (stats.goals > 0 ? o.progress + 1 : 0)
      // Coming off the bench (or an unused-sub week, which never reaches
      // this function at all) breaks a START streak specifically — you
      // were not trusted to begin the match, whatever else happened in it.
      : o.kind === "startStreak" ? (started ? o.progress + 1 : 0)
      // A count, not a streak: only ever moves forward, and only on a
      // match you actually featured in — `conceded` is undefined when no
      // fixture context was given, which correctly never credits it.
      : o.kind === "cleanSheets" ? (conceded === 0 ? o.progress + 1 : o.progress)
      : o.progress;

    if (progress >= o.target) {
      earned += o.bonus;
      completed.push(`${s.category}: ${objectiveLabel(o)} — ★${o.bonus}`);
      // The upgrade: this deal's own fee (see sponsorFee) is permanently
      // higher from here on, capped at upgradeMaxLevel so it can't run away
      // over a very long career. `level` starts at 1 (or is absent, on a
      // deal saved before this existed — treated the same) — the FIRST
      // completion takes it to 2, i.e. the first real upgrade.
      const level = Math.min(getTuning("sponsors.upgradeMaxLevel"), (s.level ?? 1) + 1);
      return { ...s, level, objective: { ...o, progress, done: true } };
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

  return { sponsors, lapsed, standingHit: lapsed.length * getTuning("sponsors.lapsedStandingHit"), seasonFees };
}

/** A newly activated deal gets something to ask for. */
export function attachObjective(career: CareerState, sponsors: SponsorDeal[]): SponsorDeal[] {
  const rng = mulberry32(career.season * 4211 + career.week * 17);
  return sponsors.map((s, i) => (s.active && !s.objective ? { ...s, objective: makeObjective(career, i, rng, s.category) } : s));
}
