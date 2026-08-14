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
  /**
   * Which edition is on screen.
   *
   * Normally STAR_FIFA_YEAR and nothing else. But FC 27 is built by hand over
   * the course of a transfer window, so there is a stretch of days where the
   * edition the game wants does not exist yet — and a page that dead-ends for a
   * month is not much of a page. When that happens it offers the newest edition
   * that DOES have clubs, and says loudly which one you are looking at.
   */
  const [year, setYear] = useState(STAR_FIFA_YEAR);
  const [available, setAvailable] = useState<number[]>([]);
  /** What the clubs endpoint says about itself — see its `meta`. Shown only when
   *  there is nothing to draw, because that is the only time it helps. */
  const [meta, setMeta] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/draft/clubs", { cache: "no-store" });
        const data = await res.json() as {
          clubs?: { name: string; seasons: number[] }[];
          meta?: { rpc: boolean; playersFoundByName: number };
        };
        const all = data.clubs ?? [];
        const years = Array.from(new Set(all.flatMap(c => c.seasons)))
          .filter(y => y > 2000)
          .sort((a, b) => b - a);
        const names = all
          .filter(c => c.seasons.includes(year))
          .map(c => c.name)
          .sort((a, b) => a.localeCompare(b));
        if (!alive) return;
        setAvailable(years);
        setMeta(
          data.meta
            ? `${all.length} clubs, ${data.meta.playersFoundByName} ${STAR_EDITION_LABEL} players matched by name, SQL function ${data.meta.rpc ? "installed" : "missing"}`
            : null,
        );

        if (names.length === 0) {
          setClubs([]);
          setError(
            years.length === 0
              ? "No Premier League clubs in the database at all — check the Supabase connection."
              : `No ${year - 1}/${String(year % 100).padStart(2, "0")} clubs yet.`,
          );
          return;
        }
        setError(null);
        setClubs(names);
        // The WHOLE squad, not the twenty a career keeps: here you are picking
        // a side, and a side is picked from everybody on the books.
        const sq = await fetchLeagueSquads(names, year, true);
        if (alive) setSquads(sq);
      } catch {
        if (alive) setError("Could not load the clubs. Check your connection and try again.");
      }
    })();
    return () => { alive = false; };
  }, [year]);

  const newest = available.find(y => y !== year);

  return (
    <main className="w-full py-2">
      {year !== STAR_FIFA_YEAR && (
        <div className="mx-auto mb-2 max-w-5xl rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-[11px] font-bold text-amber-200">
          Showing <b>FC {String(year % 100).padStart(2, "0")}</b> — the game itself plays{" "}
          {STAR_EDITION_LABEL}, which has no clubs yet.{" "}
          <button onClick={() => setYear(STAR_FIFA_YEAR)} className="underline">
            Try {STAR_EDITION_LABEL} again
          </button>
        </div>
      )}

      {error ? (
        <div className="mx-auto max-w-md rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm font-bold text-red-200">
          <p>{error}</p>
          {available.length > 0 && (
            <p className="mt-2 text-[12px] font-normal text-red-200/80">
              The database has: {available.slice(0, 8).join(", ")}{available.length > 8 ? "…" : ""}.
            </p>
          )}
          {meta && (
            <p className="mt-2 text-[11px] font-normal text-red-200/70">{meta}</p>
          )}
          {newest && (
            <button
              onClick={() => setYear(newest)}
              className="mt-3 w-full rounded bg-red-800 py-2 text-[12px] font-black uppercase text-white transition hover:bg-red-700"
            >
              Use FC {String(newest % 100).padStart(2, "0")} for now
            </button>
          )}
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
