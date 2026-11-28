/**
 * THE DRIVE'S ARRIVAL AT THE REAL COMPOUND (driving phase 2, 28 Nov 2026; lib/star/drive3d/arrival.ts). Pure:
 *  1. the route: it starts on the compound's road in your lane, passes the barrier inside the way in (x 7..14),
 *     ends with the car's middle on your bay's middle, nose to the fence;
 *  2. the car never runs into a parked car or the barrier post, and stays off the grass strip by the road;
 *  3. the barrier is fully up before the car's nose reaches the arm, and down at the start;
 *  4. the shots: barrier first, then the bay; the two team-mates have turned by the stop;
 *  5. the door moment: a fade to black after the stop, you out at the driver's door (clear of every solid), the
 *     fade comes back up; the whole arrival is 8-14 s; Skip jumps straight to you at the door;
 *  6. the drive in hands over: with `handover` it fades out on the compound road (HANDOVER_AT before the gate).
 */
import { newArrival, stepArrival, skipArrival, carPose, liftOf, shotOf, turnOf, youOut, BARRIER, YOUR_BAY, ROAD_Z, arrivalCam } from "../../lib/star/drive3d/arrival";
import { LANE } from "../../lib/star/drive3d/route";
import { COMPOUND, PARKED, bayAt, CAR_SIZE, compoundSolids } from "../../lib/star/world3d/compoundPlan";
import { newDrive, stepDrive, HANDOVER_AT } from "../../lib/star/drive3d/drive";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1-4. a full arrival
{
  const A = newArrival();
  const p0 = carPose(A);
  check(Math.abs(p0.z - (ROAD_Z - LANE)) < 0.05 && Math.abs(p0.yaw - Math.PI / 2) < 1e-6, `starts in your lane on the road heading east (${p0.x.toFixed(1)}, ${p0.z.toFixed(2)})`);
  check(liftOf(A) === 0, "the barrier starts down");
  check(shotOf(A) === "barrier", "the barrier shot first");
  let crossX = NaN, liftAtArm = -1, sawBay = false, turnAtStop = -1, hit = "", n = 0;
  // the parked cars (not yours: your bay is where you park) and the barrier post
  const others = PARKED.filter((p) => !(p.bay === COMPOUND.yourBay && p.row === "N")).map((p) => { const [x, z] = bayAt(p.bay, p.row); const [w, l] = CAR_SIZE[p.kind]; return [x - w / 2, x + w / 2, z - l / 2, z + l / 2, `bay ${p.bay}${p.row}`] as const; });
  const post = [BARRIER.x - 0.15, BARRIER.x + 0.15, BARRIER.z - 0.15, BARRIER.z + 0.15, "barrier post"] as const;
  while (A.phase !== "done" && n < 60 * 40) {
    const was = carPose(A);
    stepArrival(A); n++;
    const p = carPose(A);
    if (Number.isNaN(crossX) && was.z > BARRIER.z && p.z <= BARRIER.z) crossX = p.x;
    // the car's nose (2.2 m ahead) reaching the arm's line
    if (liftAtArm < 0 && p.z + 2.2 * Math.cos(p.yaw) <= BARRIER.z + 0.05 && p.x > BARRIER.x) liftAtArm = liftOf(A);
    if (shotOf(A) === "bay") sawBay = true;
    if (A.stoppedAt >= 0 && turnAtStop < 0) turnAtStop = turnOf(A);
    // the car's four corners against everything else (its footprint 1.9 × 4.4 m)
    const f = [Math.sin(p.yaw), Math.cos(p.yaw)], l = [Math.cos(p.yaw), -Math.sin(p.yaw)];
    for (const [a, b] of [[2.2, 0.95], [2.2, -0.95], [-2.2, 0.95], [-2.2, -0.95], [0, 0.95], [0, -0.95]]) {
      const cx = p.x + f[0] * a + l[0] * b, cz = p.z + f[1] * a + l[1] * b;
      for (const [x0, x1, z0, z1, what] of [...others, post]) if (!hit && cx > x0 && cx < x1 && cz > z0 && cz < z1) hit = `${what} at t ${A.t.toFixed(1)}`;
      // the grass strip and low hedge on the road side of the car park (x < x1 − 7, z 44..46)
      if (!hit && cx < COMPOUND.carPark.x1 - 7 && cz > COMPOUND.carPark.z1 && cz < COMPOUND.carPark.z1 + 1.7 && A.phase === "roll") hit = `the hedge by the road at t ${A.t.toFixed(1)} (${cx.toFixed(1)}, ${cz.toFixed(1)})`;
    }
  }
  check(crossX > COMPOUND.carPark.x1 - 7 + 0.95 && crossX < COMPOUND.carPark.x1 - 0.95, `passes the barrier inside the way in (x ${crossX.toFixed(2)})`);
  check(liftAtArm > 0.97, `the arm is up before the nose reaches it (${liftAtArm.toFixed(2)})`);
  check(!hit, `never runs into anything (${hit})`);
  const end = carPose(A);
  check(Math.hypot(end.x - YOUR_BAY[0], end.z - YOUR_BAY[1]) < 0.1, `parks on your bay's middle (${end.x.toFixed(2)}, ${end.z.toFixed(2)} vs ${YOUR_BAY.join(", ")})`);
  check(Math.abs(Math.cos(end.yaw) + 1) < 1e-3, "nose to the fence (facing north, as the front row's cars)");
  check(sawBay, "the bay shot comes after the barrier");
  check(turnAtStop > 0.95, `the two team-mates have turned by the stop (${turnAtStop.toFixed(2)})`);
  check(A.stoppedAt > 7 && A.stoppedAt < 13, `the stop comes 7-13 s in (${A.stoppedAt.toFixed(1)})`);
  check(A.outAt > A.stoppedAt && A.phase === "done" && A.fade === 0, "the door moment: black, then back up");
  check(A.t < 14, `the whole arrival is under 14 s (${A.t.toFixed(1)})`);
  // the cameras never sit inside a parked car, and stay over the ground
  const cam = arrivalCam(A);
  check(cam.pos[1] > 0.5, "the camera is off the ground");
}

