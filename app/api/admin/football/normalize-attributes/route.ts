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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Fetch all non-FC26 players in pages
  const PAGE = 500;
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

    for (const p of data) {
      const a = (p.attributes as Record<string, unknown>) ?? {};

      const normalized: Record<string, unknown> = {};

      const age = p.age ?? coerce(a.age);
      if (age != null) normalized.age = age;

      const attrVl = a.attr_vl as string | undefined;
      if (attrVl) normalized.attr_vl = attrVl;

      const club = p.club ?? (a.club as string) ?? null;
      if (club) normalized.club = club;

      const crossing = coerce(a.Crossing);
      if (crossing != null) normalized.Crossing = crossing;

      const defending = coerce(a.Defending);
      if (defending != null) normalized.Defending = defending;

      const dribbling = coerce(a.Dribbling);
      if (dribbling != null) normalized.Dribbling = dribbling;

      const imageUrl = p.image_url ?? (a.image_url as string) ?? null;
      if (imageUrl) normalized.image_url = imageUrl;

      const league = p.league ?? (a.league as string) ?? null;
      if (league) normalized.league = league;

      const name = p.name ?? (a.name as string) ?? null;
      if (name) normalized.name = name;

      const nationality = p.nationality ?? (a.nationality as string) ?? null;
      if (nationality) normalized.nationality = nationality;

      const natFlagUrl = a.nationality_flag_url as string | undefined;
      if (natFlagUrl) normalized.nationality_flag_url = natFlagUrl;

      const overall = p.overall ?? coerce(a.attr_sort) ?? coerce(a.overall) ?? null;
      if (overall != null) normalized.overall = overall;

      const pace = coerce(a.Pace);
      if (pace != null) normalized.Pace = pace;

      const passing = coerce(a.Passing);
      if (passing != null) normalized.Passing = passing;

      const physical = coerce(a.Physical);
      if (physical != null) normalized.Physical = physical;

      const positions = p.positions ?? (a.positions as string) ?? null;
      if (positions) normalized.positions = positions;

      const potential = p.potential ?? coerce(a.potential) ?? null;
      if (potential != null) normalized.potential = potential;

      const shooting = coerce(a.Shooting);
      if (shooting != null) normalized.Shooting = shooting;

      const sofifaId = p.sofifa_id ?? (a.sofifa_id as string) ?? null;
      if (sofifaId) normalized.sofifa_id = sofifaId;

      const { error: upErr } = await service
        .from("sofifa_players")
        .update({ attributes: normalized })
        .eq("sofifa_id", p.sofifa_id)
        .eq("fifa_year", p.fifa_year);

      if (upErr) { failed++; } else { updated++; }
    }

    if (data.length < PAGE) break;
    page++;
  }

  return NextResponse.json({ ok: true, updated, failed });
}
