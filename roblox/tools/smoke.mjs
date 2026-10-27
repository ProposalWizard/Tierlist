#!/usr/bin/env node
/**
 * Server smoke test, without Roblox Studio:
 *   node roblox/tools/smoke.mjs [presses]
 * Runs roblox/src/Server/Main.server.luau on the real converted game
 * (roblox/src/Game) with stand-ins for the Roblox services it uses (players,
 * DataStore, HttpService, remotes), then plays as a client would: the new
 * career screens, a club, then button presses. Also saves, "rejoins" and
 * checks the career comes back the same. Prints each screen's title.
 * Run roblox/tools/build.mjs first.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const LUAU = process.env.LUAU || "/tmp/claude-0/tools/luau";
const PRESSES = Number(process.argv[2] ?? 120);
const game = path.join(REPO, "roblox/src/Game");

const modules = [];
const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) walk(p); else if (n.endsWith(".luau")) modules.push(p); } };
walk(game);

const strip = (s) => s.replace(/^--!.*$/gm, "");
const parts = [];
parts.push(fs.readFileSync(path.join(REPO, "roblox/tools/smoke-mocks.luau"), "utf8"));
parts.push("local Js = (function()\n" + strip(fs.readFileSync(path.join(REPO, "roblox/src/Runtime/Js.luau"), "utf8")) + "\nend)()");
parts.push("local MODULES = {}");
for (const m of modules) {
  const key = path.relative(game, m).replace(/\.luau$/, "");
  parts.push(`MODULES[${JSON.stringify(key)}] = (function()\n${strip(fs.readFileSync(m, "utf8"))}\nend)()`);
}
parts.push(`LOADER = { Js = Js, import = Js.makeImporter(function(p) return MODULES[p] end) }`);
const server = strip(fs.readFileSync(path.join(REPO, "roblox/src/Server/Main.server.luau"), "utf8"))
  .replace(/local Loader = require\([^\n]*\n/, "local Loader = LOADER\n");
parts.push(`RUN_SERVER = function()\n${server}\nend`);
parts.push(`PRESSES = ${PRESSES}`);
parts.push(fs.readFileSync(path.join(REPO, "roblox/tools/smoke-driver.luau"), "utf8"));
const out = "/tmp/claude-0/smoke.luau";
fs.writeFileSync(out, parts.join("\n"));
const r = spawnSync(LUAU, [out], { encoding: "utf8", maxBuffer: 1 << 26 });
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
