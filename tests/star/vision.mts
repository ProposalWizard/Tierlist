/**
 * VISION — "WHO SHOULD I PASS TO?" (lib/star/visionRound.ts; Harry, 20 Oct
 * 2026: "real scenarios … have someone offside … early on you tap, then you
 * actually have to kick the ball").
 *
 * Checks:
 *  1. the data: every real pass and every drawn chance reads, and the pass
 *     checks (the engine's own "does a good ball get there") cover them;
 *  2. the answers: in every picture a level can show, the right man is
 *     onside by the engine's law, a good ball to him gets there on the engine,
 *     nobody stands in his path, and every other good ball is worse;
 *  3. the traps, on the real engine: a kick to the offside man is OFFSIDE,
 *     a kick into a cut lane is cut out, and a kick to the right man finds
 *     him;
 *  4. the levels: three different pictures each, tap then kick, the window
 *     down to 0.3 s, old saved rows can't break anything, and a player
 *     climbing 1 → 30 seldom meets the same picture twice;
 *  5. where a man is on the glass: the drill's sum turns back exactly, and a
 *     tap on a man's shirt picks him;
 *  6. the curve: the modelled good player (tests/star/visionBot.ts) passes
 *     level 1 nearly always and level 30 well under half the time, and the
 *     climb in between only goes one way (over five-level stretches).
 *
 * Run: npx tsx tests/star/vision.mts
 */
import { readFileSync } from "node:fs";
import {
  setVisionMoments, setVisionChecks, realBases, drawnBases, judgeMen, visionCandidates, visionLevelPictures, visionAsk,
  visionScenario, judgeTap, judgeKick, passReach, camToBox, boxToCam, tapPick, REACH_ANSWER, LANE_CUT_M,
  type VisionPicture, type FrameCam,
} from "../../lib/star/visionRound";
import { offsideSnapshot } from "../../lib/star/canvasEngine";
import { tiltFor } from "../../lib/star/cameraTilt";
import {
  defaultLevel, levelConfig, committedLevel, sanitizeLevel, levelSeedOf, levelId, isOldVisionRow, LEVEL_FIELDS,
  VISION_KICK_FROM, VISION_TOP_FROM, VISION_TOP_WINDOW,
} from "../../lib/star/trainingLevelData";
import { TRAINING_LEVELS } from "../../lib/star/trainingLevels";
import { mulberry32 } from "../../lib/star/season";
import { botTry, playKick, passPowerFor, GOOD_PLAYER } from "./visionBot";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

setVisionMoments(JSON.parse(readFileSync(new URL("../../lib/star/data/visionMoments.json", import.meta.url), "utf8")));
setVisionChecks(JSON.parse(readFileSync(new URL("../../lib/star/data/visionChecks.json", import.meta.url), "utf8")));

// ── 1. The data ────────────────────────────────────────────────────────────
const real = realBases(), drawn = drawnBases();
check(real.length >= 150, `there are plenty of real passes (${real.length})`);
check(drawn.length >= 20, `the team's drawn passing chances are read (${drawn.length})`);
for (const b of [...real, ...drawn]) {
  check(b.answer >= 0 && b.answer < b.mates.length, `${b.id}: the right man is one of the team-mates`);
  check(b.mates.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y)) && b.opps.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y)), `${b.id}: everyone stands somewhere`);
  check(passReach(b.id, b.answer) !== undefined, `${b.id}: the engine has checked the passes in it`);
}
setVisionMoments({ moments: [{ id: "junk" }, null] });
check(realBases().length === 0, "a broken real-moments file gives no pictures, never a crash");
setVisionMoments(JSON.parse(readFileSync(new URL("../../lib/star/data/visionMoments.json", import.meta.url), "utf8")));

