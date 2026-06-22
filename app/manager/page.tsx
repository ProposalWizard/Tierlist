"use client";
import { useState, useMemo } from "react";
import ManagerSetup from "@/components/manager/ManagerSetup";
import TransferMarket from "@/components/manager/TransferMarket";
import SquadArrange from "@/components/manager/SquadArrange";
import SeasonHub, { type Fixture, type LeagueRow } from "@/components/manager/SeasonHub";
import MatchDay from "@/components/manager/MatchDay";
import TransferWindow from "@/components/manager/TransferWindow";
import { DEFAULT_PL_TEAMS } from "@/components/draft/formations";
import type { DraftPlayer } from "@/app/draft/page";
import type { MatchResult } from "@/lib/matchEvents";

type Phase = "setup" | "market" | "arrange" | "hub" | "match" | "transfer" | "end";

function buildFixtures(opponents: { name: string }[]): Fixture[] {
  // 19 opponents × 2 (home + away) = 38 fixtures
  // Interleave so each opponent appears once in first half and once in second half
  const firstHalf = opponents.map(o => ({ opponent: o.name, isHome: Math.random() < 0.5 }));
  const secondHalf = firstHalf.map(f => ({ opponent: f.opponent, isHome: !f.isHome }));
  // Shuffle within halves
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const all = [...shuffle(firstHalf), ...shuffle(secondHalf)];
  return all.map((f, i) => ({
    matchweek: i + 1,
    opponent: f.opponent,
    isHome: f.isHome,
    played: false,
  }));
}

