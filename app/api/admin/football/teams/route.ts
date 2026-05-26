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
  const leagueId = searchParams.get("league");
  const season = searchParams.get("season") ?? "2024";

  if (!leagueId) {
    return NextResponse.json({ error: "league param required" }, { status: 400 });
  }

  try {
    const { data, errors } = await apiFetch("/teams", { league: leagueId, season });
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 502 });
    }
    return NextResponse.json({ teams: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
