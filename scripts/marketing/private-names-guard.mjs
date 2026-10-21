#!/usr/bin/env node
/**
 * PRIVATE NAMES GUARD — the leak guard for the Marketing area (Harry, 21 Oct
 * 2026; docs/plans/2026-10-21-marketing-production.md, risk 1).
 *
 * This repo is PUBLIC. The marketing method was learned from Harry's other
 * app, which holds other businesses' private work. Nothing of theirs may land
 * here: no client name, brand, code or account number. This script fails if
 * any of those words appears in the repo's files or recent commit messages.
 *
 * THE LIST OF WORDS IS NEVER IN THIS REPO (that would leak it). Give it as:
 *   KIB_PRIVATE_NAMES="name one,name two"            (comma-separated), and/or
 *   KIB_PRIVATE_NAMES_FILE=/path/outside/the/repo.txt (one per line, # = comment;
 *                                                       a line "re:<regex>" is a pattern)
 * With neither set it SKIPS and says so (the live build has no list, on purpose).
 *
 *   node scripts/marketing/private-names-guard.mjs              files (tracked + new) and the last 200 commit messages
 *   node scripts/marketing/private-names-guard.mjs --no-commits files only
 *
 * A plain name matches in any case, with or without spaces, hyphens or
 * underscores between its words, as a whole word. Hits are printed as
 * "file:line  name #N" — the name itself is never printed, so build logs
 * never carry it either. Exit 1 on any hit.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2);
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SHOWN = 60;

/* ── The list ─────────────────────────────────────────────────────────── */
const raw = [];
if (process.env.KIB_PRIVATE_NAMES?.trim()) raw.push(...process.env.KIB_PRIVATE_NAMES.split(","));
const listFile = process.env.KIB_PRIVATE_NAMES_FILE?.trim();
if (listFile) {
  const abs = path.resolve(listFile);
  if (abs === ROOT || abs.startsWith(ROOT + path.sep)) {
    console.error("PRIVATE NAMES GUARD: the names file must live OUTSIDE this repo (it would leak the list). Move it and try again.");
    process.exit(1);
  }
  let text;
  try { text = fs.readFileSync(abs, "utf8"); } catch {
    console.error("PRIVATE NAMES GUARD: KIB_PRIVATE_NAMES_FILE is set but the file can't be read.");
    process.exit(1);
  }
  raw.push(...text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)));
}
const words = raw.map((w) => w.trim()).filter(Boolean);
if (!words.length) {
  console.log("private-names: skipped. No list given (set KIB_PRIVATE_NAMES or KIB_PRIVATE_NAMES_FILE to check). See scripts/marketing/private-names-guard.mjs.");
  process.exit(0);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = [];
words.forEach((w, i) => {
  const n = i + 1;
  if (w.startsWith("re:")) {
    try { patterns.push({ n, re: new RegExp(w.slice(3), "i") }); } catch { console.error(`private-names: pattern #${n} is not a valid pattern; left out.`); }
    return;
  }
  if (w.replace(/[\s_-]/g, "").length < 4) { console.error(`private-names: name #${n} is under 4 letters, too short to search safely; give it as a "re:" pattern. Left out.`); return; }
  const body = w.split(/[\s_-]+/).map(esc).join("[\\s_-]?");
  patterns.push({ n, re: new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "i") });
});

/* ── The files ────────────────────────────────────────────────────────── */
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
let files;
try {
  files = [...git("ls-files", "-z").split("\0"), ...git("ls-files", "-z", "--others", "--exclude-standard").split("\0")].filter(Boolean);
} catch {
  // No git (a bare build folder): walk it, skipping what is never committed.
  const skip = new Set(["node_modules", ".next", ".git", ".vercel"]);
  files = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { if (skip.has(e.name)) continue; const p = d ? `${d}/${e.name}` : e.name; e.isDirectory() ? walk(p) : files.push(p); } };
  walk("");
}

const hits = [];
let scanned = 0;
for (const f of new Set(files)) {
  const abs = path.join(ROOT, f);
  let buf;
  try { const st = fs.statSync(abs); if (!st.isFile() || st.size > MAX_BYTES) continue; buf = fs.readFileSync(abs); } catch { continue; }
  if (buf.subarray(0, 8192).includes(0)) continue; // a picture, a video, a font: not text
  scanned++;
  const lines = buf.toString("utf8").split("\n");
  for (const { n, re } of patterns) {
    // The file name counts too.
    if (re.test(f)) hits.push(`${f}  (its name)  name #${n}`);
    lines.forEach((ln, i) => { if (re.test(ln)) hits.push(`${f}:${i + 1}  name #${n}`); });
  }
}

/* ── Commit messages ──────────────────────────────────────────────────── */
let commits = 0;
if (!args.includes("--no-commits")) {
  try {
    for (const entry of git("log", "-n", "200", "--format=%h%x00%B%x1e").split("\x1e")) {
      const [h, msg] = entry.trim().split("\0");
      if (!h) continue;
      commits++;
      for (const { n, re } of patterns) if (re.test(msg ?? "")) hits.push(`commit ${h} (its message)  name #${n}`);
    }
  } catch { /* no history here */ }
}

if (hits.length) {
  console.error(`\nPRIVATE NAMES GUARD: ${hits.length} hit${hits.length === 1 ? "" : "s"} of a private name (numbered as in your list; the names are not printed):`);
  for (const h of hits.slice(0, MAX_SHOWN)) console.error(`  ${h}`);
  if (hits.length > MAX_SHOWN) console.error(`  … and ${hits.length - MAX_SHOWN} more`);
  console.error("Take each one out (this repo is public). See scripts/marketing/private-names-guard.mjs.\n");
  process.exit(1);
}
console.log(`private-names: 0 hits for ${patterns.length} name${patterns.length === 1 ? "" : "s"} in ${scanned} files${commits ? ` and ${commits} commit messages` : ""}.`);
