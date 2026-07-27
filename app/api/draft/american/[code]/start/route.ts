import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRoundPlayers, shuffleArray } from "@/lib/americanDraft";

export async function POST(
  _req: Request,
  { params }: { params: { code: string } }
) {
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
  if (room.host_id !== user.id) return new Response("Host only", { status: 403 });
  if (room.status !== "lobby") return new Response("Already started", { status: 400 });

  const { data: participants } = await service
    .from("american_draft_participants")
    .select("user_id")
    .eq("room_id", room.id);

  if (!participants || participants.length < 2) {
    return new Response("Need at least 2 players to start", { status: 400 });
  }

  const userIds = participants.map((p: { user_id: string }) => p.user_id);
  const pickOrder = shuffleArray(userIds);
  const roundPlayers = await fetchRoundPlayers(service, room.position_sequence[0] as string);

  const { error } = await service
    .from("american_draft_rooms")
    .update({
      status: "drafting",
      pick_order: pickOrder,
      current_pick_idx: 0,
      current_round: 0,
      round_players: roundPlayers,
    })
    .eq("id", room.id);

  if (error) return new Response("Failed to start draft", { status: 500 });

  return NextResponse.json({ ok: true });
}
