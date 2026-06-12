import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;

// Match the English Premier League only. Older FIFA editions call it
// "English Premier League"; newer ones "Premier League". A plain
// %Premier League% match would also catch Scottish/Russian/Ukrainian
// Premier Leagues, so we anchor the patterns to the start of the name.
const PL_FILTER = "league.ilike.Premier League%,league.ilike.English Premier League%,league.ilike.Barclays Premier League%";

// SoFIFA gives Russia's and Ukraine's top divisions the SAME name ("Premier
// League") as England's, so the filter above also catches their clubs. None of
// these are English, and this set is closed (the Russian league left FIFA after
// 2022; Ukraine only ever has these two), so a name denylist is reliable here.
const NON_ENGLISH_PL_CLUBS = new Set(
  [
    // Ukrainian Premier League
    "Dynamo Kyiv", "Shakhtar Donetsk",
    // Russian Premier League
    "Akhmat Grozny", "Alaniya", "Arsenal Tula", "FC Amkar Perm",
    "FC Anzhi Makhachkala", "FC Dynamo Moscow", "FC Khimki", "FC Krasnodar",
    "FC Kuban Krasnodar", "FC Lokomotiv", "FC Moscow", "FC Orenburg",
    "FC Rostov", "FC Tom Tomsk", "FC Tosno", "FC Ufa", "FC Ural Yekaterinburg",
    "FC Volga Nizhny Novgorod", "Mordovia Saransk", "PFC CSKA",
    "PFC Krylia Sovetov Samara", "Rubin Kazan", "SKA Khabarovsk",
    "Saturn Ramenskoye", "Spartak Moscow", "Spartak Nalchik", "Torpedo Moscow",
    "FC Sibir Novosibirsk",
    "Zenit",
  ].map((c) => c.toLowerCase())
);

function isEnglishPLClub(club: string): boolean {
  return !NON_ENGLISH_PL_CLUBS.has(club.trim().toLowerCase());
}

export async function GET() {
  const supabase = createServiceClient();

  const clubMap = new Map<string, Set<number>>();

  // Fast path: dedicated SQL function (see supabase/migrations/draft_club_seasons.sql)
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_pl_club_seasons"
  );

  if (!rpcError && Array.isArray(rpcData)) {
    for (const row of rpcData as { club: string; fifa_year: number }[]) {
      if (!row.club || !isEnglishPLClub(row.club)) continue;
      if (!clubMap.has(row.club)) clubMap.set(row.club, new Set());
      clubMap.get(row.club)!.add(row.fifa_year);
    }
  } else {
    // Fallback: paginate through all PL player rows
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("sofifa_players")
        .select("club, fifa_year")
        .or(PL_FILTER)
        .range(from, to);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      for (const row of data ?? []) {
        if (!row.club || !isEnglishPLClub(row.club)) continue;
        if (!clubMap.has(row.club)) clubMap.set(row.club, new Set());
        clubMap.get(row.club)!.add(row.fifa_year);
      }

      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
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
