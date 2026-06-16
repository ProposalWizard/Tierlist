import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { simulateSharedSeason, DEFAULT_PL_TEAMS } from "@/lib/seasonSimulator";
import type { DraftPlayer, SharedSeasonInput } from "@/lib/seasonSimulator";

function hashRoomId(roomId: string): number {
  let h = 2166136261;
  for (let i = 0; i < roomId.length; i++) {
    h ^= roomId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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
    .select("id, host_id, status, season_number")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });
  if (room.host_id !== user.id) return new Response("Only the host can simulate", { status: 403 });
  if (room.status === "complete") return Response.json({ ok: true, alreadyDone: true });

  const { data: roomPlayers } = await service
    .from("draft_room_players")
    .select("*")
    .eq("room_id", room.id);

  if (!roomPlayers || roomPlayers.length === 0) {
    return new Response("No players in room", { status: 400 });
  }

  const notReady = roomPlayers.filter(p => p.status !== "ready");
  if (notReady.length > 0) {
    return new Response("Not all players have submitted squads", { status: 400 });
  }

  // Mark room as simulating
  await service.from("draft_rooms").update({ status: "simulating" }).eq("id", room.id);

  const N = roomPlayers.length;
  // Keep the strongest AI teams (remove N weakest to make room for human players)
  const sortedAI = [...DEFAULT_PL_TEAMS].sort((a, b) => b.strength - a.strength);
  const aiOpponents = sortedAI.slice(0, 20 - N).map(t => ({ name: t.name, strength: t.strength }));

  // Build human team inputs for shared simulation
  const humanTeams: SharedSeasonInput[] = roomPlayers.map(rp => ({
    userId: rp.user_id,
    displayName: rp.display_name,
    squad: (rp.squad ?? []) as DraftPlayer[],
  }));

  // Single shared seed derived from room ID — same seed for every player
  const sharedSeed = hashRoomId(room.id) ^ (room.season_number ?? 1) * 0x9e3779b9;

  // Simulate all 20 teams in ONE shared league — results are consistent for everyone
  const seasonNumber = room.season_number ?? 1;
  const results = simulateSharedSeason(humanTeams, aiOpponents, sharedSeed >>> 0, seasonNumber);

  // Persist each player's result
  for (const rp of roomPlayers) {
    const result = results.get(rp.user_id);
    if (!result) continue;

    await service
      .from("draft_room_players")
      .update({
        season_result: result,
        actual_finish: result.actualFinish,
        status: "simulated",
      })
      .eq("id", rp.id);
  }

  // Mark room complete
  await service.from("draft_rooms").update({ status: "complete" }).eq("id", room.id);

  return Response.json({ ok: true });
}
