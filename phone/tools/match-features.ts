/**
 * HEADLESS CHECK: the features on the match (the trial's engine stages, the
 * strike drills) and the live penalty shootout, through the phone's driver.
 *
 *   npx esbuild phone/tools/match-features.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --outfile=/tmp/match-features.mjs && node /tmp/match-features.mjs
 *
 * Each feature is played by the same bot as tools/match-bot.ts until it has
 * resolved its reps; every chance must resolve, through the website's call
 * order (openOn → enforceHardRules → cast → initDefenders → keeper → frame),
 * with a sane outcome. The shootout: a knockout's penalties are played kick
 * by kick on the pitch to a winner, and the match's stats carry the result.
 * Exit code 1 on any failure.
 */
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { mulberry32 } from "@/lib/star/season";
import { startTrial } from "@/lib/star/trial";
import { freeKickSetup } from "@/lib/star/trialStages";
import { levelConfig, levelSeedOf } from "@/lib/star/trainingLevelData";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import { gateCrossing, gateQuality } from "@/lib/star/trainingDrills";
import { MatchDriver } from "../src/match/driver";
import { featureSetup, matchSetupFor, type ChanceResolved, type FeatureSpec } from "../src/match/setup";
import { buildFreeKickScenario, buildStrikeFrom, buildStrike, DRILL_SCENE, type StrikeKind, type StrikeLevel } from "../src/match/drills";
import { botAim, botContact, flatPullFor, playWithBot } from "./match-bot";
import { testCareer } from "./match-run-career";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { touchingFrame } from "@/lib/star/relationships";
import { loadVisionMoments, visionLevelPicturesAsync, visionAsk, visionScenario, judgeTap } from "@/lib/star/visionRound";
import type { VisionLevel } from "@/lib/star/trainingLevelData";
import { SCENARIO_KINDS } from "@/lib/star/canvasEngine";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import { nextHighlight, newSimMemory, buildSimScenario, pictureKey } from "@/lib/star/gallerySim";
import { sanitizePlaySettings } from "@/lib/star/playArea";
import { farewellSides, farewellCareer, farewellFixture, farewellDuties, farewellSeed, FAREWELL_OFF_AT } from "@/lib/star/farewell";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
setVisitSalt(0);

let failures = 0;
const fail = (m: string) => { failures++; console.log("FAIL  " + m); };

/** Play a feature until `want` chances have resolved (or give up). */
function playFeature(name: string, spec: Omit<FeatureSpec, "onChanceResolved">, want: number, skills = { power: 60, technique: 60 }): ChanceResolved[] {
  const got: ChanceResolved[] = [];
  const d = new MatchDriver(featureSetup({ ...spec, onChanceResolved: (i) => got.push(i) }, { skills, seed: 4242 }), { hw: 1.6 });
  d.start();
  let aimT = 0, contactT = 0, last = "", n = 0;
  for (; n < 200_000 && got.length < want; n++) {
    if (d.phase === "aim" && last !== "aim") aimT = 0;
    if (d.phase === "contact" && last !== "contact") contactT = 0;
    last = d.phase;
    if (d.held) { /* a teaching pause: nothing moves */ }
    if (d.phase === "aim" && !d.lead) {
      aimT++;
      if (aimT === 30) {
        const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
        d.pointerDown({ x: b.x, y: b.y }, 99, 0);
        d.pointerMove(botAim(b, d.viewport, d.facing, 7, got.length), pull);
        d.pointerUp(pull);
      }
    }
    if (d.phase === "contact" && !d.contactLocked) { contactT++; if (contactT === 6) { const c = botContact(got.length); d.tapContact(c.cx, c.cy); } }
    d.tick();
  }
  const line = got.map((g) => g.outcome).join(", ");
  if (got.length < want) fail(`${name}: only ${got.length}/${want} chances resolved in ${n} frames (phase ${d.phase})`);
  else console.log(`OK    ${name.padEnd(34)} ${got.length} chances in ${n} frames: ${line}`);
  return got;
}

