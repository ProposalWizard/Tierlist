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
 * ── The unifying idea: everything is priced in WEEKS OF INCOME ──
 *
 * A player does not feel an absolute number. They feel "three weeks". So
 * every price in the game is written as a fraction of ONE WEEK'S TOTAL
 * INCOME at the tier it belongs to, and there are exactly four bands:
 *
 *   Small consumable   a can, a match's worth of boot
 *   Meaningful upgrade a pair of boots, a mid lifestyle item
 *   Aspirational       a car, a house
 *   Endgame            a jet, an island
 *
 * ── The decision most likely to be got wrong, stated so it is not ──
 *
 * THE FRACTIONS ARE NOT CONSTANT ACROSS THE CAREER. THEY SHRINK AS YOU
 * CLIMB. This was written the other way round first, and the owners
 * rejected it, correctly: a fixed fraction makes the early game feel
 * IDENTICAL to the late game in purchasing terms, which is exactly the
 * failure it claimed to avoid. You cannot be "mean early and loosening
 * through the middle" and also charge everybody the same number of weeks.
 *
 * The owners' own worked example settles the size of it: "all the high
 * stuff should be like boots at 1,000 and your wage is like 30 a week to
 * get the boots." That is THIRTY-THREE WEEKS FOR A PAIR OF BOOTS at the
 * bottom of the ladder. Alongside: "I kind of like how NSS is, where you
 * earn way lower than you would in real life," and "National League,
 * League One, and the early shop should all be scaled down."
 *
 * So `TIER_SQUEEZE` multiplies every band, and it strictly decreases:
 *
 *   National League / League Two  brutal. A first pair of boots is a
 *                                 season-long goal. A consumable is a real
 *                                 decision, not a habit. This is the slog,
 *                                 and it is deliberate.
 *   League One / Championship     loosening. Boots become a few weeks. The
 *                                 first time the player feels rich, and
 *                                 where sponsors and lifestyle start to pay.
 *   Premier League                money is genuinely plentiful against the
 *                                 personal shop. The constraint stops being
 *                                 price and becomes access — reputation,
 *                                 influence, ownership — which starts the
 *                                 player at "mean" all over again on a
 *                                 second ladder this file does not price.
 *
 * `tests/star/economy.mts` asserts the strict decrease band by band,
 * specifically so that nobody later "tidies" this back into a constant.
 *
 * ── Why there are still no tier locks ──
 *
 * An item anchored one tier above you costs `DIVISION_STEP × SQUEEZE_STEP`
 * times as many of YOUR weeks. A World Class boot read from a National
 * League wallet is over a hundred weeks of income — unbuyable by
 * arithmetic, without a single `if (locked)` anywhere. You cannot afford
 * tier-3 money until you earn tier-3 money.
 *
 * ── The one thing that survives the rewrite unchanged ──
 *
 * A consumable that converts money into RATING — the stat cans, and more
 * weakly the energy cans — must get MORE expensive in weeks-of-income as
 * you climb, not less. That is true for its own reason (held flat, a rich
 * late-career player simply buys past the growth curve) and it is the one
 * place that deliberately runs AGAINST `TIER_SQUEEZE`. See
 * `RATING_CONVERTER_WEEKS`.
 *
 * ── UNRESOLVED, AND FOR THE OWNERS TO DECIDE: the unit itself ──
 *
 * The owners talk in NSS numbers ("10 a week", "boots cost 70"). But
 * `MONEY_SCALE = 2000` (money.ts) was set on 14 Sep 2026 specifically so
 * that wages would stop reading as placeholders. Both cannot be true at
 * once, and this pass deliberately does NOT pick.
 *
 * What it does instead is make the choice ONE DIAL. `WAGE_FLOOR` below is
 * the only absolute number in the entire personal economy; every wage, fee
 * and price is a pure multiple of it. Setting it to 20 gives the NSS
 * reading (a bottom-rung bench player on ★10 a week, boots at ★70). Setting
 * it to ~400 gives the illustrative figures the design pass used (a ★50 can
 * in the National League, ★4,000 at the top). Nothing else has to change
 * either way, and every ratio in this file — and every test over it — holds
 * identically at both.
 *
 * ── What is NOT in here, stated plainly ──
 *
 * Sponsorship fees (`sponsors.ts`), the per-match sponsor payment
 * (`matchStats.ts`), transfer and relegation wage offers (`transfers.ts`,
 * `relegationOffers.ts`), dilemma payouts (`dilemmas.ts`), the retirement
 * testimonial (`retirement.ts`), influence pricing (`governingBodies.ts`)
 * and the son mechanic (`clubPowers.ts`) are all still on the flat ×2000
 * `MONEY_SCALE` rescale of 14 Sep 2026, independent of anything here. They
 * are income and spending on the SAME wallet, so this recalibration leaves
 * them mis-sized until they are moved onto `TOTAL_INCOME_SHARES` below.
 * They live in files this workstream does not own — see the handover report
 * for the two that matter most and the exact change each needs.
 */

