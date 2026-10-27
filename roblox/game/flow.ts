/**
 * THE CAREER FLOW, WITHOUT THE SCREENS.
 *
 * The website's page (app/star-dev/page.tsx) decides what happens between
 * screens: after a match, at the end of a season, in the transfer window.
 * That page is React and cannot be converted, so this file repeats its
 * handlers step for step, calling the same lib/star functions in the same
 * order. The converter turns it into Roblox code like any other file, and the
 * Roblox screens (roblox/src/Client) only draw what it says and call it back.
 *
 * Each handler names the page handler it copies. Keep them in step when the
 * page changes (roblox/tools/drift.mjs lists app/star-dev/page.tsx too).
 *
 * Not here yet, on purpose (later stages): the trial (stage 2 needs the
 * match), the shop, training drills, the phone feed screens, the garden.
 * A new career starts signed to the club picked, as the website's career
 * soak does.
 */
import {
  makeInitialCareer, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason,
  checkForContractOffer, markContractOfferUsed,
} from "../../lib/star/careerFlow";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";
import type { CupRound } from "../../lib/star/cups";
import { simulateOwnMatch } from "../../lib/star/simMatch";
import { selectionFor } from "../../lib/star/selection";
import { setPieceDuties } from "../../lib/star/setPieces";
import { projectedEnergy, startNewWeek } from "../../lib/star/week";
import { recordFirstMatch } from "../../lib/star/unlocks";
import {
  generateForMatch, generateForCareer, generateForRollover, generateForCallUp, generateForLeagueWeek,
  generateForInternational, applyGoalOfMonthBoost,
} from "../../lib/star/media/feed";
import { leoUpdateOn } from "../../lib/star/leoUpdate";
import {
  formHasCollapsed, dropToYouth, endLoan, loanRecallOffer, playYouthMatch, applyYouthWeek,
  readyForPromotion, promoteFromYouth,
} from "../../lib/star/youth";
import { computeSeasonAwardStats } from "../../lib/star/seasonAwards";
import { retirementCheck, retire } from "../../lib/star/retirement";
import { windowInterest, withRecall, markWalkedAway, withAgreedWage, type WindowInterest } from "../../lib/star/transferInterest";
import { wageFloorFor } from "../../lib/star/signingTalk";
import { acceptOffer, type TransferOffer } from "../../lib/star/transfers";
import { clearAfterWindow, requestOf } from "../../lib/star/transferRequest";
import { generateRelegationOffers } from "../../lib/star/relegationOffers";
import { isRegionalDivision, divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { sortLeague, mulberry32 } from "../../lib/star/season";
import { knockoutRoundupFor } from "../../lib/star/knockoutView";
type KnockoutRoundup = NonNullable<ReturnType<typeof knockoutRoundupFor>>;
import { periodDue, decide, applyDecision, syncIntl } from "../../lib/star/intl/career";
import { nextFixtureFor, nationOf, leaguePosition } from "../../lib/star/competitions";
import { currentRound, lastSixteenIndex } from "../../lib/star/cups";
import { currentTie } from "../../lib/star/euro";
import { renewalWage, renewalMultiplier } from "../../lib/star/economy";
import { offerClauses } from "../../lib/star/contracts";
import { computeBallonDorShortlist, type BallonDorResult } from "../../lib/star/ballonDor";
import { nationKits, nationStrength } from "../../lib/star/international";
import { fetchRealSquad, shouldUpgradeSquad, squadAfterFetch } from "../../lib/star/realSquad";
import {
  fetchLeagueSquads, fetchFreeAgents, syncLeagueStrengthFromSquads, relabelOutOfPosition, isRealFetch,
  shouldUpgradeLeagueSquads, mergeLeagueSquadStats, reconcileExternalSquads,
} from "../../lib/star/leagueSquads";
import { externalClubsFor } from "../../lib/star/clubs";
import { ageOwnFetchedForCareer, ageFetchedForCareer } from "../../lib/star/worldAgeing";
import { toSavedForm, fromSavedForm, hydrateSquads } from "../../lib/star/squadSaveCodec";
import { withStars } from "../../lib/star/starPoints";

export type Phase =
  | "dashboard" | "youth" | "post-match" | "draw" | "knockout-roundup" | "playoff-roundup" | "deadline-day"
  | "intl-callup" | "intl-watched" | "intl-tournament-table" | "contract-renewal" | "ballon-dor"
  | "retirement" | "final-season" | "season-transfer" | "transfer-request-talk" | "transfer-signing"
  | "relegation-move" | "season-awards" | "ladder" | "legacy";

/** Everything the page keeps in React state, kept here instead. */
export interface Game {
  career: CareerState;
  phase: Phase;
  playedFixture?: Fixture | null;
  lastMatchStats?: MatchStats | null;
  pendingDraw?: { competition: string; round: CupRound } | null;
  pendingKo?: KnockoutRoundup | null;
  koShown: string[];
  roundupShown?: string | null;
  watchedFixture?: Fixture | null;
  contractOfferReason?: "form" | "star" | null;
  wonBallonDor?: boolean;
  transferOffers?: TransferOffer[];
  talkOffer?: TransferOffer | null;
  pendingSignOffer?: { offer: TransferOffer; wasRelegationMove: boolean } | null;
}

const at = (g: Game, phase: Phase, extra: Partial<Game> = {}): Game => ({ ...g, ...extra, phase });

/** The phase the page's effects would move to on their own (intl call-ups, the youth team). */
function settle(g: Game): Game {
  if (g.phase === "dashboard" && g.career.placement?.kind === "youth") return { ...g, phase: "youth" };
  if (g.phase === "dashboard" && periodDue(g.career) !== null) return { ...g, phase: "intl-callup" };
  if (g.phase === "intl-callup" && periodDue(g.career) === null) return { ...g, phase: "dashboard" };
  return g;
}

/** handleProfileComplete, minus the trial: signed straight to the club picked. */
export function newGame(player: StarPlayer, clubs: string[], division: CareerDivision): Game {
  let career = makeInitialCareer(player, clubs, division);
  // page.tsx: "A save from before the international world ... bring it into step once."
  if (career.player?.club && career.fixtures?.length && !career.intl?.xi?.[career.season]) career = syncIntl(career);
  return settle({ career, phase: "dashboard", koShown: [] });
}

/**
 * The real players, from knowitball.co.uk (the same requests the website
 * makes): your dressing room and your division at the signing (page.tsx's
 * scout-offer signing), free agents and the clubs abroad (handleProfileComplete).
 * A request that fails leaves the invented players in place, as on the website.
 */
export async function loadRealSquads(g: Game): Promise<Game> {
  const c = g.career;
  const club = c.player.club;
  const clubs = c.league.map((t) => t.name);
  const squad = await fetchRealSquad(club);
  const leagueSquads = await fetchLeagueSquads(clubs);
  const freeAgents = await fetchFreeAgents();
  const externalSquads = await fetchLeagueSquads(externalClubsFor(clubs));
  const next: CareerState = {
    ...c,
    squad: squad.length ? squad : c.squad,
    leagueSquads,
    league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)),
    freeAgents,
    externalSquads,
  };
  return { ...g, career: next };
}

