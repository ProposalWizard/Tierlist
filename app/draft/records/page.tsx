"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  username: string;
  seasonNumber: number | null;
  clubName?: string | null;
  mode?: "normal" | "prime";
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
  { key: "most_points",    label: "Most Points",          emoji: "📊", isTeam: true },
  { key: "wins",           label: "Most Wins",            emoji: "🏆", isTeam: true },
  { key: "goals",          label: "Golden Boot",          emoji: "👟", isTeam: false },
  { key: "assists",        label: "Most Assists",         emoji: "🎯", isTeam: false },
  { key: "clean_sheets",   label: "Golden Glove",         emoji: "🧤", isTeam: false },
  { key: "unbeaten",       label: "Longest Unbeaten",     emoji: "🛡️", isTeam: true },
  { key: "goals_conceded", label: "Least Goals Conceded", emoji: "🔒", isTeam: true, ascending: true },
  { key: "biggest_win",    label: "Biggest Win",          emoji: "💥", isTeam: true },
  { key: "avg_rating",     label: "Player of the Season Rating", emoji: "⭐", isTeam: false, isDecimal: true },
  { key: "squad_ovr",      label: "Highest Squad OVR",     emoji: "📈", isTeam: true },
];

const CAREER_RECORD_TYPES: RecordType[] = [
  { key: "career_goals",      label: "Most Career Goals",         emoji: "⚽", isTeam: false },
  { key: "career_assists",    label: "Most Career Assists",       emoji: "🎯", isTeam: false },
  { key: "career_trophies",   label: "Most Trophies Won",         emoji: "🏅", isTeam: true },
  { key: "career_avg_rating", label: "Highest Career Avg Rating", emoji: "⭐", isTeam: false, isDecimal: true },
];

const OFFICIAL: Record<string, { value: number; playerName: string | null; playerOvr: number | null; clubName?: string }> = {
  "pl_most_points":    { value: 100, playerName: null, playerOvr: null, clubName: "Man City" },
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
  "pl_biggest_win":    { value: 9, playerName: "9-0", playerOvr: null, clubName: "Man Utd" },
  "all_biggest_win":   { value: 9, playerName: "9-0", playerOvr: null, clubName: "Man Utd" },
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

function ModeBadge({ mode }: { mode: "normal" | "prime" }) {
  return mode === "prime" ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
      PRIME
    </span>
  ) : (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
      NORMAL
    </span>
  );
}

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

function formatValue(value: number, rt: RecordType, score?: string | null): string {
  if (rt.key === "biggest_win" && score) return score;
  if (rt.isDecimal) return (value / 10).toFixed(1);
  return String(value);
}

