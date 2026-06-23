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
  const clubId = searchParams.get("club");
  const history = searchParams.get("history") === "true";

  if (!clubId) {
    return NextResponse.json({ error: "club param required" }, { status: 400 });
  }

  try {
    const service = createServiceClient();

    const { data: clubRow } = await service
      .from("football_clubs")
      .select("wikidata_id, name, country, league")
      .eq("wikidata_id", clubId)
      .single();

    const club = clubRow
      ? {
          id: clubRow.wikidata_id,
          name: clubRow.name,
          country: clubRow.country ?? "",
          league: clubRow.league ?? null,
          image: null,
        }
      : { id: clubId, name: clubId, country: "", league: null, image: null };

    let careerQuery = service
      .from("football_careers")
      .select("player_id, start_date, end_date")
      .eq("club_id", clubId);

    if (!history) {
      careerQuery = careerQuery.or("end_date.is.null,end_date.eq.");
    }

    const { data: careerRows } = await careerQuery.order("start_date", { ascending: false });

    const playerIds = Array.from(new Set((careerRows ?? []).map((c) => c.player_id)));

    if (playerIds.length === 0) {
      return NextResponse.json({ club, players: [] });
    }

    // Fetch players in chunks
    const allPlayers: Record<string, unknown>[] = [];
    for (let i = 0; i < playerIds.length; i += 500) {
      const chunk = playerIds.slice(i, i + 500);
      const { data: rows } = await service
        .from("football_players")
        .select("wikidata_id, name, country_id, position")
        .in("wikidata_id", chunk);
      if (rows) allPlayers.push(...rows);
    }

    // Get country names
    const countryIds = Array.from(new Set(allPlayers.map((p) => p.country_id as string).filter(Boolean)));
    const countryMap = new Map<string, string>();
    if (countryIds.length > 0) {
      const { data: countries } = await service
        .from("football_countries")
        .select("wikidata_id, name")
        .in("wikidata_id", countryIds);
      for (const c of countries ?? []) countryMap.set(c.wikidata_id, c.name);
    }

    const playerMap = new Map(allPlayers.map((p) => [p.wikidata_id as string, p]));

    const careerMap = new Map<string, { startDate: string | null; endDate: string | null }>();
    for (const c of careerRows ?? []) {
      if (!careerMap.has(c.player_id)) {
        careerMap.set(c.player_id, {
          startDate: c.start_date || null,
          endDate: c.end_date || null,
        });
      }
    }

    const players = playerIds
      .map((pid) => {
        const p = playerMap.get(pid);
        if (!p) return null;
        const career = careerMap.get(pid);
        return {
          id: p.wikidata_id as string,
          name: p.name as string,
          nationality: countryMap.get((p.country_id as string) ?? "") ?? "",
          position: (p.position as string) ?? "",
          dob: "",
          image: null,
          startDate: career?.startDate ?? null,
          endDate: career?.endDate ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ club, players });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
