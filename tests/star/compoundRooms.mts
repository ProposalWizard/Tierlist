/**
 * THE COMPOUND'S RECEPTION AND CANTEEN (lib/star/world3d/roomsPlan.ts; 28 Nov 2026).
 *
 *  - the doors lead in and out: the reception and canteen doors of the compound open their rooms, and back out of
 *    each stands you on free forecourt ground just outside that same door (the compound's own walk grid);
 *  - each room is walkable: from where you come in, the desk, the cabinet, the screen, the sofa, the counter and every
 *    chair beside a team-mate can be reached on the room's walk grid (the same body width the place uses);
 *  - the seats are spaced: every chair a body's width from every other, the team-mates' chairs never yours, the
 *    sitter's knees clear the table (the chair is pulled out past them);
 *  - lunch is the lunch card's, not a copy: the canteen's three are life/lunch.ts lunchMates, the menu and the chef are
 *    life/lunch.ts hallOf, the 3D never decides a plate (no lunch rule in the room's files) and the page shows
 *    components/star/LunchCard.tsx itself;
 *  - the receptionist's line is the career clock's: the next match, and when you leave;
 *  - speed: every measured view of each room is inside the club gym's own frame (GYM_FRAME).
 */
import fs from "node:fs";
import { buildGrid, findPath, freeAt, type XZ } from "../../lib/star/tapWalk";
import { COMPOUND, DOORS, compoundSolids, outOfDoor, doorFront } from "../../lib/star/world3d/compoundPlan";
import {
  RECEPTION, CANTEEN, MATE_SEATS, CHAIR_FRONT, GYM_FRAME, ROOMS_MEASURED, canteenChairs, hipsOn, roomSolids, wallSolids, roomBack, roomInfo, hasChef,
  RECEPTIONIST, CHEF, type RoomId,
} from "../../lib/star/world3d/roomsPlan";
import { hallOf, lunchMates, LUNCH_FROM } from "../../lib/star/life/lunch";
import { clockOf, nextMatchInfo, hhmm, passTime } from "../../lib/star/life/clock";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { generateSquad } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const BODY_R = 0.3; // npc.ts BODY_R
const SIT_STEP = 0.31; // smartObject.ts SIT_STEP: his feet in front of the seat before he sits

// ── the compound's doors lead into the rooms and back out of the same door ──
const cs = compoundSolids();
const [bx0, bx1, bz0, bz1] = COMPOUND.bounds;
const cgrid = buildGrid(bx0, bx1, bz0, bz1, COMPOUND.cell, (x, z) => {
  if (x < bx0 + BODY_R || x > bx1 - BODY_R || z < bz0 + BODY_R || z > bz1 - BODY_R) return false;
  for (const [a, b, c, d] of cs) if (x > a - BODY_R && x < b + BODY_R && z > c - BODY_R && z < d + BODY_R) return false;
  return true;
});
for (const id of ["reception", "canteen"] as RoomId[]) {
  const door = DOORS.find((d) => d.leads === id);
  check(!!door, `a compound door leads into the ${id}`);
  if (!door) continue;
  const back = roomBack(id);
  check(back.startAt === `${id}-door` && back.label === "Compound", `the ${id}'s back goes out of its own door ("${back.label}", ${back.startAt})`);
  const [x, z, yaw] = outOfDoor(id);
  check(Math.abs(x - door.x) < 0.01 && z > doorFront(door)[1], `back out of the ${id}: in front of its own door (${x}, ${z})`);
  check(freeAt(cgrid, x, z), `back out of the ${id}: on free forecourt ground (${x}, ${z})`);
  check(Math.abs(yaw) < 0.01, `back out of the ${id}: facing away from the building`);
  check(!!findPath(cgrid, [COMPOUND.you.x, COMPOUND.you.z], doorFront(door)), `the ${id} door can be walked to from your car`);
}
check(DOORS.every((d) => d.leads === "gym" || d.leads === "reception" || d.leads === "canteen") && new Set(DOORS.map((d) => d.leads)).size === 3, "the three doors lead to three places (gym, reception, canteen)");