// ── 2. The answers ─────────────────────────────────────────────────────────
const asks = [
  { options: 2, traps: 0, margin: 0.4, real: false }, { options: 2, traps: 0, margin: 0.4, real: true },
  { options: 4, traps: 1, margin: 0.25, real: true }, { options: 5, traps: 2, margin: 0.15, real: true, offside: true },
  { options: 6, traps: 3, margin: 0.03, real: true },
];
let pictures = 0, offsidePics = 0;
const allPics: VisionPicture[] = [];
for (const ask of asks) {
  const list = visionCandidates(ask);
  check(list.length >= 3, `${JSON.stringify(ask)}: enough pictures for a level's three tries (${list.length})`);
  for (const p of list) {
    pictures++;
    allPics.push(p);
    const A = p.options[p.best];
    check(A.onside && A.lineGap >= 0.6, `${p.id}: the right man is onside by a clear yard`);
    check(A.trap === null, `${p.id}: the right man is no trap`);
    check(A.reach === undefined ? A.lane >= LANE_CUT_M : A.reach >= REACH_ANSWER, `${p.id}: a good ball to the right man gets there`);
    for (let i = 0; i < p.options.length; i++) {
      if (i === p.best) continue;
      const o = p.options[i];
      if (!o.trap) check(o.score < A.score, `${p.id}: man ${i} is a lesser ball than the right one`);
      // Nobody stands in the right ball's path (he would take it himself).
      const len = Math.hypot(A.x - p.ball.x, A.y - p.ball.y);
      const t = ((o.x - p.ball.x) * (A.x - p.ball.x) + (o.y - p.ball.y) * (A.y - p.ball.y)) / (len * len);
      const px = p.ball.x + (A.x - p.ball.x) * Math.max(0, Math.min(1, t)), py = p.ball.y + (A.y - p.ball.y) * Math.max(0, Math.min(1, t));
      check(!(t > 0.05 && t < 1.1 && Math.hypot(o.x - px, o.y - py) < 3), `${p.id}: man ${i} is clear of the right ball's path`);
    }
    // The picture is judged as shown, by the engine's own law.
    const again = judgeMen(p.kind, p.ball, p.options, p.defenders, p.keeper, p.options.map((o) => o.reach));
    check(again.every((o, i) => o.onside === p.options[i].onside && o.trap === p.options[i].trap), `${p.id}: judging it again gives the same answer`);
    if (p.options.some((o) => o.trap === "offside")) offsidePics++;
  }
}
check(offsidePics >= 4, `some pictures have a man stood offside (${offsidePics})`);

// ── 3. The traps, on the real engine ──────────────────────────────────────
function perfectKick(p: VisionPicture, i: number, seed: number) {
  const m = p.options[i];
  const d = Math.hypot(m.x - p.ball.x, m.y - p.ball.y);
  return playKick(p, m, passPowerFor(d), { cx: 0, cy: 0 }, GOOD_PLAYER.skills, seed, { aimedAt: i });
}
const uniq = [...new Map(allPics.map((p) => [p.id, p])).values()];
{
  // Offside: the law flags him, a tap on him says so, and a kick to him is given offside.
  let flagged = 0, kicked = 0, called = 0;
  for (const p of uniq) {
    const i = p.options.findIndex((o) => o.trap === "offside");
    if (i < 0) continue;
    const sc = visionScenario(p, 1);
    offsideSnapshot(sc, sc.ball);
    if (sc.secondaryRunners[i].offside) flagged++;
    check(judgeTap(p, i).result === "offside" && judgeTap(p, i).word === "OFFSIDE", `${p.id}: a tap on the offside man says OFFSIDE`);
    for (let s = 0; s < 6; s++) { kicked++; if (perfectKick(p, i, 100 + s).result === "offside") called++; }
  }
  check(flagged > 0 && flagged === uniq.filter((p) => p.options.some((o) => o.trap === "offside")).length, `the engine's law flags every offside trap (${flagged})`);
  check(called >= kicked * 0.8, `a pass played to the offside man ends OFFSIDE (the engine flags him as it is struck) (${called}/${kicked})`);
  console.log(`  offside: ${flagged} pictures with a man stood offside; ${called} of ${kicked} passes played to him ended OFFSIDE`);
}
{
  // The right man: a good pass finds him on the engine.
  let ok = 0, n = 0;
  for (const p of uniq.slice(0, 60)) for (let s = 0; s < 4; s++) { n++; if (perfectKick(p, p.best, 7 + s).result === "right") ok++; }
  check(ok >= n * 0.85, `a good pass to the right man reaches him on the engine (${ok}/${n})`);
  // A cut lane: a pass into it is cut out (or found by nobody).
  let cut = 0, m = 0;
  for (const p of uniq) {
    const i = p.options.findIndex((o) => o.trap === "lane");
    if (i < 0 || m >= 120) continue;
    for (let s = 0; s < 3; s++) { m++; const v = perfectKick(p, i, 31 + s); if (v.result !== "right" && v.result !== "wrong") cut++; }
  }
  check(cut >= m * 0.6, `a pass into a cut lane is cut out on the engine (${cut}/${m})`);
  console.log(`  right man found ${ok}/${n}; passes into a cut lane lost ${cut}/${m}`);
}
{
  // The words.
  const p = uniq[0];
  check(judgeTap(p, p.best).ok && judgeTap(p, p.best).word === "RIGHT MAN", "the right man says RIGHT MAN");
  check(!judgeTap(p, null).ok && judgeTap(p, null).word === "TOO SLOW", "no answer in time says TOO SLOW");
  check(judgeTap(p, null).line.length > 0 && judgeTap(p, null).line.length <= 90, "the line under it is one short line");
  const sc = visionScenario(p, 1);
  check(judgeKick(p, sc, null) === null, "a kick still going says nothing yet");
  check(judgeKick(p, sc, "tackled")?.result === "cut", "a pass the engine cut out says CUT OUT");
  sc.receivedBy = sc.secondaryRunners[p.best];
  check(judgeKick(p, sc, null)?.result === "right", "a pass the right man took says RIGHT MAN");
  // A man the data only knows by his shirt number is called by it.
  const numbered = { ...p, options: p.options.map((o, i) => ({ ...o, name: i === p.best ? "No. 65" : "Jay O'Shea" })) };
  check(judgeTap(numbered, null).line.includes("No. 65"), `a shirt number reads "No. 65" (${judgeTap(numbered, null).line})`);
}

