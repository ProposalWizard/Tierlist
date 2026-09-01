import {
  makeObjective, progressObjectives, rollSponsorSeason, attachObjective, objectiveLabel,
} from "../../lib/star/sponsors";
import { offerClauses, clauseSummary, canTriggerClause, appearanceMoney, loyaltyMoney } from "../../lib/star/contracts";
import { testimonialFor, retire, TESTIMONIAL_APPEARANCES } from "../../lib/star/retirement";
import { fanFeed, fanMood } from "../../lib/star/fanmail";
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { generateOffers } from "../../lib/star/transfers";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * Money that asks something of you, contracts with a shape, a farewell, and the
 * supporters finally saying something.
 *
 * A SponsorDeal was `{ category, perMatch, active }` — passive money that
 * unlocked by counting, so the sponsors screen was a list of numbers going up on
 * its own. A contract was a wage, two bonuses and a number of seasons, so every
 * deal in the game was the same deal at a different price. A career at one club
 * had nothing to show for it that six clubs did not — if anything the mercenary
 * did better, because every move came with a signing fee. And the `fans`
 * relationship moved for fifteen seasons without the player ever hearing from
 * them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 24, position: "ST",
  club: "Arsenal", nationality: "England", startYear: 2026,
} as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const result = (goals: number, rating = 7.2): MatchStats => ({
  minutes: 90, chances: 5, goals, assists: 1, passes: 12, rating, starMan: rating >= 8.5,
  bossChange: 2, teamChange: 2, fansChange: 2,
  wage: 2, goalBonus: 0, sponsorPay: 0, totalCash: 2, homeScore: goals, awayScore: 0,
});

// ── Sponsors ask for something ──────────────────────────────────────────────
{
  const c = { ...base(), starRating: 3.0 };
  const rng = mulberry32(5);
  const o = makeObjective(c, 0, rng);
  check(o.target > 0 && o.bonus > 0, `an objective has a target and a payment (${objectiveLabel(o)}, ★${o.bonus})`);
  check(o.seasonsLeft >= 1 && o.seasonsLeft <= 2, "and a term to do it in");
  check(!o.done && o.progress === 0, "and starts at nothing");
  check(objectiveLabel(o).length > 0, "and can be read");

  // Scaled to who you are: the same deal asks more of a better player.
  const small = makeObjective({ ...c, starRating: 1 }, 0, mulberry32(9));
  const big = makeObjective({ ...c, starRating: 5 }, 0, mulberry32(9));
  check(big.target >= small.target, `a bigger name is asked for more (${small.target} vs ${big.target})`);
  check(big.bonus > small.bonus, "and paid more for it");

  // Progress, and the payment when it lands.
  let deals = attachObjective(c, c.sponsors.map(s => ({ ...s, active: true, perMatch: 1 })));
  check(deals.every(d => !!d.objective), "every active deal has something to ask");
  const goalDeals = deals.map(d => ({ ...d, objective: { ...d.objective!, kind: "goals" as const, target: 3, progress: 0 } }));
  let earned = 0;
  let live = goalDeals;
  for (let i = 0; i < 3; i++) {
    const step = progressObjectives(live, result(1), c.seasonStats);
    live = step.sponsors;
    earned += step.earned;
  }
  check(earned > 0, `hitting a target pays (★${earned})`);
  check(live.every(d => d.objective?.done), "and closes the objective");
  const after = progressObjectives(live, result(5), c.seasonStats);
  check(after.earned === 0, "a completed objective does not pay twice");
}

