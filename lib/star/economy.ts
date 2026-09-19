import type { CareerDivision } from "./calendar";
import { DIVISION_ORDER } from "./calendar";
import { clubStanding, clubReputation } from "./clubReputation";

/**
 * THE ECONOMY — ONE PLACE, ONE CURVE.
 *
 * ── Why this file exists ──
 *
 * The product owners' verdict, after playing: "I don't think someone signing
 * at a National League club should start at a 5,000 signing-on fee… I
 * actually think all of the wages are too big. Pretty sure in NSS, you just
 * start with like 10 a week… I kind of like how NSS is, where you earn way
 * lower than you would in real life. I don't think it makes as much sense to
 * earn loads, because then your shop just becomes hell." And, on the arc
 * rather than any single figure: "If you take 4 or 5 seasons to get there,
 * then it starts just exploding."
 *
 * And the diagnosis underneath it: "every part of this was tuned separately
 * and in isolation, with no single guiding curve." That is exactly what was
 * true. A weekly wage was five hardcoded division constants in
 * `scoutOffers.ts`; the signing-on fee was one flat 5,000 in
 * `careerFlow.ts`; every shop price was a hand-typed absolute figure in
 * `shopDefaults.ts` with no relationship to any of them. Nothing tied a
 * price to an income, so "how many weeks does this item cost" was a number
 * nobody could read anywhere.
 *
 * So: every personal-economy magnitude that a coherent recalibration has to
 * move TOGETHER lives here, and everything downstream derives from it.
 * Retuning the game's money means editing this file and nothing else.
 *
 * ── The one curve ──
 *
 * Three numbers describe the whole wage ladder:
 *
 *   `WAGE_FLOOR`  — what the smallest club at the bottom of the game pays.
 *   `DIVISION_STEP` — how much richer each division is than the one below.
 *   `BAND_WIDTH`  — how much richer a division's biggest club is than its
 *                   smallest.
 *
 * Everything else — every division band, every club's wage, the signing-on
 * fee, every price in the shop — is derived from those three plus a handful
 * of named shares. Change `WAGE_FLOOR` and the entire game rescales with the
 * shop still costing the same number of weeks.
 *
 * ── The guarantee, and why it is structural rather than careful ──
 *
 * "A division's best club must never out-pay the division above's worst."
 * That holds here BY CONSTRUCTION, from a single inequality:
 *
 *     DIVISION_STEP > BAND_WIDTH
 *
 * A division's band runs from `floor` to `floor × BAND_WIDTH`, and the next
 * division's floor is `floor × DIVISION_STEP`. If the step outgrows the
 * width, consecutive bands cannot touch — and every wage is clamped into its
 * own band before it leaves this file. `tests/star/clubReputation.mts`
 * asserts it over every club in the game at every trial score, and it would
 * have to assert it whatever numbers these three held.
 *
 * ── What is NOT in here yet, stated plainly ──
 *
 * Sponsorship fees (`sponsors.ts` / `sponsors.feeScale`), dilemma payouts
 * (`dilemmas.ts`), the retirement testimonial (`retirement.ts`), influence
 * pricing (`governingBodies.ts`), the son mechanic (`clubPowers.ts`) and the
 * additive reputation bumps in transfer/relegation offers (`transfers.ts`,
 * `relegationOffers.ts`) are all still on the flat ×2000 `MONEY_SCALE`
 * rescale of 14 Sep 2026, independent of anything here. They are income and
 * spending on the SAME wallet, so a recalibration of this file that leaves
 * them alone will leave them mis-sized — see the handover report. They were
 * deliberately not moved in this pass: they live in files this workstream
 * does not own, and moving them blind while the guiding curve is still being
 * designed would be guessing twice.
 */

// ── The three numbers everything else comes from ────────────────────────