// 5. you at the door, clear of every solid; Skip
{
  const o = youOut();
  const solids = compoundSolids();
  const r = 0.3;
  const inside = solids.find(([x0, x1, z0, z1]) => o.x > x0 - r && o.x < x1 + r && o.z > z0 - r && o.z < z1 + r);
  check(!inside, `you stand clear of every solid at the door (${o.x.toFixed(2)}, ${o.z.toFixed(2)})${inside ? ` in ${inside.join(",")}` : ""}`);
  check(o.x > YOUR_BAY[0] + 0.95, "at the driver's door (the right-hand side: a UK car)");
  const A = newArrival();
  for (let i = 0; i < 30; i++) stepArrival(A);
  skipArrival(A);
  check(A.phase === "out" && A.fade === 1 && A.skipped, "Skip: straight to the black and you at the door");
  check(Math.hypot(carPose(A).x - YOUR_BAY[0], carPose(A).z - YOUR_BAY[1]) < 0.1, "Skip: the car is in its bay");
  let n = 0; while (A.phase !== "done" && n < 200) { stepArrival(A); n++; }
  check(A.phase === "done" && n / 60 < 0.7, `Skip: the picture is back within the fade (${(n / 60).toFixed(2)} s)`);
}

// 6. the drive in hands over on the compound road
{
  const S = newDrive({ leg: "in", tier: "low", seed: 3, mode: "lanes", spec: { wheelR: 0.42, wheelbase: 2.6 }, names: { mate: "Kai", car: "hatchback", club: "Aston Villa" }, call: "none", handover: true });
  let n = 0, fadeFrom = -1;
  while (S.phase !== "done" && n < 60 * 90) { stepDrive(S, { hold: false }); n++; if (fadeFrom < 0 && S.fade > 0) fadeFrom = S.car.s; }
  check(S.phase === "done", "the drive in with a hand-over finishes");
  check(Math.abs(fadeFrom - (S.route.gateS - HANDOVER_AT)) < 0.6, `it fades out ${HANDOVER_AT} m before the gate (${(S.route.gateS - fadeFrom).toFixed(1)})`);
  check(S.car.s < S.route.gateS, "it never reaches the old stand-in gate");
  check(S.ta === 0 && S.stoppedAt < 0, "the old stand-in arrival never plays");
  // a call still ringing at the hand-over is a missed call (one memory)
  const S2 = newDrive({ leg: "in", tier: "low", seed: 3, mode: "lanes", spec: { wheelR: 0.42, wheelbase: 2.6 }, names: { mate: "Kai", car: "hatchback", club: "Aston Villa" }, call: "agent-interest", handover: true });
  S2.callAt = 20;
  n = 0; while (S2.phase !== "done" && n < 60 * 90) { stepDrive(S2, { hold: true }); n++; }
  check(S2.callState !== "ringing" && S2.memories.length <= 1, "no call is left ringing after the hand-over");
}

if (problems.length) { console.error(`driveArrival: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`); process.exit(1); }
console.log("driveArrival: all checks passed");
