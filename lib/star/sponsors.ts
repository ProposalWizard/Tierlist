import { fameOf, fameLevel, isWornOut } from "./fame";
import type { CareerState, SponsorDeal, MatchStats } from "./types";
import { mulberry32 } from "./season";
import { clubExpectation, type Ambition } from "./expectations";
import { getTuning } from "./tuningStore";
import { clubNameSeed } from "./squadData";
import { WAGE_FLOOR } from "./economy";

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

/** Is anything you own of this category still in working order? */
function ownsWorking(career: CareerState, category: "item" | "vehicle" | "property"): boolean {
  return (career.ownedItems ?? []).some(i => i.category === category && !isWornOut(i));
}

/**
 * ── Rebuilt 21 Sep 2026 ──
 * Fame gates are now the six fame LEVELS (fame.ts): Local Name 10, Rising
 * Star 25, National Name 40, Global Star 60, Icon 80. The old "lifestyle
 * points" requirements are gone with lifestyle itself — the vanity brands
 * now want something you actually own, still in working order.
 */
const SPONSOR_REQUIREMENTS: Record<string, SponsorRequirement> = {
  // Grounded, performance-first brands — reachable early, on output alone.
  Boots: {
    fame: 10, baseFee: 6,
    extra: c => c.seasonStats.goals + c.seasonStats.assists >= 3 || c.careerStats.goals + c.careerStats.assists >= 10,
    describe: "3 goal involvements this season (or 10 for your career)",
  },
  "Sports Drink": {
    fame: 10, baseFee: 7,
    extra: c => c.seasonStats.appearances >= 6,
    describe: "6 appearances this season",
  },
  Food: {
    fame: 10, baseFee: 8,
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
    fame: 25, baseFee: 12,
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
    fame: 40, baseFee: 14,
    extra: c => c.relationships.fans >= 50,
    describe: "50 Fans relationship",
  },
  Watch: {
    fame: 60, baseFee: 20,
    extra: c => ownsWorking(c, "vehicle"),
    describe: "a car (or better) in working order",
  },
  Jewelry: {
    fame: 60, baseFee: 26,
    extra: c => ownsWorking(c, "property"),
    describe: "a property of your own",
  },
  // The one that wants the whole picture — famous, flush, AND playing
  // somewhere that matters.
  Car: {
    fame: 80, baseFee: 34,
    extra: c => {
      const amb = clubExpectation(c).ambition;
      return amb === "Title" || amb === "Europe";
    },
    describe: "playing for a club chasing the title or Europe",
  },
};

/** Plain-English requirement for a locked category — the fame floor first,
 *  then whatever else that brand wants. */
export function sponsorRequirementText(category: string): string {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return "";
  return `${fameLevel(r.fame).name} (${r.fame} fame), ${r.describe}`;
}

