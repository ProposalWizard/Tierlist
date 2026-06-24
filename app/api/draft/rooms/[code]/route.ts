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

  const updates: Record<string, unknown> = {};

  // Allow host to set room status to "started" to kick off the game for all players
  if (body.status === "started") {
    updates.status = "started";
  }

  const newSettings = body.settings;
  if (newSettings && typeof newSettings === "object") {
    const merged = { ...(room.settings as Record<string, unknown> ?? {}), ...newSettings };
    updates.settings = merged;
  }

  if (Object.keys(updates).length === 0) {
    return new Response("No valid updates", { status: 400 });
  }

  const { error } = await service
    .from("draft_rooms")
    .update(updates)
    .eq("id", room.id);

  if (error) return new Response("Failed to update room", { status: 500 });

  const merged = updates.settings ?? room.settings;
  return Response.json({ settings: merged, status: updates.status });
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
