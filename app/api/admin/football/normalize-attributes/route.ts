import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

function coerce(val: unknown): number | null {
  if (val == null) return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function buildNormalized(p: {
  sofifa_id: string;
  fifa_year: number;
  name: string | null;
  positions: string | null;
  club: string | null;
  league: string | null;
  overall: number | null;
  potential: number | null;
  age: number | null;
  image_url: string | null;
  nationality: string | null;
  attributes: Record<string, unknown>;
}) {
  const a = p.attributes ?? {};
  const out: Record<string, unknown> = {};

  const age = p.age ?? coerce(a.age);
  if (age != null) out.age = age;

  if (a.attr_vl) out.attr_vl = a.attr_vl;

  const club = p.club ?? (a.club as string) ?? null;
  if (club) out.club = club;

  const crossing = coerce(a.Crossing);
  if (crossing != null) out.Crossing = crossing;

  const defending = coerce(a.Defending);
  if (defending != null) out.Defending = defending;

  const dribbling = coerce(a.Dribbling);
  if (dribbling != null) out.Dribbling = dribbling;

  const imageUrl = p.image_url ?? (a.image_url as string) ?? null;
  if (imageUrl) out.image_url = imageUrl;

  const league = p.league ?? (a.league as string) ?? null;
  if (league) out.league = league;

  const name = p.name ?? (a.name as string) ?? null;
  if (name) out.name = name;

  const nationality = p.nationality ?? (a.nationality as string) ?? null;
  if (nationality) out.nationality = nationality;

  if (a.nationality_flag_url) out.nationality_flag_url = a.nationality_flag_url;

  const overall = p.overall ?? coerce(a.attr_sort) ?? coerce(a.overall) ?? null;
  if (overall != null) out.overall = overall;

  const pace = coerce(a.Pace);
  if (pace != null) out.Pace = pace;

  const passing = coerce(a.Passing);
  if (passing != null) out.Passing = passing;

  const physical = coerce(a.Physical);
  if (physical != null) out.Physical = physical;

  const positions = p.positions ?? (a.positions as string) ?? null;
  if (positions) out.positions = positions;

  const potential = p.potential ?? coerce(a.potential) ?? null;
  if (potential != null) out.potential = potential;

  const shooting = coerce(a.Shooting);
  if (shooting != null) out.Shooting = shooting;

  const sofifaId = p.sofifa_id ?? (a.sofifa_id as string) ?? null;
  if (sofifaId) out.sofifa_id = sofifaId;

  return out;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = createServiceClient();
    const PAGE = 200;
    let page = 0;
    let updated = 0;
    let failed = 0;

    while (true) {
      const { data, error } = await service
        .from("sofifa_players")
        .select("sofifa_id, fifa_year, name, positions, club, league, overall, potential, age, image_url, nationality, attributes")
        .neq("fifa_year", 2026)
        .range(page * PAGE, (page + 1) * PAGE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;

      // Build batch of upsert rows with normalized attributes
      const rows = data.map((p) => ({
        sofifa_id: p.sofifa_id,
        fifa_year: p.fifa_year,
        name: p.name,
        positions: p.positions,
        club: p.club,
        league: p.league,
        overall: p.overall,
        potential: p.potential,
        age: p.age,
        image_url: p.image_url,
        nationality: p.nationality,
        attributes: buildNormalized(p as Parameters<typeof buildNormalized>[0]),
      }));

      const { error: upErr } = await service
        .from("sofifa_players")
        .upsert(rows, { onConflict: "sofifa_id,fifa_year" });

      if (upErr) {
        console.error("[normalize] batch failed:", upErr.message);
        failed += rows.length;
      } else {
        updated += rows.length;
      }

      if (data.length < PAGE) break;
      page++;
    }

    return NextResponse.json({ ok: true, updated, failed });
  } catch (err) {
    console.error("[normalize] unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
