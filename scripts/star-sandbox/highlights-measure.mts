// HIGHLIGHTS MEASURE (22 Oct 2026; Harry: "barely any highlights", "leaning too
// much towards real highlights", "buildups are still too slow"). Through the real
// unseen match + the real chance maker + the career build-up, same seeds and inputs:
//   npx tsx scripts/star-sandbox/highlights-measure.mts             your chances a match (Match flow Old/New, ST/LW, 3 sides)
//   MODE=serve npx tsx scripts/star-sandbox/highlights-measure.mts  real-moment share + build-up seconds (rebuild On, Real moments On)
// N=matches (default 300). Run from the repo root.
import { readFileSync, existsSync } from "node:fs";
import * as HM from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import * as RT from "../../lib/star/fhr/realMomentToggle";
import * as RMH from "../../lib/star/fhr/realMomentHighlights";
import { careerBuildUp } from "../../lib/star/leadInGen";

const N = Number(process.env.N ?? 300);
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function standIn(zone: string, rng: () => number): HM.ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}
function inputs(o: { us: number; them: number; home: boolean; pos: string; flow: boolean }): HM.HiddenMatchInputs {
  const sk = { pace: 66, power: 64, technique: 66, vision: 62 };
  return {
    teamStrength: o.us, oppStrength: o.them, playerSkill: (sk.power + sk.technique + sk.vision) / 3,
    home: o.home, pace: sk.pace, freeKick: 60, canTakeCorners: true, position: o.pos, energy: 90, energyMode: "medium",
    impactSub: false, talisman: false, matchFlow: o.flow,
    context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 60, skills: sk },
    livePenalties: true, lateSub: undefined, fergie: { from: 90, to: 93 },
  } as HM.HiddenMatchInputs;
}
const SETUPS = [
  { name: "even 75v75 home", us: 75, them: 75, home: true },
  { name: "stronger 84v70 home", us: 84, them: 70, home: true },
  { name: "weaker 70v82 away", us: 70, them: 82, home: false },
];
const mode = process.env.MODE ?? "count"; // count | serve
if (mode === "count") {
  for (const flow of [false, true]) for (const pos of ["ST", "LW"]) {
    const row: string[] = [];
    for (const s of SETUPS) {
      let req = 0, sp = 0, drib = 0;
      for (let m = 0; m < N; m++) {
        const rng = mulberry32(1000 + m * 7919);
        const st = HM.newMatch(rng);
        const inp = inputs({ ...s, pos, flow });
        for (;;) {
          const step = HM.advanceUntilInvolved(st, inp, rng, 93);
          if (!step.request) break;
          req++; if (step.request.pattern === "set_piece") sp++; if (step.request.dribble) drib++;
          HM.resolveScenario(st, standIn(step.request.zone, rng));
        }
      }
      row.push(`${s.name}: ${(req / N).toFixed(2)} (set pieces ${(sp / N).toFixed(2)}, dribbles ${(drib / N).toFixed(2)})`);
    }
    console.log(`flow=${flow ? "New" : "Old"} ${pos} | ${row.join(" | ")}`);
  }
} else {
  // Serve: FHR on, real moments on/off, through makeChance + careerBuildUp.
  const tracked = JSON.parse(readFileSync("data/realmoments/tracked.json", "utf8"));
  const tracks = JSON.parse(readFileSync("data/realmoments/tracks.json", "utf8"));
  const pool = RMH.buildRealMomentPool(tracked, tracks);
  forceFhrMode("on");
  RT.forceRealMomentsMode(process.env.RM === "off" ? "off" : "on");
  RMH.setRealMomentPool(pool);
  for (const pos of ["ST", "LW"]) for (const flow of [true, false]) {
    const memory = new PictureMemory("m-" + pos, false);
    let req = 0, real = 0, open = 0, withBU = 0, buS = 0, offside = 0, drib = 0;
    const kinds: Record<string, number> = {};
    const realKinds: Record<string, number> = {};
    for (let m = 0; m < N; m++) {
      const seed = 1000 + m * 7919;
      const rng = mulberry32(seed), eng = mulberry32(seed ^ 0x5eed);
      const st = HM.newMatch(rng);
      const selection = newSelectionMemory();
      const inp = inputs({ us: 75, them: 75, home: true, pos, flow });
      for (;;) {
        const step = HM.advanceUntilInvolved(st, inp, rng, 93);
        if (!step.request) break;
        const r = step.request;
        req++;
        if (r.dribble) { drib++; HM.resolveScenario(st, standIn(r.zone, rng)); continue; }
        const made = makeChance({ source: { from: "request", request: r, position: pos }, rng: eng, memory, selection });
        const setPiece = r.pattern === "set_piece";
        if (!setPiece) open++;
        kinds[made.sc.kind] = (kinds[made.sc.kind] ?? 0) + 1;
        if (made.how === "real") { real++; realKinds[made.sc.kind] = (realKinds[made.sc.kind] ?? 0) + 1; }
        const lead = careerBuildUp(made.sc, {
          opening: false, fresh: true, lane: r.lane, pattern: r.pattern, seed: seed + req,
          us: "Us", them: "Them", themStrength: 75, usStrength: 75, regain: (r as { regain?: unknown }).regain, offsideOff: false,
          frame: { ...made.sc.viewport }, minute: st.minute, scoreDiff: st.userScore - st.oppScore,
        } as never);
        if (lead && lead.durS > 0) { withBU++; buS += lead.durS; if ((lead as { offside?: unknown }).offside) offside++; }
        HM.resolveScenario(st, standIn(r.zone, rng));
      }
    }
    const pct = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(1)}%`;
    console.log(`${pos} flow=${flow ? "New" : "Old"}: chances/match ${(req / N).toFixed(2)} (dribbles ${(drib / N).toFixed(2)}); real ${real} of ${req - drib} served = ${pct(real, req - drib)} (of open play ${pct(real, open)}); real/match ${(real / N).toFixed(2)}`);
    console.log(`   build-ups/match ${(withBU / N).toFixed(2)} (${pct(withBU, req - drib)} of served), mean ${(buS / Math.max(1, withBU)).toFixed(2)} s, seconds/match ${(buS / N).toFixed(1)}, offside build-ups/match ${(offside / N).toFixed(2)}`);
    console.log(`   kinds:`, JSON.stringify(Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / N).toFixed(2)]))));
    console.log(`   real kinds:`, JSON.stringify(Object.fromEntries(Object.entries(realKinds).map(([k, v]) => [k, +(v / N).toFixed(2)]))));
  }
}
void existsSync;
