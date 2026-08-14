"use client";
import { useEffect, useState } from "react";
import LineupBuilder from "@/components/star/LineupBuilder";
import { fetchLeagueSquads } from "@/lib/star/leagueSquads";
import { STAR_FIFA_YEAR, STAR_SEASON_LABEL, STAR_EDITION_LABEL } from "@/lib/star/edition";
import type { LeagueSquad } from "@/lib/star/types";

/**
 * SQUAD BUILDER.
 *
 * Its own page rather than a tab inside the career, because it is not about a
 * career: it is every Premier League squad and a shape to put them in, and you
 * should be able to open it without having a save.
 *
 * It fetches the division the same way a career does — one request for all
 * twenty clubs (see app/api/star/league-squads) rather than twenty requests for
 * one club each.
 */

export default function LineupsPage() {
  const [clubs, setClubs] = useState<string[]>([]);
  const [squads, setSquads] = useState<LeagueSquad[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/draft/clubs", { cache: "no-store" });
        const data = await res.json() as { clubs?: { name: string; seasons: number[] }[] };
        const names = (data.clubs ?? [])
          .filter(c => c.seasons.includes(STAR_FIFA_YEAR))
          .map(c => c.name)
          .sort((a, b) => a.localeCompare(b));
        if (!alive) return;
        if (names.length === 0) { setError(`No ${STAR_SEASON_LABEL} Premier League clubs found — is the ${STAR_EDITION_LABEL} data imported?`); return; }
        setClubs(names);
        // The WHOLE squad, not the twenty a career keeps: here you are picking
        // a side, and a side is picked from everybody on the books.
        const sq = await fetchLeagueSquads(names, STAR_FIFA_YEAR, true);
        if (alive) setSquads(sq);
      } catch {
        if (alive) setError("Could not load the clubs. Check your connection and try again.");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="w-full py-2">
      {error ? (
        <div className="mx-auto max-w-md rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm font-bold text-red-200">
          {error}
        </div>
      ) : clubs.length === 0 ? (
        <div className="mx-auto max-w-md p-8 text-center text-sm font-bold text-emerald-300">
          Loading the division…
        </div>
      ) : (
        <LineupBuilder clubs={clubs} squads={squads} />
      )}
    </main>
  );
}
