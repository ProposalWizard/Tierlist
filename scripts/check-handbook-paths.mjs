#!/usr/bin/env node
// Checks that every repo path named in backticks in docs/3D_HANDBOOK.md (and the
// 3d-building skill) exists. Run: node scripts/check-handbook-paths.mjs
import { readFileSync, existsSync } from "node:fs";

const files = ["docs/3D_HANDBOOK.md", ".claude/skills/3d-building/SKILL.md"];
const roots = /^(lib|components|app|tools|scripts|public|tests|docs|\.claude|data|supabase)\//;
let bad = 0;
for (const f of files) {
  if (!existsSync(f)) { console.log(`MISSING FILE ${f}`); bad++; continue; }
  const text = readFileSync(f, "utf8");
  const seen = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    for (const tok of m[1].split(/\s+/)) {
      const p = tok.replace(/[.,;:)]+$/, "").replace(/^\(/, "");
      if (!roots.test(p) || /[<>*{}$]|\.\.\./.test(p) || seen.has(p)) continue;
      seen.add(p);
      if (!existsSync(p)) { console.log(`MISSING  ${f}: ${p}`); bad++; }
    }
  }
}
console.log(bad ? `${bad} missing` : "all paths exist");
process.exit(bad ? 1 : 0);
