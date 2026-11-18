/**
 * lib/backup/plan.ts — the nightly database backup and the morning limits post
 * (Harry, 12 Nov 2026: Supabase + Cloudflare plan, projects 3 and 5).
 *
 *   03:00 UK  /api/cron/backup  copies the key tables into R2:
 *             backups/db/<YYYY-MM-DD>/<table>.jsonl.gz  + manifest.json
 *   08:00 UK  /api/cron/limits  posts the limits in #health (database, Storage,
 *             R2, last night's backup), amber at 75 %, red at 90 %.
 *
 * PURE: no fs, no network, no clock (every function takes `now`). The real
 * work is in lib/backup/server.ts. Tests: tests/star/backup.mts.
 * How to restore: docs/backup.md. Bucket layout: docs/r2-layout.md.
 */

/* ── Which tables ───────────────────────────────────────────────────── */

export interface BackupTable {
  /** The table in the public schema ("auth_users" is the sign-in list, read through the admin API). */
  table: string;
  /** Columns to order by, so pages never overlap (the primary key). */
  order: string[];
  /** Rows per page. Careers are big (one whole save per row), so few at a time. */
  page: number;
  /** What it is, in plain words (docs/backup.md lists the same). */
  what: string;
}

const T = (table: string, order: string[], what: string, page = 1000): BackupTable => ({ table, order, page, what });

/** The tables copied every night. Never sofifa_players: the FIFA stats have their own cold copy. */
export const BACKUP_TABLES: readonly BackupTable[] = [
  // Players' careers and what they own
  T("star_careers", ["user_id", "slot"], "every career save (one row per account and slot)", 20),
  T("star_hall_of_fame", ["user_id", "entry_id"], "retired careers in the Hall of Fame", 100),
  T("star_wallet", ["user_id"], "gems each account holds"),
  T("star_wallet_ledger", ["id"], "every gem in and out"),
  T("star_entitlements", ["user_id", "item_id"], "items each account owns"),
  T("star_paid_items", ["item_id"], "the paid item list"),
  T("star_save_flags", ["id"], "save checks that flagged a career"),
  T("star_legend_shares", ["code"], "shared legend cards", 200),
  // Accounts
  T("user_profiles", ["user_id"], "profiles (name, picture, settings)"),
  T("user_roles", ["user_id"], "who is an admin"),
  T("user_xp", ["user_id"], "XP and levels"),
  T("user_stats", ["user_id"], "play stats per account"),
  T("auth_users", ["id"], "the sign-in list (id, email, sign-in dates, settings); read through the admin API", 1000),
  // Feedback and testers
  T("feedback", ["id"], "bug reports and feedback"),
  T("tester_links", ["code"], "tester invite links"),
  // The Team room
  T("team_members", ["user_id"], "who is Harry, Mikey or Leo"),
  T("team_messages", ["id"], "Team room messages"),
  T("team_ideas", ["id"], "ideas board"),
  T("team_idea_votes", ["idea_id", "person"], "idea votes"),
  T("team_tasks", ["id"], "tasks"),
  T("team_notes", ["id"], "notes on patch notes and jobs"),
  T("team_read_marks", ["person"], "read marks"),
  T("team_acks", ["kind", "target", "person"], "Read and understood ticks"),
  T("team_channels", ["slug"], "channels"),
  T("team_reactions", ["message_id", "emoji", "person"], "reactions"),
  T("team_dms", ["id"], "private messages"),
  T("team_bot_posts", ["id"], "bot posts (#bugs, #health)"),
  T("team_status", ["person"], "status lines"),
  T("team_welcome", ["id"], "the welcome note"),
  T("team_welcome_reads", ["person", "version"], "who read the welcome note"),
  T("team_bug_marks", ["post_id"], "bug report marks (handed to, fixed)"),
];

/** Never backed up here, whatever the list says. */
export const NEVER_BACKED_UP = ["sofifa_players"] as const;

export const backupTables = (): BackupTable[] =>
  BACKUP_TABLES.filter((t) => !(NEVER_BACKED_UP as readonly string[]).includes(t.table));

/* ── Keys in R2 ─────────────────────────────────────────────────────── */

export const BACKUP_PREFIX = "backups/db/";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (d: string) => DAY_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
export const dayPrefix = (day: string) => `${BACKUP_PREFIX}${day}/`;
export const tableKey = (day: string, table: string) => `${dayPrefix(day)}${table}.jsonl.gz`;
export const manifestKey = (day: string) => `${dayPrefix(day)}manifest.json`;
/** The day folder a key sits in, or null (anything not shaped backups/db/<day>/... is never touched). */
export function dayOfKey(key: string): string | null {
  if (!key.startsWith(BACKUP_PREFIX)) return null;
  const d = key.slice(BACKUP_PREFIX.length).split("/")[0];
  return isDay(d) && key.length > dayPrefix(d).length ? d : null;
}

