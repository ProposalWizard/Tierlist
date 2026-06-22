import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();

  // Fetch room to verify host
  const { data: room } = await service
    .from("draft_rooms")
    .select("id, host_id, settings")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });
  if (room.host_id !== user.id) return new Response("Only the host can update settings", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const newSettings = body.settings;
  if (!newSettings || typeof newSettings !== "object") {
    return new Response("Invalid settings", { status: 400 });
  }

  // Merge with existing settings (preserve formation and any fields not sent)
  const merged = { ...(room.settings as Record<string, unknown> ?? {}), ...newSettings };

  const { error } = await service
    .from("draft_rooms")
    .update({ settings: merged })
    .eq("id", room.id);

  if (error) return new Response("Failed to update settings", { status: 500 });

  return Response.json({ settings: merged });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const service = createServiceClient();

  const { data: room, error } = await service
    .from("draft_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !room) return new Response("Room not found", { status: 404 });

  // Fetch squad during lobby/simulating so the squad preview works while waiting
  // Only omit season_result (heavy) until the room is complete
  const columns = room.status === "complete"
    ? "id, user_id, display_name, status, avg_ovr, team_strength, actual_finish, squad, season_result, joined_at"
    : "id, user_id, display_name, status, avg_ovr, team_strength, actual_finish, squad, joined_at";

  const { data: players } = await service
    .from("draft_room_players")
    .select(columns)
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  return Response.json(
    { room, players: players ?? [] },
    { headers: room.status !== "complete" ? { "Cache-Control": "no-store" } : {} }
  );
}
