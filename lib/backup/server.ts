/**
 * lib/backup/server.ts — SERVER ONLY. The real work behind lib/backup/plan.ts:
 * read tables with the Supabase service client a page at a time, gzip them as
 * they come (only the gzip output is held, never the whole table as text),
 * write them to R2, and read sizes for the morning post.
 *
 * R2 is the Marketing bucket (R2_* in Vercel, lib/marketing/r2.ts); every
 * key written or deleted here is under backups/db/. Nothing here ever writes
 * to the database except the one #health post (team_bot_posts).
 */
import { createGzip } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseList, r2ConfigFrom, r2Url, type ListedObject, type R2Config } from "@/lib/marketing/r2";
import {
  BACKUP_PREFIX, backupTables, dayOfKey, dayPrefix, isManifest, isMissingTable, manifestKey, retention, tableKey,
  type BackupTable, type Manifest, type TableResult,
} from "./plan";

export const r2Config = (): { config: R2Config | null; missing: string[] } => r2ConfigFrom(process.env);

/* ── R2 ─────────────────────────────────────────────────────────────── */

async function r2Fetch(cfg: R2Config, method: "GET" | "PUT" | "DELETE", key: string, opts: { query?: Record<string, string>; body?: Buffer; type?: string } = {}) {
  const headers = opts.type ? { "content-type": opts.type } : undefined;
  const url = r2Url(cfg, method, key, new Date(), 300, { query: opts.query, headers });
  const res = await fetch(url, { method, body: opts.body ? new Uint8Array(opts.body) : undefined, headers, cache: "no-store" });
  // Never echo the URL: it carries a signature.
  if (!res.ok && res.status !== 404) throw new Error(`Storage answered ${res.status} to a ${method}.`);
  return res;
}

export async function r2List(cfg: R2Config, prefix: string, maxPages = 200): Promise<ListedObject[]> {
  const out: ListedObject[] = [];
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const query: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
    if (prefix) query.prefix = prefix;
    if (token) query["continuation-token"] = token;
    const res = await r2Fetch(cfg, "GET", "", { query });
    if (!res.ok) break;
    const got = parseList(await res.text());
    out.push(...got.objects);
    if (!got.next) break;
    token = got.next;
  }
  return out;
}

export const r2Put = async (cfg: R2Config, key: string, body: Buffer, type: string) => { await r2Fetch(cfg, "PUT", key, { body, type }); };

export async function r2GetText(cfg: R2Config, key: string): Promise<string | null> {
  const res = await r2Fetch(cfg, "GET", key);
  return res.ok ? await res.text() : null;
}

/** Delete one object. Refuses anything outside backups/db/<day>/. */
export async function r2DeleteBackup(cfg: R2Config, key: string) {
  if (!dayOfKey(key)) throw new Error("Refused: not a backup key.");
  await r2Fetch(cfg, "DELETE", key);
}

/* ── One table into one gzip file ───────────────────────────────────── */

class GzipCollector {
  private gz = createGzip({ level: 6 });
  private chunks: Buffer[] = [];
  private done: Promise<void>;
  rawBytes = 0;
  constructor() {
    this.gz.on("data", (c: Buffer) => this.chunks.push(c));
    this.done = new Promise((res, rej) => { this.gz.on("end", () => res()); this.gz.on("error", rej); });
  }
  async line(row: unknown) {
    const s = `${JSON.stringify(row)}\n`;
    this.rawBytes += Buffer.byteLength(s);
    if (!this.gz.write(s)) await new Promise<void>((r) => this.gz.once("drain", () => r()));
  }
  async finish(): Promise<Buffer> { this.gz.end(); await this.done; return Buffer.concat(this.chunks); }
}

type Page = { rows: unknown[]; error: { code?: string; message?: string } | null };

async function readPage(sb: SupabaseClient, t: BackupTable, from: number, order: string[]): Promise<Page> {
  if (t.table === "auth_users") {
    const { data, error } = await sb.auth.admin.listUsers({ page: Math.floor(from / t.page) + 1, perPage: t.page });
    if (error) return { rows: [], error: { message: error.message } };
    const rows = (data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, user_metadata: u.user_metadata ?? {}, app_metadata: u.app_metadata ?? {} }));
    return { rows, error: null };
  }
  let q = sb.from(t.table).select("*");
  for (const c of order) q = q.order(c, { ascending: true });
  const { data, error } = await q.range(from, from + t.page - 1);
  return { rows: (data ?? []) as unknown[], error: error ? { code: error.code, message: error.message } : null };
}

/**
 * Copy one table. Stops starting new pages once `deadline` (ms since epoch)
 * passes: the table is then "not-reached" and nothing is written for it.
 */
