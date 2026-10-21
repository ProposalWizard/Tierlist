/**
 * tests/star/lagTest.mts — the in-game Lag test's maths (B18 step 0, 20 Oct 2026).
 *
 * Percentiles, the refresh-rate estimate (60 / 120 / 30 Hz and odd ones), the
 * bar per device tier (research §5.4, and Harry's "less frames is okay": a
 * steady 30 fps passes 3D on the low tier), the verdict, the shape check the
 * route uses, the "Copy results" lines the terminal script reads back, and
 * where a run is kept (a file on the lag-runs branch, made from main the
 * first time: Harry, 20 Oct 2026, "just use pushes").
 */
import {
  LAG_BRANCH, LAG_STEPS, LAG_TIERS, MAX_RUN_BYTES, MIN_FRAMES, barFor, estimateRefresh, fmt, frameStats, isLagRun, lagRunFile, lagRunPath, newRunId,
  parseStepLine, passCount, percentile, refineRefresh, resultsText, snapRefresh, stepLine, stepVerdict, verdict,
  type LagRun, type LagStepResult,
} from "@/lib/star/lagTest";
import { ensureBranch } from "@/lib/star/commitScenarios";
import { lagPillSpot, PILL_W } from "@/lib/star/lagPillSpot";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const near = (a: number, b: number, eps = 0.051) => Math.abs(a - b) <= eps;

console.log("Percentiles (nearest rank)");
const hundred = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
ok(percentile(hundred, 50) === 50, "p50 of 1..100 is 50");
ok(percentile(hundred, 95) === 95, "p95 of 1..100 is 95");
ok(percentile(hundred, 99) === 99, "p99 of 1..100 is 99");
ok(percentile(hundred, 100) === 100 && percentile(hundred, 0) === 1, "p100 is the max, p0 the min");
ok(percentile([], 95) === 0, "an empty list is 0, not a crash");
ok(percentile([7], 99) === 7, "one value is every percentile");

console.log("Frame stats");
// 60 Hz: 900 frames at 16.7 ms, 100 at 30 ms, 40 at 60 ms, 10 at 140 ms
const gaps60 = [...Array(900).fill(16.7), ...Array(100).fill(30), ...Array(40).fill(60), ...Array(10).fill(140)];
const st = frameStats(gaps60);
ok(st.n === 1050, "every gap counted (1,050)");
ok(st.p50 === 16.7, "p50 16.7 ms");
ok(st.p95 === 30, "p95 30 ms (frame 998 of 1,050 is in the 30 ms group)");
ok(st.p99 === 60, "p99 60 ms (frame 1,040 is in the 60 ms group)");
ok(st.max === 140, "max 140 ms");
ok(st.over33 === 50 && st.over50 === 50 && st.over100 === 10, "over 33 / 50 / 100 ms: 50, 50, 10");
ok(st.hist.reduce((a, b) => a + b, 0) === 1050, "the histogram holds every frame");
ok(st.hist[st.hist.length - 1] === 10, "10 frames in the over-100 bucket");
ok(frameStats([16.7, NaN, -1, 0, Infinity]).n === 1, "junk gaps (NaN, ≤0, ∞) are dropped");

console.log("Refresh rate from the idle median");
ok(snapRefresh(16.67).hz === 60, "16.67 ms → 60 Hz");
ok(snapRefresh(17.4).hz === 60, "17.4 ms (a bit of jitter) → 60 Hz");
ok(snapRefresh(8.33).hz === 120, "8.33 ms → 120 Hz (ProMotion)");
ok(snapRefresh(11.1).hz === 90, "11.1 ms → 90 Hz (an Android)");
ok(snapRefresh(6.94).hz === 144, "6.94 ms → 144 Hz (a gaming monitor)");
ok(snapRefresh(33.3).hz === 30, "33.3 ms → 30 Hz (iPhone Low Power Mode)");
ok(snapRefresh(25).hz === 40, "25 ms is near no common rate → the raw 40 Hz");
ok(snapRefresh(0).hz === 60 && snapRefresh(NaN).hz === 60, "no frames → assume 60 Hz");
ok(estimateRefresh([8.3, 8.4, 8.3, 25, 8.3, 8.4, 8.3]).hz === 120, "a 120 Hz idle list with one hitch still reads 120 Hz");
ok(near(snapRefresh(8.33).intervalMs, 8.333, 0.01), "120 Hz interval 8.33 ms");
// A slow phone busy at 30 fps while the start screen measured: a later step at 60 fps shows the real rate.
const busyStart = snapRefresh(33.3);
ok(refineRefresh(busyStart, [{ frames: frameStats(Array(300).fill(33.3)) }, { frames: frameStats(Array(300).fill(16.7)) }]).hz === 60, "busy start read 30 Hz, a 60 fps step proves a 60 Hz screen");
ok(refineRefresh(snapRefresh(16.7), [{ frames: frameStats(Array(300).fill(33.3)) }, { frames: null }]).hz === 60, "slow steps never pull the rate down");
ok(refineRefresh(snapRefresh(16.7), [{ frames: frameStats(Array(10).fill(8.3)) }]).hz === 60, "a step too short to judge doesn't change the rate");
ok(refineRefresh(snapRefresh(33.3), []).hz === 30, "a phone in Low Power Mode all the way stays 30 Hz");

