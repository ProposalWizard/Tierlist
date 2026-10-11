import { newMatch, tick, resolveScenario, CHANCE_LINES, type HiddenMatchInputs, type Zone, type ScenarioResult } from "../lib/star/hiddenMatch";
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function standIn(zone: Zone, rng: () => number): ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}
const ZO = ["own_box", "defensive", "middle", "attacking", "box"];
function run(label: string, inputs: HiddenMatchInputs, N = 2000) {
  let shotsUs = 0, shotsThem = 0, gUs = 0, gThem = 0, poss = 0, mins = 0, req = 0, cornersUs = 0;
  const zoneMin: Record<string, number> = {}; const reqMin = new Array(7).fill(0); const goalMin = new Array(7).fill(0);
  let skip2 = 0, transitions = 0, firstReq = 0, firstReqN = 0, chancesViaMid = 0, chancesTotal = 0;
  let recentMidN = 0; let trA = 0, ttA = 0, trB = 0, ttB = 0; let momSwing = 0, momN = 0; let tallyCorners = 0, tallyCornersThem = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 7919 + 13); const st = newMatch(rng);
    (st as { tally?: unknown }).tally = {};
    let spellMid = false; const zh: string[] = []; const recentMid = () => zh.slice(-5).includes("middle"); let lastPoss = st.possession; let first = -1;
    const goalAt: { m: number; us: boolean }[] = []; const mom: number[] = [0]; const sU = new Array(130).fill(0), sT = new Array(130).fill(0);
    while (st.minute < 90) {
      const z0 = st.zone; const u0 = st.userScore, o0 = st.oppScore;
      const { events, request } = tick(st, inputs, rng);
      mins++; if (st.possession === "user") poss++;
      zoneMin[st.zone] = (zoneMin[st.zone] ?? 0) + 1;
      if (Math.abs(ZO.indexOf(st.zone) - ZO.indexOf(z0)) >= 2) skip2++;
      if (st.possession !== lastPoss) { spellMid = false; lastPoss = st.possession; }
      if (st.zone === "middle") spellMid = true; zh.push(z0);
      const bucket = Math.min(6, Math.floor((st.minute - 1) / 15));
      for (const e of events) {
        if ((e as { corner?: boolean }).corner) { if (e.isOpponent) tallyCornersThem++; else tallyCorners++; }
        if (e.isGoal) { if (e.teammateGoal) { gUs++; shotsUs++; sU[st.minute]++; } else { gThem++; shotsThem++; sT[st.minute]++; } chancesTotal++; if (spellMid) chancesViaMid++; if (recentMid()) recentMidN++; goalMin[bucket]++; }
        else if (CHANCE_LINES.has(e.text) || (e as { shot?: boolean }).shot) { if (e.isOpponent) { shotsThem++; sT[st.minute]++; } else { shotsUs++; sU[st.minute]++; } chancesTotal++; if (spellMid) chancesViaMid++; if (recentMid()) recentMidN++; }
      }
      if (request) {
        req++; reqMin[bucket]++; if (first < 0) first = st.minute;
        if (request.kinds.length === 1 && request.kinds[0] === "corner") cornersUs++;
        if (request.pattern === "transition") transitions++;
        chancesTotal++; if (spellMid) chancesViaMid++; if (recentMid()) recentMidN++;
        const r = standIn(request.zone, rng);
        if (r === "goal" || r === "saved") { shotsUs++; sU[st.minute]++; }
        if (r === "goal") { gUs++; goalMin[bucket]++; }
        resolveScenario(st, r);
      }
      if (st.userScore > u0) goalAt.push({ m: st.minute, us: true });
      if (st.oppScore > o0) goalAt.push({ m: st.minute, us: false });
      mom.push(st.momentum);
    }
    const g0 = goalAt[0];
    if (g0 && g0.m <= 70) {
      const sum = (a: number[], f: number, t: number) => a.slice(f, t).reduce((x, y) => x + y, 0);
      const trailAfter = g0.us ? sum(sT, g0.m + 1, g0.m + 16) : sum(sU, g0.m + 1, g0.m + 16);
      const totAfter = sum(sT, g0.m + 1, g0.m + 16) + sum(sU, g0.m + 1, g0.m + 16);
      const trailBefore = g0.us ? sum(sT, 1, g0.m + 1) : sum(sU, 1, g0.m + 1);
      const totBefore = sum(sT, 1, g0.m + 1) + sum(sU, 1, g0.m + 1);
      trA += trailAfter; ttA += totAfter; trB += trailBefore; ttB += totBefore;
    }
    for (const g of goalAt) {
      if (g.m < 3 || g.m > 84) continue;
      const before = mom[g.m - 2], after = mom[Math.min(mom.length - 1, g.m + 3)];
      momSwing += (after - before) * (g.us ? 1 : -1); momN++;
    }
    if (first > 0) { firstReq += first; firstReqN++; }
  }
  const f = (n: number) => (n / N).toFixed(2);
  console.log(`\n== ${label} (${N} matches)`);
  console.log(`shots us ${f(shotsUs)} them ${f(shotsThem)} total ${f(shotsUs + shotsThem)}`);
  console.log(`goals us ${f(gUs)} them ${f(gThem)} total ${f(gUs + gThem)}  conv ${((gUs + gThem) / (shotsUs + shotsThem) * 100).toFixed(1)}%`);
  console.log(`possession us ${(poss / mins * 100).toFixed(1)}%   your chances ${f(req)}  first at ${(firstReq / firstReqN).toFixed(1)}'`);
  console.log(`your corners (requests) ${f(cornersUs)}  corners us ${f(tallyCorners)} them ${f(tallyCornersThem)}  transitions ${f(transitions)}`);
  console.log(`zone minutes %`, Object.fromEntries(ZO.map((k) => [k, ((zoneMin[k] ?? 0) / mins * 100).toFixed(1)])));
  console.log(`2+ zone jumps ${(skip2 / mins * 100).toFixed(1)}% of minutes; chances whose spell went through midfield ${(chancesViaMid / chancesTotal * 100).toFixed(1)}%, ball in midfield in the 5' before ${(recentMidN / chancesTotal * 100).toFixed(1)}%`);
  console.log(`after the first goal, the side behind takes ${(trA / ttA * 100).toFixed(1)}% of shots in the next 15' (before the goal: ${(trB / ttB * 100).toFixed(1)}%)`);
  console.log(`momentum swing to the scorer over 5' after a goal: ${(momSwing / momN).toFixed(3)}`);
  console.log(`your chances by 15': ${reqMin.map((n) => f(n)).join(" ")}   goals by 15': ${goalMin.map((n) => (n / (gUs + gThem) * 100).toFixed(0) + "%").join(" ")}`);
}
const base = { playerSkill: 70, pace: 70, freeKick: 60, position: "ST", livePenalties: true, context: {} } as const;
const extra = process.env.FLOW ? { matchFlow: true } : {};
run("equal 75 v 75, neutral", { ...base, ...extra, teamStrength: 75, oppStrength: 75 });
run("equal 75 v 75, home", { ...base, ...extra, teamStrength: 75, oppStrength: 75, home: true });
run("much stronger 88 v 62, home", { ...base, ...extra, teamStrength: 88, oppStrength: 62, home: true });
run("much weaker 62 v 88, away", { ...base, ...extra, teamStrength: 62, oppStrength: 88, home: false });
