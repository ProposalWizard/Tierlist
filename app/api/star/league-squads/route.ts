import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;
// Reads the live DB, so it must never be frozen into a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * THE WHOLE DIVISION, IN ONE TRIP.
 *
 * `/api/draft/roster` exists and returns the same players. It is not the wrong
 * endpoint — it is a different one, for a different job. The Draft needs every
 * attribute a footballer has, so for each player it reads the `attributes`
 * JSONB blob out of the row and unpacks about thirty numbers from it, then runs
 * a second query to patch missing nationalities.
 *
 * The star career needs six fields and twenty clubs. Asking the Draft's
 * endpoint for them would mean twenty round trips, each one reading and
 * discarding a blob — the same shape of query that froze a live draft for
 * fifteen seconds in the July audit.
 *
 * So: one request, one query, no JSONB, only the columns that get used. The
 * Draft's endpoint is untouched and goes on doing its own job.
 */

interface LeanPlayer {
  id: string;
  name: string;
  positions: string;
  overall: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clubsParam = searchParams.get("clubs");
  const year = parseInt(searchParams.get("year") ?? "2026", 10);

  if (!clubsParam) {
    return NextResponse.json({ error: "Missing required query param: clubs" }, { status: 400 });
  }
  if (Number.isNaN(year)) {
    return NextResponse.json({ error: "year must be a number" }, { status: 400 });
  }

  const clubs = clubsParam.split("|").map(c => c.trim()).filter(Boolean);
  if (clubs.length === 0) {
    return NextResponse.json({ error: "clubs must not be empty" }, { status: 400 });
  }
  // A league is twenty clubs. The cap is a guard against somebody asking for the
  // whole table, not a limit anybody should reach.
  if (clubs.length > 40) {
    return NextResponse.json({ error: "at most 40 clubs" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── The one query ──
  //
  // No `attributes`, no `*`, no follow-up. `manual_*` columns are the admin
  // overrides and are cheap scalars, so they come along and win where set.
  const { data, error } = await supabase
    .from("sofifa_players")
    .select("sofifa_id, name, club, overall, manual_overall, positions, manual_positions")
    .eq("fifa_year", year)
    .in("club", clubs)
    .order("overall", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const squads: Record<string, LeanPlayer[]> = {};
  for (const club of clubs) squads[club] = [];

  for (const row of data ?? []) {
    const club = row.club as string;
    const list = squads[club];
    if (!list) continue;
    const overall = (row.manual_overall as number) || (row.overall as number) || 0;
    const positions = ((row.manual_positions as string) || (row.positions as string) || "").trim();
    const name = ((row.name as string) || "").trim();
    // A row with no name is not a footballer we can put on a team sheet.
    if (!name) continue;
    list.push({ id: String(row.sofifa_id), name, positions, overall });
  }

  // Ordered by rating, best first — which is the order every consumer wants and
  // is cheaper to do once here than in each of them.
  for (const club of clubs) squads[club].sort((a, b) => b.overall - a.overall);

  return NextResponse.json({
    year,
    squads,
    // What actually came back, so the caller can fall back per club rather than
    // guessing. The FC 26 import is known to be partial.
    found: Object.fromEntries(clubs.map(c => [c, squads[c].length])),
  });
}
