/**
 * THE OCT 13 GAMEPLAY UPDATE — four switches, all Old by default
 * (Settings → Look → Gameplay · new vs old → "New 13 Oct · testing"):
 *
 *   Shot power      (lib/star/shotFeel.ts)  a 60 strikes like a 40 used to; a 100 rarely blazes over
 *   Contact field   (lib/star/shotFeel.ts)  the side of the ball = a low curler along the floor
 *   Keeper feel     (keeperBrain.ts KEEPER_FEEL_BRAIN, canvasEngine.ts KEEPER_FEEL)
 *   Team-mate shots (canvasEngine.ts MATE_CARRY)  a man in space runs on before he shoots
 *
 * 1. Old is the game from before: every switch off strikes the same ball.
 * 2-5. Each New does what it says, measured, with the before alongside.
 *
 * Run: npx tsx tests/star/gameplay13.mts
 */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
const on = (s: string, v: boolean) => store.set(`star-gameplay-${s}`, v ? "new" : "old");

const E = await import("../../lib/star/canvasEngine");
const { makeChance } = await import("../../lib/star/chanceMaker");
const { mulberry32 } = await import("../../lib/star/season");
const { CX, POST_L, POST_R, GOAL_H } = await import("../../lib/star/pitch");
const { strikingPower } = await import("../../lib/star/strikePower");
const F = await import("../../lib/star/shotFeel");
const { launchShot, shotSeedFor, gradeContact } = await import("../../lib/star/shotModel");
const { defaultVersion } = await import("../../lib/star/gameplayVersion");
const { shoot, cleanCrossing } = await import("./shotLab");
const KH = await import("./keeperPro/harness.mts");

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (n: number, d: number) => (100 * n) / Math.max(1, d);

console.log("\n1. OLD IS THE GAME FROM BEFORE");
for (const s of ["shotPower", "contactField", "keeperFeel", "mateShots"] as const) ok(defaultVersion(s) === "old", `${s} starts on Old`);
{
  // Field off and lift 1 through launchShot = plain launch, number for number.
  let same = true;
  for (let s = 1; s <= 60; s++) {
    const r = mulberry32(s);
    const sc = E.buildScenario(["one_on_one", "long_range", "tight_angle", "cutback"][s % 4] as any, mulberry32(s * 7), 62, 60, 55);
    const dir = { x: (r() - 0.5) * 0.6, y: -1 }, c = { cx: r() * 2 - 1, cy: r() * 2 - 1 };
    const a = E.launch(JSON.parse(JSON.stringify(sc)), dir, 0.9, c, { power: 70, technique: 60 }, mulberry32(9));
    const b = launchShot(JSON.parse(JSON.stringify(sc)), dir, 0.9, c, { power: 70, technique: 60 }, mulberry32(9), { seed: 1 }, { pro: false, knuckle: false, field: false, lift: 1 }, E.launch).ball;
    if (a.vel.x !== b.vel.x || a.vel.y !== b.vel.y || a.vz !== b.vz || a.spin !== b.spin) same = false;
  }
  ok(same, "with Contact field and Shot power off, a strike is exactly today's ball (60 strikes)");
  ok(gradeContact({ cx: 0.9, cy: 0.1 }, 0.9, false).label === "SLICED", "Shots pro's grading is untouched without the field (the side is still SLICED)");
}

