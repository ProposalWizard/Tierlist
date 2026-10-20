/**
 * tests/star/teamRoomJobs.mts — jobs that arrive by push (lib/teamRoom/jobs.ts):
 * reading team/jobs.json, merging main and each person's branch by id,
 * reading GitHub with a fake fetch (never the network), the tick rows in
 * team_tasks staying out of the ordinary lists, and the To-do badge.
 */
import fs from "node:fs";
import {
  clearJobsCache, fetchTeamJobs, isJobMarker, jobOwners, markerJobId, markerTitle, mergeJobs, newPushedJobs, parseJobs, pushedFor,
  type TeamJob,
} from "@/lib/teamRoom/jobs";
import { newGivenTasks, tasksFor, tasksGivenBy, type TeamTask } from "@/lib/teamRoom/logic";
import { BUNDLED_JOBS, TEAM_ROOM } from "@/lib/teamRoom/config";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (min: number) => new Date(Date.UTC(2026, 9, 20, 10, min)).toISOString();

const job = (id: string, over: Partial<TeamJob> = {}): TeamJob =>
  ({ id, owner: "all", title: `Job ${id}`, prompt: null, from: "Harry", added: at(0), ...over });

console.log("Reading the jobs file");
{
  const raw = [
    { id: "a-1", owner: "Mikey", title: " Do it ", from: "Harry", added: "2026-10-20" },
    { id: "b", owner: "all", title: "x".repeat(300), prompt: "p".repeat(5000), from: "Leo", added: at(5) },
    { id: "bad id!", owner: "Leo", title: "t", from: "Harry", added: at(1) },
    { id: "c", owner: "Bob", title: "t", from: "Harry", added: at(1) },
    { id: "d", owner: "Leo", title: "", from: "Harry", added: at(1) },
    { id: "e", owner: "Leo", title: "t", from: "Harry", added: "not a date" },
    { id: "f", owner: "Leo", title: "t", from: "nobody", added: at(1) },
    null, "text", 7,
  ];
  const jobs = parseJobs(raw);
  ok(jobs.map((j) => j.id).join() === "a-1,b", `only well-formed jobs kept (${jobs.map((j) => j.id).join()})`);
  ok(jobs[0].title === "Do it" && jobs[0].prompt === null, "title trimmed; no prompt = null");
  ok(jobs[1].title.length === 200 && jobs[1].prompt?.length === 4000, "title cut to 200, prompt to 4000");
  ok(parseJobs({ id: "x" }).length === 0 && parseJobs(null).length === 0, "not a list → no jobs, no crash");
  ok(jobOwners(job("x")).join() === "Harry,Mikey,Leo" && jobOwners(job("x", { owner: "Leo" })).join() === "Leo", "owner all = each of the three");
}

console.log("The jobs file in the repo");
{
  const file = JSON.parse(fs.readFileSync("team/jobs.json", "utf8"));
  const jobs = parseJobs(file);
  ok(Array.isArray(file) && jobs.length === file.length, "every job in team/jobs.json is well formed");
  ok(new Set(jobs.map((j) => j.id)).size === jobs.length, "no id twice");
  ok(parseJobs(BUNDLED_JOBS).length === jobs.length, "the copy built into the site is the same file");
  const lag = jobs.find((j) => j.id === "lag-test-2026-10-20");
  ok(!!lag && lag.owner === "all" && lag.from === "Harry", "the lag test job: for all three, from Harry");
  ok(lag?.title === "Lag test on your phone, 10 min, after the next push: ⚙ (top right of Home) → 🛠 Dev → Start lag test. Copy the prompt into your Claude chat first.", "its title as asked");
  const md = fs.readFileSync("docs/handoffs/2026-10-20-builds/lag-test-todos.md", "utf8");
  const block = md.split("## The prompt")[1].split("```")[1].replace(/^\n/, "").replace(/\n$/, "");
  ok(lag?.prompt === block, "its prompt is exactly the handoff's prompt block");
  ok(fs.existsSync("team/README.md"), "team/README.md says how to add one");
}

console.log("Merging main and each branch");
{
  const main = [job("a", { title: "old", added: at(0) }), job("b")];
  const harry = [job("a", { title: "new", added: at(10) }), job("c", { added: at(3) })];
  const mikey = [job("a", { title: "older", added: at(-5) })];
  const m = mergeJobs([main, harry, mikey]);
  ok(m.map((j) => j.id).join() === "a,c,b", `one per id, newest first (${m.map((j) => j.id).join()})`);
  ok(m[0].title === "new", "a clash: the newest added wins, whatever the branch order");
  const tie = mergeJobs([[job("a", { title: "main" })], [job("a", { title: "branch" })]]);
  ok(tie.length === 1 && tie[0].title === "branch", "same added: the later list (a person's branch) wins over main");
}

