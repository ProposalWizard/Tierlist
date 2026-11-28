/**
 * LUNCH AT THE TRAINING GROUND (lib/star/life/lunch.ts; the food hall, phase 1): lunch opens at 12:30 and shuts
 * at 14:00; one plate a day (a second does nothing); pasta +3 energy and the treat mood +1 come out of the house's
 * +3-a-day caps; protein ×1.1 and balanced ×1.05 on the gym, with the shake never past ×1.2 together; the gym part
 * is for the session after lunch only (tomorrow it is gone); the short chat is free, the long lunch costs one of
 * the week's 3 things and moves his bond; club size changes only the words; an old save loads; the save is small.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { absOf, clockOf, passTime, sleepClock, leaveAt } from "../../lib/star/life/clock";
import { applyThing, HOUSE_ENERGY_CAP, HOUSE_MOOD_CAP, moodOf } from "../../lib/star/life/houseActs";
import {
  eatLunch, lunchStatus, lunchToday, lunchGymLift, waitForLunch, lunchMates, lunchChat, longLunch, tableBlocked, hallOf,
  PLATES, PLATE_EFFECT, LUNCH_FROM, LUNCH_UNTIL, EAT_MINS, LONG_LUNCH_MINS,
} from "../../lib/star/life/lunch";
import { doExercise, gymExercise, fuelMult, newGym, takeProtein, gapOf, FUEL_CEILING, MACHINE_POINTS } from "../../lib/star/gym/progress";
import { loadCareerFromStoredForm } from "../../lib/star/storage";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const made: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 60 };
// a quiet day before the match: day 0 at 09:00 (the match is the next afternoon)
const morning = (c: CareerState): CareerState => { const s = clockOf(c); return { ...c, clock: { ...s, d: 0, m: 9 * 60 } }; };
const base = morning(made);
check(leaveAt(base) > absOf(clockOf(base)) + 600, "the test day is not a match day");
const atLunch = waitForLunch(base);

// ── the time gate ──
check(lunchStatus(base) === "early", `09:00: ${lunchStatus(base)}`);
check(eatLunch(base, "pasta").career === base, "before 12:30 a plate does nothing");
check(clockOf(atLunch).m === LUNCH_FROM && lunchStatus(atLunch) === "open", `wait for lunch → ${clockOf(atLunch).m}`);
const after = { ...atLunch, clock: { ...clockOf(atLunch), m: LUNCH_UNTIL } };
check(lunchStatus(after) === "over" && eatLunch(after, "pasta").career === after, "14:00: lunch is over");
const nearLeave = passTime(base, leaveAt(base) - absOf(clockOf(base)));
check(lunchStatus(nearLeave) === "match", `at time to leave: ${lunchStatus(nearLeave)}`);

// ── each plate ──
for (const p of PLATES) {
  const r = eatLunch(atLunch, p);
  const e = PLATE_EFFECT[p];
  check(r.energy === e.energy && r.career.energy === 60 + e.energy, `${p}: energy +${r.energy} (want +${e.energy})`);
  check(r.mood === e.mood && moodOf(r.career) === e.mood, `${p}: mood +${r.mood}`);
  check(lunchGymLift(r.career) === e.gym, `${p}: gym ×${lunchGymLift(r.career)}`);
  check(lunchToday(r.career)?.plate === p, `${p}: saved`);
  check(absOf(clockOf(r.career)) - absOf(clockOf(atLunch)) === (p === "skip" ? 0 : EAT_MINS), `${p}: clock minutes`);
  check(r.text.length > 0 && (e.energy === 0 || r.text.includes(`Energy +${e.energy}`)), `${p}: the words "${r.text}"`);
}

// ── one a day ──
const pasta = eatLunch(atLunch, "pasta");
const second = eatLunch(pasta.career, "treat");
check(second.career === pasta.career && second.energy === 0 && second.mood === 0 && /full/.test(second.text), `a second plate: "${second.text}"`);
const skipped = eatLunch(atLunch, "skip");
check(eatLunch(skipped.career, "pasta").career === skipped.career, "after skipping, no plate today");

// ── the house's caps are shared ──
const COFFEE = { energy: 1, text: "Fresh coffee. Energy +1" };
let h = atLunch;
h = applyThing(h, "coffee", COFFEE).career; h = applyThing(h, "coffee", COFFEE).career; // +2 from the house
const hp = eatLunch(h, "pasta");
check(hp.energy === HOUSE_ENERGY_CAP - 2 && hp.career.energy === 60 + HOUSE_ENERGY_CAP, `two coffees then pasta: +${hp.energy} (cap ${HOUSE_ENERGY_CAP})`);
const afterPasta = applyThing(pasta.career, "fridge", { energy: 1, text: "Cold. Energy +1" });
check(afterPasta.energy === 0, "pasta then the fridge: the cap is used up");
const BATH = { mood: 1, text: "Soak. Mood +1" };
let m = atLunch;
for (const id of ["bath", "darts", "arcade"]) m = applyThing(m, id, BATH).career;
const mt = eatLunch(m, "treat");
check(mt.mood === 0 && moodOf(mt.career) === HOUSE_MOOD_CAP, `three mood things then a treat: +${mt.mood} (cap ${HOUSE_MOOD_CAP})`);

// ── the gym ceiling: never past ×1.2 ──
for (const shake of [false, true]) for (const p of PLATES) {
  const f = fuelMult(shake, PLATE_EFFECT[p].gym);
  check(f <= FUEL_CEILING + 1e-9, `shake ${shake} + ${p}: ×${f}`);
}
check(fuelMult(false, 1.1) === 1.1 && fuelMult(true, 1.1) === 1.2 && fuelMult(true, 1) === 1.2, "×1.1 alone; with the shake ×1.2, not ×1.32");
const gap = gapOf(made);
const pts = (o: { plate?: number; shake?: boolean }) => {
  const g = o.shake ? takeProtein(newGym(), gap) : newGym();
  // a warm window (a visit last gap) so the sum is exact
  const warm = { ...g, last: { season: gap.season, week: gap.week } };
  return doExercise(warm, gap, { kind: "bench", quality: 1 }, { plate: o.plate }).gained;
};
check(pts({}) === MACHINE_POINTS && pts({ plate: 1.1 }) === Math.round(MACHINE_POINTS * 1.1) && pts({ plate: 1.1, shake: true }) === Math.round(MACHINE_POINTS * 1.2), `bench points: ${pts({})}, protein ${pts({ plate: 1.1 })}, protein + shake ${pts({ plate: 1.1, shake: true })}`);
// through the career: the plate is read from the save
const prot = eatLunch(atLunch, "protein").career;
const gNone = gymExercise({ ...atLunch, gym: { ...newGym(), last: gap } }, { kind: "bench", quality: 1 }, "off");
const gProt = gymExercise({ ...prot, gym: { ...newGym(), last: gap } }, { kind: "bench", quality: 1 }, "off");
check(gProt.out.gained === Math.round(gNone.out.gained * 1.1), `career gym: plain ${gNone.out.gained}, after protein ${gProt.out.gained}`);

// ── next session only: tomorrow it is gone ──
const tomorrow = sleepClock(prot);
check(lunchGymLift(tomorrow) === 1 && lunchToday(tomorrow) === null, "the next day: no lift, no plate");
check(lunchStatus(waitForLunch(tomorrow)) === "open" && eatLunch(waitForLunch(tomorrow), "pasta").energy > 0 || lunchStatus(tomorrow) === "match", "the next day: a new plate");

// ── the table ──
const mates = lunchMates(pasta.career);
check(mates.length === 3 && mates.every((x) => made.squad.some((s) => s.id === x.id)), `three real team-mates: ${mates.map((x) => x.short).join(", ")}`);
check(JSON.stringify(lunchMates(pasta.career)) === JSON.stringify(mates), "the same team-mates all day");
check(tableBlocked(atLunch, "chat") === "Pick a plate first", "no plate: sit after you pick one");
const ch = lunchChat(pasta.career, mates[0])!;
check(!!ch && ch.line.includes(mates[0].short) && ch.career.weekActions === pasta.career.weekActions && ch.career.relationships.team === pasta.career.relationships.team && JSON.stringify(ch.career.life ?? null) === JSON.stringify(pasta.career.life ?? null), "the chat is free and changes nothing else");
check(lunchChat(ch.career, mates[1]) === null, "one chat a day");
const before = ch.career.weekActions ?? 3;
const ll = longLunch(ch.career, mates[0])!;
check(!!ll && (ll.career.weekActions ?? 3) === before - 1, `the long lunch: one of the week's things (${before} → ${ll.career.weekActions})`);
check(ll.bond > 0 && ll.bond <= 4 && (ll.career.life?.people[mates[0].id]?.b ?? 0) > 30, `his bond +${ll.bond}`);
check(absOf(clockOf(ll.career)) - absOf(clockOf(ch.career)) === LONG_LUNCH_MINS, "the long lunch takes 45 minutes");
check(longLunch(ll.career, mates[1]) === null, "one long lunch a day");
check(longLunch({ ...ch.career, weekActions: 0 }, mates[0]) === null && /3 things/.test(tableBlocked({ ...ch.career, weekActions: 0 }, "long") ?? ""), "no week things left: no long lunch");
check(lunchToday(ll.career)?.plate === "pasta" && lunchToday(ll.career)?.chatted && lunchToday(ll.career)?.long, "the plate survives the table");

// ── club size: words only ──
const kinds = (["premier", "championship", "league_one", "national_league_north"] as const).map((d) => hallOf({ division: d }).kind);
check(kinds.join() === "chef,canteen,counter,urn", `halls: ${kinds.join()}`);

// ── the save: small; old saves ──
const lu = clockOf(ll.career).lu!;
check(String(lu).length <= 5, `lunch in the save: ${lu} (${String(lu).length} bytes)`);
const old = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
delete old.clock;
const loaded = loadCareerFromStoredForm(old)!;
check(!!loaded && lunchToday(loaded) === null && lunchGymLift(loaded) === 1, "an old save (no clock): no lunch yet, no lift");
const oldAtLunch = waitForLunch(loaded);
check(lunchStatus(loaded) === "match" || lunchStatus(oldAtLunch) !== "early", "an old save can go to lunch");
// a new gap (after a match) drops the plate
const played = { ...prot, fixtures: prot.fixtures.map((f, i) => (i === 0 ? { ...f, played: true } : f)) };
check(lunchToday(played) === null && lunchGymLift(played) === 1, "after the next match the plate is gone");

if (problems.length) {
  console.error(`lunch: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`lunch: ok (12:30 to 14:00; one plate a day; caps shared +${HOUSE_ENERGY_CAP}/+${HOUSE_MOOD_CAP}; gym ×1.1 / ×1.05, never past ×${FUEL_CEILING}; next session only; chat free, long lunch 1 thing, bond +${ll.bond}; save "${lu}")`);
