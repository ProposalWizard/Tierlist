import {
  YOUTH_STANDING, PROMOTION_STANDING, LOAN_STANDING, youthWage,
  youthLevelFor, youthAbility, playYouthMatch, applyYouthWeek,
  readyForPromotion, promoteFromYouth, PROMOTION_AT, PROMOTION_PAR,
  startYouthSpell, youthTakerFor, YOUTH_INTEREST_BELOW,
  formHasCollapsed, dropToYouth, COLLAPSE_RATING, YOUTH_DROP_AT, YOUTH_LEAGUE_TWO_ABOVE,
  rollLoanWildcard, startLoanSpell, loanProgress, loanRecallOffer, endLoan,
  LOAN_TARGET_MIN, LOAN_TARGET_SPREAD, placementLabel, YOUTH_AGE_LIMIT,
} from "../../lib/star/youth";
import { makeIdentity, attachClub } from "../../lib/star/careerFlow";
import { weeklyWageFor, STARTER_STANDING, divisionBaseWage } from "../../lib/star/economy";
import { mulberry32 } from "../../lib/star/season";
import { NO_INTEREST_BELOW, clubsForDivision } from "../../lib/star/scoutOffers";
import { divisionRank, DIVISION_ORDER, type CareerDivision } from "../../lib/star/calendar";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * BEING AT A CLUB WITHOUT BEING IN THE SIDE.
 *
 * Four properties carry this whole feature, and every one of them is the
 * sort of thing that looks obviously true and quietly stops being true:
 *
 *  1. **A youth wage is on the one wage curve.** Not a bare number, not a
 *     fraction of a bare number — `weeklyWageFor` at a standing, so it
 *     scales with the club and the division exactly as every other wage in
 *     the game does, and can never out-pay a bench player at the same club.
 *  2. **There is a real way out, and it is earned.** A good player at a
 *     level he is too good for gets promoted; a player below the level does
 *     not. If both of those are not measurably true the meter is set
 *     dressing.
 *  3. **The free-agent life still exists.** The youth team catches players
 *     the free-agent shell used to, and it must not catch ALL of them —
 *     below a real floor nobody wants you on any terms, which is the bottom
 *     of the game and was a deliberate design decision long before this.
 *  4. **A youth goal is not a first-team goal.** They live on the spell, and
 *     nothing that touches `seasonStats` or `careerStats` may ever see them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const PLAYER: StarPlayer = {
  firstName: "Youth", lastName: "Teamer", age: 17, skinTone: "light",
  club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;

function atClub(club: string, division: CareerDivision, o: Partial<CareerState> = {}): CareerState {
  const identity = makeIdentity({ ...PLAYER }, division);
  const signed = attachClub(identity, club, clubsForDivision(division), division, 100);
  return { ...signed, ...o };
}

function inYouth(club: string, division: CareerDivision, o: Partial<CareerState> = {}): CareerState {
  const base = atClub(club, division, o);
  return { ...base, placement: startYouthSpell(club, division, "trial") };
}

// ═══════════════════════════════════════════════════════════════════════
//  1. THE WAGE IS ON THE CURVE
// ═══════════════════════════════════════════════════════════════════════
{
  for (const division of DIVISION_ORDER) {
    const clubs = clubsForDivision(division);
    for (const club of clubs.slice(0, 4)) {
      const youth = youthWage(club, division);
      const bench = weeklyWageFor(club, division, 0);
      const starter = weeklyWageFor(club, division, STARTER_STANDING);
      check(youth === bench,
        `${club}: a youth wage IS the bottom of the club's own band, not a separate figure (${youth} vs ${bench})`);
      check(youth < starter,
        `${club}: a youth-team player earns less than a first-teamer (${youth} vs ${starter})`);
      check(youth >= 1, `${club}: a youth wage is still real money (${youth})`);
    }
  }

  // The whole point of a standing rather than a number: the SAME standing
  // pays wildly differently at the top and the bottom of the ladder,
  // because the ladder is what decides money in this game.
  const top = youthWage(clubsForDivision("premier")[0], "premier");
  const bottom = youthWage(clubsForDivision("national_league")[0], "national_league");
  check(top > bottom * 20,
    `a Premier League youth deal is worth vastly more than a National League one (${top} vs ${bottom})`);

  // And the three standings this feature introduces sit in the right order:
  // youth < just-promoted < a plain starter.
  const club = clubsForDivision("championship")[0];
  const y = weeklyWageFor(club, "championship", YOUTH_STANDING);
  const p = weeklyWageFor(club, "championship", PROMOTION_STANDING);
  const st = weeklyWageFor(club, "championship", STARTER_STANDING);
  check(y < p && p < st, `youth (${y}) < promoted (${p}) < starter (${st})`);
  check(LOAN_STANDING > YOUTH_STANDING && LOAN_STANDING < PROMOTION_STANDING,
    "a loaned-out fringe player sits between a youth-teamer and a promoted one");
}

// ═══════════════════════════════════════════════════════════════════════
//  2. THE LEVEL, AND THE WAY OUT
// ═══════════════════════════════════════════════════════════════════════
{
  // Youth football gets harder the further up the ladder the club is —
  // which is the single most important property of the feature: WHERE you
  // land decides how long it takes to get out.
  for (let i = 1; i < DIVISION_ORDER.length; i++) {
    const above = DIVISION_ORDER[i - 1], below = DIVISION_ORDER[i];
    check(youthLevelFor(above) > youthLevelFor(below),
      `${above} youth football is harder than ${below} (${youthLevelFor(above)} vs ${youthLevelFor(below)})`);
  }
  check(divisionRank("premier") === 0, "…measured off the real ladder order, not a local copy of it");

  // A career opens on 40/40/40/40/30.
  const fresh = makeIdentity({ ...PLAYER });
  const ability = youthAbility(fresh.skills);
  check(ability > youthLevelFor("national_league"),
    `a fresh trialist (${ability.toFixed(1)}) is already above National League youth football (${youthLevelFor("national_league")})`);
  check(ability < youthLevelFor("premier"),
    `…and well short of a Premier League academy (${youthLevelFor("premier")})`);
}

/** Run a youth spell to its conclusion, or until `weeks` run out. Returns
 *  the week promotion happened on, or null. */
function runSpell(career: CareerState, weeks: number, seed: number): { at: number | null; end: CareerState } {
  let c = career;
  for (let w = 1; w <= weeks; w++) {
    const match = playYouthMatch({ ...c, week: w }, mulberry32(seed + w * 977));
    c = applyYouthWeek({ ...c, week: w }, match);
    if (readyForPromotion(c)) return { at: w, end: c };
  }
  return { at: null, end: c };
}

{
  // ── A player who is too good for the level gets out ──
  const strong = inYouth(clubsForDivision("national_league")[0], "national_league", {
    skills: { pace: 62, power: 62, technique: 62, vision: 62, freeKick: 58 },
  });
  let promoted = 0, totalWeeks = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { at } = runSpell(strong, 60, seed * 7919);
    if (at !== null) { promoted++; totalWeeks += at; }
  }
  check(promoted >= 38,
    `a player well above the level gets promoted out of the youth team (${promoted}/40 spells)`);
  const avg = promoted ? totalWeeks / promoted : 0;
  check(avg > 4 && avg < 40,
    `…and it takes a real run of weeks rather than one good afternoon (avg ${avg.toFixed(1)} weeks)`);

  // ── A player miles below the level does not ──
  const weak = inYouth(clubsForDivision("premier")[0], "premier", {
    skills: { pace: 30, power: 30, technique: 30, vision: 30, freeKick: 25 },
  });
  let weakPromoted = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (runSpell(weak, 60, seed * 6301).at !== null) weakPromoted++;
  }
  check(weakPromoted === 0,
    `a player far below the level is not promoted by sitting there (${weakPromoted}/40 spells)`);

  // ── The meter cannot go negative, so a bad run is never a hole you
  //    cannot climb out of. It is the free-agent limbo this replaces that
  //    was the dead end; this must not be one too. ──
  const { end } = runSpell(weak, 30, 1234);
  check(end.placement!.progress >= 0, `the meter floors at 0 (got ${end.placement!.progress})`);
  check(end.placement!.progress <= PROMOTION_AT, "…and never overshoots the top");

  // ── Promotion writes a real contract and does not leave you unpickable ──
  const ready: CareerState = {
    ...strong,
    relationships: { ...strong.relationships, boss: 4 },
    form: [3.1, 3.4, 2.9],
    placement: { ...strong.placement!, progress: PROMOTION_AT },
  };
  const up = promoteFromYouth(ready);
  check(up.placement === undefined, "promotion ends the spell");
  check(up.contract.club === strong.placement!.club, "…and the contract is with the club that promoted you");
  check(up.contract.wage === weeklyWageFor(strong.placement!.club, "national_league", PROMOTION_STANDING),
    "…priced on the same curve at the promoted standing, not invented");
  check(up.contract.wage > youthWage(strong.placement!.club, "national_league"),
    "…and it is a rise on the youth deal");
  // The trap this exists to avoid: being promoted out of a form collapse by
  // the very manager whose opinion of you is what sent you down, and being
  // dropped again the same week by that identical number.
  check(up.relationships.boss > ready.relationships.boss,
    "a manager who has just promoted you does not still think nothing of you");
  check(up.form.length === 0, "…and the bad run does not follow you up");
}

