/**
 * Live chances (lib/star/liveChance.ts): the plan, the ball and the swing read.
 * Run: npx tsx tests/star/liveChance.mts
 */
import { liveRate, planFromLead, planMadeUp, liveBallAt, alongOf, readSwing, runPast, liveKindOK, LIVE_DEFAULTS, liveChancesOn, type LeadPath } from "../../lib/star/liveChance";
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

// A straight 20 m pass along the ground ending at the spot at t1 = 2.0, durS 2.25.
const spot = { x: 34, y: 14 }, from = { x: 34, y: 34 };
const ease = (f: number) => f * (1.3 - 0.3 * f);
const lead: LeadPath = {
  durS: 2.25, passStart: [0.5], passEnd: [2.0],
  ballAt: (t) => { const f = Math.max(0, Math.min(1, (t - 0.5) / 1.5)), g = ease(f); return { x: from.x, y: from.y + (spot.y - from.y) * g, z: 0 }; },
};
const plan = planFromLead(lead, spot)!;
ok(!!plan, "a ground pass onto the spot is live");
ok(Math.abs(plan.t1 - 2.0) < 1e-9 && plan.handT >= 0.55 && plan.handT < 2.0, `hand-over before the pass arrives (handT ${plan.handT.toFixed(2)})`);
ok(plan.u.y < -0.99, "direction: toward goal");
ok(Math.abs(plan.v1 - 0.7 * 20 / 1.5) < 1e-6, `arrival speed ${plan.v1.toFixed(2)} m/s`);
const wall = (plan.t1 - plan.handT) / plan.slow;
ok(Math.abs(wall - LIVE_DEFAULTS.arriveS) < 0.01 || plan.slow === LIVE_DEFAULTS.slowMin, `about ${LIVE_DEFAULTS.arriveS}s of real time to aim (${wall.toFixed(2)}s)`);
// The ball is continuous at the spot and rolls on past it.
const at1 = liveBallAt(plan, plan.t1, lead.ballAt), past = liveBallAt(plan, plan.t1 + 0.3, lead.ballAt);
ok(Math.hypot(at1.x - spot.x, at1.y - spot.y) < 1e-6, "on the spot at t1");
ok(alongOf(plan, past) > 1.5, `rolls on past (${alongOf(plan, past).toFixed(2)} m after 0.3 s)`);
ok(runPast(plan, liveBallAt(plan, plan.t1 + 0.5, lead.ballAt)), "0.5 s later it has run past you");
// An air ball, or a pass that is not to the spot, is not live.
ok(planFromLead({ ...lead, ballAt: (t) => ({ ...lead.ballAt(t), z: 1.5 }) }, spot) === null, "a ball in the air is not live");
ok(planFromLead(lead, { x: 40, y: 14 }) === null, "a last pass to somebody else is not live");
ok(planFromLead({ ...lead, passStart: [], passEnd: [] }, spot) === null, "no pass (you carried it): not live");
// The swing.
const aim = { x: 0, y: -1 };
const sw = (along: number) => readSwing(plan, { x: spot.x, y: spot.y + (-plan.u.y) * -along }, 10, aim, 0.8, 0.3);
const sweet = sw(0), early = sw(-0.8), late = sw(0.7), air1 = sw(-1.5), air2 = sw(1.2);
ok(sweet.hit && sweet.timing === "sweet", "on the spot: clean");
ok(early.hit && early.timing === "early" && early.power < (sweet.hit ? sweet.power : 0), "early: weaker");
ok(early.hit && early.contact.cy < (sweet.hit ? sweet.contact.cy : 0), "early: struck higher on the ball (lower shot)");
ok(late.hit && late.timing === "late" && late.contact.cy > (sweet.hit ? sweet.contact.cy : 0), "late: got under it (rises)");
ok(!air1.hit && air1.why === "early", "far too early: fresh air");
ok(!air2.hit && air2.why === "late", "far too late: fresh air");
// Pace carries in: a ball rolling across you bends a shot aimed straight.
const across = planMadeUp({ x: 20, y: 14 }, spot)!;
const bent = readSwing(across, spot, 12, aim, 0.6, 0.5);
ok(bent.hit && bent.dir.x > 0.05 && bent.bentDeg > 2, `a ball rolling left-to-right pulls the shot right (${bent.hit ? bent.bentDeg.toFixed(1) : "-"}°)`);
const hard = readSwing(across, spot, 12, aim, 1, 0.5);
ok(hard.hit && bent.hit && hard.bentDeg < bent.bentDeg, "a harder strike is bent less");
// Which chances.
ok(!liveKindOK("penalty") && !liveKindOK("free_kick") && !liveKindOK("corner") && !liveKindOK("header") && !liveKindOK("volley"), "set pieces and aerials are never live");
ok(liveKindOK("one_on_one") && liveKindOK("through_ball") && liveKindOK("cutback"), "open-play ground chances are live");
ok(liveChancesOn() === false, "off by default (no window)");
// Extra slow motion near you, none far away.
ok(liveRate(plan, { x: spot.x, y: spot.y + 8 }) === plan.slow, "far away: the plan's slow motion only");
ok(Math.abs(liveRate(plan, spot) - plan.slow * LIVE_DEFAULTS.nearSlow) < 1e-9, "at the spot: the extra slow motion");
ok(liveRate(plan, { x: spot.x, y: spot.y - 3 }) === plan.slow, "gone past: back to the plan's");
if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("all passed");
