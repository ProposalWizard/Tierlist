/**
 * tests/star/adminLook.mts — one layout, four skins (Harry, 20 Oct 2026).
 *
 * Where the one back arrow goes (lib/adminRegistry.ts backFor), the Research
 * list (lib/research.ts), and that no admin page keeps its own way back: every
 * Broadcast-frame page uses the frame's arrow (no hard-coded back address),
 * and the old per-look layout switch is gone from the admin home.
 */
import fs from "node:fs";
import { ADMIN_PAGES, GAMES, GROUPS, backFor } from "@/lib/adminRegistry";
import { RESEARCH, researchNewestFirst } from "@/lib/research";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("The back arrow");
ok(backFor("/star-gallery-dev").href === "/admin/star/g/chances", "a test page → its group's page");
ok(backFor("/star-3d-area-dev/office").href === "/admin/star/g/places3d", "a page below a listed page → the listed page's group");
ok(backFor("/admin/star/g/chances").href === "/admin/star", "a Road to Ballon d'Or group → the Ballon d'Or home");
ok(backFor("/admin/star/g/draft").href === "/admin/star/game/web", "a Website games group → that game's home");
ok(backFor("/admin/star/g/research").href === "/admin/star/game/studio", "the Research group → the Studio home");
ok(backFor("/admin/star/game/web").href === GAMES[0].home, "another game's home → the first game's home");
ok(backFor("/admin/star").href === "/", "the admin home → the site");
ok(backFor("/admin/research?x=1").href === "/admin/star/g/research", "a query string is ignored");
ok(backFor("/somewhere-unlisted").href === "/admin/star", "an unlisted page → the admin home");
for (const p of ADMIN_PAGES.filter((x) => x.url !== "/admin/star")) {
  const b = backFor(p.url);
  if (!GROUPS.some((g) => b.href === `/admin/star/g/${g.key}`)) ok(false, `${p.url} goes back to a group page (got ${b.href})`);
}
ok(true, "every listed page goes back to a group page");

console.log("Research");
ok(RESEARCH.length >= 4, "the four first write-ups are listed");
ok(RESEARCH.every((r) => /^https:\/\//.test(r.url) && r.title && r.line && /^\d{4}-\d{2}-\d{2}$/.test(r.date)), "every write-up has a link, a title, a line and a date");
ok(new Set(RESEARCH.map((r) => r.url)).size === RESEARCH.length, "no write-up listed twice");
const sorted = researchNewestFirst();
ok(sorted.every((r, i) => i === 0 || sorted[i - 1].date >= r.date), "newest first");
ok(ADMIN_PAGES.some((p) => p.url === "/admin/research" && p.group === "research"), "the Research page sits in the Research group");
ok(GROUPS.find((g) => g.key === "research")?.game === "studio", "the Research group is on the Studio tab");
ok(fs.existsSync("public/admin/icons/research.webp"), "the Research group has its icon");

console.log("One layout in every look");
const home = fs.readFileSync("app/admin/star/AdminHome.tsx", "utf8");
ok(!/isBoardLook|useAdminLook/.test(home), "the admin home does not change its layout by look");
const shell = fs.readFileSync("components/admin/shell/AdminShell.tsx", "utf8");
ok(!/isBoardLook/.test(shell), "the side menu's groups open the same page in every look");
const framed = fs.readdirSync("app", { recursive: true }).map(String).filter((f) => f.endsWith(".tsx"))
  .filter((f) => fs.readFileSync(`app/${f}`, "utf8").includes("<BroadcastPage"));
const ownBack = framed.filter((f) => /<BroadcastPage[^>]*\sback="/.test(fs.readFileSync(`app/${f}`, "utf8").replace(/\n\s*/g, " ")));
ok(ownBack.length === 0, `no framed page sends its arrow somewhere of its own${ownBack.length ? ` (${ownBack.join(", ")})` : ""}`);

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nadminLook: all passed");
