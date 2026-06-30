"use client";

import { useState, useEffect } from "react";

interface PersonalRecord {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  seasonNumber: number | null;
}

const SEASON_RECORD_TYPES: { key: string; label: string; emoji: string; isTeam: boolean; ascending?: boolean; isDecimal?: boolean }[] = [
  { key: "most_points",    label: "Most Points",           emoji: "📊", isTeam: true },
  { key: "wins",           label: "Most Wins",             emoji: "🏆", isTeam: true },
  { key: "goals",          label: "Most Goals",            emoji: "⚽", isTeam: false },
  { key: "assists",        label: "Most Assists",          emoji: "🎯", isTeam: false },
  { key: "clean_sheets",   label: "Most Clean Sheets",     emoji: "🧤", isTeam: false },
  { key: "goals_conceded", label: "Fewest Goals Conceded", emoji: "🔒", isTeam: true, ascending: true },
  { key: "unbeaten",       label: "Longest Unbeaten",      emoji: "🛡️", isTeam: true },
  { key: "biggest_win",    label: "Biggest Win",           emoji: "💥", isTeam: true },
  { key: "avg_rating",     label: "Best Player Rating",    emoji: "⭐", isTeam: false, isDecimal: true },
];

const CAREER_RECORD_TYPES: { key: string; label: string; emoji: string; isTeam: boolean; isDecimal?: boolean }[] = [
  { key: "career_goals",      label: "Career Goals",        emoji: "⚽", isTeam: false },
  { key: "career_assists",    label: "Career Assists",      emoji: "🎯", isTeam: false },
  { key: "career_trophies",   label: "Career Trophies",     emoji: "🏅", isTeam: true },
  { key: "career_avg_rating", label: "Career Avg Rating",   emoji: "⭐", isTeam: false, isDecimal: true },
];

function formatValue(value: number, isDecimal?: boolean, score?: string | null): string {
  if (score) return score;
  if (isDecimal) return (value / 10).toFixed(1);
  return String(value);
}

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

  const hasAnyseason = SEASON_RECORD_TYPES.some(rt => records[`${competition}_${rt.key}`]);
  const hasAnyCareer = CAREER_RECORD_TYPES.some(rt => records[`career_${rt.key}`]);

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
              competition === "pl" ? "bg-purple-600 text-white" : "text-white hover:text-gray-300"
            }`}
          >
            PL
          </button>
          <button
            onClick={() => setCompetition("all")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
              competition === "all" ? "bg-purple-600 text-white" : "text-white hover:text-gray-300"
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
      ) : (
        <div className="space-y-4">
          {/* Season records */}
          {!hasAnyseason ? (
            <p className="text-center text-white text-xs py-2">
              Play a draft season to set your records!
            </p>
          ) : (
            <div className="space-y-1.5">
              {SEASON_RECORD_TYPES.map(rt => {
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
                      {rt.ascending && (
                        <div className="text-[10px] text-white/50">lower is better</div>
                      )}
                    </div>
                    <div className="text-xl font-black text-amber-400 tabular-nums">
                      {formatValue(rec.value, rt.isDecimal, rt.key === "biggest_win" ? rec.playerName : null)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Career records */}
          {hasAnyCareer && (
            <div>
              <div className="flex items-center gap-2 mb-2 pt-1">
                <span className="text-xs">🌟</span>
                <span className="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">Career Records</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <div className="space-y-1.5">
                {CAREER_RECORD_TYPES.map(rt => {
                  const key = `career_${rt.key}`;
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
                        {formatValue(rec.value, rt.isDecimal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasAnyseason && !hasAnyCareer && (
            <p className="text-center text-white text-xs py-2">
              Play a draft season to set your records!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
