"use client";
import { useMemo, useState, useRef, useCallback } from "react";
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
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const titleMessage = () => {
    if (season.actualFinish === 1)
      return { title: "CHAMPIONS", sub: "TITLE WON. JOB DONE.", color: "text-emerald-400" };
    if (season.actualFinish <= 4)
      return { title: "TOP 4", sub: "Champions League secured.", color: "text-blue-400" };
    if (season.actualFinish <= 6)
      return { title: "EUROPE", sub: "European football earned.", color: "text-orange-400" };
    if (season.actualFinish <= 17)
      return { title: "MID-TABLE", sub: "Safe but unremarkable.", color: "text-gray-400" };
    return { title: "RELEGATED", sub: "Down to the Championship.", color: "text-red-400" };
  };

  const msg = titleMessage();

  const positionOrder: Record<string, number> = { GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, SW: 1, CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RAM: 6, LAM: 6, RW: 8, LW: 8, ST: 9, CF: 9 };
  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => (positionOrder[a.assignedPosition] ?? 5) - (positionOrder[b.assignedPosition] ?? 5)),
    [players]
  );

  const sortedStats = useMemo(() =>
    [...season.playerStats].sort((a, b) => (positionOrder[a.assignedPosition] ?? 5) - (positionOrder[b.assignedPosition] ?? 5)),
    [season.playerStats]
  );

  const handleShare = useCallback(async () => {
    if (!shareRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#030712",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `pl-draft-${ordinal(season.actualFinish)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
      const text = `PL Draft: Finished ${ordinal(season.actualFinish)} with ${season.teamRecord.points}pts (${avgOvr} avg OVR) — ${season.performance.toLowerCase()}! 🏆`;
      const url = typeof window !== "undefined" ? window.location.href : "";
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank"
      );
    } catch (err) {
      console.error("Share screenshot failed:", err);
    } finally {
      setSharing(false);
    }
  }, [sharing, season.actualFinish, season.teamRecord.points, season.performance, players]);

  const getLeaguePositionStyle = (pos: number, isPlayer: boolean) => {
    if (isPlayer) return "";
    if (pos === 1) return "border-l-2 border-l-yellow-500";
    if (pos <= 4) return "border-l-2 border-l-blue-500";
    if (pos <= 6) return "border-l-2 border-l-emerald-500";
    if (pos >= 18) return "border-l-2 border-l-red-500";
    return "";
  };

  const getLeaguePositionBadge = (pos: number) => {
    if (pos === 1) return "bg-yellow-500/20 text-yellow-400";
    if (pos <= 4) return "bg-blue-500/20 text-blue-400";
    if (pos <= 6) return "bg-emerald-500/20 text-emerald-400";
    if (pos >= 18) return "bg-red-500/20 text-red-400";
    return "text-gray-500";
  };

  // Group matches into matchweeks (2 matches per week for a 38-match season against 19 opponents)
  const matchweeks = useMemo(() => {
    const weeks: { week: number; matches: typeof season.matches }[] = [];
    for (let i = 0; i < season.matches.length; i++) {
      weeks.push({ week: i + 1, matches: [season.matches[i]] });
    }
    return weeks;
  }, [season.matches]);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      {/* Shareable area */}
      <div ref={shareRef} className="bg-gray-950 pb-4">
        {/* Champion / Relegated Banner */}
        {(season.actualFinish === 1 || season.actualFinish >= 18) && (
          <div className={`relative overflow-hidden rounded-xl mb-6 py-8 px-4 text-center ${
            season.actualFinish === 1
              ? "bg-gradient-to-r from-yellow-900/40 via-yellow-600/20 to-yellow-900/40 border border-yellow-600/40"
              : "bg-gradient-to-r from-red-900/40 via-red-600/20 to-red-900/40 border border-red-600/40"
          }`}>
            {/* Glow effect */}
            <div className={`absolute inset-0 ${
              season.actualFinish === 1
                ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent"
                : "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            }`} />
            <div className="relative">
              {season.actualFinish === 1 && (
                <div className="text-3xl mb-2">&#9733;</div>
              )}
              <h1 className={`text-4xl font-black tracking-tighter ${
                season.actualFinish === 1 ? "text-yellow-400" : "text-red-400"
              }`}>
                {season.actualFinish === 1 ? "CHAMPIONS" : "RELEGATED"}
              </h1>
              <p className={`text-sm font-medium mt-1 ${
                season.actualFinish === 1 ? "text-yellow-500/70" : "text-red-500/70"
              }`}>
                {season.actualFinish === 1 ? "Premier League Title Winners" : "Dropped to the Championship"}
              </p>
            </div>
          </div>
        )}

        {/* Finish Cards */}
        <div className="flex justify-center gap-3 mb-4">
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Finished</div>
            <div className={`text-3xl font-black ${
              season.actualFinish === 1 ? "text-yellow-400" :
              season.actualFinish <= 4 ? "text-blue-400" :
              season.actualFinish <= 6 ? "text-emerald-400" :
              season.actualFinish >= 18 ? "text-red-400" : "text-white"
            }`}>{ordinal(season.actualFinish)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Projected</div>
            <div className="text-3xl font-black text-gray-300">{ordinal(season.projectedFinish)}</div>
          </div>
          <div className={`rounded-xl px-4 py-3 flex items-center border ${
            season.performance === "OVERPERFORMED"
              ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/40"
              : season.performance === "UNDERPERFORMED"
                ? "bg-red-900/30 text-red-400 border-red-700/40"
                : "bg-gray-900 text-gray-400 border-gray-800/50"
          }`}>
            <span className="text-xs font-bold tracking-wide">{season.performance}</span>
          </div>
        </div>

        {/* Title message (only when no big banner) */}
        {season.actualFinish > 1 && season.actualFinish < 18 && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-center border border-gray-800/50">
            <h2 className={`text-xl font-black ${msg.color}`}>{msg.title}</h2>
            <p className="text-gray-500 text-sm">{msg.sub}</p>
          </div>
        )}

        {/* Your XI */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            Your XI
          </h3>
          <div className="space-y-0.5">
            {sortedPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 px-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-gray-500">
            <span>Average OVR</span>
            <span className="font-bold text-white">
              {Math.round(players.reduce((acc, p) => acc + p.overall, 0) / players.length)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>Team Strength</span>
            <span className="font-bold text-emerald-400">
              {Math.round(season.phaseRatings.teamStrength)}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-gray-600 justify-end">
            <span>ATK {Math.round(season.phaseRatings.attack)}</span>
            <span>MID {Math.round(season.phaseRatings.midfield)}</span>
            <span>DEF {Math.round(season.phaseRatings.defense)}</span>
            <span>GK {Math.round(season.phaseRatings.gk)}</span>
          </div>
        </div>

        {/* Record */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-emerald-400">{season.teamRecord.wins}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Wins</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-yellow-400">{season.teamRecord.draws}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Draws</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-red-400">{season.teamRecord.losses}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Losses</div>
          </div>
        </div>

        {/* Form Guide */}
        <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800/50">
          <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Form</div>
          <div className="flex gap-[3px] flex-wrap">
            {season.matches.map((m, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${
                  m.result === "W"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : m.result === "D"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }`}
                title={`MW${i + 1}: ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent}`}
              >
                {m.result}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-white">{season.teamRecord.points}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Points</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-emerald-400">{season.teamRecord.goalsFor}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Goals For</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-red-400">{season.teamRecord.goalsAgainst}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Goals Against</div>
          </div>
        </div>

        {/* FA Cup */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#127942;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">FA Cup</h3>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
              season.faCup.winner
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {season.faCup.winner ? "WINNER" : `Out: ${season.faCup.exitRound}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {season.faCup.matches.map((m, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${
                  m.result === "W" ? "bg-emerald-900/20" : "bg-red-900/20"
                }`}
              >
                <span className="text-[10px] font-bold text-gray-500 w-20 shrink-0">{m.round}</span>
                <span className="flex-1 font-medium truncate">{m.opponent}</span>
                <span className={`font-black tabular-nums ${m.result === "W" ? "text-emerald-400" : "text-red-400"}`}>
                  {m.goalsFor}-{m.goalsAgainst}
                </span>
                {m.extraTime && !m.penalties && (
                  <span className="text-[9px] font-bold text-yellow-400/70 bg-yellow-500/10 px-1 py-0.5 rounded">AET</span>
                )}
                {m.penalties && m.penaltyScore && (
                  <span className="text-[9px] font-bold text-purple-400/70 bg-purple-500/10 px-1 py-0.5 rounded">
                    PEN {m.penaltyScore.player}-{m.penaltyScore.opponent}
                  </span>
                )}
              </div>
            ))}
          </div>
          {season.faCup.matches.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-800/50 flex gap-4 text-[10px] text-gray-600">
              <span>
                Goals: {season.faCup.matches.reduce((s, m) => s + m.goalsFor, 0)}
              </span>
              <span>
                Conceded: {season.faCup.matches.reduce((s, m) => s + m.goalsAgainst, 0)}
              </span>
            </div>
          )}
        </div>

        {/* Season Awards */}
        <div className="mb-6">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            Season Awards
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-yellow-400 text-xs">&#9917;</span>
                <span className="text-[10px] font-bold tracking-widest text-yellow-400 uppercase">Golden Boot</span>
              </div>
              <div className="font-bold text-sm">{season.awards.goldenBoot.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.goldenBoot.goals} goals</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-purple-400 text-xs">&#127919;</span>
                <span className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">Playmaker</span>
              </div>
              <div className="font-bold text-sm">{season.awards.playmaker.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.playmaker.assists} assists</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-blue-400 text-xs">&#129351;</span>
                <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Golden Glove</span>
              </div>
              <div className="font-bold text-sm">{season.awards.goldenGlove.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.goldenGlove.cleanSheets} clean sheets</div>
            </div>
            <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-700/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-emerald-400 text-xs">&#11088;</span>
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Player of Season</span>
              </div>
              <div className="font-bold text-sm">{season.awards.playerOfSeason.name}</div>
              <div className="text-emerald-400 text-sm font-bold">
                {season.awards.playerOfSeason.goals}G &middot; {season.awards.playerOfSeason.assists}A
              </div>
            </div>
          </div>
        </div>

        {/* Player Stats */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            Squad Stats
          </h3>
          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-8"></span>
            <span className="flex-1 ml-2">Player</span>
            <span className="w-8 text-center">G</span>
            <span className="w-8 text-center">A</span>
            <span className="w-8 text-center">CS</span>
            <span className="w-9 text-center">AVG</span>
          </div>
          <div className="space-y-0.5">
            {sortedStats.map((ps, i) => (
              <div key={i} className="flex items-center text-sm py-1.5 px-1 rounded hover:bg-gray-800/50 transition">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(ps.assignedPosition)} text-white w-8 text-center`}>
                  {ps.assignedPosition}
                </span>
                <span className="flex-1 ml-2 font-medium">{ps.name}</span>
                <span className={`w-8 text-center font-bold ${ps.goals > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.goals > 0 ? ps.goals : "-"}
                </span>
                <span className={`w-8 text-center font-bold ${ps.assists > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.assists > 0 ? ps.assists : "-"}
                </span>
                <span className={`w-8 text-center font-bold ${ps.cleanSheets > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.cleanSheets > 0 ? ps.cleanSheets : "-"}
                </span>
                <span className={`w-9 text-center text-xs font-bold ${
                  ps.avgRating >= 7.5 ? "text-emerald-400" :
                  ps.avgRating >= 7.0 ? "text-yellow-400" :
                  ps.avgRating >= 6.5 ? "text-orange-400" : "text-gray-500"
                }`}>
                  {ps.avgRating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Extra stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.awards.goldenGlove.cleanSheets}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Clean Sheets</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.longestWinStreak}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Win Streak</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.longestUnbeatenRun}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Unbeaten Run</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Biggest Win</div>
            <div className="font-bold text-emerald-400 text-sm mt-0.5">
              {season.teamRecord.wins > 0
                ? <>{season.biggestWin.score} vs {season.biggestWin.opponent}</>
                : <span className="text-gray-600">No wins</span>
              }
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Worst Defeat</div>
            <div className="font-bold text-red-400 text-sm mt-0.5">
              {season.teamRecord.losses > 0
                ? <>{season.worstDefeat.score} vs {season.worstDefeat.opponent}</>
                : <span className="text-emerald-400">Undefeated!</span>
              }
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Highest Scoring</div>
            <div className="font-bold text-emerald-400 text-sm mt-0.5">
              {season.highestScoring.score} vs {season.highestScoring.opponent}
            </div>
          </div>
        </div>
      </div>

      {/* League Table Toggle */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Final League Table</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {showTable && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 overflow-x-auto border border-gray-800/50">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-gray-500">Champion</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-500">Champions League</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-500">Europa League</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-500">Relegation</span>
            </div>
          </div>

          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-7 text-center">#</span>
            <span className="flex-1 ml-2">Club</span>
            <span className="w-8 text-center">P</span>
            <span className="w-8 text-center">W</span>
            <span className="w-8 text-center">D</span>
            <span className="w-8 text-center">L</span>
            <span className="w-10 text-right">GD</span>
            <span className="w-10 text-right">PTS</span>
          </div>
          <div className="space-y-0.5">
            {season.leagueTable.map((team, i) => {
              const pos = i + 1;
              return (
                <div
                  key={team.name}
                  className={`flex items-center text-sm py-1.5 px-1 rounded transition ${
                    team.isPlayer
                      ? "bg-emerald-900/30 border border-emerald-700/30 font-bold"
                      : `hover:bg-gray-800/50 ${getLeaguePositionStyle(pos, team.isPlayer)}`
                  }`}
                >
                  <span className={`w-7 text-center text-xs font-bold rounded ${getLeaguePositionBadge(pos)}`}>
                    {pos}
                  </span>
                  <span className={`flex-1 ml-2 ${team.isPlayer ? "text-emerald-400 font-bold" : "text-gray-300"}`}>
                    {team.isPlayer ? "Your XI" : team.name}
                  </span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.played}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.won}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.drawn}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.lost}</span>
                  <span className={`w-10 text-right text-xs font-bold ${
                    team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-gray-500"
                  }`}>
                    {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                  </span>
                  <span className={`w-10 text-right font-black ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>
                    {team.points}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Results Toggle */}
      <button
        onClick={() => setShowMatches(!showMatches)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Match Results</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showMatches ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {showMatches && (
        <div className="space-y-1 mb-6">
          {matchweeks.map(({ week, matches }) => (
            <div key={week}>
              {/* Matchweek header */}
              <div className="flex items-center gap-2 py-2 px-1">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">
                  MW {week} / 38
                </span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              {matches.map((match, mi) => (
                <div
                  key={mi}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-900/80 border border-gray-800/50 hover:bg-gray-800/60 transition"
                >
                  {/* Result badge */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                    match.result === "W"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : match.result === "D"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    {match.result}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      <span className="text-gray-500 text-xs mr-1.5">
                        {match.isHome ? "H" : "A"}
                      </span>
                      {match.opponent}
                    </div>
                    {match.goalScorers.length > 0 && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {match.goalScorers.map((g) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className={`text-lg font-black tabular-nums ${
                    match.result === "W"
                      ? "text-emerald-400"
                      : match.result === "D"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}>
                    {match.goalsFor}-{match.goalsAgainst}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sharing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Share Season
            </>
          )}
        </button>
        <button
          onClick={onNewRun}
          className="py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          New Run
        </button>
      </div>
    </div>
  );
}
