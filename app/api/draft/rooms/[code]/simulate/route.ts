import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { simulateSharedSeason, getSeasonTeams } from "@/lib/seasonSimulator";
import type { DraftPlayer, SharedSeasonInput, LeagueTeam } from "@/lib/seasonSimulator";

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
    .select("id, host_id, status, season_number, previous_league_table")
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

  try {
    const emptySquads = roomPlayers.filter(rp => !rp.squad || !Array.isArray(rp.squad) || rp.squad.length === 0);
    if (emptySquads.length > 0) {
      await service.from("draft_rooms").update({ status: "lobby" }).eq("id", room.id);
      return new Response(`Missing squad data for ${emptySquads.length} player(s)`, { status: 400 });
    }

    const N = roomPlayers.length;
    const seasonNumber = room.season_number ?? 1;
    const previousLeagueTable = (room as Record<string, unknown>).previous_league_table as
      { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; isPlayer?: boolean }[] | null | undefined;
    const seasonTeams = getSeasonTeams(previousLeagueTable as LeagueTeam[] | undefined);
    const sortedAI = [...seasonTeams].sort((a, b) => b.strength - a.strength);
    const aiOpponents = sortedAI.slice(0, 20 - N).map(t => ({ name: t.name, strength: t.strength }));

    const humanTeams: SharedSeasonInput[] = roomPlayers.map(rp => ({
      userId: rp.user_id,
      displayName: rp.display_name,
      squad: (rp.squad ?? []) as DraftPlayer[],
    }));

    const sharedSeed = hashRoomId(room.id) ^ (room.season_number ?? 1) * 0x9e3779b9;
    const results = simulateSharedSeason(humanTeams, aiOpponents, sharedSeed >>> 0, seasonNumber, previousLeagueTable ?? undefined);

    // Write all player results in parallel
    await Promise.all(roomPlayers.map(async (rp) => {
      const result = results.get(rp.user_id);
      if (!result) return;
      await service
        .from("draft_room_players")
        .update({
          season_result: result,
          actual_finish: result.actualFinish,
          status: "simulated",
        })
        .eq("id", rp.id);
    }));

    await service.from("draft_rooms").update({ status: "complete" }).eq("id", room.id);

    return Response.json({ ok: true });
  } catch (e) {
    await service.from("draft_rooms").update({ status: "lobby" }).eq("id", room.id);
    console.error("Simulation error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Simulation failed: ${msg}`, { status: 500 });
  }
}