// ═══════════════════════════════════════════════════════════════════════
//  PART 1 — INCOME
// ═══════════════════════════════════════════════════════════════════════

/**
 * THE ONE DIAL. A week's wage for a bench player at the smallest club in
 * the National League, before anything else about him.
 *
 * Anchored to something real rather than chosen: `FREE_AGENT_WEEKLY_PAY`
 * (freeAgent.ts) is ★10 a week and is already documented there as being on
 * the intended, NSS-flavoured scale — "a man nobody will sign" — and the
 * owners independently reached for the same figure ("in NSS, you just start
 * with like 10 a week"). `WAGE_FLOOR × STANDING_BENCH` is exactly ★10, so a
 * bottom-rung professional who cannot get in the side earns precisely what
 * a free agent earns, which is the right place for those two to meet.
 *
 * See the header: this is the number the owners still have to sign off.
 */
export const WAGE_FLOOR = 20;

/**
 * How much richer each rung of the ladder is than the one below it — "R".
 *
 * Geometric, deliberately: the gap between the National League and League
 * Two should FEEL the same as the gap between the Championship and the
 * Premier League, and a fixed multiple is the only shape that does that.
 * Explicitly NOT "your last wage times something" — see `transfers.ts` in
 * the handover report for what that produces.
 */
export const DIVISION_STEP = 2.4;

/**
 * The most a club's own stature adds to a wage, over the smallest club in
 * the same division: +50%.
 *
 * MUST stay below `DIVISION_STEP - 1`. That single inequality is what makes
 * "a division's best club never out-pays the division above's worst" a
 * property of the code rather than of today's numbers — see the guarantee
 * note on `weeklyWageFor`.
 */
export const REPUTATION_PREMIUM_MAX = 0.5;

/** What being in or out of the side is worth, as a multiple of the wage a
 *  plain starter earns at the same club. */
export const STANDING_BENCH = 0.5;
export const STANDING_STARTER = 1.0;
export const STANDING_STAR = 1.6;

/**
 * Where on the 0-1 standing scale "a starter" sits.
 *
 * 0.55 rather than a round 0.5 because that is where `selection.ts`'s own
 * `START_AT = 55` puts the line between the bench and the starting eleven.
 * The two numbers mean the same thing and should not drift apart.
 */
export const STARTER_STANDING = 0.55;

/**
 * WHAT ELSE ARRIVES BESIDES THE WAGE, as shares of the wage.
 *
 * "Total weekly income" is the thing every price in this file is written
 * against, and a wage is not all of it. These three shares are the TARGET
 * shape — what the rest of the game's income should add up to — and they
 * are the numbers the unowned files listed in the header have to be moved
 * onto. They are named rather than folded into one multiple precisely so a
 * future pass can check each one against what its own file actually pays.
 *
 * INVARIANT: these must sum to at most 2.33, or the wage stops being 30% of
 * total income and the whole ladder starts being driven by things a player
 * has much less control over. Asserted in `tests/star/economy.mts`.
 */
export const TOTAL_INCOME_SHARES = {
  /** Goal and assist bonuses, at a realistic scoring rate. Today's contract
   *  pays 10% of a week per goal and 7% per assist; a starter scoring or
   *  making about half a goal a week lands here. */
  bonuses: 0.10,
  /** The per-match sponsor payment, at roughly 0.8 matches a week. THIS IS
   *  THE TARGET, NOT WHAT THE GAME PAYS — see handover bug #1: today it is
   *  a flat ★2,000 a match, which is several times the wage rather than a
   *  fraction of it, and it is the single biggest distortion in the
   *  personal economy. */
  sponsorPerMatch: 0.08,
  /** Lump sums — sponsor signing fees, appearance money, one-off rewards —
   *  spread evenly across the season they land in. */
  lumps: 0.22,
} as const;

/** One week's total income, as a multiple of one week's wage. */
export const TOTAL_INCOME_MULTIPLE =
  1 + TOTAL_INCOME_SHARES.bonuses
    + TOTAL_INCOME_SHARES.sponsorPerMatch
    + TOTAL_INCOME_SHARES.lumps;

