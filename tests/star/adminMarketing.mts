/**
 * tests/star/adminMarketing.mts — the Marketing tab, slice 1 (21 Oct 2026):
 * the tab in the admin list (admins only), the board file and how branches
 * merge (fake fetch, never the network), the client record and its Brain
 * notes, and the leak guard's own behaviour.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ADMIN_PAGES, GAMES, GROUPS, backFor, gamesFor, gameForPath } from "@/lib/adminRegistry";
import { ADMIN_GUIDES } from "@/lib/adminGuides";
import { STAGES, clearBoardCache, fetchBoard, mergeBoards, parseBoard, repoLink, type VideoCard } from "@/lib/marketing/board";
import { parseClientRecord, parseNote, readClientRecord } from "@/lib/marketing/clientRecord";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("The tab");
const mk = GAMES.find((g) => g.key === "marketing");
ok(!!mk && mk.home === "/admin/marketing", "Marketing is a game tab opening on /admin/marketing");
ok(gamesFor("admin").some((g) => g.key === "marketing") && !gamesFor("tester").some((g) => g.key === "marketing"), "admins see the tab, testers never do");
ok(gamesFor("tester").length === GAMES.length - 1, "testers still see every other tab");
const pages = ADMIN_PAGES.filter((p) => p.group === "marketing");
ok(pages.length === 4 && pages.every((p) => p.access === "admin" && p.section === "marketing"), "four pages (board, client, studio, uploads), all admins only");
ok(GROUPS.find((g) => g.key === "marketing")?.game === "marketing", "the Marketing group sits on the Marketing tab");
ok(gameForPath("/admin/marketing/client") === "marketing", "the client page belongs to the Marketing tab");
ok(backFor("/admin/marketing").href === "/admin/team", "← on the board (a tab's home) goes to the Team area");
ok(pages.every((p) => p.url in ADMIN_GUIDES), "each page has its eye guide");
for (const p of pages) {
  const src = fs.readFileSync(path.join("app", p.url, "page.tsx"), "utf8");
  ok(/components\/admin\/broadcast/.test(src) && /<PageGuide page="/.test(src) && /back=\{null\}/.test(src), `${p.url}: on the Broadcast frame, with the eye, one back arrow`);
}
const guard = spawnSync("node", ["scripts/admin-look-guard.mjs"], { encoding: "utf8" });
ok(guard.status === 0 && /RBD \+ Marketing/.test(guard.stdout), "the admin-look guard checks the Marketing pages too, and passes");

console.log("The board file");
const at = (min: number) => new Date(Date.UTC(2026, 9, 21, 10, min)).toISOString();
const card = (id: string, over: Partial<VideoCard> = {}): VideoCard => ({
  id, title: `Video ${id}`, stage: "idea", owner: "Harry", updated: at(0), postOn: null, line: null,
  script: null, cover: null, video: null, seconds: null, links: [], log: [], ...over,
});
ok(STAGES.map((s) => s.name).join(",") === "Idea,Script,Script OK,Making,In edit,Final check,Posted", "the seven columns, in the plan's order");
{
  const raw = [
    { id: "a", title: " A ", stage: "script", owner: "Mikey", updated: at(1), script: "docs/x.md", links: [{ label: "TikTok", url: "https://tiktok.com/x" }, { label: "bad", url: "http://x" }] },
    { id: "b", title: "B", stage: "nope", owner: "Harry", updated: at(1) },
    { id: "c", title: "C", stage: "idea", owner: "Bob", updated: at(1) },
    { id: "d", title: "D", stage: "idea", owner: "Claude", updated: "not a date" },
    { id: "e", title: "E", stage: "posted", owner: "Claude", updated: at(2), script: "../../etc/passwd", postOn: "21 Oct" },
  ];
  const got = parseBoard(raw);
  ok(got.length === 2 && got[0].title === "A" && got[0].links.length === 1, "bad cards and non-https links are left out");
  ok(got[1].script === null && got[1].postOn === null, "a path that climbs out of the repo, and a bad date, are dropped");
  ok(parseBoard({}).length === 0 && parseBoard(null).length === 0, "not a list → no cards, no crash");
}
{
  const merged = mergeBoards([
    { branch: "main", cards: [card("v1", { stage: "script", updated: at(1) }), card("v2")] },
    { branch: "Harry", cards: [card("v1", { stage: "making", updated: at(5) })] },
    { branch: "Mikey", cards: [card("v1", { stage: "idea", updated: at(3) })] },
  ]);
  const v1 = merged.find((c) => c.id === "v1")!;
  ok(merged.length === 2 && v1.stage === "making" && v1.branch === "Harry", "the newest change to a card wins, and remembers its branch");
  ok(repoLink("docs/a b.md", "Harry").endsWith("/blob/Harry/docs/a%20b.md"), "repo links point at the card's branch");
}
const bundled = JSON.parse(fs.readFileSync("marketing/board.json", "utf8"));
const first = parseBoard(bundled);
ok(first.length === bundled.length && first.length >= 1, "every card in marketing/board.json is valid");
const v01 = first.find((c) => c.id === "v01-patch-0.1-0.3");
ok(!!v01 && v01.stage === "posted" && !!v01.script && !!v01.cover && fs.existsSync(v01.script!) && fs.existsSync(v01.cover!), "v01 is Posted, and its script and cover exist");

console.log("Reading GitHub (fake)");
{
  clearBoardCache();
  const files: Record<string, unknown> = { main: bundled, Harry: [card("v02", { updated: at(9) })] };
  const fake = async (url: string) => {
    const b = decodeURIComponent(url.split("ref=")[1]);
    if (b === "Leo") return { ok: false, status: 500, text: async () => "" };
    if (!(b in files)) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => JSON.stringify(files[b]) };
  };
  const r = await fetchBoard({ fetch: fake, bundled, noCache: true });
  ok(r.from === "github" && r.cards.some((c) => c.id === "v02" && c.branch === "Harry") && r.cards.some((c) => c.id === "v01-patch-0.1-0.3"), "main and a branch merge; a missing file adds nothing");
  ok(r.problems.length === 1 && /500/.test(r.problems[0]), "a branch that fails is named once");
  const down = await fetchBoard({ fetch: async () => { throw new Error("offline"); }, bundled, noCache: true });
  ok(down.from === "bundled" && down.cards.length === first.length, "GitHub down → the copy built into the site");
}

console.log("The client record");
{
  const n = parseNote("RUL-KIB-009", "---\nid: RUL-KIB-009\ntype: ruling\nclient: kib\ntags: [client-kib, rule]\nstatus: draft\ndate: 2026-10-21\nsource: \"x.md:1\"\nsummary: Be short.\n---\nBody line.\n");
  ok(!!n && n.summary === "Be short." && n.status === "draft" && n.tags.length === 2 && n.body === "Body line." && n.source === "x.md:1", "a Brain note is read");
  const rec = parseClientRecord("---\nlabel: K\ncode: KIB\nhomes:\n  board: marketing/board.json\n---\n# K\nIntro.\n## Voice\n- RUL-KIB-009\n- A plain line.\n## Brand\n- FACT-KIB-404\n", (c) => (c === "RUL-KIB-009" ? n : null));
  ok(rec.code === "KIB" && rec.homes.board === "marketing/board.json" && rec.intro[0] === "Intro.", "the record's code, homes and intro");
  ok(rec.sections.length === 2 && rec.sections[0].items[0].kind === "note" && rec.sections[0].items[1].kind === "text", "codes become notes, other lines stay text");
  const missing = rec.sections[1].items[0];
  ok(missing.kind === "note" && missing.note === null, "a code with no note is shown as missing, not dropped");
}
{
  const real = readClientRecord();
  ok(!!real && real.code === "KIB", "marketing/clients/knowitball/client.md reads");
  const titles = real?.sections.map((s) => s.title) ?? [];
  ok(["Who we are", "Voice", "Audience", "Rules", "Brand", "Learnings", "Winning scripts"].every((t) => titles.includes(t)), "it has every section the plan asks for");
  const notes = real?.sections.flatMap((s) => s.items).filter((i) => i.kind === "note") ?? [];
  ok(notes.length >= 10 && notes.every((i) => i.kind === "note" && i.note && i.note.tags.includes("client-kib")), "every code it lists is a real Brain note tagged client-kib");
  ok(fs.readFileSync("brain/_tags.md", "utf8").includes("client-kib |"), "the client-kib tag is in the tag list");
}

console.log("The leak guard");
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kib-guard-"));
  const list = path.join(tmp, "names.txt");
  const run = (env: Record<string, string>) => spawnSync("node", ["scripts/marketing/private-names-guard.mjs"], { encoding: "utf8", env: { ...process.env, KIB_PRIVATE_NAMES: "", KIB_PRIVATE_NAMES_FILE: "", ...env } });
  const skip = run({});
  ok(skip.status === 0 && /skipped/i.test(skip.stdout), "no list given → skips with a clear message");
  fs.writeFileSync(list, "# a word that IS in the repo, to prove it fails\nKnowitball Tierlists\n");
  const hit = run({ KIB_PRIVATE_NAMES_FILE: list });
  ok(hit.status === 1 && /name #1/.test(hit.stderr) && !/Knowitball Tierlists/.test(hit.stderr + hit.stdout), "a planted name fails the guard, and the name itself is never printed");
  // Built at run time, so the word is not in this file either.
  const clean = run({ KIB_PRIVATE_NAMES: `zz${"q".repeat(3)}${Date.now()}` });
  ok(clean.status === 0 && /0 hits/.test(clean.stdout), "a name that is nowhere → passes");
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nadminMarketing: all passed");
