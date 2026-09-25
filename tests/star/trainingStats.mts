/**
 * PACE, VISION AND FREE KICK EACH DO SOMETHING YOU CAN FEEL (Mikey, 25 Sep 2026).
 *
 * - Vision: a smooth curve of extra team-mates. 40 (where a career starts) is
 *   exactly what it was; each 10 points above adds a quarter of a man on
 *   average, so 80 is +1 and 100 is +1.5.
 * - Pace: the Touch Mode chase gets quicker, 6.8 m/s at 40 to 8.4 at 100.
 * - Free kick: corners are struck with it (like free kicks and penalties), and
 *   a better rating hands you more free kicks and corners.
 *
 * Run: npx tsx tests/star/trainingStats.mts
 */
import {
  buildWeightedScenario, supportSeen, touchChaseSpeed, stepTouchChase,
  type Scenario, type Ball,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { mateBodiesOf } from "../../lib/star/authoredChance";
import { setPieceSkills } from "../../lib/star/setPieces";
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const log: string[] = [];

// ── Vision ──
{
  const avg = (v: number) => {
    let s = 0; const n = 4000;
    for (let i = 0; i < n; i++) s += supportSeen(v, (i + 0.5) / n);
    return s / n;
  };
  check(supportSeen(40, 0) === 1 && supportSeen(40, 0.99) === 1, "vision 40 is exactly the one extra man it always was");
  check(Math.abs(avg(60) - 1.5) < 0.01, `vision 60 averages +1.5 (got ${avg(60).toFixed(3)})`);
  check(Math.abs(avg(80) - 2) < 0.01, `vision 80 averages +2 (got ${avg(80).toFixed(3)})`);
  check(Math.abs(avg(100) - 2.5) < 0.01, `vision 100 averages +2.5 (got ${avg(100).toFixed(3)})`);
  let prev = -1;
  for (let v = 40; v <= 100; v += 5) { const a = avg(v); check(a >= prev, `vision never gives fewer men as it rises (${v})`); prev = a; }
  check(supportSeen(30, 0) === 0, "below 40 is still nobody extra");

  // Through the real chance builder.
  const mates = (v: number) => {
    let s = 0, n = 0;
    for (let i = 0; i < 1500; i++) {
      const sc = buildWeightedScenario(mulberry32(2000 + i), "ST", 62, 60, v);
      if (sc.kind === "penalty" || sc.kind === "free_kick") continue;
      n++; s += mateBodiesOf(sc).length;
    }
    return s / n;
  };
  const m40 = mates(40), m80 = mates(80), m100 = mates(100);
  log.push(`vision: team-mates per chance ${m40.toFixed(2)} at 40, ${m80.toFixed(2)} at 80, ${m100.toFixed(2)} at 100`);
  check(m80 - m40 > 0.8 && m80 - m40 < 1.2, `80 vision is about one more team-mate than 40 in real chances (+${(m80 - m40).toFixed(2)})`);
  check(m100 > m80, "100 vision gives more than 80");
}

// ── Pace: the Touch Mode chase ──
{
  check(Math.abs(touchChaseSpeed(40) - 6.8) < 1e-9, "pace 40 chases at 6.8 m/s");
  check(Math.abs(touchChaseSpeed(100) - 8.4) < 1e-9, "pace 100 chases at 8.4 m/s");
  const catchTime = (pace: number) => {
    const sc = { player: { x: 30, y: 30 }, touchChaseArmed: true } as unknown as Scenario;
    const ball = { pos: { x: 30, y: 22 } } as unknown as Ball;
    let t = 0;
    while (t < 5 && !stepTouchChase(sc, ball, 1 / 180, touchChaseSpeed(pace))) t += 1 / 180;
    return t;
  };
  const slow = catchTime(40), quick = catchTime(100);
  log.push(`pace: an 8 m chase takes ${slow.toFixed(2)}s at 40, ${quick.toFixed(2)}s at 100`);
  check(quick < slow * 0.85, "a quick player reaches his own touch clearly sooner");
}

// ── Free kick: corners are struck with it ──
{
  const open = { power: 60, technique: 50 };
  check(setPieceSkills(open, 90, "corner").technique === Math.round(50 * 0.4 + 90 * 0.6), "a corner uses 60% free kick, 40% technique");
  check(setPieceSkills(open, 90, "one_on_one").technique === 50, "open play still uses plain technique");
}

// ── Free kick: taking more of them ──
{
  const deadBalls = (fk: number | undefined) => {
    const inputs: HiddenMatchInputs = { teamStrength: 72, oppStrength: 68, playerSkill: 60, position: "CM", freeKick: fk };
    let count = 0;
    for (let m = 0; m < 600; m++) {
      const rng = mulberry32(9000 + m);
      const state = newMatch(rng);
      for (let guard = 0; guard < 40; guard++) {
        const step = advanceUntilInvolved(state, inputs, rng, 90);
        if (!step.request) break;
        if (step.request.kinds.includes("free_kick") || step.request.kinds.includes("corner")) count++;
        resolveScenario(state, "saved");
      }
    }
    return count / 600;
  };
  const none = deadBalls(undefined), at40 = deadBalls(40), at100 = deadBalls(100);
  log.push(`free kick: free kicks + corners per match ${at40.toFixed(2)} at 40, ${at100.toFixed(2)} at 100 (no rating: ${none.toFixed(2)})`);
  check(Math.abs(at40 - none) < 1e-9, "a free-kick rating of 40 hands you exactly the old share");
  check(at100 > at40 * 1.2, "a rating of 100 hands you clearly more set pieces");
}

for (const l of log) console.log("  " + l);
if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — pace, vision and free kick each change the game");