function buildEmptyTable(opponents: { name: string; strength: number }[], playerName: string): LeagueRow[] {
  const rows: LeagueRow[] = opponents.map(o => ({
    name: o.name,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    isPlayer: false,
  }));
  rows.push({
    name: playerName,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    isPlayer: true,
  });
  return rows;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0; let p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// Quick simulation for AI vs AI matches
function simulateAiMatch(homeStrength: number, awayStrength: number, seed: number): { homeGoals: number; awayGoals: number } {
  const rand = rng(seed);
  const homeAdv = 3;
  const diff = (homeStrength + homeAdv) - awayStrength;
  const homeXg = Math.max(0.25, Math.min(3.5, 1.3 + diff * 0.065)) * (0.85 + rand() * 0.3);
  const awayXg = Math.max(0.25, Math.min(3.5, 1.3 - diff * 0.065)) * (0.85 + rand() * 0.3);
  return { homeGoals: poisson(homeXg, rand), awayGoals: poisson(awayXg, rand) };
}

const PLAYER_TEAM_NAME = "Your Club";

export default function ManagerPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [formation, setFormation] = useState("4-3-3");
  const [squad, setSquad] = useState<DraftPlayer[]>([]);
  const [budget, setBudget] = useState(0);
  const [matchweek, setMatchweek] = useState(1);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [table, setTable] = useState<LeagueRow[]>([]);
  const [season, setSeason] = useState(1);
  const [transferDone, setTransferDone] = useState(false);
  const opponents = useMemo(() => DEFAULT_PL_TEAMS.slice(0, 19), []);
  const seasonSeed = useMemo(() => Math.floor(Math.random() * 1_000_000), []);

  const squadAvg = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length) : 0;
  const starterAvg = useMemo(() => {
    const starters = squad.filter(p => !p.isSub);
    return starters.length > 0 ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : 0;
  }, [squad]);

  const handleSetupComplete = (f: string) => {
    setFormation(f);
    setPhase("market");
  };

  const handleMarketComplete = (s: DraftPlayer[], remaining: number) => {
    setSquad(s);
    setBudget(remaining);
    setPhase("arrange");
  };

  const handleArrangeComplete = (s: DraftPlayer[]) => {
    setSquad(s);
    setFixtures(buildFixtures(opponents));
    setTable(buildEmptyTable(opponents, PLAYER_TEAM_NAME));
    setMatchweek(1);
    setPhase("hub");
  };

  const handlePlayNext = () => {
    if (matchweek > 38) {
      setPhase("end");
      return;
    }
    setPhase("match");
  };

  const handleMatchComplete = (result: MatchResult, finalSquad: DraftPlayer[]) => {
    setSquad(finalSquad);
    const fixture = fixtures[matchweek - 1];
    if (!fixture) return;

    // Update fixture
    const newFixtures = [...fixtures];
    newFixtures[matchweek - 1] = {
      ...fixture,
      played: true,
      goalsFor: result.goalsFor,
      goalsAgainst: result.goalsAgainst,
    };
    setFixtures(newFixtures);

    // Update player's table row
    const newTable = table.map(row => ({ ...row }));
    const playerRow = newTable.find(r => r.isPlayer);
    const oppRow = newTable.find(r => r.name === fixture.opponent);

    if (playerRow) {
      playerRow.played++;
      playerRow.goalsFor += result.goalsFor;
      playerRow.goalsAgainst += result.goalsAgainst;
      if (result.goalsFor > result.goalsAgainst) { playerRow.won++; playerRow.points += 3; }
      else if (result.goalsFor < result.goalsAgainst) { playerRow.lost++; }
      else { playerRow.drawn++; playerRow.points += 1; }
    }
    if (oppRow) {
      oppRow.played++;
      oppRow.goalsFor += result.goalsAgainst;
      oppRow.goalsAgainst += result.goalsFor;
      if (result.goalsAgainst > result.goalsFor) { oppRow.won++; oppRow.points += 3; }
      else if (result.goalsAgainst < result.goalsFor) { oppRow.lost++; }
      else { oppRow.drawn++; oppRow.points += 1; }
    }

    // Simulate the other matches in this matchweek (AI vs AI)
    // Each matchweek, every team plays exactly one match. The other 18 teams (excluding player + their opponent)
    // pair up. We do a simple random pairing.
    const aiTeams = opponents.filter(t => t.name !== fixture.opponent);
    // Shuffle
    const shuffled = [...aiTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const home = shuffled[i];
      const away = shuffled[i + 1];
      const sim = simulateAiMatch(home.strength, away.strength, seasonSeed * 1000 + matchweek * 100 + i);
      const homeRow = newTable.find(r => r.name === home.name);
      const awayRow = newTable.find(r => r.name === away.name);
      if (homeRow) {
        homeRow.played++;
        homeRow.goalsFor += sim.homeGoals;
        homeRow.goalsAgainst += sim.awayGoals;
        if (sim.homeGoals > sim.awayGoals) { homeRow.won++; homeRow.points += 3; }
        else if (sim.homeGoals < sim.awayGoals) { homeRow.lost++; }
        else { homeRow.drawn++; homeRow.points += 1; }
      }
      if (awayRow) {
        awayRow.played++;
        awayRow.goalsFor += sim.awayGoals;
        awayRow.goalsAgainst += sim.homeGoals;
        if (sim.awayGoals > sim.homeGoals) { awayRow.won++; awayRow.points += 3; }
        else if (sim.awayGoals < sim.homeGoals) { awayRow.lost++; }
        else { awayRow.drawn++; awayRow.points += 1; }
      }
    }
    setTable(newTable);

    setMatchweek(mw => mw + 1);
    setPhase("hub");
  };

  const handleTransferComplete = (newSquad: DraftPlayer[], newBudget: number) => {
    setSquad(newSquad);
    setBudget(newBudget);
    setTransferDone(true);
    setPhase("hub");
  };

  const handleNewSeason = () => {
    setSeason(s => s + 1);
    setFixtures(buildFixtures(opponents));
    setTable(buildEmptyTable(opponents, PLAYER_TEAM_NAME));
    setMatchweek(1);
    setBudget(b => b + 150); // End-of-season cash injection
    setTransferDone(false);
    setPhase("hub");
  };

  // === RENDER ===
  if (phase === "setup") return <ManagerSetup onStart={handleSetupComplete} />;
  if (phase === "market") return <TransferMarket formationName={formation} onComplete={handleMarketComplete} />;
  if (phase === "arrange") return <SquadArrange squad={squad} formationName={formation} budgetLeft={budget} onConfirm={handleArrangeComplete} />;

  if (phase === "match") {
    const fixture = fixtures[matchweek - 1];
    if (!fixture) {
      return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading match...</div>;
    }
    const opp = opponents.find(o => o.name === fixture.opponent) ?? { name: fixture.opponent, strength: 70 };
    return (
      <MatchDay
        squad={squad}
        opponent={opp}
        isHome={fixture.isHome}
        matchweek={matchweek}
        seed={seasonSeed + matchweek * 7919}
        onComplete={handleMatchComplete}
      />
    );
  }

  if (phase === "transfer") {
    return <TransferWindow squad={squad} budget={budget} onComplete={handleTransferComplete} />;
  }

  if (phase === "hub") {
    const showTransferButton = matchweek > 19 && matchweek <= 38 && !transferDone;
    return (
      <SeasonHub
        table={table}
        fixtures={fixtures}
        matchweek={matchweek}
        budget={budget}
        squadAvg={starterAvg}
        onPlayNext={handlePlayNext}
        onOpenTransfer={showTransferButton ? () => setPhase("transfer") : undefined}
      />
    );
  }

  if (phase === "end") {
    const sorted = [...table].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGd = a.goalsFor - a.goalsAgainst;
      const bGd = b.goalsFor - b.goalsAgainst;
      return bGd - aGd;
    });
    const playerRow = sorted.find(r => r.isPlayer);
    const playerPos = playerRow ? sorted.indexOf(playerRow) + 1 : 0;
    const isCl = playerPos <= 4;
    const isWinner = playerPos === 1;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-7xl mb-4">{isWinner ? "🏆" : isCl ? "🌟" : playerPos >= 18 ? "📉" : "⚽"}</div>
          <h1 className="text-3xl font-black text-white mb-1">Season {season} Complete</h1>
          <p className="text-white text-sm mb-6">
            {isWinner ? "Champions of England!" :
             isCl ? `${playerPos}${playerPos === 2 ? "nd" : playerPos === 3 ? "rd" : "th"} place — Champions League!` :
             playerPos >= 18 ? "Relegated. A rebuild beckons." :
             `Finished ${playerPos}${playerPos === 2 ? "nd" : playerPos === 3 ? "rd" : "th"}.`}
          </p>

          <div className="bg-gray-900 rounded-2xl border border-gray-800/50 p-5 mb-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-[10px] text-white uppercase">Points</div>
                <div className="text-3xl font-black text-amber-400">{playerRow?.points ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-white uppercase">Position</div>
                <div className="text-3xl font-black text-white">{playerPos}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-white uppercase">Goals For</div>
                <div className="text-xl font-black text-emerald-400">{playerRow?.goalsFor ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-white uppercase">Goals Against</div>
                <div className="text-xl font-black text-red-400">{playerRow?.goalsAgainst ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleNewSeason}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black py-3.5 rounded-xl"
            >
              Start Season {season + 1} (+£150M budget)
            </button>
            <button
              onClick={() => { setPhase("setup"); setSeason(1); setSquad([]); setBudget(0); }}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-bold py-3 rounded-xl text-sm"
            >
              New Career
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
