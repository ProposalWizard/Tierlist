/**
 * PACE: THE KNOCK-ON (lib/star/firstPersonDribble.ts "THE KNOCK-ON") —
 * Harry, 20 Oct 2026: Pace "is mostly holding to run"; it needs a real skill
 * a better player does better, and the top levels must stay hard.
 *
 * Bots play every training Pace level on its own picture (the layout the
 * game plays), many times each, with human-like noise:
 *  - good:     reads the picture right 92% of the time, times the knock to
 *              ±45 ms (σ) on the GO ring, picks the gap;
 *  - decent:   reads right 85%, ±70 ms;
 *  - hasty:    reads like decent but goes as soon as he moves (no waiting);
 *  - careless: swipes a random way as soon as he moves.
 *
 * Measured with the scratch harness at 200 tries a level (20 Oct 2026):
 *
 *                 L1-10   L11-20  L21-30
 *   before  good   75%     64%     61%
 *           decent 68%     60%     52%
 *           hasty  45%     56%     27%
 *           careless 16%   17%      5%
 *   after   good   85%     75%     37%
 *           decent 65%     52%     22%
 *           hasty  20%     29%      8%
 *           careless 8%    15%      3%
 *
 * Before, waiting and timing changed nothing (hasty ≈ decent in the middle
 * band) and some levels were dead whatever you did (L5: 28%, L28: 0% for a
 * decent player). After, each step of skill is worth a clear step up.
 * This test re-runs a smaller version and checks the shape.
 *
 * Run: npx tsx tests/star/paceKnockOn.mts
 */
import {
  newRun, applySteer, applyBurst, stepRun, knockWindow, knockGradeNow, knockRing, KNOCK, TELE_SLOW,
  type FpRunState, type FpDefender,
} from "../../lib/star/firstPersonDribble";
import { levelConfig, levelSeedOf } from "../../lib/star/trainingLevelData";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); console.log(`${ok ? "  ok " : "FAIL "} ${what}`); };

const DT = 1 / 60;
type Mode = "good" | "decent" | "hasty" | "careless";

