/**
 * Goals from matches you did not play (lib/star/goalClip/synth.ts): every
 * kind of move makes a recording that is a real goal — the ball goes in
 * between the posts and under the bar, the keeper does not reach it, the
 * scorer strikes it from where he stands, nobody stands in the net — and the
 * same goal is the same recording every time.
 */
import { synthTrack, type SynthKind } from "../../lib/star/goalClip/synth";
import { frameAt, trackDuration } from "../../lib/star/goalClip/track";
import { POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";
import { makeEdit } from "../../lib/star/goalClip/edit";
import { planAudio, finishOf } from "../../lib/star/goalClip/audio";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const KINDS: SynthKind[] = ["run_in", "header", "long_range", "tap_in", "penalty"];

let made = 0;
for (const kind of KINDS) {
  for (let i = 0; i < 40; i++) {
    const g = { home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: i % 2 === 0, minute: 10 + i, scoreAfter: [1, 0] as [number, number], seed: `t-${kind}-${i}`, kind };
    const tr = synthTrack(g);
    const tag = `${kind} #${i}`;
    check(!!tr, `${tag}: made`);
    if (!tr) continue;
    made++;
    // The same goal, the same recording.
    const again = synthTrack(g)!;
    check(again.n === tr.n && again.data.every((v, k) => v === tr.data[k]), `${tag}: same seed, same goal`);
    // In the goal: between the posts and under the bar as it crosses the line.
    const before = frameAt(tr, Math.max(0, tr.goalT - 1 / 30)).ball, after = frameAt(tr, Math.min(trackDuration(tr), tr.goalT + 1 / 30)).ball;
    const k = before.y === after.y ? 0 : before.y / (before.y - after.y);
    const cross = { x: before.x + (after.x - before.x) * k, z: before.z + (after.z - before.z) * k };
    check(cross.x > POST_L + 0.1 && cross.x < POST_R - 0.1 && cross.z < GOAL_H - 0.05, `${tag}: goes in under the bar between the posts (x ${cross.x.toFixed(2)}, z ${cross.z.toFixed(2)})`);
    check(before.y > 0 && after.y <= 0.05, `${tag}: crosses the line at the goal`);
    // The scorer strikes it from where he stands.
    const si = tr.bodies.findIndex(b => b.id === tr.meta.scorerBody);
    const at = frameAt(tr, tr.strikeT);
    const d = Math.hypot(at.bodies[si].x - at.ball.x, at.bodies[si].y - at.ball.y);
    check(d < 1.6, `${tag}: the scorer is at the ball when he strikes it (${d.toFixed(2)} m)`);
    // Nobody stands in the net, and the keeper is not where the ball goes in.
    for (let t = 0; t < trackDuration(tr); t += 0.2) {
      const fr = frameAt(tr, t);
      for (let b = 0; b < tr.bodies.length; b++) {
        const p = fr.bodies[b];
        if (p.y < -0.3) { check(false, `${tag}: ${tr.bodies[b].id} inside the net at ${t.toFixed(1)}s`); break; }
      }
    }
    const ki = tr.bodies.findIndex(b => b.role === "keeper");
    const kp = frameAt(tr, tr.goalT).bodies[ki];
    check(Math.abs(kp.x - cross.x) > 0.8, `${tag}: the keeper's body is not on the ball's line (${Math.abs(kp.x - cross.x).toFixed(2)} m)`);
    // It is voiced like any goal, and read as the right kind of finish.
    const plan = planAudio(makeEdit([tr], "broadcast"));
    check(plan.cues.some(c => c.sound.startsWith("cl-")), `${tag}: the commentator calls it`);
    if (kind === "header") check(finishOf(tr) === "header", `${tag}: called a header`);
    if (kind === "penalty") check(finishOf(tr) === "penalty", `${tag}: called a penalty`);
  }
}
// A bad input never throws.
check(synthTrack({ home: "", away: "", scorer: "", scorerShort: "", scorerHome: true, minute: 0, seed: "" }) !== undefined, "empty input does not throw");

if (problems.length) { console.error(`synthGoal FAILED (${problems.length}):\n  - ` + problems.slice(0, 25).join("\n  - ")); process.exit(1); }
console.log(`synthGoal: ${made} made goals checked`);
