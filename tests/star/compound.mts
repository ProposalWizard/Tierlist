/**
 * THE TRAINING COMPOUND (lib/star/world3d/compoundPlan.ts; phase 1, the grounds, on /star-world3d-dev?place=compound).
 *
 *  - the layout is walkable: from where you park, every door, every pitch, the gate, the stand, every spot a person
 *    uses and the bench can be reached on the walk grid (the same grid and body width the place uses);
 *  - the doors lead where they say: the gym door to the gym place, the others to a "coming soon" card;
 *  - the people's routines never keep anyone on one thing for more than 45 s (a step, or the walk to the next);
 *  - speed: the measured draws and triangles from every viewpoint (scripts/world3d/compound-measure.mjs, an S20
 *    profile) are inside each tier's budget, and the budget is the standing rule's (Medium 90 draws, 90k triangles;
 *    Low 60 draws).
 */
import { buildGrid, findPath, freeAt, type XZ } from "../../lib/star/tapWalk";
import {
  COMPOUND, DOORS, DOOR_SOON, SPOTS, PEOPLE, ROUTINES, FORECOURT_BENCH, COMPOUND_RATE, STUCK_MAX_S, COMPOUND_BUDGET, COMPOUND_VIEWS,
  COMPOUND_MEASURED, compoundSolids, doorFront, goalsOf, zoneAt, ZONES, CONES, POLES, MANNEQUINS,
} from "../../lib/star/world3d/compoundPlan";
import { clusterTriangles } from "../../lib/star/world3d/farBodies";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** A body's half width (lib/star/world3d/npc.ts BODY_R; kept here so the test needs no three.js). */
const BODY_R = 0.3;
/** People walk at about this (m/s; npc.ts NPC_WALK). */
const NPC_WALK = 1.25;

// ── the walk grid, exactly as the place builds it (testScene.ts) ──
const solids = compoundSolids();
const [bx0, bx1, bz0, bz1] = COMPOUND.bounds;
const grid = buildGrid(bx0, bx1, bz0, bz1, COMPOUND.cell, (x, z) => {
  if (x < bx0 + BODY_R || x > bx1 - BODY_R || z < bz0 + BODY_R || z > bz1 - BODY_R) return false;
  for (const [a, b, c, d] of solids) if (x > a - BODY_R && x < b + BODY_R && z > c - BODY_R && z < d + BODY_R) return false;
  return true;
});
const pathLen = (from: XZ, to: XZ): number | null => {
  const p = findPath(grid, from, to);
  if (!p) return null;
  let len = 0, at = from;
  for (const q of p) { len += Math.hypot(q[0] - at[0], q[1] - at[1]); at = q; }
  // the walker finishes the last bit to the exact point (npc.ts plan)
  return len + Math.hypot(to[0] - at[0], to[1] - at[1]);
};
const start: XZ = [COMPOUND.you.x, COMPOUND.you.z];
check(freeAt(grid, start[0], start[1]), `you start on free ground (${start})`);

