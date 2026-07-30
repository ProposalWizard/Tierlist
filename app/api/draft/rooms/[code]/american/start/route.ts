import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AM_POSITION_SEQUENCE,
  fetchRoundPlayers,
  makeAmericanState,
} from "@/lib/americanDraft";

/**
 * Host-only. Initialises the American draft on an existing multiplayer room:
 * shuffles a pick order from the room's players and loads the first round's
 * pool. The room itself moves to "started" so every client leaves the lobby.
 */
export async function POST(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const code = params.code.toUpperCase();

  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, host_id, status, american_state")
    .eq("code", code)
    .maybeSingle();

  if (roomErr) {
    return NextResponse.json({ error: `Room lookup failed: ${roomErr.message}` }, { status: 500 });
  }
  if (!room) return new Response("Room not found", { status: 404 });
  if (room.host_id !== user.id) return new Response("Only the host can start the draft", { status: 403 });

  // Already running — treat as success so a double click doesn't reshuffle the
  // pick order out from under everyone.
  if (room.american_state) return NextResponse.json({ ok: true, alreadyStarted: true });

  const { data: players, error: playersErr } = await service
    .from("draft_room_players")
    .select("user_id, status")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  if (playersErr) {
    return NextResponse.json({ error: `Could not read players: ${playersErr.message}` }, { status: 500 });
  }

  const eligible = (players ?? []).filter(p => p.status !== "out").map(p => p.user_id);
  if (eligible.length < 2) {
    return NextResponse.json({ error: "Need at least 2 players to start an American draft" }, { status: 400 });
  }
  if (eligible.length > 6) {
    return NextResponse.json({ error: "American draft supports at most 6 players" }, { status: 400 });
  }

  const firstRoundPlayers = await fetchRoundPlayers(service, AM_POSITION_SEQUENCE[0]);
  if (firstRoundPlayers.length === 0) {
    return NextResponse.json(
      { error: "No Premier League goalkeepers found — is the player data imported?" },
      { status: 500 }
    );
  }

  const state = makeAmericanState(eligible, firstRoundPlayers);

  const { error: updateErr } = await service
    .from("draft_rooms")
    .update({ american_state: state, status: "started" })
    .eq("id", room.id);

  if (updateErr) {
    return NextResponse.json(
      {
        error: updateErr.message.includes("american_state")
          ? "Run the draft_american_mode.sql migration — draft_rooms is missing the american_state column."
          : `Could not start the draft: ${updateErr.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
