import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;
// Diagnostic endpoint — must always reflect the live DB, never a build-time snapshot.
export const dynamic = "force-dynamic";

// Diagnostic endpoint for the PL Draft game. Hit /api/draft/debug to see:
//  - how many players are in the DB and per fifa_year
//  - what distinct league names exist (so we can fix the PL filter)
//  - a sample of clubs that match the current PL filter
export async function GET() {
  const supabase = createServiceClient();

  // Total row count
  const { count: totalCount, error: countErr } = await supabase
    .from("sofifa_players")
    .select("*", { count: "exact", head: true });

  if (countErr) {
    return NextResponse.json(
      { error: countErr.message, hint: "sofifa_players table may not exist — run sofifa_data.sql" },
      { status: 500 }
    );
  }

  // Per-year counts (sample first 5000 rows for league/year breakdown)
  const { data: sample, error: sampleErr } = await supabase
    .from("sofifa_players")
    .select("fifa_year, league, club")
    .limit(10000);

  if (sampleErr) {
    return NextResponse.json({ error: sampleErr.message }, { status: 500 });
  }

  const yearCounts: Record<string, number> = {};
  const leagueCounts: Record<string, number> = {};
  let nullLeagues = 0;

  for (const row of sample ?? []) {
    const y = String(row.fifa_year);
    yearCounts[y] = (yearCounts[y] ?? 0) + 1;
    if (!row.league) {
      nullLeagues++;
    } else {
      leagueCounts[row.league] = (leagueCounts[row.league] ?? 0) + 1;
    }
  }

  // Top leagues by frequency
  const topLeagues = Object.entries(leagueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([league, count]) => ({ league, count }));

  // Any league containing "premier" (case-insensitive)
  const premierLeagues = Object.entries(leagueCounts)
    .filter(([l]) => l.toLowerCase().includes("premier"))
    .map(([league, count]) => ({ league, count }));

  // Test the current clubs filter
  const PL_FILTER =
    "league.ilike.Premier League%,league.ilike.English Premier League%,league.ilike.Barclays Premier League%";
  const { data: plRows, error: plErr } = await supabase
    .from("sofifa_players")
    .select("club, fifa_year, league")
    .or(PL_FILTER)
    .limit(20);

  return NextResponse.json({
    totalPlayers: totalCount ?? 0,
    sampleSize: sample?.length ?? 0,
    yearCounts,
    nullLeagueCountInSample: nullLeagues,
    topLeaguesInSample: topLeagues,
    premierLeaguesInSample: premierLeagues,
    currentFilterMatches: {
      error: plErr?.message ?? null,
      count: plRows?.length ?? 0,
      sample: plRows ?? [],
    },
  });
}