/** Whether this category would sign you right now. */
export function sponsorEligible(category: string, career: CareerState): boolean {
  const r = SPONSOR_REQUIREMENTS[category];
  if (!r) return false;
  return fameOf(career) >= r.fame && r.extra(career);
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
 * THE ONE PLACE SPONSOR MONEY BECOMES REAL MONEY.
 *
 * `SPONSOR_REQUIREMENTS`' `baseFee` and every objective bonus formula stay
 * deliberately small numbers (6-34) — that is what `objectiveDifficultyPerFee`
 * scales against, and inflating them directly would blow up every objective's
 * difficulty alongside its pay. So the conversion happens once, here, at the
 * very end: `raw` points become weeks of the player's own weekly wage.
 *
 * `WAGE_FLOOR` is the floor rather than zero so a career caught mid-signing
 * with no contract written yet still pays something sane rather than nothing.
 */
function moneyFromRaw(raw: number, career: CareerState): number {
  const wage = Math.max(WAGE_FLOOR, career.contract?.wage ?? 0);
  return Math.max(1, Math.round(raw * getTuning("sponsors.feeWageWeeksPerUnit") * wage));
}

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
  const raw = Math.max(1, Math.round((r.baseFee + fameOf(career) / getTuning("sponsors.fameDivisor")) * mult * upgrade));
  // ── WAGE-RELATIVE, 19 Sep 2026 ──
  //
  // This used to be `raw × 2000`, a flat multiplier from the 14 Sep rescale.
  // `raw` runs about 10-60, so a single deal paid ★20,000-120,000 — between
  // seventeen and a hundred weeks of Premier League income, EVERY SEASON,
  // from every active deal at once. Sponsorship was quietly paying more than
  // football.
  //
  // A sponsor pays you in proportion to what you are worth, and the game
  // already has a number for what you are worth: your wage. So the raw score
  // is now converted at `sponsors.feeWageWeeksPerUnit` weeks of YOUR OWN
  // weekly wage per point — which puts one deal at roughly half a week to
  // three weeks of your money whatever rung you are on, and makes the whole
  // sponsor book add up to about the `TOTAL_INCOME_SHARES.lumps` share
  // economy.ts always said it should be. It stays on the curve for the rest
  // of time without anybody having to remember to rescale it again.
  return moneyFromRaw(raw, career);
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
  const activated = career.sponsors.map((s, i) => (i === idx ? { ...s, active: true, level: s.level ?? 1, termLeft: sponsorTerm(category) } : s));
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

  // Converted to real money the same wage-relative way `sponsorFee` is, and
  // for the same reason — objectiveBonusBase/PerIndex stay small numbers
  // since difficulty is computed off baseFee, not off this bonus.
  const rawBonus = Math.max(3, Math.round((getTuning("sponsors.objectiveBonusBase") + index * getTuning("sponsors.objectiveBonusPerIndex")) * rep * seasons * difficulty));

  return {
    kind,
    target,
    progress: 0,
    seasonsLeft: seasons,
    bonus: moneyFromRaw(rawBonus, career),
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
/** One season, or two for the three top brands. */
export const LONG_TERM_SPONSORS = ["Watch", "Jewelry", "Car"];
export function sponsorTerm(category: string): number {
  return LONG_TERM_SPONSORS.includes(category) ? 2 : 1;
}

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
  const ended: string[] = [];
  const sponsors = (career.sponsors ?? []).map(s => {
    // The deal's own term runs down first (owners, 21 Sep 2026: deals last
    // one season, two for the top brands, then have to be earned again).
    // A deal saved before terms existed counts as a one-season deal.
    if (s.active && (s.termLeft ?? 1) <= 1) {
      ended.push(`${s.category}: deal ended — re-sign if you still qualify`);
      return { ...s, active: false, objective: undefined, termLeft: undefined };
    }
    if (s.active && typeof s.termLeft === "number") s = { ...s, termLeft: s.termLeft - 1 };
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

  // A deal that simply reached the end of its term costs no standing — only
  // a failed objective does.
  return { sponsors, lapsed: [...lapsed, ...ended], standingHit: lapsed.length * getTuning("sponsors.lapsedStandingHit"), seasonFees };
}

/**
 * A newly activated deal gets something to ask for.
 *
 * Real bug, reported directly: signing five sponsors in the same week
 * produced five IDENTICAL objectives (all "score in consecutive
 * appearances"). Root cause: `signSponsor` calls this function separately
 * for each deal as it's signed, one at a time — and the old seed
 * (`season * 4211 + week * 17`) depends on neither the category nor which
 * signing this is, so every call this week re-seeds `mulberry32` to the
 * exact same starting state, and a freshly-seeded RNG's very FIRST draw
 * (which is all `makeObjective` needs to pick a `kind`) is deterministic —
 * so it's always the same draw. Folding the category's own name into the
 * seed (via `clubNameSeed`, the same hash squadData.ts already uses for
 * "always the same, but different per name") makes each category roll its
 * own independent objective while staying exactly as deterministic as
 * before — the same account signing Boots on the same day always gets the
 * same Boots objective, it just no longer has to be the same as Watch's.
 */
export function attachObjective(career: CareerState, sponsors: SponsorDeal[]): SponsorDeal[] {
  return sponsors.map((s, i) => {
    if (!s.active || s.objective) return s;
    const rng = mulberry32(career.season * 4211 + career.week * 17 + clubNameSeed(s.category));
    return { ...s, objective: makeObjective(career, i, rng, s.category) };
  });
}
