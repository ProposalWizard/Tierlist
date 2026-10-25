/**
 * HEADERS AND VOLLEYS WITH NO ARROW (lib/star/airTap.ts; Harry, 25 Oct 2026:
 * "skip straight to the ball-hitting animation that we had with the headers,
 * where you just click on the ball. Not make a whole new game up").
 *
 * Pins:
 *   1. the tap aims it: the ball's LEFT side sends it RIGHT (and back), the
 *      middle at the middle of the goal, AIR_TAP_POST_CX out at the post
 *      (AIR_TAP_INSET_M inside it), never wider; the further off the line,
 *      the further across;
 *   2. inside the clean band the contact model sees no glance (the side only
 *      aimed it); past it an edge tap glances, the same way it aimed; the band
 *      grows with Aerial; a late touch keeps its own contact and goes at the middle;
 *   3. the strike through the real path (airContactRead): a clean tap toward
 *      the post reads clean at Aerial 60, the very edge GLANCED;
 *   4. CanvasMatch: no drag on a header/volley, the old ball screen opens by
 *      itself with the tap's aim, no tap-the-goal game, no close camera / men
 *      growing with the zoom, no jump of your man at the hand-over; the trail
 *      follows the ball as drawn. ContactBall shows the band when aiming from the tap.
 */
import { readFileSync } from "node:fs";
import { airContactRead, airCentreR } from "../../lib/star/airborneChance";
import {
  airTapAimX, airTapAim, airTapCleanR, airTapContactCx, airTapStrike,
  AIR_TAP_POST_CX, AIR_TAP_INSET_M, type AirKind,
} from "../../lib/star/airTap";
import { CX, GOAL_W } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;
const kinds: AirKind[] = ["header", "volley"];

// 1.
check(near(airTapAimX(0), CX), "the middle of the ball does not aim at the middle of the goal");
check(near(airTapAimX(-AIR_TAP_POST_CX), CX + GOAL_W / 2 - AIR_TAP_INSET_M), "the left side does not aim at the right post");
check(near(airTapAimX(AIR_TAP_POST_CX), CX - GOAL_W / 2 + AIR_TAP_INSET_M), "the right side does not aim at the left post");
check(near(airTapAimX(1), airTapAimX(AIR_TAP_POST_CX)) && near(airTapAimX(-1), airTapAimX(-AIR_TAP_POST_CX)), "an edge tap aims wider than the post");
{ let prev = Infinity; for (let cx = -1; cx <= 1.0001; cx += 0.05) { const x = airTapAimX(cx); check(x <= prev + 1e-9, `the aim goes back at cx ${cx.toFixed(2)}`); prev = x; } }
for (const k of kinds) {
  const ball = { x: CX - 4, y: 9 };
  const { dir, power } = airTapAim(k, ball, -0.5);
  check(dir.y < 0 && near(Math.hypot(dir.x, dir.y), 1, 1e-9) && power > 0.5 && power <= 1, `${k}: the aim is not a unit line at goal with a power`);
  // it points where it says on the goal line
  const tx = ball.x + dir.x * (ball.y / -dir.y);
  check(near(tx, airTapAimX(-0.5), 1e-6), `${k}: the aim does not reach its spot on the goal line`);
}

// 2.
for (const k of kinds) {
  for (const a of [30, 60, 90]) {
    const W = airTapCleanR(k, a), R0 = airCentreR(a);
    check(W > AIR_TAP_POST_CX - 0.15 && W < 1, `${k} at Aerial ${a}: the clean band (${W}) is not about the post's width`);
    for (const cx of [0, 0.3, -0.5, W * 0.99, -W * 0.99]) check(Math.abs(airTapContactCx(k, cx, a)) < R0, `${k} at Aerial ${a}: a tap at ${cx} inside the band glances`);
    check(airTapContactCx(k, 1, a) > 0.99 && airTapContactCx(k, -1, a) < -0.99, `${k} at Aerial ${a}: the very edge is not the edge`);
    check(airTapContactCx(k, (W + 1) / 2, a) > R0, `${k} at Aerial ${a}: past the band does not glance`);
  }
  check(airTapCleanR(k, 30) < airTapCleanR(k, 60) && airTapCleanR(k, 60) < airTapCleanR(k, 90), `${k}: the band does not grow with Aerial`);
  const late = airTapStrike(k, { x: CX + 3, y: 10 }, { cx: 0.8, cy: 0.55, lift: 1, late: true }, 60);
  check(late.contact.cx === 0.8 && late.contact.cy === 0.55, `${k}: a late touch's contact was changed`);
  const tx = CX + 3 + late.aim.dir.x * (10 / -late.aim.dir.y);
  check(near(tx, CX, 1e-6), `${k}: a late touch does not go at the middle`);
}

