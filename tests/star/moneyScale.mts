import { MONEY_SCALE } from "../../lib/star/money";
import { testimonialFor, TESTIMONIAL_APPEARANCES } from "../../lib/star/retirement";
import { finaliseMatch } from "../../lib/star/matchStats";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { BOOTS_CATALOGUE } from "../../lib/star/shopData";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE PERSONAL-MONEY SCALE.
 *
 * On 14 Sep 2026 every personal-money value was multiplied by 2000, so that
 * amounts read as real money while each item's cost in weeks-of-wage stayed
 * the same. Three formulas were missed and stayed on the old ★1 scale, which
 * left them as rounding errors rather than rewards:
 *
 *   - the per-match sponsor payment, capped at ★5;
 *   - the retirement testimonial, about ★500 for an entire career;
 *   - an orphaned duplicate of the horse prices in a dead component.
 *
 * The first two are fixed and tested here. The third was dead code with no
 * importers and was deleted.
 *
 * These are absolute-value assertions on purpose. The whole failure mode was
 * a number sitting quietly at the wrong order of magnitude for days while
 * every relative check around it still passed, so a relative test would not
 * have caught it and would not catch a regression either.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027, ...overrides,
  };
}

const base = (): CareerState =>
  makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS], "premier");

// ── The scale constant itself ────────────────────────────────────────────
check(MONEY_SCALE === 2000, `MONEY_SCALE should be 2000, got ${MONEY_SCALE}`);

// ── The testimonial is a send-off, not a rounding error ──────────────────
{
  const c: CareerState = {
    ...base(),
    clubAppearances: 300,
    fame: 80,
    starRating: 5,
  };
  const t = testimonialFor(c);
  check(t !== null, "a 300-appearance career should earn a testimonial at all");

  if (t) {
    // Pre-fix this formula returned ~508. The same inputs must now land on
    // the real personal-money scale.
    check(
      t.payout > 500_000,
      `testimonial for a 300-app, fame-80, 5-star career should be six figures or more, got ${t.payout}`,
    );
    // Sanity on the other side: a send-off, not a transfer fee.
    check(
      t.payout < 5_000_000,
      `testimonial should not rival a club valuation, got ${t.payout}`,
    );
    // It is exactly the old shape times the scale, not a new formula.
    const oldShape = Math.round(300 * 0.9 + 80 * 1.6 + 5 * 22);
    check(
      t.payout === oldShape * MONEY_SCALE,
      `testimonial should be the unchanged formula x MONEY_SCALE (${oldShape * MONEY_SCALE}), got ${t.payout}`,
    );
  }

  // The loyalty gate is untouched by any of this.
  const tooNew = testimonialFor({ ...c, clubAppearances: TESTIMONIAL_APPEARANCES - 1 });
  check(tooNew === null, "a player short of the appearance bar earns no testimonial");
}

// ── Sponsor money per match is worth collecting ──────────────────────────
{
  const withSponsors: CareerState = {
    ...base(),
    relationships: { ...base().relationships, sponsors: 100 },
  };
  const none: CareerState = {
    ...base(),
    relationships: { ...base().relationships, sponsors: 0 },
  };

  // Same match, same everything, only the sponsor standing differs.
  const args = [3, 1, 0, 20, 90, 2, 1] as const;
  const paid = finaliseMatch(...args, withSponsors);
  const unpaid = finaliseMatch(...args, none);

  const delta = paid.totalCash - unpaid.totalCash;

  // Pre-fix this difference was 5 — against a wage of 2000.
  check(
    delta >= 10_000,
    `a fully-served sponsor book should pay real money per match, got a difference of ${delta}`,
  );
  check(
    delta === Math.floor((100 / 20) * MONEY_SCALE),
    `sponsor pay should be the unchanged formula x the sponsor fee scale, got ${delta}`,
  );

  // A player with no sponsor standing still earns nothing from it.
  check(
    unpaid.sponsorPay === 0,
    `no sponsor standing should pay nothing, got ${unpaid.sponsorPay}`,
  );

  // And it is genuinely additive, not a replacement for the wage.
  check(
    unpaid.totalCash >= none.contract.wage,
    "a match should still pay at least the wage with no sponsors",
  );
}

// ── Boot pace stays inert and off-screen ─────────────────────────────────
{
  // The field remains on the type for save compatibility, but nothing should
  // start reading it again without making it do something first — see the
  // doc comment on Boot.pace in types.ts.
  const anyBoot = BOOTS_CATALOGUE[0];
  check(
    typeof anyBoot.pace === "number",
    "Boot.pace should still exist so a boot stored in an old save still matches the type",
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS  money scale (${MONEY_SCALE}x) holds for the testimonial and sponsor pay`);
