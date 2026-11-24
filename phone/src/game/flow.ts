/**
 * THE CAREER'S FLOW: what happens between screens (owned by the CAREER area).
 *
 * The website's version lives in app/star-dev/page.tsx (handleProfileComplete,
 * the trial's offers, handlePlayMatch, handleMatchComplete, continueAfterMatch,
 * endSeason, handleBallonDorContinue, rollOverSeason, …). This file is the
 * phone's port of it, calling the same lib/star functions in the same order.
 * Where page.tsx only changes what is drawn (toasts, sounds, pop-ups) the
 * phone keeps the data in game/session.ts and its own screens show it.
 *
 * The MATCH area calls completeMatch(stats) at full time and then opens the
 * "post-match" screen.
 *
 * Every function here works on the one career in game/store.ts and returns
 * the next STEP (a screen name) for the screens to open. A step that belongs
 * to another area (a cup draw, the transfer window, the phone feed) is only
 * taken when that area has registered the screen; until then the flow goes
 * on exactly as page.tsx would after that screen (see `screenExists`).
 */
import type { CareerState, MatchStats, Fixture, StarPlayer, Skills } from "@/lib/star/types";
import { getCareer, setCareer } from "./store";
import { getSession, setSession, type MatchReport } from "./session";
import { afterNewCareer, afterSigning, afterTransfer, afterLoad, keepSquadsInStep, resetSquadEffects } from "./squads";

