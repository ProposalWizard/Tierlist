import { offerClauses, rescaleClauses, canTriggerClause } from "../../lib/star/contracts";
import { acceptOffer } from "../../lib/star/transfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, TransferOffer } from "../../lib/star/types";

/**
 * A CLAUSE MEANS A MULTIPLE OF THE WAGE, NOT A NUMBER OF STARS.
 *
 * Every clause `offerClauses` writes is `wage × some multiple`, and
 * `canTriggerClause` compares a buyer's means — also `wage × something` —
 * against the release clause. Both sides being wage-derived is what makes
 * the whole system scale-invariant: multiply every wage in the game by ten
 * and nothing about how hard a clause is to trigger changes.
 *
 * That holds only while the clause and the wage came from the same number.
 *
 * Clauses are written when an offer is BUILT; wage negotiation happens
 * afterwards. So as soon as a wage can be haggled upward, a release clause
 * left pinned to the opening wage becomes trivially easy to meet — and the
 * better you negotiated, the faster you would be sold. That is the failure
 * this file exists to catch, BEFORE wage negotiation ships.
 *
 * These are ratio assertions on purpose. An absolute one would pass happily
 * while the clause drifted to the wrong wage.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027, ...overrides,
  };
}

const base = (star = 3.5): CareerState => ({
  ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS], "premier"),
  starRating: star,
});

// ── Rescaling keeps every clause's multiple of the wage ──────────────────
{
  let checked = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const c = base(1 + (seed % 5));
    const fromWage = 500 + (seed * 137) % 20_000;
    const clauses = offerClauses(c, fromWage, mulberry32(seed));

    // Negotiate the wage anywhere from a big cut to a big rise.
    const factor = 0.4 + ((seed * 31) % 200) / 100;   // 0.4x .. 2.4x
    const toWage = Math.round(fromWage * factor);
    const moved = rescaleClauses(clauses, fromWage, toWage);

    for (const key of ["appearanceFee", "loyaltyBonus", "releaseClause"] as const) {
      const before = clauses[key];
      const after = moved[key];
      check(
        (before === undefined) === (after === undefined),
        `${key}: a clause should not appear or vanish when the wage is restated`,
      );
      if (before === undefined || after === undefined) continue;

      checked++;
      const ratioBefore = before / fromWage;
      const ratioAfter = after / toWage;
      // Rounding and the minimum floors move this a little on tiny wages.
      check(
        near(ratioBefore, ratioAfter, Math.max(0.01, ratioBefore * 0.02)),
        `${key}: multiple of wage changed — was ${ratioBefore.toFixed(3)}x, now ${ratioAfter.toFixed(3)}x`,
      );
    }
  }
  check(checked > 200, `expected plenty of real clauses to check, only saw ${checked}`);
}

// ── The trigger test stays equally hard after a negotiated rise ──────────
//
// This is the actual player-facing failure: negotiate well, get sold faster.
{
  let triggerableBefore = 0;
  let triggerableAfter = 0;
  let pinnedWouldTrigger = 0;
  let samples = 0;

  for (let seed = 1; seed <= 600; seed++) {
    const c = base(2 + (seed % 4));
    const fromWage = 2_000 + (seed * 91) % 18_000;
    const clauses = offerClauses(c, fromWage, mulberry32(seed * 7));
    if (clauses.releaseClause === undefined) continue;

    samples++;
    const toWage = Math.round(fromWage * 1.3);   // a good negotiation
    const strength = 55 + (seed % 40);

    const before = { ...c.contract, wage: fromWage, ...clauses };
    const after = { ...c.contract, wage: toWage, ...rescaleClauses(clauses, fromWage, toWage) };
    // What would have happened WITHOUT the rescale: clause frozen at the
    // opening wage, means computed from the signed one.
    const pinned = { ...c.contract, wage: toWage, ...clauses };

    if (canTriggerClause(before, strength, fromWage)) triggerableBefore++;
    if (canTriggerClause(after, strength, toWage)) triggerableAfter++;
    if (canTriggerClause(pinned, strength, toWage)) pinnedWouldTrigger++;
  }

  check(samples > 100, `expected a real sample of release clauses, got ${samples}`);
  check(
    triggerableBefore === triggerableAfter,
    `a negotiated rise must not change how many clauses are triggerable: `
    + `${triggerableBefore} before vs ${triggerableAfter} after`,
  );
  // And prove the bug is real rather than theoretical: without the rescale,
  // a 30% rise makes strictly more clauses meetable.
  check(
    pinnedWouldTrigger > triggerableAfter,
    `the bug this guards against should be demonstrable — pinned clauses gave `
    + `${pinnedWouldTrigger} triggerable vs ${triggerableAfter} rescaled`,
  );
}

// ── acceptOffer routes through it ────────────────────────────────────────
{
  const c = base(3.5);
  const clauses = offerClauses(c, 5_000, mulberry32(99));
  const offer: TransferOffer = {
    club: "Chelsea", strength: 80, wage: 5_000, goalBonus: 400, assistBonus: 300,
    seasons: 3, signingFee: 20_000, clauses, position: 4,
    pitch: "We want you.",
  };

  // Signed as offered: unchanged behaviour.
  const asOffered = acceptOffer(c, offer);
  check(asOffered.contract.wage === 5_000, "signing as offered keeps the offered wage");
  check(
    asOffered.contract.releaseClause === clauses.releaseClause,
    "signing as offered leaves the clauses exactly as offered",
  );

  // Signed after negotiating up.
  const negotiated = acceptOffer(c, offer, 7_500);
  check(negotiated.contract.wage === 7_500, "signing after a negotiation uses the agreed wage");
  if (clauses.releaseClause !== undefined && negotiated.contract.releaseClause !== undefined) {
    const before = clauses.releaseClause / 5_000;
    const after = negotiated.contract.releaseClause / 7_500;
    check(
      near(before, after, before * 0.02),
      `acceptOffer should restate the release clause on the agreed wage — `
      + `${before.toFixed(2)}x became ${after.toFixed(2)}x`,
    );
    check(
      negotiated.contract.releaseClause > clauses.releaseClause,
      "a higher agreed wage should raise the release clause, not leave it behind",
    );
  }
}

// ── Degenerate inputs never produce nonsense ─────────────────────────────
{
  const clauses = { appearanceFee: 100, loyaltyBonus: 200, releaseClause: 5_000 };
  for (const [from, to] of [[0, 1000], [1000, 0], [-5, 100], [1000, 1000]] as const) {
    const out = rescaleClauses(clauses, from, to);
    for (const key of ["appearanceFee", "loyaltyBonus", "releaseClause"] as const) {
      const v = out[key]!;
      check(Number.isFinite(v) && v > 0, `${key} stayed finite and positive for ${from} -> ${to}, got ${v}`);
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  clauses keep their multiple of the wage through a negotiation");
