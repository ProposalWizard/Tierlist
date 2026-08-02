import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AM_POSITION_SEQUENCE,
  fetchRoundPlayers,
  makeAmericanState,
  roundOptionsFromSettings,
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
    .select("id, host_id, status, american_state, settings")
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

  // Throws rather than returning an empty pool, so a data problem surfaces here
  // instead of starting a draft nobody can pick in.
  let firstRoundPlayers;
  try {
    firstRoundPlayers = await fetchRoundPlayers(
      service,
      AM_POSITION_SEQUENCE[0],
      [],
      roundOptionsFromSettings(room.settings)
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load goalkeepers" },
      { status: 500 }
    );
  }

  const state = makeAmericanState(eligible, firstRoundPlayers);

  // Only write if no draft has been seeded yet. The earlier read-then-write left
  // a race: two starts (a retry after the query timed out, or a double click)
  // could both see american_state as null and both write, giving each client a
  // DIFFERENT pool — which is how two players ended up looking at ten different
  // goalkeepers and every pick was rejected as "no longer available".
  const { data: written, error: updateErr } = await service
    .from("draft_rooms")
    .update({ american_state: state, status: "started" })
    .eq("id", room.id)
    .is("american_state", null)
    .select("id");

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

  // No row updated means another request seeded the draft first. That is a
  // success, not an error — make sure the room is marked started and let this
  // caller fall in behind the pool that actually won.
  if (!written || written.length === 0) {
    await service.from("draft_rooms").update({ status: "started" }).eq("id", room.id);
    return NextResponse.json({ ok: true, alreadyStarted: true });
  }

  return NextResponse.json({ ok: true });
}
