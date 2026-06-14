"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadDraftHistory } from "@/components/draft/DraftResult";
import type { DraftRunRecord } from "@/components/draft/DraftResult";
import { getPositionColor } from "@/components/draft/formations";

export default function DraftHistoryPage() {
  const [history, setHistory] = useState<DraftRunRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadDraftHistory());
  }, []);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const seasons = history.length;
    const bestPoints = Math.max(...history.map(h => h.points));
    const bestRecord = history.reduce((best, h) =>
      h.record.wins > best.record.wins ? h : best, history[0]);
    const totalWins = history.reduce((s, h) => s + h.record.wins, 0);
    const totalMatches = history.reduce((s, h) => s + h.record.wins + h.record.draws + h.record.losses, 0);
    const winRate = Math.round((totalWins / totalMatches) * 100);
    const mostGoals = Math.max(...history.map(h => h.goalsFor));
    const topOvr = Math.max(...history.map(h => h.avgOvr));
    const titles = history.filter(h => h.finish === 1).length;

    return { seasons, bestPoints, bestRecord, winRate, mostGoals, topOvr, titles };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <Link href="/draft" className="text-sm text-gray-500 hover:text-white transition mb-4 inline-block">
          &larr; Back to Draft
        </Link>
        <h1 className="text-3xl font-black mb-2">Your Draft History</h1>
        <p className="text-gray-500">No completed runs yet. Play a draft to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <Link href="/draft" className="text-sm text-gray-500 hover:text-white transition mb-4 inline-block">
        &larr; Back to Draft
      </Link>
      <h1 className="text-3xl font-black mb-1">Your Draft History</h1>
      <p className="text-gray-500 text-sm mb-6">Your seasons, records, and stats.</p>

      {stats && (
        <>
          {/* Aggregate stats */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.seasons}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Seasons</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.bestPoints}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Best Points</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.bestRecord.record.wins}W {stats.bestRecord.record.draws}D {stats.bestRecord.record.losses}L</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Best Record</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.winRate}%</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Win Rate</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.mostGoals}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Most Goals</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.topOvr}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">Top-rated XI</div>
            </div>
          </div>

          {/* Trophy summary */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${
              stats.titles > 0
                ? "bg-yellow-900/20 border-yellow-700/40"
                : "bg-gray-900 border-gray-800/50 opacity-50"
            }`}>
              <span className="text-xl">&#127942;</span>
              <div>
                <div className="font-bold text-sm">Champions</div>
                <div className="text-[10px] text-gray-500">Finish 1st</div>
              </div>
              {stats.titles > 0 && (
                <span className="ml-auto text-xs font-black text-yellow-400">&times;{stats.titles}</span>
              )}
            </div>
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${
              history.some(h => h.finish <= 4)
                ? "bg-blue-900/20 border-blue-700/40"
                : "bg-gray-900 border-gray-800/50 opacity-50"
            }`}>
              <span className="text-xl">&#11088;</span>
              <div>
                <div className="font-bold text-sm">Top Four</div>
                <div className="text-[10px] text-gray-500">Finish in the top 4</div>
              </div>
              {history.filter(h => h.finish <= 4).length > 0 && (
                <span className="ml-auto text-xs font-black text-blue-400">&times;{history.filter(h => h.finish <= 4).length}</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Recent runs */}
      <h2 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">Recent Runs</h2>
      <p className="text-[10px] text-gray-600 mb-3">Tap a run to see the XI you fielded.</p>

      <div className="space-y-2">
        {history.map((run) => {
          const isExpanded = expandedId === run.id;
          const finishColor =
            run.finish === 1 ? "text-yellow-400" :
            run.finish <= 4 ? "text-blue-400" :
            run.finish <= 6 ? "text-emerald-400" :
            run.finish >= 18 ? "text-red-400" : "text-white";

          return (
            <div key={run.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : run.id)}
                className="w-full bg-gray-900 rounded-xl p-4 border border-gray-800/50 hover:bg-gray-800/80 transition text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-black ${finishColor}`}>{run.points} pts</span>
                    <span className="text-gray-500 text-sm">&middot; {ordinal(run.finish)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.finish === 1 && <span className="text-yellow-400">&#127942;</span>}
                    {run.finish <= 4 && run.finish > 1 && <span className="text-blue-400">&#11088;</span>}
                    <span className="text-[10px] text-gray-600">
                      {new Date(run.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Won {run.record.wins} &middot; Drew {run.record.draws} &middot; Lost {run.record.losses}
                  &middot; Scored {run.goalsFor} &middot; Conceded {run.goalsAgainst}
                  {run.formation ? ` &middot; ${run.formation}` : ""}
                </div>
              </button>

              {isExpanded && (
                <div className="bg-gray-900/50 rounded-b-xl px-4 pb-4 pt-2 border-x border-b border-gray-800/50 -mt-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {run.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-7 text-center`}>
                          {p.assignedPosition}
                        </span>
                        <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