import { makeIdentity, attachClub, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed } from "@/lib/star/careerFlow";
import { startTrial, trialComplete, trialScore, recordStage, beginStage, trialStagesFor, type TrialStage } from "@/lib/star/trial";
import { trialOffers, clubsForDivision, SOURED_PITCH, type ScoutOffer } from "@/lib/star/scoutOffers";
import { scoutedOfferForTrial } from "@/lib/star/scoutedPlacement";
import { goalBonusFor, assistBonusFor } from "@/lib/star/economy";
import { mulberry32, sortLeague } from "@/lib/star/season";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { currentRound, lastSixteenIndex } from "@/lib/star/cups";
import { currentTie } from "@/lib/star/euro";
import { knockoutRoundupFor } from "@/lib/star/knockoutView";
import { divisionOf, isRegionalDivision, type CareerDivision } from "@/lib/star/calendar";
import { generateRelegationOffers } from "@/lib/star/relegationOffers";
import { rest, projectedEnergy, trainingLeft, spendTrainingSession } from "@/lib/star/week";
import { acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { clearAfterWindow, requestOf } from "@/lib/star/transferRequest";
import { windowInterest, withRecall } from "@/lib/star/transferInterest";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { hallRecordBook, freshHallRecords, amount as hallAmount } from "@/lib/star/hallRecords";
import { phoneHall } from "../world/hall";
import { generateForMatch, generateForInternational, generateForCallUp, generateForCareer, generateForLeagueWeek, generateForRollover, applyGoalOfMonthBoost, hasFreshMedia } from "@/lib/star/media/feed";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";
import { checkNewAchievements, ACHIEVEMENTS } from "@/lib/star/achievements";
import { computeStarRating } from "@/lib/star/rating";
import { starsNow, starStatus, matchStarPoints, withStars, starGain } from "@/lib/star/starPoints";
import { recordFirstMatch, recordDrill, gameFirst, isOpen, DRILLS_TO_OPEN_SHOP } from "@/lib/star/unlocks";
import { isStory, trainingDayOn, trainingDayLeft, recordTrainingDayDrill } from "@/lib/star/story";
import { applyLevelResult, levelDifficulty } from "@/lib/star/trainingLevels";
import { getTuning } from "@/lib/star/tuningStore";
import { signingNews, newsForMatch, type BreakingNews } from "@/lib/star/breakingNews";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { simulateOwnMatch } from "@/lib/star/simMatch";
import { nationKits, nationStrength } from "@/lib/star/international";
import { periodDue, decide, applyDecision, syncIntl, type IntlDecision } from "@/lib/star/intl/career";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { youthTakerFor, youthWage, startYouthSpell, rollLoanWildcard, startLoanSpell, formHasCollapsed, dropToYouth, endLoan, loanRecallOffer } from "@/lib/star/youth";
import { managerTalkFor, type ManagerTalk } from "@/lib/star/signingTalk";
import { FIRST_CONTRACT_WAGE } from "@/lib/star/scoutedPlacement";
import { getPostMatchReactionsEnabled as getPostMatchReactions } from "@/lib/star/postMatchPrefs";
import { useSyncExternalStore } from "react";
import { agreedWeeklyWage } from "@/lib/star/signingTalk";
import { SOURED_OFFER_SHARE } from "@/lib/star/scoutOffers";
import { playYouthMatch, applyYouthWeek, readyForPromotion, promoteFromYouth } from "@/lib/star/youth";
import { startNewWeek, spendAction } from "@/lib/star/week";
import { farewellSides, farewellCareer, farewellFixture, farewellDuties, farewellSeed, farewellRecordFrom, farewellSkipped, type FarewellSides } from "@/lib/star/farewell";
import { applyEffects, pickDilemma, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { pressQuestionFor, type PressQuestion, type PressOption } from "@/lib/star/media";
import { applyGameGain } from "@/lib/star/relationshipGame";
import { recordBossMeeting } from "@/lib/star/unlocks";
import { changeDealHappiness } from "@/lib/star/sponsorDeals";
import type { FarewellRecord } from "@/lib/star/types";
import { addToPhoneHall } from "../world/hall";

// ═══════════════════════════════════════════════════════════════════
//  STEPS: where the screens go next
// ═══════════════════════════════════════════════════════════════════

export interface Step { screen: string; params?: Record<string, unknown> }
/** The tabbed main screen (Home). */
export const HOME: Step = { screen: "tabs" };

/** Whether a screen exists in the app; set by areas/career.tsx (headless: none of the others). */
let screenExists: (name: string) => boolean = () => false;
export function setScreenCheck(fn: (name: string) => boolean) { screenExists = fn; }

function need(): CareerState {
  const c = getCareer();
  if (!c) throw new Error("No career");
  return c;
}

/** The fixture the next match is for (null when the season has none left). page.tsx: nextFixtureFor(career). */
export function nextFixture(): Fixture | null {
  const c = getCareer();
  return c ? nextFixtureFor(c) : null;
}

/** Every fixture played and the season not rolled over (page.tsx seasonOver). */
export function seasonOver(c: CareerState | null = getCareer()): boolean {
  return !!c && c.fixtures.length > 0 && !nextFixtureFor(c);
}

/** Your side's name for a fixture: your club, or your country (page.tsx myTeam). */
export function myTeam(c: CareerState, f: Fixture): string {
  return f.kind === "international" ? nationOf(c) : c.player.club;
}

// ═══════════════════════════════════════════════════════════════════
//  A NEW CAREER (handleProfileComplete → trial → offers → signing)
// ═══════════════════════════════════════════════════════════════════

/** The profile screens are done: a career with no club, into the trial. */
export function beginCareer(player: StarPlayer, division: CareerDivision = "premier", seed?: number): Step {
  const created = { ...makeIdentity(player, division), trial: { ...(seed === undefined ? startTrial() : startTrial(seed)) } };
  setCareer(created);
  setSession({ report: null, news: [], potmWin: null, wonBallonDor: false, contractReason: null, koShown: [], roundupShown: null, training: null });
  // The team sheets, the XP Book, free agents and the wider world (page.tsx
  // handleProfileComplete), answered from the packed files (game/squads.ts).
  resetSquadEffects();
  void afterNewCareer([]);
  return { screen: "career-trial" };
}

/**
 * A trial stage played on the match (TrialSequence finishStage): written to
 * the career the instant it exists, with the game's own recordStage.
 */
export function finishTrialStage(stage: TrialStage, quality: number, finalPenScored?: boolean): void {
  setCareer((c) => {
    if (!c.trial) return c;
    const from = c.trial.fiveASide !== undefined ? { ...c.trial, fiveASide: undefined } : c.trial;
    const recorded = recordStage(from, stage, quality);
    return { ...c, trial: finalPenScored === undefined ? recorded : { ...recorded, finalPenScored } };
  });
}
/** TrialSequence's effect: the stage a screen is showing is marked open (the anti-cheat's beginStage). */
export function beginTrialStage(stage: TrialStage): void {
  setCareer((c) => (c.trial ? { ...c, trial: beginStage(c.trial, stage) } : c));
}

/**
 * STILL A STAND-IN for the two stages the website does not play on the
 * match engine (dribbling: FirstPersonDribble's own first-person picture;
 * vision: TrialVision's own picture): scored from your skills and a roll
 * seeded off the trial, then written with the game's own recordStage.
 */
export function simulateTrialStage(stage: TrialStage): void {
  setCareer((c) => {
    if (!c.trial) return c;
    const rng = mulberry32((c.trial.seed ^ stage.length * 7919 ^ Object.keys(c.trial.results).length * 104729) >>> 0);
    const skill = (c.skills.power + c.skills.technique + c.skills.pace) / 300;
    const quality = stage === "shootout" ? (rng() < 0.55 + skill * 0.3 ? 2 / 3 : 1 / 3) + (rng() < 0.4 ? 1 / 3 : 0) : 0.35 + 0.35 * skill + 0.3 * rng();
    return { ...c, trial: recordStage(c.trial, stage, Math.min(1, quality)) };
  });
}

export function trialStages(c: CareerState): TrialStage[] {
  return c.trial ? trialStagesFor(c.trial) : [];
}

/** The clubs that came in (page.tsx offersForTrial). */
export function offersForTrial(career: CareerState): ScoutOffer[] {
  if (!career.trial) return [];
  if ((career.trialsTaken ?? 1) <= 1) return [scoutedOfferForTrial(career.trial)];
  return trialOffers(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x5c0a7), { retrial: (career.trialsTaken ?? 1) > 1 });
}
/** Which club's manager sits you down (page.tsx talkingClubFor). */
export function talkingClubFor(career: CareerState, offers: ScoutOffer[]): ScoutOffer | null {
  if (!offers.length) return null;
  return offers.find((o) => o.club === career.player.club) ?? offers[0];
}
/** page.tsx offersWithAgreedTerms. */
export function offersWithAgreedTerms(career: CareerState, offers: ScoutOffer[]): ScoutOffer[] {
  const agreed = career.agreedTerms;
  if (!agreed) return offers;
  if (agreed.wage <= 0) {
    const rest = offers.filter((o) => o.club !== agreed.club);
    return rest.length ? rest : offers;
  }
  return offers.map((o) => (o.club === agreed.club
    ? { ...o, wage: agreed.wage, goalBonus: goalBonusFor(agreed.wage), assistBonus: assistBonusFor(agreed.wage), ...(agreed.soured ? { pitch: SOURED_PITCH } : {}) }
    : o));
}

/** Where a finished trial goes (page.tsx afterTrialPhase). */
export function afterTrial(): Step {
  const c = need();
  if (c.trial && !trialComplete(c.trial)) return { screen: "career-trial" };
  if (c.agreedTerms) return { screen: "career-offers" };
  return offersForTrial(c).length ? { screen: "career-manager-talk" } : { screen: "career-offers" };
}

/** The manager's verdict and opening number (page.tsx manager-talk phase). */
export function managerTalk(c: CareerState): { talk: ManagerTalk; offer: ScoutOffer; firstContract: boolean } | null {
  if (!c.trial) return null;
  const talking = talkingClubFor(c, offersForTrial(c));
  if (!talking) return null;
  const talk = managerTalkFor({
    trial: c.trial, club: talking.club, division: talking.division, clubStrength: talking.strength,
    playerFirstName: c.player.firstName, scoutNouns: leoUpdateOn("bugFixes"), rng: mulberry32(c.trial.seed ^ 0x1a9b3),
  });
  const firstContract = isStory(c);
  return { talk: firstContract ? { ...talk, openingWeekly: FIRST_CONTRACT_WAGE } : talk, offer: talking, firstContract };
}

/** "Accept & sign" in the manager's office (ManagerTalk onAccept). */
export function acceptManagerOffer(): Step {
  const c = need();
  const m = managerTalk(c);
  if (!m) return { screen: "career-offers" };
  const agreed = { ...c, agreedTerms: { club: m.offer.club, wage: m.talk.openingWeekly } };
  const offer = offersWithAgreedTerms(agreed, offersForTrial(agreed)).find((o) => o.club === m.offer.club);
  if (offer) { setCareer(agreed); return signTrialOffer(offer); }
  setCareer(agreed);
  return { screen: "career-offers" };
}

/** Sign for a club from the trial's offers (page.tsx signTrialOffer). */
export function signTrialOffer(offer: ScoutOffer): Step {
  const career = need();
  const loan = rollLoanWildcard(offer.club, offer.division, offer.seasons, mulberry32((career.trial?.seed ?? 1) ^ 0x70a2 ^ offer.club.length));
  const homeClub = loan ? loan.hostClub : offer.club;
  const homeDivision = loan ? loan.hostDivision : offer.division;
  const wage = loan ? loan.wage : offer.wage;
  const clubs = loan ? loan.hostClubs : clubsForDivision(offer.division);
  const signed = attachClub(career, homeClub, clubs, homeDivision, wage);
  const withDeal: CareerState = {
    ...signed,
    contract: {
      club: loan ? loan.parentClub : offer.club,
      wage,
      goalBonus: loan ? goalBonusFor(wage) : offer.goalBonus,
      assistBonus: loan ? assistBonusFor(wage) : offer.assistBonus,
      seasonsRemaining: offer.seasons,
    },
    agreedTerms: undefined,
    ...(loan ? { placement: startLoanSpell(loan, signed.seasonStats.goals) } : null),
  };
  // page.tsx's own effect: a career with a club and fixtures is brought into
  // step with the international world once.
  setCareer(withDeal);
  // The real dressing room, now that there is one (page.tsx: fetchRealSquad + fetchLeagueSquads).
  void afterSigning(homeClub, clubs);
  settle();
  return { screen: "career-signed" };
}

/** Where CONTINUE on the title screen lands: Home, or the step a career with no club is at. */
let loadedOnce = false;
export function resumeStep(): Step {
  const c = getCareer();
  if (!c) return { screen: "career-new" };
  // page.tsx's save load: an existing career gets the real dressing rooms (game/squads.ts).
  if (!loadedOnce) { loadedOnce = true; void afterLoad(c); void keepSquadsInStep(c); }
  if (c.retired) return { screen: "career-legacy" };
  if (!c.player.club) return clublessStep(c);
  // A youth-team player lands on Home like anyone else (page.tsx's load goes to the dashboard); PLAY is his youth week.
  return HOME;
}

/** page.tsx clublessPhaseFor: which screen a career with NO club belongs on. */
export function clublessStep(c: CareerState): Step {
  if (c.trial && !trialComplete(c.trial)) return { screen: "career-trial" };
  if (!c.trial) return { screen: "career-free-agent" };
  if (c.agreedTerms) return { screen: "career-offers" };
  return offersForTrial(c).length ? { screen: "career-manager-talk" } : { screen: "career-free-agent" };
}

/** TrialReward's "done": the signing news, then Home (or the loan brief). */
export function finishSigning(): Step {
  const c = need();
  pushNews(signingNews(c, c.contract?.club ?? c.player.club));
  return c.placement?.kind === "loan" ? { screen: "career-loan-brief", params: { intro: true } } : HOME;
}

/** Nobody offered terms: a youth team, or the free-agent life (page.tsx youthOrFreeAgent). */
/** The club whose youth team takes you when nobody offers terms, or null (page.tsx youthClub; the same roll youthOrFreeAgent makes). */
export function youthTakerName(career: CareerState): string | null {
  if (!career.trial) return null;
  return youthTakerFor(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x9e11))?.club ?? null;
}
export function youthOrFreeAgent(): Step {
  const career = need();
  if (!career.trial) return { screen: "career-free-agent" };
  const taker = youthTakerFor(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x9e11));
  if (!taker) return { screen: "career-free-agent" };
  const wage = youthWage(taker.club, taker.division);
  const signed = attachClub(career, taker.club, taker.clubs, taker.division, wage);
  setCareer({
    ...signed,
    contract: { club: taker.club, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 2 },
    agreedTerms: undefined,
    placement: startYouthSpell(taker.club, taker.division, "trial"),
  });
  void afterSigning(taker.club, taker.clubs);
  settle();
  return { screen: "career-youth" };
}

