import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS,
  LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
} from "./clubs";
import { leagueNameFor, type CareerDivision } from "./calendar";
import { MONEY_SCALE } from "./money";

/**
 * WHO COMES IN FOR YOU.
 *
 * The number the trial produced (0-100) decides which clubs were watching and
 * what they are willing to offer. This is the whole point of the trial — until
 * this existed the score was computed, shown, and then thrown away, and every
 * player arrived at the same club on the same wage however they had played.
 *
 * ── No ceiling, and no floor either ──
 *
 * A perfect trial can genuinely get you a Premier League club. That was
 * decided directly, against the obvious objection — a sixteen-year-old with
 * 40-ish stats at a top-five club is benched immediately — and the answer was
 * to fix what happens NEXT (never a reserve; a bench place or a loan; a wage
 * that follows your standing) rather than to cap the dream. The rare outcome
 * is the most interesting start in the game, not a trap.
 *
 * And a bad enough trial means NOBODY comes in. That is not a failure state
 * bolted on — it is the free-agent life, and it is the reason career creation
 * was split in two so a career can exist with no club at all.
 *
 * ── Why the bands overlap ──
 *
 * A score does not map to one division. It shifts the ODDS across the ladder,
 * so the same 62 can bring a League Two club one day and a Championship club
 * the next, and neither is a bug. A trial you can read off a table is a trial
 * with one right answer.
 */

export interface ScoutOffer {
  club: string;
  division: CareerDivision;
  /** Weekly, in stars — see money.ts. */
  wage: number;
  goalBonus: number;
  assistBonus: number;
  seasons: number;
  /** What they actually said about you. */
  pitch: string;
  /** 0-100, how good the club is — drives everything downstream. */
  strength: number;
}

const LADDER: { division: CareerDivision; clubs: readonly string[]; strength: number }[] = [
  { division: "premier", clubs: PREMIER_LEAGUE_CLUBS, strength: 80 },
  { division: "championship", clubs: CHAMPIONSHIP_CLUBS, strength: 68 },
  { division: "league_one", clubs: LEAGUE_ONE_CLUBS, strength: 58 },
  { division: "league_two", clubs: LEAGUE_TWO_CLUBS, strength: 50 },
  { division: "national_league", clubs: NATIONAL_LEAGUE_CLUBS, strength: 42 },
];

/**
 * Below this, nobody signs you — at all, on any roll.
 *
 * ── Why this moved from 22 to 30, and why the bar was never the real problem ──
 *
 * Failing the trial was supposed to be a real outcome. Measured, under the
 * scoring model in trial.ts today, it was not one: 4,000 trials at every
 * quality from 10 % to 100 % produced a step function. Anything scoring under
 * the bar brought nobody, and anything scoring over it brought somebody
 * **100.0 % of the time** — at 25 % quality, at 50 %, at every level. Playing
 * a genuinely mediocre afternoon could not cost you a contract, so the whole
 * free-agent life was a substantial build that almost nobody would ever see.
 *
 * Two things caused that, and raising this number only fixes the first:
 *
 *  1. `appetite` peaked at exactly 1 — a certainty, not a chance. A score
 *     sitting on any rung's peak was signed by that rung every single time.
 *     `keenness` is the fix: how likely ANYBODY is takes a separate, rising
 *     ramp, and the bell curve below only decides WHICH rung.
 *  2. The "must not come back with nothing" fallback at the bottom of
 *     `generateScoutOffers` ran for every score above this bar, which turned
 *     any run of bad rolls back into a guaranteed signing. It is now gated on
 *     `GUARANTEED_INTEREST_ABOVE` — a genuinely good trial still cannot be
 *     left in limbo, a mediocre one genuinely can.
 *
 * Decided directly: failure should be a real possibility, not a rare safety
 * net. The target was roughly a coin flip at 50 % quality, and that is what
 * these numbers measure at — see `tests/star/scoutOffers.mts`, which asserts
 * the measured rate at 25/50/75/100 % quality rather than trusting the shape.
 */
export const NO_INTEREST_BELOW = 30;

/**
 * …and the same bar for a SECOND look, which is deliberately lower.
 *
 * The way back is downward into the leagues (see `grantTrial`, freeAgent.ts):
 * a man nobody in the Premier League wanted is being watched by a National
 * League club, and that club is not asking for 30 out of 100. A retrial score
 * that would have brought nobody first time around genuinely brings somebody
 * down the bottom of the ladder.
 */
export const RETRIAL_NO_INTEREST_BELOW = 18;

