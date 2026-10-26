import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { notGuest } from "@/lib/guest/config";

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user: signedIn } } = await supabase.auth.getUser();
  const user = notGuest(signedIn); // a guest counts as signed out (lib/guest/config.ts)

  const { count } = await service
    .from("vote_tierlist_likes")
    .select("*", { count: "exact", head: true })
    .eq("vote_tierlist_id", id);

  let liked = false;
  if (user) {
    const { data } = await supabase
      .from("vote_tierlist_likes")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("vote_tierlist_id", id)
      .maybeSingle();
    liked = !!data;
  }

  return NextResponse.json({ liked, count: count ?? 0, isLoggedIn: !!user });
}

// POST /api/vote-tierlists/[id]/like — toggle like for current user
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: signedIn } } = await supabase.auth.getUser();
  const user = notGuest(signedIn); // a guest counts as signed out (lib/guest/config.ts)
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

  return NextResponse.json({ liked: !existing, count: count ?? 0, isLoggedIn: true });
}
