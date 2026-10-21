/**
 * TRAINING LEVELS AS DATA (lib/star/trainingLevelData.ts) — Harry, 19 Oct
 * 2026: "training levels have no way of adapting them … the final training
 * of, say, vision isn't hard enough."
 *
 * Checks:
 *  1. the committed file has every level, and reads back as itself;
 *  2. levels 1-19 are still the old drills (nothing below the top moved);
 *     Vision has its own new curve (20 Oct 2026): tap, then kick;
 *  3. saved edits sit on top of the file, are kept inside the limits, and a
 *     broken one can never break a drill;
 *  4. a commit merge keeps every row it wasn't sent;
 *  5. the top end climbs: every number from 20 to 30 moves the hard way,
 *     (Vision's modelled player and its pictures on the real engine are in
 *     tests/star/vision.mts).
 *
 * Run: npx tsx tests/star/trainingLevelData.mts
 */
import { readFileSync } from "node:fs";
import {
  TRAINING_SKILLS, LEVEL_FIELDS, TOP_FROM, defaultLevel, defaultTable, tableFromFile, fileText,
  mergeTrainingFile, levelConfig, committedLevel, sanitizeLevel, easePowerLevel, levelId, parseLevelId,
  setTrainingOverlay, levelSeedOf, VISION_KICK_FROM, VISION_TOP_FROM, VISION_TOP_WINDOW,
} from "../../lib/star/trainingLevelData";
import { TRAINING_LEVELS, levelDifficulty, levelSeed } from "../../lib/star/trainingLevels";
import { techniqueDrill, freeKickDrill, paceDrill, powerDrillForLevel } from "../../lib/star/trainingDrills";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── 1. The committed file ──────────────────────────────────────────────────
const fileRaw = JSON.parse(readFileSync(new URL("../../lib/star/data/trainingLevels.json", import.meta.url), "utf8"));
for (const s of TRAINING_SKILLS) {
  const rows = fileRaw.levels?.[s];
  check(Array.isArray(rows) && rows.length === TRAINING_LEVELS, `the file has ${TRAINING_LEVELS} ${s} levels`);
  for (let n = 1; n <= TRAINING_LEVELS; n++) {
    const row = rows?.[n - 1];
    check(JSON.stringify(sanitizeLevel(s, n, row)) === JSON.stringify(row), `${s} ${n}: the file's row is already inside the limits`);
    check(JSON.stringify(committedLevel(s, n)) === JSON.stringify(row), `${s} ${n}: the game reads the file's row`);
  }
}
check(fileText(tableFromFile(fileRaw)) === readFileSync(new URL("../../lib/star/data/trainingLevels.json", import.meta.url), "utf8"),
  "the file is written in the stable form (a commit of an unchanged level changes nothing else)");

// ── 2. Levels 1-19 are the old drills ──────────────────────────────────────
for (let n = 1; n < TOP_FROM; n++) {
  const d = levelDifficulty(n);
  const p = defaultLevel("power", n), op = powerDrillForLevel(n, 0);
  check(near(p.distance, op.distance, 0.01) && near(p.offset, op.offset, 0.01) && p.blockers === op.blockers && p.keeper === op.keeper
    && (!op.keeper || near(p.keeperStrength, op.keeperStrength, 0.5)) && p.pass === 0.5, `power ${n} is the old level`);
  const t = defaultLevel("technique", n), ot = techniqueDrill(d, 0);
  check(near(t.gateDistance, ot.gateDistance, 0.01) && near(t.gateWidth, ot.gateWidth, 0.01) && near(t.gateOffset, ot.gateOffset, 0.01) && t.pass === 0.25, `technique ${n} is the old level`);
  const f = defaultLevel("freeKick", n), of = freeKickDrill(d, 0);
  check(near(f.distance, of.distance, 0.01) && near(f.offset, of.offset, 0.01) && f.wall === of.wall && near(f.keeperStrength, of.keeperStrength, 0.5), `free kick ${n} is the old level`);
  const pa = defaultLevel("pace", n), opa = paceDrill(d, 0);
  check(pa.chasers === opa.chasers && pa.waveMax === 3 && near(pa.oppStrength, opa.oppStrength, 0.5) && near(pa.runPace, d, 0.5), `pace ${n} is the old level (you still run at the level's number)`);
}
// Vision's own curve: tap below the first kick level, kick from it; the
// kick must start inside VISION_TOP_WINDOW from VISION_TOP_FROM.
for (let n = 1; n <= TRAINING_LEVELS; n++) {
  const v = defaultLevel("vision", n);
  check(v.kick === (n >= VISION_KICK_FROM), `vision ${n}: ${n >= VISION_KICK_FROM ? "kick" : "tap"} level`);
  if (n >= VISION_TOP_FROM) check(near(v.window, VISION_TOP_WINDOW, 0.005), `vision ${n}: the kick starts inside ${VISION_TOP_WINDOW} s`);
  if (n > 1 && n !== VISION_KICK_FROM) check(v.window <= defaultLevel("vision", n - 1).window, `vision ${n}: the window never grows`);
}

