/**
 * HEADERS AND VOLLEYS WITH NO ARROW (lib/star/airTap.ts) — goals per 100 at
 * Aerial 30 / 60 / 90, next to the timed "Head it?" screen with the arrow
 * (scripts/aerial/timer-measure.mts: header 19.0 / 25.0 / 35.3, volley
 * 19.3 / 26.3 / 35.3).
 *
 *   npx tsx scripts/aerial/tap-measure.mts [--n=600] [--sd=0.15] [--median=0.9] [--spread=0.35]
 *
 * The same pictures, seeds, tap times and late touch as timer-measure.mts.
 * Only the aim changes: there is no arrow, so the bot aims with the tap.
 *  - WHERE it means to put it: 3 in 4 at the far corner from the keeper,
 *    0.35-0.95 m inside the post (timer-measure's own target).
 *  - It taps the side of the ball that sends it there (airTap.ts), 60% on
 *    top of a header (nodded down), else through the middle; a volley a
 *    little over the middle.
 *  - The finger lands --sd ball radii off the spot it meant, both ways
 *    (normal). An assumption: nobody has measured real taps here.
 *  --moves: each chance also picks its aerial move (lib/star/aerialMoves.ts)
 *    and the strike gets that move's tint (aerialStrikeTint), as the match
 *    does. Flair is Technique in the game; here it is set to the Aerial
 *    (--flair=N to fix it), so the bicycle and scorpion gates open at 90.
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne, airStrikeTimerS, airLateContact } from "../../lib/star/airborneChance";
import { airTapStrike, airTapAimX, AIR_TAP_POST_CX, AIR_TAP_INSET_M, AIR_TAP_CLEAN_PAD, AIR_TAP_CLEAN_K, AIR_TAP_POWER, type AirKind } from "../../lib/star/airTap";
import { readFileSync } from "node:fs";
import type { Scenario, ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, GOAL_W, POST_L, POST_R } from "../../lib/star/pitch";
import { pickAerialMove, aerialStrikeTint, type AerialMove } from "../../lib/star/aerialMoves";
import { airZOf } from "../../lib/star/airDrawings";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const SD = Number(arg("sd", "0.15"));
const MED = Number(arg("median", "0.9")), SPREAD = Number(arg("spread", "0.35"));
const TIME_SD = 0.22;
const MOVES = process.argv.includes("--moves");
const FLAIR = arg("flair", "");
/** How often each move was picked, over the last tapRate calls. */
export const moveCount: Record<string, number> = {};

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// timer-measure.mts's own height and tap time per seed.
function liftFor(kind: AirKind, seed: number): number {
  const r = mulberry32((seed ^ 0x1f7a3) >>> 0);
  if (kind === "header") return 0.84 + 0.16 * r();
  return Math.max(0, Math.min(1, 0.55 + gauss(r) * TIME_SD));
}
function tapTimeFor(seed: number): number {
  const r = mulberry32((seed ^ 0x7a9b1) >>> 0);
  return MED * Math.exp(gauss(r) * SPREAD);
}

/** The tap that aims at goal-line x `tx`. */
function cxFor(tx: number): number {
  return (-(tx - CX) / (GOAL_W / 2 - AIR_TAP_INSET_M)) * AIR_TAP_POST_CX;
}

