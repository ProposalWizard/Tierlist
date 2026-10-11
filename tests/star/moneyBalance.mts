/**
 * MONEY ACROSS A WHOLE CAREER (docs/money-balance-oct2026.md).
 *
 * 1. A renewal at your own club never takes a wage past PREMIER_WAGE_CAP.
 *    Before 11 Oct 2026 it compounded off the wage you already had with no
 *    ceiling: a star at Liverpool reached ★271k a week by season 20, 2.7x
 *    the cap — and saveGuard.ts treats the cap as the limit of a legal save.
 * 2. The 20-season simulator (scripts/money-sim/sim.mts) runs end to end on
 *    the real career code, is deterministic, and keeps every wage under the
 *    cap.
 */
import {
  renewalWage, renewalMultiplier, PREMIER_WAGE_CAP,
  RENEWAL_RAISE_PER_WIN, RENEWAL_SOURED_CUT,
} from "../../lib/star/economy";
import { SHAPES, runCareer } from "../../scripts/money-sim/sim.mts";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. renewalWage ──────────────────────────────────────────────────────────
check(RENEWAL_RAISE_PER_WIN === 0.08 && RENEWAL_SOURED_CUT === 0.15,
  "the renewal talks still pay +8% a right guess and cost 15% on a wrong one");
check(renewalWage(1000, 2, false) === 1160, `two right guesses on ★1,000 is ★1,160 (got ${renewalWage(1000, 2, false)})`);
check(renewalWage(1000, 2, true) === Math.round(1000 * 1.16 * 0.85), "a soured talk takes 15% off where it got to");
check(renewalWage(1000, 0, false) === 1000, "no right guesses, same wage");
check(Math.abs(renewalMultiplier(3, false) - 1.24) < 1e-9, "the multiplier is 1 + 8% a win");

// Below the cap: exactly the old formula. Never above it, however many wins.
for (const w of [25, 900, 6336, 29_831, 80_000, 95_000, 99_999, 100_000]) {
  for (let wins = 0; wins <= 30; wins++) {
    const got = renewalWage(w, wins, false);
    const old = Math.round(w * (1 + 0.08 * wins));
    check(got <= PREMIER_WAGE_CAP, `★${w} with ${wins} wins stays under the cap (got ${got})`);
    check(got === Math.min(old, PREMIER_WAGE_CAP), `★${w} with ${wins} wins is the old raise, capped (got ${got}, old ${old})`);
  }
}
// A save already above the cap (from before the fix) keeps its wage; it is not cut.
check(renewalWage(150_000, 3, false) === 150_000, "a wage already over the cap is kept, not cut, by a renewal");
check(renewalWage(150_000, 0, true) < 150_000, "…but a soured talk can still lower it");

// Renewing every week from a top wage: the old way runs away, the new way stops.
{
  let capped = 29_000, uncapped = 29_000;
  for (let i = 0; i < 38; i++) {
    capped = renewalWage(capped, 1, false);
    uncapped = Math.round(uncapped * renewalMultiplier(1, false));
  }
  check(capped === PREMIER_WAGE_CAP, `38 weekly renewals from ★29k stop at the cap (got ${capped})`);
  check(uncapped > 5 * PREMIER_WAGE_CAP, `…where the old formula ran past ★500k (got ${uncapped})`);
}

// ── 2. The simulator ────────────────────────────────────────────────────────
const star = SHAPES.find(s => s.id === "star")!;
const average = SHAPES.find(s => s.id === "average")!;

const starRows = runCareer(star);
check(starRows.length === 20, `the star career plays 20 seasons (got ${starRows.length})`);
for (const r of starRows) {
  check(r.wage <= PREMIER_WAGE_CAP, `season ${r.season}: the star's wage is under the cap (★${r.wage})`);
  check(Number.isFinite(r.bank) && r.bank >= 0, `season ${r.season}: the bank is a real, non-negative number (★${r.bank})`);
}
check(starRows[19].division === "premier", "the star ends in the Premier League");

// The bug this file was written for, reproduced: the old renewal goes past the cap.
const starBefore = runCareer(star, { uncappedRenewals: true });
check(starBefore.some(r => r.wage > PREMIER_WAGE_CAP),
  `the old, uncapped renewal passes the cap in the same career (max ★${Math.max(...starBefore.map(r => r.wage))})`);

const a1 = runCareer(average, { seasons: 8 });
const a2 = runCareer(average, { seasons: 8 });
check(JSON.stringify(a1) === JSON.stringify(a2), "the simulator is deterministic: two runs, same numbers");
check(a1[0].division === "national_league" && a1[0].wage <= 50,
  `the average career starts in the National League on NSS money (★${a1[0].wage} a week)`);

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — renewals stop at the wage cap; the 20-season money simulator runs, deterministic");