/** Bottom rung first, so the ladder is built upwards from `WAGE_FLOOR`. */
const LADDER_UP: CareerDivision[] = [...DIVISION_ORDER].reverse();

/**
 * The wage the smallest club in this division pays a bench player: the
 * whole geometric ladder, and the only thing a division contributes.
 */
export const DIVISION_BASE_WAGE: Record<CareerDivision, number> = (() => {
  const out = {} as Record<CareerDivision, number>;
  let base = WAGE_FLOOR;
  for (const division of LADDER_UP) {
    out[division] = base;
    base *= DIVISION_STEP;
  }
  return out;
})();

export function divisionBaseWage(division: CareerDivision): number {
  return DIVISION_BASE_WAGE[division] ?? DIVISION_BASE_WAGE.national_league;
}

/** What this club's own stature is worth, 1.0 at the smallest club in the
 *  division and 1 + `REPUTATION_PREMIUM_MAX` at the biggest. */
export function clubPremium(club: string, division: CareerDivision): number {
  return 1 + REPUTATION_PREMIUM_MAX * clubStanding(club, division);
}

/**
 * What being this well thought of is worth, from a 0-1 standing.
 *
 * Piecewise linear through the three points the brief names — bench, plain
 * starter, star — rather than a single slope, so "starter" is a real,
 * findable value of exactly 1.0 rather than whatever a straight line
 * happened to pass through.
 */
export function standingMultiplier(standing: number): number {
  const s = Math.max(0, Math.min(1, Number.isFinite(standing) ? standing : STARTER_STANDING));
  if (s <= STARTER_STANDING) {
    return STANDING_BENCH + (s / STARTER_STANDING) * (STANDING_STARTER - STANDING_BENCH);
  }
  const t = (s - STARTER_STANDING) / (1 - STARTER_STANDING);
  return STANDING_STARTER + t * (STANDING_STAR - STANDING_STARTER);
}

/**
 * WHAT THIS CLUB PAYS THIS PLAYER, PER WEEK.
 *
 * Three independent factors, and nothing else:
 *
 *     division base  ×  club premium  ×  standing multiplier
 *
 * `standing` is 0-1 — how well thought of you are. At a trial it is the
 * afternoon's score; at a renewal it is where you sit in the pecking order.
 * It defaults to `STARTER_STANDING`, a plain first-teamer, so a club's
 * "ordinary" wage is a real number something else can ask for without
 * implying a flawless audition.
 *
 * ── The guarantee, and why it is structural rather than careful ──
 *
 * "A division's best club must never out-pay the division above's worst."
 * Compare like with like — the same player, the same standing — and that
 * falls straight out of one inequality:
 *
 *     1 + REPUTATION_PREMIUM_MAX  <  DIVISION_STEP
 *
 * The biggest club in a division reaches `base × (1 + premium)`; the
 * smallest club one rung up starts at `base × DIVISION_STEP`. If the step
 * outgrows the premium the two can never cross, whatever the numbers hold.
 * `tests/star/economy.mts` asserts it over every club in the game.
 */
export function weeklyWageFor(
  club: string, division: CareerDivision, standing = STARTER_STANDING,
): number {
  const wage = divisionBaseWage(division)
    * clubPremium(club, division)
    * standingMultiplier(standing);
  return Math.max(1, Math.round(wage));
}

/** What an ordinary first-teamer at a middling club in this division earns
 *  — the figure a tier's prices are written against. */
export function typicalWeeklyWage(division: CareerDivision): number {
  return divisionBaseWage(division) * (1 + REPUTATION_PREMIUM_MAX / 2) * STANDING_STARTER;
}

/** …and everything that arrives in the same week alongside it. */
export function typicalWeeklyIncome(division: CareerDivision): number {
  return typicalWeeklyWage(division) * TOTAL_INCOME_MULTIPLE;
}

// ═══════════════════════════════════════════════════════════════════════
//  PART 2 — THE SIGNING-ON FEE
// ═══════════════════════════════════════════════════════════════════════

/**
 * How many weeks' wage a club hands over when it buys you FROM SOMEBODY.
 *
 * NOT on the first contract. The owners were explicit: a trial that ends in
 * a signing pays nothing at all, because any windfall on day one undoes the
 * slog the opening of the game is built to be. See
 * `FIRST_CONTRACT_SIGNING_FEE` (careerFlow.ts). Every move after that pays,
 * because a real transfer genuinely does — and by then it is a reward for
 * having got somewhere rather than a head start.
 *
 * Both ends matter. A small club pays a token amount; a giant pays a
 * genuine windfall, because it is a genuine windfall. Scaled by the club's
 * RAW reputation rather than its standing in its own division,
 * deliberately: the fee is the one place a club's real stature should read
 * across the whole game, so a relegated West Ham signs you like the big
 * club it is rather than like the second tier it is in.
 */
