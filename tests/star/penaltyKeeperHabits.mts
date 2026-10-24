/**
 * THE SHOOTOUT KEEPER READS YOUR HABITS (Leo, 22 Oct 2026 — test page only).
 *
 * "The keeper remembers where you put your last kicks and leans that way.
 * Mix it up or get read." lib/star/penaltyKeeper.ts's `habit` (from
 * `readKickHabits`), played on /star-shootout-dev through ShootoutPlay's
 * `readsHabits`.
 *
 * 1. NO HISTORY = EXACTLY AS BEFORE. A fingerprint of the keeper's settings,
 *    his decisions over 400 aims and 300 whole kicks through the keeper brain
 *    (run-up hop included), taken BEFORE the habit code was written, frozen
 *    below. It must match with no habit, an empty history and a 1-kick history.
 * 2. The read itself (words, minimum kicks, cap, mixed taker = no lean).
 * 3. Measured on the real engine: same side five times, habits off vs on;
 *    a mixed-up taker, off vs on.
 *
 * Run: npx tsx tests/star/penaltyKeeperHabits.mts
 */
import { createHash } from "node:crypto";
import { buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions, type Scenario } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import { brainSetup, brainAim, brainStrike, brainStep, brainRunUp } from "../../lib/star/keeperBrain";
import {
  penaltyReadFor, decidePenaltyRead, readKickHabits, KICK_HABITS,
  type PastKick, type KickSide, type PenaltyReadSettings,
} from "../../lib/star/penaltyKeeper";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

/** Taken on the code before the habit existed (22 Oct 2026, commit 42b4aaf1). */
const FROZEN = "b3498da413c40f61a963f08f4b67e1066fe4158ba10057c6c5a1c50d01346aa9";

const OVERRIDES: (Partial<PenaltyReadSettings> | undefined)[] = [undefined, { commitChance: 0.65, readChance: 0.55 }, { commitChance: 0.95, readChance: 0.72 }, {}, { metres: 2, shortest: 1, reach: 0.5 }];

/** `withHistory` adds a habit built from that history to every keeper — the
 *  no-history cases must come out byte for byte as before. */
function fingerprint(withHistory?: PastKick[]): string {
  const add = (ov: Partial<PenaltyReadSettings> | undefined): Partial<PenaltyReadSettings> | undefined =>
    // A bare `{}` is a trial override today and stays one, so it is left alone.
    withHistory === undefined || (ov && Object.keys(ov).length === 0) ? ov : { ...(ov ?? {}), habit: readKickHabits(withHistory) };
  const out: unknown[] = [];
  for (const ks of [20, 40, 55, 62, 70, 85, 99, NaN]) for (const ov of OVERRIDES) {
    out.push(penaltyReadFor(ks, add(ov)));
  }
  for (let i = 0; i < 400; i++) {
    const rng = mulberry32(1000 + i * 31);
    const sc = buildScenario("penalty", rng, 62, 60, 55);
    const cx = (sc.goal.x1 + sc.goal.x2) / 2;
    const off = (rng() - 0.5) * 7.2;
    const dx = cx + off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
    const ball = launch(sc, { x: dx / L, y: dy / L }, 0.75, { cx: 0, cy: 0 }, { power: 60, technique: 60 }, rng);
    const s = penaltyReadFor([40, 62, 85][i % 3], add(OVERRIDES[i % OVERRIDES.length]));
    out.push(decidePenaltyRead(sc, ball, s, [rng(), rng()]));
  }
  for (let i = 0; i < 300; i++) {
    const seed = 5000 + i * 7919;
    const rng = mulberry32(seed);
    const sc: Scenario = buildScenario("penalty", rng, 62, 60, 55);
    enforceHardRules(sc); initDefenders(sc, rng);
    brainSetup(sc, (seed ^ 0x4b7e) >>> 0, 62, { penalty: penaltyReadFor(62, add(undefined)) });
    const cx = (sc.goal.x1 + sc.goal.x2) / 2;
    const off = (rng() - 0.5) * 7;
    for (let t = 0; t < 2.0; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); brainRunUp(sc, 1 / 60, t, cx + off); }
    const dx = cx + off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
    const ball = launch(sc, { x: dx / L, y: dy / L }, 0.75, { cx: 0, cy: -0.5 }, { power: 60, technique: 60 }, rng);
    brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
    let res: string | null = null;
    for (let t = 0; !res && t < 8; t += 1 / 180) { const h = 1 / 180; stepDefenders(sc, h, ball.pos, false, ball); stepKeeper(sc, h); stepReactions(sc, ball, h, rng); brainStep(sc, ball, h); res = stepBall(ball, sc, rng, h); }
    out.push([res, sc.keeper.saves, Math.round(sc.keeper.x * 1000)]);
  }
  return createHash("sha256").update(JSON.stringify(out)).digest("hex");
}

console.log("\n1. NO HISTORY = EXACTLY AS BEFORE");
const now = fingerprint();
ok(now === FROZEN, `no habit: fingerprint matches the one frozen before the change (${now.slice(0, 12)}…)`);
ok(fingerprint([]) === FROZEN, "empty history: same fingerprint");
ok(fingerprint([{ side: "left", height: "low" }]) === FROZEN, "one kick (under the 2 he needs): same fingerprint");
ok(fingerprint([{ side: "left", height: "low" }, { side: "right", height: "high" }, { side: "left", height: "low" }, { side: "right", height: "low" }]) === FROZEN, "a mixed-up taker (L R L R): same fingerprint — never read");
ok(fingerprint([{ side: "left", height: "low" }, { side: "left", height: "low" }, { side: "left", height: "low" }]) !== FROZEN, "three to the left: the keeper does change");

