"use client";
import { useState } from "react";
import type { CLSeasonResult, CLMatchResult, CLKnockoutTie, CLLeagueStanding, CLPlayerStats } from "@/lib/clSimulator";
import CLMatchViewer from "./CLMatchViewer";

interface Props {
  result: CLSeasonResult;
  seasonNumber: number;
  totalSeasons: number;
  onPlayNextSeason?: () => void;
  onFinish?: () => void;
}

type ViewTab = "overview" | "league" | "knockout" | "stats" | "replay";

export default function CLSeasonView({ result, seasonNumber, totalSeasons, onPlayNextSeason, onFinish }: Props) {
  const [tab, setTab] = useState<ViewTab>("overview");
  const [replayMatch, setReplayMatch] = useState<{ match: CLMatchResult; tie?: CLKnockoutTie; leg?: 1 | 2 } | null>(null);

  if (replayMatch) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <CLMatchViewer
          match={replayMatch.match}
          knockoutTie={replayMatch.tie}
          legNumber={replayMatch.leg}
          onFinished={() => setReplayMatch(null)}
        />
      </div>
    );
  }

  const tabs: { id: ViewTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "league", label: "League Table" },
    { id: "knockout", label: "Knockout" },
    { id: "stats", label: "Player Stats" },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Season {seasonNumber} Results</h1>
          <div className="mt-2">
            {result.winner ? (
              <div className="text-2xl font-bold text-yellow-400">🏆 Champions League Winners! 🏆</div>
            ) : result.exitStage ? (
              <div className="text-lg text-red-400">Eliminated: {result.exitStage}</div>
            ) : (
              <div className="text-lg text-gray-400">League Position: {result.leaguePosition}</div>
            )}
          </div>
          {!result.winner && (
            <div className="text-sm text-gray-500 mt-1">
              Tournament winner: {result.tournamentWinner}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* League phase summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3">League Phase — Position {result.leaguePosition}</h3>
              <div className="space-y-2">
                {result.leagueMatches.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setReplayMatch({ match: m })}
                    className="w-full flex items-center justify-between bg-gray-700/50 hover:bg-gray-700 rounded p-2 text-sm transition-colors"
                  >
                    <span className="text-gray-400 w-6 text-center">{m.isHome ? "H" : "A"}</span>
                    <span className="flex-1 text-left ml-2">{m.opponent}</span>
                    <span className={`font-mono font-bold ${
                      m.result === "W" ? "text-green-400" : m.result === "L" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {m.goalsFor} - {m.goalsAgainst}
                    </span>
                    <span className={`ml-2 w-6 text-center font-bold ${
                      m.result === "W" ? "text-green-400" : m.result === "L" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {m.result}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">▶</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Knockout results */}
            {result.knockoutTies.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Knockout Stage</h3>
                <div className="space-y-3">
                  {result.knockoutTies.map((tie, i) => (
                    <div key={i} className="bg-gray-700/50 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-400 uppercase font-semibold">{tie.round}</span>
                        <span className={`text-sm font-bold ${tie.result === "W" ? "text-green-400" : "text-red-400"}`}>
                          {tie.result === "W" ? "Advanced" : "Eliminated"}
                        </span>
                      </div>
                      <div className="text-sm">vs {tie.opponent}</div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setReplayMatch({ match: tie.leg1, tie, leg: tie.leg2 ? 1 : undefined })}
                          className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors"
                        >
                          {tie.leg2 ? "Leg 1" : "Match"}: {tie.leg1.goalsFor}-{tie.leg1.goalsAgainst}
                          {tie.leg1.penalties && tie.leg1.penaltyScore ? ` (${tie.leg1.penaltyScore.player}-${tie.leg1.penaltyScore.opponent} pens)` : ""}
                          {tie.leg1.extraTime && !tie.leg1.penalties ? " (AET)" : ""}
                          {" ▶"}
                        </button>
                        {tie.leg2 && (
                          <button
                            onClick={() => setReplayMatch({ match: tie.leg2!, tie, leg: 2 })}
                            className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors"
                          >
                            Leg 2: {tie.leg2.goalsFor}-{tie.leg2.goalsAgainst}
                            {tie.leg2.penalties && tie.leg2.penaltyScore ? ` (${tie.leg2.penaltyScore.player}-${tie.leg2.penaltyScore.opponent} pens)` : ""}
                            {tie.leg2.extraTime && !tie.leg2.penalties ? " (AET)" : ""}
                            {" ▶"}
                          </button>
                        )}
                      </div>
                      {tie.leg2 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Aggregate: {tie.aggFor} - {tie.aggAgainst}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* League table tab */}
        {tab === "league" && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700 text-gray-400 text-xs">
                  <th className="py-2 px-2 text-left w-8">#</th>
                  <th className="py-2 px-2 text-left">Team</th>
                  <th className="py-2 px-1 text-center w-8">P</th>
                  <th className="py-2 px-1 text-center w-8">W</th>
                  <th className="py-2 px-1 text-center w-8">D</th>
                  <th className="py-2 px-1 text-center w-8">L</th>
                  <th className="py-2 px-1 text-center w-10">GF</th>
                  <th className="py-2 px-1 text-center w-10">GA</th>
                  <th className="py-2 px-1 text-center w-10">GD</th>
                  <th className="py-2 px-2 text-center w-10 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {result.leagueTable.map((team: CLLeagueStanding, i: number) => {
                  let rowBg = "";
                  if (i < 8) rowBg = "bg-blue-900/20";
                  else if (i < 24) rowBg = "bg-yellow-900/10";
                  else rowBg = "bg-red-900/10";
                  if (team.isPlayer) rowBg = "bg-blue-600/30";

                  return (
                    <tr key={team.name} className={`border-t border-gray-700/50 ${rowBg}`}>
                      <td className="py-1.5 px-2 text-gray-400">{i + 1}</td>
                      <td className={`py-1.5 px-2 ${team.isPlayer ? "font-bold text-blue-400" : ""}`}>{team.name}</td>
                      <td className="py-1.5 px-1 text-center">{team.played}</td>
                      <td className="py-1.5 px-1 text-center">{team.won}</td>
                      <td className="py-1.5 px-1 text-center">{team.drawn}</td>
                      <td className="py-1.5 px-1 text-center">{team.lost}</td>
                      <td className="py-1.5 px-1 text-center">{team.goalsFor}</td>
                      <td className="py-1.5 px-1 text-center">{team.goalsAgainst}</td>
                      <td className="py-1.5 px-1 text-center">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td>
                      <td className="py-1.5 px-2 text-center font-bold">{team.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 text-xs text-gray-500 flex gap-4">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900/40 inline-block" /> Top 8 — Round of 16</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-900/30 inline-block" /> 9-24 — Playoff Round</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/30 inline-block" /> 25-36 — Eliminated</span>
            </div>
          </div>
        )}

        {/* Knockout tab */}
        {tab === "knockout" && (
          <div className="space-y-4">
            {result.knockoutTies.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                {result.leaguePosition > 24
                  ? "Eliminated in the league phase"
                  : "No knockout matches played"}
              </div>
            ) : (
              result.knockoutTies.map((tie, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-blue-400">{tie.round}</h3>
                    <span className={`text-sm px-2 py-0.5 rounded ${tie.result === "W" ? "bg-green-600/30 text-green-400" : "bg-red-600/30 text-red-400"}`}>
                      {tie.result === "W" ? "Won" : "Lost"}
                    </span>
                  </div>
                  <div className="text-lg font-bold mb-2">KNOWITBALL FC vs {tie.opponent}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MatchCard
                      label={tie.leg2 ? "Leg 1" : "Match"}
                      match={tie.leg1}
                      onReplay={() => setReplayMatch({ match: tie.leg1, tie, leg: tie.leg2 ? 1 : undefined })}
                    />
                    {tie.leg2 && (
                      <MatchCard
                        label="Leg 2"
                        match={tie.leg2}
                        onReplay={() => setReplayMatch({ match: tie.leg2!, tie, leg: 2 })}
                      />
                    )}
                  </div>
                  {tie.leg2 && (
                    <div className="mt-2 text-sm text-gray-400">
                      Aggregate: <span className="text-white font-bold">{tie.aggFor} - {tie.aggAgainst}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stats tab */}
        {tab === "stats" && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700 text-gray-400 text-xs">
                  <th className="py-2 px-2 text-left">Player</th>
                  <th className="py-2 px-1 text-center w-10">Pos</th>
                  <th className="py-2 px-1 text-center w-10">Apps</th>
                  <th className="py-2 px-1 text-center w-10">⚽</th>
                  <th className="py-2 px-1 text-center w-10">🅰️</th>
                  <th className="py-2 px-1 text-center w-10">CS</th>
                  <th className="py-2 px-1 text-center w-12">Rating</th>
                </tr>
              </thead>
              <tbody>
                {result.playerStats
                  .sort((a: CLPlayerStats, b: CLPlayerStats) => b.avgRating - a.avgRating)
                  .map((ps: CLPlayerStats) => (
                    <tr key={ps.name} className="border-t border-gray-700/50">
                      <td className="py-1.5 px-2 font-semibold">{ps.name}</td>
                      <td className="py-1.5 px-1 text-center text-gray-400">{ps.assignedPosition}</td>
                      <td className="py-1.5 px-1 text-center">{ps.appearances}</td>
                      <td className="py-1.5 px-1 text-center">{ps.goals || "-"}</td>
                      <td className="py-1.5 px-1 text-center">{ps.assists || "-"}</td>
                      <td className="py-1.5 px-1 text-center">{ps.cleanSheets || "-"}</td>
                      <td className={`py-1.5 px-1 text-center font-bold ${
                        ps.avgRating >= 8 ? "text-green-400" : ps.avgRating >= 7 ? "text-yellow-400" : ps.avgRating >= 6 ? "text-orange-400" : "text-red-400"
                      }`}>
                        {ps.avgRating.toFixed(1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-4 pt-4">
          {seasonNumber < totalSeasons && onPlayNextSeason && (
            <button
              onClick={onPlayNextSeason}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors"
            >
              Play Season {seasonNumber + 1} →
            </button>
          )}
          {(seasonNumber >= totalSeasons || !onPlayNextSeason) && onFinish && (
            <button
              onClick={onFinish}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition-colors"
            >
              Finish Career
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ label, match, onReplay }: { label: string; match: CLMatchResult; onReplay: () => void }) {
  return (
    <button onClick={onReplay} className="bg-gray-700/50 hover:bg-gray-700 rounded p-3 text-left transition-colors w-full">
      <div className="text-xs text-gray-400 mb-1">{label} {match.isHome ? "(Home)" : "(Away)"}</div>
      <div className="text-lg font-mono font-bold">
        <span className={match.goalsFor > match.goalsAgainst ? "text-green-400" : match.goalsFor < match.goalsAgainst ? "text-red-400" : "text-yellow-400"}>
          {match.goalsFor}
        </span>
        {" - "}
        <span>{match.goalsAgainst}</span>
      </div>
      {match.extraTime && <span className="text-xs text-gray-500">AET</span>}
      {match.penalties && match.penaltyScore && (
        <span className="text-xs text-gray-500 ml-1">({match.penaltyScore.player}-{match.penaltyScore.opponent} pens)</span>
      )}
      {match.goalScorers.length > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          ⚽ {match.goalScorers.map(g => `${g.player} ${g.minute}'`).join(", ")}
        </div>
      )}
      <div className="text-xs text-blue-400 mt-1">Watch replay ▶</div>
    </button>
  );
}
