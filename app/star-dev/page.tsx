"use client";
import { useCallback, useEffect, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer } from "@/lib/star/storage";
import { mulberry32 } from "@/lib/star/season";
import { makeInitialCareer, creditMatchResult, awardLeagueTrophyIfWon, advanceSeason } from "@/lib/star/careerFlow";
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
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [relationshipGameKind, setRelationshipGameKind] = useState<RelationshipKind | null>(null);

  useEffect(() => {
    const saved = loadCareer();
    if (saved) {
      setCareer(saved);
      setPhase("dashboard");
    }
  }, []);

  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  const nextFixture = career?.fixtures.find((f) => !f.played) ?? null;
  const nextMatchLabel = nextFixture
    ? `Next: ${nextFixture.home ? career!.player.club : nextFixture.opponent} v ${nextFixture.home ? nextFixture.opponent : career!.player.club}`
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
    setTrainingSkill(skill);
    setPhase("training");
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
    setCareer(updated);
    setTrainingSkill(null);
    setPhase("skills");
  }, [career, trainingSkill]);

  const handlePlayMatch = useCallback(() => {
    if (!career || !nextFixture) return;
    setPhase("match");
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
    const { career: next, newlyUnlocked } = creditMatchResult(career, nextFixture, stats);
    toastAchievements(newlyUnlocked);
    setCareer(next);
    setPhase("post-match");
  }, [career, nextFixture]);

  const handlePostMatchContinue = useCallback(() => {
    if (!career) return;
    const remaining = career.fixtures.filter((f) => !f.played).length;
    if (remaining === 0) {
      const { career: next } = awardLeagueTrophyIfWon(career);
      setCareer(next);
      setPhase("ballon-dor");
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
  }, [career]);

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

  const handleBallonDorContinue = useCallback((userWon: boolean) => {
    if (!career) return;
    const { career: next, newlyUnlocked } = advanceSeason(career, userWon);
    toastAchievements(newlyUnlocked);
    setCareer(next);

    // If the contract has run out, force a renewal before returning to the dashboard.
    if (next.contract.seasonsRemaining <= 0) {
      setPhase("contract-renewal");
    } else {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, [career]);

  const handleFullReset = () => {
    if (confirm("Delete this career and start over?")) {
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
    setCareer(updated);
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
    } else {
      // Keep old contract with 0 seasons — will be forced to renew next season anyway
    }
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
    const opp = career.league.find((t) => t.name === nextFixture.opponent);
    const oppStrength = opp?.strength ?? 65;
    return (
      <div
        className="min-h-screen bg-gray-950 text-white py-4 px-3"
        style={{ backgroundImage: "radial-gradient(70% 45% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)" }}
      >
        <div className="max-w-sm mx-auto">
          <CanvasMatch
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={oppStrength}
            position={career.player.position}
            teamRelationship={career.relationships.team}
            career={career}
            fixture={nextFixture}
            oppStrength={oppStrength}
            onComplete={handleMatchComplete}
            seed={career.season * 1000 + career.week}
          />
        </div>
      </div>
    );
  }

  if (phase === "post-match" && lastMatchStats && nextFixture) {
    return (
      <PostMatch
        stats={lastMatchStats}
        homeTeam={nextFixture.home ? career.player.club : nextFixture.opponent}
        awayTeam={nextFixture.home ? nextFixture.opponent : career.player.club}
        onContinue={handlePostMatchContinue}
      />
    );
  }

  if (phase === "ballon-dor") {
    return <BallonDor career={career} onContinue={handleBallonDorContinue} />;
  }

  if (phase === "dilemma" && currentDilemma) {
    return <DilemmaModal dilemma={currentDilemma} onChoose={handleDilemmaChoose} />;
  }

  if (phase === "contract-renewal") {
    return <ContractRenewal career={career} onComplete={handleContractComplete} />;
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
    return <Casino bankStart={career.money} onExit={handleCasinoExit} />;
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
    const home = nextFixture.home ? career.player.club : nextFixture.opponent;
    const away = nextFixture.home ? nextFixture.opponent : career.player.club;
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex items-center justify-center px-3 py-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 text-[10px] font-black tracking-widest uppercase">
              Week {nextFixture.week}
            </div>
            <h1 className="mt-2 text-2xl font-black">Match Day</h1>
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
            {career.energy < 40 && (
              <div className="mt-3 text-red-300 text-xs font-bold">⚠ Low energy — you may underperform</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={handleBackToDashboard} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black">← Back</button>
            <button onClick={handlePlayMatch} className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">Play Match ⚽</button>
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
