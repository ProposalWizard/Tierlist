import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRoundPlayers, shuffleArray } from "@/lib/americanDraft";
import type { AmPlayer } from "@/lib/americanDraft";

export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const { sofifa_id } = (await req.json()) as { sofifa_id: string };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();

  const { data: room } = await service
    .from("american_draft_rooms")
    .select("*")
    .eq("code", params.code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });
  if (room.status !== "drafting") return new Response("Not currently drafting", { status: 400 });

  // Verify it's this user's turn
  const currentPickerId = (room.pick_order as string[])[room.current_pick_idx as number];
  if (currentPickerId !== user.id) return new Response("Not your turn", { status: 400 });

  // Find the selected player in round_players
  const roundPlayers = room.round_players as AmPlayer[];
  const picked = roundPlayers.find(p => p.sofifa_id === sofifa_id);
  if (!picked) return new Response("Player not available", { status: 400 });

  // Load participant
  const { data: participant } = await service
    .from("american_draft_participants")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return new Response("Not in room", { status: 400 });

  const currentPosition = (room.position_sequence as string[])[room.current_round as number];
  const newSquad = [
    ...(participant.squad || []),
    { round: room.current_round, position: currentPosition, player: picked },
  ];

  // Update participant squad + last pick
  await service
    .from("american_draft_participants")
    .update({ squad: newSquad, last_pick: picked })
    .eq("id", participant.id);

  // Compute next state
  const remainingPlayers = roundPlayers.filter(p => p.sofifa_id !== sofifa_id);
  const pickOrder = room.pick_order as string[];
  const posSeq = room.position_sequence as string[];
  const isLastPickerInRound = (room.current_pick_idx as number) + 1 >= pickOrder.length;
  const isLastRound = (room.current_round as number) + 1 >= posSeq.length;

  if (isLastPickerInRound && isLastRound) {
    // Draft complete
    await service
      .from("american_draft_rooms")
      .update({ status: "complete", round_players: [] })
      .eq("id", room.id);
  } else if (isLastPickerInRound) {
    // Advance to next round
    const nextRound = (room.current_round as number) + 1;
    const nextPosition = posSeq[nextRound];

    const { data: allParticipants } = await service
      .from("american_draft_participants")
      .select("user_id")
      .eq("room_id", room.id);

    const newPickOrder = shuffleArray(
      (allParticipants || []).map((p: { user_id: string }) => p.user_id)
    );
    const newRoundPlayers = await fetchRoundPlayers(service, nextPosition);

    await service
      .from("american_draft_rooms")
      .update({
        current_round: nextRound,
        current_pick_idx: 0,
        pick_order: newPickOrder,
        round_players: newRoundPlayers,
      })
      .eq("id", room.id);
  } else {
    // Next picker in same round
    await service
      .from("american_draft_rooms")
      .update({
        current_pick_idx: (room.current_pick_idx as number) + 1,
        round_players: remainingPlayers,
      })
      .eq("id", room.id);
  }

  return NextResponse.json({ ok: true });
}
