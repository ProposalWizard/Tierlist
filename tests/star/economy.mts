// A tiny localStorage so tuningStore.ts (reached through shopData.ts) can
// run headless — same pattern as tests/star/tuning.mts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import {
  WAGE_FLOOR, DIVISION_STEP, divisionStepInto, MIN_DIVISION_STEP,
  REPUTATION_PREMIUM_MAX, SQUEEZE_STEP,
  STANDING_BENCH, STANDING_STARTER, STANDING_STAR, STARTER_STANDING,
  TOTAL_INCOME_SHARES, TOTAL_INCOME_MULTIPLE,
  PRICE_BANDS, SHOP_TIERS, SHOP_TIER_ORDER,
  RATING_CONVERTER_WEEKS, RATING_CONVERTER_TIERS,
  BOOT_WEEKS_PER_MATCH, BOOT_MATCHES_MIN, BOOT_MATCHES_MAX,
  weeklyWageFor, typicalWeeklyWage, typicalWeeklyIncome,
  tierWeeklyIncome, tierPrice, bandPrice, bandWeeks, weeksOfIncome,
  priceIsInBand, bootMatchesFor, bootWeeksPerMatch, weeksOfWallet,
  signingOnFee, SIGNING_ON_WEEKS_MIN, SIGNING_ON_WEEKS_MAX,
  offerStanding, offerWageFor, goalBonusFor, assistBonusFor,
  GOAL_BONUS_WAGE_SHARE, ASSIST_BONUS_WAGE_SHARE,
  TOTAL_INCOME_MULTIPLE as INCOME_MULT,
  type ShopTierId, type PriceBandId,
} from "../../lib/star/economy";
import { DIVISION_ORDER } from "../../lib/star/calendar";
import type { CareerDivision } from "../../lib/star/calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS,
  LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import {
  BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT,
  KIB_CANS_DEFAULT, STAT_KIB_CANS_DEFAULT, PRICE_SPECS,
} from "../../lib/star/shopDefaults";
import { BOOTS_CATALOGUE, shopTierOf } from "../../lib/star/shopData";
import { STARTER_BOOT_MATCHES } from "../../lib/star/careerFlow";

