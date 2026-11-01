/**
 * Live chances (lib/star/liveChance.ts): the plan, the ball and the swing read.
 * Run: npx tsx tests/star/liveChance.mts
 */
import { liveDialsFor, touchErrorScale, defenderTarget, nearestTo, DEF, liveDials, TOUCH, isTouchFlick, touchWeight, readTouch, planAfterTouch, keeperVsTouch, keeperRushes, rushTarget, runnerAt, liveRate, planFromLead, planMadeUp, liveBallAt, alongOf, readSwing, runPast, liveKindOK, LIVE_DEFAULTS, liveChancesOn, type LeadPath } from "../../lib/star/liveChance";
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
// The strike screen's tap: where you tap sets curve and height; the timing moves it.
const tapAt = (along: number, tap: { cx: number; cy: number }) => readSwing(plan, { x: spot.x, y: spot.y + (-plan.u.y) * -along }, 10, aim, 0.8, 0.3, LIVE_DEFAULTS, tap);
const chip = tapAt(0, { cx: 0, cy: 0.9 }), curl = tapAt(0, { cx: -0.7, cy: 0 });
ok(chip.hit && chip.contact.cy === 0.9, "clean tap at the bottom: a chip (contact kept)");
ok(curl.hit && curl.contact.cx === -0.7, "clean tap on the side: curl (contact kept)");
const lateChip = tapAt(0.7, { cx: 0, cy: 0.5 }), earlyTop = tapAt(-0.8, { cx: 0, cy: 0 });
ok(lateChip.hit && lateChip.contact.cy > 0.5, "late tap: further under the ball");
ok(earlyTop.hit && earlyTop.contact.cy < 0, "early tap: rides up the ball");
ok(!tapAt(-1.5, { cx: 0, cy: 0 }).hit, "tap far too early: fresh air");
// Extra slow motion near you, none far away.
ok(liveRate(plan, { x: spot.x, y: spot.y + 8 }) === plan.slow, "far away: the plan's slow motion only");
ok(Math.abs(liveRate(plan, spot) - plan.slow * LIVE_DEFAULTS.nearSlow) < 1e-9, "at the spot: the extra slow motion");
ok(liveRate(plan, { x: spot.x, y: spot.y - 3 }) === plan.slow, "gone past: back to the plan's");
// ── The first touch ──
ok(isTouchFlick(150, 0.1) && !isTouchFlick(400, 0.1) && !isTouchFlick(150, 0.02), "a flick is quick and long enough; a slow drag or a tiny one is not");
ok(touchWeight(TOUCH.minSwipe) === 0 && touchWeight(TOUCH.fullSwipe) === 1, "swipe length sets the weight 0..1");
// One-on-one: the pass comes straight up the pitch to the spot; you touch it forward-left.
const flickFL = { x: -0.7, y: -0.7 };
const tClean = readTouch(plan, spot, 8, flickFL, 0.4, 0.3);
ok(tClean.ok && tClean.timing === "sweet", "a touch on the ring: clean");
if (tClean.ok) {
  const ang = Math.acos(Math.max(-1, Math.min(1, (tClean.dir.x * -0.7071 + tClean.dir.y * -0.7071)))) * 180 / Math.PI;
  ok(ang < 12, `clean: it goes where you flicked (${ang.toFixed(1)}° off, the pass's own pace a little)`);
  ok(tClean.v0 > TOUCH.vSoft && tClean.v0 < TOUCH.vHeavy, `clean: a medium touch (${tClean.v0.toFixed(1)} m/s)`);
  const after = planAfterTouch(tClean, { x: spot.x + 0.5, y: spot.y + 0.4 }, 6.8);
  const travel = Math.hypot(after.plan.spot.x - spot.x, after.plan.spot.y - spot.y);
  ok(travel > 2 && travel < 9, `you catch it up ${travel.toFixed(1)} m on, ${after.plan.t1.toFixed(2)} s after the touch`);
  ok(Math.hypot(after.meet.x - after.plan.spot.x, after.meet.y - after.plan.spot.y) <= TOUCH.meetGap + 1e-6, "you meet it just behind the ball");
  const you1 = runnerAt({ x: spot.x + 0.5, y: spot.y + 0.4 }, after.meet, 6.8, after.plan.t1);
  ok(Math.hypot(you1.x - after.meet.x, you1.y - after.meet.y) < 0.05, "you are there as it arrives");
  // A keeper right in front of the ball smothers it; one off to the side and committed is beaten.
  const kIn = keeperVsTouch({ x: spot.x - 1.5, y: spot.y - 1.8 }, 6, 0.25, after.plan, after.plan.t1);
  ok(kIn.smother, "keeper standing where you push it: he smothers it");
  const kOut = keeperVsTouch({ x: spot.x + 3.5, y: spot.y - 2.5 }, 6, 0.25, after.plan, after.plan.t1);
  ok(!kOut.smother, "keeper on the other side, coming at you: you go round him");
}
const tEarly = readTouch(plan, { x: spot.x, y: spot.y + 0.8 }, 8, flickFL, 0.4, 0.3);
ok(tEarly.ok && tEarly.timing === "early" && tClean.ok && tEarly.v0 > tClean.v0, "early touch: heavier");
ok(!readTouch(plan, { x: spot.x, y: spot.y + 1.6 }, 8, flickFL, 0.4, 0.3).ok, "far too early: misses it");
ok(keeperRushes("one_on_one", { x: 34, y: 2 }, { x: 34, y: 16 }) && !keeperRushes("long_range", { x: 34, y: 2 }, { x: 34, y: 25 }), "the keeper rushes in a one-on-one, not on a long shot");
const rt = rushTarget({ x: 34, y: 14 }, { x: 34, y: 0 });
ok(rt.y < 14 && rt.y > 12, "he rushes to just in front of where the ball meets you");
// ── Stats decide the skill ──
const weak = liveDialsFor({ pace: 42, power: 42, technique: 42, vision: 42 }), star = liveDialsFor({ pace: 94, power: 94, technique: 94, vision: 94 });
ok(star.sweet > weak.sweet * 1.8, `technique widens the clean zone (${weak.sweet.toFixed(2)} → ${star.sweet.toFixed(2)} m)`);
ok(star.reachLate > weak.reachLate && star.reachEarly > weak.reachEarly, "pace and technique give more reach");
ok(star.arriveS > weak.arriveS && star.nearSlow < weak.nearSlow, "vision gives more time and slow motion");
ok(touchErrorScale(94) < touchErrorScale(42), "a better first touch with technique");
ok(liveDials({ pace: 94, power: 94, technique: 94, vision: 94 }).sweet === star.sweet, "the game's dials come from the stats");
// A mistimed touch from a poor first touch is wider than from a good one.
const poorT = readTouch(plan, { x: spot.x, y: spot.y + 0.8 }, 8, { x: -0.7, y: -0.7 }, 0.4, 0.3, LIVE_DEFAULTS, touchErrorScale(42));
const goodT = readTouch(plan, { x: spot.x, y: spot.y + 0.8 }, 8, { x: -0.7, y: -0.7 }, 0.4, 0.3, LIVE_DEFAULTS, touchErrorScale(94));
ok(poorT.ok && goodT.ok && poorT.v0 > goodT.v0, "a poor first touch runs heavier");
// ── Everyone moves ──
const press = defenderTarget({ x: 40, y: 10 }, { x: 34, y: 16 }, { x: 34, y: 0 }, true);
ok(Math.abs(Math.hypot(press.x - 34, press.y - 16) - DEF.pressGap) < 1e-6, "the presser stops just short of the ball");
const cover = defenderTarget({ x: 40, y: 10 }, { x: 34, y: 16 }, { x: 34, y: 0 }, false);
ok(cover.y < 16 && Math.abs(cover.x - 34) < 0.01, "a cover man goes goal-side of the ball");
ok(nearestTo([{ x: 0, y: 0 }, { x: 30, y: 15 }], { x: 34, y: 16 }).i === 1, "the nearest defender presses");
if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("all passed");
