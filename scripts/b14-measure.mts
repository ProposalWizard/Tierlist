/**
 * B14 (running after a chance): 500 matches, before and after.
 *
 *   npx tsx scripts/b14-measure.mts [matches=500] [passShare=0.35]
 *
 * The hidden match (lib/star/hiddenMatch.ts) hands you your chances as it does
 * in a career; each one is built by makeChance (the game's own chance maker)
 * and played out in the real engine with CanvasMatch's substep stack. "You"
 * are a bot: in an open-play chance with a goal in it you pass to a team-mate
 * `passShare` of the time, otherwise you shoot. The same seeds are played two
 * ways:
 *   BEFORE  the game as it was (Chances: Old): a pass that finds its man is
 *           "delivered"; the give-and-go roll (chainReturnChance) may hand you
 *           a NEW picture (another chance).
 *   AFTER   THE RUN (playOn.ts startPlayOnRun, Auto run, nobody steering): you
 *           run on; the man reads you (stickRead) and shoots or passes back;
 *           a ball you reach is your next kick in the same picture.
 * Every link's result goes back into the hidden match (resolveScenario), so
 * the rest of the match follows from what happened, as in the game.
 */
import { newMatch, tick, resolveScenario, type HiddenMatchInputs, type ScenarioResult } from "../lib/star/hiddenMatch";
import { makeChance } from "../lib/star/chanceMaker";
import { mulberry32 } from "../lib/star/season";
import {
  launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders, orderableRunners, goalInView, acceptsCaptainOrders,
  chainReturnChance, chainKindFor, resetForTouchOn, CHAIN_MAX, OUTCOME_TEXT, passQuality,
  type Scenario, type Ball, type Outcome, type ScenarioKind,
} from "../lib/star/canvasEngine";
import { startPlayOnRun, stepPlayOn, steerPlayOn, sprintPlayOn, MAX_LAY_OFFS, type PlayOn } from "../lib/star/playOn";
import { takeEnergySpent } from "../lib/star/legs";

const N = Number(process.argv[2] ?? 500);
const PASS_SHARE = Number(process.argv[3] ?? 0.35);
const H = 1 / 180;
const BOX_BOT = process.env.B14_BOT === "box";

const resultFor = (res: Outcome): ScenarioResult => {
  if (OUTCOME_TEXT[res].kind === "goal") return "goal";
  if (res === "delivered" || res === "touchOn") return "delivered";
  if (res === "tackled" || res === "blocked") return "lost";
  return "saved";
};

interface Tally {
  chances: number; yourShots: number; yourGoals: number; passes: number; mateShots: number; mateGoals: number;
  backToYou: number; newPicture: number; teamGoalsSim: number; oppGoals: number; energy: number; sprintS: number;
  byQ: Record<string, { reads: number; back: number }>;
}
const newTally = (): Tally => ({ chances: 0, yourShots: 0, yourGoals: 0, passes: 0, mateShots: 0, mateGoals: 0, backToYou: 0, newPicture: 0, teamGoalsSim: 0, oppGoals: 0, energy: 0, sprintS: 0, byQ: {} });

function shoot(sc: Scenario, rng: () => number): Ball {
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2;
  const side = rng() < 0.5 ? -1 : 1;
  const tx = gcx + side * (0.6 + rng() * 2.6);
  const dir = { x: tx - sc.ball.x, y: 0 - sc.ball.y };
  const b = launch(sc, dir, 0.7 + rng() * 0.25, { cx: (rng() - 0.5) * 0.3, cy: (rng() - 0.5) * 0.4 }, { power: 70, technique: 70 }, rng);
  b.youStruckAtGoal = true;
  return b;
}

function pass(sc: Scenario, rng: () => number, i: number): { ball: Ball; to: { x: number; y: number } } | null {
  const mates = orderableRunners(sc);
  if (!mates.length) return null;
  const to = mates[i % mates.length].pos;
  const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y, d = Math.hypot(dx, dy) || 1;
  const ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
  ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp }; ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
  return { ball, to: { ...to } };
}

/** Play one ball out. Returns the outcome and whether the run caught a pass back. */
function playOut(sc: Scenario, ball: Ball, rng: () => number, po: PlayOn | null, layOffsLeft: number, t: Tally): { res: Outcome; caught: boolean } {
  const lr = mulberry32(0x51ab ^ Math.floor(rng() * 1e9));
  let res: Outcome | null = null;
  let qRead: string | null = null;
  for (let s = 0; s < 14 && !res; s += H) {
    stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, rng);
    if (po && BOX_BOT && !po.layOffLive) {
      // B14_BOT=box: you steer (W A S D + Shift) into the box, the far side of the man you passed to.
      const gcx = (sc.goal.x1 + sc.goal.x2) / 2, p = sc.player;
      const tx = gcx + ((sc.receivedAt ?? ball.pos).x < gcx ? 5 : -5), ty = 10;
      const ux = tx - p.x, uy = ty - p.y, ul = Math.hypot(ux, uy) || 1;
      steerPlayOn(po, ul < 1 ? 0 : (ux / ul) * 0.9, ul < 1 ? 0 : (uy / ul) * 0.9); sprintPlayOn(po, ul > 4);
    } else if (po && BOX_BOT) { const p = sc.player, lx = ball.pos.x + ball.vel.x * 0.3 - p.x, ly = ball.pos.y + ball.vel.y * 0.3 - p.y, l = Math.hypot(lx, ly) || 1; steerPlayOn(po, lx / l, ly / l); sprintPlayOn(po, true); }
    if (po) {
      const before = po.stick?.choice ?? null;
      if (stepPlayOn(po, sc, ball, H, lr, layOffsLeft) === "caught") {
        t.energy += takeEnergySpent(po.stick!.legs!);
        return { res: "delivered", caught: true };
      }
      if (po.stick?.legs?.sprinting) t.sprintS += H;
      if (before === null && po.stick?.choice) {
        const q = passQuality(sc);
        qRead = q < 0.55 ? "q<0.55" : q < 0.65 ? "q0.55-0.65" : "q>=0.65";
        (t.byQ[qRead] ??= { reads: 0, back: 0 }).reads++;
        if (po.stick.choice !== "shoot") t.byQ[qRead].back++;
      }
    }
    res = stepBall(ball, sc, rng, H);
    if (ball.event) ball.event = null;
  }
  if (po?.stick?.legs) t.energy += takeEnergySpent(po.stick.legs);
  return { res: res ?? "wide", caught: false };
}

