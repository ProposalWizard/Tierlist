"use client";
import { useEffect, useState } from "react";
import LineupBuilder from "@/components/star/LineupBuilder";
import { fetchLeagueSquads } from "@/lib/star/leagueSquads";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
  CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS, type Division,
} from "@/lib/star/clubs";
import type { LeagueSquad } from "@/lib/star/types";

/**
 * SQUAD BUILDER.
 *
 * Its own page rather than a tab inside the career, because it is not about a
 * career: it is every club's squad and a shape to put them in, and you should
 * be able to open it without having a save.
 *
 * Three tabs now instead of one flat Premier League list — the Championship
 * and this season's five-club promotion pool are real parts of the game too
 * (see lib/star/clubs.ts, the shared source for which club is in which). The
 * club lists here are read straight off that file rather than fetched from
 * /api/draft/clubs — that endpoint is Draft mode's own, filtered to whatever
 * IT considers "the Premier League" across its whole multi-year archive, and
 * this page needs THIS season's three divisions exactly, not a historical
 * sweep.
 */

const TABS: { key: Division; label: string; clubs: readonly string[] }[] = [
  { key: "premier", label: "Premier League", clubs: PREMIER_LEAGUE_CLUBS },
  { key: "championship", label: "Championship", clubs: CHAMPIONSHIP_CLUBS },
  { key: "champions", label: "Champions League", clubs: CHAMPIONS_LEAGUE_CLUBS },
  { key: "europa", label: "Europa League", clubs: EUROPA_LEAGUE_CLUBS },
  { key: "pool", label: "Other", clubs: PROMOTION_POOL_CLUBS },
];

export default function LineupsPage() {
  const [division, setDivision] = useState<Division>("premier");
  const [squads, setSquads] = useState<LeagueSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tab = TABS.find(t => t.key === division)!;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // The WHOLE squad, not the twenty a career keeps: here you are
        // picking a side, and a side is picked from everybody on the books.
        const sq = await fetchLeagueSquads([...tab.clubs], STAR_FIFA_YEAR, true);
        if (!alive) return;
        setSquads(sq);
      } catch {
        if (alive) setError("Could not load the clubs. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [division]);

  return (
    <main className="w-full py-2">
      {/* Five tabs now, not three — a phone-width row of equal flex-1 tiles
          crushed "Champions League"/"Europa League" onto multiple lines.
          A scrollable row keeps every label on one line at a readable size
          instead. */}
      <div className="mx-auto mb-2 flex max-w-5xl gap-1.5 overflow-x-auto px-2 pb-0.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setDivision(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-black uppercase tracking-wide transition ${
              division === t.key
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-gray-700 bg-gray-900 text-white/70 hover:bg-gray-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mx-auto max-w-md rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm font-bold text-red-200">
          {error}
        </div>
      ) : loading ? (
        <div className="mx-auto max-w-md p-8 text-center text-sm font-bold text-emerald-300">
          Loading the division…
        </div>
      ) : (
        <LineupBuilder clubs={[...tab.clubs]} squads={squads} />
      )}
    </main>
  );
}
