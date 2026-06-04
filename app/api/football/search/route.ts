import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("football_players")
    .select("wikidata_id, name, date_of_birth, country_id, position, image_url")
    .ilike("name", `%${q}%`)
    .limit(15);

  const rows = data ?? [];
  const countryIds = Array.from(new Set(rows.map((p) => p.country_id).filter(Boolean))) as string[];
  const countryMap = new Map<string, string>();
  if (countryIds.length > 0) {
    const { data: countries } = await supabase
      .from("football_countries")
      .select("wikidata_id, name")
      .in("wikidata_id", countryIds);
    for (const c of countries ?? []) countryMap.set(c.wikidata_id, c.name);
  }

  const players = rows.map((p) => ({
    id: p.wikidata_id,
    name: p.name,
    nationality: countryMap.get(p.country_id ?? "") ?? "",
    position: p.position ?? "",
    image: p.image_url ?? null,
  }));

  return NextResponse.json({ players });
}
