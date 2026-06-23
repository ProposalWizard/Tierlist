"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import CLDraftSetup, { type CLDraftSettings } from "@/components/cl-draft/CLDraftSetup";
import CLDraftPick, { type CLDraftPlayer } from "@/components/cl-draft/CLDraftPick";
import CLMatchViewer from "@/components/cl-draft/CLMatchViewer";
import CLSeasonView from "@/components/cl-draft/CLSeasonView";
import { simulateCLSeason } from "@/lib/clSimulator";
import type { CLSeasonResult, CLMatchResult, CLKnockoutTie } from "@/lib/clSimulator";
import type { DraftPlayer, PlayerAttributes } from "@/lib/seasonSimulator";
import { getPositionColor, FORMATIONS } from "@/components/draft/formations";

type GamePhase = "loading" | "unauthorized" | "setup" | "draft" | "simulate" | "result" | "career-end";

const MAX_SEASONS = 5;

function toDraftPlayer(p: CLDraftPlayer): DraftPlayer {
  return {
    name: p.name,
    overall: p.overall,
    positions: p.positions,
    club: p.club,
    clubYear: p.clubYear,
    assignedPosition: p.assignedPosition,
    age: p.age,
    isSub: p.isSub,
    attrs: p.attrs,
  };
}

function applyStatChange(player: CLDraftPlayer, change: number): CLDraftPlayer {
  const p = {
    ...player,
    overall: Math.max(1, Math.min(100, player.overall + change)),
  };
  if (p.attrs) {
    const attrs = { ...p.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      attrs[key] = Math.max(1, Math.min(100, (attrs[key] as number) + change));
    }
    p.attrs = attrs;
  }
  return p;
}

