#!/usr/bin/env node
/**
 * Twin tests: the same test file runs on the website code (Node) and on the
 * converted Roblox code (Luau). Every line it prints must match.
 *   node roblox/tools/twin.mjs                 # every roblox/twin/*.twin.ts
 *   node roblox/tools/twin.mjs season          # only names containing "season"
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runLuau } from "./run.mjs";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const dir = path.join(REPO, "roblox/twin");
const filter = process.argv.slice(2);
const tests = fs.readdirSync(dir).filter((f) => f.endsWith(".twin.ts") && (!filter.length || filter.some((w) => f.includes(w))));
let failed = 0;
for (const t of tests) {
  const file = path.join("roblox/twin", t);
  const web = spawnSync("npx", ["tsx", file], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });
  const t0 = Date.now();
  const rbx = runLuau(file);
  const ms = Date.now() - t0;
  const a = web.stdout.split("\n"), b = rbx.stdout.split("\n");
  let diff = -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { diff = i; break; }
  if (web.status !== 0) { console.log(`FAIL ${t}: website run failed\n${web.stderr.slice(0, 2000)}`); failed++; continue; }
  if (rbx.status !== 0 || diff >= 0) {
    failed++;
    console.log(`FAIL ${t} (${a.length} lines from the website)`);
    if (rbx.status !== 0) console.log(rbx.stderr.slice(0, 3000));
    if (diff >= 0) {
      console.log(`  first difference at line ${diff + 1}:`);
      console.log(`  website: ${(a[diff] ?? "<end>").slice(0, 400)}`);
      console.log(`  roblox : ${(b[diff] ?? "<end>").slice(0, 400)}`);
    }
  } else console.log(`ok   ${t}  (${a.length - 1} lines identical, roblox ${ms} ms)`);
}
console.log(failed ? `${failed} of ${tests.length} twin tests FAILED` : `all ${tests.length} twin tests pass`);
process.exit(failed ? 1 : 0);
