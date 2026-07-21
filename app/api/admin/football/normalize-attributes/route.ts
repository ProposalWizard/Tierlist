import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

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
  const crossing = coerce(a.Crossing) ?? coerce(a.attr_cr) ?? coerce(a.crossing);
  if (crossing != null) out.Crossing = crossing;
  const defending = coerce(a.Defending) ?? coerce(a.attr_def) ?? coerce(a.defending);
  if (defending != null) out.Defending = defending;
  const dribbling = coerce(a.Dribbling) ?? coerce(a.attr_dri) ?? coerce(a.dribbling);
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
  const overall = p.overall ?? coerce(a.overall) ?? coerce(a.attr_sort) ?? coerce(a.attr_oa) ?? null;
  if (overall != null) out.overall = overall;
  const pace = coerce(a.Pace) ?? coerce(a.attr_pac) ?? coerce(a.pac);
  if (pace != null) out.Pace = pace;
  const passing = coerce(a.Passing) ?? coerce(a.attr_pas) ?? coerce(a.passing);
  if (passing != null) out.Passing = passing;
  const physical = coerce(a.Physical) ?? coerce(a.attr_phy) ?? coerce(a.physical);
  if (physical != null) out.Physical = physical;
  const positions = p.positions ?? (a.positions as string) ?? (a.player_positions as string) ?? null;
  if (positions) out.positions = positions;
  const potential = p.potential ?? coerce(a.potential) ?? coerce(a.attr_pt) ?? null;
  if (potential != null) out.potential = potential;
  const shooting = coerce(a.Shooting) ?? coerce(a.attr_sho) ?? coerce(a.shooting);
  if (shooting != null) out.Shooting = shooting;
  const sofifaId = p.sofifa_id ?? (a.sofifa_id as string) ?? null;
  if (sofifaId) out.sofifa_id = sofifaId;

  return out;
}

// POST /api/admin/football/normalize-attributes?year=2023[&test=1]
// Normalises one FIFA year at a time to avoid serverless timeouts.
// Add &test=1 to process just one player and return the full error for debugging.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const year = parseInt(req.nextUrl.searchParams.get("year") ?? "", 10);
    if (!year || year === 2026) {
      return NextResponse.json({ error: "Provide a valid year (not 2026)" }, { status: 400 });
    }

    const testMode = req.nextUrl.searchParams.get("test") === "1";
    const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "500", 10), 1000);

    const service = createServiceClient();
    const baseQuery = service
      .from("sofifa_players")
      .select("sofifa_id, fifa_year, name, positions, club, league, overall, potential, age, image_url, nationality, attributes")
      .eq("fifa_year", year);

    const { data, error } = testMode
      ? await baseQuery.limit(3)
      : await baseQuery.range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ ok: true, year, updated: 0 });

    // --- Test mode: try a single upsert and return the full Supabase response ---
    if (testMode) {
      const p = data[0];
      const normalized = buildNormalized(p as Parameters<typeof buildNormalized>[0]);

      // Try UPDATE first
      const updateRes = await service
        .from("sofifa_players")
        .update({ attributes: normalized })
        .eq("sofifa_id", p.sofifa_id)
        .eq("fifa_year", p.fifa_year)
        .select("sofifa_id, fifa_year");

      // Also try UPSERT with full row
      const upsertRow = {
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
        attributes: normalized,
      };
      const upsertRes = await service
        .from("sofifa_players")
        .upsert([upsertRow], { onConflict: "sofifa_id,fifa_year" });

      return NextResponse.json({
        testMode: true,
        year,
        player: {
          sofifa_id: p.sofifa_id,
          name: p.name,
          fifa_year: p.fifa_year,
          originalAttrKeys: Object.keys((p.attributes as Record<string, unknown>) ?? {}),
        },
        normalizedKeys: Object.keys(normalized),
        normalizedSample: normalized,
        updateResult: {
          data: updateRes.data,
          error: updateRes.error ? {
            message: updateRes.error.message,
            ...(updateRes.error as unknown as Record<string, unknown>),
          } : null,
          status: updateRes.status,
          count: updateRes.count,
        },
        upsertResult: {
          error: upsertRes.error ? {
            message: upsertRes.error.message,
            ...(upsertRes.error as unknown as Record<string, unknown>),
          } : null,
          status: upsertRes.status,
          count: upsertRes.count,
        },
      });
    }

    // --- Normal mode: update attributes column for each player ---
    const rows = data.map((p) => ({
      sofifa_id: p.sofifa_id,
      fifa_year: p.fifa_year,
      attributes: buildNormalized(p as Parameters<typeof buildNormalized>[0]),
    }));

    let updated = 0;
    let failed = 0;
    let firstError: string | null = null;
    const PARALLEL = 20;

    for (let i = 0; i < rows.length; i += PARALLEL) {
      const chunk = rows.slice(i, i + PARALLEL);
      const results = await Promise.all(
        chunk.map((row) =>
          service
            .from("sofifa_players")
            .update({ attributes: row.attributes })
            .eq("sofifa_id", row.sofifa_id)
            .eq("fifa_year", row.fifa_year)
        )
      );
      for (const { error: upErr } of results) {
        if (upErr) {
          failed++;
          if (!firstError) firstError = upErr.message;
        } else {
          updated++;
        }
      }
    }

    const hasMore = data.length === limit;
    return NextResponse.json({ ok: true, year, updated, failed, firstError, offset, limit, count: data.length, hasMore });
  } catch (err) {
    console.error("[normalize-attributes]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
