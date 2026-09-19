import { MONEY_SCALE } from "../../lib/star/money";
import { testimonialFor, TESTIMONIAL_APPEARANCES, TESTIMONIAL_WEEKS_PER_POINT } from "../../lib/star/retirement";
import { finaliseMatch } from "../../lib/star/matchStats";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { BOOTS_CATALOGUE } from "../../lib/star/shopData";
import {
  tierWeeklyIncome, tierPrice, typicalWeeklyWage, typicalWeeklyIncome,
  sponsorPayPerMatch, SPONSOR_PAY_WEEKS_PER_MATCH, SPONSOR_MATCHES_PER_WEEK,
  TOTAL_INCOME_SHARES,
} from "../../lib/star/economy";
import { LAWYER_FEE } from "../../lib/star/corruption";
import { MONEY_PER_INFLUENCE_POINT, FULL_INFLUENCE_COST } from "../../lib/star/governingBodies";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * NO MONEY FIGURE IN THE PERSONAL ECONOMY IS A BARE NUMBER, OR A FLAT
 * MULTIPLE OF ONE.
 *
 * ── What this file used to say, and why that is no longer the claim ──
 *
 * On 14 Sep 2026 every personal-money value was multiplied by 2000, and a
 * handful of formulas were missed by that pass and left as rounding errors:
 * the per-match sponsor payment (capped at ★5), the retirement testimonial
 * (about ★500 for an entire career), and some since-deleted duplicates. This
 * file was written to pin those fixes down, and it did it by asserting the
 * exact thing that was done — "this figure is the old formula x MONEY_SCALE".
 *
 * That assertion has now been superseded, and it is worth being precise about
 * why rather than just deleting it. Multiplying a number by 2000 fixes its
 * ORDER OF MAGNITUDE and leaves it derived from nothing at all. So every one
 * of those figures drifted straight back out of proportion the moment
 * economy.ts gave the game a real income curve, and then again when that
 * curve was sharpened on 19 Sep 2026:
 *
 *   - the testimonial paid ★1,440,000, about ten whole top-flight seasons of
 *     income for one evening's football;
 *   - the per-match sponsor payment paid ★10,000 a match — 8.6 weeks of
 *     Premier League income PER MATCH, and over a 38-match season 8.6 TIMES
 *     the entire modelled income of the career. Every other price in the game
 *     was meaningless while it stood, because the wallet they were priced
 *     against was being filled from somewhere else entirely;
 *   - influence, lawyers and the §4.5 son sat at figures nobody would ever
 *     have paid (total control of FIFA cost eleven Private Islands).
 *
 * So the claim is now the stronger one: EVERY personal-money figure is
 * DERIVED FROM economy.ts's income curve, and each one lands in a stated
 * window of weeks-of-income. A figure that is derived cannot be left behind
 * by the next retune, which a figure that was multiplied always can be.
 *
 * ── What is kept from the old file, deliberately ──
 *
 * The windows below are still ABSOLUTE assertions, for the original reason:
 * the whole failure mode is a number sitting quietly at the wrong order of
 * magnitude for days while every relative check around it still passes. And
 * the SWEEP at the bottom is kept and widened — it reads the real source of
 * every file that prices something in stars and insists no bare literal and
 * no flat `* MONEY_SCALE` survives in any of them. It is a blunt instrument
 * and deliberately so: the failure it guards against is somebody adding a
 * plausible-looking number years from now, and no clever test catches that.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const TOP = tierWeeklyIncome("world_class");
const SEASON_WEEKS = 38;

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027, ...overrides,
  };
}

const base = (): CareerState =>
  makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS], "premier");

// ── The testimonial is a send-off, not a second career ───────────────────
{
  const c: CareerState = { ...base(), clubAppearances: 300, fame: 80, starRating: 5 };
  const t = testimonialFor(c);
  check(t !== null, "a 300-appearance career should earn a testimonial at all");

  if (t) {
    // It is exactly the old SHAPE — appearances are what earn it, a bigger
    // name fills a bigger ground — read against the curve rather than against
    // a multiplier. Asserted as the derivation, so it cannot be left behind.
    const score = 300 * 0.9 + 80 * 1.6 + 5 * 22;
    check(
      t.payout === Math.round(score * TESTIMONIAL_WEEKS_PER_POINT * TOP),
      `the testimonial is the unchanged formula read as weeks of top-flight income `
      + `(expected ${Math.round(score * TESTIMONIAL_WEEKS_PER_POINT * TOP)}, got ${t.payout})`,
    );

    // …and it lands somewhere a human would call a send-off. Before it was
    // fixed it was ~★508 (nothing); after the flat rescale it was ★1,440,000
    // (roughly ten top-flight seasons). Both ends are now pinned in weeks.
    const weeks = t.payout / TOP;
    check(
      weeks >= 10 && weeks <= 80,
      `a great one-club career's testimonial should be between ten weeks and two seasons of `
      + `top-flight income — got ${weeks.toFixed(1)} weeks (★${t.payout})`,
    );
    // A modest career earns a real but visibly smaller evening.
    const modest = testimonialFor({ ...c, clubAppearances: 150, fame: 30, starRating: 2 });
    check(!!modest && modest.payout < t.payout * 0.7,
      "a modest career's testimonial is visibly smaller than a great one's");
  }

  // The loyalty gate is untouched by any of this.
  check(testimonialFor({ ...c, clubAppearances: TESTIMONIAL_APPEARANCES - 1 }) === null,
    "a player short of the appearance bar earns no testimonial");
}