// ── 4. The levels ──────────────────────────────────────────────────────────
/** The committed levels' asks and seeds, as the game reads them. */
const levelOf = (n: number) => {
  const c = levelConfig("vision", n, {});
  return { ask: visionAsk(c), seed: levelSeedOf("vision", n, c) };
};
const levelPics = (n: number) => visionLevelPictures(n, levelOf, 3);
const shownAt = new Map<string, number[]>();
for (let n = 1; n <= TRAINING_LEVELS; n++) {
  const cfg = levelConfig("vision", n, {});
  check(cfg.kick === n >= VISION_KICK_FROM, `level ${n}: ${n >= VISION_KICK_FROM ? "kick" : "tap"}`);
  const pics = levelPics(n);
  check(pics.length === 3, `level ${n} has a picture for each try`);
  const passes = new Set(pics.map((p) => p.id.replace(/b$/, "")));
  check(passes.size === 3, `level ${n}: three different pictures (${pics.map((p) => p.id).join(", ")})`);
  for (const p of passes) shownAt.set(p, [...(shownAt.get(p) ?? []), n]);
  const again = levelPics(n);
  check(JSON.stringify(again.map((p) => p.id)) === JSON.stringify(pics.map((p) => p.id)), `level ${n} plays the same pictures every time`);
  if (cfg.offside) check(pics.some((p) => p.options.some((o) => o.trap === "offside")), `level ${n} asks for someone offside and has him`);
  for (const f of LEVEL_FIELDS.vision) {
    if (f.toggle) continue;
    const v = Number((cfg as unknown as Record<string, number>)[f.key]);
    check(v >= f.min && v <= f.max, `vision ${n}: ${f.key} ${v} inside the editor's range`);
  }
}
{
  // Climbing 1 → 30 (90 tries): each level avoids what the levels before it
  // showed. Measured 20 Oct 2026: 45 different passes, an ordinary one on at
  // most 3 levels (32 passes and up to 7 levels before). The offside ones come
  // back more: 5 readable real ones for 13 offside levels.
  const offsidePass = new Set(Array.from({ length: TRAINING_LEVELS }, (_, i) => levelPics(i + 1)).flat()
    .filter((p) => p.options.some((o) => o.trap === "offside")).map((p) => p.id.replace(/b$/, "")));
  const ordinary = [...shownAt.entries()].filter(([id]) => !offsidePass.has(id));
  const worst = ordinary.reduce((m, [, lv]) => Math.max(m, lv.length), 0);
  console.log(`  climbing 1 → 30: ${shownAt.size} different pictures in 90 tries; an ordinary one on at most ${worst} levels`);
  check(shownAt.size >= 40, `climbing 1 → 30 shows at least 40 different pictures (${shownAt.size})`);
  check(worst <= 3, `an ordinary picture comes back on at most 3 levels (${worst})`);
  // A level edited in the editor builds on the levels below it as committed.
  const edited = (n: number) => n === 12 ? { ask: { ...levelOf(12).ask, margin: 0.2 }, seed: levelOf(12).seed } : levelOf(n);
  const before = levelPics(11).map((p) => p.id).join();
  visionLevelPictures(12, edited, 3);
  check(levelPics(11).map((p) => p.id).join() === before, "playing an edited level never changes the levels below it");
}
check(levelConfig("vision", VISION_TOP_FROM, {}).window === VISION_TOP_WINDOW && levelConfig("vision", 30, {}).window === VISION_TOP_WINDOW,
  `from level ${VISION_TOP_FROM} the kick must start inside ${VISION_TOP_WINDOW}s`);
{
  // The window only shrinks, within the tap levels and within the kick levels.
  for (let n = 2; n <= TRAINING_LEVELS; n++) {
    if (n === VISION_KICK_FROM) continue;
    check(levelConfig("vision", n, {}).window <= levelConfig("vision", n - 1, {}).window, `vision ${n}: the window never grows`);
  }
  // An old saved Vision row (the 2D drill's numbers) can't break or bend a level.
  const old = { options: 11, window: 0.85, margin: 0.3, markers: 13, offsideShare: 0.55, lineGap: 0.4, tapRadius: 2.2 };
  check(isOldVisionRow(old) && !isOldVisionRow(committedLevel("vision", 30)), "an old Vision row is told apart from a new one");
  check(JSON.stringify(levelConfig("vision", 30, { [levelId("vision", 30)]: old })) === JSON.stringify(committedLevel("vision", 30)),
    "an old saved Vision edit plays the committed level");
  check(JSON.stringify(sanitizeLevel("vision", 12, old)) === JSON.stringify(defaultLevel("vision", 12)), "an old Vision row in a file reads as the built-in row");
  check(levelConfig("vision", 30, { [levelId("vision", 30)]: { window: 0.5 } }).window === 0.5, "a new partial edit still plays");
}

