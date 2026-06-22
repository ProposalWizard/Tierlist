"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  username: string;
  seasonNumber: number | null;
  clubName?: string | null;
}

interface RecordType {
  key: string;
  label: string;
  emoji: string;
  isTeam: boolean;
  ascending?: boolean;
  isDecimal?: boolean;
}

const SEASON_RECORD_TYPES: RecordType[] = [
  { key: "wins",           label: "Most Wins",            emoji: "🏆", isTeam: true },
  { key: "goals",          label: "Golden Boot",          emoji: "👟", isTeam: false },
  { key: "assists",        label: "Most Assists",         emoji: "🎯", isTeam: false },
  { key: "clean_sheets",   label: "Golden Glove",         emoji: "🧤", isTeam: false },
  { key: "unbeaten",       label: "Longest Unbeaten",     emoji: "🛡️", isTeam: true },
  { key: "goals_conceded", label: "Least Goals Conceded", emoji: "🔒", isTeam: true, ascending: true },
  { key: "avg_rating",     label: "Player of the Season Rating", emoji: "⭐", isTeam: false, isDecimal: true },
];

const CAREER_RECORD_TYPES: RecordType[] = [
  { key: "career_goals",      label: "Most Career Goals",         emoji: "⚽", isTeam: false },
  { key: "career_assists",    label: "Most Career Assists",       emoji: "🎯", isTeam: false },
  { key: "career_trophies",   label: "Most Trophies Won",         emoji: "🏅", isTeam: true },
  { key: "career_avg_rating", label: "Highest Career Avg Rating", emoji: "⭐", isTeam: false, isDecimal: true },
];

const OFFICIAL: Record<string, { value: number; playerName: string | null; playerOvr: number | null; clubName?: string }> = {
  "pl_wins":           { value: 32, playerName: null, playerOvr: null, clubName: "Man City" },
  "pl_goals":          { value: 36, playerName: "E. Haaland", playerOvr: 91 },
  "pl_assists":        { value: 21, playerName: "Bruno Fernandes", playerOvr: 88 },
  "pl_clean_sheets":   { value: 24, playerName: "P. Čech", playerOvr: 88 },
  "pl_unbeaten":       { value: 49, playerName: null, playerOvr: null, clubName: "Arsenal" },
  "pl_goals_conceded": { value: 15, playerName: null, playerOvr: null, clubName: "Chelsea" },
  "all_wins":          { value: 32, playerName: null, playerOvr: null, clubName: "Man City" },
  "all_goals":         { value: 36, playerName: "E. Haaland", playerOvr: 91 },
  "all_assists":       { value: 21, playerName: "Bruno Fernandes", playerOvr: 88 },
  "all_clean_sheets":  { value: 24, playerName: "P. Čech", playerOvr: 88 },
  "all_unbeaten":      { value: 49, playerName: null, playerOvr: null, clubName: "Arsenal" },
  "all_goals_conceded":{ value: 15, playerName: null, playerOvr: null, clubName: "Chelsea" },
};

function mergeWithOfficial(
  dbEntries: RecordEntry[],
  key: string,
  rt: RecordType,
): RecordEntry[] {
  const official = OFFICIAL[key];
  if (!official) return dbEntries;

  const hasOfficial = dbEntries.some(e => e.username === "Official");
  const officialEntry: RecordEntry = {
    ...official,
    username: "Official",
    seasonNumber: null,
  };

  const entries = hasOfficial ? dbEntries : [...dbEntries, officialEntry];

  if (rt.ascending) {
    entries.sort((a, b) => a.value - b.value);
  } else {
    entries.sort((a, b) => b.value - a.value);
  }
  return entries.slice(0, 5);
}

const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th"];

