/**
 * StatsBomb → our pitch (lib/star/statsbombShots.ts sbToPitch), and a real
 * shot turned into one of our scenarios. Test page only (/star-statsbomb-dev).
 */
import { existsSync, readFileSync } from "node:fs";
import { sbToPitch, peopleOf, scenarioForShot, kindForShot, blockersOf, leadinPlan, type SbFile, type SbLeadinFile } from "../../lib/star/statsbombShots";
import { CX, PITCH_W, HALF_LEN, PEN_SPOT_Y, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_DEPTH } from "../../lib/star/pitch";

let fails = 0;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const at = (label: string, sb: [number, number], x: number, y: number) => {
  const p = sbToPitch(sb);
  check(`${label}: (${sb}) → (${x.toFixed(2)}, ${y.toFixed(2)})`, near(p.x, x) && near(p.y, y), p);
};

// The attacking goal (StatsBomb x = 120) is our goal line, y = 0.
at("goal centre", [120, 40], CX, 0);
at("near post (attacker's left)", [120, 36], POST_L, 0);
at("far post", [120, 44], POST_R, 0);
at("penalty spot", [108, 40], CX, PEN_SPOT_Y);
at("six-yard line", [114, 40], CX, SIX_DEPTH);
at("box corner, left", [102, 18], BOX_L, BOX_DEPTH);
at("box corner, right", [102, 62], BOX_R, BOX_DEPTH);
at("corner flag, left", [120, 0], 0, 0);
at("corner flag, right", [120, 80], PITCH_W, 0);
at("halfway line, centre", [60, 40], CX, HALF_LEN);
at("own goal", [0, 40], CX, 2 * HALF_LEN);
at("own corner", [0, 0], 0, 2 * HALF_LEN);

// The goal is the real width, not a stretched 6.8 m.
check("goal is 7.32 m wide", near(sbToPitch([120, 44]).x - sbToPitch([120, 36]).x, 7.32));
// Moving towards the goal (bigger StatsBomb x) means smaller y: never mirrored.
check("closer to goal is smaller y", sbToPitch([110, 40]).y < sbToPitch([100, 40]).y);
// The attacker's left (StatsBomb y < 40) is our left (x < CX).
check("attacker's left is our left", sbToPitch([110, 20]).x < CX);
// Monotonic everywhere (no folds at the box edges).
let mono = true;
for (let v = 0; v < 120; v += 0.5) if (sbToPitch([v + 0.5, 40]).y >= sbToPitch([v, 40]).y) mono = false;
for (let v = 0; v < 80; v += 0.5) if (sbToPitch([110, v + 0.5]).x <= sbToPitch([110, v]).x) mono = false;
check("monotonic across and along the pitch", mono);

// Blockers: a man on the line between ball and goal counts, one behind the ball does not.
check("a defender in the triangle blocks", blockersOf({ x: CX, y: 12 }, [{ x: CX, y: 6 }]) === 1);
check("a defender behind the ball does not", blockersOf({ x: CX, y: 12 }, [{ x: CX, y: 15 }]) === 0);

// A real file, if present: every shot converts and builds a scenario with the
// ball where the real ball was and the keeper where the real keeper stood.
const file = "data/statsbomb/shots.json";
if (existsSync(file)) {
  const data = JSON.parse(readFileSync(file, "utf8")) as SbFile;
  let built = 0, ballOk = 0, keeperOk = 0, withKeeper = 0, inPitch = 0;
  for (const s of data.shots) {
    const p = peopleOf(s);
    // StatsBomb logs one ball 0.1 yd past the goal line: half a metre of slack.
    if (p.ball.x >= -0.5 && p.ball.x <= PITCH_W + 0.5 && p.ball.y >= -0.5 && p.ball.y <= HALF_LEN * 2) inPitch++;
    const sc = scenarioForShot(s);
    built++;
    if (Math.hypot(sc.ball.x - p.ball.x, sc.ball.y - p.ball.y) < 0.02 || kindForShot(s) === "penalty") ballOk++;
    if (p.keeper) {
      withKeeper++;
      if (Math.hypot(sc.keeper.x - p.keeper.x, sc.keeper.y - p.keeper.y) < 0.02) keeperOk++;
    }
  }
  const n = data.shots.length;
  console.log(`file: ${n} shots, ${built} built, ball at the real spot ${ballOk}, keeper at the real spot ${keeperOk}/${withKeeper}`);
  check("every real ball is on the pitch", inPitch === n, inPitch);
  check("every shot builds a scenario", built === n);
  check("the ball is where the real ball was (all)", ballOk === n, ballOk);
  check("the keeper is where the real keeper was (95%+)", keeperOk >= withKeeper * 0.95, `${keeperOk}/${withKeeper}`);
  // The moving lead-in: ends with the ball and the shooter on the shot's spot.
  const lf = "data/statsbomb/leadins.json";
  if (existsSync(lf)) {
    const leads = (JSON.parse(readFileSync(lf, "utf8")) as SbLeadinFile).leadins;
    let n2 = 0, ends = 0, ordered = 0, starts = 0;
    for (const s of data.shots) {
      const l = leads[s.id];
      if (!l || l.passes.length < 2) continue;
      n2++;
      const plan = leadinPlan(s, l);
      const shotAt = sbToPitch(s.loc);
      const last = plan.keys[plan.keys.length - 1].ball;
      const you = plan.dots.find((d) => d.id === "you")!;
      if (Math.hypot(last.x - shotAt.x, last.y - shotAt.y) < 0.6 && Math.hypot(you.to.x - shotAt.x, you.to.y - shotAt.y) < 1e-6) ends++;
      if (plan.at.every((a, i) => i === 0 || a >= plan.at[i - 1]) && Math.abs(plan.at[plan.at.length - 1] - 1) < 1e-9) ordered++;
      if (l.start) starts++;
    }
    console.log(`lead-ins: ${n2} with 2+ passes, ${starts} with a 360 start frame`);
    check("every lead-in ends with the ball and the shooter on the shot", ends === n2, `${ends}/${n2}`);
    check("every lead-in's timeline runs 0 → 1 in order", ordered === n2, `${ordered}/${n2}`);
  }
} else {
  console.log("(no data/statsbomb/shots.json — run scripts/statsbomb/fetch_shots.py to check the real file too)");
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log("\nall passed");
