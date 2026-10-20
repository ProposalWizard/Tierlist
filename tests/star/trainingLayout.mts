/**
 * DRAG A TRAINING LEVEL ABOUT (lib/star/trainingLayout.ts) — Harry, 20 Oct
 * 2026: "the training editor should be drag and drop like the gallery".
 *
 * Checks that a drag on the Training levels page's picture:
 *  1. changes the right numbers (the ball sets Distance / Off centre; a cone
 *     sets the gap; a Pace man moves only across his line);
 *  2. survives Save and Commit (sanitizeLevel keeps it, the file text keeps it);
 *  3. is what the drill plays (the same spots the drill builds from);
 *  4. comes off with Shuffle / Level's own, and moves with the ball when a
 *     career eases a Power level.
 *
 * Run: npx tsx tests/star/trainingLayout.mts
 */
import { DRILL_LAYOUTS, levelLayout, moveHandle, paceMen } from "../../lib/star/trainingLayout";
import {
  levelConfig, sanitizeLevel, withoutPositions, hasPositions, mergeTrainingFile, tableFromFile, fileText, defaultTable,
  easePowerLevel, type PowerLevel, type TechniqueLevel, type FreeKickLevel, type PaceLevel,
} from "../../lib/star/trainingLevelData";
import { strikeSpot, powerManSpots, placedMen, conePositions, techniqueBallSpot, wallSpots } from "../../lib/star/trainingDrills";
import { newRun } from "../../lib/star/firstPersonDribble";
import { mulberry32 } from "../../lib/star/season";
import { CX } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); console.log(`${ok ? "  ok " : "FAIL "} ${what}`); };
const near = (a: number, b: number, t = 0.02) => Math.abs(a - b) <= t;

check(!!DRILL_LAYOUTS.power && !!DRILL_LAYOUTS.technique && !!DRILL_LAYOUTS.freeKick && !!DRILL_LAYOUTS.pace, "Power, Technique, Free kick and Pace can be dragged");
check(!DRILL_LAYOUTS.vision && levelLayout("vision", levelConfig("vision", 5, {}), 5) === null, "Vision has no picture to drag yet (being rebuilt) — and asking for one is harmless");

// ── Power ──
{
  const row = levelConfig("power", 20, {});
  const lay = levelLayout("power", row, 20)!;
  const ball = strikeSpot(row.distance, row.offset);
  const ownMen = powerManSpots(ball, row.blockers);
  check(lay.handles.length === 1 + row.blockers, `power 20: the ball and ${row.blockers} men to grab`);
  check(lay.handles.slice(1).every((h, i) => near(h.at.x, ownMen[i].x) && near(h.at.y, ownMen[i].y)), "power: the men stand where the drill puts them");
  const moved = moveHandle("power", row, 20, "ball", { x: CX - 5, y: 30 }) as PowerLevel;
  check(moved.distance === 30 && moved.offset === -5, `dragging the ball sets Distance 30, Off centre -5 (${moved.distance}, ${moved.offset})`);
  check(!hasPositions(moved), "dragging only the ball places nobody by hand");
  const far = moveHandle("power", row, 20, "ball", { x: CX, y: 99 }) as PowerLevel;
  check(far.distance === 40, "the ball can't be dragged past the Distance slider's end (40 m)");
  const man = moveHandle("power", row, 20, "man-1", { x: CX + 6, y: 12 }) as PowerLevel;
  check(man.men?.length === row.blockers && near(man.men![1].x, CX + 6) && near(man.men![1].y, 12), "dragging a man pins every man, with this one where he was dropped");
  const played = placedMen(powerManSpots(strikeSpot(man.distance, man.offset), man.blockers), man.men, man.blockers);
  check(near(played[1].x, CX + 6) && near(played[0].x, ownMen[0].x), "the drill plays the dragged man where he was dropped, the others unmoved");
  const saved = sanitizeLevel("power", 20, JSON.parse(JSON.stringify(man)));
  check(JSON.stringify(saved.men) === JSON.stringify(man.men), "Save keeps the dragged men");
  const merged = tableFromFile(JSON.parse(mergeTrainingFile(fileText(defaultTable()), [{ skill: "power", level: 20, config: man }]).text));
  check(JSON.stringify(merged.power[19].men) === JSON.stringify(man.men), "Commit writes the dragged men into the levels file");
  check(!hasPositions(withoutPositions(man)), "Shuffle / Level's own takes the dragged men off");
  const eased = easePowerLevel(20, 55, n => (n === 20 ? man : levelConfig("power", n, {})));
  check(eased.distance < man.distance && !!eased.men && eased.men[1].y < man.men![1].y, "a career's eased level carries the dragged men in with the ball");
  const broken = sanitizeLevel("power", 20, { ...row, men: [{ x: "a", y: 3 }, { x: 999, y: -5 }, null] });
  check(broken.men?.length === 1 && broken.men[0].x <= 67.5 && broken.men[0].y >= 0.5, "a broken dragged spot is dropped or kept on the pitch");
}

