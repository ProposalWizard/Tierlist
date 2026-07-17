import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { nextSeasonNumber } = await req.json();
  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, host_id, status, season_number")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // Only the host may advance the room to the next season — otherwise any
  // authenticated user who knows the 6-char code could reset an in-progress
  // game and wipe every player's season result.
  if (room.host_id !== user.id) {
    return new Response("Only the host can start the next season", { status: 403 });
  }

  // Idempotent: only advance if the room is complete and hasn't already moved to the next season
  if (room.status !== "complete" || (room.season_number ?? 1) >= nextSeasonNumber) {
    return Response.json({ ok: true, skipped: true });
  }

  // Read all players' data BEFORE clearing — need season_result for the league
  // table and actual_finish to identify relegated players.
  const { data: allPlayers } = await service
    .from("draft_room_players")
    .select("id, season_result, actual_finish")
    .eq("room_id", room.id);

  let previousLeagueTable: { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }[] | null = null;
  const playerWithResult = (allPlayers ?? []).find(p => p.season_result != null);
  if (playerWithResult) {
    const result = playerWithResult.season_result as { leagueTable?: { name: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number; isPlayer?: boolean }[] } | null;
    if (result?.leagueTable) {
      previousLeagueTable = result.leagueTable.map(t => ({
        name: t.name,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        gf: t.goalsFor,
        ga: t.goalsAgainst,
        points: t.points,
      }));
    }
  }

  // Identify relegated players (finished 18th or worse) before clearing the column.
  const relegatedIds = (allPlayers ?? [])
    .filter(p => typeof p.actual_finish === "number" && p.actual_finish >= 18)
    .map(p => p.id as string);

  // Reset players FIRST, then the room. Order matters: the ready endpoint
  // rejects submissions while room.status is "complete", so by resetting
  // players before flipping the room to "lobby" no ready can land in the
  // window between the two writes and get wiped.
  await service
    .from("draft_room_players")
    .update({ status: "drafting", avg_ovr: null, team_strength: null, season_result: null, actual_finish: null })
    .eq("room_id", room.id);

  // Relegated players are out of the competition — mark them so the lobby's
  // allReady check and the simulate route both skip them.
  if (relegatedIds.length > 0) {
    await service
      .from("draft_room_players")
      .update({ status: "out" })
      .in("id", relegatedIds);
  }
  await service
    .from("draft_rooms")
    .update({ status: "lobby", season_number: nextSeasonNumber, previous_league_table: previousLeagueTable })
    .eq("id", room.id);

  return Response.json({ ok: true });
}
