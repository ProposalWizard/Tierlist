import {
  newRun, applySteer, applyBurst, applyFeint, stepRun, pickWaveSizes, applyPass, duelWaveSizes,
  LUNGE_REACH, DUEL,
  type FpRunState, type FpDefender, type FpIdentity,
} from "../../lib/star/firstPersonDribble";
import { mulberry32 } from "../../lib/star/season";
import { createHash } from "node:crypto";

/**
 * REAL DUELS — measured against real take-ons (docs/gameplay15/dribble.md).
 *
 * Opta-style public numbers: about half of all take-ons succeed across a
 * league, about two in three for the best dribblers, and roughly one in ten
 * ends in a foul. Here a human-like bot (it reacts to what is on the screen
 * after a human reaction time, and sometimes misreads) takes on thousands of
 * seeded runs, by its dribbling, its pace and how well it times things.
 *
 * Also: Settings → Gameplay → Dribble duels: Old (duels off) must be the run
 * exactly as before — fingerprinted below from the code before the change.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const QUICK = process.argv.includes("--quick");

// ── Old is byte-identical ────────────────────────────────────────────────
// The fingerprint was taken on 11 Oct 2026 from the code BEFORE duels existed
// (300 seeds × both classic settings, random steers, bursts and passes).
{
  const h = createHash("sha256");
  for (let seed = 1; seed <= 300; seed++) for (const classic of [false, true]) {
    const rng = mulberry32(seed);
    const s = newRun({ pace: (seed * 13) % 101, oppStrength: (seed * 29) % 101, waveSizes: seed % 3 ? pickWaveSizes(rng, { minRounds: 3 }) : undefined, rng, classic, mates: seed % 4 });
    const ir = mulberry32(seed + 999);
    let t = 0;
    while (s.phase === "running" && t < 30) {
      const r = ir();
      if (r < 0.02) applyBurst(s, ir() < 0.5 ? -1 : 1);
      else if (r < 0.06) applySteer(s, s.x + (ir() - 0.5) * 6);
      else if (r < 0.0605 && s.mates.length) applyPass(s, 0, 60);
      stepRun(s, 1 / 60); t += 1 / 60;
    }
    h.update(JSON.stringify([s.phase, s.x.toFixed(9), s.y.toFixed(9), s.lostTo, s.defenders.map(d => [d.phase, d.x.toFixed(9), d.y.toFixed(9), d.sepAtContact?.toFixed(9)])]));
  }
  const got = h.digest("hex");
  check(got === "49f4c024b3aae9a6eb4a65d2c18d7e57b7398e35dd503e1fe4ee744608af039f",
    `duels off must be the run exactly as before (fingerprint ${got.slice(0, 12)}…)`);
}

// ── The bot ─────────────────────────────────────────────────────────────
const DT = 1 / 60;
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
function widestGap(xs: number[], lo: number, hi: number) {
  const e = [lo, ...[...xs].sort((a, b) => a - b), hi];
  let m = (lo + hi) / 2, g = -1;
  for (let i = 0; i < e.length - 1; i++) if (e[i + 1] - e[i] > g) { g = e[i + 1] - e[i]; m = (e[i] + e[i + 1]) / 2; }
  return m;
}

export interface Bot {
  name: string;
  /** Reaction time to a cue on screen, seconds (mean, spread). 0 = instant. */
  react: number; spread: number;
  /** Chance of going the wrong way. */
  misread: number;
  /** Chance of trying a feint on a man before waiting for his tackle. */
  feint: number;
  /** Swipes at random moments instead of reading anything. */
  blind?: boolean;
}
export const BOTS: Record<string, Bot> = {
  perfect: { name: "perfect timing", react: 0, spread: 0, misread: 0, feint: 0.6 },
  // A cue on a phone screen, then a swipe the screen has to recognise as one:
  // about 0.3 s (simple visual reaction ~0.22 s, plus the flick itself).
  human: { name: "human (0.30 s, 12% misread)", react: 0.3, spread: 0.08, misread: 0.12, feint: 0.6 },
  burstOnly: { name: "human, no feints", react: 0.3, spread: 0.08, misread: 0.12, feint: 0 },
  slow: { name: "slow (0.5 s)", react: 0.5, spread: 0.1, misread: 0.15, feint: 0.6 },
  blind: { name: "blind swipes", react: 0, spread: 0, misread: 0.5, feint: 0.3, blind: true },
};

export interface Duel { won: boolean; fouled: boolean }

/** A defending roster with defending spread like a real back line + midfield (60-85). */
function roster(rng: () => number, mean = 72): FpIdentity[] {
  return Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, defending: Math.round(mean - 12 + rng() * 25) }));
}

