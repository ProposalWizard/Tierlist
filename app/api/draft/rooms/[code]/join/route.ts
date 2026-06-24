import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  const { data: existingPlayers } = await service
    .from("draft_room_players")
    .select("user_id")
    .eq("room_id", room.id);

  const alreadyInRoom = existingPlayers?.some(p => p.user_id === user.id);

  // Existing players can always rejoin (e.g. after navigating away mid-season).
  // New players can only join when the room is in lobby state.
  if (!alreadyInRoom && room.status !== "lobby") {
    return new Response("Room is not accepting players", { status: 400 });
  }
  if (!alreadyInRoom && (existingPlayers?.length ?? 0) >= 6) {
    return new Response("Room is full (max 6 players)", { status: 400 });
  }

  const { data: profile } = await service
    .from("user_profiles")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.username || user.email?.split("@")[0] || "Player";

  // Upsert so host joining doesn't error
  const { error } = await service.from("draft_room_players").upsert(
    { room_id: room.id, user_id: user.id, display_name: displayName, status: "drafting" },
    { onConflict: "room_id,user_id", ignoreDuplicates: false }
  );

  if (error) return new Response("Failed to join room", { status: 500 });

  return Response.json({ room_id: room.id });
}