/**
 * The save, as the website writes it (storage.ts saveCareer): the star rating
 * banked, the other clubs' squads in their thin form (squadSaveCodec.ts).
 */
export function forSave(g: Game): Game {
  return { ...g, career: toSavedForm(withStars(g.career)) as CareerState };
}

/** A save read back (fromSavedForm runs on every save read, as on the website). */
export function fromSave(g: Game): Game {
  return { ...g, career: fromSavedForm(g.career as Parameters<typeof fromSavedForm>[0]) };
}

/**
 * Opening a saved career (page.tsx loadCareerAndDecidePhase): your dressing
 * room upgraded if it is still invented, the division and the clubs abroad
 * refetched and filled back in. Never loses what the career changed.
 */
export async function resumeSquads(g: Game): Promise<Game> {
  let c = g.career;
  if (!c.player.club) return g;
  if (shouldUpgradeSquad(c.squad ?? [])) {
    const real = await fetchRealSquad(c.player.club);
    if (shouldUpgradeSquad(c.squad ?? [])) {
      const squad = squadAfterFetch(c.squad ?? [], ageOwnFetchedForCareer(c, c.player.club, real));
      if (squad) c = { ...c, squad };
    }
  }
  const leagueClubs = c.league.map((t) => t.name);
  if (!(c.leagueSquads ?? []).length) {
    const leagueSquads = await fetchLeagueSquads(leagueClubs);
    c = { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)) };
  } else {
    const fresh = await fetchLeagueSquads(leagueClubs);
    const filled = relabelOutOfPosition(hydrateSquads(c.leagueSquads ?? []));
    if (isRealFetch(fresh) && shouldUpgradeLeagueSquads(filled)) {
      const leagueSquads = mergeLeagueSquadStats(ageFetchedForCareer(c, fresh), filled);
      c = { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)) };
    } else if (filled !== c.leagueSquads) c = { ...c, leagueSquads: filled };
  }
  const abroad = externalClubsFor(leagueClubs);
  if (!(c.externalSquads ?? []).length) {
    c = { ...c, externalSquads: await fetchLeagueSquads(abroad) };
  } else {
    const fresh = await fetchLeagueSquads(abroad);
    const externalSquads = reconcileExternalSquads(
      relabelOutOfPosition(hydrateSquads(c.externalSquads ?? [])), ageFetchedForCareer(c, fresh),
      (club) => !!c.ownedClubs?.[club]?.dissolvedInto,
    );
    c = { ...c, externalSquads };
  }
  return { ...g, career: c };
}