// ── each room's walk grid, exactly as the place builds it (testScene.ts) ──
const gridOf = (id: RoomId) => {
  const R = id === "reception" ? RECEPTION : CANTEEN;
  const solids = [...wallSolids(id), ...roomSolids(id)];
  const b = [-R.W2, R.W2, -R.D2, R.D2];
  const g = buildGrid(b[0], b[1], b[2], b[3], 0.2, (x, z) => {
    if (x < b[0] + BODY_R || x > b[1] - BODY_R || z < b[2] + BODY_R || z > b[3] - BODY_R) return false;
    for (const [a, c, d, e] of solids) if (x > a - BODY_R && x < c + BODY_R && z > d - BODY_R && z < e + BODY_R) return false;
    return true;
  });
  return { g, R, solids };
};
const reach = (g: ReturnType<typeof buildGrid>, from: XZ, to: XZ, name: string) => {
  const p = findPath(g, from, to);
  check(!!p, `${name} can be walked to`);
  // findPath snaps the last bit to a free cell; the walker finishes to the exact point when it is within 0.8 m (npc.ts plan)
  if (p && p.length) { const l = p[p.length - 1]; check(Math.hypot(l[0] - to[0], l[1] - to[1]) < 0.8, `${name}: the path ends within 0.8 m of it (${Math.hypot(l[0] - to[0], l[1] - to[1]).toFixed(2)})`); }
};
{
  const { g, R } = gridOf("reception");
  const start: XZ = [R.you.x, R.you.z];
  check(freeAt(g, start[0], start[1]), "reception: you start on free floor");
  check(start[1] < R.D2 && start[1] > R.D2 - 2.5, "reception: you start a step or two in from the door");
  reach(g, start, RECEPTION.talk, "reception: the desk (to talk to the receptionist)");
  reach(g, start, [RECEPTION.cabinet.x1 + 0.85, 0], "reception: the trophy cabinet");
  reach(g, start, [4.45, RECEPTION.screen.z], "reception: the fixture screen");
  for (let k = 0; k < RECEPTION.sofa.seats; k++) reach(g, start, [RECEPTION.sofa.at[0] + SIT_STEP, RECEPTION.sofa.at[1] + (k - 1) * RECEPTION.sofa.spacing], `reception: the sofa's seat ${k + 1}`);
  // the receptionist stands behind the desk, the desk between you and him; you never walk round to him
  const [cx, cz] = RECEPTION.clerk.at;
  check(cz < RECEPTION.desk.z0 && cx > RECEPTION.desk.x0 && cx < RECEPTION.desk.x1, "reception: the receptionist is behind the desk");
  check(!findPath(g, start, [cx, cz]) || (() => { const p = findPath(g, start, [cx, cz])!; const l = p[p.length - 1]; return Math.hypot(l[0] - cx, l[1] - cz) > 0.8; })(), "reception: nobody walks round behind the desk");
}
const chairs = canteenChairs();
{
  const { g, R } = gridOf("canteen");
  const start: XZ = [R.you.x, R.you.z];
  check(freeAt(g, start[0], start[1]), "canteen: you start on free floor");
  reach(g, start, CANTEEN.serve, "canteen: the counter (the lunch card)");
  const byId = new Map(chairs.map((c) => [c.id, c]));
  for (const ms of MATE_SEATS) {
    const c = byId.get(ms.you);
    check(!!c && !!byId.get(ms.mate), `canteen: ${ms.mate} and ${ms.you} are real chairs`);
    if (!c) continue;
    const h = hipsOn(c), f = c.facing === 0 ? 1 : -1;
    reach(g, start, [h[0], h[1] + f * SIT_STEP], `canteen: the chair beside a team-mate (${ms.you})`);
  }
  // the chef is behind the counter, the counter between you and him
  check(CANTEEN.chef.at[1] < CANTEEN.counter.z0, "canteen: the chef is behind the counter");
}

// ── the seats are spaced, the mates' never yours, the knees clear the table ──
const allSeats = chairs.map((c) => hipsOn(c));
let closest = Infinity;
for (let i = 0; i < allSeats.length; i++) for (let j = i + 1; j < allSeats.length; j++) closest = Math.min(closest, Math.hypot(allSeats[i][0] - allSeats[j][0], allSeats[i][1] - allSeats[j][1]));
check(closest >= 2 * BODY_R + 0.25, `canteen: every two sitters at least ${(2 * BODY_R + 0.25).toFixed(2)} m apart (closest ${closest.toFixed(2)})`);
check(new Set(MATE_SEATS.flatMap((m) => [m.mate, m.you])).size === MATE_SEATS.length * 2, "canteen: no chair is both a team-mate's and yours");
check(MATE_SEATS.length === 3, "canteen: three team-mates eating (the lunch card's three)");
for (const c of chairs) {
  const [, tz] = CANTEEN.tables[c.table];
  const hips = hipsOn(c);
  const edge = Math.abs(hips[1] - tz) - CANTEEN.tableD2;
  // hips to the table's edge: the seat's front (CHAIR_FRONT) and a bent knee (about 0.25 m past it) stay outside it
  check(edge > CHAIR_FRONT + 0.15, `canteen: ${c.id}'s knees clear the table (hips ${edge.toFixed(2)} m from its edge)`);
  check(Math.abs(hips[1] - tz) - CANTEEN.tableD2 - SIT_STEP > 0.15, `canteen: ${c.id}: standing to sit, he is clear of the table`);
}

