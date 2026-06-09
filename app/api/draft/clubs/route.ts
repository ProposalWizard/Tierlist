import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;

export async function GET() {
  const supabase = createServiceClient();

  const PAGE_SIZE = 1000;
  const allRows: { club: string; fifa_year: number }[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("sofifa_players")
      .select("club, fifa_year")
      .ilike("league", "%Premier League%")
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      allRows.push(...data);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  const clubMap = new Map<string, Set<number>>();

  for (const row of allRows) {
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
