import {
  CLIP_FPS, SAVE_KINDS, frameStride, packFrame, frameAt, trackDuration, trackToStored, trackFromStored, trackBytes,
  type ClipBody, type FrameState, type GoalTrack,
} from "../../lib/star/goalClip/track";
import { GoalRecorder, LEAD_IN_S, POST_GOAL_S, MAX_CLIP_S, type GoalFacts } from "../../lib/star/goalClip/recorder";
import { keeperDives, readableDive, MAX_DIVE_TILT } from "../../lib/star/goalClip/render";
import { keeperDiveClip } from "../../lib/star/sprites";
import { readFileSync } from "node:fs";

/**
 * GOAL RECORDINGS (Leo, 7 Oct 2026: "the goal replays should always be the
 * same"). A recording must give back the positions that were played, frame
 * for frame, and the same recording must always give the same frames.
 * See lib/star/goalClip/.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BODIES: ClipBody[] = [
  { id: "you", role: "you", side: "us", kit: { shirt: "#ef4444", shorts: "#ffffff" } },
  { id: "run0", role: "mate", side: "us", name: "Saka", kit: { shirt: "#ef4444", shorts: "#ffffff" } },
  { id: "def0", role: "opp", side: "them", kit: { shirt: "#1d4ed8", shorts: "#1d4ed8" } },
  { id: "keeper", role: "keeper", side: "them", kit: { shirt: "#facc15", shorts: "#111827" } },
];

/** A known, smooth "match": every number a function of time. */
function stateAt(t: number): FrameState {
  return {
    ball: { x: 34 + 3 * Math.sin(t), y: Math.max(-1, 22 - 4 * t), z: Math.max(0, 1.5 * Math.sin(t * 0.7)) },
    bodies: [
      { x: 30 + 0.2 * t, y: 24, z: 0 },
      { x: 38 - 0.5 * t, y: 12 - t, z: 0 },
      { x: 33 + Math.cos(t), y: 9, z: t > 3 && t < 3.4 ? 0.3 : 0 },
      { x: 34 + 0.8 * Math.sin(t * 1.3), y: 0.6, z: 0 },
    ],
    keeper: { dive: 0.5 * Math.sin(t), lunge: Math.min(1, Math.max(0, t - 5)), dir: t > 5 ? 1 : 0, kind: t > 5.2 ? "low" : null },
  };
}
const FACTS: GoalFacts = {
  id: "clip-test", minute: 63, minuteLabel: "63", scorer: "Sam Test", scorerShort: "Test", scorerBody: "you",
  isYou: true, home: "Arsenal", away: "Chelsea", youAreHome: true,
};

/** Play a "match" into a recorder with uneven frame steps (a real phone). */
function play(rec: GoalRecorder, until: number, at: (t: number) => void, jitterSeed = 1) {
  let t = 0, s = jitterSeed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  while (t < until) {
    const dt = 1 / 60 + (rnd() - 0.5) * 0.012;
    t += dt;
    rec.frame(dt, stateAt(t));
    at(t);
  }
}

// ── 1. A frame packs and unpacks to the centimetre ──────────────────────────
{
  const st = stateAt(5.6);
  const data = new Int16Array(frameStride(BODIES.length));
  packFrame(st, data, 0);
  const track: GoalTrack = {
    v: 1, meta: { ...FACTS, createdAt: "" }, fps: CLIP_FPS, bodies: BODIES, data, n: 1,
    goalT: 0, strikeT: 0, firstKickT: 0, events: [],
  };
  const back = frameAt(track, 0);
  const err = Math.max(
    Math.abs(back.ball.x - st.ball.x), Math.abs(back.ball.y - st.ball.y), Math.abs(back.ball.z - st.ball.z),
    ...back.bodies.flatMap((b, i) => [Math.abs(b.x - st.bodies[i].x), Math.abs(b.y - st.bodies[i].y), Math.abs(b.z - st.bodies[i].z)]),
  );
  check(err <= 0.005, `a packed frame comes back within half a centimetre (worst ${err.toFixed(4)} m)`);
  check(back.keeper.kind === "low" && back.keeper.dir === 1, `the keeper's save comes back (${back.keeper.kind}, ${back.keeper.dir})`);
  check(Math.abs(back.keeper.lunge - st.keeper.lunge) < 0.001, "the lunge comes back");
  check(SAVE_KINDS[0] === null, "index 0 is no save");
}

