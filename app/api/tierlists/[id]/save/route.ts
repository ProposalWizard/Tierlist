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

  // Surface write failures — otherwise the response claims the toggle happened
  // (filled bookmark icon) when nothing was written, e.g. the tierlist was
  // deleted between page load and the click, giving an FK violation.
  if (existing) {
    const { error } = await supabase
      .from("saved_tierlists")
      .delete()
      .eq("user_id", user.id)
      .eq("tierlist_id", id);
    if (error) return NextResponse.json({ error: "Failed to unsave" }, { status: 500 });
    return NextResponse.json({ saved: false });
  } else {
    const { error } = await supabase
      .from("saved_tierlists")
      .insert({ user_id: user.id, tierlist_id: id });
    // 23505 = already saved (double-tap race) — treat as success, it is saved.
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ saved: true });
  }
}