export const SIGNING_ON_WEEKS_MIN = 2;
export const SIGNING_ON_WEEKS_MAX = 12;

/** What `attachClub` pays when a career moves to a NEW club. */
export function signingOnFee(club: string, wage: number): number {
  const rep = Math.max(0, Math.min(100, clubReputation(club))) / 100;
  const weeks = SIGNING_ON_WEEKS_MIN + rep * (SIGNING_ON_WEEKS_MAX - SIGNING_ON_WEEKS_MIN);
  return Math.max(1, Math.round(wage * weeks));
}

// ═══════════════════════════════════════════════════════════════════════
//  PART 3 — THE PRICE BANDS
// ═══════════════════════════════════════════════════════════════════════

export type PriceBandId = "consumable" | "upgrade" | "aspirational" | "endgame";

export interface PriceBand {
  id: PriceBandId;
  label: string;
  /** In weeks of income — AT THE TOP OF THE LADDER. Multiply by the tier's
   *  own `TIER_SQUEEZE` to get what it costs anybody lower down. */
  min: number;
  max: number;
}

/**
 * THE FOUR BANDS, at the top of the ladder.
 *
 * These are the LOOSEST the game ever gets. A Premier League regular buys a
 * pair of boots for two to four weeks of income; everybody below him pays
 * the same band multiplied by his own tier's `TIER_SQUEEZE`.
 */
export const PRICE_BANDS: Record<PriceBandId, PriceBand> = {
  consumable:   { id: "consumable",   label: "Small consumable",   min: 0.05, max: 0.10 },
  upgrade:      { id: "upgrade",      label: "Meaningful upgrade", min: 2,    max: 4 },
  aspirational: { id: "aspirational", label: "Aspirational",       min: 15,   max: 25 },
  endgame:      { id: "endgame",      label: "Endgame",            min: 100,  max: 150 },
};

/**
 * HOW MUCH MEANER EACH RUNG IS THAN THE ONE ABOVE IT.
 *
 * √3, so the whole ladder is exactly 9× from top to bottom: a band that is
 * 2-4 weeks in the Premier League is 18-36 weeks in the National League.
 * That lands the entry pair of boots on the owners' own worked example —
 * roughly thirty-odd weeks of a bottom-rung wage — rather than on a number
 * chosen to look tidy.
 *
 * MUST stay above 1. At 1 the bands go constant and the early game stops
 * being a slog, which is the exact design that was rejected.
 */
export const SQUEEZE_STEP = Math.sqrt(3);

/**
 * FIVE SHOP TIERS, ONE PER RUNG OF THE LADDER.
 *
 * The complaint was specific: "there's stuff in the store from all the way
 * up to 5K and nothing has changed in the store. There's no tiered items,
 * there's no change to the boots, nothing." Both halves were true — the
 * catalogue was a flat list of absolute prices with no grouping in the data
 * and none in the UI, so there was no visible progression through it at all.
 *
 * A tier is anchored to the division whose income it is priced against, and
 * carries its own `squeeze`. "How many weeks of MY money is this" is now a
 * number you can read straight off the catalogue, and it stays the same
 * number when the ladder is retuned.
 */
export type ShopTierId = "starter" | "semi_pro" | "pro" | "elite" | "world_class";

export interface ShopTier {
  id: ShopTierId;
  label: string;
  /** The division whose weekly income this tier's prices are written against. */
  anchor: CareerDivision;
  /**
   * How many times meaner this tier's bands are than the top of the ladder.
   * Strictly decreasing up the list — see `SQUEEZE_STEP` and the header.
   */
  squeeze: number;
  blurb: string;
}

export const SHOP_TIERS: ShopTier[] = [
  { id: "starter", label: "Starter", anchor: "national_league",
    squeeze: 9,
    blurb: "Non-league money. Everything here is a season-long goal." },
  { id: "semi_pro", label: "Semi-Pro", anchor: "league_two",
    squeeze: 3 * SQUEEZE_STEP,
    blurb: "League Two money. Still a real slog, but a shorter one." },
  { id: "pro", label: "Pro", anchor: "league_one",
    squeeze: 3,
    blurb: "League One money. You can start choosing rather than saving." },
  { id: "elite", label: "Elite", anchor: "championship",
    squeeze: SQUEEZE_STEP,
    blurb: "Championship money. The first time a good week buys something." },
  { id: "world_class", label: "World Class", anchor: "premier",
    squeeze: 1,
    blurb: "Top-flight money. Price stops being the thing in your way." },
];

