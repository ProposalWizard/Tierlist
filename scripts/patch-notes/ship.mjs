#!/usr/bin/env node
/**
 * scripts/patch-notes/ship.mjs — put patch notes on the live site straight
 * away, WITHOUT the feature code they describe (Harry, 21 Oct 2026: "from now
 * on also as soon as patch notes are built put them onto the site";
 * Brain note PRO-TEAM-007).
 *
 * It builds a patch-notes-only branch from origin/main and adds ONLY:
 *   - the named versions' entries in lib/patchNotesData.ts   (copied from --from)
 *   - their lines in lib/patchNotePages.ts                    (copied from --from)
 *   - their kept pages, patch-notes/pages/<version>/**        (copied from --from)
 * then checks that nothing else changed and that the two data files import
 * nothing but the PatchNote type (so main never pulls in unreleased code).
 * The feature code stays on the person's branch until they say push.
 *
 * Usage (from the repo):
 *   node scripts/patch-notes/ship.mjs 0.95h 0.96h            build the branch + commit (local)
 *   node scripts/patch-notes/ship.mjs 0.95h --pr             also push it and open a PR to main (gh)
 *   node scripts/patch-notes/ship.mjs 0.95h --from origin/Mikey
 *   node scripts/patch-notes/ship.mjs 0.95h --update         replace an entry main already has
 *   node scripts/patch-notes/ship.mjs 0.95h --tsc            also type-check the two files on the branch
 *   node scripts/patch-notes/ship.mjs --dry 0.95h            show what would change, write nothing
 *
 * Works in a throwaway git worktree under the system temp folder, so the
 * checkout you are in is never touched. Merging the PR deploys main (Vercel),
 * and the site then buzzes the team about the new notes (lib/teamRoom/inbox.ts).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const versions = args.filter((a, i) => !a.startsWith("--") && !["--from", "--branch", "--base"].includes(args[i - 1]));
const FROM = opt("--from", "HEAD");
const BASE = opt("--base", "origin/main");
const DRY = flag("--dry");
if (!versions.length) { console.error("Name the versions to ship, e.g. node scripts/patch-notes/ship.mjs 0.95h 0.96h"); process.exit(2); }

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const git = (a, cwd = ROOT) => execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
const DATA = "lib/patchNotesData.ts";
const PAGES = "lib/patchNotePages.ts";
/** The only paths a patch-notes-only branch may change. */
export const ALLOWED = (p) => p === DATA || p === PAGES || p.startsWith("patch-notes/");