/** After a move (handleSigningDone): the new club's real dressing room. */
export async function loadNewClubSquad(g: Game): Promise<Game> {
  const club = g.career.player.club;
  const squad = await fetchRealSquad(club);
  if (!squad.length) return g;
  return { ...g, career: { ...g.career, squad: ageOwnFetchedForCareer(g.career, club, squad) } };
}

/** What the dashboard offers for the next match (LineupIntro's `watching`). */
export function matchday(g: Game): { fixture: Fixture | null; canPlay: boolean; status: string | null; reason: string | null; seasonOver: boolean } {
  const c = g.career;
  const fixture = nextFixtureFor(c);
  const sel = selectionFor({ ...c, energy: projectedEnergy(c) });
  const watching = sel.status === "Squad" || sel.status === "Injured";
  return {
    fixture,
    canPlay: !!fixture && !watching && !fixture.watch,
    status: sel.status ?? null,
    reason: (sel as { reason?: string }).reason ?? null,
    seasonOver: c.fixtures.length > 0 && !fixture,
  };
}

/** handleSimMatch → handleMatchComplete. */
export function simMatch(g: Game): Game {
  const career = g.career;
  const nextFixture = nextFixtureFor(career);
  if (!nextFixture) return g;
  const readied: CareerState = { ...career, weekActions: 0, energy: projectedEnergy(career) };
  const sel = selectionFor(readied);
  const bootOn = readied.currentBoot.matches > 0;
  const stats = simulateOwnMatch(readied, nextFixture, {
    selection: sel,
    duties: setPieceDuties(readied, sel.status),
    skills: {
      power: Math.min(100, readied.skills.power + (bootOn ? readied.currentBoot.power : 0)),
      technique: Math.min(100, readied.skills.technique + (bootOn ? readied.currentBoot.technique : 0)),
    },
  });
  return matchComplete(g, stats, readied, nextFixture);
}

