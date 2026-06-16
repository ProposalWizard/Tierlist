import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { simulateSeason, DEFAULT_PL_TEAMS } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/lib/seasonSimulator";

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
    .select("id, host_id, status")
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
  const aiOpponents = sortedAI.slice(0, 20 - N);

  // Simulate each player's season
  for (const rp of roomPlayers) {
    const squad = (rp.squad ?? []) as DraftPlayer[];

    const humanOpponents = roomPlayers
      .filter(p => p.user_id !== rp.user_id)
      .map(p => ({
        name: `${p.display_name}'s XI`,
        strength: Number(p.team_strength) || 75,
      }));

    // Always exactly 19 opponents: (20-N) AI + (N-1) human = 19
    const opponents = [...aiOpponents, ...humanOpponents];

    const result = simulateSeason(squad, opponents, 1);

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
