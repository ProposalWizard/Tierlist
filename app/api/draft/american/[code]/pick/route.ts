import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRoundPlayers, shuffleArray } from "@/lib/americanDraft";
import type { AmPlayer, SquadPick } from "@/lib/americanDraft";

function genRoomCode(): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

// Convert American Draft picks into the DraftPlayer shape used by regular multiplayer.
function buildDraftSquad(picks: SquadPick[]) {
  return picks.map(pick => {
    const p = pick.player;
    const isSubPick = pick.position === "ANY";
    const assignedPosition = isSubPick
      ? (p.positions.split(",")[0]?.trim() || "CM")
      : pick.position;

    return {
      name: p.name,
      overall: p.ovr,
      positions: p.positions,
      club: p.club,
      clubYear: p.edition || p.club,
      assignedPosition,
      sofifa_id: p.sofifa_id,
      image_url: p.image_url,
      nationality: p.nationality,
      age: p.age,
      isSub: isSubPick,
    };
  });
}

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

  const currentPickerId = (room.pick_order as string[])[room.current_pick_idx as number];
  if (currentPickerId !== user.id) return new Response("Not your turn", { status: 400 });

  const roundPlayers = room.round_players as AmPlayer[];
  const picked = roundPlayers.find(p => p.sofifa_id === sofifa_id);
  if (!picked) return new Response("Player not available", { status: 400 });

  const { data: participant } = await service
    .from("american_draft_participants")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return new Response("Not in room", { status: 400 });

  const currentPosition = (room.position_sequence as string[])[room.current_round as number];
  const newSquad: SquadPick[] = [
    ...(participant.squad || []),
    { round: room.current_round, position: currentPosition, player: picked },
  ];

  // Persist this player's squad update FIRST so reads below see it
  await service
    .from("american_draft_participants")
    .update({ squad: newSquad, last_pick: picked })
    .eq("id", participant.id);

  const remainingPlayers = roundPlayers.filter(p => p.sofifa_id !== sofifa_id);
  const pickOrder = room.pick_order as string[];
  const posSeq = room.position_sequence as string[];
  const isLastPickerInRound = (room.current_pick_idx as number) + 1 >= pickOrder.length;
  const isLastRound = (room.current_round as number) + 1 >= posSeq.length;

  if (isLastPickerInRound && isLastRound) {
    // ── Draft complete: create the linked regular multiplayer room ───────────
    let linkedCode: string | null = null;

    try {
      // Re-read all participants to get their completed squads
      const { data: completedParticipants } = await service
        .from("american_draft_participants")
        .select("*")
        .eq("room_id", room.id);

      if (completedParticipants && completedParticipants.length >= 2) {
        // Generate a unique code for the regular draft room
        let newCode = genRoomCode();
        for (let attempt = 0; attempt < 10; attempt++) {
          const { data: existing } = await service
            .from("draft_rooms")
            .select("id")
            .eq("code", newCode)
            .maybeSingle();
          if (!existing) break;
          newCode = genRoomCode();
        }

        const roomSettings = {
          formation: "4-3-3",
          eraStart: 2007,
          eraEnd: 2026,
          mode: "normal",
          draftOrder: "position-first",
          respins: 0,
        };

        const { data: newRoom } = await service
          .from("draft_rooms")
          .insert({
            code: newCode,
            host_id: room.host_id,
            status: "lobby",
            settings: roomSettings,
            season_number: 1,
          })
          .select("id")
          .single();

        if (newRoom) {
          // Insert each participant as a ready player with their squad
          for (const p of completedParticipants) {
            const squad = buildDraftSquad(p.squad || []);
            const avg_ovr = squad.length > 0
              ? Math.round(squad.reduce((s, pl) => s + pl.overall, 0) / squad.length)
              : null;

            await service.from("draft_room_players").insert({
              room_id: newRoom.id,
              user_id: p.user_id,
              display_name: p.display_name,
              status: "ready",
              squad,
              avg_ovr,
            });
          }
          linkedCode = newCode;
        }
      }
    } catch {
      // Non-fatal — American Draft still completes; players just won't be redirected
    }

    await service
      .from("american_draft_rooms")
      .update({ status: "complete", round_players: [], linked_room_code: linkedCode })
      .eq("id", room.id);
  } else if (isLastPickerInRound) {
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