/** handleMatchComplete: credit the match, the world reacts, on to the post-match screen. */
export function matchComplete(g: Game, stats: MatchStats, readied: CareerState, nextFixture: Fixture): Game {
  const career = readied;
  const credited = creditMatchResult(career, nextFixture, stats);
  const { potmAwarded } = credited;
  const next = recordFirstMatch(credited.career);
  next.media = nextFixture.kind === "international"
    ? generateForInternational(career, next, nextFixture, stats, nationOf(career), nationKits(nationOf(career)).home, nationStrength(nationOf(career)))
    : generateForMatch(career, next, nextFixture, stats);
  if (leoUpdateOn("goalOfMonth")) { const b = applyGoalOfMonthBoost(next); next.relationships = b.relationships; next.media = b.media; }
  const restOfWeek = (next.results ?? []).filter(
    (r) => r.week === nextFixture.week && r.home !== career.player.club && r.away !== career.player.club,
  );
  if (restOfWeek.length) next.media = generateForLeagueWeek({ ...next, media: next.media }, restOfWeek);
  if (potmAwarded) {
    const place = potmAwarded.isYou ? "won it"
      : potmAwarded.yourPlace ? `${potmAwarded.yourPlace}${["st", "nd", "rd"][potmAwarded.yourPlace - 1] ?? "th"} on the shortlist`
      : "not shortlisted";
    next.media = generateForCareer(
      { ...next, media: next.media },
      {
        kind: "award",
        won: potmAwarded.isYou,
        award: `${potmAwarded.monthName} Player of the Month`,
        detail: potmAwarded.isYou
          ? `${potmAwarded.goals} goals and ${potmAwarded.assists} assists in ${potmAwarded.monthName}.`
          : `${potmAwarded.winner} of ${potmAwarded.club} takes it — ${potmAwarded.goals} goals. You were ${place}.`,
      },
      `potm-${potmAwarded.season}-${potmAwarded.month}`,
    );
  }
  const collapsed = formHasCollapsed(next) ? dropToYouth(next) : next;
  return at(g, "post-match", { career: collapsed, lastMatchStats: stats, playedFixture: nextFixture });
}

/** handleWatchFromStands. */
export function watchFromStands(g: Game): Game {
  const nextFixture = nextFixtureFor(g.career);
  if (!nextFixture) return g;
  const { career: next } = simulateMissedFixture(g.career, nextFixture);
  if (nextFixture.watch) {
    const watched = next.fixtures.find((f) => f.intlId === nextFixture.intlId && f.played) ?? null;
    return at(g, "intl-watched", { career: next, watchedFixture: watched });
  }
  return settle(at(g, "dashboard", { career: next }));
}

/** handleYouthWeek. */
export function youthWeek(g: Game): Game {
  const career = g.career;
  if (career.placement?.kind !== "youth") return g;
  const nextFixture = nextFixtureFor(career);
  if (!nextFixture && career.fixtures.length > 0) return at(g, "dashboard");
  let base = career;
  if (nextFixture) base = simulateMissedFixture(career, nextFixture).career;
  else base = { ...career, week: career.week + 1, ...startNewWeek() };
  const match = playYouthMatch(base, mulberry32(base.season * 10007 + base.week * 131 + 4409));
  return settle(at(g, "youth", { career: applyYouthWeek(base, match) }));
}

/** handleYouthPromotion. */
export function youthPromotion(g: Game): Game {
  if (!readyForPromotion(g.career)) return g;
  return settle(at(g, "dashboard", { career: promoteFromYouth(g.career) }));
}

/** handlePostMatchContinue (a simmed match always goes straight on). */
export function postMatchContinue(g: Game): Game {
  return continueAfterMatch(g, g.career, false);
}

