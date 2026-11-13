/**
 * tests/star/recordingStore.mts — Admin → Videos recordings in team storage
 * (lib/recordings/store.ts): the R2 key, the link for Claude and its token,
 * the 30-day rule with Keep, what the clean-up may delete, the auto-read
 * list, the upload checks. Plus: the clean-up job refuses without CRON_SECRET.
 * No network: every call here is a pure function or a refused request.
 */
import fs from "node:fs";
import { NextRequest } from "next/server";
import type { ListedObject, R2Config } from "@/lib/marketing/r2";
import {
  RECORDING_CAPS, RETAIN_DAYS, checkRecording, cleanupPlan, isRecordingKey, isWatchLink, keepKeyFor, keyFromWatch, linkToken,
  parseRecordingKey, readKeyFor, recordingGetUrl, recordingKey, recordingTitle, recordingsFromList, secondsOf, tokenOk,
  unreadFor, usedOn, watchLink,
} from "@/lib/recordings/store";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const now = new Date("2026-11-12T15:00:00Z");
const cfg: R2Config = { accountId: "a".repeat(32), accessKeyId: "AKID", secret: "s3cret-never-shown", bucket: "kib-marketing" };

/* ── The key ── */
const key = recordingKey({ who: "Harry", about: "Keeper dive feels slow!", seconds: 252, ext: "webm", now, rand: "A1b2zz" });
ok(key === "recordings/harry/2026-11-12-keeper-dive-feels-slow-4m12s-a1b2.webm", `key: recordings/<who>/<date>-<what>-<length>-<4>.webm (${key})`);
const p = parseRecordingKey(key)!;
ok(p.who === "Harry" && p.day === "2026-11-12" && p.about === "keeper dive feels slow" && p.seconds === 252 && p.ext === "webm", "the key reads back: who, day, what, length");
ok(recordingTitle(p) === "2026-11-12 · Harry · keeper dive feels slow (4m12s)", "title has the Drive name's shape");
ok(recordingKey({ who: "Leo", about: "  ", seconds: 9, ext: "mp4", now, rand: "" }) === "recordings/leo/2026-11-12-screen-recording-9s-0000.mp4", "nothing typed → screen-recording");
ok(recordingKey({ who: "Mikey", about: "v0.4 shop", seconds: 3725, ext: "MOV", now, rand: "abcd" }) === "recordings/mikey/2026-11-12-v0-4-shop-1h02m05s-abcd.mov", "dots and hours survive");
ok(isRecordingKey(recordingKey({ who: "Mikey", about: "x".repeat(200) + " ../../etc", seconds: 1, ext: "exe", now, rand: "abcd" })), "a long or odd name still makes a valid key; an unknown ending becomes webm");
ok(isRecordingKey(recordingKey({ who: "Harry", about: "a 12s clip 4m12s", seconds: 61, ext: "webm", now, rand: "abcd" })) && parseRecordingKey(recordingKey({ who: "Harry", about: "a 12s clip 4m12s", seconds: 61, ext: "webm", now, rand: "abcd" }))!.seconds === 61, "a length-looking word in the name does not confuse the real length");
ok(recordingKey({ who: "Harry", about: "late", seconds: 5, ext: "webm", now: new Date("2026-07-01T23:30:00Z"), rand: "abcd" }).includes("/2026-07-02-"), "the day is the UK day (BST)");
ok(secondsOf("45s") === 45 && secondsOf("4m12s") === 252 && secondsOf("1h02m05s") === 3725, "lengths read back");
for (const bad of ["recordings/harry/../../backups/db/x.webm", "videos/inbox/20261112-000000-abcd-x.webm", "recordings/bob/2026-11-12-x-9s-abcd.webm",
  "recordings/harry/2026-11-12-x-9s-abcd.webm.keep", "recordings/harry/2026-11-12-x-9s-abcd.html", "backups/db/2026-11-12/manifest.json", "recordings/harry/x.webm", 7, null]) {
  ok(!isRecordingKey(bad), `not a recording: ${String(bad)}`);
}

