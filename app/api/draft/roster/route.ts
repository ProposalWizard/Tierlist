import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function parseAttr(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const club = searchParams.get("club");
  const yearParam = searchParams.get("year");

  if (!club || !yearParam) {
    return NextResponse.json(
      { error: "Missing required query params: club, year" },
      { status: 400 }
    );
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    return NextResponse.json(
      { error: "year must be a number" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sofifa_players")
    .select(
      "sofifa_id, name, overall, potential, positions, age, image_url, nationality, attributes"
    )
    .eq("club", club)
    .eq("fifa_year", year)
    .order("overall", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const roster = (data ?? []).map((p) => {
    const a = (p.attributes as Record<string, unknown>) ?? {};
    return {
      sofifa_id: p.sofifa_id,
      name: p.name ?? "",
      overall: p.overall ?? parseAttr(a.overall) ?? parseAttr(a.attr_oa) ?? 0,
      potential: p.potential ?? parseAttr(a.potential) ?? parseAttr(a.attr_pt) ?? 0,
      positions: p.positions ?? (a.positions as string) ?? "",
      age: p.age ?? parseAttr(a.age) ?? parseAttr(a.attr_ae) ?? 0,
      image_url: p.image_url ?? (a.image_url as string) ?? null,
      nationality: p.nationality ?? (a.nationality as string) ?? "",
      pace: parseAttr(a.attr_pac),
      shooting: parseAttr(a.attr_sho),
      passing: parseAttr(a.attr_pas),
      dribbling: parseAttr(a.attr_dri),
      defending: parseAttr(a.attr_def),
      physical: parseAttr(a.attr_phy),
      finishing: parseAttr(a.attr_fi),
      positioning: parseAttr(a.attr_po),
      crossing: parseAttr(a.attr_cr),
      vision: parseAttr(a.attr_vi),
      longShots: parseAttr(a.attr_lo),
      shortPassing: parseAttr(a.attr_sh),
      longPassing: parseAttr(a.attr_lp),
      heading: parseAttr(a.attr_he),
      interceptions: parseAttr(a.attr_in),
      standingTackle: parseAttr(a.attr_st),
      marking: parseAttr(a.attr_ma),
      reactions: parseAttr(a.attr_re),
      sprintSpeed: parseAttr(a.attr_sp),
      gkDiving: parseAttr(a.attr_gd),
      gkPositioning: parseAttr(a.attr_gp),
      gkReflexes: parseAttr(a.attr_gr),
    };
  });

  return NextResponse.json(
    { club, year, roster },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