console.log("Reading GitHub (fake fetch)");
{
  const res = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
  const asked: { url: string; auth: boolean }[] = [];
  const files: Record<string, number | unknown> = {
    main: 404,
    Harry: [job("from-harry", { owner: "Mikey", added: at(20) })],
    Mikey: [{ ...job("lag-test-2026-10-20"), title: "Lag test, edited", added: "2026-10-21T09:00:00Z" }],
    Leo: 404,
  };
  const fake = async (url: string, init?: { headers?: Record<string, string> }) => {
    asked.push({ url, auth: !!init?.headers?.Authorization });
    const ref = decodeURIComponent(/[?&]ref=([^&]+)/.exec(url)?.[1] ?? "");
    const f = files[ref];
    return typeof f === "number" ? res(f, {}) : res(200, f);
  };
  clearJobsCache();
  const d = await fetchTeamJobs({ fetch: fake, bundled: BUNDLED_JOBS, now: Date.parse(at(30)), noCache: true });
  ok(asked.length === 4 && asked.every((a) => a.url.startsWith(`https://api.github.com/repos/${TEAM_ROOM.jobs.repo}/contents/${TEAM_ROOM.jobs.path}?ref=`)), "asks GitHub only, once per branch: main, Harry, Mikey, Leo");
  ok(d.from === "github" && d.problems.length === 0, "read live, no problems (a branch with no file is fine)");
  ok(d.jobs.some((j) => j.id === "from-harry"), "a job pushed to Harry's branch shows with no deploy");
  ok(d.jobs.find((j) => j.id === "lag-test-2026-10-20")?.title === "Lag test, edited", "main has no file yet → the built-in copy stands in, and Mikey's newer edit wins");

  const down = await fetchTeamJobs({ fetch: async () => { throw new Error("offline"); }, bundled: BUNDLED_JOBS, noCache: true });
  ok(down.from === "bundled" && down.jobs.length === parseJobs(BUNDLED_JOBS).length && down.problems.length === 2 && down.problems.some((p) => p.includes("built into the site")), `GitHub unreachable → the jobs built into the site, and why: one line for all four branches (${down.problems.join(" | ")})`);
  const limited = await fetchTeamJobs({ fetch: async () => res(403, {}), bundled: BUNDLED_JOBS, noCache: true });
  ok(limited.from === "bundled" && limited.problems.some((p) => p.includes("limiting")), "rate limited everywhere → built-in copy, and why");

  const broken = await fetchTeamJobs({
    fetch: async (url) => (url.includes("ref=Leo") ? res(200, "[{ not json") : url.includes("ref=main") ? res(200, [job("m")]) : res(404, {})),
    bundled: [], noCache: true,
  });
  ok(broken.from === "github" && broken.jobs.map((j) => j.id).join() === "m" && broken.problems.some((p) => p.includes("Leo's branch") && p.includes("not valid JSON")),
    "one branch's file broken → the rest still show, and the line names the branch");
  const half = await fetchTeamJobs({
    fetch: async (url) => (url.includes("ref=main") ? res(200, [job("m"), { id: "no-title" }]) : res(404, {})), bundled: [], noCache: true,
  });
  ok(half.jobs.length === 1 && half.problems.some((p) => p.includes("1 job") && p.includes("left out")), "a malformed job is left out and counted");

  // A refused key: the repository is public, so ask again without it.
  const tried: boolean[] = [];
  const refusing = async (url: string, init?: { headers?: Record<string, string> }) => {
    tried.push(!!init?.headers?.Authorization);
    return init?.headers?.Authorization ? res(401, {}) : fake(url);
  };
  const r = await fetchTeamJobs({ fetch: refusing, bundled: BUNDLED_JOBS, token: "bad", noCache: true });
  ok(r.from === "github" && r.jobs.some((j) => j.id === "from-harry") && r.problems.some((p) => p.includes("refused")), "a refused key → read without it, one line saying so");

  // Kept about a minute on the server.
  clearJobsCache();
  let n = 0;
  const counting = async (url: string) => { n++; return fake(url); };
  await fetchTeamJobs({ fetch: counting, bundled: BUNDLED_JOBS, now: 1_000_000 });
  await fetchTeamJobs({ fetch: counting, bundled: BUNDLED_JOBS, now: 1_000_000 + 30_000 });
  ok(n === 4, `a second read within a minute uses the kept answer (${n} asks)`);
  await fetchTeamJobs({ fetch: counting, bundled: BUNDLED_JOBS, now: 1_000_000 + TEAM_ROOM.jobs.refreshMs + 1 });
  ok(n === 8, "after a minute it asks GitHub again");
  clearJobsCache();
}

