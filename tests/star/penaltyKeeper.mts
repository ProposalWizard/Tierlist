/**
 * THE PENALTY KEEPER — measured on the real engine.
 *
 * Every penalty is struck exactly the way CanvasMatch strikes one (launch at
 * a chosen aim, the keeper's read applied at the strike through
 * lib/star/penaltyKeeper.ts, then the same per-substep loop at 180 Hz), and is
 * scored the way a penalty is: SCORED (in, not off a follow-up), SAVED (the
 * keeper got a touch and it didn't go in) or MISSED (wide, over, post).
 *
 * The REAL MATCH is pinned to the Premier League ruleset (Harry, 26 Sep 2026):
 *   - overall ~80-85 % scored, ~10-15 % saved, ~3-5 % missed;
 *   - corners score a bit more than 70 %;
 *   - down the middle scores about as often as a placed one, and a chipped
 *     Panenka scores when he dives and is saved when he stays;
 *   - placement, power and the keeper's rating all move the odds, but no
 *     option goes below ~50 % or above ~95 %;
 *   - he never moves before the strike, and he dives a real distance.
 * The TRIAL is pinned to stay exactly as hard as it was, and to ramp.
 *
 * ── The human aim this is measured against ──
 * A realistic spread of kicks, not one spot: 70 % placed to a side (anywhere
 * from 1.4 m off-centre to the post, weighted towards the post), 20 % down
 * the middle, 10 % chipped down the middle. Power 0.6-0.9, height from the
 * grass to about 2.2 m. Kicker power/technique 60 (trial: 55).
 *
 * Run: npx tsx tests/star/penaltyKeeper.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import {
  penaltyReadFor, decidePenaltyRead, applyPenaltyRead, PENALTY_READ_DEFAULT, PENALTY_READ_TRIAL,
  type PenaltyReadSettings,
} from "../../lib/star/penaltyKeeper";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

interface Kick { off: number; power: number; cy: number }
type Res = "scored" | "saved" | "missed";
type Keeper = { ks: number; read: PenaltyReadSettings };

/** The real match's keeper at this rating (no override). */
const real = (ks: number): Keeper => ({ ks, read: penaltyReadFor(ks) });
/** The trial's keeper, at its easiest (difficulty 0) and hardest (difficulty 1) —
 *  the numbers trialStages.ts's penaltySetup / penaltyReadForTrial give. */
const TRIAL_EASY: Keeper = { ks: 45, read: penaltyReadFor(45, { commitChance: 0.65, readChance: 0.55 }) };
const TRIAL_HARD: Keeper = { ks: 90, read: penaltyReadFor(90, { commitChance: 0.95, readChance: 0.72 }) };

/** One penalty, struck the way CanvasMatch strikes it. */
function penalty(seed: number, kick: Kick, keeper: Keeper, skills = { power: 60, technique: 60 }): Res {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, keeper.ks, 60, 55);
  initDefenders(sc, rng);
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const dx = cx + kick.off - sc.ball.x, dy = 0 - sc.ball.y, L = Math.hypot(dx, dy);
  const ball = launch(sc, { x: dx / L, y: dy / L }, kick.power, { cx: 0, cy: kick.cy }, skills, rng);
  const r = mulberry32((seed ^ 0x5eed) >>> 0);
  applyPenaltyRead(sc, decidePenaltyRead(sc, ball, keeper.read, [r(), r()]));
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    res = stepBall(ball, sc, rng, h);
  }
  if ((res === "goal" || res === "rebound") && !sc.follower.shot) return "scored";
  return sc.keeper.saves > 0 ? "saved" : "missed";
}

type Zone = "placed" | "corner" | "2m" | "middle" | "chip";
function kickFor(zone: Zone, rng: () => number, power?: number): Kick {
  const side = rng() < 0.5 ? -1 : 1;
  const p = power ?? 0.6 + rng() * 0.3;
  const cy = -1 + rng() * 1.25; // grass to ~2.2 m at the line
  switch (zone) {
    case "placed": return { off: side * (1.4 + 2.15 * Math.sqrt(rng())), power: p, cy };
    case "corner": return { off: side * (2.9 + rng() * 0.65), power: p, cy };
    case "2m": return { off: side * (1.6 + rng() * 0.8), power: p, cy };
    case "middle": return { off: (rng() - 0.5) * 0.8, power: p, cy };
    // A Panenka: soft, under the ball, down the middle — about 1.2-2.4 m high
    // and over a second in the air.
    case "chip": return { off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: 0.3 + rng() * 0.45 };
  }
}
function mixKick(rng: () => number): Kick {
  const u = rng();
  return kickFor(u < 0.7 ? "placed" : u < 0.9 ? "middle" : "chip", rng);
}

