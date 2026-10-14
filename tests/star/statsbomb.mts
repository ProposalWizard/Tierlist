/**
 * StatsBomb → our pitch (lib/star/statsbombShots.ts sbToPitch), and a real
 * shot turned into one of our scenarios. Test page only (/star-statsbomb-dev).
 */
import { existsSync, readFileSync } from "node:fs";
import { sbToPitch, peopleOf, scenarioForShot, kindForShot, playKindForShot, blockersOf, leadinPlan, playedKeeperOff, frameHoldsShot, type SbFile, type SbLeadinFile } from "../../lib/star/statsbombShots";
import { buildScenario, goalInView, VIEW_ASPECT, type ScenarioKind, type Vec2, type Viewport } from "../../lib/star/canvasEngine";
import { brainSetup, brainAim } from "../../lib/star/keeperBrain";
import { enforceHardRules } from "../../lib/star/kindRules";
import { mulberry32 } from "../../lib/star/season";
import { CX, PITCH_W, HALF_LEN, PEN_SPOT_Y, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_DEPTH, NET_DEPTH } from "../../lib/star/pitch";

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
  // ── The real keeper's start survives into play (keeperHoldsStart) ──
  // Before: the keeper brain walked him to OUR set spot while you aimed.
  {
    let n3 = 0, held = 0, sumReal = 0, sumBefore = 0, sumAfter = 0, sumDrift = 0;
    for (const s of data.shots) {
      const p = peopleOf(s);
      if (!p.keeper) continue;
      n3++;
      // The picture as CanvasMatch receives it (openOn), after the kind's hard rules.
      const sc = scenarioForShot(s);
      enforceHardRules(sc);
      const start = { x: sc.keeper.x, y: sc.keeper.y };
      brainSetup(sc, 99, sc.keeperStrength, {});
      let maxMove = 0;
      for (let f = 0; f < 30; f++) { brainAim(sc, 1 / 60); maxMove = Math.max(maxMove, Math.hypot(sc.keeper.x - start.x, sc.keeper.y - start.y)); }
      if (maxMove < 0.01) held++;
      sumDrift += maxMove;
      sumReal += Math.max(0, p.keeper.y);
      sumBefore += playedKeeperOff(s, 2, false) ?? 0;
      sumAfter += playedKeeperOff(s, 2, true) ?? 0;
    }
    const f2 = (v: number) => (v / n3).toFixed(2);
    console.log(`keeper start: real ${f2(sumReal)} m off his line · played before ${f2(sumBefore)} m · after ${f2(sumAfter)} m (2 s of aiming, ${n3} shots)`);
    check("the real keeper stays on his real spot through the first 30 frames (all)", held === n3, `${held}/${n3}, mean drift ${f2(sumDrift)} m`);
    check("played keeper depth matches the real one within 0.15 m on average", Math.abs(sumAfter - sumReal) / n3 < 0.15, `${f2(sumAfter)} vs ${f2(sumReal)}`);
  }

  // ── Framing: every real man within 20 m of the ball and the whole goal on screen ──
  {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    // The camera before this change (statsbombShots.ts cameraFor, 13 Oct 2026).
    const oldCamera = (ball: Vec2, keeper: Vec2 | null): Viewport => {
      const pts = [ball, ...(keeper ? [keeper] : []), { x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH }];
      const pad = 4;
      const x1 = Math.min(...pts.map((p) => p.x)) - pad, x2 = Math.max(...pts.map((p) => p.x)) + pad;
      const yTop = Math.min(...pts.map((p) => p.y)) - pad * 0.875, yBot = Math.max(...pts.map((p) => p.y)) + pad * 0.875 + 6;
      const h = Math.min(42, Math.max(28, yBot - yTop, (x2 - x1) / VIEW_ASPECT));
      const w = h * VIEW_ASPECT;
      const cx = Math.min(PITCH_W + 3 - w / 2, Math.max(-3 + w / 2, (x1 + x2) / 2));
      let y1 = -NET_DEPTH - 2;
      if (ball.y + pad > y1 + h) y1 = ball.y + pad - h;
      return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
    };
    let n4 = 0, before = 0, after = 0, pens = 0, maxH = 0;
    for (const s of data.shots) {
      const kind = playKindForShot(s);
      if (!goalInView(kind) || kind === "penalty") { pens++; continue; }
      n4++;
      const p = peopleOf(s);
      if (frameHoldsShot(s, oldCamera(p.ball, p.keeper))) before++;
      const sc = scenarioForShot(s, { wideFrame: true });
      if (frameHoldsShot(s, sc.viewport)) after++;
      maxH = Math.max(maxH, sc.viewport.y2 - sc.viewport.y1);
    }
    const pc = (v: number) => `${((100 * v) / n4).toFixed(1)}%`;
    console.log(`framing: everyone within 20 m + the whole goal on screen — before ${before}/${n4} (${pc(before)}), after ${after}/${n4} (${pc(after)}); tallest frame ${maxH.toFixed(1)} m; ${pens} penalties keep the game's own camera`);
    check("every real man within 20 m and the whole goal are on screen (all non-penalty shots)", after === n4, `${after}/${n4}`);
  }

  // ── The real game is untouched: no game chance ever carries keeperHoldsStart ──
  {
    const kinds: ScenarioKind[] = ["one_on_one", "volley", "tight_angle", "long_range", "free_kick", "penalty", "cutback", "through_ball", "corner", "byline_cross"];
    let built2 = 0, flagged = 0, walked = 0;
    for (const k of kinds) for (let seed = 1; seed <= 100; seed++) {
      const sc = buildScenario(k, mulberry32(seed));
      built2++;
      if ("keeperHoldsStart" in sc) flagged++;
      const start = { x: sc.keeper.x, y: sc.keeper.y };
      brainSetup(sc, seed, sc.keeperStrength, {});
      for (let f = 0; f < 120; f++) brainAim(sc, 1 / 60);
      if (Math.hypot(sc.keeper.x - start.x, sc.keeper.y - start.y) > 0.01) walked++;
    }
    console.log(`game chances: ${built2} built, ${flagged} carry keeperHoldsStart, ${walked} keepers still take their set walk`);
    check("no game chance carries keeperHoldsStart", flagged === 0, flagged);
    check("game keepers still take their set walk (most chances)", walked > built2 * 0.5, `${walked}/${built2}`);
  }

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
