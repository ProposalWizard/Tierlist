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

  // Idempotent: only advance if the room is complete and hasn't already moved to the next season
  if (room.status !== "complete" || (room.season_number ?? 1) >= nextSeasonNumber) {
    return Response.json({ ok: true, skipped: true });
  }

  // Read players' season_result BEFORE clearing, to preserve the league table for European comp qualification
  const { data: roomPlayers } = await service
    .from("draft_room_players")
    .select("season_result")
    .eq("room_id", room.id)
    .not("season_result", "is", null)
    .limit(1);

  let previousLeagueTable: { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }[] | null = null;
  if (roomPlayers && roomPlayers.length > 0) {
    const result = roomPlayers[0].season_result as { leagueTable?: { name: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number; isPlayer?: boolean }[] } | null;
    if (result?.leagueTable) {
      // Store a compact form: strip isPlayer (it varies per human) and rename fields to save space
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

  // Reset room for the next season, storing the previous league table
  await service
    .from("draft_rooms")
    .update({ status: "lobby", season_number: nextSeasonNumber, previous_league_table: previousLeagueTable })
    .eq("id", room.id);

  // Reset all players for the new season (drafting, not ready — they need to re-submit squads)
  await service
    .from("draft_room_players")
    .update({ status: "drafting", squad: null, avg_ovr: null, team_strength: null, season_result: null, actual_finish: null })
    .eq("room_id", room.id);

  return Response.json({ ok: true });
}
