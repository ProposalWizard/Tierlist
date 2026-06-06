import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { fetchPlayerImages } from "@/lib/footballImport";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
  const service = createServiceClient();

  // Get distinct player_ids from careers table (players with career data = notable)
  // Using a large range and deduplicating in JS since PostgREST can't do DISTINCT
  const { data: careerRows } = await service
    .from("football_careers")
    .select("player_id")
    .order("player_id")
    .range(offset, offset + 2999);

  if (!careerRows || careerRows.length === 0) {
    return NextResponse.json({ done: true, checked: 0, found: 0, offset });
  }

  const uniqueIds = Array.from(new Set(careerRows.map((c: { player_id: string }) => c.player_id)));

  // Check which of these don't have images
  const { data: needImages } = await service
    .from("football_players")
    .select("wikidata_id")
    .in("wikidata_id", uniqueIds)
    .is("image_url", null);

  const idsToCheck = (needImages ?? []).map((r: { wikidata_id: string }) => r.wikidata_id);

  if (idsToCheck.length === 0) {
    const hasMore = careerRows.length === 3000;
    return NextResponse.json({
      done: !hasMore,
      checked: 0,
      found: 0,
      offset,
      nextOffset: hasMore ? offset + 3000 : null,
      note: `${uniqueIds.length} players already have images`,
    });
  }

  // Use fast image-only SPARQL query (no OPTIONAL — only returns players with images)
  // Process in sub-batches of 200 (Wikidata VALUES limit)
  let totalFound = 0;
  for (let i = 0; i < idsToCheck.length; i += 200) {
    const batch = idsToCheck.slice(i, i + 200);
    const results = await fetchPlayerImages(batch);

    if (results.length > 0) {
      await service.from("football_players").upsert(
        results.map((r) => ({
          wikidata_id: r.wikidata_id,
          image_url: r.image_url,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "wikidata_id" }
      );
      totalFound += results.length;
    }
  }

  const hasMore = careerRows.length === 3000;
  return NextResponse.json({
    done: !hasMore,
    checked: idsToCheck.length,
    found: totalFound,
    offset,
    nextOffset: hasMore ? offset + 3000 : null,
  });
}
