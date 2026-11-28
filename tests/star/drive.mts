/**
 * THE DRIVE (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md). Pure maths of
 * lib/star/drive3d/{route,car,drive,calls,cars}.ts and the cut cars' files:
 *  1. route timing: the auto-drive takes 25-30 s gate to gate; holding is quicker; the arrival ≤ 10 s;
 *  2. auto-drive: it slows for the roundabout, never runs into the car ahead, overtakes it when clear;
 *  3. lane changes: a tap moves you across in LANE_CHANGE_S, refused (horn) with a car coming or on the roundabout;
 *  4. skip: ends the drive from the first frame within the fade;
 *  5. wheels: spin = distance / radius; the fronts steer left in a left bend, right in a right, straight on a straight;
 *  6. the arrival: the barrier is up before you reach it, you stop in the bay, the team-mates have turned, then the door cut;
 *  7. the way back ends at the fork, a choice fades out;
 *  8. calls: real words (nothing left to fill in), one drive in three, a memory per answer;
 *  9. budgets: no traffic on Low; every drive car ≤ 25k triangles, every light copy ≤ 5k, four wheel nodes each.
 */
import fs from "node:fs";
import path from "node:path";
import { buildRoute, at, LANE, DRIVE_IN, LAT_G } from "../../lib/star/drive3d/route";
import { startCar, stepCar, LANE_CHANGE_S, laneClear, wheelSpinFor, steerFor, type Traffic } from "../../lib/star/drive3d/car";
import { newDrive, stepDrive, autoDriveSeconds, skipDrive, chooseFork, answerCall, barrierLift, matesTurn, TRAFFIC_BY_TIER, STEP, INTRO_S, arrivalLine } from "../../lib/star/drive3d/drive";
import { DRIVE_CALLS, fillCall, pickCall, callMemory } from "../../lib/star/drive3d/calls";
import { DRIVE_CAR_IDS, carFile, carFromShop } from "../../lib/star/drive3d/cars";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const spec = { wheelR: 0.42, wheelbase: 2.6 };
const base = { leg: "in" as const, seed: 3, mode: "lanes" as const, spec, names: { mate: "Kai", car: "hatchback", club: "Aston Villa" } };

// 1. timing
const auto = autoDriveSeconds(base), fast = autoDriveSeconds(base, true);
check(auto >= 25 && auto <= 30, `auto-drive gate to gate 25-30 s (now ${auto.toFixed(1)})`);
check(fast < auto - 1.5, `holding is quicker (${fast.toFixed(1)} vs ${auto.toFixed(1)} s)`);
{
  const S = newDrive({ ...base, tier: "medium", call: "none" });
  let n = 0, maxV = 0, roundV = 99, ahead = 99, minGap = 99;
  while (S.phase !== "done" && n < 60 * 90) {
    stepDrive(S, { hold: false }); n++;
    maxV = Math.max(maxV, S.car.v);
    const k = at(S.route, S.car.s).kind;
    if (k === "roundabout") roundV = Math.min(roundV, S.car.v), ahead = Math.min(ahead, roundV);
    for (const c of S.traffic) if (c.dir === 1 && Math.abs(S.car.off - LANE) < 0.6 && c.s > S.car.s) minGap = Math.min(minGap, c.s - S.car.s);
    // never sideways harder than the grip it keeps
    if (S.phase === "drive") check(Math.abs(S.car.v * S.car.yawRate) < LAT_G * 1.6 + 0.5, `sideways ${(S.car.v * S.car.yawRate).toFixed(1)} m/s² at s ${S.car.s.toFixed(0)}`);
  }
  check(S.phase === "done", "the drive in finishes");
  check(roundV <= 9.5, `slows for the roundabout (${roundV.toFixed(1)} m/s)`);
  check(maxV <= 22.5, `never past the lane's 22 m/s on auto (${maxV.toFixed(1)})`);
  check(minGap > 6, `never runs into the car ahead (closest ${minGap.toFixed(1)} m)`);
  check(S.t - INTRO_S - auto < 14, `the arrival ≤ 10 s plus traffic (whole drive ${S.t.toFixed(1)} s)`);
  void ahead;
}

