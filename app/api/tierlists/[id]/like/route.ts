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
    .from("tierlist_likes")
    .select("*", { count: "exact", head: true })
    .eq("tierlist_id", id);

  let liked = false;
  if (user) {
    const { data } = await supabase
      .from("tierlist_likes")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("tierlist_id", id)
      .maybeSingle();
    liked = !!data;
  }

  return NextResponse.json({ liked, count: count ?? 0, isLoggedIn: !!user });
}

// POST /api/tierlists/[id]/like — toggle like for current user
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Check if already liked
  const { data: existing } = await supabase
    .from("tierlist_likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("tierlist_id", id)
    .maybeSingle();

  if (existing) {
    // Unlike
    await supabase
      .from("tierlist_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("tierlist_id", id);
  } else {
    // Like
    await supabase
      .from("tierlist_likes")
      .insert({ user_id: user.id, tierlist_id: id });
  }

  // Return new count + state
  const { count } = await supabase
    .from("tierlist_likes")
    .select("*", { count: "exact", head: true })
    .eq("tierlist_id", id);

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
