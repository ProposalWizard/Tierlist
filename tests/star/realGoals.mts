/**
 * REAL GOALS (Leo, 18 Oct 2026) — the test page /star-real-goals-dev.
 *
 *   1. No StatsBomb data or code is left anywhere (its licence forbids a paid
 *      game; rebuilt on Wyscout's CC BY data, 19 Oct 2026).
 *   2. The level map: 5 stages of 10, easiest first, every featured goal in, stars unlock.
 *   3. Accuracy: the real spot is 100%, far off is near 0; the stars.
 *   4. Always scoreable as the real goal: every featured goal struck along its real
 *      line scores at least 95% with the real lane on (and far less without it).
 *   5. The real sides: a kit for every nation in the data, no clashes, the real
 *      keeper's name, and no made-up names on the placed men.
 *   6. The build-up follows the real move closer than the Real shots lead-in.
 *   7. The real match is unchanged with the lane absent: a fingerprint of real goals struck
 *      with no lane (retaken on the Wyscout goals, 19 Oct 2026; the StatsBomb one
 *      was taken on the engine before the lane existed).
 *
 * Run: npx tsx tests/star/realGoals.mts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadGoals, aimAtReal, playStrike } from "./realGoals/harness.mts";
import { measureBuildup } from "./realGoals/buildup.mts";
import {
  buildLevels, levelOpen, recordResult, totalStars, accuracyPct, starsFor, realEnd, NATION_KITS, kitsForGoal,
  colourGap, KIT_CLASH, FEATURED, dressFor, scenarioForGoal, LEVELS_PER_STAGE, STAGE_GATES, shortNameOf, knownAs,
  type Progress,
} from "../../lib/star/realGoals";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// ── 1. No StatsBomb anywhere ──────────────────────────────────────────────
console.log("\n1. NO STATSBOMB DATA OR CODE");
{
  const bad: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (/statsbomb|kane-moments/i.test(f)) bad.push(p);
      if (statSync(p).isDirectory()) { if (f !== "node_modules" && !f.startsWith(".")) walk(p); continue; }
      if (!/\.(ts|tsx|mts|js|mjs|py|json)$/.test(f)) continue;
      const src = readFileSync(p, "utf8");
      if (/statsbombShots|data\/statsbomb|statsbomb\/open-data|statsbomb-shots|kane-moments\.json/.test(src) && !p.endsWith("realGoals.mts")) bad.push(p);
    }
  };
  for (const d of ["app", "components", "lib", "public", "data", "scripts", "tools"]) walk(d);
  ok(bad.length === 0, `no StatsBomb file, import or data path left${bad.length ? ` (found: ${bad.join(", ")})` : ""}`);
}

const goals = loadGoals();
ok(goals.length === 232, `232 real goals (World Cup 2018 + Euro 2016, not penalties) joined with their facts (${goals.length})`);

// ── 2. Levels ─────────────────────────────────────────────────────────────
console.log("\n2. THE LEVEL MAP");
{
  const stages = buildLevels(goals);
  ok(stages.length === 5 && stages.every((s) => s.levels.length === LEVELS_PER_STAGE), "5 stages of 10");
  const all = stages.flatMap((s) => s.levels);
  ok(all.every((l, i) => l.n === i), "levels numbered 0..49 in order");
  ok(new Set(all.map((l) => l.goal.id)).size === all.length, "no goal twice");
  ok(stages.every((s) => s.levels.every((l, i) => i === 0 || l.difficulty >= s.levels[i - 1].difficulty)), "easiest first inside each stage");
  const mean = stages.map((s) => s.levels.reduce((a, l) => a + l.difficulty, 0) / s.levels.length);
  ok(mean.every((m, i) => i === 0 || m > mean[i - 1]), `each stage harder than the last (mean difficulty ${mean.map((m) => m.toFixed(1)).join(" → ")})`);
  const ids = new Set(all.map((l) => l.goal.id));
  ok(FEATURED.every((f) => ids.has(f.id)), "every featured goal is a level");
  let p: Progress = {};
  ok(levelOpen(stages, p, all[0]) && !levelOpen(stages, p, all[1]), "new: only level 1 open");
  p = recordResult(p, all[0].goal.id, 1, 40);
  ok(levelOpen(stages, p, all[1]), "a star on level 1 opens level 2");
  ok(!levelOpen(stages, p, stages[1].levels[0]), `stage 2 shut below ${STAGE_GATES[1]} stars`);
  for (const l of stages[0].levels) p = recordResult(p, l.goal.id, 1, 30);
  ok(totalStars(p) === 10 && levelOpen(stages, p, stages[1].levels[0]), "10 stars opens stage 2");
  p = recordResult(p, all[0].goal.id, 0, 10);
  ok(p[all[0].goal.id].stars === 1 && p[all[0].goal.id].best === 40, "a worse try never loses a star or the best %");
}

// ── 3. Accuracy ───────────────────────────────────────────────────────────
console.log("\n3. ACCURACY AND STARS");
{
  const r = { x: 31, z: 0.4 };
  ok(accuracyPct(r, r) === 100, "the real spot exactly = 100%");
  const a45 = accuracyPct(r, { x: 31.45, z: 0.4 }), a80 = accuracyPct(r, { x: 31.8, z: 0.4 }), far = accuracyPct(r, { x: 37, z: 2 });
  ok(Math.abs(a45 - 85) < 1, `45 cm off = 85% (${a45.toFixed(1)})`);
  ok(Math.abs(a80 - 60) < 1.5, `80 cm off = 60% (${a80.toFixed(1)})`);
  ok(far < 1, `the other corner = ${far.toFixed(2)}%`);
  ok(accuracyPct(r, null) === 0, "never reached the line = 0%");
  ok(starsFor(false, 99) === 0 && starsFor(true, 10) === 1 && starsFor(true, 60) === 2 && starsFor(true, 85) === 3, "no goal 0 · goal ★ · 60% ★★ · 85% ★★★");
  ok(accuracyPct(r, { x: 31.06, z: 0.4 }) >= 99.5, "6 cm off still reads 100% (possible, but hard)");
}

// ── 4. Always scoreable ──────────────────────────────────────────────────
console.log("\n4. ALWAYS SCOREABLE AS THE REAL GOAL (struck exactly along the real line, 6 seeds each)");
{
  const N = 6;
  let on = 0, off = 0, n = 0;
  for (const f of FEATURED) {
    const g = goals.find((q) => q.id === f.id)!;
    const aim = aimAtReal(g);
    for (let i = 0; i < N; i++) {
      const seed = (9001 + i * 7919) >>> 0;
      if (playStrike(g, aim, true, seed, false).goal) on++;
      if (playStrike(g, aim, false, seed, false).goal) off++;
      n++;
    }
  }
  console.log(`  featured: lane off ${(100 * off / n).toFixed(1)}% → on ${(100 * on / n).toFixed(1)}% (${n} strikes)`);
  ok(on / n >= 0.95, `the real line scores at least 95% (${(100 * on / n).toFixed(1)}%)`);
  ok(off < on, "and the lane is what does it (fewer without it)");
  // A strike well off the real line plays normally: never in the lane.
  const g = goals.find((q) => q.id === FEATURED[0].id)!;
  const aim = aimAtReal(g);
  const wide = playStrike(g, { ...aim, angle: aim.angle + 0.12 }, true, 4242, false);
  ok(!wide.inLane, "a strike 7° off the real line is not in the lane");
}

// ── 5. Kits and names ────────────────────────────────────────────────────
console.log("\n5. THE REAL SIDES");
{
  const teams = new Set(goals.flatMap((g) => [g.x.home, g.x.away]));
  const missing = [...teams].filter((t) => !NATION_KITS[t]);
  ok(missing.length === 0, `a kit for every one of the ${teams.size} nations${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
  const clash = goals.filter((g) => { const k = kitsForGoal(g); return colourGap(k.us.shirt, k.them.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.us.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.them.shirt) < KIT_CLASH; });
  ok(clash.length === 0, `no two shirts alike in any of the ${goals.length} goals (${clash.length})`);
  ok(shortNameOf("Kylian Mbappé") === "Mbappé" && shortNameOf("Ángel Di María") === "Di María" && shortNameOf("Neymar") === "Neymar", "short names: Mbappé, Di María, Neymar");
  ok(knownAs(goals[0], "  Dimitri  Payet ") === "Dimitri Payet", "known names come tidied from the data (Dimitri Payet)");
  let keeperNamed = 0, foreign = 0;
  for (const f of FEATURED) {
    const gg = goals.find((q) => q.id === f.id)!;
    const sc = scenarioForGoal(gg);
    dressFor(gg)(sc);
    if (sc.keeper.who?.name && sc.keeper.who.name === gg.x.keeper) keeperNamed++;
    for (const w of [...sc.defenders.map((d) => d.who), ...sc.secondaryRunners.map((r) => r.who), ...(sc.runner ? [sc.runner.who] : [])]) if (w?.name) foreign++;
  }
  ok(keeperNamed === FEATURED.length, `the conceding keeper's real name in every featured goal (${keeperNamed}/${FEATURED.length})`);
  ok(foreign === 0, "the placed men carry no name (never a name from outside the real match)");
}

// ── 6. Build-up ──────────────────────────────────────────────────────────
console.log("\n6. THE BUILD-UP FOLLOWS THE REAL MOVE");
{
  const r = measureBuildup();
  console.log(`  ${r.goals} goals: replayed ball ${r.before.toFixed(2)} m off the real ball before → ${r.after.toFixed(2)} m after; ${r.oldActions.toFixed(1)} → ${r.newActions.toFixed(1)} actions a goal`);
  ok(r.after < r.before / 3, "at least 3× closer to the real ball");
  ok(r.after < 1, "under a metre off on average");
}

// ── 7. Fingerprint ───────────────────────────────────────────────────────
console.log("\n7. THE REAL MATCH IS UNCHANGED WITH THE LANE ABSENT");
{
  /** Retaken on Harry 66ce9cf1 with the Wyscout goals and their placed pictures
   *  (19 Oct 2026; it moves if the placing rule in lib/star/realMoments changes). The StatsBomb
   *  goals' one (c7ad8836) was taken on origin/main 0beabcbf, before the real lane. */
  const OLD_HASH = "c0175259";
  let h = 2166136261 >>> 0;
  const mix = (v: number | string) => { const s = typeof v === "number" ? (Number.isNaN(v) ? "nan" : v.toFixed(4)) : v; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const g of goals.slice(0, 40)) {
    const aim = aimAtReal(g);
    mix(aim.angle); mix(aim.cy);
    for (let i = 0; i < 2; i++) {
      const p = playStrike(g, aim, false, (777 + i * 31) >>> 0, true);
      mix(p.outcome); mix(p.x); mix(p.z);
    }
  }
  const fp = h.toString(16).padStart(8, "0");
  console.log(`  fingerprint (no lane) ${fp}`);
  ok(OLD_HASH === "PENDING" || fp === OLD_HASH, `no lane = exactly the engine before it (${fp} = ${OLD_HASH})`);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
void realEnd;