/** continueAfterMatch. */
export function continueAfterMatch(g: Game, from: CareerState, skipDraw: boolean): Game {
  const playedFixture = g.playedFixture ?? null;
  if (from.lastTransferWindowKey && from.lastTransferWindowKey !== from.deadlineDayShownFor) {
    return at(g, "deadline-day", { career: from });
  }
  const ko = playedFixture ? knockoutRoundupFor(from, playedFixture) : null;
  if (ko && !g.koShown.includes(ko.key)) {
    return at(g, "knockout-roundup", { career: from, pendingKo: ko, koShown: [...g.koShown, ko.key] });
  }
  if (playedFixture?.kind === "international" && playedFixture.round
    && from.tournament?.season === from.season && playedFixture.competition === from.tournament.competition) {
    const key = `tourn:${from.season}:${playedFixture.week}`;
    if (!g.koShown.includes(key)) return at(g, "intl-tournament-table", { career: from, koShown: [...g.koShown, key] });
  }
  if (!skipDraw && playedFixture) {
    const cupCompetition = playedFixture.competition === "FA Cup" || playedFixture.competition === "League Cup"
      || playedFixture.competition === "Lower League Trophy"
      ? playedFixture.competition : null;
    if (cupCompetition) {
      const state = from.cupState?.find((s) => s.competition === cupCompetition);
      const round = state ? currentRound(state) : null;
      const freshlyDrawn = round && round.ties.length >= 2 && round.ties.every((t) => t.hs === undefined && !t.legs?.length);
      const youreIn = !!round && round.ties.some((t) => t.home === from.player.club || t.away === from.player.club);
      const r16 = state ? lastSixteenIndex(state) : -1;
      const shownInBracket = !!state && state.rounds.length - 1 > r16;
      if (freshlyDrawn && round && youreIn && !shownInBracket) {
        return at(g, "draw", { career: from, pendingDraw: { competition: cupCompetition, round } });
      }
    }
    const isEuroKnockout = playedFixture.kind === "europe"
      && (playedFixture.competition === "Champions League" || playedFixture.competition === "Europa League");
    if (isEuroKnockout && from.euroState && !from.euroState.bracket) {
      const tie = currentTie(from.euroState);
      const freshlyDrawn = tie && tie.legs.every((l) => l.us === undefined);
      if (freshlyDrawn && tie) {
        return at(g, "draw", {
          career: from,
          pendingDraw: { competition: from.euroState.competition, round: { name: tie.round, ties: [{ home: from.player.club, away: tie.opponent }] } as CupRound },
        });
      }
    }
  }
  if (from.playOffState) {
    const upcoming = nextFixtureFor(from);
    const runOver = !!from.playOffState.yourRunOver && playedFixture?.kind === "playoff";
    const key = upcoming?.kind === "playoff" ? `${from.season}:${upcoming.round}:${upcoming.week}`
      : runOver ? `${from.season}:end` : null;
    if (key && g.roundupShown !== key) return at(g, "playoff-roundup", { career: from, roundupShown: key });
  }
  const remaining = from.fixtures.filter((f) => !f.played).length;
  if (remaining === 0) return settle(at(g, "dashboard", { career: from }));
  if (periodDue(from) !== null) return at(g, "intl-callup", { career: from });
  const earlyOffer = checkForContractOffer(from);
  if (earlyOffer) {
    return at(g, "contract-renewal", { career: markContractOfferUsed(from, earlyOffer), contractOfferReason: earlyOffer });
  }
  return settle(at(g, "dashboard", { career: from }));
}

/** The Continue on the draw, knockout and play-off round-up screens. */
export function drawContinue(g: Game): Game { return continueAfterMatch({ ...g, pendingDraw: null }, g.career, true); }
export function knockoutContinue(g: Game): Game { return continueAfterMatch({ ...g, pendingKo: null }, g.career, false); }
export function playoffContinue(g: Game): Game { return continueAfterMatch(g, g.career, true); }
export function deadlineDayContinue(g: Game): Game {
  const next = { ...g.career, deadlineDayShownFor: g.career.lastTransferWindowKey };
  return continueAfterMatch({ ...g, career: next }, next, true);
}
export function backToDashboard(g: Game): Game { return settle(at(g, "dashboard", { watchedFixture: null })); }

/** The call-up screen (CallUpScreen) and its Continue. */
export function callUp(g: Game) { const due = periodDue(g.career); return due === null ? null : decide(g.career, due); }
export function callUpContinue(g: Game): Game {
  const due = periodDue(g.career);
  if (due === null) return settle(at(g, "dashboard"));
  const decision = decide(g.career, due);
  let next = applyDecision(g.career, decision);
  const rec = next.international ?? { decided: [], callUps: 0, snubs: 0, matches: [] };
  next = { ...next, international: { ...rec, callUps: rec.callUps + (decision.called ? 1 : 0), snubs: rec.snubs + (decision.called ? 0 : 1) } };
  if (decision.called) {
    next = { ...next, media: generateForCallUp(next, decision.nation, next.international?.callUps ?? 1, decision.period.label, `callup-${decision.period.key}`) };
  }
  return settle(at(g, "dashboard", { career: next }));
}

