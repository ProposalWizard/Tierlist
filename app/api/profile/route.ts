import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profile — return current user's profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(data);
}

// PUT /api/profile — update username / anonymous flag
export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const username: string | null = body.username?.trim() || null;
  const is_anonymous: boolean = !!body.is_anonymous;

  const { error } = await supabase
    .from("user_profiles")
    .update({ username, is_anonymous, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    const msg = error.message.includes("unique")
      ? "That username is already taken."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