// ── The trial's free kicks: three reps, the wall, the keeper, the run-up ──
const trial = startTrial(31337);
{
  let rep = 0;
  const seed = (trial.seed ^ 0x5f5e) >>> 0;
  playFeature("trial free kicks", {
    openOn: () => { const r = rep++; return buildFreeKickScenario(trial, r, mulberry32((seed ^ ((r + 1) * 0x9e3779b1)) >>> 0)); },
    keeperStrength: () => freeKickSetup(trial, Math.max(0, rep - 1)).keeperStrength,
    scene: { teammates: false },
    setPieceSkill: 55,
  }, 3);
}

// ── Through the gate: the ball is watched every step for the cones ──
{
  const setup = buildStrike("technique", 50, 0, mulberry32(9));
  let prev: { x: number; y: number; z: number } | null = null, crossed: { x: number; z: number } | null = null, steps = 0;
  const got = playFeature("trial technique gate", {
    openOn: () => { const s = buildStrike("technique", 50, 0, mulberry32(9)); s.scenario.viewport = { ...s.viewport }; prev = null; crossed = null; return s.scenario; },
    onBallStep: (b) => { steps++; if (setup.gate && !crossed && prev) crossed = gateCrossing(prev, b, setup.gate.centre.y); prev = { ...b }; },
    markers: () => setup.gate ? [setup.gate.left, setup.gate.right] : [],
    keeperStrength: () => 40,
    scene: { ...DRILL_SCENE.technique, you: false, box: false },
  }, 1);
  if (got.length && steps === 0) fail("technique gate: onBallStep never called");
  else if (got.length) console.log(`      gate: ${steps} ball steps watched, quality ${gateQuality(crossed, setup.gateCfg!, setup.gate!.centre.x).toFixed(2)}`);
}

// ── The strike drills (TrainingMinigame StrikeDrill), a few levels each ──
for (const kind of ["power", "technique", "freeKick", "aerial"] as StrikeKind[]) {
  for (const lvl of [1, 15, 30]) {
    const row = levelConfig(kind, lvl) as StrikeLevel;
    const seed = levelSeedOf(kind, lvl, row);
    const view = buildStrikeFrom(kind, row, mulberry32(seed));
    playFeature(`drill ${kind} level ${lvl}`, {
      openOn: () => { const s = buildStrikeFrom(kind, row, mulberry32(seed)); s.scenario.viewport = { ...s.viewport }; return s.scenario; },
      keeperStrength: () => (kind === "technique" ? 40 : (row as { keeperStrength: number }).keeperStrength),
      scene: view.openGoal ? { ...DRILL_SCENE.power, keeper: false } : DRILL_SCENE[kind],
      setPieceSkill: 60, aerial: 60,
    }, 3, { power: 60, technique: 60 });
  }
}

// ── A teaching pause holds the run-up until it is let go ──
{
  let release: (() => void) | null = null, held = 0;
  const d = new MatchDriver(featureSetup({
    openOn: () => buildFreeKickScenario(trial, 0, mulberry32(5)),
    keeperStrength: () => 60, scene: { teammates: false },
    holdAt: (m, r) => { if (m === "runup" && !release) { release = r; return true; } return false; },
  }, { skills: { power: 60, technique: 60 }, seed: 5 }), { hw: 1.6 });
  d.start();
  for (let i = 0; i < 40; i++) d.tick();
  const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
  d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove(botAim(b, d.viewport, d.facing, 1, 0), pull); d.pointerUp(pull);
  const t0 = d.runup?.t ?? -1;
  for (let i = 0; i < 120; i++) { d.tick(); if (d.held) held++; }
  const t1 = d.runup?.t ?? -1;
  (release as (() => void) | null)?.();
  for (let i = 0; i < 400 && d.phase === "runup"; i++) d.tick();
  if (held < 100 || t1 !== t0 || d.phase !== "contact") fail(`teaching pause: held ${held} frames, run-up ${t0}→${t1}, then ${d.phase}`);
  else console.log(`OK    teaching pause                       held ${held} frames, run-up frozen, then the strike screen`);
}

