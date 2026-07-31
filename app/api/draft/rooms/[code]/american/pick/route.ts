import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  americanPicksToSquad,
  fetchRoundPlayers,
  pickedPlayerKeys,
  shuffleArray,
} from "@/lib/americanDraft";
import type { AmericanState, SquadPick } from "@/lib/americanDraft";
import { computeTeamStrength } from "@/lib/seasonSimulator";

/**
 * Make one pick in a room's American draft.
 *
 * On the final pick of the final round every player's squad is written to their
 * own draft_room_players row with status 'ready', which is exactly the state the
 * normal flow reaches after everyone submits a spun squad — so the host's
 * existing "Simulate Season" button just works. Nothing is handed off to
 * another room.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const { sofifa_id } = (await req.json().catch(() => ({}))) as { sofifa_id?: string };
  if (!sofifa_id) return NextResponse.json({ error: "Missing sofifa_id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const code = params.code.toUpperCase();

  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, american_state, season_number")
    .eq("code", code)
    .maybeSingle();

  if (roomErr) {
    return NextResponse.json({ error: `Room lookup failed: ${roomErr.message}` }, { status: 500 });
  }
  if (!room) return new Response("Room not found", { status: 404 });

  const state = room.american_state as AmericanState | null;
  if (!state) return NextResponse.json({ error: "This room is not running an American draft" }, { status: 400 });
  if (state.complete) return NextResponse.json({ ok: true, complete: true });

  if (state.pick_order[state.current_pick_idx] !== user.id) {
    return NextResponse.json({ error: "It is not your turn" }, { status: 409 });
  }

  const picked = state.round_players.find(p => p.sofifa_id === sofifa_id);
  if (!picked) {
    return NextResponse.json({ error: "That player is no longer available" }, { status: 409 });
  }

  const currentPosition = state.position_sequence[state.current_round];

  // Record the pick.
  const nextState: AmericanState = {
    ...state,
    picks: {
      ...state.picks,
      [user.id]: [
        ...(state.picks[user.id] ?? []),
        { round: state.current_round, position: currentPosition, player: picked },
      ],
    },
    last_pick: { ...state.last_pick, [user.id]: picked },
  };

  const isLastPickerInRound = state.current_pick_idx + 1 >= state.pick_order.length;
  const isLastRound = state.current_round + 1 >= state.position_sequence.length;

  if (isLastPickerInRound && isLastRound) {
    // ── Draft finished — write every squad into this room ──
    nextState.complete = true;
    nextState.round_players = [];

    const rows = Object.entries(nextState.picks).map(([userId, picks]) => {
      const squad = americanPicksToSquad(picks as SquadPick[]);
      const { teamStrength, avgOvr } = computeTeamStrength(squad);
      return { userId, squad, teamStrength, avgOvr };
    });

    for (const row of rows) {
      const { error: readyErr } = await service
        .from("draft_room_players")
        .update({
          squad: row.squad,
          avg_ovr: row.avgOvr,
          team_strength: row.teamStrength,
          status: "ready",
        })
        .eq("room_id", room.id)
        .eq("user_id", row.userId);

      if (readyErr) {
        return NextResponse.json(
          { error: `Could not save squads: ${readyErr.message}` },
          { status: 500 }
        );
      }
    }

    const { error: doneErr } = await service
      .from("draft_rooms")
      .update({ american_state: nextState, status: "lobby" })
      .eq("id", room.id);

    if (doneErr) {
      return NextResponse.json({ error: `Could not finish the draft: ${doneErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, complete: true });
  }

  if (isLastPickerInRound) {
    // Advance to the next round: reshuffle the order and load a fresh pool.
    const nextRound = state.current_round + 1;
    nextState.current_round = nextRound;
    nextState.current_pick_idx = 0;
    nextState.pick_order = shuffleArray(state.pick_order);
    // Exclude everyone already taken, so a player picked at one position can
    // never reappear at another — and no two editions of the same footballer
    // can both end up in a squad.
    nextState.round_players = await fetchRoundPlayers(
      service,
      state.position_sequence[nextRound],
      pickedPlayerKeys(nextState.picks)
    );
  } else {
    // Same round, next picker — the picked player leaves the pool.
    nextState.current_pick_idx = state.current_pick_idx + 1;
    nextState.round_players = state.round_players.filter(p => p.sofifa_id !== sofifa_id);
  }

  const { error: saveErr } = await service
    .from("draft_rooms")
    .update({ american_state: nextState })
    .eq("id", room.id);

  if (saveErr) {
    return NextResponse.json({ error: `Could not save the pick: ${saveErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