/* ── The link for Claude ── */
const link = watchLink("https://knowitball.co.uk/", cfg, key);
const tok = linkToken(cfg.secret, key);
ok(link === `https://knowitball.co.uk/api/dev-recordings/watch?k=harry/2026-11-12-keeper-dive-feels-slow-4m12s-a1b2.webm&t=${tok}`, `the link: ${link}`);
ok(/^[a-f0-9]{32}$/.test(tok) && !link.includes(cfg.secret), "token is 32 hex letters; the secret is not in the link");
ok(isWatchLink(link) && !isWatchLink("https://drive.google.com/file/d/x/view") && !isWatchLink(link + "&stream=1x"), "isWatchLink knows its own links");
const u = new URL(link);
ok(keyFromWatch(u.searchParams.get("k")) === key, "the link's k names the key again");
ok(keyFromWatch("../videos/inbox/x.mp4") === null && keyFromWatch("harry/../../x.webm") === null && keyFromWatch(null) === null, "k can never leave recordings/");
ok(tokenOk(cfg.secret, key, u.searchParams.get("t")), "the right token opens it");
ok(!tokenOk(cfg.secret, key, tok.replace(/.$/, tok.endsWith("0") ? "1" : "0")) && !tokenOk(cfg.secret, key, "") && !tokenOk(cfg.secret, key, null) && !tokenOk(cfg.secret, key, tok + "00"), "a wrong, empty or long token does not");
const other = recordingKey({ who: "Leo", about: "other", seconds: 5, ext: "webm", now, rand: "abcd" });
ok(!tokenOk(cfg.secret, other, tok), "one recording's token does not open another");
ok(linkToken("another-secret", key) !== tok, "a different secret, a different token");
// fetch.py spots the same links (its own copy of the pattern).
const py = fs.readFileSync("scripts/screen-video/fetch.py", "utf8");
ok(py.includes("/api/dev-recordings/watch") && py.includes("&stream=1"), "fetch.py knows the recording link and the through-the-site retry");
const signed = recordingGetUrl(cfg, key, now);
ok(signed.startsWith(`https://${cfg.accountId}.r2.cloudflarestorage.com/kib-marketing/recordings/harry/`) && signed.includes("X-Amz-Expires=3600") && signed.includes("response-content-type=video%2Fwebm") && !signed.includes(cfg.secret), "the play link is a one-hour signed R2 link, type video/webm");

/* ── The list, Keep and the 30 days ── */
const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();
const k = (who: string, name: string) => `recordings/${who}/${name}`;
const fresh = k("harry", "2026-11-12-fresh-10s-aaaa.webm");
const mid = k("mikey", "2026-10-20-mid-1m00s-bbbb.webm");
const old = k("leo", "2026-10-01-old-2m00s-cccc.webm");
const oldKept = k("harry", "2026-09-01-old-kept-3m00s-dddd.mp4");
const oldRead = k("harry", "2026-10-02-old-read-5s-eeee.webm");
const objects: ListedObject[] = [
  { key: fresh, size: 1000, modified: daysAgo(0.1) },
  { key: mid, size: 2000, modified: daysAgo(23) },
  { key: old, size: 3000, modified: daysAgo(31) },
  { key: oldKept, size: 4000, modified: daysAgo(70) }, { key: keepKeyFor(oldKept), size: 0, modified: daysAgo(60) },
  { key: oldRead, size: 5000, modified: daysAgo(40) }, { key: readKeyFor(oldRead), size: 0, modified: daysAgo(40) },
  { key: keepKeyFor(k("leo", "2026-08-01-gone-5s-ffff.webm")), size: 0, modified: daysAgo(90) },
  { key: "recordings/harry/notes.txt", size: 5, modified: daysAgo(400) },
  { key: "recordings/readme.md", size: 5, modified: daysAgo(400) },
];
const rows = recordingsFromList(objects, now);
ok(rows.length === 5 && rows[0].key === fresh && rows[4].key === oldKept, "the list: recordings only, newest first");
ok(rows[0].daysLeft === 30 && rows[1].daysLeft === 7 && rows[2].daysLeft === 0, `days left: 30, 7, 0 (${rows.map((r) => r.daysLeft).join(", ")})`);
ok(rows[4].keep && rows[4].daysLeft === null && !rows[0].keep, "Keep on → no days left counted");
ok(RETAIN_DAYS === 30, "kept 30 days");

