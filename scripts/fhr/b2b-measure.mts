// B2b (Full highlights rebuild, 20 Oct 2026): the build-ups by how the two
// sides compare — strong v weak, even, weak v strong — and the match they sit
// in, as ONE system (Harry: "chance count = to build up all of that is all
// just highlights intelligence and should work together").
//
//   npx tsx scripts/fhr/b2b-measure.mts [--matches=500] [--build=1] [--sides=85v65,75v75,65v85]
//
// Plays whole matches through the real unseen match (hiddenMatch.ts) and the
// real chance maker, with the inputs the real match passes (match flow,
// context, penalties won in any move, home and away in turn). Your finishing
// is the ruler's stand-in. Off: today's game. On: Chances New, a build-up
// before every fresh open-play chance (from the match's own regain), and a
// called offside ENDS that chance in the match's count too (handed back as
// the match hands back an offside). --build=0 skips the build-ups (counts only).
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { forceChancesMode } from "../../lib/star/newChances";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { mulberry32, standInResult } from "../../lib/star/fhr/ruler";
import { matchStill, matchCanvasHW } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpFor, fhrWantsBuildUp, type FhrBuildUp } from "../../lib/star/fhr/buildUp";

const arg = (k: string, d: string) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MATCHES = Number(arg("matches", "500"));
const BUILD = arg("build", "1") === "1";
const SIDES = arg("sides", "85v65,75v75,65v85").split(",").map((s) => s.split("v").map(Number) as [number, number]);
const HW = matchCanvasHW(390, 700);

interface Row {
  mode: string; sides: string;
  chances: number; played: number; offsides: number; yourGoals: number; theirGoals: number;
  buildUps: number; withRegain: number; regainHad: number; regainHeightM: number; spellS: number; scrappy: number;
  passes: number; pressM: number; lenS: number; uncalled: number; problems: number; untimedCalls: number; onBallS: number; pressShare: number; caughtShare: number; behindLineM: number;
}

