"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import CLDraftSetup, { type CLDraftSettings } from "@/components/cl-draft/CLDraftSetup";
import CLDraftPick, { type CLDraftPlayer } from "@/components/cl-draft/CLDraftPick";
import CLMatchViewer from "@/components/cl-draft/CLMatchViewer";
import CLBracket from "@/components/cl-draft/CLBracket";
import CLSeasonView from "@/components/cl-draft/CLSeasonView";
import { simulateCLSeason } from "@/lib/clSimulator";
import type { CLSeasonResult, CLMatchResult, CLKnockoutTie, CLLeagueStanding, CLFullBracket } from "@/lib/clSimulator";
import type { DraftPlayer, PlayerAttributes } from "@/lib/seasonSimulator";

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

// Build partial league table from only the matches completed so far.
// Player stats come from actual completed matches; AI teams are scaled proportionally.
function computeLiveLeagueTable(fullResult: CLSeasonResult, completedMatches: number): CLLeagueStanding[] {
  const total = Math.max(1, fullResult.leagueMatches.length);
  const fraction = completedMatches / total;

  const live = fullResult.leagueTable.map(team => {
    if (team.isPlayer) {
      const done = fullResult.leagueMatches.slice(0, completedMatches);
      let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
      for (const m of done) {
        if (m.result === "W") won++;
        else if (m.result === "D") drawn++;
        else lost++;
        gf += m.goalsFor;
        ga += m.goalsAgainst;
      }
      return { ...team, played: completedMatches, won, drawn, lost, goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga, points: won * 3 + drawn };
    }
    return {
      ...team,
      played: Math.round(team.played * fraction),
      won: Math.round(team.won * fraction),
      drawn: Math.round(team.drawn * fraction),
      lost: Math.round(team.lost * fraction),
      goalsFor: Math.round(team.goalsFor * fraction),
      goalsAgainst: Math.round(team.goalsAgainst * fraction),
      goalDifference: Math.round(team.goalDifference * fraction),
      points: Math.round(team.points * fraction),
    };
  });

  live.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
  return live;
}