// ── 3. Saved edits on top ──────────────────────────────────────────────────
{
  const id = levelId("vision", 30);
  check(parseLevelId(id)?.skill === "vision" && parseLevelId(id)?.level === 30, "a level id reads back");
  check(parseLevelId("vision:31") === null && parseLevelId("speed:3") === null, "a level id outside the 150 is refused");
  const base = levelConfig("vision", 30, {});
  const edited = levelConfig("vision", 30, { [id]: { ...base, window: 0.6, options: 99, junk: 5 } });
  check(edited.window === 0.6, "a saved edit is what the game plays");
  check(edited.options === 6, "a saved number is kept inside the editor's limit (99 team-mates → 6)");
  check(!("junk" in edited), "an unknown key is dropped");
  const partial = levelConfig("vision", 30, { [id]: { window: 0.7 } });
  check(partial.window === 0.7 && partial.options === defaultLevel("vision", 30).options, "a missing number comes from the built-in row");
  const broken = levelConfig("pace", 5, { [levelId("pace", 5)]: { chasers: "lots", oppStrength: NaN } });
  check(Number.isFinite(broken.chasers) && Number.isFinite(broken.oppStrength), "a broken saved row still gives real numbers");
  check(levelConfig("power", 7, { [id]: { window: 0.6 } }).distance === committedLevel("power", 7).distance, "an edit to one level never touches another");
  setTrainingOverlay({ [id]: { ...base, window: 0.65 } });
  check(levelConfig("vision", 30).window === 0.65, "the game's overlay (the store) is read by default");
  setTrainingOverlay({});
  check(levelConfig("vision", 30).window === base.window, "an empty overlay plays the committed file");
  const seeded = sanitizeLevel("technique", 4, { ...committedLevel("technique", 4), seed: 1234 });
  check(levelSeedOf("technique", 4, seeded) === 1234 && levelSeedOf("technique", 4, committedLevel("technique", 4)) === levelSeed("technique", 4),
    "a shuffled layout keeps its own seed; otherwise the level's own");
  check(sanitizeLevel("power", 1, { keeper: "yes" }).keeper === false, "a toggle that isn't true/false falls back to the built-in");
}

// ── 4. Commit merge ────────────────────────────────────────────────────────
{
  const current = fileText(defaultTable());
  const edit = { ...defaultLevel("vision", 30), window: 0.7 };
  const m = mergeTrainingFile(current, [{ skill: "vision", level: 30, config: edit }, { skill: "nope" as never, level: 2, config: {} }]);
  const t = tableFromFile(JSON.parse(m.text));
  check(m.ids.length === 1 && m.ids[0] === "vision:30", "only real levels are committed");
  check(t.vision[29].window === 0.7, "the edited level is in the file");
  check(JSON.stringify(t.power) === JSON.stringify(defaultTable().power) && JSON.stringify(t.vision.slice(0, 29)) === JSON.stringify(defaultTable().vision.slice(0, 29)),
    "every other row is kept as it was");
  const fromNothing = tableFromFile(JSON.parse(mergeTrainingFile("", [{ skill: "pace", level: 3, config: { chasers: 4 } }]).text));
  check(fromNothing.pace[2].chasers === 4 && fromNothing.vision.length === 30, "a file missing on the branch is created whole, never half-empty");
  check(tableFromFile(JSON.parse(mergeTrainingFile("{not json", []).text)).power.length === 30, "a broken file is rebuilt from the built-in levels");
}