/** One run. Returns every real duel (a man who was on you when he went to ground). */
export function botRun(seed: number, o: { dribbling: number; pace: number; bot: Bot; duels?: boolean; defMean?: number }) {
  const rng = mulberry32(seed * 7919 + 3);
  const brng = mulberry32(seed * 31 + 11);
  const s = newRun({
    pace: o.pace, oppStrength: 70, waveSizes: (o.duels ?? true) ? duelWaveSizes(rng) : pickWaveSizes(rng, { minRounds: 3 }), rng, classic: false,
    roster: roster(mulberry32(seed + 5), o.defMean), duels: o.duels ?? true, dribbling: o.dribbling,
  });
  const bot = o.bot;
  const cueAt = new Map<FpDefender, { at: number; cue: string }>();
  const acted = new Set<string>();
  const feinted = new Set<FpDefender>();
  const gapAt = new Map<FpDefender, number>();
  const pressed = new Map<FpDefender, number>();
  let steered = -1, wall = 0, blindNext = 0.3 + brng() * 1.0;
  const react = () => bot.react === 0 ? 0 : Math.max(0.1, bot.react + bot.spread * gauss(brng));
  while (s.phase === "running" && wall < 40) {
    if (s.activeRound >= 0 && s.activeRound !== steered) {
      steered = s.activeRound;
      applySteer(s, widestGap(s.defenders.filter(d => d.round === s.activeRound).map(d => d.x), s.minX, s.maxX));
    }
    const live = s.defenders.filter(d => d.round === s.activeRound && d.phase !== "beaten" && d.phase !== "won");
    const t = live.length ? live.reduce((a, b) => (s.y - a.y) <= (s.y - b.y) ? a : b) : null;
    if (bot.blind) {
      if (wall >= blindNext) {
        const dir = brng() < 0.5 ? -1 : 1;
        if (brng() < bot.feint) applyFeint(s, brng() < 0.5 ? "stepover" : "shoulder", dir);
        else applyBurst(s, dir);
        blindNext = wall + 0.4 + brng() * 1.2;
      }
    } else if (t) {
      const gap = s.y - t.y;
      // A feint, while he backs off, selling the side he shows you.
      if (t.phase === "jockey" && !feinted.has(t) && gap < 5.6) {
        feinted.add(t);
        if (brng() < bot.feint) applyFeint(s, brng() < 0.5 ? "stepover" : "shoulder", (t.show ?? 1));
      }
      const cue = t.phase === "bitten" ? "bitten" : (t.phase === "telegraph" || t.phase === "committed") ? "tackle" : null;
      if (cue) {
        const key = `${s.defenders.indexOf(t)}:${cue}`;
        const prev = cueAt.get(t);
        if (!prev || prev.cue !== cue) cueAt.set(t, { at: wall + react(), cue });
        if (!acted.has(key) && wall >= cueAt.get(t)!.at) {
          let dir: 1 | -1;
          if (cue === "bitten") dir = (-(t.leanDir ?? 1)) as 1 | -1;
          else { const lands = t.x + t.commitSide * LUNGE_REACH; dir = s.x >= lands ? 1 : -1; }
          if (brng() < bot.misread) dir = -dir as 1 | -1;
          if (applyBurst(s, dir)) acted.add(key);
        }
      }
    }
    for (const d of s.defenders) if ((d.phase === "telegraph" || d.phase === "committed") && !gapAt.has(d)) gapAt.set(d, Math.abs(s.x - d.x));
    if (s.presser != null) {
      const d = s.defenders[s.presser];
      if (s.y - d.y < DUEL.jockeyD) pressed.set(d, Math.min(pressed.get(d) ?? 99, Math.abs(s.x - d.x)));
    }
    stepRun(s, DT); wall += DT;
  }
  // A take-on: with duels on, the man who took you on (one at a time), was
  // square on you (within 1.6 m across) inside jockeying range, and got to you; with duels off (the old run, no such thing), a man who went
  // for it while within 1.6 m across of you.
  const duels: Duel[] = s.defenders
    .filter(d => d.sepAtContact !== undefined && (s.duels ? (pressed.get(d) ?? 99) < 1.6 : (gapAt.get(d) ?? 99) < 1.6))
    .map(d => ({ won: d.phase === "beaten" && !d.fouled, fouled: !!d.fouled }));
  return { s, duels };
}