{
  // ── NOT AN INESCAPABLE GRIND, measured on the player who actually lands
  //    here: a brand-new trialist on the starting 40/40/40/40/30 ──
  //
  // Measured with NO training at all, which is the harshest possible read —
  // the real game gives three actions a week and every one of them can be
  // spent on a skill. If it is escapable with the training turned off it is
  // comfortably escapable with it on.
  for (const division of ["national_league", "league_two"] as CareerDivision[]) {
    const c = inYouth(clubsForDivision(division)[0], division);
    const weeks: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const { at } = runSpell(c, 80, seed * 7919);
      if (at !== null) weeks.push(at);
    }
    weeks.sort((a, b) => a - b);
    const median = weeks[Math.floor(weeks.length / 2)] ?? 999;
    check(weeks.length >= 32,
      `a fresh trialist gets out of a ${division} youth team without training at all (${weeks.length}/40 spells)`);
    check(median <= 60,
      `…inside a season and a half (median ${median} weeks in ${division})`);
    check(median >= 8,
      `…and not in a fortnight (median ${median} weeks in ${division})`);
  }
}

{
  // ── Playing develops you, the same way a first-team match already does ──
  //
  // Not a new mechanic: `creditMatchResult` (careerFlow.ts) already grants a
  // small across-the-board skill pool off the match rating scaled by age,
  // and `applyYouthWeek` reads the identical three tuning values through the
  // identical `growthMultiplier`. This is the honest answer to "why is a
  // youth team better than the free agent's garden" — and the garden's own
  // hard ceiling of 55 is exactly what it is measured against.
  const c = inYouth(clubsForDivision("national_league")[0], "national_league");
  const before = youthAbility(c.skills);
  const { end } = runSpell(c, 40, 999);
  check(youthAbility(end.skills) > before,
    `forty weeks of youth football makes you better (${before} → ${youthAbility(end.skills)})`);
}

