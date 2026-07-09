import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

const ACCENT_MAP: Record<string, string[]> = {
  a: ["à", "á", "â", "ã", "ä", "å"],
  c: ["ç", "č", "ć"],
  d: ["ð", "đ"],
  e: ["è", "é", "ê", "ë", "ě"],
  i: ["ì", "í", "î", "ï"],
  l: ["ł"],
  n: ["ñ", "ń"],
  o: ["ò", "ó", "ô", "õ", "ö", "ø"],
  r: ["ř"],
  s: ["š", "ś", "ş"],
  u: ["ù", "ú", "û", "ü"],
  y: ["ý", "ÿ"],
  z: ["ž", "ź", "ż"],
};

function generateAccentVariants(q: string): string[] {
  const lower = q.toLowerCase();
  const variants = new Set<string>([q]);

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const accented = ACCENT_MAP[ch];
    if (!accented) continue;
    for (const acc of accented) {
      variants.add(q.slice(0, i) + acc + q.slice(i + 1));
    }
  }

  return Array.from(variants);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const year = searchParams.get("year");
  const club = searchParams.get("club")?.trim();
  const position = searchParams.get("position")?.trim();
  const limitParam = searchParams.get("limit");

  // Require year when no name — prevents full-table-scan timeouts on club/position alone
  if (!q && !year) {
    return NextResponse.json(
      { error: "Please select a FIFA Year when not searching by player name." },
      { status: 400 }
    );
  }

  if (!q && !year && !club && !position) {
    return NextResponse.json(
      { error: "Provide at least one filter: q, year, club, or position" },
      { status: 400 }
    );
  }

  let limit = 50;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 200);
    }
  }

  const service = createServiceClient();

  try {
    let query = service.from("sofifa_players").select("*");

    if (q) {
      const variants = generateAccentVariants(q);
      if (variants.length <= 1) {
        query = query.ilike("name", `%${q}%`);
      } else {
        query = query.or(variants.map(v => `name.ilike.%${v}%`).join(","));
      }
    }

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        query = query.eq("fifa_year", yearNum);
      }
    }

    if (club) {
      query = query.ilike("club", `%${club}%`);
    }

    if (position) {
      query = query.ilike("positions", `%${position}%`);
    }

    query = query.order("overall", { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let players = data ?? [];

    // When searching by name without a year filter, expand results to include
    // ALL editions for each matched sofifa_id. This handles players whose name
    // changed across editions (e.g. "Beto" in FIFA 20-25 vs "Norberto Gomez
    // Betunsal" in FC 26) — they share the same sofifa_id so should group together.
    if (q && !year && players.length > 0) {
      const ids = Array.from(new Set(players.map((p: { sofifa_id: string }) => p.sofifa_id)));
      const { data: allEditions } = await service
        .from("sofifa_players")
        .select("*")
        .in("sofifa_id", ids)
        .order("overall", { ascending: false })
        .limit(Math.min(ids.length * 20, 2000));
      if (allEditions && allEditions.length > players.length) {
        players = allEditions;
      }
    }

    return NextResponse.json({ players, count: players.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    sofifa_id, fifa_year,
    manual_overall, manual_positions, manual_nationality, name,
    club, league, potential, age, attributes: attributesUpdate,
  } = body as {
    sofifa_id: string;
    fifa_year: number;
    manual_overall?: number | null;
    manual_positions?: string | null;
    manual_nationality?: string | null;
    name?: string | null;
    club?: string | null;
    league?: string | null;
    potential?: number | null;
    age?: number | null;
    attributes?: Record<string, unknown> | null;
  };

  if (!sofifa_id || !fifa_year) {
    return NextResponse.json({ error: "Missing sofifa_id or fifa_year" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (manual_overall !== undefined) updates.manual_overall = manual_overall;
  if (manual_positions !== undefined) updates.manual_positions = manual_positions;
  if (manual_nationality !== undefined) updates.manual_nationality = manual_nationality;
  if (name !== undefined && name !== null && name.trim()) updates.name = name.trim();
  if (club !== undefined) updates.club = club;
  if (league !== undefined) updates.league = league;
  if (potential !== undefined) updates.potential = potential;
  if (age !== undefined) updates.age = age;
  if (attributesUpdate !== undefined) updates.attributes = attributesUpdate;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("sofifa_players")
    .update(updates)
    .eq("sofifa_id", sofifa_id)
    .eq("fifa_year", fifa_year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { sofifa_id, fifa_year } = body as { sofifa_id: string; fifa_year: number };

  if (!sofifa_id || !fifa_year) {
    return NextResponse.json({ error: "Missing sofifa_id or fifa_year" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("sofifa_players")
    .delete()
    .eq("sofifa_id", sofifa_id)
    .eq("fifa_year", fifa_year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function editionLabel(year: number): string {
  const y = year > 100 ? year % 100 : year;
  if (y >= 24) return `FC ${String(y).padStart(2, "0")}`;
  return `FIFA ${String(y).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { sofifa_id, source_year, target_year, overrides } = body as {
    sofifa_id: string;
    source_year: number;
    target_year: number;
    overrides?: { overall?: number; club?: string; positions?: string };
  };

  if (!sofifa_id || !source_year || !target_year) {
    return NextResponse.json({ error: "Missing sofifa_id, source_year, or target_year" }, { status: 400 });
  }

  if (source_year === target_year) {
    return NextResponse.json({ error: "Source and target year must be different" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: existing } = await service
    .from("sofifa_players")
    .select("sofifa_id")
    .eq("sofifa_id", sofifa_id)
    .eq("fifa_year", target_year)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Player already has a ${editionLabel(target_year)} entry` },
      { status: 409 }
    );
  }

  const { data: source, error: fetchError } = await service
    .from("sofifa_players")
    .select("*")
    .eq("sofifa_id", sofifa_id)
    .eq("fifa_year", source_year)
    .single();

  if (fetchError || !source) {
    return NextResponse.json({ error: "Source player/year not found" }, { status: 404 });
  }

  const newRow = {
    sofifa_id: source.sofifa_id,
    fifa_year: target_year,
    fifa_edition: editionLabel(target_year),
    name: source.name,
    positions: overrides?.positions ?? source.positions,
    nationality: source.nationality,
    club: overrides?.club ?? source.club,
    league: source.league,
    overall: overrides?.overall ?? source.overall,
    potential: source.potential,
    age: source.age,
    image_url: source.image_url,
    attributes: source.attributes,
    manual_overall: null,
    manual_positions: null,
  };

  const { data: inserted, error: insertError } = await service
    .from("sofifa_players")
    .insert(newRow)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ player: inserted });
}
