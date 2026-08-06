import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { boardSizeForPlayers, buildBriefSequence, fetchChallengeRound } from "@/lib/challengeDraft";
import { CHALLENGE_DRAFT_MODE, makeChallengeRoomState } from "@/lib/challengeRoom";

/**
 * Host starts the draft: draw the briefs, build round one, fix the order.
 *
 * The write is conditional on american_state still being empty, so two taps of
 * Start — or a host and a rejoining client racing — cannot produce two
 * different sets of briefs for the same room.
 */
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
    .select("id, host_id, settings, american_state")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const settings = (room.settings ?? {}) as { draftMode?: string; eraStart?: number; eraEnd?: number };
  if (settings.draftMode !== CHALLENGE_DRAFT_MODE) {
    return NextResponse.json({ error: "That code is not a Challenge draft room" }, { status: 400 });
  }
  if (room.host_id !== user.id) {
    return NextResponse.json({ error: "Only the host can start the draft" }, { status: 403 });
  }
  if (room.american_state) {
    return NextResponse.json({ ok: true, alreadyStarted: true });
  }

  const { data: players } = await service
    .from("draft_room_players")
    .select("user_id")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const userIds = (players ?? []).map(p => p.user_id as string);
  if (userIds.length === 0) {
    return NextResponse.json({ error: "Nobody is in the room" }, { status: 400 });
  }

  const era = {
    start: Number(settings.eraStart) || 2007,
    end: Number(settings.eraEnd) || 2026,
  };
  const opts = { eraStart: era.start, eraEnd: era.end };

  try {
    const briefs = await buildBriefSequence(service, opts, userIds.length);
    if (briefs.length === 0) {
      return NextResponse.json(
        { error: "No usable briefs — is the Premier League player data imported?" },
        { status: 500 }
      );
    }

    // Boards grow with the room: ten cards for one or two managers, two more
    // for every manager after that, so the last picker still has a choice.
    const size = boardSizeForPlayers(userIds.length);
    const board = await fetchChallengeRound(service, briefs[0], [], opts, size);
    if (board.length === 0) {
      return NextResponse.json({ error: "Could not build the first round" }, { status: 500 });
    }

    const state = makeChallengeRoomState(userIds, briefs, board, era);

    const { data: claimed, error } = await service
      .from("draft_rooms")
      .update({ american_state: state, status: "drafting" })
      .eq("id", room.id)
      .is("american_state", null)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ ok: true, alreadyStarted: true });
    }
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the draft" },
      { status: 500 }
    );
  }
}
