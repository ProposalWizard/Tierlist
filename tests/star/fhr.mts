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
  check(/if \(!fhrOnHere \|\| !shot\) return null;/.test(page), "Infinite Highlights uses the match camera without the switch On");
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

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("fhr: Off serves exactly today's chances (40 matches), On = Chances: New, still camera pure, ruler measures — all checks pass");
