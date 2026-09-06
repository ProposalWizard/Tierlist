import {
  newRun, applySteer, applyBurst, stepRun, runProgress, runSpeed,
  BASE_SPEED, PACE_SPEED,
  type FpRunState, type RunPhase,
} from "../../lib/star/firstPersonDribble";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE FIRST-PERSON DUEL — IS IT ACTUALLY FAIR, ACTUALLY WINNABLE, ACTUALLY
 * REQUIRING A BURST?
 *
 * Same idiom as every other suite here: a problems[] array, PASS/FAIL,
 * process.exit(1) on failure. What makes this suite worth writing at all is
 * that every assertion is a claim about FEEL, not just "doesn't crash" —
 * each one is picked because if it were false, the mode would not actually
 * play the way it's meant to.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const DT = 1 / 60;
const GUARD = 30000; // enough ticks at 1/60s to cover RUN_TIMEOUT (20s) several times over

function runToEnd(s: FpRunState, dt: number, onTick?: (s: FpRunState) => void): RunPhase {
  let guard = 0;
  while (s.phase === "running" && guard++ < GUARD) {
    onTick?.(s);
    stepRun(s, dt);
  }
  return s.phase;
}

// ── Determinism — same seed twice, identical outcome and separations ──────
{
  let mismatches = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const a = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed) });
    const b = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed) });
    const scriptedBurst = (s: FpRunState) => {
      if (s.active >= 0 && s.defenders[s.active].phase === "telegraph") {
        applyBurst(s, s.defenders[s.active].commitSide === 1 ? -1 : 1);
      }
    };
    const pa = runToEnd(a, DT, scriptedBurst);
    const pb = runToEnd(b, DT, scriptedBurst);
    const sepsA = a.defenders.map(d => d.sepAtContact ?? -1);
    const sepsB = b.defenders.map(d => d.sepAtContact ?? -1);
    if (pa !== pb || sepsA.some((v, i) => Math.abs(v - sepsB[i]) > 1e-9)) mismatches++;
  }
  check(mismatches === 0, `same seed produces identical outcome + separations every time (${mismatches}/50 mismatched)`);
}

// ── Do nothing and you lose — a hard invariant, not a tendency ────────────
{
  let losses = 0;
  const seeds = 200;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(seed * 3 + 1) });
    const phase = runToEnd(s, DT);
    if (phase === "lost") losses++;
  }
  check(losses === seeds, `standing completely still loses every single time (${losses}/${seeds}) — his own lunge alone can never clear CLEAR_SEP`);
}

// ── A scripted "read the telegraph, burst the other way" oracle wins
// almost every time — the mode is genuinely winnable and the telegraph is
// a real signal ─────────────────────────────────────────────────────────
function oracleRun(seed: number, oppStrength: number, mode: "correct" | "wrong"): RunPhase {
  const s = newRun({ pace: 60, oppStrength, rng: mulberry32(seed * 101 + 7) });
  let lastActive = -1;
  let announced = false;
  return runToEnd(s, DT, st => {
    if (st.active !== lastActive) { lastActive = st.active; announced = false; }
    if (st.active >= 0 && !announced) {
      const def = st.defenders[st.active];
      if (def.phase === "telegraph") {
        announced = true;
        const dir = mode === "correct"
          ? (def.commitSide === 1 ? -1 : 1)
          : def.commitSide;
        applyBurst(st, dir);
      }
    }
  });
}

{
  const seeds = 300;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) if (oracleRun(seed, 60, "correct") === "clear") cleared++;
  const rate = cleared / seeds;
  check(rate >= 0.95, `reading the telegraph and bursting away wins the run almost every time (${(rate * 100).toFixed(1)}%)`);
}

// ── Burst INTO the telegraphed side and you lose almost every time ────────
{
  const seeds = 300;
  let lost = 0;
  for (let seed = 1; seed <= seeds; seed++) if (oracleRun(seed, 60, "wrong") === "lost") lost++;
  const rate = lost / seeds;
  check(rate >= 0.95, `bursting into the side he committed to loses almost every time (${(rate * 100).toFixed(1)}%)`);
}

