import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    clubs?: Record<string, string>;   // club name → logo URL
    leagues?: Record<string, string>; // league name → logo URL
  };

  const service = createServiceClient();
  let clubsSaved = 0;
  let leaguesSaved = 0;

  if (body.clubs && Object.keys(body.clubs).length > 0) {
    const rows = Object.entries(body.clubs)
      .filter(([club, url]) => club.trim() && url.trim())
      .map(([club, logo_url]) => ({ club: club.trim(), logo_url: logo_url.trim(), updated_at: new Date().toISOString() }));

    const { error } = await service
      .from("club_logos")
      .upsert(rows, { onConflict: "club" });
    if (error) return NextResponse.json({ error: `Club logos: ${error.message}` }, { status: 500 });
    clubsSaved = rows.length;
  }

  if (body.leagues && Object.keys(body.leagues).length > 0) {
    const rows = Object.entries(body.leagues)
      .filter(([league, url]) => league.trim() && url.trim())
      .map(([league, logo_url]) => ({ league: league.trim(), logo_url: logo_url.trim(), updated_at: new Date().toISOString() }));

    const { error } = await service
      .from("league_logos")
      .upsert(rows, { onConflict: "league" });
    if (error) return NextResponse.json({ error: `League logos: ${error.message}` }, { status: 500 });
    leaguesSaved = rows.length;
  }

  return NextResponse.json({ clubsSaved, leaguesSaved });
}
