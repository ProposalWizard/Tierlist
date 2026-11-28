/**
 * HOME GYMS BY HOUSE LEVEL (lib/star/gym/homeGym.ts). Each house level has its gym: 2, 2, 4, 6, 9, 13
 * exercises, each level holding every exercise of the one below, all of them the club gym's own games.
 *  - the room: every machine of the level, its stand spot and the way in fit inside its walls, with room
 *    to walk; a mirror on the villa and the estate only; the sauna door on the estate only;
 *  - the save: an exercise at home is the club gym's own numbers (career.gym): a machine done at the club
 *    is done at home too (and the other way), the visit's ring of three is shared, the gap's cap is shared;
 *  - the effect flag: OFF, exactly as the club gym (no energy, Power, Pace, week action);
 *  - the clock: a home exercise costs its minutes (life/houseActs.ts GYM_MINS), never past time to leave;
 *    the club gym's exercise costs none;
 *  - back routes: Training → Training, the house → the house, the compound → the compound.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { HOME_GYMS, MACHINE_FOOT, homeGymKinds, homeGymOf, homeGymStart, homeGymExercise, gymBack } from "../../lib/star/gym/homeGym";
import { gymExercise, gymOf, GYM_CAREER_EFFECT } from "../../lib/star/gym/progress";
import { GYM_GAME_KINDS } from "../../lib/star/gym/games";
import { GYM_MINS } from "../../lib/star/life/houseActs";
import { absOf, clockOf, leaveAt, passTime } from "../../lib/star/life/clock";
import { HOME_TIERS } from "../../lib/star/home3d/homes";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── which exercises each level has ──
const COUNTS = { starter: 2, flat: 2, penthouse: 4, house: 6, villa: 9, estate: 13 } as const;
let prev: string[] = [];
for (const t of HOME_TIERS) {
  const k = homeGymKinds(t);
  check(k.length === COUNTS[t], `${t}: ${COUNTS[t]} exercises (${k.length})`);
  check(new Set(k).size === k.length, `${t}: no exercise twice`);
  check(prev.every((x) => k.includes(x as never)), `${t}: holds every exercise of the level below`);
  check(k.every((x) => GYM_GAME_KINDS.includes(x)), `${t}: only the club gym's own games`);
  prev = k;
}
check(homeGymKinds("estate").length === GYM_GAME_KINDS.length, "the estate has every exercise the club gym has");
check(homeGymKinds("starter").join() === "pushup,plank", "the starter's corner: push-ups and the plank (a mat and dumbbells)");
check(["bench", "treadmill"].every((k) => homeGymKinds("penthouse").includes(k as never)), "the penthouse: a bench and cardio");
check(["squat", "pullup"].every((k) => homeGymKinds("house").includes(k as never)), "the house's garage: the rack and the pull-up bar");

// ── each room fits its machines ──
const WALK = 0.05; // kit may stand by a wall (the club gym's rack and pull-up bar do); each footprint already holds its stand spot and a body's room
for (const t of HOME_TIERS) {
  const p = homeGymOf(t);
  const [x0, x1, z0, z1] = p.box;
  check(x1 - x0 >= 3.5 && z1 - z0 >= 3, `${t}: the room is at least 3.5 × 3 m (${(x1 - x0).toFixed(1)} × ${(z1 - z0).toFixed(1)})`);
  for (const k of p.kinds) {
    const [a, b, c, d] = MACHINE_FOOT[k];
    check(a >= x0 + WALK && b <= x1 - WALK && c >= z0 + WALK && d <= z1 - 0.2, `${t}: the ${k} kit and its spot fit inside the walls`);
  }
  const s = homeGymStart(t);
  check(s.x > x0 + 0.5 && s.x < x1 - 0.5 && s.z > z0 && s.z < z1 - 0.4, `${t}: you walk in just inside the door`);
  check(p.doorX - 0.62 > x0 && p.doorX + 0.62 < x1, `${t}: the doorway is in the south wall`);
  // the way in is clear: the start spot is in no machine's footprint
  check(p.kinds.every((k) => { const [a, b, c, d] = MACHINE_FOOT[k]; return !(s.x > a && s.x < b && s.z > c && s.z < d); }), `${t}: nothing stands in the doorway`);
  if (p.rack) check(p.rack[0] >= z0 + 0.3 && p.rack[1] <= z1 - 0.8, `${t}: the dumbbell rack fits the west wall`);
}
// the rooms grow with the house
const area = (t: (typeof HOME_TIERS)[number]) => { const [a, b, c, d] = homeGymOf(t).box; return (b - a) * (d - c); };
for (let i = 1; i < HOME_TIERS.length; i++) check(area(HOME_TIERS[i]) >= area(HOME_TIERS[i - 1]), `${HOME_TIERS[i]}'s gym is no smaller than ${HOME_TIERS[i - 1]}'s`);
check(HOME_TIERS.filter((t) => HOME_GYMS[t].mirror).join() === "villa,estate", "a mirror wall on the villa and the estate only");
check(HOME_TIERS.filter((t) => HOME_GYMS[t].sauna).join() === "estate", "a sauna door on the estate only");

// ── the save: the club gym's own numbers ──
const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as CareerState["player"] as StarPlayer;
const base: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 60 };
check(GYM_CAREER_EFFECT === "off", "the gym effect is off (as the club gym)");
{
  // the same machine at the club then at home: done for this gap
  const club = gymExercise(base, { kind: "pushup", quality: 1 });
  check(club.out.gained > 0, "push-ups at the club count");
  const home = homeGymExercise(club.career, { kind: "pushup", quality: 1 });
  check(home.out.gained === 0 && home.out.why === "machineDone", `push-ups at home after the club: already done this gap (${home.out.why})`);
  // and the other way round
  const h1 = homeGymExercise(base, { kind: "plank", quality: 1 });
  const c1 = gymExercise(h1.career, { kind: "plank", quality: 1 });
  check(h1.out.gained > 0 && c1.out.why === "machineDone", "the plank at home, then at the club: already done");
  // one ring of three across both gyms
  const a = homeGymExercise(base, { kind: "pushup", quality: 1 });
  const b = gymExercise(a.career, { kind: "treadmill", quality: 1 });
  const c = homeGymExercise(b.career, { kind: "plank", quality: 1 });
  check(c.out.ringClosed, "two at home and one at the club close the one ring");
  const d = homeGymExercise(c.career, { kind: "bench", quality: 1 });
  check(d.out.gained === 0 && !!d.out.why, `a fourth exercise after the ring: nothing (${d.out.why})`);
  // the home gym saves to career.gym, the same field
  check(gymOf(c.career).ring?.done && Object.keys(gymOf(c.career).ring!.done).length === 3, "the ring's three are in career.gym");
  // the effect off: nothing else moves
  check(c.career.energy === base.energy && c.career.weekActions === base.weekActions && c.career.skills?.power === base.skills?.power && c.career.skills?.pace === base.skills?.pace,
    "effect off: no energy, no week action, no Power or Pace from the home gym");
}

// ── the clock ──
{
  const t0 = absOf(clockOf(base));
  const h = homeGymExercise(base, { kind: "treadmill", quality: 1 });
  check(absOf(clockOf(h.career)) - t0 === GYM_MINS.treadmill && h.mins === GYM_MINS.treadmill, `a home run costs ${GYM_MINS.treadmill} minutes (${h.mins})`);
  check(/minutes later/.test(h.sub) && h.out.words.includes(h.sub), `its card says so ("${h.out.words}")`);
  const club = gymExercise(base, { kind: "treadmill", quality: 1 });
  check(absOf(clockOf(club.career)) === t0, "the club gym costs no clock minutes");
  for (const k of GYM_GAME_KINDS) check((GYM_MINS[k] ?? 0) >= 10 && (GYM_MINS[k] ?? 0) <= 30, `${k}: 10 to 30 minutes`);
  // never past time to leave for a match
  const late = passTime(base, leaveAt(base) - t0 - 5);
  const lh = homeGymExercise(late, { kind: "bench", quality: 1 });
  check(absOf(clockOf(lh.career)) <= leaveAt(base) && lh.mins <= 5, `five minutes before time to leave: the set stops the clock there (${lh.mins})`);
  const at = homeGymExercise(lh.career, { kind: "squat", quality: 1 });
  check(at.mins === 0 && /time to leave/.test(at.sub), `at time to leave: no minutes pass ("${at.sub}")`);
}

// ── back routes ──
check(gymBack("training").to === "skills" && gymBack("training").label === "Training", "from Training: back to Training");
check(gymBack("home").to === "home-3d" && gymBack("home").label === "House", "from the house: back to the house");

if (problems.length) {
  console.error(`homeGym: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("homeGym: 2/2/4/6/9/13 exercises by house level, every machine inside its room, the club gym's own numbers and limits, the effect off, home minutes on the clock, back routes — all OK");
