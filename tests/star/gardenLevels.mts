/**
 * GARDEN LEVELS AND RIDING (28 Nov 2026) — the parts that need no GPU: XP and levels, what each level opens,
 * the save round trip and old saves, the ride put back on the career, the riding maths (gaits, energy, turning),
 * the lap rules (order, jumps, poles, refusals, best), the plan (everything inside its area, the course inside the
 * track, the gates on one line), the horse's rounding pass, and the measured draws / triangles against the budget.
 */
import * as T from "three";
import {
  GARDEN_LEVELS, GARDEN_XP, WEEK_CAP, addGardenXp, applyRide, areaOpen, gardenChip, gardenLevelOf, gardenLevelsOptFor,
  gardenProgress, rideEnergy, xpAtLevel, xpFor, STABLE_HORSE_NAME,
} from "../../lib/star/gardenLevels";
import {
  GAIT_SPEED, TIRED, DRAIN, REFILL_PER_WEEK, crossAt, drain, energyNow, gaitAt, gaitFor, jumpResult, lapClock, lapTraining,
  newLap, offSquare, setRideEffectForTest, stepLap, stepSpeed, turnRate, RAIL_PENALTY, POLE_PENALTY, type CourseGate,
} from "../../lib/star/garden3d/riding";
import {
  AXIS_Z, COURSE, COURSE_ROUTE, FIELD, LANE, PADDOCK2, TRACK, TRACK_GATES, WEST_GATE, ZONE_A, clampToRects, clearedRects,
  inRect, jumpBoxes, levelTrees, passedWaypoint, pushOut, rideRects, solidBoxes, trackPoint, trackRadius, walkRects,
} from "../../lib/star/garden3d/levelLayout";
import { roundSkinned } from "../../lib/star/garden3d/rideHorse";
import { GARDEN_BUDGET, GARDEN_LEVELS_MEASURED, RIDER_MEASURED } from "../../lib/star/garden3d/gardenBudget";
import type { CareerState } from "../../lib/star/types";
import { HORSE_NAMES, REAL_HORSE_BLOCKLIST } from "../../lib/star/horseNames";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const career = (o: Partial<CareerState> = {}) => ({ season: 1, week: 3, horse: null, matchFitness: 80, ...o }) as unknown as CareerState;

