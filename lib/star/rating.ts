import type { CareerState, Skills } from "./types";
import { RECORDS, recordBeaten } from "./records";
import { getTuning } from "./tuningStore";

/**
 * ONE OVERALL, DERIVED FROM WHAT'S ACTUALLY REAL.
 *
 * `career.starRating` used to be its own scalar, hand-nudged a little after
 * a good match (+0.03 for an 8+ rating) and a little more after a training
 * session (+0.005 per skill point gained) — moving independently of
 * `career.skills`, the thing a real player's rating is actually built from,
 * and already trained, already read live by the match engine
 * (CanvasMatch.tsx). Two numbers claiming to answer the same question,
 * agreeing only by coincidence.
 *
 * Requested directly: derive it FROM skills instead, the way a real
 * player's overall is built from attributes rather than tracked
 * separately — and fold in the things a real football reputation is
 * actually built from too: trophies, individual honours, real records
 * beaten, a body of career stats. `starRating` is still a single 0-5
 * scalar, still stored on `CareerState`, still read by every system that
 * already reads it (contracts, transfers, sponsors, the manager, dilemmas,
 * retirement, media reach) — nothing about ITS shape or range changes, only
 * how it gets computed, and that happens in exactly one place now.
 */

// ── The attribute base ──────────────────────────────────────────────────────

/**
 * How much each trained skill counts toward the base rating.
 *
 * Technique and vision weighted heaviest — the two that never decay with
 * age (see careerFlow.ts's `ageEffect`) are the two a real footballer's
 * reputation actually rests on longest. Free-kick weighted lightest: a real
 * specialism, not a general measure of how good a player is. Sums to 1.
 */
const SKILL_WEIGHTS: Record<keyof Skills, number> = {
  pace: getTuning("rating.weightPace"),
  power: getTuning("rating.weightPower"),
  technique: getTuning("rating.weightTechnique"),
  vision: getTuning("rating.weightVision"),
  freeKick: getTuning("rating.weightFreeKick"),
};

/** 0-100, purely off trained attributes — a maxed-out set of skills (all
 *  100) reaches exactly 100 here, same ceiling `displayOverall` gives a
 *  full 5★. */
export function attributeOverall(skills: Skills): number {
  return (
    skills.pace * SKILL_WEIGHTS.pace +
    skills.power * SKILL_WEIGHTS.power +
    skills.technique * SKILL_WEIGHTS.technique +
    skills.vision * SKILL_WEIGHTS.vision +
    skills.freeKick * SKILL_WEIGHTS.freeKick
  );
}

// ── Reputation: trophies, honours, records, a body of work ─────────────────

/** Fame handed out for a season's silverware, at rollover, AND how much
 *  reputation that same trophy is worth toward the rating below — one
 *  table for both, since a Premier League medal means the same amount
 *  whichever number it's feeding. Moved here from careerFlow.ts, which
 *  still imports it for the `trophyFame` computation in `advanceSeason`.
 *  A league title (or a European Cup) means more than a Community Shield,
 *  so the trophy itself decides how much; anything not listed (Play-Offs,
 *  an unnamed cup) still counts a little rather than nothing. */
export const TROPHY_FAME: Record<string, number> = {
  "Premier League": 25, "Championship": 20,
  "Champions League": 22, "Europa League": 12, "Conference League": 8,
  "FA Cup": 14, "League Cup": 9,
  "Community Shield": 4, "Super Cup": 4,
};

/** Every point of "reputation" the rating can gain beyond raw attributes —
 *  capped, so a decorated legend is meaningfully lifted above an
 *  identically-trained nobody without honours ever being able to outweigh
 *  actual ability. 18 points is +0.9★ at the very most. */
const HONOUR_CAP = getTuning("rating.honourCap");

