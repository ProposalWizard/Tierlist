import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRoundPlayers, playerNameKey, shuffleArray } from "@/lib/americanDraft";
import type { AmPlayer, SquadPick } from "@/lib/americanDraft";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/lib/seasonSimulator";

function genRoomCode(): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

// Convert American Draft picks into the DraftPlayer shape used by regular multiplayer.
function buildDraftSquad(picks: SquadPick[]): DraftPlayer[] {
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
  const { error: squadErr } = await service
    .from("american_draft_participants")
    .update({ squad: newSquad, last_pick: picked })
    .eq("id", participant.id);

  if (squadErr) {
    return NextResponse.json(
      { error: `Failed to save pick: ${squadErr.message}` },
      { status: 500 }
    );
  }

  const remainingPlayers = roundPlayers.filter(p => p.sofifa_id !== sofifa_id);
  const pickOrder = room.pick_order as string[];
  const posSeq = room.position_sequence as string[];
  const isLastPickerInRound = (room.current_pick_idx as number) + 1 >= pickOrder.length;
  const isLastRound = (room.current_round as number) + 1 >= posSeq.length;

  if (isLastPickerInRound && isLastRound) {
    // ── Draft complete: create the linked regular multiplayer room ───────────
    // Every failure below must be surfaced. supabase-js returns { data, error }
    // instead of throwing, so a silent failure here would leave the room stuck
    // on the final round forever with the client showing "picked" but never
    // advancing.
    let linkedCode: string | null = null;
    let linkError: string | null = null;

    try {
      // Re-read all participants to get their completed squads
      const { data: completedParticipants, error: partErr } = await service
        .from("american_draft_participants")
        .select("*")
        .eq("room_id", room.id);

      if (partErr) throw new Error(`read participants: ${partErr.message}`);
      if (!completedParticipants?.length) throw new Error("no participants found");

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

      const { data: newRoom, error: roomErr } = await service
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

      if (roomErr || !newRoom) {
        throw new Error(`create season room: ${roomErr?.message ?? "no row returned"}`);
      }

      // Insert each participant as a ready player with their finished squad.
      // team_strength must be computed with the same function the normal ready
      // route uses, otherwise the lobby shows no STR and the simulator has to
      // fall back to a default.
      const rows = completedParticipants.map(p => {
        const squad = buildDraftSquad((p.squad as SquadPick[]) || []);
        const { teamStrength, avgOvr } = computeTeamStrength(squad);
        return {
          room_id: newRoom.id,
          user_id: p.user_id,
          display_name: p.display_name,
          status: "ready",
          squad,
          avg_ovr: squad.length > 0 ? avgOvr : null,
          team_strength: squad.length > 0 ? teamStrength : null,
        };
      });

      const { error: playersErr } = await service.from("draft_room_players").insert(rows);
      if (playersErr) throw new Error(`create season players: ${playersErr.message}`);

      linkedCode = newCode;
    } catch (e) {
      linkError = e instanceof Error ? e.message : String(e);
    }

    // Mark the American room complete. If linked_room_code doesn't exist yet
    // (an older american_draft.sql was applied), retry without it so the draft
    // still finishes instead of soft-locking on the last pick.
    const { error: completeErr } = await service
      .from("american_draft_rooms")
      .update({ status: "complete", round_players: [], linked_room_code: linkedCode })
      .eq("id", room.id);

    if (completeErr) {
      const { error: retryErr } = await service
        .from("american_draft_rooms")
        .update({ status: "complete", round_players: [] })
        .eq("id", room.id);

      if (retryErr) {
        return NextResponse.json(
          { error: `Failed to complete draft: ${retryErr.message}` },
          { status: 500 }
        );
      }
      // Completed, but the code column is missing — tell the client why.
      return NextResponse.json({
        ok: true,
        complete: true,
        linked_room_code: null,
        warning:
          "Draft finished but the season room could not be linked — run the latest " +
          "american_draft.sql migration (missing linked_room_code column).",
      });
    }

    return NextResponse.json({
      ok: true,
      complete: true,
      linked_room_code: linkedCode,
      ...(linkError ? { warning: `Season room not created: ${linkError}` } : {}),
    });
  } else if (isLastPickerInRound) {
    const nextRound = (room.current_round as number) + 1;
    const nextPosition = posSeq[nextRound];

    const { data: allParticipants } = await service
      .from("american_draft_participants")
      .select("user_id, squad")
      .eq("room_id", room.id);

    const newPickOrder = shuffleArray(
      (allParticipants || []).map((p: { user_id: string }) => p.user_id)
    );

    // Everyone already taken this draft, so a player can't come up again at a
    // different position or as a different FIFA edition of the same footballer.
    const takenKeys = new Set<string>();
    for (const p of allParticipants ?? []) {
      for (const pick of ((p as { squad?: SquadPick[] }).squad ?? [])) {
        const player = pick?.player;
        if (!player) continue;
        if (player.sofifa_id) takenKeys.add(`id:${player.sofifa_id}`);
        const nk = playerNameKey(player.name);
        if (nk) takenKeys.add(`name:${nk}`);
      }
    }
    const newRoundPlayers = await fetchRoundPlayers(service, nextPosition, takenKeys);

    const { error: roundErr } = await service
      .from("american_draft_rooms")
      .update({
        current_round: nextRound,
        current_pick_idx: 0,
        pick_order: newPickOrder,
        round_players: newRoundPlayers,
      })
      .eq("id", room.id);

    if (roundErr) {
      return NextResponse.json(
        { error: `Failed to advance round: ${roundErr.message}` },
        { status: 500 }
      );
    }
  } else {
    const { error: advanceErr } = await service
      .from("american_draft_rooms")
      .update({
        current_pick_idx: (room.current_pick_idx as number) + 1,
        round_players: remainingPlayers,
      })
      .eq("id", room.id);

    if (advanceErr) {
      return NextResponse.json(
        { error: `Failed to advance pick: ${advanceErr.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
