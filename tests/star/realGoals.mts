/**
 * REAL GOALS (Leo, 18 Oct 2026) — the test page /star-real-goals-dev.
 *
 *   1. The data never reaches the real game (nothing outside the test pages imports it).
 *   2. The game: every goal of every collection is a level; chapters (rounds, places) open with stars.
 *   3. Accuracy: the real spot is 100%, far off is near 0; the stars.
 *   4. Always scoreable as the real goal: every featured goal struck along its real
 *      line scores at least 95% with the real lane on (and far less without it); a strike
 *      70%+ like the real one is always a goal (Leo, 19 Oct 2026).
 *   5. The real sides: a kit for every nation in the data, no clashes, real names on the men.
 *   6. The build-up follows the real move: no jumps, the real men where the camera saw them.
 *   7. The real match is unchanged with the lane absent: a fingerprint of real goals struck
 *      with no lane equals the one taken on the engine before the lane existed.
 *
 * Run: npx tsx tests/star/realGoals.mts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadGoals, aimAtReal, playStrike } from "./realGoals/harness.mts";
import { measureTrack } from "./realGoals/track.mts";
import { measureLane } from "./realGoals/lane.mts";
import {
  chaptersFor, chapterOpen, chapterNeeds, recordResult, totalStars, accuracyPct, starsFor, realEnd, NATION_KITS, kitsForGoal,
  colourGap, KIT_CLASH, FEATURED, dressFor, scenarioForGoal, shortNameOf, knownAs, difficultyTier, DIFFICULTY_CUTS, difficultyOf,
  LANE_PCT, LANE_R, ACC_SIGMA,
  type Progress,
} from "../../lib/star/realGoals";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// ── 1. The data guard ─────────────────────────────────────────────────────
console.log("\n1. THE DATA NEVER REACHES THE REAL GAME");
{
  const ALLOWED = [/^app\/star-statsbomb-dev\//, /^app\/star-real-goals-dev\//, /^app\/api\/star\/statsbomb-shots\//, /^lib\/star\/statsbombShots\.ts$/, /^lib\/star\/realGoals\.ts$/, /^lib\/star\/realGoalTrack\.ts$/];
  const bad: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "node_modules" && !f.startsWith(".")) walk(p); continue; }
      if (!/\.(ts|tsx|mts|js|mjs)$/.test(f)) continue;
      const src = readFileSync(p, "utf8");
      const imports = /(from\s+|import\(\s*|require\(\s*)["'][^"']*(statsbombShots|realGoals|data\/statsbomb)["']|["']statsbomb["']\s*,/.test(src);
      if (imports && !ALLOWED.some((r) => r.test(p))) bad.push(p);
    }
  };
  for (const d of ["app", "components", "lib"]) walk(d);
  ok(bad.length === 0, `only the test pages read the StatsBomb data${bad.length ? ` (found: ${bad.join(", ")})` : ""}`);
}

const goals = loadGoals();
const byCol = (k: string) => goals.filter((g) => g.col === k);
{
  const want: Record<string, number> = { wc2022: 169, euro2024: 107, wc2018: 157, euro2020: 131, copa2024: 69, afcon2023: 115 };
  for (const [k, n] of Object.entries(want)) ok(byCol(k).length === n, `${k}: every goal but own goals (${byCol(k).length} of ${n})`);
  ok(byCol("legends").length >= 55, `Legends: ${byCol("legends").length} famous goals`);
  ok(byCol("worldies").length >= 90, `Club worldies: ${byCol("worldies").length}`);
  ok(goals.length >= 880, `${goals.length} goals in all (v0.17 had 250)`);
  ok(byCol("wc2022").filter((g) => g.shot.type === "Penalty").length === 17, "World Cup 2022's 17 penalties are in");
  ok(byCol("wc2022").filter((g) => (g.x.frames?.length ?? 0) >= 2).length >= 140, "World Cup 2022 goals carry 360 frames for the build-up");
  ok(goals.every((g) => g.shot.outcome === "Goal" && g.shot.loc && g.x.names.length === g.shot.ff.length), "every row is a real goal with a name for every frozen man");
}

// ── 2. The game ───────────────────────────────────────────────────────────
console.log("\n2. THE GAME");
{
  const wc = chaptersFor(byCol("wc2022"));
  ok(wc.map((c) => c.name).join(",") === "Matchday 1,Matchday 2,Matchday 3,Round of 16,Quarter-finals,Semi-finals,Third place,The final", `a tournament is played round by round (${wc.map((c) => c.name).join(" → ")})`);
  ok(wc.reduce((a, c) => a + c.goals.length, 0) === 169, "every goal is a level");
  ok(wc[wc.length - 1].goals.some((g) => g.id === "03fb2918"), "Mbappé's volley is in The final");
  for (const k of ["legends", "worldies"]) ok(chaptersFor(byCol(k)).reduce((a, c) => a + c.goals.length, 0) === byCol(k).length, `${k}: every goal in a chapter`);
  let p: Progress = {};
  ok(chapterOpen(wc, 0, p) && !chapterOpen(wc, 1, p), "new: only the first chapter open");
  const need = Math.ceil(wc[0].goals.length / 2);
  ok(chapterNeeds(wc, 1, p) === need, `Matchday 2 needs ${need} goals of Matchday 1 starred`);
  for (const g of wc[0].goals.slice(0, need)) p = recordResult(p, g.id, 1, 30);
  ok(chapterOpen(wc, 1, p) && !chapterOpen(wc, 2, p), "half of Matchday 1 starred opens Matchday 2, not 3");
  p = recordResult(p, wc[0].goals[0].id, 0, 10);
  ok(p[wc[0].goals[0].id].stars === 1 && p[wc[0].goals[0].id].best === 30, "a worse try never loses a star or the best %");
  ok(totalStars(p) === need, "stars add up");
  const tiers = [1, 2, 3, 4, 5].map((t) => goals.filter((g) => difficultyTier(g) === t).length);
  ok(tiers.every((n) => n > goals.length * 0.12), `difficulty spread over five bands (${tiers.join(" / ")})`);
  const d = goals.map(difficultyOf).sort((x, y) => x - y);
  ok(DIFFICULTY_CUTS.every((c, i) => Math.abs(c - d[Math.floor(((i + 1) / 5) * d.length)]) < 0.25), "the band cuts are the quintiles of all the goals");
  ok(goals.find((g) => g.id === "c71a4f0a") ? difficultyTier(goals.find((g) => g.id === "c71a4f0a")!) >= 4 : true, "Bellingham's overhead kick is hard (4-5)");
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
  const g = goals.find((q) => q.id === "03fb2918")!;
  const aim = aimAtReal(g);
  const wide = playStrike(g, { ...aim, angle: aim.angle + 0.12 }, true, 4242, false);
  ok(!wide.inLane, "a strike 7° off the real line is not in the lane");
  ok(Math.abs(accuracyPct({ x: 0, z: 0 }, { x: LANE_R, z: 0 }) - LANE_PCT) < 0.01 && Math.abs(LANE_R - ACC_SIGMA * Math.sqrt(-Math.log(LANE_PCT / 100))) < 1e-9, `the lane's edge is exactly ${LANE_PCT}% on the page's own accuracy (${(LANE_R * 100).toFixed(0)} cm)`);
  const lane = measureLane(Number(process.env.RG_LANE_GOALS ?? 24), 1);
  const hi = lane.rows.filter((r) => r.band === "90-100%" || r.band === "70-90%");
  const hiN = hi.reduce((a, r) => a + r.page.n, 0), hiGoal = hi.reduce((a, r) => a + r.page.goal, 0);
  console.log("  " + lane.rows.map((r) => `${r.band}: ${r.page.goal}/${r.page.n}`).join("  "));
  ok(hiN > 20 && hiGoal === hiN, `every strike ${LANE_PCT}%+ like the real one goes in (${hiGoal}/${hiN})`);
}

// ── 5. Kits and names ────────────────────────────────────────────────────
console.log("\n5. THE REAL SIDES");
{
  const teams = new Set(goals.flatMap((g) => [g.x.home, g.x.away]));
  const missing = [...teams].filter((t) => !NATION_KITS[t]);
  ok(missing.length === 0, `a kit for every one of the ${teams.size} sides${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
  const clash = goals.filter((g) => { const k = kitsForGoal(g); return colourGap(k.us.shirt, k.them.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.us.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.them.shirt) < KIT_CLASH; });
  ok(clash.length === 0, `no two shirts alike in any of the ${goals.length} goals (${clash.length})`);
  ok(shortNameOf("Kylian Mbappé") === "Mbappé" && shortNameOf("Ángel Di María") === "Di María" && shortNameOf("Neymar") === "Neymar", "short names: Mbappé, Di María, Neymar");
  ok(knownAs(goals.find((q) => q.id === "03fb2918")!, "Kylian Mbappé Lottin") === "Kylian Mbappé", "known names from the line-ups (Kylian Mbappé, not Mbappé Lottin)");
  let named = 0, men = 0, keeperNamed = 0, foreign = 0;
  for (const f of FEATURED) {
    const gg = goals.find((q) => q.id === f.id)!;
    const sc = scenarioForGoal(gg);
    dressFor(gg)(sc);
    const real = new Set(gg.x.names.map((nm) => knownAs(gg, nm)));
    if (sc.keeper.who?.name && real.has(sc.keeper.who.name)) keeperNamed++;
    for (const w of [...sc.defenders.map((d) => d.who), ...sc.secondaryRunners.map((r) => r.who), ...(sc.runner ? [sc.runner.who] : [])]) {
      men++;
      if (w?.name) { if (real.has(w.name)) named++; else foreign++; }
    }
  }
  ok(keeperNamed === FEATURED.length, `the real keeper named in every featured goal (${keeperNamed}/${FEATURED.length})`);
  ok(named / Math.max(1, men) >= 0.9, `real names on ${named} of ${men} outfield men`);
  ok(foreign === 0, "never a name from outside the real match");
}

// ── 6. Build-up ──────────────────────────────────────────────────────────
console.log("\n6. THE BUILD-UP FOLLOWS THE REAL MOVE");
{
  const r = measureTrack(["wc2022", "euro2024", "wc2018"]);
  console.log(`  ${r.goals} goals: jumps (man over 12 m/s) ${r.before.men} → ${r.after.men}, ball ${r.before.ball} → ${r.after.ball}, hand-over ${r.before.handover} → ${r.after.handover}; men vs the 360 camera ${(r.near.before / r.near.n).toFixed(2)} → ${(r.near.after / r.near.n).toFixed(2)} m (held out ${(r.near.held / r.near.n).toFixed(2)})`);
  ok(r.after.ball === 0, "the ball never blinks (over 45 m/s in a frame)");
  ok(r.after.men < r.before.men / 2, "less than half v0.17's too-fast frames");
  ok(r.after.handover <= r.goals * 0.02, "the hand-over to the chance is smooth (≤2% of goals with a step)");
  ok(r.near.after / r.near.n < (r.near.before / r.near.n) / 2, "the men are less than half as far from where the real camera saw them");
  ok(r.near.held / r.near.n < r.near.before / r.near.n, "…and closer on frames the build-up never saw (held out)");
  ok(r.ballErr.after / r.ballErr.n < 0.6, "the ball within 60 cm of every real touch on average");
}

// ── 7. Fingerprint ───────────────────────────────────────────────────────
console.log("\n7. THE REAL MATCH IS UNCHANGED WITH THE LANE ABSENT");
{
  /** Taken with lib/star/canvasEngine.ts from origin/main 0beabcbf (before the real lane). */
  const OLD_HASH = "c7ad8836";
  let h = 2166136261 >>> 0;
  const mix = (v: number | string) => { const s = typeof v === "number" ? (Number.isNaN(v) ? "nan" : v.toFixed(4)) : v; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  // The same 40 goals as v0.17 (shots.json order: World Cup 2022 then Euro 2024, open play and free kicks), the Real shots chance, no lane.
  const order = (JSON.parse(readFileSync("data/statsbomb/shots.json", "utf8")) as { shots: { id: string; outcome: string; type: string }[] }).shots
    .filter((x) => x.outcome === "Goal" && x.type !== "Penalty").map((x) => x.id);
  const fp40 = order.map((id) => goals.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g).slice(0, 40);
  for (const g of fp40) {
    const aim = aimAtReal(g);
    mix(aim.angle); mix(aim.cy);
    for (let i = 0; i < 2; i++) {
      const p = playStrike(g, aim, "legacy", (777 + i * 31) >>> 0, true);
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