console.log("\n2. SHOT POWER");
const kmh = (stat: number) => {
  const sc = E.buildScenario("one_on_one", mulberry32(3), 62, 60, 55);
  const b = E.launch(sc, { x: 0, y: -1 }, 1, { cx: 0, cy: 0 }, { power: stat, technique: 70 }, () => 0.5);
  return Math.hypot(b.vel.x, b.vel.y) * 3.6;
};
const powerRows = [20, 40, 60, 80, 100].map((p) => ({ p, before: kmh(strikingPower(p)), after: kmh(F.feelPower(p)) }));
for (const r of powerRows) console.log(`  power ${r.p}: ${r.before.toFixed(0)} -> ${r.after.toFixed(0)} km/h (full pull, middle of the ball)`);
ok(Math.abs(powerRows[2].after - kmh(strikingPower(40))) < 0.5, "a 60 now strikes it exactly like a 40 used to");
ok(powerRows.every((r, i) => i === 0 || r.after > powerRows[i - 1].after), "more power is still always more pace");
ok(powerRows[4].after < 100 && powerRows[4].after > 90, `a 100: ${powerRows[4].before.toFixed(0)} -> ${powerRows[4].after.toFixed(0)} km/h`);
{
  const kinds = ["one_on_one", "tight_angle", "long_range", "volley", "through_ball"] as const;
  const over = (stat: number, after: boolean) => {
    let n = 0, o = 0;
    for (const kind of kinds) for (let s = 1; s <= 60; s++) {
      const r = shoot(kind, s * 7919 + 13, { skills: { power: stat, technique: 65 }, ...(after ? { strikePower: F.feelPower, lift: F.feelLift } : {}) });
      n++; if (r.ballZ !== null && r.ballZ >= GOAL_H) o++;
    }
    return pct(o, n);
  };
  const b100 = over(100, false), a100 = over(100, true), a40 = over(40, true), b40 = over(40, false);
  console.log(`  over the bar (a person's thumb, 300 shots): power 40 ${b40.toFixed(1)}% -> ${a40.toFixed(1)}%, power 100 ${b100.toFixed(1)}% -> ${a100.toFixed(1)}%`);
  ok(b100 > 10 && a100 < 4, "a 100 is no longer 'guaranteed over the bar'");
  ok(a40 <= b40 + 0.5, "a 40 clears the bar no more than before");
}
ok(F.struckAtGoal(E.buildScenario("one_on_one", mulberry32(4), 62, 60, 55), { x: 0, y: -1 }) && !F.struckAtGoal(E.buildScenario("corner", mulberry32(4), 62, 60, 55), { x: 0, y: -1 }),
  "only a strike at goal (never a corner, cross or free kick)");

