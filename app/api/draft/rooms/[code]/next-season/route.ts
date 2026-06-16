import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { nextSeasonNumber } = await req.json();
  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, host_id, status, season_number")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // Idempotent: only advance if the room is complete and hasn't already moved to the next season
  if (room.status !== "complete" || (room.season_number ?? 1) >= nextSeasonNumber) {
    return Response.json({ ok: true, skipped: true });
  }

  // Reset room for the next season
  await service
    .from("draft_rooms")
    .update({ status: "lobby", season_number: nextSeasonNumber })
    .eq("id", room.id);

  // Reset all players for the new season (drafting, not ready — they need to re-submit squads)
  await service
    .from("draft_room_players")
    .update({ status: "drafting", squad: null, avg_ovr: null, team_strength: null, season_result: null, actual_finish: null })
    .eq("room_id", room.id);

  return Response.json({ ok: true });
}