console.log("The bar (research §5.4)");
const b60 = barFor("phone-high", false, 60);
ok(b60.p95 === 20.8 && b60.p99 === 33.4 && b60.max === 100, "60 Hz: p95 ≤ 20.8, p99 ≤ 33.4 (the research's numbers), none over 100");
const b120 = barFor("phone-high", true, 120);
ok(b120.p95 === 10.4 && b120.p99 === 16.7, "120 Hz screen: p95 ≤ 10.4 ms, p99 ≤ 16.7 ms");
ok(verdict(frameStats([...Array(990).fill(16.7), ...Array(10).fill(33.4)]), b60).pass === true, "one dropped frame in 100 (33.4 ms on the clock) passes at 60 Hz");
ok(verdict(frameStats([...Array(940).fill(16.7), ...Array(60).fill(21.2)]), b60).pass === true, "0.4 ms of clock jitter over the p95 line still passes");
ok(verdict(frameStats([...Array(940).fill(16.7), ...Array(60).fill(21.4)]), b60).pass === false, "0.6 ms over it fails");
ok(barFor("pc-high", false, 144).p95 === 8.7, "144 Hz PC: p95 ≤ 8.7 ms");
const low3d = barFor("phone-low", true, 60);
ok(low3d.p95 === 41.7 && low3d.p99 === null && low3d.max === 100, "low tier, 3D: steady 30 fps (p95 ≤ 41.7, no p99 rule, none over 100)");
ok(barFor("pc-low", true, 60).p95 === 41.7, "the low PC gets the same 3D allowance");
ok(barFor("phone-low", false, 60).p95 === 20.8, "low tier in 2D still holds 60 (p95 ≤ 20.8)");
ok(barFor("phone-mid", true, 60).p95 === 20.8, "mid tier gets no 30 fps allowance in 3D");
ok(barFor("other", true, 60).p95 === 20.8, "\"Other\" is judged like a full-speed device");
ok(barFor("phone-low", true, 120).p95 === 41.7, "low tier 3D on a 120 Hz screen: still the steady-30 rule");
ok(barFor("phone-high", false, 30).p95 === 41.7 && barFor("phone-high", false, 30).p99 === 66.7, "a 30 Hz screen (Low Power Mode): the bar is built on 33.3 ms");

console.log("The verdict");
const smooth = frameStats(Array(600).fill(16.7));
ok(verdict(smooth, b60).pass === true, "a steady 60 fps passes at 60 Hz");
ok(verdict(smooth, b120).pass === false, "the same steady 60 fps fails on a 120 Hz screen");
const steady30 = frameStats([...Array(560).fill(33.3), ...Array(30).fill(36), ...Array(10).fill(50)]);
ok(verdict(steady30, low3d).pass === true, "a steady 30 fps passes 3D on the low tier");
ok(verdict(steady30, b60).pass === false, "…and fails the 60 Hz bar a mid phone is held to");
const hitch = frameStats([...Array(599).fill(16.7), 120]);
const vh = verdict(hitch, b60);
ok(vh.pass === false && vh.fails.length === 1 && /worst frame 120 ms/.test(vh.fails[0]), "one 120 ms frame fails, and says so in plain words");
const lowHitch = frameStats([...Array(599).fill(33.3), 101]);
ok(verdict(lowHitch, low3d).pass === false, "even at 30 fps, a frame over 100 ms fails");
const p99only = frameStats([...Array(970).fill(16.7), ...Array(30).fill(40)]);
ok(verdict(p99only, b60).pass === false && verdict(p99only, b60).fails.some((f) => /1 frame in 100/.test(f)), "p95 fine but p99 over → fails on p99");
ok(verdict(p99only, low3d).pass === true, "the steady-30 rule has no p99 line");
ok(verdict(frameStats(Array(MIN_FRAMES - 1).fill(16.7)), b60).pass === null, `under ${MIN_FRAMES} frames: no verdict`);
ok(verdict(null, b60).pass === null, "no frames at all: no verdict");
ok(fmt(20.83) === "20.8" && fmt(140.4) === "140" && fmt(21) === "21", "numbers read 20.8, 140, 21");

