"use client";
import { useMemo, useState, useRef } from "react";
import { simulateSeason } from "@/lib/seasonSimulator";
import { getPositionColor, getPositionTextColor } from "./formations";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  players: DraftPlayer[];
  onNewRun: () => void;
}

export default function DraftResult({ players, onNewRun }: Props) {
  const season = useMemo(() => simulateSeason(players), [players]);
  const [showMatches, setShowMatches] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const titleMessage = () => {
    if (season.actualFinish === 1)
      return { title: "CHAMPIONS", sub: "TITLE WON. JOB DONE.", color: "text-green-400" };
    if (season.actualFinish <= 4)
      return { title: "TOP 4", sub: "Champions League secured.", color: "text-blue-400" };
    if (season.actualFinish <= 6)
      return { title: "EUROPE", sub: "European football earned.", color: "text-orange-400" };
    if (season.actualFinish <= 17)
      return { title: "MID-TABLE", sub: "Safe but unremarkable.", color: "text-gray-400" };
    return { title: "RELEGATED", sub: "Down to the Championship.", color: "text-red-400" };
  };

  const msg = titleMessage();

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20" ref={resultRef}>
      {/* Title Badge */}
      <div className="text-center mb-6">
        {season.actualFinish === 1 && (
          <div className="inline-block px-4 py-1 bg-green-600 rounded-full text-sm font-bold mb-3">
            CHAMPIONS
          </div>
        )}
        <div className="flex justify-center gap-4 mb-4">
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center">
            <div className="text-xs text-gray-400">FINISHED</div>
            <div className="text-3xl font-bold">{ordinal(season.actualFinish)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center">
            <div className="text-xs text-gray-400">PROJECTED</div>
            <div className="text-3xl font-bold">{ordinal(season.projectedFinish)}</div>
          </div>
          <div className={`rounded-xl px-4 py-3 flex items-center ${
            season.performance === "OVERPERFORMED" ? "bg-green-900/50 text-green-400" :
            season.performance === "UNDERPERFORMED" ? "bg-red-900/50 text-red-400" :
            "bg-gray-900 text-gray-400"
          }`}>
            <span className="text-sm font-bold">{season.performance}</span>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <h2 className={`text-xl font-bold ${msg.color}`}>{msg.title}</h2>
          <p className="text-gray-400 text-sm">{msg.sub}</p>
        </div>
      </div>

      {/* Your XI */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h3 className="text-sm text-gray-400 font-medium mb-3">YOUR XI</h3>
        <div className="space-y-1">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)}`}>
                {p.assignedPosition}
              </span>
              <span className="flex-1">{p.name}</span>
              <span className="text-gray-500 text-xs">{p.clubYear}</span>
              <span className="font-bold text-green-400 w-6 text-right">{p.overall}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Record */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{season.teamRecord.wins}</div>
          <div className="text-xs text-gray-400">Wins</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">{season.teamRecord.draws}</div>
          <div className="text-xs text-gray-400">Draws</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{season.teamRecord.losses}</div>
          <div className="text-xs text-gray-400">Losses</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{season.teamRecord.points}</div>
          <div className="text-xs text-gray-400">Points</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{season.teamRecord.goalsFor}</div>
          <div className="text-xs text-gray-400">Goals For</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{season.teamRecord.goalsAgainst}</div>
          <div className="text-xs text-gray-400">Goals Against</div>
        </div>
      </div>

      {/* Season Awards */}
      <h3 className="text-sm text-gray-400 font-medium mb-3">SEASON AWARDS</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-xs text-yellow-400 font-medium mb-1">GOLDEN BOOT</div>
          <div className="font-bold">{season.awards.goldenBoot.name}</div>
          <div className="text-green-400 text-sm">{season.awards.goldenBoot.goals} goals</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-xs text-purple-400 font-medium mb-1">PLAYMAKER</div>
          <div className="font-bold">{season.awards.playmaker.name}</div>
          <div className="text-green-400 text-sm">{season.awards.playmaker.assists} assists</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-xs text-blue-400 font-medium mb-1">GOLDEN GLOVE</div>
          <div className="font-bold">{season.awards.goldenGlove.name}</div>
          <div className="text-green-400 text-sm">{season.awards.goldenGlove.cleanSheets} clean sheets</div>
        </div>
        <div className="bg-green-900/50 rounded-xl p-4 border border-green-700/50">
          <div className="text-xs text-green-400 font-medium mb-1">PLAYER OF THE SEASON</div>
          <div className="font-bold">{season.awards.playerOfSeason.name}</div>
          <div className="text-green-400 text-sm">
            {season.awards.playerOfSeason.goals}G &middot; {season.awards.playerOfSeason.assists}A
          </div>
        </div>
      </div>

      {/* Player Stats */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <div className="flex items-center text-xs text-gray-500 mb-2 px-1">
          <span className="w-8"></span>
          <span className="flex-1">PLAYER</span>
          <span className="w-8 text-center">G</span>
          <span className="w-8 text-center">A</span>
          <span className="w-8 text-center">CS</span>
        </div>
        {season.playerStats.map((ps, i) => (
          <div key={i} className="flex items-center text-sm py-1 px-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(ps.assignedPosition)} w-8 text-center`}>
              {ps.assignedPosition}
            </span>
            <span className="flex-1 ml-2">{ps.name}</span>
            <span className={`w-8 text-center font-bold ${ps.goals > 0 ? "text-green-400" : "text-gray-600"}`}>
              {ps.goals > 0 ? ps.goals : "-"}
            </span>
            <span className={`w-8 text-center font-bold ${ps.assists > 0 ? "text-green-400" : "text-gray-600"}`}>
              {ps.assists > 0 ? ps.assists : "-"}
            </span>
            <span className={`w-8 text-center font-bold ${ps.cleanSheets > 0 ? "text-green-400" : "text-gray-600"}`}>
              {ps.cleanSheets > 0 ? ps.cleanSheets : "-"}
            </span>
          </div>
        ))}
      </div>

      {/* Extra stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{season.awards.goldenGlove.cleanSheets}</div>
          <div className="text-xs text-gray-400">Clean Sheets</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{season.longestWinStreak}</div>
          <div className="text-xs text-gray-400">Longest Win Streak</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-900 rounded-xl p-3">
          <div className="text-xs text-gray-500">Biggest Win</div>
          <div className="font-bold text-green-400">
            {season.biggestWin.score} vs {season.biggestWin.opponent}
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-3">
          <div className="text-xs text-gray-500">Highest-Scoring</div>
          <div className="font-bold text-green-400">
            {season.highestScoring.score} vs {season.highestScoring.opponent}
          </div>
        </div>
      </div>

      {/* League Table Toggle */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-4 flex items-center justify-between hover:bg-gray-800 transition"
      >
        <span className="font-medium">FINAL LEAGUE TABLE</span>
        <span className="text-gray-400">{showTable ? "▲" : "▼"}</span>
      </button>

      {showTable && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 overflow-x-auto">
          <div className="flex items-center text-xs text-gray-500 mb-2 px-1">
            <span className="w-6 text-center">#</span>
            <span className="flex-1 ml-2">CLUB</span>
            <span className="w-10 text-right">GD</span>
            <span className="w-10 text-right font-bold">PTS</span>
          </div>
          {season.leagueTable.map((team, i) => (
            <div
              key={team.name}
              className={`flex items-center text-sm py-1.5 px-1 rounded ${
                team.isPlayer ? "bg-green-900/40 font-bold" : ""
              }`}
            >
              <span className="w-6 text-center text-gray-500">{i + 1}</span>
              <span className={`flex-1 ml-2 ${team.isPlayer ? "text-green-400" : ""}`}>
                {team.isPlayer ? "Your XI" : team.name}
              </span>
              <span className={`w-10 text-right ${
                team.goalDifference > 0 ? "text-green-400" : team.goalDifference < 0 ? "text-red-400" : ""
              }`}>
                {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
              </span>
              <span className={`w-10 text-right font-bold ${team.isPlayer ? "text-green-400" : ""}`}>
                {team.points}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Match Results Toggle */}
      <button
        onClick={() => setShowMatches(!showMatches)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-4 flex items-center justify-between hover:bg-gray-800 transition"
      >
        <span className="font-medium">MATCH RESULTS</span>
        <span className="text-gray-400">{showMatches ? "▲" : "▼"}</span>
      </button>

      {showMatches && (
        <div className="space-y-2 mb-6">
          {season.matches.map((match, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 ${
                match.result === "W"
                  ? "bg-gray-900"
                  : match.result === "D"
                    ? "bg-yellow-900/20"
                    : "bg-red-900/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    match.result === "W"
                      ? "bg-green-600"
                      : match.result === "D"
                        ? "bg-yellow-600"
                        : "bg-red-600"
                  }`}
                >
                  {match.result}
                </span>
                <span className="flex-1 font-medium">
                  {match.isHome ? "" : "@ "}{match.opponent}
                </span>
                <span
                  className={`font-bold ${
                    match.result === "W"
                      ? "text-green-400"
                      : match.result === "D"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {match.goalsFor}-{match.goalsAgainst}
                </span>
              </div>
              {match.goalScorers.length > 0 && (
                <div className="text-xs text-gray-400 mt-1 ml-8">
                  ⚽ {match.goalScorers.map((g) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            // TODO: implement share as image
          }}
          className="py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition"
        >
          Share
        </button>
        <button
          onClick={onNewRun}
          className="py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition"
        >
          New Run
        </button>
      </div>
    </div>
  );
}
