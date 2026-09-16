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
