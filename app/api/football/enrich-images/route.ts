import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { fetchFootballersWithImagesByYear } from "@/lib/footballImport";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year } = await req.json().catch(() => ({ year: 2000 }));
  const service = createServiceClient();

  const wikidataResults = await fetchFootballersWithImagesByYear(year);

  if (wikidataResults.length === 0) {
    return NextResponse.json({ year, wikidataFound: 0, matched: 0, updated: 0 });
  }

  const wikidataIds = wikidataResults.map((r) => r.wikidata_id);
  const imageMap = new Map(wikidataResults.map((r) => [r.wikidata_id, r.image_url]));

  // Find which players exist in our DB — include name to satisfy NOT NULL on upsert
  const matchedPlayers: { wikidata_id: string; name: string }[] = [];
  for (let i = 0; i < wikidataIds.length; i += 200) {
    const chunk = wikidataIds.slice(i, i + 200);
    const { data: existing } = await service
      .from("football_players")
      .select("wikidata_id, name")
      .in("wikidata_id", chunk);
    for (const row of existing ?? []) {
      matchedPlayers.push({ wikidata_id: row.wikidata_id, name: row.name });
    }
  }

  let updated = 0;
  let errors: string[] = [];

  if (matchedPlayers.length > 0) {
    const updates = matchedPlayers.map((p) => ({
      wikidata_id: p.wikidata_id,
      name: p.name,
      image_url: imageMap.get(p.wikidata_id)!,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < updates.length; i += 500) {
      const { error } = await service.from("football_players").upsert(
        updates.slice(i, i + 500),
        { onConflict: "wikidata_id" }
      );
      if (error) {
        errors.push(error.message);
      } else {
        updated += updates.slice(i, i + 500).length;
      }
    }
  }

  return NextResponse.json({
    year,
    wikidataFound: wikidataResults.length,
    matched: matchedPlayers.length,
    updated,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
