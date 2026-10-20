/**
 * tests/star/teamBoard.mts — the team board's rules (lib/teamBoard.ts).
 *
 * Who a push or pull request belongs to, which patch note a push went out in,
 * and that the GitHub read never throws and never reaches the network here.
 */
import { fetchTeamBoard, noteOwner, ownWork, patchFor, perDay, personFor, pushCount, pushLog, sessionOwners, splitMessage, NOTE_REACH_MS } from "@/lib/teamBoard";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { ADMIN_PAGES, relatedFor, currentPage, visibleTo } from "@/lib/adminRegistry";
import { ADMIN_GUIDES } from "@/lib/adminGuides";
import { extractUpdate, parseBars, parseWaiting, scrub } from "@/lib/devStatus";
// @ts-expect-error plain .mjs hook, no types
import { extractUpdate as hookExtract } from "../../scripts/hooks/post-status-hook.mjs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("Who owns what");
ok(noteOwner({ title: "Harry's patch notes: The Arcade pack" }) === "Harry", "Harry's note");
ok(noteOwner({ title: "Mikey's patch notes v0.16: Gameplay" }) === "Mikey", "Mikey's note");
ok(noteOwner({ title: "Leo's patch notes — goal videos" }) === "Leo", "Leo's note");
ok(noteOwner({ title: "Knowitball v0.1" }) === null, "a note with no owner in its title");
ok(personFor("Harry") === "Harry" && personFor("leo") === "Leo", "branch named after a person");
ok(personFor("claude/recover-tierlist-website-3BajA", "LeoVassiliou") === "Leo", "stray branch → PR opener (Leo's v0.16 trap)");
ok(personFor("claude/x", "someone-else") === null, "unknown opener stays unknown");
ok(BUILT_IN_PATCH_NOTES.filter((n) => noteOwner(n)).length >= BUILT_IN_PATCH_NOTES.length - 3, "nearly every real note has an owner");

console.log("Which patch note a push went out in");
const notes = [
  { version: "0.55", title: "Leo's patch notes: Updates tab", publishedAt: "2026-10-14T21:00:00Z", artifactUrl: "https://claude.ai/artifact/L55" },
  { version: "0.54", title: "Harry's patch notes: New chances", publishedAt: "2026-10-14T16:00:00Z", artifactUrl: "https://claude.ai/artifact/H54" },
  { version: "0.56", title: "Harry's patch notes: The Arcade pack", publishedAt: "2026-10-14T23:30:00Z", artifactUrl: null },
  { version: "0.50", title: "Mikey's patch notes v0.16: Gameplay review", publishedAt: "2026-10-13T17:00:00Z", artifactUrl: null },
];
const h1 = patchFor({ person: "Harry", at: "2026-10-14T12:00:00Z", title: "Chances: build-ups" }, notes);
ok(h1?.version === "0.54" && h1.how === "time", "Harry's push before 0.54 → 0.54");
const h2 = patchFor({ person: "Harry", at: "2026-10-14T17:00:00Z", title: "Fix a thing" }, notes);
ok(h2?.version === "0.54", "an hour after go-live still counts (2 h grace)");
const h3 = patchFor({ person: "Harry", at: "2026-10-14T19:00:00Z", title: "Arcade banners" }, notes);
ok(h3?.version === "0.56", "3 h after 0.54 → the next one, 0.56");
ok(patchFor({ person: "Harry", at: "2026-10-15T09:00:00Z", title: "New work" }, notes) === null, "after the last note → none yet");
const named = patchFor({ person: "Harry", at: "2026-10-14T12:00:00Z", title: "Patch notes v0.56 page" }, notes);
ok(named?.version === "0.56" && named.how === "named", "a push naming v0.56 → 0.56");
const mk = patchFor({ person: "Mikey", at: "2026-10-12T10:00:00Z", title: "Patch notes v0.16" }, notes);
ok(mk?.version === "0.50" && mk.how === "named", "Mikey's own number (v0.16) found in the title → site 0.50");
ok(patchFor({ person: "Leo", at: "2026-10-14T12:00:00Z", title: "v0.54 tweak" }, notes)?.version === "0.55", "another person's version is never used");
ok(patchFor({ person: null, at: "2026-10-14T12:00:00Z", title: "x" }, notes) === null, "no person → no note");
ok(patchFor({ person: "Harry", at: new Date(Date.parse("2026-10-14T16:00:00Z") - NOTE_REACH_MS - 1000).toISOString(), title: "old" }, notes) === null, "more than 4 days before → not linked");