// ── Per-match sponsor money: THE bug this whole recalibration turned on ──
{
  const withSponsors: CareerState = {
    ...base(), relationships: { ...base().relationships, sponsors: 100 },
  };
  const none: CareerState = {
    ...base(), relationships: { ...base().relationships, sponsors: 0 },
  };

  const args = [3, 1, 0, 20, 90, 2, 1] as const;
  const paid = finaliseMatch(...args, withSponsors);
  const unpaid = finaliseMatch(...args, none);
  const delta = paid.totalCash - unpaid.totalCash;
  const wage = none.contract.wage;

  // Derived, not flat: exactly `sponsorPayPerMatch` off the wage actually
  // being paid for this fixture.
  check(
    delta === sponsorPayPerMatch(wage, 100),
    `per-match sponsor pay is sponsorPayPerMatch off the real wage `
    + `(expected ${sponsorPayPerMatch(wage, 100)}, got ${delta})`,
  );

  // THE REGRESSION GUARD, stated the way the bug was found. A whole season of
  // image rights at FULL sponsor standing must be a modest share of a season's
  // income — not a multiple of it. It was 8.6x before this was fixed.
  const seasonSponsor = delta * SEASON_WEEKS;
  const seasonIncome = typicalWeeklyIncome("premier") * SEASON_WEEKS;
  check(
    seasonSponsor < seasonIncome * 0.25,
    `a full season of image rights (★${Math.round(seasonSponsor)}) must stay a modest share of a `
    + `season's income (★${Math.round(seasonIncome)}) — it was 8.6 TIMES it before this was derived`,
  );
  // …and it is genuinely the share TOTAL_INCOME_SHARES claims it is.
  const shareOfAWeek = (delta * SPONSOR_MATCHES_PER_WEEK) / wage;
  check(
    Math.abs(shareOfAWeek - TOTAL_INCOME_SHARES.sponsorPerMatch) < 0.005,
    `at full standing, image rights should contribute exactly `
    + `TOTAL_INCOME_SHARES.sponsorPerMatch (${TOTAL_INCOME_SHARES.sponsorPerMatch}) of a week's wage — `
    + `got ${shareOfAWeek.toFixed(4)}`,
  );
  check(
    Math.abs(SPONSOR_PAY_WEEKS_PER_MATCH * SPONSOR_MATCHES_PER_WEEK - TOTAL_INCOME_SHARES.sponsorPerMatch) < 1e-9,
    "SPONSOR_PAY_WEEKS_PER_MATCH is derived from the declared share, not typed in beside it",
  );

  // Standing genuinely drives it, in both directions.
  check(unpaid.sponsorPay === 0, `no sponsor standing should pay nothing, got ${unpaid.sponsorPay}`);
  check(sponsorPayPerMatch(wage, 50) < sponsorPayPerMatch(wage, 100),
    "serving your sponsors better is worth more money");
  check(unpaid.totalCash >= wage, "a match should still pay at least the wage with no sponsors");
}

// ── The late-career money sinks land in a stated window of weeks ─────────
{
  const windows: { what: string; value: number; min: number; max: number }[] = [
    { what: "hiring lawyers", value: LAWYER_FEE, min: 4, max: 20 },
    { what: "one point of governing-body influence", value: MONEY_PER_INFLUENCE_POINT, min: 0.5, max: 3 },
    { what: "total control of a governing body", value: FULL_INFLUENCE_COST, min: 50, max: 200 },
  ];
  for (const w of windows) {
    const weeks = w.value / TOP;
    check(
      weeks >= w.min && weeks <= w.max,
      `${w.what} should cost ${w.min}-${w.max} weeks of top-flight income — got ${weeks.toFixed(1)} `
      + `(★${w.value})`,
    );
  }
  // Total control is a hundred single points and nothing else.
  check(FULL_INFLUENCE_COST === MONEY_PER_INFLUENCE_POINT * 100,
    "full influence is exactly a hundred points");
  // …and it stays in the bracket of the biggest thing you can own, which is
  // the comparison governingBodies.ts's own doc makes.
  check(
    FULL_INFLUENCE_COST < tierPrice("world_class", 150),
    "total control of a governing body should not out-price the Private Island",
  );
}

