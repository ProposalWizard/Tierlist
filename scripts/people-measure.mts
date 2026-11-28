/**
 * The frame meter's cost of the house's routines (plan phase 2, speed): the pure part of each frame
 * (world3d/houseLife.ts stepGuests: whereAt per visitor, the day plan once a day / every 2 s) and the
 * planner itself. Run: npx tsx scripts/people-measure.mts
 */
import { dayPlan } from "../lib/star/life/dayPlan";
import { whereAt } from "../lib/star/life/houseRoutines";
import { roomsFor } from "../lib/star/home3d/homes";

const mates = [{ id: "m1", name: "Kyle" }, { id: "m2", name: "Den" }, { id: "m3", name: "Rico" }, { id: "m4", name: "Sol" }];
const inp = (d: number) => ({ tier: "estate" as const, rooms: roomsFor("estate", "new", true), mates, dayNo: d, dow: 1, matchKo: null, seed: "measure", invite: { at: 18 * 60, mateId: "m1", yes: true } });

// the planner: once a day, and every 2 s for invites
let t0 = performance.now();
const N = 2000;
for (let d = 0; d < N; d++) dayPlan(inp(d));
const planMs = (performance.now() - t0) / N;

// a frame: whereAt for every visitor of a busy estate day (chef x2, cleaner, a mate), 60 fps for 10 game hours at 1 min / 6 s
const plan = dayPlan({ ...inp(5), dow: 1 });
const frames = 60 * 6 * 60 * 10;
t0 = performance.now();
let k = 0;
for (let f = 0; f < frames; f++) {
  const m = 9 * 60 + f / (60 * 6);
  for (const v of plan) if (whereAt(v.steps, m)) k++;
}
const frameMs = (performance.now() - t0) / frames;
console.log(`visitors on the day: ${plan.length} (${plan.map((v) => v.who).join(", ")}); steps ${plan.reduce((a, v) => a + v.steps.length, 0)}`);
console.log(`day planner: ${planMs.toFixed(3)} ms per call (once a day + every 2 s)`);
console.log(`routines per frame (pure): ${(frameMs * 1000).toFixed(2)} µs (${k} present-visitor checks)`);
console.log(`share of a 16.7 ms frame: ${(100 * (frameMs + planMs / 120) / 16.7).toFixed(4)}%`);
