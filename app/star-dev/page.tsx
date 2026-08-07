"use client";
import { useCallback, useEffect, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem, Horse, Fixture } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer, saveStarPhase, loadStarPhase } from "@/lib/star/storage";
import { mulberry32 } from "@/lib/star/season";
import { makeInitialCareer, creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed } from "@/lib/star/careerFlow";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { nextFixtureFor, fixtureLabel, nationOf } from "@/lib/star/competitions";
import { spendAction, rest, canAct } from "@/lib/star/week";
import { generateOffers, acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { retirementCheck, retire } from "@/lib/star/retirement";
import { pressQuestionFor, type PressQuestion, type PressOption } from "@/lib/star/media";
import { conditionsFor, conditionsLine } from "@/lib/star/weather";
import PressConference from "@/components/star/PressConference";
import TransferWindow from "@/components/star/TransferWindow";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { pickDilemma, applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import { NRG_DRINKS, type NrgDrink } from "@/lib/star/shopData";
import ProfileSetup from "@/components/star/ProfileSetup";
import DashboardShell from "@/components/star/DashboardShell";
import DashboardStats from "@/components/star/DashboardStats";
import LeagueScreen from "@/components/star/LeagueScreen";
import LifeScreen from "@/components/star/LifeScreen";
import SkillsScreen, { TRAINING_ENERGY_COST } from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import CanvasMatch from "@/components/star/CanvasMatch";
import PostMatch from "@/components/star/PostMatch";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import Casino from "@/components/star/Casino";
import DilemmaModal from "@/components/star/DilemmaModal";
import { SponsorsScreen, AchievementsScreen, TrophiesScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import RelationshipMinigame, { type RelationshipKind } from "@/components/star/RelationshipMinigame";

export default function StarDevPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<"league" | "skills" | "life" | "play" | null>(null);
  const [trainingSkill, setTrainingSkill] = useState<keyof Skills | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [contractOfferReason, setContractOfferReason] = useState<"form" | "star" | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [relationshipGameKind, setRelationshipGameKind] = useState<RelationshipKind | null>(null);
  const [transferOffers, setTransferOffers] = useState<TransferOffer[]>([]);
  const [pressQuestion, setPressQuestion] = useState<PressQuestion | null>(null);
  const clampRel = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // Nothing is written back until the load has run, so the initial
  // "profile-setup" render cannot wipe a pending phase before we have read it.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const saved = loadCareer();
    if (!saved) return;
    setCareer(saved);

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
      setPhase("retirement");
      return;
    }
    if (pending?.phase === "season-transfer") {
      // Regenerated rather than stored: the seed is the season and the player's
      // fame, neither of which has moved, so these are the same offers.
      const offers = generateOffers(saved, mulberry32(saved.season * 7717 + saved.fame));
      if (offers.length > 0) { setTransferOffers(offers); setPhase("season-transfer"); return; }
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
    if (hydrated) saveStarPhase(phase, contractOfferReason ?? undefined);
  }, [hydrated, phase, contractOfferReason]);

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

  const handleProfileComplete = useCallback((player: StarPlayer, clubs: string[]) => {
    setCareer(makeInitialCareer(player, clubs));
    setPhase("dashboard");
  }, []);

  const handleExit = useCallback(() => {
    if (confirm("Exit career? Progress is auto-saved.")) {
      window.location.href = "/";
    }
  }, []);

  const handleNavigate = useCallback((tab: "league" | "skills" | "life" | "play") => {
    setActiveNav(tab);
    if (tab === "league") setPhase("league");
    else if (tab === "skills") setPhase("skills");
    else if (tab === "life") setPhase("life");
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
    const { career: next, newlyUnlocked } = creditMatchResult(career, nextFixture, stats);
    toastAchievements(newlyUnlocked);
    setCareer(next);
    setPhase("post-match");
  }, [career, nextFixture]);

  // The end of a season, reachable from the post-match screen and — after a
  // refresh dropped you on the dashboard — from the dashboard prompt too.
  // awardLeagueTrophyIfWon is idempotent, so arriving twice is safe.
  const handleSeasonEnd = useCallback(() => {
    if (!career) return;
    const { career: next } = awardLeagueTrophyIfWon(career);
    setCareer(next);
    setActiveNav(null);
    setPhase("ballon-dor");
  }, [career]);

  const handlePostMatchContinue = useCallback(() => {
    if (!career) return;

    // The press get you on the way out of the ground, before the week rolls on.
    // Only when the match gave them something to ask about.
    if (playedFixture && lastMatchStats && !pressQuestion) {
      const q = pressQuestionFor(
        career, playedFixture, lastMatchStats, !!playedFixture.derby,
        mulberry32(career.season * 613 + career.week * 29),
      );
      if (q) { setPressQuestion(q); setPhase("press"); return; }
    }

    const remaining = career.fixtures.filter((f) => !f.played).length;
    if (remaining === 0) {
      handleSeasonEnd();
      return;
    }

    // Mid-season contract offer — fires when the club wants to lock in a player
    // who has hit a star milestone or maintained exceptional form for 5+ matches.
    const earlyOffer = checkForContractOffer(career);
    if (earlyOffer) {
      const updated = markContractOfferUsed(career, earlyOffer);
      setCareer(updated);
      setContractOfferReason(earlyOffer);
      setPhase("contract-renewal");
      return;
    }

    // 30% chance of a dilemma between weeks
    const rng = mulberry32(career.week * 131 + career.season);
    if (rng() < 0.35) {
      const d = pickDilemma(career, rng);
      if (d) {
        setCurrentDilemma(d);
        setPhase("dilemma");
        return;
      }
    }

    setActiveNav(null);
    setPhase("dashboard");
  }, [career, handleSeasonEnd, playedFixture, lastMatchStats, pressQuestion]);

  const handlePressAnswer = useCallback((o: PressOption) => {
    if (!career) return;
    setCareer({
      ...career,
      relationships: {
        ...career.relationships,
        boss: clampRel(career.relationships.boss + o.boss),
        team: clampRel(career.relationships.team + o.team),
        fans: clampRel(career.relationships.fans + o.fans),
      },
      happiness: clampRel(career.happiness + (o.happiness ?? 0)),
    });
    setPressQuestion(null);
    // Straight back into the flow it interrupted.
    setTimeout(() => handlePostMatchContinue(), 0);
  }, [career, handlePostMatchContinue]);

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

  /** Whether they won it is only known at the ceremony, so it is carried here. */
  const [wonBallonDor, setWonBallonDor] = useState(false);

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
    setCareer(retire(career));
    setPhase("legacy");
  }, [career]);

  const handlePlayOn = useCallback(() => {
    if (!career) return;
    openTransferWindowOrRoll(career, wonBallonDor);
  }, [career, wonBallonDor, openTransferWindowOrRoll]);

  const handleAcceptTransfer = useCallback((offer: TransferOffer) => {
    if (!career) return;
    const moved = acceptOffer(career, offer);
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
    setCareer({ ...career, money: finalBank });
    setActiveNav("life");
    setPhase("life");
  }, [career]);

  const handleContractComplete = useCallback((newContract: CareerState["contract"] | null) => {
    if (!career) return;
    if (newContract) {
      setCareer({ ...career, contract: newContract });
    }
    setContractOfferReason(null);
    setActiveNav(null);
    setPhase("dashboard");
  }, [career]);

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
            <div className="my-3 text-gray-400 font-black">vs</div>
            <div className="text-lg font-black text-white">{away}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-700 rounded-lg py-2">
                <div className="text-gray-400 text-[10px] font-bold">Your Energy</div>
                <div className="font-black text-emerald-300 text-lg">{Math.round(career.energy)}%</div>
              </div>
              <div className="bg-gray-700 rounded-lg py-2">
                <div className="text-gray-400 text-[10px] font-bold">Match Fitness</div>
                <div className="font-black text-emerald-300 text-lg">{Math.round(career.matchFitness)}%</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-gray-400">
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
              <button onClick={handlePlayMatch} className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">
                {selection?.status === "Substitute" ? "Take your place on the bench ⚽" : "Play Match ⚽"}
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
      nextMatchLabel={nextMatchLabel}
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
      {phase === "league" && (
        <div>
          <BackChip onBack={handleBackToDashboard} />
          <LeagueScreen career={career} />
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
          />
        </div>
      )}
      {phase === "skills" && (
        <div>
          <BackChip onBack={handleBackToDashboard} />
          <SkillsScreen career={career} onTrain={handleTrain} />
          <button onClick={handleFullReset} className="mt-4 w-full py-2 text-xs text-red-400 underline">
            [dev] Reset career
          </button>
        </div>
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
