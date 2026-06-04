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
        .limit(30);

      const rows = data ?? [];
      const countryIds = Array.from(new Set(rows.map((p) => p.country_id).filter(Boolean))) as string[];
      const countryMap = await getCountryMap(service, countryIds);

      const players = rows.map((p) => ({
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
