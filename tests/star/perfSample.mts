/**
 * THE SPEED RECORDER (27 Nov 2026, Harry: "recording directly back to a database with some understanding
 * of what screens it is on … automatically tracking over playtests"). The pure half, lib/star/perfSample.ts:
 *   1. who records: the team, or a ?fps=1 phone; never a normal player;
 *   2. the clock: one sample per 5 s whatever the frame rate, none while hidden, stop after 2 h;
 *   3. batching: 6 to a send, at most 60 waiting, a lost batch is dropped and counted;
 *   4. the row: exactly the table's columns, the 3D numbers when fresh, else the page's clock;
 *   5. the place: phase, test page, the phone over the house, match vs match3d;
 *   6. actions: safe labels only, at most 8, a double fire kept once;
 *   7. the device line from user agents (S20, iPhone, desktop);
 *   8. the report script's grouping and the S20 filter.
 * Plus the migration's GRANT list matches the columns the browser writes.
 */
import { readFileSync } from "node:fs";
import {
  perfRecordingWanted, PerfSampler, buildSample, placeOf, placeOfPhase, placeOfPath, screenOf, safeLabel, ActionLog,
  parseAgent, posthogProps, PERF_COLUMNS, SAMPLE_EVERY_MS, STOP_AFTER_MS, type SampleInput, type PerfRow,
} from "../../lib/star/perfSample";
import { summarise, deviceMatches, parseSince, type Row } from "../../scripts/perf-report.mts";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. who records ──
check(perfRecordingWanted({ team: false, meterOn: false }) === null, "a normal player records nothing");
check(perfRecordingWanted({ team: true, meterOn: false }) === "team", "a team account records");
check(perfRecordingWanted({ team: false, meterOn: true }) === "fps", "a ?fps=1 phone records");
check(perfRecordingWanted({ team: true, meterOn: true }) === "team", "team wins over ?fps=1");

// ── 2 + 3. the clock and the queue, frame-rate free ──
const device = { gpu: "Mali-G77", gpuClass: "android-mid", device: "SM-G981B", browser: "Chrome 131", os: "Android 13", screenW: 360, screenH: 800, viewportW: 360, viewportH: 740, dpr: 3, memGB: 8, cores: 8, appVersion: "abc123" };
const base = (at: number, over: Partial<SampleInput> = {}): PerfRow => buildSample({
  session: "s1", account: null, reason: "fps", at, where: { path: "/star-dev", phase: "garden" }, actions: [],
  three: { fps: 41.26, worstMs: 88.4, frames: 160, draws: 120, tris: 230456, jsMs: 3.14, pixelRatio: 1.5 },
  page: { fps: 59, worstMs: 20, frames: 290 }, gov: { rung: 2, tier: "medium" }, qualitySetting: "auto",
  caps: { cap: 1.5, scale: 0.88 }, device, ...over,
});
for (const tickMs of [16, 33, 100, 1000]) { // "frame rates": how often the caller asks
  const s = new PerfSampler(0);
  const sends: number[] = [];
  const at: number[] = [];
  for (let now = 0; now <= 60_000; now += tickMs) {
    if (s.due(now)) { at.push(now); const b = s.add(now, base(now)); if (b) sends.push(b.length); }
  }
  const gaps = at.slice(1).map((t, i) => t - at[i]);
  check((s.taken === 12 || s.taken === 13) && gaps.every((g) => g >= SAMPLE_EVERY_MS && g < SAMPLE_EVERY_MS + Math.max(tickMs, 1)), `one sample per 5 s over 60 s at a ${tickMs} ms tick (got ${s.taken}, gaps ${Math.min(...gaps)}-${Math.max(...gaps)})`);
  check(sends.length === 2 && sends.every((n) => n === 6) && s.waiting === s.taken - 12, `batches of 6 at a ${tickMs} ms tick (${sends.join(",")}; ${s.waiting} waiting)`);
}
{
  const s = new PerfSampler(0);
  check(s.due(0, false) === false, "no sample while the page is hidden");
  const h = new PerfSampler(0); h.hold(1000);
  check(!h.due(5999) && h.due(6000), "the first sample comes 5 s after switching on");
  check(s.due(0) && (s.add(0, base(0)), !s.due(SAMPLE_EVERY_MS - 1)), "never two samples inside 5 s");
  check(s.due(STOP_AFTER_MS - 1), "still on just under 2 h");
  check(!s.due(STOP_AFTER_MS) && s.stopped && !s.due(STOP_AFTER_MS + 10 * SAMPLE_EVERY_MS), "stops for good after 2 h");
  const q = new PerfSampler(0, { sendEvery: 1000, maxQueue: 60 });
  for (let i = 0; i < 75; i++) q.add(i * 5000, base(i * 5000));
  check(q.waiting === 60 && q.dropped === 15, `at most 60 waiting (got ${q.waiting}, dropped ${q.dropped})`);
  const b = q.flush(); q.lost(b.length);
  check(q.waiting === 0 && q.dropped === 75, "a lost batch is dropped and counted, never resent");
}

