import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface PlayerRow {
  wikidata_id: string;
  name: string;
  date_of_birth: string | null;
  country_id: string | null;
  position: string | null;
  image_url: string | null;
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

  const [r1, r2] = await Promise.all([
    supabase.from("football_players").select(cols).ilike("name", `%${q}%`).limit(200),
    qStripped !== q.toLowerCase()
      ? supabase.from("football_players").select(cols).ilike("name", `%${qStripped}%`).limit(200)
      : Promise.resolve({ data: null }),
  ]);

  const seen = new Set<string>();
  const rows: PlayerRow[] = [];
  for (const r of [...((r1.data ?? []) as PlayerRow[]), ...((r2.data ?? []) as PlayerRow[])]) {
    if (seen.has(r.wikidata_id)) continue;
    seen.add(r.wikidata_id);
    if (stripAccents(r.name).includes(qStripped)) rows.push(r);
  }

  if (rows.length === 0) return NextResponse.json({ players: [] });

  const playerIds = rows.map((p) => p.wikidata_id);
  const careerCounts = new Map<string, number>();

  const careerResults = await Promise.all(
    Array.from({ length: Math.ceil(playerIds.length / 200) }, (_, i) => {
      const chunk = playerIds.slice(i * 200, i * 200 + 200);
      return supabase.from("football_careers").select("player_id, club_id, end_date")
        .in("player_id", chunk).limit(5000);
    })
  );

  interface CareerRow { player_id: string; club_id: string; end_date: string | null }
  const allCareers: CareerRow[] = [];
  for (const res of careerResults) {
    for (const c of (res.data ?? []) as unknown as CareerRow[]) {
      careerCounts.set(c.player_id, (careerCounts.get(c.player_id) ?? 0) + 1);
      allCareers.push(c);
    }
  }

  const activePlayerIds = new Set<string>();
  if (activeOnly && allCareers.length > 0) {
    const clubIds = Array.from(new Set(allCareers.map((c) => c.club_id)));
    const nationalTeamIds = new Set<string>();

    const clubResults = await Promise.all(
      Array.from({ length: Math.ceil(clubIds.length / 200) }, (_, i) => {
        const chunk = clubIds.slice(i * 200, i * 200 + 200);
        return supabase.from("football_clubs").select("wikidata_id, name").in("wikidata_id", chunk);
      })
    );
    for (const res of clubResults) {
      for (const cl of (res.data ?? []) as { wikidata_id: string; name: string }[]) {
        if (cl.name.toLowerCase().includes("national")) {
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

  const qNorm = stripAccents(q.trim());
  const ranked = filteredRows
    .map((p) => {
      let score = 0;
      const name = stripAccents(p.name);
      const nameWords = name.split(/\s+/);

      if (name === qNorm) score = 10000;
      else if (nameWords.includes(qNorm)) score = 5000;
      else if (name.startsWith(qNorm)) score = 3000;
      else if (nameWords.some((w) => w.startsWith(qNorm))) score = 2000;
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

  const players = ranked.map((p) => {
    let image = p.image_url ?? null;
    if (image && image.startsWith("http://")) image = image.replace("http://", "https://");
    return {
      id: p.wikidata_id,
      name: p.name,
      nationality: countryMap.get(p.country_id ?? "") ?? "",
      position: p.position ?? "",
      image,
    };
  });

  return NextResponse.json({ players });
}
