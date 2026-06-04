import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const club1 = req.nextUrl.searchParams.get("club1");
  const club2 = req.nextUrl.searchParams.get("club2");
  if (!club1 || !club2) {
    return NextResponse.json({ error: "club1 and club2 params required" }, { status: 400 });
  }

  try {
    const service = createServiceClient();

    const [{ data: careers1 }, { data: careers2 }] = await Promise.all([
      service.from("football_careers").select("player_id").eq("club_id", club1),
      service.from("football_careers").select("player_id").eq("club_id", club2),
    ]);

    const set1 = new Set((careers1 ?? []).map((c) => c.player_id));
    const commonIds = Array.from(new Set(
      (careers2 ?? []).map((c) => c.player_id).filter((id: string) => set1.has(id))
    ));

    if (commonIds.length === 0) {
      return NextResponse.json({ players: [] });
    }

    const { data: playerRows } = await service
      .from("football_players")
      .select("wikidata_id, name, date_of_birth, country_id, position, image_url")
      .in("wikidata_id", commonIds);

    const countryIds = Array.from(new Set((playerRows ?? []).map((p) => p.country_id).filter(Boolean))) as string[];
    const countryMap = new Map<string, string>();
    if (countryIds.length > 0) {
      const { data: countries } = await service
        .from("football_countries")
        .select("wikidata_id, name")
        .in("wikidata_id", countryIds);
      for (const c of countries ?? []) countryMap.set(c.wikidata_id, c.name);
    }

    const players = (playerRows ?? []).map((p) => ({
      id: p.wikidata_id,
      name: p.name,
      nationality: countryMap.get(p.country_id ?? "") ?? "",
      position: p.position ?? "",
      dob: p.date_of_birth ?? "",
      image: p.image_url ?? null,
    }));

    return NextResponse.json({ players });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Query failed" },
      { status: 500 },
    );
  }
}
