import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Admin edits to season rewards must show up immediately — without this the
// route is statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const [configRes, rewardsRes] = await Promise.all([
    supabase.from("season_config").select("season, name, total_levels").eq("season", 1).maybeSingle(),
    supabase.from("season_level_rewards")
      .select("id, season, level, card_name, subtitle, card_library(image_url)")
      .eq("season", 1)
      .order("level", { ascending: true }),
  ]);

  if (configRes.error || rewardsRes.error) {
    return NextResponse.json({
      config: { season: 1, name: "Season 1", total_levels: 50 },
      rewards: [],
    });
  }

  const rewards = (rewardsRes.data ?? []).map((r) => {
    const lib = r.card_library as unknown as { image_url: string } | null;
    return {
      id: r.id,
      season: r.season,
      level: r.level,
      card_name: r.card_name,
      subtitle: r.subtitle,
      image_url: lib?.image_url ?? null,
    };
  });

  return NextResponse.json({
    config: configRes.data ?? { season: 1, name: "Season 1", total_levels: 50 },
    rewards,
  });
}