// ── 5. The top end climbs ──────────────────────────────────────────────────
type Dir = 1 | -1;
const HARDER: Record<string, Record<string, Dir>> = {
  power: { distance: 1, blockers: 1, keeperStrength: 1, pass: 1 },
  technique: { gateDistance: 1, gateWidth: -1, gateOffset: 1, maxHeight: -1 },
  freeKick: { distance: 1, wall: 1, keeperStrength: 1, pass: 1 },
  pace: { chasers: 1, oppStrength: 1, runPace: 1 },
  vision: { options: 1, window: -1, margin: -1, traps: 1, letGo: -1 },
};
for (const s of TRAINING_SKILLS) {
  for (const [key, dir] of Object.entries(HARDER[s])) {
    for (let n = TOP_FROM + 1; n <= TRAINING_LEVELS; n++) {
      const a = Number((defaultLevel(s, n - 1) as unknown as Record<string, number>)[key]);
      const b = Number((defaultLevel(s, n) as unknown as Record<string, number>)[key]);
      // Your own run speed is the one number allowed to rise slowly: it rising
      // faster than theirs is exactly what made the old top flat.
      if (s === "pace" && key === "runPace") { check(b - a <= 1, `pace ${n}: your speed rises by at most a point a level`); continue; }
      check(dir === 1 ? b >= a : b <= a, `${s} ${n}: ${key} never gets easier than level ${n - 1}`);
    }
    if (!(s === "pace" && key === "runPace")) {
      const a20 = Number((defaultLevel(s, TOP_FROM) as unknown as Record<string, number>)[key]);
      const a30 = Number((defaultLevel(s, 30) as unknown as Record<string, number>)[key]);
      if (key !== "pass" && key !== "maxHeight") check(dir === 1 ? a30 > a20 : a30 < a20, `${s}: level 30's ${key} is harder than level 20's`);
    }
  }
  for (const f of LEVEL_FIELDS[s]) {
    if (f.toggle) continue;
    for (let n = 1; n <= TRAINING_LEVELS; n++) {
      const v = Number((defaultLevel(s, n) as unknown as Record<string, number>)[f.key]);
      check(v >= f.min && v <= f.max, `${s} ${n}: ${f.key} ${v} is inside the editor's range`);
    }
  }
}
{
  const p20 = defaultLevel("pace", 20), p30 = defaultLevel("pace", 30);
  check(p30.oppStrength > p30.runPace && p30.oppStrength - p30.runPace > p20.oppStrength - p20.runPace,
    "pace: at the top THEY are quicker than you, and the gap grows (the old top had you outrunning them, 100 vs 95)");
}
// Vision has its own 1-30 curve (since 20 Oct 2026): checked, with its modelled
// player and its pictures on the real engine, in tests/star/vision.mts.

// Power eased toward your Power, read off the rows.
{
  const rowAt = (n: number) => defaultLevel("power", n);
  for (let n = 1; n < TOP_FROM; n++) {
    check(JSON.stringify(easePowerLevel(n, 100, rowAt)) === JSON.stringify(rowAt(n)), `power ${n}: full Power plays the row as written`);
    for (const power of [40, 55, 70]) {
      const e = easePowerLevel(n, power, rowAt), o = powerDrillForLevel(n, 0, power);
      check(near(e.distance, o.distance, 0.05) && near(e.offset, o.offset, 0.05) && Math.abs(e.blockers - o.blockers) <= 1
        && e.keeper === o.keeper && (!o.keeper || near(e.keeperStrength, o.keeperStrength, 1)), `power ${n} at Power ${power}: eased like the old rule`);
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — training levels are data the game reads, edits sit on top, and the top ten levels climb");
