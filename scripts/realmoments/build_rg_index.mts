/**
 * Build data/realmoments/rg_index.json — the Real Goals home's small index
 * (chat 5, 22 Oct 2026; the hub: "the home tiles on screen in under 1 s at a
 * 6x slower CPU"). The home draws from this alone: each path's number of
 * levels, and each daily goal's card (scorer, minute, sides, score, where it
 * went in, which data file holds it). The big shot files load only when a
 * path or a goal is opened.
 *
 * Run after any change to the data, the paths or DAILY_LIST:
 *   npx tsx scripts/realmoments/build_rg_index.mts
 * tests/star/realGoals.mts fails if the file does not match a fresh build.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildRgIndex } from "../../lib/star/realGoalIndex";
import { joinGoals, LEAGUES, type RgFile } from "../../lib/star/realGoals";
import type { WyscoutShotFile } from "../../lib/star/realMoments";

const R = <T,>(f: string): T => JSON.parse(readFileSync(`data/realmoments/${f}`, "utf8")) as T;
const files: Record<string, ReturnType<typeof joinGoals>> = {
  wc: joinGoals(R<WyscoutShotFile>("wyscout_shots.json").shots, R<RgFile>("wyscout_goals.json").goals),
  bangers: (() => { const b = R<RgFile & WyscoutShotFile>("bangers.json"); return joinGoals(b.shots, b.goals); })(),
};
for (const l of LEAGUES) { const f = R<RgFile & WyscoutShotFile>(`wyscout_${l.file.replace("-", "_")}.json`); files[l.file] = joinGoals(f.shots, f.goals); }

const out = JSON.stringify(buildRgIndex(files));
if (process.argv.includes("--check")) {
  const now = readFileSync("data/realmoments/rg_index.json", "utf8");
  if (now !== out) { console.error("rg_index.json is out of date: run npx tsx scripts/realmoments/build_rg_index.mts"); process.exit(1); }
  console.log("rg_index.json is up to date");
} else {
  writeFileSync("data/realmoments/rg_index.json", out);
  console.log(`wrote data/realmoments/rg_index.json (${(out.length / 1024).toFixed(1)} KB)`);
}