// ── 2. A recorded goal replays the positions that were played ───────────────
let recorded: GoalTrack | null = null;
{
  const rec = new GoalRecorder();
  rec.begin(BODIES);
  let kicked = false, scored = false;
  play(rec, 9.0, (t) => {
    if (!kicked && t >= 5.0) { kicked = true; rec.event("shot", "you", { mode: "curl" }); }
    if (!scored && t >= 6.2) { scored = true; rec.markGoal(FACTS); }
  });
  const out = rec.take();
  check(out.length === 1, `one goal, one clip (${out.length})`);
  recorded = out[0] ?? null;
  if (recorded) {
    const tr = recorded;
    const dur = trackDuration(tr);
    const want = (6.2 + POST_GOAL_S) - (5.0 - LEAD_IN_S);
    check(Math.abs(dur - want) < 0.06, `the clip runs from just before the kick to just after the goal (${dur.toFixed(2)} s, want ${want.toFixed(2)})`);
    check(Math.abs(tr.strikeT - LEAD_IN_S) < 0.03, `the strike sits ${LEAD_IN_S} s in (${tr.strikeT})`);
    check(Math.abs(tr.goalT - (LEAD_IN_S + 1.2)) < 0.03, `the goal sits where it happened (${tr.goalT})`);
    check(tr.events.some(e => e.kind === "goal") && tr.events.some(e => e.kind === "shot" && e.mode === "curl"), "the kick and the goal are on it");
    // Compare every replayed moment with the "match" itself. The clip's clock
    // started 0.9 s before a kick at 5.0 s of match time.
    const offset = 5.0 - LEAD_IN_S;
    let worst = 0;
    for (let k = 0; k <= 400; k++) {
      const t = (dur * k) / 400;
      const got = frameAt(tr, t), real = stateAt(t + offset);
      worst = Math.max(worst,
        Math.hypot(got.ball.x - real.ball.x, got.ball.y - real.ball.y, got.ball.z - real.ball.z),
        ...got.bodies.map((b, i) => Math.hypot(b.x - real.bodies[i].x, b.y - real.bodies[i].y)));
    }
    // The recorder's clock is the sum of the match's own steps, which drifts a
    // hair from the "real" time above; a few centimetres is the whole budget.
    check(worst < 0.05, `every replayed moment is within 5 cm of the match (worst ${(worst * 100).toFixed(1)} cm)`);
    check(trackBytes(tr) < 40_000, `a clip is small (${trackBytes(tr)} bytes)`);
  }
}

// ── 3. The same recording is the same replay, every time ────────────────────
if (recorded) {
  const a = trackToStored(recorded);
  const b = trackFromStored(JSON.parse(JSON.stringify(a)));
  check(!!b && b.data.length === recorded.data.length && b.data.every((v, i) => v === recorded!.data[i]), "stored and read back, byte for byte");
  const t = 1.234;
  const f1 = JSON.stringify(frameAt(recorded, t)), f2 = JSON.stringify(frameAt(b!, t));
  check(f1 === f2, "the same moment reads the same from the copy");
  check(trackFromStored({ ...a, v: 99 }) === null && trackFromStored({ ...a, n: a.n + 1 }) === null && trackFromStored(null) === null, "a broken or future recording is refused");
  // Two recorders fed the same frames make byte-identical clips.
  const twice = [0, 1].map(() => {
    const rec = new GoalRecorder();
    rec.begin(BODIES);
    let k = false, g = false;
    play(rec, 9, (tt) => { if (!k && tt >= 5) { k = true; rec.event("shot", "you"); } if (!g && tt >= 6.2) { g = true; rec.markGoal(FACTS); } }, 7);
    return rec.take()[0];
  });
  check(!!twice[0] && !!twice[1] && twice[0].data.every((v, i) => v === twice[1].data[i]), "the same match makes the same clip");
}

