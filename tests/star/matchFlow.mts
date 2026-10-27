/**
 * MATCH FLOW (Leo v0.15, the match radar job) — the unseen match against real
 * Premier League per-match numbers, and proof that Old is untouched.
 *
 *   1. Old: with `matchFlow` absent or false, 300 seeded matches give exactly
 *      the events, requests and scores the game gave before this change
 *      (a fingerprint taken from the code before it).
 *   2. New: over 1,000 matches per matchup, shots, goals, conversion,
 *      corners and possession land in the real range, the side behind takes
 *      more of the shots after a goal, more happens late, and the chances
 *      that reach you move by no more than a few percent.
 *
 * Real numbers and sources: docs/gameplay15/radar.md. The full measuring
 * script (all four matchups, every number): scripts/match-flow-measure.mts.
 */
import {
  newMatch, tick, resolveScenario, CHANCE_LINES,
  type HiddenMatchInputs, type Zone, type ScenarioResult,
} from "../../lib/star/hiddenMatch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The player's own chances, at the rates hiddenMatch.mts uses. */
function standIn(zone: Zone, rng: () => number): ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}

// ── 1. Old is the old match ─────────────────────────────────────────────────
// FNV-1a over every event, request and score of 300 matches in 3 matchups.
function fingerprint(extra: Partial<HiddenMatchInputs>): string {
  let h = 0x811c9dc5;
  const feed = (str: string) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  const sets: HiddenMatchInputs[] = [
    { teamStrength: 75, oppStrength: 75, playerSkill: 70, position: "ST", livePenalties: true, context: {} },
    { teamStrength: 88, oppStrength: 62, playerSkill: 80, position: "LW", home: true, fergie: { from: 90, to: 94 } },
    { teamStrength: 62, oppStrength: 88, playerSkill: 60, position: "CAM", home: false, deepTouches: true, context: { playstyle: "defensive" } },
  ];
  for (const base of sets) {
    for (let seed = 1; seed <= 100; seed++) {
      const inputs = { ...base, ...extra };
      const rng = mulberry32(seed * 131 + 7);
      const st = newMatch(rng);
      while (st.minute < 94) {
        const { events, request } = tick(st, inputs, rng);
        feed(JSON.stringify(events));
        if (request) { feed(JSON.stringify({ ...request, regain: undefined, deal: undefined })); resolveScenario(st, standIn(request.zone, rng)); }
        feed(`${st.minute}:${st.userScore}-${st.oppScore}:${st.zone}:${st.possession}:${st.momentum.toFixed(6)}`);
      }
    }
  }
  return h.toString(16);
}
// Taken from lib/star/hiddenMatch.ts as it was before match flow (ddd06d7d).
// B2b (2c985b9d) added a read-only `regain` note to ScenarioRequest (no random
// draw, nothing reads it back), which changed the JSON of every request. The
// fingerprint leaves that one note out (`regain: undefined`), so it still pins
// every event, score, zone and the rest of every request to the old match.
// 26 Oct 2026 (Mikey, play style changes chances): Defensive's byline-cross
// weight went 0.8 → 1.6, which changes the third matchup's requested kinds
// (was 4173b349; with the old 0.8 it still is). The new `deal` note is left
// out like `regain`.
const OLD_FINGERPRINT = "64861bcd";
console.log("\n== Old is exactly the old match");
check(fingerprint({}) === OLD_FINGERPRINT, `no matchFlow: fingerprint ${fingerprint({})} = ${OLD_FINGERPRINT}`);
check(fingerprint({ matchFlow: false }) === OLD_FINGERPRINT, "matchFlow: false is the same");
check(fingerprint({ matchFlow: true }) !== OLD_FINGERPRINT, "matchFlow: true is a different match");

// ── 2. New against the real numbers ─────────────────────────────────────────
interface M { shots: number; goals: number; corners: number; poss: number; chances: number; early: number; late: number; trail: number; trailTot: number }
function measure(inputs: HiddenMatchInputs, N = 1000): M {
  const m: M = { shots: 0, goals: 0, corners: 0, poss: 0, chances: 0, early: 0, late: 0, trail: 0, trailTot: 0 };
  let minutes = 0;
  for (let seed = 1; seed <= N; seed++) {
    const rng = mulberry32(seed * 7919 + 13);
    const st = newMatch(rng);
    const sU = new Array(100).fill(0), sT = new Array(100).fill(0);
    let firstGoal: { m: number; us: boolean } | null = null;
    while (st.minute < 90) {
      const u0 = st.userScore, o0 = st.oppScore;
      const { events, request } = tick(st, inputs, rng);
      minutes++;
      if (st.possession === "user") m.poss++;
      for (const e of events) {
        if (e.corner) m.corners++;
        if (e.isGoal || CHANCE_LINES.has(e.text) || e.shot) {
          m.shots++;
          if (e.isOpponent || (e.isGoal && !e.teammateGoal)) sT[st.minute]++; else sU[st.minute]++;
        }
      }
      if (request) {
        m.chances++;
        const r = standIn(request.zone, rng);
        if (r === "goal" || r === "saved") { m.shots++; sU[st.minute]++; }
        resolveScenario(st, r);
      }
      const scored = st.userScore + st.oppScore - u0 - o0;
      if (scored > 0) {
        m.goals += scored;
        if (st.minute <= 15) m.early += scored;
        if (st.minute > 75) m.late += scored;
        if (!firstGoal) firstGoal = { m: st.minute, us: st.userScore > u0 };
      }
    }
    if (firstGoal && firstGoal.m <= 70) {
      const sum = (a: number[]) => a.slice(firstGoal!.m + 1, firstGoal!.m + 16).reduce((x, y) => x + y, 0);
      m.trail += firstGoal.us ? sum(sT) : sum(sU);
      m.trailTot += sum(sT) + sum(sU);
    }
  }
  return {
    shots: m.shots / N, goals: m.goals / N, corners: m.corners / N, poss: (m.poss / minutes) * 100,
    chances: m.chances / N, early: m.early / m.goals, late: m.late / m.goals, trail: m.trail / Math.max(1, m.trailTot), trailTot: m.trailTot,
  };
}
const base: HiddenMatchInputs = { teamStrength: 75, oppStrength: 75, playerSkill: 70, pace: 70, freeKick: 60, position: "ST", livePenalties: true, context: {} };
const f = (n: number) => n.toFixed(2);