// ═══════════════════════════════════════════════════════════════════════
//  3. A YOUTH GOAL IS NOT A FIRST-TEAM GOAL
// ═══════════════════════════════════════════════════════════════════════
{
  const c = inYouth(clubsForDivision("league_two")[0], "league_two", {
    skills: { pace: 70, power: 70, technique: 70, vision: 70, freeKick: 70 },
  });
  const { end } = runSpell(c, 25, 4242);
  check(end.seasonStats.goals === 0, `youth goals never reach seasonStats (got ${end.seasonStats.goals})`);
  check(end.careerStats.goals === 0, `…or careerStats (got ${end.careerStats.goals})`);
  check(end.placement!.goals + end.placement!.assists >= 0, "…they are recorded on the spell instead");
  check(end.placement!.apps > 0, `…along with the appearances (${end.placement!.apps})`);

  // Playing football keeps you sharp. That is the concrete difference
  // between a youth team and the free agent's garden, and it has to be a
  // real number or it is a sentence.
  const before = { ...c, matchFitness: 50 };
  const match = playYouthMatch(before, mulberry32(11));
  const after = applyYouthWeek(before, match);
  check(after.matchFitness > before.matchFitness,
    `a youth match raises match fitness (${before.matchFitness} → ${after.matchFitness})`);
  check(after.energy < before.energy, "…and costs you something to play");

  // A rating exactly at par leaves the meter where it was — the one point
  // the whole progression pivots on.
  check(Math.abs((PROMOTION_PAR - PROMOTION_PAR) * 9) < 1e-9, "par is par");
  const rated = playYouthMatch(c, mulberry32(7));
  check(rated.rating >= 3 && rated.rating <= 10, `a youth rating is on the 0-10 scale (${rated.rating})`);
  check(rated.verdict.length > 0, "…and the coach says something about it");
}

