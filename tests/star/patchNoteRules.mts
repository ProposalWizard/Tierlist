/**
 * Every patch note keeps the team's rules (scripts/patch-notes/rules.mjs,
 * Brain RUL-TEAM-028, Leo 26 Oct 2026): who made it, the real time, every
 * update with its time and where, its own number, a menu name, and a page
 * that opens the same way as everyone else's.
 */
import fs from "node:fs";
import path from "node:path";
import { BUILT_IN_PATCH_NOTES } from "../../lib/patchNotesData";
import { PATCH_NOTE_PAGES } from "../../lib/patchNotePages";
import { PATCH_VERSION_ALIASES, canonicalPatchVersion } from "../../lib/patchVersionAliases";
// @ts-expect-error plain JS module, shared with scripts/patch-notes/ship.mjs
import { noteProblems, RETIRED_NUMBERS } from "../../scripts/patch-notes/rules.mjs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("Every note keeps the rules");
const problems = BUILT_IN_PATCH_NOTES.flatMap((n) => noteProblems(n, BUILT_IN_PATCH_NOTES) as string[]);
for (const p of problems.slice(0, 30)) console.error("   ", p);
ok(problems.length === 0, `${BUILT_IN_PATCH_NOTES.length} notes: author, title, time, own number, updates (${problems.length} problems)`);

console.log("Every note opens on a page");
const root = path.join(process.cwd(), "patch-notes");
const noPage = BUILT_IN_PATCH_NOTES.filter((n) => !PATCH_NOTE_PAGES[n.version] || !fs.existsSync(path.join(root, PATCH_NOTE_PAGES[n.version])));
ok(noPage.length === 0, `every note has a kept page (missing: ${noPage.map((n) => n.version).join(", ") || "none"})`);

console.log("Renumbered notes");
ok(Object.keys(PATCH_VERSION_ALIASES).every((o) => RETIRED_NUMBERS.includes(o)), "every old number is retired");
ok(Object.values(PATCH_VERSION_ALIASES).every((v) => BUILT_IN_PATCH_NOTES.some((n) => n.version === v)), "every new number is a note");
ok(canonicalPatchVersion("0.110") === "0.121" && canonicalPatchVersion("0.110@2026-10-26T03:42:00Z") === "0.121@2026-10-26T03:42:00Z" && canonicalPatchVersion("0.110h") === "0.110h", "old keys (plain and read keys) map to the new number; Harry's stay");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll passed");