/** page.tsx's effect: a career with a club and fixtures is brought into step with the international world once a season. */
export function withIntl(c: CareerState): CareerState {
  return c.player?.club && c.fixtures?.length && !c.intl?.xi?.[c.season] ? syncIntl(c) : c;
}

/**
 * What page.tsx's two effects do after any change outside the match: the
 * central achievement check, then the international world kept in step.
 */
export function settle(): string[] {
  const ids = centralCheck();
  const c = getCareer();
  if (c) { const synced = withIntl(c); if (synced !== c) setCareer(synced); }
  // page.tsx's squad effects: missing division squads, your club's full roster, free agents.
  void keepSquadsInStep();
  hallRecordCheck();
  return ids;
}

/**
 * YOUR LEGEND LIVES ON (page.tsx, lib/star/hallRecords.ts): a record from one of your own
 * retired careers (the phone's Hall of Fame), broken by this career. Each one once a career:
 * the RECORD BROKEN banner, and the posts about it.
 */
function hallRecordCheck() {
  try {
    const career = getCareer();
    if (!career || career.retired) return;
    const entries = phoneHall().entries;
    if (!entries.length) return;
    const broken = freshHallRecords(career, hallRecordBook(entries));
    if (!broken.length) return;
    let next: CareerState = { ...career, hallRecordsBroken: Array.from(new Set([...(career.hallRecordsBroken ?? []), ...broken.map((b) => b.record.def.id)])) };
    for (const b of broken) {
      try {
        next = { ...next, media: generateForCareer(next, { kind: "hall-record", record: b.record.def.label, holder: b.record.holder.name, was: b.record.holder.value, now: b.you, unit: b.record.def.unit }, `hall-${b.record.def.id}`) };
      } catch { /* the posts are extra: the record still counts */ }
    }
    setCareer(next);
    for (const b of broken) {
      pushPop({ kind: "toast", record: true, label: "Hall of Fame record broken", unlocked: `${b.record.def.label}: ${hallAmount(b.record.def, b.you)} — beating ${b.record.holder.name} (${b.record.holder.value})` });
    }
  } catch { /* no Hall to chase */ }
}

// ═══════════════════════════════════════════════════════════════════
//  THE WEEK: training, rest, cans, the central achievement check
// ═══════════════════════════════════════════════════════════════════

export const TRAINING_ENERGY_COST = getTuning("energy.trainingCost");

/**
 * THE CENTRAL CHECK (page.tsx useEffect): any change to the career outside a
 * match unlocks newly earned achievements at once and brings the star rating
 * up to date. Returns the ids it unlocked.
 */
export function centralCheck(): string[] {
  const career = getCareer();
  if (!career) return [];
  const ids = checkNewAchievements(career);
  if (ids.length === 0) return [];
  const unlocked = { ...career, achievements: [...career.achievements, ...ids] };
  const next = withStars({ ...unlocked, starRating: computeStarRating(unlocked) });
  setCareer(next);
  // The pop-up shows the star bar moving (page.tsx offMatchAch).
  pushPop({ kind: "achievements", items: achievementCards(ids), star: { from: starsNow(career), to: starsNow(next), toNext: starStatus(next).toNext, fromNext: starStatus(career).toNext } });
  return ids;
}

/** Put your feet up (page.tsx handleRest). */
export function restDay(): void {
  setCareer((c) => rest(c));
  settle();
}

/** Drink a can (page.tsx handleUseCan). */
export function useCan(id: KibCan["id"]): void {
  const career = need();
  if (career.kibCans[id] === 0) return;
  const can = KIB_CANS.find((c) => c.id === id)!;
  if (can.effect && career.kibAbility?.[can.effect]) return;
  if (!can.effect && career.energy >= 100) return;
  setCareer({
    ...career,
    kibCans: { ...career.kibCans, [id]: career.kibCans[id] - 1 },
    ...(can.effect ? { kibAbility: { ...career.kibAbility, [can.effect]: true } } : {}),
    energy: Math.min(100, career.energy + can.restore),
  });
  settle();
}

/** Buy a can (page.tsx handleBuyKib). */
export function buyCan(can: KibCan): void {
  const career = need();
  const price = kibCanPrice(can, career.contract.wage ?? 0);
  if (career.money < price) return;
  setCareer({ ...career, money: career.money - price, kibCans: { ...career.kibCans, [can.id]: career.kibCans[can.id] + 1 } });
  settle();
}