// 3.
{
  const clean = airTapStrike("header", { x: CX, y: 9 }, { cx: -0.7, cy: -0.35, lift: 0.95 }, 60);
  const r = airContactRead({ kind: "header", lift: 0.95, cx: clean.contact.cx, cy: clean.contact.cy, aerial: 60 });
  check(r.good && r.turnDeg === 0, `a clean header toward the post reads ${r.label} (turn ${r.turnDeg})`);
  const edge = airTapStrike("header", { x: CX, y: 9 }, { cx: -1, cy: 0, lift: 0.95 }, 60);
  const re = airContactRead({ kind: "header", lift: 0.95, cx: edge.contact.cx, cy: edge.contact.cy, aerial: 60 });
  check(!re.good && re.label === "GLANCED" && re.turnDeg > 0, `the very left edge reads ${re.label}, turn ${re.turnDeg} (want GLANCED, to the right)`);
  const v = airTapStrike("volley", { x: CX, y: 12 }, { cx: 0.6, cy: -0.1, lift: 0.55 }, 60);
  const rv = airContactRead({ kind: "volley", lift: 0.55, cx: v.contact.cx, cy: v.contact.cy, aerial: 60 });
  check(rv.good, `a clean volley toward the post reads ${rv.label}`);
}

// 4.
const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
check(/if \(phaseRef\.current === "aim" && isAirKind\(scenarioRef\.current\.kind\) && airTapOn\(\)\) return;/.test(cm), "a header/volley can still be dragged");
check(/AIR_TAP_OPEN_NO_LEAD_S\) && airTapOpenedRef\.current !== sc\) \{[\s\S]{0,200}setAim\(airTapAim\([\s\S]{0,200}setPhase\("contact"\)/.test(cm), "the ball screen does not open by itself with the tap's aim");
check(/airTapStrike\(sc\.kind as AirKind, sc\.ball, c, airAerialNow\(\)\)[\s\S]{0,120}handleContact\(\{ \.\.\.st\.contact, aim: st\.aim \}\)/.test(cm), "the tap does not aim the strike");
check(/: tapped\.aim \?\? aim;/.test(cm), "handleContact ignores the tap's aim");
check(!/AirPick|airPick|AIR_CAM|airCamAt/.test(cm), "the tap-the-goal game or its close camera is still in the match");
check(/if \(!\(isAirKind\(sc\.kind\) && airTapOn\(\)\)\) \{\s*const vpNow/.test(cm), "your man still jumps clear of an arrow at the hand-over");
check(/const sb = shownBallRef\.current;\s*trailRef\.current\.push\(sb \?/.test(cm), "the trail does not follow the ball as drawn");
check(/aimFromTap=\{isAirKind\(scenarioRef\.current\.kind\) && airTapOn\(\)\}/.test(cm), "the ball screen is not told the tap aims");
const cb = readFileSync(new URL("../../components/star/ContactBall.tsx", import.meta.url), "utf8");
check(/data-air-band/.test(cb) && /aimFromTap \? airTapContactCx\(kind, cx, aerial\) : cx/.test(cb), "ContactBall does not draw the band or read the tap's side as aim");

if (problems.length) {
  console.log(`airTap FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`airTap: band header ${[30, 60, 90].map((a) => airTapCleanR("header", a).toFixed(2)).join("/")}, volley ${[30, 60, 90].map((a) => airTapCleanR("volley", a).toFixed(2)).join("/")}; post at ${AIR_TAP_POST_CX} of the radius — ok`);
