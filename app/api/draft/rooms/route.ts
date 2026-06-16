import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const settings = body.settings ?? null;

  const service = createServiceClient();

  // Generate unique 6-char code
  let code = "";
  let attempts = 0;
  while (attempts < 10) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: existing } = await service.from("draft_rooms").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
    attempts++;
  }

  const { data: room, error } = await service
    .from("draft_rooms")
    .insert({ code, host_id: user.id, status: "lobby", settings })
    .select()
    .single();

  if (error || !room) return new Response("Failed to create room", { status: 500 });

  // Get display name
  const { data: profile } = await service
    .from("user_profiles")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.username || user.email?.split("@")[0] || "Player";

  await service.from("draft_room_players").insert({
    room_id: room.id,
    user_id: user.id,
    display_name: displayName,
    status: "drafting",
  });

  return Response.json({ code: room.code, room_id: room.id });
}
