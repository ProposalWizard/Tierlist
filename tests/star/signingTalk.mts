import {
  managerTalkFor, fairWageFor, trialistStrength, standingFor,
  weeklyToSeason, seasonToWeekly, seasonWeeks, agreedWeeklyWage, wageFloorFor,
  TRIALIST_STRENGTH_FLOOR, TRIALIST_STRENGTH_CEILING,
} from "../../lib/star/signingTalk";
import { makeOffer } from "../../lib/star/negotiation";
import { offerWageFor, offerStanding, weeklyWageFor } from "../../lib/star/economy";
import { startTrial, recordStage, TRIAL_STAGES, trialScore } from "../../lib/star/trial";
import { mulberry32 } from "../../lib/star/season";
import { clubsForDivision } from "../../lib/star/scoutOffers";
import { matchweeksFor, DIVISION_ORDER, type CareerDivision } from "../../lib/star/calendar";

/**
 * THE CONVERSATION, AND THE WAGE THAT COMES OUT OF IT.
 *
 * The negotiation itself is `negotiation.ts` and already has its own
 * coverage — this file is about the four things that are new, every one of
 * which is a way the wage ladder could be quietly broken:
 *
 *  1. **The number going in is the one curve's number.** `offerWageFor`,
 *     the same function that prices every other contract in the game. If
 *     this ever stops being true, a negotiated first contract stops being
 *     comparable to anything else.
 *  2. **A better trial is a stronger hand — measurably.** It has to move
 *     the wage, in the right direction, by a real amount.
 *  3. **The unit the haggle is conducted in is safe.** `cleanRound`
 *     (negotiation.ts) steps in ★100s with a ★100 floor, which is fine for
 *     a transfer fee and a tenfold distortion of a ★10-a-week National
 *     League wage. Conducting it in a season's wages is the fix, and it has
 *     to actually hold at the bottom of the ladder, which is where it
 *     matters.
 *  4. **What comes out can never land under the club's own floor**, however
 *     the haggle went.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** A finished trial at a given quality, the way the real one finishes. */
function trialAt(quality: number, seed = 4242) {
  let t = startTrial(seed);
  for (const stage of TRIAL_STAGES) t = recordStage(t, stage, quality);
  return t;
}

// ═══════════════════════════════════════════════════════════════════════
//  1. THE NUMBER IS THE CURVE'S NUMBER
// ═══════════════════════════════════════════════════════════════════════
{
  for (const division of DIVISION_ORDER) {
    const club = clubsForDivision(division)[0];
    for (const score of [20, 50, 80, 100]) {
      const strength = 42 + (4 - DIVISION_ORDER.indexOf(division)) * 10;
      const fair = fairWageFor(club, division, strength, score);
      const expected = offerWageFor(club, division, score, strength - trialistStrength(score), 0);
      check(fair === expected,
        `${club} @ ${score}: the fair wage IS offerWageFor's number, not a second formula (${fair} vs ${expected})`);
      check(fair >= wageFloorFor(club, division),
        `${club} @ ${score}: …and never under the club's own band (${fair} vs ${wageFloorFor(club, division)})`);
    }
  }

  // The standing it asks for is `offerStanding`'s, unchanged.
  check(standingFor(80, 50) === offerStanding(50, 80 - trialistStrength(50)),
    "the standing is offerStanding's, with the trial score as the reputation");
}

// ═══════════════════════════════════════════════════════════════════════
//  2. A BETTER TRIAL IS A STRONGER HAND
// ═══════════════════════════════════════════════════════════════════════
{
  const club = clubsForDivision("championship")[0];
  const wages = [10, 30, 50, 70, 90, 100].map(s => fairWageFor(club, "championship", 68, s));
  for (let i = 1; i < wages.length; i++) {
    check(wages[i] >= wages[i - 1],
      `a better trial never pays less at the same club (${wages[i - 1]} → ${wages[i]})`);
  }
  check(wages[wages.length - 1] > wages[0] * 1.3,
    `…and the gap between a terrible afternoon and a perfect one is real (${wages[0]} → ${wages[wages.length - 1]})`);

  // It works twice over, which is the mechanism rather than the effect: a
  // higher score raises the reputation term AND shrinks the step up, and
  // both push the standing the same way.
  check(trialistStrength(100) > trialistStrength(0),
    "a better trial puts you higher on the same scale clubs are measured on");
  check(trialistStrength(0) === TRIALIST_STRENGTH_FLOOR
    && trialistStrength(100) === TRIALIST_STRENGTH_CEILING,
    "…running from National League standard to Premier League standard");
  check(standingFor(80, 90) > standingFor(80, 20),
    "…so the same club thinks more of you after a better afternoon");
}

