#!/usr/bin/env node
/**
 * scripts/brain/bundle-for-site.mjs — the Brain, small enough for the site's
 * AI bots to search (13 Nov 2026, lib/teamRoom/claudeBot.ts brainSearch).
 *
 * Reads every live note in brain/<type>/<CODE>.md and writes one file,
 * lib/teamRoom/brainBundle.json: code, summary, tags and the note's few lines.
 * Runs at the start of `npm run build` and `npm run dev`, so a deploy's copy
 * always matches its notes. About 100 KB.
 *
 *   node scripts/brain/bundle-for-site.mjs           write it
 *   node scripts/brain/bundle-for-site.mjs --check   exit 1 if out of date
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = "lib/teamRoom/brainBundle.json";

export function bundle(root) {
  const dir = path.join(root, "brain");
  const notes = [];
  for (const type of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!type.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(dir, type.name))) {
      if (!f.endsWith(".md")) continue;
      const raw = fs.readFileSync(path.join(dir, type.name, f), "utf8").replace(/\r/g, "");
      const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
      if (!m) continue;
      const head = Object.fromEntries(m[1].split("\n").map((l) => { const i = l.indexOf(":"); return i < 0 ? ["", ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
      if (!head.id || head.status !== "live" || !head.summary) continue;
      notes.push({ id: head.id, summary: head.summary.replace(/^"|"$/g, ""), tags: (head.tags ?? "").replace(/[\[\]\s]/g, ""), body: m[2].trim().slice(0, 1500) });
    }
  }
  notes.sort((a, b) => a.id.localeCompare(b.id));
  return `[\n${notes.map((n) => `  ${JSON.stringify(n)}`).join(",\n")}\n]\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const want = bundle(root);
  const file = path.join(root, OUT);
  const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (process.argv.includes("--check")) {
    if (want !== have) { console.error(`${OUT} is out of date: run node scripts/brain/bundle-for-site.mjs`); process.exit(1); }
    console.log(`${OUT} is current.`);
  } else {
    if (want !== have) fs.writeFileSync(file, want);
    console.log(`${OUT}: ${JSON.parse(want).length} notes, ${Math.round(Buffer.byteLength(want) / 1024)} KB${want !== have ? "" : " (no change)"}`);
  }
}