// ── 4. A long aim is not in the clip; a long move is cut from the front ─────
{
  const rec = new GoalRecorder();
  rec.begin(BODIES);
  let k = false, g = false;
  play(rec, 43.5, (t) => {                     // 40 s of aiming first
    if (!k && t >= 40) { k = true; rec.event("shot", "you"); }
    if (!g && t >= 40.8) { g = true; rec.markGoal(FACTS); }
  });
  const tr = rec.take()[0];
  check(!!tr && trackDuration(tr) < LEAD_IN_S + 0.8 + POST_GOAL_S + 0.1, `40 s of aiming is cut to the lead-in (${tr ? trackDuration(tr).toFixed(2) : "none"} s)`);

  const rec2 = new GoalRecorder();
  rec2.begin(BODIES);
  let k2 = false, g2 = false;
  play(rec2, 25, (t) => {                      // a pass at 2 s, the goal at 21 s
    if (!k2 && t >= 2) { k2 = true; rec2.event("pass", "you"); }
    if (!g2 && t >= 21) { g2 = true; rec2.markGoal(FACTS); }
  });
  const tr2 = rec2.take()[0];
  check(!!tr2 && trackDuration(tr2) <= MAX_CLIP_S + 0.05, `a long move is capped at ${MAX_CLIP_S} s (${tr2 ? trackDuration(tr2).toFixed(2) : "none"})`);
  check(!!tr2 && Math.abs(tr2.goalT - (MAX_CLIP_S - POST_GOAL_S)) < 0.05, "…keeping the goal and what came just before it");
}

// ── 5. A goal cut short by the next chance keeps what it has ────────────────
{
  const rec = new GoalRecorder();
  rec.begin(BODIES);
  let k = false, g = false;
  play(rec, 6.7, (t) => {
    if (!k && t >= 5) { k = true; rec.event("shot", "you"); }
    if (!g && t >= 6.2) { g = true; rec.markGoal(FACTS); }
  });
  check(rec.recordingGoal, "still recording the moment after the goal");
  rec.begin(BODIES);                            // the next chance starts early
  const tr = rec.take()[0];
  check(!!tr && Math.abs(trackDuration(tr) - (6.7 - 5 + LEAD_IN_S)) < 0.06, `cut where it stopped (${tr ? trackDuration(tr).toFixed(2) : "none"} s)`);
  check(rec.take().length === 0, "handed out once");
  // A chance with no goal makes no clip.
  play(rec, 4, () => {});
  rec.begin(BODIES);
  check(rec.take().length === 0, "no goal, no clip");
}