// ── XP and levels ──
check(gardenLevelOf(0).level === 1 && gardenLevelOf(0).into === 0 && gardenLevelOf(0).need === 300, "0 XP: level 1, 0/300");
check(gardenLevelOf(299).level === 1 && gardenLevelOf(300).level === 2, "300 XP opens level 2");
check(gardenLevelOf(340).into === 40 && gardenLevelOf(340).need === 600, "340 XP: level 2, 40/600");
check(gardenChip(300 + 340) === "Garden level 2 · 340/600 XP", `the chip reads "Garden level 2 · 340/600 XP" (${gardenChip(640)})`);
check(xpAtLevel(5) === 3400 && gardenLevelOf(3400).level === 5 && gardenLevelOf(99999).level === 5, "level 5 at 3400 XP, and never past 5");
check(gardenChip(5000) === "Garden level 5 · max", "the top level's chip says max");
for (const l of GARDEN_LEVELS) check(gardenLevelOf(xpAtLevel(l.level)).level === l.level && gardenLevelOf(xpAtLevel(l.level) - 1).level === Math.max(1, l.level - 1), `level ${l.level} starts exactly at ${xpAtLevel(l.level)} XP`);
check(!areaOpen(0, "paddock") && areaOpen(300, "paddock") && !areaOpen(300, "field") && areaOpen(900, "field") && areaOpen(1900, "track") && areaOpen(3400, "signpost"), "each level opens its own area, in order");
check(xpFor({ kind: "drill" }) === GARDEN_XP.drill && xpFor({ kind: "drill", stars: 3 }) === GARDEN_XP.drill + 3 * GARDEN_XP.drillStar && xpFor({ kind: "drill", stars: 9 }) === xpFor({ kind: "drill", stars: 3 }), "a drill: base + 10 a star, 3 stars at most");
check(xpFor({ kind: "casino", bets: 0 }) === 0 && xpFor({ kind: "casino", bets: 100 }) === GARDEN_XP.casinoBet * GARDEN_XP.casinoBetsMax, "casino: per bet, capped per visit");
{
  let c = career();
  for (let i = 0; i < 20; i++) c = addGardenXp(c, { kind: "drill", stars: 3 });
  check(gardenProgress(c).xp === WEEK_CAP, `a week gives at most ${WEEK_CAP} XP (${gardenProgress(c).xp})`);
  c = addGardenXp({ ...c, week: 4 }, { kind: "casino", bets: 4 });
  check(gardenProgress(c).xp === WEEK_CAP + 60, "the next week counts again");
  // weeks to level 5 at an ordinary rate (two drills of 2 stars and a casino visit of 3 bets a week: 180 a week)
  let w = 0, d = career();
  while (gardenLevelOf(gardenProgress(d).xp).level < 5 && w < 200) { d = { ...d, week: w } as CareerState; d = addGardenXp(addGardenXp(addGardenXp(d, { kind: "drill", stars: 2 }), { kind: "drill", stars: 2 }), { kind: "casino", bets: 3 }); w++; }
  check(w >= 15 && w <= 30, `level 5 takes weeks of ordinary play, not a sitting (${w} weeks)`);
}
// save round trip and an old save
{
  const old = career();
  check(gardenProgress(old).xp === 0 && gardenLevelOf(gardenProgress(old).xp).level === 1, "an old save (no gardenXp) is level 1, 0 XP");
  check(gardenProgress({ gardenXp: { xp: NaN } } as unknown as CareerState).xp === 0 && gardenProgress({ gardenXp: "x" } as unknown as CareerState).xp === 0, "a broken value reads as 0");
  const c = addGardenXp(career(), { kind: "drill", stars: 1 });
  const back = JSON.parse(JSON.stringify(c)) as CareerState;
  check(gardenProgress(back).xp === 50 && back.gardenXp?.wk === "1-3", "the XP survives a save round trip");
  check(JSON.stringify(c.gardenXp).length < 80, `saved small (${JSON.stringify(c.gardenXp).length} characters)`);
}

// ── a ride, on the career ──
{
  const mine = career({ horse: { name: "Bolt", breed: "x", speed: 80, stamina: 70, energy: 60, racesRun: 0, racesWon: 0, earnings: 0 } } as Partial<CareerState>);
  const r = applyRide(mine, { energy: 52.34, laps: [{ kind: "course", ms: 41000 }, { kind: "course", ms: 38000 }, { kind: "track", ms: 17000 }] });
  check(r.horse?.energy === 52.3 && r.horse.speed === 80 && r.matchFitness === 80, "your horse's energy goes down; flag off: no speed, stamina or fitness change");
  check(r.gardenXp?.bestCourse === 38000 && r.gardenXp?.bestTrack === 17000 && r.gardenXp?.laps === 3, "best times and laps are kept");
  const r2 = applyRide(r, { energy: 50, laps: [{ kind: "course", ms: 45000 }] });
  check(r2.gardenXp?.bestCourse === 38000, "a slower lap never replaces the best");
  setRideEffectForTest("on");
  const t = applyRide(mine, { energy: 40, laps: Array.from({ length: 5 }, () => ({ kind: "course" as const, ms: 40000 })) });
  check(t.matchFitness === 83 && t.horse?.speed === 81.5 && t.horse?.stamina === 71.5, "flag on: 3 laps a week train (+1 fitness, +0.5 speed and stamina each)");
  const t2 = applyRide(t, { energy: 30, laps: [{ kind: "course", ms: 40000 }] });
  check(t2.matchFitness === 83, "no more than 3 a week");
  setRideEffectForTest(null);
  check(lapTraining(0).fitness === 0, "the flag is off by default");
  const stable = career();
  check(rideEnergy(stable) === 100, "the stable horse starts full");
  const s = applyRide(stable, { energy: 30, laps: [] });
  check(s.gardenXp?.stableEnergy === 30 && rideEnergy(s) === 30, "the stable horse's energy is saved");
  check(rideEnergy({ ...s, week: 5 } as CareerState) === 30 + 2 * REFILL_PER_WEEK && rideEnergy({ ...s, week: 40 } as CareerState) === 100, "it refills 20 a week, to 100");
  const o = gardenLevelsOptFor(stable);
  check(o.horse.name === STABLE_HORSE_NAME && !o.horse.mine && gardenLevelsOptFor(mine).horse.mine, "no horse of your own: the stable's horse");
}