console.log("\n3. CONTACT FIELD");
{
  const apex = (c: { cx: number; cy: number }) => {
    const b = E.launch(E.buildScenario("one_on_one", mulberry32(5), 62, 60, 55), { x: 0, y: -1 }, 1, c, { power: 60, technique: 70 }, () => 0.5);
    return (b.vz * b.vz) / 19.6;
  };
  const edge0 = apex({ cx: 1, cy: 0 }), edge1 = apex(F.fieldContact({ cx: 1, cy: 0 }));
  console.log(`  the side of the ball at mid-height: apex ${edge0.toFixed(2)} -> ${edge1.toFixed(2)} m`);
  ok(edge1 < edge0 * 0.6, "the side of the ball is a low strike now");
  ok(apex(F.fieldContact({ cx: 0.2, cy: 0.5 })) === apex({ cx: 0.2, cy: 0.5 }) && apex(F.fieldContact({ cx: 0, cy: -0.8 })) === apex({ cx: 0, cy: -0.8 }),
    "the middle of the ball is unchanged (top = driven, bottom = lifted)");
  ok(apex(F.fieldContact({ cx: 0.7, cy: 0.7 })) > apex(F.fieldContact({ cx: 1, cy: 0 })) + 0.3, "a bottom corner still gives curl and some lift");
  ok(F.fieldContact({ cx: 0.9, cy: 0.1 }).cx === 0.9, "the curl (sideways) is kept in full");
  ok(gradeContact({ cx: 0.9, cy: 0.1 }, 0.9, false, true).label === "CURLER", "with the field the side is a CURLER, not a slice");

  // Mikey's shot: from the left wing, the side of the ball, aimed wide of the
  // far post — it curls back in low at the far post.
  const wing = { x: 23, y: 13 }, target = POST_R - 0.5, meant = { cx: 0.92, cy: 0 };
  const strike = (aimX: number, c: { cx: number; cy: number }, field: boolean, rng: () => number) => {
    const sc = E.buildScenario("one_on_one", mulberry32(5), 62, 60, 55);
    sc.defenders = []; sc.teammates = []; sc.runner = null; sc.secondaryRunners = [];
    sc.ball = { ...wing }; sc.player = { x: wing.x - 0.8, y: wing.y + 0.4 };
    const dx = aimX - wing.x, dy = -wing.y, L = Math.hypot(dx, dy);
    const b = launchShot(sc, { x: dx / L, y: dy / L }, 0.85, c, { power: 60, technique: 70 }, rng, { seed: shotSeedFor(1, 0) }, { pro: false, knuckle: false, field }, E.launch).ball;
    return cleanCrossing(sc, b);
  };
  for (const field of [false, true]) {
    let best = 0, err = 1e9;
    for (let ax = POST_R; ax <= POST_R + 14; ax += 0.1) { const c = strike(ax, meant, field, () => 0.5); if (c && Math.abs(c.x - target) < err) { err = Math.abs(c.x - target); best = ax; } }
    let inF = 0, low = 0; const n = 200;
    for (let s = 1; s <= n; s++) {
      const r = mulberry32(s * 31 + 7);
      const g = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
      let cx = meant.cx + g() * 0.15, cy = meant.cy + g() * 0.2; const d = Math.hypot(cx, cy); if (d > 0.99) { cx *= 0.99 / d; cy *= 0.99 / d; }
      const c = strike(best + Math.tan((g() * 2.5 * Math.PI) / 180) * Math.hypot(best - wing.x, wing.y), { cx, cy }, field, r);
      if (c) { if (c.x > POST_L && c.x < POST_R && c.z < GOAL_H) inF++; if (c.z < 0.5) low++; }
    }
    console.log(`  left-wing curler, field ${field ? "on " : "off"}: aimed ${(best - POST_R).toFixed(1)} m wide of the far post; in the goal ${pct(inF, n).toFixed(0)}%, under 0.5 m at the line ${pct(low, n).toFixed(0)}%`);
    if (field) { ok(pct(low, n) >= 60, "with the field it finishes low (along the floor)"); ok(pct(inF, n) >= 55, "…and in the goal more often than not"); }
    else ok(pct(low, n) < 10, "without it the same tap arrives high (the complaint)");
  }
}

