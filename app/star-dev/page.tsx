"use client";
import { useCallback, useEffect, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills, Boot, OwnedItem } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer } from "@/lib/star/storage";
import { buildLeague, buildFixtures, simulateOtherFixtures, updateLeagueWithUserResult, mulberry32, sortLeague } from "@/lib/star/season";
import { pickDilemma, applyEffects, type Dilemma, type DilemmaEffect } from "@/lib/star/dilemmas";
import { checkNewAchievements } from "@/lib/star/achievements";
import { BOOTS_CATALOGUE, NRG_DRINKS, type NrgDrink } from "@/lib/star/shopData";
import ProfileSetup from "@/components/star/ProfileSetup";
import DashboardShell from "@/components/star/DashboardShell";
import DashboardStats from "@/components/star/DashboardStats";
import LeagueScreen from "@/components/star/LeagueScreen";
import LifeScreen from "@/components/star/LifeScreen";
import SkillsScreen, { TRAINING_ENERGY_COST } from "@/components/star/SkillsScreen";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import Match from "@/components/star/Match";
import PostMatch from "@/components/star/PostMatch";
import BallonDor from "@/components/star/BallonDor";
import Shop from "@/components/star/Shop";
import Casino from "@/components/star/Casino";
import DilemmaModal from "@/components/star/DilemmaModal";
import { SponsorsScreen, AchievementsScreen, TrophiesScreen, ContractRenewal } from "@/components/star/SecondaryScreens";
import RelationshipMinigame, { type RelationshipKind } from "@/components/star/RelationshipMinigame";

const SPONSOR_CATEGORIES = ["Boots", "Sports Drink", "Sports Clothing", "Casual Clothing", "Food", "Cosmetics", "Watch", "Electronics", "Jewelry", "Car"];

