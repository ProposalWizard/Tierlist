#!/usr/bin/env node
/**
 * Run converted website code here, without Roblox Studio:
 *   node roblox/tools/run.mjs <entry.ts> [--no-convert]
 * Converts the entry (and what it imports), packs it with the support layer
 * into one Luau file and runs it with the luau tool. Prints what it prints.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { convert } from "./ts2luau/convert.mjs";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const LUAU = process.env.LUAU || "/tmp/claude-0/tools/luau";

export function bundle(entryKey) {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "roblox/src/Game/_manifest.json"), "utf8"));
  const parts = [];
  const js = fs.readFileSync(path.join(REPO, "roblox/src/Runtime/Js.luau"), "utf8");
  parts.push("local Js = (function()\n" + js.replace(/^--!.*$/gm, "") + "\nend)()");
  parts.push("local MODULES = {}");
  for (const key of manifest.modules) {
    const src = fs.readFileSync(path.join(REPO, "roblox/src/Game", key + ".luau"), "utf8").replace(/^--!.*$/gm, "");
    parts.push(`MODULES[${JSON.stringify(key)}] = (function()\n${src}\nend)()`);
  }
  parts.push("local import = Js.makeImporter(function(p) return MODULES[p] end)");
  parts.push(`import(${JSON.stringify(entryKey)})`);
  return parts.join("\n");
}

export function runLuau(entry, { doConvert = true } = {}) {
  if (doConvert) {
    const { failures } = convert([entry], { quiet: true });
    if (failures.length) return { status: 99, stdout: "", stderr: "CONVERT FAILURES:\n" + failures.join("\n") };
  }
  const key = path.relative(REPO, path.resolve(REPO, entry)).replace(/\.(ts|mts)$/, "");
  const out = path.join("/tmp/claude-0", "bundle-" + key.replace(/\//g, "_") + ".luau");
  fs.writeFileSync(out, bundle(key));
  const r = spawnSync(LUAU, [out], { encoding: "utf8", maxBuffer: 1 << 28 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, bundle: out };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const entry = process.argv[2];
  const r = runLuau(entry, { doConvert: !process.argv.includes("--no-convert") });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}
