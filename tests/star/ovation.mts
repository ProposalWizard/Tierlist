import { ovationPlan, youAt, greetWeight, cameraAngle, greetingCaption, OVATION, type OvationPerson } from "../../lib/star/ovation";

/** The standing ovation's timeline (Mikey's farewell playtest, 8 Oct 2026). */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const mates: OvationPerson[] = [{ id: "m1", name: "Palmer", team: "ours" }, { id: "m2", name: "Caicedo", team: "ours" }];
const rivals: OvationPerson[] = [{ id: "r1", name: "Mbappé", team: "rivals" }, { id: "r2", name: "Saka", team: "rivals" }];
const sub: OvationPerson = { id: "s", name: "Delap", team: "ours" };

const plan = ovationPlan(mates, rivals, sub);
check(plan.stops.length === 5, `two team-mates, two rivals and the sub stop you (${plan.stops.length})`);
check(plan.stops.map(s => s.who.team).join() === "ours,rivals,ours,rivals,ours", "team-mate, rival, team-mate, rival, then the sub");
check(plan.stops[4].sub && plan.stops[4].kind === "hug", "the substitute hugs you on the line");
check(plan.stops.some(s => s.kind === "dap") && plan.stops.some(s => s.kind === "pat") && plan.stops.some(s => s.kind === "hug" && !s.sub), "a hug, a dap-up and a pat on the way");
for (let i = 1; i < plan.stops.length; i++) {
  check(plan.stops[i].from >= plan.stops[i - 1].to, `stop ${i} starts after the one before ends`);
  check(plan.stops[i].z > plan.stops[i - 1].z, `stop ${i} is further along your path`);
}
check(plan.end > 14 && plan.end < 26, `the scene lasts 14-26 s (${plan.end.toFixed(1)})`);
check(plan.offAt < plan.end, "you cross the line before it ends");

// You never walk backwards, and you stand still at every stop.
let lastZ = -Infinity, back = 0;
for (let t = 0; t <= plan.end; t += 0.05) {
  const a = youAt(plan, t);
  if (a.z < lastZ - 1e-9) back++;
  lastZ = a.z;
  if (a.stop) check(Math.abs(a.z - a.stop.z) < 1e-9, `at a stop you stand where it is (t=${t.toFixed(2)})`);
}
check(back === 0, "you only ever walk towards the touchline");
check(Math.abs(youAt(plan, plan.end).z - (OVATION.lineZ + OVATION.offBy)) < 1e-6, "you finish past the touchline");
check(youAt(plan, 0).z === OVATION.startZ && !youAt(plan, 0).walking, "the scene opens with you standing in midfield");

// Greetings ease in and out; the camera goes once round.
const s0 = plan.stops[0];
check(greetWeight(s0, s0.from) === 0 && greetWeight(s0, s0.to) === 0, "a greeting starts and ends at nothing");
check(greetWeight(s0, (s0.from + s0.to) / 2) > 0.99, "a greeting is full in the middle");
const turn = cameraAngle(plan, plan.end) - cameraAngle(plan, 0);
check(Math.abs(turn - Math.PI * 2) < 1e-9, "the camera goes exactly once round you");
check(cameraAngle(plan, plan.end * 0.5) > cameraAngle(plan, plan.end * 0.25), "the camera keeps turning one way");

// Thin sides still work.
const none = ovationPlan([], [], null);
check(none.stops.length === 0 && none.end > 5, "nobody to greet: you still walk off");
const onlyRivals = ovationPlan([], rivals, null);
check(onlyRivals.stops.length === 2 && onlyRivals.stops.every(s => s.kind === "dap"), "rivals only: two dap-ups");
check(greetingCaption(plan.stops[4]).includes("Delap"), "the caption names the man");

if (problems.length) { console.error("FAIL ovation:\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`ovation: ok (scene ${plan.end.toFixed(1)} s, off at ${plan.offAt.toFixed(1)} s)`);
