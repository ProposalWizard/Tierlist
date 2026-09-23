"use client";
import { freshItem, isWornOut } from "@/lib/star/fame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem, Horse, Fixture, GoalReplay } from "@/lib/star/types";
import { canPlaceCompetitionBet, type CompetitionBet } from "@/lib/star/competitionBetting";
import { addRecentGoal, saveReplayToSlot, deleteSavedReplay } from "@/lib/star/goalReplays";
import {
  loadCareer, saveCareer, clearCareer, saveStarPhase, loadStarPhase, loadCareerFromCloud, saveCareerToCloud,
  clearCareerFromCloud, loadCareerSavedAt, ANON_SCOPE, slotScope, listSaveSlots, loadActiveSlot, saveActiveSlot,
} from "@/lib/star/storage";
import { createClient } from "@/lib/supabase/client";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { mulberry32 } from "@/lib/star/season";
import { trialComplete, startTrial, trialScore, noteReload } from "@/lib/star/trial";
import { generateScoutOffers, clubsForDivision, type ScoutOffer } from "@/lib/star/scoutOffers";
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
import { signSponsor } from "@/lib/star/sponsors";
import { renameHorse } from "@/lib/star/horse";
import { getPostMatchReactionsEnabled } from "@/lib/star/postMatchPrefs";
import { selectionFor, MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { currentRound } from "@/lib/star/cups";
import { currentTie } from "@/lib/star/euro";
import { fixtureDateLabel, divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { sortLeague } from "@/lib/star/season";
import { generateRelegationOffers } from "@/lib/star/relegationOffers";
import { matchdayFor } from "@/lib/star/teamsheet";
import { loadLineup, saveLineup, fetchSharedLineups, type SavedLineup } from "@/lib/star/lineupStore";
import { DEFAULT_FORMATION, formationOf, type Role } from "@/lib/star/formations";
import { spendAction, rest, canAct, projectedEnergy, startNewWeek } from "@/lib/star/week";
import { generateOffers, acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { type PressQuestion, type PressOption } from "@/lib/star/media";
import type { MonthAward } from "@/lib/star/potm";
import { generateForMatch, generateForCareer, generateForLeagueWeek, generateForBoardroomSale, hasFreshMedia } from "@/lib/star/media/feed";
import { skipTo, type SkipTarget } from "@/lib/star/devSkip";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";
import { fetchRealSquad, shouldUpgradeSquad, mergeSquadStats } from "@/lib/star/realSquad";
import { fetchLeagueSquads, mergeLeagueSquadStats, shouldUpgradeLeagueSquads, shouldUpgradeExternalSquads, syncLeagueStrengthFromSquads, fetchFreeAgents } from "@/lib/star/leagueSquads";
import { externalClubsFor } from "@/lib/star/clubs";
import { conditionsFor, conditionsLine } from "@/lib/star/weather";
import PressConference from "@/components/star/PressConference";
import TransferWindow from "@/components/star/TransferWindow";
import RelegationMove from "@/components/star/RelegationMove";
import TransferSigning from "@/components/star/TransferSigning";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import { computeStarRating, growthMultiplier } from "@/lib/star/rating";
import { getTuning } from "@/lib/star/tuningStore";
import ProfileSetup from "@/components/star/ProfileSetup";
import TrialSequence from "@/components/star/TrialSequence";
import FreeAgentShell from "@/components/star/FreeAgentShell";
import TrialReward from "@/components/star/TrialReward";
import DashboardShell, { type NavTab } from "@/components/star/DashboardShell";
import DashboardStats from "@/components/star/DashboardStats";
import LeagueScreen from "@/components/star/LeagueScreen";
import LadderScreen from "@/components/star/LadderScreen";
import SeasonAwardsScreen from "@/components/star/SeasonAwardsScreen";
import LifeScreen from "@/components/star/LifeScreen";
import PotmWinModal from "@/components/star/PotmWinModal";
import VersusScreen from "@/components/star/VersusScreen";
import PositionPicker from "@/components/star/PositionPicker";
import ScoutReportCard from "@/components/star/ScoutReport";
import { scoutReportFor } from "@/lib/star/scoutReport";
import ClubCrest from "@/components/star/ClubCrest";
import { kitsFor } from "@/lib/star/kits";
import { groundFor, crowdFor } from "@/lib/star/stadiums";
import SkillsScreen, { TRAINING_ENERGY_COST } from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import CanvasMatch from "@/components/star/CanvasMatch";
import PostMatch from "@/components/star/PostMatch";
import CupDrawReveal, { type DrawRound } from "@/components/star/CupDrawReveal";
import DeadlineDayRoundup from "@/components/star/DeadlineDayRoundup";
import SettingsScreen from "@/components/star/SettingsScreen";
import FaceEditorScreen from "@/components/star/FaceEditorScreen";
import FakeFaceEditorScreen from "@/components/star/FakeFaceEditorScreen";
import MediaFeed from "@/components/star/MediaFeed";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";

/** The dashboard KIB Cans card's own accent per tier — the same colour as
 *  the can's real photo (see shopData.ts's `color`), as a hex value rather
 *  than a Tailwind class so it can drive an inline border/background wash
 *  too, not just a token. */
const KIB_ACCENT: Record<KibCan["id"], { hex: string }> = {
  basic: { hex: "#fb923c" },
  premium: { hex: "#60a5fa" },
  elite: { hex: "#c084fc" },
};

import KibCanIcon from "@/components/star/KibCanIcon";
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
import { SponsorsScreen, AchievementsScreen, TrophiesScreen, ReputationScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import GardenScreen from "@/components/star/GardenScreen";
import RelationshipMinigame, { type RelationshipKind } from "@/components/star/RelationshipMinigame";
import { useImmersiveMode } from "@/components/star/ImmersiveToggle";

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
  return generateScoutOffers(
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
  if (agreed.wage <= 0) return offers.filter(o => o.club !== agreed.club);
  return offers.map(o => (o.club === agreed.club
    ? { ...o, wage: agreed.wage, goalBonus: goalBonusFor(agreed.wage), assistBonus: assistBonusFor(agreed.wage) }
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
export default function StarDevPage() {
  const immersive = useImmersiveMode();
  return <StarDevInner immersive={immersive} />;
}

function StarDevInner({ immersive }: { immersive: ReturnType<typeof useImmersiveMode> }) {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<NavTab | null>(null);
  const [trainingTab, setTrainingTab] = useState<"training" | "life">("training");
  const [trainingSkill, setTrainingSkill] = useState<keyof Skills | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [contractOfferReason, setContractOfferReason] = useState<"form" | "star" | null>(null);
  /** Set right before jumping to "investments" from the Ownership hub, so a
   *  club card can open straight into that club's boardroom instead of
   *  making the player re-navigate through tabs they just came from. Reset
   *  once read so re-opening Invest from its own home button still starts
   *  on Market like it always has. */
  const [investmentsEntry, setInvestmentsEntry] = useState<{ tab: "market" | "portfolio" | "boardroom"; club?: string; section?: "squad" | "sign" | "manager" | "powers" } | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  /** A star rating that just moved — see toastRatingChange. Cleared the same
   *  flat-timeout way the achievement toast above already is. */
  const [ratingChange, setRatingChange] = useState<{ from: number; to: number } | null>(null);
  const [relationshipGameKind, setRelationshipGameKind] = useState<RelationshipKind | null>(null);
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
    saveCareer(career, slotScope(scopeRef.current, activeSlotRef.current)); // localStorage — immediate
    // Debounced cloud save: waits 3 s after the last change so a burst of
    // state updates (end of match, season rollover) produces one write, not
    // many. The slot is captured now, at the moment the timer is set, not
    // re-read when it actually fires — see flushCloudSave's own note on why
    // a save already in flight has to land on the slot it was really FOR,
    // not whichever slot happens to be active three seconds from now.
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    const slotAtSaveTime = activeSlotRef.current;
    cloudSaveTimer.current = setTimeout(() => { saveCareerToCloud(career, slotAtSaveTime); }, 3000);
  }, [career]);

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
  const duties = career && selection ? setPieceDuties(career, selection.status) : null;
  // What your energy — and therefore your selection — will actually be once
  // you go and play: every day still unspent this week counts toward it
  // automatically (handlePlayMatch banks it for real the moment you commit).
  // The pre-match screen reads THESE, not the raw pre-credit `career`/
  // `selection` above, so it shows and decides off the number you're really
  // about to have rather than a stale one from before this week finished.
  const preMatchEnergy = career ? projectedEnergy(career) : 0;
  const preMatchSelection = career ? selectionFor({ ...career, energy: preMatchEnergy }) : null;
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
    if (confirm("Leave the career? It stays saved — you will come back to exactly this. To start a new one or switch saves, use Saves in Settings.")) {
      window.location.href = "/";
    }
  }, []);

  const handleNavigate = useCallback((tab: NavTab) => {
    setActiveNav(tab);
    if (tab === "league") setPhase("league");
    else if (tab === "skills") { setTrainingTab("training"); setPhase("skills"); }
    else if (tab === "home") setPhase("dashboard");
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
    if (!career || !canAct(career)) return;
    setTrainingSkill(skill);
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

  const handleTrainingComplete = useCallback((xp: number) => {
    if (!career || !trainingSkill) return;
    const currentVal = career.skills[trainingSkill];
    // A younger player gets more out of the same session than a veteran
    // does — see growthMultiplier's own note; applied here rather than to
    // `xp` itself so the drill's own scoring (TrainingMinigame.tsx) stays
    // exactly what it always was.
    const gain = Math.min(100 - currentVal, Math.round(Math.floor(xp / getTuning("training.minigameXpDivisor")) * growthMultiplier(career.player.age)));
    const updated: CareerState = {
      ...career,
      skills: { ...career.skills, [trainingSkill]: currentVal + gain },
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
    toastRatingChange(career.starRating, updated.starRating);
    setCareer(spendAction(updated));
    setTrainingSkill(null);
    // A youth-team player's week is lived on his own screen, so training
    // from it comes back to it rather than dropping him on the first team's
    // skills page with no obvious way back.
    setPhase(career.placement?.kind === "youth" ? "youth" : "skills");
  }, [career, trainingSkill]);

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
    toastRatingChange(career.starRating, next.starRating);
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
  const toastRatingChange = (from: number, to: number) => {
    const fromShown = Math.round(from * 10) / 10;
    const toShown = Math.round(to * 10) / 10;
    if (toShown <= fromShown) return;
    setRatingChange({ from: fromShown, to: toShown });
    setTimeout(() => setRatingChange(null), 3000);
  };

  const handleMatchComplete = useCallback((stats: MatchStats) => {
    if (!career || !nextFixture) return;
    setLastMatchStats(stats);
    setPlayedFixture(nextFixture);
    const { career: next, newlyUnlocked, potmAwarded } = creditMatchResult(career, nextFixture, stats);
    toastAchievements(newlyUnlocked);
    toastRatingChange(career.starRating, next.starRating);
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
  }, [career, nextFixture, applyFormCollapse]);

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
        if (freshlyDrawn && round) {
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
    // pass through the phone screen.
    if (getPostMatchReactionsEnabled() && hasFreshMedia(career)) { setPhase("media"); return; }
    continueAfterMatch(career, !pressQuestion);
  }, [career, continueAfterMatch, pressQuestion]);

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
    toastRatingChange(from.starRating, next.starRating);
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
    // ── Relegated out of the National League ──
    //
    // The four-club pool the old club drops into has no fixtures, no table,
    // no season — so this cannot be the ordinary optional window
    // (TransferWindow, with its "stay put" button). A new club has to be
    // chosen before the season can roll over at all, because advanceSeason
    // needs to know which real division to build next season's fixtures in.
    // Every OTHER boundary (including Championship -> League One) now just
    // carries on into next season's real fixtures, since League One, League
    // Two and the National League are all real playable divisions.
    if (divisionOf(from) === "national_league"
      && sortLeague(from.league).slice(-4).map(t => t.name).includes(from.player.club)) {
      const offers = generateRelegationOffers(from, mulberry32(from.season * 8831 + from.fame));
      // Guaranteed non-empty in the normal game — a division this small only
      // happens in a test fixture, and rolling over rather than showing an
      // empty offer screen is the safer failure.
      if (offers.length > 0) {
        setTransferOffers(offers);
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
    setCareer(moved);
    setTransferOffers([]);
    setPendingSignOffer(null);
    // `justTransferred: true` — `moved.contract` is the new club's deal, not
    // one stayed on for the season; see advanceSeason's own doc on why this
    // has to be told rather than inferred from `moved` alone.
    rollOverSeason(moved, wonBallonDor, wasRelegationMove, true);
  }, [career, pendingSignOffer, wonBallonDor, rollOverSeason]);

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
      const squad = mergeSquadStats(freshSquad, c.squad ?? []);
      const leagueSquads = mergeLeagueSquadStats(freshLeague, c.leagueSquads ?? []);
      const externalSquads = mergeLeagueSquadStats(freshExternal, c.externalSquads ?? []);
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
    setLastMatchStats(null);
    setCurrentDilemma(null);
    setContractOfferReason(null);
    setInvestmentsEntry(null);
    setUnlockedAchievements([]);
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
  const loadCareerIntoState = useCallback(async (slot: number) => {
    setCloudLoading(true);
    resetTransientState();
    const scope = slotScope(scopeRef.current, slot);
    const local = loadCareer(scope);
    const localAt = local ? loadCareerSavedAt(scope) : -1;
    const cloud = await loadCareerFromCloud(slot);
    const saved = cloud && cloud.savedAt > localAt ? cloud.career : local;
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
    } else if (shouldUpgradeLeagueSquads(saved.leagueSquads!)) {
      // A division fetched before faces and flags existed. Re-fetched once, in
      // the background, and merged rather than replaced — this season's goals
      // and assists were real and stay real; only the missing fields fill in.
      fetchLeagueSquads(saved.league.map(t => t.name)).then((fresh) => {
        setCareer(c => {
          if (!c) return c;
          const leagueSquads = mergeLeagueSquadStats(fresh, c.leagueSquads ?? []);
          return { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) };
        });
      });
    }

    // ── …and the wider world, for an existing career that predates it ──
    if (!(saved.externalSquads ?? []).length) {
      fetchLeagueSquads(externalClubsFor(saved.league.map(t => t.name))).then((externalSquads) => {
        setCareer(c => (c && !(c.externalSquads ?? []).length ? { ...c, externalSquads } : c));
      });
    } else if (shouldUpgradeExternalSquads(saved.externalSquads!, externalClubsFor(saved.league.map(t => t.name)))) {
      // A career that first fetched the wider world while most of those
      // clubs still had zero real rows, OR whose snapshot simply predates a
      // club the CURRENT code expects to find (see shouldUpgradeExternalSquads'
      // own comment) — re-fetched and merged, same as the domestic re-fetch
      // just above, rather than staying stuck with a stale snapshot forever.
      fetchLeagueSquads(externalClubsFor(saved.league.map(t => t.name))).then((fresh) => {
        setCareer(c => (c ? { ...c, externalSquads: mergeLeagueSquadStats(fresh, c.externalSquads ?? []) } : c));
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
    if (cloudSaveTimer.current) {
      clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
    if (career) saveCareerToCloud(career, activeSlotRef.current);
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
  const handleDeleteSave = useCallback((slot: number) => {
    if (!confirm("Delete this save? This cannot be undone.")) return;
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

  const handleFullReset = useCallback(() => {
    if (career?.retired || confirm("Delete this career and start over?")) {
      clearCareer(slotScope(scopeRef.current, activeSlotRef.current));
      clearCareerFromCloud(activeSlotRef.current);
      resetTransientState();
      setCareer(null);
      setPhase("profile-setup");
    }
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
    setCareer({
      ...career,
      kibCans: { ...career.kibCans, [id]: career.kibCans[id] - 1 },
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
    const owned = career?.ownedItems.find((o) => o.id === item.id);
    if (!career || career.money < item.price || (owned && !isWornOut(owned))) return;
    setCareer({
      ...career,
      money: career.money - item.price,
      ownedItems: [...career.ownedItems.filter((o) => o.id !== item.id), freshItem(item)],
      happiness: Math.min(100, career.happiness + Math.floor(item.lifestyleValue / 3)),
    });
  }, [career]);

  const handleSignSponsor = useCallback((category: string) => {
    if (!career) return;
    setCareer(signSponsor(career, category));
  }, [career]);

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
    setCareer(sellStake(career, club, percent));
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

  const handleRelationshipGameComplete = useCallback((gain: number) => {
    if (!career || !relationshipGameKind) return;
    let updated: CareerState = { ...career };
    if (relationshipGameKind === "happiness") {
      updated.happiness = Math.min(100, career.happiness + gain);
    } else {
      updated.relationships = {
        ...career.relationships,
        [relationshipGameKind]: Math.min(100, career.relationships[relationshipGameKind] as number + gain),
      };
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
    setCareer({ ...career, money: Math.max(0, Math.round(finalBank)) });
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
        onAccept={() => {
          setCareer({ ...career, agreedTerms: { club: talking.club, wage: talk.openingWeekly } });
          setPhase("scout-offers");
        }}
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
          // A walkout is recorded as a wage of 0, which takes that club off
          // the newspaper entirely — see `offersWithAgreedTerms`. Pushing a
          // manager too far genuinely costs you the contract.
          setCareer({ ...career, agreedTerms: { club: talk.club, wage: weekly ?? 0 } });
          setPhase("scout-offers");
        }}
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
        onAccept={offer => {
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
        }}
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
  if (phase === "trial-stages" && career?.trial && trialComplete(career.trial)) {
    setPhase(afterTrialPhase(career));
    return null;
  }

  if (phase === "trial-stages" && career?.trial) {
    return (
      <TrialSequence
        trial={career.trial}
        playerName={career.player.firstName}
        skills={{
          power: career.skills.power,
          technique: career.skills.technique,
          // The dribbling stage runs on this and nothing else.
          pace: career.skills.pace,
        }}
        onTrial={t => setCareer(c => (c ? { ...c, trial: t } : c))}
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
        onDone={() => {
          setActiveNav("home");
          setPhase(onLoan ? "loan-brief" : "dashboard");
        }}
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
    return <ProfileSetup onComplete={handleProfileComplete} />;
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
    // `level` is the whole point of the rebuilt drills: every one of them is
    // calibrated to the stat it trains, so the same session gets genuinely
    // harder as that number climbs (see lib/star/trainingDrills.ts). It was
    // never passed before, which is why training played identically at 5 and
    // at 95. `skills` goes to the engine's own `launch`, so a strike in
    // training is the same strike it would be in a match.
    return (
      <TrainingMinigame
        skill={trainingSkill}
        level={career.skills[trainingSkill]}
        skills={career.skills}
        onComplete={handleTrainingComplete}
      />
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
    const canCurve = bootMatchesLeft && !!career.currentBoot.curve;
    const canExtraTouch = bootMatchesLeft && !!career.currentBoot.extraTouch;
    return (
      <div
        className="min-h-screen bg-gray-950 text-white py-4 px-3"
        style={{ backgroundImage: "radial-gradient(70% 45% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)" }}
      >
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
          />
        </div>
      </div>
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
      <PostMatch
        stats={lastMatchStats}
        homeTeam={playedFixture.home ? myTeam(playedFixture) : playedFixture.opponent}
        awayTeam={playedFixture.home ? playedFixture.opponent : myTeam(playedFixture)}
        youAreHome={playedFixture.home !== false}
        competition={playedFixture.kind && playedFixture.kind !== "league" ? fixtureLabel(playedFixture) : undefined}
        knockout={career.knockoutMessage}
        onContinue={handlePostMatchContinue}
      />
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
    return <MediaFeed career={career} mode="moment" onContinue={handleMediaContinue} />;
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
        onDone={handleSigningDone}
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

  if (phase === "shop-kib" || phase === "shop-boots" || phase === "shop-lifestyle") {
    const kind = phase === "shop-kib" ? "kib" : phase === "shop-boots" ? "boots" : "lifestyle";
    return (
      <Shop
        career={career}
        kind={kind}
        onBack={handleBackToDashboard}
        onBuyKib={handleBuyKib}
        onBuyBoot={handleBuyBoot}
        onBuyItem={handleBuyItem}
        onBuyFromBlackMarket={handleBuyFromBlackMarket}
      />
    );
  }

  if (phase === "casino-menu") {
    return <Casino bankStart={career.money} career={career} onExit={handleCasinoExit} onHorseRace={handleHorseRace} onBuyHorse={handleBuyHorse} onRenameHorse={handleRenameHorse} onPlaceBet={handlePlaceBet} />;
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

  if (phase === "sponsors") return <SponsorsScreen career={career} onBack={handleBackToDashboard} onSign={handleSignSponsor} />;
  if (phase === "achievements") return <AchievementsScreen career={career} onBack={handleBackToDashboard} />;
  if (phase === "trophies") return <TrophiesScreen trophies={career.trophies} ballonDors={career.ballonDorWins} awards={career.awards} onBack={handleBackToDashboard} />;
  if (phase === "garden") return <GardenScreen career={career} onBack={handleBackToDashboard} />;
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
      <SettingsScreen
        career={career}
        onBack={handleBackFromSettings}
        onSkip={handleDevSkip}
        onAddMoney={handleAddMoney}
        onSetCaptain={handleSetCaptain}
        onSetReputation={handleSetReputation}
        onSetFame={handleSetFame}
        onMaxSkills={handleMaxSkills}
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
        immersiveActive={immersive.active}
        onToggleImmersive={immersive.toggle}
      />
    );
  }
  if (phase === "face-editor") {
    return <FaceEditorScreen career={career} onBack={() => setPhase("settings")} />;
  }
  if (phase === "fake-face-editor") {
    return <FakeFaceEditorScreen career={career} onBack={() => setPhase("settings")} />;
  }
  if (phase === "relationship-game" && relationshipGameKind) {
    const currentValue = relationshipGameKind === "happiness"
      ? career.happiness
      : (career.relationships[relationshipGameKind] as number);
    return (
      <RelationshipMinigame
        kind={relationshipGameKind}
        currentValue={currentValue}
        onComplete={handleRelationshipGameComplete}
        onCancel={() => { setRelationshipGameKind(null); setActiveNav("skills"); setTrainingTab("life"); setPhase("skills"); }}
      />
    );
  }

  // Pre-match confirmation
  if (phase === "pre-match" && nextFixture) {
    // ── The team sheets ──
    //
    // Between the pre-match screen and kick-off, because the eleven you are
    // about to play against is the last thing worth knowing and the game has
    // never once said it. Only for club football: an international squad is not
    // in `leagueSquads` and there is nothing honest to draw.
    // Decided BEFORE the branch, never inside it: falling back by calling a
    // state setter mid-render is a React error, and "can we draw this?" is a
    // question about data that render is entitled to ask.
    // The side you actually picked, shape and all — not just its bench, which
    // is all this used to read. See teamsheet.ts's SavedXI.
    const saved = loadLineup(career.player.club);
    const savedXI = saved && saved.xi.some(Boolean)
      ? { formation: formationOf(saved.formation), xi: saved.xi }
      : undefined;
    const matchday = nextFixture.kind === "international"
      ? null
      : matchdayFor(career, nextFixture, preMatchSelection?.status === "1st Team", playAs ?? undefined, saved?.bench, savedXI, preMatchSelection?.status === "Substitute");
    // Whether YOUR side is drawable — the bar the button decides on now. An
    // under-scouted OPPONENT no longer holds the screen back at all: it gets
    // its own "Unable to scout" half instead (see VersusScreen). Only an
    // international fixture (no matchday at all) or your own squad falling
    // short — practically never, but the same honest fallback either way —
    // sends the button straight past the team sheets.
    const teamsReady = !!matchday && (matchday.home.yours ? matchday.home : matchday.away).xi.length >= 9;

    if (showTeams && matchday && teamsReady) {
      return (
        <VersusScreen
          matchday={matchday}
          date={fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind, divisionOf(career))}
          results={career.results}
          clubKits={career.clubKits}
          competition={
            !nextFixture.kind || nextFixture.kind === "league"
              ? `${leagueNameFor(divisionOf(career))} · Matchday ${nextFixture.week}`
              : `${nextFixture.competition}${nextFixture.round ? ` · ${nextFixture.round}` : ""}`
          }
          onKickOff={() => { setShowTeams(false); handlePlayMatch(); }}
          onBack={() => setShowTeams(false)}
        />
      );
    }

    const mine = nextFixture.kind === "international" ? nationOf(career) : career.player.club;
    const home = nextFixture.home ? mine : nextFixture.opponent;
    const away = nextFixture.home ? nextFixture.opponent : mine;
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex items-center justify-center px-3 py-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-4">
            <div className={`inline-block px-4 py-1 rounded-full border text-[10px] font-black tracking-widest uppercase ${
              !nextFixture.kind || nextFixture.kind === "league"
                ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300"
                : nextFixture.kind === "international"
                  ? "bg-sky-500/20 border-sky-400/40 text-sky-200"
                  : "bg-violet-500/20 border-violet-400/40 text-violet-200"}`}
            >
              Week {nextFixture.week} · {fixtureLabel(nextFixture)}
            </div>
            <h1 className="mt-2 text-2xl font-black">
              {nextFixture.derby ? "Derby Day" : nextFixture.kind && nextFixture.kind !== "league" ? nextFixture.round : "Match Day"}
            </h1>
            {nextFixture.derby && (
              <p className="mt-1 text-[11px] font-bold text-red-300">
                The one that counts. Everything is worth more today.
              </p>
            )}
          </div>
          {(() => {
            const kits = kitsFor(home, away);
            // Whoever is HOME hosts it — `home` is already the real home
            // side of this fixture, not necessarily you.
            const ground = groundFor(home);
            const crowd = crowdFor(home, nextFixture.week);
            // The real stadium photo the gradient was always built to sit
            // underneath — supplied directly. Europe's own three nights
            // (Champions League, Europa League, and the Super Cup, which is
            // contested BETWEEN two European winners) get the UEFA-branded
            // shot; everything else — league, FA Cup, League Cup, Community
            // Shield, internationals — gets the ordinary floodlit ground.
            //
            // Both source files arrived with a black letterboxed/rounded
            // frame baked into the PNG itself (a screenshot of a generated
            // image, corners and all) — `cover` was scaling that black
            // padding right along with the real photo, so depending on this
            // box's own aspect ratio the actual stadium could be cropped
            // strangely or shrunk to leave black bars showing. Cropped out
            // at the source now (see git history for the originals) so
            // `cover` has nothing but real photo to work with. The gradient
            // itself was also darker than intended, worst right at the
            // bottom — reported directly, twice: "doesn't fit the entire
            // box... quite odd" and "a lot darker and shadier than I
            // imagined... like an effect." Lightened across the board.
            const isEuropeanNight = nextFixture.competition === "Champions League"
              || nextFixture.competition === "Europa League"
              || nextFixture.competition === "Super Cup";
            const stadiumPhoto = isEuropeanNight ? "/star/stadium-europe.png" : "/star/stadium-domestic.png";
            return (
              <div
                className="relative overflow-hidden rounded-xl border border-emerald-800/60 shadow-lg"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(11,42,31,0.25) 0%, rgba(10,31,39,0.35) 55%, rgba(7,19,24,0.5) 100%), url(${stadiumPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(120% 55% at 50% -10%, rgba(16,185,129,0.30), transparent 60%)" }}
                />
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <ClubCrest club={home} kit={kits.home} size={56} />
                    <div className="flex flex-col items-center gap-1 px-1 pt-3">
                      <div className="text-xs font-black text-white/60 tracking-widest">VS</div>
                    </div>
                    <ClubCrest club={away} kit={kits.away} size={56} />
                  </div>
                  <div className="mt-3 text-center text-[10px] text-white/70">
                    🏟️ {ground.name} · Crowd: {crowd.toLocaleString()}
                  </div>
                  {!career.injury && preMatchEnergy < MIN_ENERGY_TO_START && (
                    <div className="mt-3 text-center text-amber-300 text-[10px] font-bold">⚠ Too fatigued to start — the manager will only risk you off the bench</div>
                  )}
                  {career.injury && (
                    <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-2.5 py-2 text-left">
                      <div className="text-red-300 text-[10px] font-black uppercase tracking-wide">🩹 {career.injury.note}</div>
                      <div className="mt-0.5 text-[10px] text-white/80">
                        Out for {career.injury.weeksRemaining} more week{career.injury.weeksRemaining === 1 ? "" : "s"} — you cannot be selected until you are fit.
                      </div>
                    </div>
                  )}
                  <div className="mt-3 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] text-white text-center">
                    {conditionsLine(conditionsFor(career.season, nextFixture.week, career.homeCity))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Who you're actually about to play — requested directly, with a
              real scouting-app screenshot as the reference. Club opponents
              only: an international opponent is a nation, not a squad to
              scout the way this reads. */}
          {nextFixture.kind !== "international" && (
            <ScoutReportCard report={scoutReportFor(career, nextFixture.opponent, nextFixture.week, nextFixture)} />
          )}

          {/* The manager's team sheet. Boss, form, reputation and sharpness used
              to move every week and decide nothing at all. Which position you
              play this match lives here too now — it was its own box above
              this one, but it's a decision that belongs with the rest of
              "your role this match", not a separate stop on the page. */}
          {preMatchSelection && (
            <div className={`mt-3 rounded-xl border p-3 ${
              preMatchSelection.status === "1st Team" ? "border-emerald-500/50 bg-emerald-500/10"
                : preMatchSelection.status === "Substitute" ? "border-amber-400/50 bg-amber-400/10"
                  : "border-red-500/50 bg-red-500/10"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Your role</span>
                <span className={`text-xs font-black ${
                  preMatchSelection.status === "1st Team" ? "text-emerald-300"
                    : preMatchSelection.status === "Substitute" ? "text-amber-200" : "text-red-300"}`}
                >
                  {preMatchSelection.status === "1st Team" ? "Starting Eleven"
                    : preMatchSelection.status === "Substitute" ? `Bench (on ~${preMatchSelection.onAt}')`
                      : preMatchSelection.status === "Injured" ? "Injured"
                        : "Out of Squad"}
                </span>
              </div>

              {nextFixture.kind !== "international" && (
                <PositionPicker
                  club={career.player.club}
                  realPosition={career.player.position}
                  playAs={playAs}
                  onChange={setPlayAs}
                  embedded
                />
              )}

              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/20 rounded-lg py-2 text-center">
                  <div className="text-white/75 text-[10px] font-bold">Match Fitness</div>
                  <div className="font-black text-emerald-300 text-base">{Math.round(career.matchFitness)}%</div>
                </div>
                <div className="bg-black/20 rounded-lg py-2 text-center">
                  <div className="text-white/75 text-[10px] font-bold">Energy</div>
                  <div className={`font-black text-base ${
                    // Green starts, amber is the bench, red is left out — the real selection lines.
                    preMatchEnergy >= MIN_ENERGY_TO_START ? "text-emerald-300" : preMatchEnergy >= MIN_ENERGY_TO_SUB ? "text-amber-300" : "text-red-400"}`}
                  >
                    {Math.round(preMatchEnergy)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={handleBackToDashboard} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black">← Back</button>
            {preMatchSelection?.status === "Squad" || preMatchSelection?.status === "Injured" ? (
              <button onClick={handleWatchFromStands} className="py-3 bg-gray-600 hover:bg-gray-500 rounded-xl font-black">Watch from the stands</button>
            ) : (
              <button
                onClick={() => (teamsReady ? setShowTeams(true) : handlePlayMatch())}
                className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black"
              >
                {/* Gated on YOUR side only now — an under-scouted opponent
                    still gets a team-sheet screen, just with "Unable to
                    scout opponent's team" on their half (see VersusScreen).
                    Only an international fixture, or your own squad falling
                    short, skips the screen entirely. */}
                {teamsReady
                  ? "Team sheets →"
                  : preMatchSelection?.status === "Substitute" ? "Take your place on the bench ⚽" : "Play Match ⚽"}
              </button>
            )}
          </div>
        </div>
      </div>
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

  return (
    <DashboardShell
      career={career}
      onExit={handleExit}
      onNavigate={handleNavigate}
      onSettings={() => setPhase("settings")}
      activeNav={activeNav}
      mediaUnread={hasFreshMedia(career) && activeNav !== "media"}
      nextMatchLabel={nextMatchLabel}
      nextMatchDate={nextMatchDate ?? undefined}
      fullBleed={phase === "media" && activeNav === "media"}
    >
      {unlockedAchievements.length > 0 && (
        <div className="mb-2 bg-yellow-500 border border-yellow-300 rounded-lg p-2 text-center text-black font-black text-xs animate-pulse">
          ⭐ Achievement Unlocked: {unlockedAchievements[0]} ⭐
        </div>
      )}
      {ratingChange && (
        <div className="mb-2 bg-emerald-500 border border-emerald-300 rounded-lg p-2 text-center text-black font-black text-xs animate-pulse">
          ▲ Rating Up: {ratingChange.from.toFixed(1)}★ → {ratingChange.to.toFixed(1)}★
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
      {phase === "dashboard" && (
        <DashboardStats career={career} onRenew={() => setPhase("contract-renewal")} />
      )}
      {phase === "dashboard" && (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <QuickBtn label="KIB" icon="🥤" onClick={() => setPhase("shop-kib")} />
            <QuickBtn label="Boots" icon="👟" onClick={() => setPhase("shop-boots")} />
            <QuickBtn label="Style" icon="💎" onClick={() => setPhase("shop-lifestyle")} />
            <QuickBtn label="Casino" icon="🎰" onClick={() => setPhase("casino-menu")} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <QuickBtn label="Sponsors" icon="🤝" onClick={() => setPhase("sponsors")} />
            <QuickBtn label="Awards" icon="⭐" onClick={() => setPhase("achievements")} />
            <QuickBtn label="Trophies" icon="🏆" onClick={() => setPhase("trophies")} />
            <QuickBtn label="Ownership" icon="🏛️" onClick={() => setPhase("ownership")} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <QuickBtn label="Garden" icon="🌳" onClick={() => setPhase("garden")} />
          </div>
          <div className="mt-2 bg-gray-800 rounded-lg border border-gray-700 p-3">
            <div className="text-[10px] font-black uppercase text-white/85 tracking-widest mb-2">KIB Cans</div>
            <div className="grid grid-cols-3 gap-2">
              {KIB_CANS.map((c) => {
                const count = career.kibCans[c.id];
                const accent = KIB_ACCENT[c.id];
                return (
                  <div
                    key={c.id}
                    className="relative overflow-hidden rounded-xl border p-2 text-center"
                    style={{ borderColor: `${accent.hex}66`, backgroundColor: "#15151a" }}
                  >
                    {/* A diagonal wash in the can's own colour, standing in
                        for the concept art's background graphics — no extra
                        art asset needed, just the accent already on the
                        can's own data. */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-25"
                      style={{
                        backgroundImage: `repeating-linear-gradient(115deg, ${accent.hex}55 0px, ${accent.hex}55 2px, transparent 2px, transparent 14px)`,
                      }}
                    />
                    {/* How many owned, as a corner badge rather than its own
                        text row — same information, less vertical space. */}
                    <div
                      className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums text-gray-950"
                      style={{ backgroundColor: accent.hex }}
                    >
                      ×{count}
                    </div>
                    <div className="relative">
                      <KibCanIcon can={c} className="h-[84px] w-full mb-1.5" />
                      <div className="text-[10px] font-black text-white">{c.name.replace(" KIB Can", "")}</div>
                      <div className="text-[9px] font-bold text-white/55">+{c.restore} energy</div>
                      <button
                        disabled={count === 0}
                        onClick={() => handleUseCan(c.id)}
                        className={`mt-1.5 w-full rounded-md py-1 text-[10px] font-black uppercase tracking-wide transition ${
                          count > 0 ? "text-gray-950" : "bg-gray-700 text-white/40"
                        }`}
                        style={count > 0 ? { backgroundColor: accent.hex } : undefined}
                      >
                        Use
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {phase === "league" && (
        <LeagueScreen career={career} />
      )}
      {phase === "media" && activeNav === "media" && (
        <MediaFeed career={career} mode="browse" />
      )}
      {phase === "skills" && (
        <div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <TrainingTabBtn label="Training" active={trainingTab === "training"} onClick={() => setTrainingTab("training")} />
            <TrainingTabBtn label="Life" active={trainingTab === "life"} onClick={() => setTrainingTab("life")} />
          </div>
          {trainingTab === "training" ? (
            <SkillsScreen career={career} onTrain={handleTrain} />
          ) : (
            <LifeScreen
              career={career}
              onPlayRelationshipGame={handleOpenRelationshipGame}
              onRest={handleRest}
            />
          )}
        </div>
      )}
      {/* Above every phase, because winning it can land on the post-match
          screen and must not be something you have to go looking for. */}
      {potmWin && career && (
        <PotmWinModal award={potmWin} career={career} onClose={() => setPotmWin(null)} />
      )}
    </DashboardShell>
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

function QuickBtn({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg py-2 flex flex-col items-center transition"
    >
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] font-black text-white mt-0.5">{label}</div>
    </button>
  );
}
