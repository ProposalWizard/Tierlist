/**
 * TEST PAGES PLAY LIKE THE REAL GAME (Leo, 1 Nov 2026: "make sure everything
 * is always up to date with the real game … I dont wanna be starting a new
 * career … and seeing old gameplay"). Pins the places that drifted:
 *  1. A free kick on any picture gets the MATCH keeper, unless it is marked as
 *     the trial's or training's (their easier keeper is on purpose).
 *  2. A test career has every stat the match reads (not just power/technique).
 *  3. With Full highlights rebuild Off, a test area's build-ups are the career's.
 * Run: npx tsx tests/star/testPagesMatchGame.mts
 */
import { buildScenario, initDefenders, launch } from "../../lib/star/canvasEngine";
import { strikeKind, markDrillFreeKick, isDrillFreeKick } from "../../lib/star/kindRules";
import { FREE_KICK } from "../../lib/star/kindRules/freeKick";
import { buildTestCareer } from "../../lib/star/engineProfile";
import { DEFAULT_PLAY_SETTINGS } from "../../lib/star/playArea";
import { testAreaBuildUp } from "../../lib/star/fhr/builders";
import { careerBuildUp } from "../../lib/star/leadInGen";
import { CX } from "../../lib/star/pitch";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 1. Free kicks: a page's own picture → match rules; a marked trial/training picture → drill.
const decideFor = (marked: boolean) => {
  const r = mulberry32(5);
  const sc = buildScenario("free_kick", r, 88, 60, 55);
  initDefenders(sc, r);
  if (marked) markDrillFreeKick(sc);
  const ball = launch(sc, { x: CX - sc.ball.x, y: -sc.ball.y }, 0.8, { cx: 0.3, cy: 0.4 }, { power: 70, technique: 70 }, r);
  return { kd: strikeKind(sc, ball, mulberry32(9), { keeperStrength: 88, power: 70, technique: 70 }), sc };
};
const page = decideFor(false), drill = decideFor(true);
ok(page.kd?.data.drill === false && !isDrillFreeKick(page.sc), "a test page's own free kick gets the match keeper (and the top-corner rule)");
ok(drill.kd?.data.drill === true && isDrillFreeKick(drill.sc), "the trial's / training's marked free kick keeps its easier keeper");
ok(FREE_KICK.corner === true, "the match free kick has the top-corner rule");

// 2. A test career reads the Play Area for every stat the match uses.
const built = buildTestCareer({ ...DEFAULT_PLAY_SETTINGS, power: 88, technique: 77 }, 3);
const sk = built?.career.skills;
ok(!!sk && sk.power === 88 && sk.technique === 77 && sk.pace === 88 && sk.vision === 77 && sk.freeKick === 77 && sk.aerial === 83,
  `test career stats: ${JSON.stringify(sk && { power: sk.power, technique: sk.technique, pace: sk.pace, vision: sk.vision, freeKick: sk.freeKick, aerial: sk.aerial })}`);

// 3. Build-ups with the rebuild switch Off (the default in node): the test area's are the career's.
const r = mulberry32(11);
const sc = buildScenario("one_on_one", r, 62, 60, 55);
const moment = { opening: false, fresh: true, seed: 7, frame: { x1: 0, x2: 68, y1: 0, y2: 40 }, minute: 30, scoreDiff: 0 };
const a = testAreaBuildUp(() => ({}) as never)(JSON.parse(JSON.stringify(sc)), moment as never);
const b = careerBuildUp(JSON.parse(JSON.stringify(sc)), moment as never);
ok((a === null) === (b === null) && (!a || !b || Math.abs(a.durS - b.durS) < 1e-9), `test area build-up = career build-up (${a ? a.durS.toFixed(2) : "none"} / ${b ? b.durS.toFixed(2) : "none"})`);

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("all passed");