/** Training: a skill picked (page.tsx handleTrain). Null when no session is left. */
export function pickTraining(skill: keyof Skills): Step | null {
  const career = need();
  if (trainingLeft(career) <= 0 && !trainingDayOn(career)) return null;
  setSession({ training: { skill, level: null } });
  return { screen: "career-training-levels", params: { skill } };
}

/**
 * STILL A STAND-IN for the two drills the website does not play on the
 * match engine (Pace: the Gauntlet, FirstPersonDribble; Vision: Pick the
 * Pass, its own picture). Power, Technique, Free Kick and Aerial are played
 * on the match (screens/MatchStages.tsx DrillStrike). Three tries, each
 * passed or not off your skill against the level's difficulty, seeded so
 * the same level gives the same stars. Returns 0-3 stars.
 */
export function simulateDrill(skill: keyof Skills, level: number): number {
  const c = need();
  const rng = mulberry32((c.week * 977 + level * 131 + skill.length * 17 + c.season * 7) >>> 0);
  // levelDifficulty is the skill the level is built for (40-100): at it, a coin flip a try.
  const chance = Math.max(0.1, Math.min(0.95, 0.5 + (c.skills[skill] - levelDifficulty(level)) / 40));
  let stars = 0;
  for (let t = 0; t < 3; t++) if (rng() < chance) stars++;
  return Math.max(0, Math.min(3, stars));
}

/** A drill finished with N stars (page.tsx handleTrainingComplete). */
export function completeTraining(skill: keyof Skills, level: number, stars: number): { step: Step; shopOpened: boolean } {
  const career = need();
  const banked = applyLevelResult(career, skill, level, stars).career;
  const dayDrill = trainingDayOn(career) && trainingDayLeft(career).includes(skill);
  const updated: CareerState = {
    ...banked,
    lastTrainedWeek: { ...career.lastTrainedWeek, [skill]: career.week },
    energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
    starRating: career.starRating,
  };
  updated.starRating = computeStarRating(updated);
  const drilled = recordDrill(spendTrainingSession(updated), starStatus(career).total, starsNow(career));
  setCareer(dayDrill ? recordTrainingDayDrill(drilled, skill) : drilled);
  noteRating(starsNow(career), starsNow(updated));
  const shopOpened = gameFirst(career) && !isStory(career) && career.unlocks!.drills + 1 === DRILLS_TO_OPEN_SHOP;
  // page.tsx chainPop: the first drill is a first step, and opens the Shop.
  if (shopOpened) pushPop({ kind: "toast", label: "Complete a training drill", unlocked: "Shop unlocked" });
  setSession({ training: null });
  settle();
  return { step: career.placement?.kind === "youth" ? { screen: "career-youth" } : { screen: "career-training" }, shopOpened };
}

// ═══════════════════════════════════════════════════════════════════
//  MATCH DAY (handlePlayMatch, handleSimMatch, handleWatchFromStands)
// ═══════════════════════════════════════════════════════════════════

/** The week as it will be once you play (handlePlayMatch's readying, without saving it). */
function readied(c: CareerState): CareerState {
  return { ...c, weekActions: 0, energy: projectedEnergy(c) };
}

/** Committing to play: the week's actions spent, the rest days' energy banked (handlePlayMatch). */
export function readyWeek(): Fixture | null {
  const c = getCareer();
  const f = c ? nextFixtureFor(c) : null;
  if (!c || !f) return null;
  setCareer(readied(c));
  return f;
}

/** Who the manager has picked this week, as of kick-off energy (page.tsx preMatchSelection). */
export function preMatchSelection(c: CareerState) {
  return selectionFor({ ...c, energy: projectedEnergy(c) });
}

/**
 * Full time: credit the match to the career (page.tsx handleMatchComplete).
 * Called by the match area; then it opens "post-match".
 */
export function completeMatch(stats: MatchStats): void {
  const before = getCareer();
  const fixture = before ? nextFixtureFor(before) : null;
  if (!before || !fixture) return;
  // handlePlayMatch readies the week before kick-off; readying is idempotent,
  // so a match opened without it is credited the same.
  const career = readied(before);
  const credited = creditMatchResult(career, fixture, stats);
  const bootsWornOut = career.currentBoot.matches > 0 && credited.career.currentBoot.matches === 0;
  const { newlyUnlocked, potmAwarded } = credited;
  let next = recordFirstMatch(credited.career);
  pushNews(...newsForMatch(career, next, fixture, fixture.kind && fixture.kind !== "league" ? fixtureLabel(fixture) : null));
  const starNext = starStatus(next);
  const earned = matchStarPoints(career, fixture, stats);
  const pick = (c: CareerState) => ({ boss: c.relationships.boss, team: c.relationships.team, fans: c.relationships.fans });
  const gain = starGain(career, next);
  const energyBack = stats.endEnergy !== undefined ? Math.max(0, Math.round(next.energy - Math.max(0, Math.min(100, stats.endEnergy)))) : null;

  next.media = fixture.kind === "international"
    ? generateForInternational(career, next, fixture, stats, nationOf(career), nationKits(nationOf(career)).home, nationStrength(nationOf(career)))
    : generateForMatch(career, next, fixture, stats);
  if (leoUpdateOn("goalOfMonth")) { const b = applyGoalOfMonthBoost(next); next.relationships = b.relationships; next.media = b.media; }
  // (leoUpdateOn("feedSpeed") premakes goal videos: the phone has no video maker yet.)
  const restOfWeek = (next.results ?? []).filter((r) => r.week === fixture.week && r.home !== career.player.club && r.away !== career.player.club);
  if (restOfWeek.length) next.media = generateForLeagueWeek({ ...next, media: next.media }, restOfWeek);
  if (potmAwarded) {
    const place = potmAwarded.isYou ? "won it"
      : potmAwarded.yourPlace ? `${potmAwarded.yourPlace}${["st", "nd", "rd"][potmAwarded.yourPlace - 1] ?? "th"} on the shortlist`
      : "not shortlisted";
    next.media = generateForCareer({ ...next, media: next.media }, {
      kind: "award", won: potmAwarded.isYou, award: `${potmAwarded.monthName} Player of the Month`,
      detail: potmAwarded.isYou
        ? `${potmAwarded.goals} goals and ${potmAwarded.assists} assists in ${potmAwarded.monthName}.`
        : `${potmAwarded.winner} of ${potmAwarded.club} takes it — ${potmAwarded.goals} goals. You were ${place}.`,
    }, `potm-${potmAwarded.season}-${potmAwarded.month}`);
  }
  next = applyFormCollapse(next);

  const report: MatchReport = {
    stats, fixture,
    starFrom: starsNow(career), starTo: starNext.stars,
    star: {
      sp: earned.total, base: earned.base, mult: earned.mult, toNext: starNext.toNext, fromNext: starStatus(career).toNext, gate: starNext.gate?.need,
      total: gain.total, extra: gain.lines.filter((l) => l.cat !== "match").map((l) => ({ label: l.label, sp: l.sp, n: l.n })),
      held: starNext.held, carried: starNext.carried,
    },
    rel: { before: pick(career), after: pick(next) },
    bootsWornOut, achievements: newlyUnlocked, energyBack,
    knockout: next.knockoutMessage ?? null,
    competition: fixture.kind && fixture.kind !== "league" ? fixtureLabel(fixture) : null,
  };
  setSession({ report, energyBack, ...(potmAwarded?.isYou ? { potmWin: potmAwarded } : {}) });
  setCareer(next);
  noteRating(starsNow(career), starNext.stars, false);
  settle();
}

