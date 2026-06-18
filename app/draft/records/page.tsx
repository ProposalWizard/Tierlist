"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  username: string;
  seasonNumber: number | null;
}

const RECORD_TYPES: { key: string; label: string; emoji: string; isTeam: boolean }[] = [
  { key: "wins",        label: "Most Wins",        emoji: "🏆", isTeam: true },
  { key: "goals",       label: "Most Goals",       emoji: "⚽", isTeam: false },
  { key: "assists",     label: "Most Assists",      emoji: "🎯", isTeam: false },
  { key: "clean_sheets",label: "Most Clean Sheets", emoji: "🧤", isTeam: false },
  { key: "unbeaten",    label: "Longest Unbeaten",  emoji: "🛡️", isTeam: true },
];

const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th"];

function OvrBadge({ ovr }: { ovr: number }) {
  const colour =
    ovr >= 88 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
    ovr >= 80 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
    "bg-gray-800/80 text-gray-400 border-gray-700/40";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colour}`}>
      {ovr} OVR
    </span>
  );
}

function Leaderboard({ entries, isTeam }: { entries: RecordEntry[]; isTeam: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-gray-600 text-sm">
        No records yet — be the first!
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
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
          <span className={`text-lg leading-none w-6 text-center shrink-0 ${i >= 3 ? "text-xs font-bold text-gray-600" : ""}`}>
            {MEDALS[i]}
          </span>
          <div className="flex-1 min-w-0">
            {!isTeam && entry.playerName && (
              <div className="text-sm font-bold text-white truncate">
                {entry.playerName}
                {entry.playerOvr !== null && (
                  <span className="ml-2">
                    <OvrBadge ovr={entry.playerOvr} />
                  </span>
                )}
              </div>
            )}
            <div className={`text-xs text-gray-400 truncate ${isTeam ? "font-bold text-sm text-white" : ""}`}>
              {isTeam ? (
                <>
                  <span className="text-white font-bold text-sm">{entry.value}</span>
                  <span className="text-gray-500 text-xs font-normal ml-2">by </span>
                  <span className="text-emerald-400 font-bold">{entry.username}</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 font-bold">{entry.username}</span>
                  {entry.seasonNumber && (
                    <span className="text-gray-600 ml-1">· S{entry.seasonNumber}</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className={`text-xl font-black tabular-nums shrink-0 ${
            i === 0 ? "text-amber-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"
          }`}>
            {!isTeam ? entry.value : ""}
          </div>
        </div>
      ))}
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
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm font-medium mb-6 transition-colors"
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
              <p className="text-gray-500 text-sm">All-time season records from every draft run</p>
            </div>
          </div>
        </div>

        {/* PL / All Comps toggle */}
        <div className="flex gap-1.5 mb-8 bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 max-w-xs">
          <button
            onClick={() => setCompetition("pl")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              competition === "pl"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Premier League
          </button>
          <button
            onClick={() => setCompetition("all")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              competition === "all"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            All Comps
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading records...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {RECORD_TYPES.map(rt => {
              const key = `${competition}_${rt.key}`;
              const entries = records[key] ?? [];
              return (
                <div key={rt.key} className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{rt.emoji}</span>
                    <div>
                      <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">
                        {rt.label}
                      </h2>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                        {competition === "pl" ? "Premier League" : "All Competitions"} · Season record
                      </p>
                    </div>
                  </div>
                  <Leaderboard entries={entries} isTeam={rt.isTeam} />
                </div>
              );
            })}

            <p className="text-center text-gray-700 text-xs pb-4">
              Only signed-in players appear on these boards.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
