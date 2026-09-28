#!/usr/bin/env node
// Run every tests/star/*.mts, several at once (Harry, 27 Sep 2026: make the
// checks faster — one file at a time took about 30 minutes).
//
//   node scripts/run-star-tests.mjs            all of them, 4 at a time
//   node scripts/run-star-tests.mjs -j 6       6 at a time
//   node scripts/run-star-tests.mjs keeper pen only files whose name contains "keeper" or "pen"
//
// Prints one line per file as it finishes, then the failures with the tail of
// their output. Exits 1 if any file failed.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
let jobs = Math.max(1, Math.min(4, cpus().length));
const filters = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-j") jobs = Math.max(1, Number(args[++i]) || jobs);
  else filters.push(args[i]);
}

const dir = "tests/star";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".mts"))
  .filter((f) => filters.length === 0 || filters.some((w) => f.includes(w)))
  .sort();

const started = Date.now();
const results = [];
let next = 0;

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let out = "";
    const child = spawn("npx", ["tsx", join(dir, file)], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      const ok = code === 0;
      console.log(`${ok ? "  pass" : "  FAIL"}  ${file}  (${secs}s)`);
      results.push({ file, ok, out });
      resolve();
    });
  });
}

async function worker() {
  while (next < files.length) await runOne(files[next++]);
}

console.log(`${files.length} test files, ${jobs} at a time`);
await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, worker));

const failed = results.filter((r) => !r.ok).sort((a, b) => a.file.localeCompare(b.file));
for (const f of failed) {
  console.log(`\n── ${f.file} ──`);
  console.log(f.out.trim().split("\n").slice(-15).join("\n"));
}
const mins = ((Date.now() - started) / 60000).toFixed(1);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed, in ${mins} min${failed.length ? ": " + failed.map((f) => f.file).join(", ") : ""}`);
process.exit(failed.length ? 1 : 0);