/**
 * The score at which every rung that wants you at all is genuinely coming.
 *
 * `keenness` ramps from 0 at the bar to 1 here, and multiplies the bell curve
 * below. This is the dial that makes a mediocre trial a coin flip rather than
 * a certainty: it is how seriously the watching clubs take you AT ALL, kept
 * separate from which rung of the ladder you fit on.
 */
const FULLY_KEEN_AT = 95;
const RETRIAL_FULLY_KEEN_AT = 36;

/**
 * Above this, somebody always comes.
 *
 * A trial clearly good enough to be signed must not come back with nothing
 * because every roll went against it — that reads as a bug, not as bad luck.
 * That was always the intent of the fallback at the bottom of
 * `generateScoutOffers`; what was wrong was that it applied to EVERY score
 * above `NO_INTEREST_BELOW`, which is what made a 50 %-quality trial a
 * guaranteed contract. It now only protects a trial that genuinely earned it.
 */
export const GUARANTEED_INTEREST_ABOVE = 70;
export const RETRIAL_GUARANTEED_INTEREST_ABOVE = 60;

/** What a second look changes about a club's decision. */
export interface ScoutContext {
  /**
   * This is a trial a free agent earned back, not the one his career opened
   * with. Lowers the bar and moves every rung's peak down the score range —
   * see `appetite`.
   */
  retrial?: boolean;
}

/** A weekly wage for a division, before anything about you. Anchored to the
 *  paying club's level, which is the fix §4.2 of the rework asks for. */
function baseWage(division: CareerDivision): number {
  switch (division) {
    case "premier": return 6 * MONEY_SCALE;
    case "championship": return 2 * MONEY_SCALE;
    case "league_one": return 1 * MONEY_SCALE;
    case "league_two": return 0.6 * MONEY_SCALE;
    case "national_league": return 0.3 * MONEY_SCALE;
  }
}

/** Where on the 0-100 score range each rung is most interested. */
const PEAK: Record<CareerDivision, number> = {
  premier: 96, championship: 80, league_one: 64, league_two: 48, national_league: 32,
};

/** How wide each rung's interest runs either side of its peak. */
const SPREAD = 22;

/**
 * Where each rung peaks on a SECOND look — every peak moved down a rung of the
 * ladder, which means up the score range.
 *
 * ── Which direction "down a rung" goes, and the exploit the other one opens ──
 *
 * The first cut of this dropped every peak by a flat 16 points of score. It
 * measured backwards: a retrial at 75 % quality reached the Premier League
 * 90.5 % of the time against a first trial's 22.4 %, because a peak at a lower
 * SCORE means a given score reaches a HIGHER division. That is a re-roll with
 * a prize on it — fail on purpose, take the second look, come out at a better
 * club — which is the exact thing the four-tap week-skip fix exists to close.
 *
 * So the peaks move the other way. Each rung now wants the score the rung
 * above it used to want, so the same afternoon that first time brought a
 * League Two club brings a National League one on the second look: the way
 * back is genuinely downward into the leagues (§3.7 of the rework, and
 * `grantTrial`'s own note in freeAgent.ts). What makes the second look EASIER
 * is the bar and the keenness ramp, not the badge on the offer.
 *
 * The National League does not move — there is no rung below it to be pushed
 * onto, and somebody has to be the club that takes a chance on a bad
 * afternoon. Its peak drops slightly instead, so it genuinely catches the
 * bottom of the range rather than leaving it empty.
 *
 * The Premier League's 110 is deliberately past the top of the range rather
 * than out of reach: a perfect retrial still lands there about two times in
 * three, so a second chance is not a ceiling — it is just no longer the
 * quickest way up.
 */
const RETRIAL_PEAK: Record<CareerDivision, number> = {
  premier: 110, championship: 94, league_one: 76, league_two: 56, national_league: 26,
};

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * How much each rung wants you, given how you played, as a real probability.
 *
 * Two independent things, deliberately separated — conflating them is what
 * made every trial above the bar a guaranteed contract:
 *
 *  • **Which rung.** A curve per division rather than a threshold: each one
 *    has a score it is most interested at, and interest falls away either
 *    side — a National League club is not chasing the boy who tore the trial
 *    up, and a Premier League club is not watching the one who could not hit
 *    the target.
 *  • **Whether anybody at all.** `keenness`, a straight ramp from nothing at
 *    the bar to everything at `FULLY_KEEN_AT`. This used to be missing
 *    entirely, which meant the curve peaked at exactly 1 and a score sitting
 *    on a rung's peak was signed by that rung 100 % of the time.
 */
