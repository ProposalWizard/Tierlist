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
    .select("id, host_id, status, season_number, settings")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // Only the host may advance the room to the next season — otherwise any
  // authenticated user who knows the 6-char code could reset an in-progress
  // game and wipe every player's season result. Exception: if the host was
  // relegated ("out"), any active member may advance so the room isn't stuck.
  const { data: callerRow } = await service
    .from("draft_room_players")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerRow) return new Response("Not a room member", { status: 403 });

  if (room.host_id !== user.id) {
    // Allow non-host to advance only if the host's row is "out"
    const { data: hostRow } = await service
      .from("draft_room_players")
      .select("status")
      .eq("room_id", room.id)
      .eq("user_id", room.host_id)
      .maybeSingle();
    if (!hostRow || hostRow.status !== "out") {
      return new Response("Only the host can start the next season", { status: 403 });
    }
  }

  // Idempotent: only advance if the room is complete and hasn't already moved to the next season
  if (room.status !== "complete" || (room.season_number ?? 1) >= nextSeasonNumber) {
    return Response.json({ ok: true, skipped: true });
  }

  // Read all players' data BEFORE clearing — need season_result for the league
  // table and actual_finish to identify relegated players.
  const { data: allPlayers } = await service
    .from("draft_room_players")
    .select("id, display_name, season_result, actual_finish")
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

  // Guard: refuse to advance if any active (non-out) player hasn't received their
  // simulation result yet. Otherwise the host advancing early would wipe another
  // player's result before they've seen it, leaving them permanently stuck.
  const { data: statusCheck } = await service
    .from("draft_room_players")
    .select("id, status, season_result")
    .eq("room_id", room.id);
  const missingResult = (statusCheck ?? []).some(
    p => (p as Record<string, unknown>).status !== "out" && p.season_result == null
  );
  if (missingResult) {
    return new Response("Some players have not yet received simulation results", { status: 409 });
  }

  // Identify relegated players (finished 18th or worse) before clearing the column.
  const relegatedIds = (allPlayers ?? [])
    .filter(p => typeof p.actual_finish === "number" && p.actual_finish >= 18)
    .map(p => p.id as string);

  // Snapshot current season results into room.settings.allPlayerSeasons BEFORE clearing.
  // This lets late-polling clients (who miss the season_result window due to the race
  // between tryComplete and next-season) recover the full history from the server.
  const existingSettings = (room.settings as Record<string, unknown>) ?? {};
  const prevHistory = (existingSettings.allPlayerSeasons as Record<string, unknown[]>) ?? {};
  const newHistory: Record<string, unknown[]> = { ...prevHistory };
  for (const p of allPlayers ?? []) {
    const playerName = (p as Record<string, unknown>).display_name as string | undefined;
    if (p.season_result && playerName) {
      if (!newHistory[playerName]) newHistory[playerName] = [];
      newHistory[playerName] = [...newHistory[playerName], p.season_result];
    }
  }

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
    .update({
      status: "lobby",
      season_number: nextSeasonNumber,
      previous_league_table: previousLeagueTable,
      settings: { ...existingSettings, allPlayerSeasons: newHistory, revealStartAt: null },
    })
    .eq("id", room.id);

  return Response.json({ ok: true });
}
