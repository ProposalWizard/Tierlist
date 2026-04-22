import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count } = await service
    .from("blind_ranking_likes")
    .select("*", { count: "exact", head: true })
    .eq("blind_ranking_id", id);

  let liked = false;
  if (user) {
    const { data } = await supabase
      .from("blind_ranking_likes")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("blind_ranking_id", id)
      .maybeSingle();
    liked = !!data;
  }

  return NextResponse.json({ liked, count: count ?? 0, isLoggedIn: !!user });
}

export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: existing } = await supabase
    .from("blind_ranking_likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("blind_ranking_id", id)
    .maybeSingle();

  if (existing) {
    await supabase.from("blind_ranking_likes").delete()
      .eq("user_id", user.id).eq("blind_ranking_id", id);
  } else {
    await supabase.from("blind_ranking_likes")
      .insert({ user_id: user.id, blind_ranking_id: id });
  }

  const service = createServiceClient();
  const { count } = await service
    .from("blind_ranking_likes")
    .select("*", { count: "exact", head: true })
    .eq("blind_ranking_id", id);

  return NextResponse.json({ liked: !existing, count: count ?? 0, isLoggedIn: true });
}
