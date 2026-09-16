import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

/**
 * CUSTOM CLUBS — METADATA (kit + stadium name).
 *
 * Requested directly: the ability to invent a whole fake club and later
 * vote it into a real competition. A custom club's PLAYERS live directly in
 * `sofifa_players` (see the sibling `players` route) — this table only
 * holds the handful of fields that have nowhere else to live: its own real
 * home+away kit and its stadium name. Its logo reuses `club_logos`, exactly
 * like a real club's.
 */

export async function GET() {
  const service = createServiceClient();
  const { data, error } = await service.from("custom_clubs").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clubs: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name } = body as { name?: string };
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "A club name is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // A custom club can't reuse a REAL club's name — it would collide with
  // every real lookup (kits, logos, league squads) keyed by that same
  // string. Checked against sofifa_players' own club column, which is the
  // one place every real club name this game knows about actually lives.
  const { data: realClash } = await service
    .from("sofifa_players")
    .select("club")
    .ilike("club", name.trim())
    .limit(1)
    .maybeSingle();
  if (realClash) {
    return NextResponse.json({ error: `"${name.trim()}" is already a real club's name — pick something else` }, { status: 409 });
  }

  const { data, error } = await service
    .from("custom_clubs")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ club: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, stadium_name, home_shirt, home_trim, away_shirt, away_trim, logo_url } = body as {
    name?: string; stadium_name?: string; home_shirt?: string; home_trim?: string; away_shirt?: string; away_trim?: string; logo_url?: string;
  };
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const service = createServiceClient();

  // club_logos is public-READ only (same RLS posture as every real club's
  // badge) — no anon/authenticated write policy exists, so a browser client
  // upserting directly would fail. This route's service-role client is the
  // one place that can write it, same as every other admin-football route.
  if (logo_url !== undefined) {
    const { error: logoError } = await service.from("club_logos").upsert({ club: name, logo_url, updated_at: new Date().toISOString() });
    if (logoError) return NextResponse.json({ error: logoError.message }, { status: 500 });
  }

  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (stadium_name !== undefined) update.stadium_name = stadium_name;
  if (home_shirt !== undefined) update.home_shirt = home_shirt;
  if (home_trim !== undefined) update.home_trim = home_trim;
  if (away_shirt !== undefined) update.away_shirt = away_shirt;
  if (away_trim !== undefined) update.away_trim = away_trim;

  const { data, error } = await service.from("custom_clubs").update(update).eq("name", name).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ club: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const service = createServiceClient();
  // Cascade: every player this club owns, its logo, its saved lineup — a
  // deleted custom club leaves nothing real behind that could later collide
  // with a genuinely different club reusing the same name.
  await service.from("sofifa_players").delete().eq("club", name).like("sofifa_id", "custom:%");
  await service.from("club_logos").delete().eq("club", name);
  await service.from("star_lineups").delete().eq("club", name);
  const { error } = await service.from("custom_clubs").delete().eq("name", name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
