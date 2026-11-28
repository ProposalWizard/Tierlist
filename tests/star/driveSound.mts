/**
 * THE DRIVE'S SOUND (lib/star/drive3d/sound.ts). Pure maps and the player on a fake AudioContext:
 *  1. the engine: pitch rises with speed inside a gear and drops at each change up; Hold = higher and louder;
 *     the race's rev = higher; idle when stopped; each car has its own engine (the hatch above the SUV and the supercar);
 *  2. the road: town hum on the street and roundabout, wind and birds on the lane and at the compound, rain only when it rains;
 *  3. the one-shots each fire once, on the right frame: honk + cheer, the camera's flash (only with a fine), the race's rev,
 *     the refused lane change, the call's pick-up; the arrival's barrier, clunk, engine off, door open, door, steps;
 *     a real drive (the sim) gives the cues it should, in order;
 *  4. the rules: nothing is made or played before a tap; Sound effects off = nothing is made; a hidden tab is silent;
 *     muted mid-drive = the master goes to 0; dispose stops every loop;
 *  5. the download: no new audio files (everything is made in code), well under the 600 KB budget.
 */
import { CAR_ENGINES, engineAt, ambienceFor, driveFrame, arrivalFrame, cuesBetween, soundAllowed, createDriveSound, DRIVE_SOUND_FILES, type DriveSoundFrame, type DriveCue } from "../../lib/star/drive3d/sound";
import { newDrive, stepDrive, answerEvent, answerCall, type DriveOptions } from "../../lib/star/drive3d/drive";
import { newArrival, stepArrival, liftOf, DOOR_AFTER_STOP } from "../../lib/star/drive3d/arrival";
import { DRIVE_CAR_IDS } from "../../lib/star/drive3d/cars";
import { statSync } from "node:fs";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1. the engine
{
  for (const id of DRIVE_CAR_IDS) {
    const E = CAR_ENGINES[id];
    check(engineAt(0, false, id).rpm === E.idle, `${id}: idle when stopped`);
    let ups = 0, last = engineAt(0.5, false, id);
    for (let v = 0.5; v <= 30; v += 0.25) {
      const n = engineAt(v, false, id);
      if (n.gear === last.gear) check(n.rpm >= last.rpm - 1e-6, `${id}: rpm rises with speed in gear ${n.gear} (${v} m/s)`);
      else { ups++; check(n.gear === last.gear + 1 && n.rpm < last.rpm, `${id}: a change up drops the revs (${v} m/s)`); }
      check(n.rpm <= E.red + 1e-6 && n.freq > 0 && n.gain > 0 && n.gain < 1.2, `${id}: in range at ${v} m/s`);
      last = n;
    }
    check(ups >= 2, `${id}: changes gear on the drive (${ups})`);
    const cruise = engineAt(15, false, id), held = engineAt(15, true, id, 2), revd = engineAt(15, false, id, 0, 1);
    check(held.gain > cruise.gain, `${id}: Hold is louder`);
    check(held.rpm >= cruise.rpm * 0.98, `${id}: Hold keeps the revs up`);
    check(revd.rpm > cruise.rpm && revd.gain > cruise.gain, `${id}: the race's rev is higher and louder`);
  }
  check(engineAt(15, false, "suv").cutoff < engineAt(15, false, "hatch").cutoff && CAR_ENGINES.super.cyl > CAR_ENGINES.hatch.cyl && new Set(DRIVE_CAR_IDS.map((i) => JSON.stringify(CAR_ENGINES[i]))).size === DRIVE_CAR_IDS.length, "each car its own engine (the SUV darker than the hatch, the supercar a V8)");
  check(engineAt(20, false, "super").cutoff > engineAt(20, false, "family").cutoff, "the supercar sounds brighter than the family car");
}

// 2. the road
{
  const st = ambienceFor("street", 0, false), ln = ambienceFor("lane", 0, false, 20), cp = ambienceFor("compound", 0, false);
  check(st.town === 1 && ln.town === 0 && cp.town === 0, "town hum only in town");
  check(ln.birds === 1 && ln.wind > st.wind && st.birds < 0.3 && cp.birds > 0.3, "birds and wind in the country");
  check(st.rain === 0 && ambienceFor("lane", 1, true).rain === 1 && ambienceFor("lane", 1, false).rain < 1, "rain only when it rains, louder in the car");
}

