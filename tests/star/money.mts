import { formatMoney, niceMoneyStep } from "../../lib/star/money";

/**
 * MONEY FORMATTING — the exact worked examples given directly by the user.
 *
 * Reverted 14 Sep 2026: the earlier version showed every remaining digit as
 * a decimal (12,500,072 read as "12.500072m") — reported directly as messy
 * in practice ("ten point zero zero zero zero zero three million" instead
 * of a clean "10m"). Rounded down to a clean whole k/m/b now; the real
 * amount is untouched everywhere it's actually tracked, only the display
 * string is simplified.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(formatMoney(999) === "999", `under 1000 shows plainly (${formatMoney(999)})`);
check(formatMoney(1256) === "1k", `1,256 rounds down to a clean 1k (${formatMoney(1256)})`);
check(formatMoney(311_798) === "311k", `311,798 rounds down to a clean 311k, not 311.798k (${formatMoney(311_798)})`);
check(formatMoney(10_000_003) === "10m", `10,000,003 rounds down to a clean 10m, not 10.000003m (${formatMoney(10_000_003)})`);
check(formatMoney(12_500_072) === "12m", `12,500,072 rounds down to 12m (${formatMoney(12_500_072)})`);
check(formatMoney(46_000_000_000) === "46b", `an exact 46 billion reads as plain 46b (${formatMoney(46_000_000_000)})`);
check(formatMoney(12_500_000) === "12m", `no decimal point ever shown any more (${formatMoney(12_500_000)})`);
check(formatMoney(1000) === "1k", `an exact thousand has no decimal point (${formatMoney(1000)})`);
check(formatMoney(0) === "0", `zero shows plainly (${formatMoney(0)})`);
check(formatMoney(-2500) === "-2k", `negative amounts keep their sign (${formatMoney(-2500)})`);
check(formatMoney(1_000_000) === "1m", `an exact million (${formatMoney(1_000_000)})`);
check(formatMoney(1_000_000_000) === "1b", `an exact billion (${formatMoney(1_000_000_000)})`);

// ── niceMoneyStep — the exact worked examples given directly ────────────
check(niceMoneyStep(2_000_000) === 250_000, `~2M steps by 250K (${niceMoneyStep(2_000_000)})`);
check(niceMoneyStep(50_000_000) === 1_000_000, `~50M steps by 1M (${niceMoneyStep(50_000_000)})`);
check(niceMoneyStep(100_000_000) === 5_000_000, `~100M steps by 5M (${niceMoneyStep(100_000_000)})`);
check(niceMoneyStep(500) === 500, `a small amount still steps by a real, non-trivial amount (${niceMoneyStep(500)})`);
{
  let prev = niceMoneyStep(100);
  for (const v of [1_000, 50_000, 500_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000]) {
    const step = niceMoneyStep(v);
    check(step >= prev, `steps never get SMALLER as the amount grows (${prev} -> ${step} at ${v})`);
    prev = step;
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — money formats to a clean, rounded-down k/m/b with no decimal clutter, matching every worked example given directly");
