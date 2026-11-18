/**
 * scripts/backup/restore.mts — bring one table back from a night's backup
 * into a SPARE table (<table>_restore), never over the live one.
 * Plain-English steps: docs/backup.md.
 *
 *   npx tsx scripts/backup/restore.mts --day 2026-11-11 --table star_careers --person Mikey
 *   npx tsx scripts/backup/restore.mts --day 2026-11-11 --table feedback --file-only
 *
 * Options
 *   --day YYYY-MM-DD    which night (the folder date in backups/db/)
 *   --table NAME        one table from lib/backup/plan.ts BACKUP_TABLES
 *   --person NAME       only that Team room person's rows (Harry, Mikey, Leo: user_id from team_members)
 *   --where col=value   only rows where col equals value (repeat for more)
 *   --file-only         just save the rows to a file on this computer; no database at all
 *   --append            add to a spare table that already has rows (default: stop)
 *
 * Needs, in .env.local or the shell: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET (copy from Vercel), and unless --file-only,
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * What it changes: only <table>_restore (inserts). It never writes, updates
 * or deletes a live table, and never writes to R2.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { r2ConfigFrom, r2Url } from "@/lib/marketing/r2";
import { BACKUP_TABLES, isDay, tableKey } from "@/lib/backup/plan";

function loadEnvLocal() {
  const f = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function args() {
  const a = process.argv.slice(2);
  const out: { day?: string; table?: string; person?: string; where: [string, string][]; fileOnly: boolean; append: boolean } = { where: [], fileOnly: false, append: false };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === "--day") out.day = a[++i];
    else if (k === "--table") out.table = a[++i];
    else if (k === "--person") out.person = a[++i];
    else if (k === "--where") { const [c, ...v] = (a[++i] ?? "").split("="); if (c && v.length) out.where.push([c, v.join("=")]); }
    else if (k === "--file-only") out.fileOnly = true;
    else if (k === "--append") out.append = true;
    else { console.error(`Unknown option: ${k}`); process.exit(2); }
  }
  return out;
}

const stop = (msg: string): never => { console.error(`\nStopped: ${msg}\n`); process.exit(1); };

async function main() {
  loadEnvLocal();
  const o = args();
  if (!o.day || !isDay(o.day)) stop("give --day YYYY-MM-DD (the backup folder's date).");
  const t = BACKUP_TABLES.find((x) => x.table === o.table);
  if (!t) stop(`give --table, one of: ${BACKUP_TABLES.map((x) => x.table).join(", ")}`);
  const table = t!.table;
  const spare = `${table}_restore`;
  if (!spare.endsWith("_restore") || spare === table) stop("the spare table name must end in _restore.");

  const { config, missing } = r2ConfigFrom(process.env);
  if (!config) stop(`R2 settings missing: ${missing.join(", ")} (copy them from Vercel into .env.local).`);

  const needDb = !o.fileOnly || !!o.person;
  const sb = needDb
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : stop("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (or use --file-only without --person)."))
    : null;

  // 1. Who: --person reads team_members (READ ONLY).
  const where = [...o.where];
  if (o.person) {
    const { data, error } = await sb!.from("team_members").select("user_id").eq("person", o.person).maybeSingle();
    if (error || !data) stop(`no Team room account found for ${o.person}.`);
    where.push([table === "auth_users" ? "id" : "user_id", (data as { user_id: string }).user_id]);
  }

  // 2. Download the night's file from R2 (READ ONLY).
  const key = tableKey(o.day!, table);
  console.log(`Downloading ${key} …`);
  const res = await fetch(r2Url(config!, "GET", key, new Date(), 300), { cache: "no-store" });
  if (res.status === 404) stop(`there is no ${table} file for ${o.day}. Check the day (docs/backup.md: the folder date is the morning after).`);
  if (!res.ok) stop(`storage answered ${res.status}.`);
  const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const all = text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  const rows = all.filter((r) => where.every(([c, v]) => String(r[c]) === v));
  console.log(`${all.length} rows in the file, ${rows.length} match${where.length ? ` (${where.map(([c, v]) => `${c}=${v}`).join(", ")})` : ""}.`);

  // 3. Always keep a copy on this computer, outside the repo.
  const dir = path.join(os.tmpdir(), "kib-backup-restore", o.day!);
  fs.mkdirSync(dir, { recursive: true });
  const local = path.join(dir, `${table}${where.length ? "-filtered" : ""}.jsonl`);
  fs.writeFileSync(local, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  console.log(`Saved on this computer: ${local}`);
  if (o.fileOnly) return;
  if (table === "auth_users") { console.log("The sign-in list is never loaded into a table: use the file above to look things up."); return; }
  if (!rows.length) stop("nothing to load.");

  // 4. The spare table must already exist (made by hand, SQL below), and be empty unless --append.
  const head = await sb!.from(spare).select("*", { count: "exact", head: true });
  if (head.error) {
    console.log(`\nThe spare table ${spare} does not exist yet. Run this in the Supabase SQL Editor, then run this script again:\n`);
    console.log(`-- CHANGES THE DATABASE (adds one empty spare table; the live table is not touched).`);
    console.log(`-- What: an empty copy of ${table}'s columns, called ${spare}.`);
    console.log(`-- Why:  to load the ${o.day} backup next to the live table and compare.`);
    console.log(`CREATE TABLE IF NOT EXISTS public.${spare} (LIKE public.${table} INCLUDING DEFAULTS);`);
    console.log(`ALTER TABLE public.${spare} ENABLE ROW LEVEL SECURITY;  -- no rules = only the service key can see it\n`);
    process.exit(1);
  }
  if ((head.count ?? 0) > 0 && !o.append) stop(`${spare} already has ${head.count} rows. Empty it first (TRUNCATE public.${spare};) or pass --append.`);

  // 5. Load (CHANGES THE DATABASE: the spare table only).
  const batch = Math.max(1, Math.min(200, t!.page));
  let done = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const { error } = await sb!.from(spare).insert(rows.slice(i, i + batch));
    if (error) stop(`loading failed after ${done} rows: ${error.message}`);
    done += Math.min(batch, rows.length - i);
  }
  console.log(`\nLoaded ${done} rows into ${spare}. The live ${table} was not touched.`);
  console.log(`Next: compare, then copy back by hand if wanted (docs/backup.md, "Putting it back").`);
}

main().catch((e) => stop(e instanceof Error ? e.message : String(e)));