// ── 4. the row ──
{
  const r = base(Date.UTC(2026, 10, 27, 12));
  check(JSON.stringify(Object.keys(r).sort()) === JSON.stringify([...PERF_COLUMNS].sort()), "the row has exactly the writable columns");
  check(r.source === "3d" && r.fps === 41.3 && r.worst_ms === 88 && r.draws === 120 && r.tris === 230456 && r.pixel_ratio === 1.5, "3D numbers used when fresh, rounded");
  check(r.px_cap === 1.5 && r.res_scale === 0.88 && r.quality_rung === 2 && r.quality_tier === "medium", "cap, scale and rung kept");
  check(r.sampled_at === "2026-11-27T12:00:00.000Z" && r.place === "garden" && r.screen === "garden", "time, place, screen");
  const flat = base(0, { three: null, where: { path: "/star-dev", phase: "league" } });
  check(flat.source === "page" && flat.fps === 59 && flat.draws === null && flat.place === null, "a flat screen: the page's clock, no 3D numbers");
  const p = posthogProps(base(0, { actions: [{ t: 1, k: "tap", v: "Play" }, { t: 2, k: "phase", v: "match" }] }));
  check(p.actions === "tap:Play | phase:match" && p.action_count === 2 && p.fps === 41.3, "PostHog props: same numbers, actions as one line");
  const long = buildSample({ ...({} as SampleInput), session: "x".repeat(99), account: null, reason: "team", at: 0, where: { path: "/" + "p".repeat(200) }, actions: [], three: null, page: null, device: { ...device, gpu: "g".repeat(300) } });
  check(long.session_id.length <= 40 && long.page.length <= 60 && (long.gpu ?? "").length <= 80 && long.fps === null, "long text is cut to the table's limits");
}

// ── 5. the place ──
check(placeOfPhase("home-3d") === "house" && placeOfPhase("shop-3d") === "shop" && placeOfPhase("casino-roulette") === "casino" && placeOfPhase("training-3d") === "training" && placeOfPhase("gym-3d") === "gym", "phases → places");
check(placeOfPath("/star-world3d-dev", "?place=gym") === "gym" && placeOfPath("/star-garden3d-dev") === "garden" && placeOfPath("/star-phone3d-dev") === "phone", "test pages → places");
check(placeOf({ path: "/star-dev", phase: "media", phoneUp: true }) === "phone", "the 3D phone over the house is 'phone'");
check(placeOf({ path: "/star-dev", phase: "match", drawing3d: true }) === "match3d" && placeOf({ path: "/star-dev", phase: "match" }) === "match", "match vs match3d");
check(placeOf({ path: "/star-dev", phase: "league" }) === null, "a flat career screen has no place");
check(screenOf("/road-to-the-golden-ball", "pre-match") === "pre-match" && screenOf("/star-world3d-dev", null) === "/star-world3d-dev", "screen names");
check(placeOf({ path: "/road-to-the-golden-ball", phase: "home-3d" }) === "house", "the career at its public address");

