import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function parseAttr(val: unknown): number {
  if (typeof val === "number") return val;
  // parseInt handles "83 +2" / "83 -1" style values — returns the first number only
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

function inferPositions(p: {
  pace: number; shooting: number; passing: number; dribbling: number;
  defending: number; physical: number; gkDiving: number; gkReflexes: number;
  crossing: number; finishing: number; interceptions: number;
  standingTackle: number; vision: number; marking: number;
}): string {
  if (p.gkDiving > 50 || p.gkReflexes > 50) return "GK";

  const def = p.defending || 0;
  const sho = p.shooting || 0;
  const pac = p.pace || 0;
  const pas = p.passing || 0;
  const dri = p.dribbling || 0;
  const fin = p.finishing || 0;

  if (def >= 75 && sho <= 60 && pac < 78) return "CB";
  if (def >= 70 && pac >= 78 && sho <= 65) return "RB,LB";
  if (def >= 70 && pas >= 70 && sho <= 65) return "CDM";
  if (pac >= 82 && dri >= 75 && def < 55 && pac > sho) return "RW,LW";
  if (fin >= 75 && sho >= 70 && def < 50) return "ST";
  if (pas >= 75 && dri >= 73 && sho >= 68) return "CAM";
  if (pas >= 68 && def >= 50 && sho >= 55) return "CM";
  if (pac >= 78 && dri >= 70 && def < 60) return "RM,LM";
  if (def >= 65) return "CB";
  if (sho >= 65) return "ST";
  return "CM";
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

  // OVR source by edition:
  //   FC 26: DB `overall` column is set, attributes JSONB has `overall` key
  //   Non-FC26: DB `overall` is often NULL, use `attr_sort` from JSONB
  //     (attr_sort may include "+/-" suffix like "83 +2" — parseInt strips it)
  const roster = (data ?? []).map((p) => {
    const a = (p.attributes as Record<string, unknown>) ?? {};
    return {
      sofifa_id: p.sofifa_id,
      name: p.name || (a.name as string) || "",
      overall: p.overall || parseAttr(a.overall) || parseAttr(a.attr_sort) || parseAttr(a.attr_oa) || 0,
      potential: p.potential || parseAttr(a.potential) || parseAttr(a.attr_pt) || 0,
      positions: p.positions || (a.positions as string) || (a.player_positions as string) || "",
      age: p.age || parseAttr(a.age) || parseAttr(a.attr_ae) || 0,
      image_url: p.image_url || (a.image_url as string) || null,
      nationality: p.nationality || (a.nationality as string) || "",
      pace: parseAttr(a.attr_pac) || parseAttr(a.pac),
      shooting: parseAttr(a.attr_sho) || parseAttr(a.shooting),
      passing: parseAttr(a.attr_pas) || parseAttr(a.passing),
      dribbling: parseAttr(a.attr_dri) || parseAttr(a.dribbling),
      defending: parseAttr(a.attr_def) || parseAttr(a.defending),
      physical: parseAttr(a.attr_phy) || parseAttr(a.physical),
      finishing: parseAttr(a.attr_fi) || parseAttr(a.finishing),
      positioning: parseAttr(a.attr_po) || parseAttr(a.positioning),
      crossing: parseAttr(a.attr_cr) || parseAttr(a.crossing),
      vision: parseAttr(a.attr_vi) || parseAttr(a.vision),
      longShots: parseAttr(a.attr_lo) || parseAttr(a.longShots),
      shortPassing: parseAttr(a.attr_sh) || parseAttr(a.shortPassing),
      longPassing: parseAttr(a.attr_lp) || parseAttr(a.longPassing),
      heading: parseAttr(a.attr_he) || parseAttr(a.heading),
      interceptions: parseAttr(a.attr_in) || parseAttr(a.interceptions),
      standingTackle: parseAttr(a.attr_st) || parseAttr(a.standingTackle),
      marking: parseAttr(a.attr_ma) || parseAttr(a.marking),
      reactions: parseAttr(a.attr_re) || parseAttr(a.reactions),
      sprintSpeed: parseAttr(a.attr_sp) || parseAttr(a.sprintSpeed),
      gkDiving: parseAttr(a.attr_gd) || parseAttr(a.attr_div) || parseAttr(a.gkDiving),
      gkPositioning: parseAttr(a.attr_gp) || parseAttr(a.attr_pos) || parseAttr(a.gkPositioning),
      gkReflexes: parseAttr(a.attr_gr) || parseAttr(a.attr_ref) || parseAttr(a.gkReflexes),
    };
  });

  // Safety net: estimate OVR from face stats if all other sources returned 0
  for (const player of roster) {
    if (player.overall === 0) {
      const mainStats = [player.pace, player.shooting, player.passing, player.dribbling, player.defending, player.physical].filter(v => v > 0);
      if (mainStats.length >= 3) {
        player.overall = Math.round(mainStats.reduce((a, b) => a + b, 0) / mainStats.length);
      }
    }
  }

  // Infer positions from stats when not stored in DB
  for (const player of roster) {
    if (!player.positions) {
      player.positions = inferPositions(player);
    }
  }

  // Re-sort by resolved overall (DB sort may put NULL-overall players at bottom)
  roster.sort((a, b) => b.overall - a.overall);

  return NextResponse.json(
    { club, year, roster },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
