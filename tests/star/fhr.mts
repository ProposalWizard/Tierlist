/**
 * The Full Highlights Rebuild's switch (lib/star/fhr/toggle.ts), phases 0–1.
 *
 * Pins that "Full highlights rebuild: Off" changes nothing:
 *   1. a new phone reads Off, and the Settings row defaults to Off;
 *   2. Off leaves Chances exactly where it was; On forces Chances: New;
 *   3. the chances the real unseen match + chance maker serve over 40 whole
 *      matches are identical with the switch untouched, set Off, and with
 *      Chances forced Old — and On serves exactly what Chances: New serves;
 *   4. the files the plan says must not change know nothing of the switch;
 *   5. the still's match camera (phase 1) never touches the chance it frames
 *      or today's frame, and Infinite Highlights only uses it when On;
 *   6. the ruler (lib/star/fhr/ruler.ts) measures finite numbers.
 */
import { readFileSync } from "node:fs";
import { fhrMode, forceFhrMode, FHR_DEFAULT } from "../../lib/star/fhr/toggle";
import { chancesMode, forceChancesMode } from "../../lib/star/newChances";
import { LOOK_ROWS } from "../../lib/star/lookRows";
import { newMatch, advanceUntilInvolved, resolveScenario } from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { buildScenario } from "../../lib/star/canvasEngine";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { matchStill, withMatchCamera, matchCanvasHW } from "../../lib/star/fhr/stillCamera";
import { measureRuler, mulberry32, standInResult, RULER_INPUTS } from "../../lib/star/fhr/ruler";
import { reactingAfterStrike } from "../../scripts/fhr/react";
import { careerBuildUp, wantsBuildUp, buildUpFor } from "../../lib/star/leadInGen";
import { leadInEntities, type LeadIn } from "../../lib/star/leadIn";
import { fhrBuildUpFor, fhrWantsBuildUp, maxSpeed, FHR_MIN_S, FHR_MAX_S, FHR_TOP_SPEED, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { servedChances } from "../../lib/star/fhr/servedChances";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const G = globalThis as Record<string, unknown>;
const clearForces = () => { forceFhrMode(null); forceChancesMode(null); };

// 1.
clearForces();
check(FHR_DEFAULT === "off" && fhrMode() === "off", `a new phone reads ${fhrMode()}, not off`);
check(LOOK_ROWS.fhr.standard === "off", "the Settings row must default to Off");

// 2.
check(chancesMode() === "old", `Off: Chances reads ${chancesMode()} on a new phone`);
forceFhrMode("off");
check(chancesMode() === "old", "Off moved Chances");
forceFhrMode("on");
check(chancesMode() === "new", "On did not turn Chances to New");
forceFhrMode("off"); forceChancesMode("new");
check(chancesMode() === "new", "Off overrode a Chances: New the player chose");
clearForces();

// 3. What the match serves, to the centimetre.
function served(matches: number): string {
  const out: string[] = [];
  const memory = new PictureMemory("fhr-test", false);
  for (let i = 0; i < matches; i++) {
    const seed = 11 + i * 7919;
    const rng = mulberry32(seed), engineRng = mulberry32(seed ^ 0x5eed);
    const state = newMatch(rng);
    const selection = newSelectionMemory();
    for (;;) {
      const step = advanceUntilInvolved(state, RULER_INPUTS, rng, 90);
      if (!step.request) break;
      const req = step.request;
      if (req.dribble) out.push("dribble");
      else {
        const sc = makeChance({ source: { from: "request", request: req, position: "ST" }, rng: engineRng, memory, selection }).sc;
        const bodies = [sc.ball, sc.player, sc.keeper, ...sc.defenders, ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos)];
        out.push(`${sc.kind}:${bodies.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";")}`);
      }
      resolveScenario(state, standInResult(req.zone, rng));
    }
    out.push(`FT ${state.userScore}-${state.oppScore}`);
  }
  return out.join("\n");
}
clearForces();
const untouched = served(40);
forceFhrMode("off");
const off = served(40);
clearForces(); forceChancesMode("old");
const old = served(40);
check(untouched === off, "switch set Off serves different chances than a phone that never touched it");
check(untouched === old, "Off serves different chances than Chances: Old");
clearForces(); forceFhrMode("on");
const on = served(40);
clearForces(); forceChancesMode("new");
const nw = served(40);
check(on === nw, "On does not serve what Chances: New serves");
check(on !== off, "On serves exactly what Off does (the switch is not reaching the chances)");
clearForces();