// ── Bursting the instant he starts closing (before he's shown a side) is
// punished — worse than reading the telegraph, but not zero, since his
// mirror mostly (not perfectly) recovers the lost ground ─────────────────
{
  const seeds = 300;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    let lastActive = -1;
    let fired = false;
    const phase = runToEnd(s, DT, st => {
      if (st.active !== lastActive) { lastActive = st.active; fired = false; }
      if (st.active >= 0 && !fired && st.defenders[st.active].phase === "closing") {
        fired = true;
        applyBurst(st, -1);
      }
    });
    if (phase === "clear") cleared++;
  }
  const rate = cleared / seeds;
  check(rate < 0.40, `bursting blind, before any telegraph, beats the oracle's rate by a wide margin (${(rate * 100).toFixed(1)}% < 40%)`);
  check(rate > 0.02, `...but isn't literally zero either — it's a bad idea, not a guaranteed loss (${(rate * 100).toFixed(1)}%)`);
}

// ── Steering alone, full-lock, never bursting, is not enough ──────────────
{
  const seeds = 200;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(seed * 51 + 3) });
    const phase = runToEnd(s, DT, st => applySteer(st, st.maxX));
    if (phase === "clear") cleared++;
  }
  const rate = cleared / seeds;
  check(rate < 0.20, `steering hard to one side, without ever bursting, essentially never gets you through (${(rate * 100).toFixed(1)}% < 20%)`);
}

// ── The telegraph window is genuinely reactable, at every difficulty ──────
function telegraphWindows(oppStrength: number, seeds: number): number[] {
  const windows: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength, rng: mulberry32(seed * 211 + 17) });
    const telegraphAt: (number | null)[] = s.defenders.map(() => null);
    const recorded = s.defenders.map(() => false);
    let wall = 0, guard = 0;
    while (s.phase === "running" && guard++ < GUARD) {
      stepRun(s, DT);
      wall += DT;
      for (let i = 0; i < s.defenders.length; i++) {
        const def = s.defenders[i];
        if (telegraphAt[i] === null && def.phase === "telegraph") telegraphAt[i] = wall;
        if (!recorded[i] && telegraphAt[i] !== null && (def.phase === "beaten" || def.phase === "won")) {
          windows.push(wall - (telegraphAt[i] as number));
          recorded[i] = true;
        }
      }
    }
  }
  return windows;
}

{
  for (const str of [10, 55, 100]) {
    const windows = telegraphWindows(str, 200);
    check(windows.length > 50, `collected a real sample of telegraph windows at strength ${str} (${windows.length})`);
    const min = Math.min(...windows);
    check(min >= 0.45 - 1e-6, `every telegraph, even at strength ${str}, stays live at least 0.45s wall-clock — reactable on a phone (min ${min.toFixed(6)}s)`);
  }
}

// ── A stronger defender gives you genuinely less time to react — that is
// the ENTIRE difficulty knob in this design (see the file header: a better
// defender telegraphs less, he never moves in some way that can't be read).
// A zero-latency scripted oracle can't reveal this — it reacts on the exact
// frame the window opens regardless of how long that window is, so its win
// rate is deliberately difficulty-independent (checked above: reading the
// telegraph correctly wins ~every time, at every strength tested). What
// actually has to scale with strength is the window itself. ─────────────
{
  const low = telegraphWindows(15, 200);
  const high = telegraphWindows(95, 200);
  const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanLow = meanOf(low), meanHigh = meanOf(high);
  check(meanHigh < meanLow, `a strong defence's reaction window is genuinely shorter, on average, than a weak one's (${meanHigh.toFixed(3)}s < ${meanLow.toFixed(3)}s)`);
  check(Math.min(...high) >= 0.45 - 1e-6, `even the shortest window at max strength never drops below the 0.45s reactable floor`);
}

// ── Lane clamping — never off the corridor, never NaN, never ends early
// purely for drifting wide ─────────────────────────────────────────────
{
  const s = newRun({ pace: 80, oppStrength: 50, rng: mulberry32(999) });
  let sawOutOfBounds = false, sawNaN = false;
  runToEnd(s, DT, st => {
    applySteer(st, st.maxX + 50); // asking for something absurd, every frame
    if (st.x < st.minX - 1e-9 || st.x > st.maxX + 1e-9) sawOutOfBounds = true;
    if (Number.isNaN(st.x) || Number.isNaN(st.y)) sawNaN = true;
  });
  check(!sawOutOfBounds, "the lane never leaves [minX, maxX] no matter how hard you steer past it");
  check(!sawNaN, "position never goes NaN");
}

