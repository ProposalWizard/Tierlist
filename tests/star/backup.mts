/**
 * tests/star/backup.mts — the nightly backup and the morning limits post
 * (12 Nov 2026): which day folders are kept, the manifest's shape, the
 * amber/red colours, the UK clock, and that both timed jobs refuse without
 * CRON_SECRET. Fakes only: never R2, never the database.
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  BACKUP_TABLES, KEEP_DAILY, KEEP_SUNDAYS, LIMITS, NEVER_BACKED_UP, backupTables, buildManifest, cronGate, dayOfKey,
  isManifest, isMissingTable, isUkHour, levelOf, limitsPost, manifestKey, retention, sizesByTopFolder, tableKey, ukClock,
  type TableResult,
} from "@/lib/backup/plan";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

console.log("Which tables");
{
  const names = backupTables().map((t) => t.table);
  ok(!names.includes("sofifa_players"), "sofifa_players is never backed up");
  ok((NEVER_BACKED_UP as readonly string[]).includes("sofifa_players"), "and it is named as never");
  for (const must of ["star_careers", "user_profiles", "star_hall_of_fame", "star_wallet", "feedback", "team_messages", "team_dms"]) ok(names.includes(must), `${must} is in`);
  ok(new Set(names).size === names.length, "no table twice");
  ok(BACKUP_TABLES.every((t) => t.order.length > 0 && t.page > 0), "every table has an order and a page size");
  ok(BACKUP_TABLES.find((t) => t.table === "star_careers")!.page <= 50, "careers are read a few at a time");
}

console.log("Keys");
{
  ok(tableKey("2026-11-12", "star_careers") === "backups/db/2026-11-12/star_careers.jsonl.gz", "table file key");
  ok(manifestKey("2026-11-12") === "backups/db/2026-11-12/manifest.json", "manifest key");
  ok(dayOfKey("backups/db/2026-11-12/feedback.jsonl.gz") === "2026-11-12", "day read back from a key");
  for (const bad of ["videos/2026-11-12/x", "backups/db/notes.txt", "backups/db/2026-11-12/", "backups/2026-11-12/x", "patch-notes/backups/db/2026-11-12/x", "backups/db/2026-13-45/x"])
    ok(dayOfKey(bad) === null, `never treated as a backup: ${bad}`);
}

console.log("Which copies to keep (14 nightly + 8 Sundays)");
{
  const today = "2026-11-12"; // a Thursday
  const days = Array.from({ length: 120 }, (_, i) => addDays(today, -i));
  const { keep, remove } = retention(days, today);
  const daily = days.slice(0, KEEP_DAILY);
  ok(daily.every((d) => keep.includes(d)), "the 14 newest days are kept");
  const sundays = days.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0).slice(0, KEEP_SUNDAYS);
  ok(sundays.every((d) => keep.includes(d)), "the 8 newest Sundays are kept");
  const expected = new Set([...daily, ...sundays]);
  ok(keep.length === expected.size, `kept ${keep.length} = ${expected.size} (overlap counted once)`);
  ok(remove.length === days.length - expected.size && remove.every((d) => !expected.has(d)), "everything else is removed");
  ok(!remove.includes(today), "today is never removed");
  const ninth = days.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0)[KEEP_SUNDAYS];
  ok(remove.includes(ninth), `the 9th Sunday back (${ninth}) goes`);
  ok(remove.includes(addDays(today, -14)) === (new Date(`${addDays(today, -14)}T00:00:00Z`).getUTCDay() !== 0), "day 15 goes unless it is a kept Sunday");

  const r2 = retention([addDays(today, 1), "not-a-day", today], today);
  ok(r2.keep.includes(addDays(today, 1)) && r2.remove.length === 0, "a future folder (clock gone wrong) is kept; junk is ignored");
  ok(retention([], today).remove.length === 0, "nothing there: nothing removed");
  const gappy = ["2026-08-02", "2026-08-09", "2026-11-01", "2026-11-11"];
  ok(retention(gappy, today).remove.length === 0, "few Sundays: old ones stay until 8 newer exist");
}

console.log("The manifest");
{
  const r = (table: string, state: TableResult["state"], rows = 10, bytes = 100): TableResult => ({ table, key: tableKey("2026-11-12", table), state, rows, bytes, rawBytes: bytes * 8, ms: 5 });
  const s = new Date("2026-11-12T03:00:00Z"), f = new Date("2026-11-12T03:01:30Z");
  const m = buildManifest("2026-11-12", s, f, [r("star_careers", "ok", 40, 5000), r("feedback", "ok"), r("star_tuning_notes", "missing", 0, 0)], ["2026-10-01"]);
  ok(isManifest(m), "a built manifest passes its own check");
  ok(m.ok, "ok when every table is copied or not in the database yet");
  ok(m.totalRows === 50 && m.totalBytes === 5100 && m.durationMs === 90_000, "totals and time add up");
  ok(m.never.includes("sofifa_players") && m.removedDays[0] === "2026-10-01", "lists what is never copied and what was removed");
  const back = JSON.parse(JSON.stringify(m));
  ok(isManifest(back), "survives being written and read back");
  ok(!buildManifest("2026-11-12", s, f, [r("a", "ok"), r("b", "failed")]).ok, "one failed table = not ok");
  ok(!buildManifest("2026-11-12", s, f, [r("a", "ok"), r("b", "not-reached")]).ok, "out of time = not ok");
  ok(!buildManifest("2026-11-12", s, f, []).ok, "no tables = not ok");
  ok(!isManifest({ version: 2 }) && !isManifest(null) && !isManifest({ ...m, tables: [{ table: 1 }] }), "a wrong shape is refused");
  ok(isMissingTable({ code: "42P01" }) && isMissingTable({ code: "PGRST205" }) && !isMissingTable({ code: "57014", message: "timeout" }), "a table not there is told apart from a failure");
  // The file format: gzip'd JSON lines round-trip.
  const rows = [{ id: 1, career: { name: "Mikey's star", nested: [1, 2] } }, { id: 2, career: null }];
  const gz = gzipSync(rows.map((x) => JSON.stringify(x)).join("\n") + "\n");
  const back2 = gunzipSync(gz).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  ok(JSON.stringify(back2) === JSON.stringify(rows), "jsonl.gz rows come back exactly");
}

console.log("Colours (amber 75 %, red 90 %)");
{
  ok(levelOf(0, 100) === "green" && levelOf(74.9, 100) === "green", "under 75 % is green");
  ok(levelOf(75, 100) === "amber" && levelOf(89.9, 100) === "amber", "75 % to under 90 % is amber");
  ok(levelOf(90, 100) === "red" && levelOf(120, 100) === "red", "90 % and over is red");
  ok(levelOf(null, 100) === "unknown" && levelOf(5, 0) === "unknown" && levelOf(NaN, 100) === "unknown", "no reading is unknown, never green");
  ok(levelOf(LIMITS.database * 0.74, LIMITS.database) === "green", "0.37 GB-ish database (74 %) is green");
}

console.log("The morning post");
{
  const m = buildManifest("2026-11-12", new Date("2026-11-12T03:00:00Z"), new Date("2026-11-12T03:02:00Z"),
    [{ table: "star_careers", key: "k", state: "ok", rows: 300, bytes: 20 * 1024 * 1024, rawBytes: 1, ms: 1 }]);
  const r2 = sizesByTopFolder([{ key: "patch-notes/a.jpg", size: 100 }, { key: "patch-notes/b/c.mp4", size: 200 }, { key: "videos/x/y.mp4", size: 50 }, { key: "loose.txt", size: 1 }]);
  ok(r2.total === 351 && r2.folders[0].folder === "patch-notes" && r2.folders[0].bytes === 300, "R2 summed by top folder, biggest first");
  ok(r2.folders.some((f) => f.folder === "(top level)"), "a file at the top is counted too");
  const green = limitsPost({ day: "2026-11-12", dbBytes: 300 * 1024 * 1024, storageBytes: 100 * 1024 * 1024, r2, backup: m });
  ok(green.level === "green" && !green.red && /All green/.test(green.title), "all under 75 % and a good backup: green");
  ok(/Database: 300 MB of 500 MB \(60%\)/.test(green.body), "database line reads size, limit and %");
  ok(/Last night's backup: OK, 20\.0 MB/.test(green.body), "backup line reads OK and its size");
  const amber = limitsPost({ day: "2026-11-12", dbBytes: 400 * 1024 * 1024, storageBytes: 1, r2, backup: m });
  ok(amber.level === "amber" && !amber.red, "database at 80 %: amber");
  const red = limitsPost({ day: "2026-11-12", dbBytes: 460 * 1024 * 1024, storageBytes: 1, r2, backup: m });
  ok(red.level === "red" && red.red && /🔴 Database/.test(red.body), "database at 92 %: red");
  const noBackup = limitsPost({ day: "2026-11-12", dbBytes: 1, storageBytes: 1, r2, backup: null });
  ok(noBackup.red && /none found/.test(noBackup.body), "no backup last night: red");
  const failedNight = buildManifest("2026-11-12", new Date(), new Date(), [{ table: "star_careers", key: "k", state: "failed", rows: 0, bytes: 0, rawBytes: 0, ms: 0, error: "x" }]);
  const bad = limitsPost({ day: "2026-11-12", dbBytes: 1, storageBytes: 1, r2, backup: failedNight });
  ok(bad.red && /FAILED.*star_careers/.test(bad.body), "a failed backup: red, names the table");
  const blind = limitsPost({ day: "2026-11-12", dbBytes: null, storageBytes: null, r2: null, backup: m, notes: ["run supabase/migrations/ops_limits.sql"] });
  ok(blind.level === "unknown" && /could not read/.test(blind.body) && /ops_limits\.sql/.test(blind.body), "missing readings say so, never green");
  ok(green.body.length <= 2000 && green.title.length <= 200, "fits team_bot_posts (title 200, body 2000)");
}

console.log("UK clock (the job runs at the UK hour, winter and summer)");
{
  ok(isUkHour(new Date("2026-01-15T03:00:00Z"), 3) && !isUkHour(new Date("2026-01-15T02:00:00Z"), 3), "winter: 03:00 UTC is 03:00 UK");
  ok(isUkHour(new Date("2026-07-15T02:00:00Z"), 3) && !isUkHour(new Date("2026-07-15T03:00:00Z"), 3), "summer: 02:00 UTC is 03:00 UK");
  ok(isUkHour(new Date("2026-07-15T07:00:00Z"), 8) && isUkHour(new Date("2026-01-15T08:00:00Z"), 8), "the 8am post, both seasons");
  ok(ukClock(new Date("2026-07-15T23:30:00Z")).day === "2026-07-16", "the UK date, not the UTC one");
  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
  const sched = (p: string) => vercel.crons.filter((c: { path: string }) => c.path === p).map((c: { schedule: string }) => c.schedule).sort();
  ok(JSON.stringify(sched("/api/cron/backup")) === JSON.stringify(["0 2 * * *", "0 3 * * *"]), "vercel.json: backup at 02:00 and 03:00 UTC");
  ok(JSON.stringify(sched("/api/cron/limits")) === JSON.stringify(["0 7 * * *", "0 8 * * *"]), "vercel.json: limits at 07:00 and 08:00 UTC");
  ok(sched("/api/admin/patch-notes/media-sync").length === 1 && vercel.git?.deploymentEnabled?.main === true && vercel.git?.deploymentEnabled?.["**"] === false, "the old cron and the main-only deploy block are kept");
}

console.log("Both jobs refuse without CRON_SECRET");
{
  const none = cronGate("Bearer anything", undefined);
  ok(!none.ok && none.status === 503 && none.reason === "no-secret" && /CRON_SECRET/.test(none.message), "no secret: refused, and says why");
  ok(!cronGate(null, "  ").ok, "a blank secret counts as none");
  const wrong = cronGate("Bearer nope", "s3cret");
  ok(!wrong.ok && wrong.status === 401 && !/s3cret/.test(wrong.message), "wrong secret: 401, the secret is never echoed");
  ok(!cronGate(null, "s3cret").ok, "no header: refused");
  ok(cronGate("Bearer s3cret", "s3cret").ok, "the right secret: allowed");
  // No user-agent fallback (the patch-notes job's cronAllowed has one; these must not).
  const plan = fs.readFileSync(path.join(process.cwd(), "lib/backup/plan.ts"), "utf8");
  ok(!/user-?agent|vercel-cron/i.test(plan.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "the gate never looks at the user-agent");

  // The real routes, with no CRON_SECRET and no database: both answer 503 and do nothing.
  delete process.env.CRON_SECRET;
  const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { NextRequest } = await import("next/server");
  for (const p of ["backup", "limits"]) {
    const mod = await import(`@/app/api/cron/${p}/route`);
    const res = await mod.GET(new NextRequest(`http://localhost/api/cron/${p}`, { headers: { "user-agent": "vercel-cron/1.0" } }));
    const body = await res.json();
    ok(res.status === 503 && body.refused === true && /CRON_SECRET/.test(body.error), `/api/cron/${p}: refuses with no CRON_SECRET, even as "vercel-cron"`);
    process.env.CRON_SECRET = "s3cret";
    const res2 = await mod.GET(new NextRequest(`http://localhost/api/cron/${p}`, { headers: { authorization: "Bearer wrong" } }));
    ok(res2.status === 401, `/api/cron/${p}: wrong secret is 401`);
    delete process.env.CRON_SECRET;
    ok(typeof mod.maxDuration === "number" && mod.maxDuration <= 300, `/api/cron/${p}: maxDuration ${mod.maxDuration} s fits Vercel Pro`);
  }
  if (saved.key) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
}

console.log("The copy itself, with a fake database and a fake R2");
{
  const { backupTable, pruneOld } = await import("@/lib/backup/server");
  const cfg = { accountId: "0123456789abcdef0123456789abcdef", accessKeyId: "AKIDTEST", secret: "s", bucket: "kib-marketing" };
  const puts: { url: string; body: Buffer }[] = [];
  const deletes: string[] = [];
  const listing = (keys: string[]) => `<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((k) => `<Contents><Key>${k}</Key><Size>10</Size></Contents>`).join("")}</ListBucketResult>`;
  let bucket: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: { method?: string; body?: Uint8Array }) => {
    const m = init?.method ?? "GET";
    if (m === "PUT") puts.push({ url, body: Buffer.from(init!.body!) });
    if (m === "DELETE") deletes.push(decodeURIComponent(new URL(url).pathname.replace("/kib-marketing/", "")));
    if (m === "GET") return new Response(listing(bucket), { status: 200 });
    return new Response("", { status: 200 });
  }) as typeof fetch;
  const rows = Array.from({ length: 45 }, (_, i) => ({ user_id: `u${String(i).padStart(3, "0")}`, slot: 1, career: { n: i } }));
  const asked: [number, number][] = [];
  const fakeSb = {
    from: (table: string) => {
      const q = { select: () => q, order: () => q, range: async (a: number, b: number) => {
        asked.push([a, b]);
        if (table === "gone") return { data: null, error: { code: "42P01", message: "relation does not exist" } };
        return { data: rows.slice(a, b + 1), error: null };
      } };
      return q;
    },
  } as unknown as Parameters<typeof backupTable>[0];
  const t = { table: "star_careers", order: ["user_id", "slot"], page: 20, what: "" };
  const res = await backupTable(fakeSb, cfg, "2026-11-12", t, Date.now() + 60_000);
  ok(res.state === "ok" && res.rows === 45, "45 rows copied in pages of 20");
  ok(JSON.stringify(asked) === JSON.stringify([[0, 19], [20, 39], [40, 59]]), "paged 0-19, 20-39, 40-59, then stopped");
  ok(puts.length === 1 && puts[0].url.includes("/kib-marketing/backups/db/2026-11-12/star_careers.jsonl.gz?"), "one file written, at the right key");
  const lines = gunzipSync(puts[0].body).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  ok(lines.length === 45 && lines[44].career.n === 44 && res.bytes === puts[0].body.length, "the file holds every row; bytes = what was written");
  const gone = await backupTable(fakeSb, cfg, "2026-11-12", { ...t, table: "gone" }, Date.now() + 60_000);
  ok(gone.state === "missing" && puts.length === 1, "a table not in the database: marked missing, nothing written");
  const late = await backupTable(fakeSb, cfg, "2026-11-12", t, Date.now() - 1);
  ok(late.state === "not-reached" && puts.length === 1, "past the time limit: not started, nothing written");

  const today = "2026-11-12";
  const days = Array.from({ length: 70 }, (_, i) => addDays(today, -i));
  bucket = [...days.flatMap((d) => [tableKey(d, "feedback"), manifestKey(d)]), "backups/other/keep.txt", "videos/x/y.mp4", "backups/db/README.txt"];
  const removed = await pruneOld(cfg, today);
  const { remove } = retention(days, today);
  ok(JSON.stringify(removed) === JSON.stringify(remove), "pruning removes exactly the days retention drops");
  ok(deletes.length === remove.length * 2 && deletes.every((k) => k.startsWith("backups/db/") && remove.includes(dayOfKey(k)!)), "only files inside dropped backups/db/<day>/ folders are deleted");
  globalThis.fetch = realFetch;
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
