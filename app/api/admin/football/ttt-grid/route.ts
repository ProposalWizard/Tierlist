import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = req.nextUrl.searchParams.getAll("row");
  const cols = req.nextUrl.searchParams.getAll("col");
  if (rows.length !== 3 || cols.length !== 3) {
    return NextResponse.json({ error: "Need exactly 3 row and 3 col params" }, { status: 400 });
  }

  try {
    const service = createServiceClient();

    const allClubIds = [...rows, ...cols];
    const { data: clubRows } = await service
      .from("football_clubs")
      .select("wikidata_id, name")
      .in("wikidata_id", allClubIds);

    const clubNameMap = new Map(
      (clubRows ?? []).map((c) => [c.wikidata_id, c.name])
    );

    const rowClubs = rows.map((id) => clubNameMap.get(id) ?? id);
    const colClubs = cols.map((id) => clubNameMap.get(id) ?? id);

    // Fetch all career data for the 6 clubs in one query
    const { data: allCareers } = await service
      .from("football_careers")
      .select("player_id, club_id")
      .in("club_id", allClubIds)
      .limit(100000);

    const clubPlayerSets = new Map<string, Set<string>>();
    for (const c of allCareers ?? []) {
      if (!clubPlayerSets.has(c.club_id)) {
        clubPlayerSets.set(c.club_id, new Set());
      }
      clubPlayerSets.get(c.club_id)!.add(c.player_id);
    }

    // Find intersections
    const allIntersectionIds = new Set<string>();
    const cellIdArrays: string[][] = [];

    for (const rowId of rows) {
      for (const colId of cols) {
        const rowSet = clubPlayerSets.get(rowId) ?? new Set();
        const colSet = clubPlayerSets.get(colId) ?? new Set();
        const common = Array.from(rowSet).filter((id) => colSet.has(id));
        cellIdArrays.push(common);
        for (const id of common) allIntersectionIds.add(id);
      }
    }

    // Fetch all players in one go
    const uniqueIds = Array.from(allIntersectionIds);
    const allPlayers: Record<string, unknown>[] = [];
    for (let i = 0; i < uniqueIds.length; i += 500) {
      const chunk = uniqueIds.slice(i, i + 500);
      const { data: playerRows } = await service
        .from("football_players")
        .select("wikidata_id, name, country_id, position")
        .in("wikidata_id", chunk);
      if (playerRows) allPlayers.push(...playerRows);
    }

    // Get country names
    const countryIds = Array.from(new Set(allPlayers.map((p) => p.country_id as string).filter(Boolean)));
    const countryMap = new Map<string, string>();
    if (countryIds.length > 0) {
      const { data: countries } = await service
        .from("football_countries")
        .select("wikidata_id, name")
        .in("wikidata_id", countryIds);
      for (const c of countries ?? []) countryMap.set(c.wikidata_id, c.name);
    }

    const playerMap = new Map(allPlayers.map((p) => [p.wikidata_id as string, p]));

    // Build cells as a flat array of 9 (row-major order) to match the UI's gridCells[ri*3+ci] access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cells: any[][] = [];
    for (let i = 0; i < cellIdArrays.length; i++) {
      const ids = cellIdArrays[i];
      const players = ids
        .map((pid) => {
          const p = playerMap.get(pid);
          if (!p) return null;
          return {
            id: p.wikidata_id as string,
            name: p.name as string,
            nationality: countryMap.get((p.country_id as string) ?? "") ?? "",
            position: (p.position as string) ?? "",
            dob: "",
            image: null,
          };
        })
        .filter(Boolean);
      cells.push(players);
    }

    return NextResponse.json({ cells, rowClubs, colClubs });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Grid build failed" },
      { status: 500 },
    );
  }
}
