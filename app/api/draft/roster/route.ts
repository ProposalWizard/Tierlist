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
  const prime = searchParams.get("prime") === "true";

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
      "sofifa_id, name, overall, manual_overall, potential, positions, manual_positions, age, image_url, nationality, attributes"
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
      overall: p.manual_overall || p.overall || parseAttr(a.overall) || parseAttr(a.attr_sort) || parseAttr(a.attr_oa) || 0,
      potential: p.potential || parseAttr(a.potential) || parseAttr(a.attr_pt) || 0,
      positions: p.manual_positions || p.positions || (a.positions as string) || (a.player_positions as string) || "",
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

  // Expand wing positions: LM↔LW, RM↔RW (but only if NOT a fullback).
  // FIFA removed wingback positions and relabeled them as LM/RM, so we
  // don't want defenders who list LM to also get LW. Only non-fullbacks.
  for (const player of roster) {
    const pos = player.positions.split(",").map((p: string) => p.trim().toUpperCase());
    const hasLB = pos.includes("LB") || pos.includes("LWB");
    const hasRB = pos.includes("RB") || pos.includes("RWB");
    const added: string[] = [];
    if (pos.includes("LM") && !hasLB && !pos.includes("LW")) added.push("LW");
    if (pos.includes("LW") && !hasLB && !pos.includes("LM")) added.push("LM");
    if (pos.includes("RM") && !hasRB && !pos.includes("RW")) added.push("RW");
    if (pos.includes("RW") && !hasRB && !pos.includes("RM")) added.push("RM");
    if (added.length > 0) {
      player.positions = [...pos, ...added].join(", ");
    }
  }

  // Prime mode: replace each player's stats with their best-ever edition
  if (prime) {
    const ids = roster.map((p) => p.sofifa_id).filter(Boolean);
    if (ids.length > 0) {
      const { data: allEditions } = await supabase
        .from("sofifa_players")
        .select("sofifa_id, overall, manual_overall, potential, positions, manual_positions, age, attributes")
        .in("sofifa_id", ids)
        .order("overall", { ascending: false });

      if (allEditions) {
        const bestById = new Map<string, typeof allEditions[0]>();
        for (const row of allEditions) {
          if (!bestById.has(row.sofifa_id)) {
            bestById.set(row.sofifa_id, row);
          }
        }

        for (const player of roster) {
          const best = bestById.get(player.sofifa_id);
          if (!best) continue;
          const ba = (best.attributes as Record<string, unknown>) ?? {};
          const bestOvr = best.manual_overall || best.overall || parseAttr(ba.overall) || parseAttr(ba.attr_sort) || parseAttr(ba.attr_oa) || 0;
          if (bestOvr <= player.overall) continue;

          player.overall = bestOvr;
          player.potential = best.potential || parseAttr(ba.potential) || parseAttr(ba.attr_pt) || 0;
          if (best.manual_positions || best.positions) player.positions = best.manual_positions || best.positions;
          player.pace = parseAttr(ba.attr_pac) || parseAttr(ba.pac) || player.pace;
          player.shooting = parseAttr(ba.attr_sho) || parseAttr(ba.shooting) || player.shooting;
          player.passing = parseAttr(ba.attr_pas) || parseAttr(ba.passing) || player.passing;
          player.dribbling = parseAttr(ba.attr_dri) || parseAttr(ba.dribbling) || player.dribbling;
          player.defending = parseAttr(ba.attr_def) || parseAttr(ba.defending) || player.defending;
          player.physical = parseAttr(ba.attr_phy) || parseAttr(ba.physical) || player.physical;
          player.finishing = parseAttr(ba.attr_fi) || parseAttr(ba.finishing) || player.finishing;
          player.positioning = parseAttr(ba.attr_po) || parseAttr(ba.positioning) || player.positioning;
          player.crossing = parseAttr(ba.attr_cr) || parseAttr(ba.crossing) || player.crossing;
          player.vision = parseAttr(ba.attr_vi) || parseAttr(ba.vision) || player.vision;
          player.longShots = parseAttr(ba.attr_lo) || parseAttr(ba.longShots) || player.longShots;
          player.shortPassing = parseAttr(ba.attr_sh) || parseAttr(ba.shortPassing) || player.shortPassing;
          player.longPassing = parseAttr(ba.attr_lp) || parseAttr(ba.longPassing) || player.longPassing;
          player.heading = parseAttr(ba.attr_he) || parseAttr(ba.heading) || player.heading;
          player.interceptions = parseAttr(ba.attr_in) || parseAttr(ba.interceptions) || player.interceptions;
          player.standingTackle = parseAttr(ba.attr_st) || parseAttr(ba.standingTackle) || player.standingTackle;
          player.marking = parseAttr(ba.attr_ma) || parseAttr(ba.marking) || player.marking;
          player.reactions = parseAttr(ba.attr_re) || parseAttr(ba.reactions) || player.reactions;
          player.sprintSpeed = parseAttr(ba.attr_sp) || parseAttr(ba.sprintSpeed) || player.sprintSpeed;
          player.gkDiving = parseAttr(ba.attr_gd) || parseAttr(ba.attr_div) || parseAttr(ba.gkDiving) || player.gkDiving;
          player.gkPositioning = parseAttr(ba.attr_gp) || parseAttr(ba.attr_pos) || parseAttr(ba.gkPositioning) || player.gkPositioning;
          player.gkReflexes = parseAttr(ba.attr_gr) || parseAttr(ba.attr_ref) || parseAttr(ba.gkReflexes) || player.gkReflexes;
        }
      }
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
