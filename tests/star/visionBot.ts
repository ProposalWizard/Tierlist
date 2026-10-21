/**
 * THE VISION BOT — a modelled player for the Vision drill, and the real
 * engine playing his pass. Not a test on its own: tests/star/vision.mts and
 * scripts/vision/curve.mts read it.
 *
 * What the bot does on a try (all times in seconds from the picture
 * appearing, GO):
 *   1. REACT: he takes in the picture (`react`).
 *   2. LOOK: a proper look at everyone takes `glance` per man. He looks for
 *      as long as he can and still tap (tap levels) or get his finger on the
 *      ball (kick levels) inside the window, keeping 3 × `timeSd` in hand.
 *      RUSH = the share of that proper look he had no time for (0 = all of
 *      it, 1 = none: he goes on his first impression).
 *   3. JUDGE: what he sees is the truth plus his error, and every error grows
 *      as he rushes (× 1 + `rushGain` · rush²; traps × the `trapRush` share):
 *        - offside: how far a man is from the line, ± `lineSd` metres;
 *        - a defender in the lane / on a man's back: those distances ± `distSd`;
 *        - how good a ball to him is (the engine's spaceScore) ± `scoreSd`.
 *      He picks the best ball among the men he did not judge to be a trap
 *      (if he judged them all traps, the best-looking one).
 *   4. TAP or KICK: a tap lands on the man he picked. A kick is the real
 *      thing: aimed at the man ± `aimSdDeg` (× 1 + 0.8 · rush), at the power that rolls the ball
 *      a little past him (measured off the real engine) ± `powerSd`, struck
 *      round the middle of the ball ± `contactSd`, and then PLAYED BY THE
 *      ENGINE (launch, stepDefenders, stepKeeper, stepReactions, stepBall at
 *      the match's 1/180 s): it judges whether it reached the right man, was
 *      offside, was cut out or went astray (lib/star/visionRound.ts judgeKick).
 *   5. TIMING: every time above wobbles by `timeSd`; a pull takes `flick`
 *      ± `timeSd`. Too late to the window, or holding the pull past the
 *      level's let-go time, is TOO SLOW.
 *
 * The numbers are a GOOD player's (a regular who has played the drill):
 * react 0.16 s, a proper look 0.25 s a man, a tap 0.1 s, finger on the ball
 * 0.06 s, timing ±0.04 s, offside read ±0.5 m, distances ±0.4 m, how good a
 * ball is ±0.08, aim ±2.5°, power ±10 %; rushed, his reads get up to 7×
 * worse and his kick 1.8× less accurate.
 * Reasoned, not measured on a person: it is a yardstick for the curve.
 */
