import { createServiceClient } from "@/lib/supabase/service";

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

  const { data: players } = await service
    .from("draft_room_players")
    .select("id, user_id, display_name, status, avg_ovr, team_strength, actual_finish, squad, season_result, joined_at")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  return Response.json({ room, players: players ?? [] });
}
