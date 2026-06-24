import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !(await isAdmin(user.id))) return false;
  return true;
}

export async function GET() {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const supabase = createServiceClient();

  const [configRes, rewardsRes] = await Promise.all([
    supabase.from("season_config").select("*").eq("season", 1).maybeSingle(),
    supabase.from("season_level_rewards")
      .select("id, season, level, card_library_id, card_name, subtitle, card_library(id, name, image_url)")
      .eq("season", 1)
      .order("level", { ascending: true }),
  ]);

  return NextResponse.json({
    config: configRes.data ?? { season: 1, name: "Season 1", total_levels: 50 },
    rewards: rewardsRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const body = await req.json();
  const { season = 1, level, card_library_id, card_name, subtitle } = body;
  if (!level || level < 1) return new NextResponse("Invalid level", { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("season_level_rewards")
    .upsert(
      { season, level, card_library_id: card_library_id ?? null, card_name: card_name ?? null, subtitle: subtitle ?? null },
      { onConflict: "season,level" }
    )
    .select("id, season, level, card_library_id, card_name, subtitle, card_library(id, name, image_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { total_levels } = await req.json();
  if (!total_levels || total_levels < 1 || total_levels > 500) {
    return new NextResponse("Invalid total_levels", { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("season_config")
    .upsert({ season: 1, total_levels }, { onConflict: "season" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("season_level_rewards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