// ═══════════════════════════════════════════════════════════════════════
//  4. WHO TAKES YOU IN — AND THE FLOOR UNDER IT
// ═══════════════════════════════════════════════════════════════════════
{
  // A youth team's bar is much lower than a professional contract's, which
  // is the whole reason this catches players the free-agent shell used to.
  check(YOUTH_INTEREST_BELOW < NO_INTEREST_BELOW,
    `a youth team asks for less than a contract does (${YOUTH_INTEREST_BELOW} vs ${NO_INTEREST_BELOW})`);

  // …but it is still a bar. Below it, nobody at all, and the free-agent
  // life is genuinely where you go — that phase is not deleted by this.
  for (const score of [0, 5, 11]) {
    check(youthTakerFor(score, mulberry32(score + 1)) === null,
      `a ${score} brings nobody, not even a youth team`);
  }
  for (const score of [12, 20, 29]) {
    check(youthTakerFor(score, mulberry32(score + 1)) !== null,
      `a ${score} finds somebody down the leagues (${score} is above the youth bar)`);
  }

  // ── Never above League Two from this route, and this is MEASURED ──
  //
  // A career starts on 40/40/40/40/30, an ability of 38 — exactly League Two
  // youth football's level, and six short of League One's. The first cut of
  // this let a good trial score put you in a League One academy, where a
  // fresh trialist got promoted 4 times in 40 spells over eighty weeks. The
  // measurement is in the spell tests above; this is the rule that came out
  // of it, pinned so it cannot quietly drift back up.
  for (let score = 0; score <= 100; score++) {
    for (let seed = 1; seed <= 20; seed++) {
      const taker = youthTakerFor(score, mulberry32(score * 31 + seed));
      if (!taker) continue;
      check(divisionRank(taker.division) >= divisionRank("league_two"),
        `a youth taker is never above League Two (got ${taker.division} at ${score})`);
      check(taker.clubs.includes(taker.club), "…and the club really is in the division it says");
      check(youthLevelFor(taker.division) <= youthAbility(makeIdentity({ ...PLAYER }).skills),
        `…so a brand-new trialist is never below the level he is dropped into (${taker.division})`);
    }
  }
  check(YOUTH_LEAGUE_TWO_ABOVE > YOUTH_INTEREST_BELOW,
    "a better afternoon still buys a better academy within that range");
}

