/**
 * THINGS IN THE HOUSE DO SOMETHING (lib/star/life/houseActs.ts; plan phase 3): using a thing moves
 * the clock by its minutes and gives real energy (career.energy) or mood within the day's caps: at
 * most +3 energy and +3 mood a day from the house, coffee's 3rd cup gives nothing and the 5th makes
 * you jittery, a second go at the same thing gives nothing more that day, a new day resets the caps,
 * the mood drifts back to 0, energy never passes 100, a thing never moves the clock past time to
 * leave, and the card's words say what really happened (never "Energy +1" when it gave nothing).
 * The economy check: a week of farming every thing every day adds at most 3 energy a day.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { applyThing, moodOf, plainWords, HOUSE_ENERGY_CAP, HOUSE_MOOD_CAP, ACT_MINS } from "../../lib/star/life/houseActs";
import { absOf, clockOf, sleepClock, leaveAt, passTime } from "../../lib/star/life/clock";
import { loadCareerFromStoredForm } from "../../lib/star/storage";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const base: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 60 };
const COFFEE = { energy: 1, text: "Fresh coffee. Energy +1" };
const FRIDGE = { energy: 1, text: "Ice cold. Energy +1" };
const SHOWER = { energy: 1, text: "Fresh. Energy +1" };
const BATH = { mood: 1, text: "A long soak. Mood +1" };

// ── one coffee: +1 energy, 10 minutes ──
const a = applyThing(base, "coffee", COFFEE);
check(a.career.energy === 61 && a.energy === 1, `a coffee: energy 60 → ${a.career.energy}`);
check(absOf(clockOf(a.career)) === absOf(clockOf(base)) + ACT_MINS.coffee, "a coffee takes 10 minutes on the clock");
check(a.text.startsWith("Fresh coffee.") && a.text.includes("Energy +1") && a.sub.startsWith("10 minutes later · "), `the card: "${a.text}" / "${a.sub}"`);

// ── coffee: 3rd nothing, 5th jittery ──
let c = base;
const cups = [];
for (let i = 0; i < 5; i++) { const r = applyThing(c, "coffee", COFFEE); cups.push(r); c = r.career; }
check(cups[0].energy === 1 && cups[1].energy === 1 && cups[2].energy === 0 && cups[3].energy === 0, `coffee 1-4: ${cups.map((x) => x.energy).join(",")}`);
check(cups[4].mood === -1 && moodOf(c) === -1, "the 5th coffee: jittery, mood -1");
check(!cups[2].text.includes("Energy +1") && cups[2].text.includes("third coffee"), `the 3rd cup's card says why ("${cups[2].text}")`);

// ── the day's energy cap: +3 from the house, all things together ──
let d = base;
for (const [id, e] of [["coffee", COFFEE], ["fridge", FRIDGE], ["shower", SHOWER], ["coffee", COFFEE]] as const) d = applyThing(d, id, e).career;
check(d.energy === 60 + HOUSE_ENERGY_CAP, `four energy things in a day: +${d.energy - 60} (cap ${HOUSE_ENERGY_CAP})`);
const capped = applyThing({ ...d }, "fridge", FRIDGE);
check(capped.energy === 0 && !capped.text.includes("Energy +1"), `over the cap: nothing, and the card says so ("${capped.text}")`);

// ── a second go at the same thing: nothing more today ──
const b1 = applyThing(base, "bath", BATH), b2 = applyThing(b1.career, "bath", BATH);
check(b1.mood === 1 && b2.mood === 0 && b2.text.includes("already"), "the bath: mood +1 once a day");

// ── mood cap and drift ──
let m = base;
for (const id of ["bath", "mirror", "pool", "darts", "arcade"]) m = applyThing(m, id, { mood: 1, text: "Fun. Mood +1" }).career;
check(moodOf(m) === HOUSE_MOOD_CAP, `mood from the house in a day: ${moodOf(m)} (cap ${HOUSE_MOOD_CAP})`);
const nextDay = sleepClock(m);
check(moodOf(nextDay) === HOUSE_MOOD_CAP - 1, `the next morning the mood has drifted a point back (${moodOf(nextDay)})`);
const fresh = applyThing(nextDay, "coffee", COFFEE);
check(fresh.energy === 1, "a new day: the caps start again");

// ── a week of farming: at most +3 energy a day ──
let w = { ...base, energy: 10 };
const start = w.energy;
let days = 0;
for (let day = 0; day < 7; day++) {
  if (absOf(clockOf(w)) >= leaveAt(w)) break;
  for (let k = 0; k < 6; k++) for (const [id, e] of [["coffee", COFFEE], ["fridge", FRIDGE], ["shower", SHOWER]] as const) w = applyThing(w, id, e).career;
  days++;
  w = sleepClock(w);
}
check(w.energy - start <= HOUSE_ENERGY_CAP * days, `farming ${days} days: +${w.energy - start} energy (most ${HOUSE_ENERGY_CAP * days})`);

// ── edges ──
check(applyThing({ ...base, energy: 100 }, "coffee", COFFEE).career.energy === 100, "never past 100");
const late = passTime(base, 100 * 1440);
const lateUse = applyThing(late, "bath", BATH);
check(absOf(clockOf(lateUse.career)) === leaveAt(base) && lateUse.sub.includes("time to leave"), "at time to leave: the clock stays, the card says so");
check(plainWords("Sharp. Fitness +1") === "Sharp." && plainWords(undefined) === "Done.", "the old promise is cut from the words");
const run = applyThing(base, "treadmill", { energy: -1, mood: 1, text: "Sharp. Fitness +1" });
check(run.career.energy === 59 && run.text.includes("Energy -1") && !run.text.includes("Fitness"), `a run tires you, and says only what it did ("${run.text}")`);

// ── small on the save; old saves ──
check(JSON.stringify(d.clock).length < 90, `the day's counters are small (${JSON.stringify(d.clock).length} bytes)`);
const old = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
delete old.clock;
const loaded = loadCareerFromStoredForm(old);
check(!!loaded && applyThing(loaded!, "coffee", COFFEE).energy === 1 && moodOf(loaded!) === 0, "an old save (no clock): a coffee works, mood 0");

if (problems.length) {
  console.error(`houseActs: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`houseActs: ok (coffee +1, +1, 0, 0, jittery; +${HOUSE_ENERGY_CAP} energy and +${HOUSE_MOOD_CAP} mood a day at most; farming ${days} days +${w.energy - start}; card: "${a.text}" / "${a.sub}")`);
