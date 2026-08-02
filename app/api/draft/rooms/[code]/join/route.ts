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
    .select("id, status, season_number")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  const { data: existingPlayers } = await service
    .from("draft_room_players")
    .select("user_id")
    .eq("room_id", room.id);

  const alreadyInRoom = existingPlayers?.some(p => p.user_id === user.id);

  // Existing players can always rejoin (e.g. after navigating away mid-season).
  // New players can only join when the room is in lobby state AND season 1 hasn't
  // started yet — next-season returns the room to "lobby" each season, so without
  // the season gate a stranger with the code could join a career mid-way through.
  if (!alreadyInRoom && (room.status !== "lobby" || (room.season_number ?? 1) > 1)) {
    return new Response("Room is not accepting new players", { status: 409 });
  }
  if (!alreadyInRoom && (existingPlayers?.length ?? 0) >= 6) {
    return new Response("Room is full (max 6 players)", { status: 400 });
  }

  const { data: profile } = await service
    .from("user_profiles")
    .select("username, team_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // team_name is carried over from the profile so a saved team name shows from
  // the moment you enter the room. It was left null until the player manually
  // pressed save in the lobby, so the board fell back to their username.
  const displayName = profile?.username || user.email?.split("@")[0] || "Player";
  const teamName = profile?.team_name || null;

  // Upsert so host joining doesn't error. Only set status on a brand-new join —
  // rejoining must NOT reset a player's status (e.g. "ready"/"simulated"), or the
  // host's ready-check gate would hang waiting on someone who already finished.
  const upsertPayload: {
    room_id: string; user_id: string; display_name: string;
    status?: string; team_name?: string | null;
  } = {
    room_id: room.id, user_id: user.id, display_name: displayName,
  };
  // Seed the team name on a first join only — rejoining must not overwrite a
  // name the player renamed inside this room.
  if (!alreadyInRoom) {
    upsertPayload.status = "drafting";
    upsertPayload.team_name = teamName;
  }

  const { error } = await service.from("draft_room_players").upsert(
    upsertPayload,
    { onConflict: "room_id,user_id", ignoreDuplicates: false }
  );

  if (error) return new Response("Failed to join room", { status: 500 });

  return Response.json({ room_id: room.id });
}
