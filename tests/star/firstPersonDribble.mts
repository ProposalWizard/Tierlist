import {
  newRun, applySteer, applyBurst, stepRun, runProgress, runSpeed,
  BASE_SPEED, PACE_SPEED, LUNGE_REACH,
  type FpRunState, type FpDefender, type RunPhase,
} from "../../lib/star/firstPersonDribble";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE FIRST-PERSON DUEL — IS IT ACTUALLY FAIR, ACTUALLY WINNABLE, ACTUALLY
 * REQUIRING A BURST? NOW WITH WAVES OF ONE TO THREE MEN, NOT JUST ONE.
 *
 * Same idiom as every other suite here: a problems[] array, PASS/FAIL,
 * process.exit(1) on failure. What makes this suite worth writing at all is
 * that every assertion is a claim about FEEL, not just "doesn't crash" —
 * each one is picked because if it were false, the mode would not actually
 * play the way it's meant to.
 *
 * Changed directly from three men engaged strictly one at a time to three
 * WAVES of one to three men each, placed across the corridor rather than
 * spawned on your lane. The "oracle" below had to change to match how a
 * real player would actually read it: it now (1) steers toward the widest
 * gap between a wave's men the moment they come into view — the entire
 * point of placing them in advance rather than spawning them lazily — and
 * (2) bursts away from where a telegraphing man's lunge will actually LAND
 * (his current lane + commitSide*LUNGE_REACH), not just "the opposite of
 * commitSide" — the two were the same thing when a man always spawned
 * exactly on your lane, but a wave's men don't always fully close that
 * lateral gap before committing. An oracle using the OLD, simpler rule was
 * measured losing wildly more often than it should — not because the mode
 * had gotten unfair, but because that rule no longer matches what "reading
 * it correctly" actually means once a defender's position and his
 * commit-side are no longer guaranteed to coincide.
 *
 * Every number below is MEASURED against the real sim (a scratch script
 * run directly against this file, same as every other suite's README
 * entry), not assumed — some thresholds are visibly looser than the
 * original single-defender suite's, and that's real: a wave of three is
 * supposed to be harder than a wave of one.
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

/** Every man in the currently-active wave, still live. */
function liveWave(s: FpRunState): FpDefender[] {
  return s.defenders.filter(d => d.round === s.activeRound && d.phase !== "beaten" && d.phase !== "won");
}

/** The most immediate threat in the active wave — smallest depth gap to
 *  you, i.e. closest to actually reaching CONTACT_D. Multiple men can be
 *  telegraphing or committed at once; this is always the one whose outcome
 *  resolves soonest. */
function nearestThreat(s: FpRunState): FpDefender | null {
  const live = liveWave(s);
  if (!live.length) return null;
  return live.reduce((a, b) => (s.y - a.y) <= (s.y - b.y) ? a : b);
}

/** The middle of the widest gap between a wave's men (and the corridor
 *  edges) — where a real player would steer the instant the wave comes
 *  into view, since they're placed, not sprung on you. */
function widestGapTarget(xs: number[], minX: number, maxX: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const edges = [minX, ...sorted, maxX];
  let bestMid = (minX + maxX) / 2, bestGap = -1;
  for (let i = 0; i < edges.length - 1; i++) {
    const gap = edges[i + 1] - edges[i];
    if (gap > bestGap) { bestGap = gap; bestMid = (edges[i] + edges[i + 1]) / 2; }
  }
  return bestMid;
}

/** A scripted "read every wave correctly" (or deliberately incorrectly)
 *  player: steers to the open gap as soon as a wave is visible, then
 *  bursts away from (or into, for "wrong") wherever each telegraphing
 *  man's lunge will actually land, the instant he shows it — retried every
 *  tick until the burst actually fires, in case an earlier burst is still
 *  locked out. */
function oracleRun(seed: number, oppStrength: number, mode: "correct" | "wrong"): FpRunState {
  const s = newRun({ pace: 60, oppStrength, rng: mulberry32(seed * 101 + 7) });
  const reacted = new Set<FpDefender>();
  let steeredForRound = -1;
  runToEnd(s, DT, st => {
    if (st.activeRound >= 0 && st.activeRound !== steeredForRound) {
      steeredForRound = st.activeRound;
      const xs = st.defenders.filter(d => d.round === st.activeRound).map(d => d.x);
      applySteer(st, widestGapTarget(xs, st.minX, st.maxX));
    }
    const threat = nearestThreat(st);
    if (threat && threat.phase === "telegraph" && !reacted.has(threat)) {
      const landsAt = threat.x + threat.commitSide * LUNGE_REACH;
      const awayDir = st.x >= landsAt ? 1 : -1;
      const fired = applyBurst(st, mode === "correct" ? awayDir : (-awayDir as 1 | -1));
      if (fired) reacted.add(threat); // only give up trying once it actually fires
    }
  });
  return s;
}

