/**
 * MONEY FORMATTING — K / M / B, WITH EVERY REMAINING DIGIT AS A DECIMAL.
 *
 * Requested directly, with worked examples: ★1,256 reads as "1.256k", not
 * "1.3k" — every digit below the unit boundary becomes a decimal digit
 * rather than being rounded away, so ★12,500,072 reads as "12.500072m" and
 * ★46,000,000,000 reads cleanly as "46b" (a zero remainder drops the
 * decimal point entirely, and trailing zero digits are trimmed the same
 * way — ★12,500,000 is "12.5m", not "12.500000m").
 *
 * Deliberately NOT the same convention every other `money()` helper across
 * this game's screens already used (a rounded one-or-two-decimal
 * `toFixed`) — this is the one true implementation those should now defer
 * to, so a balance reads identically everywhere it's shown.
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

export function formatMoney(n: number): string {
  const negative = n < 0;
  const value = Math.round(Math.abs(n));

  const UNITS: { div: number; suffix: string; digits: number }[] = [
    { div: 1_000_000_000, suffix: "b", digits: 9 },
    { div: 1_000_000, suffix: "m", digits: 6 },
    { div: 1_000, suffix: "k", digits: 3 },
  ];

  for (const u of UNITS) {
    if (value >= u.div) {
      const whole = Math.floor(value / u.div);
      const remainder = value % u.div;
      if (remainder === 0) return `${negative ? "-" : ""}${whole}${u.suffix}`;
      const decimals = String(remainder).padStart(u.digits, "0").replace(/0+$/, "");
      return `${negative ? "-" : ""}${whole}.${decimals}${u.suffix}`;
    }
  }
  return `${negative ? "-" : ""}${value}`;
}
