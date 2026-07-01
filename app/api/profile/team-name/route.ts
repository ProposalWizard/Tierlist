import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ teamName: null });

  const { data } = await supabase
    .from("user_profiles")
    .select("team_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ teamName: data?.team_name ?? null });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const teamName: string = (body.teamName ?? "").trim().slice(0, 50);
  if (!teamName) return NextResponse.json({ error: "Team name is required" }, { status: 400 });

  const service = createServiceClient();
  await service
    .from("user_profiles")
    .update({ team_name: teamName })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
