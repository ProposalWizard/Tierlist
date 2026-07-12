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

  // Surface write failures — otherwise the response claims the toggle
  // happened (filled heart) when nothing was written (e.g. the tierlist was
  // deleted between page load and the click → FK violation).
  if (existing) {
    // Unlike
    const { error } = await supabase
      .from("tierlist_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("tierlist_id", id);
    if (error) return NextResponse.json({ error: "Failed to unlike" }, { status: 500 });
  } else {
    // Like
    const { error } = await supabase
      .from("tierlist_likes")
      .insert({ user_id: user.id, tierlist_id: id });
    // 23505 = already liked (double-tap race) — treat as success, it's liked.
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "Failed to like" }, { status: 500 });
    }
  }

  // Return new count + state
  const { count } = await supabase
    .from("tierlist_likes")
    .select("*", { count: "exact", head: true })
    .eq("tierlist_id", id);

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