/* ── UK time ────────────────────────────────────────────────────────── */

/** The UK date and hour (GMT in winter, BST in summer). */
export function ukClock(now: Date): { day: string; hour: number; weekday: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), weekday: wd };
}

/**
 * Vercel's timed jobs run on UTC. Each job is listed twice in vercel.json (the
 * UTC hour for winter and for summer), and only the call that lands on the UK
 * hour does the work.
 */
export const isUkHour = (now: Date, hour: number) => ukClock(now).hour === hour;
export const BACKUP_UK_HOUR = 3;
export const LIMITS_UK_HOUR = 8;

/* ── Who may start a job ────────────────────────────────────────────── */

export type CronGate = { ok: true } | { ok: false; status: 401 | 503; reason: "no-secret" | "bad-auth"; message: string };

/**
 * The backup and the limits post need CRON_SECRET. No secret = refuse (never
 * the user-agent fallback cronAllowed in lib/patchNoteMedia.ts uses: anyone
 * can send that header). Vercel sends "Authorization: Bearer <CRON_SECRET>"
 * by itself once the setting exists.
 */
export function cronGate(authorization: string | null | undefined, secret: string | undefined): CronGate {
  const s = secret?.trim();
  if (!s) return { ok: false, status: 503, reason: "no-secret", message: "CRON_SECRET is not set in Vercel, so this job refuses to run. Add it in Vercel → Project → Settings → Environment Variables (Production), then redeploy." };
  if ((authorization ?? "") !== `Bearer ${s}`) return { ok: false, status: 401, reason: "bad-auth", message: "Not allowed." };
  return { ok: true };
}

/** A "CRON_SECRET missing" post goes in #health at most this often (anyone can call the URL). */
export const NO_SECRET_POST_EVERY_MS = 12 * 60 * 60 * 1000;

/* ── Which copies to keep ───────────────────────────────────────────── */

export const KEEP_DAILY = 14;
export const KEEP_SUNDAYS = 8;

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const isSunday = (d: string) => new Date(dayMs(d)).getUTCDay() === 0;

/**
 * Keep: the 14 newest UK days up to today, and the 8 newest Sundays.
 * A day in the future (a clock gone wrong) is kept, never deleted.
 * Anything that is not a date folder is left alone.
 */
export function retention(days: readonly string[], today: string): { keep: string[]; remove: string[] } {
  const all = Array.from(new Set(days.filter(isDay))).sort();
  const t = dayMs(today);
  const past = all.filter((d) => dayMs(d) <= t);
  const keep = new Set<string>(all.filter((d) => dayMs(d) > t));
  const daily = past.filter((d) => t - dayMs(d) < KEEP_DAILY * 86_400_000);
  daily.forEach((d) => keep.add(d));
  past.filter(isSunday).slice(-KEEP_SUNDAYS).forEach((d) => keep.add(d));
  return { keep: all.filter((d) => keep.has(d)), remove: all.filter((d) => !keep.has(d)) };
}

/* ── The manifest ───────────────────────────────────────────────────── */

export type TableState = "ok" | "missing" | "failed" | "not-reached";
export interface TableResult {
  table: string;
  key: string;
  state: TableState;
  rows: number;
  /** Bytes in R2 (gzip). */
  bytes: number;
  /** Bytes before gzip. */
  rawBytes: number;
  ms: number;
  error?: string;
}
export interface Manifest {
  version: 1;
  day: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  totalRows: number;
  totalBytes: number;
  tables: TableResult[];
  removedDays: string[];
  never: string[];
}

/** ok = every table either copied or not there yet (a migration not run). A failure or a timeout is not ok. */
export function buildManifest(day: string, started: Date, finished: Date, tables: TableResult[], removedDays: string[] = []): Manifest {
  return {
    version: 1, day,
    startedAt: started.toISOString(), finishedAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    ok: tables.length > 0 && tables.every((t) => t.state === "ok" || t.state === "missing"),
    totalRows: tables.reduce((n, t) => n + t.rows, 0),
    totalBytes: tables.reduce((n, t) => n + t.bytes, 0),
    tables, removedDays, never: [...NEVER_BACKED_UP],
  };
}

/** Is this what a manifest looks like? (The morning post reads it back from R2.) */
export function isManifest(x: unknown): x is Manifest {
  const m = x as Manifest;
  return !!m && m.version === 1 && isDay(m.day) && typeof m.ok === "boolean" && typeof m.totalBytes === "number"
    && typeof m.durationMs === "number" && Array.isArray(m.tables)
    && m.tables.every((t) => typeof t.table === "string" && typeof t.rows === "number" && typeof t.bytes === "number" && typeof t.state === "string");
}

/** "Postgres says the table is not there" (a migration not run yet): PostgREST and Postgres codes. */
export const isMissingTable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

