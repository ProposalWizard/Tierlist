import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  const service = createServiceClient();

  // Rate-limit username changes to once per 30 days
  if (username !== null) {
    const { data: profile } = await service
      .from("user_profiles")
      .select("username, username_changed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const isActualChange = profile?.username !== username;
    const changedAt = profile?.username_changed_at as string | null | undefined;
    if (isActualChange && changedAt) {
      const daysSince = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const daysLeft = Math.ceil(30 - daysSince);
        return NextResponse.json(
          { error: `You can change your username again in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.` },
          { status: 429 }
        );
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    username,
    is_anonymous,
    updated_at: new Date().toISOString(),
  };
  if (username !== null) {
    updatePayload.username_changed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(updatePayload)
    .eq("user_id", user.id);

  if (error) {
    const msg = error.message.includes("unique")
      ? "That username is already taken."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Propagate new username to all draft records for this user
  if (username) {
    await service
      .from("draft_records")
      .update({ username })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