function waves(chasers: number, waveMax: number) {
  const out: number[] = [];
  for (let left = chasers; left > 0; left -= waveMax) out.push(Math.min(waveMax, left));
  return out;
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
function widestGap(xs: number[], minX: number, maxX: number) {
  const e = [minX, ...[...xs].sort((a, b) => a - b), maxX];
  let best = (minX + maxX) / 2, g = -1;
  for (let i = 0; i < e.length - 1; i++) if (e[i + 1] - e[i] > g) { g = e[i + 1] - e[i]; best = (e[i] + e[i + 1]) / 2; }
  return best;
}
/** A skilled read of the picture: knock left, right or not at all — whichever gets past this wave. */
function readPicture(s: FpRunState): (-1 | 0 | 1)[] {
  const out: { dir: -1 | 0 | 1; ok: boolean; sep: number }[] = [];
  for (const dir of [-1, 0, 1] as const) {
    const c = JSON.parse(JSON.stringify({ ...s, rng: undefined })) as FpRunState;
    c.rng = () => 0.5;
    const round = c.activeRound;
    if (dir !== 0) applyBurst(c, dir);
    let g = 0;
    while (c.phase === "running" && c.activeRound === round && g++ < 240) stepRun(c, DT);
    const wave = c.defenders.filter(d => d.round === round);
    out.push({ dir, ok: c.phase === "clear" || (c.phase === "running" && wave.every(d => d.phase === "beaten")), sep: Math.min(...wave.map(d => d.sepAtContact ?? 9)) });
  }
  return out.sort((a, b) => (Number(b.ok) - Number(a.ok)) || b.sep - a.sep).map(o => o.dir);
}

function botRun(level: number, mode: Mode, noiseSeed: number, knockOn: boolean): boolean {
  const cfg = levelConfig("pace", level, {});
  const s = newRun({ pace: cfg.runPace, oppStrength: cfg.oppStrength, waveSizes: waves(cfg.chasers, cfg.waveMax), rng: mulberry32(levelSeedOf("pace", level, cfg)), knockOn });
  const r = mulberry32(noiseSeed);
  const sig = mode === "good" ? 0.045 : 0.07, mis = mode === "good" ? 0.08 : 0.15;
  let wall = 0, steered = -1, guard = 0;
  const plan = new Map<FpDefender, { at: number; read: boolean | null }>();
  const handled = new Set<FpDefender>();
  while (s.phase === "running" && guard++ < 5000) {
    if ((mode === "good" || mode === "decent") && s.activeRound >= 0 && s.activeRound !== steered) {
      steered = s.activeRound;
      applySteer(s, widestGap(s.defenders.filter(d => d.round === s.activeRound).map(d => d.x), s.minX, s.maxX));
    }
    for (const d of s.defenders) {
      if (d.round !== s.activeRound || plan.has(d) || handled.has(d) || d.phase !== "telegraph" || d.role === "cover") continue;
      const react = Math.max(0.12, 0.24 + 0.05 * gauss(r));
      if (mode === "careless") plan.set(d, { at: wall + react, read: null });
      else if (mode === "hasty" || !knockOn) plan.set(d, { at: wall + react, read: r() >= mis });
      else {
        const aim = d.tell / TELE_SLOW - (d.goWin ?? 0.2) * (KNOCK.before - 0.5);
        plan.set(d, { at: wall + Math.max(0.05, aim + sig * gauss(r)), read: r() >= mis });
      }
    }
    let due: FpDefender | null = null;
    for (const [d, p] of plan) if (p.at <= wall && d.phase !== "beaten" && d.phase !== "won" && (!due || d.y > due.y)) due = d;
    if (due) {
      const p = plan.get(due)!;
      const dir = p.read === null ? (r() < 0.5 ? 1 : -1) : (() => { const o = readPicture(s); return p.read ? o[0] : o[1 + Math.floor(r() * 2)]; })();
      if (dir === 0 || applyBurst(s, dir)) { plan.delete(due); handled.add(due); }
    }
    for (const [d] of plan) if (d.phase === "beaten" || d.phase === "won") plan.delete(d);
    stepRun(s, DT);
    wall += DT;
  }
  return s.phase === "clear";
}

const TRIES = 24;
const BANDS: [number, number][] = [[1, 10], [11, 20], [21, 30]];
function rates(mode: Mode, knockOn: boolean): number[] {
  return BANDS.map(([a, b]) => {
    let ok = 0, n = 0;
    for (let L = a; L <= b; L++) for (let t = 0; t < TRIES; t++) { n++; if (botRun(L, mode, 1000 * L + t, knockOn)) ok++; }
    return ok / n;
  });
}
const pct = (v: number[]) => v.map(x => `${(x * 100).toFixed(0)}%`).join(" / ");

// ── 1. The rules themselves ────────────────────────────────────────────────
check(knockWindow(0) === KNOCK.winEasy && Math.abs(knockWindow(100) - KNOCK.winHard) < 1e-9, "the GO window runs from easy (weak man) to hard (the best)");
{
  let prev = Infinity, mono = true;
  for (let v = 0; v <= 100; v += 5) { const w = knockWindow(v); if (w > prev + 1e-12) mono = false; prev = w; }
  check(mono, "a stronger man never gives a wider window");
}
{
  // Walk one taker through his telegraph and commit: the grade goes early → clean → late, and the ring agrees.
  const cfg = levelConfig("pace", 10, {});
  const s = newRun({ pace: cfg.runPace, oppStrength: cfg.oppStrength, waveSizes: [1], rng: mulberry32(3), knockOn: true });
  const seen: string[] = [];
  let g = 0, ringOff = 0;
  while (s.phase === "running" && g++ < 2000) {
    const d = s.defenders[0];
    if (d.phase === "telegraph" || d.phase === "committed") {
      const grade = knockGradeNow(s, d), ring = knockRing(d, s.elapsed).stage;
      const tag = `${grade}`;
      if (seen[seen.length - 1] !== tag) seen.push(tag);
      if (!((grade === "perfect") === (ring === "go") || ring === "gone")) ringOff++;
    }
    stepRun(s, DT);
  }
  check(ringOff === 0, `the ring is green exactly when a knock is clean (${ringOff} frames off)`);
  check(seen.join(",") === "early,perfect,late", `a knock goes too early → clean → too late as he commits (${seen.join(",")})`);
}
{
  // Off = exactly as before: the same seed, with and without the field absent, plays the same run.
  const a = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(9) });
  const b = newRun({ pace: 60, oppStrength: 60, rng: mulberry32(9), knockOn: false });
  for (let i = 0; i < 400; i++) { stepRun(a, DT); stepRun(b, DT); }
  check(JSON.stringify({ ...a, rng: 0 }) === JSON.stringify({ ...b, rng: 0 }), "without the knock-on the run is unchanged (the real match and trial)");
  check(a.knockOn === undefined && a.defenders.every(d => d.role === undefined), "without the knock-on nobody is a taker or cover");
}
{
  // One man per wave comes for the ball; the rest hold.
  const s = newRun({ pace: 70, oppStrength: 80, waveSizes: [3, 3], rng: mulberry32(21), knockOn: true });
  let g = 0;
  while (s.phase === "running" && g++ < 3000) { stepRun(s, DT); if (s.defenders.some(d => d.round === 0 && d.phase !== "waiting")) break; }
  const wave = s.defenders.filter(d => d.round === 0);
  check(wave.filter(d => d.role === "taker").length === 1 && wave.filter(d => d.role === "cover").length === 2, "each wave has exactly one man coming for the ball");
}

// ── 2. Skill beats luck (bots on every level's own picture) ──────────────────
const after = { good: rates("good", true), decent: rates("decent", true), hasty: rates("hasty", true), careless: rates("careless", true) };
console.log(`  after  good ${pct(after.good)} · decent ${pct(after.decent)} · hasty ${pct(after.hasty)} · careless ${pct(after.careless)}`);
for (let i = 0; i < 3; i++) {
  const band = `L${BANDS[i][0]}-${BANDS[i][1]}`;
  check(after.good[i] >= after.careless[i] * 3 + 0.1, `${band}: a skilled player clears far more than a careless one (${(after.good[i] * 100).toFixed(0)}% vs ${(after.careless[i] * 100).toFixed(0)}%)`);
  check(after.decent[i] > after.hasty[i] + 0.08, `${band}: waiting for the ring beats going at once (${(after.decent[i] * 100).toFixed(0)}% vs ${(after.hasty[i] * 100).toFixed(0)}%)`);
  check(after.good[i] > after.decent[i], `${band}: sharper timing clears more (${(after.good[i] * 100).toFixed(0)}% vs ${(after.decent[i] * 100).toFixed(0)}%)`);
  check(after.careless[i] < 0.25, `${band}: swiping any way rarely gets through (${(after.careless[i] * 100).toFixed(0)}%)`);
}
check(after.good[0] >= 0.7, `the first ten levels are friendly to a good player (${(after.good[0] * 100).toFixed(0)}%)`);
check(after.good[2] <= 0.5 && after.decent[2] <= 0.35, `the top ten levels stay hard (good ${(after.good[2] * 100).toFixed(0)}%, decent ${(after.decent[2] * 100).toFixed(0)}%)`);
check(after.good[2] < after.good[1] && after.good[1] < after.good[0], "the bands get harder in order for a good player");

if (problems.length) {
  console.log(`\nFAIL — ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("\nPASS");
