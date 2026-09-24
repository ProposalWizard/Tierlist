#!/usr/bin/env node
/**
 * ONE ENGINE — CHECKED AT THE END OF EVERY CLAUDE TURN (a Stop hook).
 *
 * Asked for by Harry (24 Sep 2026): run the guard at the end of each Claude
 * turn that changed code, so a copy of the match is caught in the session that
 * made it — not twenty minutes later when a Vercel deploy fails for everyone.
 *
 * Only runs when the turn left code changed (uncommitted, or committed but not
 * pushed) under app/, components/, lib/ or the guard itself; otherwise it costs
 * nothing. On a failure it exits 2 with the problems, which sends them back to
 * the session to fix before it finishes. If the session is already being held
 * by this hook once, it lets it go (with the problems shown) rather than loop.
 */
import { readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* no input */ }

const sh = (c) => { try { return execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const RELEVANT = /^(app|components|lib)\/.*\.(tsx?|jsx?|mjs)$|^scripts\/one-engine-guard\.mjs$|^package\.json$/;

const changed = new Set();
for (const line of sh("git status --porcelain -uall").split("\n")) {
  const f = line.slice(3).trim().split(" -> ").pop();
  if (f) changed.add(f);
}
if (sh("git rev-parse --abbrev-ref --symbolic-full-name @{u}").trim()) {
  for (const f of sh("git diff --name-only @{u}..HEAD").split("\n")) if (f) changed.add(f);
}
if (![...changed].some((f) => RELEVANT.test(f))) process.exit(0);

const r = spawnSync("node", ["scripts/one-engine-guard.mjs"], { encoding: "utf8" });
if (r.status === 0) process.exit(0);

const problems = ((r.stderr || "") + (r.stdout || "")).split("\n").filter((l) => /✗|crashed/.test(l)).join("\n");
if (input.stop_hook_active) {
  process.stdout.write(JSON.stringify({ systemMessage: `ONE ENGINE GUARD still failing:\n${problems}` }));
  process.exit(0);
}
process.stderr.write(`ONE ENGINE GUARD failed on the code this turn changed. Fix it before finishing (load the one-engine skill):\n${problems}\n`);
process.exit(2);
