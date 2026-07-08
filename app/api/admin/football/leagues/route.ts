import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data } = await service
      .from("football_clubs")
      .select("wikidata_id, name, country, league")
      .ilike("name", `%${query}%`)
      .limit(50);

    if (!data || data.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    // Fetch career counts for all matched clubs in one query
    const ids = data.map((c) => c.wikidata_id);
    const { data: careerCounts } = await service
      .from("football_careers")
      .select("club_id")
      .in("club_id", ids)
      .limit(200000);

    const countMap = new Map<string, number>();
    for (const row of careerCounts ?? []) {
      countMap.set(row.club_id, (countMap.get(row.club_id) ?? 0) + 1);
    }

    const qLower = query.toLowerCase();
    const clubs = data
      .map((c: Record<string, unknown>) => ({
        id: c.wikidata_id as string,
        name: c.name as string,
        country: (c.country as string) ?? "",
        league: (c.league as string) ?? null,
        image: null,
        _count: countMap.get(c.wikidata_id as string) ?? 0,
        _exact: (c.name as string).toLowerCase() === qLower ? 1 : 0,
      }))
      // Sort: exact name match first, then by career count descending
      .sort((a, b) => b._exact - a._exact || b._count - a._count)
      .slice(0, 20)
      .map(({ _count: _c, _exact: _e, ...rest }) => rest);

    return NextResponse.json({ clubs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
