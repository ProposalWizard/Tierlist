"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface ClubData {
  name: string;
  seasons: number[];
}

export default function PLClubsPage() {
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"bySeason" | "byClub">("bySeason");

  useEffect(() => {
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d) => {
        if (d.clubs) setClubs(d.clubs);
        else if (d.error) setError(d.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const allYears = Array.from(
    new Set(clubs.flatMap((c) => c.seasons))
  ).sort((a, b) => b - a);

  const clubsByYear = new Map<number, string[]>();
  for (const year of allYears) {
    clubsByYear.set(
      year,
      clubs
        .filter((c) => c.seasons.includes(year))
        .map((c) => c.name)
        .sort()
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/football"
          className="text-white hover:text-white text-sm"
        >
          &larr; Football Admin
        </Link>
        <h1 className="text-2xl font-bold">PL Clubs by Season</h1>
      </div>

      {loading && <p className="text-white">Loading clubs...</p>}
      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-800/50 rounded p-3">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode("bySeason")}
              className={`px-4 py-2 rounded text-sm font-medium ${
                viewMode === "bySeason"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
            >
              By Season ({allYears.length})
            </button>
            <button
              onClick={() => setViewMode("byClub")}
              className={`px-4 py-2 rounded text-sm font-medium ${
                viewMode === "byClub"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
            >
              By Club ({clubs.length})
            </button>
          </div>

          <div className="text-sm text-white mb-4">
            {clubs.length} total PL clubs across {allYears.length} seasons
          </div>

          {viewMode === "bySeason" && (
            <div className="space-y-4">
              {allYears.map((year) => {
                const yearClubs = clubsByYear.get(year) ?? [];
                return (
                  <div
                    key={year}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg font-bold text-emerald-400">
                        {year >= 2024 ? "FC" : "FIFA"}{" "}
                        {String(year % 100).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-white">
                        {yearClubs.length} clubs
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          yearClubs.length === 20
                            ? "bg-emerald-900/50 text-emerald-400"
                            : yearClubs.length >= 18
                              ? "bg-yellow-900/50 text-yellow-400"
                              : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {yearClubs.length === 20
                          ? "Complete"
                          : yearClubs.length >= 18
                            ? "Near complete"
                            : "Incomplete"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {yearClubs.map((club) => (
                        <span
                          key={club}
                          className="px-2 py-1 bg-gray-800 rounded text-xs text-white"
                        >
                          {club}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "byClub" && (
            <div className="space-y-1">
              {clubs.map((club) => (
                <div
                  key={club.name}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded px-4 py-2"
                >
                  <span className="font-medium w-48 shrink-0">{club.name}</span>
                  <span className="text-xs text-white w-20 shrink-0">
                    {club.seasons.length} seasons
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {club.seasons.map((y) => (
                      <span
                        key={y}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white"
                      >
                        {String(y % 100).padStart(2, "0")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