console.log("The route");
ok(LAG_STEPS.length === 10, "10 steps");
ok(new Set(LAG_STEPS.map((s) => s.id)).size === LAG_STEPS.length, "every step id is different");
ok(LAG_STEPS.every((s) => s.seconds >= 20 && s.seconds <= 40), "each step records 20–40 s");
const total = LAG_STEPS.reduce((a, s) => a + s.seconds, 0);
ok(total >= 240 && total <= 400, `about 5 minutes of recording (${total} s), about 10 with the walking`);
ok(LAG_STEPS[LAG_STEPS.length - 1].id === "cutscene" && !!LAG_STEPS[LAG_STEPS.length - 1].link, "the cut scene (a test page) is last, with its link");
for (const id of ["home", "shop3d", "garden", "play3d", "match2d", "settings"]) ok(LAG_STEPS.some((s) => s.id === id), `the route covers ${id}`);
ok(LAG_STEPS.filter((s) => s.three).map((s) => s.id).join() === "home,shop3d,garden,play3d,cutscene", "3D steps: Home (its 3D player), 3D shop, Garden, 3D game, cut scene");
ok(LAG_TIERS.map((t) => t.label).join(" / ") === "iPhone 16 or newer / iPhone 13 or 14 / Older Android / High PC / Mid PC / Low PC / Other", "the device choices, as on the start screen");

console.log("A saved run");
const step = (id: string, gaps: number[] | null, status: LagStepResult["status"] = "done"): LagStepResult => {
  const d = LAG_STEPS.find((s) => s.id === id)!;
  return {
    id, title: d.title, status, three: d.three, seconds: gaps ? 30 : 0, frames: gaps ? frameStats(gaps) : null,
    longTasks: null, loaf: null, heartbeat: gaps ? { n: 1500, p95: 3, max: 12, over50: 0 } : null,
    frame3d: d.three && gaps ? [{ t: 2, draws: 140, tris: 410000, jsMs: 4.1, pr: 2, fps: 59, worst: 30, rung: 1, tier: "medium" }] : [],
    heapMB: [80, 92], phases: [], hiddenMs: 0,
  };
};
const run: LagRun = {
  v: 1, id: newRunId(Date.UTC(2026, 9, 20, 13, 5)), person: "Harry", tier: "phone-low", device: "",
  startedAt: Date.UTC(2026, 9, 20, 13, 5), endedAt: Date.UTC(2026, 9, 20, 13, 15),
  facts: { ua: "Mozilla/5.0 (Linux; Android 11; SM-A515F)", screen: "412×915", viewport: "412×780", dpr: 2.63, cores: 8, memGB: 4, gpu: "Mali-G72", standalone: false, quality3d: "auto", build: "c42bc43d9", tzOffset: -60 },
  refresh: snapRefresh(16.7), reloads: 0, complete: false,
  steps: [
    step("home", Array(1200).fill(16.7)),
    step("stats", [...Array(1700).fill(16.7), 150]),
    step("shop", null, "skipped"),
    step("garden", [...Array(800).fill(33.3), ...Array(20).fill(40)]),
  ],
};
ok(isLagRun(run), "a run passes the shape check");
ok(JSON.stringify(run).length < MAX_RUN_BYTES / 10, `a run is small (${JSON.stringify(run).length} bytes, the cap is ${MAX_RUN_BYTES})`);
ok(!isLagRun({ ...run, tier: "fast-phone" }), "an unknown tier is refused");
ok(!isLagRun({ ...run, person: "" }), "no name is refused");
ok(!isLagRun({ ...run, id: "x y" }), "a bad id is refused");
ok(!isLagRun({ ...run, steps: Array(21).fill(run.steps[0]) }), "more than 20 steps is refused");
ok(!isLagRun(null) && !isLagRun([]) && !isLagRun("run"), "not an object: refused");
ok(stepVerdict(run, run.steps[0]).v.pass === true, "Home at a steady 60 fps: ✓");
ok(stepVerdict(run, run.steps[1]).v.pass === false, "Stats with a 150 ms frame: ✗");
ok(stepVerdict(run, run.steps[2]).v.pass === null, "a skipped step has no verdict");
ok(stepVerdict(run, run.steps[3]).v.pass === true, "the Garden at a steady 30 fps on an older Android: ✓");
const pc = passCount(run);
ok(pc.passed === 2 && pc.judged === 3, "passed 2 of 3 (the skip is not judged)");