// ── lunch is the lunch card's, not a copy ──
const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const career: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
career.squad = generateSquad(7);
const info = roomInfo(career);
check(JSON.stringify(info.mates.map((m) => m.id)) === JSON.stringify(lunchMates(career, 3).map((m) => m.id)), "canteen: the three at the tables are lunchMates' three, in its order");
check(info.hall.kind === hallOf(career).kind && info.hall.title === hallOf(career).title, `canteen: its hall is hallOf's (${info.hall.kind})`);
check(info.hall.menu.every(([p, food]) => hallOf(career).food[p as "protein"] === food), "canteen: the menu board shows hallOf's own food");
check(hasChef("chef") && hasChef("canteen") && !hasChef("counter") && !hasChef("urn"), "canteen: a chef at the top two levels, a tea urn below");
for (const [div, kind] of [["premier", "chef"], ["championship", "canteen"], ["league_one", "counter"], ["national_league", "urn"]] as const) {
  check(roomInfo({ ...career, division: div }).hall.kind === kind, `canteen: ${div} → ${kind}`);
}
const src = ["lib/star/world3d/roomsPlan.ts", "lib/star/world3d/roomsPlace.ts"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
check(!/PLATE_EFFECT|eatLunch\(|longLunch\(|lunchChat\(|HOUSE_ENERGY_CAP/.test(src), "canteen: no lunch rule in the room's files (the lunch card owns them)");
const w3 = fs.readFileSync("components/star/World3D.tsx", "utf8");
check(/import LunchCard from "\.\/LunchCard"/.test(w3) && /<LunchCard /.test(w3), "canteen: the page shows the lunch card itself (components/star/LunchCard.tsx)");
const scene = fs.readFileSync("lib/star/world3d/testScene.ts", "utf8");
check(/cb\.onLunch\(\{ at: "counter" \}\)/.test(scene) && /cb\.onLunch\(\{ at: "table", mate:/.test(scene), "canteen: the counter and a team-mate's chair open the lunch card");
check(RECEPTIONIST.name !== CHEF.name && RECEPTIONIST.id !== CHEF.id, "the receptionist and the chef are two people");

// ── the receptionist's line is the career clock's ──
const nx = nextMatchInfo(career);
check(!!nx, "the test career has a next match");
if (nx) {
  check(info.desk[0].includes(nx.f.opponent) && info.desk[0].includes(hhmm(nx.ko)), `reception: the line names the next match and its kick-off ("${info.desk[0]}")`);
  check(info.desk[1].includes(hhmm(nx.leave)), `reception: the line says when you leave ("${info.desk[1]}")`);
  check(info.screen.lines.join(" ").includes(nx.f.opponent), "reception: the screen shows the next match");
  const later = passTime(career, LUNCH_FROM - clockOf(career).m);
  check(roomInfo(later).clock === clockOf(later).m, "the rooms' clock is the career's");
}
check(roomInfo({ ...career, trophies: [{ season: 1, competition: "FA Cup", club: "Arsenal" }] }).trophies[0]?.includes("FA Cup"), "reception: the cabinet lists the career's trophies");

// ── speed: inside the club gym's own frame ──
check(ROOMS_MEASURED.length >= 6, `the rooms are measured (${ROOMS_MEASURED.length} views)`);
for (const m of ROOMS_MEASURED) {
  if (m.room === "gym") continue;
  check(m.draws <= GYM_FRAME.draws, `${m.room} ${m.view}: ${m.draws} draws (the gym's ${GYM_FRAME.draws})`);
  check(m.triangles <= GYM_FRAME.triangles, `${m.room} ${m.view}: ${m.triangles} triangles (the gym's ${GYM_FRAME.triangles})`);
}
const gymM = ROOMS_MEASURED.filter((m) => m.room === "gym");
check(gymM.length > 0 && Math.max(...gymM.map((m) => m.draws)) <= GYM_FRAME.draws && Math.max(...gymM.map((m) => m.triangles)) <= GYM_FRAME.triangles, "the gym's own frame is what was measured");

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`✓ compound rooms: doors in and out, both rooms walkable, ${chairs.length} chairs spaced (closest ${closest.toFixed(2)} m), lunch is the lunch card's, the desk reads the clock, ${ROOMS_MEASURED.length} views inside the gym's frame`);
