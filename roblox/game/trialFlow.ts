/**
 * The trial's steps on the server: app/star-dev/page.tsx's handleProfileComplete
 * (a new career starts on a trial), the result of the five stages coming back
 * from the device, offersForTrial, the manager's talk and signTrialOffer.
 * The stages themselves are played on the device (roblox/game/trialPlay.ts).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 */
import type { CareerState, StarPlayer } from "../../lib/star/types";
import type { CareerDivision } from "../../lib/star/calendar";
import { makeIdentity, attachClub } from "../../lib/star/careerFlow";
import {
  startTrial, recordStage, trialComplete, trialScore, trialStagesFor, nextStage,
  type TrialProgress, type TrialStage,
} from "../../lib/star/trial";
import { trialOffers, clubsForDivision, type ScoutOffer } from "../../lib/star/scoutOffers";
import { scoutedOfferForTrial, FIRST_CONTRACT_WAGE } from "../../lib/star/scoutedPlacement";
import { managerTalkFor, type ManagerTalk } from "../../lib/star/signingTalk";
import { goalBonusFor, assistBonusFor } from "../../lib/star/economy";
import { rollLoanWildcard, startLoanSpell, youthTakerFor, startYouthSpell, youthWage } from "../../lib/star/youth";
import { isStory } from "../../lib/star/story";
import { leoUpdateOn } from "../../lib/star/leoUpdate";
import { mulberry32 } from "../../lib/star/season";
import { syncIntl } from "../../lib/star/intl/career";

/** handleProfileComplete: the person the trial builds, no club yet, on a trial. */
export function newTrialCareer(player: StarPlayer, division: CareerDivision, seed?: number): CareerState {
  return { ...makeIdentity(player, division), trial: seed === undefined ? startTrial() : startTrial(seed) };
}

/** What the device sends back: each stage's quality (0..1), in order, and the shootout's last kick. */
export interface TrialReturn {
  results: { stage: string; quality: number }[];
  finalPenScored: boolean;
}

/**
 * The stages' results into the trial (TrialSequence's finishStage → recordStage),
 * checked: only the stages still to play, in order, each quality 0..1.
 * Null = refused.
 */
export function recordTrialReturn(career: CareerState, back: TrialReturn): CareerState | null {
  let trial = career.trial;
  if (!trial || !back || !Array.isArray(back.results)) return null;
  for (const r of back.results) {
    const want = nextStage(trial);
    if (!want || r.stage !== want) return null;
    if (typeof r.quality !== "number" || !Number.isFinite(r.quality) || r.quality < 0 || r.quality > 1) return null;
    trial = recordStage(trial, want, r.quality);
    if (want === "shootout") trial = { ...trial, finalPenScored: !!back.finalPenScored };
  }
  if (!trialComplete(trial)) return null;
  return { ...career, trial };
}

/** page.tsx offersForTrial. */
export function offersForTrial(career: CareerState): ScoutOffer[] {
  if (!career.trial) return [];
  if ((career.trialsTaken ?? 1) <= 1) return [scoutedOfferForTrial(career.trial)];
  return trialOffers(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x5c0a7), { retrial: (career.trialsTaken ?? 1) > 1 });
}

/** page.tsx talkingClubFor. */
export function talkingClubFor(career: CareerState, offers: ScoutOffer[]): ScoutOffer | null {
  if (!offers.length) return null;
  return offers.find((o) => o.club === career.player.club) ?? offers[0];
}

/** The manager-talk phase: what he says, with a new career's fixed first contract. */
export function managerTalk(career: CareerState): { talk: ManagerTalk; offer: ScoutOffer; firstContract: boolean } | null {
  const offers = offersForTrial(career);
  const talking = talkingClubFor(career, offers);
  if (!talking || !career.trial) return null;
  const talk = managerTalkFor({
    trial: career.trial,
    club: talking.club,
    division: talking.division,
    clubStrength: talking.strength,
    playerFirstName: career.player.firstName,
    scoutNouns: leoUpdateOn("bugFixes"),
    rng: mulberry32(career.trial.seed ^ 0x1a9b3),
  });
  const firstContract = isStory(career);
  return { talk: firstContract ? { ...talk, openingWeekly: FIRST_CONTRACT_WAGE } : talk, offer: talking, firstContract };
}

/** page.tsx offersWithAgreedTerms. */
function offersWithAgreedTerms(career: CareerState, offers: ScoutOffer[]): ScoutOffer[] {
  const agreed = career.agreedTerms;
  if (!agreed) return offers;
  if (agreed.wage <= 0) {
    const rest = offers.filter((o) => o.club !== agreed.club);
    return rest.length ? rest : offers;
  }
  return offers.map((o) => (o.club === agreed.club
    ? { ...o, wage: agreed.wage, goalBonus: goalBonusFor(agreed.wage), assistBonus: assistBonusFor(agreed.wage) }
    : o));
}

/** ManagerTalk's "Accept & sign" → signTrialOffer. */
export function acceptManagerOffer(career: CareerState): CareerState | null {
  const mt = managerTalk(career);
  if (!mt) return null;
  const agreed: CareerState = { ...career, agreedTerms: { club: mt.offer.club, wage: mt.talk.openingWeekly } };
  const offer = offersWithAgreedTerms(agreed, offersForTrial(agreed)).find((o) => o.club === mt.offer.club);
  return offer ? signTrialOffer(agreed, offer) : null;
}

/** page.tsx signTrialOffer (the real squads are fetched after, by the server). */
export function signTrialOffer(career: CareerState, offer: ScoutOffer): CareerState {
  const loan = rollLoanWildcard(offer.club, offer.division, offer.seasons, mulberry32((career.trial?.seed ?? 1) ^ 0x70a2 ^ offer.club.length));
  const homeClub = loan ? loan.hostClub : offer.club;
  const homeDivision = loan ? loan.hostDivision : offer.division;
  const wage = loan ? loan.wage : offer.wage;
  const clubs = loan ? loan.hostClubs : clubsForDivision(offer.division);
  const signed = attachClub(career, homeClub, clubs, homeDivision, wage);
  let out: CareerState = {
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
  if (out.fixtures?.length && !out.intl?.xi?.[out.season]) out = syncIntl(out);
  return out;
}

/** No club came in (a second look gone wrong): the youth team that takes you, if any (page.tsx's trial ending). */
export function youthAfterTrial(career: CareerState): CareerState | null {
  if (!career.trial) return null;
  const taker = youthTakerFor(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x9e11));
  if (!taker) return null;
  const wage = youthWage(taker.club, taker.division);
  const signed = attachClub(career, taker.club, taker.clubs, taker.division, wage);
  return {
    ...signed,
    contract: { club: taker.club, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 2 },
    agreedTerms: undefined,
    placement: startYouthSpell(taker.club, taker.division, "trial"),
  };
}

/** For the screens: the stages' names and scores. */
export function trialSummary(trial: TrialProgress): { stage: TrialStage; score: number | null }[] {
  return trialStagesFor(trial).map((s) => ({ stage: s, score: trial.results[s]?.score ?? null }));
}
