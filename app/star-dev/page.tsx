"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem, Horse, Fixture } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer, saveStarPhase, loadStarPhase, loadCareerFromCloud, saveCareerToCloud, clearCareerFromCloud, loadCareerSavedAt } from "@/lib/star/storage";
import { mulberry32 } from "@/lib/star/season";
import { makeInitialCareer, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed } from "@/lib/star/careerFlow";
import { selectionFor, MIN_ENERGY_TO_START } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { currentRound } from "@/lib/star/cups";
import { currentTie } from "@/lib/star/euro";
import { fixtureDateLabel, divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { sortLeague } from "@/lib/star/season";
import { generateRelegationOffers } from "@/lib/star/relegationOffers";
import { matchdayFor } from "@/lib/star/teamsheet";
import { loadLineup, fetchSharedLineups } from "@/lib/star/lineupStore";
import { formationOf, type Role } from "@/lib/star/formations";
import { spendAction, rest, canAct, skipToMatchDay } from "@/lib/star/week";
import { generateOffers, acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { type PressQuestion, type PressOption } from "@/lib/star/media";
import type { MonthAward } from "@/lib/star/potm";
import { generateForMatch, generateForCareer, hasFreshMedia } from "@/lib/star/media/feed";
import { skipTo, type SkipTarget } from "@/lib/star/devSkip";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";
import { fetchRealSquad, shouldUpgradeSquad, mergeSquadStats } from "@/lib/star/realSquad";
import { fetchLeagueSquads, mergeLeagueSquadStats, shouldUpgradeLeagueSquads, syncLeagueStrengthFromSquads, fetchFreeAgents } from "@/lib/star/leagueSquads";
import { CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS, OTHER_CLUBS, PROMOTION_POOL_CLUBS } from "@/lib/star/clubs";
import { conditionsFor, conditionsLine } from "@/lib/star/weather";
import PressConference from "@/components/star/PressConference";
import TransferWindow from "@/components/star/TransferWindow";
import RelegationMove from "@/components/star/RelegationMove";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import ProfileSetup from "@/components/star/ProfileSetup";
import TrialPenalty from "@/components/star/TrialPenalty";
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
import SkillsScreen from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import CanvasMatch from "@/components/star/CanvasMatch";
import PostMatch from "@/components/star/PostMatch";
import CupDrawReveal, { type DrawRound } from "@/components/star/CupDrawReveal";
import DeadlineDayRoundup from "@/components/star/DeadlineDayRoundup";
import SettingsScreen from "@/components/star/SettingsScreen";
import MediaFeed from "@/components/star/MediaFeed";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import Casino from "@/components/star/Casino";
import DilemmaModal from "@/components/star/DilemmaModal";
import { SponsorsScreen, AchievementsScreen, TrophiesScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import RelationshipMinigame, { type RelationshipKind } from "@/components/star/RelationshipMinigame";

/**
 * Every club this career could plausibly trade with beyond its own division —
 * Champions League, Europa League, and the "Other"/promotion-pool clubs the
 * Lineups screen already offers — minus whichever of them happen to also be
 * in the player's own division (Arsenal is both a Premier League club and a
 * Champions League one; fetching and tracking it twice would be pointless
 * and would let it silently diverge between the two). See
 * lib/star/leagueTransfers.ts's runInternationalWindow for what actually
 * reads this list.
 */
function externalClubsFor(domesticClubs: string[]): string[] {
  const domestic = new Set(domesticClubs);
  const world = new Set([
    ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS, ...OTHER_CLUBS, ...PROMOTION_POOL_CLUBS,
  ]);
  return Array.from(world).filter(c => !domestic.has(c));
}

export default function StarDevPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<NavTab | null>(null);
  const [trainingTab, setTrainingTab] = useState<"training" | "life">("training");
  const [trainingSkill, setTrainingSkill] = useState<keyof Skills | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [contractOfferReason, setContractOfferReason] = useState<"form" | "star" | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [relationshipGameKind, setRelationshipGameKind] = useState<RelationshipKind | null>(null);
  const [transferOffers, setTransferOffers] = useState<TransferOffer[]>([]);
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
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      setHydrated(true);
      // Whichever actually changed more recently — NOT cloud unconditionally.
      //
      // The first version of this always preferred cloud, on the theory that
      // it was the more durable copy. It regressed players' squads instead: a
      // cloud row saved before a league-squads merge finished (or before a
      // later session on this same device added more) is OLDER than what
      // localStorage already has, and preferring it anyway — then immediately
      // writing it back over localStorage in the save effect below — silently
      // downgraded a fully-populated division back to one missing images that
      // had already been filled in. Reported as exactly that: player photos
      // that used to be there, gone, with nothing else about the save wrong.
      //
      // Comparing timestamps instead means cloud only wins when it is
      // genuinely ahead — a different device, or recovering after local
      // storage itself was wiped — which is the entire reason it exists.
      const local = loadCareer();
      const localAt = local ? loadCareerSavedAt() : -1;
      const cloud = await loadCareerFromCloud();
      const saved = cloud && cloud.savedAt > localAt ? cloud.career : local;
      setCloudLoading(false);
      if (!saved) return;
      setCareer(saved);

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
    }

    // A finished career has one screen and no way back into the season.
    if (saved.retired) { setPhase("legacy"); return; }

    // Resume a phase the career cannot get out of on its own. Reloading used to
    // always land on the dashboard, which at the end of a season meant no
    // fixture left to play and no way to reach the Ballon d'Or — the career was
    // stuck there for good.
    const pending = loadStarPhase();
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
    };
    init();
  }, []);

  useEffect(() => {
    if (!career) return;
    saveCareer(career); // localStorage — immediate
    // Debounced cloud save: waits 3 s after the last change so a burst of
    // state updates (end of match, season rollover) produces one write, not many.
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => { saveCareerToCloud(career); }, 3000);
  }, [career]);

  // Only the phases a refresh must return you to are written; everything else
  // clears the record — see RESUMABLE in storage.ts.
  useEffect(() => {
    if (hydrated) saveStarPhase(phase, contractOfferReason ?? undefined, wonBallonDor);
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
    const created = makeInitialCareer(player, clubs, division);
    setCareer(created);
    // ── Into the trial, not the dashboard ──
    //
    // A career now opens on one penalty you cannot fail, only not have passed
    // yet, and the contract it earns. The career itself is fully built before
    // any of that — the trial is a scene played over a career that already
    // exists, so nothing about it can leave a half-made save behind if the tab
    // closes halfway through. Both squad fetches below still run during it,
    // which is time the trial is spending anyway.
    setPhase("trial");
    fetchSharedLineups();
    fetchRealSquad(player.club).then((squad) => {
      setCareer(c => (c && c.player.club === player.club ? { ...c, squad } : c));
    });
    // ── And the other nineteen dressing rooms ──
    //
    // One request for the whole division, not nineteen. See
    // app/api/star/league-squads — the Draft's roster endpoint reads a JSONB
    // blob per player, which is right for the Draft and far too heavy to ask
    // twenty times for six fields.
    fetchLeagueSquads(clubs).then((leagueSquads) => {
      setCareer(c => (c ? { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads) } : c));
    });
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
   * Pull the squads down again, keeping everything that has happened in them.
   *
   * A career holds a snapshot of the database taken when it was created, which
   * is right — the alternative is a squad that changes under you mid-season.
   * But FC 27 is being written by hand while careers are being played, so there
   * has to be a way to say "I have made my edits, bring them in". Goals and
   * assists survive; see mergeSquadStats.
   */
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

  const [refreshing, setRefreshing] = useState(false);
  const refreshSquads = useCallback(async () => {
    if (!career || refreshing) return;
    setRefreshing(true);
    try {
      const [mine, division, freeAgents] = await Promise.all([
        fetchRealSquad(career.player.club),
        fetchLeagueSquads(career.league.map(t => t.name)),
        fetchFreeAgents(),
        fetchSharedLineups(),
      ]);
      setCareer(c => {
        if (!c) return c;
        const leagueSquads = mergeLeagueSquadStats(division, c.leagueSquads ?? []);
        return {
          ...c,
          squad: mergeSquadStats(mine, c.squad ?? []),
          leagueSquads,
          league: syncLeagueStrengthFromSquads(c.league, leagueSquads),
          // No stats to merge/preserve here, unlike squad/leagueSquads — a
          // free agent is not playing matches for anyone, so a fresh fetch
          // simply replaces the list wholesale.
          freeAgents,
        };
      });
    } finally {
      setRefreshing(false);
    }
  }, [career, refreshing]);

  const handleExit = useCallback(() => {
    if (confirm("Leave the career? It stays saved — you will come back to exactly this. To delete it and start again, use New career on the dashboard.")) {
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

  // Give up on the rest of this week's actions in exchange for real energy
  // back — the trade point 3 of the energy design asks for.
  const handleSkipToMatchDay = useCallback(() => {
    if (!career) return;
    setCareer(skipToMatchDay(career));
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

  const handleTrainingComplete = useCallback((xp: number) => {
    if (!career || !trainingSkill) return;
    const currentVal = career.skills[trainingSkill];
    const gain = Math.min(100 - currentVal, Math.floor(xp / 5));
    const updated: CareerState = {
      ...career,
      skills: { ...career.skills, [trainingSkill]: currentVal + gain },
      starRating: Math.min(5, career.starRating + gain * 0.005),
    };
    checkAndSetAchievements(updated);
    setCareer(spendAction(updated));
    setTrainingSkill(null);
    setPhase("skills");
  }, [career, trainingSkill]);

  const handlePlayMatch = useCallback(() => {
    if (!career || !nextFixture) return;
    setPhase("match");
  }, [career, nextFixture]);

  // Left out of the squad. The match still happens — it just happens without
  // you — and the week costs you sharpness while the manager softens a little.
  const handleWatchFromStands = useCallback(() => {
    if (!career || !nextFixture) return;
    const { career: next, newlyUnlocked } = simulateMissedFixture(career, nextFixture);
    toastAchievements(newlyUnlocked);
    setCareer(next);
    setActiveNav("home");
    setPhase("dashboard");
  }, [career, nextFixture]);

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

  const handleMatchComplete = useCallback((stats: MatchStats) => {
    if (!career || !nextFixture) return;
    setLastMatchStats(stats);
    setPlayedFixture(nextFixture);
    const { career: next, newlyUnlocked, potmAwarded } = creditMatchResult(career, nextFixture, stats);
    toastAchievements(newlyUnlocked);
    // The world reacts. Generated once, here, from the career on both sides of
    // the match — "went top" is a comparison and the after state cannot make it.
    next.media = generateForMatch(career, next, nextFixture, stats);
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
    setCareer(next);
    setPhase("post-match");
  }, [career, nextFixture]);

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
    if (hasFreshMedia(career)) { setPhase("media"); return; }
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
  const rollOverSeason = useCallback((from: CareerState, userWon: boolean, forcedRelegationMove = false) => {
    const { career: next, newlyUnlocked } = advanceSeason(from, userWon);
    toastAchievements(newlyUnlocked);
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
    // ── Relegated out of the Championship ──
    //
    // The pool the old club drops into has no fixtures, no table, no season —
    // so this cannot be the ordinary optional window (TransferWindow, with its
    // "stay put" button). A new club has to be chosen before the season can
    // roll over at all, because advanceSeason needs to know which real
    // division to build next season's fixtures in.
    if (divisionOf(from) === "championship"
      && sortLeague(from.league).slice(-3).map(t => t.name).includes(from.player.club)) {
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
    const offers = generateOffers(from, mulberry32(from.season * 7717 + from.fame));
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

  const handleAcceptTransfer = useCallback((offer: TransferOffer) => {
    if (!career) return;
    const forcedRelegationMove = phase === "relegation-move";
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
    rollOverSeason(moved, wonBallonDor, forcedRelegationMove);
  }, [career, phase, wonBallonDor, rollOverSeason]);

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

  const handleFullReset = () => {
    if (career?.retired || confirm("Delete this career and start over?")) {
      clearCareer();
      clearCareerFromCloud();
      setCareer(null);
      setPhase("profile-setup");
    }
  };

  // Shop buys
  const handleBuyBoot = useCallback((boot: Boot) => {
    if (!career || career.money < boot.price) return;
    setCareer({
      ...career,
      money: career.money - boot.price,
      currentBoot: { ...boot },
    });
  }, [career]);

  const handleBuyItem = useCallback((item: OwnedItem) => {
    if (!career || career.money < item.price || career.ownedItems.some((o) => o.id === item.id)) return;
    setCareer({
      ...career,
      money: career.money - item.price,
      ownedItems: [...career.ownedItems, item],
      happiness: Math.min(100, career.happiness + Math.floor(item.lifestyleValue / 3)),
      fame: career.fame + Math.floor(item.lifestyleValue / 5),
    });
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
      || (phase === "relationship-game" && !relationshipGameKind)
      || (phase === "retirement" && !retirementCheck(career).canRetire);
    if (missing) {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, [career, phase, trainingSkill, nextFixture, lastMatchStats, playedFixture,
      pressQuestion, currentDilemma, transferOffers, relationshipGameKind, pendingDraw]);

  // ---------- RENDER ----------
  if (cloudLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white/60 text-sm font-bold animate-pulse">Loading career…</div>
      </div>
    );
  }

  if (phase === "trial" && career) {
    return <TrialPenalty club={career.player.club} onScored={() => setPhase("trial-reward")} />;
  }

  if (phase === "trial-reward" && career) {
    return (
      <TrialReward
        playerName={`${career.player.firstName} ${career.player.lastName}`}
        surname={career.player.lastName}
        club={career.player.club}
        onDone={() => { setActiveNav("home"); setPhase("dashboard"); }}
      />
    );
  }

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
    return <TrainingMinigame skill={trainingSkill} onComplete={handleTrainingComplete} />;
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
    const effectivePower = Math.min(100, career.skills.power + (bootMatchesLeft ? career.currentBoot.power : 0));
    const effectiveTechnique = Math.min(100, career.skills.technique + (bootMatchesLeft ? career.currentBoot.technique : 0));
    return (
      <div
        className="min-h-screen bg-gray-950 text-white py-4 px-3"
        style={{ backgroundImage: "radial-gradient(70% 45% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)" }}
      >
        <div className="max-w-sm mx-auto">
          <CanvasMatch
            skills={{ power: effectivePower, technique: effectiveTechnique }}
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

  // Straight out of the ground it is a moment with a Continue; reached from the
  // nav it is a place you can browse and leave.
  if (phase === "media") {
    return activeNav === "media"
      ? <MediaFeed career={career} mode="browse" onBack={handleBackToDashboard} />
      : <MediaFeed career={career} mode="moment" onContinue={handleMediaContinue} />;
  }

  if (phase === "legacy") {
    return <LegacyScreen career={career} onNewCareer={handleFullReset} />;
  }

  if (phase === "retirement") {
    return <RetirementChoice career={career} onRetire={handleRetire} onPlayOn={handlePlayOn} />;
  }

  if (phase === "season-transfer" && transferOffers.length > 0) {
    return (
      <TransferWindow
        career={career}
        offers={transferOffers}
        onAccept={handleAcceptTransfer}
        onStay={handleStayPut}
      />
    );
  }

  if (phase === "relegation-move" && transferOffers.length > 0) {
    return (
      <RelegationMove
        career={career}
        offers={transferOffers}
        onAccept={handleAcceptTransfer}
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

  if (phase === "shop-boots" || phase === "shop-lifestyle") {
    const kind = phase === "shop-boots" ? "boots" : "lifestyle";
    return (
      <Shop
        career={career}
        kind={kind}
        onBack={handleBackToDashboard}
        onBuyBoot={handleBuyBoot}
        onBuyItem={handleBuyItem}
      />
    );
  }

  if (phase === "casino-menu") {
    return <Casino bankStart={career.money} career={career} onExit={handleCasinoExit} onHorseRace={handleHorseRace} onBuyHorse={handleBuyHorse} />;
  }

  if (phase === "sponsors") return <SponsorsScreen career={career} onBack={handleBackToDashboard} />;
  if (phase === "achievements") return <AchievementsScreen career={career} onBack={handleBackToDashboard} />;
  if (phase === "trophies") return <TrophiesScreen trophies={career.trophies} ballonDors={career.ballonDorWins} onBack={handleBackToDashboard} />;

  if (phase === "settings") {
    return (
      <SettingsScreen
        career={career}
        onBack={handleBackToDashboard}
        onSkip={handleDevSkip}
        onNewCareer={handleFullReset}
        onSetPortrait={handleSetPortrait}
      />
    );
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
      : matchdayFor(career, nextFixture, selection?.status === "1st Team", playAs ?? undefined, saved?.bench, savedXI);
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
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center shadow-lg">
            <div className="text-lg font-black text-white">{home}</div>
            <div className="my-3 text-white/75 font-black">vs</div>
            <div className="text-lg font-black text-white">{away}</div>
            <div className="mt-4 text-[10px] text-white/75">
              Boot: <span className="text-white font-bold">{career.currentBoot.name}</span> ({career.currentBoot.matches} matches left)
            </div>
            {career.currentBoot.matches === 0 && (
              <div className="mt-1 text-red-300 text-[10px] font-bold">⚠ Boots need replacing</div>
            )}
            {!career.injury && career.energy < MIN_ENERGY_TO_START && (
              <div className="mt-1 text-red-300 text-[10px] font-bold">⚠ Too fatigued to start — the manager will only risk you off the bench</div>
            )}
            {career.injury && (
              <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-2.5 py-2 text-left">
                <div className="text-red-300 text-[10px] font-black uppercase tracking-wide">🩹 {career.injury.note}</div>
                <div className="mt-0.5 text-[10px] text-white/80">
                  Out for {career.injury.weeksRemaining} more week{career.injury.weeksRemaining === 1 ? "" : "s"} — you cannot be selected until you are fit.
                </div>
              </div>
            )}
            <div className="mt-3 rounded-lg bg-gray-700 px-2 py-1.5 text-[10px] text-white">
              {conditionsLine(conditionsFor(career.season, nextFixture.week, career.homeCity))}
            </div>
          </div>

          {/* Who you're actually about to play — requested directly, with a
              real scouting-app screenshot as the reference. Club opponents
              only: an international opponent is a nation, not a squad to
              scout the way this reads. */}
          {nextFixture.kind !== "international" && (
            <ScoutReportCard report={scoutReportFor(career, nextFixture.opponent, nextFixture.week)} />
          )}

          {/* Which position you play this match — moved here from the
              dashboard: it's a decision for the build-up to THIS match, not
              a standing setting, and it needs nothing about the opponent. */}
          {nextFixture.kind !== "international" && (
            <PositionPicker
              club={career.player.club}
              realPosition={career.player.position}
              playAs={playAs}
              onChange={setPlayAs}
            />
          )}

          {/* The manager's team sheet. Boss, form, reputation and sharpness used
              to move every week and decide nothing at all. */}
          {selection && (
            <div className={`mt-3 rounded-xl border p-3 ${
              selection.status === "1st Team" ? "border-emerald-500/50 bg-emerald-500/10"
                : selection.status === "Substitute" ? "border-amber-400/50 bg-amber-400/10"
                  : "border-red-500/50 bg-red-500/10"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Your role</span>
                <span className={`text-xs font-black ${
                  selection.status === "1st Team" ? "text-emerald-300"
                    : selection.status === "Substitute" ? "text-amber-200" : "text-red-300"}`}
                >
                  {selection.status === "1st Team" ? "Starting Eleven"
                    : selection.status === "Substitute" ? `Bench (on ~${selection.onAt}')`
                      : selection.status === "Injured" ? "Injured"
                        : "Out of Squad"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/20 rounded-lg py-2 text-center">
                  <div className="text-white/75 text-[10px] font-bold">Match Fitness</div>
                  <div className="font-black text-emerald-300 text-base">{Math.round(career.matchFitness)}%</div>
                </div>
                <div className="bg-black/20 rounded-lg py-2 text-center">
                  <div className="text-white/75 text-[10px] font-bold">Energy</div>
                  <div className={`font-black text-base ${
                    career.energy >= 70 ? "text-emerald-300" : career.energy >= 40 ? "text-amber-300" : "text-red-400"}`}
                  >
                    {Math.round(career.energy)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={handleBackToDashboard} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black">← Back</button>
            {selection?.status === "Squad" || selection?.status === "Injured" ? (
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
                  : selection?.status === "Substitute" ? "Take your place on the bench ⚽" : "Play Match ⚽"}
              </button>
            )}
          </div>
        </div>
      </div>
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
    >
      {unlockedAchievements.length > 0 && (
        <div className="mb-2 bg-yellow-500 border border-yellow-300 rounded-lg p-2 text-center text-black font-black text-xs animate-pulse">
          ⭐ Achievement Unlocked: {unlockedAchievements[0]} ⭐
        </div>
      )}
      {phase === "dashboard" && career.managerNews && (
        <div className="mb-3 rounded-xl border border-red-500/50 bg-red-500/15 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">In the dugout</div>
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickBtn label="Boots" icon="👟" onClick={() => setPhase("shop-boots")} />
            <QuickBtn label="Style" icon="💎" onClick={() => setPhase("shop-lifestyle")} />
            <QuickBtn label="Casino" icon="🎰" onClick={() => setPhase("casino-menu")} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <QuickBtn label="Sponsors" icon="🤝" onClick={() => setPhase("sponsors")} />
            <QuickBtn label="Awards" icon="⭐" onClick={() => setPhase("achievements")} />
            <QuickBtn label="Trophies" icon="🏆" onClick={() => setPhase("trophies")} />
          </div>
        </>
      )}
      {phase === "league" && (
        <LeagueScreen career={career} onRefreshSquads={refreshSquads} refreshing={refreshing} />
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
              onSkipToMatchDay={handleSkipToMatchDay}
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