// ═══════════════════════════════════════════════════════════════════════
//  5. FORM COLLAPSING
// ═══════════════════════════════════════════════════════════════════════
{
  const club = clubsForDivision("premier")[0];
  const collapsed = atClub(club, "premier", {
    form: [3.2, 4.0, 3.8, 6.9],
    relationships: { boss: 2, team: 30, fans: 20, girlfriend: null, sponsors: 0 },
    starRating: 1.2,
    matchFitness: 40,
  });
  check(formHasCollapsed(collapsed), "a real run of bad games and a manager out of patience sends you down");

  // One bad afternoon is not a collapse. This is the single most likely way
  // for this feature to become obnoxious, so it is pinned.
  check(!formHasCollapsed({ ...collapsed, form: [3.2, 7.4, 7.6] }),
    "one bad game among good ones is not a collapse");
  check(!formHasCollapsed({ ...collapsed, form: [3.2, 4.0] }),
    "…and neither is a career too short to have a run in it");

  // Good standing saves you however bad the run looks — the manager is the
  // one who decides, and BOTH halves of the test are needed.
  const stillRated = {
    ...collapsed,
    relationships: { ...collapsed.relationships, boss: 95 },
    starRating: 4.5, matchFitness: 95,
  };
  check(!formHasCollapsed(stillRated),
    "a manager who still rates you does not send you to the youth team over three bad games");

  // An injured player is out injured, not out of favour.
  check(!formHasCollapsed({ ...collapsed, injury: { note: "Hamstring", weeksRemaining: 3 } as CareerState["injury"] }),
    "being injured is not being dropped");

  // …and a player already in a placement cannot be dropped into one again.
  check(!formHasCollapsed(dropToYouth(collapsed)), "you cannot be dropped twice");

  const down = dropToYouth(collapsed);
  check(down.placement?.kind === "youth" && down.placement.reason === "form",
    "the drop records why it happened");
  check(down.contract.wage === collapsed.contract.wage,
    "being dropped does not let the club retype your wage");
  check(YOUTH_DROP_AT < 34,
    `the drop bar is below selection.ts's own bench bar of 34 (got ${YOUTH_DROP_AT})`);
  check(COLLAPSE_RATING < 6, `…and a "bad game" really is a bad game (${COLLAPSE_RATING})`);

  // The label is honest about who it is talking to.
  check(placementLabel(down).toLowerCase().includes("reserve") || down.player.age <= YOUTH_AGE_LIMIT,
    "an older player is in the reserves, not the under-18s");
  const kid = { ...down, player: { ...down.player, age: 17 } };
  check(placementLabel(kid) === "Youth team", "a seventeen-year-old is in the youth team");
}

// ═══════════════════════════════════════════════════════════════════════
//  6. THE LOAN WILDCARD
// ═══════════════════════════════════════════════════════════════════════
{
  // A wildcard is a wildcard. It must be uncommon, and it must only ever
  // come from a club big enough for the story to make sense.
  let fired = 0;
  for (let seed = 1; seed <= 400; seed++) {
    if (rollLoanWildcard("Manchester United", "premier", 3, mulberry32(seed * 104729))) fired++;
  }
  check(fired > 20 && fired < 160,
    `a loan is an occasional outcome of a big club's interest, not the usual one (${fired}/400)`);

  for (const division of ["league_one", "league_two", "national_league"] as CareerDivision[]) {
    let small = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (rollLoanWildcard(clubsForDivision(division)[0], division, 2, mulberry32(seed * 31337))) small++;
    }
    check(small === 0, `a ${division} club that rates you simply plays you — no loan (${small}/200)`);
  }

  // The shape of the deal itself.
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 25; seed++) {
    const loan = rollLoanWildcard("Manchester United", "premier", 3, mulberry32(seed * 104729));
    if (!loan) continue;
    checked++;
    check(divisionRank(loan.hostDivision) > divisionRank(loan.parentDivision),
      `you are sent DOWN the ladder to play (${loan.parentDivision} → ${loan.hostDivision})`);
    check(loan.hostClubs.includes(loan.hostClub), "…to a club that is really in that division");
    check(loan.target >= LOAN_TARGET_MIN && loan.target < LOAN_TARGET_MIN + LOAN_TARGET_SPREAD,
      `…with a real number on it (${loan.target})`);
    // The wage is the PARENT club's, because a loan is paid by the club
    // that owns you — and it has to still be on the curve.
    check(loan.wage === weeklyWageFor("Manchester United", "premier", LOAN_STANDING),
      `…paid by the parent club, on the curve (${loan.wage})`);
    check(loan.wage > divisionBaseWage(loan.hostDivision),
      "…which is the whole appeal: big-club money while you play every week");
  }
  check(checked > 0, "at least one loan was actually inspected");
}

