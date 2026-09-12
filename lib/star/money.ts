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