console.log("\n4. KEEPER FEEL (on top of Keeper pro)");
{
  const kinds = ["one_on_one", "through_ball", "long_range", "tight_angle", "volley"] as const;
  const softBody = (feel: boolean) => {
    on("keeperFeel", feel);
    let n = 0, sv = 0;
    for (const kind of kinds) for (let s = 1; s <= 60; s++) {
      const r = KH.shoot(kind, s * 7919 + 463, 70, { pro: true, aim: "body", power: [0.45, 0.6], cy: [-0.6, 0.2] });
      if (!r.onTarget || r.speed >= 18) continue;
      n++; if (KH.firstSaved(r)) sv++;
    }
    return pct(sv, n);
  };
  const b = softBody(false), a = softBody(true);
  console.log(`  a soft shot (< 18 m/s) straight at a 70: saved ${b.toFixed(0)}% -> ${a.toFixed(0)}%`);
  ok(a > b + 3, "he gets his body behind a soft one more often");
  on("keeperFeel", false);
  const sc = E.buildScenario("one_on_one", mulberry32(4), 70, 60, 55);
  const B = await import("../../lib/star/keeperBrain");
  B.brainSetup(sc, 3, 70, { openPlay: 0.55 });
  ok(!sc.keeperFeel && !sc.keeperPro, "Old: neither flag on the scenario");
  on("keeperFeel", true);
  B.brainSetup(sc, 3, 70, { openPlay: 0.55 });
  ok(!!sc.keeperFeel && !!sc.keeperPro, "Keeper feel New turns Keeper pro on with it");
  on("keeperFeel", false);
}
{
  // The whole update together (Shots, Keeper pro, Ball physics, Shot power,
  // Contact field, Keeper feel): save % by distance for a 70-rated keeper
  // against the real Premier League (StatsBomb 2015/16: 53 / 77 / 90).
  on("keeperPro", true); on("keeperFeel", true); E.setBallPhysics("new");
  const kinds = ["one_on_one", "tight_angle", "long_range", "volley", "through_ball"] as const;
  const bd: Record<string, [number, number]> = {};
  for (const kind of kinds) for (let s = 1; s <= 80; s++) {
    const r = shoot(kind, s * 7919 + 13, { keeper: 70, skills: { power: 70, technique: 65 }, model: { pro: true, knuckle: false }, strikePower: F.feelPower, lift: F.feelLift, field: true });
    if (!r.onTarget) continue;
    const k = r.dist! < 12 ? "under 12 m" : r.dist! < 22 ? "12-22 m" : "22 m+";
    bd[k] ??= [0, 0]; bd[k][0]++; if (r.save && r.save !== "fumble") bd[k][1]++;
  }
  const rate = (k: string) => pct(bd[k][1], bd[k][0]);
  console.log(`  all new, keeper 70: under 12 m ${rate("under 12 m").toFixed(0)}% · 12-22 m ${rate("12-22 m").toFixed(0)}% · 22 m+ ${rate("22 m+").toFixed(0)}% (real 53 / 77 / 90)`);
  ok(Math.abs(rate("under 12 m") - 53) < 15 && Math.abs(rate("12-22 m") - 77) < 12 && Math.abs(rate("22 m+") - 90) < 10,
    "the whole update together keeps a 70's save % near the real one at every distance");
  on("keeperPro", false); on("keeperFeel", false); E.setBallPhysics("old");
}

console.log("\n5. TEAM-MATE SHOTS");
{
  const DT = 1 / 120;
  const strikeDist = (carry: boolean) => {
    on("mateShots", carry);
    const ds: number[] = [];
    let carried = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const rng = mulberry32(seed * 1013 + 12 * 7919);
      const sc = makeChance({ source: { from: "kind", kind: "through_ball" }, rng, strength: { keeper: 65, team: 65, vision: 60 }, memory: null }).sc;
      E.initDefenders(sc, rng);
      const t = sc.passTarget ?? sc.runner?.pos;
      if (!t || !sc.receiver) continue;
      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      const ball = E.launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, Math.min(0.95, 0.2 + d / 32), { cx: 0, cy: -0.3 }, { power: 60, technique: 60 }, rng);
      let px = 0, py = 0, res: unknown = null;
      for (let i = 0; i < 1200 && !res; i++) {
        E.stepDefenders(sc, DT, ball.pos, false, ball); E.stepKeeper(sc, DT); E.stepReactions(sc, ball, DT, rng);
        const before = sc.receiverShots ?? 0;
        px = ball.pos.x; py = ball.pos.y;
        if ((ball.carryT ?? 0) > 0) carried++;
        res = E.stepBall(ball, sc, rng, DT);
        if ((sc.receiverShots ?? 0) > before) { ds.push(Math.hypot(px - CX, py)); break; }
      }
    }
    ds.sort((a, b) => a - b);
    return { med: ds[ds.length >> 1], far: pct(ds.filter((x) => x > 22).length, ds.length), carried };
  };
  const b = strikeDist(false), a = strikeDist(true);
  console.log(`  a team-mate put through: shoots from a median ${b.med.toFixed(1)} -> ${a.med.toFixed(1)} m; from 22 m+ ${b.far.toFixed(0)}% -> ${a.far.toFixed(0)}%`);
  ok(b.carried === 0, "Old: nobody ever carries it");
  ok(a.med < b.med - 4 && a.far < b.far - 25, "New: he runs on and shoots from nearer");
  on("mateShots", false);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
