import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { simulateSharedSeason, getSeasonTeams } from "@/lib/seasonSimulator";
import type { DraftPlayer, SharedSeasonInput, LeagueTeam, PlayerAttributes } from "@/lib/seasonSimulator";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateFakeSquad(seed: number): DraftPlayer[] {
  const slots: { pos: string; isSub: boolean; ovr: number; attrs: PlayerAttributes }[] = [
    { pos: "GK",  isSub: false, ovr: 87, attrs: { pace: 55, shooting: 20, passing: 65, dribbling: 30, defending: 30, physical: 75, finishing: 15, positioning: 20, crossing: 20, vision: 60, longShots: 15, shortPassing: 65, longPassing: 70, heading: 15, interceptions: 20, standingTackle: 15, marking: 15, reactions: 88, sprintSpeed: 55, gkDiving: 87, gkPositioning: 86, gkReflexes: 89 } },
    { pos: "LB",  isSub: false, ovr: 84, attrs: { pace: 85, shooting: 55, passing: 78, dribbling: 75, defending: 80, physical: 76, finishing: 45, positioning: 50, crossing: 82, vision: 72, longShots: 50, shortPassing: 78, longPassing: 74, heading: 60, interceptions: 80, standingTackle: 82, marking: 78, reactions: 82, sprintSpeed: 86, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "CB",  isSub: false, ovr: 86, attrs: { pace: 70, shooting: 40, passing: 65, dribbling: 55, defending: 88, physical: 86, finishing: 30, positioning: 35, crossing: 30, vision: 55, longShots: 35, shortPassing: 68, longPassing: 70, heading: 85, interceptions: 86, standingTackle: 88, marking: 87, reactions: 84, sprintSpeed: 70, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "CB",  isSub: false, ovr: 85, attrs: { pace: 68, shooting: 38, passing: 63, dribbling: 53, defending: 87, physical: 85, finishing: 28, positioning: 33, crossing: 28, vision: 53, longShots: 33, shortPassing: 66, longPassing: 68, heading: 84, interceptions: 85, standingTackle: 87, marking: 86, reactions: 83, sprintSpeed: 68, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "RB",  isSub: false, ovr: 84, attrs: { pace: 87, shooting: 56, passing: 79, dribbling: 76, defending: 79, physical: 74, finishing: 46, positioning: 52, crossing: 83, vision: 73, longShots: 52, shortPassing: 79, longPassing: 75, heading: 58, interceptions: 78, standingTackle: 80, marking: 76, reactions: 82, sprintSpeed: 88, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "CM",  isSub: false, ovr: 86, attrs: { pace: 72, shooting: 78, passing: 87, dribbling: 84, defending: 72, physical: 78, finishing: 75, positioning: 78, crossing: 76, vision: 88, longShots: 80, shortPassing: 89, longPassing: 86, heading: 55, interceptions: 74, standingTackle: 72, marking: 68, reactions: 86, sprintSpeed: 72, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "CM",  isSub: false, ovr: 85, attrs: { pace: 74, shooting: 76, passing: 85, dribbling: 82, defending: 74, physical: 80, finishing: 73, positioning: 76, crossing: 74, vision: 86, longShots: 78, shortPassing: 87, longPassing: 84, heading: 60, interceptions: 76, standingTackle: 74, marking: 70, reactions: 85, sprintSpeed: 74, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "CM",  isSub: false, ovr: 84, attrs: { pace: 76, shooting: 74, passing: 83, dribbling: 80, defending: 76, physical: 82, finishing: 70, positioning: 74, crossing: 72, vision: 84, longShots: 76, shortPassing: 85, longPassing: 82, heading: 65, interceptions: 78, standingTackle: 76, marking: 72, reactions: 84, sprintSpeed: 76, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "LW",  isSub: false, ovr: 87, attrs: { pace: 92, shooting: 84, passing: 80, dribbling: 90, defending: 35, physical: 65, finishing: 85, positioning: 88, crossing: 78, vision: 80, longShots: 78, shortPassing: 82, longPassing: 70, heading: 50, interceptions: 30, standingTackle: 28, marking: 25, reactions: 88, sprintSpeed: 93, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "ST",  isSub: false, ovr: 88, attrs: { pace: 85, shooting: 90, passing: 72, dribbling: 82, defending: 30, physical: 82, finishing: 92, positioning: 91, crossing: 55, vision: 72, longShots: 80, shortPassing: 74, longPassing: 55, heading: 85, interceptions: 25, standingTackle: 22, marking: 20, reactions: 90, sprintSpeed: 86, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "RW",  isSub: false, ovr: 86, attrs: { pace: 90, shooting: 82, passing: 79, dribbling: 88, defending: 33, physical: 63, finishing: 83, positioning: 86, crossing: 80, vision: 78, longShots: 76, shortPassing: 80, longPassing: 68, heading: 48, interceptions: 28, standingTackle: 26, marking: 23, reactions: 87, sprintSpeed: 91, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "GK",  isSub: true,  ovr: 80, attrs: { pace: 50, shooting: 15, passing: 55, dribbling: 25, defending: 25, physical: 70, finishing: 10, positioning: 15, crossing: 15, vision: 50, longShots: 10, shortPassing: 55, longPassing: 60, heading: 10, interceptions: 15, standingTackle: 10, marking: 10, reactions: 80, sprintSpeed: 50, gkDiving: 80, gkPositioning: 78, gkReflexes: 81 } },
    { pos: "CB",  isSub: true,  ovr: 82, attrs: { pace: 65, shooting: 35, passing: 60, dribbling: 50, defending: 84, physical: 82, finishing: 25, positioning: 30, crossing: 25, vision: 50, longShots: 30, shortPassing: 62, longPassing: 65, heading: 80, interceptions: 82, standingTackle: 84, marking: 83, reactions: 80, sprintSpeed: 65, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
    { pos: "ST",  isSub: true,  ovr: 82, attrs: { pace: 82, shooting: 84, passing: 65, dribbling: 78, defending: 28, physical: 76, finishing: 86, positioning: 84, crossing: 50, vision: 65, longShots: 72, shortPassing: 66, longPassing: 48, heading: 78, interceptions: 22, standingTackle: 18, marking: 16, reactions: 82, sprintSpeed: 83, gkDiving: 0, gkPositioning: 0, gkReflexes: 0 } },
  ];
  return slots.map((s, i) => ({
    name: `Dev ${s.pos}${s.isSub ? " (sub)" : ""}`,
    overall: s.ovr,
    positions: s.pos,
    club: "Dev FC",
    clubYear: "FC 24",
    assignedPosition: s.pos,
    sofifa_id: `dev-${seed}-${i}`,
    image_url: null,
    nationality: "England",
    age: 24 + (i % 8),
    isSub: s.isSub,
    attrs: s.attrs,
  }));
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!await isAdmin(user.id)) return new Response("Admin only", { status: 403 });

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, host_id, status, season_number, previous_league_table")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });
  if (room.host_id !== user.id) return new Response("Only the host can do this", { status: 403 });

  const { data: roomPlayers } = await service
    .from("draft_room_players")
    .select("*")
    .eq("room_id", room.id);

  if (!roomPlayers || roomPlayers.length === 0) {
    return new Response("No players in room", { status: 400 });
  }

  // Always give every player a strong fake squad
  for (const rp of roomPlayers) {
    const fake = generateFakeSquad(hashStr(rp.id));
    await service.from("draft_room_players").update({
      squad: fake,
      status: "ready",
      avg_ovr: 85,
      team_strength: 0.85,
    }).eq("id", rp.id);
  }

  // Re-fetch with updated squads
  const { data: readyPlayers } = await service
    .from("draft_room_players")
    .select("*")
    .eq("room_id", room.id);

  if (!readyPlayers) return new Response("Failed to refetch players", { status: 500 });

  await service.from("draft_rooms").update({ status: "simulating" }).eq("id", room.id);

  try {
    const N = readyPlayers.length;
    const seasonNumber = room.season_number ?? 1;
    const previousLeagueTable = (room as Record<string, unknown>).previous_league_table as
      { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; isPlayer?: boolean }[] | null | undefined;
    const seasonTeams = getSeasonTeams(previousLeagueTable as LeagueTeam[] | undefined);
    const aiOpponents = [...seasonTeams]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 20 - N)
      .map(t => ({ name: t.name, strength: t.strength }));

    const humanTeams: SharedSeasonInput[] = readyPlayers.map(rp => ({
      userId: rp.user_id,
      displayName: rp.display_name,
      squad: (rp.squad ?? []) as DraftPlayer[],
    }));

    const sharedSeed = hashStr(room.id) ^ (seasonNumber) * 0x9e3779b9;

    const results = simulateSharedSeason(humanTeams, aiOpponents, sharedSeed >>> 0, seasonNumber, previousLeagueTable ?? undefined);

    for (const rp of readyPlayers) {
      const result = results.get(rp.user_id);
      if (!result) continue;
      await service.from("draft_room_players").update({
        season_result: result,
        actual_finish: result.actualFinish,
        status: "simulated",
      }).eq("id", rp.id);
    }

    await service.from("draft_rooms").update({ status: "complete" }).eq("id", room.id);
    return Response.json({ ok: true });
  } catch (e) {
    await service.from("draft_rooms").update({ status: "lobby" }).eq("id", room.id);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Simulation failed: ${msg}`, { status: 500 });
  }
}