// 4. The plan's "must not change" files know nothing of the switch.
const root = new URL("../../", import.meta.url);
for (const f of ["lib/star/hiddenMatch.ts", "lib/star/canvasEngine.ts", "lib/star/scenarioRules.ts", "lib/star/authoredChance.ts", "scripts/one-engine-guard.mjs"]) {
  const src = readFileSync(new URL(f, root), "utf8");
  check(!/fhr/i.test(src), `${f} mentions the rebuild switch`);
}

// 5. The still's match camera.
{
  const rng = mulberry32(5);
  for (const kind of ["one_on_one", "cutback", "long_range", "corner", "penalty", "free_kick", "through_ball", "buildup"] as const) {
    const sc = buildScenario(kind, rng);
    const before = JSON.stringify(sc);
    const today = JSON.stringify(frameFromScenario(sc));
    const still = matchStill(sc, matchCanvasHW(390, 700), 20);
    check(JSON.stringify(sc) === before, `matchStill changed the ${kind} it framed`);
    const base = frameFromScenario(sc);
    const shown = withMatchCamera(base, still);
    check(JSON.stringify(base) === today, `withMatchCamera changed today's ${kind} frame`);
    check(today.indexOf('"sizes"') === -1, "today's frame carries sizes (it must not: absent = exactly as before)");
    const asp = (shown.camera.y2 - shown.camera.y1) / (shown.camera.x2 - shown.camera.x1);
    const want = (shown.facing ?? "up") === "up" ? still.hw : 1 / still.hw;
    check(Math.abs(asp - want) < 0.02, `${kind}: still camera is ${asp.toFixed(3)} tall for a ${want.toFixed(3)} canvas`);
    check(shown.items.every((it) => base.items.some((b) => b.id === it.id)), `${kind}: the still invented a figure`);
  }
  const page = readFileSync(new URL("app/star-highlights-dev/page.tsx", root), "utf8");
  check(/if \(!fhrOnHere \|\| !shot\) return null;/.test(page) && /get\("still"\) === "builder"/.test(page), "Infinite Highlights lost its builder-frame escape (?still=builder)");
}

// 6.
{
  const r = measureRuler({ matches: 20, chances: "old" });
  check(r.chancesPerMatch > 2 && r.chancesPerMatch < 15, `ruler: ${r.chancesPerMatch} chances a match`);
  check(Number.isFinite(r.startMedianM), "ruler: start distance not measured");
  check(G.__starChancesForced === null || G.__starChancesForced === undefined, "ruler left Chances forced");
  // Counting reactions (terminal only) never moves what is served.
  const withReact = measureRuler({ matches: 20, chances: "old", react: reactingAfterStrike });
  check(withReact.chancesPerMatch === r.chancesPerMatch && withReact.goalsPerMatch === r.goalsPerMatch
    && withReact.startMedianM === r.startMedianM, "counting reactions changed the chances served");
  check(Number.isFinite(withReact.reactingPerChance) && withReact.reactingPerChance > 0, "reactions not counted");
}

