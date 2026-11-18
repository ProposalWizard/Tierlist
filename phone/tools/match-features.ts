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
void playWithBot;

console.log(failures ? `\n${failures} FAILED` : "\nAll feature checks passed.");
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = failures ? 1 : 0;
