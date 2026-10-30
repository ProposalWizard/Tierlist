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
 *   8. The 2017/18 league goals (Leo, 20 Oct 2026): five files, every goal joins,
 *      a kit for all 98 clubs, no clashes, a real keeper's name, scenarios build,
 *      the real line scores, and the level map is unchanged by them.
 *   9. The paths (22 Oct 2026): every path builds (5 stages, easiest first, gates),
 *      the World Cup path is exactly the old level map, Worldies are hard.
 *  10. The Bangers: every banger joins, says it is drafted from public record with
 *      a source, has a kit and no clash, builds a scenario, its real line scores.
 *  11. The daily goal: the same goal for a date, append-only, the streak.
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
  joinGoals, LEAGUES, isTournament, stageOf, sideKits, CLUB_KITS_1718,
  type Progress, type RgFile, difficultyOf, concededBy, realMoveLeadin,
} from "../../lib/star/realGoals";
import { PATHS, buildPath, pathStars, compOfPath, isWorldieCandidate } from "../../lib/star/realGoalPaths";
import {
  DAILY_LIST, DAILY_START, dailyGoalId, dailyNumber, utcDate, recordDaily, currentStreak, beatToday, EMPTY_DAILY,
} from "../../lib/star/realGoalDaily";

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

  // Sim rebuild piece 1 (21 Oct 2026): no number may be sourced to it either.
  // No source line in the game, its tests, its scripts or its patch notes may
  // name it (the old 360 tables too). History lives in SESSION_LOG.md,
  // data/opendata/LICENCES.md, the brain and the dated plans under docs/.
  const named: string[] = [];
  const word = /stats\s*bomb|\bsb[- ]?360\b/i;
  const scan = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "node_modules" && !f.startsWith(".") && p !== join("scripts", "brain")) scan(p); continue; }
      if (!/\.(ts|tsx|mts|js|mjs|py|json|html|md)$/.test(f) || p.endsWith("realGoals.mts")) continue;
      readFileSync(p, "utf8").split("\n").forEach((line, i) => { if (word.test(line)) named.push(`${p}:${i + 1}`); });
    }
  };
  for (const d of ["app", "components", "lib", "tests", "scripts", "tools", "patch-notes", "data/realmoments"]) scan(d);
  ok(named.length === 0, `no line in the game, tests, scripts or patch notes is sourced to it${named.length ? ` (found: ${named.slice(0, 8).join(", ")}${named.length > 8 ? ", …" : ""})` : ""}`);
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
   *  goals' one (c7ad8836) was taken on origin/main 0beabcbf, before the real lane.
   *  Retaken 21 Oct 2026 (headers piece 1): a real headed goal is now played as
   *  a header (realMoments/shots.ts kindForShot), not as a bouncing volley or a
   *  ground shot; was c0175259. */
  const OLD_HASH = "cedc67e1";
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