console.log("\n2. THE READ");
const K = (s: string): PastKick[] => [...s].map((c) => ({ side: (c === "L" ? "left" : c === "R" ? "right" : "centre") as KickSide, height: "low" }));
const show = (s: string) => { const r = readKickHabits(K(s)); console.log(`  ${s.padEnd(6)} → ${r.side ?? "-"} strength ${r.strength.toFixed(2)}  "${r.words}"`); return r; };
ok(show("").strength === 0 && show("L").strength === 0, "under 2 kicks: no lean");
const ll = show("LL"), lll = show("LLL"), llll = show("LLLL"), llrl = show("LLRL");
ok(ll.strength > 0 && lll.strength > ll.strength && llll.strength > lll.strength, "the lean grows with each kick the same way");
ok(llll.strength === KICK_HABITS.cap, `four the same way: the cap (${KICK_HABITS.cap})`);
ok(llrl.side === "left" && llrl.strength > 0 && llrl.words.startsWith("3 of your 4 kicks went left"), `3 of 4 left: "${llrl.words}"`);
ok(show("LRLR").strength === 0 && show("RLRL").strength === 0 && show("LRCLRC").strength === 0, "a mixed-up taker is never read");
ok(show("CCC").side === "centre" && show("CCC").dir === 0, "always down the middle: he stays more");
ok(show("RRRRRRRRRR").strength <= KICK_HABITS.cap, "never past the cap");

console.log("\n3. MEASURED ON THE REAL ENGINE (keeper 62, kicks 1.4 m to the post, 0.6-0.9 power)");
/** One of your kicks through the brain, with the keeper reading `history`. */
function kick(seed: number, side: -1 | 1 | 0, history: PastKick[] | null): "scored" | "saved" | "missed" {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, 62, 60, 55);
  enforceHardRules(sc); initDefenders(sc, rng);
  const read = penaltyReadFor(62, history ? { habit: readKickHabits(history) } : undefined);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, 62, { penalty: read });
  const g = mulberry32((seed ^ 0xa11ce) >>> 0);
  const off = side === 0 ? (g() - 0.5) * 0.8 : side * (1.4 + 2.15 * Math.sqrt(g()));
  const power = 0.6 + g() * 0.3, cy = -1 + g() * 1.25;
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  for (let t = 0; t < 2.0; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); brainRunUp(sc, 1 / 60, t, cx + off); }
  const dx = cx + off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const ball = launch(sc, { x: dx / L, y: dy / L }, power, { cx: 0, cy }, { power: 60, technique: 60 }, rng);
  brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) { const h = 1 / 180; stepDefenders(sc, h, ball.pos, false, ball); stepKeeper(sc, h); stepReactions(sc, ball, h, rng); brainStep(sc, ball, h); res = stepBall(ball, sc, rng, h); }
  if ((res === "goal" || res === "rebound") && !sc.follower.shot) return "scored";
  return sc.keeper.saves > 0 ? "saved" : "missed";
}
const N = 600;
/** Shootouts of five kicks each: `pick` chooses each kick's side. */
function series(on: boolean, pick: (i: number, r: () => number) => -1 | 0 | 1) {
  let saved = 0, scored = 0, total = 0, saved5 = 0;
  for (let n = 0; n < N; n++) {
    const r = mulberry32(77 + n * 13);
    const hist: PastKick[] = [];
    for (let i = 0; i < 5; i++) {
      const side = pick(i, r);
      const res = kick(90000 + n * 104729 + i * 7919, side, on ? hist : null);
      total++; if (res === "saved") { saved++; if (i === 4) saved5++; } if (res === "scored") scored++;
      hist.push({ side: side < 0 ? "left" : side > 0 ? "right" : "centre", height: "low" });
    }
  }
  return { saved: saved / total, scored: scored / total, saved5: saved5 / N };
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const same = (on: boolean) => series(on, () => -1);
const mixed = (on: boolean) => series(on, (_i, r) => { const u = r(); return u < 0.4 ? -1 : u < 0.8 ? 1 : 0; });
const sOff = same(false), sOn = same(true), mOff = mixed(false), mOn = mixed(true);
console.log(`  same side ×5, habits OFF: saved ${pct(sOff.saved)} (5th kick ${pct(sOff.saved5)}), scored ${pct(sOff.scored)}`);
console.log(`  same side ×5, habits ON : saved ${pct(sOn.saved)} (5th kick ${pct(sOn.saved5)}), scored ${pct(sOn.scored)}`);
console.log(`  mixed taker,  habits OFF: saved ${pct(mOff.saved)}, scored ${pct(mOff.scored)}`);
console.log(`  mixed taker,  habits ON : saved ${pct(mOn.saved)}, scored ${pct(mOn.scored)}`);
ok(sOn.saved > sOff.saved + 0.05, `same side five times gets read: saved ${pct(sOff.saved)} → ${pct(sOn.saved)}`);
ok(sOn.saved5 > sOff.saved5 + 0.08, `…most of all on the 5th kick: ${pct(sOff.saved5)} → ${pct(sOn.saved5)}`);
ok(Math.abs(mOn.saved - mOff.saved) < 0.04, `a mixed-up taker is barely touched: ${pct(mOff.saved)} → ${pct(mOn.saved)}`);
ok(sOn.saved < 0.45, `capped: even a one-side taker is not a wall (${pct(sOn.saved)} saved)`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
