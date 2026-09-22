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
 * ── The second number a price implies: how long the thing lasts ──
 *
 * A price on its own is only half of what a boot costs. The catalogue this
 * replaces let price span EIGHTY-fold while durability spanned three, so
 * the cheapest boots in the game worked out at about three weeks' wages per
 * match — the one item the early game is built around saving for was also
 * the worst value on the shelf. Durability is therefore no longer typed in
 * beside a price; it is derived FROM it, which makes "cost per match is a
 * small fraction of a week" true at every tier by construction rather than
 * by choosing fourteen pairs of numbers carefully. See
 * `BOOT_WEEKS_PER_MATCH` in PART 4, including why the consequence is that
 * cheap boots last far longer than dear ones.
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
 * What it does instead is make the choice ONE DIAL, and as of 19 Sep 2026
 * that is now literally true of the whole game rather than of this file
 * alone: `MONEY_SCALE` multiplies nothing any more, and `WAGE_FLOOR` below
 * is the ONLY absolute number left in the entire personal economy. Every
 * wage, fee, price, fine, bribe, testimonial and sponsor cheque is a pure
 * multiple of it.
 *
 * At `WAGE_FLOOR = 20` a bench player at the smallest non-league club earns
 * ★10 a week and his first boots cost ★650. Halving it to 10 halves every
 * figure in the game and changes nothing else — the ratios, which are the
 * actual design, are untouched, and so is every test over them.
 * `tests/star/economy.mts` proves that by checking the ladder's ratios come
 * out as exact multiples of `DIVISION_STEP`, which they could not if any
 * figure anywhere had a constant in it that did not come from this dial.
 *
 * WHAT THE QUESTION HAS NARROWED TO, after the 19 Sep sharpening. The
 * BOTTOM of the ladder already reads in NSS numbers, and lands almost
 * exactly on the owners' own worked example: "boots at 1,000 and your wage
 * is like 30 a week" against a real ★25 a week and a real ★650 first pair.
 * What no longer reads small is the TOP — ★2,621 a week, ★14,500 boots —
 * and that is a consequence of the CURVE being 105x end to end, not of the
 * unit. Turning this dial down to make the top read small drags the bottom
 * below the point where prices round cleanly (`priceStep` is coarse, and a
 * starter consumable is already only ★16).
 *
 * TWO THINGS TURNING IT WOULD COST, stated so neither is a surprise:
 *   - A SAVE IN PROGRESS stores absolute stars — a balance, a contract, the
 *     price paid for an owned item. Every NEW figure would move and those
 *     would not, so an existing career would find its bank balance suddenly
 *     worth twice or half as much against the shop. A migration question,
 *     not a code one.
 *   - CLUB MONEY DOES NOT MOVE WITH IT. Valuations, transfer fees and
 *     facilities are on their own, much larger scale (`marketValue.scale`,
 *     and `clubValuation`'s ★5,000,000 floor), deliberately — a
 *     footballer's wallet is nowhere near a club's finances. So this dial
 *     is also the only thing that moves the personal-to-club gap: turning
 *     it DOWN widens it, UP narrows it. See the note on that gap below.
 *
 * ── THE PERSONAL-TO-CLUB GAP, MEASURED AND LEFT ALONE ──
 *
 * The cheapest club in the game is valued at ★5,000,000 (a hard floor in
 * `investments.ts`). Twenty Premier League seasons of personal income was
 * ★2,789,212 — so buying the smallest club outright was 1.79x out of reach
 * of a career that could not be bettered, down from 5.7x before the 19 Sep
 * sharpening but still short.
 *
 * RESOLVED, and by the shape that was asked for rather than the one this
 * note predicted. Four were on the table: drop the club floor, raise
 * late-career earnings, add a non-wage income route, or make part-ownership
 * the entry point. The answer was the second — "I think we just scale
 * championship and premier league wages late game sharper" — which is why
 * the fix is `DIVISION_STEP_INTO` and not a second money scale.
 *
 * Twenty Premier League seasons is now ★6,741,504, and the floor is 1.35x
 * COVERED rather than 1.79x away. See `DIVISION_STEP_INTO` for what the two
 * numbers buy at ten, fifteen and twenty seasons, and for why the bottom of
 * the ladder is untouched by it.
 *
 * ── What used to be outside this file, and is not any more ──
 *
 * The first version of this header listed eight systems that were still on
 * the flat ×2000 `MONEY_SCALE` rescale of 14 Sep 2026 and therefore
 * mis-sized against everything here. As of 19 Sep 2026 every one of them is
 * on the curve, and two of them were doing real damage:
 *
 *   `matchStats.ts`      per-match image rights paid a flat ★10,000 — 8.6
 *                        weeks of Premier League income PER MATCH, and over
 *                        a season 8.6 TIMES the whole modelled income of the
 *                        career. Now `sponsorPayPerMatch` below, which is
 *                        exactly `TOTAL_INCOME_SHARES.sponsorPerMatch`.
 *   `transfers.ts`,      an offer was `your last wage x (1 + something) +
 *   `relegationOffers.ts` reputation`, which has no club in it at all and
 *                        compounds: five moves took ★829 to ★52,985, 33x the
 *                        ladder's whole ceiling. Now `offerWageFor` below.
 *   `sponsors.ts`        signing and season fees were `raw x 2000`, 17-100
 *                        weeks of top-flight income per deal per season.
 *                        Now weeks of the player's OWN wage.
 *   `corruption.ts`      lawyers, bribes and the fine cap — now weeks of
 *                        top-flight income.
 *   `governingBodies.ts` a point of influence is a week of top-flight
 *                        income; total control is a hundred of them.
 *   `clubPowers.ts`      the §4.5 son and his potion, ratio preserved.
 *   `dilemmas.ts`        payouts, anchored at `elite` — see that file for
 *                        the one honest limitation static data leaves.
 *   `retirement.ts`      the testimonial, formula unchanged, unit derived.
 *
 * `MONEY_SCALE` now multiplies nothing at all. `tests/star/moneyScale.mts`
 * sweeps the source of all of them and fails on a bare figure or a
 * reintroduced flat multiplier.
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
 * Explicitly NOT "your last wage times something" — see `transfers.ts`, and
 * `offerStanding` below, for what that produces and what replaced it.
 *
 * ── SHARPENED, 19 Sep 2026: 2.4 → 3.2 ──
 *
 * The owners, after playing the 2.4 ladder: "the curve should be sharper, a
 * top prem contract should be way more with the top end items also being
 * more, it should just match that and be difficult to get there."
 *
 * 3.2 makes the ladder exactly 3.2^4 ≈ 105x from the bottom rung to the top,
 * where 2.4 was 33x. A top-flight first-teamer goes from ★829 a week to
 * ★2,621, and the star of the biggest club in the country from ★1,593 to
 * ★5,033 — "way more", by a factor of a little over three.
 *
 * WHY THIS IS THE WHOLE CHANGE, AND WHY IT DOES NOT LENGTHEN THE EARLY GAME.
 * `WAGE_FLOOR` is the bottom of the ladder and it did not move, so the
 * National League's wage, its income and every price at the `starter` tier
 * are all byte-identical to before: the first pair of boots is still ★650
 * and still twenty-odd weeks of non-league money. Everything above the
 * bottom rung stretches away from it. That is exactly the asked-for shape —
 * the top is further away, the slog at the bottom is not longer — and it is
 * a property of anchoring the ladder at its BOTTOM rather than its top.
 *
 * "The top end items also being more" needs no separate edit either: every
 * price at the `elite` and `world_class` tiers is a number of weeks of those
 * tiers' income, so they climb by the same 3.2 per rung the wages do. The
 * best boot in the game goes from ★4,600 to ★14,750; the Private Island from
 * ★174,000 to ★557,000. What a top-flight player pays in WEEKS is unchanged,
 * which is right — the difficulty is in getting to that income, not in the
 * price once you are there.
 *
 * Everything that reads as "unreachable from down here" gets sharper with
 * it, without a single lock: the best boot in the game is 131 weeks of
 * non-league income at 2.4 and 415 at 3.2.
 */
export const DIVISION_STEP = 3.2;

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
 * THE TWO RUNGS THAT ARE STEEPER THAN THE REST, and the one thing they fix.
 *
 * Every rung used to be the same `DIVISION_STEP`. These two are not, and it
 * was a deliberate answer to a specific problem rather than a feel-tune:
 *
 *   "I think we just scale championship and premier league wages late game
 *    sharper."
 *
 * ── The problem ──
 *
 * The cheapest club in the game is ★5,000,000 (a hard floor in
 * `investments.ts`), and club money is deliberately on its own much larger
 * scale — a footballer's wallet is nowhere near a club's finances. Twenty
 * Premier League seasons of personal income came to ★2,789,212, so buying
 * the smallest club outright was 1.79x out of reach of a career that could
 * not actually be bettered. The end-game goal was unreachable by design
 * rather than by difficulty, which is the worst version of a goal.
 *
 * ── Why the top rungs specifically, and not the whole dial ──
 *
 * Turning `DIVISION_STEP` up moves every rung, which drags the bottom of
 * the ladder with it — and the bottom is the one part already confirmed to
 * read right (★25 a week, a ★650 first pair of boots, NSS numbers). The
 * gap is at the top, so the change belongs at the top.
 *
 * It also matches how football actually pays. The step from League Two to
 * League One is a pay rise; the step into the Premier League is a different
 * order of money entirely. A flat multiple between every division was the
 * simplification, not this.
 *
 * ── What these two numbers buy, measured ──
 *
 * A season is `matchweeksFor("premier")` = 38 weeks of
 * `typicalWeeklyIncome`. Against the ★5,000,000 floor:
 *
 *                       10 seasons   15 seasons   20 seasons
 *   flat 3.2 (before)      0.28x        0.42x        0.56x
 *   4.5 / 5.5 (now)        0.67x        1.01x        1.35x
 *
 * So a strong fifteen-season top-flight career buys the smallest club, and
 * a full twenty leaves real change — rather than a perfect career falling
 * short. Chosen over 4.0/5.0 (1.09x at twenty, 0.82x at fifteen) precisely
 * because that one needed a career with nothing spent along the way, and
 * boots and the shop are the whole point of earning it.
 *
 * Weekly wages: the Championship goes ★819 -> ★1,152, the Premier League
 * ★2,621 -> ★6,336. End to end the ladder is 253x rather than 105x.
 *
 * ── What it does NOT change ──
 *
 * `WAGE_FLOOR` and the two bottom rungs are untouched, so the National
 * League, League Two and every `starter`-tier price are byte-identical.
 * Shop prices at the top tiers climb with the wages that anchor them, which
 * is right and is not a side effect: those prices are written in WEEKS of
 * that tier's income, and a top-flight player pays the same number of weeks
 * as before. The only thing that genuinely got closer is the club, because
 * `clubValuation` is on its own scale and did not move with any of this.
 *
 * ── The invariant still holds, on every rung ──
 *
 * "A division's best club never out-pays the division above's worst" needs
 * `1 + REPUTATION_PREMIUM_MAX` to be under EVERY step, not just the uniform
 * one. 1.5 against a minimum step of 3.2 — see `MIN_DIVISION_STEP` and the
 * test over it.
 */
export const DIVISION_STEP_INTO: Partial<Record<CareerDivision, number>> = {
  championship: 4.5,
  premier: 5.5,
};

/** The multiple this division's floor is above the floor of the one below.
 *  `DIVISION_STEP` unless this rung is one of the steep ones. */
export function divisionStepInto(division: CareerDivision): number {
  return DIVISION_STEP_INTO[division] ?? DIVISION_STEP;
}

/** The shallowest rung on the ladder — what `REPUTATION_PREMIUM_MAX` has to
 *  stay under for the no-overlap guarantee to hold everywhere. */
export const MIN_DIVISION_STEP = Math.min(
  DIVISION_STEP,
  ...Object.values(DIVISION_STEP_INTO).filter((v): v is number => typeof v === "number"),
);

/**
 * The wage the smallest club in this division pays a bench player: the
 * whole ladder, and the only thing a division contributes.
 *
 * Geometric, but no longer at one uniform ratio — the top two rungs are
 * steeper. See `DIVISION_STEP_INTO`.
 */
export const DIVISION_BASE_WAGE: Record<CareerDivision, number> = (() => {
  const out = {} as Record<CareerDivision, number>;
  let base = WAGE_FLOOR;
  LADDER_UP.forEach((division, i) => {
    // The bottom rung IS the floor; every rung above it is the one below
    // multiplied by its own step.
    if (i > 0) base *= divisionStepInto(division);
    out[division] = base;
  });
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
  career?: WageCareer,
): number {
  if (division === "premier") {
    const wage = divisionBaseWage(division)
      * premierClubFactor(club)
      * standingMultiplier(standing)
      * (career ? premierHonoursFactor(career) * premierStarFactor(career.starRating) : 1);
    return Math.max(1, Math.min(PREMIER_WAGE_CAP, Math.round(wage)));
  }
  const wage = divisionBaseWage(division)
    * clubPremium(club, division)
    * standingMultiplier(standing);
  return Math.max(1, Math.round(wage));
}

// ═══════════════════════════════════════════════════════════════════════
//  PART 1a — THE PREMIER LEAGUE, WHERE THE TOP GETS GENUINELY RICH
// ═══════════════════════════════════════════════════════════════════════

/**
 * Owners, 21 Sep 2026: "for the Premier League the highest of the highs
 * could be a lot more… capped at 100,000… for the best of the best. Most
 * good players might still only earn 10 to 20,000… some of the lower ones
 * still about 2,500." Three multipliers, Premier League only, on top of the
 * ordinary division base × standing:
 *
 *   club spending power   real weekly wage bills, supplied directly
 *   recent honours        league / Champions League won last season,
 *                         a Ballon d'Or ever
 *   star rating           nothing below 4★, up to ×1.5 at 5★
 *
 * Every other division is untouched, and so is every shop price — those are
 * anchored to `typicalWeeklyWage`, which does not read any of this.
 */

/** Real 2025-26 weekly wage bills as a multiple of the smallest (Coventry),
 *  supplied by the owners. A club missing from this list (a promoted side,
 *  a custom club) pays like the smallest. */
export const PREMIER_WAGE_SPEND: Record<string, number> = {
  "Liverpool": 13.53, "Manchester City": 13.52, "Arsenal": 11.75,
  "Manchester United": 11.60, "Tottenham Hotspur": 10.56, "Aston Villa": 7.45,
  "Chelsea": 7.41, "Newcastle United": 5.18, "Crystal Palace": 5.01,
  "Nottingham Forest": 4.87, "AFC Bournemouth": 4.78, "Everton": 4.52,
  "Fulham FC": 4.35, "Leeds United": 4.08, "Brighton & Hove Albion": 3.86,
  "Sunderland": 3.82, "Brentford": 3.71, "Ipswich Town": 1.49,
  "Hull City": 1.19, "Coventry City": 1.00,
};

/**
 * Square-rooted, deliberately. A club's WAGE BILL is 13.5x Coventry's, but
 * most of that is paying MORE players, not paying one player 13.5x — so
 * applied raw, a Liverpool squad player would out-earn a Coventry star ten
 * times over. √13.53 = 3.68x keeps the order exactly as supplied while
 * landing a Liverpool starter around ★18,600 and a star around ★29,800.
 */
export function premierClubFactor(club: string): number {
  return Math.sqrt(Math.max(1, PREMIER_WAGE_SPEND[club] ?? 1));
}

export const PREMIER_HONOUR_MULT = { league: 1.2, championsLeague: 1.3, ballonDor: 1.5 } as const;
export const PREMIER_WAGE_CAP = 100_000;

/** Just enough of a career to read its honours — kept narrow so this file
 *  never has to import the whole CareerState shape. */
export interface WageCareer {
  season: number;
  starRating: number;
  ballonDorWins: number;
  trophies: { season: number; competition: string }[];
}

/** Won last season (or this one) — a champion is paid like one while it's
 *  fresh. Ballon d'Or wins aren't stored by season, so any win counts. */
export function premierHonoursFactor(career: WageCareer): number {
  const recent = (comp: string) =>
    career.trophies.some(t => t.competition === comp && t.season >= career.season - 1);
  let f = 1;
  if (recent("Premier League")) f *= PREMIER_HONOUR_MULT.league;
  if (recent("Champions League")) f *= PREMIER_HONOUR_MULT.championsLeague;
  if (career.ballonDorWins > 0) f *= PREMIER_HONOUR_MULT.ballonDor;
  return f;
}

/** Nothing below 4★; a straight line up to ×1.5 at a perfect 5★. */
export function premierStarFactor(starRating: number): number {
  const s = Number.isFinite(starRating) ? starRating : 0;
  return 1 + 0.5 * Math.max(0, Math.min(1, s - 4));
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
//  PART 1b — THE REST OF THE INCOME, AND WHAT A RIVAL CLUB OFFERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GOAL AND ASSIST MONEY, as fractions of a week's wage.
 *
 * `scoutOffers.ts` already writes exactly these onto a first contract
 * (`wage * 0.1` / `wage * 0.07`); they were literals there and are named
 * here so every OTHER place that has to build a contract — a transfer
 * offer, a relegation offer, a renewal — derives the same numbers instead
 * of inventing its own. Together with a realistic scoring rate they are
 * what `TOTAL_INCOME_SHARES.bonuses` is the sum of.
 */
export const GOAL_BONUS_WAGE_SHARE = 0.10;
export const ASSIST_BONUS_WAGE_SHARE = 0.07;

export function goalBonusFor(wage: number): number {
  return Math.max(1, Math.round(wage * GOAL_BONUS_WAGE_SHARE));
}
export function assistBonusFor(wage: number): number {
  return Math.max(1, Math.round(wage * ASSIST_BONUS_WAGE_SHARE));
}

/**
 * How many fixtures an ordinary week actually contains, averaged over a
 * season with a cup run in it. Only used to turn a PER-MATCH payment into
 * the per-WEEK share `TOTAL_INCOME_SHARES` is written in.
 */
export const SPONSOR_MATCHES_PER_WEEK = 0.8;

/**
 * IMAGE-RIGHTS MONEY, PER MATCH — and the single worst number in the old
 * personal economy.
 *
 * `matchStats.ts` paid `floor(sponsors / 20) × ★2,000` — a flat ★10,000 a
 * match at full sponsor standing, with no relationship to anything the
 * player earns. That is 8.6 weeks of Premier League income PER MATCH, and
 * 286 weeks of National League income per match. Over a 38-match season it
 * paid ★380,000 against a modelled season income of ★44,126: eight and a
 * half times the entire intended income of the career, arriving through one
 * line nobody was reading. Every other figure in this file was meaningless
 * while it stood, because the wallet it was all priced against was being
 * filled from somewhere else entirely.
 *
 * It was ★5 before the 14 Sep 2026 rescale multiplied it like a one-off
 * fee. It is not a one-off fee: it fires about forty times a season.
 *
 * So it is now what `TOTAL_INCOME_SHARES.sponsorPerMatch` always said it
 * should be, read literally: at FULL sponsor standing, and at
 * `SPONSOR_MATCHES_PER_WEEK` matches a week, it contributes exactly that
 * share of a week's wage. Below full standing it falls off in proportion,
 * so serving your sponsors well is worth real money and ignoring them
 * genuinely costs you — which is the mechanic; ★10,000 flat was not a
 * mechanic, it was a leak.
 *
 * `wage` is the WEEK's wage share this fixture carries (see wages.ts), not
 * a whole week, so a midweek-and-weekend double still pays one week's worth
 * of image rights across the two rather than two.
 */
export const SPONSOR_PAY_WEEKS_PER_MATCH =
  TOTAL_INCOME_SHARES.sponsorPerMatch / SPONSOR_MATCHES_PER_WEEK;

export function sponsorPayPerMatch(wage: number, sponsorStanding: number): number {
  const standing = Math.max(0, Math.min(100, Number.isFinite(sponsorStanding) ? sponsorStanding : 0)) / 100;
  return Math.max(0, Math.round(Math.max(0, wage) * SPONSOR_PAY_WEEKS_PER_MATCH * standing));
}

/**
 * WHERE A MOVE PUTS YOU IN THE NEW CLUB'S PECKING ORDER, 0-1.
 *
 * ── The bug this exists to end ──
 *
 * `transfers.ts` and `relegationOffers.ts` both computed an offer as
 * `old wage × (1 + at least 10%) + reputation × ★90`. A wage built that way
 * has NO RELATIONSHIP TO WHO IS PAYING IT: the club's name, its division and
 * its stature are all absent from the formula, and the previous wage — which
 * is the one thing that should not determine what a different club pays —
 * is the whole of it. Because it compounds, it also runs away: measured over
 * five moves it went ★829 → ★9,372 → ★18,769 → ★29,106 → ★40,477 → ★52,985,
 * which is thirty-three times the intended ceiling of the entire ladder. Two
 * more moves and a Premier League player out-earns the ladder's top rung by
 * two orders of magnitude, and every price in this file stops meaning
 * anything again.
 *
 * ── What replaces it ──
 *
 * An offer now reads `weeklyWageFor(their club, their division, standing)` —
 * the same function that prices every other contract in the game — with the
 * player's CURRENT wage as a floor, because nobody takes a pay cut to join a
 * club that came looking for them. Your old wage can hold an offer up; it
 * can no longer drive it.
 *
 * All that is left to decide is the standing, which is the honest question:
 * how well thought of will you be once you get there. Reputation raises it;
 * stepping UP to a stronger club lowers it, because a bigger club's first
 * team is a harder room to walk into, and dropping DOWN raises it, because
 * a smaller club is signing you to be the man. `strengthStep` is their
 * strength minus yours, on the 0-100 club-strength scale.
 */
export const OFFER_STANDING_AT_ZERO_REPUTATION = 0.30;
export const OFFER_STANDING_AT_FULL_REPUTATION = 1.0;
/** How much of the standing scale a full-size step between clubs is worth. */
export const OFFER_STANDING_STEP_WEIGHT = 0.20;
/** The club-strength gap treated as a full-size step, either way. */
export const OFFER_STANDING_STEP_SPAN = 25;

export function offerStanding(reputation: number, strengthStep: number): number {
  const rep = Math.max(0, Math.min(100, Number.isFinite(reputation) ? reputation : 0)) / 100;
  const base = OFFER_STANDING_AT_ZERO_REPUTATION
    + rep * (OFFER_STANDING_AT_FULL_REPUTATION - OFFER_STANDING_AT_ZERO_REPUTATION);
  const step = Math.max(-1, Math.min(1,
    (Number.isFinite(strengthStep) ? strengthStep : 0) / OFFER_STANDING_STEP_SPAN));
  return Math.max(0, Math.min(1, base - step * OFFER_STANDING_STEP_WEIGHT));
}

/**
 * THE WAGE A RIVAL CLUB OFFERS — the one function both offer generators use.
 *
 * `currentWage` is a floor and nothing more. See `offerStanding` above for
 * the whole of why.
 */
export function offerWageFor(
  club: string, division: CareerDivision, reputation: number,
  strengthStep: number, currentWage: number, career?: WageCareer,
): number {
  const theirs = weeklyWageFor(club, division, offerStanding(reputation, strengthStep), career);
  return Math.max(1, Math.round(Math.max(theirs, currentWage || 0)));
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
 * How coarse a price is allowed to be at this size — coarse steps that
 * widen as the numbers grow, the same instinct `niceMoneyStep` (money.ts)
 * already applies to a stepper. Exported so `bandPrice` below can round
 * BACK INTO a band in the same units it rounded out of.
 */
export function priceStep(raw: number): number {
  return raw < 20 ? 1
    : raw < 100 ? 5
      : raw < 1_000 ? 25
        : raw < 10_000 ? 100
          : raw < 100_000 ? 500
            : 1_000;
}

/**
 * A price, from a tier and how many weeks of that tier's income it costs.
 *
 * Rounded to something a player reads as a price rather than as a
 * calculation. The rounding is small relative to every band's own width,
 * but at a band's exact EDGE it can still land a star or two outside it —
 * `tierPrice("starter", 18)` is ★630 raw and rounds to ★625, which is
 * 17.86 weeks and therefore no longer inside an 18-36 week band. That is
 * why a catalogue entry should be priced with `bandPrice` below rather than
 * with this directly: it does the same rounding and then guarantees the
 * result is still in the band it claims.
 */
export function tierPrice(tier: ShopTierId, weeks: number): number {
  const raw = tierWeeklyIncome(tier) * weeks;
  const step = priceStep(raw);
  return Math.max(step, Math.round(raw / step) * step);
}

/**
 * THE FUNCTION EVERY CATALOGUE ENTRY IS PRICED WITH.
 *
 * "Put this item in the `upgrade` band of the `starter` tier, `at` 15% of
 * the way up that band" — and get back a round number that is provably
 * inside it. `at` is 0-1 across the band's own width, so an entry never
 * names a number of weeks (which would have to be re-derived by hand every
 * time `SQUEEZE_STEP` or `WAGE_FLOOR` moves) and never names an absolute
 * price (which is what the shop used to be, and why nothing was tied to
 * anything).
 *
 * The clamp matters and is not defensive decoration: `priceStep` is coarse
 * — ★100 at four figures — so a request at `at: 0` or `at: 1` rounds off
 * the edge about half the time. When that happens the price moves to the
 * nearest whole step INSIDE the band rather than outside it. Only if the
 * band is narrower than one step (which no band in this file is) does it
 * fall back to the middle of the band, un-stepped.
 */
export function bandPrice(tier: ShopTierId, band: PriceBandId, at = 0.5): number {
  const { min, max } = bandWeeks(band, tier);
  const income = tierWeeklyIncome(tier);
  const lo = min * income;
  const hi = max * income;

  const t = Math.max(0, Math.min(1, Number.isFinite(at) ? at : 0.5));
  const raw = lo + (hi - lo) * t;
  const step = priceStep(raw);

  let price = Math.max(step, Math.round(raw / step) * step);
  if (price < lo) price = Math.ceil(lo / step) * step;
  if (price > hi) price = Math.floor(hi / step) * step;
  if (price < lo || price > hi) price = Math.round((lo + hi) / 2);

  return Math.max(1, Math.round(price));
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
} as const;

/** Which tier each rung of the rating-converter ladders is anchored at. */
export const RATING_CONVERTER_TIERS = {
  energy: ["starter", "pro", "world_class"] as ShopTierId[],
};

// ═══════════════════════════════════════════════════════════════════════
//  PART 4 — DURABILITY, WHICH IS THE OTHER HALF OF A BOOT'S PRICE
// ═══════════════════════════════════════════════════════════════════════

/**
 * TWO THINGS HAVE TO BE TRUE OF A BOOT AT ONCE, AND ONLY ONE OF THEM WAS.
 *
 * The catalogue this replaces ran from ★6,000 to ★500,000 — a factor of
 * EIGHTY — while durability ran from 3 matches to 10, a factor of three.
 * Nothing reconciled the two, so at the bottom of the shop a pair of boots
 * worked out at roughly three weeks' wages PER MATCH: a player who bought
 * the cheapest boots in the game could not afford to keep wearing them, and
 * the item that was supposed to be his first real purchase was in fact the
 * worst-value thing on the shelf.
 *
 * So durability is no longer typed in next to a price. It IS the price:
 *
 *     matches  =  weeks of income up front  ÷  BOOT_WEEKS_PER_MATCH
 *
 * which makes both invariants hold by construction rather than by careful
 * choice of fourteen pairs of numbers:
 *
 *   1. COST PER MATCH is `BOOT_WEEKS_PER_MATCH` of a week at EVERY tier —
 *      identical for the ★725 starter boot and the ★4,600 world-class one,
 *      because both are derived from the same ratio.
 *   2. THE UP-FRONT PRICE is still a real goal at its own tier, because it
 *      is still whatever the `upgrade` band says it is. Durability moved;
 *      the price did not.
 *
 * ── Which way round, and why ──
 *
 * The brief allowed either: make cheap boots last far longer, or make
 * expensive ones last a whole season. This file does the FIRST, and the
 * second falls out of it as a consequence rather than being chosen
 * separately. A starter boot at ~20 weeks of non-league income lasts around
 * 65 matches — the better part of two seasons — and the best boot in the
 * game lasts about a dozen.
 *
 * That inversion is deliberate, and it is also how boots actually work: a
 * hard-wearing budget boot survives seasons of it, and an elite lightweight
 * boot is a race-day item that gets replaced constantly. It gives the
 * catalogue a real trade-off it never had — stats against durability —
 * instead of a single dominant column where the dearest boot won on both.
 *
 * It also fixes the specific absurdity above: a non-league player saving 20
 * weeks for boots now gets two seasons out of them rather than three
 * matches.
 */
export const BOOT_WEEKS_PER_MATCH = 0.30;

/** Hard ends, so a rounding change can never produce a boot that is used up
 *  in a single match or one that outlasts an entire career. */
export const BOOT_MATCHES_MIN = 4;
export const BOOT_MATCHES_MAX = 120;

/**
 * How many matches a boot at this price, at this tier, is good for.
 *
 * Rounded coarsely on the same instinct as `priceStep` — nobody reads "67
 * matches" as more precise than "65", and a round number survives a
 * retune of the curve looking deliberate rather than computed.
 */
export function bootMatchesFor(price: number, tier: ShopTierId): number {
  const weeks = weeksOfIncome(price, tier);
  const raw = weeks / BOOT_WEEKS_PER_MATCH;
  const rounded =
    raw < 20 ? Math.round(raw)
      : raw < 60 ? Math.round(raw / 2) * 2
        : Math.round(raw / 5) * 5;
  return Math.max(BOOT_MATCHES_MIN, Math.min(BOOT_MATCHES_MAX, rounded));
}

/** What a boot actually works out at per match, in weeks of the income of
 *  the tier it belongs to — the number invariant (1) above is checked on. */
export function bootWeeksPerMatch(price: number, matches: number, tier: ShopTierId): number {
  return weeksOfIncome(price, tier) / Math.max(1, matches);
}

// ═══════════════════════════════════════════════════════════════════════
//  PART 5 — READING A PRICE FROM A REAL WALLET
// ═══════════════════════════════════════════════════════════════════════

/**
 * "How many weeks of MY money is this?" — for a specific career rather than
 * for a tier's notional first-teamer.
 *
 * Every price in this game is a number of weeks that has been multiplied
 * out into stars, and the shop is the one place a player should be able to
 * read it back the other way. Takes the wage off the actual contract and
 * grosses it up by `TOTAL_INCOME_MULTIPLE`, so it answers with total income
 * rather than wage alone — the same denominator every band is written
 * against, which is what makes the answer comparable to `bandWeeks`.
 */
export function weeksOfWallet(price: number, weeklyWage: number): number {
  const income = Math.max(1, weeklyWage) * TOTAL_INCOME_MULTIPLE;
  return price / income;
}

/**
 * KIB CANS, PRICED OFF THE PLAYER'S OWN WAGE — in weeks of it.
 *
 * The Stat Cans were deleted on 21 Sep 2026 ("only three types of cans,
 * not six"), leaving these three. Priced as a share of YOUR current weekly
 * wage rather than a fixed tier price, so they never become pocket change:
 * the richer you get, the more a can costs.
 */
export const KIB_CAN_WAGE_WEEKS = { basic: 0.5, premium: 1, elite: 2 } as const;
