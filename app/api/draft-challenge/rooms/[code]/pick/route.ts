import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { boardSizeForPlayers, fetchChallengeRound } from "@/lib/challengeDraft";
import { attachSquadAttributes, nextPickDeadline } from "@/lib/americanDraft";
import type { AmPlayer } from "@/lib/americanDraft";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import {
  CHALLENGE_DRAFT_MODE,
  asChallengeState,
  autoPickFrom,
  challengePicksToSquad,
  orderForRound,
  takenKeysFrom,
} from "@/lib/challengeRoom";
import type { ChallengeRoomState } from "@/lib/challengeRoom";

/**
 * One pick in a multiplayer Challenge draft.
 *
 * Also serves auto-picks: past the turn deadline, ANY member of the room can
 * POST { auto: true } and the server picks for whoever is stalling. Same code
 * path either way — only who the pick belongs to, and what authorises it,
 * differ. Without it one player closing their laptop freezes the room for
 * everyone, permanently.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => ({})) as { sofifa_id?: string; auto?: boolean };
  const isAuto = body.auto === true;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const { data: room } = await service
    .from("draft_rooms")
    .select("id, settings, american_state")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if ((room.settings as { draftMode?: string } | null)?.draftMode !== CHALLENGE_DRAFT_MODE) {
    return NextResponse.json({ error: "That code is not a Challenge draft room" }, { status: 400 });
  }

  const state = asChallengeState(room.american_state);
  if (!state) return NextResponse.json({ error: "The draft has not started" }, { status: 400 });
  if (state.complete) return NextResponse.json({ ok: true, complete: true, state });

  const order = orderForRound(state.base_order, state.current_round);
  const currentPickerId = order[state.current_pick_idx];

  // Membership is required either way — for a normal pick it is implied by the
  // turn check, but an auto-pick is made on someone ELSE's behalf, so it has to
  // be verified explicitly or any logged-in user could drive a stranger's draft.
  const { data: membership } = await service
    .from("draft_room_players")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "You are not in this room" }, { status: 403 });
  }

  let actingUserId: string;
  let picked: AmPlayer | undefined;

  if (isAuto) {
    // The deadline is the only thing that authorises this, and it is checked
    // against the SERVER clock — otherwise a fast local clock would let someone
    // pick for a team-mate who is still deciding.
    const deadline = state.pick_deadline ?? 0;
    if (!deadline || Date.now() < deadline) {
      return NextResponse.json(
        { error: "That manager still has time to pick", retryAt: deadline },
        { status: 409 }
      );
    }
    actingUserId = currentPickerId;
    picked = autoPickFrom(state);
  } else {
    if (currentPickerId !== user.id) {
      return NextResponse.json({ error: "It is not your turn" }, { status: 409 });
    }
    actingUserId = user.id;
    picked = state.round_players.find(p => p.sofifa_id === body.sofifa_id);
  }

  if (!picked) {
    return NextResponse.json({ error: "That player is no longer available" }, { status: 409 });
  }

  const brief = state.briefs[state.current_round];
  const next: ChallengeRoomState = {
    ...state,
    picks: {
      ...state.picks,
      [actingUserId]: [...(state.picks[actingUserId] ?? []), { briefId: brief.id, player: picked }],
    },
    last_pick: { ...state.last_pick, [actingUserId]: picked },
    pick_deadline: nextPickDeadline(),
  };

  const isLastPickerInRound = state.current_pick_idx + 1 >= order.length;
  const isLastRound = state.current_round + 1 >= state.briefs.length;
  const opts = { eraStart: state.era.start, eraEnd: state.era.end };

  if (isLastPickerInRound && isLastRound) {
    // ── Finished: write every squad and mark everyone ready ──
    next.complete = true;
    next.round_players = [];

    const built = Object.entries(next.picks).map(([userId, list]) => ({
      userId,
      squad: challengePicksToSquad(list),
      fifaYears: list.map(p => p.player.fifa_year),
    }));
    // The simulator needs attributes; they are deliberately kept off the live
    // draft state so each pick's write stays small, and fetched once here.
    await attachSquadAttributes(service, built);

    for (const { userId, squad } of built) {
      const { teamStrength, avgOvr } = computeTeamStrength(squad);
      const { error } = await service
        .from("draft_room_players")
        .update({ squad, avg_ovr: avgOvr, team_strength: teamStrength, status: "ready" })
        .eq("room_id", room.id)
        .eq("user_id", userId);
      if (error) {
        return NextResponse.json({ error: `Could not save squads: ${error.message}` }, { status: 500 });
      }
    }
  } else if (isLastPickerInRound) {
    const nextRound = state.current_round + 1;
    next.current_round = nextRound;
    next.current_pick_idx = 0;
    try {
      const size = boardSizeForPlayers(state.base_order.length);
      next.round_players = await fetchChallengeRound(
        service, state.briefs[nextRound], takenKeysFrom(next.picks), opts, size,
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not load the next round" },
        { status: 500 }
      );
    }
    if (next.round_players.length === 0) {
      // Rejecting the pick keeps the room on a round it can still play, rather
      // than saving an empty board nobody can act on.
      return NextResponse.json(
        { error: `No players left for "${state.briefs[nextRound].title}".` },
        { status: 409 }
      );
    }
  } else {
    next.current_pick_idx = state.current_pick_idx + 1;
    next.round_players = state.round_players.filter(p => p.sofifa_id !== picked!.sofifa_id);
  }

  const { error: saveErr } = await service
    .from("draft_rooms")
    .update({
      american_state: next,
      ...(next.complete ? { status: "started" } : {}),
    })
    .eq("id", room.id);

  if (saveErr) {
    return NextResponse.json({ error: `Could not save the pick: ${saveErr.message}` }, { status: 500 });
  }

  // The authoritative state rides back on the response, so the picker's board
  // is exact the moment the request lands — no Realtime round-trip to wait on.
  return NextResponse.json({ ok: true, complete: next.complete, state: next });
}