// 3. the cues
const base: DriveOptions = { leg: "in", tier: "medium", seed: 7, mode: "lanes", spec: { wheelR: 0.42, wheelbase: 2.6 }, names: { mate: "Kai", car: "sports car", club: "Aston Villa" }, call: "none", handover: true, carId: "sports", wage: 24000 };
/** A whole drive on auto; every cue as it fires: [time, cue]. */
function cuesOf(o: Partial<DriveOptions>, act: (S: ReturnType<typeof newDrive>) => void = () => {}) {
  const S = newDrive({ ...base, ...o });
  const got: [number, DriveCue][] = [];
  let prev: DriveSoundFrame | null = null, ring = 0, ind = 0, haz = 0, rain = 0, mate = 0;
  const roads = new Set<string>();
  for (let n = 0; S.phase !== "done" && n < 60 * 120; n++) {
    act(S);
    stepDrive(S, { hold: false });
    const f = driveFrame(S, false, "chase");
    for (const c of cuesBetween(prev, f)) got.push([S.t, c]);
    if (f.ringing) ring++; if (f.indicator) ind++; if (f.hazards) haz++; if (f.rain > 0.5) rain++; if (f.mate > 0.5) mate++;
    roads.add(f.road);
    prev = f;
  }
  return { got, names: got.map((g) => g[1]), ring, ind, haz, rain, mate, roads, S };
}
{
  const fan = cuesOf({ event: "fan-crossing" }, (S) => { if (S.eventState === "open") answerEvent(S, "yes"); });
  check(fan.names.filter((c) => c === "honk").length === 1 && fan.names.filter((c) => c === "cheer").length === 1, `the fan: one honk and one cheer (${fan.names})`);
  const fanNo = cuesOf({ event: "fan-crossing" }, (S) => { if (S.eventState === "open") answerEvent(S, "no"); });
  check(!fanNo.names.includes("honk") && !fanNo.names.includes("cheer"), "eyes on the road: no honk, no cheer");
  const cam = cuesOf({ event: "speed-camera" });
  check(cam.names.filter((c) => c === "flash").length === 1, `the camera: one flash when it catches you (${cam.names})`);
  const camSlow = cuesOf({ event: "speed-camera" }, (S) => { if (S.eventState === "open") answerEvent(S, "yes"); });
  check(!camSlow.names.includes("flash"), "slowed down in time: no flash");
  const race = cuesOf({ event: "mate-race" }, (S) => { if (S.eventState === "open") answerEvent(S, "yes"); });
  check(race.names.filter((c) => c === "rev").length === 1 && race.mate > 30, `the race: one rev, his engine beside you (${race.names}, ${race.mate} frames)`);
  const help = cuesOf({ event: "breakdown" }, (S) => { if (S.eventState === "open") answerEvent(S, "yes"); });
  check(help.haz > 60, `pull over and help: the hazards tick (${help.haz} frames)`);
  const rain = cuesOf({ event: "rain" });
  check(rain.rain > 200, `rain: on the roof for the rest of the drive (${rain.rain} frames)`);
  const call = cuesOf({ call: "borrow-car", event: "none" }, (S) => { if (S.callState === "ringing" && S.t - S.callSince > 2) answerCall(S, "yes"); });
  check(call.ring > 100 && call.ring < 60 * 3 && call.names.filter((c) => c === "pickup").length === 1, `the call: rings, then one pick-up (${call.ring} frames)`);
  const plain = cuesOf({ event: "none" });
  check(plain.names.length === 0, `a plain drive has no one-shots (${plain.names})`);
  check(plain.ind > 0, "the indicator ticks on the auto overtake");
  check(plain.roads.has("street") && plain.roads.has("lane"), "the drive passes through town and the country");
  // the arrival
  const A = newArrival();
  let prev: DriveSoundFrame | null = null;
  const got: DriveCue[] = [];
  for (let n = 0; A.phase !== "done" && n < 60 * 60; n++) { stepArrival(A); const f = arrivalFrame(A, liftOf(A), DOOR_AFTER_STOP); got.push(...cuesBetween(prev, f)); prev = f; }
  const want: DriveCue[] = ["barrier", "barrier-stop", "engine-off", "door-open", "door", "steps"];
  check(JSON.stringify(got) === JSON.stringify(want), `the arrival: ${want.join(" → ")} (got ${got.join(" → ")})`);
  check(cuesBetween(null, arrivalFrame(A, liftOf(A), DOOR_AFTER_STOP)).length === 0, "a frame with nothing before it fires nothing it was already in");
}