export function measure(n: number, o: { dribbling: number; pace: number; bot: Bot; duels?: boolean; defMean?: number }) {
  let won = 0, fouled = 0, total = 0, clear = 0, foulRuns = 0;
  for (let i = 1; i <= n; i++) {
    const r = botRun(i, o);
    for (const d of r.duels) { total++; if (d.won) won++; if (d.fouled) fouled++; }
    if (r.s.phase === "clear") clear++;
    if (r.s.phase === "fouled") foulRuns++;
  }
  return { success: won / Math.max(1, total), foul: fouled / Math.max(1, total), duels: total, clear: clear / n, foulRuns: foulRuns / n };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const N = QUICK ? 400 : 1500;

const isMain = process.argv[1] && /dribbleDuels\.mts$/.test(process.argv[1]);
if (isMain) {
  const avg = measure(N, { dribbling: 60, pace: 70, bot: BOTS.human });
  const elite = measure(N, { dribbling: 92, pace: 88, bot: BOTS.human });
  const poor = measure(N, { dribbling: 30, pace: 50, bot: BOTS.human });
  const perfect = measure(N, { dribbling: 60, pace: 70, bot: BOTS.perfect });
  const slow = measure(N, { dribbling: 60, pace: 70, bot: BOTS.slow });
  const blind = measure(N, { dribbling: 60, pace: 70, bot: BOTS.blind });
  const noFeint = measure(N, { dribbling: 60, pace: 70, bot: BOTS.burstOnly });
  const fast = measure(N, { dribbling: 60, pace: 95, bot: BOTS.human });
  const slowLegs = measure(N, { dribbling: 60, pace: 40, bot: BOTS.human });
  console.log(`  take-ons won (human bot, ${N} runs a row, defenders 60-85):`);
  console.log(`    dribbling 30 / pace 50: ${pct(poor.success)}   60 / 70: ${pct(avg.success)}   92 / 88: ${pct(elite.success)}`);
  console.log(`    pace 40: ${pct(slowLegs.success)}   pace 95: ${pct(fast.success)} (dribbling 60)`);
  console.log(`    timing — perfect ${pct(perfect.success)}, human ${pct(avg.success)}, slow ${pct(slow.success)}, blind ${pct(blind.success)}, no feints ${pct(noFeint.success)}`);
  console.log(`    fouls ${pct(avg.foul)} of duels (elite ${pct(elite.foul)}); runs cleared ${pct(avg.clear)} (elite ${pct(elite.clear)}), runs ending in a free kick ${pct(avg.foulRuns)}`);

  check(avg.success > 0.44 && avg.success < 0.57, `an average dribbler wins about half his take-ons (got ${pct(avg.success)}, want 44-57%)`);
  check(elite.success > 0.58 && elite.success < 0.72, `an elite dribbler wins about two in three (got ${pct(elite.success)}, want 58-72%)`);
  check(poor.success < avg.success - 0.05, `a poor dribbler wins clearly fewer (${pct(poor.success)} vs ${pct(avg.success)})`);
  check(fast.success > slowLegs.success + 0.04, `pace matters (95: ${pct(fast.success)} vs 40: ${pct(slowLegs.success)})`);
  check(perfect.success > avg.success + 0.12, `perfect timing beats human timing clearly (${pct(perfect.success)} vs ${pct(avg.success)})`);
  check(slow.success < avg.success - 0.12, `slow timing loses clearly more (${pct(slow.success)} vs ${pct(avg.success)})`);
  check(blind.success < 0.22, `swiping blind rarely works (${pct(blind.success)})`);
  check(noFeint.success < avg.success, `feints help (no feints ${pct(noFeint.success)} vs ${pct(avg.success)})`);
  check(avg.foul > 0.05 && avg.foul < 0.17, `about one duel in ten ends in a foul (${pct(avg.foul)})`);

  // Determinism: the same seed and inputs give the same run.
  {
    const a = botRun(17, { dribbling: 60, pace: 70, bot: BOTS.human }), b = botRun(17, { dribbling: 60, pace: 70, bot: BOTS.human });
    check(JSON.stringify(a.duels) === JSON.stringify(b.duels) && a.s.phase === b.s.phase, "duels are deterministic for a seed");
  }
  // Do nothing and you lose.
  {
    let survived = 0;
    for (let i = 1; i <= 300; i++) {
      const rng = mulberry32(i);
      const s = newRun({ pace: 70, oppStrength: 75, waveSizes: [1, 1, 1], rng, duels: true, dribbling: 60 });
      let g = 0; while (s.phase === "running" && g++ < 3000) stepRun(s, DT);
      if (s.phase === "clear") survived++;
    }
    check(survived <= 3, `standing still never gets you through (${survived}/300 cleared)`);
  }
  void DUEL;

  if (problems.length) {
    console.log("FAIL");
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log("PASS — duels: half won by an average dribbler, two in three by the best, timing and stats both count; Old unchanged");
}