// ── …and a deal you do not deliver lapses ──────────────────────────────────
{
  const c = base();
  const undelivered: CareerState = {
    ...c,
    sponsors: c.sponsors.map((s, i) => i === 0
      ? { ...s, active: true, perMatch: 3, objective: { kind: "goals" as const, target: 30, progress: 1, seasonsLeft: 1, bonus: 20, done: false } }
      : s),
  };
  const rolled = rollSponsorSeason(undelivered);
  check(rolled.lapsed.length === 1, "a term that ran out unmet lapses");
  check(!rolled.sponsors[0].active && rolled.sponsors[0].perMatch === 0, "and the retainer goes with it");
  check(rolled.standingHit > 0, "and it costs you with the next sponsor who looks at you");

  // A multi-season target carries on rather than lapsing at the first rollover.
  const twoYear: CareerState = {
    ...c,
    sponsors: c.sponsors.map((s, i) => i === 0
      ? { ...s, active: true, perMatch: 3, objective: { kind: "goals" as const, target: 30, progress: 5, seasonsLeft: 2, bonus: 20, done: false } }
      : s),
  };
  const carried = rollSponsorSeason(twoYear);
  check(carried.lapsed.length === 0, "a two-season target is not judged after one");
  check(carried.sponsors[0].objective?.seasonsLeft === 1, "the term simply runs down");
  check(carried.sponsors[0].objective?.progress === 5, "and the progress carries with it");

  // One delivered is cleared out rather than lingering.
  const done: CareerState = {
    ...c,
    sponsors: c.sponsors.map((s, i) => i === 0
      ? { ...s, active: true, perMatch: 3, objective: { kind: "goals" as const, target: 3, progress: 9, seasonsLeft: 1, bonus: 20, done: true } }
      : s),
  };
  const cleared = rollSponsorSeason(done);
  check(cleared.lapsed.length === 0 && cleared.sponsors[0].active, "a delivered deal is kept");
  check(!cleared.sponsors[0].objective, "and is ready to be given a new target");
}

// ── Contract clauses ────────────────────────────────────────────────────────
{
  const c = base();
  // Every clause appears for somebody across a spread of draws.
  const kinds = new Set<string>();
  for (let seed = 0; seed < 60; seed++) {
    for (const star of [1.5, 3.2, 4.8]) {
      const cl = offerClauses({ ...c, starRating: star }, 10, mulberry32(seed * 3 + 1));
      Object.keys(cl).forEach(k => kinds.add(k));
    }
  }
  check(kinds.has("appearanceFee") && kinds.has("loyaltyBonus") && kinds.has("releaseClause"),
    `all three clauses are reachable (${Array.from(kinds).join(", ")})`);

  // Shaped by who you are to them.
  let fringeFees = 0, starFees = 0, fringeLoyalty = 0, starLoyalty = 0;
  for (let seed = 0; seed < 200; seed++) {
    if (offerClauses({ ...c, starRating: 1.5 }, 10, mulberry32(seed + 1)).appearanceFee) fringeFees++;
    if (offerClauses({ ...c, starRating: 4.8 }, 10, mulberry32(seed + 1)).appearanceFee) starFees++;
    if (offerClauses({ ...c, starRating: 1.5 }, 10, mulberry32(seed + 1)).loyaltyBonus) fringeLoyalty++;
    if (offerClauses({ ...c, starRating: 4.8 }, 10, mulberry32(seed + 1)).loyaltyBonus) starLoyalty++;
  }
  check(fringeFees > starFees, `a fringe player is offered appearance money (${fringeFees} vs ${starFees} of 200)`);
  check(starLoyalty > fringeLoyalty, `and a star is offered loyalty money (${starLoyalty} vs ${fringeLoyalty})`);

  check(clauseSummary({ ...c.contract, appearanceFee: 3, loyaltyBonus: 9, releaseClause: 200 }).length === 3,
    "every clause is explained to the player");
  check(clauseSummary(c.contract).length === 0, "and a contract with none says nothing");

  check(appearanceMoney({ ...c.contract, appearanceFee: 4 }) === 4, "the appearance fee is paid per match");
  check(appearanceMoney(c.contract) === 0, "and nothing when there is none");
  check(loyaltyMoney({ ...c.contract, loyaltyBonus: 12 }, true) === 12, "loyalty is paid for staying");
  check(loyaltyMoney({ ...c.contract, loyaltyBonus: 12 }, false) === 0, "and not for leaving");

  // A release clause cuts both ways: it is the price at which a club cannot say
  // no, so a LOW one gets you offers your reputation would never attract.
  const cheap = { ...c.contract, releaseClause: 30 };
  const dear = { ...c.contract, releaseClause: 100000 };
  check(canTriggerClause(cheap, 90, 10), "a big club can meet a low clause");
  check(!canTriggerClause(dear, 90, 10), "and cannot meet an unreasonable one");
  check(!canTriggerClause(c.contract, 99, 10), "a contract without one cannot be triggered at all");

  const nobody: CareerState = { ...c, starRating: 0.6, fame: 1, form: [5, 5, 5, 5, 5] };
  const withClause = { ...nobody, contract: cheap };
  const offersWithout = generateOffers(nobody, mulberry32(3)).length;
  const offersWith = generateOffers(withClause, mulberry32(3)).length;
  check(offersWith > offersWithout,
    `a low release clause gets a nobody offers he would not otherwise get (${offersWithout} → ${offersWith})`);
  check(generateOffers(withClause, mulberry32(3)).some(o => o.viaClause), "and they are flagged as clause moves");
}