// ── everything you can go to is reachable from where you park ──
const targets: [string, XZ][] = [
  ["the gate (inside)", [0, 20.4]],
  ["the crest board", [COMPOUND.board.x, COMPOUND.board.z + 1.1]],
  ...DOORS.map((d): [string, XZ] => [d.label, doorFront(d)]),
  ...COMPOUND.pitches.map((p): [string, XZ] => [`pitch ${p.id}`, [p.x, p.z]]),
  ...COMPOUND.pitches.map((p): [string, XZ] => [`pitch ${p.id}'s far corner`, [p.x + p.len / 2 - 3, p.z - p.wid / 2 + 3]]),
  ["the stand's front", [COMPOUND.stand.x0 - 1, (COMPOUND.stand.z0 + COMPOUND.stand.z1) / 2]],
  ...SPOTS.map((s): [string, XZ] => [`spot ${s.id}`, s.at]),
  ["the forecourt bench", [FORECOURT_BENCH.at[0] + 0.31, FORECOURT_BENCH.at[1]]],
];
for (const [name, at] of targets) {
  const len = pathLen(start, at);
  check(len !== null, `${name} can be walked to from the car park`);
  // the walk must end where it should (not at a nearest free cell metres off)
  const p = findPath(grid, start, at);
  if (p && p.length) { const end = p[p.length - 1]; check(Math.hypot(end[0] - at[0], end[1] - at[1]) < 0.8, `${name}: the walk ends at it (${end.map((v) => v.toFixed(1))} vs ${at})`); }
}
// the walk from the car park to the gym door goes through the gate (the fence has no other way in from the car park)
{
  const p = [start, ...findPath(grid, start, doorFront(DOORS[0]))!];
  const crossing = p.find((q, i) => i > 0 && (p[i - 1][1] - COMPOUND.fenceZ) * (q[1] - COMPOUND.fenceZ) <= 0);
  check(!!crossing && Math.abs(crossing[0]) < COMPOUND.gate.x1, `the way in crosses the fence at the gate (${crossing?.map((v) => v.toFixed(1))})`);
  const len = pathLen(start, doorFront(DOORS[0]))!;
  check(len > 18 && len < 32, `car park to the gym door is a short walk, 18-32 m (${len.toFixed(1)} m: about ${(len / 1.4).toFixed(0)} s)`);
}
// nothing is planted on a pitch's playing area but the training kit, and every goal sits on a pitch's end line
for (const g of goalsOf()) check(COMPOUND.pitches.some((p) => Math.abs(Math.abs(g.x - p.x) - p.len / 2) < 0.01 && Math.abs(g.z - p.z) < 0.01), `goal at ${g.x},${g.z} is on an end line`);
for (const [x, z] of [...CONES, ...POLES, ...MANNEQUINS]) check(COMPOUND.pitches.some((p) => Math.abs(x - p.x) < p.len / 2 && Math.abs(z - p.z) < p.wid / 2), `training kit at ${x},${z} is on a pitch`);
// the zones cover what they hold (each door, the gate, each pitch's middle)
check(zoneAt(0, 24) === "gate" && zoneAt(-11, 9) === "building" && zoneAt(62, 1) === "pitchA" && zoneAt(-2, 35) === "carpark", "the zones hold the gate, the building, pitch A and the car park");
check(ZONES.every((z) => z.box[0] < z.box[1] && z.box[2] < z.box[3]), "every zone's box is the right way round");

// ── the doors lead where they say ──
const gymDoor = DOORS.find((d) => d.id === "door-gym");
check(!!gymDoor && gymDoor.leads === "gym", "the gym door leads to the gym place");
for (const d of DOORS) if (d.leads !== "gym") check((DOOR_SOON[d.id]?.length ?? 0) > 0, `${d.label}: a "coming soon" card says what will be there`);
check(new Set(DOORS.map((d) => d.id)).size === DOORS.length && DOORS.length === 3, "three doors, each its own id (gym, reception, canteen)");
check(DOORS.every((d) => d.x > COMPOUND.building.x0 + 1 && d.x < COMPOUND.building.x1 - 1), "every door is on the building's front");

// ── the people: 3 to 6, each on a routine that never keeps him on one thing past 45 s ──
check(PEOPLE.length >= 3 && PEOPLE.length <= 6, `3 to 6 people (${PEOPLE.length})`);
check(PEOPLE.some((p) => p.role === "staff" && p.prop === "clipboard") && PEOPLE.some((p) => p.slot === "kitman"), "a coach with a clipboard and the kit man");
const where = (target: string): XZ | null => {
  const s = SPOTS.find((x) => x.id === target);
  if (s) return s.at;
  if (target === FORECOURT_BENCH.id) return [FORECOURT_BENCH.at[0] + 0.31, FORECOURT_BENCH.at[1]];
  return null;
};
for (const p of PEOPLE) {
  const r = ROUTINES[p.routine];
  check(!!r, `${p.slot}: routine ${p.routine} exists`);
  if (!r) continue;
  check(freeAt(grid, p.start[0], p.start[1]) || p.routine === "compound-bench", `${p.slot} starts on free ground`);
  const stops = r.steps.map((s) => where(s.do.target));
  check(stops.every(Boolean), `${p.slot}: every step's place exists (${r.steps.map((s) => s.do.target)})`);
  for (const s of r.steps) {
    const secs = (s.mins[1] * 60) / COMPOUND_RATE;
    check(secs <= STUCK_MAX_S, `${p.slot}: "${s.do.target}" lasts at most ${secs.toFixed(0)} s (≤ ${STUCK_MAX_S})`);
  }
  // the walk from each stop to the next (round again at the end), and from his start to the first
  const legs: [XZ, XZ, string][] = [[p.start, stops[0]!, `start → ${r.steps[0].do.target}`]];
  for (let i = 0; i < stops.length; i++) legs.push([stops[i]!, stops[(i + 1) % stops.length]!, `${r.steps[i].do.target} → ${r.steps[(i + 1) % stops.length].do.target}`]);
  for (const [a, b, name] of legs) {
    const len = pathLen(a, b);
    check(len !== null, `${p.slot}: ${name} can be walked`);
    if (len !== null) check(len / NPC_WALK <= STUCK_MAX_S, `${p.slot}: ${name} takes at most ${STUCK_MAX_S} s (${(len / NPC_WALK).toFixed(0)} s)`);
  }
}

