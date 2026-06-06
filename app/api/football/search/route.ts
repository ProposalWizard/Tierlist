import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const supabase = await createClient();
  const cols = "wikidata_id, name, date_of_birth, country_id, position, image_url";
  const qStripped = stripAccents(q);
  const needsAccentQuery = qStripped !== q.toLowerCase();

  const queries: Promise<{ data: Record<string, unknown>[] | null }>[] = [
    supabase.from("football_players").select(cols).ilike("name", `%${q}%`).limit(200),
  ];
  if (needsAccentQuery) {
    queries.push(
      supabase.from("football_players").select(cols).ilike("name", `%${qStripped}%`).limit(200)
    );
  }

  const results = await Promise.all(queries);
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const res of results) {
    for (const r of res.data ?? []) {
      const id = r.wikidata_id as string;
      if (seen.has(id)) continue;
      seen.add(id);
      if (stripAccents(r.name as string).includes(qStripped)) rows.push(r);
    }
  }

  if (rows.length === 0) return NextResponse.json({ players: [] });

  const playerIds = rows.map((p) => p.wikidata_id as string);
  const careerCounts = new Map<string, number>();

  const careerChunks: Promise<{ data: Record<string, unknown>[] | null }>[] = [];
  for (let i = 0; i < playerIds.length; i += 200) {
    const chunk = playerIds.slice(i, i + 200);
    careerChunks.push(
      supabase.from("football_careers").select("player_id, club_id, end_date")
        .in("player_id", chunk).limit(5000)
    );
  }

  const careerResults = await Promise.all(careerChunks);

  interface CareerRow { player_id: string; club_id: string; end_date: string | null }
  const allCareers: CareerRow[] = [];
  for (const res of careerResults) {
    for (const c of (res.data ?? []) as CareerRow[]) {
      careerCounts.set(c.player_id, (careerCounts.get(c.player_id) ?? 0) + 1);
      allCareers.push(c);
    }
  }

  const activePlayerIds = new Set<string>();
  if (activeOnly && allCareers.length > 0) {
    const clubIds = Array.from(new Set(allCareers.map((c) => c.club_id)));
    const nationalTeamIds = new Set<string>();

    const clubChunks: Promise<{ data: Record<string, unknown>[] | null }>[] = [];
    for (let i = 0; i < clubIds.length; i += 200) {
      const chunk = clubIds.slice(i, i + 200);
      clubChunks.push(
        supabase.from("football_clubs").select("wikidata_id, name").in("wikidata_id", chunk)
      );
    }
    const clubResults = await Promise.all(clubChunks);
    for (const res of clubResults) {
      for (const cl of res.data ?? []) {
        if ((cl.name as string).toLowerCase().includes("national")) {
          nationalTeamIds.add(cl.wikidata_id as string);
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
    ? rows.filter((p) => activePlayerIds.has(p.wikidata_id as string))
    : rows;
  if (filteredRows.length === 0) return NextResponse.json({ players: [] });

  const qNorm = stripAccents(q.trim());
  const ranked = filteredRows
    .map((p) => {
      let score = 0;
      const name = stripAccents(p.name as string);
      const nameWords = name.split(/\s+/);

      if (name === qNorm) score = 10000;
      else if (nameWords.includes(qNorm)) score = 5000;
      else if (name.startsWith(qNorm)) score = 3000;
      else if (nameWords.some((w: string) => w.startsWith(qNorm))) score = 2000;
      else score = 1000;

      score += Math.min(200, (careerCounts.get(p.wikidata_id as string) ?? 0) * 25);
      if (p.image_url) score += 50;
      if (p.date_of_birth) {
        const year = parseInt((p.date_of_birth as string).substring(0, 4));
        if (!isNaN(year) && year > 1960)
          score += Math.min(30, (year - 1960) / 2);
      }

      return { ...p, _score: score };
    })
    .sort((a, b) => (b._score as number) - (a._score as number))
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
    id: p.wikidata_id as string,
    name: p.name as string,
    nationality: countryMap.get((p.country_id as string) ?? "") ?? "",
    position: (p.position as string) ?? "",
    image: (p.image_url as string) ?? null,
  }));

  return NextResponse.json({ players });
}
