#!/usr/bin/env node
/**
 * scripts/patch-notes/build-headlines.mjs — the 🔔 Inbox's small list
 * (22 Oct 2026). lib/patchNotesData.ts is ~1 MB of words; the bell, on every
 * admin page, only needs each note's version, date, title and author. This
 * writes those to lib/patchNoteHeadlines.json (~20 KB).
 *
 * Runs at the start of `npm run build` and `npm run dev`, so a deploy's list
 * always matches its notes; ship.mjs also runs it on a patch-notes-only
 * branch. tests/star/patchNoteMedia.mts checks the committed copy is current.
 *
 *   node scripts/patch-notes/build-headlines.mjs           write it
 *   node scripts/patch-notes/build-headlines.mjs --check   exit 1 if out of date
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const DATA = "lib/patchNotesData.ts";
export const HEADLINES = "lib/patchNoteHeadlines.json";

/** "Mikey's patch notes …" → Mikey (same rule as lib/teamRoom/extras.ts patchAuthor). */
export function authorOf(title) {
  const m = /^(harry|mikey|leo)['’]s\b/i.exec(String(title ?? "").trim());
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : null;
}

export const headlinesFrom = (notes) =>
  notes.map((n) => ({ version: n.version, title: n.title, publishedAt: n.publishedAt, author: authorOf(n.title) }));

/** The file's text: one note per line, so a diff shows exactly which line changed. */
export const render = (list) => `[\n${list.map((h) => `  ${JSON.stringify(h)}`).join(",\n")}\n]\n`;

export async function buildHeadlines(root) {
  const req = createRequire(path.join(root, "package.json"));
  const ts = req("typescript");
  const src = fs.readFileSync(path.join(root, DATA), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const { BUILT_IN_PATCH_NOTES } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  return render(headlinesFrom(BUILT_IN_PATCH_NOTES));
}

export async function writeHeadlines(root) {
  const text = await buildHeadlines(root);
  const file = path.join(root, HEADLINES);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (old !== text) fs.writeFileSync(file, text);
  return { changed: old !== text, bytes: Buffer.byteLength(text) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  try {
    if (process.argv.includes("--check")) {
      const want = await buildHeadlines(root);
      const have = fs.existsSync(path.join(root, HEADLINES)) ? fs.readFileSync(path.join(root, HEADLINES), "utf8") : "";
      if (want !== have) { console.error(`${HEADLINES} is out of date: run node scripts/patch-notes/build-headlines.mjs`); process.exit(1); }
      console.log(`${HEADLINES} is current.`);
    } else {
      const r = await writeHeadlines(root);
      console.log(`[headlines] ${HEADLINES} ${r.changed ? "written" : "already current"} (${(r.bytes / 1024).toFixed(1)} KB)`);
    }
  } catch (e) {
    // Never block a build over the bell's list: the committed copy still works.
    console.warn(`[headlines] not refreshed: ${e?.message ?? e}`);
    if (process.argv.includes("--check")) process.exit(1);
  }
}
