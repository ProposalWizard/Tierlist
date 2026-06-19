import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { simulateSharedSeason, getSeasonTeams } from "@/lib/seasonSimulator";
import type { DraftPlayer, SharedSeasonInput, LeagueTeam } from "@/lib/seasonSimulator";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateFakeSquad(seed: number): DraftPlayer[] {
  const slots = [
    { pos: "GK",  isSub: false },
    { pos: "LB",  isSub: false },
    { pos: "CB",  isSub: false },
    { pos: "CB",  isSub: false },
    { pos: "RB",  isSub: false },
    { pos: "CM",  isSub: false },
    { pos: "CM",  isSub: false },
    { pos: "CM",  isSub: false },
    { pos: "LW",  isSub: false },
    { pos: "ST",  isSub: false },
    { pos: "RW",  isSub: false },
    { pos: "GK",  isSub: true  },
    { pos: "CB",  isSub: true  },
    { pos: "ST",  isSub: true  },
  ];
  return slots.map((s, i) => ({
    name: `Dev ${s.pos}${s.isSub ? " (sub)" : ""}`,
    overall: 78 + ((seed + i * 7) % 10),
    positions: s.pos,
    club: "Dev FC",
    clubYear: "FC 24",
    assignedPosition: s.pos,
    sofifa_id: `dev-${seed}-${i}`,
    image_url: null,
    nationality: "England",
    age: 24 + (i % 8),
    isSub: s.isSub,
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

  // Fill any missing squads and mark all as ready
  for (const rp of roomPlayers) {
    const hasSquad = rp.squad && Array.isArray(rp.squad) && rp.squad.length > 0;
    if (!hasSquad) {
      const fake = generateFakeSquad(hashStr(rp.id));
      await service.from("draft_room_players").update({
        squad: fake,
        status: "ready",
        avg_ovr: 83,
        team_strength: 0.83,
      }).eq("id", rp.id);
    } else {
      const squad = rp.squad as { overall?: number }[];
      const starters = squad.filter((p: { isSub?: boolean }) => !p.isSub);
      const sum = starters.reduce((acc, p) => acc + (p.overall ?? 75), 0);
      const avgOvr = starters.length > 0 ? Math.round(sum / starters.length) : 75;
      const teamStrength = parseFloat((avgOvr / 100).toFixed(2));
      await service.from("draft_room_players").update({
        status: "ready",
        avg_ovr: avgOvr,
        team_strength: teamStrength,
      }).eq("id", rp.id);
    }
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