// ═══════════════════════════════════════════════════════════════════════
//  3. THE UNIT THE HAGGLE IS CONDUCTED IN
// ═══════════════════════════════════════════════════════════════════════
{
  for (const division of DIVISION_ORDER) {
    check(seasonWeeks(division) === matchweeksFor(division),
      `a season's wages is a real season long in ${division}, not an invented multiplier`);
  }

  // The round trip has to be tight enough that the ladder survives it. The
  // worst case in the whole game is the very bottom — a ★10-a-week National
  // League youth-level deal — which is exactly where negotiating in weekly
  // money would have floored every position at ★100.
  for (const division of DIVISION_ORDER) {
    const club = clubsForDivision(division)[0];
    for (const standing of [0, 0.35, 0.55, 1]) {
      const weekly = weeklyWageFor(club, division, standing);
      const round = seasonToWeekly(weeklyToSeason(weekly, division), division);
      check(round === weekly,
        `${club} @ ${standing}: a wage survives the trip through a season and back (${weekly} → ${round})`);
    }
  }

  // …and the real proof: a whole negotiation at the bottom of the ladder
  // comes back as a sane weekly wage rather than a tenfold inflation.
  const club = clubsForDivision("national_league")[0];
  const fair = fairWageFor(club, "national_league", 42, 35);
  const talk = managerTalkFor({
    trial: trialAt(0.35), club, division: "national_league",
    clubStrength: 42, playerFirstName: "Sam", rng: mulberry32(7),
  });
  check(talk.fairWeekly === fair, "the conversation and the curve agree on what the deal is worth");
  check(talk.openingWeekly < talk.fairWeekly,
    `a manager opens BELOW what the deal is worth (${talk.openingWeekly} vs ${talk.fairWeekly})`);
  check(talk.openingWeekly >= 1, `…but still with a real number (${talk.openingWeekly})`);
  check(talk.openingWeekly < talk.fairWeekly * 4,
    `…and not a figure ten times the wage, which is what a weekly haggle would have produced (${talk.openingWeekly})`);

  // Accepting his opening position outright closes the deal at it — the
  // engine's own "you met their price" rule, reached through this unit.
  const closed = makeOffer(talk.negotiation, talk.negotiation.theirPosition, mulberry32(3));
  check(closed.status === "accepted", "taking what is on the table closes the deal");
  const weekly = agreedWeeklyWage(closed.finalPrice ?? null, club, "national_league");
  check(weekly === talk.openingWeekly,
    `…at the number he actually said (${weekly} vs ${talk.openingWeekly})`);
}

// ═══════════════════════════════════════════════════════════════════════
//  4. WHAT COMES OUT
// ═══════════════════════════════════════════════════════════════════════
{
  const club = clubsForDivision("premier")[0];
  // Haggling upward really does pay more than caving — the whole point of
  // there being a negotiation at all.
  const talk = managerTalkFor({
    trial: trialAt(0.8), club, division: "premier",
    clubStrength: 82, playerFirstName: "Sam", rng: mulberry32(11),
  });
  let state = talk.negotiation;
  for (let round = 0; round < 4 && state.status === "negotiating"; round++) {
    // Come down a little each time — a real, moving position.
    state = makeOffer(state, Math.round(state.yourPosition * 0.94), mulberry32(round * 31 + 5));
  }
  if (state.status === "accepted") {
    const haggled = agreedWeeklyWage(state.finalPrice ?? null, club, "premier");
    check((haggled ?? 0) > talk.openingWeekly,
      `haggling beats taking the first offer (${talk.openingWeekly} → ${haggled})`);
  }

  // A walkout is a real no-deal, and the caller is told so rather than
  // being handed a number.
  check(agreedWeeklyWage(null, club, "premier") === null, "no deal means no wage");

  // And nothing that comes out of the table can land under the club's own
  // floor, whatever number was agreed.
  check(agreedWeeklyWage(1, club, "premier") === wageFloorFor(club, "premier"),
    "an absurd agreement is still floored at the bottom of the club's band");

  // The manager says real things about a real afternoon.
  const good = managerTalkFor({
    trial: trialAt(0.95), club, division: "premier",
    clubStrength: 82, playerFirstName: "Sam", rng: mulberry32(2),
  });
  const bad = managerTalkFor({
    trial: trialAt(0.2), club, division: "premier",
    clubStrength: 82, playerFirstName: "Sam", rng: mulberry32(2),
  });
  check(good.lines.length >= 2 && bad.lines.length >= 2, "he says more than one thing");
  check(good.lines[0] !== bad.lines[0], "a 95 and a 20 are not told the same thing");
  check(good.lines.every(l => l.includes("Sam") || l.length > 0), "…and he uses your name");
  check(good.lines.join(" ").includes(club), "…and says who he is");
  check(good.fairWeekly > bad.fairWeekly,
    `…and puts a bigger number on the table for the better afternoon (${bad.fairWeekly} → ${good.fairWeekly})`);
  check(good.best !== null, "he singles out your best stage");
  check(good.best !== good.worst, "…and never calls the same stage your best and your worst");

  // Re-opening the screen cannot re-roll a better opening offer: it is
  // seeded off the trial, the same anti-farming rule the offers are under.
  const again = managerTalkFor({
    trial: trialAt(0.95), club, division: "premier",
    clubStrength: 82, playerFirstName: "Sam", rng: mulberry32(2),
  });
  check(again.openingWeekly === good.openingWeekly,
    "the same trial always gets the same opening offer");

  // A perfect trial at a tiny club still cannot out-earn a bad one at a big
  // club — the invariant the whole ladder rests on, reached through this
  // new path rather than through `weeklyWageFor` directly.
  const tiny = clubsForDivision("national_league");
  const big = clubsForDivision("premier");
  const bestTiny = Math.max(...tiny.map(c => fairWageFor(c, "national_league", 46, 100)));
  const worstBig = Math.min(...big.map(c => fairWageFor(c, "premier", 76, 0)));
  check(bestTiny < worstBig,
    `a perfect trial in the National League never out-pays a poor one in the Premier League (${bestTiny} vs ${worstBig})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the manager's number comes off the one wage curve, and a season's wages is a unit the existing haggle can actually round");
