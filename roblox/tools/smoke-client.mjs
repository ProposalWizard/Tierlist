#!/usr/bin/env node
/**
 * Client smoke test, without Roblox Studio:
 *   node roblox/tools/smoke-client.mjs [matches] [division] [club number]
 * Runs the match client (roblox/src/Client/Match.luau) with stand-ins for the
 * Roblox pieces it uses (parts, screens, camera, input), against the real
 * server (roblox/src/Server/Main.server.luau) and the real converted game.
 * A robot plays each match with a mouse and keyboard: drags to aim, taps the
 * strike screen, runs with W A S D, dribbles, presses every pause button.
 * Catches the mistakes only the Roblox side can make. Run build.mjs first.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const LUAU = process.env.LUAU || "/tmp/claude-0/tools/luau";
const MATCHES = Number(process.argv[2] ?? 2);
const DIVISION = process.argv[3] ?? "League One";
const CLUB = Number(process.argv[4] ?? 1);
const game = path.join(REPO, "roblox/src/Game");

const modules = [];
const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) walk(p); else if (n.endsWith(".luau")) modules.push(p); } };
walk(game);

const strip = (s) => s.replace(/^--!.*$/gm, "");
const read = (p) => strip(fs.readFileSync(path.join(REPO, p), "utf8"));
const parts = [];
parts.push(read("roblox/tools/smoke-mocks.luau"));
parts.push(read("roblox/tools/smoke-client-mocks.luau"));
parts.push("local Js = (function()\n" + read("roblox/src/Runtime/Js.luau") + "\nend)()");
parts.push("local MODULES = {}");
for (const m of modules) {
  const key = path.relative(game, m).replace(/\.luau$/, "");
  parts.push(`MODULES[${JSON.stringify(key)}] = (function()\n${strip(fs.readFileSync(m, "utf8"))}\nend)()`);
}
parts.push(`LOADER = { Js = Js, import = Js.makeImporter(function(p) return MODULES[p] end) }`);
const server = read("roblox/src/Server/Main.server.luau").replace(/local Loader = require\([^\n]*\n/, "local Loader = LOADER\n");
parts.push(`RUN_SERVER = function()\n${server}\nend`);
const client = read("roblox/src/Client/Match.luau").replace(/Loader = require\(ReplicatedStorage[^\n]*\n/, "Loader = LOADER\n");
if (!client.includes("Loader = LOADER")) throw new Error("could not hook the client's Loader");
parts.push(`MATCH_CLIENT = function()\n${client}\nend`);
parts.push(`MATCHES = ${MATCHES}\nDIVISION = ${JSON.stringify(DIVISION)}\nCLUB_PICK = ${CLUB}`);
parts.push(read("roblox/tools/smoke-client-driver.luau"));
const out = "/tmp/claude-0/smoke-client.luau";
fs.writeFileSync(out, parts.join("\n"));
const r = spawnSync(LUAU, [out], { encoding: "utf8", maxBuffer: 1 << 26 });
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
