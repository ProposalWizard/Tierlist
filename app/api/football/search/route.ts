import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const supabase = await createClient();

  const { data } = await supabase
    .from("football_players")
    .select("wikidata_id, name, date_of_birth, country_id, position, image_url")
    .ilike("name", `%${q}%`)
    .limit(200);

  const rows = data ?? [];
  if (rows.length === 0) return NextResponse.json({ players: [] });

  const playerIds = rows.map((p) => p.wikidata_id);
  const careerCounts = new Map<string, number>();
  const activePlayerIds = new Set<string>();

  interface CareerRow { player_id: string; club_id: string; end_date: string | null }
  const allCareers: CareerRow[] = [];

  for (let i = 0; i < playerIds.length; i += 200) {
    const chunk = playerIds.slice(i, i + 200);
    const { data: careers } = await supabase
      .from("football_careers")
      .select("player_id, club_id, end_date")
      .in("player_id", chunk)
      .limit(5000);
    for (const c of (careers ?? []) as CareerRow[]) {
      careerCounts.set(c.player_id, (careerCounts.get(c.player_id) ?? 0) + 1);
      allCareers.push(c);
    }
  }

  if (activeOnly && allCareers.length > 0) {
    const clubIds = Array.from(new Set(allCareers.map((c) => c.club_id)));
    const nationalTeamIds = new Set<string>();
    for (let i = 0; i < clubIds.length; i += 200) {
      const chunk = clubIds.slice(i, i + 200);
      const { data: clubs } = await supabase
        .from("football_clubs")
        .select("wikidata_id, name")
        .in("wikidata_id", chunk);
      for (const cl of clubs ?? []) {
        if ((cl.name as string).toLowerCase().includes("national")) {
          nationalTeamIds.add(cl.wikidata_id);
        }
      }
    }

    for (const c of allCareers) {
      if (nationalTeamIds.has(c.club_id)) continue;
      if (c.end_date && c.end_date >= "2026") {
        activePlayerIds.add(c.player_id);
      } else if (!c.end_date) {
        activePlayerIds.add(c.player_id);
      }
    }
  }

  const filteredRows = activeOnly
    ? rows.filter((p) => activePlayerIds.has(p.wikidata_id))
    : rows;
  if (filteredRows.length === 0) return NextResponse.json({ players: [] });

  const qLower = q.toLowerCase().trim();
  const ranked = filteredRows
    .map((p) => {
      let score = 0;
      const name = (p.name as string).toLowerCase();
      const nameWords = name.split(/\s+/);

      if (name === qLower) score = 10000;
      else if (nameWords.includes(qLower)) score = 5000;
      else if (name.startsWith(qLower)) score = 3000;
      else if (nameWords.some((w) => w.startsWith(qLower))) score = 2000;
      else score = 1000;

      score += Math.min(200, (careerCounts.get(p.wikidata_id) ?? 0) * 25);
      if (p.image_url) score += 50;
      if (p.date_of_birth) {
        const year = parseInt(p.date_of_birth.substring(0, 4));
        if (!isNaN(year) && year > 1960)
          score += Math.min(30, (year - 1960) / 2);
      }

      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 15);

  const countryIds = Array.from(
    new Set(ranked.map((p) => p.country_id).filter(Boolean))
  ) as string[];
  const countryMap = new Map<string, string>();
  if (countryIds.length > 0) {
    const { data: countries } = await supabase
      .from("football_countries")
      .select("wikidata_id, name")
      .in("wikidata_id", countryIds);
    for (const c of countries ?? []) countryMap.set(c.wikidata_id, c.name);
  }

  const players = ranked.map((p) => ({
    id: p.wikidata_id,
    name: p.name,
    nationality: countryMap.get(p.country_id ?? "") ?? "",
    position: p.position ?? "",
    image: p.image_url ?? null,
  }));

  return NextResponse.json({ players });
}