// ── 6. actions ──
check(safeLabel("  Team   sheets →\n") === "Team sheets →", "labels squashed to one line");
check(safeLabel("harry@example.com") === null && safeLabel("Call 07700900123") === null && safeLabel("   ") === null, "no addresses, long numbers or empties");
check((safeLabel("x".repeat(80)) ?? "").length === 32, "labels cut to 32");
check(safeLabel("£1,200,000") === "£1,200,000", "money on a button is fine");
{
  const log = new ActionLog();
  log.push({ t: 1, k: "tap", v: "Play" }); log.push({ t: 1.2, k: "tap", v: "Play" });
  for (let i = 0; i < 12; i++) log.push({ t: 2 + i, k: "tap", v: `B${i}` });
  const got = log.take();
  check(got.length === 8 && got[7].v === "B11" && log.size === 0, `at most 8 actions, newest kept, emptied on take (${got.length})`);
  const l2 = new ActionLog(); l2.push({ t: 1, k: "tap", v: "Play" }); l2.push({ t: 1.2, k: "tap", v: "Play" });
  check(l2.take().length === 1, "a double fire is kept once");
}

// ── 7. the device line ──
{
  const s20 = parseAgent("Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36");
  check(s20.device === "SM-G981B" && s20.os === "Android 13" && s20.browser === "Chrome 131", `S20 (${JSON.stringify(s20)})`);
  const reduced = parseAgent("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", "SM-G981B");
  check(reduced.device === "SM-G981B", "Chrome's reduced agent: the model from userAgentData");
  const ip = parseAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1");
  check(ip.device === "iPhone" && ip.os === "iOS 18.1" && ip.browser === "Safari 18", `iPhone (${JSON.stringify(ip)})`);
  const sam = parseAgent("Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36");
  check(sam.browser === "Samsung 25", "Samsung Internet");
  const mac = parseAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  check(mac.device === "computer" && mac.os === "macOS", "a computer");
}

// ── 8. the report ──
{
  const row = (over: Partial<Row>): Row => ({
    sampled_at: "2026-11-27T12:00:00Z", session_id: "a", reason: "team", page: "/star-dev", screen: "garden", nav: null, place: "garden", loading: null,
    actions: [], source: "3d", fps: 30, worst_ms: 60, draws: 100, tris: 1, pixel_ratio: 1.5, px_cap: 1.5, res_scale: 1, quality_rung: 1, quality_tier: "medium",
    gpu: "Mali-G77 MC11", gpu_class: "android-mid", device: "SM-G981B", browser: "Chrome 131", os: "Android 13", dpr: 3, app_version: "abc", ...over,
  });
  const rows = [10, 20, 30, 40, 50].map((fps, i) => row({ fps, worst_ms: 40 + i * 20 }))
    .concat([row({ device: "iPhone", gpu: "Apple GPU", fps: 60, worst_ms: 20, session_id: "b" })]);
  const g = summarise(rows);
  check(g.length === 2 && g[0].device === "SM-G981B" && g[0].n === 5 && g[0].fps === 30 && g[0].worst95 === 120, `groups by screen × place × device (${JSON.stringify(g[0])})`);
  check(g[1].device.startsWith("iPhone") && g[1].fps === 60, "the iPhone separately, named by its GPU");
  check(deviceMatches(rows[0], "S20") && !deviceMatches(rows[5], "S20") && deviceMatches(rows[5], "iphone"), "--device S20 finds an SM-G981B");
  check(parseSince("24h") === 86_400_000 && parseSince("30m") === 1_800_000 && parseSince("2d") === 172_800_000, "--since");
}

// ── the migration's GRANT matches what the browser writes ──
{
  const sql = readFileSync(new URL("../../supabase/migrations/star_perf_samples.sql", import.meta.url), "utf8");
  const grant = sql.match(/GRANT INSERT \(([\s\S]*?)\) ON public\.star_perf_samples/);
  const cols = grant ? grant[1].split(",").map((c) => c.trim()).filter(Boolean).sort() : [];
  check(JSON.stringify(cols) === JSON.stringify([...PERF_COLUMNS].sort()), `GRANT INSERT columns = the row's columns (${cols.length} vs ${PERF_COLUMNS.length})`);
  check(/WITH CHECK \(account_id IS NULL OR account_id = auth\.uid\(\)\)/.test(sql) && /admins read/.test(sql), "insert check and admin read policy");
}

if (problems.length) {
  console.log(`perfSample: ${problems.length} problem(s)`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("perfSample: all checks pass");