// ── speed: the measured frames inside the budget, the budget the standing rule's ──
check(COMPOUND_BUDGET.medium.draws <= 90 && COMPOUND_BUDGET.medium.triangles <= 90_000 && COMPOUND_BUDGET.low.draws <= 60, "the budget is the standing rule's (Medium ≤90 draws ≤90k triangles, Low ≤60 draws)");
for (const tier of ["medium", "low", "high"] as const) {
  const rows = COMPOUND_MEASURED.filter((m) => m.tier === tier);
  check(rows.length === COMPOUND_VIEWS.length, `${tier}: every viewpoint measured (${rows.length}/${COMPOUND_VIEWS.length})`);
  for (const v of COMPOUND_VIEWS) check(rows.some((r) => r.view === v.id), `${tier}: "${v.id}" measured`);
  const b = COMPOUND_BUDGET[tier];
  for (const r of rows) {
    check(r.draws <= b.draws && r.triangles <= b.triangles, `${tier} ${r.view}: standing ${r.draws} draws ${r.triangles} triangles (budget ${b.draws}, ${b.triangles})`);
    check(r.walkDraws <= b.draws && r.walkTriangles <= b.triangles, `${tier} ${r.view}: walking ${r.walkDraws} draws ${r.walkTriangles} triangles (budget ${b.draws}, ${b.triangles})`);
  }
}

// ── far people: the coarse triangles are a real cut and only reuse the body's own vertices ──
{
  // a little grid of quads, 40 × 40 vertices, one bone: clustering at 4 cells keeps it whole but far smaller
  const N = 40, pts: number[] = [], idx: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push(i * 0.01, j * 0.01, 0);
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i; idx.push(a, a + 1, a + N, a + 1, a + N + 1, a + N); }
  const pos = { count: N * N, getX: (k: number) => pts[k * 3], getY: (k: number) => pts[k * 3 + 1], getZ: (k: number) => pts[k * 3 + 2] };
  const far = clusterTriangles(pos, idx, 0.04);
  check(far.length > 0 && far.length < idx.length / 4, `far triangles: a real cut (${far.length / 3} of ${idx.length / 3})`);
  check(far.every((k) => k >= 0 && k < N * N), "far triangles only use the body's own vertices");
  // two bones side by side: no triangle joins a vertex of one bone to the other's
  const bone = (k: number) => (k % N < N / 2 ? 0 : 1);
  const far2 = clusterTriangles(pos, idx, 0.04, bone);
  let mixed = 0;
  for (let t = 0; t < far2.length; t += 3) { const b = new Set([bone(far2[t]), bone(far2[t + 1]), bone(far2[t + 2])]); if (b.size > 1 && !idx.some(() => false)) mixed++; }
  // a triangle may still span the bone line where the full mesh had one (the seam): never more than the full mesh had
  let fullMixed = 0;
  for (let t = 0; t < idx.length; t += 3) if (new Set([bone(idx[t]), bone(idx[t + 1]), bone(idx[t + 2])]).size > 1) fullMixed++;
  check(mixed <= fullMixed, `far triangles never weld two bones more than the body did (${mixed} ≤ ${fullMixed})`);
}

if (problems.length) { console.error(`✗ compound: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`✓ compound: ${targets.length} places reachable, the doors lead where they say, ${PEOPLE.length} people never stuck over ${STUCK_MAX_S} s, ${COMPOUND_MEASURED.length} measured frames inside the budget`);