/* ── Reading the archive (TypeScript → plain data, no app code run) ──────── */
const req = createRequire(path.join(ROOT, "package.json"));
const ts = req("typescript");
async function loadModule(src, name) {
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  if (/^\s*import\s(?!type)/m.test(js)) throw new Error(`${name} imports something at run time; a patch-notes file must not (it would drag code onto main).`);
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

/** Only `import type` lines, and only from ./patchNotes, are allowed in the two files. */
export function importsOk(src) {
  const bad = [];
  for (const m of src.matchAll(/^\s*import\s+([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const typeOnly = /^type\s/.test(m[1]);
    if (!typeOnly || m[2] !== "./patchNotes") bad.push(m[0].trim());
  }
  return bad;
}

/** [start, end) of the `{ … }` object holding "version": v in the archive's text. */
export function entrySpan(text, v) {
  const key = new RegExp(`"version"\\s*:\\s*"${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  const m = key.exec(text);
  if (!m) return null;
  // walk back to the "{" that opens this entry (depth 0 relative to the array)
  let depth = 0, i = m.index;
  for (; i >= 0; i--) {
    const c = text[i];
    if (c === "}") depth++;
    else if (c === "{") { if (depth === 0) break; depth--; }
  }
  const start = i;
  // walk forward, skipping strings, to its matching "}"
  let d = 0, inStr = false, esc = false, j = start;
  for (; j < text.length; j++) {
    const c = text[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) { j++; break; } }
  }
  return [start, j];
}

const indent = (s, n) => s.split("\n").map((l, i) => (i === 0 ? l : " ".repeat(n) + l)).join("\n");

let cleanup = () => {};
async function main() {
  git(["fetch", "-q", "origin", "main"]);
  if (FROM.startsWith("origin/")) git(["fetch", "-q", "origin", FROM.slice(7)]);
  // Pin --from to a commit now: inside the new worktree "HEAD" would mean main.
  const SRC = git(["rev-parse", "--verify", `${FROM}^{commit}`]).trim();
  const fromData = git(["show", `${SRC}:${DATA}`]);
  const fromPages = git(["show", `${SRC}:${PAGES}`]);
  for (const [n, s] of [[DATA, fromData], [PAGES, fromPages]]) {
    const bad = importsOk(s);
    if (bad.length) throw new Error(`${n} on ${FROM} imports ${bad.join(" | ")}. Patch-notes files may only import the PatchNote type.`);
  }
  const { BUILT_IN_PATCH_NOTES: fromNotes } = await loadModule(fromData, DATA);
  const { PATCH_NOTE_PAGES: fromMap } = await loadModule(fromPages, PAGES);
  const want = versions.map((v) => {
    const e = fromNotes.find((n) => n.version === v);
    if (!e) throw new Error(`v${v} is not in ${DATA} on ${FROM}.`);
    return e;
  });

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const branch = opt("--branch", `patch-notes/${stamp}-${versions.join("-").replace(/[^\w.-]/g, "")}`);
  const dir = path.join(os.tmpdir(), `kib-pn-ship-${stamp}-${process.pid}`);
  if (!DRY) {
    git(["worktree", "add", "-q", "-b", branch, dir, BASE]);
    cleanup = () => { try { git(["worktree", "remove", "--force", dir]); git(["branch", "-D", branch]); } catch { /* already gone */ } };
  }
  const W = DRY ? null : dir;
  const read = (p) => (W ? fs.readFileSync(path.join(W, p), "utf8") : git(["show", `${BASE}:${p}`]));
  const write = (p, s) => { if (W) fs.writeFileSync(path.join(W, p), s); };

  // 1. the archive entries (newest first: the order they have on --from)
  let data = read(DATA);
  const order = want.slice().sort((a, b) => fromNotes.indexOf(a) - fromNotes.indexOf(b));
  const added = [], replaced = [];
  for (const e of order.slice().reverse()) {
    const body = indent(JSON.stringify(e, null, 2), 4);
    const span = entrySpan(data, e.version);
    if (span) {
      if (!flag("--update")) { console.log(`  v${e.version}: already on main (use --update to replace it)`); continue; }
      data = data.slice(0, span[0]) + body + data.slice(span[1]);
      replaced.push(e.version);
    } else {
      const open = data.indexOf("= [", data.indexOf("BUILT_IN_PATCH_NOTES"));
      if (open < 0) throw new Error("Could not find the archive's array on main.");
      const at = open + 3;
      data = `${data.slice(0, at)}\n    ${body},${data.slice(at)}`;
      added.push(e.version);
    }
  }
  write(DATA, data);

  // 2. the kept pages' lines
  let pages = read(PAGES);
  const copies = [];
  for (const e of want) {
    const file = fromMap[e.version];
    if (!file) { console.log(`  v${e.version}: no kept page (the archive shows its Text view)`); continue; }
    copies.push(file);
    if (new RegExp(`^\\s*"${e.version.replace(/\./g, "\\.")}"\\s*:`, "m").test(pages)) continue;
    const open = pages.indexOf("{", pages.indexOf("PATCH_NOTE_PAGES"));
    pages = `${pages.slice(0, open + 1)}\n  "${e.version}": "${file}",${pages.slice(open + 1)}`;
  }
  write(PAGES, pages);

  // 3. the kept pages' files
  for (const file of copies) {
    const folder = file.startsWith("pages/") ? path.posix.dirname(`patch-notes/${file}`) : `patch-notes/${file}`;
    if (W) git(["checkout", SRC, "--", folder], W);
    else console.log(`  would copy ${folder}`);
  }

  if (DRY) {
    console.log(`DRY RUN: would add ${added.length ? added.join(", ") : "nothing"}${replaced.length ? `, replace ${replaced.join(", ")}` : ""}; pages: ${copies.join(", ") || "none"}`);
    return;
  }

  // 4. the checks: nothing but patch-notes files, and nothing that imports code
  git(["add", "-A"], W);
  const changed = git(["diff", "--cached", "--name-only", BASE], W).split("\n").filter(Boolean);
  const outside = changed.filter((p) => !ALLOWED(p));
  if (outside.length) throw new Error(`Refusing: these are not patch-notes files: ${outside.join(", ")}`);
  for (const p of [DATA, PAGES]) {
    const bad = importsOk(fs.readFileSync(path.join(W, p), "utf8"));
    if (bad.length) throw new Error(`Refusing: ${p} imports ${bad.join(" | ")}`);
  }
  const { BUILT_IN_PATCH_NOTES: after } = await loadModule(fs.readFileSync(path.join(W, DATA), "utf8"), DATA);
  const vs = after.map((n) => n.version);
  if (new Set(vs).size !== vs.length) throw new Error("Refusing: a version key is used twice on the branch (RUL-TEAM-006).");
  if (flag("--tsc")) {
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(W, "node_modules"));
    execFileSync("npx", ["tsc", "--noEmit", "--skipLibCheck", "--target", "es2020", "--moduleResolution", "bundler", "--module", "esnext", "--strict", DATA, PAGES], { cwd: W, stdio: "inherit" });
    fs.unlinkSync(path.join(W, "node_modules"));
  }
  if (!changed.length) { console.log("Nothing to ship: main already has these notes."); git(["worktree", "remove", "--force", W]); return; }

  const msg = `Patch notes only: v${versions.join(", v")}\n\nFrom ${FROM} (no feature code). Files: ${changed.length}. Made by scripts/patch-notes/ship.mjs.`;
  git(["commit", "-q", "-m", msg], W);
  console.log(`Branch ${branch} (worktree ${W}): ${changed.length} files, all patch-notes files.`);
  if (flag("--pr")) {
    git(["push", "-q", "-u", "origin", branch], W);
    const title = `Patch notes only: v${versions.join(", v")}`;
    const body = `Only patch-notes files (lib/patchNotesData.ts, lib/patchNotePages.ts, patch-notes/). No feature code: the features stay on their branch until pushed.\n\nMade by scripts/patch-notes/ship.mjs.`;
    try {
      const url = execFileSync("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body", body], { cwd: W, encoding: "utf8" }).trim();
      console.log(`PR: ${url}`);
    } catch { console.log(`Pushed ${branch}. Open a PR to main by hand (gh was not available).`); }
  } else {
    console.log(`Next: cd ${W} && git push -u origin ${branch}, then open a PR to main (or run again with --pr).`);
  }
}

main().catch((e) => { cleanup(); console.error(`ship.mjs: ${e.message} (the half-made branch was removed)`); process.exit(1); });