function OvrBadge({ ovr }: { ovr: number }) {
  const colour =
    ovr >= 88 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
    ovr >= 80 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
    "bg-gray-800/80 text-white border-gray-700/40";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colour}`}>
      {ovr} OVR
    </span>
  );
}

function formatValue(value: number, rt: RecordType): string {
  if (rt.isDecimal) return (value / 10).toFixed(1);
  return String(value);
}

function Leaderboard({ entries, rt }: { entries: RecordEntry[]; rt: RecordType }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-white text-sm">
        No records yet — be the first!
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const isOfficial = entry.username === "Official";
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              i === 0
                ? "bg-amber-900/15 border-amber-700/30"
                : i === 1
                  ? "bg-gray-700/15 border-gray-600/30"
                  : i === 2
                    ? "bg-amber-900/10 border-amber-800/20"
                    : "bg-gray-900/50 border-gray-800/30"
            }`}
          >
            <span className={`text-lg leading-none w-6 text-center shrink-0 ${i >= 3 ? "text-xs font-bold text-white" : ""}`}>
              {MEDALS[i]}
            </span>
            <div className="flex-1 min-w-0">
              {!rt.isTeam && entry.playerName && (
                <div className="text-sm font-bold text-white truncate">
                  {entry.playerName}
                  {!isOfficial && entry.playerOvr !== null && (
                    <span className="ml-2"><OvrBadge ovr={entry.playerOvr} /></span>
                  )}
                </div>
              )}
              <div className="text-xs text-white truncate">
                {rt.isTeam ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm">{formatValue(entry.value, rt)}</span>
                    {isOfficial ? (
                      <>
                        {entry.clubName && <span className="text-white font-bold">{entry.clubName}</span>}
                        <span className="text-amber-400 font-bold">⭐ Official</span>
                      </>
                    ) : (
                      <span className="text-emerald-400 font-bold">{entry.username}</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 flex-wrap">
                    {isOfficial ? (
                      <span className="text-amber-400 font-bold">⭐ Official</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">{entry.username}</span>
                    )}
                    {!isOfficial && entry.seasonNumber && (
                      <span className="text-white">· S{entry.seasonNumber}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            {!rt.isTeam && (
              <div className={`text-xl font-black tabular-nums shrink-0 ${
                i === 0 ? "text-amber-400" : i === 1 ? "text-white" : i === 2 ? "text-amber-600" : "text-white"
              }`}>
                {formatValue(entry.value, rt)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DraftRecordsPage() {
  const [competition, setCompetition] = useState<"pl" | "all">("pl");
  const [records, setRecords] = useState<Record<string, RecordEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/draft/records")
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setRecords(d.records ?? {});
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/draft"
            className="inline-flex items-center gap-1.5 text-white hover:text-emerald-400 text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Draft
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📋</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Hall of Records</h1>
              <p className="text-white text-sm">All-time season records · <span className="text-amber-400">⭐ Official</span> = real-world PL record to beat</p>
            </div>
          </div>
        </div>

        {/* PL / All Comps toggle */}
        <div className="flex gap-1.5 mb-8 bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 max-w-xs">
          <button
            onClick={() => setCompetition("pl")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              competition === "pl" ? "bg-purple-600 text-white shadow-lg" : "text-white hover:text-white"
            }`}
          >
            Premier League
          </button>
          <button
            onClick={() => setCompetition("all")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              competition === "all" ? "bg-purple-600 text-white shadow-lg" : "text-white hover:text-white"
            }`}
          >
            All Comps
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading records...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {SEASON_RECORD_TYPES.map(rt => {
              const key = `${competition}_${rt.key}`;
              const entries = mergeWithOfficial(records[key] ?? [], key, rt);
              return (
                <div key={rt.key} className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{rt.emoji}</span>
                    <div className="flex-1">
                      <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">
                        {rt.label}
                      </h2>
                      <p className="text-[10px] text-white uppercase tracking-widest font-bold">
                        {competition === "pl" ? "Premier League" : "All Competitions"} · Season record
                      </p>
                    </div>
                    {rt.ascending && (
                      <span className="text-[10px] text-white font-bold tracking-widest uppercase">lower is better</span>
                    )}
                  </div>
                  <Leaderboard entries={entries} rt={rt} />
                </div>
              );
            })}

            {/* Career records — only in All Comps tab */}
            {competition === "all" && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🌟</span>
                  <h2 className="text-xs font-extrabold tracking-[0.2em] text-white uppercase">Career Records</h2>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>
                <div className="space-y-4">
                  {CAREER_RECORD_TYPES.map(rt => {
                    const key = `career_${rt.key}`;
                    const entries = records[key] ?? [];
                    return (
                      <div key={rt.key} className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">{rt.emoji}</span>
                          <div>
                            <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">
                              {rt.label}
                            </h2>
                            <p className="text-[10px] text-white uppercase tracking-widest font-bold">
                              Career · All competitions
                            </p>
                          </div>
                        </div>
                        <Leaderboard entries={entries} rt={rt} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-center text-white text-xs pb-4">
              Only signed-in players appear on these boards. ⭐ Official = real-world PL benchmark.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
