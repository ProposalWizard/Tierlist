import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const playerId = searchParams.get("player");
  const service = createServiceClient();

  if (query) {
    try {
      const { data } = await service
        .from("football_players")
        .select("wikidata_id, name, date_of_birth, country_id, position, image_url")
        .ilike("name", `%${query}%`)
        .limit(200);

      const rows = data ?? [];
      if (rows.length === 0) return NextResponse.json({ players: [] });

      const playerIds = rows.map((p) => p.wikidata_id);
      const careerCounts = new Map<string, number>();
      for (let i = 0; i < playerIds.length; i += 200) {
        const chunk = playerIds.slice(i, i + 200);
        const { data: careers } = await service
          .from("football_careers")
          .select("player_id")
          .in("player_id", chunk)
          .limit(5000);
        for (const c of careers ?? []) {
          careerCounts.set(c.player_id, (careerCounts.get(c.player_id) ?? 0) + 1);
        }
      }

      const qLower = query.toLowerCase().trim();
      const ranked = rows
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
        .slice(0, 30);

      const countryIds = Array.from(new Set(ranked.map((p) => p.country_id).filter(Boolean))) as string[];
      const countryMap = await getCountryMap(service, countryIds);

      const players = ranked.map((p) => ({
        id: p.wikidata_id,
        name: p.name,
        nationality: countryMap.get(p.country_id ?? "") ?? "",
        position: p.position ?? "",
        dob: p.date_of_birth ?? "",
        image: p.image_url ?? null,
      }));

      return NextResponse.json({ players });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (playerId) {
    try {
      const { data: playerRow } = await service
        .from("football_players")
        .select("wikidata_id, name, date_of_birth, country_id, position, image_url")
        .eq("wikidata_id", playerId)
        .single();

      if (!playerRow) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }

      const countryMap = await getCountryMap(service, playerRow.country_id ? [playerRow.country_id] : []);

      const player = {
        id: playerRow.wikidata_id,
        name: playerRow.name,
        nationality: countryMap.get(playerRow.country_id ?? "") ?? "",
        position: playerRow.position ?? "",
        dob: playerRow.date_of_birth ?? "",
        image: playerRow.image_url ?? null,
      };

      const { data: careerRows } = await service
        .from("football_careers")
        .select("club_id, start_date, end_date")
        .eq("player_id", playerId)
        .order("start_date", { ascending: true });

      const clubIds = Array.from(new Set((careerRows ?? []).map((c) => c.club_id)));
      const clubMap = await getClubNameMap(service, clubIds);

      const career = (careerRows ?? []).map((c) => ({
        team: clubMap.get(c.club_id) ?? "",
        teamId: c.club_id,
        startDate: c.start_date || null,
        endDate: c.end_date || null,
      }));

      return NextResponse.json({ player, career });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Provide q or player param" }, { status: 400 });
}

async function getCountryMap(service: ReturnType<typeof createServiceClient>, ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await service.from("football_countries").select("wikidata_id, name").in("wikidata_id", ids);
  for (const c of data ?? []) map.set(c.wikidata_id, c.name);
  return map;
}

async function getClubNameMap(service: ReturnType<typeof createServiceClient>, ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await service.from("football_clubs").select("wikidata_id, name").in("wikidata_id", ids);
  for (const c of data ?? []) map.set(c.wikidata_id, c.name);
  return map;
}
