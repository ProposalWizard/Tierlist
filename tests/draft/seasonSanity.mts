/**
 * tests/draft/seasonSanity.mts — plays many PL Draft seasons with random
 * squads (weak to strong, five seasons each) and checks every number a
 * player can see adds up: 38 games, points = 3W + D, the table's goals match,
 * the team record matches the table, no NaN or undefined anywhere, scorers
 * equal goals, minutes 1-120.
 *   npx tsx tests/draft/seasonSanity.mts [careers]
 */
import { simulateSeason, type DraftPlayer, type SeasonResult } from "../../lib/seasonSimulator";

const CAREERS = Number(process.argv[2] ?? 100);
let fails = 0;
const fail = (msg: string) => { fails++; if (fails <= 25) console.log("  FAIL", msg); };

const SLOTS = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CAM", "RW", "ST", "LW"];
const POS: Record<string, string> = { GK: "GK", RB: "RB", CB: "CB", LB: "LB", CM: "CM", CAM: "CAM", RW: "RW", ST: "ST", LW: "LW" };
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const NAMES = ["K. De Bruyne", "V. van Dijk", "H. Kane", "Richarlison", "J. Pickford", "N. Kanté", "D. Calvert-Lewin", "R. van Persie", "B. Saka", "M. Salah", "E. Haaland", "T. Walcott", "A. Iwobi", "J. Lens"];

function squad(base: number): DraftPlayer[] {
  const out: DraftPlayer[] = [];
  const s = (n: number) => Math.max(30, Math.min(99, Math.round(base + (rnd() - 0.5) * n)));
  SLOTS.concat(["CM", "ST", "CB"]).forEach((slot, i) => {
    const ovr = s(14);
    const a = (v: number) => s(20) - base + v;
    out.push({
      name: NAMES[i % NAMES.length] + (i >= NAMES.length ? " II" : ""), overall: ovr, positions: POS[slot], club: "Test", clubYear: "TST 15/16",
      assignedPosition: slot, age: 20 + Math.floor(rnd() * 14), isSub: i >= 11,
      attrs: {
        pace: a(ovr), shooting: a(ovr), passing: a(ovr), dribbling: a(ovr), defending: a(ovr), physical: a(ovr),
        finishing: a(ovr), positioning: a(ovr), crossing: a(ovr), vision: a(ovr), longShots: a(ovr), shortPassing: a(ovr),
        longPassing: a(ovr), heading: a(ovr), interceptions: a(ovr), standingTackle: a(ovr), marking: a(ovr), reactions: a(ovr),
        sprintSpeed: a(ovr), gkDiving: slot === "GK" ? a(ovr) : 10, gkPositioning: slot === "GK" ? a(ovr) : 10, gkReflexes: slot === "GK" ? a(ovr) : 10,
      },
    });
  });
  return out;
}

function deepBad(v: unknown, path: string, out: string[]) {
  if (out.length > 3) return;
  if (typeof v === "number" && !Number.isFinite(v)) out.push(path + "=" + v);
  else if (typeof v === "string" && /\bundefined\b|\bNaN\b|\[object Object\]/.test(v)) out.push(path + "='" + v + "'");
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) deepBad(x, path + "." + k, out);
}

function check(r: SeasonResult, tag: string) {
  const bad: string[] = []; deepBad(r, "season", bad);
  if (bad.length) fail(`${tag}: ${bad.join(", ")}`);
  if (r.matches.length !== 38) fail(`${tag}: ${r.matches.length} league matches`);
  if (r.leagueTable.length !== 20) fail(`${tag}: table has ${r.leagueTable.length} teams`);
  let gf = 0, ga = 0;
  for (const t of r.leagueTable) {
    if (t.played !== 38) fail(`${tag}: ${t.name} played ${t.played}`);
    if (t.won + t.drawn + t.lost !== t.played) fail(`${tag}: ${t.name} W+D+L != played`);
    if (t.points !== 3 * t.won + t.drawn) fail(`${tag}: ${t.name} points ${t.points} != 3W+D`);
    if (t.goalDifference !== t.goalsFor - t.goalsAgainst) fail(`${tag}: ${t.name} GD wrong`);
    gf += t.goalsFor; ga += t.goalsAgainst;
  }
  if (gf !== ga) fail(`${tag}: table goals for ${gf} != against ${ga}`);
  const names = new Set(r.leagueTable.map((t) => t.name));
  if (names.size !== 20) fail(`${tag}: duplicate team names in table`);
  for (let i = 1; i < r.leagueTable.length; i++) {
    const a = r.leagueTable[i - 1], b = r.leagueTable[i];
    if (a.points < b.points || (a.points === b.points && a.goalDifference < b.goalDifference)) { fail(`${tag}: table out of order at ${i}`); break; }
  }
  const me = r.leagueTable.find((t) => t.isPlayer);
  if (!me) { fail(`${tag}: player's team not in table`); return; }
  const w = r.matches.filter((m) => m.result === "W").length, d = r.matches.filter((m) => m.result === "D").length;
  if (me.won !== w || me.drawn !== d) fail(`${tag}: table W/D ${me.won}/${me.drawn} vs matches ${w}/${d}`);
  if (r.teamRecord.points !== me.points || r.teamRecord.goalsFor !== me.goalsFor) fail(`${tag}: teamRecord differs from table`);
  const pos = r.leagueTable.indexOf(me) + 1;
  if (r.actualFinish !== pos) fail(`${tag}: actualFinish ${r.actualFinish} but table says ${pos}`);
  for (const m of r.matches) {
    const res = m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor < m.goalsAgainst ? "L" : "D";
    if (m.result !== res) fail(`${tag}: ${m.goalsFor}-${m.goalsAgainst} marked ${m.result}`);
    if (m.goalScorers.length !== m.goalsFor) fail(`${tag}: ${m.goalsFor} goals but ${m.goalScorers.length} scorers v ${m.opponent}`);
    for (const g of m.goalScorers) if (!(g.minute >= 1 && g.minute <= 120)) fail(`${tag}: goal minute ${g.minute}`);
    if (m.assistProviders.length > m.goalsFor) fail(`${tag}: more assists than goals`);
  }
  const boot = r.awards.goldenBoot;
  if (boot.goals < 0 || !boot.name) fail(`${tag}: golden boot '${boot.name}' ${boot.goals}`);
}

const t0 = Date.now();
let seasons = 0, worstMs = 0;
for (let c = 0; c < CAREERS; c++) {
  const base = 55 + Math.floor(rnd() * 40);
  const players = squad(base);
  let prev: SeasonResult | undefined;
  for (let s = 1; s <= 5; s++) {
    const t = Date.now();
    const r = simulateSeason(players, undefined, s, prev?.leagueTable, prev);
    worstMs = Math.max(worstMs, Date.now() - t);
    check(r, `career ${c} (OVR ~${base}) season ${s}`);
    prev = r; seasons++;
  }
}
console.log(`${seasons} seasons in ${((Date.now() - t0) / 1000).toFixed(1)} s, slowest ${worstMs} ms`);
console.log(fails ? `${fails} FAILED` : "All passed");
process.exit(fails ? 1 : 0);
