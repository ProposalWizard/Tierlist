import { readFileSync } from "node:fs";
import { makeChance } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { buildKaneMoment, dealKaneMoment, GRADE_SHARE, resetKaneDeals, type KaneGrade, type KaneMoment } from "../../lib/star/kaneMoments";
import { goalInView } from "../../lib/star/canvasEngine";
import { POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";
import { mulberry32 } from "../../lib/star/season";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

/**
 * KANE DRAWINGS (Settings → Match → Kane drawings (testing)).
 * Real strikers' passes and shots, Kane's dealt most (public/star/kane-moments.json,
 * made by tools/statsbomb/kane.mts). With the setting on, a chance of a kind
 * that has drawings is one of them; with it off (null), nothing changes.
 * The drawing rules (Mikey, 9 Oct 2026) are each checked on every drawing.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const file = JSON.parse(readFileSync("public/star/kane-moments.json", "utf8")) as { moments: KaneMoment[] };
const ms = file.moments;
check(ms.length > 600, `a real number of drawings (${ms.length})`);

// Every drawing builds: the ball where Kane was, you on it, the target on the real team-mate.
let bad = 0;
for (const m of ms) {
  const sc = buildKaneMoment(m);
  const b = m.override.ball!;
  if (Math.hypot(sc.ball.x - b.x, sc.ball.y - b.y) > 0.01) bad++;
  if (Math.hypot(sc.player.x - sc.ball.x, sc.player.y - sc.ball.y) > 1.5) bad++;
  if (m.runnerTo && (!sc.runner || !sc.passTarget || Math.hypot(sc.passTarget.x - m.runnerTo.x, sc.passTarget.y - m.runnerTo.y) > 0.01)) bad++;
  if (sc.kind !== m.kind) bad++;
}
check(bad === 0, `every drawing builds as drawn (${bad} wrong)`);

// The drawing rules, on every drawing.
const rule = { goal: 0, gap: 0, bodies: 0, byline: 0, grade: 0, ball: 0 };
for (const m of ms) {
  const sc = buildKaneMoment(m);
  const v = sc.viewport!;
  const inV = (x: number, y: number, pad = 0) => x >= v.x1 + pad && x <= v.x2 - pad && y >= v.y1 + pad && y <= v.y2 - pad;
  if (!inV(sc.ball.x, sc.ball.y, 2)) rule.ball++;
  if (m.kind === "byline_cross") { if (!sc.facing) rule.byline++; }
  else if (goalInView(m.kind) && (!inV(POST_L, 0, 0.5) || !inV(POST_R, 0, 0.5) || v.y1 > -NET_DEPTH)) rule.goal++;
  for (const d of sc.defenders) {
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 2.7 || Math.hypot(d.x - sc.player.x, d.y - sc.player.y) < 2.7) rule.gap++;
  }
  const bodies = [...sc.defenders, ...sc.teammates, ...(sc.runner ? [sc.runner.pos] : [])];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    if (Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y) < 0.85) rule.bodies++;
  }
  if (!m.grade) rule.grade++;
}
check(rule.ball === 0, `the ball is well inside the picture (${rule.ball} not)`);
check(rule.goal === 0, `a chance at goal shows the whole goal and the net (${rule.goal} not)`);
check(rule.byline === 0, `a byline cross is watched side-on (${rule.byline} not)`);
check(rule.gap === 0, `no opponent within 2.7 m of the ball or you (${rule.gap} too close)`);
check(rule.bodies === 0, `nobody stands on anybody (${rule.bodies} overlaps)`);
check(rule.grade === 0, `every drawing has a grade (${rule.grade} without)`);
check(ms.some((m) => m.kind === "byline_cross"), "there are byline crosses");
check(ms.some((m) => m.kane) && ms.some((m) => !m.kane), "Kane and other strikers both in");

// Dealt about 50 / 35 / 15 by grade (where a kind has all three).
const dealtG: Record<KaneGrade, number> = { easy: 0, normal: 0, hard: 0 };
const rngG = mulberry32(11);
for (let i = 0; i < 6000; i++) dealtG[dealKaneMoment("midfield_pass", rngG, ms)!.grade!]++;
for (const g of Object.keys(GRADE_SHARE) as KaneGrade[]) {
  check(Math.abs(dealtG[g] / 6000 - GRADE_SHARE[g]) < 0.03, `${g} dealt about ${GRADE_SHARE[g] * 100}% (${(dealtG[g] / 60).toFixed(1)}%)`);
}
// Within a grade, Kane comes up more often than his share of the drawings.
const mp = ms.filter((m) => m.kind === "midfield_pass" && m.grade === "easy");
const kaneShare = mp.filter((m) => m.kane).length / mp.length;
let kaneDealt = 0, easyDealt = 0;
const rngK = mulberry32(12);
for (let i = 0; i < 12000; i++) { const d = dealKaneMoment("midfield_pass", rngK, ms)!; if (d.grade === "easy") { easyDealt++; if (d.kane) kaneDealt++; } }
check(kaneDealt / easyDealt > kaneShare * 1.3, `Kane dealt more than his share (${(kaneDealt / easyDealt * 100).toFixed(1)}% vs ${(kaneShare * 100).toFixed(1)}% of drawings)`);

// The match serves them: kind kept, and no repeat until the kind is used up.
const kinds = Array.from(new Set(ms.map((m) => m.kind))) as ScenarioKind[];
for (const kind of kinds) {
  // Within a grade, no repeat until the grade is used up.
  resetKaneDeals();
  const easy = ms.filter((m) => m.kind === kind && m.grade === "easy");
  if (!easy.length) continue;
  const ids: string[] = [];
  const rng = mulberry32(3);
  while (ids.length < easy.length * 4) { const d = dealKaneMoment(kind, rng, ms)!; if (d.grade === "easy") ids.push(d.id); }
  const round = easy.reduce((a, m) => a + (m.kane ? 3 : 1), 0);
  const first = ids.slice(0, round);
  check(easy.every((m) => first.filter((x) => x === m.id).length === (m.kane ? 3 : 1)), `${kind}: a round deals every easy one once (Kane's 3 times) before any comes back`);
}
const made = makeChance({ source: { from: "kind", kind: "through_ball" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: ms });
check(made.how === "kane" && made.sc.kind === "through_ball", `a through ball is a Kane drawing (${made.how})`);
const pen = makeChance({ source: { from: "kind", kind: "penalty" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: ms });
check(pen.how !== "kane", "a kind with no drawing (a penalty) is made as before");
const off = makeChance({ source: { from: "kind", kind: "through_ball" }, rng: mulberry32(9), selection: newSelectionMemory(), kaneDrawings: null });
check(off.how !== "kane", "switched off: the game's own");

if (problems.length) { console.error(`kaneMoments: ${problems.length} problem(s)`); for (const p of problems) console.error("  ✗ " + p); process.exit(1); }
console.log(`kaneMoments: ${ms.length} drawings, ${kinds.length} kinds, all good`);
