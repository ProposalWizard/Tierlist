import type { SquadPlayer } from "./types";

/**
 * FORMATIONS.
 *
 * Thirty-one shapes, each eleven slots, each slot a role and a spot on the pitch.
 *
 * Coordinates are fractions of the frame: x runs 0 (left touchline) to 1
 * (right), y runs 0 (the goal you are attacking) to 1 (your own). So a
 * goalkeeper is near y = 0.94 and a striker near y = 0.16, and a formation reads
 * top-down the way it is drawn.
 *
 * The names are the ones football uses — 4231, 4231(2), 433(4) — because those
 * are what people ask for. The bracketed variants are the same numbers arranged
 * differently: 433 is a flat midfield three, 433(2) puts a holder behind two,
 * 433(3) two holders in front of one, 433(4) one holder behind two attacking,
 * 433(5) two holders behind one attacking — a double pivot and a lone number 10.
 */

export type Role = SquadPlayer["position"];

export interface Slot {
  role: Role;
  x: number;
  y: number;
  /** What to print in the shirt, when the role alone is ambiguous. */
  label?: string;
}

export interface Formation {
  id: string;
  /** How it reads in a menu. */
  name: string;
  slots: Slot[];
}

// Bands, so every formation sits on the same lines and they look like a
// family — spaced evenly across the striker-to-keeper range rather than
// bunched, since every one of these rows has to clear a real player chip
// (see pitchLayout.ts and formationSpacing.mts) in a fraction of the pitch
// box's height. Two deliberate departures from dead-even spacing, both
// reported directly against real formations:
//  - DEF4, back four's own line, sits BELOW the even DEF a back three or
//    back five would use — pushed a little closer to goal, widening the gap
//    to CDM/CM in front of it (4-2-3-1's centre-backs and holding two were
//    overlapping).
//  - WB does the same job for a back five's whole line — wing-backs AND
//    centre-backs both, a flat five rather than centre-backs a notch higher
//    — pushed further from goal than DEF4, widening the gap to the
//    goalkeeper instead (5-2-2-1's keeper and central centre-back were
//    overlapping).
const GK = 0.94, DEF4 = 0.80, DEF = 0.75, WB = 0.73, HOLD = 0.632, MID = 0.478, ATT = 0.324, FWD = 0.17;

const gk = (): Slot => ({ role: "GK", x: 0.5, y: GK });
/** A flat back four. */
const back4 = (): Slot[] => [
  { role: "LB", x: 0.12, y: DEF4 }, { role: "CB", x: 0.38, y: DEF4 },
  { role: "CB", x: 0.62, y: DEF4 }, { role: "RB", x: 0.88, y: DEF4 },
];
/**
 * Three centre-halves, level and centred — the middle one sits at true
 * dead-centre (0.5) rather than off to one side, which is what a back three
 * actually looks like. Used to be pulled off-centre to dodge a straight
 * vertical stack with whatever sits directly behind it in x=0.5, but that
 * traded a real, visible "why isn't the CB in the middle" bug for a squeeze
 * only two of the five back3() formations actually have: 3-1-4-2 (a lone
 * CDM right behind it) keeps its own back three with the middle CB nudged
 * instead, since that CDM is the one real people expect dead centre as the
 * defensive pivot; 3-5-2 (a CDM woven into its wide five) nudges that CDM a
 * hair off 0.5 instead. The other three back3() formations have nothing
 * else stacked on 0.5 this close behind it, so they get it properly
 * symmetric with no compromise at all.
 */
const back3 = (): Slot[] => [
  { role: "CB", x: 0.22, y: DEF }, { role: "CB", x: 0.50, y: DEF }, { role: "CB", x: 0.78, y: DEF },
];
/** Three centre-halves and two wing-backs, all level — a flat five. */
const back5 = (): Slot[] => [
  { role: "LB", x: 0.07, y: WB, label: "LWB" }, { role: "CB", x: 0.30, y: WB },
  { role: "CB", x: 0.50, y: WB }, { role: "CB", x: 0.70, y: WB },
  { role: "RB", x: 0.93, y: WB, label: "RWB" },
];

const f = (id: string, name: string, ...rows: Slot[][]): Formation => ({
  id, name, slots: [gk(), ...rows.flat()],
});

