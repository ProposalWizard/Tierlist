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
    .select("id, host_id, status, season_number, previous_league_table, settings")
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

  // Exclude relegated players ("out" status) — they don't submit squads.
  const activePlayers = roomPlayers.filter(p => (p as Record<string, unknown>).status !== "out");
  const notReady = activePlayers.filter(p => p.status !== "ready");
  if (notReady.length > 0) {
    return new Response("Not all players have submitted squads", { status: 400 });
  }

  // Atomically claim the room for simulation: only one request can transition it
  // out of a non-simulating/complete state, so a double-click can't run twice.
  // Stamp simulatingSince so a crash/timeout mid-run can be recovered from.
  const existingSettings = (room as Record<string, unknown>).settings as Record<string, unknown> | null | undefined;
  const { data: claimed } = await service
    .from("draft_rooms")
    .update({ status: "simulating", settings: { ...(existingSettings ?? {}), simulatingSince: Date.now() } })
    .eq("id", room.id)
    .in("status", ["lobby", "started", "drafting"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    // If the room is stuck in "simulating" for > 2 minutes (a prior request
    // crashed/timed out after claiming but before resetting), allow a reclaim
    // so clients aren't stranded on "Simulating season..." forever.
    const stuckSince = (existingSettings as Record<string, unknown> | null)?.simulatingSince as number | undefined;
    if (room.status === "simulating" && stuckSince && Date.now() - stuckSince > 2 * 60 * 1000) {
      const { data: reclaimed } = await service
        .from("draft_rooms")
        .update({ status: "simulating", settings: { ...(existingSettings ?? {}), simulatingSince: Date.now() } })
        .eq("id", room.id)
        .eq("status", "simulating")
        .select("id");
      if (!reclaimed || reclaimed.length === 0) {
        return Response.json({ ok: true, alreadyRunning: true });
      }
      // Reclaim succeeded — fall through to run the simulation below.
    } else {
      return Response.json({ ok: true, alreadyRunning: true });
    }
  }

  try {
    const emptySquads = activePlayers.filter(rp => !rp.squad || !Array.isArray(rp.squad) || rp.squad.length === 0);
    if (emptySquads.length > 0) {
      await service.from("draft_rooms").update({ status: "lobby" }).eq("id", room.id);
      return new Response(`Missing squad data for ${emptySquads.length} player(s)`, { status: 400 });
    }

    const N = activePlayers.length;
    const seasonNumber = room.season_number ?? 1;
    const previousLeagueTable = (room as Record<string, unknown>).previous_league_table as
      { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; isPlayer?: boolean }[] | null | undefined;
    const seasonTeams = getSeasonTeams(previousLeagueTable as LeagueTeam[] | undefined);
    const sortedAI = [...seasonTeams].sort((a, b) => b.strength - a.strength);
    const aiOpponents: { name: string; strength: number }[] = sortedAI.slice(0, 20 - N).map(t => ({ name: t.name, strength: t.strength }));

    // After relegations, the AI pool from the previous season may be short.
    // Top up from remaining sorted AI to ensure exactly 20 - N opponents.
    if (aiOpponents.length < 20 - N) {
      const used = new Set(aiOpponents.map((a: { name: string }) => a.name));
      const extras = sortedAI
        .filter(t => !used.has(t.name))
        .slice(0, (20 - N) - aiOpponents.length)
        .map(t => ({ name: t.name, strength: t.strength }));
      aiOpponents.push(...extras);
    }
    // Hard guard: if still short, log a diagnostic. The simulator tolerates a
    // smaller league; this handles edge cases where the AI pool is exhausted.
    if (aiOpponents.length + N !== 20) {
      console.error(`League size mismatch: ${N} humans + ${aiOpponents.length} AI = ${N + aiOpponents.length}, expected 20`);
    }

    const humanTeams: SharedSeasonInput[] = activePlayers.map(rp => ({
      userId: rp.user_id,
      displayName: rp.display_name,
      teamName: (rp as Record<string, unknown>).team_name as string | undefined,
      squad: (rp.squad ?? []) as DraftPlayer[],
    }));

    // Build previous season results map for Super Cup / Charity Shield / EL/UCL qualification
    const previousResults: Record<string, { uclWinner: boolean; uelWinner: boolean; faCupWinner: boolean; leagueCupWinner?: boolean }> = {};
    for (const rp of activePlayers) {
      const prev = rp.season_result as Record<string, unknown> | null | undefined;
      if (prev) {
        previousResults[rp.user_id] = {
          uclWinner: (prev.ucl as Record<string, unknown> | undefined)?.winner === true,
          uelWinner: (prev.uel as Record<string, unknown> | undefined)?.winner === true,
          faCupWinner: (prev.faCup as Record<string, unknown> | undefined)?.winner === true,
          leagueCupWinner: (prev.leagueCup as Record<string, unknown> | undefined)?.winner === true,
        };
      }
    }

    const sharedSeed = hashRoomId(room.id) ^ (room.season_number ?? 1) * 0x9e3779b9;
    const results = simulateSharedSeason(humanTeams, aiOpponents, sharedSeed >>> 0, seasonNumber, previousLeagueTable ?? undefined, Object.keys(previousResults).length > 0 ? previousResults : undefined);

    // Write results for active players
    await Promise.all(activePlayers.map(async (rp) => {
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

    // If the host was relegated and surviving players remain, hand off host role
    // so the room isn't deadlocked (the host gates next-season/simulate/start).
    const hostResult = results.get(room.host_id);
    const hostRelegated = hostResult && hostResult.actualFinish >= 18;
    const survivors = activePlayers.filter(rp => {
      const r = results.get(rp.user_id);
      return r && r.actualFinish < 18;
    });
    if (hostRelegated && survivors.length > 0) {
      // Hand off to best-finishing survivor
      const newHost = survivors.reduce((best, rp) => {
        const br = results.get(best.user_id)!;
        const rr = results.get(rp.user_id)!;
        return rr.actualFinish < br.actualFinish ? rp : best;
      });
      await service.from("draft_rooms").update({ host_id: newHost.user_id }).eq("id", room.id);
    }

    // 6-second buffer so all players (including late joiners) load DraftResult
    // before the animation starts and have time to receive the settings sync
    const revealStartAt = Date.now() + 6000;
    await service.from("draft_rooms").update({
      status: "complete",
      settings: { ...(existingSettings ?? {}), revealStartAt },
    }).eq("id", room.id);

    // Include updated players in response; "out" players keep their status unchanged.
    const updatedPlayers = roomPlayers.map(rp => {
      if ((rp as Record<string, unknown>).status === "out") return rp;
      return {
        ...rp,
        season_result: results.get(rp.user_id) ?? null,
        actual_finish: results.get(rp.user_id)?.actualFinish ?? null,
        status: "simulated",
      };
    });

    return Response.json({ ok: true, revealStartAt, players: updatedPlayers });
  } catch (e) {
    await service.from("draft_rooms").update({ status: "lobby" }).eq("id", room.id);
    console.error("Simulation error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Simulation failed: ${msg}`, { status: 500 });
  }
}
