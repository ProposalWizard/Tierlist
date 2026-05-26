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
  const competitionId = searchParams.get("competition");
  const seasonId = searchParams.get("season");
  const clubQuery = searchParams.get("q");

  if (clubQuery) {
    try {
      const data = await tmFetch(`/clubs/search/${encodeURIComponent(clubQuery)}`);
      return NextResponse.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (!competitionId) {
    return NextResponse.json({ error: "competition or q param required" }, { status: 400 });
  }

  try {
    const url = seasonId
      ? `/competitions/${competitionId}/clubs?season_id=${seasonId}`
      : `/competitions/${competitionId}/clubs`;
    const data = await tmFetch(url);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
