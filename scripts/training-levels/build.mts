/**
 * Write lib/star/data/trainingLevels.json from the built-in curve
 * (defaultLevel in lib/star/trainingLevelData.ts).
 *
 *   npx tsx scripts/training-levels/build.mts          only fills rows that are missing
 *   npx tsx scripts/training-levels/build.mts --reset  every row back to the built-in curve
 *
 * The file is the game's data: once levels are edited and committed from
 * /star-training-dev, a plain run keeps those edits. --reset throws them away.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { defaultTable, fileText, tableFromFile } from "../../lib/star/trainingLevelData";

const path = "lib/star/data/trainingLevels.json";
const reset = process.argv.includes("--reset");
let current: unknown = null;
try { current = JSON.parse(readFileSync(path, "utf8")); } catch { current = null; }
const table = reset ? defaultTable() : tableFromFile(current);
writeFileSync(path, fileText(table));
console.log(`wrote ${path}${reset ? " (reset to the built-in curve)" : ""}`);
