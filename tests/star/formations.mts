import {
  FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, refit, fitness,
  type Pickable,
} from "../../lib/star/formations";
import { buildLeagueSquad, type RosterRow } from "../../lib/star/leagueSquads";

/**
 * Thirty shapes, eleven men in each.
 *
 * A formation is a list of slots, and everything downstream trusts two things
 * about it: that there are eleven, and that exactly one of them is a
 * goalkeeper. Both are the kind of thing a typo breaks silently — a 4-3-3 with
 * ten slots renders as a 4-3-3 with a hole in it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The thirty the player asked for, by name. */
const WANTED = [
  "3142", "3412", "3421", "343", "352", "41212", "41212(2)", "4132", "4141",
  "4213", "4222", "4231", "4231(2)", "424", "4312", "4321", "433", "433(2)",
  "433(3)", "433(4)", "4411(2)", "442", "442(2)", "451", "451(2)", "5212",
  "5221", "523", "532", "541",
];

// ── Every shape is a football team ──────────────────────────────────────────
{
  check(FORMATIONS.length === WANTED.length, `${WANTED.length} formations (${FORMATIONS.length})`);
  const have = new Set(FORMATIONS.map(f => f.id));
  for (const id of WANTED) check(have.has(id), `${id} exists`);
  check(new Set(FORMATIONS.map(f => f.id)).size === FORMATIONS.length, "no formation is listed twice");
  check(have.has(DEFAULT_FORMATION), "the default is one of them");

  for (const f of FORMATIONS) {
    check(f.slots.length === 11, `${f.id}: eleven men (${f.slots.length})`);
    const keepers = f.slots.filter(s => s.role === "GK").length;
    check(keepers === 1, `${f.id}: exactly one goalkeeper (${keepers})`);
    check(f.slots.every(s => s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1),
      `${f.id}: everybody is on the pitch`);
    // The name says how many are in front of the keeper.
    const outfield = f.slots.filter(s => s.role !== "GK").length;
    check(outfield === 10, `${f.id}: ten outfielders (${outfield})`);
    // Nobody is standing on somebody else.
    for (let i = 0; i < f.slots.length; i++) {
      for (let j = i + 1; j < f.slots.length; j++) {
        const a = f.slots[i], b = f.slots[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 0.06) {
          problems.push(`${f.id}: two men in the same spot (${a.role} and ${b.role})`);
        }
      }
    }
    // The shape reads back off the numbers in its own name: strip the bracket,
    // and the digits should sum to ten.
    const digits = f.id.replace(/\(.*\)/, "").split("").map(Number);
    check(digits.reduce((a, b) => a + b, 0) === 10, `${f.id}: the name adds up to ten`);
  }
  check(formationOf("nonsense").id === DEFAULT_FORMATION, "an unknown shape falls back");
}

// ── Picking a side ──────────────────────────────────────────────────────────
{
  const roster = (club: string, n = 24): RosterRow[] => {
    const rng = mulberry(club.length * 17);
    const POS = ["GK", "CB", "CB,LB", "RB", "LB", "CDM", "CM", "CM,CAM", "CAM", "LW", "RW", "ST"];
    return Array.from({ length: n }, (_, i) => ({
      id: `${club}-${i}`, name: `P${i}`, positions: POS[i % POS.length],
      overall: 60 + Math.floor(rng() * 32),
    }));
  };
  const squad: Pickable[] = buildLeagueSquad("Arsenal", roster("Arsenal")).players
    .map(p => ({ id: p.id, name: p.name, position: p.position, overall: p.overall }));

  for (const f of FORMATIONS) {
    const xi = autoPick(squad, f);
    check(xi.length === 11, `${f.id}: eleven picked (${xi.length})`);
    check(xi.every(id => id !== null), `${f.id}: nobody is left empty`);
    check(new Set(xi).size === 11, `${f.id}: nobody is picked twice`);

    const byId = new Map(squad.map(p => [p.id, p]));
    const keeperSlot = f.slots.findIndex(s => s.role === "GK");
    check(byId.get(xi[keeperSlot]!)?.position === "GK", `${f.id}: a goalkeeper keeps goal`);
    // …and nobody else is one.
    const outfieldKeepers = xi.filter((id, i) => i !== keeperSlot && byId.get(id!)?.position === "GK").length;
    check(outfieldKeepers === 0, `${f.id}: the reserve keeper is not at right-back`);

    // Most of the side is in its actual position rather than shoehorned.
    const natural = xi.filter((id, i) => byId.get(id!)!.position === f.slots[i].role).length;
    check(natural >= 7, `${f.id}: most of the side plays where it plays (${natural}/11)`);
  }

  // A short squad does not crash; it leaves holes.
  const thin = squad.slice(0, 6);
  const xi = autoPick(thin, formationOf("442"));
  check(xi.length === 11, "a six-man squad still returns eleven slots");
  check(xi.filter(Boolean).length <= 6, "…with nobody invented to fill them");
}

// ── Changing shape keeps the side you picked ────────────────────────────────
{
  const roster: RosterRow[] = Array.from({ length: 22 }, (_, i) => ({
    id: `p${i}`, name: `P${i}`,
    positions: ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST"][i % 12],
    overall: 70 + (i % 15),
  }));
  const squad: Pickable[] = buildLeagueSquad("Test", roster).players
    .map(p => ({ id: p.id, name: p.name, position: p.position, overall: p.overall }));

  const before = autoPick(squad, formationOf("433"));
  const after = refit(before, squad, formationOf("352"));

  check(after.length === 11, "the new shape has eleven slots");
  check(new Set(after.filter(Boolean)).size === after.filter(Boolean).length, "nobody is duplicated");
  const kept = after.filter(id => id && before.includes(id)).length;
  check(kept >= 9, `changing 4-3-3 to 3-5-2 keeps the side (${kept}/11 the same men)`);

  // Round trip: back to where we started, still eleven, still no duplicates.
  const back = refit(after, squad, formationOf("433"));
  check(new Set(back.filter(Boolean)).size === 11, "and back again");

  // A saved eleven with a stranger in it does not poison the next shape.
  const withGhost = [...before];
  withGhost[3] = "somebody-who-left";
  const healed = refit(withGhost, squad, formationOf("433"));
  check(healed.every(id => id === null || squad.some(p => p.id === id)),
    "a player who has left is replaced rather than kept");
  check(healed.filter(Boolean).length === 11, "…and the hole he left is filled");
}

// ── Fitness is an opinion, not a rule ───────────────────────────────────────
{
  check(fitness("ST", "ST") === 100, "a striker up front is a perfect fit");
  check(fitness("ST", "CAM") > fitness("ST", "CB"), "a ten leads the line better than a centre-half");
  check(fitness("GK", "CB") === 0, "an outfielder never keeps goal");
  check(fitness("CB", "GK") === 0, "and a keeper never plays out");
  check(fitness("CB", "ST") > 0, "but anybody else can be asked to fill in");
  check(fitness("LB", "RB") > fitness("LB", "ST"), "a full-back covers the other flank first");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — thirty shapes, eleven men in each, and changing shape keeps your side");