// ── 8. League goals ──────────────────────────────────────────────────────
console.log("\n8. THE 2017/18 LEAGUE GOALS");
{
  const league = LEAGUES.flatMap((l) => {
    const f = JSON.parse(readFileSync(`data/realmoments/wyscout_${l.file.replace("-", "_")}.json`, "utf8")) as RgFile & { shots: Parameters<typeof joinGoals>[0] };
    const j = joinGoals(f.shots, f.goals);
    ok(j.length === f.goals.length && j.length > 700 && j.every((g) => g.x.comp === l.comp), `${l.comp}: all ${j.length} goals join with their facts`);
    return j;
  });
  ok(league.length > 4300, `${league.length} league goals in all`);
  ok(!league.some(isTournament) && goals.every(isTournament), "league goals are never in the level map's pool");
  ok(new Set([...goals, ...league].map((g) => g.id)).size === goals.length + league.length, "no id twice across tournaments and leagues");
  const teams = new Set(league.flatMap((g) => [g.x.home, g.x.away]));
  const grey = [...teams].filter((t) => sideKits(t) === sideKits("nobody at all"));
  ok(grey.length === 0, `a kit for every one of the ${teams.size} clubs${grey.length ? ` (missing ${grey.join(", ")})` : ""}`);
  ok(Object.keys(CLUB_KITS_1718).every((t) => teams.has(t)), "every hand-set club kit is a club in the data (no misspelt names)");
  const clash = league.filter((g) => { const k = kitsForGoal(g); return colourGap(k.us.shirt, k.them.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.us.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.them.shirt) < KIT_CLASH; });
  ok(clash.length === 0, `no two shirts alike in any of the ${league.length} league goals (${clash.length}${clash.length ? `: ${clash.slice(0, 5).map((g) => `${g.shot.team} v ${g.x.home === g.shot.team ? g.x.away : g.x.home}`).join(", ")}` : ""})`);
  ok(league.filter((g) => g.x.keeper).length >= league.length - 2, "the conceding keeper's name on (nearly) every goal");
  ok(league.every((g) => g.x.score[0] <= g.x.final[0] && g.x.score[1] <= g.x.final[1]), "the score before a goal never passes the final score");
  ok(stageOf(league[0]).match(/^\d{1,2} [A-Z][a-z]{2} 201[78]$/) !== null, `a league goal shows its date (${stageOf(league[0])})`);
  let built = 0, on = 0, n = 0;
  for (const g of league.filter((_, i) => i % 220 === 0)) {
    const sc = scenarioForGoal(g); dressFor(g)(sc); if (sc.ball && sc.keeper) built++;
    const aim = aimAtReal(g);
    for (let s = 0; s < 3; s++) { n++; if (playStrike(g, aim, true, (9100 + s * 13) >>> 0, false).goal) on++; }
  }
  ok(built === Math.ceil(league.length / 220), `a scenario builds for every sampled goal (${built})`);
  ok(on / n >= 0.9, `the real line scores on sampled league goals (${(100 * on / n).toFixed(1)}% of ${n})`);
  const lv = buildLevels(goals).flatMap((s) => s.levels.map((l) => l.goal.id)).join();
  ok(lv === buildLevels([...goals, ...league].filter(isTournament)).flatMap((s) => s.levels.map((l) => l.goal.id)).join(), "the level map is exactly the same as before the league goals");
}

// ── 9. Paths ─────────────────────────────────────────────────────────────
const leagueAll = LEAGUES.flatMap((l) => {
  const f = JSON.parse(readFileSync(`data/realmoments/wyscout_${l.file.replace("-", "_")}.json`, "utf8")) as RgFile & { shots: Parameters<typeof joinGoals>[0] };
  return joinGoals(f.shots, f.goals);
});
const bf = JSON.parse(readFileSync("data/realmoments/bangers.json", "utf8")) as RgFile & { shots: Parameters<typeof joinGoals>[0] };
const bangers = joinGoals(bf.shots, bf.goals);
const everyGoal = [...bangers, ...goals, ...leagueAll];
console.log("\n9. THE PATHS");
{
  const old = buildLevels(goals).flatMap((s) => s.levels.map((l) => l.goal.id)).join();
  ok(buildPath("wc", everyGoal).flatMap((s) => s.levels.map((l) => l.goal.id)).join() === old, "the World Cup & Euro path is exactly the old level map (bangers and leagues added)");
  for (const p of PATHS) {
    const st = buildPath(p.id, everyGoal);
    const all = st.flatMap((s) => s.levels);
    const per = p.id === "bangers" ? Math.ceil(bangers.length / 5) : 10;
    ok(st.length === 5 && st.every((s, i) => s.name === p.stageNames[i]), `${p.name}: 5 stages (${p.stageNames.join(" · ")})`);
    ok(all.length === (p.id === "bangers" ? bangers.length : 50) && st.every((s) => s.levels.length <= per), `${p.name}: ${all.length} levels`);
    ok(new Set(all.map((l) => l.goal.id)).size === all.length && all.every((l, i) => l.n === i), `${p.name}: no goal twice, numbered in order`);
    const mean = st.map((s) => s.levels.reduce((a, l) => a + l.difficulty, 0) / s.levels.length);
    ok(mean.every((m, i) => i === 0 || m > mean[i - 1]), `${p.name}: each stage harder (${mean.map((m) => m.toFixed(1)).join(" → ")})`);
    if (p.id !== "wc" && p.id !== "worldies" && p.id !== "bangers") ok(all.every((l) => l.goal.x.comp === compOfPath(p.id)), `${p.name}: only its own league's goals`);
    // Its own gates count only its own stars.
    let pr: Progress = {};
    for (const l of st[0].levels) pr = recordResult(pr, l.goal.id, 1, 30);
    ok(pathStars(st, pr) === st[0].levels.length && levelOpen(st, pr, st[1].levels[0], (q) => pathStars(st, q)) === (st[0].levels.length >= st[1].gate), `${p.name}: stage 2 opens at ${st[1].gate} of its own stars`);
    ok(pathStars(st, { "not-a-level": { stars: 3, best: 90 } }) === 0, `${p.name}: stars from elsewhere do not count`);
  }
  const w = buildPath("worldies", everyGoal).flatMap((s) => s.levels);
  const wMean = w.reduce((a, l) => a + l.difficulty, 0) / w.length;
  const lMean = leagueAll.reduce((a, g) => a + difficultyOf(g), 0) / leagueAll.length;
  ok(wMean > lMean + 1.5 && w.every((l) => l.goal.shot.xg <= 0.06 && isWorldieCandidate(l.goal)), `Worldies are the hard ones (mean difficulty ${wMean.toFixed(2)} v ${lMean.toFixed(2)} for every league goal; every one ≤6% xG, 18-35 m, a corner or high)`);
  ok(LEAGUES.every((l) => w.filter((q) => q.goal.x.comp === l.comp).length === 10), "Worldies: 10 from each league");
}

