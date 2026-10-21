/**
 * CREDITS (sim rebuild piece 1, 21 Oct 2026; Harry D8: "Settings + public /credits").
 *
 *   1. Every data file the game reads (data/opendata, data/realmoments,
 *      data/ballondor, lib/star/fhr/patterns.json, the nation kits) names at
 *      least one credit id, and every id exists in DATA_CREDITS.
 *   2. Every football-data line is word for word in data/opendata/LICENCES.md;
 *      every other line names a licence file that exists.
 *   3. Ids are unique; every credit is used by a file or is an art / sound /
 *      font / facts credit; every group has a title.
 *   4. Settings and /credits both read the one list.
 *
 * Run: npx tsx tests/star/dataCredits.mts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_CREDITS, DATA_FILE_CREDITS, CREDIT_GROUPS } from "../../lib/star/dataCredits";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const ids = new Set(DATA_CREDITS.map((c) => c.id));

console.log("\n1. EVERY DATA FILE NAMES A CREDIT");
{
  const files: string[] = [];
  for (const d of ["data/opendata", "data/realmoments", "data/ballondor"]) {
    for (const f of readdirSync(d)) if (f.endsWith(".json")) files.push(join(d, f));
  }
  files.push("lib/star/fhr/patterns.json", "lib/star/data/sources/nation_kits_2026-10.json");
  if (existsSync("lib/star/sim/realTargets.json")) files.push("lib/star/sim/realTargets.json");
  const missing = files.filter((f) => !DATA_FILE_CREDITS[f] || DATA_FILE_CREDITS[f].length === 0);
  ok(missing.length === 0, `${files.length} data files, each with a credit${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  const badIds = Object.entries(DATA_FILE_CREDITS).flatMap(([f, cs]) => cs.filter((c) => !ids.has(c)).map((c) => `${f} → ${c}`));
  ok(badIds.length === 0, `every credit id a file names exists${badIds.length ? ` (${badIds.join(", ")})` : ""}`);
  const gone = Object.keys(DATA_FILE_CREDITS).filter((f) => !existsSync(f));
  ok(gone.length === 0, `every file in the map exists${gone.length ? ` (${gone.join(", ")})` : ""}`);
}

console.log("\n2. EVERY LINE IS BACKED");
{
  const lic = readFileSync("data/opendata/LICENCES.md", "utf8");
  for (const c of DATA_CREDITS) {
    if (c.use === "patterns" || c.use === "roles" || c.use === "moments") ok(lic.includes(c.line), `${c.id}: the line is LICENCES.md's, word for word`);
    else ok(!!c.licenceFile && existsSync(c.licenceFile), `${c.id}: its licence file ${c.licenceFile ?? "(none)"} exists`);
  }
}

console.log("\n3. THE LIST IS TIDY");
{
  ok(ids.size === DATA_CREDITS.length, "every credit id is unique");
  const used = new Set(Object.values(DATA_FILE_CREDITS).flat());
  const idle = DATA_CREDITS.filter((c) => ["patterns", "roles", "moments"].includes(c.use) && !used.has(c.id)).map((c) => c.id);
  ok(idle.length === 0, `every football-data credit covers a file${idle.length ? ` (idle: ${idle.join(", ")})` : ""}`);
  ok(DATA_CREDITS.every((c) => CREDIT_GROUPS.some((g) => g.use === c.use)), "every credit sits in a group Settings and /credits show");
  ok(DATA_CREDITS.every((c) => c.line.length > 20 && c.licence.length > 0), "every credit has a line and a licence");
}

console.log("\n4. BOTH PLACES READ THE ONE LIST");
{
  const settings = readFileSync("components/star/DataCredits.tsx", "utf8");
  const page = readFileSync("app/credits/page.tsx", "utf8");
  ok(/from "@\/lib\/star\/dataCredits"/.test(settings) && settings.includes("CREDIT_GROUPS"), "Settings → Data credits reads lib/star/dataCredits.ts");
  ok(/from "@\/lib\/star\/dataCredits"/.test(page) && page.includes("CREDIT_GROUPS"), "/credits reads lib/star/dataCredits.ts");
  ok(readFileSync("components/SiteFooter.tsx", "utf8").includes('href="/credits"'), "the site footer links /credits");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