function playMatch(seed: number, after: boolean, t: Tally) {
  const mrng = mulberry32(seed * 7919 + 13);
  const st = newMatch(mrng);
  const inputs: HiddenMatchInputs = { teamStrength: 75, oppStrength: 75, playerSkill: 70, pace: 70, freeKick: 60, position: "ST", livePenalties: true, context: {} } as HiddenMatchInputs;
  let link = 0;
  while (st.minute < 90) {
    const u0 = st.userScore, o0 = st.oppScore;
    const { events, request } = tick(st, inputs, mrng);
    for (const e of events) if (e.isGoal && e.teammateGoal) t.teamGoalsSim++;
    if (request) {
      t.chances++;
      // Each chance has its own streams, so BEFORE and AFTER build the same picture.
      const crng = mulberry32((seed * 1000003 + link * 7717) >>> 0); link++;
      let sc: Scenario = makeChance({ source: { from: "kind", kind: request.kinds[Math.floor(crng() * request.kinds.length)] }, rng: crng }).sc;
      initDefenders(sc, crng);
      let depth = 0, layOffsLeft = MAX_LAY_OFFS, again = true, i = 0;
      while (again) {
        again = false; i++;
        const brng = mulberry32((seed * 31 + link * 101 + i * 7) >>> 0);
        const open = goalInView(sc.kind) && acceptsCaptainOrders(sc.kind) && orderableRunners(sc).length > 0;
        const wantPass = open && brng() < (i > 1 ? 0.15 : PASS_SHARE);
        if (wantPass) {
          const p = pass(sc, crng, i)!;
          t.passes++;
          let po: PlayOn | null = null;
          if (after) {
            sc.player = { x: sc.ball.x, y: sc.ball.y };
            po = startPlayOnRun(sc, brng, p.to, { pace: 70, physical: 70, energy: 80 });
          }
          const { res, caught } = playOut(sc, p.ball, crng, po, layOffsLeft, t);
          if (sc.receiverShot) { t.mateShots++; if (OUTCOME_TEXT[res].kind === "goal") t.mateGoals++; }
          resolveScenario(st, resultFor(res));
          if (caught) {
            t.backToYou++; layOffsLeft--;
            resetForTouchOn(sc, { x: p.ball.pos.x, y: p.ball.pos.y });
            again = true;
          } else if (res === "delivered" && !after && depth < CHAIN_MAX && crng() < chainReturnChance(sc)) {
            const at = sc.receivedAt ?? p.to;
            const kind: ScenarioKind = chainKindFor(at, crng, Math.max(sc.passDifficulty, sc.passAmbition ?? 0));
            sc = makeChance({ source: { from: "kind", kind }, rng: crng }).sc;
            initDefenders(sc, crng);
            depth++; t.newPicture++; again = goalInView(sc.kind);
          }
        } else {
          const b = shoot(sc, crng);
          t.yourShots++;
          const { res } = playOut(sc, b, crng, null, 0, t);
          if (OUTCOME_TEXT[res].kind === "goal") t.yourGoals++;
          resolveScenario(st, resultFor(res));
        }
      }
    }
    t.oppGoals += st.oppScore - o0;
    void u0;
  }
}

const before = newTally(), after = newTally();
for (let s = 1; s <= N; s++) { playMatch(s, false, before); playMatch(s, true, after); }
const f = (n: number) => (n / N).toFixed(2);
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
for (const [label, t] of [["BEFORE", before], ["AFTER", after]] as const) {
  console.log(`\n== ${label} (${N} matches, you pass ${(PASS_SHARE * 100).toFixed(0)}% of open-play chances)`);
  console.log(`chances handed to you ${f(t.chances)} a match · your shots ${f(t.yourShots)} · your goals ${f(t.yourGoals)}`);
  console.log(`your passes ${f(t.passes)} · team-mate shots off them ${f(t.mateShots)} · team-mate goals off them ${f(t.mateGoals)}`);
  console.log(`ball back to you: in the same picture ${f(t.backToYou)} · a new picture ${f(t.newPicture)}`);
  console.log(`team goals with you on the ball or passing ${f(t.yourGoals + t.mateGoals)} · team goals from the rest of the match ${f(t.teamGoalsSim)} · their goals ${f(t.oppGoals)}`);
  if (label === "AFTER") {
    console.log(`sprinting ${(t.sprintS / N).toFixed(1)} s a match · energy spent sprinting ${(t.energy / N).toFixed(2)} a match`);
    for (const [k, v] of Object.entries(t.byQ).sort()) console.log(`  passer ${k}: back to you ${pct(v.back, v.reads)} of ${v.reads} reads`);
  }
}