// Build a bracket showing only rounds the player has entered so far.
// Within revealed rounds, all pairings (including AI vs AI) are shown.
function getPartialBracket(fullResult: CLSeasonResult, simMatchIdx: number): CLFullBracket {
  const revealedRounds = new Set<string>();
  let matchCount = 0;

  for (const tie of fullResult.knockoutTies) {
    revealedRounds.add(tie.round);
    const tieMatchCount = tie.leg2 ? 2 : 1;
    if (matchCount + tieMatchCount > simMatchIdx) break;
    matchCount += tieMatchCount;
  }

  const b = fullResult.bracket;
  return {
    playoffRound: revealedRounds.has("Playoff Round") ? b.playoffRound : [],
    roundOf16: revealedRounds.has("Round of 16") ? b.roundOf16 : [],
    quarterFinals: revealedRounds.has("Quarter-Final") ? b.quarterFinals : [],
    semiFinals: revealedRounds.has("Semi-Final") ? b.semiFinals : [],
    final: revealedRounds.has("Final") ? b.final : null,
  };
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
  // After each match finishes: hold it here, show between-match screen, advance only on user action
  const [matchJustFinished, setMatchJustFinished] = useState<CLMatchResult | null>(null);
  const [updatedResult, setUpdatedResult] = useState<CLSeasonResult | null>(null);

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
    setUpdatedResult(result);
    setSimPhase("league");
    setSimMatchIndex(0);
    setMatchJustFinished(null);
    setPhase("simulate");
  }, [currentSeason, allResults]);

  const getCurrentMatch = (result: CLSeasonResult): { match: CLMatchResult; tie?: CLKnockoutTie; leg?: 1 | 2 } | null => {
    if (simPhase === "league") {
      if (simMatchIndex < result.leagueMatches.length) {
        return { match: result.leagueMatches[simMatchIndex] };
      }
      return null;
    }
    if (simPhase === "knockout") {
      const knockoutMatches: { match: CLMatchResult; tie: CLKnockoutTie; leg: 1 | 2 }[] = [];
      for (const tie of result.knockoutTies) {
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

  // Match finished: apply decision-modified result, show between-match screen
  const handleMatchFinished = (modifiedMatch: CLMatchResult) => {
    if (!fullResult) return;

    const updated = { ...fullResult };
    if (simPhase === "league") {
      updated.leagueMatches = fullResult.leagueMatches.map((m, i) =>
        i === simMatchIndex ? modifiedMatch : m
      );
    } else if (simPhase === "knockout") {
      let matchIdx = 0;
      updated.knockoutTies = fullResult.knockoutTies.map(tie => {
        const newTie = { ...tie };
        if (matchIdx === simMatchIndex) newTie.leg1 = modifiedMatch;
        matchIdx++;
        if (tie.leg2) {
          if (matchIdx === simMatchIndex) newTie.leg2 = modifiedMatch;
          matchIdx++;
        }
        return newTie;
      });
    }
    setFullResult(updated);
    setUpdatedResult(updated);
    setMatchJustFinished(modifiedMatch);
  };

  // User clicks "Next Match" from the between-match screen
  const handleAdvanceMatch = () => {
    const result = updatedResult ?? fullResult;
    if (!result) return;
    setMatchJustFinished(null);

    if (simPhase === "league") {
      const nextIdx = simMatchIndex + 1;
      if (nextIdx < result.leagueMatches.length) {
        setSimMatchIndex(nextIdx);
      } else if (result.knockoutTies.length > 0) {
        setSimPhase("knockout");
        setSimMatchIndex(0);
      } else {
        setSimPhase("done");
        setSeasonResult(result);
        setPhase("result");
      }
    } else if (simPhase === "knockout") {
      const knockoutMatchCount = result.knockoutTies.reduce(
        (count, tie) => count + 1 + (tie.leg2 ? 1 : 0), 0
      );
      const nextIdx = simMatchIndex + 1;
      if (nextIdx < knockoutMatchCount) {
        setSimMatchIndex(nextIdx);
      } else {
        setSimPhase("done");
        setSeasonResult(result);
        setPhase("result");
      }
    }
  };

  const handlePlayNextSeason = () => {
    if (!seasonResult) return;
    setAllResults(prev => [...prev, seasonResult]);

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

    const numDepartures = Math.random() < 0.6 ? 2 : 1;
    const departedIndices: number[] = [];
    for (let i = 0; i < numDepartures; i++) {
      const available = updatedPlayers.map((_, idx) => idx).filter(idx => !departedIndices.includes(idx));
      if (available.length === 0) break;
      departedIndices.push(available[Math.floor(Math.random() * available.length)]);
    }

    setPlayers(updatedPlayers.filter((_, i) => !departedIndices.includes(i)));
    setCurrentSeason(prev => prev + 1);
    setSeasonResult(null);
    setFullResult(null);
    setUpdatedResult(null);
    setMatchJustFinished(null);
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
    const result = updatedResult ?? fullResult;
    if (!result) return null;

    // ── Between-match screen ──
    if (matchJustFinished !== null) {
      const completedLeagueMatches = simPhase === "league"
        ? simMatchIndex + 1
        : result.leagueMatches.length;

      const liveTable = computeLiveLeagueTable(result, completedLeagueMatches);
      const partialBracket = simPhase === "knockout" ? getPartialBracket(result, simMatchIndex) : null;

      // Determine next match label
      const isLastLeagueMatch = simPhase === "league" && simMatchIndex + 1 >= result.leagueMatches.length;
      const isLastKnockoutMatch = simPhase === "knockout" && (() => {
        const total = result.knockoutTies.reduce((c, t) => c + 1 + (t.leg2 ? 1 : 0), 0);
        return simMatchIndex + 1 >= total;
      })();
      let nextLabel = "Next Match →";
      if (isLastLeagueMatch && result.knockoutTies.length > 0) nextLabel = "Into Knockout Stage →";
      else if (isLastKnockoutMatch || (isLastLeagueMatch && result.knockoutTies.length === 0)) nextLabel = "See Season Results →";

      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Last match result */}
            <div className="bg-gray-800 rounded-xl p-5 text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Season {currentSeason} — {simPhase === "league" ? `Match ${simMatchIndex + 1} of ${result.leagueMatches.length}` : matchJustFinished.opponent}</div>
              <div className={`text-3xl font-bold mb-1 ${
                matchJustFinished.result === "W" ? "text-green-400" :
                matchJustFinished.result === "L" ? "text-red-400" : "text-yellow-400"
              }`}>
                {matchJustFinished.result === "W" ? "Victory!" : matchJustFinished.result === "L" ? "Defeat" : "Draw"}
              </div>
              <div className="text-xl font-mono">
                KNOWITBALL FC&nbsp;
                <span className="font-bold">{matchJustFinished.goalsFor}</span>
                &nbsp;–&nbsp;
                <span className="font-bold">{matchJustFinished.goalsAgainst}</span>
                &nbsp;{matchJustFinished.opponent}
              </div>
              {matchJustFinished.goalScorers.length > 0 && (
                <div className="text-sm text-gray-400 mt-1">
                  ⚽ {matchJustFinished.goalScorers.map(g => `${g.player} ${g.minute}′`).join(", ")}
                </div>
              )}
            </div>

            {/* Standings header */}
            <div className="text-center text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {simPhase === "league" ? `Standings after ${completedLeagueMatches} of ${result.leagueMatches.length} matches` : "Knockout Bracket"}
            </div>

            {/* League table (league phase) */}
            {simPhase === "league" && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-700 text-gray-400 text-xs">
                      <th className="py-1.5 px-1 text-left w-6">#</th>
                      <th className="py-1.5 px-1 text-left">Team</th>
                      <th className="py-1.5 px-1 text-center w-6">P</th>
                      <th className="py-1.5 px-1 text-center w-6">W</th>
                      <th className="py-1.5 px-1 text-center w-6">D</th>
                      <th className="py-1.5 px-1 text-center w-6">L</th>
                      <th className="py-1.5 px-1 text-center w-8">GD</th>
                      <th className="py-1.5 px-1 text-center w-8 font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveTable.map((team, i) => {
                      let rowBg = i < 8 ? "bg-blue-900/20" : i < 24 ? "bg-yellow-900/10" : "bg-red-900/10";
                      if (team.isPlayer) rowBg = "bg-blue-600/30";
                      return (
                        <tr key={team.name} className={`border-t border-gray-700/50 ${rowBg}`}>
                          <td className="py-1 px-1 text-gray-400">{i + 1}</td>
                          <td className={`py-1 px-1 truncate max-w-[130px] ${team.isPlayer ? "font-bold text-blue-400" : ""}`}>{team.name}</td>
                          <td className="py-1 px-1 text-center">{team.played}</td>
                          <td className="py-1 px-1 text-center">{team.won}</td>
                          <td className="py-1 px-1 text-center">{team.drawn}</td>
                          <td className="py-1 px-1 text-center">{team.lost}</td>
                          <td className="py-1 px-1 text-center">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td>
                          <td className="py-1 px-1 text-center font-bold">{team.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 text-xs text-gray-500 flex gap-3">
                  <span><span className="text-blue-400">■</span> R16</span>
                  <span><span className="text-yellow-600">■</span> Playoff</span>
                  <span><span className="text-red-800">■</span> Out</span>
                </div>
              </div>
            )}

            {/* Bracket (knockout phase) */}
            {simPhase === "knockout" && partialBracket && (
              <CLBracket bracket={partialBracket} />
            )}

            {/* Advance button */}
            <div className="text-center pt-2">
              <button
                onClick={handleAdvanceMatch}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors"
              >
                {nextLabel}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Active match viewer ──
    const currentMatch = getCurrentMatch(result);
    if (!currentMatch) {
      setSeasonResult(result);
      setPhase("result");
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <div className="text-sm text-gray-400 mb-1">Season {currentSeason}</div>
            <div className="text-lg font-semibold text-blue-400">
              {simPhase === "league"
                ? `League Phase — Match ${simMatchIndex + 1} of ${result.leagueMatches.length}`
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
                setUpdatedResult(null);
                setMatchJustFinished(null);
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
