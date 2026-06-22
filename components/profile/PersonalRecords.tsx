"use client";

import { useState, useEffect } from "react";

interface PersonalRecord {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  seasonNumber: number | null;
}

const RECORD_TYPES: { key: string; label: string; emoji: string; isTeam: boolean }[] = [
  { key: "wins",         label: "Most Wins",         emoji: "🏆", isTeam: true },
  { key: "goals",        label: "Most Goals",        emoji: "⚽", isTeam: false },
  { key: "assists",      label: "Most Assists",      emoji: "🎯", isTeam: false },
  { key: "clean_sheets", label: "Most Clean Sheets",  emoji: "🧤", isTeam: false },
  { key: "unbeaten",     label: "Longest Unbeaten",   emoji: "🛡️", isTeam: true },
];

export default function PersonalRecords() {
  const [competition, setCompetition] = useState<"pl" | "all">("pl");
  const [records, setRecords] = useState<Record<string, PersonalRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/draft/records?personal=true")
      .then(r => r.json())
      .then(d => setRecords(d.personal ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasAny = RECORD_TYPES.some(rt => records[`${competition}_${rt.key}`]);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),inset_0_0_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">
          Personal Bests
        </h3>
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setCompetition("pl")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
              competition === "pl"
                ? "bg-purple-600 text-white"
                : "text-white hover:text-gray-300"
            }`}
          >
            PL
          </button>
          <button
            onClick={() => setCompetition("all")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
              competition === "all"
                ? "bg-purple-600 text-white"
                : "text-white hover:text-gray-300"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasAny ? (
        <p className="text-center text-white text-xs py-4">
          Play a draft season to set your records!
        </p>
      ) : (
        <div className="space-y-2">
          {RECORD_TYPES.map(rt => {
            const key = `${competition}_${rt.key}`;
            const rec = records[key];
            if (!rec) return (
              <div key={rt.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/30 border border-gray-800/30">
                <span className="text-base">{rt.emoji}</span>
                <span className="flex-1 text-xs font-bold text-white">{rt.label}</span>
                <span className="text-sm font-black text-white">—</span>
              </div>
            );
            return (
              <div key={rt.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/40 border border-gray-700/30">
                <span className="text-base">{rt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white">{rt.label}</div>
                  {!rt.isTeam && rec.playerName && (
                    <div className="text-[10px] text-white truncate">
                      {rec.playerName}
                      {rec.playerOvr !== null && (
                        <span className="ml-1 text-emerald-500/70">{rec.playerOvr} OVR</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xl font-black text-amber-400 tabular-nums">
                  {rec.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