// ── riding maths ──
check(gaitFor(0, false, 100) === "halt" && gaitFor(0.3, false, 100) === "walk" && gaitFor(0.6, false, 100) === "trot" && gaitFor(1, false, 100) === "canter" && gaitFor(1, true, 100) === "gallop", "stick push: walk, trot, canter; the gallop button gallops");
check(gaitFor(1, true, TIRED.noGallop - 1) === "canter" && gaitFor(1, false, TIRED.walkOnly - 1) === "walk", "tired: no gallop under 15, a walk under 5");
check(GAIT_SPEED.walk < GAIT_SPEED.trot && GAIT_SPEED.trot < GAIT_SPEED.canter && GAIT_SPEED.canter < GAIT_SPEED.gallop && GAIT_SPEED.gallop <= 10, "speeds rise walk → gallop (gallop 9.5 m/s)");
for (const g of ["walk", "trot", "canter", "gallop"] as const) check(gaitAt(GAIT_SPEED[g]) === g, `${g}'s own speed reads as ${g}`);
{
  let v = 0, t = 0;
  while (v < GAIT_SPEED.canter && t < 10) { v = stepSpeed(v, "canter", 1 / 30); t += 1 / 30; }
  check(t > 1.5 && t < 2.5, `halt to canter in about 2 s (${t.toFixed(2)} s)`);
  let u = GAIT_SPEED.gallop; t = 0;
  while (u > 0 && t < 10) { u = stepSpeed(u, "halt", 1 / 30); t += 1 / 30; }
  check(t < 2.2, `gallop to a stop in under 2.2 s (${t.toFixed(2)} s)`);
}
check(turnRate(0) > turnRate(GAIT_SPEED.gallop) && turnRate(GAIT_SPEED.gallop) > 0.9, "he turns tighter slowly than flat out");
check(drain(50, GAIT_SPEED.walk, 60) === 50 && drain(50, GAIT_SPEED.gallop, 10) === 50 - DRAIN.gallop * 10 && drain(1, GAIT_SPEED.gallop, 100) === 0, "a walk is free, a gallop costs most, never under 0");
check(energyNow(undefined, undefined, 1, 1) === 100 && energyNow(10, "1-3", 2, 3) === 100 && energyNow(10, "1-3", 1, 4) === 30, "energy refills by the weeks since");
// a course lap at a canter, ~30 s, costs about 5; galloped flat out about 15
check(Math.abs(DRAIN.canter * 30 - 4.8) < 0.5 && DRAIN.gallop * 30 === 15, "a canter lap ~5 energy, a galloped one 15");