interface Rate { s: number; v: number; m: number }
function rate(n: number, gen: (rng: () => number) => Kick, keeper: Keeper, skills?: { power: number; technique: number }): Rate {
  const c = { scored: 0, saved: 0, missed: 0 };
  for (let i = 0; i < n; i++) {
    const seed = 1000 + i * 7919;
    c[penalty(seed, gen(mulberry32((seed ^ 0xa11ce) >>> 0)), keeper, skills)]++;
  }
  return { s: c.scored / n, v: c.saved / n, m: c.missed / n };
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const show = (name: string, r: Rate) => console.log(`  ${name.padEnd(28)} scored ${pct(r.s).padStart(6)}  saved ${pct(r.v).padStart(6)}  missed ${pct(r.m).padStart(5)}`);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE REAL MATCH (typical keeper, 62)");
const overall = rate(2000, mixKick, real(62));
show("overall (realistic mix)", overall);
const Z = 800;
const zones = {} as Record<Zone, Rate>;
for (const z of ["placed", "corner", "2m", "middle", "chip"] as Zone[]) {
  zones[z] = rate(Z, (g) => kickFor(z, g), real(62));
  show(z, zones[z]);
}
ok(overall.s >= 0.78 && overall.s <= 0.86, `overall scored ~80-85 % (${pct(overall.s)})`);
ok(overall.v >= 0.10 && overall.v <= 0.18, `overall saved ~10-15 % (${pct(overall.v)}); real PL all-time 17.7 %`);
ok(overall.m >= 0.02 && overall.m <= 0.06, `overall missed ~3-5 % (${pct(overall.m)})`);
ok(zones.corner.s > 0.72 && zones.corner.s < 0.9, `a corner scores a bit more than 70 % (${pct(zones.corner.s)})`);
ok(Math.abs(zones.middle.s - zones.corner.s) < 0.12, `down the middle scores about as often as a corner (${pct(zones.middle.s)} vs ${pct(zones.corner.s)})`);
ok(zones.middle.s > zones.placed.s - 0.05, `…and no worse than a placed kick overall (${pct(zones.middle.s)} vs ${pct(zones.placed.s)})`);
ok(zones["2m"].s < zones.corner.s - 0.1, `placement matters: 2 m in is easier to save than the corner (${pct(zones["2m"].s)} vs ${pct(zones.corner.s)})`);

console.log("\nTHE PANENKA");
{
  const stays = { ks: 62, read: { ...penaltyReadFor(62), commitChance: 0 } };
  const dives = { ks: 62, read: { ...penaltyReadFor(62), commitChance: 1 } };
  const vStay = rate(400, (g) => kickFor("chip", g), stays);
  const vDive = rate(400, (g) => kickFor("chip", g), dives);
  show("chip vs a keeper who stays", vStay);
  show("chip vs a keeper who dives", vDive);
  ok(vStay.s < 0.3, `a keeper who stays catches it (scored ${pct(vStay.s)})`);
  ok(vDive.s > 0.8, `a keeper who dives is beaten by it (scored ${pct(vDive.s)})`);
}

console.log("\nPOWER, RATING — every option between ~50 % and ~95 %");
{
  const cells: [string, Rate][] = [];
  for (const ks of [40, 62, 85]) {
    for (const z of ["corner", "2m", "middle", "chip"] as Zone[]) cells.push([`k${ks} ${z}`, ks === 62 ? zones[z] : rate(500, (g) => kickFor(z, g), real(ks))]);
    for (const p of [0.5, 0.95]) for (const z of ["corner", "2m"] as Zone[]) cells.push([`k${ks} ${z} power ${p}`, rate(500, (g) => kickFor(z, g, p), real(ks))]);
  }
  for (const [name, r] of cells) show(name, r);
  const lo = Math.min(...cells.map(([, r]) => r.s)), hi = Math.max(...cells.map(([, r]) => r.s));
  ok(lo >= 0.5, `no option below ~50 % (lowest ${pct(lo)})`);
  ok(hi <= 0.95, `no option above ~95 % (highest ${pct(hi)})`);
  const get = (n: string) => cells.find(([k]) => k === n)![1];
  ok(get("k62 corner power 0.5").s !== get("k62 corner power 0.95").s, `power moves the odds (corner: ${pct(get("k62 corner power 0.5").s)} soft vs ${pct(get("k62 corner power 0.95").s)} hard — a hard one beats him more but misses more)`);
  const k40 = rate(1200, mixKick, real(40)), k85 = rate(1200, mixKick, real(85));
  show("overall k40", k40); show("overall k85", k85);
  ok(k40.s > overall.s && overall.s > k85.s, `a better keeper saves more (${pct(k40.s)} > ${pct(overall.s)} > ${pct(k85.s)} scored)`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE TRIAL — harder on purpose, and ramping (easiest vs hardest rep)");
{
  const tsk = { power: 55, technique: 55 };
  const easy = rate(1000, mixKick, TRIAL_EASY, tsk), hard = rate(1000, mixKick, TRIAL_HARD, tsk);
  show("trial easiest", easy); show("trial hardest", hard);
  // Measured before the real-match ruleset on these exact seeds: 48.6 % and
  // 25.1 %. The trial keeper is the old one on purpose (PENALTY_READ_TRIAL).
  ok(easy.s <= 0.49, `the easiest trial rep is no easier than it was (${pct(easy.s)}, was 48.6 %)`);
  ok(hard.s <= 0.255, `the hardest trial rep is no easier than it was (${pct(hard.s)}, was 25.1 %)`);
  ok(hard.s < easy.s - 0.1, "it still ramps");
  ok(easy.s < overall.s - 0.2, `the trial is harder than a real match (${pct(easy.s)} vs ${pct(overall.s)})`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE DIALS");
{
  const lo = penaltyReadFor(40), mid = penaltyReadFor(62), hi = penaltyReadFor(95);
  ok(lo.readChance <= mid.readChance && mid.readChance < hi.readChance, `a better keeper reads no worse (${lo.readChance.toFixed(2)} ≤ ${mid.readChance.toFixed(2)} < ${hi.readChance.toFixed(2)})`);
  ok(lo.readChance >= 0.5 && hi.readChance <= 0.65, "never worse than a coin flip, never a mind-reader");
  ok(lo.metres < mid.metres && mid.metres < hi.metres, `a better keeper's longest dive goes further (${lo.metres.toFixed(2)} < ${mid.metres.toFixed(2)} < ${hi.metres.toFixed(2)} m)`);
  ok(mid.commitChance >= 0.9, `he dives almost every time (${pct(mid.commitChance)})`);
  ok(mid.commitChance === PENALTY_READ_DEFAULT.commitChance && mid.readChance === PENALTY_READ_DEFAULT.readChance, "a typical keeper is the default");
  // A trial override is built on the OLD keeper, field for field.
  const t = penaltyReadFor(62, { readChance: 0.9 });
  ok(t.readChance === 0.9, "an override (a harder trial rep) replaces a dial");
  ok(t.metres === PENALTY_READ_TRIAL.metres && t.shortest === undefined && t.reach === undefined && t.commitChance === PENALTY_READ_TRIAL.commitChance,
    "…on top of the old keeper: a fixed 1.4 m dive at full reach");
  ok(penaltyReadFor(62, { metres: 99 }).metres <= 3.2, "…within the engine's own reach along the line");
}

console.log("\nTHE DECISION");
{
  const rng = mulberry32(7);
  const sc = buildScenario("penalty", rng, 62, 60, 55);
  initDefenders(sc, rng);
  const s = penaltyReadFor(62);
  let went = 0, minM = 99, maxM = 0;
  for (let i = 0; i < 2000; i++) {
    const r = mulberry32(i + 1);
    const d = decidePenaltyRead(sc, { pos: sc.ball, vel: { x: 4, y: -25 } } as never, s, [r(), r()]);
    if (d.went) { went++; minM = Math.min(minM, d.metres); maxM = Math.max(maxM, d.metres); }
  }
  ok(went / 2000 > 0.93, `he commits at the strike ${pct(went / 2000)} of the time`);
  ok(minM >= s.shortest! - 1e-9 && maxM <= s.metres + 1e-9 && maxM - minM > 1, `and dives a real, varying distance (${minM.toFixed(2)}-${maxM.toFixed(2)} m, not a fixed 1.4)`);
  // A replay applies the saved decision and gets the same keeper.
  const d = decidePenaltyRead(sc, { pos: sc.ball, vel: { x: 4, y: -25 } } as never, s, [0.3, 0.1]);
  const a = JSON.parse(JSON.stringify(sc)) as Scenario, b = JSON.parse(JSON.stringify(sc)) as Scenario;
  applyPenaltyRead(a, d); applyPenaltyRead(b, JSON.parse(JSON.stringify(d)));
  ok(a.keeper.targetX === b.keeper.targetX && a.keeperReach === b.keeperReach && a.keeperReach === s.reach, "a replay of the saved decision dives the same way, as far, with the same reach");
  const stay = decidePenaltyRead(sc, { pos: sc.ball, vel: { x: 4, y: -25 } } as never, s, [0.99, 0]);
  const c = JSON.parse(JSON.stringify(sc)) as Scenario;
  applyPenaltyRead(c, stay);
  ok(!stay.went && c.keeperReach === undefined && !c.keeper.scrambling, "when the first roll says stay, he stays — with his full reach");
}

console.log("\nHE NEVER MOVES BEFORE THE STRIKE");
{
  const rng = mulberry32(42);
  const sc = buildScenario("penalty", rng, 62, 60, 55);
  initDefenders(sc, rng);
  const x0 = sc.keeper.x;
  for (let i = 0; i < 180; i++) stepKeeper(sc, 1 / 60);
  ok(Math.abs(sc.keeper.x - sc.keeper.startX) < 0.6 && !sc.keeper.scrambling,
    `three seconds of aiming: he's still set in the middle (moved ${Math.abs(sc.keeper.x - x0).toFixed(2)} m, not diving)`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
