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
  const active = (statusCheck ?? []).filter(p => (p as Record<string, unknown>).status !== "out");
  const missingResult = active.some(p => p.season_result == null);
  // A previous call that reset the players but failed before flipping the room
  // leaves EVERY active player cleared and back to "drafting" while the room is
  // still "complete". That state is a resumable partial failure, not an
  // early-advance attempt, so it must not be rejected — otherwise the guard
  // blocks its own retry and the room can never advance again.
  const resetAlreadyApplied =
    active.length > 0 &&
    active.every(
      p => p.season_result == null && (p as Record<string, unknown>).status === "drafting"
    );
  if (missingResult && !resetAlreadyApplied) {
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

  // Three writes, ordered so that a failure at any point is recoverable:
  //
  //  1. Save the season history while the results still exist. Doing this last
  //     would lose the whole season's history if the reset had already cleared
  //     season_result and the room write then failed.
  //  2. Reset the players.
  //  3. Flip the room to "lobby" LAST. The ready endpoint rejects submissions
  //     while the room is "complete", so keeping that status until the final
  //     write means no ready can land mid-way and be wiped by the reset.
  //
  // Every write is checked: supabase-js returns { data, error } rather than
  // throwing, so an unchecked failure here would return ok:true having left the
  // room half-advanced.
  const { error: historyErr } = await service
    .from("draft_rooms")
    .update({ settings: { ...existingSettings, allPlayerSeasons: newHistory } })
    .eq("id", room.id);
  if (historyErr) {
    return new Response(`Could not save season history: ${historyErr.message}`, { status: 500 });
  }

  const { error: resetErr } = await service
    .from("draft_room_players")
    .update({ status: "drafting", avg_ovr: null, team_strength: null, season_result: null, actual_finish: null })
    .eq("room_id", room.id);
  if (resetErr) {
    return new Response(`Could not reset players: ${resetErr.message}`, { status: 500 });
  }

  // Relegated players are out of the competition — mark them so the lobby's
  // allReady check and the simulate route both skip them.
  if (relegatedIds.length > 0) {
    const { error: relegateErr } = await service
      .from("draft_room_players")
      .update({ status: "out" })
      .in("id", relegatedIds);
    if (relegateErr) {
      return new Response(`Could not mark relegated players: ${relegateErr.message}`, { status: 500 });
    }
  }

  const { error: roomErr } = await service
    .from("draft_rooms")
    .update({
      status: "lobby",
      season_number: nextSeasonNumber,
      previous_league_table: previousLeagueTable,
      settings: { ...existingSettings, allPlayerSeasons: newHistory, revealStartAt: null },
      // Clear the finished American draft. It carries complete:true and
      // seeded:true, and carrying those into the new season made the next
      // draft look already-finished — clients skipped straight past it — and
      // left it permanently unseedable.
      american_state: null,
    })
    .eq("id", room.id);
  if (roomErr) {
    return new Response(`Could not advance the room: ${roomErr.message}`, { status: 500 });
  }

  return Response.json({ ok: true });
}
