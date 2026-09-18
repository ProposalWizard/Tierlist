import type { CareerState, Fixture } from "./types";
import { dayFor, divisionOf } from "./calendar";

/**
 * WHAT A WEEK'S WAGE IS, AND WHICH MATCH PAYS IT.
 *
 * A wage is a WEEK's wage. It is paid at the weekend game if there is one,
 * and otherwise split evenly across whatever games that week does have.
 * Specified directly, and it corrects a real overpayment nobody had noticed.
 *
 * ── What was wrong ──
 *
 * The wage was added to your money once per match PLAYED (matchStats.ts's
 * `totalCash`) and once per fixture MISSED (careerFlow.ts's
 * `simulateMissedFixture`). Both are per-fixture. So a week containing a
 * midweek cup tie *and* a Saturday league game paid two full weeks' wages,
 * and a European week could too. Across a season with a deep cup run and a
 * European campaign that is a large, silent overpayment — and it scales with
 * the wage, so club-scaled wages would have made it considerably worse.
 *
 * ── The rule ──
 *
 * Every fixture in a week carries a SHARE of that week's wage, and the shares
 * across a week always total exactly 1:
 *
 *   - a week with a weekend game pays it all at that game;
 *   - a week with only midweek games splits it evenly across them;
 *   - a week with no games at all is handled elsewhere, by the ordinary
 *     week rollover, exactly as before.
 *
 * The share is deliberately the same whether you played the fixture or sat
 * it out — you are paid for the week, not for turning up. That is also what
 * keeps the total honest: a week you half-played and half-missed still pays
 * one week's wage, where before it would have paid one and a half.
 *
 * Pure and side-effect free, so both payment sites can call it and both
 * arrive at the same answer.
 */

/** A fixture is identified by week + kind + opponent, never object identity. */
function sameFixture(a: Fixture, b: Fixture): boolean {
  return a.week === b.week
    && (a.kind ?? "league") === (b.kind ?? "league")
    && a.opponent === b.opponent;
}

/**
 * The fraction of a week's wage this fixture carries: 0, 1, or a share.
 *
 * Returns 1 for a fixture that isn't in the career's list at all — a
 * standalone or synthetic fixture has no week to share with, and paying it
 * nothing would be worse than paying it fully.
 */
export function wageShareFor(career: CareerState, fixture: Fixture): number {
  const inWeek = (career.fixtures ?? []).filter(f => f.week === fixture.week);

  // Not a fixture this career knows about, or the only one that week.
  if (inWeek.length <= 1) return 1;

  const division = divisionOf(career);
  const isWeekend = (f: Fixture) => dayFor(f.kind, f.week, division) === "saturday";

  // A weekend game takes the week's wage. Only if there isn't one does the
  // week split across its midweek games.
  const weekend = inWeek.filter(isWeekend);
  const payers = weekend.length > 0 ? weekend : inWeek;

  const isPayer = payers.some(f => sameFixture(f, fixture));
  if (!isPayer) return 0;

  return 1 / payers.length;
}

/**
 * This fixture's actual wage payment, in money.
 *
 * Rounded so a split never introduces fractions of a star into a balance.
 * Rounding each share independently can lose a unit or two across a split
 * week, which is deliberate: it is a rounding difference on one week's pay,
 * and the alternative (tracking a remainder across fixtures) is real
 * complexity for no player-visible gain.
 */
export function wageForFixture(career: CareerState, fixture: Fixture): number {
  return Math.round(career.contract.wage * wageShareFor(career, fixture));
}