/** page.tsx applyFormCollapse: a run of bad games and it is the youth team. */
function applyFormCollapse(next: CareerState): CareerState {
  return formHasCollapsed(next) ? dropToYouth(next) : next;
}

/** "Sim this match" (page.tsx handleSimMatch): your chances settled by your skills, credited like a played match. */
export function simMatch(): Step {
  const career = getCareer();
  const fixture = career ? nextFixtureFor(career) : null;
  if (!career || !fixture) return HOME;
  const r = readied(career);
  setCareer(r);
  completeMatch(simStatsFor(r, fixture));
  return { screen: "post-match" };
}

/** The stats the website's Sim button makes (simulateOwnMatch, same inputs as page.tsx). */
export function simStatsFor(r: CareerState, fixture: Fixture): MatchStats {
  const sel = selectionFor(r);
  const bootOn = r.currentBoot.matches > 0;
  return simulateOwnMatch(r, fixture, {
    selection: sel,
    duties: setPieceDuties(r, sel.status),
    skills: {
      power: Math.min(100, r.skills.power + (bootOn ? r.currentBoot.power : 0)),
      technique: Math.min(100, r.skills.technique + (bootOn ? r.currentBoot.technique : 0)),
    },
  });
}

/** Left out of the squad, or your nation on TV (page.tsx handleWatchFromStands). */
export function watchFromStands(): { step: Step; watched: Fixture | null } {
  const career = need();
  const f = nextFixtureFor(career);
  if (!f) return { step: HOME, watched: null };
  const { career: next } = simulateMissedFixture(career, f);
  setCareer(next);
  noteRating(starsNow(career), starsNow(next));
  settle();
  if (f.watch) {
    const watched = next.fixtures.find((x) => x.intlId === f.intlId && x.played) ?? null;
    return { step: { screen: "career-watched" }, watched };
  }
  return { step: afterAnyWeek(next), watched: null };
}

/** After a week without a match of yours: the season-end prompt or a call-up waits on Home. */
function afterAnyWeek(c: CareerState): Step {
  if (periodDue(c) !== null) return { screen: "career-callup" };
  return HOME;
}

// ═══════════════════════════════════════════════════════════════════
//  AFTER THE MATCH (handlePostMatchContinue → continueAfterMatch)
// ═══════════════════════════════════════════════════════════════════

/** Out of the ground: the phone's reactions first when there is something to read, then on. */
export function postMatchContinue(): Step {
  const career = need();
  const r = getSession().report;
  // hasFreshMedia && isOpen(career, "phone") && the per-device preference: the feed is the WORLD area's screen.
  if (!r?.stats.simmed && getPostMatchReactions() && hasFreshMedia(career) && isOpen(career, "phone") && screenExists("media")) return { screen: "media", params: { afterMatch: true } };
  return continueAfterMatch();
}

/**
 * Everything between the final whistle and the next week (page.tsx
 * continueAfterMatch). `skipDraw` is set coming back from the draw screen.
 */
export function continueAfterMatch(skipDraw = false): Step {
  const from = need();
  const s = getSession();
  const played = s.report?.fixture ?? null;

  if (from.lastTransferWindowKey && from.lastTransferWindowKey !== from.deadlineDayShownFor && screenExists("deadline-day")) {
    return { screen: "deadline-day" };
  }

  const ko = played ? knockoutRoundupFor(from, played) : null;
  if (ko && !s.koShown.includes(ko.key)) {
    setSession({ koShown: [...s.koShown, ko.key] });
    if (screenExists("knockout-roundup")) return { screen: "knockout-roundup", params: { ko } };
  }

  if (played?.kind === "international" && played.round && from.tournament?.season === from.season && played.competition === from.tournament.competition) {
    const key = `tourn:${from.season}:${played.week}`;
    if (!s.koShown.includes(key)) {
      setSession({ koShown: [...getSession().koShown, key] });
      if (screenExists("intl-tournament-table")) return { screen: "intl-tournament-table" };
    }
  }

  if (!skipDraw && played) {
    const cupCompetition = played.competition === "FA Cup" || played.competition === "League Cup" || played.competition === "Lower League Trophy" ? played.competition : null;
    if (cupCompetition) {
      const state = from.cupState?.find((x) => x.competition === cupCompetition);
      const round = state ? currentRound(state) : null;
      const freshlyDrawn = round && round.ties.length >= 2 && round.ties.every((t) => t.hs === undefined && !t.legs?.length);
      const youreIn = !!round && round.ties.some((t) => t.home === from.player.club || t.away === from.player.club);
      const r16 = state ? lastSixteenIndex(state) : -1;
      const shownInBracket = !!state && state.rounds.length - 1 > r16;
      if (freshlyDrawn && round && youreIn && !shownInBracket && screenExists("cup-draw")) {
        return { screen: "cup-draw", params: { competition: cupCompetition, round } };
      }
    }
    const isEuroKnockout = played.kind === "europe" && (played.competition === "Champions League" || played.competition === "Europa League");
    if (isEuroKnockout && from.euroState && !from.euroState.bracket) {
      const tie = currentTie(from.euroState);
      const freshlyDrawn = tie && tie.legs.every((l) => l.us === undefined);
      if (freshlyDrawn && tie && screenExists("cup-draw")) {
        return { screen: "cup-draw", params: { competition: from.euroState.competition, round: { name: tie.round, ties: [{ home: from.player.club, away: tie.opponent }] } } };
      }
    }
  }

  if (from.playOffState) {
    const upcoming = nextFixtureFor(from);
    const runOver = !!from.playOffState.yourRunOver && played?.kind === "playoff";
    const key = upcoming?.kind === "playoff" ? `${from.season}:${upcoming.round}:${upcoming.week}` : runOver ? `${from.season}:end` : null;
    if (key && s.roundupShown !== key) {
      setSession({ roundupShown: key });
      if (screenExists("playoff-roundup")) return { screen: "playoff-roundup" };
    }
  }

  // Home, where "End of Season" waits: you end the season yourself.
  if (from.fixtures.filter((f) => !f.played).length === 0) return HOME;

  if (periodDue(from) !== null) return { screen: "career-callup" };

  const earlyOffer = checkForContractOffer(from);
  if (earlyOffer) {
    setCareer(markContractOfferUsed(from, earlyOffer));
    setSession({ contractReason: earlyOffer });
    return { screen: "career-contract-renewal" };
  }
  return HOME;
}

// ── The international call-up (page.tsx intl-callup phase) ──