// ── Boot pace stays inert and off-screen ─────────────────────────────────
{
  // The field remains on the type for save compatibility, but nothing should
  // start reading it again without making it do something first — see the
  // doc comment on Boot.pace in types.ts.
  check(
    typeof BOOTS_CATALOGUE[0].pace === "number",
    "Boot.pace should still exist so a boot stored in an old save still matches the type",
  );
}

// ── THE SWEEP: no bare literals, AND no flat multiplier either ──────────
//
// Kept from the original file and widened. It reads the real source of every
// file that prices something in stars and flags two things now, not one: a
// bare number where a derived one belongs, and a `* MONEY_SCALE` anywhere at
// all — because a flat multiplier is exactly how all five of these figures
// ended up wrong a second time.
{
  const { readFileSync } = await import("node:fs");
  const read = (f: string) => readFileSync(new URL(`../../lib/star/${f}`, import.meta.url), "utf8");
  /** Comments explain the history; only real code is being swept. */
  const code = (f: string) => read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const checks: { file: string; what: string; pattern: RegExp }[] = [
    // A dilemma's money effect. Must go through `cash()`, which now reads
    // the curve rather than multiplying.
    { file: "dilemmas.ts", what: "a dilemma's money effect", pattern: /money:\s*-?\d+(?![\d*])/g },
    // Flat price constants.
    { file: "governingBodies.ts", what: "the price of influence", pattern: /MONEY_PER_INFLUENCE_POINT\s*=\s*[\d_]+\s*;/g },
    { file: "clubPowers.ts", what: "the cost of a son", pattern: /HAVE_A_SON_COST\s*=\s*[\d_]+\s*;/g },
    { file: "corruption.ts", what: "the lawyers' fee", pattern: /LAWYER_FEE\s*=\s*[\d_]+\s*;/g },
  ];

  for (const c of checks) {
    const hits = code(c.file).match(c.pattern) ?? [];
    check(
      hits.length === 0,
      `${c.file}: ${c.what} looks like a bare figure again — found ${hits.length} `
      + `(${hits.slice(0, 3).join(", ")}). Price it off economy.ts (tierPrice / tierWeeklyIncome), `
      + "or if it is genuinely not money, rename it so this stops matching.",
    );
  }

  // The new positive half: every one of these files reads the CURVE. The old
  // version of this check accepted a mention of `MONEY_SCALE`, which is
  // exactly the thing that turned out not to be good enough.
  const CURVE_FILES = [
    "dilemmas.ts", "governingBodies.ts", "clubPowers.ts", "retirement.ts",
    "corruption.ts", "sponsors.ts", "matchStats.ts", "transfers.ts",
    "relegationOffers.ts", "scoutOffers.ts",
  ];
  for (const f of CURVE_FILES) {
    check(
      /from "\.\/economy"/.test(read(f)),
      `${f} prices things in stars but never reads economy.ts — either it is off the curve, `
      + "or it should say why not",
    );
    check(
      !/\*\s*MONEY_SCALE/.test(code(f)),
      `${f} still multiplies by MONEY_SCALE. A flat multiplier fixes an order of magnitude and `
      + "leaves the figure derived from nothing — which is how every value in this file ended up "
      + "wrong a second time. Derive it from economy.ts instead.",
    );
  }

  // MONEY_SCALE itself is now HISTORY, not a live dial: nothing in the game
  // multiplies by it any more. It is kept exported because money.ts's own
  // note explains what it was and why a reader will find it referenced in
  // comments across half a dozen files.
  check(MONEY_SCALE === 2000,
    `MONEY_SCALE is kept at its historical 2000 for the record (got ${MONEY_SCALE})`);
  const liveUses = CURVE_FILES.concat(["money.ts", "freeAgent.ts", "economy.ts"])
    .filter(f => /\*\s*MONEY_SCALE|MONEY_SCALE\s*\*/.test(code(f)));
  check(
    liveUses.length === 0,
    `MONEY_SCALE should no longer multiply anything — still live in ${liveUses.join(", ")}`,
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(
  `PASS  every personal-money figure is derived from the curve — testimonial, image rights, `
  + `lawyers and influence all land in a stated window of weeks (top-flight income `
  + `★${Math.round(TOP)}/wk, wage ★${Math.round(typicalWeeklyWage("premier"))}/wk)`,
);