import {
  launch, stepBall, stepDefenders, stepKeeper, stepReactions, initDefenders, buildScenario,
  type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { frameForNewView } from "../../lib/star/matchView";
import { mulberry32 } from "../../lib/star/season";
import {
  visionScenario, judgeKick, judgeTap, LANE_CUT_M, MARKED_M,
  type VisionPicture, type VisionVerdict,
} from "../../lib/star/visionRound";
import type { VisionLevel } from "../../lib/star/trainingLevelData";

export interface BotPlayer {
  react: number;
  glance: number;
  tapMotor: number;
  reachBall: number;
  flick: number;
  timeSd: number;
  scoreSd: number;
  /** How much every misjudgement grows when he has no time to look properly (×(1 + rushGain) at the worst). */
  rushGain: number;
  /** The share of that growth his read of a trap (offside, a man marked, a lane cut) takes. */
  trapRush: number;
  lineSd: number;
  distSd: number;
  aimSdDeg: number;
  powerSd: number;
  contactSd: number;
  skills: { power: number; technique: number };
}

export const GOOD_PLAYER: BotPlayer = {
  react: 0.16, glance: 0.25, tapMotor: 0.1, reachBall: 0.06, flick: 0.16, timeSd: 0.04,
  scoreSd: 0.08, rushGain: 6, trapRush: 1, lineSd: 0.5, distSd: 0.4,
  aimSdDeg: 2.5, powerSd: 0.1, contactSd: 0.18,
  skills: { power: 70, technique: 70 },
};

/** The match's own physics step. */
export const H = 1 / 180;
/** The new view's canvas shape on a 390 × 844 phone (height ÷ width). */
export const PHONE_HW = 1.8;
/** The camera angle the game plays at (Settings: decided, 20°). */
export const TILT_DEG = 20;

function gauss(r: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── The power that rolls a ground pass a given distance (measured off the engine) ──

let powerTable: { power: number; dist: number }[] | null = null;
/** How far an unopposed pass struck through the middle travels before it stops, per power. */
function rollTable(): { power: number; dist: number }[] {
  if (powerTable) return powerTable;
  const out: { power: number; dist: number }[] = [];
  for (let p = 0.04; p <= 1.0001; p += 0.02) {
    const sc = buildScenario("midfield_pass", mulberry32(7), 62, 60);
    sc.ball = { x: 6, y: 40 };
    sc.player = { x: 6, y: 40.8 };
    sc.defenders = [];
    sc.secondaryRunners = [];
    sc.runner = null;
    sc.teammates = [];
    sc.follower.x = -400; sc.follower.y = 400;
    sc.keeper.done = true;
    sc.viewport = { x1: -500, x2: 500, y1: -500, y2: 500 };
    const rng = mulberry32(11);
    const ball = launch(sc, { x: 1, y: 0 }, p, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
    let t = 0;
    for (; t < 12; t += H) {
      const res = stepBall(ball, sc, rng, H);
      if (res) break;
      if (Math.hypot(ball.vel.x, ball.vel.y) < 0.3 && ball.z < 0.1) break;
    }
    out.push({ power: p, dist: ball.pos.x - 6 });
  }
  powerTable = out;
  return out;
}

/** The power a good passer gives a ball to a man `d` metres away: it would roll on about a third past him. */
export function passPowerFor(d: number): number {
  const want = d * 1.35 + 2;
  const t = rollTable();
  for (let i = 1; i < t.length; i++) {
    if (t[i].dist >= want) {
      const a = t[i - 1], b = t[i];
      return a.power + (b.power - a.power) * ((want - a.dist) / Math.max(1e-6, b.dist - a.dist));
    }
  }
  return 1;
}

// ── The real engine plays the pass ──

/** Play a kick from the picture's ball on the real engine; the engine's verdict. */
export function playKick(
  pic: VisionPicture, aim: { x: number; y: number }, power: number, contact: { cx: number; cy: number },
  skills: { power: number; technique: number }, seed: number, opts: { ignoreOffside?: boolean; aimedAt?: number | null } = {},
): VisionVerdict {
  const sc: Scenario = visionScenario(pic, seed);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  initDefenders(sc, rng);
  // The play area, as the match frames it (the ball out of it is out).
  frameForNewView(sc, PHONE_HW, false, TILT_DEG);
  const dir = { x: aim.x - sc.ball.x, y: aim.y - sc.ball.y };
  const ball: Ball = launch(sc, dir, Math.max(0.02, Math.min(1, power)), contact, skills, rng);
  // The pass checks ask "does the ball get there", not "is he onside".
  if (opts.ignoreOffside) for (const r of sc.secondaryRunners) r.offside = false;
  // The law's flags as it was struck (the drill reads them on the first step of the flight).
  const atStrike = sc.secondaryRunners.map((r) => !!r.offside);
  const aimed = opts.aimedAt ?? null;
  let res: Outcome | null = null;
  for (let t = 0; t < 8; t += H) {
    stepDefenders(sc, H, sc.player, false, ball);
    stepKeeper(sc, H);
    stepReactions(sc, ball, H, rng);
    res = stepBall(ball, sc, rng, H);
    const v = judgeKick(pic, sc, res, aimed, atStrike);
    if (v) return v;
  }
  return judgeKick(pic, sc, res ?? "short", aimed, atStrike) ?? judgeKick(pic, sc, "short", aimed, atStrike)!;
}

// ── One try ──

export interface BotTry { verdict: VisionVerdict; picked: number | null; decideS: number }

export function botTry(pic: VisionPicture, cfg: VisionLevel, who: BotPlayer, rng: () => number, seed: number): BotTry {
  const jitter = () => gauss(rng) * who.timeSd;
  const start = who.react + jitter();
  const motor = cfg.kick ? who.reachBall : who.tapMotor;
  // The time he has to look before he must act (keeping a little in hand),
  // against a proper look at everyone. No time at all: he goes on his first
  // impression (rush 1) and hopes he is in time.
  const need = pic.options.length * who.glance;
  const have = Math.max(0, Math.min(need, cfg.window - who.react - motor - 3 * who.timeSd));
  const rush = Math.max(0, Math.min(1, 1 - have / need));
  // Every misjudgement grows as he rushes: a glance reads the picture worse than a look.
  const k = 1 + who.rushGain * rush * rush;
  const kt = 1 + who.rushGain * rush * rush * who.trapRush;
  let pick = -1, best = -Infinity, fallback = -1, fbest = -Infinity;
  pic.options.forEach((o, i) => {
    const offside = Number.isFinite(o.lineGap) && o.lineGap + gauss(rng) * who.lineSd * kt < 0;
    const cut = o.lane + gauss(rng) * who.distSd * kt < LANE_CUT_M;
    const marked = o.space + gauss(rng) * who.distSd * kt < MARKED_M;
    // The engine scores an offside man 0; he sees a man in space, not a score.
    const look = (o.onside ? o.score : 0.45) + gauss(rng) * who.scoreSd * k;
    if (look > fbest) { fbest = look; fallback = i; }
    if (offside || cut || marked) return;
    if (look > best) { best = look; pick = i; }
  });
  if (pick < 0) pick = fallback;
  const decideS = start + have + motor + jitter();
  if (decideS > cfg.window) return { verdict: judgeTap(pic, null), picked: null, decideS };
  if (!cfg.kick) return { verdict: judgeTap(pic, pick), picked: pick, decideS };
  // The pull: let go inside the level's let-go time.
  const pull = who.flick + Math.abs(jitter());
  if (pull > cfg.letGo) return { verdict: judgeTap(pic, null), picked: pick, decideS };
  const m = pic.options[pick];
  const d = Math.hypot(m.x - pic.ball.x, m.y - pic.ball.y);
  // A snatched pass is a less accurate one.
  const ks = 1 + 0.8 * rush;
  const err = (gauss(rng) * who.aimSdDeg * ks * Math.PI) / 180;
  const dx = m.x - pic.ball.x, dy = m.y - pic.ball.y;
  const aim = {
    x: pic.ball.x + dx * Math.cos(err) - dy * Math.sin(err),
    y: pic.ball.y + dx * Math.sin(err) + dy * Math.cos(err),
  };
  const power = passPowerFor(d) * (1 + gauss(rng) * who.powerSd * ks);
  const contact = { cx: Math.max(-1, Math.min(1, gauss(rng) * who.contactSd)), cy: Math.max(-1, Math.min(1, gauss(rng) * who.contactSd)) };
  return { verdict: playKick(pic, aim, power, contact, who.skills, seed, { aimedAt: pick }), picked: pick, decideS };
}
