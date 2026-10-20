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
import {
  fhrBuildUpFor, fhrWantsBuildUp, maxSpeed, fhrTempo, momentDrama,
  FHR_MIN_S, FHR_MAX_S, FHR_TOP_SPEED, FHR_RUNON_S, FHR_RUNON_MAX_M, FHR_BIG_MAX_S, COVER_CLEAR_M, type FhrBuildUp,
} from "../../lib/star/fhr/buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul, FOUL_SHARE, type FhrFoulBuildUp } from "../../lib/star/fhr/foulBuildUp";
import { testAreaBuildUp } from "../../lib/star/fhr/builders";
import { standBackFor, yourRunupFor, penaltyRunupOf, freeKickRunupOf } from "../../lib/star/runupStyles";
import { servedChances } from "../../lib/star/fhr/servedChances";

/** A lead-in's shape, for comparing two (the ball every twelfth of it). */
const leadSigOf = (l: LeadIn | null) => {
  if (!l) return "none";
  const out: string[] = [l.durS.toFixed(4)];
  for (let t = 0; t <= l.durS + 1e-9; t += l.durS / 12) { const b = l.ballAt(t); out.push(`${b.x.toFixed(3)},${b.y.toFixed(3)}`); }
  return out.join(";");
};

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
  let open = 0, withProblems = 0, runOns = 0, covers = 0, setPieces = 0, fouls = 0, called = 0, regains = 0;
  const runSpeeds: number[] = [];
  for (const c of cs) {
    const sp = c.sc.kind === "penalty" || c.sc.kind === "free_kick" || c.sc.kind === "corner";
    const before = JSON.stringify(c.sc);
    const l = careerBuildUp(c.sc, c.moment) as FhrBuildUp | null;
    check(JSON.stringify(c.sc) === before, `${c.sc.kind}: the build-up changed the chance`);
    check(careerBuildUp(c.sc, { ...c.moment, fresh: false }) === null, `${c.sc.kind}: a move carrying on got a build-up`);
    check(careerBuildUp(c.sc, { ...c.moment, opening: true }) === null, `${c.sc.kind}: an opening chance got a build-up`);
    if (sp) {
      // FHR-4: a corner never; a free kick or penalty sometimes shows the foul (checked in 8).
      setPieces++;
      if (c.sc.kind === "corner") check(l === null, "a corner got a build-up");
      else if (l) { fouls++; check(!!(l as unknown as FhrFoulBuildUp).foul, `${c.sc.kind}: a set piece got an open-play build-up`); }
      continue;
    }
    open++;
    if (!l) { check(false, `${c.sc.kind}: no build-up`); continue; }
    sigs.add(l.signature);
    if (l.problems.length) withProblems++;
    // B2b: never an offside left uncalled; a called one ends the move (no chance, so no hand-over checks).
    check(l.passChecks.every((p) => !p.offside || p.called), `${c.sc.kind}: an offside pass was not called`);
    if (l.offside) {
      called++;
      check(l.whistleAt === l.offside.at && l.captionAt?.(l.offside.at + 0.01) === "Offside!", `${c.sc.kind}: a called offside without its whistle and caption`);
      check(l.passChecks.some((p) => p.called && p.by === l.offside!.by), `${c.sc.kind}: the called offside is not in the pass checks`);
      check(!l.runOnKeys?.length, `${c.sc.kind}: men still running after a called offside`);
      continue;
    }
    durs.push(l.durS);
    // A regain (B2b: the match's own, this minute) adds their spell: up to half of it longer.
    if (l.regain) regains++;
    const maxS = FHR_MAX_S + (l.regain ? 0.5 * l.regain.spellS + 0.6 : 0);
    check(l.durS >= FHR_MIN_S - 1e-9 && l.durS <= maxS + 1e-9, `${c.sc.kind}: build-up ${l.durS.toFixed(2)} s, not 4–${maxS.toFixed(1)}`);
    // Ends exactly on the drawing: the ball and you at the hand-over (durS), and
    // the men still running (phase 3) once they have stopped (durS + runOnS).
    const b = l.ballAt(l.durS);
    check(Math.abs(b.x - c.sc.ball.x) < 1e-9 && Math.abs(b.y - c.sc.ball.y) < 1e-9 && b.z === 0, `${c.sc.kind}: the ball does not end on the drawing's`);
    const runs = new Set(l.runOnKeys ?? []);
    if (runs.size) { runOns++; check((l.runOnS ?? 0) > 0 && (l.runOnS ?? 0) <= FHR_RUNON_S + 1 / 15 + 1e-9, `${c.sc.kind}: run-on ${l.runOnS} s`); }
    check(!runs.has("you") && !runs.has("keeper"), `${c.sc.kind}: you or the keeper still running at the hand-over`);
    for (const e of leadInEntities(c.sc)) {
      const tEnd = runs.has(e.key) ? l.durS + (l.runOnS ?? 0) : l.durS;
      const p = l.posAt(e.key, tEnd), want = e.get();
      if (p) check(Math.abs(p.x - want.x) < 1e-9 && Math.abs(p.y - want.y) < 1e-9, `${c.sc.kind}: ${e.key} does not end where the drawing has him`);
      else check(want.x < -3 || want.x > 71 || want.y < -3 || want.y > 108, `${c.sc.kind}: ${e.key} on the pitch but not in the build-up`);
      if (runs.has(e.key)) {
        // Phase 3: a little short of his spot at the hand-over, and still moving.
        const q = l.posAt(e.key, l.durS)!, q2 = l.posAt(e.key, l.durS + 1 / 15)!;
        check(Math.hypot(q.x - want.x, q.y - want.y) <= FHR_RUNON_MAX_M + 0.6, `${c.sc.kind}: ${e.key} ${Math.hypot(q.x - want.x, q.y - want.y).toFixed(2)} m short at the hand-over`);
        runSpeeds.push(Math.hypot(q2.x - q.x, q2.y - q.y) * 15);
      }
    }
    // FHR-3: a covering defender joins behind the ball, never between it and the goal.
    if (l.cover) {
      covers++;
      const j = l.joiners?.[0];
      check(!!j && Math.abs(j.end.x - l.cover.end.x) < 1e-9, `${c.sc.kind}: cover without its joiner`);
      check(l.cover.end.y > c.sc.ball.y + 1, `${c.sc.kind}: the extra defender ends goal-side of the ball`);
      check(c.sc.defenders.some((d) => d.x > -1 && d.x < 69), `${c.sc.kind}: an extra defender with no drawn defender (he would move the offside line)`);
      const fin = l.posAt("cover0", l.durS + (l.runOnS ?? 0))!;
      check(Math.abs(fin.x - l.cover.end.x) < 1e-9 && Math.abs(fin.y - l.cover.end.y) < 1e-9, `${c.sc.kind}: the extra defender does not end on his place`);
      for (const e of leadInEntities(c.sc)) { const w = e.get(); check(Math.hypot(w.x - fin.x, w.y - fin.y) >= COVER_CLEAR_M - 1e-6, `${c.sc.kind}: the extra defender ends on top of ${e.key}`); }
      const fr = l.frame, s0 = l.posAt("cover0", 0)!;
      check(l.cover.enterS > 0.2, `${c.sc.kind}: the extra defender starts on the screen`);
      void fr; void s0;
    } else check(!l.joiners?.length, `${c.sc.kind}: a joiner without a cover`);
    // Nobody faster than a man can run; every extra off the chance's frame at the end.
    for (const p of l.people) check(maxSpeed(p.path) <= FHR_TOP_SPEED + 1e-6, `${c.sc.kind}: ${p.key} runs ${maxSpeed(p.path).toFixed(1)} m/s`);
    // The same chance always gets the same build-up.
    check(leadSig(careerBuildUp(c.sc, c.moment)) === leadSig(l), `${c.sc.kind}: the same chance got a different build-up`);
  }
  check(open > 100, `only ${open} open-play chances served`);
  check(runOns >= (open - called) * 0.9, `phase 3: only ${runOns} of ${open - called} build-ups hand over with men still running`);
  check(called > 0 && called <= open * 0.2, `B2b: ${called} of ${open} build-ups ended in a called offside`);
  check(regains > 0, "B2b: no build-up showed the match's regain");
  runSpeeds.sort((a, b) => a - b);
  check(runSpeeds[runSpeeds.length >> 1] > 1, `phase 3: median speed at the hand-over ${runSpeeds[runSpeeds.length >> 1]?.toFixed(2)} m/s (nobody really moving)`);
  check(covers >= open * 0.05 && covers <= open * 0.4, `FHR-3: ${covers} of ${open} chances got an extra defender`);
  check(setPieces > 5, "no set pieces served");
  G.__fhrStats = { open, called, regains, runOns, covers, setPieces, fouls, runSpeedMedian: runSpeeds[runSpeeds.length >> 1] };
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

