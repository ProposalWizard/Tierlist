import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CHALLENGE_DRAFT_MODE, asChallengeState } from "@/lib/challengeRoom";

/** Room snapshot: who is in it, and the draft state if it has started. */
export async function GET(
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
    .select("id, code, host_id, status, settings, american_state")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if ((room.settings as { draftMode?: string } | null)?.draftMode !== CHALLENGE_DRAFT_MODE) {
    return NextResponse.json({ error: "That code is not a Challenge draft room" }, { status: 400 });
  }

  const { data: players } = await service
    .from("draft_room_players")
    .select("user_id, display_name, team_name, squad, status")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const state = asChallengeState(room.american_state);

  return NextResponse.json({
    roomId: room.id,
    code: room.code,
    hostId: room.host_id,
    isHost: room.host_id === user.id,
    settings: room.settings,
    // Only this player's own squad — a finished squad is a few hundred KB and
    // nobody needs everyone else's while the draft is still running.
    mySquad: (players ?? []).find(p => p.user_id === user.id)?.squad ?? null,
    players: (players ?? []).map(p => ({
      user_id: p.user_id,
      name: p.team_name || p.display_name || "Player",
      status: p.status,
    })),
    state,
  });
}
