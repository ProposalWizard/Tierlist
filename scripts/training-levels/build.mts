/**
 * Write lib/star/data/trainingLevels.json from the built-in curve
 * (defaultLevel in lib/star/trainingLevelData.ts).
 *
 *   npx tsx scripts/training-levels/build.mts          only fills rows that are missing
 *   npx tsx scripts/training-levels/build.mts --reset  every row back to the built-in curve
 *
 * The file is the game's data: once levels are edited and committed from
 * /star-training-dev, a plain run keeps those edits. --reset throws them away;
 * --reset-skill vision resets only that game (a Vision row from before its
 * rebuild is already read as the built-in row by a plain run).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { defaultTable, fileText, tableFromFile, TRAINING_SKILLS, type TrainingSkill } from "../../lib/star/trainingLevelData";

const path = "lib/star/data/trainingLevels.json";
const reset = process.argv.includes("--reset");
// --reset-skill vision: only that game's rows back to the built-in curve.
const one = process.argv[process.argv.indexOf("--reset-skill") + 1] as TrainingSkill | undefined;
const resetSkill = process.argv.includes("--reset-skill") && one && TRAINING_SKILLS.includes(one) ? one : null;
let current: unknown = null;
try { current = JSON.parse(readFileSync(path, "utf8")); } catch { current = null; }
const table = reset ? defaultTable() : tableFromFile(current);
if (resetSkill) (table as Record<TrainingSkill, unknown[]>)[resetSkill] = defaultTable()[resetSkill];
writeFileSync(path, fileText(table));
console.log(`wrote ${path}${reset ? " (reset to the built-in curve)" : resetSkill ? ` (${resetSkill} reset to the built-in curve)` : ""}`);
