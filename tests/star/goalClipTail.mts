import { frameAt, type ClipBody, type FrameState } from "../../lib/star/goalClip/track";
import { GoalRecorder, POST_GOAL_S, type GoalFacts } from "../../lib/star/goalClip/recorder";

/**
 * A GOAL IS RECORDED FOR ITS FULL POST_GOAL_S (22 Oct 2026, Leo's plan part 12).
 *
 * The match hands the result screen back to the commentary 1.8 s after a goal
 * (CanvasMatch handOver(..., 1800)); POST_GOAL_S is 2.2 s. Before this fix,
 * CanvasMatch's recordGoalFrame cut the clip the moment the phase changed, so
 * the last 0.4 s (more on a slow phone) was made up by extendRow. Now it keeps
 * writing down the same chance's picture until the recorder cuts at
 * POST_GOAL_S; only a new chance or the match closing cuts it early.
 *
 * This drives a GoalRecorder through the same decision recordGoalFrame makes,
 * once with the old rule and once with the new one, frame by frame at 60 fps,
 * and measures the last REAL frame the recorder was given after the goal.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BODIES: ClipBody[] = [
  { id: "you", role: "you", side: "us", kit: { shirt: "#ef4444", shorts: "#ffffff" } },
  { id: "keeper", role: "keeper", side: "them", kit: { shirt: "#facc15", shorts: "#111827" } },
];
const FACTS: GoalFacts = {
  id: "clip-tail", minute: 63, minuteLabel: "63", scorer: "Sam Test", scorerShort: "Test", scorerBody: "you",
  isYou: true, home: "Arsenal", away: "Chelsea", youAreHome: true,
};

const GOAL_AT = 1.0;          // the ball crosses the line (resolveOutcome → markGoal)
const HAND_OVER_S = 1.8;      // CanvasMatch: handOver(() => startSimulation(), 1800)
const NEXT_CHANCE_S = 6.0;    // the commentary runs a while before the next chance

type Phase = "flight" | "result" | "feed" | "aim";
/** The engine as the loop steps it: flight and result move things; the
 *  commentary ("feed") steps nothing, so the picture holds where it was. */
function engine() {
  let st: FrameState = {
    ball: { x: 34, y: 16, z: 0.4 }, bodies: [{ x: 34, y: 18, z: 0 }, { x: 34, y: 0.6, z: 0 }],
    keeper: { dive: 0, lunge: 0, dir: 0, kind: null },
  };
  let vy = -14;
  return {
    step(phase: Phase, dt: number) {
      if (phase !== "flight" && phase !== "result") return;
      // Ball into the net with the net's drag; you run on; the keeper falls.
      st = {
        ball: { x: st.ball.x, y: st.ball.y + vy * dt, z: st.ball.z },
        bodies: [{ x: st.bodies[0].x, y: st.bodies[0].y - 3 * dt, z: 0 }, { x: st.bodies[1].x + 1.2 * dt, y: 0.6, z: 0 }],
        keeper: { dive: Math.min(1, st.keeper.dive + dt), lunge: 0, dir: 1, kind: "low" },
      };
      if (phase === "result") vy *= Math.max(0, 1 - 5.5 * dt);
    },
    get state() { return st; },
  };
}

function run(rule: "old" | "new") {
  const rec = new GoalRecorder();
  const eng = engine();
  const scene = { id: 1 };
  let recScene: object | null = null;
  let lastRealAfterGoal = 0;
  const tracks = [] as ReturnType<GoalRecorder["take"]>;
  let t = 0;
  const dt = 1 / 60;
  let marked = false;
  let held: FrameState | null = null;
  while (t < NEXT_CHANCE_S + 0.5) {
    t += dt;
    const phase: Phase = t < GOAL_AT ? "flight" : t < GOAL_AT + HAND_OVER_S ? "result" : t < NEXT_CHANCE_S ? "feed" : "aim";
    const sc = phase === "aim" ? { id: 2 } : scene;
    eng.step(phase, dt);
    if (!marked && phase === "result") { rec.markGoal(FACTS); marked = true; }
    // ── recordGoalFrame, as CanvasMatch has it ──
    const live = (phase === "flight" || phase === "result");
    const keep = rule === "old" ? live : live || (rec.recordingGoal && recScene === sc);
    if (keep) {
      if (recScene !== sc) { recScene = sc; rec.begin(BODIES); }
      if (rec.recordingGoal) lastRealAfterGoal = t - GOAL_AT;
      rec.frame(dt, eng.state);
    } else if (rec.recordingGoal) {
      rec.finishNow();
    }
    if (phase === "feed" && !held) held = eng.state;
    tracks.push(...rec.take());
  }
  return { track: tracks[0], lastRealAfterGoal, held: held! };
}

const before = run("old"), after = run("new");
for (const [name, r] of [["before", before], ["after", after]] as const) {
  check(!!r.track, `${name}: a clip was cut`);
}
console.log(`last real frame after the goal: before ${before.lastRealAfterGoal.toFixed(2)} s, after ${after.lastRealAfterGoal.toFixed(2)} s (POST_GOAL_S ${POST_GOAL_S} s)`);
check(before.lastRealAfterGoal < HAND_OVER_S + 0.05, `before: recording stopped at the hand-over (${before.lastRealAfterGoal.toFixed(2)} s)`);
check(after.lastRealAfterGoal >= POST_GOAL_S - 0.05, `after: recording runs to POST_GOAL_S (${after.lastRealAfterGoal.toFixed(2)} s)`);

// The clip's last frame is the picture the engine left, not a guess at it.
if (before.track && after.track) {
  const endOf = (tr: typeof after.track) => frameAt(tr, tr.goalT + POST_GOAL_S - 0.01);
  const gap = (f: FrameState) => Math.hypot(f.ball.x - after.held.ball.x, f.ball.y - after.held.ball.y)
    + Math.hypot(f.bodies[0].x - after.held.bodies[0].x, f.bodies[0].y - after.held.bodies[0].y)
    + Math.hypot(f.bodies[1].x - after.held.bodies[1].x, f.bodies[1].y - after.held.bodies[1].y);
  const gb = gap(endOf(before.track)), ga = gap(endOf(after.track));
  console.log(`clip's last frame vs the real picture: before ${(gb * 100).toFixed(1)} cm off, after ${(ga * 100).toFixed(1)} cm off`);
  check(ga < 0.02, `after: the last frame is the real picture (${(ga * 100).toFixed(1)} cm off)`);
  check(Math.abs(before.track.goalT + POST_GOAL_S - after.track.goalT - POST_GOAL_S) < 0.05, "both clips are the same length");
}

// A new chance still cuts a goal that is being recorded (begin → finishNow).
{
  const rec = new GoalRecorder();
  rec.begin(BODIES);
  const st = engine().state;
  for (let i = 0; i < 30; i++) rec.frame(1 / 60, st);
  rec.markGoal(FACTS);
  for (let i = 0; i < 10; i++) rec.frame(1 / 60, st);
  rec.begin(BODIES);
  check(rec.take().length === 1 && !rec.recordingGoal, "a new chance cuts the goal at once");
}

if (problems.length) {
  console.error("goalClipTail FAILED:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("goalClipTail: all checks passed");
