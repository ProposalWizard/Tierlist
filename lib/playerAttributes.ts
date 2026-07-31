import type { PlayerAttributes } from "@/lib/seasonSimulator";

/** "83 +2" / "83 -1" style values keep only the leading number. */
export function parseAttr(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

/**
 * Map a sofifa_players.attributes JSONB blob onto PlayerAttributes.
 *
 * Key names differ between editions — newer ones use "Pace"/"Shooting", older
 * ones the "attr_pac"/"attr_sho" short forms — so each field checks every known
 * spelling. Extracted from the draft roster API so the American draft produces
 * identical player objects; without attributes the season simulator falls back
 * to a crude approximation that counts midfielders at HALF their rating.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function attributesFromJson(attributes: any): PlayerAttributes {
  const a = (attributes as Record<string, unknown>) ?? {};
  return {
    pace:           parseAttr(a.Pace)      || parseAttr(a.attr_pac) || parseAttr(a.pac),
    shooting:       parseAttr(a.Shooting)  || parseAttr(a.attr_sho) || parseAttr(a.shooting),
    passing:        parseAttr(a.Passing)   || parseAttr(a.attr_pas) || parseAttr(a.passing),
    dribbling:      parseAttr(a.Dribbling) || parseAttr(a.attr_dri) || parseAttr(a.dribbling),
    defending:      parseAttr(a.Defending) || parseAttr(a.attr_def) || parseAttr(a.defending),
    physical:       parseAttr(a.Physical)  || parseAttr(a.attr_phy) || parseAttr(a.physical),
    finishing:      parseAttr(a.attr_fi)   || parseAttr(a.finishing),
    positioning:    parseAttr(a.attr_po)   || parseAttr(a.positioning),
    crossing:       parseAttr(a.Crossing)  || parseAttr(a.attr_cr) || parseAttr(a.crossing),
    vision:         parseAttr(a.attr_vi)   || parseAttr(a.vision),
    longShots:      parseAttr(a.attr_lo)   || parseAttr(a.longShots),
    shortPassing:   parseAttr(a.attr_sh)   || parseAttr(a.shortPassing),
    longPassing:    parseAttr(a.attr_lp)   || parseAttr(a.longPassing),
    heading:        parseAttr(a.attr_he)   || parseAttr(a.heading),
    interceptions:  parseAttr(a.attr_in)   || parseAttr(a.interceptions),
    standingTackle: parseAttr(a.attr_st)   || parseAttr(a.standingTackle),
    marking:        parseAttr(a.attr_ma)   || parseAttr(a.marking),
    reactions:      parseAttr(a.attr_re)   || parseAttr(a.reactions),
    sprintSpeed:    parseAttr(a.attr_sp)   || parseAttr(a.sprintSpeed),
    gkDiving:       parseAttr(a.attr_gd)   || parseAttr(a.attr_div) || parseAttr(a.gkDiving),
    gkPositioning:  parseAttr(a.attr_gp)   || parseAttr(a.attr_pos) || parseAttr(a.gkPositioning),
    gkReflexes:     parseAttr(a.attr_gr)   || parseAttr(a.attr_ref) || parseAttr(a.gkReflexes),
  } as PlayerAttributes;
}
