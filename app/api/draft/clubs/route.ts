import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sofifa_players")
    .select("club, fifa_year")
    .ilike("league", "%Premier League%");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clubMap = new Map<string, Set<number>>();

  for (const row of data ?? []) {
    if (!row.club) continue;
    if (!clubMap.has(row.club)) {
      clubMap.set(row.club, new Set());
    }
    clubMap.get(row.club)!.add(row.fifa_year);
  }

  const clubs = Array.from(clubMap.entries())
    .map(([name, seasonsSet]) => ({
      name,
      seasons: Array.from(seasonsSet).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { clubs },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