/* ── The morning limits ─────────────────────────────────────────────── */

export type Level = "green" | "amber" | "red" | "unknown";
export const AMBER_AT = 0.75;
export const RED_AT = 0.9;

export function levelOf(used: number | null | undefined, limit: number): Level {
  if (used == null || !Number.isFinite(used) || !(limit > 0)) return "unknown";
  const f = used / limit;
  return f >= RED_AT ? "red" : f >= AMBER_AT ? "amber" : "green";
}

const MB = 1024 * 1024;
const GB = 1024 * MB;
export const LIMITS = {
  database: 500 * MB,
  storage: 1 * GB,
  r2: 10 * GB,
} as const;

export const DOT: Record<Level, string> = { green: "🟢", amber: "🟠", red: "🔴", unknown: "⚪" };

export function sizeWord(b: number): string {
  if (b >= GB) return `${(b / GB).toFixed(2)} GB`;
  if (b >= MB) return `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

/** Sum object sizes by top folder ("videos", "patch-notes", "backups", ...). */
export function sizesByTopFolder(objects: readonly { key: string; size: number }[]): { total: number; folders: { folder: string; bytes: number }[] } {
  const m = new Map<string, number>();
  let total = 0;
  for (const o of objects) {
    const top = o.key.includes("/") ? o.key.split("/")[0] : "(top level)";
    m.set(top, (m.get(top) ?? 0) + o.size);
    total += o.size;
  }
  return { total, folders: Array.from(m, ([folder, bytes]) => ({ folder, bytes })).sort((a, b) => b.bytes - a.bytes) };
}

export interface LimitsInput {
  /** UK date the post is for. */
  day: string;
  dbBytes: number | null;
  storageBytes: number | null;
  r2: { total: number; folders: { folder: string; bytes: number }[] } | null;
  /** Last night's manifest, null = none found. */
  backup: Manifest | null;
  /** Why a reading is missing (shown in the post, never a key). */
  notes?: string[];
}

export interface LimitsPost { title: string; body: string; level: Level; red: boolean; lines: { what: string; level: Level }[] }

const pct = (used: number, limit: number) => `${Math.round((used / limit) * 100)}%`;

export function limitsPost(i: LimitsInput): LimitsPost {
  const lines: { what: string; level: Level; text: string }[] = [];
  const meter = (what: string, used: number | null, limit: number, extra = "") => {
    const level = levelOf(used, limit);
    const text = used == null ? `${DOT.unknown} ${what}: could not read` : `${DOT[level]} ${what}: ${sizeWord(used)} of ${sizeWord(limit)} (${pct(used, limit)})${extra}`;
    lines.push({ what, level, text });
  };
  meter("Database", i.dbBytes, LIMITS.database);
  meter("Supabase Storage", i.storageBytes, LIMITS.storage);
  const top = i.r2?.folders.slice(0, 4).map((f) => `${f.folder} ${sizeWord(f.bytes)}`).join(", ");
  meter("Cloudflare R2", i.r2?.total ?? null, LIMITS.r2, top ? ` · ${top}` : "");

  const b = i.backup;
  let bLevel: Level;
  let bText: string;
  if (!b) { bLevel = "red"; bText = `${DOT.red} Last night's backup: none found for ${i.day}`; }
  else if (!b.ok) {
    bLevel = "red";
    const bad = b.tables.filter((t) => t.state === "failed" || t.state === "not-reached").map((t) => t.table);
    bText = `${DOT.red} Last night's backup: FAILED (${bad.length} table${bad.length === 1 ? "" : "s"}: ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? "…" : ""}), ${sizeWord(b.totalBytes)} saved`;
  } else {
    bLevel = "green";
    const missing = b.tables.filter((t) => t.state === "missing").length;
    bText = `${DOT.green} Last night's backup: OK, ${sizeWord(b.totalBytes)}, ${b.totalRows.toLocaleString("en-GB")} rows, ${b.tables.length - missing} tables in ${Math.round(b.durationMs / 1000)} s${missing ? ` (${missing} not in the database yet)` : ""}`;
  }
  lines.push({ what: "Backup", level: bLevel, text: bText });

  const order: Level[] = ["red", "amber", "unknown", "green"];
  const level = order.find((l) => lines.some((x) => x.level === l)) ?? "green";
  const worst = level === "red" ? "Red: act today" : level === "amber" ? "Amber: getting full" : level === "unknown" ? "Some readings missing" : "All green";
  const body = [...lines.map((l) => l.text), ...(i.notes ?? []).map((n) => `Note: ${n}`)].join("\n").slice(0, 2000);
  return { title: `Morning limits · ${i.day} · ${worst}`.slice(0, 200), body, level, red: level === "red", lines: lines.map(({ what, level }) => ({ what, level })) };
}