// ── A testimonial ───────────────────────────────────────────────────────────
{
  const c = base();
  check(testimonialFor(c) === null, "a new signing does not get a testimonial");
  check(testimonialFor({ ...c, clubAppearances: TESTIMONIAL_APPEARANCES - 1 }) === null, "nor one appearance short of it");

  const loyal = { ...c, clubAppearances: TESTIMONIAL_APPEARANCES + 40, fame: 50, starRating: 4 };
  const t = testimonialFor(loyal);
  check(!!t && t.payout > 0, `a decade at one club does (★${t?.payout})`);
  check(t?.club === loyal.player.club, "at the club he gave it to");

  const retired = retire(loyal);
  check(retired.retired === true, "retiring records it");
  check(retired.money === loyal.money + (t?.payout ?? 0), "and the money is paid");
  check(!!retired.testimonial, "and the legacy screen has something to show");

  const journeyman = retire({ ...c, clubAppearances: 12 });
  check(journeyman.testimonial === null || journeyman.testimonial === undefined, "a journeyman gets nothing");
  check(journeyman.money === c.money, "and no money either");
}

// ── The supporters have a voice ─────────────────────────────────────────────
{
  const c = base();
  const adored = { ...c, relationships: { ...c.relationships, fans: 92 } };
  const hated = { ...c, relationships: { ...c.relationships, fans: 12 } };

  check(fanFeed(adored).length === 5, "the feed is short — a wall of generated text reads as filler");
  check(fanFeed(adored).some(p => p.mood > 0), "supporters who love you say so");
  check(fanFeed(hated).some(p => p.mood < 0), "and supporters who do not say that instead");
  check(fanMood(adored) !== fanMood(hated), `the room has a mood ("${fanMood(adored)}" vs "${fanMood(hated)}")`);

  // Stable while you look at it.
  check(JSON.stringify(fanFeed(adored)) === JSON.stringify(fanFeed(adored)), "and it does not reshuffle under a re-render");

  // It talks about what actually happened.
  const captain = { ...adored, captain: true };
  check(fanFeed(captain).some(p => p.text.includes("captain")), "the armband gets mentioned");
  const awarded = { ...adored, awards: [{ season: 1, kind: "Golden Boot", detail: "22 goals" }] };
  check(fanFeed(awarded).some(p => p.text.includes("Golden Boot")), "and so does an award");
  const outOfForm = { ...c, relationships: { ...c.relationships, fans: 60 }, form: [5.6, 5.4, 5.8] };
  check(fanFeed(outOfForm).some(p => p.mood < 0), "and a bad run does not go unnoticed");
}

// ── It all still runs a season ──────────────────────────────────────────────
{
  let c = { ...base(), contract: { ...base().contract, appearanceFee: 2, loyaltyBonus: 15 } };
  const startMoney = c.money;
  let guard = 0;
  while (nextFixtureFor(c) && guard++ < 120) {
    c = creditMatchResult(c, nextFixtureFor(c)!, result(1)).career;
  }
  check(guard < 120, "a full season plays out with all of it wired in");
  check(c.money > startMoney, "and the appearance money actually arrived");

  const before = c.money;
  const next = advanceSeason(c, false).career;
  check(next.money >= before + 15, `the loyalty bonus is paid at the rollover (${before} → ${next.money})`);

  // Reported directly: a transfer accepted this rollover pays the STAYED
  // bonus for the club just left, because `career.contract` is already the
  // new club's deal (acceptOffer overwrites it) by the time advanceSeason
  // runs. `justTransferred: true` — set by both real callers, the transfer
  // window and a forced relegation move — withholds it. `c` here still
  // carries the same loyaltyBonus: 15 contract on paper; only the flag
  // changes.
  const beforeTransfer = c.money;
  const transferred = advanceSeason(c, false, true).career;
  check(transferred.money < beforeTransfer + 15,
    `a transfer accepted this rollover does not also pay the stayed-all-season bonus (${beforeTransfer} → ${transferred.money})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — sponsors ask, contracts have shape, loyalty is paid, and the crowd has a voice");