export function callUpDecision(): IntlDecision | null {
  const c = getCareer();
  const p = c ? periodDue(c) : null;
  return c && p ? decide(c, p) : null;
}
export function answerCallUp(decision: IntlDecision): Step {
  const career = need();
  let next = applyDecision(career, decision);
  const rec = next.international ?? { decided: [], callUps: 0, snubs: 0, matches: [] };
  next = { ...next, international: { ...rec, callUps: rec.callUps + (decision.called ? 1 : 0), snubs: rec.snubs + (decision.called ? 0 : 1) } };
  if (decision.called) {
    next = { ...next, media: generateForCallUp(next, decision.nation, next.international?.callUps ?? 1, decision.period.label, `callup-${decision.period.key}`) };
  }
  setCareer(next);
  settle();
  // Another window can already be due (page.tsx's effect re-opens the call-up).
  return periodDue(next) !== null ? { screen: "career-callup" } : HOME;
}

// ── A contract (page.tsx handleContractComplete) ──

export function contractComplete(newContract: CareerState["contract"] | null): Step {
  const career = need();
  if (newContract) {
    const signed: CareerState = { ...career, contract: newContract };
    signed.media = generateForCareer(signed, { kind: "contract", club: newContract.club, wage: newContract.wage, seasons: newContract.seasonsRemaining }, `contract-s${career.season}`);
    setCareer(signed);
  }
  setSession({ contractReason: null });
  settle();
  return HOME;
}

// ═══════════════════════════════════════════════════════════════════
//  THE END OF THE SEASON
//  endSeason → (season reel) → Golden Ball → retirement / final season /
//  transfer window → rollOverSeason → season awards → contract or Home
// ═══════════════════════════════════════════════════════════════════

/** "End of Season" pressed on Home (page.tsx endSeason). */
export function endSeason(): Step {
  const from = need();
  const { career: awarded } = awardLeagueTrophyIfWon(from);
  setCareer({ ...awarded, lastSeasonAwardStats: computeSeasonAwardStats(awarded) });
  settle();
  // "Your season" first, then the Golden Ball: Leo's update only, as on the
  // website (off by default there). The phone shows it as a still slideshow.
  return leoUpdateOn("seasonReel") ? { screen: "career-season-reel" } : { screen: "career-golden-ball" };
}

/** The Golden Ball night is over (page.tsx handleBallonDorContinue). */
export function ballonDorContinue(userWon: boolean): Step {
  const career = need();
  setSession({ wonBallonDor: userWon });
  const check = retirementCheck(career);
  if (check.mustRetire) return { screen: "career-retirement" };
  if (check.finalSeasonNext) return { screen: "career-final-season" };
  return openTransferWindowOrRoll(career, userWon);
}

/** After the final-season notice (page.tsx handlePlayOn). */
export function playOn(): Step {
  return openTransferWindowOrRoll(need(), getSession().wonBallonDor);
}

/** page.tsx openTransferWindowOrRoll. */
export function openTransferWindowOrRoll(from: CareerState, userWon: boolean): Step {
  if (isRegionalDivision(divisionOf(from)) && sortLeague(from.league).slice(-4).some((t) => t.name === from.player.club)) {
    const forced = generateRelegationOffers(from, mulberry32(from.season * 8831 + from.fame));
    if (forced.length > 0) {
      const agreed = requestOf(from).agreed;
      const offers = agreed ? [agreed, ...forced.filter((o) => o.club !== agreed.club)] : forced;
      if (screenExists("relegation-move")) return { screen: "relegation-move", params: { offers } };
      // No relegation screen yet: the first club that came in (the move is forced).
      return signTransfer(offers[0], true);
    }
  }
  const interest = withRecall(windowInterest(from, "summer", { step3Promoted: leoUpdateOn("bugFixes") }), loanRecallOffer(from), from);
  if (interest.leagues.length > 0) {
    if (screenExists("season-transfer")) return { screen: "season-transfer" };
    // No transfer window screen yet: the same as "Stay where you are" (handleStayPut).
    return rollOverSeason(clearAfterWindow(from), userWon);
  }
  return rollOverSeason(from, userWon);
}

/**
 * The transfer window's signing done (page.tsx handleSigningDone). For the
 * WORLD area's transfer screens: call this once the player signs.
 */
export function signTransfer(offer: TransferOffer, wasRelegationMove = false): Step {
  const career = need();
  const moved = clearAfterWindow(acceptOffer(career, offer));
  // New club, new team-mates: the real squad lands a moment later (page.tsx handleSigningDone).
  void afterTransfer(offer.club);
  const crossDivision = !!offer.division && offer.division !== divisionOf(career);
  moved.media = generateForCareer(moved, { kind: "transfer", from: career.player.club, to: offer.club, fee: offer.transferFee ?? offer.signingFee }, "transfer");
  pushNews(leoUpdateOn("bugFixes")
    ? signingNews(moved, offer.club, { division: offer.division ?? divisionOf(career), age: moved.player.age + 1 })
    : signingNews(moved, offer.club));
  setCareer(moved);
  return rollOverSeason(moved, getSession().wonBallonDor, wasRelegationMove || crossDivision, true);
}

/** Stay where you are (page.tsx handleStayPut). For the WORLD area's transfer screens. */
export function stayPut(): Step {
  return rollOverSeason(clearAfterWindow(need()), getSession().wonBallonDor);
}

/** Into the next season (page.tsx rollOverSeason). */
export function rollOverSeason(from: CareerState, userWon: boolean, forcedRelegationMove = false, justTransferred = false): Step {
  const { career: rolled } = advanceSeason(from, userWon, justTransferred, { noSackAfterPromotion: leoUpdateOn("bugFixes") });
  const next = endLoan(rolled);
  next.lastSeasonRecords = from.seasonRecords ?? [];
  next.seasonRecords = [];
  if (forcedRelegationMove && next.ladderNews) next.ladderNews = { ...next.ladderNews, yourMove: null };
  if (userWon) next.media = generateForCareer(next, { kind: "ballon-dor", won: true, total: next.ballonDorWins }, "bdor");
  for (const a of (next.awards ?? []).filter((x) => x.season === from.season)) {
    next.media = generateForCareer({ ...next, media: next.media }, { kind: "award", won: true, award: a.kind, detail: a.detail }, `award-${a.kind}`);
  }
  if (next.managerNews && next.manager) {
    next.media = generateForCareer({ ...next, media: next.media }, { kind: "manager-out", name: from.manager?.name ?? "The manager", incoming: next.manager.name, reason: next.managerNews }, "gaffer");
  }
  if (next.lastSeasonJudgement) {
    next.media = generateForCareer({ ...next, media: next.media }, { kind: "season-end", position: leaguePosition(from), headline: next.lastSeasonJudgement.headline, detail: next.lastSeasonJudgement.detail }, "review");
  }
  next.media = generateForRollover({ ...next, media: next.media });
  setCareer(next);
  noteRating(starsNow(from), starsNow(next));
  settle();
  setSession({ report: null, koShown: [], roundupShown: null });
  if (next.lastSeasonAwardStats) return { screen: "career-season-awards" };
  return continueAfterRollover(next);
}

/** page.tsx continueAfterRollover / handleSeasonAwardsContinue. */
export function continueAfterRollover(next: CareerState = need()): Step {
  if (next.contract.seasonsRemaining <= 0) return { screen: "career-contract-renewal" };
  return HOME;
}

