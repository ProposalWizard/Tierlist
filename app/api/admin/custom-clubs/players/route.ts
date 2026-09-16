import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";

/** Same rule app/api/admin/football/player-search/route.ts's own private
 *  copy uses — `fifa_edition` is a real NOT NULL column on `sofifa_players`,
 *  caught directly (a real INSERT failed against the live database without
 *  it) rather than assumed from the type shape alone. */
function editionLabel(year: number): string {
  const y = year > 100 ? year % 100 : year;
  if (y >= 24) return `FC ${String(y).padStart(2, "0")}`;
  return `FIFA ${String(y).padStart(2, "0")}`;
}

/**
 * CUSTOM CLUBS — PLAYERS, CREATED FROM SCRATCH.
 *
 * A custom player is a real `sofifa_players` row, same table, same year,
 * same columns every real player already uses — the ONLY difference is a
 * `custom:`-prefixed `sofifa_id` (a real fetch never produces one — the
 * same tell `leagueSquads.ts`'s `generatedSquad` fallback already uses for
 * "this isn't real"). That means every existing real-data path — the
 * league-squads fetch, `/admin/football/players`'s own editor, the
 * transfer engine — already works for a custom player with zero changes;
 * this route only adds the one thing that page can't do: create a player
 * with no real source row to clone from.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const club = searchParams.get("club");
  if (!club) return NextResponse.json({ error: "Missing club" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("sofifa_players")
    .select("*")
    .eq("club", club)
    .eq("fifa_year", STAR_FIFA_YEAR)
    .like("sofifa_id", "custom:%")
    .order("overall", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ players: data });
}

interface CreateBody {
  club: string;
  name: string;
  positions: string; // comma-separated, e.g. "ST, CAM"
  overall: number;
  age: number;
  nationality: string;
  potential: "none" | "high" | "worldClass";
  image_url?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as CreateBody;
  const { club, name, positions, overall, age, nationality, potential, image_url } = body;
  if (!club?.trim() || !name?.trim() || !positions?.trim()) {
    return NextResponse.json({ error: "club, name, and positions are all required" }, { status: 400 });
  }
  if (!Number.isFinite(overall) || overall < 40 || overall > 99) {
    return NextResponse.json({ error: "overall must be a real rating between 40 and 99" }, { status: 400 });
  }
  if (!Number.isFinite(age) || age < 15 || age > 45) {
    return NextResponse.json({ error: "age must be a real number between 15 and 45" }, { status: 400 });
  }

  const service = createServiceClient();
  const sofifa_id = `custom:${crypto.randomUUID()}`;
  const { data, error } = await service
    .from("sofifa_players")
    .insert({
      sofifa_id,
      fifa_year: STAR_FIFA_YEAR,
      fifa_edition: editionLabel(STAR_FIFA_YEAR),
      name: name.trim(),
      positions: positions.trim(),
      nationality: nationality?.trim() || null,
      club: club.trim(),
      overall: Math.round(overall),
      age: Math.round(age),
      image_url: image_url?.trim() || null,
      high_potential: potential === "high" || potential === "worldClass",
      world_class_potential: potential === "worldClass",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player: data });
}

interface UpdateBody {
  sofifa_id: string;
  name?: string;
  positions?: string;
  overall?: number;
  age?: number;
  nationality?: string;
  potential?: "none" | "high" | "worldClass";
  image_url?: string;
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as UpdateBody;
  const { sofifa_id, name, positions, overall, age, nationality, potential, image_url } = body;
  if (!sofifa_id?.startsWith("custom:")) {
    return NextResponse.json({ error: "Missing or invalid sofifa_id — this route only edits custom players" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name.trim();
  if (positions !== undefined) update.positions = positions.trim();
  if (overall !== undefined) update.overall = Math.round(overall);
  if (age !== undefined) update.age = Math.round(age);
  if (nationality !== undefined) update.nationality = nationality.trim() || null;
  if (image_url !== undefined) update.image_url = image_url.trim() || null;
  if (potential !== undefined) {
    update.high_potential = potential === "high" || potential === "worldClass";
    update.world_class_potential = potential === "worldClass";
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("sofifa_players")
    .update(update)
    .eq("sofifa_id", sofifa_id)
    .eq("fifa_year", STAR_FIFA_YEAR)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const sofifa_id = searchParams.get("sofifa_id");
  if (!sofifa_id?.startsWith("custom:")) {
    return NextResponse.json({ error: "Missing or invalid sofifa_id — this route only deletes custom players" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("sofifa_players").delete().eq("sofifa_id", sofifa_id).eq("fifa_year", STAR_FIFA_YEAR);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
