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
 * Below this, nobody signs you.
 *
 * Deliberately low. Failing the trial has to be a real outcome or the whole
 * free-agent life is decoration — but it should be something you did, not
 * something that happened to you, and a bar at a third of the marks available
 * is one a player who tried will clear.
 */
export const NO_INTEREST_BELOW = 22;

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

/**
 * How much each rung wants you, given how you played.
 *
 * A curve per division rather than a threshold: each one has a score it is
 * most interested at, and interest falls away either side — a National League
 * club is not chasing the boy who tore the trial up, and a Premier League club
 * is not watching the one who could not hit the target.
 */
function appetite(division: CareerDivision, score: number): number {
  const peak: Record<CareerDivision, number> = {
    premier: 96, championship: 80, league_one: 64, league_two: 48, national_league: 32,
  };
  const spread = 22;
  const d = (score - peak[division]) / spread;
  return Math.exp(-d * d);
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
export function generateScoutOffers(trialScore: number, rng: () => number): ScoutOffer[] {
  const score = Math.max(0, Math.min(100, Number.isFinite(trialScore) ? trialScore : 0));
  if (score < NO_INTEREST_BELOW) return [];

  const offers: ScoutOffer[] = [];
  const takenClubs = new Set<string>();

  for (const rung of LADDER) {
    const want = appetite(rung.division, score);
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

  // A trial clearly good enough to be signed must not come back with nothing
  // because every roll went against it — that reads as a bug, not as bad luck.
  if (!offers.length) {
    const rung = LADDER.reduce((best, r) =>
      appetite(r.division, score) > appetite(best.division, score) ? r : best, LADDER[0]);
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