console.log("Ticks live in team_tasks, never as jobs of their own");
{
  const jobs = [job("lag", { owner: "all", added: at(1) }), job("for-leo", { owner: "Leo", added: at(2) }), job("for-harry", { owner: "Harry", from: "Mikey", added: at(3) })];
  ok(markerTitle(jobs[0]) === "[job:lag] Job lag", "the tick row's title");
  ok(markerTitle(job("x", { title: "y".repeat(300) })).length === 200, "cut to 200 (the table's limit)");
  const NOW = Date.parse(at(60));
  const tasks: TeamTask[] = [
    { id: 1, owner: "Harry", made_by: "Harry", title: markerTitle(jobs[0]), done_at: at(50), created_at: at(49) },
    { id: 2, owner: "Mikey", made_by: "Mikey", title: markerTitle(jobs[0]), done_at: null, created_at: at(40) },
    { id: 3, owner: "Harry", made_by: "Harry", title: "my own job", done_at: null, created_at: at(5) },
    { id: 4, owner: "Harry", made_by: "Leo", title: "[job:lag] typed by Leo", done_at: null, created_at: at(6) },
  ];
  ok(markerJobId(tasks[0]) === "lag" && isJobMarker(tasks[1]), "a tick row is recognised");
  ok(!isJobMarker(tasks[2]) && !isJobMarker(tasks[3]), "an ordinary job, or one given by someone else, never is");
  const l = tasksFor(tasks, "Harry", NOW);
  ok(l.mine.map((x) => x.id).join() === "3" && l.done.length === 0 && l.given.map((x) => x.id).join() === "4", "tick rows are hidden from Mine and Done today");
  ok(tasksGivenBy(tasks, "Mikey").length === 0 && newGivenTasks(tasks, "Mikey", 0) === 0, "and from Jobs I gave and the given-job count");

  const h = pushedFor(jobs, tasks, "Harry", NOW);
  ok(h.open.map((j) => j.id).join() === "for-harry" && h.done.map((j) => j.id).join() === "lag", "Harry: the lag test ticked, his own job open; Leo's job not on his list");
  ok(h.done[0].markers.join() === "1" && h.done[0].done_at === at(50), "done with his own tick's time");
  const mk = pushedFor(jobs, tasks, "Mikey", NOW);
  ok(mk.open.map((j) => j.id).join() === "lag", "Mikey's tick row is not done (unticked) → still to do for him");
  const lo = pushedFor(jobs, tasks, "Leo", NOW);
  ok(lo.open.map((j) => j.id).join() === "for-leo,lag", "Leo: owner all + his own, newest first; Harry's tick doesn't tick it for Leo");
  ok(pushedFor(jobs, tasks, "Harry", NOW + 25 * 3600_000).done.length === 0, "a ticked job leaves after a day, like other jobs");
  ok(pushedFor(jobs, tasks, null, NOW).open.length === 0, "no name picked → nothing");
  // Unticked again: the newest tick row decides.
  const re = [...tasks, { id: 9, owner: "Harry" as const, made_by: "Harry" as const, title: markerTitle(jobs[0]), done_at: null, created_at: at(55) }];
  ok(pushedFor(jobs, re, "Harry", NOW).open.some((j) => j.id === "lag"), "two tick rows: the newest one decides");
}

console.log("The To-do badge");
{
  const jobs = [job("a"), job("b", { owner: "Mikey" })];
  const tasks: TeamTask[] = [];
  ok(newPushedJobs(jobs, tasks, "Leo", []) === 1 && newPushedJobs(jobs, tasks, "Mikey", []) === 2, "each pushed job still to do counts once");
  ok(newPushedJobs(jobs, tasks, "Mikey", ["a"]) === 1, "…until it has been on screen in the To-do");
  const ticked: TeamTask[] = [{ id: 1, owner: "Leo", made_by: "Leo", title: markerTitle(jobs[0]), done_at: at(1), created_at: at(0) }];
  ok(newPushedJobs(jobs, ticked, "Leo", []) === 0, "a ticked one never counts");
  ok(newPushedJobs(jobs, tasks, null, []) === 0, "no name → nothing");
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nteamRoomJobs: all passed");
