#!/usr/bin/env node
/**
 * Build the Roblox game:
 *   node roblox/tools/build.mjs
 * 1. Converts the game (roblox/game/screens.ts and everything it uses, which
 *    is the website's career code) into roblox/src/Game, from clean.
 * 2. Checks no folder and file share a name (Roblox would mix them up).
 * 3. Packs roblox/build/RoadToBallonDor.rbxlx with Rojo: open it in Roblox Studio.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { convert } from "./ts2luau/convert.mjs";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const ROJO = process.env.ROJO || "/tmp/claude-0/tools/rojo";
const ENTRIES = ["roblox/game/screens.ts", "roblox/game/match.ts", "roblox/game/matchView.ts", "roblox/game/strikeScreen.ts", "roblox/game/trialPlay.ts", "roblox/game/trainingPlay.ts"];

const { written, failures } = convert(ENTRIES, { clean: true, outDir: path.join(REPO, "roblox/src/Game") });
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`converted ${written.length} files`);

// a ModuleScript and a Folder with one name, side by side, can't both be found
const clashes = [];
const walk = (dir) => {
  const names = fs.readdirSync(dir);
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      if (names.includes(n + ".luau")) clashes.push(path.relative(REPO, p));
      walk(p);
    }
  }
};
walk(path.join(REPO, "roblox/src/Game"));
if (clashes.length) { console.error("name clashes:\n" + clashes.join("\n")); process.exit(1); }

const out = path.join(REPO, "roblox/build/RoadToBallonDor.rbxlx");
fs.mkdirSync(path.dirname(out), { recursive: true });
const r = spawnSync(ROJO, ["build", path.join(REPO, "roblox/default.project.json"), "-o", out], { encoding: "utf8" });
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`built ${path.relative(REPO, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