console.log("\n== Equal sides (75 v 75, neutral)");
const oldEq = measure(base), newEq = measure({ ...base, matchFlow: true });
console.log(`   shots ${f(oldEq.shots)} → ${f(newEq.shots)} · goals ${f(oldEq.goals)} → ${f(newEq.goals)} · corners ${f(oldEq.corners)} → ${f(newEq.corners)} · possession ${f(oldEq.poss)} → ${f(newEq.poss)}% · your chances ${f(oldEq.chances)} → ${f(newEq.chances)}`);
check(newEq.shots >= 21 && newEq.shots <= 28, `shots a match ${f(newEq.shots)} in 21-28 (real ~25)`);
check(newEq.goals >= 2.4 && newEq.goals <= 3.2, `goals a match ${f(newEq.goals)} in 2.4-3.2 (real ~2.8)`);
check(newEq.goals / newEq.shots >= 0.09 && newEq.goals / newEq.shots <= 0.14, `a shot goes in ${(newEq.goals / newEq.shots * 100).toFixed(1)}% (real ~11%)`);
check(newEq.corners >= 7 && newEq.corners <= 12.5, `corners a match ${f(newEq.corners)} in 7-12.5 (real ~10.5)`);
check(newEq.poss >= 46 && newEq.poss <= 54, `possession ${f(newEq.poss)}% in 46-54`);
check(Math.abs(newEq.chances / oldEq.chances - 1) <= 0.1, `your chances ${f(oldEq.chances)} → ${f(newEq.chances)}, within 10%`);
check(newEq.late > newEq.early * 1.2, `more goals in the last 15' (${(newEq.late * 100).toFixed(0)}%) than the first (${(newEq.early * 100).toFixed(0)}%)`);
check(newEq.trail > oldEq.trail + 0.01, `after a goal the side behind takes more of the shots: ${(oldEq.trail * 100).toFixed(1)}% → ${(newEq.trail * 100).toFixed(1)}%`);

console.log("\n== A much stronger side (88 v 62 at home) and a much weaker one (62 v 88 away)");
const strong = measure({ ...base, teamStrength: 88, oppStrength: 62, home: true, matchFlow: true });
const weak = measure({ ...base, teamStrength: 62, oppStrength: 88, home: false, matchFlow: true });
const oldStrong = measure({ ...base, teamStrength: 88, oppStrength: 62, home: true });
const oldWeak = measure({ ...base, teamStrength: 62, oppStrength: 88, home: false });
console.log(`   strong: possession ${f(oldStrong.poss)} → ${f(strong.poss)}%, your chances ${f(oldStrong.chances)} → ${f(strong.chances)}`);
console.log(`   weak:   possession ${f(oldWeak.poss)} → ${f(weak.poss)}%, your chances ${f(oldWeak.chances)} → ${f(weak.chances)}`);
check(strong.poss >= 63 && strong.poss <= 74, `the much stronger side has ${f(strong.poss)}% of the ball (63-74)`);
check(weak.poss >= 26 && weak.poss <= 37, `the much weaker side has ${f(weak.poss)}% of the ball (26-37)`);
check(strong.shots >= 20 && weak.shots >= 20, `shots stay football-like in a mismatch (${f(strong.shots)}, ${f(weak.shots)})`);
// 25% (was 20%) since sim rebuild piece 4 (22 Oct 2026): with Match flow on,
// your missed chance now ends like a team-mate's (a corner, or the second ball
// won back a zone further out; hiddenMatch.ts missedMove). Before, it handed
// the ball over IN their box, and a much stronger side won it straight back
// there for another chance: 8.98 a match, now 8.43 (Old 10.77, where every
// miss still ends that way). The Old fingerprint above is unchanged.
check(Math.abs(strong.chances / oldStrong.chances - 1) <= 0.25 && Math.abs(weak.chances / oldWeak.chances - 1) <= 0.25,
  `your chances in a mismatch move under 25% (${f(oldStrong.chances)} → ${f(strong.chances)}, ${f(oldWeak.chances)} → ${f(weak.chances)})`);

if (problems.length) { console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log("\nmatch flow: all good");