const plan = cleanupPlan(objects, now);
ok(JSON.stringify(plan) === JSON.stringify([old, oldRead, readKeyFor(oldRead), keepKeyFor(k("leo", "2026-08-01-gone-5s-ffff.webm"))].sort()), `clean-up: old + its read mark + an orphan mark, nothing else (${plan.length})`);
ok(!plan.includes(oldKept) && !plan.includes(keepKeyFor(oldKept)), "a kept recording and its mark stay, however old");
ok(!plan.includes(fresh) && !plan.includes(mid), "anything under 30 days stays");
ok(!plan.some((x) => x.endsWith("notes.txt") || x.endsWith("readme.md")), "a file it does not know is left alone");
ok(cleanupPlan([{ key: old, size: 1, modified: daysAgo(30) }], now).length === 0 && cleanupPlan([{ key: old, size: 1, modified: daysAgo(30.01) }], now).length === 1, "exactly 30 days stays; a moment over goes");
// Whatever is listed, nothing outside recordings/ can ever be planned for deletion.
const hostile: ListedObject[] = [
  { key: "backups/db/2026-01-01/manifest.json", size: 1, modified: daysAgo(300) },
  { key: "videos/inbox/20260101-000000-abcd-old.mp4", size: 1, modified: daysAgo(300) },
  { key: "patch-notes/pages/0.1/a.png", size: 1, modified: daysAgo(300) },
  { key: "videos/inbox/20260101-000000-abcd-old.mp4.keep", size: 0, modified: daysAgo(300) },
  { key: "recordings/harry/../../videos/x.webm", size: 1, modified: daysAgo(300) },
  { key: "recordingsX/harry/2026-01-01-x-9s-abcd.webm", size: 1, modified: daysAgo(300) },
];
ok(cleanupPlan(hostile, now).length === 0, "clean-up never touches backups/, videos/, patch-notes/ or a path that climbs out");
ok(cleanupPlan([...hostile, ...objects], now).every((x) => x.startsWith("recordings/") && !x.includes("..")), "every planned delete is inside recordings/");
// No bucket time on a row: the day in its name decides.
ok(cleanupPlan([{ key: old, size: 1, modified: "" }], now).length === 1 && cleanupPlan([{ key: fresh, size: 1, modified: "" }], now).length === 0, "no bucket time → the date in the name is used");

/* ── Auto-read ── */
const un = unreadFor([...objects, { key: k("harry", "2026-11-11-second-10s-gggg.webm"), size: 1, modified: daysAgo(1) },
  { key: k("harry", "2026-11-10-seen-10s-hhhh.webm"), size: 1, modified: daysAgo(2) }, { key: readKeyFor(k("harry", "2026-11-10-seen-10s-hhhh.webm")), size: 0, modified: daysAgo(2) },
  { key: k("harry", "2026-11-05-stale-10s-iiii.webm"), size: 1, modified: daysAgo(7) }], "Harry", now);
ok(un.length === 2 && un[0].about === "second" && un[1].about === "fresh", "auto-read: this person's unread from the last 3 days, oldest first");
ok(unreadFor(objects, "Leo", now).length === 0, "auto-read: an old recording is not handed out");