export function tapRate(kind: AirKind, aerial: number, n = N, sd = SD): { goals: number; late: number } {
  let goals = 0, lateN = 0;
  for (let i = 1; i <= n; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    const late = tapTimeFor(seed) > airStrikeTimerS(kind, aerial);
    if (late) lateN++;
    const side = (seed & 1) ? 1 : -1;
    const lift0 = liftFor(kind, seed);
    let st: ReturnType<typeof airTapStrike> | null = null;
    const thumbFor = (sc: Scenario, r: () => number): Thumb => {
      const farSide = sc.keeper.x < CX ? 1 : -1;
      const s = r() < 0.75 ? farSide : -farSide;
      const inset = 0.35 + r() * 0.6;
      const targetX = s > 0 ? POST_R - inset : POST_L + inset;
      const meantCy = kind === "header" ? (r() < 0.6 ? -0.35 : 0) : -0.1;
      let cx = cxFor(targetX) + gauss(r) * sd, cy = meantCy + gauss(r) * sd;
      const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
      st = late
        ? airTapStrike(kind, sc.ball, { ...airLateContact(kind, lift0, side), late: true }, aerial)
        : airTapStrike(kind, sc.ball, { cx, cy, lift: lift0 }, aerial);
      let ax = late ? CX : airTapAimX(cx);
      let power = st.aim.power;
      if (MOVES) {
        const mate = sc.teammates[0];
        const move: AerialMove = pickAerialMove({ kind, ballZ: airZOf(sc), inDir: mate ? { x: sc.ball.x - mate.x, y: sc.ball.y - mate.y } : { x: 0, y: -1 },
          toGoal: { x: CX - sc.ball.x, y: -sc.ball.y }, aerial, flair: FLAIR ? Number(FLAIR) : aerial, seed });
        moveCount[move] = (moveCount[move] ?? 0) + 1;
        const dx = ax - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy) || 1;
        const t = aerialStrikeTint(move, { x: dx / L, y: dy / L }, power, seed);
        ax = sc.ball.x + (t.dir.x / -t.dir.y) * sc.ball.y;
        power = t.power;
      }
      return { aimErrDeg: 0, power, contact: { cx: st.contact.cx, cy: st.contact.cy }, intent: "placed", targetX, aimX: ax };
    };
    const o: LabOptions = { skills: { power: 60, technique: 60 }, thumbFor };
    o.afterLaunch = (ball, sc) => {
      const c = st!.contact;
      applyAirborne(ball, sc, { kind, lift: c.lift ?? lift0, cx: c.cx, cy: c.cy, tech: 60, aerial });
    };
    if (shoot(kind as ScenarioKind, seed, o).goal) goals++;
  }
  return { goals: (100 * goals) / n, late: (100 * lateN) / n };
}

const isMain = process.argv[1]?.endsWith("tap-measure.mts");
const GRID = arg("grid", "");
if (isMain && GRID) {
  // Tuning: each line "kind pad k power" tried in turn (the module's tables, changed in place).
  for (const line of readFileSync(GRID, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [kind, pad, k, pw] = line.split(/\s+/) as [AirKind, string, string, string];
    (AIR_TAP_CLEAN_PAD as Record<AirKind, number>)[kind] = Number(pad);
    (AIR_TAP_CLEAN_K as Record<AirKind, number>)[kind] = Number(k);
    (AIR_TAP_POWER as Record<AirKind, number>)[kind] = Number(pw);
    console.log(`${line.padEnd(28)} ${[30, 60, 90].map((a) => tapRate(kind, a).goals.toFixed(1).padStart(6)).join("  ")}`);
  }
} else if (isMain) {
  console.log(`finger ± ${SD} ball radii (assumed); tap time log-normal median ${MED} s; ${N} chances a cell`);
  console.log(`timed screen with the arrow (timer-measure.mts): header 19.0 / 25.0 / 35.3 · volley 19.3 / 26.3 / 35.3`);
  for (const kind of ["header", "volley"] as const) {
    const cells = [30, 60, 90].map((a) => tapRate(kind, a));
    console.log(`\n${kind.toUpperCase()}                Aerial 30      60      90`);
    console.log(`goals per 100              ${cells.map((x) => x.goals.toFixed(1).padStart(6)).join("  ")}`);
    console.log(`ran out, per 100           ${cells.map((x) => x.late.toFixed(1).padStart(6)).join("  ")}`);
    if (MOVES) { console.log(`moves picked (all three columns): ${JSON.stringify(moveCount)}`); for (const k of Object.keys(moveCount)) delete moveCount[k]; }
  }
}
