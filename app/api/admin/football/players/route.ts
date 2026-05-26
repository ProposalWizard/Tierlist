import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { apiFetch } from "@/lib/apiFootball";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("team");
  const playerId = searchParams.get("player");
  const search = searchParams.get("q");
  const season = searchParams.get("season") ?? "2024";
  const detail = searchParams.get("detail");

  // Search players by name
  if (search) {
    try {
      const { data, errors } = await apiFetch("/players", { search, league: "39", season });
      if (errors.length > 0) {
        return NextResponse.json({ error: errors.join(", ") }, { status: 502 });
      }
      return NextResponse.json({ players: data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Get single player details (career, transfers, trophies)
  if (playerId) {
    try {
      const result: Record<string, unknown> = {};

      // Career clubs
      const { data: careerData } = await apiFetch("/players/teams", { player: playerId });
      result.career = careerData;

      if (detail === "full" || detail === "transfers") {
        const { data: transferData } = await apiFetch("/transfers", { player: playerId });
        result.transfers = transferData;
      }

      if (detail === "full" || detail === "trophies") {
        const { data: trophyData } = await apiFetch("/trophies", { player: playerId });
        result.trophies = trophyData;
      }

      if (detail === "full" || detail === "stats") {
        // Get stats for the most recent seasons available
        const { data: statsData } = await apiFetch("/players", { id: playerId, season });
        result.stats = statsData;
      }

      return NextResponse.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Get team squad
  if (teamId) {
    try {
      const { data: squadData, errors } = await apiFetch("/players/squads", { team: teamId });
      if (errors.length > 0) {
        return NextResponse.json({ error: errors.join(", ") }, { status: 502 });
      }
      return NextResponse.json({ squad: squadData });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Provide team, player, or q param" }, { status: 400 });
}