function makeInitialCareer(player: StarPlayer, clubs: string[]): CareerState {
  const league = buildLeague(clubs, player.club);
  const fixtures = buildFixtures(clubs, player.club);
  const starterBoot: Boot = { ...BOOTS_CATALOGUE[0] };
  return {
    version: 2,
    player,
    skills: { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 30 },
    relationships: { boss: 60, team: 60, fans: 40, girlfriend: null, sponsors: 0 },
    contract: { club: player.club, wage: 1, goalBonus: 1, assistBonus: 1, seasonsRemaining: 3 },
    season: 1,
    week: 1,
    energy: 100,
    matchFitness: 80,
    happiness: 60,
    money: 3,
    starRating: 2.5,
    fame: 5,
    seasonStats: { appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0 },
    careerStats: { appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0 },
    fixtures,
    league,
    achievements: ["first-contract"],
    status: "1st Team",
    currentBoot: starterBoot,
    nrgDrinks: { basic: 2, premium: 0, elite: 0 },
    ownedItems: [],
    girlfriend: null,
    sponsors: SPONSOR_CATEGORIES.map((c) => ({ category: c, perMatch: 0, active: false })),
    trophies: [],
    form: [],
    kitPrimary: "#ff0000",
    kitSecondary: "#ffffff",
    homeCity: "London",
    seenDilemmas: [],
    ballonDorWins: 0,
  };
}

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

  const checkAndSetAchievements = (state: CareerState) => {
    const newlyUnlocked = checkNewAchievements(state);
    if (newlyUnlocked.length > 0) {
      state.achievements = [...state.achievements, ...newlyUnlocked];
      setUnlockedAchievements(newlyUnlocked);
      setTimeout(() => setUnlockedAchievements([]), 3000);
    }
  };

  const handleMatchComplete = useCallback((stats: MatchStats) => {
    if (!career || !nextFixture) return;
    setLastMatchStats(stats);

    const seasonStats = {
      appearances: career.seasonStats.appearances + 1,
      goals: career.seasonStats.goals + stats.goals,
      hatTricks: career.seasonStats.hatTricks + (stats.goals >= 3 ? 1 : 0),
      passes: career.seasonStats.passes + stats.passes,
      assists: career.seasonStats.assists + stats.assists,
      starMan: career.seasonStats.starMan + (stats.starMan ? 1 : 0),
      totalRating: career.seasonStats.totalRating + stats.rating,
      ratingCount: career.seasonStats.ratingCount + 1,
    };
    const careerStats = {
      appearances: career.careerStats.appearances + 1,
      goals: career.careerStats.goals + stats.goals,
      hatTricks: career.careerStats.hatTricks + (stats.goals >= 3 ? 1 : 0),
      passes: career.careerStats.passes + stats.passes,
      assists: career.careerStats.assists + stats.assists,
      starMan: career.careerStats.starMan + (stats.starMan ? 1 : 0),
      totalRating: career.careerStats.totalRating + stats.rating,
      ratingCount: career.careerStats.ratingCount + 1,
    };

    let league = updateLeagueWithUserResult(career.league, career.player.club, nextFixture.opponent, stats.homeScore, stats.awayScore);
    const rng = mulberry32(career.season * 1000 + career.week);
    league = simulateOtherFixtures(league, career.player.club, career.week, rng);

    const fixtures = career.fixtures.map((f) => {
      if (f === nextFixture) {
        return {
          ...f,
          played: true,
          homeScore: f.home ? stats.homeScore : stats.awayScore,
          awayScore: f.home ? stats.awayScore : stats.homeScore,
          userGoals: stats.goals,
          userAssists: stats.assists,
          userRating: stats.rating,
        };
      }
      return f;
    });

    // Boot durability
    const newBootMatches = Math.max(0, career.currentBoot.matches - 1);
    const currentBoot = { ...career.currentBoot, matches: newBootMatches };

    // Sponsor progress: raise relationship based on fame + performance
    const sponsorGain = Math.max(0, Math.floor(stats.fansChange / 3));
    const newSponsorRel = Math.min(100, career.relationships.sponsors + sponsorGain);

    // Auto-unlock sponsor deals as relationship increases (one deal per ★10 relationship)
    const dealsUnlocked = Math.floor(newSponsorRel / 10);
    const sponsors = career.sponsors.map((s, i) => {
      if (i < dealsUnlocked && !s.active) {
        return { ...s, active: true, perMatch: 1 + Math.floor(i / 2) };
      }
      return s;
    });

    let next: CareerState = {
      ...career,
      seasonStats,
      careerStats,
      league,
      fixtures,
      money: career.money + stats.totalCash,
      energy: Math.max(15, career.energy - 40),
      matchFitness: Math.min(100, career.matchFitness + 3),
      relationships: {
        ...career.relationships,
        boss: Math.max(0, Math.min(100, career.relationships.boss + stats.bossChange)),
        team: Math.max(0, Math.min(100, career.relationships.team + stats.teamChange)),
        fans: Math.max(0, Math.min(100, career.relationships.fans + stats.fansChange)),
        sponsors: newSponsorRel,
      },
      sponsors,
      starRating: Math.min(5, career.starRating + (stats.rating >= 8 ? 0.03 : stats.rating >= 7 ? 0.01 : 0)),
      fame: career.fame + Math.max(0, Math.floor(stats.fansChange / 2)),
      week: career.week + 1,
      currentBoot,
      form: [stats.rating, ...career.form].slice(0, 5),
    };
    checkAndSetAchievements(next);

    setCareer(next);
    setPhase("post-match");
  }, [career, nextFixture]);

  const handlePostMatchContinue = useCallback(() => {
    if (!career) return;
    const remaining = career.fixtures.filter((f) => !f.played).length;
    if (remaining === 0) {
      // Award league trophy if won
      const sorted = sortLeague(career.league);
      if (sorted[0]?.name === career.player.club) {
        const trophy = { season: career.season, competition: "Premier League", club: career.player.club };
        setCareer({ ...career, trophies: [...career.trophies, trophy] });
      }
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
    const clubs = career.league.map((t) => t.name);
    const newFixtures = buildFixtures(clubs, career.player.club);
    const newLeague = buildLeague(clubs, career.player.club);

    // Contract seasons remaining
    const seasonsLeft = career.contract.seasonsRemaining - 1;

    // Aging effects — skills decline slightly after 30
    const ageEffect = (v: number): number => {
      const newAge = career.player.age + 1;
      if (newAge >= 34) return Math.max(20, v - 3);
      if (newAge >= 30) return Math.max(30, v - 1);
      return v;
    };
    const agedSkills: Skills = {
      pace: ageEffect(career.skills.pace),
      power: ageEffect(career.skills.power),
      technique: career.skills.technique, // technique decays slower
      vision: career.skills.vision,       // vision improves with age; keep steady
      freeKick: career.skills.freeKick,
    };

    let next: CareerState = {
      ...career,
      player: { ...career.player, age: career.player.age + 1 },
      skills: agedSkills,
      season: career.season + 1,
      week: 1,
      fixtures: newFixtures,
      league: newLeague,
      seasonStats: { appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0 },
      energy: 100,
      matchFitness: 85,
      form: [],
      contract: { ...career.contract, seasonsRemaining: seasonsLeft },
      ballonDorWins: career.ballonDorWins + (userWon ? 1 : 0),
    };

    checkAndSetAchievements(next);
    setCareer(next);

    // If contract expiring, force renewal
    if (seasonsLeft <= 0) {
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
    return (
      <Match
        career={career}
        fixture={nextFixture}
        oppStrength={opp?.strength ?? 65}
        onComplete={handleMatchComplete}
      />
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