export const FORMATIONS: Formation[] = [
  // The one back3() formation with a lone CDM stacked directly behind it —
  // the only pairing tight enough (HOLD sits right under DEF) that both
  // could not be centred at once. The CDM is the one real people expect
  // dead centre as the defensive pivot, so this formation keeps its own
  // back three, nudged instead — everyone else gets the shared, properly
  // centred back3().
  f("3142", "3-1-4-2",
    [{ role: "CB", x: 0.22, y: DEF }, { role: "CB", x: 0.38, y: DEF }, { role: "CB", x: 0.78, y: DEF }],
    [{ role: "CDM", x: 0.50, y: HOLD }],
    [{ role: "LW", x: 0.12, y: MID, label: "LM" }, { role: "CM", x: 0.38, y: MID },
     { role: "CM", x: 0.62, y: MID }, { role: "RW", x: 0.88, y: MID, label: "RM" }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("3412", "3-4-1-2", back3(),
    [{ role: "LW", x: 0.12, y: MID + 0.06, label: "LM" }, { role: "CM", x: 0.38, y: MID + 0.06 },
     { role: "CM", x: 0.62, y: MID + 0.06 }, { role: "RW", x: 0.88, y: MID + 0.06, label: "RM" }],
    [{ role: "CAM", x: 0.50, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("3421", "3-4-2-1", back3(),
    [{ role: "LW", x: 0.12, y: MID + 0.06, label: "LM" }, { role: "CM", x: 0.38, y: MID + 0.06 },
     { role: "CM", x: 0.62, y: MID + 0.06 }, { role: "RW", x: 0.88, y: MID + 0.06, label: "RM" }],
    [{ role: "CAM", x: 0.33, y: ATT }, { role: "CAM", x: 0.67, y: ATT }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("343", "3-4-3", back3(),
    [{ role: "LW", x: 0.12, y: MID + 0.04, label: "LM" }, { role: "CM", x: 0.40, y: MID + 0.04 },
     { role: "CM", x: 0.60, y: MID + 0.04 }, { role: "RW", x: 0.88, y: MID + 0.04, label: "RM" }],
    [{ role: "LW", x: 0.22, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.78, y: FWD }]),

  // The CDM sits close enough behind back3()'s now-centred middle CB that a
  // dead-centre pivot here would stack under it — nudged a hair off 0.5
  // instead, barely visible next to the CM pair either side of it.
  f("352", "3-5-2", back3(),
    [{ role: "LW", x: 0.09, y: MID + 0.03, label: "LM" }, { role: "CM", x: 0.32, y: MID + 0.03 },
     { role: "CDM", x: 0.47, y: MID + 0.09 }, { role: "CM", x: 0.68, y: MID + 0.03 },
     { role: "RW", x: 0.91, y: MID + 0.03, label: "RM" }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("41212", "4-1-2-1-2", back4(),
    [{ role: "CDM", x: 0.50, y: HOLD }],
    [{ role: "CM", x: 0.28, y: MID }, { role: "CM", x: 0.72, y: MID }],
    [{ role: "CAM", x: 0.50, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("41212(2)", "4-1-2-1-2 (wide)", back4(),
    [{ role: "CDM", x: 0.50, y: HOLD }],
    [{ role: "LW", x: 0.11, y: MID, label: "LM" }, { role: "RW", x: 0.89, y: MID, label: "RM" }],
    [{ role: "CAM", x: 0.50, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  // The lone CDM and the middle CM below share the same x=0.5 by default,
  // stacking a third thing on top of GK's own centre line with nothing to
  // separate them but a squeeze in y — moved both off it (opposite ways)
  // for real diagonal clearance instead. See back3()'s own note.
  f("4132", "4-1-3-2", back4(),
    [{ role: "CDM", x: 0.54, y: HOLD }],
    [{ role: "CM", x: 0.24, y: MID }, { role: "CM", x: 0.40, y: MID }, { role: "CM", x: 0.76, y: MID }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("4141", "4-1-4-1", back4(),
    [{ role: "CDM", x: 0.50, y: HOLD }],
    [{ role: "LW", x: 0.12, y: MID - 0.04, label: "LM" }, { role: "CM", x: 0.38, y: MID - 0.04 },
     { role: "CM", x: 0.62, y: MID - 0.04 }, { role: "RW", x: 0.88, y: MID - 0.04, label: "RM" }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  // The two CDMs sit close enough to DEF4's own centre-backs (0.38/0.62)
  // that they need a real diagonal gap, not just the vertical one DEF4
  // already bought them — widened outward, same idea as back3() above.
  f("4213", "4-2-1-3", back4(),
    [{ role: "CDM", x: 0.30, y: HOLD }, { role: "CDM", x: 0.70, y: HOLD }],
    [{ role: "CAM", x: 0.50, y: ATT + 0.04 }],
    [{ role: "LW", x: 0.20, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.80, y: FWD }]),

  f("4222", "4-2-2-2", back4(),
    [{ role: "CDM", x: 0.30, y: HOLD }, { role: "CDM", x: 0.70, y: HOLD }],
    [{ role: "CAM", x: 0.22, y: ATT }, { role: "CAM", x: 0.78, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("4231", "4-2-3-1", back4(),
    [{ role: "CDM", x: 0.30, y: HOLD }, { role: "CDM", x: 0.70, y: HOLD }],
    [{ role: "LW", x: 0.15, y: ATT }, { role: "CAM", x: 0.50, y: ATT + 0.02 }, { role: "RW", x: 0.85, y: ATT }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("4231(2)", "4-2-3-1 (narrow)", back4(),
    [{ role: "CM", x: 0.35, y: HOLD - 0.02 }, { role: "CM", x: 0.65, y: HOLD - 0.02 }],
    [{ role: "CAM", x: 0.28, y: ATT }, { role: "CAM", x: 0.58, y: ATT - 0.015 }, { role: "CAM", x: 0.76, y: ATT }],
    [{ role: "ST", x: 0.46, y: FWD - 0.02 }]),

  f("424", "4-2-4", back4(),
    [{ role: "CM", x: 0.35, y: MID }, { role: "CM", x: 0.65, y: MID }],
    [{ role: "LW", x: 0.12, y: FWD + 0.02 }, { role: "ST", x: 0.38, y: FWD },
     { role: "ST", x: 0.62, y: FWD }, { role: "RW", x: 0.88, y: FWD + 0.02 }]),

  f("4312", "4-3-1-2", back4(),
    [{ role: "CM", x: 0.25, y: MID + 0.06 }, { role: "CM", x: 0.50, y: MID + 0.06 }, { role: "CM", x: 0.75, y: MID + 0.06 }],
    [{ role: "CAM", x: 0.50, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("4321", "4-3-2-1", back4(),
    [{ role: "CM", x: 0.25, y: MID + 0.06 }, { role: "CM", x: 0.50, y: MID + 0.06 }, { role: "CM", x: 0.75, y: MID + 0.06 }],
    [{ role: "CAM", x: 0.32, y: ATT }, { role: "CAM", x: 0.68, y: ATT }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("433", "4-3-3", back4(),
    [{ role: "CM", x: 0.25, y: MID + 0.02 }, { role: "CM", x: 0.50, y: MID + 0.02 }, { role: "CM", x: 0.75, y: MID + 0.02 }],
    [{ role: "LW", x: 0.18, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.82, y: FWD }]),

  f("433(2)", "4-3-3 (holding)", back4(),
    [{ role: "CDM", x: 0.50, y: HOLD }],
    [{ role: "CM", x: 0.30, y: MID - 0.02 }, { role: "CM", x: 0.70, y: MID - 0.02 }],
    [{ role: "LW", x: 0.18, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.82, y: FWD }]),

  f("433(3)", "4-3-3 (defend)", back4(),
    [{ role: "CDM", x: 0.27, y: HOLD }, { role: "CDM", x: 0.73, y: HOLD }],
    [{ role: "CM", x: 0.50, y: MID - 0.04 }],
    [{ role: "LW", x: 0.18, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.82, y: FWD }]),

  f("433(4)", "4-3-3 (attack)", back4(),
    [{ role: "CM", x: 0.50, y: HOLD - 0.02 }],
    [{ role: "CAM", x: 0.30, y: ATT + 0.02 }, { role: "CAM", x: 0.70, y: ATT + 0.02 }],
    [{ role: "LW", x: 0.18, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.82, y: FWD }]),

  // 433(4)'s own row pair, mirrored: two CMs sit deep instead of one, and
  // the lone advanced man is a CAM instead of a pair — a 4-3-3 built around
  // a double pivot behind one number 10, not a front-loaded midfield three.
  f("433(5)", "4-3-3 (midfield)", back4(),
    [{ role: "CM", x: 0.30, y: HOLD - 0.02 }, { role: "CM", x: 0.70, y: HOLD - 0.02 }],
    [{ role: "CAM", x: 0.50, y: ATT + 0.035 }],
    [{ role: "LW", x: 0.18, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.82, y: FWD }]),

  f("4411(2)", "4-4-1-1", back4(),
    [{ role: "LW", x: 0.12, y: MID + 0.03, label: "LM" }, { role: "CM", x: 0.38, y: MID + 0.03 },
     { role: "CM", x: 0.62, y: MID + 0.03 }, { role: "RW", x: 0.88, y: MID + 0.03, label: "RM" }],
    [{ role: "CAM", x: 0.58, y: ATT }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("442", "4-4-2", back4(),
    [{ role: "LW", x: 0.12, y: MID + 0.01, label: "LM" }, { role: "CM", x: 0.38, y: MID + 0.01 },
     { role: "CM", x: 0.62, y: MID + 0.01 }, { role: "RW", x: 0.88, y: MID + 0.01, label: "RM" }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("442(2)", "4-4-2 (holding)", back4(),
    [{ role: "LW", x: 0.12, y: MID + 0.05, label: "LM" }, { role: "CDM", x: 0.38, y: MID + 0.09 },
     { role: "CDM", x: 0.62, y: MID + 0.09 }, { role: "RW", x: 0.88, y: MID + 0.05, label: "RM" }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("451", "4-5-1", back4(),
    [{ role: "LW", x: 0.09, y: MID + 0.01, label: "LM" }, { role: "CM", x: 0.31, y: MID + 0.01 },
     { role: "CM", x: 0.50, y: MID + 0.05 }, { role: "CM", x: 0.69, y: MID + 0.01 },
     { role: "RW", x: 0.91, y: MID + 0.01, label: "RM" }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("451(2)", "4-5-1 (attack)", back4(),
    [{ role: "LW", x: 0.14, y: ATT + 0.06 }, { role: "CM", x: 0.34, y: MID },
     { role: "CM", x: 0.50, y: MID + 0.06 }, { role: "CM", x: 0.66, y: MID },
     { role: "RW", x: 0.86, y: ATT + 0.06 }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("5212", "5-2-1-2", back5(),
    [{ role: "CM", x: 0.35, y: MID + 0.03 }, { role: "CM", x: 0.65, y: MID + 0.03 }],
    [{ role: "CAM", x: 0.50, y: ATT }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("5221", "5-2-2-1", back5(),
    [{ role: "CM", x: 0.35, y: MID + 0.03 }, { role: "CM", x: 0.65, y: MID + 0.03 }],
    [{ role: "CAM", x: 0.30, y: ATT }, { role: "CAM", x: 0.70, y: ATT }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),

  f("523", "5-2-3", back5(),
    [{ role: "CM", x: 0.35, y: MID + 0.01 }, { role: "CM", x: 0.65, y: MID + 0.01 }],
    [{ role: "LW", x: 0.20, y: FWD }, { role: "ST", x: 0.50, y: FWD }, { role: "RW", x: 0.80, y: FWD }]),

  f("532", "5-3-2", back5(),
    [{ role: "CM", x: 0.28, y: MID + 0.01 }, { role: "CM", x: 0.50, y: MID + 0.05 }, { role: "CM", x: 0.72, y: MID + 0.01 }],
    [{ role: "ST", x: 0.40, y: FWD }, { role: "ST", x: 0.60, y: FWD }]),

  f("541", "5-4-1", back5(),
    [{ role: "LW", x: 0.14, y: MID + 0.01, label: "LM" }, { role: "CM", x: 0.38, y: MID + 0.01 },
     { role: "CM", x: 0.62, y: MID + 0.01 }, { role: "RW", x: 0.86, y: MID + 0.01, label: "RM" }],
    [{ role: "ST", x: 0.50, y: FWD - 0.02 }]),
];

export const DEFAULT_FORMATION = "433";

export function formationOf(id: string): Formation {
  return FORMATIONS.find(x => x.id === id) ?? FORMATIONS.find(x => x.id === DEFAULT_FORMATION)!;
}

// ── Picking a side ──────────────────────────────────────────────────────────

/** Anybody who can be put in a shirt: your squad, or one of the other clubs'. */
export interface Pickable {
  id: string;
  name: string;
  position: Role;
  overall?: number;
  /**
   * Everywhere he's actually listed, `position` included. Optional because
   * an old save or a generated squad only ever has the one. See
   * SquadPlayer.positions — this is the same list, read at team-sheet time.
   */
  positions?: Role[];
}

const NEIGHBOURS: Record<Role, Role[]> = {
  GK: [],
  CB: ["RB", "LB", "CDM"],
  RB: ["LB", "CB", "RW", "CM"],
  LB: ["RB", "CB", "LW", "CM"],
  CDM: ["CM", "CB"],
  CM: ["CDM", "CAM", "LW", "RW"],
  CAM: ["CM", "LW", "RW", "ST"],
  RW: ["LW", "CAM", "ST", "RB"],
  LW: ["RW", "CAM", "ST", "LB"],
  ST: ["CAM", "LW", "RW"],
};

/** How well this man fits that slot. Same shape as the squad builders use. */
export function fitness(slot: Role, player: Role): number {
  if (slot === "GK" || player === "GK") return slot === player ? 100 : 0;
  if (slot === player) return 100;
  const near = NEIGHBOURS[slot] ?? [];
  const i = near.indexOf(player);
  return i >= 0 ? 74 - i * 8 : 22;
}

/**
 * The best of everywhere he's actually listed, not just the one slot he
 * happens to be filed under.
 *
 * A real player's data holds several positions — Bruno Fernandes lists CAM
 * and CM — but squad-building still settles him into exactly one SLOT of
 * the twenty, and `position` only ever remembered that slot. So a club
 * playing a shape with no CAM in it (Manchester United's 4-3-3, three
 * central midfielders) scored him only as a NEIGHBOUR of CM — fitness 66,
 * `NEIGHBOURS.CM`'s second entry — against a genuine 63-rated CM's exact
 * 100, and fitness so dominates the pick (`score = fitness*100+overall`)
 * that a 25-point rating gap could never close it. Reported directly: "Bruno
 * Fernandes only has the CAM position so he's left on the bench while a 63
 * rated player starts ahead of him." Checking every position he's listed
 * for finds CM among them and scores him the full 100 there, the same as
 * the specialist — at which point the rating gap is exactly what decides it,
 * which is the correct outcome and needed no change to the formula at all.
 */
export function bestFitness(slot: Role, player: Pickable): number {
  const positions = player.positions?.length ? player.positions : [player.position];
  let best = 0;
  for (const p of positions) {
    const f = fitness(slot, p);
    if (f > best) best = f;
  }
  return best;
}

/**
 * The side a manager would pick.
 *
 * Greedy by SLOT rather than by player, which is the whole trick and the same
 * one `realSquad` and `leagueSquads` use: take your eleven best and hand out
 * positions afterwards and you field four centre-backs and no left-back.
 * Fitness dominates, rating breaks ties.
 */
export function autoPick(squad: Pickable[], formation: Formation): (string | null)[] {
  const taken = new Set<string>();
  return formation.slots.map((slot) => {
    let best: Pickable | null = null;
    let bestScore = -1;
    for (const p of squad) {
      if (taken.has(p.id)) continue;
      const f2 = bestFitness(slot.role, p);
      if (f2 <= 0) continue;
      const score = f2 * 100 + (p.overall ?? 60);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) return null;
    taken.add(best.id);
    return best.id;
  });
}

/**
 * Keep a saved eleven when the shape changes.
 *
 * Changing 4-3-3 to 3-5-2 should not throw away the side you picked — the same
 * men are still in it, they are standing somewhere else. So the men you chose
 * are re-dealt into the new slots by fitness, and only the holes are filled from
 * the bench.
 */
export function refit(current: (string | null)[], squad: Pickable[], formation: Formation): (string | null)[] {
  const byId = new Map(squad.map(p => [p.id, p]));
  const chosen = current.filter((id): id is string => !!id && byId.has(id));
  const pool = chosen.map(id => byId.get(id)!);
  const out = autoPick(pool, formation);
  // Any slot the old eleven could not fill is filled from everybody else.
  const used = new Set(out.filter((x): x is string => !!x));
  const rest = squad.filter(p => !used.has(p.id));
  return out.map((id, i) => {
    if (id) return id;
    const slot = formation.slots[i];
    let best: Pickable | null = null, bestScore = -1;
    for (const p of rest) {
      if (used.has(p.id)) continue;
      const f2 = bestFitness(slot.role, p);
      if (f2 <= 0) continue;
      const score = f2 * 100 + (p.overall ?? 60);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) return null;
    used.add(best.id);
    return best.id;
  });
}
