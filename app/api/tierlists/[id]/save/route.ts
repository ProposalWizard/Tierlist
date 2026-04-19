import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ saved: false, isLoggedIn: false });

  const { data } = await supabase
    .from("saved_tierlists")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("tierlist_id", id)
    .maybeSingle();

  return NextResponse.json({ saved: !!data, isLoggedIn: true });
}

// POST /api/tierlists/[id]/save — toggle bookmark for current user
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: existing } = await supabase
    .from("saved_tierlists")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("tierlist_id", id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("saved_tierlists")
      .delete()
      .eq("user_id", user.id)
      .eq("tierlist_id", id);
    return NextResponse.json({ saved: false });
  } else {
    await supabase
      .from("saved_tierlists")
      .insert({ user_id: user.id, tierlist_id: id });
    return NextResponse.json({ saved: true });
  }
}
