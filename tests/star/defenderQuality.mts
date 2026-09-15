import { defenderReachMultiplier } from "../../lib/star/canvasEngine";

/**
 * A DEFENDER'S REAL QUALITY, NOT JUST HIS BODY.
 *
 * "A defender gets to it" (canvasEngine.ts) used to be pure geometry — one
 * fixed reach every defender on earth shared, no roll, no skill check at
 * all, flagged honestly in an earlier session as genuinely not a small
 * follow-up unlike the keeper's own quality dial. `defenderReachMultiplier`
 * is that follow-up, finally built once real per-player `defending` data
 * had somewhere to come from.
 *
 * The one property that matters most here isn't the curve's shape — it's
 * that `undefined` (no real identity at all, which is nearly every
 * defender in every save that existed before this session) returns EXACTLY
 * 1, so today's behaviour is provably unchanged by construction, not by a
 * Monte-Carlo measurement the way the keeper-dive rework needed one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── No real identity — the overwhelming majority of live saves today ──
check(defenderReachMultiplier(undefined) === 1, "no real quality at all leaves the multiplier at exactly 1 — zero behaviour change");

// ── A middling defender reaches almost exactly as far as ever ──
{
  const mid = defenderReachMultiplier(50);
  check(Math.abs(mid - 1) < 0.01, `defending 50 is the neutral centre (got ${mid})`);
}

// ── Monotonic: better defending always reaches at least as far ──
{
  let prev = defenderReachMultiplier(0);
  for (let q = 5; q <= 100; q += 5) {
    const cur = defenderReachMultiplier(q);
    check(cur >= prev, `reach multiplier never drops as quality rises (q=${q}: ${cur} < prev ${prev})`);
    prev = cur;
  }
}

// ── Real, but bounded — never doubles the reach, never zeroes it ──
{
  const worst = defenderReachMultiplier(0);
  const best = defenderReachMultiplier(100);
  check(worst >= 0.7 && worst < 1, `a hopeless defender reaches meaningfully less but still defends (got ${worst})`);
  check(best > 1 && best <= 1.3, `an elite defender reaches meaningfully more but isn't a wall (got ${best})`);
  check(best - worst > 0.2, `the gap between a poor and an elite defender is real, not cosmetic (${best} vs ${worst})`);
}

// ── Out-of-range input clamps rather than producing something absurd ──
{
  check(defenderReachMultiplier(-40) === defenderReachMultiplier(0), "a negative quality clamps to the same floor as 0");
  check(defenderReachMultiplier(500) === defenderReachMultiplier(100), "an absurd quality clamps to the same ceiling as 100");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a defender's own real quality genuinely, safely, and honestly moves his reach");
