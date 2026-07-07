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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username: string | null = typeof body.username === "string" ? body.username.trim() || null : null;
  const is_anonymous: boolean = !!body.is_anonymous;

  // Validate username format and length
  if (username !== null) {
    if (username.length > 30) {
      return NextResponse.json({ error: "Username must be 30 characters or fewer." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores." }, { status: 400 });
    }
  }

  const service = createServiceClient();

  // Each user gets one free username change (no cooldown). After that: once per 30 days.
  // "First-time setup" = when they have no username yet (e.g. the /setup-username flow).
  // That doesn't count against the free pass; the free pass is the first voluntary change
  // made after a username already exists.
  let isFirstTimeSetup = false;
  if (username !== null) {
    const { data: profile } = await service
      .from("user_profiles")
      .select("username, username_changed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    isFirstTimeSetup = !profile?.username;
    const isActualChange = profile?.username !== username;
    const changedAt = profile?.username_changed_at as string | null | undefined;
    // Only enforce cooldown when changing an existing username and the free pass is used
    if (isActualChange && !isFirstTimeSetup && changedAt) {
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
  // Don't stamp username_changed_at during first-time setup — that preserves the free pass.
  // The timestamp is only written when the user voluntarily changes an existing username.
  if (username !== null && !isFirstTimeSetup) {
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
