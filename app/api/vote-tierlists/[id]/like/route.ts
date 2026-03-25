export const runtime = "edge";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface Props { params: Promise<{ id: string }> }

// POST /api/vote-tierlists/[id]/like — toggle like for current user
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: existing } = await supabase
    .from("vote_tierlist_likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("vote_tierlist_id", id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("vote_tierlist_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("vote_tierlist_id", id);
  } else {
    await supabase
      .from("vote_tierlist_likes")
      .insert({ user_id: user.id, vote_tierlist_id: id });
  }

  const { count } = await supabase
    .from("vote_tierlist_likes")
    .select("*", { count: "exact", head: true })
    .eq("vote_tierlist_id", id);

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