/**
 * A week's wage for the smallest club in the National League, for a player
 * who barely earned the contract.
 *
 * Anchored to something real rather than chosen: `FREE_AGENT_WEEKLY_PAY`
 * (freeAgent.ts) is ★10 a week and is already documented there as being on
 * the intended, NSS-flavoured scale — "a man nobody will sign" — and the
 * owners independently reached for the same figure ("in NSS, you just start
 * with like 10 a week"). A bottom-of-the-ladder professional should be a
 * small multiple of that, not a different order of magnitude.
 *
 * PROVISIONAL. This is the single biggest lever on the whole game's money
 * and is expected to be set by the progression framework.
 */
export const WAGE_FLOOR = 20;

/** How much richer each rung of the ladder is than the one below it. */
export const DIVISION_STEP = 3.2;

/** How much more a division's biggest club pays than its smallest.
 *  MUST stay below `DIVISION_STEP` — see the guarantee above. */
export const BAND_WIDTH = 3.0;

/**
 * How much of a club's own band a mediocre signing still gets.
 *
 * A trial score moves you between this share of the club's ceiling and all
 * of it. At 1 the trial would be worth nothing; at 0 a poor trial would earn
 * literally the division floor at any club. Keeps "a better trial earns a
 * better deal at the SAME club" — the thing `scoutOffers.ts`'s old
 * `quality` multiplier was for — without letting it reach outside the band
 * and break the guarantee, which is exactly what a free multiplier did.
 */
export const TRIAL_WAGE_SHARE = 0.55;

/**
 * How much of a division's band even its smallest club can reach.
 *
 * Without this the bottom club in a division pays the flat division floor
 * and nothing else, so the worst club in the league is the only one whose
 * wage a trial score cannot move at all.
 */
export const CLUB_WAGE_SHARE = 0.25;

// ── The ladder, derived ─────────────────────────────────────────────────

export interface WageBand {
  /** The least anybody in this division earns, per week. */
  floor: number;
  /** The most anybody in this division earns, per week. */
  ceiling: number;
}

/** Bottom rung first, so the ladder is built upwards from `WAGE_FLOOR`. */
const LADDER_UP: CareerDivision[] = [...DIVISION_ORDER].reverse();

export const WAGE_BANDS: Record<CareerDivision, WageBand> = (() => {
  const out = {} as Record<CareerDivision, WageBand>;
  let floor = WAGE_FLOOR;
  for (const division of LADDER_UP) {
    out[division] = { floor, ceiling: floor * BAND_WIDTH };
    floor *= DIVISION_STEP;
  }
  return out;
})();

/**
 * What this club offers this player, per week.
 *
 * `trialQuality` is 0-1 — how well the afternoon went. Absent (a transfer,
 * a renewal, anything that is not a trial) it reads as a solid 0.75 rather
 * than as a perfect score, so a club's "ordinary" wage is a real number
 * something else can ask for without implying a flawless audition.
 */
export function weeklyWageFor(
  club: string, division: CareerDivision, trialQuality = 0.75,
): number {
  const band = WAGE_BANDS[division] ?? WAGE_BANDS.national_league;
  const span = band.ceiling - band.floor;

  // How high this particular club could go, if you tore the trial up.
  const standing = clubStanding(club, division);
  const ceiling = band.floor + (CLUB_WAGE_SHARE + standing * (1 - CLUB_WAGE_SHARE)) * span;

  // …and how much of its own ceiling it actually offers you.
  const q = Math.max(0, Math.min(1, Number.isFinite(trialQuality) ? trialQuality : 0));
  const reach = TRIAL_WAGE_SHARE + q * (1 - TRIAL_WAGE_SHARE);
  const wage = band.floor + (ceiling - band.floor) * reach;

  // Clamped into the band explicitly. Nothing above can currently leave it,
  // and this is what makes that a property of the function rather than a
  // property of today's constants.
  return Math.max(1, Math.round(Math.max(band.floor, Math.min(band.ceiling, wage))));
}

// ── The signing-on fee ──────────────────────────────────────────────────

/**
 * How many weeks' wage a club hands over on the day it signs you.
 *
 * Both ends matter. A National League club pays a token amount — a couple
 * of weeks, which against a ★20-ish wage is pocket money and is the point.
 * A Premier League giant pays a genuine windfall, because it is a genuine
 * windfall. Scaled by the club's RAW reputation rather than its standing in
 * its own division, deliberately: the fee is the one place a club's real
 * stature should read across the whole game, so a relegated West Ham signs
 * you like the big club it is rather than like the second tier it is in.
 */