console.log("Messages and the activity bars");
const m = splitMessage("Fix the keeper\n\nLonger words.\n\nCo-Authored-By: Claude <x>\nClaude-Session: https://claude.ai/code/session_1");
ok(m.title === "Fix the keeper" && m.body === "Longer words." && m.session === "https://claude.ai/code/session_1", "headline, body, session; attribution dropped");
const now = Date.parse("2026-10-18T12:00:00Z");
const bars = perDay([{ at: "2026-10-18T09:00:00Z" }, { at: "2026-10-18T01:00:00Z" }, { at: "2026-10-16T09:00:00Z" }, { at: "2026-10-01T09:00:00Z" }], now, 7);
ok(bars.length === 7 && bars[6] === 2 && bars[4] === 1 && bars.reduce((a, b) => a + b, 0) === 3, "pushes per day, oldest first, older than a week ignored");

console.log("GitHub read (fake fetch)");
const commit = (sha: string, msg: string, date: string) => ({ sha, html_url: `https://g/${sha}`, commit: { message: msg, committer: { date } } });
const calls: string[] = [];
const fake = async (url: string) => {
  calls.push(url);
  const body = url.includes("/commits/main/status")
    ? { state: "success", statuses: [{ context: "Vercel", state: "success", updated_at: "2026-10-18T10:00:00Z" }] }
    : url.includes("sha=Harry") ? [commit("aaa1111", "Arcade banners", "2026-10-14T19:00:00Z")]
    : url.includes("sha=main") ? [commit("mmm0000", "Merge Harry", "2026-10-18T09:59:00Z")]
    : url.includes("/pulls?") ? [{ number: 740, title: "Leo v0.16", html_url: "u", state: "open", merged_at: null, created_at: "2026-10-14T20:00:00Z", updated_at: "2026-10-14T20:00:00Z", user: { login: "LeoVassiliou" }, head: { ref: "claude/abc" } }]
    : url.includes("/pulls/740/commits") ? [commit("lll2222", "Updates tab", "2026-10-14T20:00:00Z")]
    : [];
  return { ok: true, status: 200, json: async () => body };
};
const d = await fetchTeamBoard({ fetch: fake, notes, now, noCache: true });
ok(d.problems.length === 0, "no problems");
ok(d.deploy.state === "success" && d.deploy.sha === "mmm0000", "deploy state from main's Vercel status");
ok(d.people.find((p) => p.person === "Harry")?.pushes[0]?.patch?.version === "0.56", "Harry's push linked to 0.56");
ok(d.people.find((p) => p.person === "Leo")?.pushes.some((p) => p.sha === "lll2222" && p.patch?.version === "0.55") ?? false, "Leo's open-PR work from a claude/ branch shows on Leo's card, linked to 0.55");
ok(d.pulls[0]?.person === "Leo" && d.pulls[0]?.state === "open", "PR named by its opener");
ok(calls.every((u) => u.startsWith("https://api.github.com/")), "only GitHub's API is called");
const bad = await fetchTeamBoard({ fetch: async () => ({ ok: false, status: 403, json: async () => ({}) }), notes, now, noCache: true });
ok(bad.problems.some((p) => p.includes("limiting")), "rate limit → a plain-English problem, no throw");
const down = await fetchTeamBoard({ fetch: async () => { throw new Error("offline"); }, notes, now, noCache: true });
ok(down.problems.length > 0 && down.people.length === 3, "GitHub unreachable → still three cards");
ok(down.problems.length === 1, `one line for everything GitHub could not be reached for, not one per read (${down.problems.length})`);