export async function backupTable(sb: SupabaseClient, cfg: R2Config, day: string, t: BackupTable, deadline: number): Promise<TableResult> {
  const key = tableKey(day, t.table);
  const start = Date.now();
  const base = { table: t.table, key, rows: 0, bytes: 0, rawBytes: 0 };
  if (Date.now() > deadline) return { ...base, state: "not-reached", ms: 0, error: "Out of time before this table." };
  const gz = new GzipCollector();
  let order = t.order;
  let from = 0;
  try {
    for (;;) {
      if (Date.now() > deadline) return { ...base, rows: from, state: "not-reached", ms: Date.now() - start, error: "Ran out of time part way; nothing saved for this table." };
      let page = await readPage(sb, t, from, order);
      if (page.error?.code === "42703" && order.length > 1) { order = order.slice(0, 1); page = await readPage(sb, t, from, order); }
      if (page.error && !isMissingTable(page.error)) page = await readPage(sb, t, from, order); // one retry
      if (page.error) {
        if (from === 0 && isMissingTable(page.error)) return { ...base, state: "missing", ms: Date.now() - start, error: "Not in the database (migration not run)." };
        return { ...base, rows: from, state: "failed", ms: Date.now() - start, error: (page.error.message ?? "read failed").slice(0, 200) };
      }
      for (const r of page.rows) await gz.line(r);
      from += page.rows.length;
      if (page.rows.length < t.page) break;
    }
    const body = await gz.finish();
    await r2Put(cfg, key, body, "application/gzip");
    return { ...base, rows: from, bytes: body.length, rawBytes: gz.rawBytes, state: "ok", ms: Date.now() - start };
  } catch (e) {
    return { ...base, rows: from, state: "failed", ms: Date.now() - start, error: (e instanceof Error ? e.message : "failed").slice(0, 200) };
  }
}

/** The whole night: every table, the manifest, then old copies removed. */
export async function runBackup(sb: SupabaseClient, cfg: R2Config, day: string, deadline: number,
  build: (results: TableResult[], removed: string[]) => Manifest): Promise<Manifest> {
  const results: TableResult[] = [];
  for (const t of backupTables()) results.push(await backupTable(sb, cfg, day, t, deadline));
  // Old copies go only after tonight's copy is safely written and complete.
  let removed: string[] = [];
  const first = build(results, []);
  if (first.ok) {
    try { removed = await pruneOld(cfg, day); } catch { removed = []; }
  }
  const manifest = build(results, removed);
  await r2Put(cfg, manifestKey(day), Buffer.from(JSON.stringify(manifest, null, 2)), "application/json");
  return manifest;
}

/** Delete day folders the retention rule drops. Only keys under backups/db/<day>/. */
export async function pruneOld(cfg: R2Config, today: string): Promise<string[]> {
  const objects = await r2List(cfg, BACKUP_PREFIX);
  const days = Array.from(new Set(objects.map((o) => dayOfKey(o.key)).filter((d): d is string => !!d)));
  const { remove } = retention(days, today);
  for (const d of remove) {
    for (const o of objects.filter((x) => x.key.startsWith(dayPrefix(d)))) await r2DeleteBackup(cfg, o.key);
  }
  return remove;
}

export async function readManifest(cfg: R2Config, day: string): Promise<Manifest | null> {
  const text = await r2GetText(cfg, manifestKey(day));
  if (!text) return null;
  try { const m = JSON.parse(text); return isManifest(m) ? m : null; } catch { return null; }
}

/* ── Sizes for the morning post (read only) ─────────────────────────── */

/** Database and Storage bytes from ops_limits() (supabase/migrations/ops_limits.sql). null = not readable. */
export async function supabaseSizes(sb: SupabaseClient): Promise<{ dbBytes: number | null; storageBytes: number | null; note?: string }> {
  const { data, error } = await sb.rpc("ops_limits");
  if (error) return { dbBytes: null, storageBytes: null, note: /ops_limits/.test(error.message) || error.code === "PGRST202" ? "run supabase/migrations/ops_limits.sql to read database and Storage sizes" : "could not read database sizes" };
  const row = (Array.isArray(data) ? data[0] : data) as { db_bytes?: number | string; storage_bytes?: number | string } | null;
  const n = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return { dbBytes: n(row?.db_bytes), storageBytes: n(row?.storage_bytes) };
}

/* ── #health posts ──────────────────────────────────────────────────── */

export async function postHealth(sb: SupabaseClient, p: { title: string; body: string; meta: Record<string, unknown> }) {
  const { data, error } = await sb.from("team_bot_posts")
    .insert({ bot: "health", channel: "health", title: p.title, body: p.body, url: null, everyone: false, meta: p.meta })
    .select("id").single();
  if (error) throw new Error(`Could not post in #health: ${error.message}`);
  return (data as { id: number }).id;
}

/** Has a post of this kind gone out since `sinceIso`? (Used so a refusal is not posted again and again.) */
export async function postedSince(sb: SupabaseClient, kind: string, sinceIso: string): Promise<boolean> {
  const { data } = await sb.from("team_bot_posts").select("id").eq("bot", "health").eq("meta->>kind", kind).gte("created_at", sinceIso).limit(1);
  return !!data?.length;
}

/**
 * A job called without CRON_SECRET set: refuse, and say so in #health (at most
 * once every 12 hours, since anyone can call the URL). Never runs the job.
 */
export async function reportNoSecret(sb: SupabaseClient | null, job: "backup" | "limits", message: string, now: Date, everyMs: number): Promise<boolean> {
  if (!sb) return false;
  try {
    if (await postedSince(sb, "no-secret", new Date(now.getTime() - everyMs).toISOString())) return false;
    await postHealth(sb, {
      title: `${job === "backup" ? "Nightly backup" : "Morning limits"} did not run: CRON_SECRET missing`,
      body: message,
      meta: { kind: "no-secret", job, red: true },
    });
    return true;
  } catch { return false; }
}

/** Every object in the bucket, for the R2 total (read only). */
export const r2ListAll = (cfg: R2Config) => r2List(cfg, "", 300);