/** ContractRenewal: is the club willing, and the offer after `wins` right guesses (and a slip if `locked`). */
export function renewalOffer(g: Game, wins: number, locked: boolean, rounds: number): CareerState["contract"] {
  const career = g.career;
  const offeredWage = renewalWage(career.contract.wage, wins, locked);
  const factor = career.contract.wage > 0 ? offeredWage / career.contract.wage : renewalMultiplier(wins, locked);
  const currentOffer = (base: number) => Math.round(base * factor);
  return {
    club: career.contract.club,
    wage: offeredWage,
    goalBonus: currentOffer(career.contract.goalBonus),
    assistBonus: currentOffer(career.contract.assistBonus),
    seasonsRemaining: 3,
    ...offerClauses(career, offeredWage, mulberry32(career.season * 71 + wins * 13 + rounds)),
  };
}

/** handleContractComplete (null: no new deal). */
export function contractComplete(g: Game, newContract: CareerState["contract"] | null): Game {
  let career = g.career;
  if (newContract) {
    career = { ...career, contract: newContract };
    career.media = generateForCareer(career, {
      kind: "contract", club: newContract.club, wage: newContract.wage, seasonsRemaining: newContract.seasonsRemaining,
    } as never, `contract-s${g.career.season}`);
  }
  return settle(at(g, "dashboard", { career, contractOfferReason: null }));
}

/** handleSeasonEnd → endSeason (the season reel is Leo's update only; off here). */
export function endSeason(g: Game): Game {
  const { career: awarded } = awardLeagueTrophyIfWon(g.career);
  const next = { ...awarded, lastSeasonAwardStats: computeSeasonAwardStats(awarded) };
  return at(g, "ballon-dor", { career: next });
}

/** The Ballon d'Or night's shortlist (BallonDorNight / BallonDor.tsx). */
export function ballonDor(g: Game): BallonDorResult { return computeBallonDorShortlist(g.career); }

/** handleBallonDorContinue (`userWon`: you ranked first). */
export function ballonDorContinue(g: Game): Game {
  const userWon = computeBallonDorShortlist(g.career).playerRank === 1;
  const h = { ...g, wonBallonDor: userWon };
  const check = retirementCheck(g.career);
  if (check.mustRetire) return at(h, "retirement");
  if (check.finalSeasonNext) return at(h, "final-season");
  return openTransferWindowOrRoll(h, g.career, userWon);
}

/** handlePlayOn (after the final-season notice). */
export function playOn(g: Game): Game { return openTransferWindowOrRoll(g, g.career, !!g.wonBallonDor); }

/** The clubs interested in you this summer (TransferHub). */
export function transferInterest(g: Game): WindowInterest {
  return withRecall(windowInterest(g.career, "summer", { step3Promoted: leoUpdateOn("bugFixes") }), loanRecallOffer(g.career), g.career);
}

/** openTransferWindowOrRoll. */
export function openTransferWindowOrRoll(g: Game, from: CareerState, userWon: boolean): Game {
  if (isRegionalDivision(divisionOf(from)) && sortLeague(from.league).slice(-4).some((t) => t.name === from.player.club)) {
    const forced = generateRelegationOffers(from, mulberry32(from.season * 8831 + from.fame));
    if (forced.length > 0) {
      const agreed = requestOf(from).agreed;
      return at(g, "relegation-move", { transferOffers: agreed ? [agreed, ...forced.filter((o) => o.club !== agreed.club)] : forced });
    }
  }
  const interest = withRecall(windowInterest(from, "summer", { step3Promoted: leoUpdateOn("bugFixes") }), loanRecallOffer(from), from);
  if (interest.leagues.length > 0) return at(g, "season-transfer");
  return rollOverSeason(g, from, userWon);
}

/** handleTransferNegotiate. */
export function transferNegotiate(g: Game, offer: TransferOffer): Game { return at(g, "transfer-request-talk", { talkOffer: offer }); }

/** NegotiationScreen's onDone in the window: a weekly wage agreed, or null (walked away). */
export function transferTalkDone(g: Game, finalWeekly: number | null): Game {
  const talkOffer = g.talkOffer;
  if (!talkOffer) return g;
  const talkDivision = talkOffer.division ?? divisionOf(g.career);
  const weekly = finalWeekly === null ? null : Math.max(wageFloorFor(talkOffer.club, talkDivision), Math.round(finalWeekly));
  if (weekly === null) return at(g, "season-transfer", { talkOffer: null, career: markWalkedAway(g.career, "summer", talkOffer.club) });
  return at(g, "transfer-signing", { talkOffer: null, pendingSignOffer: { offer: withAgreedWage(talkOffer, weekly), wasRelegationMove: false } });
}