console.log("A refused key (B13)");
{
  // Like a local test build: the computer's GITHUB_TOKEN is refused. The
  // board asks again without it (the repository is public) and says so once.
  const asked: { url: string; auth: boolean }[] = [];
  const refusing = async (url: string, init?: { headers?: Record<string, string> }) => {
    const auth = !!init?.headers?.Authorization;
    asked.push({ url, auth });
    if (auth) return { ok: false, status: 401, json: async () => ({}) };
    return fake(url);
  };
  const local = await fetchTeamBoard({ fetch: refusing, notes, now, noCache: true, token: "bad", where: "local" });
  ok(local.problems.length === 1 && local.problems[0].includes("local test build") && !local.problems[0].includes("Check GITHUB_TOKEN in Vercel"),
    `local build: one line saying the key is this computer's, not Vercel's (${local.problems.join(" | ")})`);
  ok(local.people.find((p) => p.person === "Harry")?.pushes.length === 1, "and the board still shows, read without the key");
  // The first reads go out together, so each tries the key once; reads after
  // the refusal (the push log's next pages, open PRs) leave it off.
  const firstBatch = asked.filter((a) => a.auth).length;
  ok(firstBatch <= 7 && asked.length - firstBatch >= firstBatch, `the refused key is tried once per first read, never again (${firstBatch} with the key, ${asked.length - firstBatch} without)`);
  const live = await fetchTeamBoard({ fetch: refusing, notes, now, noCache: true, token: "bad", where: "live" });
  ok(live.problems.length === 1 && live.problems[0].includes("Vercel"), "live site: the one line points at GITHUB_TOKEN in Vercel");
  const none = await fetchTeamBoard({ fetch: fake, notes, now, noCache: true, token: null });
  ok(none.problems.length === 0, "no key at all: GitHub still answers, no line");
}

console.log("Pushes counted from GitHub's push log (B13)");
{
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  const ev = (login: string, h: number, branch: string, head: string) =>
    ({ type: "PushEvent", created_at: at(h), actor: { login }, payload: { ref: `refs/heads/${branch}`, head } });
  const events = [
    ev("harryv2157-dev", 1, "Harry", "h1"), ev("harryv2157-dev", 2, "Harry", "h2"), ev("harryv2157-dev", 30, "main", "h3"),
    ev("ProposalWizard", 5, "Mikey", "m1"), ev("LeoVassiliou", 200, "Leo", "l1"),
    { type: "PullRequestEvent", created_at: at(3), actor: { login: "harryv2157-dev" } },
  ];
  const log = pushLog(events, true);
  ok(log.pushes.length === 5, "only push events count");
  const harry = pushCount(log, "Harry", now);
  ok(harry.week === 3 && harry.weekComplete, `Harry: 3 pushes this week, on any branch (${harry.week})`);
  ok(pushCount(log, "Leo", now).week === 0, "Leo's push 8 days ago is not this week");
  ok(harry.days.length === 14 && harry.days[13] === 2 && harry.days[12] === 1, "per day, oldest first");
  // A log that ran out (GitHub keeps the last 300 events) two days back.
  const short = pushLog(events.filter((e) => Date.parse(e.created_at) > now - 40 * 3600_000), false);
  const hs = pushCount(short, "Harry", now);
  ok(!hs.weekComplete && hs.days.slice(0, 11).every((d) => d === null) && hs.days[13] === 2, "a short log: \"at least\", and older days unknown, not zero");
  // Whose chat made a commit: the person who pushed it.
  const session: Record<string, string> = { h1: "S-harry", h2: "S-harry", h3: "S-harry", m1: "S-mikey" };
  const owners = sessionOwners(log.pushes, (sha) => session[sha] ?? null);
  ok(owners.get("S-harry") === "Harry" && owners.get("S-mikey") === "Mikey", "each chat belongs to whoever pushed its work");
  const c = (sha: string, s: string | null) => ({ sha, title: sha, body: "", at: at(1), branch: "Harry", person: "Harry" as const, url: "", session: s, patch: null });
  const onHarry = [c("a", "S-harry"), c("b", "S-mikey"), c("c", null), c("d", null), c("e", "S-unknown")];
  const own = ownWork(onHarry, "Harry", owners, new Set(["d", "e"]));
  ok(own.map((x) => x.sha).join("") === "ac", `Harry's card keeps his own work, drops Mikey's merged in from main (${own.map((x) => x.sha).join("")})`);
}

