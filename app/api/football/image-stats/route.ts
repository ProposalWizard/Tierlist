import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const service = createServiceClient();

  const [totalRes, withImageRes, sampleWithRes, sampleWithoutRes] = await Promise.all([
    service.from("football_players").select("wikidata_id", { count: "exact", head: true }),
    service.from("football_players").select("wikidata_id", { count: "exact", head: true }).not("image_url", "is", null),
    service.from("football_players").select("wikidata_id, name, image_url").not("image_url", "is", null).limit(20),
    service.from("football_players").select("wikidata_id, name").is("image_url", null).limit(20),
  ]);

  const total = totalRes.count ?? 0;
  const withImage = withImageRes.count ?? 0;

  return NextResponse.json({
    total_players: total,
    players_with_image: withImage,
    players_without_image: total - withImage,
    percentage: total > 0 ? `${((withImage / total) * 100).toFixed(1)}%` : "0%",
    sample_with_images: (sampleWithRes.data ?? []).map((p) => ({ name: p.name, image_url: p.image_url })),
    sample_without_images: (sampleWithoutRes.data ?? []).map((p) => p.name),
  });
}
