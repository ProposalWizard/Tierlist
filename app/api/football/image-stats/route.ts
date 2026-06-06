import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const service = createServiceClient();

  const [totalRes, withImageRes, sampleRes] = await Promise.all([
    service.from("football_players").select("wikidata_id", { count: "exact", head: true }),
    service.from("football_players").select("wikidata_id", { count: "exact", head: true }).not("image_url", "is", null),
    service.from("football_players").select("wikidata_id, name, image_url").not("image_url", "is", null).limit(5),
  ]);

  return NextResponse.json({
    total_players: totalRes.count ?? 0,
    with_image: withImageRes.count ?? 0,
    sample: (sampleRes.data ?? []).map((p) => ({ name: p.name, image_url: p.image_url })),
  });
}
