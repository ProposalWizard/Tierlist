"use client";
import { useCallback, useEffect, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem, Horse, Fixture } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer, saveStarPhase, loadStarPhase } from "@/lib/star/storage";
import { mulberry32 } from "@/lib/star/season";
import { makeInitialCareer, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed } from "@/lib/star/careerFlow";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { fixtureDateLabel } from "@/lib/star/calendar";
import { matchdayFor, sheetReady } from "@/lib/star/teamsheet";
import type { Role } from "@/lib/star/formations";
import { spendAction, rest, canAct } from "@/lib/star/week";
import { generateOffers, acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { pressQuestionFor, type PressQuestion, type PressOption } from "@/lib/star/media";
import type { MonthAward } from "@/lib/star/potm";
import { generateForMatch, generateForCareer, hasFreshMedia } from "@/lib/star/media/feed";
import { fetchRealSquad, shouldUpgradeSquad, mergeSquadStats } from "@/lib/star/realSquad";
import { fetchLeagueSquads, mergeLeagueSquadStats, shouldUpgradeLeagueSquads } from "@/lib/star/leagueSquads";
import { conditionsFor, conditionsLine } from "@/lib/star/weather";
import PressConference from "@/components/star/PressConference";
import TransferWindow from "@/components/star/TransferWindow";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { pickDilemma, applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import { NRG_DRINKS, type NrgDrink } from "@/lib/star/shopData";
import ProfileSetup from "@/components/star/ProfileSetup";
import DashboardShell, { type NavTab } from "@/components/star/DashboardShell";
import DashboardStats from "@/components/star/DashboardStats";
import LeagueScreen from "@/components/star/LeagueScreen";
import LifeScreen from "@/components/star/LifeScreen";
import PotmWinModal from "@/components/star/PotmWinModal";
import VersusScreen from "@/components/star/VersusScreen";
import SkillsScreen, { TRAINING_ENERGY_COST } from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import CanvasMatch from "@/components/star/CanvasMatch";
import PostMatch from "@/components/star/PostMatch";
import MediaFeed from "@/components/star/MediaFeed";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import Casino from "@/components/star/Casino";
import DilemmaModal from "@/components/star/DilemmaModal";
import { SponsorsScreen, AchievementsScreen, TrophiesScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import RelationshipMinigame, { type RelationshipKind } from "@/components/star/RelationshipMinigame";

export default function StarDevPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<NavTab | null>(null);
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

  useEffect(() => {
    setHydrated(true);
    const saved = loadCareer();
    if (!saved) return;
    setCareer(saved);

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
        setCareer(c => (c && !(c.leagueSquads ?? []).length ? { ...c, leagueSquads } : c));
      });
    } else if (shouldUpgradeLeagueSquads(saved.leagueSquads!)) {
      // A division fetched before faces and flags existed. Re-fetched once, in
      // the background, and merged rather than replaced — this season's goals
      // and assists were real and stay real; only the missing fields fill in.
      fetchLeagueSquads(saved.league.map(t => t.name)).then((fresh) => {
        setCareer(c => (c ? { ...c, leagueSquads: mergeLeagueSquadStats(fresh, c.leagueSquads ?? []) } : c));
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
    if (pending?.phase === "dilemma") {
      // Re-derived rather than stored: the seed is the week and season, neither
      // of which has moved, so this is the same dilemma you were looking at.
      const d = pickDilemma(saved, mulberry32(saved.week * 131 + saved.season));
      if (d) { setCurrentDilemma(d); setPhase("dilemma"); return; }
    }
    setPhase("dashboard");
  }, []);

  useEffect(() => {
    if (career) saveCareer(career);
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
    ? fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind)
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
  const handleProfileComplete = useCallback((player: StarPlayer, clubs: string[]) => {
    const created = makeInitialCareer(player, clubs);
    setCareer(created);
    setPhase("dashboard");
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
      setCareer(c => (c ? { ...c, leagueSquads } : c));
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
   * Asked to play somewhere other than your named position, for the match about
   * to be played. Reset the moment you kick off, so the next match always
   * offers your real position first rather than quietly keeping today's choice.
   */
  const [playAs, setPlayAs] = useState<Role | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const refreshSquads = useCallback(async () => {
    if (!career || refreshing) return;
    setRefreshing(true);
    try {
      const [mine, division] = await Promise.all([
        fetchRealSquad(career.player.club),
        fetchLeagueSquads(career.league.map(t => t.name)),
      ]);
      setCareer(c => (c ? {
        ...c,
        squad: mergeSquadStats(mine, c.squad ?? []),
        leagueSquads: mergeLeagueSquadStats(division, c.leagueSquads ?? []),
      } : c));
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
    else if (tab === "skills") setPhase("skills");
    else if (tab === "life") setPhase("life");
    else if (tab === "media") setPhase("media");
    else if (tab === "play") setPhase("pre-match");
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setActiveNav(null);
    setPhase("dashboard");
  }, []);

  const handleBackToLife = useCallback(() => {
    setActiveNav("life");
    setPhase("life");
  }, []);

  const handleTrain = useCallback((skill: keyof Skills) => {
    if (!career || !canAct(career)) return;
    setTrainingSkill(skill);
    setPhase("training");
  }, [career]);

  // Put your feet up. Costs a day of the week and buys back real energy — the
  // only reliable way to have any left by the end of a season.
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

  const handleTrainingComplete = useCallback((xp: number) => {
    if (!career || !trainingSkill) return;
    const currentVal = career.skills[trainingSkill];
    const gain = Math.min(100 - currentVal, Math.floor(xp / 5));
    const updated: CareerState = {
      ...career,
      skills: { ...career.skills, [trainingSkill]: currentVal + gain },
      energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
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
    setActiveNav(null);
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
    const { career: next } = awardLeagueTrophyIfWon(from);
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
  const continueAfterMatch = useCallback((from: CareerState, askPress: boolean) => {
    // The press get you on the way out of the ground, before the week rolls on.
    // Only when the match gave them something to ask about.
    if (askPress && playedFixture && lastMatchStats) {
      const q = pressQuestionFor(
        from, playedFixture, lastMatchStats, !!playedFixture.derby,
        mulberry32(from.season * 613 + from.week * 29),
      );
      if (q) { setPressQuestion(q); setPhase("press"); return; }
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

    // A dilemma between weeks, about a third of the time.
    const rng = mulberry32(from.week * 131 + from.season);
    if (rng() < 0.35) {
      const d = pickDilemma(from, rng);
      if (d) {
        setCurrentDilemma(d);
        setPhase("dilemma");
        return;
      }
    }

    setActiveNav(null);
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
    setActiveNav(null);
    setPhase("dashboard");
  }, [career, currentDilemma]);

  // Rolling into the next season, once anything that happens BETWEEN seasons is
  // out of the way. Split out because three different screens end here.
  const rollOverSeason = useCallback((from: CareerState, userWon: boolean) => {
    const { career: next, newlyUnlocked } = advanceSeason(from, userWon);
    toastAchievements(newlyUnlocked);
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
        { kind: "award", award: a.kind, detail: a.detail }, `award-${a.kind}`);
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
    // A new club came with a new contract, so a renewal is only forced when you
    // stayed and let the old one run out.
    if (next.contract.seasonsRemaining <= 0) {
      setPhase("contract-renewal");
    } else {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, []);

  const openTransferWindowOrRoll = useCallback((from: CareerState, userWon: boolean) => {
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
    rollOverSeason(moved, wonBallonDor);
  }, [career, wonBallonDor, rollOverSeason]);

  const handleStayPut = useCallback(() => {
    if (!career) return;
    setTransferOffers([]);
    rollOverSeason(career, wonBallonDor);
  }, [career, wonBallonDor, rollOverSeason]);

  const handleFullReset = () => {
    if (career?.retired || confirm("Delete this career and start over?")) {
      clearCareer();
      setCareer(null);
      setPhase("profile-setup");
    }
  };

  // Shop buys
  const handleBuyNrg = useCallback((drink: NrgDrink) => {
    if (!career || career.money < drink.price) return;
    setCareer({
      ...career,
      money: career.money - drink.price,
      nrgDrinks: { ...career.nrgDrinks, [drink.id]: career.nrgDrinks[drink.id] + 1 },
    });
  }, [career]);

  const handleUseDrink = useCallback((id: "basic" | "premium" | "elite") => {
    if (!career || career.nrgDrinks[id] === 0) return;
    const drink = NRG_DRINKS.find((d) => d.id === id)!;
    setCareer({
      ...career,
      nrgDrinks: { ...career.nrgDrinks, [id]: career.nrgDrinks[id] - 1 },
      energy: Math.min(100, career.energy + drink.restore),
    });
  }, [career]);

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

  const handleRelationshipGameComplete = useCallback((gain: number, energyCost: number) => {
    if (!career || !relationshipGameKind) return;
    let updated: CareerState = {
      ...career,
      energy: Math.max(0, career.energy - energyCost),
    };
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
    setActiveNav("life");
    setPhase("life");
  }, [career, relationshipGameKind]);

  const handleCasinoExit = useCallback((finalBank: number) => {
    if (!career) return;
    // Clamped: the casino owns the bank for the length of a session and hands
    // back a number, and a career with negative money has no way to recover.
    setCareer({ ...career, money: Math.max(0, Math.round(finalBank)) });
    setActiveNav("life");
    setPhase("life");
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
    setActiveNav(null);
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
      pressQuestion, currentDilemma, transferOffers, relationshipGameKind]);

  // ---------- RENDER ----------
  if (phase === "profile-setup" || !career) {
    return <ProfileSetup onComplete={handleProfileComplete} />;
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
            position={career.player.position}
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
        competition={playedFixture.kind && playedFixture.kind !== "league" ? fixtureLabel(playedFixture) : undefined}
        knockout={career.knockoutMessage}
        onContinue={handlePostMatchContinue}
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

  if (phase === "shop-nrg" || phase === "shop-boots" || phase === "shop-lifestyle") {
    const kind = phase === "shop-nrg" ? "nrg" : phase === "shop-boots" ? "boots" : "lifestyle";
    return (
      <Shop
        career={career}
        kind={kind}
        onBack={handleBackToLife}
        onBuyNrg={handleBuyNrg}
        onBuyBoot={handleBuyBoot}
        onBuyItem={handleBuyItem}
      />
    );
  }

  if (phase === "casino-menu") {
    return <Casino bankStart={career.money} career={career} onExit={handleCasinoExit} onHorseRace={handleHorseRace} onBuyHorse={handleBuyHorse} />;
  }

  if (phase === "sponsors") return <SponsorsScreen career={career} onBack={handleBackToLife} />;
  if (phase === "achievements") return <AchievementsScreen career={career} onBack={handleBackToLife} />;
  if (phase === "trophies") return <TrophiesScreen trophies={career.trophies} ballonDors={career.ballonDorWins} onBack={handleBackToLife} />;
  if (phase === "relationship-game" && relationshipGameKind) {
    const currentValue = relationshipGameKind === "happiness"
      ? career.happiness
      : (career.relationships[relationshipGameKind] as number);
    return (
      <RelationshipMinigame
        kind={relationshipGameKind}
        currentValue={currentValue}
        onComplete={handleRelationshipGameComplete}
        onCancel={() => { setRelationshipGameKind(null); setActiveNav("life"); setPhase("life"); }}
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
    const matchday = nextFixture.kind === "international"
      ? null
      : matchdayFor(career, nextFixture, selection?.status === "1st Team", playAs ?? undefined);
    const teamsReady = !!matchday && sheetReady(matchday);

    if (showTeams && matchday && teamsReady) {
      return (
        <VersusScreen
          matchday={matchday}
          date={fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind)}
          competition={
            !nextFixture.kind || nextFixture.kind === "league"
              ? `Premier League · Matchday ${nextFixture.week}`
              : `${nextFixture.competition}${nextFixture.round ? ` · ${nextFixture.round}` : ""}`
          }
          realPosition={career.player.position as Role}
          playAs={playAs}
          onPlayAs={setPlayAs}
          onKickOff={() => { setShowTeams(false); setPlayAs(null); handlePlayMatch(); }}
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
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-700 rounded-lg py-2">
                <div className="text-white/75 text-[10px] font-bold">Your Energy</div>
                <div className="font-black text-emerald-300 text-lg">{Math.round(career.energy)}%</div>
              </div>
              <div className="bg-gray-700 rounded-lg py-2">
                <div className="text-white/75 text-[10px] font-bold">Match Fitness</div>
                <div className="font-black text-emerald-300 text-lg">{Math.round(career.matchFitness)}%</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-white/75">
              Boot: <span className="text-white font-bold">{career.currentBoot.name}</span> ({career.currentBoot.matches} matches left)
            </div>
            {career.currentBoot.matches === 0 && (
              <div className="mt-1 text-red-300 text-[10px] font-bold">⚠ Boots need replacing</div>
            )}
            <div className="mt-3 rounded-lg bg-gray-700 px-2 py-1.5 text-[10px] text-white">
              {conditionsLine(conditionsFor(career.season, nextFixture.week, career.homeCity))}
            </div>
            {career.energy < 40 && (
              <div className="mt-3 text-red-300 text-xs font-bold">⚠ Low energy — you may underperform</div>
            )}
          </div>

          {/* The manager's team sheet. Boss, form, reputation and sharpness used
              to move every week and decide nothing at all. */}
          {selection && (
            <div className={`mt-3 rounded-xl border p-3 ${
              selection.status === "1st Team" ? "border-emerald-500/50 bg-emerald-500/10"
                : selection.status === "Substitute" ? "border-amber-400/50 bg-amber-400/10"
                  : "border-red-500/50 bg-red-500/10"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                  Team sheet · #{career.squadNumber ?? "—"}{career.captain ? " (C)" : ""}
                </span>
                <span className={`text-xs font-black ${
                  selection.status === "1st Team" ? "text-emerald-300"
                    : selection.status === "Substitute" ? "text-amber-200" : "text-red-300"}`}
                >
                  {selection.status === "Substitute" ? `Bench (on ~${selection.onAt}')` : selection.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/90">{selection.reason}</p>
              {career.manager && (
                <p className="mt-0.5 text-[10px] text-white/70">
                  {career.manager.name} · {career.manager.style}
                </p>
              )}
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    selection.standing >= 55 ? "bg-emerald-400" : selection.standing >= 34 ? "bg-amber-400" : "bg-red-500"}`}
                  style={{ width: `${Math.max(3, selection.standing)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-white/60">Standing with the manager</div>
              {duties && selection.status !== "Squad" && (
                <div className="mt-2 flex gap-1.5 text-[10px] font-bold">
                  <span className={`px-2 py-0.5 rounded-full ${duties.freeKicks ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-white/50"}`}>
                    Free kicks {duties.freeKicks ? "✓" : `(FK ${duties.freeKickNeeded})`}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${duties.penalties ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-white/50"}`}>
                    Penalties {duties.penalties ? "✓" : `(FK ${duties.penaltyNeeded})`}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={handleBackToDashboard} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black">← Back</button>
            {selection?.status === "Squad" ? (
              <button onClick={handleWatchFromStands} className="py-3 bg-gray-600 hover:bg-gray-500 rounded-xl font-black">Watch from the stands</button>
            ) : (
              <button
                onClick={() => (teamsReady ? setShowTeams(true) : handlePlayMatch())}
                className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black"
              >
                {/* No sheets for an international, and none for a club whose
                    squad has not been fetched — both go straight to the match
                    rather than to a pitch with holes in it. */}
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
      {phase === "dashboard" && <DashboardStats career={career} />}
      {phase === "dashboard" && (
        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Start over</div>
          <p className="mt-1 text-[11px] text-gray-200">
            Exit leaves the career saved. This deletes it and begins a new one.
          </p>
          <button
            onClick={handleFullReset}
            className="mt-2 w-full rounded-lg border border-red-500/60 bg-red-500/15 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/25"
          >
            New career
          </button>
        </div>
      )}
      {phase === "league" && (
        <div>
          <BackChip onBack={handleBackToDashboard} />
          <LeagueScreen career={career} onRefreshSquads={refreshSquads} refreshing={refreshing} />
        </div>
      )}
      {phase === "life" && (
        <div>
          <BackChip onBack={handleBackToDashboard} />
          <LifeScreen
            career={career}
            onOpenShop={(kind) => setPhase(kind === "nrg" ? "shop-nrg" : kind === "boots" ? "shop-boots" : "shop-lifestyle")}
            onOpenCasino={() => setPhase("casino-menu")}
            onOpenSponsors={() => setPhase("sponsors")}
            onOpenAchievements={() => setPhase("achievements")}
            onOpenTrophies={() => setPhase("trophies")}
            onOpenContract={() => setPhase("contract-renewal")}
            onUseDrink={handleUseDrink}
            onPlayRelationshipGame={handleOpenRelationshipGame}
            onRest={handleRest}
            onSetPortrait={handleSetPortrait}
          />
        </div>
      )}
      {phase === "skills" && (
        <div>
          <BackChip onBack={handleBackToDashboard} />
          <SkillsScreen career={career} onTrain={handleTrain} />
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

function BackChip({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="mb-2 flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-lg text-xs font-black text-white hover:bg-gray-600">
      ← Home
    </button>
  );
}
