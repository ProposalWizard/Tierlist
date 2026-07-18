import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // First, try to fetch feedback. Select user_id only if it exists (migration may not have run).
  const { data, error } = await service
    .from("feedback")
    .select("id, message, page_url, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    // user_id column might not exist — retry without it
    const { data: data2, error: error2 } = await service
      .from("feedback")
      .select("id, message, page_url, created_at")
      .order("created_at", { ascending: false });

    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });

    const feedback = (data2 ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      message: row.message,
      page_url: row.page_url,
      created_at: row.created_at,
      username: null,
    }));

    return NextResponse.json({ feedback });
  }

  // Collect distinct user_ids to look up usernames in bulk
  const userIds = Array.from(new Set((data ?? []).map((r: Record<string, unknown>) => r.user_id).filter(Boolean))) as string[];
  const usernameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from("user_profiles")
      .select("id, username")
      .in("id", userIds);
    (profiles ?? []).forEach((p: { id: string; username: string | null }) => {
      if (p.username) usernameMap[p.id] = p.username;
    });
  }

  const feedback = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    message: row.message,
    page_url: row.page_url,
    created_at: row.created_at,
    username: (row.user_id && usernameMap[row.user_id as string]) ? usernameMap[row.user_id as string] : null,
  }));

  return NextResponse.json({ feedback });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("feedback").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
