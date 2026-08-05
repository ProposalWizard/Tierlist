import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CHALLENGE_DRAFT_MODE } from "@/lib/challengeRoom";

/** Join a Challenge room by code. Idempotent — rejoining is just a no-op. */
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
    .select("id, status, settings, american_state")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if ((room.settings as { draftMode?: string } | null)?.draftMode !== CHALLENGE_DRAFT_MODE) {
    return NextResponse.json({ error: "That code is not a Challenge draft room" }, { status: 400 });
  }

  const { data: existing } = await service
    .from("draft_room_players")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Already in — let them straight back in, whatever state the room is in. A
  // refresh mid-draft must not be treated as a new join and refused.
  if (existing) return NextResponse.json({ ok: true, rejoined: true });

  // New joiners only before it starts. Once the order is fixed and boards are
  // sized to the room, someone appearing halfway through has no place in it.
  if (room.status !== "lobby" || room.american_state) {
    return NextResponse.json({ error: "That draft has already started" }, { status: 409 });
  }

  const { data: profile } = await service
    .from("user_profiles")
    .select("username, team_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await service.from("draft_room_players").insert({
    room_id: room.id,
    user_id: user.id,
    display_name: profile?.username || user.email?.split("@")[0] || "Player",
    team_name: profile?.team_name || null,
    status: "drafting",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
