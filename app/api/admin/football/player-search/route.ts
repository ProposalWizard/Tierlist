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

  if (!q) {
    return NextResponse.json(
      { error: "Missing required query param: q" },
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
    const variants = generateAccentVariants(q);
    const orFilter = variants.map((v) => `name.ilike.%${v}%`).join(",");

    let query = service
      .from("sofifa_players")
      .select("*")
      .or(orFilter);

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

    return NextResponse.json({ players: data ?? [], count: (data ?? []).length });
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
  const { sofifa_id, fifa_year, manual_overall, manual_positions } = body as {
    sofifa_id: string;
    fifa_year: number;
    manual_overall?: number | null;
    manual_positions?: string | null;
  };

  if (!sofifa_id || !fifa_year) {
    return NextResponse.json({ error: "Missing sofifa_id or fifa_year" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (manual_overall !== undefined) updates.manual_overall = manual_overall;
  if (manual_positions !== undefined) updates.manual_positions = manual_positions;

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