function appetite(division: CareerDivision, score: number, ctx: ScoutContext = {}): number {
  const peak = (ctx.retrial ? RETRIAL_PEAK : PEAK)[division];
  const d = (score - peak) / SPREAD;
  const shape = Math.exp(-d * d);

  const bar = ctx.retrial ? RETRIAL_NO_INTEREST_BELOW : NO_INTEREST_BELOW;
  const keenAt = ctx.retrial ? RETRIAL_FULLY_KEEN_AT : FULLY_KEEN_AT;
  const keenness = clamp01((score - bar) / Math.max(1, keenAt - bar));

  return shape * keenness;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const PITCHES = [
  "We watched you all afternoon. We'd like you here.",
  "You're rough, but there's something there. Come and work.",
  "We've had our eye out for someone like you.",
  "You'll have to earn it, but the door's open.",
  "Sign, and we'll get you playing.",
];

const BIG_PITCHES = [
  "We don't do this often. We're doing it for you.",
  "You were the best thing on that pitch today.",
  "You'll start in the youth side. You won't stay there.",
];

/**
 * Who came in for you.
 *
 * Returns an empty list when nobody did, which is a real, designed outcome —
 * see NO_INTEREST_BELOW and the free-agent life.
 */
export function generateScoutOffers(
  trialScore: number, rng: () => number, ctx: ScoutContext = {},
): ScoutOffer[] {
  const score = Math.max(0, Math.min(100, Number.isFinite(trialScore) ? trialScore : 0));
  const bar = ctx.retrial ? RETRIAL_NO_INTEREST_BELOW : NO_INTEREST_BELOW;
  if (score < bar) return [];

  const offers: ScoutOffer[] = [];
  const takenClubs = new Set<string>();

  for (const rung of LADDER) {
    const want = appetite(rung.division, score, ctx);
    // Interest is a chance, not a guarantee — the same trial brings different
    // clubs on different days, which is what stops this being a lookup table.
    if (rng() > want) continue;

    let club = pick(rung.clubs, rng);
    // A club that already offered does not offer twice.
    for (let tries = 0; tries < 6 && takenClubs.has(club); tries++) club = pick(rung.clubs, rng);
    if (takenClubs.has(club)) continue;
    takenClubs.add(club);

    // A better trial earns a better deal at the SAME club, not just a better
    // club — so the number matters even when the badge does not change.
    const quality = 0.8 + (score / 100) * 0.5;
    const wage = Math.round(baseWage(rung.division) * quality);
    offers.push({
      club,
      division: rung.division,
      wage,
      goalBonus: Math.round(wage * 0.1),
      assistBonus: Math.round(wage * 0.07),
      // A club further up the ladder ties you down for longer.
      seasons: rung.division === "premier" || rung.division === "championship" ? 3 : 2,
      pitch: rung.division === "premier" && score > 85 ? pick(BIG_PITCHES, rng) : pick(PITCHES, rng),
      strength: rung.strength,
    });
  }

  // ── The one thing that is still a guarantee, and the line it now sits behind ──
  //
  // A trial clearly good enough to be signed must not come back with nothing
  // because every roll went against it — that reads as a bug, not as bad luck.
  // But this used to run for ANY score above the bar, which is most of why a
  // 50 %-quality afternoon was signed 100 % of the time: however the five rolls
  // went, this put a club back on the screen. It now protects only a trial that
  // genuinely earned the protection — below `GUARANTEED_INTEREST_ABOVE` an
  // empty list is a real, designed outcome and the free-agent life is where you
  // are going.
  const guaranteedAbove = ctx.retrial
    ? RETRIAL_GUARANTEED_INTEREST_ABOVE : GUARANTEED_INTEREST_ABOVE;
  if (!offers.length && score >= guaranteedAbove) {
    const rung = LADDER.reduce((best, r) =>
      appetite(r.division, score, ctx) > appetite(best.division, score, ctx) ? r : best, LADDER[0]);
    const wage = Math.round(baseWage(rung.division) * (0.8 + (score / 100) * 0.5));
    offers.push({
      club: pick(rung.clubs, rng),
      division: rung.division,
      wage,
      goalBonus: Math.round(wage * 0.1),
      assistBonus: Math.round(wage * 0.07),
      seasons: 2,
      pitch: pick(PITCHES, rng),
      strength: rung.strength,
    });
  }

  // Best club first, which is the order a player reads them in anyway.
  return offers.sort((a, b) => b.strength - a.strength);
}

/** For the screen: which league an offer is from, in words. */
export function offerLeagueName(offer: ScoutOffer): string {
  return leagueNameFor(offer.division);
}

/** Every club in a division — what `attachClub` needs to build the league. */
export function clubsForDivision(division: CareerDivision): string[] {
  return [...(LADDER.find(r => r.division === division)?.clubs ?? PREMIER_LEAGUE_CLUBS)];
}