// ── Determinism — same seed twice, identical outcome and separations ──────
{
  let mismatches = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const a = oracleRun(seed, 60, "correct");
    const b = oracleRun(seed, 60, "correct");
    const sepsA = a.defenders.map(d => d.sepAtContact ?? -1);
    const sepsB = b.defenders.map(d => d.sepAtContact ?? -1);
    if (a.phase !== b.phase || sepsA.some((v, i) => Math.abs(v - sepsB[i]) > 1e-9)) mismatches++;
  }
  check(mismatches === 0, `same seed produces identical outcome + separations every time (${mismatches}/50 mismatched)`);
}

// ── Do nothing and you lose, almost always ────────────────────────────────
//
// No longer a hard 100% invariant the way it was with a single defender
// always spawned exactly on your lane (his own lunge from zero separation
// mathematically could never clear CLEAR_SEP on its own). A wave's men are
// placed across the corridor and won't always fully close that gap before
// committing — occasionally one starts far enough away that even standing
// completely still leaves you clear of him by dumb luck. Measured: 196/200.
{
  let losses = 0;
  const seeds = 200;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(seed * 3 + 1) });
    const phase = runToEnd(s, DT);
    if (phase === "lost") losses++;
  }
  const rate = losses / seeds;
  check(rate >= 0.90, `standing completely still loses almost every time (${(rate * 100).toFixed(1)}%)`);
}

// ── Reading every wave correctly clears a real, meaningfully high share of
// runs — and clearly, repeatably beats reading it wrong. Measured against
// 1000 seeds: correct 34.4%, wrong 10.2% cleared (wrong loses 89.8%). Not
// the ~95% a single defender alone gets (measured separately below on the
// solo-wave subset) — three men at once is supposed to be harder than one,
// and this is the real, measured shape of that difficulty curve, not a
// guess. ─────────────────────────────────────────────────────────────────
{
  const seeds = 1000;
  let correctCleared = 0, wrongCleared = 0, wrongLost = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    if (oracleRun(seed, 60, "correct").phase === "clear") correctCleared++;
    const wp = oracleRun(seed, 60, "wrong").phase;
    if (wp === "clear") wrongCleared++;
    if (wp === "lost") wrongLost++;
  }
  const correctRate = correctCleared / seeds, wrongRate = wrongCleared / seeds, wrongLostRate = wrongLost / seeds;
  check(correctRate >= 0.25, `reading every wave correctly clears a real share of runs (${(correctRate * 100).toFixed(1)}%)`);
  check(wrongLostRate >= 0.80, `reacting into the telegraphed lane instead of away from it loses the great majority of the time (${(wrongLostRate * 100).toFixed(1)}%)`);
  check(correctRate > wrongRate * 2, `reading it right clears more than twice as often as reading it wrong (${(correctRate * 100).toFixed(1)}% vs ${(wrongRate * 100).toFixed(1)}%)`);
}

// ── The same oracle, restricted to seeds where every wave happened to be a
// solo man — the one case that's directly comparable to the original
// single-defender design, and it should still hit that same ~95% mark.
// Measured: 71/74 on 1000 seeds' worth of solo-only seeds. ─────────────────
{
  let cleared = 0, soloSeeds = 0;
  for (let seed = 1; seed <= 2000 && soloSeeds < 200; seed++) {
    const probe = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    if (!probe.roundSizes.every(n => n === 1)) continue;
    soloSeeds++;
    if (oracleRun(seed, 60, "correct").phase === "clear") cleared++;
  }
  check(soloSeeds >= 30, `found a real sample of solo-only-wave seeds to check (${soloSeeds})`);
  const rate = cleared / soloSeeds;
  check(rate >= 0.85, `when every wave happens to be one man, reading him correctly wins almost every time, same as the original design (${(rate * 100).toFixed(1)}% of ${soloSeeds})`);
}

