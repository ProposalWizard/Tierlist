/**
 * FIRST TOUCH BALANCE: over the match's one-on-ones and through balls (with
 * their build-ups), the keeper rushes as the pass comes; you take a touch at
 * the ring. How often does he smother it, by how the touch was taken?
 *   npx tsx scripts/film/live/touchbalance.mts
 */
import { servedChances } from "../../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../../lib/star/fhr/buildUp";
import { setVisitSalt } from "../../../lib/star/chanceMaker";
import { planFromLead, keeperRushes, rushTarget, stepToward, keeperRushV, keeperReactS, readTouch, planAfterTouch, keeperVsTouch, LIVE_DEFAULTS } from "../../../lib/star/liveChance";
setVisitSalt(0);
const pool = servedChances({ count: 900, seed: 29 }).filter((c) => c.sc.kind === "one_on_one" || c.sc.kind === "through_ball");
type Row = { smother: boolean };
const cases: Record<string, Row[]> = {};
for (const c of pool) {
  if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
  const sc = JSON.parse(JSON.stringify(c.sc));
  const lead = fhrBuildUpFor(sc, c.moment); if (!lead) continue;
  const plan = planFromLead(lead, sc.ball); if (!plan) continue;
  const k0 = lead.posAt("keeper", plan.handT) ?? sc.keeper;
  if (!keeperRushes(sc.kind, k0, plan.spot)) continue;
  const share = Math.max(0, Math.min(1, ((sc.keeperStrength ?? 62) - 40) / 55));
  const v = keeperRushV(share), react = keeperReactS(share);
  // He rushes from the hand-over until the ball reaches you.
  let k = { ...k0 };
  for (let t = plan.handT; t < plan.t1; t += 0.02) k = stepToward(k, rushTarget(plan.spot, { x: 34, y: 0 }), v, 0.02);
  const you = lead.posAt("you", plan.t1) ?? sc.player;
  const side = Math.sign(plan.spot.x - k.x) || 1;
  const tries: [string, { x: number; y: number }, number][] = [
    ["round him, medium", { x: side * 0.85, y: -0.5 }, 0.35],
    ["round him, soft", { x: side * 0.85, y: -0.5 }, 0.1],
    ["round him, heavy", { x: side * 0.85, y: -0.5 }, 0.8],
    ["square across", { x: side, y: 0 }, 0.35],
    ["straight at him", { x: 0, y: -1 }, 0.35],
    ["wrong side (into him)", { x: -side * 0.85, y: -0.5 }, 0.35],
  ];
  for (const [name, dir, w] of tries) {
    const rd = readTouch(plan, plan.spot, plan.v1, dir, w, 0.3, LIVE_DEFAULTS);
    if (!rd.ok) continue;
    const after = planAfterTouch(rd, you, 6.8);
    const kp = keeperVsTouch(k, v * 1.15, react, after.plan, after.plan.t1);
    (cases[name] ??= []).push({ smother: kp.smother });
  }
}
for (const [name, rows] of Object.entries(cases)) {
  const s = rows.filter((r) => r.smother).length;
  console.log(`${name.padEnd(24)} smothered ${s}/${rows.length} (${Math.round(100 * s / rows.length)}%)`);
}
