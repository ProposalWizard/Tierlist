#!/usr/bin/env node
/**
 * MATCH ENGINE — A WARNING, NOT A BAN (a Claude Code PreToolUse hook,
 * .claude/settings.json).
 *
 * Harry, 5 Oct 2026: "remove Mikey's never change the match engine rule and
 * make it a general guard — instead of a rule that warns when it's happening."
 *
 * The match engine (lib/star/canvasEngine.ts) used to be off limits. Now any
 * session may change it, but every change is flagged as it happens: the person
 * sees a notice, and Claude is told to name the change in its reply and the
 * patch notes, so Harry, Mikey and Leo always know the engine moved.
 *
 * Never blocks and never asks. Everything else passes straight through.
 */
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

const ENGINE = /lib\/star\/canvasEngine\.ts/;

let hit = false;
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  hit = ENGINE.test(ti.file_path ?? ti.notebook_path ?? "");
} else if (tool === "Bash") {
  // Quoted text (a commit message, an echo) only mentions the file; ignore it.
  const cmd = (ti.command ?? "").replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "\"\"");
  const writes = /(sed\s+-i|perl\s+-i|>\s*[^&]|\btee\b|\brm\b|\bmv\b|\bcp\b|python|git\s+(checkout|restore|rm|apply|am)|truncate|patch\b)/;
  hit = ENGINE.test(cmd) && writes.test(cmd);
}

if (hit) {
  process.stdout.write(JSON.stringify({
    systemMessage: "⚠ MATCH ENGINE: this changes lib/star/canvasEngine.ts, the physics every match runs on.",
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext:
        "MATCH ENGINE WARNING: you are changing lib/star/canvasEngine.ts. This is allowed, but it changes every match. " +
        "Say so plainly in your reply and in the patch notes (what changed, why, and the before/after numbers), " +
        "run the match tests (node scripts/run-star-tests.mjs finishing keeper aiming outcomes) and playtest it before pushing.",
    },
  }));
}
process.exit(0);