// ── laps ──
check(crossAt(0, 0, 2, 0, 1, -1, 1, 1) === 0.5 && crossAt(0, 0, 0.5, 0, 1, -1, 1, 1) === -1, "line crossing");
check(jumpResult(GAIT_SPEED.walk, 0) === "refusal" && jumpResult(GAIT_SPEED.trot, 0) === "rail" && jumpResult(GAIT_SPEED.canter, 0) === "clean" && jumpResult(GAIT_SPEED.canter, 0.7) === "rail", "walk refuses, trot knocks, canter square is clean, canter at an angle knocks");
{
  const g: CourseGate = COURSE[1];
  check(offSquare(g, -1, 0) < 1e-9 && Math.abs(offSquare(g, -1, 1) - Math.PI / 4) < 1e-6, "off square: 0 straight through, 45° at a diagonal");
}
/** Ride the route by the riding maths alone (no 3D): what the lap gives. */
function rideRoute(route: [number, number, number, number][], gates: CourseGate[], laps = 1, dt = 1 / 30) {
  let x = route[0][0] + 6, z = route[0][1], yaw = -Math.PI / 2, v = 0, lap = newLap(), i = 0, t = 0, energy = 100;
  const events: string[] = []; const times: number[] = [];
  while (times.length < laps && t < 240) {
    const w = route[i % route.length];
    if (passedWaypoint(x, z, yaw, w)) i++;
    const w2 = route[i % route.length];
    const want = Math.atan2(w2[0] - x, w2[1] - z);
    let d = want - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    yaw += Math.max(-turnRate(v) * dt, Math.min(turnRate(v) * dt, d));
    v = stepSpeed(v, gaitFor(w2[2], !!w2[3], energy), dt);
    energy = drain(energy, v, dt);
    const nx = x + Math.sin(yaw) * v * dt, nz = z + Math.cos(yaw) * v * dt;
    const r = stepLap(lap, gates, x, z, nx, nz, v, dt, undefined);
    lap = r.lap; x = nx; z = nz; t += dt;
    for (const e of r.events) { events.push(e.kind + (e.result ? `:${e.result}` : "")); if (e.kind === "finish") times.push(e.time!); }
  }
  return { events, times, energy, t };
}
{
  const r = rideRoute(COURSE_ROUTE, COURSE);
  const jumps = r.events.filter((e) => e.startsWith("jump"));
  check(r.times.length === 1, `the course route finishes a lap (${r.events.join(" ")})`);
  check(jumps.length === 5, `five jumps on the way round (${jumps.join(" ")})`);
  check(jumps.filter((j) => j === "jump:clean").length >= 4, `the clean route takes the jumps clean (${jumps.join(" ")})`);
  check(r.times[0] > 18 && r.times[0] < 45, `a lap is 18-45 s (${r.times[0]?.toFixed(1)} s)`);
  check(100 - r.energy > 2 && 100 - r.energy < 12, `a lap costs a few energy (${(100 - r.energy).toFixed(1)})`);
  console.log(`  course lap (maths only, the clean route): ${lapClock(r.times[0] ?? 0)}, ${(100 - r.energy).toFixed(1)} energy, ${r.events.filter((e) => e === "pole").length} poles knocked`);
}
{
  // wrong order: straight from the start to the finish, nothing counts
  let lap = newLap();
  lap = stepLap(lap, COURSE, -59, 5.5, -61, 5.5, 6, 0.1, undefined).lap;
  check(lap.on && lap.next === 1, "through START: the lap is on, jump 1 next");
  const back = stepLap(lap, COURSE, -61, 5.5, -59, 5.5, 6, 0.1, undefined);
  check(!back.events.some((e) => e.kind === "finish"), "back over the line before the jumps: no lap");
  // a knocked pole costs a second
  const p = COURSE.find((g) => g.kind === "poles")!.poles![0];
  const hit = stepLap(lap, COURSE, p[0] - 1, p[1], p[0] + 1, p[1], 3.6, 0.1, undefined);
  check(hit.lap.pen === POLE_PENALTY && hit.events.some((e) => e.kind === "pole"), "riding into a pole: +1 s");
  const twice = stepLap(hit.lap, COURSE, p[0] - 1, p[1], p[0] + 1, p[1], 3.6, 0.1, undefined);
  check(twice.lap.pen === POLE_PENALTY, "the same pole counts once a lap");
  // a rail at a trot
  const j1 = COURSE[1];
  const rail = stepLap(lap, COURSE, j1.x0 + 0.5, 5.5, j1.x0 - 0.5, 5.5, GAIT_SPEED.trot, 0.1, undefined);
  check(rail.lap.pen === RAIL_PENALTY && rail.lap.next === 2, "jump 1 at a trot: rail down +2 s, on to jump 2");
}
{
  const r = rideRoute((() => { const pts: [number, number, number, number][] = []; for (let i = 0; i < 24; i++) { const [x, z] = trackPoint(1 - i / 24, 15); pts.push([x, z, 1, 1]); } return pts; })(), TRACK_GATES);
  check(r.times.length === 1 && r.times[0] > 12 && r.times[0] < 30, `a galloped track lap is 12-30 s (${r.times[0]?.toFixed(1)} s)`);
}
check(lapClock(34.25) === "0:34.3" && lapClock(61.04) === "1:01.0", "the clock reads m:ss.s");

