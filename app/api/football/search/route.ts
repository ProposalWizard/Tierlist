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

// Cache national team IDs in memory (refreshed every 10 minutes)
let nationalTeamCache: Set<string> | null = null;
let nationalTeamCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getNationalTeamIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Set<string>> {
  if (nationalTeamCache && Date.now() - nationalTeamCacheTime < CACHE_TTL) {
    return nationalTeamCache;
  }
  const { data } = await supabase
    .from("football_clubs")
    .select("wikidata_id, name")
    .ilike("name", "%national%");
  nationalTeamCache = new Set((data ?? []).map((c) => c.wikidata_id));
  nationalTeamCacheTime = Date.now();
  return nationalTeamCache;
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

  // 1. Search players — order by popularity so famous players come first
  const { data: r1Data } = await supabase
    .from("football_players")
    .select(cols)
    .ilike("name", `%${q}%`)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(80);

  // Merge with accent-stripped search only if different
  let r2Data: PlayerRow[] = [];
  if (qStripped !== q.toLowerCase()) {
    const { data } = await supabase
      .from("football_players")
      .select(cols)
      .ilike("name", `%${qStripped}%`)
      .order("popularity", { ascending: false, nullsFirst: false })
      .limit(80);
    r2Data = (data ?? []) as PlayerRow[];
  }

  const seen = new Set<string>();
  const rows: PlayerRow[] = [];
  for (const r of [...((r1Data ?? []) as PlayerRow[]), ...r2Data]) {
    if (seen.has(r.wikidata_id)) continue;
    seen.add(r.wikidata_id);
    if (stripAccents(r.name).includes(qStripped)) rows.push(r);
  }

  if (rows.length === 0) return NextResponse.json({ players: [] });

  // 2. Active filtering — fetch careers only for matched players
  let activePlayerIds: Set<string> | null = null;
  if (activeOnly) {
    const nationalTeamIds = await getNationalTeamIds(supabase);
    const playerIds = rows.map((p) => p.wikidata_id);

    const { data: careers } = await supabase
      .from("football_careers")
      .select("player_id, club_id, end_date")
      .in("player_id", playerIds)
      .limit(5000);

    activePlayerIds = new Set<string>();
    for (const c of (careers ?? []) as { player_id: string; club_id: string; end_date: string | null }[]) {
      if (nationalTeamIds.has(c.club_id)) continue;
      if (!c.end_date || c.end_date >= "2026") {
        activePlayerIds.add(c.player_id);
      }
    }
  }

  const filteredRows = activePlayerIds
    ? rows.filter((p) => activePlayerIds!.has(p.wikidata_id))
    : rows;
  if (filteredRows.length === 0) return NextResponse.json({ players: [] });

  // 3. Fetch popularity scores for candidates (safe if column doesn't exist yet)
  const popMap = new Map<string, number>();
  const candidateIds = filteredRows.map((p) => p.wikidata_id);
  try {
    const { data: popData } = await supabase
      .from("football_players")
      .select("wikidata_id, popularity")
      .in("wikidata_id", candidateIds)
      .not("popularity", "eq", 0);
    for (const p of popData ?? []) {
      popMap.set(p.wikidata_id, p.popularity ?? 0);
    }
  } catch {
    // Column doesn't exist yet — skip
  }

  // 4. Rank and pick top 15
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

      score += popMap.get(p.wikidata_id) ?? 0;
      if (p.image_url) score += 100;
      if (p.date_of_birth) {
        const year = parseInt(p.date_of_birth.substring(0, 4));
        if (!isNaN(year) && year > 1960)
          score += Math.min(30, (year - 1960) / 2);
      }

      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 15);

  // 4. Get country names for the final 15 only
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
    if (image) {
      const fileMatch = image.match(/Special:FilePath\/(.+)$/);
      if (fileMatch) {
        image = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(decodeURIComponent(fileMatch[1]))}&w=200`;
      } else if (image.startsWith("http://")) {
        image = image.replace("http://", "https://");
      }
    }
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