export default function CLDraftPage() {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [settings, setSettings] = useState<CLDraftSettings | null>(null);
  const [players, setPlayers] = useState<CLDraftPlayer[]>([]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [seasonResult, setSeasonResult] = useState<CLSeasonResult | null>(null);
  const [allResults, setAllResults] = useState<CLSeasonResult[]>([]);

  // Match-by-match simulation state
  const [simPhase, setSimPhase] = useState<"league" | "knockout" | "done">("league");
  const [simMatchIndex, setSimMatchIndex] = useState(0);
  const [fullResult, setFullResult] = useState<CLSeasonResult | null>(null);

  // Admin check
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("unauthorized"); return; }
      const { data } = await supabase.from("user_roles").select("is_admin").eq("user_id", user.id).single();
      if (!data?.is_admin) { setPhase("unauthorized"); return; }
      setPhase("setup");
    };
    checkAdmin();
  }, []);

  const handleStart = (s: CLDraftSettings) => {
    setSettings(s);
    setPhase("draft");
  };

  const handleDraftComplete = (picked: CLDraftPlayer[]) => {
    setPlayers(picked);
    startSimulation(picked);
  };

  const startSimulation = useCallback((squad: CLDraftPlayer[]) => {
    const draftPlayers = squad.map(toDraftPlayer);
    const result = simulateCLSeason(draftPlayers, currentSeason, allResults.length > 0 ? allResults[allResults.length - 1] : undefined);
    setFullResult(result);
    setSimPhase("league");
    setSimMatchIndex(0);
    setPhase("simulate");
  }, [currentSeason, allResults]);

  // Get current match to display in the viewer
  const getCurrentMatch = (): { match: CLMatchResult; tie?: CLKnockoutTie; leg?: 1 | 2 } | null => {
    if (!fullResult) return null;

    if (simPhase === "league") {
      if (simMatchIndex < fullResult.leagueMatches.length) {
        return { match: fullResult.leagueMatches[simMatchIndex] };
      }
      return null;
    }

    if (simPhase === "knockout") {
      // Flatten knockout ties into individual matches
      const knockoutMatches: { match: CLMatchResult; tie: CLKnockoutTie; leg: 1 | 2 }[] = [];
      for (const tie of fullResult.knockoutTies) {
        knockoutMatches.push({ match: tie.leg1, tie, leg: 1 });
        if (tie.leg2) knockoutMatches.push({ match: tie.leg2, tie, leg: 2 });
      }
      if (simMatchIndex < knockoutMatches.length) {
        return knockoutMatches[simMatchIndex];
      }
      return null;
    }

    return null;
  };

  const handleMatchFinished = () => {
    if (!fullResult) return;

    if (simPhase === "league") {
      const nextIdx = simMatchIndex + 1;
      if (nextIdx < fullResult.leagueMatches.length) {
        setSimMatchIndex(nextIdx);
      } else {
        // League phase done
        if (fullResult.knockoutTies.length > 0) {
          setSimPhase("knockout");
          setSimMatchIndex(0);
        } else {
          // Eliminated in league phase
          setSimPhase("done");
          setSeasonResult(fullResult);
          setPhase("result");
        }
      }
    } else if (simPhase === "knockout") {
      const knockoutMatches: unknown[] = [];
      for (const tie of fullResult.knockoutTies) {
        knockoutMatches.push(tie.leg1);
        if (tie.leg2) knockoutMatches.push(tie.leg2);
      }
      const nextIdx = simMatchIndex + 1;
      if (nextIdx < knockoutMatches.length) {
        setSimMatchIndex(nextIdx);
      } else {
        setSimPhase("done");
        setSeasonResult(fullResult);
        setPhase("result");
      }
    }
  };

  const handlePlayNextSeason = () => {
    if (!seasonResult) return;
    setAllResults(prev => [...prev, seasonResult]);

    // Apply rating changes based on performance
    const updatedPlayers = players.map(p => {
      const stats = seasonResult.playerStats.find(s => s.name === p.name);
      if (!stats) return p;
      let change = 0;
      if (stats.avgRating >= 8.5) change = 3;
      else if (stats.avgRating >= 7.7) change = 2;
      else if (stats.avgRating >= 7.0) change = 1;
      else if (stats.avgRating <= 6.5) change = -1;
      return change !== 0 ? applyStatChange(p, change) : p;
    });

    // Random departure (1-2 players)
    const numDepartures = Math.random() < 0.6 ? 2 : 1;
    const departedIndices: number[] = [];
    for (let i = 0; i < numDepartures; i++) {
      const available = updatedPlayers
        .map((_, idx) => idx)
        .filter(idx => !departedIndices.includes(idx));
      if (available.length === 0) break;
      const idx = available[Math.floor(Math.random() * available.length)];
      departedIndices.push(idx);
    }

    const remaining = updatedPlayers.filter((_, i) => !departedIndices.includes(i));
    setPlayers(remaining);
    setCurrentSeason(prev => prev + 1);
    setSeasonResult(null);
    setFullResult(null);
    setPhase("draft");
  };

  const handleFinishCareer = () => {
    if (seasonResult) setAllResults(prev => [...prev, seasonResult]);
    setPhase("career-end");
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "unauthorized") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Unauthorized</h1>
          <p className="text-gray-400">Admin access required for test game modes.</p>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return <CLDraftSetup onStart={handleStart} />;
  }

  if (phase === "draft" && settings) {
    const totalPicks = 14 - players.length;
    return (
      <CLDraftPick
        settings={settings}
        onComplete={(newPicks) => {
          const allPlayers = [...players, ...newPicks];
          handleDraftComplete(allPlayers);
        }}
      />
    );
  }

  if (phase === "simulate") {
    const currentMatch = getCurrentMatch();

    if (!currentMatch) {
      // No more matches — go to result
      if (fullResult) {
        setSeasonResult(fullResult);
        setPhase("result");
      }
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          {/* Phase indicator */}
          <div className="text-center mb-4">
            <div className="text-sm text-gray-400 mb-1">Season {currentSeason}</div>
            <div className="text-lg font-semibold text-blue-400">
              {simPhase === "league"
                ? `League Phase — Match ${simMatchIndex + 1} of ${fullResult?.leagueMatches.length ?? 8}`
                : `Knockout Stage — ${currentMatch.tie?.round ?? ""}`}
            </div>
          </div>

          <CLMatchViewer
            match={currentMatch.match}
            knockoutTie={currentMatch.tie}
            legNumber={currentMatch.leg}
            onFinished={handleMatchFinished}
          />
        </div>
      </div>
    );
  }

  if (phase === "result" && seasonResult) {
    return (
      <CLSeasonView
        result={seasonResult}
        seasonNumber={currentSeason}
        totalSeasons={MAX_SEASONS}
        onPlayNextSeason={currentSeason < MAX_SEASONS ? handlePlayNextSeason : undefined}
        onFinish={handleFinishCareer}
      />
    );
  }

  if (phase === "career-end") {
    const wins = allResults.filter(r => r.winner).length;
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <h1 className="text-4xl font-bold">Career Complete</h1>
          <div className="text-6xl">{wins > 0 ? "🏆" : "📋"}</div>
          <div className="text-2xl">
            {wins > 0
              ? `${wins} Champions League${wins > 1 ? "s" : ""} Won!`
              : "No Champions League Titles"}
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-left">
            <h3 className="font-semibold text-center mb-3">Season Summary</h3>
            {allResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-gray-700/50">
                <span>Season {i + 1}</span>
                <span className={`font-bold ${r.winner ? "text-yellow-400" : "text-gray-400"}`}>
                  {r.winner ? "🏆 Winner" : `Exit: ${r.exitStage ?? "League Phase"}`}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setPhase("setup");
                setPlayers([]);
                setCurrentSeason(1);
                setAllResults([]);
                setSeasonResult(null);
                setFullResult(null);
                setSettings(null);
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