// ── Termination — a run that never resolves still ends ─────────────────────
{
  // A steer target that oscillates rapidly but a burst locked out by firing
  // constantly (every call after the first is a no-op while locked) — the
  // point is just that stepRun always terminates within RUN_TIMEOUT even
  // under adversarial input.
  const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(4242) });
  let ticks = 0;
  const phase = runToEnd(s, DT, st => {
    ticks++;
    applySteer(st, ticks % 2 === 0 ? st.minX : st.maxX);
    applyBurst(st, ticks % 2 === 0 ? 1 : -1);
  });
  check(phase === "clear" || phase === "lost", `an adversarial run still terminates (${phase})`);
  check(ticks < GUARD, "it terminates well within the guard, i.e. within RUN_TIMEOUT");
}

// ── Duel ordering — sequential, never skipped; a clear run beat all three ──
{
  let checkedOne = false;
  for (let seed = 1; seed <= 100 && !checkedOne; seed++) {
    if (oracleRun(seed, 50, "correct") !== "clear") continue;
    // Re-run to inspect the final defender states (oracleRun above discards them).
    const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(seed * 101 + 7) });
    let lastActive = -1, announced = false;
    runToEnd(s, DT, st => {
      if (st.active !== lastActive) { lastActive = st.active; announced = false; }
      if (st.active >= 0 && !announced) {
        const def = st.defenders[st.active];
        if (def.phase === "telegraph") {
          announced = true;
          applyBurst(st, def.commitSide === 1 ? -1 : 1);
        }
      }
    });
    check(s.phase === "clear", "the re-run reproduces the same clear outcome (determinism sanity check)");
    check(s.defenders.every(d => d.phase === "beaten"), "a clear run really did beat all three men, not just skip past them");
    checkedOne = true;
  }
  check(checkedOne, "found at least one clear run to inspect in 100 seeds");
}

// ── dt-independence — the same scripted input wins/loses the same way
// regardless of frame rate, matching this codebase's clamped-dt rAF loops ──
{
  const dts = [1 / 30, 1 / 60, 1 / 120];
  const seeds = 150;
  const perDtOutcomes: RunPhase[][] = dts.map(() => []);
  for (let seed = 1; seed <= seeds; seed++) {
    dts.forEach((dt, di) => {
      const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
      let lastActive = -1, announced = false;
      const phase = runToEnd(s, dt, st => {
        if (st.active !== lastActive) { lastActive = st.active; announced = false; }
        if (st.active >= 0 && !announced) {
          const def = st.defenders[st.active];
          if (def.phase === "telegraph") {
            announced = true;
            applyBurst(st, def.commitSide === 1 ? -1 : 1);
          }
        }
      });
      perDtOutcomes[di].push(phase);
    });
  }
  const base = perDtOutcomes[1]; // 1/60 as the reference
  for (let di = 0; di < dts.length; di++) {
    if (di === 1) continue;
    let agree = 0;
    for (let i = 0; i < seeds; i++) if (perDtOutcomes[di][i] === base[i]) agree++;
    const rate = agree / seeds;
    check(rate >= 0.95, `outcome agrees with the 1/60s reference at dt=${dts[di].toFixed(4)}s for ≥95% of seeds (${(rate * 100).toFixed(1)}%)`);
  }
}

// ── runSpeed / runProgress sanity ─────────────────────────────────────────
{
  check(Math.abs(runSpeed(0) - BASE_SPEED) < 1e-9, "runSpeed(0) is exactly BASE_SPEED");
  check(Math.abs(runSpeed(100) - (BASE_SPEED + PACE_SPEED)) < 1e-9, "runSpeed(100) is BASE_SPEED + PACE_SPEED");
  const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(1) });
  check(runProgress(s) === 0, "progress starts at 0");
  s.y = s.clearY;
  check(Math.abs(runProgress(s) - 1) < 1e-9, "progress reaches 1 at clearY");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the duel is winnable by reading it, unwinnable by ignoring it, and fair on a phone");