// 2. auto-drive overtakes the slow car on the lane (Medium has traffic)
{
  const S = newDrive({ ...base, tier: "medium", call: "none" });
  const ev: string[] = [];
  for (let n = 0; n < 60 * 60 && S.phase !== "done"; n++) { stepDrive(S, { hold: false }); ev.push(...S.car.events); }
  check(ev.includes("overtake"), `the auto-drive overtakes the learner (${ev.join(",") || "nothing"})`);
  check(ev.includes("back-in"), "and pulls back in after");
}

// 3. lane changes
{
  const R = buildRoute();
  const laneS = R.pts.find((p) => p.kind === "lane")!.s;
  const car = startCar(); car.s = laneS + 20; car.v = 18;
  stepCar(R, car, { hold: false, tap: 1 }, STEP, spec, { mode: "lanes", traffic: [] });
  check(car.events.includes("lane-right") && car.laneTo === -LANE, "a tap on the right half moves you to the other lane");
  check(car.laneDur > LANE_CHANGE_S && car.laneDur <= 2.6, `a calm change at speed (${car.laneDur.toFixed(2)} s)`);
  for (let i = 0; i < Math.ceil(car.laneDur / STEP) + 2; i++) stepCar(R, car, { hold: false }, STEP, spec, { mode: "lanes", traffic: [] });
  check(Math.abs(car.off + LANE) < 1e-6, `across in ${car.laneDur.toFixed(2)} s (off ${car.off.toFixed(2)})`);
  const coming: Traffic[] = [{ id: "x", dir: -1, s: laneS + 60, v: 15, model: "suv", paint: "#000" }];
  const c2 = startCar(); c2.s = laneS + 20; c2.v = 18;
  stepCar(R, c2, { hold: false, tap: 1 }, STEP, spec, { mode: "lanes", traffic: coming });
  check(c2.events.includes("blocked") && c2.laneTo === LANE && c2.horn > 0, "a car coming: the horn, no move");
  check(!laneClear(coming, c2.s, -LANE) && laneClear(coming, c2.s, LANE), "laneClear sees the oncoming car in the right lane only");
  const c3 = startCar(); c3.s = R.island.r ? R.pts.find((p) => p.kind === "roundabout")!.s + 5 : 0; c3.v = 8;
  stepCar(R, c3, { hold: false, tap: 1 }, STEP, spec, { mode: "lanes", traffic: [] });
  check(c3.events.includes("blocked"), "no lane change on the roundabout");
  // stick: a full push slides you across, never past a metre off the kerb
  const c4 = startCar(); c4.s = laneS + 20; c4.v = 18;
  for (let i = 0; i < 300; i++) stepCar(R, c4, { hold: false, side: -1 }, STEP, spec, { mode: "stick", traffic: [] });
  check(c4.off < -2.4 && c4.off >= -2.5 - 1e-9, `stick: right across to a metre off the far kerb (off ${c4.off.toFixed(2)})`);
}

// 4. skip from the first frame
{
  const S = newDrive({ ...base, tier: "low", call: "agent-interest" });
  skipDrive(S);
  let n = 0; while (S.phase !== "done" && n < 200) { stepDrive(S, { hold: false }); n++; }
  check(S.phase === "done" && S.skipped && n * STEP <= 0.6, `skip ends it within the fade (${(n * STEP).toFixed(2)} s)`);
}

