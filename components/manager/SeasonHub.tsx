"use client";
import { useMemo } from "react";

export interface LeagueRow {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isPlayer: boolean;
}

export interface Fixture {
  matchweek: number;
  opponent: string;
  isHome: boolean;
  goalsFor?: number;
  goalsAgainst?: number;
  played: boolean;
}

interface Props {
  table: LeagueRow[];
  fixtures: Fixture[];
  matchweek: number;
  budget: number;
  squadAvg: number;
  onPlayNext: () => void;
  onOpenTransfer?: () => void;
}

export default function SeasonHub({ table, fixtures, matchweek, budget, squadAvg, onPlayNext, onOpenTransfer }: Props) {
  const sortedTable = useMemo(() => {
    return [...table].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGd = a.goalsFor - a.goalsAgainst;
      const bGd = b.goalsFor - b.goalsAgainst;
      if (bGd !== aGd) return bGd - aGd;
      return b.goalsFor - a.goalsFor;
    });
  }, [table]);

  const nextFixture = fixtures.find(f => f.matchweek === matchweek);
  const recentResults = fixtures.filter(f => f.played).slice(-5);
  const playerRow = sortedTable.find(r => r.isPlayer);
  const playerPos = playerRow ? sortedTable.indexOf(playerRow) + 1 : 0;

  const isSeasonOver = matchweek > 38;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 pb-32">
      {/* Header */}
      <div className="border-b border-gray-900/50">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">{isSeasonOver ? "Season Complete" : `Matchweek ${matchweek}`}</div>
              <h1 className="text-2xl font-black text-white">Season Hub</h1>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white uppercase tracking-wider">Budget</div>
              <div className="text-lg font-black text-amber-400">£{budget}M</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-900 rounded-lg p-2.5 border border-gray-800/50 text-center">
              <div className="text-[9px] text-white uppercase tracking-wider">Position</div>
              <div className="text-lg font-black text-white">{playerPos > 0 ? `${playerPos}${playerPos === 1 ? "st" : playerPos === 2 ? "nd" : playerPos === 3 ? "rd" : "th"}` : "—"}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2.5 border border-gray-800/50 text-center">
              <div className="text-[9px] text-white uppercase tracking-wider">Points</div>
              <div className="text-lg font-black text-emerald-400">{playerRow?.points ?? 0}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-2.5 border border-gray-800/50 text-center">
              <div className="text-[9px] text-white uppercase tracking-wider">Squad OVR</div>
              <div className="text-lg font-black text-white">{squadAvg}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Form */}
        {recentResults.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Recent Form</h3>
            <div className="flex gap-1.5 flex-wrap">
              {recentResults.map((f, i) => {
                const gf = f.goalsFor ?? 0;
                const ga = f.goalsAgainst ?? 0;
                const result = gf > ga ? "W" : gf < ga ? "L" : "D";
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${
                      result === "W" ? "bg-emerald-900/40 text-emerald-300" :
                      result === "L" ? "bg-red-900/40 text-red-300" :
                      "bg-gray-800 text-white"
                    }`}
                  >
                    <span className="font-black">{result}</span>
                    <span className="opacity-70">{gf}-{ga}</span>
                    <span className="opacity-50">{f.opponent.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* League table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between">
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">Premier League</h3>
            <span className="text-[10px] text-white">{playerRow?.played ?? 0} / 38 played</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-white">
                <tr className="border-b border-gray-800/50">
                  <th className="text-left px-3 py-2 w-8">#</th>
                  <th className="text-left px-2 py-2">Team</th>
                  <th className="text-center px-1.5 py-2 w-8">P</th>
                  <th className="text-center px-1.5 py-2 w-8">W</th>
                  <th className="text-center px-1.5 py-2 w-8">D</th>
                  <th className="text-center px-1.5 py-2 w-8">L</th>
                  <th className="text-center px-1.5 py-2 w-10">GD</th>
                  <th className="text-center px-2 py-2 w-10">Pts</th>
                </tr>
              </thead>
              <tbody>
                {sortedTable.map((row, i) => {
                  const pos = i + 1;
                  const isCl = pos <= 4;
                  const isEl = pos === 5;
                  const isRel = pos >= 18;
                  const gd = row.goalsFor - row.goalsAgainst;
                  return (
                    <tr
                      key={row.name}
                      className={`${row.isPlayer ? "bg-amber-500/10" : "hover:bg-gray-800/30"} border-b border-gray-900/30`}
                    >
                      <td className="px-3 py-2 text-white tabular-nums">
                        <div className="flex items-center gap-1.5">
                          {isCl && <span className="w-0.5 h-3 bg-emerald-400 rounded" />}
                          {isEl && <span className="w-0.5 h-3 bg-blue-400 rounded" />}
                          {isRel && <span className="w-0.5 h-3 bg-red-400 rounded" />}
                          {pos}
                        </div>
                      </td>
                      <td className={`px-2 py-2 truncate max-w-[120px] ${row.isPlayer ? "text-amber-300 font-bold" : "text-white"}`}>
                        {row.name}
                      </td>
                      <td className="text-center text-white tabular-nums">{row.played}</td>
                      <td className="text-center text-white tabular-nums">{row.won}</td>
                      <td className="text-center text-white tabular-nums">{row.drawn}</td>
                      <td className="text-center text-white tabular-nums">{row.lost}</td>
                      <td className={`text-center tabular-nums ${gd > 0 ? "text-emerald-400" : gd < 0 ? "text-red-400" : "text-white"}`}>
                        {gd > 0 ? "+" : ""}{gd}
                      </td>
                      <td className="text-center text-white font-black tabular-nums">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming fixtures preview */}
        {!isSeasonOver && (
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Upcoming Fixtures</h3>
            <div className="space-y-1.5">
              {fixtures.filter(f => !f.played).slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded bg-gray-950/50">
                  <span className="text-[10px] font-bold text-white w-8">MW{f.matchweek}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.isHome ? "bg-emerald-900/40 text-emerald-300" : "bg-blue-900/40 text-blue-300"}`}>
                    {f.isHome ? "H" : "A"}
                  </span>
                  <span className="text-white flex-1 truncate">{f.opponent}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {onOpenTransfer && !isSeasonOver && (
            <button
              onClick={onOpenTransfer}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-amber-700/40 text-amber-300 font-bold py-3 rounded-xl text-sm transition-all"
            >
              🔄 Transfer Window
            </button>
          )}
          {!isSeasonOver && nextFixture && (
            <button
              onClick={onPlayNext}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-black font-black py-4 rounded-xl transition-all shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]"
            >
              ▶ Play MW{matchweek} — {nextFixture.isHome ? "vs" : "@"} {nextFixture.opponent}
            </button>
          )}
          {isSeasonOver && (
            <button
              onClick={onPlayNext}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black py-4 rounded-xl transition-all"
            >
              View Season Summary →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