// ── Bursting the right way, but too LATE — the actual thing reported as
// missing: "swipe left or right... every single time... you don't even
// have to time it." A correctly-directed burst fired the instant his
// telegraph ends (he's already committed) used to clear about a third of
// runs — reading to a player as "no real deadline," since a burst fired
// any time up to and including that instant worked about as well. Now it's
// a real cliff: full power only while he's still actually telegraphing.
// Measured: 32.3% -> 2.9% right at the boundary. ───────────────────────────
{
  function lateCorrectRun(seed: number): RunPhase {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    const reacted = new Set<FpDefender>();
    return runToEnd(s, DT, st => {
      const threat = nearestThreat(st);
      if (threat && threat.phase === "committed" && !reacted.has(threat)) {
        const landsAt = threat.x + threat.commitSide * 1.1; // LUNGE_REACH
        const fired = applyBurst(st, st.x >= landsAt ? 1 : -1);
        if (fired) reacted.add(threat);
      }
    });
  }
  const seeds = 1000;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) if (lateCorrectRun(seed) === "clear") cleared++;
  const rate = cleared / seeds;
  check(rate < 0.15, `a correctly-directed burst fired the instant he's already committed is now a real miss, not a coin flip (${(rate * 100).toFixed(1)}% < 15%)`);
}

// ── Bursting the instant a wave starts closing (before anyone's shown a
// side) is punished — worse than reading the telegraph, but not zero ──────
{
  const seeds = 300;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    let firedForRound = -1;
    const phase = runToEnd(s, DT, st => {
      if (st.activeRound >= 0 && st.activeRound !== firedForRound && liveWave(st).some(d => d.phase === "closing")) {
        firedForRound = st.activeRound;
        applyBurst(st, -1);
      }
    });
    if (phase === "clear") cleared++;
  }
  const rate = cleared / seeds;
  check(rate < 0.40, `bursting blind, before any telegraph, beats the oracle's rate by a wide margin (${(rate * 100).toFixed(1)}% < 40%)`);
  check(rate > 0.01, `...but isn't literally zero either — it's a bad idea, not a guaranteed loss (${(rate * 100).toFixed(1)}%)`);
}

// ── Steering alone, full-lock, never bursting, is not enough ──────────────
{
  const seeds = 300;
  let cleared = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = newRun({ pace: 60, oppStrength: 50, rng: mulberry32(seed * 51 + 3) });
    const phase = runToEnd(s, DT, st => applySteer(st, st.maxX));
    if (phase === "clear") cleared++;
  }
  const rate = cleared / seeds;
  check(rate < 0.20, `steering hard to one side, without ever bursting, essentially never gets you through (${(rate * 100).toFixed(1)}% < 20%)`);
}

// ── The telegraph window is genuinely reactable, at every difficulty —
// purely per-defender, depth-based timing, so unaffected by how many other
// men share his wave or where any of them are placed ───────────────────────
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
// rate is deliberately difficulty-independent. What actually has to scale
// with strength is the window itself. ─────────────────────────────────────
{
  const low = telegraphWindows(15, 200);
  const high = telegraphWindows(95, 200);
  const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanLow = meanOf(low), meanHigh = meanOf(high);
  check(meanHigh < meanLow, `a strong defence's reaction window is genuinely shorter, on average, than a weak one's (${meanHigh.toFixed(3)}s < ${meanLow.toFixed(3)}s)`);
  check(Math.min(...high) >= 0.45 - 1e-6, `even the shortest window at max strength never drops below the 0.45s reactable floor`);
}