// 5. wheels
{
  check(Math.abs(wheelSpinFor(2 * Math.PI * 0.42, 0.42) - 2 * Math.PI) < 1e-9, "one turn per circumference");
  check(steerFor(1 / 15, 2.6) > 0 && steerFor(-1 / 15, 2.6) < 0 && steerFor(0, 2.6) === 0, "steer sign follows the bend");
  const R = buildRoute();
  const car = startCar(); car.v = 10; let rolled = 0;
  let leftSteer = -1, rightSteer = 1, straightSteer = 1;
  for (let i = 0; i < 60 * 40 && car.s < R.gateS; i++) {
    const s0 = car.s;
    stepCar(R, car, { hold: false }, STEP, spec, { mode: "lanes", traffic: [] });
    rolled += car.s - s0;
    const p = at(R, car.s), ahead = at(R, car.s - 3);
    if (p.k > 0 && ahead.k > 0) leftSteer = Math.max(leftSteer, car.steer);
    if (p.k < 0 && ahead.k < 0) rightSteer = Math.min(rightSteer, car.steer);
    if (p.k === 0 && ahead.k === 0 && at(R, car.s - 12).k === 0 && p.kind === "street" && car.s > 15) straightSteer = Math.min(straightSteer, Math.abs(car.steer));
  }
  const want = (rolled / spec.wheelR) % (2 * Math.PI);
  check(Math.abs(car.spin - want) < 1e-6, `spin = distance / radius (${car.spin.toFixed(3)} vs ${want.toFixed(3)})`);
  check(leftSteer > 0.05, `fronts turn left in a left bend (${leftSteer.toFixed(3)} rad)`);
  check(rightSteer < -0.05, `fronts turn right in a right bend (${rightSteer.toFixed(3)} rad)`);
  check(straightSteer < 0.01, `straight on a straight (${straightSteer.toFixed(4)} rad)`);
}

// 6. the arrival
{
  const S = newDrive({ ...base, tier: "low", call: "none" });
  let liftAtGate = -1, turnAtStop = -1, n = 0;
  while (S.phase !== "done" && n < 60 * 90) {
    stepDrive(S, { hold: false }); n++;
    if (liftAtGate < 0 && S.car.s >= S.route.gateS - 2.5) liftAtGate = barrierLift(S);
    if (turnAtStop < 0 && S.stoppedAt >= 0) turnAtStop = matesTurn(S);
  }
  check(liftAtGate > 0.97, `the barrier is up before the car reaches it (${liftAtGate.toFixed(2)})`);
  check(S.car.s >= S.route.length - 0.06 && S.car.v < 0.05, "the car stops in its bay");
  check(turnAtStop > 0.9, `both team-mates have turned by the stop (${turnAtStop.toFixed(2)})`);
  check(S.stoppedAt > 0 && S.stoppedAt < 9, `the arrival takes under 9 s to the stop (${S.stoppedAt.toFixed(1)})`);
  check(S.fade >= 1, "it cuts to black on the door moment");
  for (const id of DRIVE_CAR_IDS) check(!/[{}]/.test(arrivalLine(id, "Kai")) && arrivalLine(id, "Kai").startsWith("Kai:"), `a line for the ${id}`);
}

// 7. the way back: the fork
{
  const S = newDrive({ ...base, leg: "back", tier: "low", call: "none" });
  let n = 0; while (S.phase === "drive" && n < 60 * 90) { stepDrive(S, { hold: false }); n++; }
  check(S.phase === "fork", `the way back ends at the fork (${S.phase}, ${S.t.toFixed(1)} s)`);
  chooseFork(S, "casino");
  n = 0; while (S.phase !== "done" && n < 200) { stepDrive(S, { hold: false }); n++; }
  check(S.phase === "done" && S.fork === "casino", "a choice fades out to it");
  check(S.route.pts[0].kind === "approach" && S.route.pts[S.route.pts.length - 2].kind === "street", "back: compound road first, your street last");
}

