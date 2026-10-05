"use client";
import { useUiLook, useUiVersionOrNull } from "@/lib/star/uiLook";
import LegacyStarDevPage from "@/components/star/legacy/LegacyStarDevPage";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/pitchLook.css";
import "@/components/star/ui/flat.css";
import { freshItem, isWornOut } from "@/lib/star/fame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem, Horse, Fixture, GoalReplay } from "@/lib/star/types";
import { careerPenaltyRunup, careerFreeKickRunup, type PenaltyRunupId, type FreeKickRunupId } from "@/lib/star/runupStyles";
import { canPlaceCompetitionBet, type CompetitionBet } from "@/lib/star/competitionBetting";
import { addRecentGoal, saveReplayToSlot, deleteSavedReplay } from "@/lib/star/goalReplays";
import {
  saveCareer, clearCareer, saveStarPhase, loadStarPhase, saveCareerToCloud,
  clearCareerFromCloud, ANON_SCOPE, slotScope, listSaveSlots, loadActiveSlot, saveActiveSlot,
  reconcileCareerLoad, resolveSaveClash, deferSaveClash, hasUnsyncedProgress, type SaveClash,
} from "@/lib/star/storage";
import SaveClashPrompt from "@/components/star/SaveClashPrompt";
import { createClient } from "@/lib/supabase/client";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { mulberry32, sortLeague } from "@/lib/star/season";
import { trialComplete, startTrial, trialScore, noteReload } from "@/lib/star/trial";
import { trialOffers, clubsForDivision, SOURED_OFFER_SHARE, SOURED_PITCH, type ScoutOffer } from "@/lib/star/scoutOffers";
import { scoutedOfferForTrial } from "@/lib/star/scoutedPlacement";
import ScoutOffers from "@/components/star/ScoutOffers";
// ── The youth team, the reserves and the loan wildcard (lib/star/youth.ts) ──
// Added as new phases beside the existing ones; nothing in the phase machine
// below was reshaped for them.
import {
  youthTakerFor, youthWage, startYouthSpell, startLoanSpell, rollLoanWildcard,
  playYouthMatch, applyYouthWeek, readyForPromotion, promoteFromYouth,
  formHasCollapsed, dropToYouth, loanRecallOffer, endLoan,
} from "@/lib/star/youth";
import { managerTalkFor, agreedWeeklyWage, weeklyToSeason } from "@/lib/star/signingTalk";
import { goalBonusFor, assistBonusFor } from "@/lib/star/economy";
import NegotiationScreen from "@/components/star/NegotiationScreen";
import ManagerTalk from "@/components/star/ManagerTalk";
import YouthTeam from "@/components/star/YouthTeam";
import LoanBrief from "@/components/star/LoanBrief";
import { makeIdentity, attachClub, makeInitialCareer, hasClub, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed } from "@/lib/star/careerFlow";
import { brandsOf, signOffer, declineOffer, askLonger, askEasier, counterPoach, walkAway, settleNegotiation, brandScandal } from "@/lib/star/sponsorDeals";
import SponsorsScreen from "@/components/star/SponsorsScreen";
import { renameHorse } from "@/lib/star/horse";
import { getPostMatchReactionsEnabled } from "@/lib/star/postMatchPrefs";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { devInfoOn } from "@/lib/star/matchDayPrefs";
import { simulateOwnMatch } from "@/lib/star/simMatch";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { currentRound } from "@/lib/star/cups";
import { currentTie } from "@/lib/star/euro";
import { fixtureDateLabel, divisionOf, isRegionalDivision, type CareerDivision } from "@/lib/star/calendar";
import { generateRelegationOffers } from "@/lib/star/relegationOffers";
import { loadLineup, saveLineup, fetchSharedLineups, type SavedLineup } from "@/lib/star/lineupStore";
import { refreshXpConfig } from "@/lib/star/xpStore";
import { DEFAULT_FORMATION, type Role } from "@/lib/star/formations";
import { spendAction, rest, canAct, projectedEnergy, startNewWeek, trainingLeft, spendTrainingSession } from "@/lib/star/week";
import { generateOffers, acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { type PressQuestion, type PressOption } from "@/lib/star/media";
import type { MonthAward } from "@/lib/star/potm";
import { generateForMatch, generateForCareer, generateForLeagueWeek, generateForBoardroomSale, hasFreshMedia, toggleLike } from "@/lib/star/media/feed";
import { skipTo, type SkipTarget } from "@/lib/star/devSkip";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";
import { fetchRealSquad, shouldUpgradeSquad, mergeSquadStats, refreshSquadPhotos } from "@/lib/star/realSquad";
import { fetchLeagueSquads, mergeLeagueSquadStats, shouldUpgradeLeagueSquads, syncLeagueStrengthFromSquads, fetchFreeAgents, reconcileExternalSquads, isRealFetch, refreshLeagueSquadPhotos } from "@/lib/star/leagueSquads";
import { hydrateSquads } from "@/lib/star/squadSaveCodec";
import { externalClubsFor } from "@/lib/star/clubs";
import { conditionsFor } from "@/lib/star/weather";
import PressConference from "@/components/star/PressConference";
import TransferWindow from "@/components/star/TransferWindow";
import RelegationMove from "@/components/star/RelegationMove";
import TransferSigning from "@/components/star/TransferSigning";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import { earnedBetween, type EarnPop } from "@/lib/star/earnPops";
// The unlock chain a new career walks (Harry, 1 Oct 2026, P13-P40).
import { isOpen, hasSeen, markSeen, recordDrill, drillMessageDue, recordLeagueVisit, recordFirstMatch, recordBossMeeting, recordPhoneBought, installApp, appInstalled, LOCK_HINT, pendingAnnouncements, markAnnounced, nextStep, slotQuestionDue, setBottomLeft, bottomLeft, gameFirst, managerTalkDue, phoneShortfall, phoneStepLine, DRILLS_TO_OPEN_SHOP } from "@/lib/star/unlocks";
import { applyGameGain } from "@/lib/star/relationshipGame";
import { AchievementPop, UnlockChallenges, LockedPage, UnlockPop, AchievementToasts, SlotQuestion, type StepGo } from "@/components/star/UnlockChain";
import { DrillIntroOff, DrillTutorial, DrillHelpButton } from "@/components/star/TrainingIntro";
import { ACHIEVEMENTS } from "@/lib/star/achievements";
import EnergyBackToast from "@/components/star/EnergyBackToast";
import PointerTour from "@/components/star/PointerTour";
import BreakingNews from "@/components/star/BreakingNews";
import ManagerChat from "@/components/star/ManagerChat";
import { signingNews, newsForMatch, type BreakingNews as News } from "@/lib/star/breakingNews";
import { setPieceTalkDue, markSetPieceTold } from "@/lib/star/setPieceTalk";
import { welcomeTour, LEAGUE_TOUR, LEAGUE_SCREEN_TOUR, FIRST_GAME_TOUR, shopTour, HELP_TOURS, TRAINING_TOUR, LEVEL_TOUR, ONE_MORE_DRILL_TOUR, bossTour, BOSS_MEETING_TOUR, relationsTour, PHONE_TOUR, REACTIONS_TOUR, stepTour, type HelpScreen, type TourStep } from "@/lib/star/tours";
import { computeStarRating, growthMultiplier } from "@/lib/star/rating";
import { sfx } from "@/lib/star/sfx";
import { getTuning } from "@/lib/star/tuningStore";
import ProfileSetup from "@/components/star/ProfileSetup";
import TrialSequence from "@/components/star/TrialSequence";
import FreeAgentShell from "@/components/star/FreeAgentShell";
import TrialReward from "@/components/star/TrialReward";
import { starsNow, starStatus, matchStarPoints, withStars, starGain, starTitle } from "@/lib/star/starPoints";
import { clubTheme } from "@/components/star/ui";
import { POSITION_NAMES } from "@/lib/star/teamsheet";
import DashboardShell, { type NavTab } from "@/components/star/DashboardShell";
import DashboardStats from "@/components/star/DashboardStats";
// Swipe home screens — Stats · Home · Training (v0.15 item 34).
import SwipePages from "@/components/star/SwipePages";
import HomeHub from "@/components/star/HomeHub";
import TopHud, { type HudScreen } from "@/components/star/ui/TopHud";
import GameBar from "@/components/star/ui/GameBar";
import { PHONE_SEEN_EVENT, phoneUnreadCount } from "@/lib/star/phoneUnread";
import StatsTabs from "@/components/star/StatsTabs";
import ShopPage from "@/components/star/ShopPage";
import PhoneHome from "@/components/star/PhoneHome";
import RelationsPage from "@/components/star/RelationsPage";
import LadderScreen from "@/components/star/LadderScreen";
import SeasonAwardsScreen from "@/components/star/SeasonAwardsScreen";
import LifeScreen from "@/components/star/LifeScreen";
import PotmWinModal from "@/components/star/PotmWinModal";
import LineupIntro from "@/components/star/LineupIntro";
import PitchScope from "@/components/star/ui/PitchScope";
import MatchWeek from "@/components/star/MatchWeek";
import SkillsScreen, { TRAINING_ENERGY_COST } from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import TrainingLevelSelect from "@/components/star/TrainingLevelSelect";
import { applyLevelResult, starsOf } from "@/lib/star/trainingLevels";
import CanvasMatch from "@/components/star/CanvasMatch";
import { pressureForDivision } from "@/lib/star/pressure";
import PostMatch, { achievementToastDelay } from "@/components/star/PostMatch";
import CupDrawReveal, { type DrawRound } from "@/components/star/CupDrawReveal";
import DeadlineDayRoundup from "@/components/star/DeadlineDayRoundup";
import SettingsScreen from "@/components/star/SettingsScreen";
import GlobalSettingsScreen from "@/components/star/GlobalSettingsScreen";
import { askConfirm } from "@/lib/star/askConfirm";
import TitleScreen, { titleScreenSkipped } from "@/components/star/TitleScreen";
import FaceEditorScreen from "@/components/star/FaceEditorScreen";
import FakeFaceEditorScreen from "@/components/star/FakeFaceEditorScreen";
import MediaFeed from "@/components/star/MediaFeed";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import Shop3D from "@/components/star/Shop3D";
import CareerStore from "@/components/star/store/CareerStore";
import { addCoins } from "@/lib/star/store/career";
import { LIFESTYLE_ALL_LEVELS, KIB_CANS, kibCanPrice, kibCanEffectLabel, type KibCan } from "@/lib/star/shopData";

/** The dashboard KIB Cans card's own accent per tier — the same colour as
 *  the can's real photo (see shopData.ts's `color`), as a hex value rather
 *  than a Tailwind class so it can drive an inline border/background wash
 *  too, not just a token. */
const KIB_ACCENT: Record<KibCan["id"], { hex: string }> = {
  basic: { hex: "#fb923c" },
  premium: { hex: "#60a5fa" },
  elite: { hex: "#c084fc" },
};

import Casino from "@/components/star/Casino";
import Investments from "@/components/star/Investments";
import OwnershipScreen from "@/components/star/OwnershipScreen";
import {
  buyStake, sellStake, topUpClubBudget, signPlayerForOwnedClub, sellPlayerFromOwnedClub, replaceManagerForOwnedClub,
  proposeSellPlayerVote, resolveSellPlayerVote, canOverruleClubVote, findSquadEntry, type SellPlayerVoteProposal,
  recordFailedManagerNegotiation,
} from "@/lib/star/investments";
import { OVERRULE_REPUTATION_COST } from "@/lib/star/voting";
import VoteCeremony from "@/components/star/VoteCeremony";
import {
  setClubFormation, setClubKit, proposeKitVote, resolveKitVote, type ClubKit, type KitVoteProposal,
  proposePresidentVote, resolvePresidentVote, setPresidentWage, type PresidentVoteProposal,
  submitRecommendation, type RecommendationKind,
  haveASon, ageUpSonWithPotion, promoteSonToFirstTeam, transferSon,
  mergeClubs, setOwnedLineup,
  appointSelfCaptain, setTalisman, transferSelfTo,
} from "@/lib/star/clubPowers";
import { investInfluence, type GoverningBody } from "@/lib/star/governingBodies";
import { proposeRuleChangeVote, resolveRuleChangeVote, canOverruleRuleVote, type RuleChangeProposal, type RuleBook } from "@/lib/star/ruleBook";
import RuleBookScreen from "@/components/star/RuleBookScreen";
import { bribeVote, rollCaught, applyGettingCaught, blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { forceClubIntoPremierLeague } from "@/lib/star/forcedMovement";
import {
  proposeBodyPresidencyVote, resolveBodyPresidencyVote, canOverrulePresidencyVote,
  canStandForBodyPresidency, isBodyPresident, type PresidencyVoteProposal,
} from "@/lib/star/leadership";
import { createCompetition, playCompetitionToWinner, type NewCompetitionState } from "@/lib/star/newCompetition";
import { allInvestableClubs } from "@/lib/star/investments";
import { facilitiesFor, renameStadium, upgradeStadiumCapacity, upgradeTrainingGround, upgradeYouthAcademy } from "@/lib/star/facilities";
import DilemmaModal from "@/components/star/DilemmaModal";
import { AchievementsScreen, TrophiesScreen, ReputationScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import Garden3D from "@/components/star/Garden3D";
import type { RelationshipKind } from "@/components/star/RelationshipMinigame";
import RelationshipGame, { type GameResult } from "@/components/star/relgames/RelationshipGame";
import AdvertShoot from "@/components/star/relgames/AdvertShoot";
import { gamePlayedThisWeek } from "@/lib/star/relationships";
import { changeDealHappiness } from "@/lib/star/sponsorDeals";
import { useImmersiveMode } from "@/components/star/ImmersiveToggle";
import { setActiveFoot } from "@/lib/star/kickFoot";

/**
 * THE CLUBS THAT CAME IN, from the trial's own seed and final score.
 *
 * Lifted out of the scout-offers block so the manager conversation that now
 * comes BEFORE that screen can read exactly the same list — the two must
 * never disagree about who is interested. Regenerated rather than stored,
 * exactly as it was before: neither the seed nor the score can move once the
 * trial is over, so this is the same clubs every time it is called, and
 * storing them would be equivalent while re-rolling them would make this the
 * most farmable screen in the game.
 */
function offersForTrial(career: CareerState): ScoutOffer[] {
  if (!career.trial) return [];
  // The first trial no longer scores you onto a ladder: a scout has spotted
  // you, and you start at one club in the National League, North or South —
  // likelier the National League if you scored the shootout's final penalty
  // (Harry, 1 Oct 2026, P36/P63; lib/star/scoutedPlacement.ts). One offer,
  // seeded off the trial, so a reload lands at the same club. A free agent's
  // second look (trialsTaken > 1) still reads the old score ladder below.
  if ((career.trialsTaken ?? 1) <= 1) return [scoutedOfferForTrial(career.trial)];
  // A second look: at least one club, usually two (trialOffers, scoutOffers.ts —
  // Mikey: a trial no longer ends in the youth team or the free-agent life).
  return trialOffers(
    trialScore(career.trial),
    mulberry32(career.trial.seed ^ 0x5c0a7),
    // A second look is judged against a lower bar and a ladder shifted a
    // rung down — see ScoutContext (scoutOffers.ts) and `grantTrial`
    // (freeAgent.ts). `trialsTaken` is absent on a career that has only ever
    // had the trial it opened with, which reads as 1.
    { retrial: (career.trialsTaken ?? 1) > 1 },
  );
}

/**
 * Which club's manager sits you down.
 *
 * The man who watched you play. If the club you took the trial AT came in
 * for you, it is literally him — you were on his pitch. Otherwise it is
 * whoever made the strongest offer, whose scouts were there all afternoon.
 */
function talkingClubFor(career: CareerState, offers: ScoutOffer[]): ScoutOffer | null {
  if (!offers.length) return null;
  return offers.find(o => o.club === career.player.club) ?? offers[0];
}

/**
 * Where a finished trial goes.
 *
 * The manager's verdict first, whenever somebody actually came in and the
 * money has not already been settled; the newspaper otherwise. Written as
 * one function because three separate places route out of a finished trial
 * (the sequencer finishing, a reload landing on a finished trial, and the
 * talk itself falling through with nobody left to talk to) and they must
 * agree with each other.
 */
function afterTrialPhase(career: CareerState): StarPhase {
  if (career.agreedTerms) return "scout-offers";
  return offersForTrial(career).length ? "manager-talk" : "scout-offers";
}

/**
 * Which shell a career with NO CLUB belongs on, after a reload or on the way
 * back out of Settings.
 *
 * This used to be a straight "mid-trial or free agent". There are now two
 * real states in between those: the manager's verdict and the wage
 * negotiation, both of which happen while nobody has signed you yet.
 * Neither is in `RESUMABLE` (storage.ts), so a reload lands here — and
 * landing a player who was mid-conversation in the free-agent garden would
 * silently throw away every offer he had just earned. Both screens rebuild
 * themselves from the trial's own seed, so returning to them is exact
 * rather than a re-roll.
 */
function clublessPhaseFor(career: CareerState): StarPhase {
  if (career.trial && !trialComplete(career.trial)) return "trial-stages";
  if (!career.trial) return "free-agent";
  if (career.agreedTerms) return "scout-offers";
  return offersForTrial(career).length ? "manager-talk" : "free-agent";
}

/**
 * The offers as the newspaper should print them — with the wage you actually
 * shook hands on written over the one that club opened with.
 *
 * A wage of 0 is how a WALKOUT is recorded. Pushing a manager who has
 * already had enough is a real way to lose a contract, and the honest way to
 * show that is the club simply not being on the page any more.
 */
function offersWithAgreedTerms(career: CareerState, offers: ScoutOffer[]): ScoutOffer[] {
  const agreed = career.agreedTerms;
  if (!agreed) return offers;
  // A walkout from a save made before the club stopped walking away: that
  // club is off the paper. Never removes the last club — a trial always ends
  // with one.
  if (agreed.wage <= 0) {
    const rest = offers.filter(o => o.club !== agreed.club);
    return rest.length ? rest : offers;
  }
  return offers.map(o => (o.club === agreed.club
    ? { ...o, wage: agreed.wage, goalBonus: goalBonusFor(agreed.wage), assistBonus: assistBonusFor(agreed.wage), ...(agreed.soured ? { pitch: SOURED_PITCH } : {}) }
    : o));
}

/** The full-screen toggle used to be a fixed floating button, rendered here
 *  above every one of StarDevInner's phase-routed early returns. Reported
 *  directly as blocking the real Settings button on most phone screens —
 *  moved into Settings as a plain on/off switch instead (see
 *  ImmersiveToggle.tsx's own header and SettingsScreen.tsx's "Full Screen"
 *  section). `useImmersiveMode()` is still called once here, at this same
 *  outer level, so the fullscreen state itself survives every phase change
 *  underneath it — only the SWITCH that controls it moved, not the
 *  mechanism, which is why this wrapper still exists at all. */
function NewUiStarDevPage() {
  const immersive = useImmersiveMode();
  // The New UI's look: "pitch" adds one class that turns the career screens
  // green and chalk-lined (lib/star/uiLook.ts, pitchLook.css). Always on here —
  // the Old UI is a different page (see StarDevPage at the bottom).
  const look = useUiLook();
  // No text highlighting while you drag and tap (Mikey, 28 Sep 2026: on PC
  // "the dragging feature does also do the same thing as highlighting
  // words"). Typing in a box still works — inputs keep their own selection.
  return (
    <div className={`select-none [&_input]:select-text [&_textarea]:select-text star-root ${pitchFont.variable} ${look === "pitch" ? "star-look-pitch" : ""}`}>
      <StarDevInner immersive={immersive} />
    </div>
  );
}

function StarDevInner({ immersive }: { immersive: ReturnType<typeof useImmersiveMode> }) {
  const [career, setCareer] = useState<CareerState | null>(null);
  // v0.25 item 4: the foot you kick with, for the trial and training (they
  // mount the engine without the save). Looks only — lib/star/kickFoot.ts.
  const careerFoot = career?.player.preferredFoot;
  useEffect(() => { setActiveFoot(careerFoot); }, [careerFoot]);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<NavTab | null>(null);
  const [trainingTab, setTrainingTab] = useState<"training" | "life">("training");
  /** Swipe home screens: Stats (0) or Home (1); Training is the "skills"
   *  phase, see SwipePages below. */
  const [homePage, setHomePage] = useState<0 | 1 | 2>(1);
  /** The 3D shop's "See it in the shop": which shop to open, on which item.
   *  Forgotten as soon as you leave that shop. */
  const [shopFocus, setShopFocus] = useState<{ phase: StarPhase; id: string; level: number } | null>(null);
  // The 3D garden and 3D shop are joined by doors (Mikey, 3 Oct 2026): which
  // door you came through decides where you appear.
  const [gardenArrive, setGardenArrive] = useState<"shop" | "gate">("gate");
  const [shopAtDoor, setShopAtDoor] = useState(false);
  useEffect(() => { if (shopFocus && phase !== shopFocus.phase) setShopFocus(null); }, [phase, shopFocus]);
  const [trainingSkill, setTrainingSkill] = useState<keyof Skills | null>(null);
  /** Which of the 30 levels is being played; null while picking one. */
  const [trainingLevel, setTrainingLevel] = useState<number | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);
  /** Your star rating before and after the last match — the bar on a simmed result (item 36). */
  // The achievements the last match unlocked — the post-match shows them one at a time.
  const [lastMatchAch, setLastMatchAch] = useState<string[]>([]);
  const [lastStarChange, setLastStarChange] = useState<{ from: number; to: number } | null>(null);
  // True when the match just played was the boots' last (Harry, 5 Oct 2026:
  // "fix the boots warning" — they wore out with no warning seen).
  const [bootsJustWoreOut, setBootsJustWoreOut] = useState(false);
  const [lastMatchStar, setLastMatchStar] = useState<{ sp: number; base: number; mult: number; toNext: number; gate?: string; total?: number; extra?: { label: string; sp: number; n?: number }[]; held?: number; carried?: number; fromNext?: number } | null>(null);
  /** A whole new star: the full-screen moment. */
  const [newStar, setNewStar] = useState<number | null>(null);
  const prevCareerRef = useRef<CareerState | null>(null);
  const lastMatchAchRef = useRef<string[]>([]);
  lastMatchAchRef.current = lastMatchAch;
  // Whatever the career just earned pops up by itself — an achievement from
  // anywhere, a record broken in a match. A match's own achievements already
  // show on the post-match screen, so they are not shown twice.
  useEffect(() => {
    const prev = prevCareerRef.current;
    prevCareerRef.current = career;
    if (!prev || !career || prev === career) return;
    const fresh = earnedBetween(prev, career).filter(e => !(e.kind === "achievement" && lastMatchAchRef.current.includes(e.id.slice(4))));
    if (fresh.length) setEarnPops(q => [...q, ...fresh.filter(f => !q.some(x => x.id === f.id))]);
  }, [career]);
  // Unlock chain: the achievement pop-up waiting to show (UnlockChain.tsx).
  // `stay`: no "See all achievements" — the player stays on this screen (v0.25.1).
  const [chainPop, setChainPop] = useState<{ label: string; unlocked: string; phone?: boolean; stay?: boolean } | null>(null);
  // A "?" replay of the pointers for the screen you are on (never forced).
  const [helpTour, setHelpTour] = useState<TourStep[] | null>(null);
  // ── v0.24 first steps (lib/star/unlocks.ts, lib/star/tours.ts) ──
  // The match's achievements, popped up over the post-match screen with no
  // Next button (P2-84).
  const [matchToasts, setMatchToasts] = useState<{ label: string; description: string }[]>([]);
  // "+N energy back" on Home after a match (P2-82).
  const [energyBack, setEnergyBack] = useState<number | null>(null);
  // A drill's tutorial is open (the first time, or from its "?"), and the
  // drill it was dismissed on (so it does not open again on that drill).
  const [drillHelp, setDrillHelp] = useState(false);
  const [drillAutoDone, setDrillAutoDone] = useState<string | null>(null);
  const [drillRun, setDrillRun] = useState(0);
  // A locked button's line, as a toast (Sponsors before it opens).
  const [lockNote, setLockNote] = useState<string | null>(null);
  const showLock = useCallback((msg: string) => {
    setLockNote(msg);
    setTimeout(() => setLockNote((n) => (n === msg ? null : n)), 2600);
  }, []);
  // "See all achievements" on any achievement pop-up (v0.24, P2-67).
  const seeAllAchievements = useCallback(() => {
    setChainPop(null);
    setEarnPops([]);
    setPhase("achievements");
  }, []);
  // v0.25 (point 37): energy is explained on the first Home visit (the welcome
  // tour), not at the first full time. The full time shows the numbers only.
  // Breaking-news pop-ups waiting for the dashboard (lib/star/breakingNews.ts).
  const [newsQueue, setNewsQueue] = useState<News[]>([]);
  const pushNews = useCallback((...n: News[]) => { if (n.length) setNewsQueue(q => [...q, ...n]); }, []);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [contractOfferReason, setContractOfferReason] = useState<"form" | "star" | null>(null);
  /** Set right before jumping to "investments" from the Ownership hub, so a
   *  club card can open straight into that club's boardroom instead of
   *  making the player re-navigate through tabs they just came from. Reset
   *  once read so re-opening Invest from its own home button still starts
   *  on Market like it always has. */
  const [investmentsEntry, setInvestmentsEntry] = useState<{ tab: "market" | "portfolio" | "boardroom"; club?: string; section?: "squad" | "sign" | "manager" | "powers" } | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  // Achievements and records earned, waiting to pop up on Home (P36; lib/star/earnPops.ts).
  const [earnPops, setEarnPops] = useState<EarnPop[]>([]);
  /** A star rating that just moved — see toastRatingChange. Cleared the same
   *  flat-timeout way the achievement toast above already is. */
  const [ratingChange, setRatingChange] = useState<{ from: number; to: number } | null>(null);
  const [relationshipGameKind, setRelationshipGameKind] = useState<RelationshipKind | null>(null);
  const [advertDealId, setAdvertDealId] = useState<string | null>(null);
  /** The one vote in flight, of any of the kinds this engine now proposes —
   *  Phase 2's proof-of-concept (selling a player) plus Phase 3's kit and
   *  presidency votes, all sharing the exact same VoteCeremony/resolve
   *  pattern. See handleVoteDone below. */
  const [pendingVote, setPendingVote] = useState<
    | { kind: "sellPlayer"; proposal: SellPlayerVoteProposal }
    | { kind: "kit"; proposal: KitVoteProposal }
    | { kind: "president"; proposal: PresidentVoteProposal }
    | { kind: "ruleChange"; proposal: RuleChangeProposal }
    | { kind: "bodyPresidency"; proposal: PresidencyVoteProposal }
    | null
  >(null);
  const [transferOffers, setTransferOffers] = useState<TransferOffer[]>([]);
  /** The week the loan brief was last read. A loan target shown before
   *  every single fixture would be a toll gate; shown once a week it is a
   *  reminder. See the LoanBrief block further down. */
  const [loanBriefWeek, setLoanBriefWeek] = useState<number | null>(null);
  /** The trial's closing "A scout has spotted you" card is on screen. The last
   *  stage's result is on the career by then (so a closed app loses nothing),
   *  and without this the "finished trial goes straight on" guard below would
   *  skip the card the instant that result was written. */
  const trialEndingRef = useRef(false);
  const [pressQuestion, setPressQuestion] = useState<PressQuestion | null>(null);
  /** Whether they won it is only known at the ceremony, so it is carried here. */
  const [wonBallonDor, setWonBallonDor] = useState(false);
  const clampRel = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // Nothing is written back until the load has run, so the initial
  // "profile-setup" render cannot wipe a pending phase before we have read it.
  const [hydrated, setHydrated] = useState(false);
  // Stays true while we check for a cloud save, so we show a spinner rather
  // than the new-career setup screen during the async fetch.
  const [cloudLoading, setCloudLoading] = useState(true);
  /** This device's copy and the cloud's went different ways — the player
   *  picks one (SaveClashPrompt; the rule is lib/star/saveClash.ts). */
  const [saveClash, setSaveClash] = useState<SaveClash | null>(null);
  /**
   * A career only ever exists tied to an account now — see the "sign in to
   * play" gate below. Reported directly, after the cross-account save
   * contamination bug: a save that can live in an ambiguous, maybe-signed-in
   * local state is a save that can end up attached to the wrong account.
   * Requiring an account before a career can even be created removes that
   * state entirely — there is no longer a signed-out career for local
   * storage and a real account's cloud row to ever disagree about.
   */
  const [signedIn, setSignedIn] = useState(false);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The cloud save the 3 s timer is still holding, if any — see the
   *  flush-on-hide effect below the save effect. */
  const pendingCloudSave = useRef<{ career: CareerState; slot: number } | null>(null);
  /**
   * WHICH ACCOUNT — always the signed-in user's id (see the sign-in gate:
   * nothing past it runs without one). Resolved once, here, before anything
   * else reads or writes a save — see storage.ts's own note on why a save
   * must never be read or written without knowing whose it is. Signing in
   * or out always does a full page navigation in this app (OAuth redirect /
   * a server sign-out route), so this never goes stale mid-session.
   *
   * WHICH SAVE, within that account, is the separate `activeSlot` just
   * below — every actual localStorage/cloud key is built from both
   * together via storage.ts's slotScope(scopeRef.current, activeSlot).
   */
  const scopeRef = useRef<string>(ANON_SCOPE);
  /**
   * The save currently on screen, 1..MAX_SAVE_SLOTS — see SaveSlotsPanel
   * (Settings) for switching it and lib/star/storage.ts's slotScope for how
   * it turns into an actual key. Kept as both state (so the Settings screen
   * re-renders when it changes) and a ref (so callbacks and effects always
   * read the current value without needing it in their dependency arrays,
   * the same pattern scopeRef already uses) — setActiveSlot below keeps the
   * two in lockstep so nothing has to choose between them.
   */
  const [activeSlot, setActiveSlotState] = useState(1);
  const activeSlotRef = useRef(1);
  const setActiveSlot = useCallback((slot: number) => {
    activeSlotRef.current = slot;
    setActiveSlotState(slot);
    saveActiveSlot(scopeRef.current, slot);
  }, []);
  // A pure "please re-render" counter for the one save-list mutation that
  // doesn't already change career/phase/activeSlot on its own — deleting a
  // save that ISN'T the one on screen. See handleDeleteSave.
  const [, bumpSaves] = useState(0);
  /**
   * THE TITLE SCREEN (TitleScreen.tsx) — shown in front of whatever the
   * load decided, every time the game opens, and again from Settings'
   * "Main menu". Held as its own flag rather than a StarPhase on purpose:
   * the phase is what a refresh resumes (saveStarPhase), and writing
   * "title" into it would wipe a pending Ballon d'Or or contract. Continue
   * just lowers the flag, so the game carries on exactly as today's load
   * left it.
   */
  const [titleOpen, setTitleOpen] = useState(true);
  /** Settings opened FROM the title: its back button returns there, to the
   *  phase the game was on underneath. */
  const [settingsFromTitle, setSettingsFromTitle] = useState<StarPhase | null>(null);
  /** The title screen's own Settings page (v0.25 points 1-2): this device's
   *  settings only, no save, no top bar — Back returns to the title. */
  const [globalSettings, setGlobalSettings] = useState(false);
  useEffect(() => { if (titleScreenSkipped()) setTitleOpen(false); }, []);
  // Left Settings some other way (switched save, a face editor's own exit):
  // its back button goes home again, not to the title.
  useEffect(() => {
    if (settingsFromTitle && phase !== "settings" && phase !== "face-editor" && phase !== "fake-face-editor") setSettingsFromTitle(null);
  }, [phase, settingsFromTitle]);

  useEffect(() => {
    const init = async () => {
      setHydrated(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // No account. In production that is the end of it — see the note on
        // `signedIn` above for why requiring an account is deliberate.
        //
        // In DEVELOPMENT ONLY, fall back to the local-only ANON_SCOPE career
        // that storage.ts still supports, so the game can actually be played
        // (and therefore SEEN) without completing Google OAuth — impossible in
        // a sandbox, a headless browser or CI. See lib/star/devMode.ts for the
        // full reasoning and for why this cannot reach production.
        //
        // A career started this way lives in this browser's localStorage and
        // never syncs to the cloud: the cloud step inside loadCareerIntoState
        // is a no-op without a user id, which is correct — there is no account
        // to sync it to.
        if (offlineDevPlayEnabled()) {
          setSignedIn(true);
          scopeRef.current = ANON_SCOPE;
          const anonSlot = loadActiveSlot(ANON_SCOPE);
          activeSlotRef.current = anonSlot;
          setActiveSlotState(anonSlot);
          await loadCareerIntoState(anonSlot);
          return;
        }
        setSignedIn(false);
        setCloudLoading(false);
        return;
      }
      setSignedIn(true);
      scopeRef.current = user.id;
      const slot = loadActiveSlot(scopeRef.current);
      activeSlotRef.current = slot;
      setActiveSlotState(slot);
      await loadCareerIntoState(slot);
    };
    init();
    // loadCareerIntoState is declared further down as a useCallback with its
    // own stable, empty dependency list (see its own doc) — this effect only
    // ever needs to run once, at mount, exactly as it always has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!career) return;
    // Bank the star rating into the live career first (starPoints.ts): its
    // high-water marks have to travel with the state, or something bought
    // and then lost between two saves would take its points with it. This
    // re-runs the effect once with the banked career, which then saves.
    const banked = withStars(career);
    if (JSON.stringify([banked.stars, banked.starBest, banked.starLedger, banked.awards]) !== JSON.stringify([career.stars, career.starBest, career.starLedger, career.awards])) {
      setCareer(banked);
      return;
    }
    saveCareer(career, slotScope(scopeRef.current, activeSlotRef.current)); // localStorage — immediate
    // Debounced cloud save: waits 3 s after the last change so a burst of
    // state updates (end of match, season rollover) produces one write, not
    // many. The slot is captured now, at the moment the timer is set, not
    // re-read when it actually fires — see flushCloudSave's own note on why
    // a save already in flight has to land on the slot it was really FOR,
    // not whichever slot happens to be active three seconds from now.
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    const slotAtSaveTime = activeSlotRef.current;
    latestCareerRef.current = { career, slot: slotAtSaveTime };
    pendingCloudSave.current = { career, slot: slotAtSaveTime };
    cloudSaveTimer.current = setTimeout(() => {
      pendingCloudSave.current = null;
      saveCareerToCloud(career, slotAtSaveTime, { scope: slotScope(scopeRef.current, slotAtSaveTime) });
    }, 3000);
  }, [career]);

  // ── Signal comes back: upload what this device has that the cloud hasn't ──
  //
  // Played underground or offline, the uploads failed; before this, nothing
  // was sent again until the next change. Now it goes the moment the phone
  // is back online, or the app is reopened with signal — only when this
  // device really holds unconfirmed progress (hasUnsyncedProgress).
  const latestCareerRef = useRef<{ career: CareerState; slot: number } | null>(null);
  useEffect(() => {
    const uploadIfBehind = () => {
      const latest = latestCareerRef.current;
      if (!latest || pendingCloudSave.current) return; // a save is already on its way
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const scope = slotScope(scopeRef.current, latest.slot);
      if (!hasUnsyncedProgress(scope, latest.career)) return;
      saveCareerToCloud(latest.career, latest.slot, { scope });
    };
    const onVisible = () => { if (document.visibilityState === "visible") uploadIfBehind(); };
    window.addEventListener("online", uploadIfBehind);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", uploadIfBehind);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ── Leaving the page must not lose the last few seconds ──
  //
  // The cloud save above waits 3 s for things to settle. Switching app,
  // locking the phone or closing the tab inside those 3 s used to leave the
  // cloud one step behind: the timer never fired, and the next device (or a
  // wiped browser) loaded the older save. When the page is hidden, the
  // pending save goes NOW instead — and the local copy is written again too,
  // belt and braces, since it is the one thing guaranteed to be there on
  // return. Nothing is sent when nothing is pending.
  useEffect(() => {
    const flushOnHide = () => {
      const pending = pendingCloudSave.current;
      if (!pending) return;
      pendingCloudSave.current = null;
      if (cloudSaveTimer.current) { clearTimeout(cloudSaveTimer.current); cloudSaveTimer.current = null; }
      saveCareer(pending.career, slotScope(scopeRef.current, pending.slot));
      saveCareerToCloud(pending.career, pending.slot, { leavingPage: true, scope: slotScope(scopeRef.current, pending.slot) });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flushOnHide(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushOnHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushOnHide);
    };
  }, []);

  /**
   * EVERY NEW SCREEN STARTS AT THE TOP OF ITSELF.
   *
   * Found by playtest, reproduced seven times across unrelated screens, and it
   * is worst in exactly the place it can least afford to be.
   *
   * On a phone, almost every "next" button in this game is below the fold —
   * "Start Career", "Continue →", "Team sheets →", "KICK OFF". So the player
   * scrolls down to press it. Changing phase swaps what is rendered but does
   * not touch the scroll position, so the NEXT screen opens already scrolled
   * down by however far the last one needed.
   *
   * Measured: after scrolling to find KICK OFF, the live match opened at
   * `scrollY: 333` with the canvas at `y: -128` — the pitch, the ball and both
   * teams genuinely above the top of the screen, leaving a black area and a
   * stats strip. The player's own match, invisible, until they think to scroll
   * up. The same thing put the opening trial's ball off-screen, and both face
   * editors.
   *
   * It is also the reason an automated driver reported "22 of 22 attempts made
   * no contact with the ball" — it was dragging at a pitch that was not on the
   * screen.
   *
   * Deliberately keyed on `phase` alone: this is about arriving somewhere new,
   * not about re-rendering. Scrolling within a screen is untouched.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    // The phone frame and several screens scroll in their own element rather
    // than the window, so the window alone is not always the thing that moved.
    document.querySelectorAll<HTMLElement>("[data-scroll-root]").forEach(el => { el.scrollTop = 0; });
  }, [phase]);

  // Only the phases a refresh must return you to are written; everything else
  // clears the record — see RESUMABLE in storage.ts.
  useEffect(() => {
    if (hydrated) {
      saveStarPhase(phase, slotScope(scopeRef.current, activeSlotRef.current), contractOfferReason ?? undefined, wonBallonDor);
    }
  }, [hydrated, phase, contractOfferReason, wonBallonDor]);

  // The fixture the post-match screen is reporting on. Held in state because
  // crediting the result marks it played, so re-deriving "first unplayed" would
  // name the NEXT opponent — and would be null after the final fixture, which
  // used to strand the career with no way to reach the Ballon d'Or / next season.
  const [playedFixture, setPlayedFixture] = useState<Fixture | null>(null);
  // The freshly-drawn round waiting to be shown on the Draw screen. Set by
  // continueAfterMatch when the match just played drew a new round in a
  // domestic cup, or a new tie in the Champions/Europa League; cleared once
  // the player has clicked through it.
  const [pendingDraw, setPendingDraw] = useState<{ competition: string; round: DrawRound } | null>(null);

  // Ordered by week, not by array position — a knockout round earned mid-season
  // is appended to the fixture list and would otherwise sort to the very end.
  const nextFixture = career ? nextFixtureFor(career) : null;
  // Every fixture played and the season not yet rolled over. The dashboard has
  // nothing to offer in this state on its own, which is what made a refresh here
  // a dead end.
  const seasonOver = !!career && career.fixtures.length > 0 && !nextFixture;
  // Who the manager has picked this week, and which dead balls would be yours.
  const selection = career ? selectionFor(career) : null;
  // v0.15 item 6: each star counts double towards penalties (setPieces.ts).
  const duties = career && selection ? setPieceDuties(career, selection.status) : null;
  // What your energy — and therefore your selection — will actually be once
  // you go and play: every day still unspent this week counts toward it
  // automatically (handlePlayMatch banks it for real the moment you commit).
  // The pre-match screen reads THESE, not the raw pre-credit `career`/
  // `selection` above, so it shows and decides off the number you're really
  // about to have rather than a stale one from before this week finished.
  // The Phone button's red dot: unread things on the phone, until you read them.
  const [phoneSeenTick, setPhoneSeenTick] = useState(0);
  useEffect(() => {
    const on = () => setPhoneSeenTick((t) => t + 1);
    window.addEventListener(PHONE_SEEN_EVENT, on);
    return () => window.removeEventListener(PHONE_SEEN_EVENT, on);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const phoneUnread = useMemo(() => (career ? phoneUnreadCount(career) : 0), [career, phoneSeenTick]);
  const preMatchEnergy = career ? projectedEnergy(career) : 0;
  const preMatchSelection = career ? selectionFor({ ...career, energy: preMatchEnergy }) : null;
  // Item 24: the sub's planned minute and ladder show only with Settings →
  // Developer tools → "Show developer info" on (a per-device switch).
  const showDevInfo = devInfoOn();
  const myTeam = (f: typeof nextFixture) =>
    f?.kind === "international" ? nationOf(career!) : career!.player.club;
  const nextMatchLabel = nextFixture
    ? `Next: ${nextFixture.home ? myTeam(nextFixture) : nextFixture.opponent} v ${nextFixture.home ? nextFixture.opponent : myTeam(nextFixture)}`
    : "Season complete";
  // When it is played, in real dates. The fixture list has had these since the
  // calendar landed; this is the screen everybody actually looks at.
  const nextMatchDate = nextFixture && career
    ? fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind, divisionOf(career))
    : null;

  /**
   * A new career, with the actual squad of the club you picked.
   *
   * The club list already comes from the database — ProfileSetup builds it from
   * the clubs that exist in FC 26 — so the name in the career matches the name
   * in `sofifa_players` and the roster can simply be fetched. Once it is, the
   * goal crediting that already exists starts attributing goals to real
   * players, because it matches on name and always did.
   *
   * The career is created and shown FIRST, then the squad arrives and replaces
   * the generated one. Blocking character creation on a network request to make
   * a screen you are not looking at correct would be the wrong trade; and if the
   * request never lands, the generated squad it was born with is a working
   * squad.
   */
  const handleProfileComplete = useCallback((player: StarPlayer, clubs: string[], division: CareerDivision) => {
    // ── Into the trial, not the dashboard ──
    //
    // A career opens on a trial: five stages on the live match engine, seeded
    // once so it is the same afternoon however many times the app is closed
    // and re-opened. The career itself is fully built before any of it — the
    // trial is a scene played over a career that already exists, so nothing
    // about it can leave a half-made save behind if the tab closes halfway
    // through. Both squad fetches below still run during it, which is time the
    // trial is spending anyway.
    //
    // ── You arrive with NO CLUB ──
    //
    // This is what the whole `makeIdentity`/`attachClub` split was for. A
    // trialist is a real, complete, saveable career that nobody has signed:
    // real skills, real money, real relationships, and no league, no fixtures
    // and no squad, because he does not have a club to have them at.
    //
    // The club you picked on the setup screen is where the trial IS, not where
    // you play — `attachClub` runs later, once somebody actually offers.
    const created = { ...makeIdentity(player, division), trial: startTrial() };
    setCareer(created);
    setPhase("trial-stages");
    // ── The squad fetches have MOVED to the signing ──
    //
    // They used to fire here, on the reasoning that the trial was time they
    // could spend anyway. That was right when the club was already known; it
    // is wrong now, because at this moment there is no club — which club's
    // dressing room to fetch is the question the trial is about to answer.
    // They fire the instant an offer is accepted instead (see the scout-offers
    // screen), which is still before the first screen that needs them.
    //
    // The shared team sheets are not club-specific and still fire now.
    fetchSharedLineups();
    // The XP Book (/admin/star-xp): the XP amounts every career uses.
    refreshXpConfig();
    void clubs;
    // Whoever the database currently has out of contract — signable by any
    // club, yours included, the moment a transfer window opens. See
    // lib/star/leagueSquads.ts's fetchFreeAgents.
    fetchFreeAgents().then((freeAgents) => {
      setCareer(c => (c ? { ...c, freeAgents } : c));
    });
    // ── …and the wider world, for the rare transfer that crosses out of the
    // division entirely — see lib/star/leagueTransfers.ts's
    // runInternationalWindow. ──
    fetchLeagueSquads(externalClubsFor(clubs)).then((externalSquads) => {
      setCareer(c => (c ? { ...c, externalSquads } : c));
    });
  }, []);

  /**
   * The month you won, held until you dismiss it.
   *
   * Only ever set when the winner is you. Somebody else taking it is news and
   * belongs in the feed; yours stops the game once.
   */
  const [potmWin, setPotmWin] = useState<MonthAward | null>(null);
  /** The team sheets, shown between the pre-match screen and kick-off. */
  const [showTeams, setShowTeams] = useState(false);
  /**
   * Asked to play somewhere other than your named position. Lives on the
   * career now, not component state — it used to reset the moment you
   * kicked off, so a choice never survived past the match it was made for,
   * reported directly as "it should stay until I change it again". Applies
   * to every match from here on, not just the next one.
   */
  const playAs = career?.playAs ?? null;
  const setPlayAs = useCallback((role: Role | null) => {
    setCareer(c => (c ? { ...c, playAs: role } : c));
  }, []);

  const handleExit = useCallback(() => {
    // In-app, not confirm(): a browser box throws the player out of full
    // screen (v0.25 live test).
    void askConfirm("Leave the career? It stays saved. You come back to exactly this.", "Leave").then(ok => {
      if (ok) window.location.href = "/";
    });
  }, []);

  const handleNavigate = useCallback((tab: NavTab) => {
    setActiveNav(tab);
    if (tab === "league") setPhase("league");
    else if (tab === "skills") { setTrainingTab("training"); setPhase("skills"); }
    // PROTOTYPE (home-screen proto): Relationships is its own button now.
    else if (tab === "life") { setTrainingTab("life"); setPhase("skills"); }
    else if (tab === "home") { setHomePage(1); setPhase("dashboard"); }
    else if (tab === "media") setPhase("media");
    else if (tab === "play") setPhase("pre-match");
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setActiveNav("home");
    setPhase("dashboard");
  }, []);

  /**
   * ── Back out of Settings, to wherever this career actually lives ──
   *
   * Settings is the one screen a career with no club can legitimately be on,
   * and its back button was `handleBackToDashboard` because that handler
   * already existed. So a free agent — or a player mid-trial — who opened
   * Settings and tapped Back landed on the CLUB dashboard: the shop, the
   * casino, every club button, and, because the "is the season over" check
   * passes trivially on an empty fixture list, an "End of Season 🏆" button
   * that would run the awards and season-advance flow on a career with no
   * league at all.
   *
   * `hasClub` (calendar.ts) is the question, and it is exactly the question
   * the load path already asks to decide which shell to resume onto.
   */
  const handleBackFromSettings = useCallback(() => {
    if (career && !hasClub(career)) {
      setPhase(clublessPhaseFor(career));
      return;
    }
    setActiveNav("home");
    setPhase("dashboard");
  }, [career]);

  // Reputation, the Rule Book, and Investments (see the "ownership" phase
  // below) are only ever reached FROM the Ownership hub now — Reputation/
  // Rule Book/Invest stopped being their own separate dashboard buttons when
  // Ownership consolidated them into one. Reported directly: their own back
  // button dropped all the way to the dashboard instead of returning to
  // Ownership, "the same thing if you were to click the home button" —
  // wired to `handleBackToDashboard` because it existed already, not because
  // dashboard is genuinely where any of them were opened from.
  const handleBackToOwnership = useCallback(() => {
    setPhase("ownership");
  }, []);

  // Back out of a Life-opened screen (shop, sponsors, contract…) onto the
  // Life tab of the merged Training area, not the Training tab it shares a
  // nav slot with.
  const handleBackToLife = useCallback(() => {
    setActiveNav("skills");
    setTrainingTab("life");
    setPhase("skills");
  }, []);

  const handleTrain = useCallback((skill: keyof Skills) => {
    if (!career || trainingLeft(career) <= 0) return;
    setTrainingSkill(skill);
    setTrainingLevel(null);
    setPhase("training");
  }, [career]);

  // Put your feet up. Costs a day of the week, buys back some happiness.
  const handleRest = useCallback(() => {
    if (!career) return;
    setCareer(rest(career));
  }, [career]);


  /**
   * Set or clear the photograph on your graphics.
   *
   * Functional update rather than reading `career` from the closure: this is
   * called from a control that can sit open across a save, and the picture is
   * the one piece of the career a stale copy would silently discard the rest of.
   */
  // Settings → Penalty run-up / Free-kick run-up (lib/star/runupStyles.ts): equip a style you own.
  const handleSetPenaltyRunup = useCallback((id: PenaltyRunupId) => {
    setCareer(c => (c ? { ...c, penaltyRunup: id } : c));
  }, []);
  const handleSetFreeKickRunup = useCallback((id: FreeKickRunupId) => {
    setCareer(c => (c ? { ...c, freeKickRunup: id } : c));
  }, []);

  const handleSetPortrait = useCallback((portrait: string | undefined) => {
    setCareer(c => (c
      ? { ...c, player: { ...c.player, ...(portrait ? { portrait } : { portrait: undefined }) } }
      : c));
  }, []);

  // Which saved goal replay is currently on screen — see the "goal-replay"
  // phase below and SettingsScreen's admin-only "Goal Replays" section.
  const [watchingReplay, setWatchingReplay] = useState<GoalReplay | null>(null);
  const handleGoalScored = useCallback((replay: GoalReplay) => {
    setCareer(c => (c ? addRecentGoal(c, replay) : c));
  }, []);
  const handleWatchReplay = useCallback((replay: GoalReplay) => {
    setWatchingReplay(replay);
    setPhase("goal-replay");
  }, []);
  const handleSaveReplay = useCallback((index: number, replay: GoalReplay) => {
    setCareer(c => (c ? saveReplayToSlot(c, index, replay) : c));
  }, []);
  const handleDeleteSavedReplay = useCallback((id: string) => {
    setCareer(c => (c ? deleteSavedReplay(c, id) : c));
  }, []);

  const handleTrainingComplete = useCallback((stars: number) => {
    if (!career || !trainingSkill || trainingLevel === null) return;
    // Stars, not XP (Mikey, 25 Sep 2026): each NEW star on a level is two
    // thirds of a point, age makes no difference, and a pass also wins back
    // points lost to decay or age — see lib/star/trainingLevels.ts.
    const banked = applyLevelResult(career, trainingSkill, trainingLevel, stars).career;
    const updated: CareerState = {
      ...banked,
      // This is the "trained it" clock decaySkills reads — a session
      // resets it regardless of how much it actually gained, same as
      // real training: showing up is what keeps a skill maintained.
      lastTrainedWeek: { ...career.lastTrainedWeek, [trainingSkill]: career.week },
      energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
      // Recomputed below, once this session's achievement checks (a fresh
      // "max-technique" unlock, say) are final.
      starRating: career.starRating,
    };
    checkAndSetAchievements(updated);
    updated.starRating = computeStarRating(updated);
    toastRatingChange(starsNow(career), starsNow(updated));
    // A training session, not one of the week's actions (week.ts). Counted
    // for the unlock chain too: two drills open the League.
    setCareer(recordDrill(spendTrainingSession(updated), starStatus(career).total, starsNow(career)));
    // v0.25 (game first): the first drill is a first step, and opens the
    // Shop (v0.25.1, Harry: "drop it from 2 forced training drills to 1").
    if (gameFirst(career) && career.unlocks!.drills + 1 === DRILLS_TO_OPEN_SHOP) {
      setChainPop({ label: "Complete a training drill", unlocked: "Shop unlocked" });
    }
    setTrainingSkill(null);
    setTrainingLevel(null);
    // A youth-team player's week is lived on his own screen, so training
    // from it comes back to it rather than dropping him on the first team's
    // skills page with no obvious way back.
    setPhase(career.placement?.kind === "youth" ? "youth" : "skills");
  }, [career, trainingSkill, trainingLevel]);

  // Committing to play is what actually banks whatever's left of the week —
  // every unspent action credited as if Rest had been pressed for it (see
  // projectedEnergy, week.ts), applied for real here rather than merely
  // shown as a preview, so the team sheet, selection and the match itself
  // all run on the same number the pre-match screen just promised. Nothing
  // is spent by simply looking at the pre-match screen or backing out of it —
  // only by actually kicking off.
  const handlePlayMatch = useCallback(() => {
    if (!career || !nextFixture) return;
    setCareer({ ...career, weekActions: 0, energy: projectedEnergy(career) });
    setPhase("match");
  }, [career, nextFixture]);

  // Left out of the squad. The match still happens — it just happens without
  // you — and the week costs you sharpness while the manager softens a little.
  const handleWatchFromStands = useCallback(() => {
    if (!career || !nextFixture) return;
    const { career: next, newlyUnlocked } = simulateMissedFixture(career, nextFixture);
    toastAchievements(newlyUnlocked);
    toastRatingChange(starsNow(career), starsNow(next));
    setCareer(next);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career, nextFixture]);

  // ═══════════════════════════════════════════════════════════════════
  //  THE YOUTH TEAM (lib/star/youth.ts)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * A WEEK IN THE YOUTH TEAM.
   *
   * Two real things, in this order, and nothing invented in between:
   *
   *  1. The first team play their fixture without you. That is exactly
   *     `simulateMissedFixture` — the same call "Watch from the stands"
   *     makes — because being in the youth team IS being left out of the
   *     squad. The table moves, the cups move, the wage is paid, the week
   *     rolls over.
   *  2. You play yours. `playYouthMatch` produces a real scoreline, your
   *     own goals and assists against the level you are actually at, a
   *     rating and the coach's verdict; `applyYouthWeek` writes them onto
   *     the spell and moves the promotion meter.
   *
   * The youth goals stay on the SPELL and never touch `seasonStats` — a
   * youth goal is not a first-team goal and must never reach the Golden
   * Boot, Player of the Month or your career record.
   */
  const handleYouthWeek = useCallback(() => {
    if (!career || career.placement?.kind !== "youth") return;
    // ── The club's season has finished ──
    //
    // There is no fixture left to be left out of, and rolling the week on
    // regardless would leave a youth player playing youth matches into an
    // empty August forever while the season never turned over. The dashboard
    // is where the End of Season prompt lives, so that is where he goes —
    // the season ends for a youth-team player exactly when it ends for
    // everybody else.
    if (!nextFixture && career.fixtures.length > 0) {
      setActiveNav("home");
      setPhase("dashboard");
      return;
    }
    let base = career;
    if (nextFixture) {
      const { career: next, newlyUnlocked } = simulateMissedFixture(career, nextFixture);
      toastAchievements(newlyUnlocked);
      base = next;
    } else {
      // A career with no fixture list at all — not reachable through the
      // game, since a placement always follows `attachClub`. The week still
      // has to end rather than the screen doing nothing.
      base = { ...career, week: career.week + 1, ...startNewWeek() };
    }
    const match = playYouthMatch(base, mulberry32(base.season * 10007 + base.week * 131 + 4409));
    setCareer(applyYouthWeek(base, match));
  }, [career, nextFixture]);

  /**
   * ENTRY POINT 1 — nobody offered terms.
   *
   * Signs you into a real club's youth team on a real youth wage — which is
   * `weeklyWageFor(club, division, 0)`, the bottom of that club's own band
   * on the one wage curve the whole game uses, not a new figure (see
   * `YOUTH_STANDING`, youth.ts). Returns the phase to go to, so the caller
   * stays a one-liner; the free-agent life is still where you land when even
   * a youth team says no.
   */
  /**
   * WHO, IF ANYBODY, WOULD TAKE YOU INTO THEIR YOUTH TEAM.
   *
   * Computed here rather than only inside `youthOrFreeAgent` so the offers
   * screen can SAY it before you press the button. `youthTakerFor` is a pure
   * function of the trial's score and its seed, so this is exactly the club
   * that will sign you — not a second guess at it — and the one seed
   * expression lives in one place so the two can never drift apart.
   *
   * Null means the genuine bottom of the game: a trial nobody wanted at all,
   * and the free-agent life is still what happens there.
   */
  const youthTaker = useMemo(
    () => (career?.trial
      ? youthTakerFor(trialScore(career.trial), mulberry32(career.trial.seed ^ 0x9e11))
      : null),
    [career?.trial],
  );

  const youthOrFreeAgent = useCallback((): StarPhase => {
    if (!career?.trial) return "free-agent";
    const taker = youthTaker;
    if (!taker) return "free-agent";
    const wage = youthWage(taker.club, taker.division);
    const signed = attachClub(career, taker.club, taker.clubs, taker.division, wage);
    setCareer({
      ...signed,
      contract: {
        club: taker.club,
        wage,
        goalBonus: goalBonusFor(wage),
        assistBonus: assistBonusFor(wage),
        // A scholarship, not a professional deal. Two seasons rather than
        // one deliberately: a fresh trialist takes a measured 27-51 weeks to
        // force his way up (tests/star/youth.mts), and a one-season deal
        // would drop a player who is halfway up the meter straight onto the
        // contract-renewal screen mid-climb.
        seasonsRemaining: 2,
      },
      agreedTerms: undefined,
      placement: startYouthSpell(taker.club, taker.division, "trial"),
    });
    setActiveNav("home");
    fetchRealSquad(taker.club).then(squad => {
      setCareer(c => (c && c.player.club === taker.club ? { ...c, squad } : c));
    });
    fetchLeagueSquads(taker.clubs).then(leagueSquads => {
      setCareer(c => (c ? {
        ...c, leagueSquads,
        league: syncLeagueStrengthFromSquads(c.league, leagueSquads),
      } : c));
    });
    return "youth";
  }, [career, youthTaker]);

  /** The way out. A real contract on the real wage curve — see
   *  `promoteFromYouth`. */
  const handleYouthPromotion = useCallback(() => {
    if (!career || !readyForPromotion(career)) return;
    setCareer(promoteFromYouth(career));
    setActiveNav("home");
    setPhase("dashboard");
  }, [career]);

  /**
   * ENTRY POINT 2 — dropping a first-teamer whose form has gone.
   *
   * Called on the career AFTER a match has been credited, which is the only
   * moment `career.form` can have changed. Returns the career untouched in
   * every case but a genuine collapse (see `formHasCollapsed`), so this is
   * a no-op for the overwhelming majority of weeks.
   */
  const applyFormCollapse = useCallback((next: CareerState): CareerState => {
    if (!formHasCollapsed(next)) return next;
    return dropToYouth(next);
  }, []);

  // Pop the achievement toast for ids the reducers already appended to state.
  const toastAchievements = (ids: string[]) => {
    if (ids.length > 0) {
      setUnlockedAchievements(ids);
      sfx("achievement-pop");
      setTimeout(() => setUnlockedAchievements([]), 3000);
    }
  };

  // For handlers that build state inline: append newly-earned achievements + toast.
  const checkAndSetAchievements = (state: CareerState) => {
    const newlyUnlocked = checkNewAchievements(state);
    if (newlyUnlocked.length > 0) state.achievements = [...state.achievements, ...newlyUnlocked];
    toastAchievements(newlyUnlocked);
  };

  // The visible moment a rating change asked for — requested directly,
  // "not just a number quietly drifting". Compares the ROUNDED display
  // value (1 decimal, what the star bar itself shows), not the raw float,
  // so this never fires for a change too small to actually see. Increases
  // only — a rating that ticks down from aging decay is real and correct,
  // but is not the kind of moment worth a celebratory banner for.
  const toastRatingChange = (from: number, to: number, banner = true) => {
    // The star rating is a whole number, 1-100 (starPoints.ts).
    const fromShown = Math.floor(from);
    const toShown = Math.floor(to);
    if (toShown <= fromShown) return;
    // Every ten (20, 30 …) gets the full screen; anything less, the banner.
    if (Math.floor(toShown / 10) > Math.floor(fromShown / 10)) setNewStar(Math.floor(toShown / 10) * 10);
    if (!banner) return;
    sfx("level-up");
    setRatingChange({ from: fromShown, to: toShown });
    setTimeout(() => setRatingChange(null), 3000);
  };

  // `readied` is the career the match was played from — the Sim button
  // (item 36) hands it over, the way handlePlayMatch readies the week first.
  const careerNow = career;
  const handleMatchComplete = useCallback((stats: MatchStats, readied?: CareerState) => {
    if (!nextFixture) return;
    const career = readied ?? careerNow;
    if (!career) return;
    setLastMatchStats(stats);
    setPlayedFixture(nextFixture);
    const credited = creditMatchResult(career, nextFixture, stats);
    setBootsJustWoreOut(career.currentBoot.matches > 0 && credited.career.currentBoot.matches === 0);
    const { newlyUnlocked, potmAwarded } = credited;
    // The first game opens the Shop (Harry, P70: "play a game first and then come back").
    // v0.25 (game first): it opens Training and Achievements; Sponsors open with your first offer (unlocks.ts).
    let next = recordFirstMatch(credited.career);
    pushNews(...newsForMatch(career, next, nextFixture, nextFixture.kind && nextFixture.kind !== "league" ? fixtureLabel(nextFixture) : null));
    // The star rating shown is the career one (starPoints.ts).
    const starNext = starStatus(next);
    const earned = matchStarPoints(career, nextFixture, stats);
    setLastStarChange({ from: starsNow(career), to: starNext.stars });
    // Everything that moved the rating, not just the match (starGain).
    const gain = starGain(career, next);
    setLastMatchStar({ sp: earned.total, base: earned.base, mult: earned.mult, toNext: starNext.toNext, fromNext: starStatus(career).toNext, gate: starNext.gate?.need,
      total: gain.total, extra: gain.lines.filter(l => l.cat !== "match").map(l => ({ label: l.label, sp: l.sp, n: l.n })),
      held: starNext.held, carried: starNext.carried });
    // Shown one at a time on the post-match screen (PostMatch.tsx), not as a toast on Home.
    setLastMatchAch(newlyUnlocked);
    // …as pop-ups with no Next button (v0.24, P2-84).
    setMatchToasts(newlyUnlocked.flatMap(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return a ? [{ label: a.label, description: a.description }] : []; }));
    // The energy the rest days give back before the next match (P2-82): where
    // the bar ended in the match, against where it is now.
    if (stats.endEnergy !== undefined) setEnergyBack(Math.max(0, Math.round(next.energy - Math.max(0, Math.min(100, stats.endEnergy)))));
    else setEnergyBack(null);
    // The post-match bar already shows the rise, so no banner on Home afterwards.
    toastRatingChange(starsNow(career), starNext.stars, false);
    // The world reacts. Generated once, here, from the career on both sides of
    // the match — "went top" is a comparison and the after state cannot make it.
    next.media = generateForMatch(career, next, nextFixture, stats);
    // …and so does the rest of the division, the same week — `next.results`
    // already carries every OTHER fixture `playLeagueWeek` simulated
    // alongside yours (empty on a cup/Europe/international week, when the
    // domestic round doesn't run at all); only those belong to the new
    // England-wide tab, since yours is already covered above.
    const restOfWeek = (next.results ?? []).filter(
      r => r.week === nextFixture.week && r.home !== career.player.club && r.away !== career.player.club,
    );
    if (restOfWeek.length) {
      next.media = generateForLeagueWeek({ ...next, media: next.media }, restOfWeek);
    }
    // …and again if the month ended with it, so the award is its own moment in
    // the feed rather than a line buried under the match report.
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
    if (potmAwarded?.isYou) setPotmWin(potmAwarded);
    // A run of bad enough games, and the manager stops picking you at all —
    // which now means the youth team rather than the door. A no-op in every
    // week but a genuine collapse; see `formHasCollapsed` (youth.ts).
    setCareer(applyFormCollapse(next));
    setPhase("post-match");
  }, [careerNow, nextFixture, applyFormCollapse, pushNews]);

  // Item 36 (v0.15): "Sim this match" — the unseen match plays out and each
  // chance that comes to you is settled by your skills (lib/star/simMatch.ts),
  // then it is credited exactly like a played match.
  const handleSimMatch = useCallback(() => {
    if (!career || !nextFixture) return;
    // Readied exactly as handlePlayMatch readies a played match: the week's
    // actions spent and the rest days' energy banked.
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
    handleMatchComplete(stats, readied);
  }, [career, nextFixture, handleMatchComplete]);

  // The end of a season, reachable from the post-match screen and — after a
  // refresh dropped you on the dashboard — from the dashboard prompt too.
  // awardLeagueTrophyIfWon is idempotent, so arriving twice is safe.
  const endSeason = useCallback((from: CareerState) => {
    const { career: awarded } = awardLeagueTrophyIfWon(from);
    // Read off BEFORE anything downstream (advanceSeason, a few screens from
    // here) wipes every season-long tally back to zero — see the file header
    // in lib/star/seasonAwards.ts for why this can't wait until the trophy
    // winners themselves are ready to show.
    const next = { ...awarded, lastSeasonAwardStats: computeSeasonAwardStats(awarded) };
    setCareer(next);
    setActiveNav(null);
    setPhase("ballon-dor");
  }, []);
  const handleSeasonEnd = useCallback(() => {
    if (career) endSeason(career);
  }, [career, endSeason]);

  /**
   * Everything that happens between the final whistle and the next week, run
   * against a career you hand it.
   *
   * It takes the career as an argument rather than reading it out of the
   * closure, and that is the whole point. The press conference interrupts this
   * flow and then resumes it — and when it resumed by calling back into a
   * closure captured BEFORE the answer was applied, every branch that writes
   * state wrote a career that predated the answer. Reply to the press and then
   * hit the end of a season, or a contract offer, and the relationships you had
   * just moved were silently rolled back.
   */
  const continueAfterMatch = useCallback((from: CareerState, askPress: boolean, skipDraw = false) => {
    // Press conferences turned off for now, on request — the plumbing
    // (pressQuestionFor, PressConference, phase "press") is untouched and
    // ready to switch back on by restoring the askPress check this used to
    // open with.

    // A transfer window just closed — the whole division's business, all at
    // once, exactly the "Deadline Day" moment the real calendar builds
    // toward. `lastTransferWindowKey` moves the instant creditMatchResult
    // runs a window (see careerFlow.ts); this only checks whether that key
    // has actually been SHOWN yet, so it fires exactly once per window
    // regardless of which match happened to be the one that closed it, and
    // survives a refresh mid-flow instead of depending on this render still
    // remembering "a window just closed". A window that never ran at all
    // (season 1's summer, deliberately skipped so the hand-curated starting
    // rosters aren't immediately overwritten) leaves both fields seeded to
    // the same value in makeInitialCareer, so there is nothing here to show.
    if (from.lastTransferWindowKey && from.lastTransferWindowKey !== from.deadlineDayShownFor) {
      setPhase("deadline-day");
      return;
    }

    // The match just played was a knockout tie — domestic cup or European —
    // and advancing drew what comes next: cupState/euroState already carry it
    // (settleCupTie / settleEuro draw synchronously). Show that draw before
    // moving on, the same way the real competitions redraw the instant your
    // tie is settled; this is a replay of it, not a second draw. Not the
    // domestic final: with one tie left there is nothing to draw, the pairing
    // is just whoever won the semis. `skipDraw` is set on the way back IN
    // from that screen so this does not loop.
    if (!skipDraw && playedFixture) {
      const cupCompetition = playedFixture.competition === "FA Cup" || playedFixture.competition === "League Cup"
        ? playedFixture.competition : null;
      if (cupCompetition) {
        const state = from.cupState?.find((s) => s.competition === cupCompetition);
        const round = state ? currentRound(state) : null;
        const freshlyDrawn = round && round.ties.length >= 2 && round.ties.every((t) => t.hs === undefined);
        // Only a draw you're in (v0.15 item 32) — knocked out, the next
        // round is drawn without you and the game moves straight on.
        const youreIn = !!round && round.ties.some((t) => t.home === from.player.club || t.away === from.player.club);
        if (freshlyDrawn && round && youreIn) {
          setPendingDraw({ competition: cupCompetition, round });
          setPhase("draw");
          return;
        }
      }

      // Champions/Europa League: the knockout draws one opponent at a time
      // (drawTie in euro.ts), not a whole round of ties like the domestic
      // cups — so this reveal is always a single "you v opponent" tie. Same
      // freshly-drawn test: a tie whose legs are all still unplayed is one
      // that was JUST drawn by this match's result (the league-phase finish
      // drawing the first knockout tie, or a won tie drawing the next round);
      // an in-progress or just-finished tie is excluded automatically because
      // its first leg (or the tie itself) already has a score.
      const isEuroKnockout = playedFixture.kind === "europe"
        && (playedFixture.competition === "Champions League" || playedFixture.competition === "Europa League");
      if (isEuroKnockout && from.euroState) {
        const tie = currentTie(from.euroState);
        const freshlyDrawn = tie && tie.legs.every((l) => l.us === undefined);
        if (freshlyDrawn && tie) {
          setPendingDraw({
            competition: from.euroState.competition,
            round: { name: tie.round, ties: [{ home: from.player.club, away: tie.opponent }] },
          });
          setPhase("draw");
          return;
        }
      }
    }

    const remaining = from.fixtures.filter((f) => !f.played).length;
    if (remaining === 0) {
      endSeason(from);
      return;
    }

    // Mid-season contract offer — fires when the club wants to lock in a player
    // who has hit a star milestone or maintained exceptional form for 5+ matches.
    const earlyOffer = checkForContractOffer(from);
    if (earlyOffer) {
      setCareer(markContractOfferUsed(from, earlyOffer));
      setContractOfferReason(earlyOffer);
      setPhase("contract-renewal");
      return;
    }

    // Dilemmas turned off for now, on request — the plumbing (pickDilemma,
    // DilemmaModal, phase "dilemma") is untouched and ready to switch back on
    // by restoring the roll this used to make here.

    setActiveNav("home");
    setPhase("dashboard");
  }, [endSeason, playedFixture, lastMatchStats]);

  /**
   * Out of the ground.
   *
   * The papers react before they ask you about it, so the feed sits between the
   * stats and the press conference. It is skipped when the match produced
   * nothing worth reading, which a 0-0 in September genuinely can.
   */
  const handlePostMatchContinue = useCallback(() => {
    if (!career) return;
    // A per-device preference (Settings → Post-Match Reactions), not game
    // data — requested directly: after the rating/money screen, some
    // players would rather go straight back to the dashboard than always
    // pass through the phone screen. A simmed match (item 36) always goes
    // straight back home.
    if (!lastMatchStats?.simmed && getPostMatchReactionsEnabled() && hasFreshMedia(career)) { setPhase("media"); return; }
    continueAfterMatch(career, !pressQuestion);
  }, [career, continueAfterMatch, pressQuestion, lastMatchStats]);

  // Tapping a post's heart in the phone feed — saved on the post, so it
  // stays liked when you come back.
  const handleToggleLike = useCallback((postId: string) => {
    setCareer(c => (c ? toggleLike(c, postId) : c));
  }, []);

  const handleMediaContinue = useCallback(() => {
    if (career) continueAfterMatch(career, !pressQuestion);
  }, [career, continueAfterMatch, pressQuestion]);

  const handlePressAnswer = useCallback((o: PressOption) => {
    if (!career) return;
    const answered: CareerState = {
      ...career,
      relationships: {
        ...career.relationships,
        boss: clampRel(career.relationships.boss + o.boss),
        team: clampRel(career.relationships.team + o.team),
        fans: clampRel(career.relationships.fans + o.fans),
      },
      happiness: clampRel(career.happiness + (o.happiness ?? 0)),
    };
    setCareer(answered);
    setPressQuestion(null);
    // Straight back into the flow it interrupted — carrying the answer with it,
    // rather than through a setTimeout into a closure that never saw it.
    continueAfterMatch(answered, false);
  }, [career, continueAfterMatch]);

  const handleDilemmaChoose = useCallback((effects: DilemmaEffect) => {
    if (!career || !currentDilemma) return;
    let next = applyEffects(career, effects);
    next.seenDilemmas = [...next.seenDilemmas, currentDilemma.id];
    checkAndSetAchievements(next);
    setCareer(next);
    setCurrentDilemma(null);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career, currentDilemma]);

  // ── A division you have not played before needs its dressing rooms ──
  //
  // Promotion and relegation replace most of the clubs around you (see
  // lib/star/promotion), and advanceSeason deliberately drops the squads of
  // the ones you have left behind rather than carrying dead weight. This
  // notices whichever clubs are in your league table with no squad against
  // them — after a rollover, after a transfer, after a save that predates
  // any of it — and fetches exactly those, merging rather than replacing so
  // the clubs you kept keep this season's goals.
  useEffect(() => {
    if (!career?.league?.length) return;
    const have = new Set((career.leagueSquads ?? []).map(s => s.club));
    const missing = career.league.map(t => t.name).filter(n => !have.has(n));
    if (missing.length === 0) return;
    let alive = true;
    fetchLeagueSquads(missing).then((fresh) => {
      if (!alive) return;
      setCareer(c => {
        if (!c) return c;
        const already = new Set((c.leagueSquads ?? []).map(s => s.club));
        const leagueSquads = [...(c.leagueSquads ?? []), ...fresh.filter(s => !already.has(s.club))];
        return { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) };
      });
    });
    return () => { alive = false; };
    // Keyed on the club list itself, so it re-runs exactly when the division
    // changes rather than on every state change.
  }, [career?.league?.map(t => t.name).join("|"), career?.leagueSquads?.length]);

  // ── Your own club's full roster, not just its best twenty-ish ──
  //
  // Every entry in career.leagueSquads — the fetch above included — is built
  // with buildLeagueSquad's DEFAULT keepAll=false: a fixed slot template that
  // keeps only the single best fit per position, same lossy shape
  // career.squad itself uses. Fine for the other nineteen clubs, which only
  // ever need to answer "who's good enough to start or rotate in" — wrong for
  // your OWN club, because matchdayFor/fillMissingFromFullRoster fall back to
  // THIS exact entry to find a real player the /lineups builder placed in the
  // XI who lost the twenty-slot competition. The lineup builder itself has no
  // such limit (it fetches with keepAll=true — see app/lineups/page.tsx), so
  // it can save a lineup naming someone your own club's entry never kept —
  // and there was nowhere left to find him. Reported directly, twice, on a
  // brand new career: the lineup's own CDM never took the pitch, and the man
  // he should have replaced was never even on the bench.
  //
  // Re-fetched (merged, not replaced — goals/assists already on the books
  // survive via mergeLeagueSquadStats) every time the club you play for is
  // seen, which covers a fresh career, an existing save reopened, and a
  // transfer to a new club in one mechanism rather than three. Cheap: one
  // extra single-club request, and only when the club actually changes.
  const upgradedOwnClubRef = useRef<string | null>(null);
  useEffect(() => {
    const club = career?.player.club;
    if (!club || upgradedOwnClubRef.current === club) return;
    upgradedOwnClubRef.current = club;
    let alive = true;
    fetchLeagueSquads([club], undefined, true).then(([full]) => {
      // A failed fetch falls back to a fully INVENTED squad (generatedSquad,
      // ids prefixed "gen:") — better than nothing for a club with no
      // dressing room at all, but not something that should ever overwrite a
      // real, already-fetched roster just because this one request hiccuped.
      if (!alive || !full || full.players.some(p => p.id.startsWith("gen:"))) return;
      setCareer(c => {
        if (!c || c.player.club !== club) return c;
        const merged = mergeLeagueSquadStats([full], c.leagueSquads ?? [])[0];
        const already = (c.leagueSquads ?? []).some(s => s.club === club);
        const leagueSquads = already
          ? (c.leagueSquads ?? []).map(s => (s.club === club ? merged : s))
          : [...(c.leagueSquads ?? []), merged];
        return { ...c, leagueSquads };
      });
    });
    return () => { alive = false; };
  }, [career?.player.club]);

  // ── Free agents, for a save that predates them ──
  //
  // handleProfileComplete already fetches these for a brand new career; this
  // is the same fetch for one loaded from before freeAgents existed on
  // CareerState at all. `undefined` (never fetched) and `[]` (fetched, and
  // genuinely nobody is out of contract right now) are different states on
  // purpose — only the first should ever trigger this.
  useEffect(() => {
    if (!career || career.freeAgents !== undefined) return;
    let alive = true;
    fetchFreeAgents().then((freeAgents) => {
      if (!alive) return;
      setCareer(c => (c && c.freeAgents === undefined ? { ...c, freeAgents } : c));
    });
    return () => { alive = false; };
    // Two booleans, not the career object or the array itself — both flip
    // exactly once, at "a career now exists" and "it has been fetched",
    // which is the only two transitions this needs to notice.
  }, [!!career, career?.freeAgents === undefined]);

  // ── What went up and down, before anything else ──
  //
  // Shown whether or not it involved you: a division changing shape around
  // you is news even from mid-table. A forced contract renewal still wins,
  // because that one is a decision rather than a report — the ladder is
  // waiting on the other side of it via the dashboard. Split out of
  // rollOverSeason so the season-awards screen can land here too, once the
  // player is done looking at what the season handed out.
  const continueAfterRollover = useCallback((next: CareerState) => {
    if (next.ladderNews && next.contract.seasonsRemaining > 0) {
      setActiveNav(null);
      setPhase("ladder");
      return;
    }
    if (next.contract.seasonsRemaining <= 0) {
      setPhase("contract-renewal");
    } else {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, []);

  // Rolling into the next season, once anything that happens BETWEEN seasons is
  // out of the way. Split out because three different screens end here.
  // `justTransferred` is separate from `forcedRelegationMove` — a plain,
  // voluntary transfer-window acceptance is ALSO "just transferred" even
  // though it never touches the relegation-move screen. See advanceSeason's
  // own doc on why this has to reach it.
  const rollOverSeason = useCallback((from: CareerState, userWon: boolean, forcedRelegationMove = false, justTransferred = false) => {
    const { career: rolled, newlyUnlocked } = advanceSeason(from, userWon, justTransferred);
    // A loan runs for a season and then it is over, whichever way the target
    // went. `endLoan` leaves a youth spell alone — a youth-team player is
    // still a youth-team player in August — and only rewrites the contract
    // for somebody who is genuinely still at the club he was loaned to.
    const next = endLoan(rolled);
    toastAchievements(newlyUnlocked);
    toastRatingChange(starsNow(from), starsNow(next));
    // ── A club you just SIGNED for is not "promoted" ──
    //
    // Getting here via a forced relegation move means `from.player.club` is
    // already the new club chosen on the RelegationMove screen — that screen,
    // plus the transfer media post, already told this story. If that new
    // club happens to be a Premier League side, resolveLadder still reads it
    // as your division changing (it has no way to know a signing decision
    // isn't a ladder outcome), which would otherwise put "Chelsea are
    // promoted" on the banner below for a club that was never anywhere near
    // the play-offs. yourMove is the only thing that banner reads.
    if (forcedRelegationMove && next.ladderNews) {
      next.ladderNews = { ...next.ladderNews, yourMove: null };
    }
    // ── The close season has a media cycle too ──
    //
    // Career moments go through exactly the same pipeline as a match: same
    // events, same accounts, same templates. A sacking, a Ballon d'Or and a
    // hat-trick are the same shape of thing to the engine, which is the whole
    // reason there is one engine rather than two.
    if (userWon) {
      next.media = generateForCareer(next, { kind: "ballon-dor", won: true, total: next.ballonDorWins }, "bdor");
    }
    const honours = (next.awards ?? []).filter(a => a.season === from.season);
    for (const a of honours) {
      next.media = generateForCareer({ ...next, media: next.media },
        { kind: "award", won: true, award: a.kind, detail: a.detail }, `award-${a.kind}`);
    }
    if (next.managerNews && next.manager) {
      next.media = generateForCareer({ ...next, media: next.media },
        { kind: "manager-out", name: from.manager?.name ?? "The manager",
          incoming: next.manager.name, reason: next.managerNews }, "gaffer");
    }
    if (next.lastSeasonJudgement) {
      next.media = generateForCareer({ ...next, media: next.media },
        { kind: "season-end", position: leaguePosition(from),
          headline: next.lastSeasonJudgement.headline, detail: next.lastSeasonJudgement.detail }, "review");
    }
    setCareer(next);
    // The Golden Boot, the trophy cabinet, a Team of the Season — shown
    // once, right here, before whatever the rollover itself has to say
    // (the ladder, a forced renewal). `lastSeasonAwardStats` was stashed on
    // `next` back in endSeason, before any of this touched the numbers it
    // is built from; see lib/star/seasonAwards.ts for why the trophy half
    // of that screen is read fresh off `next` instead of also living in
    // that snapshot.
    if (next.lastSeasonAwardStats) {
      setActiveNav(null);
      setPhase("season-awards");
      return;
    }
    continueAfterRollover(next);
  }, [continueAfterRollover]);

  const handleSeasonAwardsContinue = useCallback(() => {
    if (career) continueAfterRollover(career);
  }, [career, continueAfterRollover]);

  const openTransferWindowOrRoll = useCallback((from: CareerState, userWon: boolean) => {
    // Bottom four of National League North/South go down to Step 3, which
    // has no fixtures (Mikey, 2 Oct 2026), so finishing there forces a move.
    if (isRegionalDivision(divisionOf(from))
      && sortLeague(from.league).slice(-4).some(t => t.name === from.player.club)) {
      const forced = generateRelegationOffers(from, mulberry32(from.season * 8831 + from.fame));
      if (forced.length > 0) {
        setTransferOffers(forced);
        setPhase("relegation-move");
        return;
      }
    }
    // ── A loan that hit its number ──
    //
    // The parent club's interest is a real `TransferOffer` in the ordinary
    // summer window rather than a scripted teleport home: the existing
    // window and `acceptOffer` handle it with no change at all, and you can
    // still turn it down and stay where you are playing every week. Miss
    // the number and nothing arrives — see `loanRecallOffer` (youth.ts).
    const recall = loanRecallOffer(from);
    const offers = [
      ...(recall ? [recall] : []),
      ...generateOffers(from, mulberry32(from.season * 7717 + from.fame)),
    ];
    if (offers.length > 0) {
      setTransferOffers(offers);
      setPhase("season-transfer");
      return;
    }
    rollOverSeason(from, userWon);
  }, [rollOverSeason]);

  const handleBallonDorContinue = useCallback((userWon: boolean) => {
    if (!career) return;
    setWonBallonDor(userWon);
    // Old enough to stop? That decision comes before anything about next season,
    // because there might not be one.
    if (retirementCheck(career).canRetire) {
      setPhase("retirement");
      return;
    }
    openTransferWindowOrRoll(career, userWon);
  }, [career, openTransferWindowOrRoll]);

  const handleRetire = useCallback(() => {
    if (!career) return;
    const done = retire(career);
    done.media = generateForCareer(done, {
      kind: "retirement", goals: done.careerStats.goals,
      apps: done.careerStats.appearances, trophies: done.trophies.length,
    }, "retire");
    setCareer(done);
    setPhase("legacy");
  }, [career]);

  const handlePlayOn = useCallback(() => {
    if (!career) return;
    openTransferWindowOrRoll(career, wonBallonDor);
  }, [career, wonBallonDor, openTransferWindowOrRoll]);

  // A club picked, but not yet signed for — see handleChooseTransfer/
  // handleSigningDone below. `wasRelegationMove` is captured at the moment
  // of picking, not read off `phase` when signing actually completes: by
  // then `phase` is "transfer-signing", not "relegation-move", so reading it
  // fresh there would always read false and silently drop the forced-move
  // handling for a relegated player.
  const [pendingSignOffer, setPendingSignOffer] = useState<{ offer: TransferOffer; wasRelegationMove: boolean } | null>(null);

  // Choosing a club used to complete the move immediately — no contract, no
  // signature, nothing that looked like the moment your very first pro deal
  // got. Requested directly: a transfer should "do the exact same contract
  // thing" TrialReward's own signing step does. This just records which club
  // you picked and hands off to that same signing moment (TransferSigning,
  // built on TrialReward's exported SignaturePad/CongratulationsBanner); the
  // move itself only actually happens once you press Sign it — see
  // handleSigningDone.
  const handleChooseTransfer = useCallback((offer: TransferOffer) => {
    setPendingSignOffer({ offer, wasRelegationMove: phase === "relegation-move" });
    setPhase("transfer-signing");
  }, [phase]);

  const handleSigningDone = useCallback(() => {
    if (!career || !pendingSignOffer) return;
    const { offer, wasRelegationMove } = pendingSignOffer;
    const moved = acceptOffer(career, offer);
    // New club, new team-mates. Same best-effort rule as career creation: the
    // move completes immediately with the generated squad acceptOffer gives it,
    // and the real one lands a moment later.
    fetchRealSquad(offer.club).then((squad) => {
      setCareer(c => (c && c.player.club === offer.club ? { ...c, squad } : c));
    });
    // Done deal, farewell and unveiling — three posts from one moment, and the
    // roster regenerates around the new club, so from here it is his fans
    // talking about you and your old rival who has stopped caring.
    moved.media = generateForCareer(moved,
      { kind: "transfer", from: career.player.club, to: offer.club, fee: offer.signingFee }, "transfer");
    pushNews(signingNews(moved, offer.club));
    setCareer(moved);
    setTransferOffers([]);
    setPendingSignOffer(null);
    // `justTransferred: true` — `moved.contract` is the new club's deal, not
    // one stayed on for the season; see advanceSeason's own doc on why this
    // has to be told rather than inferred from `moved` alone.
    rollOverSeason(moved, wonBallonDor, wasRelegationMove, true);
  }, [career, pendingSignOffer, wonBallonDor, rollOverSeason, pushNews]);

  const handleStayPut = useCallback(() => {
    if (!career) return;
    setTransferOffers([]);
    rollOverSeason(career, wonBallonDor);
  }, [career, wonBallonDor, rollOverSeason]);

  // Testing tool only — see lib/star/devSkip.ts. Runs the fast-forward and
  // drops the result straight on the dashboard; a season boundary crossed
  // along the way is resolved silently by skipTo itself, so there is never a
  // ballon-dor/ladder/contract screen to route through here.
  const handleDevSkip = useCallback((target: SkipTarget) => {
    if (!career) return;
    const { career: after } = skipTo(career, target);
    setCareer(after);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career]);

  const handleAddMoney = useCallback((amount: number) => {
    if (!career || amount <= 0) return;
    setCareer({ ...career, money: career.money + amount });
  }, [career]);
  // Settings → Dev: top up the Store's Coins for testing (lib/star/store/career.ts).
  const handleAddCoins = useCallback((amount: number) => {
    setCareer(c => (c ? addCoins(c, amount) : c));
  }, []);

  // ── Dev — Career shortcuts ──
  //
  // Requested directly: everything that would otherwise need real playtime
  // to reach (captaincy, reputation, fame, training gains, happiness, a club
  // move) gets a dev cheat, the same unguarded spirit as handleAddMoney
  // above. See DevCareerPanel.tsx.
  const handleSetCaptain = useCallback((captain: boolean) => {
    if (!career) return;
    setCareer({ ...career, captain });
  }, [career]);

  const handleSetReputation = useCallback((delta: number) => {
    if (!career) return;
    setCareer({ ...career, reputation: Math.max(0, Math.min(100, delta >= 100 ? 100 : career.reputation + delta)) });
  }, [career]);

  const handleSetFame = useCallback((delta: number) => {
    if (!career) return;
    // Fame is capped at 100 (fame.ts), so "Max" is 100, not the old uncapped 100,000.
    setCareer({ ...career, fame: Math.max(0, Math.min(100, delta >= 100 ? 100 : career.fame + delta)) });
  }, [career]);

  const handleMaxSkills = useCallback(() => {
    if (!career) return;
    setCareer({
      ...career,
      skills: { pace: 99, power: 99, technique: 99, vision: 99, freeKick: 99 },
    });
  }, [career]);

  // Dev: open every training level (one star on each) so any of the 30 can
  // be played without climbing to it. Keeps any better stars already won.
  const handleUnlockTraining = useCallback(() => {
    if (!career) return;
    const keys: (keyof Skills)[] = ["pace", "power", "technique", "vision", "freeKick"];
    const trainingStars = { ...(career.trainingStars ?? {}) };
    for (const k of keys) trainingStars[k] = starsOf(career, k).map(s => Math.max(1, s));
    setCareer({ ...career, trainingStars });
  }, [career]);

  const handleSetHappiness = useCallback((delta: number) => {
    if (!career) return;
    setCareer({ ...career, happiness: Math.max(0, Math.min(100, delta >= 100 ? 100 : career.happiness + delta)) });
  }, [career]);

  const handleSwitchClub = useCallback((club: string) => {
    if (!career) return;
    setCareer(attachClub(career, club, career.league.map(t => t.name), career.division ?? "premier"));
  }, [career]);

  /**
   * "Refresh Player Photos" (SettingsScreen) — a user-triggered version of
   * the same background refresh already run on load (see the mount effect's
   * shouldUpgradeSquad/shouldUpgradeLeagueSquads/shouldUpgradeExternalSquads
   * block), minus the staleness gate: those only fire while a squad still
   * reads as too thin or too image-sparse to trust, so a save that already
   * cleared that bar once never rechecks, and a photo added to the database
   * afterward never arrives on its own. Requested directly, from a real
   * report that an old save's faces are mostly blank next to a new save's
   * almost-complete set. Merges via the exact same functions the automatic
   * path uses (mergeSquadStats / mergeLeagueSquadStats), so this season's
   * goals and assists are exactly as untouched as a normal background
   * refresh already leaves them.
   */
  const handleRefreshPhotos = useCallback(async () => {
    if (!career) return;
    const clubs = career.league.map(t => t.name);
    const [freshSquad, freshLeague, freshExternal] = await Promise.all([
      fetchRealSquad(career.player.club),
      fetchLeagueSquads(clubs),
      fetchLeagueSquads(externalClubsFor(clubs)),
    ]);
    setCareer(c => {
      if (!c) return c;
      // Photos only: a refresh must never undo a transfer, a grown rating or
      // a signing (see refreshLeagueSquadPhotos). A failed fetch changes nothing.
      const dissolved = (club: string) => !!c.ownedClubs?.[club]?.dissolvedInto;
      const squad = shouldUpgradeSquad(c.squad ?? []) ? mergeSquadStats(freshSquad, c.squad ?? []) : refreshSquadPhotos(freshSquad, c.squad ?? []);
      const leagueSquads = isRealFetch(freshLeague) ? refreshLeagueSquadPhotos(c.leagueSquads ?? [], freshLeague, dissolved) : (c.leagueSquads ?? []);
      const externalSquads = isRealFetch(freshExternal) ? refreshLeagueSquadPhotos(c.externalSquads ?? [], freshExternal, dissolved) : (c.externalSquads ?? []);
      return { ...c, squad, leagueSquads, externalSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) };
    });
  }, [career]);

  /**
   * Every piece of UI state that belongs to WHICHEVER career happens to be
   * on screen right now, reset back to how it looks on a fresh page load —
   * used whenever the save actually on screen is about to change, so a save
   * that replaces the one just showing can never inherit a stray press
   * question, vote, or in-flight transfer offer that was really about the
   * career being left behind.
   *
   * `career`, `phase` and `cloudLoading` are NOT reset here — whatever calls
   * this sets all three itself, to the values the save actually being
   * loaded calls for; clearing them here first would just be an extra
   * render on the way to the same place.
   */
  const resetTransientState = useCallback(() => {
    setActiveNav(null);
    setTrainingTab("training");
    setTrainingSkill(null);
    setTrainingLevel(null);
    setLastMatchStats(null);
    setCurrentDilemma(null);
    setContractOfferReason(null);
    setInvestmentsEntry(null);
    setUnlockedAchievements([]);
    setEarnPops([]);
    prevCareerRef.current = null;
    setRatingChange(null);
    setRelationshipGameKind(null);
    setPendingVote(null);
    setTransferOffers([]);
    setPressQuestion(null);
    setWonBallonDor(false);
    setPlayedFixture(null);
    setPendingDraw(null);
    setPotmWin(null);
    setShowTeams(false);
    setWatchingReplay(null);
    setPendingSignOffer(null);
  }, []);

  /**
   * Loads whichever save is at `slot` into every piece of state a career
   * actually needs — the same local-vs-cloud reconciliation the game has
   * always done for the one save an account used to have (see
   * loadCareerFromCloud's own doc on why cloud is never simply preferred
   * outright), now reusable for switching between several: every background
   * squad/media fetch an existing career might still be missing still runs,
   * and a resumable phase (the Ballon d'Or, a pending contract, …) is still
   * resumed rather than always landing back on the dashboard.
   *
   * This is ALSO where a brand new, never-played slot ends up: nothing is
   * found, `career` is left null, and `phase === "profile-setup" || !career`
   * (the render section below) is exactly what a first-ever install of the
   * game has always shown for that.
   *
   * The empty dependency array is deliberate and safe: every setter React
   * hands back is stable across renders, `resetTransientState` above is its
   * own stable useCallback, and everything else this closes over
   * (fetchRealSquad, externalClubsFor, …) is a plain imported function, not
   * component state — so this itself never needs to be recreated.
   */
  // `chosen`: the copy the player picked on SaveClashPrompt — load exactly
  // that, without asking the cloud again.
  const loadCareerIntoState = useCallback(async (slot: number, chosen?: CareerState) => {
    setCloudLoading(true);
    resetTransientState();
    const scope = slotScope(scopeRef.current, slot);
    // Which copy — this device's or the cloud's — is lib/star/saveClash.ts's
    // call now (it used to be "whichever was written later"). When both have
    // progress the other lacks, nothing loads until the player picks one.
    let saved: CareerState | null;
    if (chosen) {
      saved = chosen;
    } else {
      const outcome = await reconcileCareerLoad(scopeRef.current, slot);
      if (outcome.kind === "clash") {
        setCareer(null);
        setSaveClash(outcome.clash);
        setCloudLoading(false);
        return;
      }
      saved = outcome.career;
    }
    setCloudLoading(false);
    setCareer(saved ?? null);
    if (!saved) { setPhase("profile-setup"); return; }

    // ── One shared set of team sheets, not whichever this device happens
    // to have cached ── see lib/star/lineupStore.ts. Fired the same way the
    // squad fetches below are: in the background, not blocking anything —
    // by the time a team sheet is actually drawn this has almost always
    // already landed.
    fetchSharedLineups();

    // ── An existing career gets the real dressing room too ──
    //
    // Careers created before the roster fetch have a generated squad — or, if
    // they predate squads entirely, one backfilled on load. Either way the names
    // are invented, and the club they play for is a real club whose real squad
    // is one request away. See shouldUpgradeSquad for what the rule is and what
    // it used to be.
    // ── A career with no club yet has no club data to fetch ──
    //
    // `makeIdentity` (careerFlow.ts) gives a real, saveable career to
    // somebody nobody has signed: no league, no fixtures, an empty squad.
    // Every fetch below keys off a club name or a division's team list, so
    // for that career they would ask the server for the squad of "" and the
    // division made of no clubs — three pointless round trips whose empty
    // answers then look exactly like a failed fetch. It gets its phase
    // resumed like any other career; it just has nothing to load.
    if (!hasClub(saved)) {
      // ── Count the resume FIRST ──
      //
      // This is the anti-cheat three separate comments promised and nothing
      // delivered. `noteReload` had no caller anywhere outside its own tests,
      // so `reloads` was zero for every career that has ever existed.
      //
      // The first attempt at wiring it up put the call AFTER the resumable-
      // phase check below — and a playtest caught that it still never fired,
      // because "trial-stages" is itself resumable, so every ordinary reload
      // mid-trial took the early return and walked straight past it. A fix
      // that reads correctly and never executes is worse than no fix; this
      // now happens before anything can return.
      //
      // Re-opening is still never blocked. It just quietly costs.
      // `noteReload` returns the SAME trial object when the load interrupted
      // nothing and so was not charged for. Building `{ ...saved, ... }`
      // unconditionally threw that away — the object identity differed every
      // time, so `resumed !== saved` was always true and the career was
      // re-saved on every load, including the ones that cost nothing. Compare
      // the trial, which is the thing that can actually have changed.
      const nextTrial = saved.trial && !trialComplete(saved.trial)
        ? noteReload(saved.trial)
        : saved.trial;
      const resumed = nextTrial === saved.trial ? saved : { ...saved, trial: nextTrial };
      if (resumed !== saved) setCareer(resumed);

      const pendingNoClub = loadStarPhase(scope);
      if (pendingNoClub) { setPhase(pendingNoClub.phase); return; }
      // A real, saved career that nobody has signed — mid-trial, or a free
      // agent. It belongs on its own shell, never on the club dashboard and
      // never back at Profile Setup, which would look like losing the save.
      setPhase(clublessPhaseFor(resumed));
      return;
    }

    if (shouldUpgradeSquad(saved.squad ?? [])) {
      fetchRealSquad(saved.player.club).then((real) => {
        setCareer(c => (c && c.player.club === saved.player.club && shouldUpgradeSquad(c.squad ?? [])
          ? { ...c, squad: real } : c));
      });
    }

    // ── …and so does the rest of the division ──
    //
    // An existing career has no league squads at all, so its Golden Boot is
    // still the old invented race. Fetched once, in the background, and only
    // when there is nothing there — a division that has been scoring all season
    // must not be wiped back to nought by a page refresh.
    if (!(saved.leagueSquads ?? []).length) {
      fetchLeagueSquads(saved.league.map(t => t.name)).then((leagueSquads) => {
        setCareer(c => (c && !(c.leagueSquads ?? []).length
          ? { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) } : c));
      });
    } else {
      // ── The rest of the division, refetched on every load ──
      //
      // The save only keeps what this career did to these squads (see
      // lib/star/squadSaveCodec.ts) — photos, flags and attributes come back
      // from this fetch. `hydrateSquads` only ever fills a field a player is
      // missing, so this season's goals and anything the career changed stay
      // exactly as saved.
      //
      // A division fetched before faces and flags existed is still merged the
      // old way — judged AFTER filling in, and only when the fetch actually
      // reached the database: judged before, a thin save (no flags yet) would
      // look pre-flags and a failed fetch would merge invented players over
      // the real division.
      fetchLeagueSquads(saved.league.map(t => t.name)).then((fresh) => {
        setCareer(c => {
          if (!c || !(c.leagueSquads ?? []).length) return c;
          const filled = hydrateSquads(c.leagueSquads ?? []);
          if (isRealFetch(fresh) && shouldUpgradeLeagueSquads(filled)) {
            const leagueSquads = mergeLeagueSquadStats(fresh, filled);
            return { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) };
          }
          return filled === c.leagueSquads ? c : { ...c, leagueSquads: filled };
        });
      });
    }

    // ── …and the wider world ──
    if (!(saved.externalSquads ?? []).length) {
      fetchLeagueSquads(externalClubsFor(saved.league.map(t => t.name))).then((externalSquads) => {
        setCareer(c => (c && !(c.externalSquads ?? []).length ? { ...c, externalSquads } : c));
      });
    } else {
      // Refetched on every load, like the division above: the save keeps only
      // what the career changed, and this fills the rest back in. Clubs the
      // save is missing or only has invented players for are brought up to
      // date by reconcileExternalSquads — which, unlike the plain merge that
      // used to run here on (as it turned out) every single load, never
      // throws away a transfer, a grown rating or a signing at a club you own.
      fetchLeagueSquads(externalClubsFor(saved.league.map(t => t.name))).then((fresh) => {
        setCareer(c => {
          if (!c || !(c.externalSquads ?? []).length) return c;
          const externalSquads = reconcileExternalSquads(
            hydrateSquads(c.externalSquads ?? []), fresh,
            club => !!c.ownedClubs?.[club]?.dissolvedInto,
          );
          return { ...c, externalSquads };
        });
      });
    }

    // A finished career has one screen and no way back into the season.
    if (saved.retired) { setPhase("legacy"); return; }

    // Resume a phase the career cannot get out of on its own. Reloading used to
    // always land on the dashboard, which at the end of a season meant no
    // fixture left to play and no way to reach the Ballon d'Or — the career was
    // stuck there for good.
    const pending = loadStarPhase(scope);
    const seasonOver = saved.fixtures.every((f) => f.played);
    if (pending?.phase === "ballon-dor" && seasonOver) {
      setPhase("ballon-dor");
      return;
    }
    if (pending?.phase === "contract-renewal") {
      setContractOfferReason(pending.offerReason ?? null);
      setPhase("contract-renewal");
      return;
    }
    if (pending?.phase === "retirement" && retirementCheck(saved).canRetire) {
      setWonBallonDor(!!pending.wonBallonDor);
      setPhase("retirement");
      return;
    }
    // A save from before the five-stage trial existed, caught mid-penalty.
    // "trial" was one penalty taken until it went in, on a screen that is
    // gone; the opening is TrialSequence now. Nothing is lost by moving them
    // across — that screen held no state of its own, which is exactly why it
    // was safe to resume into in the first place.
    if (pending?.phase === "trial" && !saved.clubAppearances) {
      setPhase("trial-stages");
      return;
    }
    if (pending?.phase === "relegation-move") {
      // The one transfer screen you cannot walk away from — see RESUMABLE in
      // storage.ts. Regenerated on the same terms as the window below it:
      // the seed is the season and your fame, neither of which has moved, so
      // these are the same clubs that were on screen when the page reloaded.
      const offers = generateRelegationOffers(saved, mulberry32(saved.season * 8831 + saved.fame));
      if (offers.length > 0) {
        setWonBallonDor(!!pending.wonBallonDor);
        setTransferOffers(offers);
        setPhase("relegation-move");
        return;
      }
    }
    if (pending?.phase === "season-transfer") {
      // Regenerated rather than stored: the seed is the season and the player's
      // fame, neither of which has moved, so these are the same offers.
      const offers = generateOffers(saved, mulberry32(saved.season * 7717 + saved.fame));
      if (offers.length > 0) {
        setWonBallonDor(!!pending.wonBallonDor);
        setTransferOffers(offers);
        setPhase("season-transfer");
        return;
      }
    }
    setPhase("dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sends whatever the OUTGOING save has right now to the cloud immediately,
  // rather than trusting the cloud-save effect's 3 s debounce to still be
  // running by the time it would have fired. That debounce is fine to just
  // let expire everywhere else; switching away is the one moment guaranteed
  // to leave it no chance to.
  const flushCloudSave = useCallback(() => {
    pendingCloudSave.current = null;
    if (cloudSaveTimer.current) {
      clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
    if (career) saveCareerToCloud(career, activeSlotRef.current, { scope: slotScope(scopeRef.current, activeSlotRef.current) });
  }, [career]);

  /** Switch which save is on screen — see SaveSlotsPanel in Settings. */
  const handleSwitchSave = useCallback((slot: number) => {
    if (slot === activeSlotRef.current) return;
    flushCloudSave();
    setActiveSlot(slot);
    loadCareerIntoState(slot);
  }, [flushCloudSave, setActiveSlot, loadCareerIntoState]);

  /**
   * Start a brand new career in an EMPTY slot — every other save, including
   * the one just left, is completely untouched. See SaveSlotsPanel in
   * Settings; a full, destructive restart of the CURRENT slot is
   * handleFullReset, just below.
   */
  const handleStartNewInSlot = useCallback((slot: number) => {
    flushCloudSave();
    setActiveSlot(slot);
    resetTransientState();
    setCareer(null);
    setCloudLoading(false);
    setPhase("profile-setup");
  }, [flushCloudSave, setActiveSlot, resetTransientState]);

  /**
   * Delete one save outright. Deleting the active slot leaves it empty and
   * open on Profile Setup, exactly like handleFullReset just below;
   * deleting any other slot simply removes it from the list. See
   * SaveSlotsPanel in Settings.
   */
  // No browser confirm() box: it throws the player out of full screen
  // (Mikey, 28 Sep 2026). The Delete buttons ask "Sure?" on the screen
  // themselves before calling this.
  const handleDeleteSave = useCallback((slot: number) => {
    clearCareer(slotScope(scopeRef.current, slot));
    clearCareerFromCloud(slot);
    if (slot === activeSlotRef.current) {
      resetTransientState();
      setCareer(null);
      setPhase("profile-setup");
    } else {
      // Nothing about the screen actually on show just changed — bump a
      // counter that IS state purely so the Saves list (which reads
      // listSaveSlots fresh on every render, not from a cache) re-renders
      // to show this slot empty.
      bumpSaves(v => v + 1);
    }
  }, [resetTransientState]);

  /**
   * "Move my saves" just wrote saves from a pasted code (MoveSavesPanel —
   * Safari and an iPhone Home Screen app keep separate saves). The career on
   * screen may be one of the slots just replaced, so nothing of it may be
   * saved again: its pending upload is dropped, not flushed. Then the chosen
   * save opens fresh, through the same load as switching saves.
   */
  const handleImportedSaves = useCallback((slot: number) => {
    pendingCloudSave.current = null;
    if (cloudSaveTimer.current) { clearTimeout(cloudSaveTimer.current); cloudSaveTimer.current = null; }
    latestCareerRef.current = null;
    setGlobalSettings(false);
    setActiveSlot(slot);
    void loadCareerIntoState(slot);
  }, [setActiveSlot, loadCareerIntoState]);

  // ── The title screen's choices ── each one is an existing handler; the
  // title only decides where to go.
  const handleTitleNewGame = useCallback((slot: number) => {
    setTitleOpen(false);
    if (slot === activeSlotRef.current && !career) { setPhase("profile-setup"); return; }
    handleStartNewInSlot(slot);
  }, [career, handleStartNewInSlot]);
  const handleTitleLoad = useCallback((slot: number) => {
    setTitleOpen(false);
    if (slot !== activeSlotRef.current) handleSwitchSave(slot);
  }, [handleSwitchSave]);
  // The title's Tutorial button (P64): a save on Home replays the pointer tour
  // there; no save starts a new career, whose first Home runs the tutorial.
  const handleTitleTutorial = useCallback(() => {
    if (!career) { handleTitleNewGame(activeSlotRef.current); return; }
    setTitleOpen(false);
    if (phase === "dashboard" && career.unlocks) { setHomePage(1); setHelpTour(HELP_TOURS.home); }
  }, [career, phase, handleTitleNewGame]);
  const handleExitToTitle = useCallback(() => {
    if (settingsFromTitle) {
      setPhase(settingsFromTitle);
      setSettingsFromTitle(null);
    } else if (career && !hasClub(career)) {
      setPhase(clublessPhaseFor(career));
    } else {
      setActiveNav("home");
      setPhase("dashboard");
    }
    setTitleOpen(true);
  }, [settingsFromTitle, career]);

  const handleFullReset = useCallback(() => {
    const reset = () => {
      clearCareer(slotScope(scopeRef.current, activeSlotRef.current));
      clearCareerFromCloud(activeSlotRef.current);
      resetTransientState();
      setCareer(null);
      setPhase("profile-setup");
    };
    // In-app, not confirm(): a browser box throws the player out of full screen.
    if (career?.retired) reset();
    else void askConfirm("Delete this career and start over?", "Delete").then(ok => { if (ok) reset(); });
  }, [career, resetTransientState]);

  // Shop buys
  const handleBuyKib = useCallback((can: KibCan) => {
    const price = kibCanPrice(can, career?.contract.wage ?? 0);
    if (!career || career.money < price) return;
    setCareer({
      ...career,
      money: career.money - price,
      kibCans: { ...career.kibCans, [can.id]: career.kibCans[can.id] + 1 },
    });
  }, [career]);

  const handleUseCan = useCallback((id: "basic" | "premium" | "elite") => {
    if (!career || career.kibCans[id] === 0) return;
    const can = KIB_CANS.find((c) => c.id === id)!;
    // A boot-ability can does nothing if that ability is already waiting.
    if (can.effect && career.kibAbility?.[can.effect]) return;
    // …and an energy can does nothing at full energy (v0.15 item 28).
    if (!can.effect && career.energy >= 100) return;
    // Premium and Elite give their ability AND some energy (P5, 1 Oct 2026).
    sfx("can-open");
    setCareer({
      ...career,
      kibCans: { ...career.kibCans, [id]: career.kibCans[id] - 1 },
      ...(can.effect ? { kibAbility: { ...career.kibAbility, [can.effect]: true } } : {}),
      energy: Math.min(100, career.energy + can.restore),
    });
  }, [career]);

  const handleBuyBoot = useCallback((boot: Boot) => {
    if (!career || career.money < boot.price) return;
    // Buying the SAME pair you're already wearing stacks the matches left
    // rather than overwriting them — requested directly, with the exact
    // arithmetic: 3 left, buy two more pairs, one match played, one more
    // pair bought = 3 - 1 + 3 + 3 + 3 = 11. A DIFFERENT boot still replaces
    // outright; switching boots mid-career was always meant to give up
    // whatever was left on the old pair, and stacking only makes sense for
    // more of the exact same thing.
    const stacking = career.currentBoot.id === boot.id;
    setCareer({
      ...career,
      money: career.money - boot.price,
      currentBoot: stacking
        ? { ...boot, matches: career.currentBoot.matches + boot.matches }
        : { ...boot },
    });
  }, [career]);

  const handleBuyItem = useCallback((item: OwnedItem) => {
    // You can own each item once — but a WORN-OUT one can be bought again,
    // which replaces it (fame.ts). Owning it raises fame through fameOf(),
    // not by adding to earned fame, so it disappears again if it breaks.
    // Levels (27 Sep 2026): you own one level of each item. Buying a higher
    // level replaces the one you have; the same or a lower level is only for
    // replacing a worn-out one.
    const base = item.baseId ?? item.id;
    const owned = career?.ownedItems.find((o) => (o.baseId ?? o.id) === base);
    const ownedLevel = owned ? (owned.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === owned.id)?.level ?? 0) : 0;
    if (!career || career.money < item.price) return;
    if (owned && !isWornOut(owned) && (item.level ?? 0) <= ownedLevel && ownedLevel > 0) return;
    if (owned && !isWornOut(owned) && owned.id === item.id) return;
    const bought: CareerState = {
      ...career,
      money: career.money - item.price,
      ownedItems: [...career.ownedItems.filter((o) => (o.baseId ?? o.id) !== base), freshItem(item)],
      happiness: Math.min(100, career.happiness + Math.floor(item.lifestyleValue / 3)),
    };
    // Unlock chain: buying the phone opens the Phone button, and takes you
    // straight back Home to see it (Harry, 1 Oct 2026, P38).
    if (base === "phone" && !isOpen(career, "phone")) {
      setCareer(recordPhoneBought(bought));
      setChainPop({ label: "Buy a phone", unlocked: "Phone and App Store unlocked", phone: true });
      setHomePage(1);
      setActiveNav("home");
      setPhase("dashboard");
      return;
    }
    setCareer(bought);
  }, [career]);

  // ── Sponsors (lib/star/sponsorDeals.ts) ──
  const [sponsorNote, setSponsorNote] = useState<string | null>(null);
  const [sponsorNegId, setSponsorNegId] = useState<string | null>(null);
  const noteSponsor = (msg: string) => { setSponsorNote(msg); setTimeout(() => setSponsorNote(null), 4000); };
  const sponsorActions = {
    onAdvert: (id: string) => {
      if (!career || !canAct(career)) { noteSponsor("No days left this week."); return; }
      setAdvertDealId(id); setPhase("advert-shoot");
    },
    advertDone: !!career && gamePlayedThisWeek(career.relGamesPlayed, career.season, career.week, "advert"),
    onSign: (id: string) => {
      if (!career) return;
      const r = signOffer(career, id);
      if (r.ok) { setCareer(r.career); noteSponsor(r.message); } else noteSponsor(r.reason);
    },
    onDecline: (id: string) => { if (career) setCareer(declineOffer(career, id)); },
    onNegotiate: (id: string) => { setSponsorNegId(id); setPhase("sponsor-negotiation"); },
    onAskLonger: (id: string) => {
      if (!career) return;
      const r = askLonger(career, id, Math.random());
      setCareer(r.career); noteSponsor(r.yes ? "They agreed: one more season." : "They said no to a longer deal.");
    },
    onAskEasier: (id: string) => {
      if (!career) return;
      const r = askEasier(career, id, Math.random());
      setCareer(r.career); noteSponsor(r.yes ? "They agreed: easier targets." : "They said no to easier targets.");
    },
    onCounter: (id: string) => {
      if (!career) return;
      const r = counterPoach(career, id, Math.random());
      setCareer(r.career); noteSponsor(r.matched ? "Your sponsor matched the offer." : "Your sponsor would not match it.");
    },
    onWalkAway: (id: string) => {
      if (!career) return;
      const r = walkAway(career, id);
      if (r.ok) { setCareer(r.career); noteSponsor(r.message); } else noteSponsor(r.reason);
    },
  };

  const handleBuyHorse = useCallback((horse: Horse, price: number) => {
    if (!career || career.money < price || career.horse) return;
    setCareer({ ...career, money: career.money - price, horse });
  }, [career]);

  const handleHorseRace = useCallback((finish: number, prize: number, energyCost: number) => {
    if (!career || !career.horse) return;
    setCareer({
      ...career,
      money: career.money + prize,
      horse: {
        ...career.horse,
        energy: Math.max(0, career.horse.energy - energyCost),
        racesRun: career.horse.racesRun + 1,
        racesWon: career.horse.racesWon + (finish === 1 ? 1 : 0),
        earnings: career.horse.earnings + prize,
      },
    });
  }, [career]);

  const handleRenameHorse = useCallback((name: string) => {
    if (!career) return;
    setCareer(renameHorse(career, name));
  }, [career]);

  // Stake itself already left the casino's `bank` (see Casino.tsx's own
  // onSetBank call, which flows back into career.money on exit exactly like
  // any other casino loss) — this only records the bet so it can actually
  // settle against a real result at the next rollover (see advanceSeason's
  // settleBets call, careerFlow.ts).
  const handlePlaceBet = useCallback((bet: Omit<CompetitionBet, "id">) => {
    if (!career || !canPlaceCompetitionBet(career)) return;
    const id = `bet-${career.season}-${(career.competitionBets ?? []).length}-${Math.round(Math.random() * 1e6)}`;
    setCareer({ ...career, competitionBets: [...(career.competitionBets ?? []), { ...bet, id }] });
  }, [career]);

  // Investments — every action below is a pure CareerState -> CareerState
  // function in lib/star/investments.ts; this is only the setCareer wiring.
  const handleBuyStake = useCallback((club: string, percent: number) => {
    if (!career) return;
    setCareer(buyStake(career, club, percent));
  }, [career]);
  const handleSellStake = useCallback((club: string, percent: number) => {
    if (!career) return;
    const sold = sellStake(career, club, percent);
    if (sold.money > career.money) sfx("coin-in");
    setCareer(sold);
  }, [career]);
  const handleTopUpClubBudget = useCallback((club: string, amount: number) => {
    if (!career) return;
    setCareer(topUpClubBudget(career, club, amount));
  }, [career]);
  const handleSignPlayerForOwnedClub = useCallback((club: string, playerId: string, fromClub: string, agreedFee?: number) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = signPlayerForOwnedClub(career, club, playerId, fromClub, agreedFee);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);
  // Reported directly, 14 Sep 2026: a majority (in this report, 100%)
  // shareholder shouldn't be FORCED through a vote to sell their own
  // player — the mandatory vote (Phase 2 of STAR_POWER_POLITICS.md's
  // proof-of-concept) made sense as a demonstration of the voting engine,
  // but in practice it's just a click-through obstacle for someone who
  // already owns the club outright. The sale now goes through directly;
  // `handleProposeSellPlayerVote` below is the OPTIONAL version, offered
  // as its own button on the confirmation screen for anyone who actually
  // wants to gauge fan reaction (and can still overrule a bad result).
  const handleSellPlayerFromOwnedClub = useCallback((club: string, playerId: string, agreedFee?: number, buyerClub?: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    // Looked up BEFORE the sale — the player is gone from this squad the
    // moment sellPlayerFromOwnedClub returns. Requested directly, 14 Sep
    // 2026: "these are transfers just like any other... there should be
    // news for them" — a boardroom sale to a real, named buyer is now real
    // transfer news, the same farewell/unveiling posts any other move gets.
    const playerName = findSquadEntry(career, club)?.squad.players.find(p => p.id === playerId)?.name;
    const result = sellPlayerFromOwnedClub(career, club, playerId, agreedFee, buyerClub);
    if (!result.ok) return { ok: false, reason: result.reason };
    let next = result.career;
    if (buyerClub && agreedFee !== undefined && playerName) {
      next = { ...next, media: generateForBoardroomSale(next, club, buyerClub, playerName, agreedFee, `boardroom-sale-${playerId}`) };
    }
    sfx("coin-in");
    setCareer(next);
    return { ok: true };
  }, [career]);
  const handleProposeSellPlayerVote = useCallback((club: string, playerId: string, agreedFee?: number, buyerClub?: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 91721 + career.week * 131 + playerId.length);
    const result = proposeSellPlayerVote(career, club, playerId, rng, agreedFee, buyerClub);
    if (!result.ok) return { ok: false, reason: result.reason };
    setPendingVote({ kind: "sellPlayer", proposal: result.proposal });
    setInvestmentsEntry({ tab: "boardroom", club, section: "squad" });
    setPhase("vote-ceremony");
    return { ok: true };
  }, [career]);

  // Phase 3: the same voting engine, put to two more real decisions — a
  // public kit vote, and a shareholder vote to elect you club president.
  const handleProposeKitVote = useCallback((club: string, optionA: ClubKit, optionB: ClubKit, favor: "a" | "b" | undefined) => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 40361 + career.week * 211 + club.length);
    const result = proposeKitVote(career, club, optionA, optionB, favor, rng);
    if (!result.ok) return { ok: false, reason: result.reason };
    setPendingVote({ kind: "kit", proposal: result.proposal });
    // Reported directly: putting a kit vote up used to dump you back on the
    // Investments screen's Market tab afterwards, not the club's own
    // Boardroom you were actually standing in — the whole Investments tree
    // unmounts (and loses its own internal tab/section state) the moment
    // the phase switches away to "vote-ceremony". Recording where you were
    // here means the SAME club's Powers tab reopens once the vote resolves.
    setInvestmentsEntry({ tab: "boardroom", club, section: "powers" });
    setPhase("vote-ceremony");
    return { ok: true };
  }, [career]);

  const handleProposePresidentVote = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 20887 + career.week * 307 + club.length);
    const result = proposePresidentVote(career, club, rng);
    if (!result.ok) return { ok: false, reason: result.reason };
    setPendingVote({ kind: "president", proposal: result.proposal });
    setInvestmentsEntry({ tab: "boardroom", club, section: "powers" });
    setPhase("vote-ceremony");
    return { ok: true };
  }, [career]);

  const handleVoteDone = useCallback((_accepted: boolean, overrule: boolean) => {
    if (!career || !pendingVote) return;
    const result = pendingVote.kind === "sellPlayer" ? resolveSellPlayerVote(career, pendingVote.proposal, overrule)
      : pendingVote.kind === "kit" ? { career: resolveKitVote(career, pendingVote.proposal), ok: true as const }
      : pendingVote.kind === "president" ? resolvePresidentVote(career, pendingVote.proposal, overrule)
      : pendingVote.kind === "bodyPresidency" ? resolveBodyPresidencyVote(career, pendingVote.proposal, overrule)
      : resolveRuleChangeVote(career, pendingVote.proposal, overrule);
    let nextCareer = result.career;
    // Same real transfer news as the direct-sell path — a sale that went
    // through a vote (or an overrule) is exactly as real a transfer.
    if (pendingVote.kind === "sellPlayer" && result.ok && pendingVote.proposal.buyerClub) {
      const { club, buyerClub, playerName, fee, playerId } = pendingVote.proposal;
      nextCareer = { ...nextCareer, media: generateForBoardroomSale(nextCareer, club, buyerClub, playerName, fee, `boardroom-sale-${playerId}`) };
    }
    setCareer(nextCareer);
    const backTo = (pendingVote.kind === "ruleChange" || pendingVote.kind === "bodyPresidency") ? "rule-book" : "investments";
    setPendingVote(null);
    setPhase(backTo);
  }, [career, pendingVote]);

  const handleProposeBodyPresidency = useCallback((body: GoverningBody) => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 13291 + career.week * 733 + body.length);
    const result = proposeBodyPresidencyVote(career, body, rng);
    if (!result.ok) return { ok: false, reason: result.reason };
    setPendingVote({ kind: "bodyPresidency", proposal: result.proposal });
    setPhase("vote-ceremony");
    return { ok: true };
  }, [career]);
  const handleReplaceManagerForOwnedClub = useCallback((club: string, managerName: string, agreedFee?: number) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = replaceManagerForOwnedClub(career, club, managerName, agreedFee);
    if (result.ok) {
      setCareer(result.career);
      // The Boardroom's own ownedClubs.managerName is a separate, fictional
      // record — real reads (team sheets, VersusScreen, this very Boardroom
      // header) all prefer the REAL saved lineup's manager first (see
      // Investments.tsx's ManagerPanel and 13 Sep 2026's "Manager showing
      // Vacant" fix), which an appointment never touched. Reported directly:
      // appointing a new manager took the fee but the name on screen stayed
      // whoever it was before. Writing the real name into the saved lineup
      // here is what actually makes the appointment visible everywhere.
      const existing = loadLineup(club);
      saveLineup(club, {
        formation: existing?.formation ?? DEFAULT_FORMATION,
        xi: existing?.xi ?? Array(11).fill(null),
        bench: existing?.bench,
        manager: managerName,
      });
    }
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleManagerNegotiationFailed = useCallback((club: string, managerName: string) => {
    if (!career) return;
    setCareer(recordFailedManagerNegotiation(career, club, managerName));
  }, [career]);

  // ── Phase 3 of STAR_POWER_POLITICS.md — the rest of the ownership layer ──
  const handleSetClubFormation = useCallback((club: string, formationId: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = setClubFormation(career, club, formationId);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleSetOwnedLineup = useCallback((club: string, lineup: SavedLineup) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = setOwnedLineup(career, club, lineup);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  // ── Owning the club you actually play for — more power, not less ──
  const handleAppointSelfCaptain = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = appointSelfCaptain(career, club);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleSetTalisman = useCallback((club: string, on: boolean) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = setTalisman(career, club, on);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleTransferSelfTo = useCallback((toClub: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = transferSelfTo(career, toClub);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleSetClubKit = useCallback((club: string, kit: ClubKit) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = setClubKit(career, club, kit);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleSetPresidentWage = useCallback((club: string, wage: number) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = setPresidentWage(career, club, wage);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleMergeClubs = useCallback((primaryClub: string, absorbedClub: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = mergeClubs(career, primaryClub, absorbedClub);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleSubmitRecommendation = useCallback((club: string, kind: RecommendationKind, detail: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = submitRecommendation(career, club, kind, detail);
    if ("ok" in result) return result;
    setCareer(result);
    return { ok: true };
  }, [career]);

  const handleHaveASon = useCallback(() => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = haveASon(career);
    if ("ok" in result) return result;
    setCareer(result);
    return { ok: true };
  }, [career]);

  const handleAgeUpSon = useCallback(() => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 61519 + career.week * 419 + (career.son?.age ?? 0));
    const result = ageUpSonWithPotion(career, rng);
    if ("ok" in result) return result;
    setCareer(result);
    return { ok: true };
  }, [career]);

  const handlePromoteSon = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = promoteSonToFirstTeam(career, club);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleTransferSon = useCallback((toClub: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = transferSon(career, toClub);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  // ── Phase 4 of STAR_POWER_POLITICS.md — the Rule Book ──────────────────
  const handleInvestInfluence = useCallback((body: GoverningBody, amount: number) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = investInfluence(career, body, amount);
    if ("ok" in result) return result;
    setCareer(result);
    return { ok: true };
  }, [career]);

  // Phase 5 of STAR_POWER_POLITICS.md: an optional bribe (§4.3) swaps real
  // votes toward "yes" the moment the tally is rolled — a real risk of
  // getting caught, reduced (never removed) by also hiring lawyers.
  const handleProposeRuleChange = useCallback((
    body: GoverningBody, change: Partial<RuleBook>, bribe?: { amount: number; useLawyers: boolean },
  ) => {
    if (!career) return { ok: false, reason: "No active career" };
    const rng = mulberry32(career.season * 82301 + career.week * 523 + JSON.stringify(change).length);
    const result = proposeRuleChangeVote(career, body, change, rng);
    if (!result.ok) return { ok: false, reason: result.reason };

    let proposal = result.proposal;
    let workingCareer = career;
    if (bribe && bribe.amount > 0) {
      const totalCost = bribe.amount + (bribe.useLawyers ? LAWYER_FEE : 0);
      if (totalCost > workingCareer.money) return { ok: false, reason: "Not enough money for that bribe" };
      workingCareer = { ...workingCareer, money: workingCareer.money - totalCost };
      proposal = { ...proposal, tally: bribeVote(proposal.tally, "yes", bribe.amount) };
      const caughtRng = mulberry32(career.season * 61001 + career.week * 907 + bribe.amount);
      if (rollCaught("bribery", bribe.useLawyers, caughtRng)) {
        workingCareer = applyGettingCaught(workingCareer, "bribery", bribe.amount, "Caught bribing a governing-body vote");
      }
    }
    setCareer(workingCareer);
    setPendingVote({ kind: "ruleChange", proposal });
    setPhase("vote-ceremony");
    return { ok: true };
  }, [career]);

  // ── Phase 7 of STAR_POWER_POLITICS.md — club facilities ─────────────────
  const handleRenameStadium = useCallback((club: string, name: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = renameStadium(career, club, name);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleUpgradeStadiumCapacity = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = upgradeStadiumCapacity(career, club);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleUpgradeTrainingGround = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = upgradeTrainingGround(career, club);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleUpgradeYouthAcademy = useCallback((club: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = upgradeYouthAcademy(career, club);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  // ── Phase 6 of STAR_POWER_POLITICS.md — forced movement and new competitions ──
  const handleForceClubIntoPremierLeague = useCallback((incomingClub: string) => {
    if (!career) return { ok: false, reason: "No active career" };
    const result = forceClubIntoPremierLeague(career, incomingClub);
    if (result.ok) setCareer(result.career);
    return { ok: result.ok, reason: result.reason };
  }, [career]);

  const handleCreateCompetition = useCallback((name: string, entrants: string[]) => {
    if (!career) return { ok: false, reason: "No active career" };
    const created = createCompetition(`comp-${career.season}-${(career.newCompetitions ?? []).length}`, name, entrants);
    if ("ok" in created) return created;
    const rng = mulberry32(career.season * 71011 + career.week * 617 + name.length);
    const strengthOf = (club: string) => career.league.find(t => t.name === club)?.strength ?? 70;
    const finished = playCompetitionToWinner(created, strengthOf, rng);
    setCareer({ ...career, newCompetitions: [...(career.newCompetitions ?? []), finished] });
    return { ok: true };
  }, [career]);

  const handleBuyFromBlackMarket = useCallback((boot: Boot, useLawyers: boolean) => {
    if (!career) return { ok: false, reason: "No active career" };
    const price = blackMarketPrice(boot.price) + (useLawyers ? LAWYER_FEE : 0);
    if (price > career.money) return { ok: false, reason: "Not enough money" };
    const stacking = career.currentBoot.id === boot.id;
    let next: CareerState = {
      ...career,
      money: career.money - price,
      currentBoot: stacking ? { ...boot, matches: career.currentBoot.matches + boot.matches } : { ...boot },
    };
    const rng = mulberry32(career.season * 33301 + career.week * 419 + boot.id.length);
    if (rollCaught("blackMarket", useLawyers, rng)) {
      next = applyGettingCaught(next, "blackMarket", price, `Caught buying banned boots (${boot.name})`);
    }
    setCareer(next);
    return { ok: true };
  }, [career]);

  const handleOpenRelationshipGame = useCallback((kind: RelationshipKind) => {
    setRelationshipGameKind(kind);
    setPhase("relationship-game");
  }, []);

  // The new games (relgames/, Mikey 4 Oct 2026) hand back what moved, and
  // each is played once a week (relationships.ts).
  const markGamePlayed = (c: CareerState, kind: string): CareerState => {
    const p = c.relGamesPlayed;
    const same = p && p.season === c.season && p.week === c.week;
    return { ...c, relGamesPlayed: { season: c.season, week: c.week, kinds: [...(same ? p.kinds : []), kind] } };
  };
  const handleRelationshipGameComplete = useCallback((res: GameResult) => {
    if (!career || !relationshipGameKind) return;
    const gain = res.gain;
    let updated: CareerState = markGamePlayed({ ...career, money: Math.max(0, career.money - (res.cost ?? 0)) }, relationshipGameKind);
    if (relationshipGameKind === "happiness") {
      updated.happiness = applyGameGain(career.happiness, gain);
    } else {
      updated.relationships = {
        ...career.relationships,
        [relationshipGameKind]: applyGameGain(career.relationships[relationshipGameKind] as number, gain),
      };
    }
    // Unlock chain: the first boss meeting is a first step (v0.24: Relations
    // itself opens after the first game; a save from before still opens it here).
    if (relationshipGameKind === "boss" && career.unlocks && !career.achievements.includes("boss-meeting")) {
      updated = recordBossMeeting(updated);
      // v0.25.1 (Harry, 3 Oct 2026): stay on Relations — no "See all", which
      // led straight to Training — and its tour explains the page, then points
      // at Training. The tour is the announcement, so none waits on Home.
      if (gameFirst(career)) updated = markAnnounced(updated, ["relations"]);
      setChainPop(gameFirst(career)
        ? { label: "Talk to your manager", unlocked: "Relations unlocked", stay: true }
        : { label: "Have a meeting with your boss", unlocked: "Next: buy your first phone" });
    }
    checkAndSetAchievements(updated);
    setCareer(spendAction(updated));
    setRelationshipGameKind(null);
    setActiveNav("skills");
    setTrainingTab("life");
    setPhase("skills");
  }, [career, relationshipGameKind]);

  const handleCasinoExit = useCallback((finalBank: number) => {
    if (!career) return;
    // Clamped: the casino owns the bank for the length of a session and hands
    // back a number, and a career with negative money has no way to recover.
    // A heavy night at the tables is a story: lose more than eight weeks' wages
    // in one visit and one time in four it reaches your sponsors.
    const banked = { ...career, money: Math.max(0, Math.round(finalBank)) };
    const lost = career.money - banked.money;
    const story = lost > Math.max(1, career.contract.wage) * 8 && Math.random() < 0.25;
    setCareer(story ? brandScandal(banked, "a casino story") : banked);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career]);

  const handleContractComplete = useCallback((newContract: CareerState["contract"] | null) => {
    if (!career) return;
    if (newContract) {
      const signed: CareerState = { ...career, contract: newContract };
      signed.media = generateForCareer(signed, {
        kind: "contract", club: newContract.club, wage: newContract.wage,
        seasons: newContract.seasonsRemaining,
      }, `contract-s${career.season}`);
      setCareer(signed);
    }
    setContractOfferReason(null);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career]);

  /**
   * A phase whose screen cannot be built is not a phase.
   *
   * Every guard below reads `phase === X && theStateThatScreenNeeds`, and that
   * state lives in React rather than in the save — so a phase that outlives it
   * matched no guard at all and fell through to the dashboard shell with none of
   * the dashboard in it. A blank screen with a nav bar, escapable only if you
   * noticed the nav was still there.
   *
   * Rather than add a fallback to each one, anything that cannot render is put
   * back on the dashboard, which is always renderable once a career exists.
   */
  useEffect(() => {
    if (!career) return;
    const missing =
      (phase === "training" && !trainingSkill)
      || (phase === "match" && !nextFixture)
      || (phase === "pre-match" && !nextFixture)
      || (phase === "post-match" && !(lastMatchStats && playedFixture))
      || (phase === "draw" && !pendingDraw)
      || (phase === "press" && !pressQuestion)
      || (phase === "dilemma" && !currentDilemma)
      || (phase === "season-transfer" && transferOffers.length === 0)
      || (phase === "transfer-signing" && !pendingSignOffer)
      || (phase === "relationship-game" && !relationshipGameKind)
      || (phase === "retirement" && !retirementCheck(career).canRetire);
    if (missing) {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, [career, phase, trainingSkill, nextFixture, lastMatchStats, playedFixture,
      pressQuestion, currentDilemma, transferOffers, pendingSignOffer, relationshipGameKind, pendingDraw]);

  // ---------- RENDER ----------
  if (cloudLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white/60 text-sm font-bold animate-pulse">Loading career…</div>
      </div>
    );
  }

  // A career only ever exists tied to an account — see the note on
  // `signedIn` above. Nothing past this point (ProfileSetup included) ever
  // runs signed out.
  if (!signedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-3xl mb-3">⚽</div>
          <h1 className="text-xl font-black text-white mb-2">Sign in to play</h1>
          <p className="text-sm text-white/60 mb-6">
            Road to Ballon d&apos;Or saves to your account, so your career follows you between
            devices instead of being stuck on whichever one you started it on.
          </p>
          <a
            href="/auth?next=/star-dev"
            className="inline-block w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 active:scale-95"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (saveClash) {
    return (
      <SaveClashPrompt
        clash={saveClash}
        onKeep={(keep) => {
          const clash = saveClash;
          const chosen = resolveSaveClash(scopeRef.current, clash, keep);
          setSaveClash(null);
          loadCareerIntoState(clash.slot, chosen);
        }}
        onLater={() => {
          const clash = saveClash;
          const chosen = deferSaveClash(scopeRef.current, clash);
          setSaveClash(null);
          loadCareerIntoState(clash.slot, chosen);
        }}
      />
    );
  }

  if (titleOpen && globalSettings) {
    return (
      <GlobalSettingsScreen
        onBack={() => setGlobalSettings(false)}
        fullscreen={{ support: immersive.support, on: immersive.active, onToggle: immersive.toggle }}
        moveSaves={{ scope: scopeRef.current, onImported: handleImportedSaves }}
      />
    );
  }
  if (titleOpen) {
    return (
      <TitleScreen
        career={career}
        saves={listSaveSlots(scopeRef.current)}
        activeSlot={activeSlot}
        onContinue={() => setTitleOpen(false)}
        onNewGameInSlot={handleTitleNewGame}
        onLoadSlot={handleTitleLoad}
        onDeleteSlot={handleDeleteSave}
        onSettings={() => setGlobalSettings(true)}
        onTutorial={handleTitleTutorial}
        showPlayArea={offlineDevPlayEnabled()}
      />
    );
  }

  /**
   * The full multi-stage trial.
   *
   * Deliberately routed ABOVE the `profile-setup || !career` fall-through
   * further down, and deliberately not gated on the career having a club: a
   * trial is what a career has INSTEAD of a club, and the whole point of
   * splitting career creation in two was that this state can exist at all.
   *
   * Nothing is held in React here. Every stage result goes straight onto the
   * career, so closing the app between stages costs nothing — see
   * TrialSequence's own note.
   */
  /**
   * The clubs that came in.
   *
   * Offers are REGENERATED from the trial's own seed and its final score
   * rather than stored, exactly as the end-of-season transfer window already
   * does: neither of those numbers can move once the trial is over, so these
   * are the same clubs every time the screen is opened. Storing them would be
   * equivalent; re-rolling them would make this the most farmable screen in
   * the game.
   */
  /**
   * THE MANAGER'S VERDICT — before the newspaper, never instead of it.
   *
   * The man whose pitch you were on (or, if he did not come in for you, the
   * club that made the strongest offer) says what he thought and puts a
   * number on the table. See lib/star/signingTalk.ts for where that number
   * comes from — `offerWageFor`/`offerStanding`, the same curve as every
   * other wage in the game, with the trial score driving both halves of it.
   */
  /** Sign for a club from the trial's offers (was inline in ScoutOffers'
   *  onAccept; now also used by the manager's "Accept & sign"). */
  const signTrialOffer = (offer: ReturnType<typeof offersForTrial>[number]) => {
    if (!career) return;
          // ── The wildcard: they sign you and send you out to play ──
          //
          // Occasionally a big club's interest is real but its first team is
          // not somewhere you are getting into, so it signs you and loans
          // you two rungs down with a number on it. See `rollLoanWildcard`.
          const loan = rollLoanWildcard(
            offer.club, offer.division, offer.seasons,
            mulberry32((career.trial?.seed ?? 1) ^ 0x70a2 ^ offer.club.length),
          );
          // THE SIGNING. Everything a club brings — the league, the fixture
          // list, the squad, the manager, your number, the cups — arrives now,
          // in one call, onto the person the trial just built. On a loan that
          // is the club you are going TO play for, not the one that owns you.
          const homeClub = loan ? loan.hostClub : offer.club;
          const homeDivision = loan ? loan.hostDivision : offer.division;
          const wage = loan ? loan.wage : offer.wage;
          const clubs = loan ? loan.hostClubs : clubsForDivision(offer.division);
          // The agreed wage is passed through so the signing-on fee is a
          // multiple of the deal actually being signed rather than of the
          // fallback starter terms — see `signingOnFee` (economy.ts).
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
            // The handshake is spent — it belongs to this signing and must
            // never follow the career into a later negotiation.
            agreedTerms: undefined,
            ...(loan ? { placement: startLoanSpell(loan, signed.seasonStats.goals) } : null),
          };
          setCareer(withDeal);
          setActiveNav("home");
          setPhase("trial-reward");
          // The real dressing room, now that there is one to fetch.
          fetchRealSquad(homeClub).then(squad => {
            setCareer(c => (c && c.player.club === homeClub ? { ...c, squad } : c));
          });
          fetchLeagueSquads(clubs).then(leagueSquads => {
            setCareer(c => (c ? {
              ...c, leagueSquads,
              league: syncLeagueStrengthFromSquads(c.league, leagueSquads),
            } : c));
          });
  };

  if (phase === "manager-talk" && career?.trial) {
    const offers = offersForTrial(career);
    const talking = talkingClubFor(career, offers);
    if (!talking) { setPhase("scout-offers"); return null; }
    const talk = managerTalkFor({
      trial: career.trial,
      club: talking.club,
      division: talking.division,
      clubStrength: talking.strength,
      playerFirstName: career.player.firstName,
      // Seeded off the trial, so re-opening this screen cannot re-roll a
      // better opening offer — the same anti-farming rule the offers
      // themselves are under.
      rng: mulberry32(career.trial.seed ^ 0x1a9b3),
    });
    return (
      <ManagerTalk
        talk={talk}
        managerName={loadLineup(talking.club)?.manager || "The manager"}
        onNegotiate={() => setPhase("wage-talk")}
        // Mikey, 28 Sep 2026: three clear choices — sign now at his first
        // number, negotiate, or look at the other clubs that came in.
        onAccept={() => {
          const agreed = { ...career, agreedTerms: { club: talking.club, wage: talk.openingWeekly } };
          const offer = offersWithAgreedTerms(agreed, offersForTrial(agreed)).find(o => o.club === talking.club);
          if (offer) signTrialOffer(offer);
          else { setCareer(agreed); setPhase("scout-offers"); }
        }}
        onSeeOthers={() => setPhase("scout-offers")}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  /**
   * …AND HAGGLING OVER IT.
   *
   * The existing negotiation, unchanged: `negotiation.ts`'s round-based
   * haggle drawn by `NegotiationScreen` — two desks, the counterpart's mood
   * on an actual face, a real walkout if you push a mood that has gone. It
   * opens on the exact state the conversation just showed you
   * (`talk.negotiation`), so what he said he would pay and what he opens
   * with cannot disagree.
   *
   * Conducted in a SEASON'S wages rather than a weekly one — see the note in
   * signingTalk.ts. The engine's own rounding steps in ★100s, which is
   * granularity on a season's money and a tenfold distortion on a ★10-a-week
   * National League wage.
   */
  if (phase === "wage-talk" && career?.trial) {
    const offers = offersForTrial(career);
    const talking = talkingClubFor(career, offers);
    if (!talking) { setPhase("scout-offers"); return null; }
    const talk = managerTalkFor({
      trial: career.trial,
      club: talking.club,
      division: talking.division,
      clubStrength: talking.strength,
      playerFirstName: career.player.firstName,
      rng: mulberry32(career.trial.seed ^ 0x1a9b3),
    });
    return (
      <NegotiationScreen
        mode="selling"
        // ── It says WHO and WHY, because this screen can be arrived at with
        //    no memory of the conversation that led to it ──
        //
        // Reported as landing on a negotiation with no idea which club was
        // interested. The conversation before it does say (and its own note
        // records the real layout bug that hid it), but this screen is also
        // where a reload or a distracted tap can put you, and it used to name
        // only the player. The club and the reason are in the title now.
        playerName={`${career.player.firstName} ${career.player.lastName} — terms with ${talking.club}`}
        marketValue={weeklyToSeason(talk.fairWeekly, talk.division)}
        counterpartLabel={talking.club}
        initialState={talk.negotiation}
        onDone={(finalSeasonPrice) => {
          const weekly = agreedWeeklyWage(finalSeasonPrice, talk.club, talk.division);
          // Push a manager too far and he no longer walks away (Mikey, 1 Oct
          // 2026): the club comes back with a worse, final offer — the only
          // one on the table if it is the only club. The offer screen marks it.
          setCareer({ ...career, agreedTerms: weekly === null
            ? { club: talk.club, wage: Math.max(1, Math.round(talking.wage * SOURED_OFFER_SHARE)), soured: true }
            : { club: talk.club, wage: weekly } });
          setPhase("scout-offers");
        }}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  if (phase === "scout-offers" && career?.trial) {
    const offers = offersWithAgreedTerms(career, offersForTrial(career));
    return (
      <ScoutOffers
        trial={career.trial}
        offers={offers}
        playerName={career.player.firstName}
        // ── Nobody offered terms. That is no longer "nowhere" ──
        //
        // A club down the leagues will take you into its youth team for a
        // season and have a look at you, which is what real football does
        // with a sixteen-year-old nobody will sign. Below
        // `YOUTH_INTEREST_BELOW` (youth.ts) even that does not happen, and
        // the free-agent life — ★10 a week and a garden gym — is exactly
        // where you go, unchanged.
        youthClub={youthTaker?.club ?? null}
        onNoOffers={() => setPhase(youthOrFreeAgent())}
        onAccept={offer => signTrialOffer(offer)}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  /**
   * Life with no club. Routed above the `profile-setup || !career`
   * fall-through for the same reason the trial is: a clubless career is a real
   * career, and the ordinary dashboard has nothing to show it.
   */
  if (phase === "free-agent" && career) {
    return (
      // Only offer the trial when there is one left to play. This guard used
      // to live in the child as a presentational check, which meant any
      // reordering of its JSX re-opened the blank-screen bug above.
      <FreeAgentShell
        career={career}
        onCareer={next => setCareer(next)}
        onTrial={career.trial && !trialComplete(career.trial)
          ? () => setPhase("trial-stages")
          : undefined}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  /**
   * THE YOUTH TEAM / THE RESERVES.
   *
   * Routed above the ordinary dashboard for the same reason the free-agent
   * shell is: the club dashboard is about being in a team, and a player who
   * is not in it has nothing to put on most of it. Unlike a free agent he
   * does have a club, so the league, the table and the settings screen are
   * all still real and still reachable from here.
   */
  if (phase === "youth" && career?.placement?.kind === "youth") {
    return (
      <YouthTeam
        career={career}
        seasonOver={seasonOver}
        onPlayWeek={handleYouthWeek}
        onTrain={handleTrain}
        onRest={handleRest}
        onPromote={handleYouthPromotion}
        onLeague={() => { setActiveNav(null); setPhase("league"); }}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  /**
   * A youth-team player has no first-team match to walk out for, so the
   * pre-match screen is his youth week instead.
   *
   * Deliberately an interception at the routing level rather than a change
   * to the dashboard or to the pre-match screen: both of those belong to
   * everybody, and neither should grow an "unless he is in the youth team"
   * branch for this.
   */
  if (phase === "pre-match" && career?.placement?.kind === "youth") {
    setPhase("youth");
    return null;
  }

  /**
   * A loan with a number on it is set dressing unless the number is in
   * front of you — so once a week, on the way to the match, it is.
   * `loanBriefWeek` makes it once a week rather than once a fixture: a
   * reminder, not a toll gate.
   */
  if (phase === "pre-match" && career?.placement?.kind === "loan" && loanBriefWeek !== career.week) {
    return (
      <LoanBrief
        career={career}
        onContinue={() => setLoanBriefWeek(career.week)}
      />
    );
  }

  /**
   * A FINISHED trial goes straight to the offers, never back to the
   * sequencer.
   *
   * The sequencer renders `null` once there are no stages left, and it only
   * ever leaves that state through a 1.4-second timer. But the career is
   * written to disk the instant the last stage ends, while the phase pointer
   * still says "trial-stages" — so closing the tab, refreshing, or simply
   * letting a phone lock the screen inside that window brought you back to a
   * blank page with no navigation and no other route to the offers. A
   * permanently stranded career. Found by an independent check of the review,
   * not by playing it.
   */
  if (phase === "trial-stages" && career?.trial && trialComplete(career.trial) && !trialEndingRef.current) {
    setPhase(afterTrialPhase(career));
    return null;
  }

  if (phase === "trial-stages" && career?.trial) {
    return (
      <TrialSequence
        trial={career.trial}
        playerName={career.player.firstName}
        penaltyRunup={careerPenaltyRunup(career)}
        freeKickRunup={careerFreeKickRunup(career)}
        skills={{
          power: career.skills.power,
          technique: career.skills.technique,
          // The dribbling stage runs on this and nothing else.
          pace: career.skills.pace,
        }}
        onTrial={t => setCareer(c => (c ? { ...c, trial: t } : c))}
        onEnding={showing => { trialEndingRef.current = showing; }}
        onComplete={(score, t) => {
          const finished = { ...career, trial: { ...t } };
          setCareer(finished);
          void score;   // read back off the trial by the offers screen
          // The manager who watched you speaks first now, and only when
          // there is somebody to speak — a trial nobody came in for goes
          // straight to the page that says so.
          setPhase(afterTrialPhase(finished));
        }}
      />
    );
  }

  /**
   * ── YOU GOT LOANED OUT AND NOBODY SAID SO ──
   *
   * Reported directly: *"you got loaned out. You got loaned out. It just
   * didn't tell you anything."* Two separate things were wrong and both are
   * here, because both are one value at this call site:
   *
   *  1. `club` was `career.player.club`, which on a loan is the club you are
   *     being SENT TO. So the back page and the signature both named a club
   *     you had never heard of and the club that had actually signed you was
   *     never mentioned. It is `contract.club` now — the club whose contract
   *     you are signing, which is the same value on every non-loan signing
   *     and the parent club on a loan.
   *  2. `LoanBrief` existed and explained the whole thing, and only ever
   *     rendered at `phase === "pre-match"` — several taps and one dashboard
   *     later. It now runs straight off the back of the signing.
   */
  if (phase === "trial-reward" && career) {
    const onLoan = career.placement?.kind === "loan";
    return (
      <TrialReward
        playerName={`${career.player.firstName} ${career.player.lastName}`}
        surname={career.player.lastName}
        club={career.contract?.club ?? career.player.club}
        terms={career.contract ? {
          wage: career.contract.wage, seasons: career.contract.seasonsRemaining,
          goalBonus: career.contract.goalBonus, assistBonus: career.contract.assistBonus,
          appearanceFee: career.contract.appearanceFee, loyaltyBonus: career.contract.loyaltyBonus,
          squadNumber: career.squadNumber,
          position: (POSITION_NAMES as Record<string, string>)[career.player.position] ?? career.player.position,
        } : undefined}
        onDone={() => {
          pushNews(signingNews(career, career.contract?.club ?? career.player.club));
          setActiveNav("home");
          setPhase(onLoan ? "loan-brief" : "dashboard");
        }}
        // The signing scene (Harry, 30 Sep 2026): you and this club's manager.
        career={career}
        managerName={career.manager?.name || loadLineup(career.contract?.club ?? career.player.club)?.manager || undefined}
      />
    );
  }

  /** The loan, explained the moment it happens — see the note above. */
  if (phase === "loan-brief" && career?.placement?.kind === "loan") {
    return (
      <LoanBrief
        career={career}
        intro
        onContinue={() => {
          // The weekly reminder is a reminder, and this week has just had
          // the full version — so it is marked seen rather than shown twice
          // in a row on the way to the very first match.
          setLoanBriefWeek(career.week);
          setActiveNav("home");
          setPhase("dashboard");
        }}
      />
    );
  }
  if (phase === "loan-brief") { setPhase("dashboard"); return null; }

  if (phase === "profile-setup" || !career) {
    return <ProfileSetup onComplete={handleProfileComplete} onMainMenu={() => setTitleOpen(true)} />;
  }

  if (phase === "season-awards" && career?.lastSeasonAwardStats) {
    return <SeasonAwardsScreen career={career} onContinue={handleSeasonAwardsContinue} />;
  }

  if (phase === "ladder" && career?.ladderNews) {
    return (
      <LadderScreen
        career={career}
        onContinue={() => { setActiveNav("home"); setPhase("dashboard"); }}
      />
    );
  }

  if (phase === "training" && trainingSkill) {
    // Pick a level first (30 per skill, stars on each), then play it. A level
    // sets its own difficulty and its own fixed picture; `skills` still goes
    // to the engine's own `launch`, so a strike in training is the same
    // strike it would be in a match.
    if (trainingLevel === null) {
      return (
        <PitchScope>
          <TrainingLevelSelect
            career={career}
            skill={trainingSkill}
            onPlay={setTrainingLevel}
            onBack={() => {
              setTrainingSkill(null);
              setPhase(career.placement?.kind === "youth" ? "youth" : "skills");
            }}
          />
          {/* The first time: start at level 1 (v0.24, P2-56). */}
          {career.unlocks && !hasSeen(career, "level-tut") && (
            <PointerTour key="level-tut" steps={LEVEL_TOUR} onDone={() => setCareer(c => (c ? markSeen(c, "level-tut") : c))} />
          )}
        </PitchScope>
      );
    }
    // v0.24 (P2-57, P2-58): no "Level 1 · How it works" card in front of the
    // drill. The first time you play a drill its tutorial sits ON it; after
    // that a "?" brings it back. A save from before the unlock chain keeps the
    // old rule (level 1 explains itself), just on the pitch now.
    const drillKey = `${trainingSkill}-${trainingLevel}`;
    const drillFirst = career.unlocks ? !hasSeen(career, `drill-${trainingSkill}`) : trainingLevel === 1;
    const drillAuto = drillFirst && drillAutoDone !== drillKey;
    const closeDrillHelp = () => {
      if (drillAuto) {
        setDrillAutoDone(drillKey);
        if (career.unlocks) setCareer(c => (c ? markSeen(c, `drill-${trainingSkill}`) : c));
        // Vision's countdown runs on its own: start it again now the
        // tutorial is out of the way, so no try is lost behind it.
        if (trainingSkill === "vision") setDrillRun(r => r + 1);
      }
      setDrillHelp(false);
    };
    return (
      <PitchScope>
        <DrillIntroOff>
          <TrainingMinigame
            key={`${drillKey}-${drillRun}`}
            skill={trainingSkill}
            trainingLevel={trainingLevel}
            skills={career.skills}
            glow={clubTheme(career.player.club, career).glow}
            onComplete={handleTrainingComplete}
            onExit={() => setTrainingLevel(null)}
          />
        </DrillIntroOff>
        {drillAuto || drillHelp
          ? <DrillTutorial skill={trainingSkill} first={!!career.unlocks && career.unlocks.drills === 0} onClose={closeDrillHelp} />
          : <DrillHelpButton onClick={() => setDrillHelp(true)} />}
      </PitchScope>
    );
  }

  if (phase === "match" && nextFixture) {
    // European and international opponents are not in your division, so the
    // fixture carries their strength.
    // Playing away is worth about a goal a game to the home side in real
    // football, and every OTHER fixture in this game has always modelled it —
    // simulateOtherFixtures gives the home team +3, and so does a match you are
    // dropped for. The one match you actually play was the exception.
    const baseStrength = nextFixture.opponentStrength
      ?? career.league.find((t) => t.name === nextFixture.opponent)?.strength
      ?? 65;
    const oppStrength = Math.max(20, Math.min(99, baseStrength + (nextFixture.home ? -3 : 4)));
    // Your worn boots actually count now: they add to the power/technique the shot
    // physics uses (capped at 100). This affects the SHOT, not the aim arrow — the
    // arrow is a fixed-scale drag indicator and never grows with power.
    const bootMatchesLeft = career.currentBoot.matches > 0;
    const effectivePower = Math.min(100, career.skills.power
      + (bootMatchesLeft ? career.currentBoot.power : 0));
    const effectiveTechnique = Math.min(100, career.skills.technique
      + (bootMatchesLeft ? career.currentBoot.technique : 0));
    // Your boots, or a Premium/Elite KIB can drunk before this match.
    const canCurve = (bootMatchesLeft && !!career.currentBoot.curve) || !!career.kibAbility?.curve;
    const canExtraTouch = (bootMatchesLeft && !!career.currentBoot.extraTouch) || !!career.kibAbility?.extraTouch;
    return (
      <PitchScope>
       <div className="min-h-screen sk-shell bg-gray-950 text-white py-4 px-3">
        <div className="max-w-sm mx-auto">
          <CanvasMatch
            skills={{ power: effectivePower, technique: effectiveTechnique }}
            canCurve={canCurve}
            canExtraTouch={canExtraTouch}
            keeperStrength={oppStrength}
            position={career.playAs ?? career.player.position}
            teamRelationship={career.relationships.team}
            career={career}
            fixture={nextFixture}
            oppStrength={oppStrength}
            onComplete={handleMatchComplete}
            startMinute={selection?.onAt ?? 0}
            duties={duties ?? undefined}
            conditions={conditionsFor(career.season, nextFixture.week, career.homeCity)}
            seed={career.season * 1000 + career.week}
            onGoalScored={handleGoalScored}
            pressure={pressureForDivision(career.division)}
            penaltyRunup={careerPenaltyRunup(career)}
            freeKickRunup={careerFreeKickRunup(career)}
          />
        </div>
       </div>
      </PitchScope>
    );
  }

  if (phase === "goal-replay" && watchingReplay) {
    return (
      <div
        className="min-h-screen bg-gray-950 text-white py-4 px-3"
        style={{ backgroundImage: "radial-gradient(70% 45% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)" }}
      >
        <div className="max-w-sm mx-auto">
          <button
            onClick={() => { setWatchingReplay(null); setPhase("settings"); }}
            className="mb-2 flex items-center gap-1 px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-black text-white hover:bg-gray-600"
          >
            ← Back to Settings
          </button>
          <CanvasMatch
            key={watchingReplay.id}
            career={career}
            replayOf={watchingReplay}
          />
        </div>
      </div>
    );
  }

  if (phase === "post-match" && lastMatchStats && playedFixture) {
    return (
      <>
      <PostMatch
        stats={lastMatchStats}
        homeTeam={playedFixture.home ? myTeam(playedFixture) : playedFixture.opponent}
        awayTeam={playedFixture.home ? playedFixture.opponent : myTeam(playedFixture)}
        youAreHome={playedFixture.home !== false}
        competition={playedFixture.kind && playedFixture.kind !== "league" ? fixtureLabel(playedFixture) : undefined}
        knockout={career.knockoutMessage}
        starBefore={lastStarChange?.from}
        starAfter={lastStarChange?.to ?? starsNow(career)}
        bootsWornOut={bootsJustWoreOut}
        star={lastMatchStar ?? undefined}
        // v0.24 (P2-84): the achievements pop up by themselves, no Next
        // button — AchievementToasts below, not PostMatch's own card.
        achievements={[]}
        onContinue={handlePostMatchContinue}
      />
      {/* The pop-ups wait for the star bar, level-up refill and all. */}
      {matchToasts.length > 0 && <AchievementToasts items={matchToasts} delay={achievementToastDelay(lastStarChange?.from, lastStarChange?.to ?? starsNow(career))} onDone={() => setMatchToasts([])} />}
      </>
    );
  }

  if (phase === "draw" && pendingDraw) {
    return (
      <CupDrawReveal
        competition={pendingDraw.competition}
        round={pendingDraw.round}
        yourClub={career.player.club}
        onContinue={() => {
          setPendingDraw(null);
          continueAfterMatch(career, false, true);
        }}
      />
    );
  }

  if (phase === "deadline-day") {
    return (
      <DeadlineDayRoundup
        career={career}
        onContinue={() => {
          // Marked seen on the object handed straight back into the chain —
          // not two state writes — so a resumed continueAfterMatch reads the
          // update immediately instead of racing the next render.
          const next = { ...career, deadlineDayShownFor: career.lastTransferWindowKey };
          setCareer(next);
          continueAfterMatch(next, false, true);
        }}
      />
    );
  }

  // Straight out of the ground it is a moment with a Continue — its own
  // standalone screen, same as it always was. Reached from the nav
  // ("browse") it falls through to the DashboardShell render below instead
  // — full-bleed (see DashboardShell's own prop), so the bottom nav stays
  // on screen under it and there's nothing left needing a back button.
  if (phase === "media" && activeNav !== "media") {
    return (
      <>
        <MediaFeed career={career} mode="moment" onContinue={handleMediaContinue} onToggleLike={handleToggleLike} />
        {/* The first time: what this screen is (v0.24, P2-85). */}
        {career.unlocks && !hasSeen(career, "reactions-tut") && (
          <PointerTour key="reactions-tut" steps={REACTIONS_TOUR} onDone={() => setCareer(c => (c ? markSeen(c, "reactions-tut") : c))} />
        )}
      </>
    );
  }

  if (phase === "legacy") {
    return <LegacyScreen career={career} onNewCareer={handleFullReset} />;
  }

  if (phase === "retirement") {
    return <RetirementChoice career={career} onRetire={handleRetire} onPlayOn={handlePlayOn} />;
  }

  if (phase === "transfer-signing" && pendingSignOffer) {
    return (
      <TransferSigning
        playerName={`${career.player.firstName} ${career.player.lastName}`}
        club={pendingSignOffer.offer.club}
        terms={{
          wage: pendingSignOffer.offer.wage, seasons: pendingSignOffer.offer.seasons,
          goalBonus: pendingSignOffer.offer.goalBonus, assistBonus: pendingSignOffer.offer.assistBonus,
          appearanceFee: pendingSignOffer.offer.clauses.appearanceFee,
          loyaltyBonus: pendingSignOffer.offer.clauses.loyaltyBonus,
          signingFee: pendingSignOffer.offer.signingFee,
          position: (POSITION_NAMES as Record<string, string>)[career.player.position] ?? career.player.position,
        }}
        onDone={handleSigningDone}
        // The 3D signing (Settings → beta), for a move as well as the first contract.
        career={career}
      />
    );
  }

  if (phase === "season-transfer" && transferOffers.length > 0) {
    return (
      <TransferWindow
        career={career}
        offers={transferOffers}
        onAccept={handleChooseTransfer}
        onStay={handleStayPut}
      />
    );
  }

  if (phase === "relegation-move" && transferOffers.length > 0) {
    return (
      <RelegationMove
        career={career}
        offers={transferOffers}
        onAccept={handleChooseTransfer}
      />
    );
  }

  if (phase === "press" && pressQuestion) {
    return <PressConference question={pressQuestion} onAnswer={handlePressAnswer} />;
  }

  if (phase === "ballon-dor") {
    return <BallonDor career={career} onContinue={handleBallonDorContinue} />;
  }

  if (phase === "dilemma" && currentDilemma) {
    return <DilemmaModal dilemma={currentDilemma} onChoose={handleDilemmaChoose} />;
  }

  if (phase === "contract-renewal") {
    return <ContractRenewal career={career} offerReason={contractOfferReason ?? undefined} onComplete={handleContractComplete} />;
  }

  // The Store (Shop page's big tile, the phone's Store app) — the test area's
  // screen on this career. See components/star/store/CareerStore.tsx.
  // The top HUD on every screen outside the dashboard shell (v0.23, P86:
  // "your energy never leaves").
  // The same top bar (name, age, money) and the same HUD (rating + energy) as
  // the dashboard on every full screen (Harry, 1 Oct 2026: "the pills at the
  // top aren't uniform across every page").
  // v0.24 (P1-22, P1-33, P1-42): each screen's "?" tour opens by itself the
  // first time you are there (a new career only — an old save has seen it all).
  const firstHelp = (screen: HelpScreen) => !!career.unlocks && !hasSeen(career, `help-${screen}`);
  const helpSeen = (screen: HelpScreen) => () => setCareer(c => (c ? markSeen(c, `help-${screen}`) : c));
  const screenHud = (screen: HudScreen, help?: HelpScreen) => (
    <>
      <GameBar career={career} onHome={() => handleNavigate("home")} onSettings={() => setPhase("settings")} onHelp={help ? () => setHelpTour(HELP_TOURS[help]) : undefined} />
      <TopHud career={career} screen={screen} onUseCan={handleUseCan} onOpenCans={() => setPhase("shop-kib")} onCareer={setCareer} />
    </>
  );
  // The league and the fixtures on ONE page, with the live-score bell in the
  // bottom bar (v0.23 W7, P90) — components/star/MatchWeek.tsx. A full screen
  // like the shop: it carries its own HUD and bottom bar.
  if (phase === "league") {
    return (
      <>
        <MatchWeek
          career={career}
          hud={screenHud("league")}
          nextFixture={nextFixture}
          onBack={handleBackToDashboard}
          onPlay={() => handleNavigate("play")}
          // The "?" replays the League's pointer; not while the first-visit one is up.
          onHelp={career.unlocks && !hasSeen(career, "league-intro") ? undefined : () => setHelpTour(HELP_TOURS.league)}
        />
        {helpTour && <PointerTour key="help-league" steps={helpTour} onDone={() => setHelpTour(null)} />}
        {career.unlocks && !hasSeen(career, "league-intro") && (
          <PointerTour
            key="league-screen"
            steps={LEAGUE_SCREEN_TOUR}
            onDone={() => {
              setCareer(c => (c ? recordLeagueVisit(markSeen(c, "league-intro")) : c));
              // v0.25 (game first): the first game opens Achievements, not the League.
              if (!gameFirst(career)) setChainPop({ label: "Complete your first two training sessions", unlocked: "Achievements unlocked" });
            }}
          />
        )}
        {chainPop && <AchievementPop label={chainPop.label} unlocked={chainPop.unlocked} onClose={() => setChainPop(null)} onSeeAll={seeAllAchievements} />}
      </>
    );
  }

  if (phase === "store") {
    return <CareerStore career={career} onChange={setCareer} onBack={handleBackToDashboard} hud={screenHud("shop")} />;
  }

  if (phase === "shop-3d") {
    // Walk the 3D shop (beta): a look round, then "See it in the shop" opens
    // that item in the normal shop to buy it. Nothing is bought in 3D.
    return (
      <Shop3D
        career={career}
        atDoor={shopAtDoor}
        onDoor={() => { setShopAtDoor(false); setGardenArrive("shop"); setPhase("garden"); }}
        onBack={() => { setShopAtDoor(false); setHomePage(2); setActiveNav("home"); setPhase("dashboard"); }}
        onGoToItem={(display, id, level) => {
          const to: StarPhase = display === "boots" ? "shop-boots" : display === "cans" ? "shop-kib" : "shop-lifestyle";
          setShopFocus({ phase: to, id, level });
          setPhase(to);
        }}
      />
    );
  }

  if (phase === "shop-kib" || phase === "shop-boots" || phase === "shop-lifestyle") {
    const kind = phase === "shop-kib" ? "kib" : phase === "shop-boots" ? "boots" : "lifestyle";
    const shopHelp: HelpScreen = kind === "kib" ? "cans" : kind === "boots" ? "boots" : "style";
    return (
      <>
        <Shop
          career={career}
          kind={kind}
          onBack={handleBackToDashboard}
          onBuyKib={handleBuyKib}
          onBuyBoot={handleBuyBoot}
          onBuyItem={handleBuyItem}
          onBuyFromBlackMarket={handleBuyFromBlackMarket}
          hud={screenHud(kind === "lifestyle" ? "style" : "shop", shopHelp)}
          onHome={() => { setHomePage(1); setActiveNav("home"); setPhase("dashboard"); }}
          focus={shopFocus && shopFocus.phase === phase ? shopFocus : null}
        />
        {helpTour && <PointerTour key="help-shop" steps={helpTour} onDone={() => setHelpTour(null)} />}
        {!helpTour && firstHelp(shopHelp) && <PointerTour key={`first-${shopHelp}`} steps={HELP_TOURS[shopHelp]} onDone={helpSeen(shopHelp)} />}
        {/* The phone flashes; one line says what it is (Harry, P102). */}
        {kind === "lifestyle" && !firstHelp(shopHelp) && career.unlocks && !isOpen(career, "phone") && !hasSeen(career, "phone-tip") && (
          <PointerTour
            key="phone-tip"
            steps={[{ target: "phone-tile", text: "Your phone — messages, social media and an App Store" }]}
            onDone={() => setCareer(c => (c ? markSeen(c, "phone-tip") : c))}
          />
        )}
      </>
    );
  }

  if (phase === "casino-menu") {
    return <Casino hud={screenHud("casino")} bankStart={career.money} career={career} onExit={handleCasinoExit} onHorseRace={handleHorseRace} onBuyHorse={handleBuyHorse} onRenameHorse={handleRenameHorse} onPlaceBet={handlePlaceBet} />;
  }

  if (phase === "investments") {
    return (
      <Investments
        career={career}
        initialTab={investmentsEntry?.tab}
        initialBoardroomClub={investmentsEntry?.club}
        initialBoardroomSection={investmentsEntry?.section}
        onBack={() => { setInvestmentsEntry(null); handleBackToOwnership(); }}
        onBuyStake={handleBuyStake}
        onSellStake={handleSellStake}
        onTopUpBudget={handleTopUpClubBudget}
        onSignPlayer={handleSignPlayerForOwnedClub}
        onSellPlayer={handleSellPlayerFromOwnedClub}
        onProposeSellVote={handleProposeSellPlayerVote}
        onReplaceManager={handleReplaceManagerForOwnedClub}
        onManagerNegotiationFailed={handleManagerNegotiationFailed}
        onRecommend={handleSubmitRecommendation}
        onSetFormation={handleSetClubFormation}
        onSetOwnedLineup={handleSetOwnedLineup}
        onAppointSelfCaptain={handleAppointSelfCaptain}
        onSetTalisman={handleSetTalisman}
        onTransferSelfTo={handleTransferSelfTo}
        onSetKit={handleSetClubKit}
        onProposeKitVote={handleProposeKitVote}
        onStandForPresident={handleProposePresidentVote}
        onSetPresidentWage={handleSetPresidentWage}
        onMergeClubs={handleMergeClubs}
        onHaveASon={handleHaveASon}
        onAgeUpSon={handleAgeUpSon}
        onPromoteSon={handlePromoteSon}
        onTransferSon={handleTransferSon}
        onRenameStadium={handleRenameStadium}
        onUpgradeStadiumCapacity={handleUpgradeStadiumCapacity}
        onUpgradeTrainingGround={handleUpgradeTrainingGround}
        onUpgradeYouthAcademy={handleUpgradeYouthAcademy}
      />
    );
  }

  if (phase === "sponsors") return (
    <>
      <SponsorsScreen career={career} onBack={handleBackToDashboard} act={sponsorActions} />
      {firstHelp("sponsors") && <PointerTour key="first-sponsors" steps={HELP_TOURS.sponsors} onDone={helpSeen("sponsors")} />}
      {sponsorNote && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] mx-auto w-fit max-w-[90%] rounded-xl border border-amber-300 bg-gray-950 px-4 py-2 text-center text-[13px] font-black text-white shadow-[0_0_18px_rgba(251,191,36,.45)]">{sponsorNote}</div>
      )}
    </>
  );
  if (phase === "sponsor-negotiation") {
    const o = brandsOf(career).offers.find(x => x.id === sponsorNegId);
    if (!o) { setPhase("sponsors"); return null; }
    return (
      <NegotiationScreen
        mode="selling"
        playerName={`${o.brand} — weekly fee`}
        marketValue={Math.round(o.weekly * 1.2)}
        counterpartLabel={o.brand}
        initialState={{
          marketValue: Math.round(o.weekly * 1.2), mode: "selling", round: 0,
          yourPosition: Math.max(o.weekly + 1, Math.round(o.weekly * 1.25)), theirPosition: o.weekly,
          moodScore: 60, status: "negotiating",
          log: [`${o.brand} open at ★${o.weekly.toLocaleString()} a week.`],
        }}
        onDone={(weekly) => {
          setCareer(settleNegotiation(career, o.id, weekly));
          noteSponsor(weekly === null ? `${o.brand} walked away.` : `Agreed: ★${Math.round(weekly).toLocaleString()} a week. Sign it to make it yours.`);
          setSponsorNegId(null);
          setPhase("sponsors");
        }}
      />
    );
  }
  if (phase === "achievements") {
    // The first steps' story list leads to each thing (v0.24, P2-69): Go
    // takes you there and that screen's tutorial runs.
    const step = nextStep(career);
    const sponsorsNew = isOpen(career, "sponsors") && !hasSeen(career, "help-sponsors");
    const goStep = (id: StepGo) => {
      setCareer(c => (c ? markSeen(c, `step-${id}`) : c));
      if (id === "first-two-sessions") handleNavigate("skills");
      else if (id === "first-game") { setHomePage(1); setActiveNav("home"); setPhase("dashboard"); }
      else if (id === "boss-meeting") { if (managerTalkDue(career)) handleOpenRelationshipGame("boss"); else handleNavigate("life"); }
      else if (id === "buy-phone") { setHomePage(2); setActiveNav("home"); setPhase("dashboard"); }
      else if (id === "sponsors") setPhase("sponsors");
    };
    const stepPrompt = step && !hasSeen(career, `step-${step.id}`) ? step.prompt
      : !step && sponsorsNew && !hasSeen(career, "step-sponsors") ? "Sponsors are open" : null;
    return (
      <>
        <AchievementsScreen
          career={career}
          onBack={handleBackToDashboard}
          top={career.unlocks ? <UnlockChallenges career={career} onGo={goStep} /> : undefined}
        />
        {career.unlocks && (firstHelp("achievements")
          ? <PointerTour key="first-achievements" steps={HELP_TOURS.achievements} onDone={helpSeen("achievements")} />
          : stepPrompt && <PointerTour key={`step-${step?.id ?? "sponsors"}`} steps={stepTour(stepPrompt)} onDone={() => {}} />)}
      </>
    );
  }
  if (phase === "trophies") return <TrophiesScreen trophies={career.trophies} ballonDors={career.ballonDorWins} awards={career.awards} onBack={handleBackToDashboard} />;
  if (phase === "garden") {
    return (
      <Garden3D
        career={career}
        arrive={gardenArrive}
        onBack={() => { setGardenArrive("gate"); handleBackToDashboard(); }}
        onShop={() => { setGardenArrive("gate"); setShopAtDoor(true); setPhase("shop-3d"); }}
      />
    );
  }
  if (phase === "reputation") return <ReputationScreen career={career} onBack={handleBackToOwnership} />;

  if (phase === "ownership") {
    return (
      <OwnershipScreen
        career={career}
        onBack={handleBackToDashboard}
        onReputation={() => setPhase("reputation")}
        onRuleBook={() => setPhase("rule-book")}
        onOpenMarket={() => { setInvestmentsEntry({ tab: "market" }); setPhase("investments"); }}
        onOpenBoardroom={club => { setInvestmentsEntry({ tab: "boardroom", club }); setPhase("investments"); }}
      />
    );
  }

  if (phase === "rule-book") {
    return (
      <RuleBookScreen
        career={career} onBack={handleBackToOwnership}
        onInvest={handleInvestInfluence} onProposeChange={handleProposeRuleChange}
        onForceClubIntoPremierLeague={handleForceClubIntoPremierLeague}
        onCreateCompetition={handleCreateCompetition}
        onStandForBodyPresidency={handleProposeBodyPresidency}
      />
    );
  }

  if (phase === "vote-ceremony" && pendingVote) {
    const canOverrule = pendingVote.kind === "kit" ? false
      : pendingVote.kind === "ruleChange" ? canOverruleRuleVote(career, pendingVote.proposal.body)
      : pendingVote.kind === "bodyPresidency" ? canOverrulePresidencyVote(career, pendingVote.proposal.body)
      : canOverruleClubVote(career, pendingVote.proposal.club);
    return (
      <VoteCeremony
        tally={pendingVote.proposal.tally}
        scope={pendingVote.kind === "kit" ? "fans" : (pendingVote.kind === "ruleChange" || pendingVote.kind === "bodyPresidency") ? "governing-body" : "boardroom"}
        successOptionId={pendingVote.kind === "kit" ? (pendingVote.proposal.favor === "b" ? "b" : pendingVote.proposal.favor === "a" ? "a" : undefined) : "yes"}
        canOverrule={canOverrule}
        overruleCost={OVERRULE_REPUTATION_COST}
        onDone={handleVoteDone}
      />
    );
  }

  if (phase === "settings") {
    return (
      <>
      {helpTour && <PointerTour key="help-settings" steps={helpTour} onDone={() => setHelpTour(null)} />}
      {!helpTour && firstHelp("settings") && <PointerTour key="first-settings" steps={HELP_TOURS.settings} onDone={helpSeen("settings")} />}
      <SettingsScreen
        career={career}
        onBack={settingsFromTitle ? handleExitToTitle : handleBackFromSettings}
        onExitToTitle={handleExitToTitle}
        onSkip={handleDevSkip}
        onAddMoney={handleAddMoney}
        onAddCoins={handleAddCoins}
        onSetCaptain={handleSetCaptain}
        onSetReputation={handleSetReputation}
        onSetFame={handleSetFame}
        onMaxSkills={handleMaxSkills}
        onUnlockTraining={handleUnlockTraining}
        onSetHappiness={handleSetHappiness}
        onSwitchClub={handleSwitchClub}
        onSetPortrait={handleSetPortrait}
        onWatchReplay={handleWatchReplay}
        onSaveReplay={handleSaveReplay}
        onDeleteSavedReplay={handleDeleteSavedReplay}
        onRefreshPhotos={handleRefreshPhotos}
        onOpenFaceEditor={() => setPhase("face-editor")}
        onOpenFakeFaceEditor={() => setPhase("fake-face-editor")}
        saves={listSaveSlots(scopeRef.current)}
        activeSlot={activeSlot}
        onSwitchSave={handleSwitchSave}
        onStartNewInSlot={handleStartNewInSlot}
        onDeleteSave={handleDeleteSave}
        moveSaves={{ scope: scopeRef.current, onImported: handleImportedSaves }}
        immersiveActive={immersive.active}
        onToggleImmersive={immersive.toggle}
        fullscreenSupport={immersive.support}
        onSetPenaltyRunup={handleSetPenaltyRunup}
        onSetFreeKickRunup={handleSetFreeKickRunup}
        onExitCareer={handleExit}
        hud={screenHud("settings", "settings")}
      />
      </>
    );
  }
  if (phase === "face-editor") {
    return <FaceEditorScreen career={career} onBack={() => setPhase("settings")} />;
  }
  if (phase === "fake-face-editor") {
    return <FakeFaceEditorScreen career={career} onBack={() => setPhase("settings")} />;
  }
  if (phase === "advert-shoot") {
    const deal = brandsOf(career).deals.find((d) => d.id === advertDealId);
    if (!deal) { setPhase("sponsors"); return null; }
    return (
      <AdvertShoot
        deal={deal}
        onFinish={(res) => {
          setCareer(spendAction(markGamePlayed(changeDealHappiness(career, deal.id, res.gain), "advert")));
          setAdvertDealId(null);
          setPhase("sponsors");
        }}
        onCancel={() => { setAdvertDealId(null); setPhase("sponsors"); }}
      />
    );
  }
  if (phase === "relationship-game" && relationshipGameKind) {
    const currentValue = relationshipGameKind === "happiness"
      ? career.happiness
      : (career.relationships[relationshipGameKind] as number);
    void currentValue;
    return (
      <RelationshipGame
        kind={relationshipGameKind}
        career={career}
        onFinish={handleRelationshipGameComplete}
        onCancel={() => {
          setRelationshipGameKind(null);
          // Relations still locked: the boss meeting was opened from Achievements.
          if (!isOpen(career, "relations")) { if (gameFirst(career)) { setActiveNav("home"); setPhase("dashboard"); } else setPhase("achievements"); return; }
          setActiveNav("skills"); setTrainingTab("life"); setPhase("skills");
        }}
      />
    );
  }

  // Pre-match confirmation — the match-day screen (components/star/MatchdayScreen.tsx),
  // including the team-sheet step before kick-off.
  if (phase === "pre-match" && nextFixture) {
    // v0.23 (P91/P93): no match-day page. Play → (a prompt only if energy is
    // low) → the line-up animation → the match. components/star/LineupIntro.tsx.
    return (
      <LineupIntro
        career={career}
        nextFixture={nextFixture}
        preMatchEnergy={preMatchEnergy}
        preMatchSelection={preMatchSelection}
        playAs={playAs}
        onPlayAs={setPlayAs}
        onBack={handleBackToDashboard}
        onPlayMatch={handlePlayMatch}
        onWatchFromStands={handleWatchFromStands}
        onSimMatch={handleSimMatch}
        onUseCan={handleUseCan}
      />
    );
  }

  // ── A career with no club can never reach the club dashboard ──
  //
  // The belt to `handleBackFromSettings`'s braces, and the reason it is here
  // rather than only there: everything below this line is a club — a league
  // table, a fixture list, a squad, a shop, a manager — and the "season over"
  // check passes trivially on an empty fixture list, so a clubless career that
  // arrives here by ANY route (a stale saved phase pointer, a future screen
  // wired to `handleBackToDashboard` without thinking about it) is offered
  // "End of Season 🏆" and can run the awards and season-advance flow on a
  // career with no league. The trial and free-agent phases are handled well
  // above this; anything else that gets here is a routing bug, and this is
  // where it stops being a corrupted save.
  if (!hasClub(career)) {
    return (
      <FreeAgentShell
        career={career}
        onCareer={next => setCareer(next)}
        onTrial={career.trial && !trialComplete(career.trial)
          ? () => setPhase("trial-stages")
          : undefined}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  // Swipe home screens: only ever the dashboard and the training phase, which
  // are its middle/left and right screens.
  // PROTOTYPE (home-screen proto): the swipe pages are Stats · Home · Shop,
  // and Training / Relationships are their own bottom-bar screens.
  const swipeActive = phase === "dashboard";
  // Which screen the "?" is on, and the one pointer tour running right now.
  const helpScreen: HelpScreen | null = swipeActive ? (homePage === 0 ? "stats" : homePage === 1 ? "home" : "shop")
    : phase === "skills" ? (trainingTab === "life" ? "relations" : "training")
    : phase === "media" && activeNav === "media" ? "phone" : null;
  // Sponsors stay shut until your first offer (v0.25): every way in says how they open.
  const openHub = (ph: Parameters<typeof setPhase>[0]) => {
    if (ph === "sponsors" && !isOpen(career, "sponsors")) {
      showLock(`Sponsors open with your first offer. ${LOCK_HINT.sponsors}.`);
      return;
    }
    setPhase(ph);
  };
  const played1 = career.fixtures.some(f => f.played);
  // v0.24: something just opened — say so on Home, before anything else
  // (Harry: "the moment ANY feature unlocks … it is announced").
  const announce = pendingAnnouncements(career);
  const showAnnounce = swipeActive && homePage === 1 && announce.length > 0 && !chainPop && earnPops.length === 0 && newStar === null && newsQueue.length === 0 && !potmWin;
  const quiet = !chainPop && earnPops.length === 0 && newStar === null && newsQueue.length === 0 && !showAnnounce;
  // The rest days' energy toast (P2-82) takes its turn after the unlock
  // pop-up and before the tours: after the first match a tour is always
  // waiting on Home, so "no tour" never came (EnergyBackToast.tsx).
  const energyToast = swipeActive && homePage === 1 && energyBack !== null && energyBack > 0 && quiet && !helpTour && !potmWin;
  // A word from the manager about set pieces: once, after your first match,
  // never on top of a tutorial or a news pop-up (lib/star/setPieceTalk.ts).
  const setPieceChat = swipeActive && homePage === 1 && quiet && !potmWin && !pendingSignOffer && !energyToast
    ? setPieceTalkDue(career) : null;
  const step = nextStep(career);
  const onTraining = phase === "skills" && trainingTab === "training";
  const onRelations = phase === "skills" && trainingTab === "life";
  const tour: { key: string; steps: TourStep[]; skippable?: boolean; onDone: () => void } | null = (() => {
    if (helpTour) return { key: "help", steps: helpTour, onDone: () => setHelpTour(null) };
    if (!career.unlocks || !quiet || energyToast) return null;
    const onHome = swipeActive && homePage === 1;
    const seen = (...keys: string[]) => () => setCareer(c => (c ? keys.reduce((acc, k) => markSeen(acc, k), c) : c));
    // v0.25: energy explained here, at the very start; then "You've got a game
    // today" (game first) — no Skip, so Play is never missed.
    if (onHome && !hasSeen(career, "tutorial")) return { key: "welcome", steps: welcomeTour(gameFirst(career)), skippable: !gameFirst(career), onDone: seen("tutorial", "help-home", "play-tip") };
    // Training (P2-56, P2-63, P2-65): what it is, each drill, then Power.
    if (onTraining && !hasSeen(career, "help-training")) return { key: "training", steps: TRAINING_TOUR, onDone: seen("help-training") };
    if (onTraining && !gameFirst(career) && career.unlocks.drills === 1 && !hasSeen(career, "drill1-msg")) return { key: "one-more", steps: ONE_MORE_DRILL_TOUR, onDone: seen("drill1-msg") };
    if ((onTraining || swipeActive) && drillMessageDue(career)) return { key: "league-open", steps: onTraining ? LEAGUE_TOUR : LEAGUE_TOUR.slice(1), onDone: seen("drills-msg") };
    // The League's first-visit pointer lives on the League page itself (it
    // returns early, above).
    if (onHome && hasSeen(career, "league-intro") && !hasSeen(career, "play-tip") && !played1 && isOpen(career, "play")) {
      return { key: "first-game", steps: FIRST_GAME_TOUR, onDone: seen("play-tip") };
    }
    // After the first game: "Time to meet your boss", and where to tap (P2-86, P2-87).
    // v0.25 (game first): "Your manager wants a word" — the talk opens Relations.
    if (onHome && step?.id === "boss-meeting" && (isOpen(career, "relations") || managerTalkDue(career)) && !hasSeen(career, "boss-prompt")) {
      return { key: "boss", steps: bossTour(gameFirst(career)), onDone: seen("boss-prompt") };
    }
    // Relations, the first time: its bars, then the boss meeting.
    const bossNow = step?.id === "boss-meeting" && canAct(career);
    if (onRelations && !hasSeen(career, "help-relations")) {
      // v0.25.1: what the page is and what the bars do, then (training next) "Tap Training".
      return { key: "relations", steps: bossNow ? [...HELP_TOURS.relations.slice(0, -1), ...BOSS_MEETING_TOUR] : relationsTour(gameFirst(career) && step?.id === "first-two-sessions"), onDone: seen("help-relations", ...(bossNow ? ["boss-tour"] : [])) };
    }
    if (onRelations && bossNow && !hasSeen(career, "boss-tour")) return { key: "boss-meeting", steps: BOSS_MEETING_TOUR, onDone: seen("boss-tour") };
    // The boss met: the Shop, and the phone in it.
    // v0.25: never a step that silently does not work. Short of money, the
    // tour says what the phone costs and how much more you need (no tap);
    // once you can pay, the usual tour takes you to it.
    if (swipeActive && step?.id === "buy-phone" && isOpen(career, "shop")) {
      const canBuy = phoneShortfall(career) === 0;
      const steps = shopTour(phoneStepLine(career), canBuy);
      if (canBuy && !hasSeen(career, "shop-intro")) {
        return { key: "shop", steps: homePage === 2 ? steps.slice(1) : steps, onDone: seen("shop-intro", ...(homePage === 2 ? ["help-shop"] : [])) };
      }
      if (!canBuy && !hasSeen(career, "shop-intro") && !hasSeen(career, "phone-short")) {
        return { key: "shop-short", steps, onDone: seen("phone-short") };
      }
    }
    if (onHome && isOpen(career, "phone") && career.achievements.includes("buy-phone") && !hasSeen(career, "phone-tour")) {
      return { key: "phone-open", steps: PHONE_TOUR, onDone: seen("phone-tour") };
    }
    // Every other screen's own tour, the first time (P1-42).
    if (swipeActive && homePage === 0 && isOpen(career, "stats") && !hasSeen(career, "help-stats")) return { key: "first-stats", steps: HELP_TOURS.stats, onDone: seen("help-stats") };
    if (swipeActive && homePage === 2 && isOpen(career, "shop") && !hasSeen(career, "help-shop")) return { key: "first-shop", steps: HELP_TOURS.shop, onDone: seen("help-shop") };
    if (phase === "media" && activeNav === "media" && !hasSeen(career, "help-phone")) return { key: "first-phone", steps: HELP_TOURS.phone, onDone: seen("help-phone") };
    return null;
  })();
  // First steps done: "Do you want to switch this to League as a shortcut?" (P2-89).
  const askSlot = swipeActive && homePage === 1 && quiet && !tour && !setPieceChat && !energyToast && slotQuestionDue(career);
  const trainingBody = (
        <div>
          {trainingTab === "training" ? (
            <SkillsScreen career={career} onTrain={handleTrain} />
          ) : (
            <RelationsPage
              career={career}
              onPlayRelationshipGame={handleOpenRelationshipGame}
              onRest={handleRest}
              onOpen={openHub}
            />
          )}
        </div>
  );

  return (
    <PitchScope on={phase === "skills" && trainingTab === "training"}>
    <DashboardShell
      career={career}
      onExit={handleExit}
      // v0.25: after the first game, Relations goes straight into the manager's talk.
      onNavigate={(t) => (t === "life" && managerTalkDue(career) ? handleOpenRelationshipGame("boss") : handleNavigate(t))}
      onSettings={() => setPhase("settings")}
      activeNav={phase === "skills" ? (trainingTab === "life" ? "life" : "skills") : activeNav}
      // A red dot while something on the phone is unread; it clears once you
      // have opened it (lib/star/phoneUnread.ts; Harry, P89).
      mediaUnread={phoneUnread > 0}
      nextMatchLabel={nextMatchLabel}
      nextMatchDate={nextMatchDate ?? undefined}
      fullBleed={phase === "media" && activeNav === "media"}
      compact={swipeActive || phase === "skills"}
      swipe={swipeActive}
      onHelp={helpScreen ? () => setHelpTour(HELP_TOURS[helpScreen]) : undefined}
      hud={
        // The top HUD (v0.23): the cells change with the screen; energy is
        // always there, with its can (USE, or BUY into the cans shop).
        <TopHud
          career={career}
          screen={((): HudScreen => {
            if (swipeActive) return homePage === 0 ? "stats" : homePage === 1 ? "home" : "shop";
            if (phase === "skills") return trainingTab === "life" ? "relations" : "training";
            return "other";
          })()}
          onUseCan={handleUseCan}
          onOpenCans={() => setPhase("shop-kib")}
          onCareer={setCareer}
        />
      }
      // The home button top-left opens the main menu (Mikey, 28 Sep 2026:
      // "this home button should take you back to the main menu").
      // On Home it opens the main menu; anywhere else it takes you back to
      // Home (Mikey, 29 Sep 2026: "there's no simple way to get back").
      onHome={() => (swipeActive ? setTitleOpen(true) : handleNavigate("home"))}
      atHome={swipeActive}
      locked={career.unlocks ? {
        ...(isOpen(career, "league") ? {} : { league: LOCK_HINT.league }),
        ...(isOpen(career, "play") ? {} : { play: LOCK_HINT.play }),
        ...(isOpen(career, "relations") || managerTalkDue(career) ? {} : { life: LOCK_HINT.relations }),
        ...(isOpen(career, "training") ? {} : { skills: LOCK_HINT.training }),
        ...(isOpen(career, "phone") ? {} : { media: LOCK_HINT.phone }),
        // A phone lasts two seasons, then you need a new one (Harry, P103).
        // A broken phone locks the Phone button until you repair it in Style
        // (Harry, 1 Oct 2026: "it should lock until u repair").
        ...(isOpen(career, "phone") && career.ownedItems.some(o => (o.baseId ?? o.id) === "phone" && o.seasonsLeft === 0) ? { media: "Your phone broke — repair it in Style" } : {}),
      } : undefined}
      // The bottom-left button (v0.24, P2-68, P2-89): Achievements through the
      // first steps, then the player's answer to "switch this to League?".
      homeSlot={career.unlocks && isOpen(career, "achievements") && bottomLeft(career) === "achievements"
        ? { active: false, onClick: () => setPhase("achievements"), label: "Achievements", icon: "⭐" }
        : undefined}
    >
      {/* ── The pointer tutorial (PointerTour.tsx, lib/star/tours.ts): one
          tour at a time, in order, pointing at the real screen. ── */}
      {/* v0.25.1: the tour goes first. Each used to wait for the other, so with
          both due after game 1 (the boss prompt and the set-piece word)
          neither showed. The manager's word waits for the tour (!tour below). */}
      {tour && <PointerTour key={tour.key} steps={tour.steps} skippable={tour.skippable} onDone={tour.onDone} />}
      {swipeActive && newsQueue.length > 0 && !chainPop && newStar === null && (
        <BreakingNews key={newsQueue[0].headline} news={newsQueue[0]} onClose={() => setNewsQueue(q => q.slice(1))} />
      )}
      {setPieceChat && !tour && (
        <ManagerChat
          key={setPieceChat.duties.join()}
          name={career.manager?.name || loadLineup(career.player.club)?.manager || "The manager"}
          lines={setPieceChat.lines}
          onDone={() => setCareer(c => (c ? markSetPieceTold(c, setPieceChat.duties) : c))}
        />
      )}
      {/* Something opened: say what, then lead to it through Achievements (v0.24). */}
      {showAnnounce && (
        <UnlockPop
          key={announce.join()}
          features={announce}
          onSeeAll={() => { setCareer(c => (c ? markAnnounced(c, announce) : c)); seeAllAchievements(); }}
          onClose={() => setCareer(c => (c ? markAnnounced(c, announce) : c))}
        />
      )}
      {askSlot && (
        <SlotQuestion
          onLeague={() => setCareer(c => (c ? setBottomLeft(c, "league") : c))}
          onKeep={() => setCareer(c => (c ? setBottomLeft(c, "achievements") : c))}
        />
      )}
      {chainPop && (
        <AchievementPop label={chainPop.label} unlocked={chainPop.unlocked} phone={chainPop.phone} onClose={() => setChainPop(null)} onSeeAll={career.unlocks && !chainPop.stay ? seeAllAchievements : undefined} />
      )}
      {!chainPop && newStar === null && newsQueue.length === 0 && earnPops.length > 0 && (
        <AchievementPop key={earnPops[0].id} label={earnPops[0].label} unlocked={earnPops[0].unlocked} record={earnPops[0].kind === "record"} onClose={() => setEarnPops(q => q.slice(1))} onSeeAll={earnPops[0].kind === "achievement" ? seeAllAchievements : undefined} />
      )}
      {/* The rest days' energy, after a match (v0.24, P2-82). */}
      {energyToast && energyBack !== null && (
        <EnergyBackToast amount={energyBack} onDone={() => setEnergyBack(null)} />
      )}
      {lockNote && (
        <div className="pointer-events-none fixed inset-x-3 bottom-[86px] z-[90] mx-auto flex max-w-sm items-center gap-2 rounded-xl bg-gray-950/95 px-3 py-2 text-[12px] font-black text-white ring-1 ring-amber-300/40 shadow-lg">
          <span>🔒</span><span>{lockNote}</span>
        </div>
      )}
      {newStar !== null && (
        <button onClick={() => setNewStar(null)} className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-6 text-center" aria-label="Close">
          {/* The name is about your career, never the club you're at
              (Harry, 1 Oct 2026: "Non-league regular" while in the Prem). */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">Star rating</div>
            <div className="mt-1 text-[72px] font-black italic leading-none text-white" style={{ textShadow: "0 0 24px rgba(251,191,36,.7)" }}>★ {newStar}</div>
            <div className="mt-2 text-[15px] font-black text-amber-300">{starTitle(newStar)}</div>
            <div className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-2 text-sm font-black text-gray-950">Continue</div>
          </div>
        </button>
      )}
      {ratingChange && (
        <div className="mb-2 bg-emerald-500 border border-emerald-300 rounded-lg p-2 text-center text-black font-black text-xs animate-pulse">
          ▲ Star rating up: ★{ratingChange.from} → ★{ratingChange.to}
        </div>
      )}
      {phase === "dashboard" && career.managerNews && (
        <div className="mb-3 rounded-xl border border-red-500/50 bg-red-500/15 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">In the dugout</div>
            {/* Persisted CareerState, not a transient toast — see managerNews's
                own comment on why it needs an explicit dismiss rather than a
                timeout: reported directly, this banner used to sit on the
                dashboard for the rest of the entire season (every match,
                every Home tap) because nothing ever cleared it before the
                NEXT sacking or the next rollover, whichever came first. */}
            <button
              onClick={() => setCareer(c => (c && c.managerNews ? { ...c, managerNews: null } : c))}
              className="shrink-0 text-red-200/70 hover:text-white text-sm leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-white">{career.managerNews}</p>
        </div>
      )}
      {phase === "dashboard" && seasonOver && (
        <div className="mb-3 rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-600/10 p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Season {career.season} complete</div>
          <p className="mt-1 text-xs text-amber-50/90">Every fixture has been played. The awards are next.</p>
          <button
            onClick={handleSeasonEnd}
            className="mt-3 w-full rounded-xl bg-amber-400 py-2.5 font-black text-gray-950 hover:bg-amber-300"
          >
            End of Season 🏆
          </button>
        </div>
      )}
      {phase === "media" && activeNav === "media" && (
        <PhoneHome
          career={career}
          onToggleLike={handleToggleLike}
          onLeave={openHub}
          onClose={() => handleNavigate("home")}
          installed={career.unlocks ? (id) => appInstalled(career, id) : undefined}
          onInstall={(id) => setCareer(c => (c ? installApp(c, id) : c))}
        />
      )}
      {/* ── The swipe home screens: Stats · Home · Training ──
          Harry, 27 Sep 2026: stats on the left, training on the right, the
          next game, form, energy and you in your kit in the middle. The
          right-hand screen IS the "skills" phase, so the Training button,
          every Back-to-Life path and a swipe all land in the same place. */}
      {phase === "skills" && trainingBody}
      {swipeActive && (
        <SwipePages
          inset
          index={homePage}
          onIndex={(i) => {
            setHomePage(i as 0 | 1 | 2);
            setActiveNav("home");
            setPhase("dashboard");
          }}
          labels={["Stats", "Home", "Shop"]}
          // The Shop is a shop, not a light-green page (v0.25, P44).
          tones={[undefined, undefined, "calm"]}
          // Small arrows at the bottom edge instead of a tab row (Harry, 1 Oct
          // 2026); Stats' left arrow is the League, Home's pitch runs under them.
          arrows={{
            icons: ["📊", "🏠", "🛍️"],
            leftEnd: isOpen(career, "league") ? { icon: "🏆", label: "League", onClick: () => handleNavigate("league") } : undefined,
            bleed: [1],
          }}
        >
          {[
            isOpen(career, "stats")
              ? <StatsTabs key="stats" career={career} onRenew={() => setPhase("contract-renewal")} onOpen={(ph) => setPhase(ph)} />
              : <LockedPage key="stats" title="Stats" feature="stats" />,
            <HomeHub
              key="home"
              career={career}
              nextFixture={nextFixture}
              nextMatchDate={nextMatchDate ?? undefined}
              myTeam={nextFixture ? myTeam(nextFixture) : career.player.club}
              onUseCan={handleUseCan}
              onBuyCan={handleBuyKib}
              onOpen={openHub}
              onLeague={isOpen(career, "league") ? () => handleNavigate("league") : undefined}
            />,
            isOpen(career, "shop")
              ? <ShopPage key="shop" career={career} onOpen={openHub} sponsorsLock={isOpen(career, "sponsors") ? undefined : "Play well"} />
              : <LockedPage key="shop" title="Shop" feature="shop" />,
          ]}
        </SwipePages>
      )}
      {/* Above every phase, because winning it can land on the post-match
          screen and must not be something you have to go looking for. */}
      {potmWin && career && (
        <PotmWinModal award={potmWin} career={career} onClose={() => setPotmWin(null)} />
      )}
    </DashboardShell>
    </PitchScope>
  );
}

function TrainingTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-lg font-black text-xs transition ${
        active ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

// ── Settings → UI: Old | New (Harry, 1 Oct 2026; lib/star/uiLook.ts) ──
//
// Old UI is the career exactly as it was on branch Harry, frozen in
// components/star/legacy/. It still plays THE real match: this file is the
// one place allowed to mount <CanvasMatch> (scripts/one-engine-guard.mjs), so
// the old shell is handed it here instead of mounting its own.
function OldUiMatch(props: React.ComponentProps<typeof CanvasMatch>) {
  return <CanvasMatch {...props} />;
}

export default function StarDevPage() {
  const ui = useUiVersionOrNull();
  // Nothing until this device's choice is known: each UI loads and saves the
  // career the moment it mounts, so the wrong one must never flash up.
  if (ui === null) return null;
  return ui === "old" ? <LegacyStarDevPage Match={OldUiMatch} /> : <NewUiStarDevPage />;
}