console.log("Copy results (for the Team chat)");
const text = resultsText(run);
ok(text.length <= 2000, `fits a Team chat message (${text.length} of 2,000 characters)`);
ok(text.startsWith("Lag test · Harry · Older Android · 60 Hz · 20 Oct 2026 14:05"), "header: who, tier, rate, their own time");
ok(/Mali-G72/.test(text) && /8 cores/.test(text) && /4 GB/.test(text), "device line: GPU, cores, memory");
ok(/Passed 2 of 3 \(stopped early\)/.test(text), "the pass count, and that it stopped early");
const back = parseStepLine(stepLine(run, 1));
ok(!!back && back.mark === "✗" && back.p95 === 16.7 && back.max === 150 && back.over100 === 1 && back.frames === 1701, "a step line reads back exactly (script)");
const skipBack = parseStepLine(stepLine(run, 2));
ok(!!skipBack && skipBack.mark === "skipped" && skipBack.title === "Shop", "a skipped line reads back");
ok(parseStepLine("hello") === null, "any other line is not a step");
const longGpu: LagRun = { ...run, facts: { ...run.facts, gpu: "X".repeat(3000) } };
ok(resultsText(longGpu).length <= 2000, "a silly-long GPU name still fits in 2,000 characters");

console.log("Where a run is kept (the lag-runs branch, no database)");
ok(LAG_BRANCH === "lag-runs", "the branch is lag-runs");
ok(lagRunPath(run) === "lag/runs/2026-10-20-1405-Harry-phone-low.json", "lag/runs/<YYYY-MM-DD-HHMM>-<person>-<tier>.json, in their own time (13:05 UTC at UTC+1 → 1405)");
ok(lagRunPath(run, 2) === "lag/runs/2026-10-20-1405-Harry-phone-low-2.json", "a second run in the same minute gets -2");
ok(lagRunPath({ ...run, person: "Zoë / tester 1" }).endsWith("-Zoe-tester-1-phone-low.json"), "a name with odd letters becomes a safe file name");
const saved = { at: "2026-10-20T13:15:00.000Z", build: "abc123" };
const fresh = lagRunFile("", run, saved);
ok(fresh.ids.length === 1 && fresh.ids[0] === run.id, "an empty path: the run is written");
ok(isLagRun(JSON.parse(fresh.text)) && JSON.parse(fresh.text).saved.build === "abc123", "the file is the run (plus when and which build saved it), and reads back as a run");
ok(fresh.text.length < MAX_RUN_BYTES, "the file is small");
const again = lagRunFile(fresh.text, run, saved);
ok(again.already === true && again.ids.length === 0, "the same run there already: counts as sent, nothing written twice");
const other = lagRunFile(fresh.text, { ...run, id: "lag-other-run" }, saved);
ok(other.taken === true && other.ids.length === 0, "a different run there: the path is taken, try the next");