// ── The live shootout: a knockout's penalties, kick by kick, to a winner ──
{
  const career = testCareer();
  const fx = { ...career.fixtures.find((f) => !f.played)!, kind: "cup" as const };
  let played = 0;
  for (let s = 0; s < 3; s++) {
    const d = new MatchDriver(matchSetupFor({ ...career, week: fx.week }, fx), { hw: 2.0 });
    // Straight to penalties (CanvasMatch startShootout), the bot takes your kick.
    (d as unknown as { runShootout(): void }).runShootout();
    const kicks: string[] = [];
    let lastLen = 0, n = 0;
    for (; n < 400_000 && !d.done; n++) {
      if (d.pause) { d.continuePause(); continue; }
      const so = d.shootout;
      if (so && so.state.kicks.length !== lastLen) { lastLen = so.state.kicks.length; const k = so.state.kicks[lastLen - 1]; kicks.push(`${k.side[0]}${k.scored ? "✓" : "✗"}`); }
      if (d.phase === "aim" && !d.lead && !d.sc.autoKick) {
        const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
        d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove(botAim(b, d.viewport, d.facing, s, kicks.length), pull); d.pointerUp(pull);
      }
      if (d.phase === "contact" && !d.contactLocked) d.tapContact(0.2, 0.1);
      d.tick();
    }
    const res = d.finalStats?.shootout;
    if (!d.done || !res || res.home === res.away || kicks.length < 6) fail(`shootout ${s}: done ${d.done}, result ${JSON.stringify(res)}, kicks ${kicks.join(" ")}`);
    else { played++; console.log(`OK    shootout ${s}                            ${res.home}-${res.away} after ${kicks.length} kicks (${kicks.join(" ")}) in ${n} frames`); }
  }
  void played;
}

// ── The trial's own penalty picture still builds (the shootout stage's openOn) ──
{
  const rng = mulberry32(3);
  const sc: Scenario = buildScenario("penalty", rng, 60, 60, 55);
  initDefenders(sc, rng);
  sc.ball = { x: CX, y: PEN_SPOT_Y };
  playFeature("trial shootout: your kick", { openOn: () => { const r = mulberry32(3); const s = buildScenario("penalty", r, 60, 60, 55); initDefenders(s, r); s.ball = { x: CX, y: PEN_SPOT_Y }; s.defenders = []; return s; }, keeperStrength: () => 60, scene: { teammates: false } }, 2);
}
// ── The relationship games' pictures (screens/MatchRelGames.tsx): built as the website builds them, played to a result ──
{
  const goalCam = (sc: Scenario, cx0: number, h: number) => { const w = h * (5 / 8); const cx = Math.max(w / 2, Math.min(68 - w / 2, cx0)); sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h }; };
  let k = 0;
  const pens = playFeature("boss penalties (empty goal, the spot)", {
    openOn: () => { const sc = buildStrike("power", 1, k, mulberry32(77 + k++ * 977), { trainingLevel: 1, power: 60 }).scenario; sc.ball = { x: CX, y: PEN_SPOT_Y }; sc.player = { x: CX, y: PEN_SPOT_Y + 1.2 }; sc.defenders = []; goalCam(sc, CX, 22); return sc; },
    keeperStrength: () => 0, scene: { ...DRILL_SCENE.power, keeper: false, ownFrame: true },
  }, 3);
  if (pens.length >= 3) console.log(`OK    boss penalties                        ${pens.map((r) => r.outcome).join(", ")}`);
  let w = 0, frame = 0;
  const wood = playFeature("woodwork challenge", {
    openOn: () => { const sc = buildStrike("power", 1, w, mulberry32(55 + w++), { trainingLevel: 1, power: 60 }).scenario; goalCam(sc, (sc.ball.x + CX) / 2, Math.max(22, sc.ball.y + 10)); return sc; },
    onBallStep: (b) => { if (touchingFrame(b)) frame++; },
    keeperStrength: () => 0, scene: { ...DRILL_SCENE.power, keeper: false, ownFrame: true },
  }, 5);
  if (wood.length >= 5) console.log(`OK    woodwork challenge                    ${wood.map((r) => r.outcome).join(", ")} (frame touched on ${frame} steps)`);
}