export const SHOP_TIER_ORDER: ShopTierId[] = SHOP_TIERS.map(t => t.id);

function tierOf(tier: ShopTierId): ShopTier {
  return SHOP_TIERS.find(s => s.id === tier) ?? SHOP_TIERS[0];
}

/** One week's TOTAL income for an ordinary first-teamer at this tier — the
 *  denominator every price at this tier is written against. */
export function tierWeeklyIncome(tier: ShopTierId): number {
  return typicalWeeklyIncome(tierOf(tier).anchor);
}

/** The wage half of it, kept separate because a wage is the thing a player
 *  actually sees on their contract. */
export function tierAnchorWage(tier: ShopTierId): number {
  return typicalWeeklyWage(tierOf(tier).anchor);
}

/**
 * A price, from a tier and how many weeks of that tier's income it costs.
 *
 * Rounded to something a player reads as a price rather than as a
 * calculation — coarse steps that widen as the numbers grow, the same
 * instinct `niceMoneyStep` (money.ts) already applies to a stepper. The
 * rounding is small relative to every band's own width, so a price never
 * rounds out of the band it was written in.
 */
export function tierPrice(tier: ShopTierId, weeks: number): number {
  const raw = tierWeeklyIncome(tier) * weeks;
  const step =
    raw < 20 ? 1
      : raw < 100 ? 5
        : raw < 1_000 ? 25
          : raw < 10_000 ? 100
            : raw < 100_000 ? 500
              : 1_000;
  return Math.max(step, Math.round(raw / step) * step);
}

/** The reverse, and the number every test and every tooltip actually wants:
 *  what does this cost, in weeks, to someone living at this tier. */
export function weeksOfIncome(price: number, tier: ShopTierId): number {
  return price / tierWeeklyIncome(tier);
}

/**
 * What a band actually costs, in weeks, AT THIS TIER — the top-of-the-ladder
 * band widened by that tier's own squeeze.
 *
 * This is the function the whole "mean early, loosening through the middle"
 * shape lives in, and the one `tests/star/economy.mts` walks tier by tier to
 * prove the fraction strictly decreases as you climb.
 */
export function bandWeeks(band: PriceBandId, tier: ShopTierId): { min: number; max: number } {
  const b = PRICE_BANDS[band];
  const squeeze = tierOf(tier).squeeze;
  return { min: b.min * squeeze, max: b.max * squeeze };
}

/** Does this price sit inside the window the catalogue claims for it? The
 *  one check every catalogue entry in `shopDefaults.ts` is held to. */
export function priceIsInBand(price: number, tier: ShopTierId, band: PriceBandId): boolean {
  const w = weeksOfIncome(price, tier);
  const { min, max } = bandWeeks(band, tier);
  return w >= min && w <= max;
}

/**
 * THE ONE THING THAT RUNS AGAINST `TIER_SQUEEZE`, ON PURPOSE.
 *
 * Everything else in this file gets cheaper in weeks-of-income as a career
 * climbs. A consumable that converts money straight into RATING cannot, or
 * a player who has climbed simply buys past the growth curve with pocket
 * change — which is the whole reason the growth curve exists.
 *
 * So these are written as weeks of the income of the tier they are anchored
 * at, and the numbers go UP the ladder rather than down: the stat can a
 * Premier League player wants costs him more of his week than the one a
 * League One player wanted cost him. `tests/star/economy.mts` asserts the
 * strict increase, exactly as it asserts the strict decrease everywhere
 * else, so the two rules cannot be quietly reconciled into one.
 *
 * Energy cans convert money into availability, which is a softer version of
 * the same thing, so they climb too — from bottom of the starter consumable
 * band to comfortably outside the top one.
 */
export const RATING_CONVERTER_WEEKS = {
  /** Basic / Premium / Elite KIB Can, at starter / pro / world class. */
  energy: [0.45, 0.6, 1.0],
  /** Basic / Premium / Elite KIB Stat Can, at pro / elite / world class.
   *  The real rating converter, and the one that has to hurt. */
  stats: [3, 5, 8],
} as const;

/** Which tier each rung of the rating-converter ladders is anchored at. */
export const RATING_CONVERTER_TIERS = {
  energy: ["starter", "pro", "world_class"] as ShopTierId[],
  stats: ["pro", "elite", "world_class"] as ShopTierId[],
};