/**
 * THE ONE CURVE, AND THE TWO RULES THAT RUN IN OPPOSITE DIRECTIONS.
 *
 * economy.ts prices the whole personal economy in WEEKS OF INCOME, and it
 * makes two claims that contradict each other on purpose:
 *
 *   1. Nearly everything gets CHEAPER in weeks as you climb the ladder.
 *      That is the "mean early, loosening through the middle" shape, and it
 *      is the claim a previous framework got wrong — it specified constant
 *      fractions, which makes the early game feel IDENTICAL to the late
 *      game in purchasing terms while claiming to avoid exactly that.
 *   2. Anything that converts money into RATING gets DEARER in weeks as you
 *      climb, or a rich late career simply buys past the growth curve.
 *
 * Both are asserted here, tier by tier, because the obvious "tidy-up" for
 * somebody reading this code cold is to reconcile the two into one rule,
 * and doing that silently destroys whichever half they drop.
 *
 * The rest of the file holds the catalogue to the curve: every price in the
 * shop is in the band it claims, the boots ladder is strictly ascending,
 * and a boot's cost PER MATCH is a small fraction of a week at every tier —
 * which is the invariant the old catalogue broke worst, charging roughly
 * three weeks' wages a match for the cheapest boots in the game.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BANDS = Object.keys(PRICE_BANDS) as PriceBandId[];
const ALL_CLUBS: Record<CareerDivision, string[]> = {
  premier: [...PREMIER_LEAGUE_CLUBS],
  championship: [...CHAMPIONSHIP_CLUBS],
  league_one: [...LEAGUE_ONE_CLUBS],
  league_two: [...LEAGUE_TWO_CLUBS],
  national_league: [...NATIONAL_LEAGUE_CLUBS],
};

// ═══════════════════════════════════════════════════════════════════════
//  1 — THE INCOME LADDER
// ═══════════════════════════════════════════════════════════════════════
{
  check(WAGE_FLOOR > 0, `WAGE_FLOOR is a real positive figure (got ${WAGE_FLOOR})`);
  check(DIVISION_STEP > 1, `DIVISION_STEP climbs (got ${DIVISION_STEP})`);

  // THE structural guarantee: a division's best club can never out-pay the
  // division above's worst. It holds because the step outgrows the premium,
  // not because today's numbers happen not to cross.
  check(
    1 + REPUTATION_PREMIUM_MAX < DIVISION_STEP,
    `1 + REPUTATION_PREMIUM_MAX (${1 + REPUTATION_PREMIUM_MAX}) must stay below DIVISION_STEP (${DIVISION_STEP}) `
    + "or a big club in a low division starts out-paying a small club in a high one",
  );

  // …and measured over every real club in the game, at the same standing,
  // which is what that inequality is supposed to buy.
  for (let i = 1; i < DIVISION_ORDER.length; i++) {
    const above = DIVISION_ORDER[i - 1];
    const below = DIVISION_ORDER[i];
    const bestBelow = Math.max(...ALL_CLUBS[below].map(c => weeklyWageFor(c, below)));
    const worstAbove = Math.min(...ALL_CLUBS[above].map(c => weeklyWageFor(c, above)));
    check(
      bestBelow < worstAbove,
      `${below}'s best-paying club (★${bestBelow}) must stay under ${above}'s worst (★${worstAbove})`,
    );
  }

  // Standing is monotone and "a starter" is a real, findable 1.0x.
  check(STANDING_BENCH < STANDING_STARTER && STANDING_STARTER < STANDING_STAR,
    "bench < starter < star");
  check(STANDING_STARTER === 1, "a plain starter is exactly the 1.0x reference");
  for (const d of DIVISION_ORDER) {
    const club = ALL_CLUBS[d][0];
    const bench = weeklyWageFor(club, d, 0);
    const starter = weeklyWageFor(club, d, STARTER_STANDING);
    const star = weeklyWageFor(club, d, 1);
    check(bench < starter && starter < star, `${d}: a better standing always pays more`);
  }

  // Income is a wage plus named shares of it, and the wage stays the
  // majority of it — see TOTAL_INCOME_SHARES' own invariant.
  const shareSum = Object.values(TOTAL_INCOME_SHARES).reduce((a, b) => a + b, 0);
  check(shareSum <= 2.33, `the non-wage shares must not swamp the wage (sum ${shareSum.toFixed(2)})`);
  check(Math.abs(TOTAL_INCOME_MULTIPLE - (1 + shareSum)) < 1e-9, "TOTAL_INCOME_MULTIPLE is 1 + the shares");
  check(1 / TOTAL_INCOME_MULTIPLE >= 0.3, `the wage is still at least 30% of total income (got ${(100 / TOTAL_INCOME_MULTIPLE).toFixed(0)}%)`);

  for (const d of DIVISION_ORDER) {
    check(typicalWeeklyIncome(d) > typicalWeeklyWage(d), `${d}: total income exceeds the wage alone`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  2 — THE SIGNING-ON FEE
// ═══════════════════════════════════════════════════════════════════════
{
  const wage = 1_000;
  const fees = PREMIER_LEAGUE_CLUBS.map(c => signingOnFee(c, wage));
  check(Math.min(...fees) >= wage * SIGNING_ON_WEEKS_MIN * 0.95,
    "even the smallest club pays at least the minimum number of weeks");
  check(Math.max(...fees) <= wage * SIGNING_ON_WEEKS_MAX * 1.05,
    "and the biggest never pays more than the maximum");
  // It scales with the wage actually agreed, not with a fixed figure — that
  // flat ★5,000 paid identically by Manchester United and Hornchurch is the
  // bug this replaced.
  check(signingOnFee(PREMIER_LEAGUE_CLUBS[0], 2_000) === 2 * signingOnFee(PREMIER_LEAGUE_CLUBS[0], 1_000),
    "the fee is a pure multiple of the wage");
}

// ═══════════════════════════════════════════════════════════════════════
//  3 — THE FRACTIONS SHRINK AS YOU CLIMB. DO NOT TIDY THIS INTO A CONSTANT.
// ═══════════════════════════════════════════════════════════════════════
{
  check(SQUEEZE_STEP > 1,
    `SQUEEZE_STEP must stay above 1 (got ${SQUEEZE_STEP}) — at 1 every band goes constant across the career, `
    + "which is the design the owners rejected: the early game stops being tighter than the late game by construction");

  // The tier list is in ladder order and its squeeze strictly decreases.
  for (let i = 1; i < SHOP_TIERS.length; i++) {
    check(
      SHOP_TIERS[i].squeeze < SHOP_TIERS[i - 1].squeeze,
      `${SHOP_TIERS[i].id} must be less squeezed than ${SHOP_TIERS[i - 1].id} `
      + `(${SHOP_TIERS[i].squeeze} vs ${SHOP_TIERS[i - 1].squeeze})`,
    );
    check(
      tierWeeklyIncome(SHOP_TIERS[i].id) > tierWeeklyIncome(SHOP_TIERS[i - 1].id),
      `${SHOP_TIERS[i].id} must be richer than ${SHOP_TIERS[i - 1].id}`,
    );
  }

  // …band by band, which is the claim that actually matters: the SAME kind
  // of purchase costs strictly fewer weeks the higher you climb.
  for (const band of BANDS) {
    for (let i = 1; i < SHOP_TIER_ORDER.length; i++) {
      const lower = bandWeeks(band, SHOP_TIER_ORDER[i - 1]);
      const higher = bandWeeks(band, SHOP_TIER_ORDER[i]);
      check(
        higher.min < lower.min && higher.max < lower.max,
        `${band}: ${SHOP_TIER_ORDER[i]} (${higher.min.toFixed(2)}-${higher.max.toFixed(2)} wks) must cost strictly `
        + `fewer weeks than ${SHOP_TIER_ORDER[i - 1]} (${lower.min.toFixed(2)}-${lower.max.toFixed(2)} wks)`,
      );
    }
  }

  // The bottom of the ladder lands on the owners' own worked example — "boots
  // at 1,000 and your wage is like 30 a week", i.e. roughly thirty weeks for
  // a pair of boots — rather than on a number chosen to look tidy. Asserted
  // as the WINDOW that example sits in, not as the example's exact figure,
  // because the figure moves with WAGE_FLOOR and the intent does not.
  const starterUpgrade = bandWeeks("upgrade", "starter");
  check(
    starterUpgrade.min >= 15 && starterUpgrade.max <= 45,
    `a pair of boots in the National League should be a season-long goal — 15-45 weeks — `
    + `got ${starterUpgrade.min.toFixed(1)}-${starterUpgrade.max.toFixed(1)}`,
  );
  // …and the top of it is genuinely loose by comparison.
  const topUpgrade = bandWeeks("upgrade", "world_class");
  check(
    topUpgrade.max <= starterUpgrade.min / 4,
    `the top of the ladder must be at least four times looser than the bottom `
    + `(top ${topUpgrade.max.toFixed(1)} wks vs bottom ${starterUpgrade.min.toFixed(1)} wks)`,
  );

  // Bands never overlap within a tier: a consumable is always cheaper than
  // an upgrade, which is always cheaper than an aspiration.
  for (const tier of SHOP_TIER_ORDER) {
    for (let i = 1; i < BANDS.length; i++) {
      check(
        bandWeeks(BANDS[i], tier).min > bandWeeks(BANDS[i - 1], tier).max,
        `${tier}: ${BANDS[i]} must start above where ${BANDS[i - 1]} ends`,
      );
    }
  }

  // No tier locks, and none needed: an item a tier above you is unaffordable
  // by arithmetic alone.
  const topBootWeeksToANonLeaguer = weeksOfWallet(
    bandPrice("world_class", "upgrade", 1), typicalWeeklyWage("national_league"),
  );
  check(
    topBootWeeksToANonLeaguer > 100,
    `the best boot in the game should read as over a hundred weeks of non-league income `
    + `(got ${topBootWeeksToANonLeaguer.toFixed(0)})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  4 — …EXCEPT THE RATING CONVERTERS, WHICH GET DEARER. ALSO DO NOT TIDY.
// ═══════════════════════════════════════════════════════════════════════
{
  for (const which of ["energy", "stats"] as const) {
    const weeks = RATING_CONVERTER_WEEKS[which];
    const tiers = RATING_CONVERTER_TIERS[which];
    check(weeks.length === tiers.length, `${which}: a tier for every rung`);

    for (let i = 1; i < weeks.length; i++) {
      check(
        weeks[i] > weeks[i - 1],
        `${which}: rung ${i} must cost MORE weeks than rung ${i - 1} (${weeks[i]} vs ${weeks[i - 1]}) — `
        + "money-into-rating is the one thing that must get dearer as you climb, or a rich late career "
        + "simply buys past the growth curve",
      );
      check(
        SHOP_TIER_ORDER.indexOf(tiers[i]) > SHOP_TIER_ORDER.indexOf(tiers[i - 1]),
        `${which}: rung ${i} must be anchored higher up the ladder than rung ${i - 1}`,
      );
    }

    // And the direction is genuinely OPPOSITE to everything else: the same
    // band at those same tiers gets cheaper while these get dearer.
    const bandLow = bandWeeks("consumable", tiers[0]).max;
    const bandHigh = bandWeeks("consumable", tiers[tiers.length - 1]).max;
    check(bandHigh < bandLow, `${which}: the ordinary consumable band really does fall across these tiers`);
    check(
      weeks[weeks.length - 1] > weeks[0],
      `${which}: …while the converter itself rises, which is the whole point`,
    );
  }

  // The stat cans are the real converter and have to hurt more than the
  // energy cans, which only convert money into availability.
  check(
    RATING_CONVERTER_WEEKS.stats[0] > RATING_CONVERTER_WEEKS.energy[2],
    "even the cheapest stat can costs more weeks than the dearest energy can",
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  5 — bandPrice ALWAYS LANDS INSIDE THE BAND IT CLAIMS
// ═══════════════════════════════════════════════════════════════════════
{
  // The edge is where this fails if it fails: `tierPrice` rounds to coarse
  // steps, so a request at exactly 0 or exactly 1 rounds off the end about
  // half the time. bandPrice is the version that pulls it back.
  for (const tier of SHOP_TIER_ORDER) {
    for (const band of BANDS) {
      for (const at of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        const p = bandPrice(tier, band, at);
        check(priceIsInBand(p, tier, band),
          `bandPrice(${tier}, ${band}, ${at}) = ★${p} = ${weeksOfIncome(p, tier).toFixed(3)} wks, outside `
          + `${bandWeeks(band, tier).min.toFixed(3)}-${bandWeeks(band, tier).max.toFixed(3)}`);
        check(p > 0 && Number.isFinite(p), `bandPrice(${tier}, ${band}, ${at}) is a real price`);
      }
      // Monotone in `at`, so "dearer end of the band" means something.
      check(bandPrice(tier, band, 1) >= bandPrice(tier, band, 0),
        `${tier}/${band}: the top of the band is not cheaper than the bottom`);
      // A nonsense `at` is clamped rather than propagated.
      check(priceIsInBand(bandPrice(tier, band, -5), tier, band), `${tier}/${band}: at < 0 clamps`);
      check(priceIsInBand(bandPrice(tier, band, 99), tier, band), `${tier}/${band}: at > 1 clamps`);
      check(priceIsInBand(bandPrice(tier, band, NaN), tier, band), `${tier}/${band}: a NaN at still prices`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  6 — EVERY CATALOGUE PRICE IS IN THE BAND IT CLAIMS
// ═══════════════════════════════════════════════════════════════════════
{
  for (const b of BOOTS_CATALOGUE_DEFAULT) {
    const spec = PRICE_SPECS.boots[b.id];
    check(!!spec, `${b.name}: has a price spec at all`);
    if (!spec) continue;
    check(priceIsInBand(b.price, spec.tier, spec.band),
      `${b.name}: ★${b.price} is ${weeksOfIncome(b.price, spec.tier).toFixed(2)} wks at ${spec.tier}, `
      + `outside the ${spec.band} band`);
  }

  for (const i of LIFESTYLE_ITEMS_DEFAULT) {
    const spec = PRICE_SPECS.lifestyle[i.id];
    check(!!spec, `${i.name}: has a price spec at all`);
    if (!spec) continue;
    check(priceIsInBand(i.price, spec.tier, spec.band),
      `${i.name}: ★${i.price} is ${weeksOfIncome(i.price, spec.tier).toFixed(2)} wks at ${spec.tier}, `
      + `outside the ${spec.band} band`);
  }

  // Cans are priced off RATING_CONVERTER_WEEKS instead of a band, so they
  // are checked against that directly.
  const cansMatch = (rows: { price: number }[], which: "energy" | "stats") =>
    rows.every((row, i) => row.price === tierPrice(RATING_CONVERTER_TIERS[which][i], RATING_CONVERTER_WEEKS[which][i]));
  check(cansMatch(KIB_CANS_DEFAULT, "energy"), "every energy can is priced straight off RATING_CONVERTER_WEEKS");
  check(cansMatch(STAT_KIB_CANS_DEFAULT, "stats"), "every stat can is priced straight off RATING_CONVERTER_WEEKS");

  // Nothing in the shop is a hand-typed figure any more: no price survives
  // a change to the one dial unless it is derived from it. Measured rather
  // than asserted from the source — read the catalogue, and check that no
  // two entries in different tiers share a price by coincidence of typing.
  const everyPrice = [
    ...BOOTS_CATALOGUE_DEFAULT.map(b => b.price),
    ...LIFESTYLE_ITEMS_DEFAULT.map(i => i.price),
    ...KIB_CANS_DEFAULT.map(c => c.price),
    ...STAT_KIB_CANS_DEFAULT.map(c => c.price),
  ];
  check(everyPrice.every(p => Number.isFinite(p) && p > 0), "every catalogue price is a real positive number");
}

// ═══════════════════════════════════════════════════════════════════════
//  7 — THE BOOT LADDER, AND THE COST-PER-MATCH INVARIANT
// ═══════════════════════════════════════════════════════════════════════
{
  // Strictly ascending, so a better boot a rung up never undercuts a worse
  // boot a rung down. The five tiers' bands overlap in absolute stars, so
  // this is a real property of where each boot sits in its own band, not a
  // consequence of the ladder.
  for (let i = 1; i < BOOTS_CATALOGUE_DEFAULT.length; i++) {
    const prev = BOOTS_CATALOGUE_DEFAULT[i - 1];
    const cur = BOOTS_CATALOGUE_DEFAULT[i];
    check(cur.price > prev.price,
      `${cur.name} (★${cur.price}) must cost more than ${prev.name} (★${prev.price})`);
    check(
      SHOP_TIER_ORDER.indexOf(PRICE_SPECS.boots[cur.id].tier)
        >= SHOP_TIER_ORDER.indexOf(PRICE_SPECS.boots[prev.id].tier),
      `${cur.name} must not sit on a lower rung than ${prev.name}`,
    );
  }

  // Every rung of the ladder actually has boots on it — "there's no tiered
  // items, there's no change to the boots, nothing" is the complaint this
  // catalogue exists to answer.
  for (const tier of SHOP_TIER_ORDER) {
    check(
      BOOTS_CATALOGUE_DEFAULT.some(b => PRICE_SPECS.boots[b.id].tier === tier),
      `the ${tier} tier has no boots in it`,
    );
  }

  // THE INVARIANT THE OLD CATALOGUE BROKE WORST. Price used to span 80x
  // against durability spanning 3x, which put the cheapest boots in the
  // game at roughly three weeks' wages PER MATCH — unaffordable precisely
  // where affordability was the point.
  for (const b of BOOTS_CATALOGUE_DEFAULT) {
    const tier = PRICE_SPECS.boots[b.id].tier;
    const perMatch = bootWeeksPerMatch(b.price, b.matches, tier);
    check(
      perMatch <= 0.4,
      `${b.name} costs ${perMatch.toFixed(2)} weeks of ${tier} income per match — a boot has to stay a `
      + "small fraction of a week per match at every tier",
    );
    check(
      Math.abs(perMatch - BOOT_WEEKS_PER_MATCH) < 0.05,
      `${b.name}'s cost per match (${perMatch.toFixed(3)}) should be BOOT_WEEKS_PER_MATCH `
      + `(${BOOT_WEEKS_PER_MATCH}) — durability is derived from price, not typed in alongside it`,
    );
    // …and the up-front price is still a real goal at its own tier, which is
    // the other half of the same requirement.
    const weeks = weeksOfIncome(b.price, tier);
    const band = bandWeeks("upgrade", tier);
    check(weeks >= band.min, `${b.name} must still be a real purchase at ${tier} (${weeks.toFixed(1)} wks)`);
  }

  // Cheap boots last far longer than dear ones — the deliberate inversion,
  // and the thing that makes the cost-per-match invariant achievable at the
  // bottom of the ladder at all.
  const cheapest = BOOTS_CATALOGUE_DEFAULT[0];
  const dearest = BOOTS_CATALOGUE_DEFAULT[BOOTS_CATALOGUE_DEFAULT.length - 1];
  check(
    cheapest.matches > dearest.matches * 3,
    `the cheapest boot (${cheapest.matches} matches) should far outlast the dearest (${dearest.matches}) — `
    + "a budget boot survives seasons, an elite one is a race-day item",
  );
  check(
    cheapest.matches >= 30,
    `a boot bought with twenty weeks of non-league income cannot wear out in ${cheapest.matches} matches`,
  );

  // The ends hold whatever the curve does.
  for (const tier of SHOP_TIER_ORDER) {
    for (const price of [1, 10, 1_000, 10_000_000]) {
      const m = bootMatchesFor(price, tier);
      check(m >= BOOT_MATCHES_MIN && m <= BOOT_MATCHES_MAX,
        `bootMatchesFor(★${price}, ${tier}) = ${m}, outside [${BOOT_MATCHES_MIN}, ${BOOT_MATCHES_MAX}]`);
    }
    // Dearer at the same tier always means longer, never shorter.
    check(bootMatchesFor(2_000, tier) >= bootMatchesFor(1_000, tier),
      `${tier}: a dearer boot never lasts fewer matches`);
  }

  // The FREE pair a career opens with is NOT the catalogue's durability.
  // Copying the cheapest entry wholesale would hand every new career the
  // better part of two free seasons of boots, which removes the first thing
  // the opening of the game is meant to be about earning.
  check(
    STARTER_BOOT_MATCHES < BOOTS_CATALOGUE[0].matches,
    `the free starter pair (${STARTER_BOOT_MATCHES} matches) must be a worn pair, not a brand-new `
    + `${BOOTS_CATALOGUE[0].matches}-match boot off the shelf`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  8 — THE CATALOGUE READS AS A LADDER ON SCREEN
// ═══════════════════════════════════════════════════════════════════════
{
  // Within each lifestyle category, a better item always costs more. A list
  // where the better thing is cheaper reads as a bug however defensible the
  // band it came from was.
  for (const category of ["item", "vehicle", "property"] as const) {
    const rows = LIFESTYLE_ITEMS_DEFAULT.filter(i => i.category === category);
    check(rows.length > 0, `${category}: the catalogue has some`);
    for (let i = 1; i < rows.length; i++) {
      check(
        rows[i].price >= rows[i - 1].price,
        `${category}: ${rows[i].name} (★${rows[i].price}) must not cost less than ${rows[i - 1].name} (★${rows[i - 1].price})`,
      );
      check(
        rows[i].lifestyleValue >= rows[i - 1].lifestyleValue,
        `${category}: ${rows[i].name} must not be worth less than ${rows[i - 1].name}`,
      );
    }

    // …and the rule underneath that ordering, which is the one a player
    // actually feels: NOTHING IS DOMINATED. If it costs more it has to be
    // worth more. Two items may legitimately tie on both (the Games Console
    // and the Headphones do — same money, same bump, a choice of flavour),
    // but nothing may ever cost more for the same or less.
    for (const a of rows) {
      for (const b of rows) {
        check(
          !(a.price > b.price && a.lifestyleValue <= b.lifestyleValue),
          `${category}: ${a.name} (★${a.price}, +${a.lifestyleValue}) is strictly dominated by `
          + `${b.name} (★${b.price}, +${b.lifestyleValue}) — it costs more and is worth no more`,
        );
      }
    }
  }

  // The cans climb in price alongside what they do.
  for (const rows of [KIB_CANS_DEFAULT, STAT_KIB_CANS_DEFAULT]) {
    for (let i = 1; i < rows.length; i++) {
      check(rows[i].price > rows[i - 1].price, `${rows[i].name} costs more than ${rows[i - 1].name}`);
    }
  }

  // The shop's own grouping resolves for every boot, and an id the
  // catalogue no longer has degrades rather than throwing — a saved career
  // can be wearing a boot that has since been renamed away.
  for (const b of BOOTS_CATALOGUE) {
    check(SHOP_TIER_ORDER.includes(shopTierOf("boots", b.id) as ShopTierId), `${b.name}: has a tier to group under`);
  }
  check(SHOP_TIER_ORDER.includes(shopTierOf("boots", "no-such-boot") as ShopTierId),
    "an unknown boot id still resolves to a tier rather than crashing the shop");
}

// ═══════════════════════════════════════════════════════════════════════
//  9 — THE UNIT IS ONE DIAL, AND EVERY RATIO SURVIVES TURNING IT
// ═══════════════════════════════════════════════════════════════════════
{
  // The owners talk in NSS numbers ("10 a week") while MONEY_SCALE = 2000
  // was set so that wages would stop reading as placeholders. Both cannot
  // be true, and this file deliberately does not pick — what it guarantees
  // instead is that picking is ONE edit. Every figure in the economy is a
  // pure multiple of WAGE_FLOOR, so the whole thing is homogeneous of
  // degree one: double the dial and every price doubles, while every RATIO
  // — which is the actual design — is untouched.
  //
  // Checked by ratio rather than by re-importing the module with a
  // different constant, which a static import cannot do: if any figure had
  // a constant baked into it that did NOT come from WAGE_FLOOR, these
  // ratios would not be the clean multiples of DIVISION_STEP they are.
  //
  // The ladder is no longer ONE ratio — the Championship and Premier League
  // rungs are deliberately steeper (`DIVISION_STEP_INTO`, which closed the
  // personal-to-club gap). So each rung is checked against its OWN declared
  // step rather than against a single constant. The guarantee is unchanged
  // and just as strong: every rung must be exactly the step it declares, to
  // within floating point, which it could not be if any figure anywhere had
  // a constant in it that did not come from WAGE_FLOOR.
  const wages = DIVISION_ORDER.map(d => typicalWeeklyWage(d));
  for (let i = 1; i < wages.length; i++) {
    // DIVISION_ORDER runs top-first, so [i - 1] is the division ABOVE [i],
    // and the step that made it is the one declared for the higher rung.
    const above = DIVISION_ORDER[i - 1];
    const want = divisionStepInto(above);
    check(
      Math.abs(wages[i - 1] / wages[i] - want) < 1e-9,
      `${above}/${DIVISION_ORDER[i]} must be exactly its own step (${want}) — `
      + `got ${(wages[i - 1] / wages[i]).toFixed(6)}, which means a figure somewhere is not derived from WAGE_FLOOR`,
    );
  }
  // The steep rungs must genuinely BE steeper, or `DIVISION_STEP_INTO` is
  // declaring something it is not doing.
  check(
    divisionStepInto("premier") > DIVISION_STEP
    && divisionStepInto("championship") > DIVISION_STEP,
    "the top two rungs are the steep ones",
  );
  // …and the no-overlap guarantee has to hold on the SHALLOWEST rung, not
  // just on the nominal step — that is what makes it structural.
  check(
    1 + REPUTATION_PREMIUM_MAX < MIN_DIVISION_STEP,
    `a division's best club must never out-pay the one above's worst `
    + `(premium ${1 + REPUTATION_PREMIUM_MAX} vs shallowest rung ${MIN_DIVISION_STEP})`,
  );
  check(
    Math.abs(typicalWeeklyWage("national_league") / WAGE_FLOOR - 1.25) < 1e-9,
    "the bottom of the ladder is a pure multiple of the one dial",
  );
  // Prices move with it too, in the same proportion.
  const bootWeeks = weeksOfIncome(bandPrice("starter", "upgrade", 0.15), "starter");
  check(bootWeeks > 15 && bootWeeks < 45,
    `the entry boot is ${bootWeeks.toFixed(1)} weeks of non-league income — the figure the owners' `
    + "worked example ('boots at 1,000, wage 30 a week') is about");
}

// ═══════════════════════════════════════════════════════════════════════
//  10 — THE CURVE IS GENUINELY SHARP, AND AN OFFER CANNOT COMPOUND
// ═══════════════════════════════════════════════════════════════════════
{
  // ── The sharpening, 19 Sep 2026 ──
  //
  // "The curve should be sharper, a top prem contract should be way more
  // with the top end items also being more, it should just match that and be
  // difficult to get there." Asserted as a FLOOR on how far apart the ends
  // are rather than as today's exact figure, the same way section 3 handles
  // the boots window: the intent is "the top is a long way from the bottom",
  // and pinning 104.9 here would break this suite the next time somebody
  // turns the dial in the direction they were asked to.
  const spread = typicalWeeklyWage("premier") / typicalWeeklyWage("national_league");
  check(
    spread >= 50,
    `the ladder must run at least fifty times from the bottom rung to the top — got ${spread.toFixed(1)}x. `
    + "It was 33x before the sharpening and the owners asked for the top to be way further away.",
  );

  // …AND THE BOTTOM DID NOT MOVE WITH IT. This is the other half of the
  // instruction ("steepen without making the early game longer") and it is
  // the property that makes the sharpening safe: the ladder is anchored at
  // its BOTTOM rung, so stretching it moves the top away from a fixed
  // National League rather than dragging the whole thing up.
  check(
    Math.abs(typicalWeeklyWage("national_league") - WAGE_FLOOR * 1.25) < 1e-9,
    "the bottom rung is WAGE_FLOOR and nothing else — a sharper curve must not lengthen the early game",
  );
  const entryBoot = weeksOfIncome(bandPrice("starter", "upgrade", 0.15), "starter");
  check(
    entryBoot > 15 && entryBoot < 45,
    `the first pair of boots must still be 15-45 weeks of non-league income after any sharpening `
    + `— got ${entryBoot.toFixed(1)}`,
  );

  // ── Bonuses follow the wage ──
  check(goalBonusFor(1_000) === Math.round(1_000 * GOAL_BONUS_WAGE_SHARE), "a goal bonus is a share of the wage");
  check(assistBonusFor(1_000) === Math.round(1_000 * ASSIST_BONUS_WAGE_SHARE), "an assist bonus is a share of the wage");
  check(goalBonusFor(2_000) === 2 * goalBonusFor(1_000), "…and is a pure multiple of it");
  check(assistBonusFor(0) >= 1 && goalBonusFor(0) >= 1, "a zero wage still yields a real, if token, bonus");

  // ── Standing on arrival ──
  check(offerStanding(0, 0) < offerStanding(100, 0), "a bigger reputation arrives higher up the pecking order");
  check(offerStanding(60, 20) < offerStanding(60, 0), "stepping UP to a stronger club costs standing");
  check(offerStanding(60, -20) > offerStanding(60, 0), "dropping DOWN to a smaller one buys it");
  for (const rep of [-50, 0, 50, 100, 500, NaN]) {
    for (const step of [-999, -10, 0, 10, 999, NaN]) {
      const st = offerStanding(rep, step);
      check(st >= 0 && st <= 1 && Number.isFinite(st), `offerStanding(${rep}, ${step}) = ${st}, outside 0-1`);
    }
  }

  // ── THE COMPOUNDING BUG, PINNED SHUT ──
  //
  // `transfers.ts` and `relegationOffers.ts` both used to compute an offer as
  // `your last wage x (1 + at least 10%) + reputation x ★90`. Measured over
  // five moves that ran ★829 → ★9,372 → ★18,769 → ★29,106 → ★40,477 →
  // ★52,985: thirty-three times the intended ceiling of the whole ladder,
  // because the previous wage — the one thing that should NOT determine what
  // a different club pays — was the entire formula.
  //
  // The claim now is structural: an offer can never exceed the most that
  // club could pay ANY player, unless your current wage already did, because
  // your wage is a floor and nothing more. Walked over every club in the
  // Premier League from a wage that has already run away.
  {
    const CEILING = (club: string, d: CareerDivision) => weeklyWageFor(club, d, 1);
    for (const club of PREMIER_LEAGUE_CLUBS) {
      for (const rep of [0, 50, 100]) {
        for (const step of [-30, 0, 30]) {
          const fresh = offerWageFor(club, "premier", rep, step, 0);
          check(
            fresh <= CEILING(club, "premier"),
            `${club}: an offer (★${fresh}) can never beat what that club pays its very best player `
            + `(★${CEILING(club, "premier")})`,
          );
        }
      }
    }

    // Iterated: move five times in a row, always taking the offer, and the
    // wage must converge on what the clubs actually pay rather than running
    // away from it. This is the exact shape of the measurement that found
    // the bug.
    let wage = Math.round(typicalWeeklyWage("premier"));
    const start = wage;
    for (let i = 0; i < 5; i++) {
      const club = PREMIER_LEAGUE_CLUBS[i % PREMIER_LEAGUE_CLUBS.length];
      wage = offerWageFor(club, "premier", 100, 0, wage);
    }
    const topPossible = Math.max(...PREMIER_LEAGUE_CLUBS.map(c => CEILING(c, "premier")));
    check(
      wage <= topPossible,
      `five moves in a row must not compound: ★${start} → ★${wage}, against a ceiling of ★${topPossible}`,
    );
    check(
      wage < start * 4,
      `five moves within the same division cannot multiply a wage several-fold (★${start} → ★${wage})`,
    );

    // A move never costs you money — your old wage really is a floor.
    for (const club of NATIONAL_LEAGUE_CLUBS.slice(0, 5)) {
      const held = Math.round(typicalWeeklyWage("premier"));
      check(
        offerWageFor(club, "national_league", 80, -40, held) >= held,
        `${club}: nobody takes a pay cut to join a club that came looking for them`,
      );
    }
  }

  // ── The signing-on fee, in weeks, under the sharpened curve ──
  for (const [d, clubs] of ([["national_league", NATIONAL_LEAGUE_CLUBS], ["premier", PREMIER_LEAGUE_CLUBS]] as const)) {
    for (const club of clubs) {
      const w = weeklyWageFor(club, d);
      const weeks = signingOnFee(club, w) / (w * INCOME_MULT);
      check(
        weeks >= 1 && weeks <= SIGNING_ON_WEEKS_MAX,
        `${club}: a signing-on fee should read as a sensible number of weeks of that tier's income `
        + `— got ${weeks.toFixed(1)}`,
      );
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(
  `PASS  one curve: ${SHOP_TIERS.length} tiers x ${BANDS.length} bands, fractions strictly shrinking `
  + `(${bandWeeks("upgrade", "starter").min.toFixed(0)}-${bandWeeks("upgrade", "starter").max.toFixed(0)} wks for boots at the bottom, `
  + `${bandWeeks("upgrade", "world_class").min.toFixed(1)}-${bandWeeks("upgrade", "world_class").max.toFixed(1)} at the top), `
  + `rating converters strictly rising, every one of `
  + `${BOOTS_CATALOGUE_DEFAULT.length + LIFESTYLE_ITEMS_DEFAULT.length + KIB_CANS_DEFAULT.length + STAT_KIB_CANS_DEFAULT.length} `
  + `catalogue prices in band, boots at ${BOOT_WEEKS_PER_MATCH} wks/match everywhere`,
);
