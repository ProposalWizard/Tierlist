import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { frame, title } = body as { frame?: string; title?: string };

  if (!frame && !title) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const svc = createServiceClient();

  if (frame) {
    const { data: owned } = await svc
      .from("user_rewards")
      .select("reward_id")
      .eq("user_id", user.id)
      .eq("reward_id", frame)
      .maybeSingle();

    if (!owned && frame !== "frame_default") {
      return NextResponse.json({ error: "Frame not unlocked" }, { status: 403 });
    }
  }

  if (title) {
    const { data: owned } = await svc
      .from("user_rewards")
      .select("reward_id")
      .eq("user_id", user.id)
      .eq("reward_id", title)
      .maybeSingle();

    if (!owned && title !== "title_rookie") {
      return NextResponse.json({ error: "Title not unlocked" }, { status: 403 });
    }
  }

  const updates: Record<string, string> = {};
  if (frame) updates.equipped_frame = frame;
  if (title) updates.equipped_title = title;

  const { error } = await svc
    .from("user_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
