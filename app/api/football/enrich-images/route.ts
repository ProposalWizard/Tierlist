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

  // Ask Wikidata: "give me all footballers born in {year} who have images"
  const wikidataResults = await fetchFootballersWithImagesByYear(year);

  if (wikidataResults.length === 0) {
    return NextResponse.json({
      year,
      wikidataFound: 0,
      matched: 0,
      updated: 0,
    });
  }

  // Match against our database — only update players we actually have
  const wikidataIds = wikidataResults.map((r) => r.wikidata_id);
  const imageMap = new Map(wikidataResults.map((r) => [r.wikidata_id, r.image_url]));

  // Find which of these players exist in our DB
  const matchedIds: string[] = [];
  for (let i = 0; i < wikidataIds.length; i += 200) {
    const chunk = wikidataIds.slice(i, i + 200);
    const { data: existing } = await service
      .from("football_players")
      .select("wikidata_id")
      .in("wikidata_id", chunk);
    for (const row of existing ?? []) {
      matchedIds.push(row.wikidata_id);
    }
  }

  // Update image_url for matched players
  let updated = 0;
  if (matchedIds.length > 0) {
    const updates = matchedIds.map((id) => ({
      wikidata_id: id,
      image_url: imageMap.get(id)!,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < updates.length; i += 500) {
      await service.from("football_players").upsert(
        updates.slice(i, i + 500),
        { onConflict: "wikidata_id" }
      );
    }
    updated = matchedIds.length;
  }

  return NextResponse.json({
    year,
    wikidataFound: wikidataResults.length,
    matched: matchedIds.length,
    updated,
  });
}