console.log("The page list");
const urls = ADMIN_PAGES.map((p) => p.url);
ok(new Set(urls).size === urls.length, "no page listed twice");
ok(urls.every((u) => u in ADMIN_GUIDES || u === "/star-dev" || u === "/admin"), "every listed admin page has a help eye entry");
for (const gone of ["/star-match-dev", "/star-scenario-dev", "/star-bigger-dev", "/ballon-dor", "/manager", "/draft-dev2"])
  ok(!urls.includes(gone), `Harry's delete list: ${gone} not listed`);
ok(visibleTo("tester").every((p) => p.access !== "admin"), "testers never see admin-only pages");
ok(relatedFor("/star-dev")?.pages.some((p) => p.url === "/star-gallery-dev") ?? false, "admin mode on the game → the gallery is offered");
ok(relatedFor("/draft/history")?.pages.some((p) => p.url === "/admin/football/players") ?? false, "on the Draft → SoFIFA players");
ok(currentPage("/admin/football/players")?.url === "/admin/football/players", "longest match wins");
ok((relatedFor("/star-gallery-dev")?.pages ?? []).every((p) => p.group === "chances"), "on a tool → the rest of its group");

console.log("Live bars");
const upd = `Here is where we are.

UPDATE · 14:20
Camera tilt 20°        ██████████ 100%  pushed
Keeper dive fix        ████████░░  80%  filming to check · ~10 min left
Started 14:05 · est. done ~14:50
Waiting on: you, to merge Harry → main
Some chatter with a key eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc`;
const lb = parseBars(upd);
ok(lb.length === 2 && lb[0].label === "Camera tilt 20°" && lb[0].pct === 100 && lb[1].pct === 80, "two bars read with label and %");
ok(lb[1].note.startsWith("filming to check"), "the words after the bar kept");
ok(parseWaiting(upd) === "you, to merge Harry → main", "Waiting on read");
const ex = extractUpdate(upd);
ok(!ex.includes("chatter") && !ex.includes("Here is where") && ex.includes("Keeper dive fix") && ex.includes("Waiting on"), "only bar / started / waiting lines are sent");
ok(extractUpdate("No bars in this message at all.") === "", "no bars → nothing sent");
ok(scrub("key ghp_abcdefghijklmnop1234 and eyJaaaaaaaaaaaa.bbbbbbbbbbbbb.c") === "key [key] and [key]", "key-shaped text blanked");
ok(hookExtract(upd) === ex, "the hook keeps exactly what the site's rules keep");

console.log("The one lock (test run only: Harry, ADM-Q110 B)");
{
  const fs = await import("node:fs");
  const own = new Set(["/star-dev", "/admin", "/admin/patch-notes"]); // open game; /admin and patch notes check inside the page
  const gated = (url: string) => {
    for (let u = url; u.length > 1; u = u.slice(0, u.lastIndexOf("/")) || "/") {
      const f = `app${u}/layout.tsx`;
      if (fs.existsSync(f) && fs.readFileSync(f, "utf8").includes("DevGate")) return true;
    }
    return false;
  };
  const missing = ADMIN_PAGES.filter((p) => !own.has(p.url) && !gated(p.url)).map((p) => p.url);
  ok(missing.length === 0, `every admin/test page has the lock${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nteamBoard: all passed");