// 8. This round (20 Oct 2026): fouls before set pieces, how big the moment is,
//    the test areas' builder and adjust, and the gallery kept safe.
{
  // FHR-4: about FOUL_SHARE of fresh free kicks and penalties show the foul; each ends exactly on the drawing.
  const pool = servedChances({ count: 900, seed: 21 }).filter((c) => c.sc.kind === "free_kick" || c.sc.kind === "penalty");
  let want = 0, made = 0, fk = 0, pen = 0;
  for (const c of pool) {
    const sc = c.sc;
    sc.player = standBackFor(yourRunupFor(sc.kind, penaltyRunupOf(undefined), freeKickRunupOf(undefined)), sc.ball, sc.player, sc.viewport);
    const m = { ...c.moment, fresh: true };
    check(!fhrWantsFoul(sc, { ...m, fresh: false }), "a foul before a set piece that was not fresh");
    if (!fhrWantsFoul(sc, m)) continue;
    want++;
    const before = JSON.stringify(sc);
    const b = fhrFoulBuildUpFor(sc, m);
    check(JSON.stringify(sc) === before, `${sc.kind}: the foul changed the set piece`);
    if (!b) continue;
    made++; if (sc.kind === "free_kick") fk++; else pen++;
    check(b.durS >= 3.5 && b.durS <= 7.5, `${sc.kind}: foul build-up ${b.durS.toFixed(2)} s`);
    check(b.whistleAt !== undefined && Math.abs(b.whistleAt - b.foul.at - 0.08) < 1e-9, `${sc.kind}: no whistle at the foul`);
    const bl = b.ballAt(b.durS);
    check(Math.abs(bl.x - sc.ball.x) < 1e-9 && Math.abs(bl.y - sc.ball.y) < 1e-9, `${sc.kind}: the ball is not on the spot at the end`);
    for (const e of leadInEntities(sc)) {
      const p = b.posAt(e.key, b.durS), w = e.get();
      if (p) check(Math.abs(p.x - w.x) < 1e-9 && Math.abs(p.y - w.y) < 1e-9, `${sc.kind}: ${e.key} does not end where the set piece has him`);
    }
    for (const p of b.people) check(maxSpeed(p.path) <= FHR_TOP_SPEED + 0.05, `${sc.kind}: ${p.key} too fast in the foul`);
  }
  check(want > 10, `only ${want} set pieces wanted a foul`);
  check(made >= want * 0.9, `${made} of ${want} foul build-ups made`);
  check(Math.abs(want / Math.max(1, pool.length) - FOUL_SHARE) < 0.2, `${want} of ${pool.length} set pieces showed the foul (share ${FOUL_SHARE})`);
  check(fk > 0 && pen > 0, `fouls: ${fk} free kicks, ${pen} penalties`);
  G.__fhrFouls = { setPieces: pool.length, want, made, fk, pen };

  // How big the moment is: an ordinary (or unknown) moment is exactly the old 4–8 s; a level final in the 90th runs longer.
  const t0 = fhrTempo({ opening: false, fresh: true, seed: 1 });
  check(t0.drama === 0 && t0.minS === 4.6 && t0.maxS === FHR_MAX_S && t0.breakMinS === FHR_MIN_S && t0.breakMaxS === 6.5 && t0.padS === FHR_MIN_S && t0.touch === 1 && t0.press === 1, "an ordinary moment's tempo moved from the old numbers");
  check(momentDrama({ minute: 90, scoreDiff: 0, stakes: "final" }) === 1, "a level final in the 90th is not the biggest moment");
  check(momentDrama({ minute: 30, scoreDiff: 0, stakes: "league" }) < 0.1, "a 30th-minute league chance counts as big");
  check(momentDrama({ minute: 88, scoreDiff: 3, stakes: "league" }) < momentDrama({ minute: 88, scoreDiff: 0, stakes: "league" }), "a 3-0 is as big as a level game");
  const open = servedChances({ count: 120, seed: 9 }).filter((c) => fhrWantsBuildUp(c.sc.kind, c.moment)).slice(0, 60);
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
  const ord = open.map((c) => fhrBuildUpFor(c.sc, c.moment).durS);
  const big = open.map((c) => fhrBuildUpFor(c.sc, { ...c.moment, minute: 90, scoreDiff: 0, stakes: "final" }));
  check(med(big.map((b) => b.durS)) > med(ord) + 1.5, `a big moment's build-up (${med(big.map((b) => b.durS)).toFixed(1)} s) is not longer than an ordinary one (${med(ord).toFixed(1)} s)`);
  check(big.every((b) => b.durS <= FHR_BIG_MAX_S + 1e-6 && !b.problems.length), "a big moment's build-up too long or failing its checks");
  check(big[0].captionAt?.(0) === "One last attack" && big[0].captionShown === true, "the 90th minute of a final does not say so");
  // The test pages' adjust: Big = a level final in the 90th; Short is shorter than Long.
  const sh = open.map((c) => fhrBuildUpFor(c.sc, c.moment, { length: "short" }).durS), lo = open.map((c) => fhrBuildUpFor(c.sc, c.moment, { length: "long" }).durS);
  check(med(sh) < med(ord) && med(lo) > med(ord), `adjust: short ${med(sh).toFixed(1)} / auto ${med(ord).toFixed(1)} / long ${med(lo).toFixed(1)} s`);
  check(fhrBuildUpFor(open[0].sc, open[0].moment, { moment: "big" }).durS === fhrBuildUpFor(open[0].sc, { ...open[0].moment, minute: 90, scoreDiff: 0, stakes: "final" }).durS, "adjust Big is not a level final in the 90th");
  G.__fhrDrama = { ordinary: med(ord), big: med(big.map((b) => b.durS)), short: med(sh), long: med(lo) };

  // The test areas: Off → nothing (the test area plays as before); On → the career's build-up, one picture played as a fresh chance.
  const build = testAreaBuildUp(() => ({}));
  clearForces();
  check(open.every((c) => build(c.sc, { ...c.moment, opening: true }) === null && build(c.sc, c.moment) === null), "a test area got a build-up with the switch Off");
  forceFhrMode("on");
  check(open.every((c) => !!build(c.sc, { ...c.moment, opening: true })), "a test area's opening chance got no build-up with the switch On");
  check(open.every((c) => leadSigOf(build(c.sc, c.moment)) === leadSigOf(careerBuildUp(c.sc, c.moment))), "a test area's build-up is not the career's");
  clearForces();

  // The gallery stays the source: nothing generated writes a scenario, and the
  // match tells a test page its chance (Save / Commit) before any build-up plays.
  for (const f of ["lib/star/fhr/buildUp.ts", "lib/star/fhr/foulBuildUp.ts", "lib/star/fhr/builders.ts", "components/star/FhrAdjust.tsx", "components/star/FhrSwitchRow.tsx"]) {
    const src = readFileSync(new URL(f, root), "utf8");
    check(!/scenarioStore|saveScenario|scenarios\/commit|saveCorrection/.test(src), `${f} touches the saved scenarios`);
  }
  const cm = readFileSync(new URL("components/star/CanvasMatch.tsx", root), "utf8");
  const load = cm.slice(cm.indexOf("const loadScenario = "));
  const served = load.indexOf("onChanceServedRef.current?.({\n      kind: scenarioRef.current.kind");
  const lead = load.indexOf("startLeadIn({");
  check(served > 0 && lead > served, "the match starts the build-up before telling the page its chance (a Save could catch it mid-build-up)");
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("fhr: Off serves exactly today's chances (40 matches) and today's build-ups, On = Chances: New + a generated 4–8 s build-up on every fresh open-play chance ending exactly on the drawing (men still running at the hand-over, stopping on their spots), an extra defender when the defence is thin, a foul before about half of fresh free kicks and penalties, longer build-ups at big moments, the test areas' builder = the career's, nothing written to the gallery, still camera pure, ruler measures — all checks pass");
console.log("  stats:", JSON.stringify({ ...(G.__fhrStats as object), fouls: G.__fhrFouls, drama: G.__fhrDrama }));