function LeaderboardRow({ entry, index: i, rt }: { entry: RecordEntry; index: number; rt: RecordType }) {
  const isOfficial = entry.username === "Official";
  return (
    <div
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
              <span className="text-white font-bold text-sm">{formatValue(entry.value, rt, entry.playerName)}</span>
              {isOfficial ? (
                <>
                  {entry.clubName && <span className="text-white font-bold">{entry.clubName}</span>}
                  <span className="text-amber-400 font-bold">⭐ Official</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 font-bold">{entry.username}</span>
                  {entry.mode && <ModeBadge mode={entry.mode} />}
                  {entry.playerOvr !== null && <OvrBadge ovr={entry.playerOvr} />}
                </>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2 flex-wrap">
              {isOfficial ? (
                <span className="text-amber-400 font-bold">⭐ Official</span>
              ) : (
                <>
                  <span className="text-emerald-400 font-bold">{entry.username}</span>
                  {entry.mode && <ModeBadge mode={entry.mode} />}
                </>
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
}

function Leaderboard({ entries, rt, expanded }: { entries: RecordEntry[]; rt: RecordType; expanded: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-white text-sm">
        No records yet — be the first!
      </div>
    );
  }
  const rest = entries.slice(1);
  return (
    <div className="space-y-2">
      <LeaderboardRow entry={entries[0]} index={0} rt={rt} />
      {rest.length > 0 && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: expanded ? `${rest.length * 72}px` : "0px", opacity: expanded ? 1 : 0 }}
        >
          <div className="space-y-2">
            {rest.map((entry, i) => (
              <LeaderboardRow key={i + 1} entry={entry} index={i + 1} rt={rt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DraftRecordsPage() {
  const [competition, setCompetition] = useState<"pl" | "all">("pl");
  const [mode, setMode] = useState<"normal" | "prime" | "best">("best");
  const [records, setRecords] = useState<Record<string, RecordEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleModeChange(newMode: "normal" | "prime" | "best") {
    setMode(newMode);
    if (newMode === "best") setCompetition("all");
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
      if (!user) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isSignedIn !== true) return;
    setLoading(true);
    setError(null);

    if (mode === "best") {
      Promise.all([
        fetch(`/api/draft/records?mode=normal`).then(r => r.json()),
        fetch(`/api/draft/records?mode=prime`).then(r => r.json()),
      ])
        .then(([normalData, primeData]) => {
          if (normalData.error) throw new Error(normalData.error);
          if (primeData.error) throw new Error(primeData.error);

          const normalRec: Record<string, RecordEntry[]> = normalData.records ?? {};
          const primeRec: Record<string, RecordEntry[]> = primeData.records ?? {};

          const allKeys = Array.from(new Set([...Object.keys(normalRec), ...Object.keys(primeRec)]));
          const merged: Record<string, RecordEntry[]> = {};

          for (const key of allKeys) {
            const normal = (normalRec[key] ?? []).map(e => ({ ...e, mode: "normal" as const }));
            const prime = (primeRec[key] ?? []).map(e => ({ ...e, mode: "prime" as const }));
            const combined = [...normal, ...prime];
            const recordType = key.split("_").slice(1).join("_");
            const isAscending = recordType === "goals_conceded";
            combined.sort((a, b) => isAscending ? a.value - b.value : b.value - a.value);
            merged[key] = combined.slice(0, 5);
          }

          setRecords(merged);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/draft/records?mode=${mode}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error);
          setRecords(d.records ?? {});
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [isSignedIn, mode]);

  if (isSignedIn === null) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSignedIn === false) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href="/draft"
            className="inline-flex items-center gap-1.5 text-white hover:text-emerald-400 text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Draft
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white mb-4">Hall of Fame</h1>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800/50 text-center mt-4">
            <div className="text-3xl mb-3">&#128274;</div>
            <p className="text-lg font-bold text-white mb-2">Sign in to view the Hall of Fame</p>
            <p className="text-white text-sm mb-4">
              Sign in to see all-time records and leaderboards.
            </p>
            <Link
              href="/auth?next=/draft/records"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-black tracking-tight text-white">Hall of Fame</h1>
              <p className="text-white text-sm">All-time season records · <span className="text-amber-400">⭐ Official</span> = real-world PL record to beat</p>
            </div>
          </div>
        </div>

        {/* Normal / Prime / Best toggle (primary) */}
        <div className="flex gap-1.5 mb-4 bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 max-w-xs">
          <button
            onClick={() => handleModeChange("normal")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              mode === "normal" ? "bg-emerald-600 text-white shadow-lg" : "text-white hover:text-white"
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => handleModeChange("prime")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              mode === "prime" ? "bg-amber-600 text-white shadow-lg" : "text-white hover:text-white"
            }`}
          >
            Prime
          </button>
          <button
            onClick={() => handleModeChange("best")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              mode === "best" ? "bg-purple-600 text-white shadow-lg" : "text-white hover:text-white"
            }`}
          >
            Best
          </button>
        </div>

        {/* PL / All Comps toggle (secondary) */}
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

        {!loading && !error && (() => {
          const visibleSeasonKeys = SEASON_RECORD_TYPES
            .filter(rt => !((rt.key === "most_points" && competition === "all") || (rt.key === "squad_ovr" && competition === "pl")))
            .map(rt => `${competition}_${rt.key}`);
          const visibleCareerKeys = competition === "all"
            ? CAREER_RECORD_TYPES.map(rt => `career_${rt.key}`)
            : [];
          const allVisibleKeys = [...visibleSeasonKeys, ...visibleCareerKeys];
          const allExpanded = allVisibleKeys.every(k => expandedKeys.has(k));
          return (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setExpandedKeys(allExpanded ? new Set() : new Set(allVisibleKeys))}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white hover:text-emerald-400 transition-colors"
              >
                {allExpanded ? "Collapse All" : "Expand All"}
                <svg
                  className={`w-3 h-3 transition-transform duration-300 ${allExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {SEASON_RECORD_TYPES.filter(rt => !((rt.key === "most_points" && competition === "all") || (rt.key === "squad_ovr" && competition === "pl"))).map(rt => {
              const key = `${competition}_${rt.key}`;
              const entries = mergeWithOfficial(records[key] ?? [], key, rt);
              const isExpanded = expandedKeys.has(key);
              const hasMore = entries.length > 1;
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
                    {rt.ascending && !hasMore && (
                      <span className="text-[10px] text-white font-bold tracking-widest uppercase">lower is better</span>
                    )}
                    {hasMore && (
                      <button
                        onClick={() => toggleExpanded(key)}
                        className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-emerald-400 transition-colors uppercase tracking-wide shrink-0"
                      >
                        {isExpanded ? "Show less" : "See more"}
                        <svg
                          className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <Leaderboard entries={entries} rt={rt} expanded={isExpanded} />
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
                    const isExpanded = expandedKeys.has(key);
                    const hasMore = entries.length > 1;
                    return (
                      <div key={rt.key} className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">{rt.emoji}</span>
                          <div className="flex-1">
                            <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">
                              {rt.label}
                            </h2>
                            <p className="text-[10px] text-white uppercase tracking-widest font-bold">
                              Career · All competitions
                            </p>
                          </div>
                          {hasMore && (
                            <button
                              onClick={() => toggleExpanded(key)}
                              className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-emerald-400 transition-colors uppercase tracking-wide shrink-0"
                            >
                              {isExpanded ? "Show less" : "See more"}
                              <svg
                                className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <Leaderboard entries={entries} rt={rt} expanded={isExpanded} />
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
          );
        })()}
      </div>
    </div>
  );
}
