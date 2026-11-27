/**
 * SLEEPING IN YOUR HOUSE (lib/star/home3d/sleep.ts): a night in your bed is the week's Rest, once
 * per gap between matches. It changes the career exactly as Rest does (energy back, one of the
 * week's things spent), never more, never twice in one gap, never past 100, never with nothing left;
 * it never moves the season (no fixture played or skipped). An old save without the new field loads
 * and can sleep.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { rest, actionsLeft } from "../../lib/star/week";
import { sleepNight, sleptThisWeek } from "../../lib/star/home3d/sleep";
import { loadCareerFromStoredForm } from "../../lib/star/storage";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const base: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 60 };

// ── one night: exactly the week's Rest ──
const a = sleepNight(base);
const r = rest(base);
check(a.rested && a.why === "rested", "a first night in the gap rests you");
check(a.career.energy === r.energy && a.career.energy > base.energy, `energy as Rest gives (${base.energy} → ${a.career.energy}, Rest ${r.energy})`);
check(actionsLeft(a.career) === actionsLeft(base) - 1, "it spends one of the week's things, as Rest does");
check(a.gained === a.career.energy - base.energy && a.text.includes(`${base.energy} → ${a.career.energy}`), "the card says what it gave");
check(sleptThisWeek(a.career) && !sleptThisWeek(base), "the gap is marked slept");

// ── cannot be repeated for gain ──
const b = sleepNight(a.career);
check(!b.rested && b.why === "sleptAlready" && b.career === a.career, "a second night in the same gap changes nothing");
check(b.text.startsWith("You've already slept since the last match"), "a second night says why not");
let c = a.career;
for (let i = 0; i < 20; i++) c = sleepNight(c).career;
check(c.energy === a.career.energy && actionsLeft(c) === actionsLeft(a.career), "twenty more nights: not one point more");

// ── the season does not move ──
check(a.career.week === base.week && a.career.season === base.season, "the week and season stay where they are");
check(JSON.stringify(a.career.fixtures) === JSON.stringify(base.fixtures), "no fixture played, moved or skipped");

// ── the next gap (a match played moves the week) sleeps again ──
const nextWeek: CareerState = { ...a.career, week: a.career.week + 1, weekActions: 3 };
check(sleepNight(nextWeek).rested, "after the next match, a new night rests you again");

// ── nothing left this week / already full ──
const none = sleepNight({ ...base, weekActions: 0 });
check(!none.rested && none.why === "nothingLeft" && none.career.energy === base.energy, "nothing left to do this week: no energy");
const full = sleepNight({ ...base, energy: 100 });
check(!full.rested && full.why === "fullEnergy" && actionsLeft(full.career) === actionsLeft(base), "full energy: the week's thing is not wasted");
check(sleepNight({ ...base, energy: 97 }).career.energy <= 100, "never past 100");

// ── an old save without the field still loads, and can sleep ──
const old = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
delete old.lastSleep;
const loaded = loadCareerFromStoredForm(old);
check(!!loaded, "an old save (no lastSleep) loads");
if (loaded) {
  check(!sleptThisWeek(loaded), "an old save has not slept yet");
  check(sleepNight(loaded).rested, "an old save can sleep");
}

if (problems.length) {
  console.error(`houseSleep: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`houseSleep: ok (one night = Rest: ${base.energy} → ${a.career.energy}, once per gap between matches)`);