// ── 6. Real recorded goals (fixtures, recorded in the real match) ──────────
{
  const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${f}`, import.meta.url), "utf8")));
  const scramble = load("scramble.json"), layoff = load("lay-off.json");
  check(!!scramble && !!layoff, "the recorded goals read back");
  if (scramble && layoff) {
    check(scramble.meta.scorerBody === "run1" && layoff.meta.scorerBody === "run0", `the scorer is the man who struck it (${scramble.meta.scorerBody}, ${layoff.meta.scorerBody})`);
    const dives = keeperDives(scramble);
    check(dives.length === 3, `a three-save scramble has three dives (${dives.length})`);
    check(dives.every((d, i) => i === 0 || d.start >= dives[i - 1].end - 1e-9), "dives come one after another");
    check(dives[dives.length - 1].end === Infinity && scramble.goalT >= dives[dives.length - 1].start, "the last dive is the one the goal went past");
    check(keeperDives(layoff).length === 1, `a simple finish has one dive (${keeperDives(layoff).length})`);
    // The cut runs from the first kick to after the goal.
    check(scramble.firstKickT < scramble.strikeT && scramble.strikeT < scramble.goalT, "first kick, then the scoring strike, then the goal");
    check(trackDuration(layoff) > layoff.goalT && trackDuration(layoff) - layoff.goalT <= POST_GOAL_S + 0.05, "the clip ends just after the goal");
  }
}

// ── 7. A dive is drawn across the screen, never standing on his head ───────
{
  // His right is his facing + 90° (sprites.ts's keeperDiveClip), so the body of
  // a dive lies along facing ± 90°. Sweep every true facing and dive direction.
  let steepest = 0, wrongSide = 0, flatChanged = 0, n = 0;
  for (let f = -Math.PI; f < Math.PI; f += Math.PI / 18) {
    for (let a = -Math.PI; a < Math.PI; a += Math.PI / 36) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const pick = readableDive(f, dx, dy);
      const along = pick.clip === "diveR" ? pick.facing + Math.PI / 2 : pick.facing - Math.PI / 2;
      // How far the drawn body is from flat (0 = flat across the screen).
      const tilt = Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(along)))));
      steepest = Math.max(steepest, tilt);
      // It dives to the same side of the screen as the real dive.
      if (Math.sign(Math.cos(along)) !== Math.sign(dx) && Math.abs(dx) > 1e-9) wrongSide++;
      // The match's own rule agrees which dive this is.
      if (keeperDiveClip(pick.facing, Math.cos(along), Math.sin(along)) !== pick.clip) wrongSide++;
      // A dive already flat enough, drawn the way he really faces, is left alone.
      const flatEnough = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx))) <= MAX_DIVE_TILT - 1e-9;
      if (flatEnough && keeperDiveClip(f, dx, dy) === pick.clip) {
        const back = Math.abs(Math.atan2(Math.sin(pick.facing - f), Math.cos(pick.facing - f)));
        if (back > 1e-6 && Math.abs(Math.atan2(Math.sin(along - a), Math.cos(along - a))) > 1e-6) flatChanged++;
      }
      n++;
    }
  }
  check(steepest <= MAX_DIVE_TILT + 1e-9, `no dive drawn steeper than ${(MAX_DIVE_TILT * 180 / Math.PI).toFixed(0)}° (steepest ${(steepest * 180 / Math.PI).toFixed(1)}° over ${n})`);
  check(wrongSide === 0, `every dive goes to the real side, by the match's own rule (${wrongSide} wrong)`);
  check(flatChanged === 0, `a dive already across the screen is drawn as it was (${flatChanged} changed)`);
  // A dive straight at the camera goes to the ball's side, not a coin flip.
  const atCamL = readableDive(Math.PI / 2, 0.02, 1, -40), atCamR = readableDive(Math.PI / 2, -0.02, 1, 40);
  const sideOf = (p: { facing: number; clip: string }) => Math.sign(Math.cos(p.clip === "diveR" ? p.facing + Math.PI / 2 : p.facing - Math.PI / 2));
  check(sideOf(atCamL) === -1 && sideOf(atCamR) === 1, `a dive at the camera leads to the ball's side (${sideOf(atCamL)}, ${sideOf(atCamR)})`);
  // …but a dive already across the screen ignores the hint (it is already right).
  check(sideOf(readableDive(Math.PI / 2, 1, 0.2, -40)) === 1, "a flat dive keeps its own side");
  // The camera behind the goal sees his back: facing up the screen, diving right.
  const net = readableDive(-Math.PI / 2, 1, 0.05);
  check(net.clip === "diveR" && Math.abs(net.facing - (Math.atan2(0.05, 1) - Math.PI / 2)) < 1e-9, `behind the goal: his back, diving right (${net.clip}, ${(net.facing * 180 / Math.PI).toFixed(0)}°)`);
}

if (problems.length) { console.error("goalClip FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalClip: all checks passed");
