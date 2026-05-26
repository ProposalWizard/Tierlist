import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { tmFetch } from "@/lib/transfermarkt";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get("club");
  const playerId = searchParams.get("player");
  const playerQuery = searchParams.get("q");
  const seasonId = searchParams.get("season");
  const detail = searchParams.get("detail");

  // Search players by name
  if (playerQuery) {
    try {
      const data = await tmFetch(`/players/search/${encodeURIComponent(playerQuery)}`);
      return NextResponse.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Get single player details
  if (playerId) {
    try {
      const profile = await tmFetch(`/players/${playerId}/profile`);

      let transfers = null;
      let stats = null;
      let achievements = null;

      if (detail === "full" || detail === "transfers") {
        transfers = await tmFetch(`/players/${playerId}/transfers`);
      }
      if (detail === "full" || detail === "stats") {
        stats = await tmFetch(`/players/${playerId}/stats`);
      }
      if (detail === "full" || detail === "achievements") {
        achievements = await tmFetch(`/players/${playerId}/achievements`);
      }

      return NextResponse.json({ profile, transfers, stats, achievements });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Get club squad
  if (clubId) {
    try {
      const url = seasonId
        ? `/clubs/${clubId}/players?season_id=${seasonId}`
        : `/clubs/${clubId}/players`;
      const data = await tmFetch(url);
      return NextResponse.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Provide club, player, or q param" }, { status: 400 });
}