// ── The farewell match (CanvasMatch farewell.offAt): no energy spent, off at the ovation minute ──
{
  const career = testCareer();
  const sides = farewellSides(career, {});
  const fc = farewellCareer(career, sides), fx = farewellFixture(career, sides);
  const setup = { ...matchSetupFor(fc, fx), duties: farewellDuties(), seed: farewellSeed(career), keeperStrength: sides.rivals.strength, oppStrength: sides.rivals.strength, teamRelationship: 100, startMinute: 0, plannedOffAt: undefined, pressure: 0.3, farewell: { offAt: FAREWELL_OFF_AT } };
  const d = new MatchDriver(setup, { hw: 2.0 });
  const e0 = d.liveEnergyAt(0);
  const r = playWithBot(d, 909);
  const s = d.finalStats;
  if (!s || !d.done) fail("farewell: did not finish");
  else if (d.hookedAt !== FAREWELL_OFF_AT && d.hookedAt !== null) fail(`farewell: off at ${d.hookedAt}', not ${FAREWELL_OFF_AT}'`);
  else if (Math.round(d.liveEnergyAt(80)) !== Math.round(e0)) fail(`farewell: energy moved ${e0} → ${d.liveEnergyAt(80)}`);
  else console.log(`OK    farewell match                        ${d.userScore}-${d.oppScore}, ${r.chances} chances, off at ${d.hookedAt ?? "-"}', goals ${s.goals}`);
}

// ── Kickabout (screens/MatchKickabout.tsx): random highlights one after another, at the Play Area's dials ──
{
  const st = { rng: mulberry32(7), mem: newSimMemory(), last: undefined as string | undefined };
  const kinds = withoutSwitchedOff(SCENARIO_KINDS);
  const ps = sanitizePlaySettings(undefined);
  const seen: string[] = [];
  const got = playFeature("kickabout (a session: 6 highlights)", {
    openOn: () => { const spec = nextHighlight(kinds, st.rng, st.mem, st.last); const sc = buildSimScenario(spec ?? ({ kind: "one_on_one", seed: 1 } as never)); st.last = pictureKey(sc); seen.push(sc.kind); return sc; },
    keeperStrength: () => ps.keeperStrength,
  }, 6, { power: ps.power, technique: ps.technique });
  if (got.length >= 6) console.log(`OK    kickabout                             kinds ${[...new Set(seen)].join(", ")}; goals ${got.filter((r) => r.outcome === "goal").length}/${got.length}`);
}

// ── Training's Vision (screens/MatchVision.tsx VisionDrill): the level's real pictures build and play on the match ──
void (async () => {
  await loadVisionMoments();
  for (const lvl of [1, 20]) {
    const cfg = levelConfig("vision", lvl) as VisionLevel;
    const seed = levelSeedOf("vision", lvl, cfg);
    const pics = await visionLevelPicturesAsync(lvl, (n) => { const c = levelConfig("vision", n) as VisionLevel; return { ask: visionAsk(c), seed: n === lvl ? seed : levelSeedOf("vision", n, c) }; }, 3);
    if (!pics.length) { fail(`vision level ${lvl}: no pictures`); continue; }
    const p = pics[0];
    const got = playFeature(`vision level ${lvl} (${cfg.kick ? "kick" : "tap"}, ${p.source})`, { openOn: () => visionScenario(p, seed >>> 0), keeperStrength: () => 62, scene: { banners: false } }, 1);
    const tapV = judgeTap(p, p.best);
    if (!tapV.ok) fail(`vision level ${lvl}: tapping the best man is not ok`);
    else if (got.length) console.log(`OK    vision level ${lvl}                        ${pics.length} pictures, best man ${p.best} of ${p.options.length}, pass: ${got[0].outcome}`);
  }
  console.log(failures ? `\n${failures} FAILED` : "\nAll feature checks passed.");
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = failures ? 1 : 0;
})();