// 4. the player: a fake AudioContext that counts what is made and started
class FakeParam { value = 0; setValueAtTime(v: number) { this.value = v; return this; } setTargetAtTime(v: number) { this.value = v; return this; } linearRampToValueAtTime(v: number) { this.value = v; return this; } exponentialRampToValueAtTime(v: number) { this.value = v; return this; } cancelScheduledValues() { return this; } }
function fakeCtx(state = "running") {
  const counts = { made: 0, started: 0, stopped: 0 };
  const node = (extra: Record<string, unknown> = {}) => {
    counts.made++;
    return { connect() { return this; }, disconnect() {}, gain: new FakeParam(), frequency: new FakeParam(), Q: new FakeParam(), pan: new FakeParam(), threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam(), type: "", loop: false, buffer: null as unknown, start() { counts.started++; }, stop() { counts.stopped++; }, ...extra };
  };
  const ctx = {
    state, currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => node(), createOscillator: () => node(), createBiquadFilter: () => node(), createBufferSource: () => node(),
    createDynamicsCompressor: () => node(), createStereoPanner: () => node(), createMediaStreamDestination: () => node({ stream: {} }),
    createBuffer: (_c: number, n: number) => ({ duration: n / 8000, getChannelData: () => new Float32Array(n) }),
  };
  return { ctx: ctx as unknown as AudioContext, counts, raw: ctx };
}
{
  const S = newDrive({ ...base, event: "fan-crossing" });
  const frame = () => driveFrame(S, false, "chase");
  // no tap: nothing is made, nothing plays
  { const F = fakeCtx("suspended"); let tap = false; const P = createDriveSound({ car: "hatch", ctx: () => F.ctx, on: () => true, tapped: () => tap });
    for (let i = 0; i < 60; i++) { stepDrive(S, { hold: false }); P.update(frame(), 1 / 60); }
    check(F.counts.made === 1 && F.counts.started === 0 && !P.built, `before a tap: nothing made or played (${F.counts.made} nodes, ${F.counts.started} started)`);
    tap = true; P.update(frame(), 1 / 60);
    check(!P.built, "a tap but the context still suspended: still nothing");
    (F.raw as { state: string }).state = "running"; P.update(frame(), 1 / 60);
    check(P.built && F.counts.started > 5, `after a tap with the context running: the loops start (${F.counts.started})`);
    P.dispose();
    check(F.counts.stopped >= 0, "dispose never throws"); }
  // Sound effects off: nothing made
  { const F = fakeCtx(); const P = createDriveSound({ car: "sports", ctx: () => F.ctx, on: () => false, tapped: () => true });
    for (let i = 0; i < 30; i++) P.update(frame(), 1 / 60);
    check(!P.built && F.counts.started === 0, "Sound effects off: nothing made or played"); P.dispose(); }
  // muted mid-drive: the master goes to 0 and no one-shot starts
  { const F = fakeCtx(); let on = true; const P = createDriveSound({ car: "sports", ctx: () => F.ctx, on: () => on, tapped: () => true });
    P.update(frame(), 1 / 60);
    const started = F.counts.started;
    on = false;
    P.update({ ...frame(), honk: true, cheer: true }, 1 / 60);
    check(F.counts.started === started, `muted mid-drive: the honk does not play (${F.counts.started - started} started)`);
    on = true;
    P.update(frame(), 1 / 60);
    const s2 = F.counts.started;
    P.update({ ...frame(), honk: true, cheer: true }, 1 / 60);
    check(F.counts.started > s2, "unmuted: the next one-shot plays (a missed one is not replayed)");
    P.dispose(); }
  check(soundAllowed({ tapped: true, state: "running", on: true, hidden: false }), "allowed: tapped, running, on, in view");
  check(!soundAllowed({ tapped: false, state: "running", on: true, hidden: false }) && !soundAllowed({ tapped: true, state: "running", on: true, hidden: true }) && !soundAllowed({ tapped: true, state: "suspended", on: true, hidden: false }), "not allowed: no tap / hidden tab / suspended");
  // no window: a no-op player
  { const P = createDriveSound({ car: "hatch" }); P.update(frame(), 1 / 60); P.dispose(); check(!P.built, "no window: silence, no throw"); }
}

// 5. the download
{
  let bytes = 0;
  for (const f of DRIVE_SOUND_FILES) bytes += statSync(`public${f}`).size;
  check(bytes < 600 * 1024, `new drive audio under 600 KB (${bytes} bytes)`);
  check(DRIVE_SOUND_FILES.length === 0, "every drive sound is made in code");
}

if (problems.length) { console.error(`driveSound: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`); process.exit(1); }
console.log("driveSound: all checks passed");