// ── the plan ──
check(walkRects(1).length === 0 && solidBoxes(1).length === 0 && clearedRects(1).length === 0 && levelTrees(1).length === 0, "level 1 builds nothing new (the garden as it is)");
check(WEST_GATE.x === -19 && AXIS_Z > WEST_GATE.z0 && AXIS_Z < WEST_GATE.z1, "the west gate is in the west wall, on the side path's line");
for (const lv of [2, 3, 4, 5]) {
  const w = walkRects(lv);
  // walk from the garden along the axis to the far end of the open areas: every step inside some area
  const end = lv >= 3 ? FIELD[0] + 2 : ZONE_A[0] + 1;
  let ok = true;
  for (let x = -18.5; x > end; x -= 0.25) if (!w.some((r) => inRect(x, AXIS_Z, r))) { ok = false; break; }
  check(ok, `level ${lv}: you can walk the whole line from the garden gate to the far end`);
  const s = solidBoxes(lv);
  let free = true;
  for (let x = -18.5; x > end; x -= 0.25) if (s.some((b) => x > b[0] - 0.32 && x < b[1] + 0.32 && AXIS_Z > b[2] - 0.32 && AXIS_Z < b[3] + 0.32)) { free = false; break; }
  check(free, `level ${lv}: no fence or wall across the gates' line`);
  for (const t of levelTrees(lv)) check(!w.some((r) => inRect(t.x, t.z, r)) && !clearedRects(lv).some((r) => inRect(t.x, t.z, r)), `level ${lv}: tree at ${t.x.toFixed(1)},${t.z.toFixed(1)} stands outside the open areas`);
}
check(solidBoxes(2).some((b) => inRect(-46.2, AXIS_Z, b)) && !solidBoxes(3).some((b) => inRect(-46.2, AXIS_Z, b)), "the field gate is shut at level 2, open at 3");
check(jumpBoxes(2).length === 0 && jumpBoxes(3).length === 5, "five jumps from level 3");
// the course and the track inside the field, the course inside the track
for (const g of COURSE) for (const [x, z] of [[g.x0, g.z0], [g.x1, g.z1], ...(g.poles ?? [])]) {
  check(inRect(x, z, FIELD), `course point ${x},${z} is in the field`);
  check(trackRadius(x, z) < TRACK.inner - 0.8, `course point ${x},${z} is inside the track's inner rail (${trackRadius(x, z).toFixed(1)} m)`);
}
for (const [x, z] of COURSE_ROUTE) check(trackRadius(x, z) < TRACK.inner - 0.3, `route point ${x},${z} stays inside the track`);
for (let t = 0; t < 1; t += 0.01) { const [x, z] = trackPoint(t, TRACK.outer + 0.3); check(inRect(x, z, [FIELD[0] + 0.5, FIELD[1] - 0.5, FIELD[2] + 0.5, FIELD[3] - 0.5]), `the track's outer rail is inside the field (${x.toFixed(1)}, ${z.toFixed(1)})`); }
check(inRect(LANE[0] + 1, AXIS_Z, rideRects(2)[0]) && !rideRects(5).some((r) => inRect(0, 0, r)), "the horse rides the lane and the new areas, never the old garden");
check(inRect(PADDOCK2[0] + 2, 0, ZONE_A), "the paddock is in area A");
check(clampToRects(-30, 50, walkRects(2))[1] <= ZONE_A[3], "a point outside is pulled back into an area");
check(pushOut(-31, -10, solidBoxes(2), 0.32)[1] > -7.5 || pushOut(-31, -10, solidBoxes(2), 0.32)[0] !== -31, "out of the stable's walls");

