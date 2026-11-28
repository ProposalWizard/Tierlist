/**
 * The four test-page ways to hit a header or volley (lib/star/airControl.ts).
 *   npx tsx tests/star/airControl.mts
 */
import { airControlMode, airStrike, airSweetS, beatStrike, ghostStrike, preaimStrike, setTestAirControl, swipeStrike, timingWord } from "../../lib/star/airControl";
import { airContactRead } from "../../lib/star/airborneChance";
import { CX, GOAL_W } from "../../lib/star/pitch";

let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails++; };
const ball = { x: CX + 2, y: 6 };

check(airControlMode() === "screen", "the game plays today's ball screen unless the test page sets another");
setTestAirControl("ghost"); check(airControlMode() === "ghost", "the test page can set one");
setTestAirControl(null); check(airControlMode() === "screen", "…and clearing it puts the ball screen back");

check(airSweetS(30) < airSweetS(60) && airSweetS(60) < airSweetS(90), "Aerial widens the clean window");
check(timingWord(0) === "PERFECT" && timingWord(-0.25) === "EARLY" && timingWord(0.25) === "LATE" && timingWord(0.6) === "MISSED IT", "the four timing words");

// A clean header nods down; early loops up; late glances.
const read = (o: ReturnType<typeof airStrike>, kind: "header" | "volley") => airContactRead({ kind, lift: o.contact.lift, cx: o.contact.cx, cy: o.contact.cy, tech: 60, aerial: 60 });
const base = { kind: "header" as const, ball, aimX: CX - 2, power: 0.9, aerial: 60 };
check(read(airStrike({ ...base, dt: 0 }), "header").good, "a header on time is clean");
check(read(airStrike({ ...base, dt: -0.3 }), "header").label === "LOOPED UP", "early: under it, looped up");
check(read(airStrike({ ...base, dt: 0.3 }), "header").label === "GLANCED", "late: off its side, glanced");
const vb = { ...base, kind: "volley" as const };
check(read(airStrike({ ...vb, dt: 0 }), "volley").good, "a volley on time is sweet");
check(read(airStrike({ ...vb, dt: -0.3 }), "volley").label === "MISTIMED" && read(airStrike({ ...vb, dt: 0.3 }), "volley").label === "MISTIMED", "a volley early or late is mistimed");
check(airStrike({ ...base, dt: 1 }).contact.late === true, "far off: the ball screen's own late touch");

// Each idea's aim goes where its input says.
check(ghostStrike("header", ball, { dx: 40, dy: 120 }, 0).aimX < CX && ghostStrike("header", ball, { dx: -40, dy: 120 }, 0).aimX > CX, "ghost: drag back-left aims right (the ground shot's arrow)");
check(ghostStrike("volley", ball, { dx: 0, dy: 160 }, 0).aim.power > ghostStrike("volley", ball, { dx: 0, dy: 30 }, 0).aim.power, "ghost: a longer drag is harder");
check(preaimStrike("header", ball, -1, 0.2, 0).aimX < CX - GOAL_W / 2 + 0.5, "pick the spot: the left post");
check(swipeStrike("volley", ball, 0.3, 1500, 0, 0).aimX > CX && swipeStrike("volley", ball, 2000 / 1e9, 2400, 0, 0).aim.power > swipeStrike("volley", ball, 0, 400, 0, 0).aim.power, "swipe: right aims right, faster is harder");
check(read(beatStrike("header", ball, 0.1, 0.4, 0, 0), "header").label !== "FIRM HEADER" || beatStrike("header", ball, 0.1, 0.4, 0, 0).word !== "PERFECT", "three-beat: taking off late costs the timing");
check(beatStrike("header", ball, -0.5, 0.4, 0.5, 0).word === "PERFECT", "three-beat: up in time and released on the line is perfect");

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log("\nall passed");
