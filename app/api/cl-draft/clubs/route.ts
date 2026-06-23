import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { CL_CLUBS } from "@/lib/clTeams";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eraStart = Number(req.nextUrl.searchParams.get("eraStart")) || 2007;
  const eraEnd = Number(req.nextUrl.searchParams.get("eraEnd")) || 2026;

  // Get all distinct club+year combos in the sofifa database
  const { data: dbClubs, error } = await supabase
    .from("sofifa_players")
    .select("club, fifa_year")
    .limit(50000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dbClubYears = new Set<string>();
  for (const row of dbClubs ?? []) {
    dbClubYears.add(`${row.club}___${row.fifa_year}`);
  }

  // Cross-reference CL clubs with available database rosters
  const clubs: { name: string; displayName: string; country: string; strength: number; seasons: { clSeason: string; fifaYear: number }[] }[] = [];

  for (const club of CL_CLUBS) {
    const seasons: { clSeason: string; fifaYear: number }[] = [];
    for (const year of club.fifaYears) {
      if (year < eraStart || year > eraEnd) continue;
      // Check if this club has roster data for this FIFA year
      if (dbClubYears.has(`${club.name}___${year}`)) {
        const prev = year - 1;
        const short = String(year % 100).padStart(2, "0");
        seasons.push({ clSeason: `${prev}/${short}`, fifaYear: year });
      }
    }
    if (seasons.length > 0) {
      clubs.push({
        name: club.name,
        displayName: club.displayName,
        country: club.country,
        strength: club.strength,
        seasons,
      });
    }
  }

  return NextResponse.json({ clubs });
}