// ── the horse's rounding (one pass): four triangles for one, skin weights still sum to 1, sizes kept ──
{
  const g = new T.BoxGeometry(1, 1, 1, 1, 1, 1);
  const n = g.attributes.position.count;
  g.setAttribute("skinIndex", new T.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? (Math.floor(i / 4) % 2) : 0)), 4));
  g.setAttribute("skinWeight", new T.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const r = roundSkinned(T, g);
  const tris0 = g.index!.count / 3, tris1 = r.index!.count / 3;
  check(tris1 === tris0 * 4, `rounding: 4 triangles for each (${tris0} → ${tris1})`);
  const sw = r.attributes.skinWeight;
  let okW = true;
  for (let i = 0; i < sw.count; i++) { const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i); if (Math.abs(s - 1) > 1e-4) okW = false; }
  check(okW, "rounding: every point's skin weights still add up to 1");
  r.computeBoundingBox();
  const sz = new T.Vector3(); r.boundingBox!.getSize(sz);
  check(sz.x > 0.85 && sz.x <= 1.0001, `rounding keeps the size (1 m box → ${sz.x.toFixed(3)} m)`);
}

// ── the rider on the saddle (RUL-3D-005), measured on the real bodies (scripts/perf3d H.rider, riderCheck) ──
check(RIDER_MEASURED.kneeOut.every((v) => v > 0.05), `knees outside the horse's barrel (${RIDER_MEASURED.kneeOut})`);
check(RIDER_MEASURED.footOut.every((v) => v >= 0), `feet outside the barrel (${RIDER_MEASURED.footOut})`);
check(Math.abs(RIDER_MEASURED.hipsOverSeat) < 0.02, "hips on the seat");
check(RIDER_MEASURED.ironGap.every((v) => v < 0.15), `feet in the irons (${RIDER_MEASURED.ironGap} m)`);

// ── speed: measured with the real scene (scripts/perf3d, 412×915 at 2.625, S20 browser name, Medium) ──
for (const m of GARDEN_LEVELS_MEASURED) {
  const b = m.walking ? GARDEN_BUDGET.mediumWalking : GARDEN_BUDGET.medium;
  check(m.triangles <= b.triangles, `level ${m.level} ${m.view}${m.walking ? " (moving)" : ""}: ${m.triangles} triangles ≤ ${b.triangles}`);
  if (m.over) { check(m.draws <= m.over.ceiling, `level ${m.level} ${m.view}: ${m.draws} draws, held at ${m.over.ceiling}`); console.log(`  KNOWN OVER: level ${m.level} ${m.view}: ${m.draws} draws > ${b.draws} (${m.over.why})`); }
  else if (!m.baselineOver) check(m.draws <= b.draws, `level ${m.level} ${m.view}${m.walking ? " (moving)" : ""}: ${m.draws} draws ≤ ${b.draws}`);
  else check(m.draws <= m.baselineOver, `level ${m.level} ${m.view}: ${m.draws} draws, no more than the garden itself there (${m.baselineOver})`);
}

// ── names: every horse name invented (Harry: no real names) ──
{
  const ours = [...HORSE_NAMES, STABLE_HORSE_NAME, "Thunder Bolt", "Copper Kettle"];
  const norm = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
  for (const n of ours) check(!REAL_HORSE_BLOCKLIST.some((r) => norm(r) === norm(n)), `"${n}" is a real horse or person`);
  check(new Set(HORSE_NAMES).size === HORSE_NAMES.length, "no name twice in the race field list");
}

if (problems.length) { console.error(`gardenLevels: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("gardenLevels: all checks passed");
