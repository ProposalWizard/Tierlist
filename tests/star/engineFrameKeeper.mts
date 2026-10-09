/**
 * THE KEEPER IS ALWAYS IN THE 3D FRAME (Harry, 9 Oct 2026: "no goalie in the
 * goal on some").
 *
 * The cause: CanvasMatch handed the 3D view a keeper only when its OWN 2D
 * picture drew him. A build-up or midfield-pass chance has no goal in the 2D
 * frame, so no keeper went over — but the 3D TV camera frames the action from
 * behind and above, and often shows the goal at the top. Empty net.
 *
 * Now every frame of every chance carries him (`keeperFrame`, `drawn` says
 * whether the 2D shows him), unless the scene has taken him off (technique
 * training). This checks it frame by frame for every chance kind, through
 * aiming, a shot or pass and its flight, and that the record sits in his goal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCENARIO_KINDS, buildScenario, goalInView, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
} from "../../lib/star/canvasEngine";
import { brainSetup, brainAim, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { keeperFrame, frameHasKeeper } from "../../lib/star/engineFrame";
import { mulberry32 } from "../../lib/star/season";
import { CX } from "../../lib/star/pitch";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };

const KIT = { shirt: "#facc15", trim: "#111827" };
const DT = 1 / 60;
let frames = 0, missing = 0, outOfGoal = 0, notFinite = 0, undrawnFrames = 0;
const undrawnKinds = new Set<string>();
for (const kind of SCENARIO_KINDS) {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = mulberry32(seed * 97 + kind.length);
    const sc = buildScenario(kind, rng, 40 + (seed * 7) % 55);
    initDefenders(sc, rng);
    brainSetup(sc, seed, 62);
    const check = () => {
      frames++;
      // CanvasMatch's rule: the record is made whenever the scene has a keeper
      const rec = frameHasKeeper(undefined) ? keeperFrame(sc.keeper, KIT, "f.png", undefined, goalInView(sc.kind)) : null;
      if (!rec) { missing++; return; }
      if (!rec.drawn) { undrawnFrames++; undrawnKinds.add(kind); }
      if (![rec.x, rec.y, rec.dive, rec.saveLunge, rec.idleT].every(Number.isFinite)) notFinite++;
      // in or around his goal: inside the box, never at the wrong end
      if (!(rec.y > -1.5 && rec.y < 18 && Math.abs(rec.x - CX) < 12)) outOfGoal++;
    };
    for (let i = 0; i < 30; i++) { brainAim(sc, DT); stepKeeper(sc, DT); check(); }
    // half the time at goal, half a pass across the box
    const tx = seed % 2 ? CX + (rng() - 0.5) * 6 : sc.ball.x + (rng() - 0.5) * 20;
    const ty = seed % 2 ? 0 : Math.max(2, sc.ball.y - 8);
    const L = Math.hypot(tx - sc.ball.x, ty - sc.ball.y) || 1;
    const ball = launch(sc, { x: (tx - sc.ball.x) / L, y: (ty - sc.ball.y) / L }, 0.4 + rng() * 0.6, { cx: 0, cy: rng() - 0.5 }, { power: 70, technique: 70 }, rng);
    brainStrike(sc, ball, seed);
    for (let i = 0; i < 240; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepReactions(sc, ball, DT, rng);
      brainStep(sc, ball, DT);
      stepKeeper(sc, DT);
      const out = stepBall(ball, sc, rng, DT);
      check();
      if (out) break;
    }
  }
}
console.log(`${frames} frames over ${SCENARIO_KINDS.length} kinds × 30 chances`);
ok(missing === 0, `every frame carries a keeper (${missing} missing)`);
ok(notFinite === 0, `every keeper record is a real number (${notFinite} not)`);
ok(outOfGoal === 0, `every keeper record is in or near his goal (${outOfGoal} out of it)`);
ok(undrawnKinds.has("buildup") && undrawnKinds.has("midfield_pass"), `the 2D-undrawn keeper is in the build-up and midfield-pass frames (${undrawnFrames} frames: ${[...undrawnKinds].join(", ")})`);
ok(!frameHasKeeper(false), "a scene with the keeper switched off carries none");

// The wiring: CanvasMatch hands the record over ungated, the 3D view places every keeper it gets.
const root = join(import.meta.dirname, "..", "..");
const cm = readFileSync(join(root, "components/star/CanvasMatch.tsx"), "utf8");
ok(/keeper: rec\.keeper,/.test(cm) && !/keeperInView \? rec\.keeper/.test(cm), "CanvasMatch hands over the keeper whether or not the 2D drew him");
ok(/!rec\.keeper && frameHasKeeper\(sceneRef\.current\?\.keeper\)/.test(cm), "CanvasMatch records the undrawn keeper");
const ev = readFileSync(join(root, "lib/star/style3d/engineView.ts"), "utf8");
ok(/if \(f\.keeper\) placeKeeper\(/.test(ev), "the 3D view places every keeper in the frame");
ok(/f\.keeper\.drawn !== false/.test(ev), "the 3D camera frames only on a keeper the 2D drew");

if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log("engineFrameKeeper: all passed");