{
  interface Call { url: string; method: string; body?: string }
  const calls: Call[] = [];
  let replies: { status: number; body: unknown }[] = [];
  const fakeFetch = async (url: string, init?: { method?: string; body?: string }) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    const r = replies.shift() ?? { status: 500, body: {} };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  const config = { token: "ghp_SECRET", repo: "ProposalWizard/Tierlist", branch: LAG_BRANCH };
  replies = [{ status: 200, body: { object: { sha: "x" } } }];
  const there = await ensureBranch({ config, branch: LAG_BRANCH, fetchImpl: fakeFetch });
  ok(there.ok && !("created" in there && there.created) && calls.length === 1 && calls[0].url.endsWith("/git/ref/heads/lag-runs"), "the branch is there: one check, nothing made");
  calls.length = 0;
  replies = [{ status: 404, body: {} }, { status: 200, body: { object: { sha: "mainsha" } } }, { status: 201, body: {} }];
  const made = await ensureBranch({ config, branch: LAG_BRANCH, fetchImpl: fakeFetch });
  ok(made.ok && "created" in made && made.created, "missing: it is made");
  ok(calls[1].url.endsWith("/git/ref/heads/main") && calls[2].method === "POST" && JSON.parse(calls[2].body!).ref === "refs/heads/lag-runs" && JSON.parse(calls[2].body!).sha === "mainsha", "…from main's newest commit");
  calls.length = 0;
  replies = [{ status: 404, body: {} }, { status: 200, body: { object: { sha: "mainsha" } } }, { status: 422, body: { message: "Reference already exists" } }];
  ok((await ensureBranch({ config, branch: LAG_BRANCH, fetchImpl: fakeFetch })).ok, "someone made it in between (422): fine");
  replies = [{ status: 401, body: {} }];
  const bad = await ensureBranch({ config, branch: LAG_BRANCH, fetchImpl: fakeFetch });
  ok(!bad.ok && /refused the token/.test((bad as { message: string }).message) && !JSON.stringify(bad).includes("ghp_SECRET"), "a refused token says so, and never shows the token");
}

// The pill during a match (Harry, 21 Oct 2026: it covered the score): it never overlaps the match's box.
{
  type B = { top: number; bottom: number; left: number; right: number };
  const over = (a: B, b: B) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const boxOf = (vw: number, vh: number, keep: B, h: number): B | null => {
    const s = lagPillSpot({ vw, vh, keep, pillH: h });
    if (!s) return null;
    const w = Math.min(PILL_W, vw - 112), mid = vw / 2;
    if (s.at === "side") return { top: s.top, bottom: s.top + h, left: s.left, right: s.left + Math.min(PILL_W, s.width) };
    return s.at === "below"
      ? { top: vh - (s.gap + h) / 2, bottom: vh - (s.gap - h) / 2, left: mid - w / 2, right: mid + w / 2 }
      : { top: (s.gap - h) / 2, bottom: (s.gap + h) / 2, left: mid - w / 2, right: mid + w / 2 };
  };
  // A phone, 390x844: scoreboard at 20, pitch to 715 (the b18s0 still): under the pitch.
  const phone = { top: 20, bottom: 715, left: 12, right: 378 };
  const p = lagPillSpot({ vw: 390, vh: 844, keep: phone, pillH: 42 });
  ok(p?.at === "below", `phone: the pill goes under the pitch (${p?.at})`);
  ok(!over(boxOf(390, 844, phone, 42)!, phone), "phone: it misses the scoreboard and the pitch");
  // A laptop, 1440x900: the match is a 384 px column in the middle: beside it.
  const lap = { top: 90, bottom: 860, left: 528, right: 912 };
  const l = lagPillSpot({ vw: 1440, vh: 900, keep: lap, pillH: 130 });
  ok(l?.at === "side", `laptop: the pill goes beside the match (${l?.at})`);
  ok(!over(boxOf(1440, 900, lap, 130)!, lap), "laptop: it misses the match");
  // No room anywhere (a pitch that fills the phone): null, the usual dock.
  ok(lagPillSpot({ vw: 390, vh: 844, keep: { top: 10, bottom: 840, left: 0, right: 390 }, pillH: 42 }) === null, "no room: the usual dock");
  // A phone where the pitch fills the screen (seen at 390x844: score row 0-34, pitch 86-828): over the stats strip, clear of the score and the pitch.
  const full = lagPillSpot({ vw: 390, vh: 844, keep: { top: -4, bottom: 828, left: 12, right: 378 }, band: { top: 34, bottom: 86 }, pillH: 40 });
  ok(full?.at === "band" && full.top >= 34 && full.top + 40 <= 86, `full-screen pitch: the pill sits between the score and the pitch (${JSON.stringify(full)})`);
  ok(lagPillSpot({ vw: 390, vh: 844, keep: { top: -4, bottom: 828, left: 12, right: 378 }, band: { top: 34, bottom: 86 }, pillH: 126 }) === null, "a pill too tall for that strip is not squeezed in");
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nlagTest: all passed");
