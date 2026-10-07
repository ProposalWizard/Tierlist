// The ratings revamp (Mikey, 6 Oct 2026): his minutes table, his values, and how a chance is graded.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { fairRating, regressForMinutes } from "../../lib/star/matchStats.ts";
import { goalZone, passGrade, missKind } from "../../lib/star/chanceRating.ts";

let fail = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fail++; console.log("  ✗ " + what); } };
const r1 = (n: number) => Math.round(n * 10) / 10;

// Minutes: exactly Mikey's table.
const table: [number, number, number][] = [[90, 8.0, 5.0], [60, 7.8, 5.0], [45, 7.7, 5.4], [20, 7.6, 5.9]];
for (const [m, good, bad] of table) {
  check(r1(regressForMinutes(8, m)) === good, `8.0 over ${m}' → ${good} (got ${r1(regressForMinutes(8, m))})`);
  check(r1(regressForMinutes(5, m)) === bad, `5.0 over ${m}' → ${bad} (got ${r1(regressForMinutes(5, m))})`);
}
// Every minute in between moves smoothly, and never the wrong way.
let prevG = 99, prevB = -99;
for (let m = 1; m <= 90; m++) {
  const gm = regressForMinutes(8, m), bm = regressForMinutes(5, m);
  check(gm >= 6.5 && gm <= 8 && gm >= prevG - 1e-9 || m === 1, `good game never drops as minutes rise (${m}')`);
  check(bm <= 6.5 && bm >= 5 && bm <= prevB + 1e-9 || m === 1, `bad game never improves as minutes rise (${m}')`);
  prevG = gm; prevB = bm;
}
check(regressForMinutes(6.5, 14) === 6.5, "6.5 stays 6.5");

// Values.
const base = { goals: 0, assists: 0, passes: 0, dribbles: 0, misses: 0, lost: 0 };
const draw = (t: Partial<typeof base> & Record<string, number>) => r1(fairRating({ ...base, ...t }, 0, 0).rating * 100) / 100;
const v = (t: Partial<typeof base> & Record<string, number>) => Math.round((fairRating({ ...base, ...t }, 0, 0).rating - 6.1) * 100) / 100;
check(v({ passes: 1 }) === 0.15, "a medium pass is +0.15");
check(v({ passes: 1, passesSafe: 1 }) === 0.10 && v({ passes: 1, passesAmb: 1 }) === 0.25, "safe +0.10, ambitious +0.25");
check(v({ lost: 1 }) === -0.30, "a lost ball is −0.30");
check(v({ misses: 1 }) === -0.35 && v({ misses: 1, missesOn: 1 }) === -0.20, "off target −0.35, saved/post −0.20");
check(v({ misses: 1, misses1v1: 1 }) === -0.75, "a one-on-one not scored is −0.75");
check(v({ misses: 1, missesPen: 1 }) === -0.72 && v({ goals: 1, goalsPen: 1 }) === 0.72, "penalty ±0.72");
check(v({ goals: 1 }) === 1.0 && v({ goals: 1, goalsOut: 1 }) === 1.25 && v({ goals: 1, goalsTap: 1 }) === 0.85, "box +1.0, outside +1.25, tap-in +0.85");
check(v({ misses: 30 }) === -4, "costs still cap at 4.0");
void draw;

// Grading.
check(goalZone("penalty", { x: 34, y: 11 }) === "penalty", "a penalty is a penalty");
check(goalZone("one_on_one", { x: 34, y: 4 }) === "tapIn", "inside the six-yard box is a tap-in");
check(goalZone("one_on_one", { x: 34, y: 12 }) === "box", "inside the box");
check(goalZone("one_on_one", { x: 34, y: 22 }) === "outside" && goalZone("one_on_one", { x: 5, y: 10 }) === "outside", "outside the box (in front, and wide)");
check(passGrade(0.1, 0) === "safe" && passGrade(0.5, 0) === "medium" && passGrade(0.2, 0.9) === "ambitious", "pass grades read the braver of the two numbers");
check(missKind("one_on_one", "wide") === "oneOnOne" && missKind("penalty", "saved") === "penalty", "a one-on-one or penalty counts as that, however it misses");
check(missKind("cutback", "saved") === "on" && missKind("cutback", "post") === "on" && missKind("cutback", "wide") === "off" && missKind("cutback", "over") === "off", "saved/post on, wide/over off");

if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log("PASS — ratings revamp: minutes table, values and grading");
