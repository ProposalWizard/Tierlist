/**
 * SMOOTH GOAL VIDEOS (Leo, 30 Oct 2026: "for real goals u show it very rigid
 * and stiff … should look smooth like the fake goals").
 *
 * lib/star/goalClip/smooth.ts eases a real recording. It must stay the SAME
 * goal (Leo, 7 Oct 2026: never re-run the chance):
 *   1. The ball: every frame exactly as played, only retimed; the strike, the
 *      goal and the flight in between keep their length to the frame.
 *   2. The scorer at the strike, and every man at every touch of his, on his
 *      exact recorded spot. The keeper exactly as recorded (dive and all).
 *   3. The events: same list, same order, same gaps from the strike on.
 *   4. Smoother: no stretch where nothing moves, no one-frame start or stop,
 *      acceleration and one-frame steps under a limit, fewer statues.
 *   5. Pure and the same every time; the given track is not changed.
 *   6. Made-up goals are left alone; the video key only changes when on.
 *
 * Run: npx tsx tests/star/goalClipSmooth.mts
 */
import { readFileSync } from "node:fs";
import { trackFromStored, frameAt, trackDuration, type GoalTrack } from "../../lib/star/goalClip/track";
import { smoothTrack, smoothRecorded, motionStats, frozenStretches } from "../../lib/star/goalClip/smooth";
import { synthTrack } from "../../lib/star/goalClip/synth";
import { goalVideoKey } from "../../lib/star/goalClip/premake";
import { makeEdit, editDuration, momentAt } from "../../lib/star/goalClip/edit";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }, tol = 0.025) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) <= tol;