/** handleChooseTransfer (a forced move's offer). */
export function chooseTransfer(g: Game, offer: TransferOffer): Game {
  return at(g, "transfer-signing", { pendingSignOffer: { offer, wasRelegationMove: g.phase === "relegation-move" } });
}

/** handleSigningDone. */
export function signingDone(g: Game): Game {
  const career = g.career;
  if (!g.pendingSignOffer) return g;
  const { offer, wasRelegationMove } = g.pendingSignOffer;
  const moved = clearAfterWindow(acceptOffer(career, offer));
  const crossDivision = !!offer.division && offer.division !== divisionOf(career);
  moved.media = generateForCareer(moved, { kind: "transfer", from: career.player.club, to: offer.club, fee: offer.transferFee ?? offer.signingFee }, "transfer");
  return rollOverSeason({ ...g, transferOffers: [], pendingSignOffer: null }, moved, !!g.wonBallonDor, wasRelegationMove || crossDivision, true);
}

/** handleStayPut. */
export function stayPut(g: Game): Game {
  return rollOverSeason({ ...g, transferOffers: [] }, clearAfterWindow(g.career), !!g.wonBallonDor);
}

/** rollOverSeason. */
export function rollOverSeason(g: Game, from: CareerState, userWon: boolean, forcedRelegationMove = false, justTransferred = false): Game {
  const { career: rolled } = advanceSeason(from, userWon, justTransferred, { noSackAfterPromotion: leoUpdateOn("bugFixes") });
  const next = endLoan(rolled);
  next.lastSeasonRecords = from.seasonRecords ?? [];
  next.seasonRecords = [];
  if (forcedRelegationMove && next.ladderNews) next.ladderNews = { ...next.ladderNews, yourMove: null };
  if (userWon) next.media = generateForCareer(next, { kind: "ballon-dor", won: true, total: next.ballonDorWins }, "bdor");
  const honours = (next.awards ?? []).filter((a) => a.season === from.season);
  for (const a of honours) {
    next.media = generateForCareer({ ...next, media: next.media }, { kind: "award", won: true, award: a.kind, detail: a.detail }, `award-${a.kind}`);
  }
  if (next.managerNews && next.manager) {
    next.media = generateForCareer({ ...next, media: next.media },
      { kind: "manager-out", name: from.manager?.name ?? "The manager", incoming: next.manager.name, reason: next.managerNews }, "gaffer");
  }
  if (next.lastSeasonJudgement) {
    next.media = generateForCareer({ ...next, media: next.media },
      { kind: "season-end", position: leaguePosition(from), headline: next.lastSeasonJudgement.headline, detail: next.lastSeasonJudgement.detail }, "review");
  }
  next.media = generateForRollover({ ...next, media: next.media });
  if (next.lastSeasonAwardStats) return at(g, "season-awards", { career: next });
  return continueAfterRollover({ ...g, career: next }, next);
}

/** continueAfterRollover / handleSeasonAwardsContinue. */
export function continueAfterRollover(g: Game, next: CareerState): Game {
  if (next.ladderNews && next.contract.seasonsRemaining > 0) return at(g, "ladder", { career: next });
  if (next.contract.seasonsRemaining <= 0) return at(g, "contract-renewal", { career: next });
  return settle(at(g, "dashboard", { career: next }));
}
export function seasonAwardsContinue(g: Game): Game { return continueAfterRollover(g, g.career); }
export function ladderContinue(g: Game): Game { return settle(at(g, "dashboard")); }

/** handleRetire (the farewell match is stage 2; turned down here). */
export function retireNow(g: Game): Game {
  const done = retire(g.career, !!g.wonBallonDor);
  done.media = generateForCareer(done, {
    kind: "retirement", goals: done.careerStats.goals, apps: done.careerStats.appearances, trophies: done.trophies.length,
  }, "retire");
  return at(g, "legacy", { career: done });
}

/** What the screens show, in plain data (no functions): the table, the fixtures. */
export function leagueTable(g: Game) { return sortLeague(g.career.league); }