// 7. Phase 2: the generated build-ups (lib/star/fhr/buildUp.ts).
{
  const leadSig = (l: LeadIn | null) => {
    if (!l) return "none";
    const out: string[] = [l.durS.toFixed(4)];
    for (let t = 0; t <= l.durS + 1e-9; t += l.durS / 12) { const b = l.ballAt(t); out.push(`${b.x.toFixed(3)},${b.y.toFixed(3)}`); }
    return out.join(";");
  };
  const cs = servedChances({ count: 160, seed: 9 });
  // Off: careerBuildUp is exactly today's — none with Chances: Old, leadInGen's own with Chances: New.
  clearForces();
  check(cs.every((c) => careerBuildUp(c.sc, c.moment) === null), "Off + Chances Old: a build-up appeared");
  forceChancesMode("new");
  const offNew = cs.map((c) => leadSig(careerBuildUp(c.sc, c.moment)));
  const today = cs.map((c) => leadSig(wantsBuildUp(c.sc.kind, c.moment) ? buildUpFor(c.sc, c.moment) : null));
  check(offNew.join("|") === today.join("|"), "Off + Chances New: careerBuildUp is not today's build-up");
  check(cs.every((c) => !(careerBuildUp(c.sc, c.moment) as { signature?: string } | null)?.signature), "Off: a generated build-up appeared");
  clearForces();
  // On: every fresh open-play chance gets one; set pieces and moves carrying on never do.
  forceFhrMode("on");
  const durs: number[] = [], sigs = new Set<string>();
  let open = 0, withProblems = 0;
  for (const c of cs) {
    const sp = c.sc.kind === "penalty" || c.sc.kind === "free_kick" || c.sc.kind === "corner";
    const before = JSON.stringify(c.sc);
    const l = careerBuildUp(c.sc, c.moment) as FhrBuildUp | null;
    check(JSON.stringify(c.sc) === before, `${c.sc.kind}: the build-up changed the chance`);
    check(careerBuildUp(c.sc, { ...c.moment, fresh: false }) === null, `${c.sc.kind}: a move carrying on got a build-up`);
    check(careerBuildUp(c.sc, { ...c.moment, opening: true }) === null, `${c.sc.kind}: an opening chance got a build-up`);
    if (sp) { check(l === null, `${c.sc.kind}: a set piece got a build-up`); continue; }
    open++;
    if (!l) { check(false, `${c.sc.kind}: no build-up`); continue; }
    durs.push(l.durS); sigs.add(l.signature);
    if (l.problems.length) withProblems++;
    check(l.durS >= FHR_MIN_S - 1e-9 && l.durS <= FHR_MAX_S + 1e-9, `${c.sc.kind}: build-up ${l.durS.toFixed(2)} s, not 4–8`);
    // Ends exactly on the drawing: the ball, and every man on the pitch.
    const b = l.ballAt(l.durS);
    check(Math.abs(b.x - c.sc.ball.x) < 1e-9 && Math.abs(b.y - c.sc.ball.y) < 1e-9 && b.z === 0, `${c.sc.kind}: the ball does not end on the drawing's`);
    for (const e of leadInEntities(c.sc)) {
      const p = l.posAt(e.key, l.durS), want = e.get();
      if (p) check(Math.abs(p.x - want.x) < 1e-9 && Math.abs(p.y - want.y) < 1e-9, `${c.sc.kind}: ${e.key} does not end where the drawing has him`);
      else check(want.x < -3 || want.x > 71 || want.y < -3 || want.y > 108, `${c.sc.kind}: ${e.key} on the pitch but not in the build-up`);
    }
    // Nobody faster than a man can run; every extra off the chance's frame at the end.
    for (const p of l.people) check(maxSpeed(p.path) <= FHR_TOP_SPEED + 1e-6, `${c.sc.kind}: ${p.key} runs ${maxSpeed(p.path).toFixed(1)} m/s`);
    // The same chance always gets the same build-up.
    check(leadSig(careerBuildUp(c.sc, c.moment)) === leadSig(l), `${c.sc.kind}: the same chance got a different build-up`);
  }
  check(open > 100, `only ${open} open-play chances served`);
  check(withProblems <= Math.ceil(open * 0.01), `${withProblems} of ${open} build-ups failed their own checks`);
  check(sigs.size >= open * 0.85, `only ${sigs.size} distinct routes in ${open} build-ups`);
  durs.sort((a, b) => a - b);
  check(durs[Math.floor(durs.length / 2)] > 5 && durs[Math.floor(durs.length / 2)] < 7.5, `median build-up ${durs[Math.floor(durs.length / 2)].toFixed(2)} s`);
  clearForces();
  // The ruler: build-ups never move the chances or goals served.
  const plain = measureRuler({ matches: 30, chances: "new" });
  const withBU = measureRuler({ matches: 30, chances: "new", buildUp: (sc, m) => (fhrWantsBuildUp(sc.kind, m) ? fhrBuildUpFor(sc, m) : null) });
  check(plain.chancesPerMatch === withBU.chancesPerMatch && plain.goalsPerMatch === withBU.goalsPerMatch && plain.startMedianM === withBU.startMedianM, "build-ups moved the chances or goals the match serves");
  check((withBU.buildUps?.made ?? 0) > 100, "the ruler made no build-ups");
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("fhr: Off serves exactly today's chances (40 matches) and today's build-ups, On = Chances: New + a generated 4–8 s build-up on every fresh open-play chance ending exactly on the drawing, still camera pure, ruler measures — all checks pass");