export const SIGNING_ON_WEEKS_MIN = 2;
export const SIGNING_ON_WEEKS_MAX = 12;

/** What `attachClub` pays on the first contract of a career. */
export function signingOnFee(club: string, wage: number): number {
  const rep = Math.max(0, Math.min(100, clubReputation(club))) / 100;
  const weeks = SIGNING_ON_WEEKS_MIN + rep * (SIGNING_ON_WEEKS_MAX - SIGNING_ON_WEEKS_MIN);
  return Math.max(1, Math.round(wage * weeks));
}

// ── The shop ladder ─────────────────────────────────────────────────────

/**
 * FIVE SHOP TIERS, ONE PER RUNG OF THE LADDER.
 *
 * The complaint was specific: "there's stuff in the store from all the way
 * up to 5K and nothing has changed in the store. There's no tiered items,
 * there's no change to the boots, nothing." Both halves were true — the
 * catalogue was a flat list of absolute prices with no grouping in the data
 * and none in the UI, so there was no visible progression through it at all.
 *
 * A tier is anchored to the division whose wage it is priced against, and an
 * item's price is written as WEEKS OF THAT WAGE. That is the join the whole
 * economy was missing: "how much of a week does this cost" is now a number
 * you can read straight off the catalogue, and it stays the same number when
 * the wage ladder is retuned.
 *
 * The practical effect: a Starter item is a couple of weeks' work on a
 * National League wage — a real slog, reachable — and a World Class item is
 * simply not purchasable until you are playing at that level, however long
 * you save, because a season's National League wages does not add up to one.
 */
export type ShopTierId = "starter" | "semi_pro" | "pro" | "elite" | "world_class";

export interface ShopTier {
  id: ShopTierId;
  label: string;
  /** The division whose weekly wage this tier's prices are written against. */
  anchor: CareerDivision;
  blurb: string;
}

export const SHOP_TIERS: ShopTier[] = [
  { id: "starter", label: "Starter", anchor: "national_league",
    blurb: "Non-league money. A couple of weeks' wages." },
  { id: "semi_pro", label: "Semi-Pro", anchor: "league_two",
    blurb: "What a League Two pro can actually afford." },
  { id: "pro", label: "Pro", anchor: "league_one",
    blurb: "Real money. You need to be playing regularly." },
  { id: "elite", label: "Elite", anchor: "championship",
    blurb: "Championship wages or a very good season." },
  { id: "world_class", label: "World Class", anchor: "premier",
    blurb: "Top-flight money. Out of reach until you get there." },
];

/**
 * The wage a tier's prices are written against — the MIDPOINT of its
 * anchor division's band, not its floor or its ceiling, so a tier is priced
 * for an ordinary player at that level rather than for the division's best
 * or worst paid.
 */
export function tierAnchorWage(tier: ShopTierId): number {
  const t = SHOP_TIERS.find(s => s.id === tier) ?? SHOP_TIERS[0];
  const band = WAGE_BANDS[t.anchor];
  return (band.floor + band.ceiling) / 2;
}

/**
 * A price, from a tier and how many weeks of that tier's wage it costs.
 *
 * Rounded to something a player reads as a price rather than as a
 * calculation — two significant figures at the small end, wider steps as
 * the numbers grow, the same instinct `niceMoneyStep` (money.ts) already
 * applies to a stepper.
 */
export function tierPrice(tier: ShopTierId, weeks: number): number {
  const raw = tierAnchorWage(tier) * weeks;
  const step = raw < 100 ? 5 : raw < 1_000 ? 25 : raw < 10_000 ? 100 : raw < 100_000 ? 500 : 5_000;
  return Math.max(step, Math.round(raw / step) * step);
}

export const SHOP_TIER_ORDER: ShopTierId[] = SHOP_TIERS.map(t => t.id);
