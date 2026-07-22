"use client";
import { useCallback, useEffect, useState } from "react";
import type { CareerState, StarPhase, StarPlayer, MatchStats, Skills } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer } from "@/lib/star/storage";
import { buildLeague, buildFixtures, simulateOtherFixtures, updateLeagueWithUserResult, mulberry32 } from "@/lib/star/season";
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

function makeInitialCareer(player: StarPlayer, clubs: string[]): CareerState {
  const league = buildLeague(clubs, player.club);
  const fixtures = buildFixtures(clubs, player.club);
  return {
    version: 1,
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
    achievements: [],
    status: "1st Team",
    bootsMatches: 5,
    nrgDrinks: 2,
    form: [],
  };
}

export default function StarDevPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [phase, setPhase] = useState<StarPhase>("profile-setup");
  const [activeNav, setActiveNav] = useState<"league" | "skills" | "life" | "play" | null>(null);
  const [trainingSkill, setTrainingSkill] = useState<keyof Skills | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);

  // Load saved career on mount
  useEffect(() => {
    const saved = loadCareer();
    if (saved) {
      setCareer(saved);
      setPhase("dashboard");
    }
  }, []);

  // Auto-save
  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  const nextFixture = career?.fixtures.find((f) => !f.played) ?? null;
  const nextMatchLabel = nextFixture
    ? `Next: ${nextFixture.home ? career!.player.club : nextFixture.opponent} v ${nextFixture.home ? nextFixture.opponent : career!.player.club}`
    : "Season complete";

  const handleProfileComplete = useCallback((player: StarPlayer, clubs: string[]) => {
    const c = makeInitialCareer(player, clubs);
    setCareer(c);
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

  const handleTrain = useCallback((skill: keyof Skills) => {
    setTrainingSkill(skill);
    setPhase("training");
  }, []);

  const handleTrainingComplete = useCallback((xp: number) => {
    if (!career || !trainingSkill) return;
    const currentVal = career.skills[trainingSkill];
    const gain = Math.min(100 - currentVal, Math.floor(xp / 5));
    setCareer({
      ...career,
      skills: { ...career.skills, [trainingSkill]: currentVal + gain },
      energy: Math.max(0, career.energy - TRAINING_ENERGY_COST),
      starRating: Math.min(5, career.starRating + gain * 0.005),
    });
    setTrainingSkill(null);
    setPhase("skills");
  }, [career, trainingSkill]);

  const handlePlayMatch = useCallback(() => {
    if (!career || !nextFixture) return;
    setPhase("match");
  }, [career, nextFixture]);

  const handleMatchComplete = useCallback((stats: MatchStats) => {
    if (!career || !nextFixture) return;
    setLastMatchStats(stats);

    // Update career state
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

    // Update league table
    let league = updateLeagueWithUserResult(
      career.league,
      career.player.club,
      nextFixture.opponent,
      stats.homeScore,
      stats.awayScore,
    );
    const rng = mulberry32(career.season * 1000 + career.week);
    league = simulateOtherFixtures(league, career.player.club, career.week, rng);

    // Update fixtures list
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

    setCareer({
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
      },
      starRating: Math.min(5, career.starRating + (stats.rating >= 8 ? 0.03 : stats.rating >= 7 ? 0.01 : 0)),
      fame: career.fame + Math.max(0, Math.floor(stats.fansChange / 2)),
      week: career.week + 1,
      bootsMatches: Math.max(0, career.bootsMatches - 1),
      form: [stats.rating, ...career.form].slice(0, 5),
    });

    setPhase("post-match");
  }, [career, nextFixture]);

  const handlePostMatchContinue = useCallback(() => {
    if (!career) return;
    const remaining = career.fixtures.filter((f) => !f.played).length;
    if (remaining === 0) {
      setPhase("ballon-dor");
    } else {
      setActiveNav(null);
      setPhase("dashboard");
    }
  }, [career]);

  const handleBallonDorContinue = useCallback(() => {
    if (!career) return;
    // Advance to next season: reset fixtures, age up, reset season stats
    const clubs = career.league.map((t) => t.name);
    const newFixtures = buildFixtures(clubs, career.player.club);
    const newLeague = buildLeague(clubs, career.player.club);
    setCareer({
      ...career,
      player: { ...career.player, age: career.player.age + 1 },
      season: career.season + 1,
      week: 1,
      fixtures: newFixtures,
      league: newLeague,
      seasonStats: { appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0 },
      energy: 100,
      matchFitness: 85,
      form: [],
    });
    setActiveNav(null);
    setPhase("dashboard");
  }, [career]);

  const handleFullReset = () => {
    if (confirm("Delete this career and start over?")) {
      clearCareer();
      setCareer(null);
      setPhase("profile-setup");
    }
  };

  // Render
  if (phase === "profile-setup" || !career) {
    return <ProfileSetup onComplete={handleProfileComplete} />;
  }

  if (phase === "training" && trainingSkill) {
    return <TrainingMinigame skill={trainingSkill} onComplete={handleTrainingComplete} />;
  }

  if (phase === "match" && nextFixture) {
    // Get opponent strength from league
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

  // Dashboard-shell wrapped screens
  return (
    <DashboardShell
      career={career}
      onExit={handleExit}
      onNavigate={handleNavigate}
      activeNav={activeNav}
      nextMatchLabel={nextMatchLabel}
    >
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
          <LifeScreen career={career} />
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
