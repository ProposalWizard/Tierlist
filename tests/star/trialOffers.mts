// After the trial: always a club, usually two (Mikey, 1 Oct 2026).
import { trialOffers, generateScoutOffers, SECOND_CLUB_CHANCE, SOURED_OFFER_SHARE } from "../../lib/star/scoutOffers.ts";
import { mulberry32 } from "../../lib/star/season.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

let runs = 0, none = 0, two = 0, dupes = 0, lowTwo = 0, lowRuns = 0;
for (let score = 0; score <= 100; score += 5) {
  for (let seed = 1; seed <= 120; seed++) {
    for (const retrial of [false, true]) {
      const offers = trialOffers(score, mulberry32(seed * 7919 + score), { retrial });
      runs++;
      if (offers.length === 0) none++;
      if (offers.length >= 2) two++;
      if (new Set(offers.map(o => o.club)).size !== offers.length) dupes++;
      if (score < 30) { lowRuns++; if (offers.length >= 2) lowTwo++; }
      // Same trial, same clubs: the screen can be left and come back to.
      const again = trialOffers(score, mulberry32(seed * 7919 + score), { retrial });
      if (JSON.stringify(again) !== JSON.stringify(offers)) { fail++; console.log(`  ✗ not repeatable at score ${score}, seed ${seed}`); break; }
      if (offers.some(o => !(o.wage > 0) || !o.club)) { fail++; console.log(`  ✗ an offer with no club or wage at score ${score}`); break; }
    }
  }
}
check(none === 0, `a trial always ends with at least one club (${none} of ${runs} ended with none)`);
check(two / runs >= 0.8, `most trials draw two clubs or more (${(100 * two / runs).toFixed(0)}%)`);
check(lowTwo / lowRuns >= SECOND_CLUB_CHANCE - 0.08, `even a poor trial usually draws two (${(100 * lowTwo / lowRuns).toFixed(0)}%)`);
check(dupes === 0, "never the same club twice");

// A good trial still does better than a poor one: the clubs it would have drawn anyway.
const best = (score: number) => {
  let s = 0;
  for (let seed = 1; seed <= 200; seed++) s += Math.max(...trialOffers(score, mulberry32(seed), {}).map(o => o.strength));
  return s / 200;
};
check(best(90) > best(20), `a better trial draws stronger clubs (${best(90).toFixed(1)} v ${best(20).toFixed(1)})`);
// A poor trial is not handed a big club: below the interest bar the clubs come from the bottom rungs.
{
  let top = 0, n = 0;
  for (let seed = 1; seed <= 300; seed++) for (const score of [0, 10, 25]) {
    n++; if (trialOffers(score, mulberry32(seed), {}).some(o => o.division === "premier" || o.division === "championship")) top++;
  }
  check(top === 0, `a poor trial never draws a Premier League or Championship club (${top} of ${n})`);
}
// The old generator is untouched (its own tests still read it).
check(generateScoutOffers(0, mulberry32(1)).length === 0, "generateScoutOffers itself still returns nobody for a zero trial");
check(SOURED_OFFER_SHARE < 1 && SOURED_OFFER_SHARE > 0.5, "a soured offer is worse, not insulting");

console.log(fail ? "FAIL" : `PASS — after the trial: always a club, ${(100 * two / runs).toFixed(0)}% of trials two or more, never a duplicate`);
if (fail) process.exit(1);