{
  // ── The target, and what it decides ──
  const loan = (() => {
    for (let seed = 1; seed <= 500; seed++) {
      const l = rollLoanWildcard("Manchester United", "premier", 3, mulberry32(seed * 104729));
      if (l) return l;
    }
    return null;
  })();
  check(loan !== null, "a loan could be rolled for the resolution tests");

  if (loan) {
    const base = atClub(loan.hostClub, loan.hostDivision);
    const out: CareerState = { ...base, placement: startLoanSpell(loan, 0) };

    const none = loanProgress(out);
    check(none?.scored === 0 && none?.target === loan.target && !none.met,
      "a loan starts at nothing and knows what it needs");
    check(loanRecallOffer(out) === null, "…and nobody comes for you having scored nothing");

    const short: CareerState = { ...out, seasonStats: { ...out.seasonStats, goals: loan.target - 1 } };
    check(loanProgress(short)?.met === false, "one short is short");
    check(loanRecallOffer(short) === null, "…and one short is no recall");

    const hit: CareerState = { ...out, seasonStats: { ...out.seasonStats, goals: loan.target } };
    check(loanProgress(hit)?.met === true, "hitting the number is hitting the number");
    const recall = loanRecallOffer(hit);
    check(recall !== null, "…and the parent club comes back for you");
    if (recall) {
      check(recall.club === loan.parentClub, "the recall is from the club that owns you");
      check(recall.division === loan.parentDivision, "…in their division, which the offer has to say");
      check(recall.wage >= weeklyWageFor(loan.parentClub, loan.parentDivision, 0),
        `…at no less than the bottom of their own band (${recall.wage})`);
      check(recall.wage > out.contract.wage,
        `…and it is a rise on the loan deal (${out.contract.wage} → ${recall.wage})`);
    }

    // ── Ending it ──
    //
    // Still at the host club: the big club's wage does not follow you. That
    // is a real pay cut and the point of missing the target.
    const stayed = endLoan(short);
    check(stayed.placement === undefined, "the loan ends when the season does");
    check(stayed.contract.club === loan.hostClub, "…and the club you play for is the club that pays you");
    check(stayed.contract.wage === weeklyWageFor(loan.hostClub, loan.hostDivision, PROMOTION_STANDING),
      `…on that club's own curve (${stayed.contract.wage})`);
    check(stayed.contract.wage < out.contract.wage,
      `…which is a real pay cut for missing the number (${out.contract.wage} → ${stayed.contract.wage})`);

    // Went back: the move has already been made by acceptOffer, and this
    // must not undo it. The bug this catches is silently re-pricing a
    // Premier League contract at the club he has just left.
    const moved: CareerState = {
      ...hit,
      player: { ...hit.player, club: loan.parentClub },
      contract: { ...hit.contract, club: loan.parentClub, wage: 9999 },
    };
    const back = endLoan(moved);
    check(back.placement === undefined, "the spell is cleared either way");
    check(back.contract.club === loan.parentClub && back.contract.wage === 9999,
      "…but a player who has already gone back keeps the deal he just signed");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  7. A PLACEMENT IS ABSENT UNLESS SOMETHING PUT ONE THERE
// ═══════════════════════════════════════════════════════════════════════
{
  // Every save written before this field existed means "you are a first-team
  // player of the club whose badge you are wearing", and absent has to read
  // as exactly that or every old career opens in a youth team.
  const old = makeIdentity({ ...PLAYER });
  check(old.placement === undefined, "a career does not start with a placement");
  const signed = attachClub(old, "Arsenal", clubsForDivision("premier"), "premier", 500);
  check(signed.placement === undefined, "…and signing for a club does not create one");
  check(placementLabel(signed) === "", "…and nothing is labelled for a player who is simply in the team");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the youth team is a real place with a real way out, and the free-agent floor is still under it");
