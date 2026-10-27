#!/usr/bin/env node
/**
 * Drift: which website files changed since the Roblox copy was converted?
 *   node roblox/tools/drift.mjs
 * Reads the commit stored in roblox/tools/manifest.json and lists every
 * converted website file that has changed since. To catch up, run the
 * converter again (roblox/tools/ts2luau/convert.mjs) and the twin tests.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "roblox/tools/manifest.json"), "utf8"));
const sources = manifest.modules.map((k) => (k.endsWith("_json") ? k.slice(0, -5) + ".json" : k + ".ts"));
const changed = execSync(`git diff --name-only ${manifest.commit} HEAD -- ${sources.map((s) => JSON.stringify(s)).join(" ")}`, { cwd: REPO })
  .toString().trim().split("\n").filter(Boolean);
const overrides = manifest.modules.filter((k) => fs.existsSync(path.join(REPO, "roblox/src/Overrides", k + ".luau")));
console.log(`Roblox copy made from website commit ${manifest.commit} (${sources.length} files).`);
if (!changed.length) console.log("No website file has changed since. Nothing to catch up.");
else {
  console.log(`${changed.length} website file(s) changed since:`);
  for (const f of changed) {
    const hand = overrides.some((k) => f.startsWith(k));
    console.log(`  ${f}${hand ? "   <- hand-written Roblox version: update it by hand" : ""}`);
  }
  console.log("Run the converter again, then the twin tests.");
}