function run(us: number, them: number, on: boolean): Row {
  forceFhrMode(on ? "on" : "off");
  forceChancesMode(on ? "new" : "old");
  const memory = new PictureMemory(`b2b-${us}-${them}-${on}`, false);
  let chances = 0, played = 0, offs = 0, you = 0, opp = 0;
  let shareSum = 0, shareN = 0, onBall = 0, onBallN = 0, untimedCalls = 0, bu = 0, withRegain = 0, regainHad = 0, regH = 0, spell = 0, scrappy = 0, passes = 0, press = 0, pressN = 0, len = 0, uncalled = 0, problems = 0, behind = 0, behindN = 0;
  for (let i = 0; i < MATCHES; i++) {
    const seed = 1 + i * 7919;
    const inputs: HiddenMatchInputs = { teamStrength: us, oppStrength: them, playerSkill: 60, position: "ST", matchFlow: true, context: {}, livePenalties: true, home: i % 2 === 0 };
    const rng = mulberry32(seed), engineRng = mulberry32(seed ^ 0x5eed);
    const state = newMatch(rng);
    const selection = newSelectionMemory();
    for (;;) {
      const step = advanceUntilInvolved(state, inputs, rng, 90);
      if (!step.request) break;
      const req = step.request;
      chances++;
      if (!req.dribble && on && BUILD) {
        const sc = makeChance({ source: { from: "request", request: req, position: "ST" }, rng: engineRng, memory, selection }).sc;
        const cam = matchStill(sc, HW).frame.camera;
        const moment = {
          opening: false, fresh: !(sc.kind === "penalty" || sc.kind === "free_kick" || sc.kind === "corner"),
          lane: req.lane, pattern: req.pattern, seed, usStrength: us, themStrength: them, regain: req.regain,
          frame: { x1: cam.x1, x2: cam.x2, y1: cam.y1, y2: cam.y2 }, minute: state.minute, scoreDiff: state.userScore - state.oppScore, stakes: "league" as const,
        };
        if (fhrWantsBuildUp(sc.kind, moment)) {
          const b = fhrBuildUpFor(sc, moment) as FhrBuildUp;
          bu++;
          if (req.regain && req.regain.ago === 0) regainHad++;
          if (b.regain) { withRegain++; regH += b.regain.heightM; spell += b.regain.spellS; if (b.regain.scrappy) scrappy++; }
          passes += b.acts.filter((a) => a.type === "pass").length;
          for (let k = 1; k < b.acts.length; k++) { onBall += b.acts[k].t0 - b.acts[k - 1].t1; onBallN++; }
          if (b.pressM !== null) { press += b.pressM; pressN++; }
          if (b.pressShare !== null) { shareSum += b.pressShare; shareN++; }
          len += b.durS;
          uncalled += b.passChecks.filter((p) => p.offside && !p.called).length;
          for (const p of b.passChecks) if (p.judged && !p.called && p.behindLineM > -5 && p.behindLineM < 6) { behind += p.behindLineM; behindN++; }
          if (b.problems.length) problems++;
          if (b.offside) {
            // The flag ended the move: no chance, in the match's count too (an offside goes back as "saved").
            offs++;
            if (b.offside.why === "untimed") untimedCalls++;
            resolveScenario(state, "saved");
            continue;
          }
        }
      } else if (!req.dribble && !on) {
        makeChance({ source: { from: "request", request: req, position: "ST" }, rng: engineRng, memory, selection });
      }
      played++;
      resolveScenario(state, standInResult(req.zone, rng));
    }
    you += state.userScore; opp += state.oppScore;
  }
  forceFhrMode(null); forceChancesMode(null);
  const n = MATCHES;
  const f = (v: number, d = 2) => +v.toFixed(d);
  return {
    mode: on ? "On" : "Off", sides: `${us} v ${them}`,
    chances: f(chances / n), played: f(played / n), offsides: f(offs / n), yourGoals: f(you / n), theirGoals: f(opp / n),
    buildUps: f(bu / n), withRegain: f(withRegain / Math.max(1, bu), 3), regainHad: f(regainHad / Math.max(1, bu), 3),
    regainHeightM: f(regH / Math.max(1, withRegain), 1), spellS: f(spell / Math.max(1, withRegain)), scrappy: f(scrappy / Math.max(1, withRegain), 3),
    passes: f(passes / Math.max(1, bu)), pressM: f(press / Math.max(1, pressN)), lenS: f(len / Math.max(1, bu)),
    pressShare: f(shareSum / Math.max(1, shareN), 3), onBallS: f(onBall / Math.max(1, onBallN)), uncalled, problems, untimedCalls: f(untimedCalls / n), caughtShare: f(offs / Math.max(1, bu), 3), behindLineM: f(behind / Math.max(1, behindN)),
  };
}

const rows: Row[] = [];
for (const [us, them] of SIDES) {
  for (const on of [false, true]) {
    const t0 = Date.now();
    const r = run(us, them, on);
    rows.push(r);
    console.log(JSON.stringify(r), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
console.log("\nsides      mode  chances played offs/m  goals(you-them)  build-ups  regain(had→shown)  height  spell  scrappy  passes  onBall  press  length  uncalled  problems");
for (const r of rows) console.log(`${r.sides.padEnd(10)} ${r.mode.padEnd(4)}  ${String(r.chances).padStart(6)} ${String(r.played).padStart(6)} ${String(r.offsides).padStart(6)}   ${r.yourGoals}-${r.theirGoals}        ${String(r.buildUps).padStart(5)}      ${r.regainHad}→${r.withRegain}      ${r.regainHeightM}   ${r.spellS}   ${r.scrappy}    ${r.passes}   ${r.onBallS}   ${r.pressM}(${r.pressShare})   ${r.lenS}   ${r.uncalled}   ${r.problems}`);