/**
 * "Hang them up" on the final whistle (page.tsx handleHangThemUp): the
 * farewell match first, once per career; if its sides can't be made, the
 * career simply retires.
 */
export function retireNow(): Step {
  const career = need();
  if (career.farewell) return retireWith();
  try {
    const sides = farewellSides(career, { calendarYears: leoUpdateOn("bugFixes") });
    farewell = { sides, career: farewellCareer(career, sides), fixture: farewellFixture(career, sides), stats: null };
    return { screen: "career-farewell-invite" };
  } catch {
    return retireWith();
  }
}

/** page.tsx handleRetire: the career ends, goes in the Hall of Fame, then the overview. */
export function retireWith(farewellRecord?: FarewellRecord): Step {
  const career = need();
  const leaving = farewellRecord ? { ...career, farewell: farewellRecord } : career;
  const done = retire(leaving, getSession().wonBallonDor);
  done.media = generateForCareer(done, { kind: "retirement", goals: done.careerStats.goals, apps: done.careerStats.appearances, trophies: done.trophies.length }, "retire");
  setCareer(done);
  addToPhoneHall(done);
  farewell = null;
  settle();
  return { screen: "career-legacy" };
}

// ── The farewell match (page.tsx farewell-invite → sheets → walkout → match → result) ──

export interface Farewell { sides: FarewellSides; career: CareerState; fixture: Fixture; stats: MatchStats | null }
let farewell: Farewell | null = null;
/** The farewell being played (null when there is none: the screens go on to the overview). */
export function currentFarewell(): Farewell | null {
  if (!farewell && getCareer() && !getCareer()!.retired && !getCareer()!.farewell) {
    try { const c = getCareer()!; const sides = farewellSides(c, { calendarYears: leoUpdateOn("bugFixes") }); farewell = { sides, career: farewellCareer(c, sides), fixture: farewellFixture(c, sides), stats: null }; } catch { /* no farewell */ }
  }
  return farewell;
}
/** Skip it: kept, so the game knows it was offered once. */
export function skipFarewell(): Step { return retireWith(farewellSkipped(need())); }
/**
 * The farewell match (page.tsx farewell-match: CanvasMatch with farewell.offAt).
 * Played on the phone's match (the match area's "farewell-match" screen), then
 * farewellMatchDone hands its stats back. Headless (no screens): played out by
 * the game's own match simulator on the farewell's career, duties and seed.
 */
export function playFarewell(): Step {
  const career = need();
  const f = currentFarewell();
  if (!f) return retireWith();
  if (screenExists("farewell-match")) return { screen: "farewell-match" };
  const sel = selectionFor(f.career);
  const bootLeft = career.currentBoot.matches > 0;
  const stats = simulateOwnMatch(f.career, f.fixture, {
    selection: sel, duties: farewellDuties(), seed: farewellSeed(career),
    skills: {
      power: Math.min(100, career.skills.power + (bootLeft ? career.currentBoot.power : 0)),
      technique: Math.min(100, career.skills.technique + (bootLeft ? career.currentBoot.technique : 0)),
    },
  });
  f.stats = stats;
  return { screen: "career-farewell-result" };
}
/** The farewell match's full time (page.tsx onComplete → setFarewellStats, farewell-result). */
export function farewellMatchDone(stats: MatchStats): Step {
  const f = currentFarewell();
  if (!f) return retireWith();
  f.stats = stats;
  return { screen: "career-farewell-result" };
}
export function finishFarewell(): Step {
  const f = farewell;
  return f?.stats ? retireWith(farewellRecordFrom(f.stats, f.sides)) : retireWith();
}

// ═══════════════════════════════════════════════════════════════════
//  THE OTHER STEPS (wage talk, youth, loans, round-ups, press, dilemmas,
//  relationships, the relegation move, the season reel)
// ═══════════════════════════════════════════════════════════════════

/** The wage haggle is done (page.tsx wage-talk onDone): agreed, or soured to a worse final offer. */
export function wageTalkDone(finalSeasonPrice: number | null): Step {
  const career = need();
  const m = managerTalk(career);
  if (!m) return { screen: "career-offers" };
  const weekly = agreedWeeklyWage(finalSeasonPrice, m.talk.club, m.talk.division);
  setCareer({ ...career, agreedTerms: weekly === null
    ? { club: m.talk.club, wage: Math.max(1, Math.round(m.offer.wage * SOURED_OFFER_SHARE)), soured: true }
    : { club: m.talk.club, wage: weekly } });
  return { screen: "career-offers" };
}

/** A youth-team week (page.tsx handleYouthWeek). */
export function youthWeek(): Step {
  const career = need();
  if (career.placement?.kind !== "youth") return HOME;
  const f = nextFixtureFor(career);
  if (!f && career.fixtures.length > 0) return HOME;
  let base = career;
  if (f) base = simulateMissedFixture(career, f).career;
  else base = { ...career, week: career.week + 1, ...startNewWeek() };
  const match = playYouthMatch(base, mulberry32(base.season * 10007 + base.week * 131 + 4409));
  setCareer(applyYouthWeek(base, match));
  settle();
  return { screen: "career-youth" };
}
/** "Go up" (page.tsx handleYouthPromotion). */
export function youthPromote(): Step {
  const career = need();
  if (!readyForPromotion(career)) return { screen: "career-youth" };
  setCareer(promoteFromYouth(career));
  settle();
  return HOME;
}

/** The loan brief's weekly reminder: once a week on the way to the match (page.tsx loanBriefWeek). */
let loanBriefWeek: number | null = null;
export function loanBriefDue(c: CareerState): boolean { return c.placement?.kind === "loan" && loanBriefWeek !== c.week; }
export function loanBriefSeen(c: CareerState = need()) { loanBriefWeek = c.week; }

/** Deadline day shown (page.tsx deadline-day onContinue). */
export function deadlineDayDone(): Step {
  const c = need();
  setCareer({ ...c, deadlineDayShownFor: c.lastTransferWindowKey });
  return continueAfterMatch(true);
}

/** The relegation move: a club picked, signed straight away (handleChooseTransfer → handleSigningDone). */
export function chooseRelegationOffer(offer: TransferOffer): Step {
  return signTransfer(offer, true);
}

/** The relegation offers, again (for a resumed screen). */
export function relegationOffers(from: CareerState = need()): TransferOffer[] {
  const forced = generateRelegationOffers(from, mulberry32(from.season * 8831 + from.fame));
  const agreed = requestOf(from).agreed;
  return agreed ? [agreed, ...forced.filter((o) => o.club !== agreed.club)] : forced;
}

/** The season's reel was watched (page.tsx handleReelDone). */
export function reelDone(): Step {
  setCareer((c) => ({ ...c, reelDoneSeason: c.season }));
  return { screen: "career-golden-ball" };
}

// ── Press conferences and dilemmas: the website has both turned off ("on
//    request"; the plumbing kept). The phone keeps the same: the screens work,
//    the flow does not open them, exactly as continueAfterMatch on page.tsx. ──