// 8. calls
{
  const names = { mate: "Kai", car: "hatchback", club: "Aston Villa" };
  for (const c of DRIVE_CALLS) {
    const f = fillCall(c, names);
    const all = [f.caller, ...f.lines, f.yes.label, f.yes.reply, f.yes.effect, f.no.label, f.no.reply, f.no.effect].join(" ");
    check(!/[{}]|TODO|lorem|placeholder|xxx/i.test(all), `${c.id}: no unfilled words`);
    check(f.lines.length >= 2 && f.lines.length <= 3 && f.lines.every((l) => l.length <= 70), `${c.id}: two or three short lines`);
    check(f.yes.label.length <= 22 && f.no.label.length <= 22, `${c.id}: answers fit a button`);
  }
  let rings = 0;
  for (let seed = 0; seed < 3000; seed++) if (pickCall(seed, "in")) rings++;
  check(rings > 3000 * 0.27 && rings < 3000 * 0.41, `about one drive in three rings (${(rings / 30).toFixed(1)}%)`);
  check(pickCall(5, "in")?.id === pickCall(5, "in")?.id, "same day, same call");
  check(!DRIVE_CALLS.filter((c) => c.leg === "back").some((c) => pickCall(0, "in", c.id)?.leg === "in"), "back-only calls stay on the way back");
  const S = newDrive({ ...base, tier: "low", call: "borrow-car", day: 12 });
  let n = 0; while (S.callState !== "ringing" && n < 60 * 30) { stepDrive(S, { hold: false }); n++; }
  check(S.callState === "ringing" && S.t >= 8 + INTRO_S && S.t <= 15 + INTRO_S, `the call rings 8-15 s in (${S.t.toFixed(1)})`);
  answerCall(S, "yes");
  check(S.memories.length === 1 && S.memories[0].answer === "yes" && S.memories[0].who === "Kai" && S.memories[0].day === 12, "an answer leaves one memory");
  const m = callMemory(DRIVE_CALLS[0], "missed", 3);
  check(m.answer === "missed" && m.about === DRIVE_CALLS[0].id, "a missed call is remembered too");
  const S2 = newDrive({ ...base, tier: "low", call: "agent-photo" });
  n = 0; while (S2.phase !== "done" && n < 60 * 90) { stepDrive(S2, { hold: false }); n++; }
  check(S2.callAnswer === "missed" && S2.memories.length === 1, "unanswered: a missed call");
}

// 9. budgets and files
{
  check(TRAFFIC_BY_TIER.low === 0, "no traffic on Low");
  check(newDrive({ ...base, tier: "low" }).traffic.length === 0 && newDrive({ ...base, tier: "medium" }).traffic.length === TRAFFIC_BY_TIER.medium, "traffic count by tier");
  check(carFromShop([]) === "hatch" && carFromShop(["car-2", "car-4"]) === "super", "your car: the best you own, the hatch if none");
  const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");
  for (const id of DRIVE_CAR_IDS) {
    for (const lod of [false, true]) {
      const f = path.join(root, "public", carFile(id, lod));
      if (!fs.existsSync(f)) { check(false, `${carFile(id, lod)} missing (bash tools/cars/run_all.sh)`); continue; }
      const j = glbJson(fs.readFileSync(f));
      const names = (j.nodes ?? []).map((n: any) => n.name);
      check(["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"].every((w) => names.includes(w)), `${carFile(id, lod)}: four wheel pivots`);
      let tris = 0;
      for (const m of j.meshes ?? []) for (const p of m.primitives) tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
      check(tris <= (lod ? 5000 : 25000), `${carFile(id, lod)}: ${tris} triangles (cap ${lod ? 5000 : 25000})`);
      check((j.extensionsUsed ?? []).includes("EXT_meshopt_compression"), `${carFile(id, lod)}: packed (scripts/perf3d/shrink-models.mjs)`);
    }
  }
  check(DRIVE_IN.length > 0, "route pieces");
}

function glbJson(b: Buffer): any {
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
}

if (problems.length) {
  console.error(`drive: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`drive: ok (auto ${auto.toFixed(1)} s, holding ${fast.toFixed(1)} s)`);