function honourPoints(career: CareerState): number {
  // Trophies — reusing TROPHY_FAME's own weighting, scaled down: a title
  // (25 fame) is worth 2.5 reputation points here, a Community Shield
  // (4 fame) half a point. A whole cabinet of silverware adds up fast,
  // which is exactly why the cap above exists.
  const trophies = career.trophies.reduce((sum, t) => sum + (TROPHY_FAME[t.competition] ?? getTuning("rating.unlistedTrophyFame")), 0)
    * getTuning("rating.trophyFameScale");

  // The individual honour nothing else touches: a Ballon d'Or is the
  // single biggest reputation event a career can have.
  const ballonDor = career.ballonDorWins * getTuning("rating.ballonDorPoints");

  // Every achievement unlocked, a small amount each — the 34 in
  // achievements.ts span "made your debut" to "won the treble", so no
  // single one should move the needle much on its own.
  const achievements = career.achievements.length * getTuning("rating.achievementPoints");

  // A REAL Premier League record beaten (records.ts) is about as
  // legendary as this game gets — worth more per item than anything else
  // here, and there are only five of them to ever beat.
  const records = RECORDS.filter(r => recordBeaten(career, r)).length * getTuning("rating.recordPoints");

  // A body of work, read continuously rather than at achievement
  // thresholds — square-rooted so a prolific career keeps being rewarded
  // without a striker's goal tally alone dwarfing everything above.
  const body = Math.sqrt(career.careerStats.goals) * getTuning("rating.goalsWeight")
    + Math.sqrt(career.careerStats.assists) * getTuning("rating.assistsWeight")
    + Math.sqrt(career.careerStats.appearances) * getTuning("rating.appearancesWeight");

  return Math.min(HONOUR_CAP, trophies + ballonDor + achievements + records + body);
}

// ── The one shared computation ──────────────────────────────────────────────

/**
 * The single source of truth for `career.starRating` — call this at the end
 * of any reducer that could have changed skills, trophies, achievements,
 * personal bests, or `ballonDorWins`, and assign the result. Never nudged
 * or accumulated by hand anywhere else; recomputed fresh from whatever the
 * career currently holds, so it can never drift out of sync with the real
 * numbers behind it.
 *
 * Floored at 0.5 rather than 0 — even a career day-one, before a single
 * skill point has been trained, reads as "a real if unproven young
 * player", not a blank stat.
 */
export function computeStarRating(career: CareerState): number {
  const total = attributeOverall(career.skills) + honourPoints(career);
  return Math.max(getTuning("rating.floor"), Math.min(5, total / getTuning("rating.divisor")));
}

/**
 * The one "overall" (0-100) every screen should read instead of inventing
 * its own linear map off `starRating` — teamsheet.ts, seasonAwards.ts and
 * LeagueScreen.tsx each had a DIFFERENT formula for the same number
 * (58+6.5x, 45+11x, 18x+10), so the same star rating read as three
 * different overalls depending which screen you were looking at. 30 at
 * 0★, 100 at 5★ — a fresh, untrained young player reads in the low-to-mid
 * 30s, a fully-trained, decorated legend caps out at a real "100".
 */
export function displayOverall(starRating: number): number {
  return Math.max(1, Math.min(100, Math.round(getTuning("rating.displayBase") + starRating * getTuning("rating.displayScale"))));
}

// ── Growing (and aging) at a realistic rate ─────────────────────────────────

/**
 * How fast a skill point actually lands, by age — the growth half of the
 * age curve `careerFlow.ts`'s `ageEffect` already applies as DECAY (pace/
 * power sliding back from 30, harder from 34). A teenager improving is a
 * real, fast thing; a player already past 31 is here to hold what he has,
 * not to keep developing — applied to every skill-point gain, training and
 * match-performance alike, so the same young-player-develops-fast,
 * veteran-plateaus shape shows up on both levers.
 */
export function growthMultiplier(age: number): number {
  if (age <= 19) return getTuning("rating.growthUnder20");
  if (age <= 23) return getTuning("rating.growthUnder24");
  if (age <= 28) return getTuning("rating.growthUnder29");
  if (age <= 31) return getTuning("rating.growthUnder32");
  return getTuning("rating.growthOver31");
}