// ── Free kick ──
{
  const row = levelConfig("freeKick", 22, {}) as FreeKickLevel;
  const lay = levelLayout("freeKick", row, 22)!;
  const wall = wallSpots(strikeSpot(row.distance, row.offset), row.wall);
  check(lay.handles.slice(1).every((h, i) => near(h.at.x, wall[i].x)), "free kick: the wall stands where the drill puts it");
  const moved = moveHandle("freeKick", row, 22, "man-0", { x: 20, y: 18 }) as FreeKickLevel;
  check(moved.men?.length === row.wall && near(moved.men![0].x, 20), "dragging a man out of the wall pins him there");
}

// ── Technique ──
{
  const row = levelConfig("technique", 25, {}) as TechniqueLevel;
  const ball = techniqueBallSpot(row);
  const gate = conePositions(ball, row);
  const left = moveHandle("technique", row, 25, "coneL", { x: gate.left.x - 2, y: gate.left.y }) as TechniqueLevel;
  check(near(left.gateWidth, row.gateWidth + 2, 0.05), `dragging the left cone out 2 m widens the gap 2 m (${row.gateWidth} → ${left.gateWidth})`);
  const g2 = conePositions(techniqueBallSpot(left), left);
  check(near(g2.right.x, gate.right.x, 0.05), "…and the right cone stays put");
  const b = moveHandle("technique", row, 25, "ball", { x: ball.x + 3, y: ball.y + 2 }) as TechniqueLevel;
  const g3 = conePositions(techniqueBallSpot(b), b);
  check(near(g3.centre.x, gate.centre.x, 0.05) && near(g3.centre.y, gate.centre.y, 0.05), "dragging the ball leaves the gate where it stands");
  check(!!b.ball && near(b.gateDistance, row.gateDistance + 2, 0.05), "…and its distance grows by the 2 m the ball went back");
  const whole = moveHandle("technique", row, 25, "gate", { x: gate.centre.x - 4, y: gate.centre.y }) as TechniqueLevel;
  check(near(whole.gateWidth, row.gateWidth) && near(conePositions(techniqueBallSpot(whole), whole).centre.x, gate.centre.x - 4, 0.05), "dragging the dot moves the whole gate, same gap");
}

// ── Pace ──
{
  const row = levelConfig("pace", 8, {}) as PaceLevel;
  const men = paceMen(row, 8);
  const lay = levelLayout("pace", row, 8)!;
  check(lay.handles.length === row.chasers && lay.handles.every(h => h.axis === "x"), "pace: every man can be grabbed, across his line only");
  const moved = moveHandle("pace", row, 8, "w0-1", { x: CX + 7, y: 0 }) as PaceLevel;
  const after = paceMen(moved, 8);
  const m = after.find(a => a.wave === 0 && a.index === 1)!;
  check(near(m.x, CX + 7) && near(m.y, men.find(a => a.wave === 0 && a.index === 1)!.y), "a dragged Pace man moves across, never up or down");
  check(after.filter(a => !(a.wave === 0 && a.index === 1)).every((a, i) => near(a.x, men.filter(b => !(b.wave === 0 && b.index === 1))[i].x)), "…and nobody else moves");
  // The run itself stands him there (the same newRun the drill plays).
  const run = newRun({ pace: row.runPace, oppStrength: row.oppStrength, waveSizes: [3, 1], rng: mulberry32(1), lanes: [[0, 7, -7]] });
  check(near(run.defenders[1].x, CX + 7) && near(run.defenders[2].x, CX - 7), "the run puts placed men on their lanes");
  const plain = newRun({ pace: row.runPace, oppStrength: row.oppStrength, waveSizes: [3, 1], rng: mulberry32(1) });
  check(run.defenders.map(d => d.commitD).join() === plain.defenders.map(d => d.commitD).join(), "placing men changes nothing else about the run");
  const wide = sanitizeLevel("pace", 8, { ...row, lanes: [[30, -30], ["x"]] });
  check(JSON.stringify(wide.lanes) === JSON.stringify([[9, -9], []]), "a dragged lane is kept inside the corridor");
}

if (problems.length) {
  console.log(`\nFAIL — ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("\nPASS");