// ── 5. Where a man is on the glass ─────────────────────────────────────────
{
  const cam: FrameCam = { viewport: { x1: 15, x2: 53, y1: -4, y2: 64 }, facing: "up", tilt: tiltFor(20, 366, 660), W: 366, H: 660 };
  let worst = 0;
  for (const p of [{ x: 20, y: 5 }, { x: 34, y: 30 }, { x: 50, y: 60 }]) {
    const q = camToBox(cam, p), back = boxToCam(cam, q.x, q.y);
    worst = Math.max(worst, Math.hypot(back.x - p.x, back.y - p.y));
  }
  check(worst < 1e-6, `the glass sum turns back exactly (${worst.toExponential(1)} m)`);
  const men = [{ x: 25, y: 20 }, { x: 40, y: 22 }];
  const at = camToBox(cam, men[1]);
  check(tapPick(cam, men, at.x, at.y - 15) === 1, "a tap on his shirt picks him");
  check(tapPick(cam, men, at.x + 120, at.y) === -1, "a tap on the grass picks nobody");
  const flat: FrameCam = { ...cam, tilt: null, facing: "right" };
  const q = camToBox(flat, men[0]), back = boxToCam(flat, q.x, q.y);
  check(Math.hypot(back.x - men[0].x, back.y - men[0].y) < 1e-9, "a side-on camera turns back too");
}

// ── 6. The curve ───────────────────────────────────────────────────────────
function levelRate(n: number, goes: number): { first: number; mean: number } {
  const cfg = levelConfig("vision", n, {});
  const seed = levelSeedOf("vision", n, cfg);
  const pics = levelPics(n);
  const rates = pics.map((p, t) => {
    const r = mulberry32((seed * 31 + t * 977) >>> 0);
    let ok = 0;
    for (let g = 0; g < goes; g++) if (botTry(p, cfg, GOOD_PLAYER, r, (seed + t * 7919 + g * 104729) >>> 0).verdict.ok) ok++;
    return ok / goes;
  });
  return { first: rates[0], mean: rates.reduce((a, b) => a + b, 0) / rates.length };
}
{
  const at = [1, 10, 20, 25, 30].map((n) => ({ n, ...levelRate(n, 160) }));
  console.log("  modelled good player, a try at the level (first picture / mean of its three):");
  console.log("  " + at.map((a) => `L${a.n} ${(a.first * 100).toFixed(0)}% / ${(a.mean * 100).toFixed(0)}%`).join("  ·  "));
  const get = (n: number) => at.find((a) => a.n === n)!;
  check(get(1).first > 0.9 && get(1).mean > 0.9, "level 1 is passed nearly every time");
  check(get(30).first < 0.4 && get(30).mean < 0.36, "level 30 is clearly hard: well under half on a try");
  check(get(10).mean > get(20).mean && get(20).mean > get(30).mean, "harder from 10 to 20 to 30");
  // Over five-level stretches the climb only goes one way.
  const all = Array.from({ length: TRAINING_LEVELS }, (_, i) => levelRate(i + 1, 60).mean);
  const avg = (a: number, b: number) => all.slice(a - 1, b).reduce((s, v) => s + v, 0) / (b - a + 1);
  const blocks = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30]].map(([a, b]) => avg(a, b));
  console.log("  five-level stretches: " + blocks.map((b) => `${(b * 100).toFixed(0)}%`).join(" → "));
  for (let i = 1; i < blocks.length; i++) check(blocks[i] <= blocks[i - 1] + 0.02, `stretch ${i + 1} is no easier than stretch ${i}`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log(`PASS — ${pictures} pictures checked: the right man is right on the engine, offside is offside, and the levels climb`);
