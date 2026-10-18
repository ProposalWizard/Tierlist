#!/usr/bin/env node
/**
 * Stop hook: after each turn, if Claude's last message has progress bars,
 * send just those lines to the team board. Nobody has to remember.
 * (docs/plans/2026-10-15/teamboard.md, design B; Harry chose "automatic".)
 *
 * Quiet and quick: no DEV_STATUS_TOKEN = does nothing; no bars = does nothing;
 * same text as last time = does nothing; otherwise it starts
 * scripts/post-status.mjs in the background and returns at once.
 * Keeps only bar / Started / Waiting on / Speed check / usage lines and
 * blanks key-shaped text (same rules as lib/devStatus.ts extractUpdate).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

if (!(process.env.DEV_STATUS_TOKEN || "").trim()) process.exit(0);

const BAR = /^(.*?)\s*([█░▓▒■□]{4,})\s*(\d{1,3})\s*%\s*(.*)$/;
export function extractUpdate(message) {
  const lines = message.replace(/\r/g, "").split("\n");
  const t = (l) => l.replace(/^[\s`>*-]+/, "");
  if (!lines.some((l) => BAR.test(t(l)))) return "";
  const keep = lines.filter((l) => BAR.test(t(l)) || /^(Started|Waiting on|Speed check|UPDATE)\b/i.test(t(l)) || /\b(tokens?|weekly|usage)\b/i.test(t(l)));
  return keep.join("\n")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, "[key]")
    .replace(/\b(ghp|gho|ghs|github_pat|sk|phc|sk-ant)[-_][A-Za-z0-9_-]{12,}/g, "[key]")
    .slice(0, 6000);
}

function lastAssistantText(path) {
  const rows = readFileSync(path, "utf8").trim().split("\n");
  for (let i = rows.length - 1; i >= 0; i--) {
    let r; try { r = JSON.parse(rows[i]); } catch { continue; }
    const m = r.message;
    if (r.type !== "assistant" || !m || !Array.isArray(m.content)) continue;
    const text = m.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (text.trim()) return text;
  }
  return "";
}

try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  if (!input.transcript_path || !existsSync(input.transcript_path)) process.exit(0);
  const update = extractUpdate(lastAssistantText(input.transcript_path));
  if (!update) process.exit(0);
  const hash = createHash("sha1").update(update).digest("hex");
  const mark = join(tmpdir(), "kib-dev-status-last");
  if (existsSync(mark) && readFileSync(mark, "utf8") === hash) process.exit(0);
  writeFileSync(mark, hash);
  const file = join(tmpdir(), `kib-dev-status-${hash}.txt`);
  writeFileSync(file, update);
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sess = input.session_id ? ["--session", String(input.session_id)] : [];
  spawn(process.execPath, [join(dir, "scripts/post-status.mjs"), "--file", file, "--delete", ...sess], { detached: true, stdio: "ignore" }).unref();
} catch { /* never block a turn */ }
process.exit(0);