export const PRESS_ON = false;
export const DILEMMAS_ON = false;

/** The press question for the match just played (page.tsx pressQuestionFor), or null. */
export function pressQuestion(): PressQuestion | null {
  const c = getCareer();
  const r = getSession().report;
  if (!c || !r) return null;
  return pressQuestionFor(c, r.fixture, r.stats, false, mulberry32(c.season * 977 + c.week));
}
/** page.tsx handlePressAnswer. */
export function answerPress(o: PressOption): Step {
  const career = need();
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  setCareer({
    ...career,
    relationships: { ...career.relationships, boss: clamp(career.relationships.boss + o.boss), team: clamp(career.relationships.team + o.team), fans: clamp(career.relationships.fans + o.fans) },
    happiness: clamp(career.happiness + (o.happiness ?? 0)),
  });
  settle();
  return continueAfterMatch();
}

/** A dilemma for this career, never a gambling one (the phone app has none: lib/app/packed.ts). */
export function dilemmaFor(c: CareerState = need()): Dilemma | null {
  const d = pickDilemma(c, mulberry32(c.season * 4099 + c.week * 37));
  return d && !/gambl|casino|\bbet\b|betting|poker|card game|wager/i.test(`${d.id} ${d.title} ${d.text}`) ? d : null;
}
/** page.tsx handleDilemmaChoose. */
export function chooseDilemma(d: Dilemma, effects: DilemmaEffect): Step {
  const career = need();
  const next = applyEffects(career, effects);
  next.seenDilemmas = [...next.seenDilemmas, d.id];
  setCareer(next);
  settle();
  return HOME;
}

// ── Relationships (page.tsx handleRelationshipGameComplete) ──

export type RelKind = "boss" | "team" | "fans" | "happiness";
export interface RelGameResult { won: boolean; gain: number; cost?: number; line?: string }
export function relationshipGameDone(kind: RelKind, res: RelGameResult): Step {
  const career = need();
  const p = career.relGamesPlayed;
  const same = p && p.season === career.season && p.week === career.week;
  let updated: CareerState = {
    ...career,
    money: Math.max(0, career.money - (res.cost ?? 0)),
    energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
    relGamesPlayed: { season: career.season, week: career.week, kinds: [...(same ? p!.kinds : []), kind] },
  };
  if (kind === "happiness") updated.happiness = applyGameGain(career.happiness, res.gain);
  else updated.relationships = { ...career.relationships, [kind]: applyGameGain(career.relationships[kind] as number, res.gain) };
  if (kind === "boss" && career.unlocks && !career.achievements.includes("boss-meeting")) {
    updated = recordBossMeeting(updated);
    // page.tsx chainPop after the first meeting (the story goes Home with no pop-up).
    if (!isStory(career)) pushPop(gameFirst(career)
      ? { kind: "toast", label: "The manager's penalties", unlocked: "Relations unlocked" }
      : { kind: "toast", label: "Have a meeting with your boss", unlocked: "Next: buy your first phone" });
  }
  setCareer(spendAction(updated));
  settle();
  return isStory(career) && kind === "boss" ? HOME : { screen: "career-relations" };
}

/**
 * A 3D training drill finished (page.tsx, the `training-3d` phase's onFinish): the garden's Training gate. It counts as the Team
 * game of the week, with the training session's energy and the same Team bar move as the Woodwork challenge. Pace Sprint
 * (`train`) also banks its stars on the pace ladder, like a 2D pace drill. The screen goes back to the Garden.
 */
export interface TrainingGateResult extends RelGameResult { train?: { skill: keyof Skills; level: number; stars: number } }
export function trainingGateDone(res: TrainingGateResult): void {
  const career = need();
  const trained: CareerState = res.train ? {
    ...applyLevelResult(career, res.train.skill, res.train.level, res.train.stars).career,
    lastTrainedWeek: { ...career.lastTrainedWeek, [res.train.skill]: career.week },
  } : career;
  const p = career.relGamesPlayed;
  const same = p && p.season === career.season && p.week === career.week;
  const updated: CareerState = {
    ...trained,
    energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
    relationships: { ...career.relationships, team: applyGameGain(career.relationships.team as number, res.gain) },
    relGamesPlayed: { season: career.season, week: career.week, kinds: [...(same ? p!.kinds : []), "team"] },
  };
  if (res.train) updated.starRating = computeStarRating(updated);
  setCareer(spendAction(updated));
  settle();
}

/** A sponsor's advert shot (page.tsx advert-shoot onFinish): the brand's happiness, one day, once a week. */
export function advertShot(dealId: string, gain: number): Step {
  const career = need();
  const p = career.relGamesPlayed;
  const same = p && p.season === career.season && p.week === career.week;
  const marked: CareerState = { ...changeDealHappiness(career, dealId, gain), relGamesPlayed: { season: career.season, week: career.week, kinds: [...(same ? p!.kinds : []), "advert"] } };
  setCareer(spendAction(marked));
  settle();
  return { screen: "sponsors" };
}

// ═══════════════════════════════════════════════════════════════════
//  POP-UPS: achievements, the star rating going up, every ten a full screen
//  (page.tsx AchievementToasts / offMatchAch, toastRatingChange, newStar)
// ═══════════════════════════════════════════════════════════════════

export type Pop =
  | { kind: "achievements"; items: { label: string; description: string }[]; star?: { from: number; to: number; toNext: number; fromNext?: number } }
  /** The small banner at the top: a first step done ("Shop unlocked") or a record broken (page.tsx chainPop / earnPops). */
  | { kind: "toast"; label: string; unlocked: string; record?: boolean }
  | { kind: "rating"; from: number; to: number }
  | { kind: "milestone"; level: number };
let pops: Pop[] = [];
const popSubs = new Set<() => void>();
function setPops(next: Pop[]) { pops = next; popSubs.forEach((f) => f()); }
export function pushPop(p: Pop) { setPops([...pops, p]); }
export function dismissPop() { setPops(pops.slice(1)); }
export function usePops(): Pop[] {
  return useSyncExternalStore((f) => { popSubs.add(f); return () => popSubs.delete(f); }, () => pops, () => pops);
}
/** page.tsx toastRatingChange: up only; every ten (20, 30…) gets the full screen; `banner` off for a match. */
export function noteRating(from: number, to: number, banner = true) {
  const a = Math.floor(from), b = Math.floor(to);
  if (b <= a) return;
  if (Math.floor(b / 10) > Math.floor(a / 10)) pushPop({ kind: "milestone", level: Math.floor(b / 10) * 10 });
  if (banner) pushPop({ kind: "rating", from: a, to: b });
}

// ── Breaking news (page.tsx pushNews / newsQueue) ──

export function pushNews(...n: BreakingNews[]) {
  if (n.length) setSession((s) => ({ news: [...s.news, ...n] }));
}
export function dismissNews() { setSession((s) => ({ news: s.news.slice(1) })); }

/** Achievement names, for the post-match screen. */
export function achievementCards(ids: string[]): { label: string; description: string }[] {
  return ids.flatMap((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id); return a ? [{ label: a.label, description: a.description }] : []; });
}
