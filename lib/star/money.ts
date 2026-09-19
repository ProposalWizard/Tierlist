/**
 * MONEY FORMATTING — K / M / B, ROUNDED TO A CLEAN WHOLE NUMBER.
 *
 * Reverted 14 Sep 2026, reported directly as messy in practice: the
 * original version of this (see git history) showed every remaining digit
 * as a decimal — a balance of ★10,000,003 read as "10.000003m", a club
 * worth ★311,798 read as "311.798k". Real, but cluttered. The real amount
 * is still tracked exactly everywhere in the game's own state (balances,
 * fees, valuations) — this function only ever governs the DISPLAY string,
 * so nothing is actually lost by rounding it away here; it just isn't
 * shown. Floors rather than rounds up (doesn't matter which per the
 * person who asked — floor keeps a balance display from ever looking
 * bigger than what's really there).
 */
/**
 * THE PERSONAL-MONEY SCALE.
 *
 * On 14 Sep 2026 every personal-money value in the game was multiplied by
 * 2000 — the same move that took the starting wage from ★1 to ★2,000 — so
 * that amounts read as real money instead of small placeholder numbers,
 * while every item's cost in weeks-of-wage stayed exactly the same. See the
 * header of `shopDefaults.ts` for the full reasoning.
 *
 * Three formulas were missed by that pass and stayed on the old ★1 scale,
 * which made them rounding errors rather than rewards: the per-match
 * sponsor payment, the retirement testimonial, and a since-deleted orphaned
 * copy of the horse-racing prices. This constant exists so that fixing them
 * points at one named thing rather than three loose 2000s, and so a future
 * reader can find every place the rescale reaches.
 *
 * Note this is the PERSONAL scale. Club-level money (transfer fees, club
 * valuations, facilities) deliberately uses a much larger one — a
 * footballer's own wallet is nowhere near a club's finances.
 *
 * ── HISTORY NOW, NOT A LIVE DIAL. 19 Sep 2026. ──
 *
 * NOTHING IN THE GAME MULTIPLIES BY THIS ANY MORE. The rescale it describes
 * was a real fix to a real problem, and it turned out to be the wrong KIND
 * of fix: multiplying a number by 2000 corrects its order of magnitude once
 * and leaves it derived from nothing, so every figure it touched drifted
 * back out of proportion the moment economy.ts gave the game an income
 * curve, and again when that curve was sharpened. Each of them — the
 * testimonial, per-match image rights, dilemma payouts, influence, lawyers,
 * the black market, the §4.5 son, sponsor fees — is now priced in weeks of
 * income off `economy.ts` instead, and cannot be left behind by the next
 * retune.
 *
 * The constant is kept, exported and at its historical value because a
 * reader will find it named in comments across half a dozen files that
 * explain what happened to them, and because `tests/star/moneyScale.mts`
 * asserts that it has no live multiplier left anywhere.
 *
 * THE ONE DIAL IS NOW `WAGE_FLOOR` (economy.ts). See that file's header for
 * the still-open question of which unit the game should read in.
 */
export const MONEY_SCALE = 2000;

/**
 * A "clean" step size for a +/- stepper on a money amount — requested
 * directly, after a real negotiation input's arrows only moved by ★1 per
 * click, meaningless once amounts run into the millions. Widens in real
 * brackets as the amount itself grows (worked examples given directly: an
 * opening offer around ★2,000,000 should move in ★250,000 steps; around
 * ★50,000,000, ★1,000,000 steps; around ★100,000,000, ★5,000,000 steps),
 * so holding the button down always moves toward genuinely different, round
 * numbers rather than crawling one unit at a time. Free-typing an exact
 * amount is untouched by this — it only governs the +/- buttons.
 */
export function niceMoneyStep(amount: number): number {
  const a = Math.abs(amount);
  if (a < 10_000) return 500;
  if (a < 100_000) return 5_000;
  if (a < 1_000_000) return 25_000;
  if (a < 10_000_000) return 250_000;
  if (a < 100_000_000) return 1_000_000;
  if (a < 1_000_000_000) return 5_000_000;
  return 25_000_000;
}

/**
 * Like formatMoney, but keeps one real decimal digit instead of flooring it
 * away — requested directly for the negotiation screen: agreeing a deal at
 * ★2,500,000 should read "Deal agreed — ★2.5m", not "★2m", since the whole
 * negotiation up to that point was conducted in real, non-round numbers.
 * Deliberately a SEPARATE function from formatMoney rather than a shared
 * option — formatMoney's own whole-number rounding was a direct, explicit
 * revert of exactly this kind of decimal precision for everyday balance/
 * valuation displays (see this file's own header), so that behaviour stays
 * the default everywhere else; this is opt-in, for the one place a rounded
 * number would visibly contradict a number just shown seconds earlier.
 */
export function formatMoneyPrecise(n: number): string {
  const negative = n < 0;
  const value = Math.abs(n);

  const UNITS: { div: number; suffix: string }[] = [
    { div: 1_000_000_000, suffix: "b" },
    { div: 1_000_000, suffix: "m" },
    { div: 1_000, suffix: "k" },
  ];

  for (const u of UNITS) {
    if (value >= u.div) {
      let str = (value / u.div).toFixed(1);
      if (str.endsWith(".0")) str = str.slice(0, -2);
      return `${negative ? "-" : ""}${str}${u.suffix}`;
    }
  }
  return `${negative ? "-" : ""}${Math.round(value)}`;
}

export function formatMoney(n: number): string {
  const negative = n < 0;
  const value = Math.round(Math.abs(n));

  const UNITS: { div: number; suffix: string }[] = [
    { div: 1_000_000_000, suffix: "b" },
    { div: 1_000_000, suffix: "m" },
    { div: 1_000, suffix: "k" },
  ];

  for (const u of UNITS) {
    if (value >= u.div) {
      const whole = Math.floor(value / u.div);
      return `${negative ? "-" : ""}${whole}${u.suffix}`;
    }
  }
  return `${negative ? "-" : ""}${value}`;
}