/* ── Upload checks ── */
const none = { files: 0, bytes: 0 };
const good = checkRecording({ who: "harry", about: "x", seconds: 12.4, ext: "webm", size: 5_000_000 }, none);
ok(good.ok && good.who === "Harry" && good.size === 5_000_000, "a normal recording is allowed");
ok(!checkRecording({ who: "Bob", ext: "webm", size: 5 }, none).ok, "only Harry, Mikey or Leo");
const badType = checkRecording({ who: "Leo", ext: "exe", size: 5 }, none);
ok(!badType.ok && badType.status === 415, "videos only");
ok(!checkRecording({ who: "Leo", ext: "webm", size: 0 }, none).ok && !checkRecording({ who: "Leo", ext: "webm", size: "9" }, none).ok, "empty or no size: refused");
const big = checkRecording({ who: "Leo", ext: "webm", size: RECORDING_CAPS.maxFileBytes + 1 }, none);
ok(!big.ok && big.status === 413, "over 500 MB: refused");
const many = checkRecording({ who: "Leo", ext: "webm", size: 5 }, { files: RECORDING_CAPS.dailyFiles, bytes: 0 });
ok(!many.ok && many.status === 429, "the daily count is a limit");
ok(!checkRecording({ who: "Leo", ext: "webm", size: 10 }, { files: 1, bytes: RECORDING_CAPS.dailyBytes - 5 }).ok, "the daily size is a limit");
const used = usedOn(objects, "2026-11-12");
ok(used.files === 1 && used.bytes === 1000, "today's use counts only today's recordings");

/* ── The routes that need no network ── */
{
  const saved = { secret: process.env.CRON_SECRET, acc: process.env.R2_ACCOUNT_ID };
  delete process.env.CRON_SECRET;
  const cron = await import("@/app/api/cron/recordings/route");
  const res = await cron.GET(new NextRequest("http://localhost/api/cron/recordings", { headers: { "user-agent": "vercel-cron/1.0" } }));
  ok(res.status === 503 && /CRON_SECRET/.test((await res.json()).error), "clean-up: refuses with no CRON_SECRET, even as \"vercel-cron\"");
  process.env.CRON_SECRET = "s3cret";
  const res2 = await cron.GET(new NextRequest("http://localhost/api/cron/recordings", { headers: { authorization: "Bearer wrong" } }));
  ok(res2.status === 401, "clean-up: wrong secret is 401");
  const src = fs.readFileSync("app/api/cron/recordings/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  ok(!/user-?agent|vercel-cron/i.test(src) && /cronGate\(/.test(src), "clean-up: gated by cronGate, never the user-agent");
  ok((src.match(/\.remove\(/g) ?? []).length === 1 && /startsWith\(RECORDINGS_PREFIX\)/.test(src), "clean-up: one delete call, guarded to recordings/");
  // With the right secret and no R2 settings it does nothing and says so.
  delete process.env.R2_ACCOUNT_ID;
  const res3 = await cron.GET(new NextRequest("http://localhost/api/cron/recordings", { headers: { authorization: "Bearer s3cret" } }));
  const b3 = await res3.json();
  ok(res3.status === 200 && b3.ok === true && !("removed" in b3), "clean-up: no R2 settings → skipped, nothing deleted");
  if (saved.secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.secret;
  if (saved.acc !== undefined) process.env.R2_ACCOUNT_ID = saved.acc;

  const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  ok(vercel.crons.filter((c: { path: string }) => c.path === "/api/cron/recordings").length === 1, "vercel.json: the clean-up runs once a night");
  ok(fs.readFileSync("docs/r2-layout.md", "utf8").includes("`recordings/<who>/"), "docs/r2-layout.md lists recordings/");

  const watch = await import("@/app/api/dev-recordings/watch/route");
  const w = await watch.GET(new Request(link));
  ok(w.status === 503, "watch: no R2 settings here → says storage is not connected (503)");
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nrecordingStore: all passed");
