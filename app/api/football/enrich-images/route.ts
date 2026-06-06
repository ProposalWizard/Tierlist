import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { fetchPlayerDetails } from "@/lib/footballImport";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
  const batchSize = 150;
  const service = createServiceClient();

  // Get players without images who have position data (enriched players only)
  const { data: players } = await service
    .from("football_players")
    .select("wikidata_id")
    .is("image_url", null)
    .not("position", "is", null)
    .order("wikidata_id")
    .range(offset, offset + batchSize - 1);

  const ids = (players ?? []).map((r: { wikidata_id: string }) => r.wikidata_id);
  if (ids.length === 0) {
    return NextResponse.json({ done: true, checked: 0, found: 0, offset });
  }

  const { details } = await fetchPlayerDetails(ids);
  const withImages = details.filter((d) => d.image_url);

  if (withImages.length > 0) {
    for (let i = 0; i < withImages.length; i += 500) {
      await service.from("football_players").upsert(
        withImages.slice(i, i + 500).map((d) => ({
          wikidata_id: d.wikidata_id,
          image_url: d.image_url,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "wikidata_id" }
      );
    }
  }

  const hasMore = ids.length === batchSize;
  return NextResponse.json({
    done: !hasMore,
    checked: ids.length,
    found: withImages.length,
    offset,
    nextOffset: hasMore ? offset + batchSize : null,
  });
}
