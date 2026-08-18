import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);

  const { data } = await supabase
    .from("star_careers")
    .select("career")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(data?.career ?? null);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);

  let career: unknown;
  try { career = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await supabase
    .from("star_careers")
    .upsert(
      { user_id: user.id, career, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);

  await supabase.from("star_careers").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