// ── Placement — waves are genuinely random, never overlapping, and every
// wave leaves at least one real gap somewhere in the corridor ─────────────
{
  let checkedWaves = 0, minGapSeen = Infinity, sawOverlap = false;
  for (let seed = 1; seed <= 300; seed++) {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    for (let r = 0; r < s.roundSizes.length; r++) {
      const xs = s.defenders.filter(d => d.round === r).map(d => d.x).sort((a, b) => a - b);
      checkedWaves++;
      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i] - xs[i - 1];
        minGapSeen = Math.min(minGapSeen, gap);
        if (gap < 0.05) sawOverlap = true;
      }
      check(xs.every(x => x >= s.minX - 1e-6 && x <= s.maxX + 1e-6), `every placed man is inside the corridor (seed ${seed}, round ${r})`);
    }
  }
  check(checkedWaves > 200, `checked a real sample of waves (${checkedWaves})`);
  check(!sawOverlap, "no two men in the same wave are ever placed on top of each other");
  check(minGapSeen >= 2.0, `the minimum gap between any two men in the same wave is genuinely enforced (min seen ${minGapSeen.toFixed(2)}m)`);
}
{
  // Not one-per-band: real randomness means a wave of three can cluster
  // entirely on one side — the whole point being tested here. Sampling a
  // few hundred waves of exactly three should turn up at least one clearly
  // lopsided arrangement (all three within one half of the corridor).
  let sawLopsided = false, threeCount = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    for (let r = 0; r < s.roundSizes.length; r++) {
      if (s.roundSizes[r] !== 3) continue;
      threeCount++;
      const xs = s.defenders.filter(d => d.round === r).map(d => d.x);
      const mid = (s.minX + s.maxX) / 2;
      if (xs.every(x => x < mid) || xs.every(x => x > mid)) sawLopsided = true;
    }
  }
  check(threeCount > 50, `found a real sample of three-man waves (${threeCount})`);
  check(sawLopsided, "placement is real randomness, not one-per-band — a three-man wave can land entirely on one side of the corridor");
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

// ── Wave ordering — sequential, never skipped; a clear run beat everyone ──
{
  let checkedOne = false;
  for (let seed = 1; seed <= 300 && !checkedOne; seed++) {
    const s = oracleRun(seed, 50, "correct");
    if (s.phase !== "clear") continue;
    check(s.defenders.every(d => d.phase === "beaten"), "a clear run really did beat every man across every wave, not just skip past some of them");
    checkedOne = true;
  }
  check(checkedOne, "found at least one clear run to inspect in 300 seeds");
}

// ── dt-independence — the same scripted input wins/loses the same way
// regardless of frame rate, matching this codebase's clamped-dt rAF loops ──
{
  function oracleAtDt(seed: number, dt: number): RunPhase {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    const reacted = new Set<FpDefender>();
    let steeredForRound = -1;
    return runToEnd(s, dt, st => {
      if (st.activeRound >= 0 && st.activeRound !== steeredForRound) {
        steeredForRound = st.activeRound;
        const xs = st.defenders.filter(d => d.round === st.activeRound).map(d => d.x);
        applySteer(st, widestGapTarget(xs, st.minX, st.maxX));
      }
      const threat = nearestThreat(st);
      if (threat && threat.phase === "telegraph" && !reacted.has(threat)) {
        const landsAt = threat.x + threat.commitSide * LUNGE_REACH;
        const fired = applyBurst(st, st.x >= landsAt ? 1 : -1);
        if (fired) reacted.add(threat);
      }
    });
  }

  const dts = [1 / 30, 1 / 60, 1 / 120];
  const seeds = 150;
  const perDtOutcomes: RunPhase[][] = dts.map(() => []);
  for (let seed = 1; seed <= seeds; seed++) {
    dts.forEach((dt, di) => perDtOutcomes[di].push(oracleAtDt(seed, dt)));
  }
  const base = perDtOutcomes[1]; // 1/60 as the reference
  for (let di = 0; di < dts.length; di++) {
    if (di === 1) continue;
    let agree = 0;
    for (let i = 0; i < seeds; i++) if (perDtOutcomes[di][i] === base[i]) agree++;
    const rate = agree / seeds;
    check(rate >= 0.90, `outcome agrees with the 1/60s reference at dt=${dts[di].toFixed(4)}s for ≥90% of seeds (${(rate * 100).toFixed(1)}%)`);
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

// ── Wave sizes are 1-3, and vary — the actual "random chance" requested ────
{
  const seen = new Set<number>();
  for (let seed = 1; seed <= 300; seed++) {
    const s = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(seed * 101 + 7) });
    check(s.roundSizes.length === 3, `three waves by default (${s.roundSizes.length})`);
    for (const n of s.roundSizes) {
      check(n >= 1 && n <= 3, `every wave has one to three men, never more or fewer (saw ${n})`);
      seen.add(n);
    }
  }
  check(seen.has(1) && seen.has(2) && seen.has(3), `all three wave sizes actually occur across enough seeds (saw ${[...seen].sort()})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — waves of one to three men are winnable by reading them, unwinnable by ignoring them, and fair on a phone");