const load = (name: string): GoalTrack => {
  const t = trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${name}.json`, import.meta.url), "utf8")));
  if (!t) throw new Error(`fixture ${name} did not load`);
  return t;
};

for (const name of ["scramble", "lay-off"]) {
  const raw = load(name);
  const before = Int16Array.from(raw.data);
  const sm = smoothTrack(raw);
  const shift = raw.strikeT - sm.strikeT;

  // ── 1. The ball, exactly as played ────────────────────────────────────────
  check(Math.abs((raw.goalT - raw.strikeT) - (sm.goalT - sm.strikeT)) < 0.002, `${name}: strike to goal keeps its length`);
  let ballOff = 0;
  for (let t = sm.strikeT - 0.3; t <= trackDuration(sm); t += 1 / 30) {
    if (!near(frameAt(sm, t).ball, frameAt(raw, t + shift).ball)) ballOff++;
  }
  check(ballOff === 0, `${name}: the ball from just before the strike to the end is the recording's, frame for frame (${ballOff} off)`);
  // Before that too: the ball path is the same path (only waits squeezed).
  const path = (tr: GoalTrack) => { const out: string[] = []; for (let f = 0; f < tr.n; f++) { const b = frameAt(tr, f / tr.fps).ball; const k = `${Math.round(b.x * 10)},${Math.round(b.y * 10)}`; if (out[out.length - 1] !== k) out.push(k); } return out; };
  const pr = path(raw), ps = path(sm);
  const missing = ps.filter(k => !pr.includes(k)).length;
  check(missing <= 2, `${name}: every spot the ball passes is a spot it passed in the match (${missing} new)`);

  // ── 2. The men at their touches; the keeper untouched ─────────────────────
  const scorer = raw.bodies.findIndex(b => b.id === raw.meta.scorerBody);
  check(scorer >= 0 && near(frameAt(sm, sm.strikeT).bodies[scorer], frameAt(raw, raw.strikeT).bodies[scorer]), `${name}: the scorer strikes it from his exact spot`);
  let pinOff = 0;
  sm.events.forEach((e, k) => {
    const i = raw.bodies.findIndex(b => b.id === e.who);
    if (i < 0 || raw.bodies[i].role === "keeper") return;
    if (!near(frameAt(sm, e.t).bodies[i], frameAt(raw, raw.events[k].t).bodies[i], 0.04)) pinOff++;
  });
  check(pinOff === 0, `${name}: every man is on his recorded spot at each of his touches (${pinOff} off)`);
  const kp = raw.bodies.findIndex(b => b.role === "keeper");
  let keeperOff = 0;
  for (let f = 0; f < sm.n; f++) {
    const t = f / sm.fps;
    if (t < sm.firstKickT) continue;
    const a = frameAt(sm, t), b = frameAt(raw, Math.min(trackDuration(raw), t + (raw.firstKickT - sm.firstKickT) + (t >= sm.strikeT - 0.3 ? shift - (raw.firstKickT - sm.firstKickT) : 0)));
    if (!near(a.bodies[kp], b.bodies[kp]) || Math.abs(a.keeper.dive - b.keeper.dive) > 0.02 || a.keeper.kind !== b.keeper.kind) keeperOff++;
  }
  check(keeperOff === 0, `${name}: the keeper, his dive and his save as recorded (${keeperOff} frames off)`);

  // ── 3. The events ─────────────────────────────────────────────────────────
  check(sm.events.length === raw.events.length && sm.events.every((e, k) => e.kind === raw.events[k].kind && e.who === raw.events[k].who), `${name}: same events, same order`);
  check(sm.events.every((e, k) => k === 0 || e.t >= sm.events[k - 1].t), `${name}: events still in time order`);
  check(sm.events.every((e, k) => raw.events[k].t < raw.firstKickT || Math.abs((e.t - sm.firstKickT) - (raw.events[k].t - raw.firstKickT)) < 0.002), `${name}: from the first kick on, every event keeps its gap`);

  // ── 4. Smoother ───────────────────────────────────────────────────────────
  const a = motionStats(raw), b = motionStats(sm);
  console.log(`  ${name}: frozen ${a.frozenS.toFixed(2)}→${b.frozenS.toFixed(2)} s · max step ${a.maxStepM.toFixed(3)}→${b.maxStepM.toFixed(3)} m · max accel ${a.maxAccel.toFixed(1)}→${b.maxAccel.toFixed(1)} m/s² · snaps ${a.snaps}→${b.snaps} · statues ${(a.statueShare * 100).toFixed(0)}→${(b.statueShare * 100).toFixed(0)}% · ${trackDuration(raw).toFixed(2)}→${trackDuration(sm).toFixed(2)} s`);
  check(a.frozenS > 0.3, `${name}: the fixture really has a frozen wait (${a.frozenS.toFixed(2)} s)`);
  check(frozenStretches(sm, 0.3).length === 0, `${name}: no stretch over 0.3 s where nothing moves before the goal`);
  check(b.snaps === 0, `${name}: no man goes from standing to running (or back) in one frame (${b.snaps})`);
  check(b.maxAccel <= 16, `${name}: acceleration within 16 m/s² (${b.maxAccel.toFixed(1)})`);
  check(b.maxStepM <= Math.max(0.2, a.maxStepM), `${name}: no one-frame jump over 0.2 m (${b.maxStepM.toFixed(3)})`);
  check(b.statueShare < a.statueShare * 0.6, `${name}: far fewer men standing as statues (${(a.statueShare * 100).toFixed(0)}% → ${(b.statueShare * 100).toFixed(0)}%)`);

  // ── 5. Pure ───────────────────────────────────────────────────────────────
  const again = smoothTrack(raw);
  check(again.n === sm.n && again.data.every((v, k) => v === sm.data[k]), `${name}: the same recording gives the same smooth one`);
  check(raw.data.every((v, k) => v === before[k]) && raw.goalT === load(name).goalT, `${name}: the recording given is not changed`);

  // It cuts into a video like any other recording.
  const ed = makeEdit([sm], "broadcast", "new", 0);
  check(editDuration(ed) > 3 && ed.shots.every(s => s.to <= trackDuration(sm) + 1e-6 && s.from >= 0), `${name}: the smooth recording cuts into a video`);
  check(ed.shots.some(s => s.replay && s.from <= sm.strikeT && s.to >= sm.goalT), `${name}: the replay still shows the strike and the goal`);
  void momentAt;

  // Your celebration run (planned smooth already) is left as recorded.
  const cel: GoalTrack = { ...raw, meta: { ...raw.meta, celebration: { move: "slide", from: [30, 10], at: 0.4 } } };
  const sc = smoothTrack(cel);
  const you = raw.bodies.findIndex(b => b.id === "you");
  let celOff = 0;
  for (let t = sc.goalT + 0.4; t <= trackDuration(sc); t += 1 / 30) {
    if (!near(frameAt(sc, t).bodies[you], frameAt(raw, t + shift).bodies[you])) celOff++;
  }
  check(celOff === 0, `${name}: your celebration run is the recording's (${celOff} frames off)`);
}

// ── 6. Made-up goals and the key ────────────────────────────────────────────
{
  const g = { home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 30, seed: "smooth-test" };
  const made = synthTrack(g)!;
  const [same] = smoothRecorded([made]);
  check(same === made, "a made-up goal is left exactly as it is");
  const sm = motionStats(smoothTrack(load("scramble")));
  const sy = motionStats(made);
  check(sm.maxAccel <= Math.max(16, sy.maxAccel * 1.2), `a smooth real goal accelerates no harder than a made-up one (${sm.maxAccel.toFixed(1)} v ${sy.maxAccel.toFixed(1)})`);
  const off = goalVideoKey("broadcast", 1, "new", ["a"], undefined, "club");
  check(off === "broadcast|1|new|a||club", `off: the video key is exactly the old one (${off})`);
  check(goalVideoKey("broadcast", 1, "new", ["a"], undefined, "club", true) !== off, "on: a smooth video has its own key");
}

if (problems.length) { console.error("goalClipSmooth FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalClipSmooth: all checks passed");
