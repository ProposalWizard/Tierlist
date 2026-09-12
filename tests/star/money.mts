import { formatMoney } from "../../lib/star/money";

/**
 * MONEY FORMATTING — the exact worked examples given directly by the user.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(formatMoney(999) === "999", `under 1000 shows plainly (${formatMoney(999)})`);
check(formatMoney(1256) === "1.256k", `1,256 reads as 1.256k (${formatMoney(1256)})`);
check(formatMoney(12_500_072) === "12.500072m", `12,500,072 reads as 12.500072m (${formatMoney(12_500_072)})`);
check(formatMoney(46_000_000_000) === "46b", `an exact 46 billion reads as plain 46b (${formatMoney(46_000_000_000)})`);
check(formatMoney(12_500_000) === "12.5m", `trailing zero decimals are trimmed (${formatMoney(12_500_000)})`);
check(formatMoney(1000) === "1k", `an exact thousand has no decimal point (${formatMoney(1000)})`);
check(formatMoney(0) === "0", `zero shows plainly (${formatMoney(0)})`);
check(formatMoney(-2500) === "-2.5k", `negative amounts keep their sign (${formatMoney(-2500)})`);
check(formatMoney(1_000_000) === "1m", `an exact million (${formatMoney(1_000_000)})`);
check(formatMoney(1_000_000_000) === "1b", `an exact billion (${formatMoney(1_000_000_000)})`);

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — money formats to k/m/b with every remaining digit as a real decimal, trailing zeros trimmed, matching every worked example given directly");
