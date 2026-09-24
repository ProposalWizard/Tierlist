#!/usr/bin/env node
/**
 * ONE ENGINE — THE LOCK (a Claude Code PreToolUse hook, .claude/settings.json).
 *
 * Asked for by Harry (24 Sep 2026): every Claude session — his, Mikey's, Leo's
 * — must stop and ASK a person before it edits the one-engine guard's lists,
 * its canary, the hooks themselves, or takes the guard out of the build. The
 * guard can't stop a person editing code; this makes sure a Claude session
 * can't do it quietly to turn a red build green.
 *
 * Reads the tool call on stdin. Anything that touches a protected file answers
 * "ask", which puts a permission prompt in front of the person with the reason
 * below. Everything else passes straight through. Never blocks outright: the
 * point is that a person decides, not that nobody can.
 */
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

const PROTECTED = [
  /scripts\/one-engine-guard\.mjs/,
  /tests\/star\/fixtures\/oneEngineCanary\//,
  /\.claude\/settings(\.local)?\.json/,
  /scripts\/hooks\/guard-(lock|stop)\.mjs/,
];
const hitsProtected = (s) => typeof s === "string" && PROTECTED.some((re) => re.test(s));

function why() {
  if (tool === "Bash") return "a shell command that may change the one-engine guard";
  return `an edit to ${ti.file_path ?? ti.notebook_path ?? "a protected file"}`;
}

let ask = false;
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const path = ti.file_path ?? ti.notebook_path ?? "";
  if (hitsProtected(path)) ask = true;
  // package.json: only when the guard is being taken out of the build.
  if (/package\.json$/.test(path)) {
    const before = ti.old_string ?? "";
    const after = ti.new_string ?? ti.content ?? "";
    if (tool === "Write" ? !/one-engine-guard/.test(after) : (/one-engine-guard/.test(before) && !/one-engine-guard/.test(after))) ask = true;
  }
} else if (tool === "Bash") {
  const cmd = ti.command ?? "";
  const writes = /(sed\s+-i|perl\s+-i|>\s*[^&]|\btee\b|\brm\b|\bmv\b|\bcp\b|python|git\s+(checkout|restore|rm)|truncate)/;
  if ((hitsProtected(cmd) || (/package\.json/.test(cmd) && /one-engine-guard/.test(cmd))) && writes.test(cmd)) ask = true;
}

if (ask) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason:
        `ONE ENGINE LOCK: this is ${why()}. The guard stops copies of the match reaching the site; ` +
        `its lists may only shrink. Approve only if you (Harry, Mikey or Leo) asked for exactly this change in this chat.`,
    },
  }));
}
process.exit(0);