// ── 10. Bangers ──────────────────────────────────────────────────────────
console.log("\n10. THE BANGERS (drafted from public record)");
{
  ok(bangers.length === bf.goals.length && bangers.length >= 55, `every banger joins with its facts (${bangers.length} of ${bf.goals.length})`);
  ok(bangers.every((g) => g.id.startsWith("bg-") && g.shot.src === "drafted" && g.x.drafted === "drafted from public record"), "every banger is marked drafted from public record (never licensed data)");
  ok(bangers.every((g) => /https?:\/\//.test(g.x.source ?? "")), "every banger names a match report (a source URL)");
  ok(bangers.every((g) => !isTournament(g)) && new Set(everyGoal.map((g) => g.id)).size === everyGoal.length, "bangers never join the World Cup path; no id twice anywhere");
  const years = bangers.map((g) => Number(g.x.date.slice(0, 4)));
  ok(Math.min(...years) >= 2010 && Math.max(...years) <= 2025, `2010-2025 (${Math.min(...years)}-${Math.max(...years)})`);
  ok(bangers.every((g) => g.x.score[0] <= g.x.final[0] && g.x.score[1] <= g.x.final[1] && (g.shot.team === g.x.home ? g.x.score[0] < g.x.final[0] : g.x.score[1] < g.x.final[1])), "the score before never passes the final, and the scorer's side scores after it");
  ok(bangers.every((g) => [g.x.home, g.x.away].includes(g.shot.team) && concededBy(g) === g.shot.opp), "the scorer's side and the conceding side are the two sides");
  ok(bangers.every((g) => { const m = g.x.move; return !m.length || !m[m.length - 1][3] || (Math.abs(m[m.length - 1][3]![0] - g.shot.ball[0]) < 0.01 && Math.abs(m[m.length - 1][3]![1] - g.shot.ball[1]) < 0.01); }), "every move ends on the shot spot");
  ok(bangers.every((g) => g.x.move.every((e, i) => i === 0 || e[0] <= g.x.move[i - 1][0])), "every move runs oldest first");
  const grey = bangers.filter((g) => sideKits(g.x.home) === sideKits("nobody at all") || sideKits(g.x.away) === sideKits("nobody at all"));
  ok(grey.length === 0, `a kit for every side${grey.length ? ` (missing: ${grey.map((g) => g.id).join(", ")})` : ""}`);
  const clash = bangers.filter((g) => { const k = kitsForGoal(g); return colourGap(k.us.shirt, k.them.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.us.shirt) < KIT_CLASH || colourGap(k.keeper.shirt, k.them.shirt) < KIT_CLASH; });
  ok(clash.length === 0, `no two shirts alike (${clash.map((g) => g.id).join(", ")})`);
  let built = 0, named = 0, lead = 0;
  for (const g of bangers) {
    const sc = scenarioForGoal(g); dressFor(g)(sc);
    if (sc.ball && Math.hypot(sc.ball.x - g.shot.ball[0], sc.ball.y - g.shot.ball[1]) < 0.6) built++; else console.log(`    moved: ${g.id} (${g.shot.ball}) → (${sc.ball.x.toFixed(1)}, ${sc.ball.y.toFixed(1)})`);
    if (sc.keeper.who?.name === g.x.keeper && g.x.keeper) named++;
    if (realMoveLeadin(g) || g.x.move.filter((e) => e[1] === "P" && e[5]).length === 0) lead++;
  }
  ok(built === bangers.length, `a scenario builds on the real spot for every banger (${built})`);
  ok(named === bangers.length, `the conceding keeper's real name on every banger (${named})`);
  ok(lead === bangers.length, "every banger with a pass to a team-mate has a real-move build-up");
  let on = 0, n = 0;
  const miss: string[] = [];
  for (const g of bangers) {
    const aim = aimAtReal(g);
    let gg = 0;
    for (let s = 0; s < 3; s++) { n++; if (playStrike(g, aim, true, (9100 + s * 13) >>> 0, false).goal) { on++; gg++; } }
    if (!gg) miss.push(g.id);
  }
  ok(on / n >= 0.9, `the real line scores on the bangers (${(100 * on / n).toFixed(1)}% of ${n} strikes${miss.length ? `; never: ${miss.join(", ")}` : ""})`);
}

// ── 11. Daily ────────────────────────────────────────────────────────────
console.log("\n11. THE DAILY REAL GOAL");
{
  const ids = new Set(everyGoal.map((g) => g.id));
  const missing = DAILY_LIST.filter((id) => !ids.has(id));
  ok(DAILY_LIST.length >= 100 && missing.length === 0, `${DAILY_LIST.length} daily goals, every one a real goal in the data${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  ok(new Set(DAILY_LIST).size === DAILY_LIST.length, "no goal twice in the daily list");
  ok(dailyGoalId(DAILY_START) === DAILY_LIST[0] && dailyGoalId("2026-10-23") === DAILY_LIST[1] && dailyNumber("2026-10-23") === 2, "day 1 = the first goal, day 2 the second");
  ok(dailyGoalId(utcDate(Date.parse("2026-11-05T00:00:01Z"))) === dailyGoalId(utcDate(Date.parse("2026-11-05T23:59:59Z"))), "the same goal all UTC day");
  const appended = [...DAILY_LIST, "extra-1", "extra-2"];
  ok(DAILY_LIST.every((_, i) => dailyGoalId(utcDate(Date.parse(`${DAILY_START}T12:00:00Z`) + i * 86400000), appended) === DAILY_LIST[i]), "appending never changes a day already in the list");
  ok(dailyGoalId(utcDate(Date.parse(`${DAILY_START}T12:00:00Z`) + DAILY_LIST.length * 86400000)) === DAILY_LIST[0], "after the end it goes round again");
  let d = EMPTY_DAILY;
  d = recordDaily(d, "2026-10-22", 0, 40);
  ok(d.streak === 0 && d.last === null && !beatToday(d, "2026-10-22"), "a miss does not start a streak");
  d = recordDaily(d, "2026-10-22", 2, 70);
  ok(d.streak === 1 && beatToday(d, "2026-10-22") && d.days["2026-10-22"].pct === 70, "a goal starts it");
  d = recordDaily(d, "2026-10-22", 3, 90);
  ok(d.streak === 1 && d.days["2026-10-22"].stars === 3, "again the same day: better stars kept, streak still 1");
  d = recordDaily(d, "2026-10-23", 1, 20);
  ok(d.streak === 2 && currentStreak(d, "2026-10-24") === 2, "the next day: 2, still alive the day after");
  ok(currentStreak(d, "2026-10-25") === 0, "a missed day: the streak shows 0");
  d = recordDaily(d, "2026-10-26", 1, 20);
  ok(d.streak === 1 && d.best === 2, "and starts again at 1, best kept at 2");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
void realEnd;
