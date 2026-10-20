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
 * Harry, 19 Oct 2026, after the play screens drifted from the real match:
 * "make it super clear … put it in bright red … a lot of times I'm just
 * clicking Allow, allow, allow, and that's how these things happen." So it
 * now ASKS every time, with a red notice in the Allow box itself, and it
 * covers every file that can make a play screen differ from the real match
 * (the drift files), not only the physics.
 *
 * Never blocks. Everything else passes straight through.
 */
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

const ENGINE = /lib\/star\/canvasEngine\.ts/;
// Files that decide what a play screen hands the engine: change one and a
// test screen can stop matching the real match (a drift).
const DRIFT = /(components\/star\/(CanvasMatch|EnginePlay|ScenarioPlay|InfiniteMatch)\.tsx|lib\/star\/(hiddenMatch|engineProfile|playArea|scenePicture|matchView)\.ts)/;

let hit = false;
let drift = false;
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const f = ti.file_path ?? ti.notebook_path ?? "";
  hit = ENGINE.test(f);
  drift = !hit && DRIFT.test(f);
} else if (tool === "Bash") {
  // Quoted text in a commit message or an echo only MENTIONS the file, so it
  // is ignored there. Anywhere else (a python/node script, a heredoc) a quoted
  // path is a real edit target (20 Oct 2026: a python heredoc slipped past).
  const raw = ti.command ?? "";
  const onlyMentions = /^\s*(git\s+commit|echo|printf)\b/.test(raw);
  const cmd = onlyMentions ? raw.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "\"\"") : raw;
  const writes = /(sed\s+-i|perl\s+-i|>\s*[^&]|\btee\b|\brm\b|\bmv\b|\bcp\b|python|node\s+-e|<<|\.write|writeFile|git\s+(checkout|restore|rm|apply|am)|truncate|patch\b)/;
  hit = ENGINE.test(cmd) && writes.test(cmd);
  drift = !hit && DRIFT.test(cmd) && writes.test(cmd);
}

// No colour codes: the app shows them as raw text. The red squares are the colour.
const ask = (title, line) => ({
  permissionDecision: "ask",
  permissionDecisionReason:
    `🟥🟥 ${title} 🟥🟥\n${line}\nOnly press Allow if someone asked for this in words. Otherwise press No.`,
});

if (hit) {
  process.stdout.write(JSON.stringify({
    systemMessage: `🟥 THIS IS A MATCH ENGINE CHANGE. EVERY MATCH WILL PLAY DIFFERENTLY.`,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...ask("THIS IS A MATCH ENGINE CHANGE", "It changes the physics every match runs on (lib/star/canvasEngine.ts)."),
      additionalContext:
        "MATCH ENGINE WARNING: you are changing lib/star/canvasEngine.ts. This is allowed, but it changes every match. " +
        "Say so plainly in your reply and in the patch notes (what changed, why, and the before/after numbers), " +
        "run the match tests (node scripts/run-star-tests.mjs finishing keeper aiming outcomes) and playtest it before pushing.",
    },
  }));
} else if (drift) {
  process.stdout.write(JSON.stringify({
    systemMessage: `🟥 SOMETHING MAY DRIFT: this file decides what a play screen hands the match engine.`,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...ask("SOMETHING MAY DRIFT FROM THE REAL MATCH", `This file decides what a play screen hands the engine (${(ti.file_path ?? "").split("/").slice(-1)[0] || "a drift file"}). Test screens can stop matching the real game.`),
      additionalContext:
        "DRIFT WARNING: you are changing a file that decides what a play screen hands the match engine. " +
        "Before pushing, re-measure the play screens against the real match (docs/handoffs/2026-10-19-ui-lookover/drift-audit.md: pitch width 366 px on a 390 phone, 384 on a computer; same props as the career) and say the before/after in the reply and patch notes.",
    },
  }));
}
process.exit(0);
